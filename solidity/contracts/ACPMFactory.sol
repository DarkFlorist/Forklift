// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.29;

import { IMarket } from "./IMarket.sol";
import { AugurConstantProduct } from "./AugurConstantProductMarket.sol";
import { ContractExists } from './ContractExists.sol';

contract ACPMFactory {
    using ContractExists for address;

    function createACPM(IMarket market, string calldata name, string calldata symbol) public returns (AugurConstantProduct) {
        address acpmAddress = getACPMAddress(market, name, symbol);
        if (acpmAddress.exists()) {
            return AugurConstantProduct(acpmAddress);
        }
        {
            bytes32 _salt = keccak256(abi.encodePacked(market, name, symbol));
            bytes memory _deploymentData = abi.encodePacked(type(AugurConstantProduct).creationCode, abi.encode(market, name, symbol));
            assembly {
                acpmAddress := create2(0x0, add(0x20, _deploymentData), mload(_deploymentData), _salt)
                if iszero(extcodesize(acpmAddress)) {
                    revert(0, 0)
                }
            }
        }
        AugurConstantProduct acpm = AugurConstantProduct(acpmAddress);
        return acpm;
    }

    function getACPMAddress(IMarket market, string calldata name, string calldata symbol) public view returns (address) {
        bytes1 _const = 0xff;
        bytes32 _salt = keccak256(abi.encodePacked(market, name, symbol));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            _const,
            address(this),
            _salt,
            keccak256(abi.encodePacked(type(AugurConstantProduct).creationCode, abi.encode(market, name, symbol)))
        )))));
    }
}