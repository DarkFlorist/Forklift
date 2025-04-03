pragma solidity 0.8.29;

library AddressToString {

	bytes16 private constant HEX_DIGITS = "0123456789abcdef";

    function addressToString(address _address) internal pure returns (string memory) {
		uint256 value = uint256(uint160(_address));
        bytes memory buffer = new bytes(2 * 20 + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * 20 + 1; i > 1; --i) {
            buffer[i] = HEX_DIGITS[value & 0xf];
            value >>= 4;
        }
        return string(buffer);
    }
}
