import { getContractAddress, numberToBytes } from 'viem'
import { DISPUTE_CROWDSOURCER_FACTORY_ADDRESS, PROXY_DEPLOYER_ADDRESS } from './constants.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { createReadClient, createWriteClient } from './ethereumWallet.js'
import { FORK_UTILS_ABI } from '../ABI/ForkUtils.js'
import { AUGUR_FORK_UTILS_BYTECODE } from './augurForkUtilsContract.js'

export const getAugurForkUtilsAddress = () => getContractAddress({ AUGUR_FORK_UTILS_BYTECODE, from: PROXY_DEPLOYER_ADDRESS, opcode: 'CREATE2', salt: numberToBytes(0) })

export const deployAugurForkUtils = async (accountAddress: AccountAddress) => {
	const client = createWriteClient(accountAddress)
	const hash = await client.sendTransaction({ to: PROXY_DEPLOYER_ADDRESS, data: AUGUR_FORK_UTILS_BYTECODE })
	await client.waitForTransactionReceipt({ hash })
}

export const getAvailableDisputesFromForkedMarket = async (reader: AccountAddress, account: AccountAddress) => {
	const client = createReadClient(reader)
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, bond: `0x${ string }`, amount: bigint }[] = []
	do {
		const page = await client.readContract({
			abi: FORK_UTILS_ABI,
			functionName: 'getAvailableDisputesFromForkedMarkets',
			address: getAugurForkUtilsAddress(),
			args: [DISPUTE_CROWDSOURCER_FACTORY_ADDRESS, account, offset, pageSize]
		})
		pages.push(...page[0])
		if (page[1]) break
		offset += pageSize
	} while(true)
	return pages.filter((data) => EthereumQuantity.parse(data.market) !== 0n)
}

export const forkReportingParticipants = async (reader: AccountAddress, reportingParticipants: readonly AccountAddress[]) => {
	const client = createWriteClient(reader)
	return await client.writeContract({
		abi: FORK_UTILS_ABI,
		functionName: 'forkAndRedeemReportingParticipants',
		address: getAugurForkUtilsAddress(),
		args: [reportingParticipants]
	})
}
