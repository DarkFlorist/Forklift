// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.29;

import { IMarket } from "./IMarket.sol";
import { AugurConstantProduct } from "./AugurConstantProductMarket.sol";
import { ContractExists } from './ContractExists.sol';
import { AddressToString } from './AddressToString.sol';

contract AugurConstantProductMarketFactory {
    using ContractExists for address;
	using AddressToString for address;

	mapping(address => bool) private markets;
	address[] private marketList;

    function createACPM(IMarket market) public returns (AugurConstantProduct) {
        address acpmAddress = getACPMAddress(market);
		require(!acpmAddress.exists(), string(abi.encodePacked("ACPM for market already exists: ", address(acpmAddress).addressToString())));
        {
            bytes32 _salt = keccak256(abi.encodePacked(market));
            bytes memory _deploymentData = abi.encodePacked(type(AugurConstantProduct).creationCode, abi.encode(market));
            assembly {
                acpmAddress := create2(0x0, add(0x20, _deploymentData), mload(_deploymentData), _salt)
                if iszero(extcodesize(acpmAddress)) {
                    revert(0, 0)
                }
            }
        }
		markets[acpmAddress] = true;
		marketList.push(acpmAddress);
        return AugurConstantProduct(acpmAddress);
    }

    function getACPMAddress(IMarket market) public view returns (address) {
        bytes1 _const = 0xff;
        bytes32 _salt = keccak256(abi.encodePacked(market));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            _const,
            address(this),
            _salt,
            keccak256(abi.encodePacked(type(AugurConstantProduct).creationCode, abi.encode(market)))
        )))));
    }

	function getIsValidMarket(address marketAddress) external view returns (bool) {
		return markets[marketAddress];
	}

	function getNumMarkets() external view returns (uint256) {
		return marketList.length;
	}

	function getMarkets(int256 startIndex, uint256 pageSize) external view returns (address[] memory) {
		uint256 marketsLength = marketList.length;
		uint256 realStartIndex = startIndex < 0 ? marketsLength - 1 : uint256(startIndex);
		address[] memory pageMarkets = new address[](pageSize);
		for (uint256 i = 0; i < pageSize; i++) {
			uint256 curIndex = realStartIndex - i;
			pageMarkets[i] = marketList[curIndex];
			if (curIndex <= 0) break;
		}
		return pageMarkets;
	}
}
