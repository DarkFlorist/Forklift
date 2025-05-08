import 'viem/window'
import { WriteClient } from './ethereumWallet.js'
import { PROXY_DEPLOYER_ADDRESS } from './constants.js'

export async function ensureProxyDeployerDeployed(writeClient: WriteClient): Promise<void> {
	const deployerBytecode = await writeClient.getCode({ address: PROXY_DEPLOYER_ADDRESS })
	if (deployerBytecode === '0x60003681823780368234f58015156014578182fd5b80825250506014600cf3') return
	const ethSendHash = await writeClient.sendTransaction({ to: '0x4c8d290a1b368ac4728d83a9e8321fc3af2b39b1', amount: 10000000000000000n })
	await writeClient.waitForTransactionReceipt({ hash: ethSendHash })
	const deployHash = await writeClient.sendRawTransaction({ serializedTransaction: '0xf87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222' })
	await writeClient.waitForTransactionReceipt({ hash: deployHash })
}
