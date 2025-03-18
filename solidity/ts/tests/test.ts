import { runTestsSequentially } from '../testsuite/ethSimulateTestSuite.js'
import { getMockedEthSimulateWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient, WriteClient } from '../testsuite/simulator/utils/viem.js'
import { promises as fs } from 'fs'
import * as funtypes from 'funtypes'

type ContractArtifact = funtypes.Static<typeof ContractArtifact>
const ContractArtifact = funtypes.ReadonlyObject({
	contracts: funtypes.ReadonlyObject({
		"AugurConstantProductMarket.sol": funtypes.ReadonlyObject({
			AugurConstantProduct: funtypes.ReadonlyObject({
				abi: funtypes.Unknown,
				evm: funtypes.ReadonlyObject({
					bytecode: funtypes.ReadonlyObject({
						object: funtypes.String
					})
				})
			})
		})
	}),
})

export const proxyDeployerAddress = `0x7a0d94f55792c434d74a40883c6ed8545e406d12`

export async function ensureProxyDeployerDeployed(client: WriteClient): Promise<void> {
	const deployerBytecode = await client.getCode({ address: proxyDeployerAddress })
	if (deployerBytecode === '0x60003681823780368234f58015156014578182fd5b80825250506014600cf3') return
	const ethSendHash = await client.sendTransaction({ to: '0x4c8d290a1b368ac4728d83a9e8321fc3af2b39b1', amount: 10000000000000000n })
	await client.waitForTransactionReceipt({ hash: ethSendHash })
	const deployHash = await client.sendRawTransaction({ serializedTransaction: '0xf87e8085174876e800830186a08080ad601f80600e600039806000f350fe60003681823780368234f58015156014578182fd5b80825250506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222' })
	await client.waitForTransactionReceipt({ hash: deployHash })
}

export const deployAugurConstantProductMarketContract = async (client: WriteClient) => {
	const contractLocation = './artifacts/AugurConstantProductMarket.json'
	const contracts = ContractArtifact.parse(JSON.parse(await fs.readFile(contractLocation, 'utf8')))
	const contract = contracts.contracts['AugurConstantProductMarket.sol'].AugurConstantProduct.evm.bytecode.object
	await ensureProxyDeployerDeployed(client)
	const bytecode: `0x${ string }` = `0x${ contract }`
	const transaction = { to: proxyDeployerAddress, data: bytecode } as const
	const hash = await client.sendTransaction(transaction)
	await client.waitForTransactionReceipt({ hash })
}


const vitalik = 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045n

const canDeployContract = async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), vitalik, 0)
	await deployAugurConstantProductMarketContract(client)
}

const allTests = async () => {
	await runTestsSequentially([
		['Can deploy contract', canDeployContract, undefined],
	])
}
allTests()
