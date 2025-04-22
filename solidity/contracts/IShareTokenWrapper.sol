pragma solidity 0.8.29;

import { IMarket } from "./IMarket.sol";
import { IERC20 } from './IERC20.sol';

interface IShareTokenWrapper is IERC20 {
	function initialize(IMarket market, bool _isYes) external;
	function isYes() external view returns (bool);
	function wrap(uint256 amount) external;
	function unwrap(uint256 amount) external;
}
