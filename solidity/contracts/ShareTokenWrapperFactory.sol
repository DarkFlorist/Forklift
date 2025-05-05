pragma solidity 0.8.29;

import { ShareTokenWrapper } from './ShareTokenWrapper.sol';


contract ShareTokenWrapperFactory {

	address public routerAddress;
	bool public isInitialized = false;

	function initialize(address _routerAddress) external {
		require(!isInitialized, "AugurCP: already initialized");
		isInitialized = true;
		routerAddress = _routerAddress;
	}

	function createShareToken(address market, uint8 count) external returns (address shareTokenWrapperAddress) {
		require(msg.sender == routerAddress, "AugurCP: Only router address permitted");
		{
			bytes32 _salt = keccak256(abi.encodePacked(market, count));
			bytes memory _deploymentData = abi.encodePacked(type(ShareTokenWrapper).creationCode);
			assembly {
				shareTokenWrapperAddress := create2(0x0, add(0x20, _deploymentData), mload(_deploymentData), _salt)
				if iszero(extcodesize(shareTokenWrapperAddress)) {
					mstore(0x00, 0x20) // offset
					mstore(0x20, 0x17) // length
					mstore(0x40, 0x6372656174655368617265546F6B656E204661696C6564) // message ("createShareToken Failed")
					revert(0x00, 0x60)
				}
			}
		}
	}
}
