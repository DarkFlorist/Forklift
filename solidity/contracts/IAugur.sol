pragma solidity 0.8.29;

import { IMarket } from "./IMarket.sol";

interface IAugur {
    function getMarketType(IMarket _market) external view returns (uint256);
}
