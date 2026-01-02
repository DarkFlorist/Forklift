// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

interface IMarket {
	function isForkingMarket() external view returns (bool);
	function participants(uint256 index) external view returns (IReportingParticipant);
}

interface IReportingParticipant {
	function fork() external;
	function redeem(address redeemFor) external returns (bool);
	function getSize() external view returns (uint256);
	function getStake() external view returns (uint256);
	function getPayoutNumerators() external view returns (uint256[] memory);
}

interface IDisputeCrowdsourcer {
	function getMarket() external view returns (IMarket);
	function balanceOf(address owner) external view returns (uint256);
	function getPayoutNumerators() external view returns (uint256[] memory);
}

interface IDisputeWindow {
	function redeem(address redeemFor) external returns (bool);
}

interface IShareToken {
	function claimTradingProceeds(IMarket _market, address _shareHolder, bytes32 _fingerprint) external returns (uint256[] memory _outcomeFees);
}

contract AugurExtraUtilities {
	struct ReportingParticipant {
		uint256 size;
		uint256 stake;
		uint256[] payoutNumerators;
	}
	struct StakeData {
		IMarket market;
		IDisputeCrowdsourcer bond;
		uint256 amount;
		uint256[] payoutNumerators;
	}

	IShareToken shareToken = IShareToken(0x9e4799ff2023819b1272eee430eadf510eDF85f0);

	function exists(address _address) internal view returns (bool) {
		uint256 size;
		assembly { size := extcodesize(_address) }
		return size > 0;
	}

	function getAvailableDisputesFromForkedMarkets(address _disputeCrowdsourcerFactory, address _account, uint256 _offset, uint256 _num) external view returns (StakeData[] memory _data, bool _done) {
		_data = new StakeData[](_num);
		for (uint256 _i = 0; _i < _num; _i++) {
			address _disputeBondAddress = addressFrom(_disputeCrowdsourcerFactory, _offset +_i + 1);
			if (!exists(_disputeBondAddress)) {
				return (_data, true);
			}
			IDisputeCrowdsourcer _bond = IDisputeCrowdsourcer(_disputeBondAddress);
			IMarket _market = _bond.getMarket();
			if (_market == IMarket(address(0x0)) || !_market.isForkingMarket()) {
				continue;
			}
			_data[_i].bond = _bond;
			_data[_i].market = _market;
			_data[_i].amount = _bond.balanceOf(_account);
			_data[_i].payoutNumerators = _bond.getPayoutNumerators();
		}
	}

	function forkAndRedeemReportingParticipants(IReportingParticipant[] memory _reportingParticipants, address _redeemFor) external returns (bool) {
		for (uint256 i = 0; i < _reportingParticipants.length; i++) {
			_reportingParticipants[i].fork();
			_reportingParticipants[i].redeem(_redeemFor);
		}
		return true;
	}

	function addressFrom(address _origin, uint _nonce) internal pure returns (address) {
		if(_nonce <= 0x7f)       return address(uint160(uint256((keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, bytes1(uint8(_nonce))))))));
		if(_nonce <= 0xff)       return address(uint160(uint256((keccak256(abi.encodePacked(bytes1(0xd7), bytes1(0x94), _origin, bytes1(0x81), uint8(_nonce)))))));
		if(_nonce <= 0xffff)     return address(uint160(uint256((keccak256(abi.encodePacked(bytes1(0xd8), bytes1(0x94), _origin, bytes1(0x82), uint16(_nonce)))))));
		if(_nonce <= 0xffffff)   return address(uint160(uint256((keccak256(abi.encodePacked(bytes1(0xd9), bytes1(0x94), _origin, bytes1(0x83), uint24(_nonce)))))));
		if(_nonce <= 0xffffffff) return address(uint160(uint256((keccak256(abi.encodePacked(bytes1(0xda), bytes1(0x94), _origin, bytes1(0x84), uint32(_nonce)))))));
		return address(uint160(uint256((keccak256(abi.encodePacked(bytes1(0xdb), bytes1(0x94), _origin, bytes1(0x85), uint40(_nonce))))))); // more than 2^40 nonces not realistic
	}

	function getReportingParticipantsForMarket(IMarket _market, uint256 _offset, uint256 _num) external view returns (ReportingParticipant[] memory _data, bool _done) {
		_data = new ReportingParticipant[](_num);
		for (uint256 _i = 0; _i < _num; _i++) {
			IReportingParticipant _participant = _market.participants(_offset + _i);
			if (!exists(address(_participant))) {
				return (_data, true);
			}
			_data[_i].size = _participant.getSize();
			_data[_i].stake = _participant.getStake();
			_data[_i].payoutNumerators = _participant.getPayoutNumerators();
		}
	}

	function claimTradingProceedsForMarkets(IMarket[] memory _markets, address _shareHolder) external {
		for (uint256 _i = 0; _i < _markets.length; _i++) {
			shareToken.claimTradingProceeds(_markets[_i], _shareHolder, bytes32(0));
		}
	}

	function redeemStake(IReportingParticipant[] memory _reportingParticipants, IDisputeWindow[] memory _disputeWindows, address _redeemFor) external returns (bool) {
		for (uint256 i=0; i < _reportingParticipants.length; i++) {
			_reportingParticipants[i].redeem(_redeemFor);
		}
		for (uint256 i=0; i < _disputeWindows.length; i++) {
			_disputeWindows[i].redeem(_redeemFor);
		}
		return true;
	}
}
