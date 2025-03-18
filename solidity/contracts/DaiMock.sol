// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.29;

import { ERC20 } from "./ERC20.sol";

contract Dai is ERC20 {
	constructor() ERC20("DAI", "DAI") { }

	function mint(uint256 amount) external {
		_mint(msg.sender, amount);
	}

	function burn(uint256 amount) external {
		_burn(msg.sender, amount);
	}
}
