pragma solidity 0.8.29;


interface IShareTokenWrapperFactory {
	function createShareToken(address market, uint8 count) external returns (address shareTokenWrapperAddress);
}
