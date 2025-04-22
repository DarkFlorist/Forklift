pragma solidity 0.8.29;

import { IShareToken } from "./IShareToken.sol";
import { IMarket } from "./IMarket.sol";
import { ERC20 } from './ERC20.sol';
import { AddressToString } from "./AddressToString.sol";

contract ShareTokenWrapper is ERC20 {
	using AddressToString for address;

	IShareToken public shareToken;
	uint256 public shareTokenId;
	bool public isYes;

	bool private initialized = false;

    constructor() ERC20("","") {}

	function initialize(IMarket market, bool _isYes) external {
		require(!initialized, "AugurCP: Already initialized");
		initialized = true;
		shareToken = market.shareToken();
		isYes = _isYes;
		shareTokenId = shareToken.getTokenId(address(market), _isYes ? 1 : 2);
		_name = string(abi.encodePacked("ACPM-", address(market).addressToString(), _isYes ? "-YES" : "-NO"));
		_symbol = _isYes ? "YES" : "NO";
	}

	function wrap(uint256 amount) external {
		shareToken.unsafeTransferFrom(msg.sender, address(this), shareTokenId, amount);
		_mint(msg.sender, amount);
	}

	function unwrap(uint256 amount) external {
		_burn(msg.sender, amount);
		shareToken.unsafeTransferFrom(address(this), msg.sender, shareTokenId, amount);
	}
}
