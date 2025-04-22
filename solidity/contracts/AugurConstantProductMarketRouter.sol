// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.29;

import { IERC1155 } from "./IERC1155.sol";
import { IERC20 } from "./IERC20.sol";
import { IShareToken } from "./IShareToken.sol";
import { IMarket } from "./IMarket.sol";
import { IAugur } from "./IAugur.sol";
import { IAugurConstantProduct } from "./IAugurConstantProduct.sol";
import { Constants } from "./Constants.sol";
import { PoolIdLibrary, PoolId } from "./uniswap/types/PoolId.sol";
import { PositionInfo, PositionInfoLibrary } from "./uniswap/libraries/PositionInfoLibrary.sol";
import { PoolKey } from "./uniswap/types/PoolKey.sol";
import { Currency, CurrencyLibrary } from "./uniswap/types/Currency.sol";
import { IPositionManager } from "./uniswap/interfaces/IPositionManager.sol";
import { Actions } from "./uniswap/libraries/Actions.sol";
import { IShareTokenWrapper } from "./IShareTokenWrapper.sol";
import { IPoolManager } from './uniswap/interfaces/IPoolManager.sol';
import { IHooks } from './uniswap/interfaces/IHooks.sol';
import { ShareTokenWrapper } from './ShareTokenWrapper.sol';
import { TickMath } from "./uniswap/libraries/TickMath.sol";
import { LiquidityAmounts } from "./uniswap/libraries/LiquidityAmounts.sol";
import { StateLibrary } from "./uniswap/libraries/StateLibrary.sol";
import { IAllowanceTransfer } from "./uniswap/interfaces/external/IAllowanceTransfer.sol";

contract AugurConstantProductRouter {
	using CurrencyLibrary for uint256;

	mapping(address => PoolKey) public marketIds;
	PoolKey[] private marketList;
	uint24 public constant feePips = 50_000; // 5% fee
	int24 public constant tickSpacing = 1000; // NOTE: follows general fee -> tickSPacing convention but may need tweaking.
	uint160 private constant startingPrice = 79228162514264337593543950336; // 1:1 pricing magic number. The startingPrice is expressed as sqrtPriceX96: floor(sqrt(token1 / token0) * 2^96)

	IShareToken public shareToken = IShareToken(Constants.SHARE_TOKEN);
	IERC20 public dai = IERC20(Constants.DAI_ADDRESS);
	IAugur public constant augur = IAugur(Constants.AUGUR_ADDRESS);
	uint256 private constant numTicks = 1000;

	bytes private constant MINT_LIQUIDITY_ACTIONS = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
	bytes private constant INCREASE_LIQUIDITY_ACTIONS = abi.encodePacked(uint8(Actions.INCREASE_LIQUIDITY), uint8(Actions.SETTLE_PAIR));
	bytes private constant DECREASE_LIQUIDITY_ACTIONS = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
	bytes private constant BURN_LIQUIDITY_ACTIONS = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR)); // TODO Confirm this handles collecting fees

	constructor() {
		dai.approve(Constants.SHARE_TOKEN, 2**256-1);
		dai.approve(Constants.AUGUR_ADDRESS, 2**256-1);
	}

	function mintLiquidity(address augurMarketAddress, uint256 setsToBuy, int24 tickLower, int24 tickUpper, uint128 amountNo, uint128 amountYes, uint256 deadline) external {
		dai.transferFrom(msg.sender, address(this), setsToBuy * numTicks);
		shareToken.buyCompleteSets(augurMarketAddress, address(this), setsToBuy);

		PoolKey memory poolKey = marketIds[augurMarketAddress];
		PoolId poolId = PoolIdLibrary.toId(poolKey);

		IShareTokenWrapper noShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency0));
		IShareTokenWrapper yesShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency1));

		yesShareToken.wrap(setsToBuy);
		noShareToken.wrap(setsToBuy);

		bytes[] memory params = new bytes[](2);

		uint256 liquidity = getExpectedLiquidityInternal(poolId, tickLower, tickUpper, amountNo, amountYes);
		params[0] = abi.encode(poolKey, tickLower, tickUpper, liquidity, amountNo, amountYes, address(this), "");
		params[1] = abi.encode(poolKey.currency0, poolKey.currency1);

		IPositionManager(Constants.UNIV4_POSITION_MANAGER).modifyLiquidities(abi.encode(MINT_LIQUIDITY_ACTIONS, params), deadline);

		if (setsToBuy != amountYes) yesShareToken.transfer(msg.sender, setsToBuy - amountYes);
		if (setsToBuy != amountNo) noShareToken.transfer(msg.sender, setsToBuy - amountNo);
		shareToken.unsafeTransferFrom(address(this), msg.sender, shareToken.getTokenId(augurMarketAddress, 0), setsToBuy);
	}

    function increaseLiquidity(address augurMarketAddress, uint256 tokenId, uint256 setsToBuy, uint128 amountNo, uint128 amountYes, uint256 deadline) external {
		dai.transferFrom(msg.sender, address(this), setsToBuy * numTicks);
		shareToken.buyCompleteSets(augurMarketAddress, address(this), setsToBuy);

		PoolKey memory poolKey = marketIds[augurMarketAddress];
		PoolId poolId = PoolIdLibrary.toId(poolKey);
		PositionInfo positionInfo = IPositionManager(Constants.UNIV4_POSITION_MANAGER).positionInfo(tokenId);

		IShareTokenWrapper noShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency0));
		IShareTokenWrapper yesShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency1));

		yesShareToken.wrap(setsToBuy);
		noShareToken.wrap(setsToBuy);

		bytes[] memory params = new bytes[](2);

		uint256 liquidity = getExpectedLiquidityInternal(poolId, PositionInfoLibrary.tickLower(positionInfo), PositionInfoLibrary.tickUpper(positionInfo), amountNo, amountYes);
		params[0] = abi.encode(tokenId, liquidity, amountNo, amountYes, "");
		params[1] = abi.encode(poolKey.currency0, poolKey.currency1);

		IPositionManager(Constants.UNIV4_POSITION_MANAGER).modifyLiquidities(abi.encode(INCREASE_LIQUIDITY_ACTIONS, params), deadline);

		if (setsToBuy != amountYes) yesShareToken.transfer(msg.sender, setsToBuy - amountYes);
		if (setsToBuy != amountNo) noShareToken.transfer(msg.sender, setsToBuy - amountNo);
		shareToken.unsafeTransferFrom(address(this), msg.sender, shareToken.getTokenId(augurMarketAddress, 0), setsToBuy);
	}

	function getExpectedLiquidity(address augurMarketAddress, int24 tickLower, int24 tickUpper, uint128 amountNo, uint128 amountYes) external view returns (uint256) {
		PoolKey memory poolKey = marketIds[augurMarketAddress];
		PoolId poolId = PoolIdLibrary.toId(poolKey);

		return getExpectedLiquidityInternal(poolId, tickLower, tickUpper, amountNo, amountYes);
	}

	function getExpectedLiquidityInternal(PoolId poolId, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max) internal view returns (uint256) {
		(uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = StateLibrary.getSlot0(IPoolManager(Constants.UNIV4_POOL_MANAGER), poolId);
		return LiquidityAmounts.getLiquidityForAmounts(
			sqrtPriceX96,
			TickMath.getSqrtPriceAtTick(tickLower),
			TickMath.getSqrtPriceAtTick(tickUpper),
			amount0Max,
			amount1Max
		);
	}

	function decreaseLiquidity(address augurMarketAddress, uint256 tokenId, uint256 liquidity, uint128 amountNoMin, uint128 amountYesMin, uint256 deadline) external {
		PoolKey memory poolKey = marketIds[augurMarketAddress];

		IShareTokenWrapper noShareTokenWrapper = IShareTokenWrapper(Currency.unwrap(poolKey.currency0));
		IShareTokenWrapper yesShareTokenWrapper = IShareTokenWrapper(Currency.unwrap(poolKey.currency1));

		bytes[] memory params = new bytes[](2);

		params[0] = abi.encode(tokenId, liquidity, amountNoMin, amountYesMin, "");
		params[1] = abi.encode(poolKey.currency0, poolKey.currency1, address(this));

		IPositionManager(Constants.UNIV4_POSITION_MANAGER).modifyLiquidities(abi.encode(DECREASE_LIQUIDITY_ACTIONS, params), deadline);

		settleRemovedLiquidity(augurMarketAddress, noShareTokenWrapper, yesShareTokenWrapper);
	}

	function burnLiquidity(address augurMarketAddress, uint256 tokenId, uint128 amountNoMin, uint128 amountYesMin, uint256 deadline) external {
		PoolKey memory poolKey = marketIds[augurMarketAddress];

		IShareTokenWrapper noShareTokenWrapper = IShareTokenWrapper(Currency.unwrap(poolKey.currency0));
		IShareTokenWrapper yesShareTokenWrapper = IShareTokenWrapper(Currency.unwrap(poolKey.currency1));

		bytes[] memory params = new bytes[](2);

		params[0] = abi.encode(tokenId, amountNoMin, amountYesMin, "");
		params[1] = abi.encode(poolKey.currency0, poolKey.currency1, address(this));

		IPositionManager(Constants.UNIV4_POSITION_MANAGER).modifyLiquidities(abi.encode(BURN_LIQUIDITY_ACTIONS, params), deadline);

		settleRemovedLiquidity(augurMarketAddress, noShareTokenWrapper, yesShareTokenWrapper);
	}

	function settleRemovedLiquidity(address augurMarketAddress, IShareTokenWrapper noShareTokenWrapper, IShareTokenWrapper yesShareTokenWrapper) internal {
		uint256 invalidShares = shareToken.balanceOfMarketOutcome(augurMarketAddress, 0, msg.sender);
		uint256 noSharesReceived = noShareTokenWrapper.balanceOf(address(this));
		uint256 yesSharesReceived = yesShareTokenWrapper.balanceOf(address(this));

		uint256 completeSetsToSell = invalidShares;
		completeSetsToSell = noSharesReceived < completeSetsToSell ? noSharesReceived : completeSetsToSell;
		completeSetsToSell = yesSharesReceived < completeSetsToSell ? yesSharesReceived : completeSetsToSell;

		uint256 invalidId = shareToken.getTokenId(augurMarketAddress, 0);
		shareToken.unsafeTransferFrom(msg.sender, address(this), invalidId, completeSetsToSell);
		noShareTokenWrapper.unwrap(completeSetsToSell);
		yesShareTokenWrapper.unwrap(completeSetsToSell);
		shareToken.sellCompleteSets(augurMarketAddress, address(this), msg.sender, completeSetsToSell, bytes32(0));

		if (noSharesReceived > completeSetsToSell) noShareTokenWrapper.transfer(msg.sender, noSharesReceived - completeSetsToSell);
		if (yesSharesReceived > completeSetsToSell) yesShareTokenWrapper.transfer(msg.sender, yesSharesReceived - completeSetsToSell);
	}

	function getExpectedAmountsFromLiquidity(address augurMarketAddress, int24 tickLower, int24 tickUpper, uint128 amountNo, uint128 amountYes) external view returns (uint256) {
		PoolKey memory poolKey = marketIds[augurMarketAddress];
		PoolId poolId = PoolIdLibrary.toId(poolKey);

		IShareTokenWrapper yesShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency0));

		bool currency0IsYes = yesShareToken.isYes();
		uint128 amount0Max = currency0IsYes ? amountYes : amountNo;
		uint128 amount1Max = currency0IsYes ? amountNo : amountYes;

		return getExpectedLiquidityInternal(poolId, tickLower, tickUpper, amount0Max, amount1Max);
	}

	function getExpectedAmountsFromLiquidityInternal(PoolId poolId, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max) internal view returns (uint256) {
		(uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = StateLibrary.getSlot0(IPoolManager(Constants.UNIV4_POOL_MANAGER), poolId);
		return LiquidityAmounts.getLiquidityForAmounts(
			sqrtPriceX96,
			TickMath.getSqrtPriceAtTick(tickLower),
			TickMath.getSqrtPriceAtTick(tickUpper),
			amount0Max,
			amount1Max
		);
	}

	uint256 counter;
	function enterPosition(IAugurConstantProduct acpm, uint256 amountInDai, bool buyYes, uint256 minSharesOut, uint256 deadline) external {
		counter++;
	}

	function exitPosition(IAugurConstantProduct acpm, uint256 daiToBuy, uint256 maxSharesIn, uint256 deadline) external {
		counter++;
	}

	function buyShares(address augurMarketAddress, uint256 setsToBuy) external {
		dai.transferFrom(msg.sender, address(this), setsToBuy * numTicks);
		shareToken.buyCompleteSets(augurMarketAddress, address(this), setsToBuy);

		PoolKey memory poolKey = marketIds[augurMarketAddress];

		IShareTokenWrapper yesShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency0));
		IShareTokenWrapper noShareToken = IShareTokenWrapper(Currency.unwrap(poolKey.currency1));

		yesShareToken.wrap(setsToBuy);
		noShareToken.wrap(setsToBuy);

		yesShareToken.transfer(msg.sender, setsToBuy);
		noShareToken.transfer(msg.sender, setsToBuy);
		shareToken.unsafeTransferFrom(address(this), msg.sender, shareToken.getTokenId(augurMarketAddress, 0), setsToBuy);
	}

	function getShareTokenWrappers(address augurMarketAddress) public view returns (address no, address yes) {
		PoolKey memory poolKey = marketIds[augurMarketAddress];
		no = Currency.unwrap(poolKey.currency0);
		yes = Currency.unwrap(poolKey.currency1);
	}

	function getShareBalances(address augurMarketAddress, address owner) external view returns (uint256 invalidBalance, uint256 noBalance, uint256 yesBalance) {
		invalidBalance = shareToken.balanceOfMarketOutcome(augurMarketAddress, 0, owner);
		(address noAddress, address yesAddress) = getShareTokenWrappers(augurMarketAddress);
		IShareTokenWrapper noShareTokenWrapper = IShareTokenWrapper(noAddress);
		IShareTokenWrapper yesShareTokenWrapper = IShareTokenWrapper(yesAddress);
		noBalance = noShareTokenWrapper.balanceOf(owner);
		yesBalance = yesShareTokenWrapper.balanceOf(owner);
	}

	function createACPM(IMarket market) public returns (PoolKey memory) {
		require(marketIds[address(market)].fee != feePips, string(abi.encodePacked("ACPM for market already exists. PoolId: ", PoolIdLibrary.toId(marketIds[address(market)]))));

		address shareTokenWrapperAddress0 = createShareToken(address(market), 0);
		address shareTokenWrapperAddress1 = createShareToken(address(market), 1);

		// We ensure that currency0 is always No and currency1 is always Yes
		bool oneGreater = uint160(shareTokenWrapperAddress0) < uint160(shareTokenWrapperAddress1);
		IShareTokenWrapper(shareTokenWrapperAddress0).initialize(market, !oneGreater);
		IShareTokenWrapper(shareTokenWrapperAddress1).initialize(market, oneGreater);
		address yesShareTokenWrapperAddress = oneGreater ? shareTokenWrapperAddress1 : shareTokenWrapperAddress0;
		address noShareTokenWrapperAddress = oneGreater ? shareTokenWrapperAddress0 : shareTokenWrapperAddress1;

		IShareTokenWrapper(noShareTokenWrapperAddress).approve(Constants.PERMIT2, 2**256-1);
		IShareTokenWrapper(yesShareTokenWrapperAddress).approve(Constants.PERMIT2, 2**256-1);
		IAllowanceTransfer(Constants.PERMIT2).approve(noShareTokenWrapperAddress ,Constants.UNIV4_POSITION_MANAGER, 2**160-1, Constants.YEAR_2099);
		IAllowanceTransfer(Constants.PERMIT2).approve(yesShareTokenWrapperAddress, Constants.UNIV4_POSITION_MANAGER, 2**160-1, Constants.YEAR_2099);

		shareToken.setApprovalForAll(address(noShareTokenWrapperAddress), true);
		shareToken.setApprovalForAll(address(yesShareTokenWrapperAddress), true);

		bool noGreater = uint160(yesShareTokenWrapperAddress) < uint160(noShareTokenWrapperAddress);

		PoolKey memory pool = PoolKey({
			currency0: noGreater ? CurrencyLibrary.fromId(uint160(yesShareTokenWrapperAddress)) : CurrencyLibrary.fromId(uint160(noShareTokenWrapperAddress)),
			currency1: noGreater ? CurrencyLibrary.fromId(uint160(noShareTokenWrapperAddress)) : CurrencyLibrary.fromId(uint160(yesShareTokenWrapperAddress)),
			fee: feePips,
			tickSpacing: tickSpacing,
			hooks: IHooks(address(0))
		});

		IPoolManager(Constants.UNIV4_POOL_MANAGER).initialize(pool, startingPrice);
		marketIds[address(market)] = pool;
		marketList.push(pool);
        return pool;
    }

	function createShareToken(address market, uint8 count) private returns (address shareTokenWrapperAddress) {
		{
            bytes32 _salt = keccak256(abi.encodePacked(market, count));
            bytes memory _deploymentData = abi.encodePacked(type(ShareTokenWrapper).creationCode);
            assembly {
                shareTokenWrapperAddress := create2(0x0, add(0x20, _deploymentData), mload(_deploymentData), _salt)
                if iszero(extcodesize(shareTokenWrapperAddress)) {
                    revert(0, 0)
                }
            }
        }
	}

	function getNumMarkets() external view returns (uint256) {
		return marketList.length;
	}

	function getMarkets(int256 startIndex, uint256 pageSize) external view returns (PoolKey[] memory) {
		uint256 marketsLength = marketList.length;
		uint256 realStartIndex = startIndex < 0 ? marketsLength - 1 : uint256(startIndex);
		PoolKey[] memory pageMarkets = new PoolKey[](pageSize);
		for (uint256 i = 0; i < pageSize; i++) {
			uint256 curIndex = realStartIndex - i;
			pageMarkets[i] = marketList[curIndex];
			if (curIndex <= 0) break;
		}
		return pageMarkets;
	}
}
