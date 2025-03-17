// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import { IERC20 } from "./IERC20.sol";

contract ShareToken {

	IERC20 public dai;
	mapping (address => mapping(uint256 => uint256)) public balanceOf;
	mapping (address => mapping(address => bool)) public isApprovedForAll;
	uint128 public feeNumerator = 1;
	uint128 public feeDenominator = 100;
	uint256 public numOutcomes = 2; // hard coded for MVP
	uint256 public numTicks = 100; // hard coded for MVP

	event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
	event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
	event ApprovalForAll(address indexed account, address indexed operator, bool approved);

	constructor(IERC20 _dai) {
		dai = _dai;
	}

	function setApprovalForAll(address operator, bool approved) public {
		isApprovedForAll[msg.sender][operator] = approved;
		emit ApprovalForAll(msg.sender, operator, approved);
	}

	function unsafeTransferFrom(address from, address to, uint256 id, uint256 amount) public {
		require(to != address(0), "ERC1155: transfer to the zero address");
		require(from == msg.sender || isApprovedForAll[from][msg.sender], "ERC1155: caller is not owner nor approved");

		balanceOf[from][id] = balanceOf[from][id] - amount;
		balanceOf[to][id] = balanceOf[to][id] + amount;

		emit TransferSingle(msg.sender, from, to, id, amount);
	}

	function unsafeBatchTransferFrom(address from, address to, uint256[] memory tokenIds, uint256[] memory values) public {
		require(tokenIds.length == values.length, "ERC1155: Batch Transfer: Token IDs length != values length");
		require(to != address(0), "ERC1155: Batch Transfer: Cannot send to 0 address.");
		require(from == msg.sender || isApprovedForAll[from][msg.sender], "ERC1155: Batch Transfer: 'msg.sender' not approved to send 'from' tokens.");
		for (uint256 i = 0; i < tokenIds.length; ++i) {
			uint256 tokenId = tokenIds[i];
			uint256 value = values[i];
			balanceOf[from][tokenId] = balanceOf[from][tokenId] - value;
			balanceOf[to][tokenId] = balanceOf[to][tokenId] + value;
			emit TransferBatch(msg.sender, from, to, tokenIds, values);
		}
	}

	function publicBuyCompleteSets(address market, uint256 amount) external returns (bool) {
		uint256 cost = amount * numTicks;

		dai.transferFrom(msg.sender, address(this), cost);

		for (uint256 i = 0; i <= numOutcomes; ++i) {
			uint256 tokenId = getTokenId(market, i);
			balanceOf[msg.sender][tokenId] = balanceOf[msg.sender][tokenId] + amount;
		}

		return true;
	}

	function publicSellCompleteSets(address market, uint256 amount) external returns (bool) {
		uint256 payment = amount * numTicks * feeNumerator / feeDenominator;

		for (uint256 i = 0; i <= numOutcomes; ++i) {
			uint256 tokenId = getTokenId(market, i);
			balanceOf[msg.sender][tokenId] = balanceOf[msg.sender][tokenId] - amount;
		}

		dai.transfer(msg.sender, payment);

		return true;
	}

	function getTokenId(address market, uint256 outcome) public pure returns (uint256 tokenId) {
		bytes memory tokenIdBytes = abi.encodePacked(market, uint8(outcome));
		assembly { tokenId := mload(add(tokenIdBytes, add(0x20, 0))) }
	}

	function balanceOfBatch(address[] calldata owners, uint256[] calldata tokenIds) external view returns (uint256[] memory) {
		require(owners.length == tokenIds.length, "EIP 1155: batch balance requires same length owners and ids");
		uint256[] memory balances = new uint256[](owners.length);
		for (uint256 i = 0; i < owners.length; ++i) {
			address owner = owners[i];
			uint256 tokenId = tokenIds[i];
			balances[i] = balanceOf[owner][tokenId];
		}
		return balances;
	}
}
