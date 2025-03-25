import 'viem/window'
import { AccountAddress } from '../types/types.js'
import { getContractAddress, numberToBytes } from 'viem'
import { augurConstantProductMarketContractArtifact } from '../VendoredAugurConstantProductMarket.js'
import { createReadClient, createWriteClient } from './ethereumWallet.js'
import { PROXY_DEPLOYER_ADDRESS } from './constants.js'

export function getAugurConstantProductMarketAddress() {
	const bytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.bytecode.object }`
	return getContractAddress({ bytecode, from: PROXY_DEPLOYER_ADDRESS, opcode: 'CREATE2', salt: numberToBytes(0) })
}

export const isAugurConstantProductMarketDeployed = async (accountAddress: AccountAddress | undefined) => {
	const wallet = createReadClient(accountAddress)
	const expectedDeployedBytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.deployedBytecode.object }`
	const address = getAugurConstantProductMarketAddress()
	const deployedBytecode = await wallet.getCode({ address })
	return deployedBytecode === expectedDeployedBytecode
}

export const deployAugurConstantProductMarketTransaction = () => {
	const bytecode: `0x${ string }` = `0x${ augurConstantProductMarketContractArtifact.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.bytecode.object }`
	return { to: PROXY_DEPLOYER_ADDRESS, data: bytecode } as const
}

export async function ensureProxyDeployerDeployed(accountAddress: AccountAddress): Promise<void> {
	const wallet = createWriteClient(accountAddress)
	const deployerBytecode = await wallet.getCode({ address: PROXY_DEPLOYER_ADDRESS })
	if (deployerBytecode === '0x60003681823780368234f58015156014578182fd5b80825250506014600cf3') return
	const ethSendHash = await wallet.sendTransaction({ to: '0x4c8d290a1b368ac4728d83a9e8321fc3af2b39b1', amount: 10000000000000000n })
	await wallet.waitForTransactionReceipt({ hash: ethSendHash })
	const deployHash = await wallet.sendRawTransaction({ serializedTransaction: '0xf87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222' })
	await wallet.waitForTransactionReceipt({ hash: deployHash })
}

export const deployAugurConstantProductMarketContract = async (accountAddress: AccountAddress) => {
	const augurConstantProductMarketDeployed = await isAugurConstantProductMarketDeployed(accountAddress)
	if (augurConstantProductMarketDeployed) throw new Error('already deployed')
	await ensureProxyDeployerDeployed(accountAddress)
	const client = createWriteClient(accountAddress)
	if (!augurConstantProductMarketDeployed) {
		const hash = await client.sendTransaction(deployAugurConstantProductMarketTransaction())
		await client.waitForTransactionReceipt({ hash })
	}
}
