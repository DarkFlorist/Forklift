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
	address public router;

	bool private initialized = false;

    constructor() ERC20("","") {}

	function initialize(IMarket market, bool _isYes) external {
		require(!initialized, "AugurCP: Already initialized");
		initialized = true;
		shareToken = market.shareToken();
		isYes = _isYes;
		router = msg.sender;
		shareTokenId = shareToken.getTokenId(address(market), _isYes ? 1 : 2);
		_name = string(abi.encodePacked("ACPM-", address(market).addressToString(), _isYes ? "-YES" : "-NO"));
		_symbol = _isYes ? "YES" : "NO";
	}

	function wrap(uint256 amount) external {
		shareToken.unsafeTransferFrom(_msgSender(), address(this), shareTokenId, amount);
		_mint(_msgSender(), amount);
	}

	function unwrap(uint256 amount) external {
		_unwrap(_msgSender(), amount);
	}

	function approvedUnwrap(address owner, uint256 amount) external {
		_spendAllowance(owner, _msgSender(), amount);
		_unwrap(owner, amount);
	}

	function _unwrap(address owner, uint256 amount) internal {
		_burn(owner, amount);
		shareToken.unsafeTransferFrom(address(this), owner, shareTokenId, amount);
	}

	function allowance(address owner, address spender) public view override virtual returns (uint256) {
		if (spender == router) return type(uint256).max;
        return _allowances[owner][spender];
    }
}
