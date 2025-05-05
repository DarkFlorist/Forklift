
import { mainnet } from 'viem/chains'
import { AugurConstantProductRouter, IPositionManager } from '../VendoredAugurConstantProductMarket.js'
import { ReadClient, WriteClient } from './ethereumWallet'
import { PROXY_DEPLOYER_ADDRESS, UNIV4_POSITION_MANAGER } from './constants.js'
import { getContractAddress, numberToBytes } from 'viem'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { ERC1155_ABI } from '../ABI/Erc1155.js'

export function getAugurConstantProductMarketRouterAddress() {
	const bytecode: `0x${ string }` = `0x${ AugurConstantProductRouter.evm.bytecode.object }`
	return getContractAddress({ bytecode, from: PROXY_DEPLOYER_ADDRESS, opcode: 'CREATE2', salt: numberToBytes(0) })
}

export const isAugurConstantProductMarketRouterDeployed = async (client: ReadClient) => {
	const expectedDeployedBytecode: `0x${ string }` = `0x${ AugurConstantProductRouter.evm.deployedBytecode.object }`
	const address = getAugurConstantProductMarketRouterAddress()
	const deployedBytecode = await client.getCode({ address })
	return deployedBytecode === expectedDeployedBytecode
}

export const deployAugurConstantProductMarketRouterTransaction = () => {
	const bytecode: `0x${ string }` = `0x${ AugurConstantProductRouter.evm.bytecode.object }`
	return { to: PROXY_DEPLOYER_ADDRESS, data: bytecode } as const
}

export const deployAugurConstantProductMarketRouter = async (writeClient: WriteClient) => {
	const hash = await writeClient.sendTransaction(deployAugurConstantProductMarketRouterTransaction())
	await writeClient.waitForTransactionReceipt({ hash })
}

export const getAugurConstantProductMarket = async (client: ReadClient, marketAddress: AccountAddress) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'marketIds',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress]
	})
}

export const isThereAugurConstantProductmarket = async (client: ReadClient, marketAddress: AccountAddress) => {
	return (await getAugurConstantProductMarket(client, marketAddress))[2] > 0n
}

export const deployAugurConstantProductMarket = async (client: WriteClient, marketAddress: AccountAddress) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'createACPM',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress]
	})
}

export const getExpectedLiquidity = async (client: ReadClient, marketAddress: AccountAddress, tickLower: number, tickUpper: number, amountNo: EthereumQuantity, amountYes: EthereumQuantity) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'getExpectedLiquidity',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, tickLower, tickUpper, amountNo, amountYes]
	})
}

export const getNumMarkets = async (client: ReadClient) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'getNumMarkets',
		address: getAugurConstantProductMarketRouterAddress(),
		args: []
	})
}

export const getMarketIsValid = async (client: ReadClient, marketAddress: AccountAddress) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'getMarketIsValid',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress]
	})
}

export const getMarkets = async (client: ReadClient, startIndex: EthereumQuantity, pageSize: EthereumQuantity) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'getMarkets',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [startIndex, pageSize]
	})
}

export const getShareBalances = async (client: ReadClient, marketAddress: AccountAddress, owner: AccountAddress) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'getShareBalances',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, owner]
	})
}

export const getPoolKey = async (client: ReadClient, marketAddress: AccountAddress) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'marketIds',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress]
	})
}

export const getNextPositionManagerToken = async (client: ReadClient) => {
	return await client.readContract({
		abi: IPositionManager.abi,
		functionName: 'nextTokenId',
		address: UNIV4_POSITION_MANAGER,
		args: []
	})
}

export const getPoolLiquidityBalance = async (client: WriteClient, tokenId: EthereumQuantity) => {
	return await client.readContract({
		abi: IPositionManager.abi,
		functionName: 'getPositionLiquidity',
		address: UNIV4_POSITION_MANAGER,
		args: [tokenId]
	})
}

export const getLastPositionInfo = async (client: ReadClient) => {
	const nextTokenId = await client.readContract({
		abi: IPositionManager.abi,
		functionName: 'nextTokenId',
		address: UNIV4_POSITION_MANAGER,
		args: []
	})
	return await client.readContract({
		abi: IPositionManager.abi,
		functionName: 'getPositionLiquidity',
		address: UNIV4_POSITION_MANAGER,
		args: [nextTokenId - 1n]
	})
}

export const getShareWrappers = async (client: ReadClient, marketAddress: AccountAddress) => {
	return await client.readContract({
		abi: AugurConstantProductRouter.abi,
		functionName: 'getShareTokenWrappers',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress]
	})
}

export const mintLiquidity = async (client: WriteClient, marketAddress: AccountAddress, sharesToBuy: EthereumQuantity, tickLower: number, tickUpper: number, amountNoMax: EthereumQuantity, amountYesMax: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'mintLiquidity',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, sharesToBuy, tickLower, tickUpper, amountNoMax, amountYesMax, deadline]
	})
}

export const increaseLiquidity = async (client: WriteClient, marketAddress: AccountAddress, tokenId: EthereumQuantity, sharesToBuy: EthereumQuantity, amountNoMax: EthereumQuantity, amountYesMax: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'increaseLiquidity',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, tokenId, sharesToBuy, amountNoMax, amountYesMax, deadline]
	})
}

export const decreaseLiquidity = async (client: WriteClient, marketAddress: AccountAddress, positionTokenId: EthereumQuantity, lpToSell: EthereumQuantity, amountNoMin: EthereumQuantity, amountYesMin: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'decreaseLiquidity',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, positionTokenId, lpToSell, amountNoMin, amountYesMin, deadline]
	})
}

export const burnLiquidity = async (client: WriteClient, marketAddress: AccountAddress, positionTokenId: EthereumQuantity, amountNoMin: EthereumQuantity, amountYesMin: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'burnLiquidity',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, positionTokenId, amountNoMin, amountYesMin, deadline]
	})
}

export const enterPosition = async (client: WriteClient, marketAddress: AccountAddress, amountInDai: EthereumQuantity, buyYes: boolean, minSharesOut: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'enterPosition',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, amountInDai, buyYes, minSharesOut, deadline]
	})
}

export const exitPosition = async (client: WriteClient, marketAddress: AccountAddress, daiToBuy: EthereumQuantity, maxSharesIn: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'exitPosition',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, daiToBuy, maxSharesIn, deadline]
	})
}

export const swapExactIn = async (client: WriteClient, marketAddress: AccountAddress, inputShares: EthereumQuantity, inputYes: boolean, minSharesOut: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'swapExactIn',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, inputYes, inputShares, minSharesOut, deadline]
	})
}

export const swapExactOut = async (client: WriteClient, marketAddress: AccountAddress, outputShares: EthereumQuantity, inputYes: boolean, maxSharesIn: EthereumQuantity, deadline: EthereumQuantity) => {
	return await client.writeContract({
		chain: mainnet,
		abi: AugurConstantProductRouter.abi,
		functionName: 'swapExactOut',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, inputYes, outputShares, maxSharesIn, deadline]
	})
}

export const expectedSharesAfterSwap = async (client: ReadClient, marketAddress: AccountAddress, swapYes: boolean, exactAmount: EthereumQuantity) => {
	const abi = [{
		'inputs': [
			{
				'internalType': 'address',
				'name': 'augurMarketAddress',
				'type': 'address'
			},
			{
				'internalType': 'uint128',
				'name': 'exactAmount',
				'type': 'uint128'
			},
			{
				'internalType': 'bool',
				'name': 'swapYes',
				'type': 'bool'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'function',
		'name': 'quoteExactInputSingle',
		'outputs': [
			{
				'internalType': 'uint256',
				'name': '',
				'type': 'uint256'
			},
			{
				'internalType': 'uint256',
				'name': '',
				'type': 'uint256'
			}
		]
	}] as const

	const results = await client.readContract({
		abi: abi,
		functionName: 'quoteExactInputSingle',
		address: getAugurConstantProductMarketRouterAddress(),
		args: [marketAddress, exactAmount, swapYes]
	})
	return results[0]
}

export const expectedSharesNeededForSwap = async (client: ReadClient, marketAddress: AccountAddress, swapYes: boolean, exactAmount: EthereumQuantity) => {
	const abi = [{
		'inputs': [
			{
				'internalType': 'address',
				'name': 'augurMarketAddress',
				'type': 'address'
			},
			{
				'internalType': 'uint128',
				'name': 'exactAmount',
				'type': 'uint128'
			},
			{
				'internalType': 'bool',
				'name': 'swapYes',
				'type': 'bool'
			}
		],
		'stateMutability': 'nonpayable',
		'type': 'function',
		'name': 'quoteExactOutputSingle',
		'outputs': [
			{
				'internalType': 'uint256',
				'name': '',
				'type': 'uint256'
			},
			{
				'internalType': 'uint256',
				'name': '',
				'type': 'uint256'
			}
		]
	}] as const
	try {
		const results = await client.readContract({
			abi,
			functionName: 'quoteExactOutputSingle',
			address: getAugurConstantProductMarketRouterAddress(),
			args: [marketAddress, exactAmount, swapYes]
		})
		return { success: true, result: results[0] } as const
	} catch(e: unknown) {
		console.error(e)
		return { success: false } as const
	}
}

export const setERC1155Approval = async (client: WriteClient, tokenAddress: AccountAddress, operatorAddress: AccountAddress, approved: boolean) => {
	return await client.writeContract({
		chain: mainnet,
		abi: ERC1155_ABI,
		functionName: 'setApprovalForAll',
		address: tokenAddress,
		args: [operatorAddress, approved]
	})
}
