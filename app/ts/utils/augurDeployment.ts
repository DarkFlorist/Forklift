import { getContractAddress, numberToBytes } from 'viem'
import { AugurConstantProductRouter, ShareTokenWrapperFactory } from '../VendoredAugurConstantProductMarket.js'
import { AUGUR_PROXY_DEPLOYER } from './constants.js'
import { ReadClient, WriteClient } from './ethereumWallet.js'
import { mainnet } from 'viem/chains'

const HOOK_SALT = 32171n

export function getShareTokenWrapperFactoryAddress() {
	const bytecode: `0x${ string }` = `0x${ ShareTokenWrapperFactory.evm.bytecode.object }`
	return getContractAddress({ bytecode, from: AUGUR_PROXY_DEPLOYER, opcode: 'CREATE2', salt: numberToBytes(0n) })
}

export function getAugurConstantProductMarketRouterAddress() {
	const bytecode: `0x${ string }` = `0x${ AugurConstantProductRouter.evm.bytecode.object }`
	return getContractAddress({ bytecode, from: AUGUR_PROXY_DEPLOYER, opcode: 'CREATE2', salt: numberToBytes(HOOK_SALT) })
}

export const deployShareTokenWrapperFactoryTransaction = () => {
	const bytecode: `0x${ string }` = `0x${ 0n.toString(16).padStart(64, '0')}${ ShareTokenWrapperFactory.evm.bytecode.object }`
	return { to: AUGUR_PROXY_DEPLOYER, data: bytecode } as const
}

export const deployAugurConstantProductMarketRouterTransaction = () => {
	const bytecode: `0x${ string }` = `0x${ HOOK_SALT.toString(16).padStart(64, '0')}${ AugurConstantProductRouter.evm.bytecode.object }`
	return { to: AUGUR_PROXY_DEPLOYER, data: bytecode } as const
}

export const ensureShareTokenWrapperFactoryDeployed = async (client: WriteClient) => {
	const hash = await client.sendTransaction(deployShareTokenWrapperFactoryTransaction())
	await client.waitForTransactionReceipt({ hash })
}

export const ensureAugurConstantProductMarketRouterDeployed = async (client: WriteClient) => {
	const shareTokenWrapperFactoryAddress = getShareTokenWrapperFactoryAddress()
	const acpmRouterAddress = getAugurConstantProductMarketRouterAddress()
	await ensureShareTokenWrapperFactoryDeployed(client)
	const hash = await client.sendTransaction(deployAugurConstantProductMarketRouterTransaction())

	await client.waitForTransactionReceipt({ hash })

	const routerAbi = AugurConstantProductRouter.abi
	await client.writeContract({
		chain: mainnet,
		abi: routerAbi,
		functionName: 'initialize',
		address: acpmRouterAddress,
		args: [shareTokenWrapperFactoryAddress]
	})

	const factoryAbi = ShareTokenWrapperFactory.abi
	await client.writeContract({
		chain: mainnet,
		abi: factoryAbi,
		functionName: 'initialize',
		address: shareTokenWrapperFactoryAddress,
		args: [acpmRouterAddress]
	})
}

export const isAugurConstantProductMarketRouterDeployed = async (client: ReadClient) => {
	const expectedDeployedBytecode: `0x${ string }` = `0x${ AugurConstantProductRouter.evm.deployedBytecode.object }`
	const address = getAugurConstantProductMarketRouterAddress()
	const deployedBytecode = await client.getCode({ address })
	return deployedBytecode === expectedDeployedBytecode
}
