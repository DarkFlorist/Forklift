import { encodePacked, getContractAddress, keccak256, numberToBytes } from 'viem'
import { DISPUTE_CROWDSOURCER_FACTORY_ADDRESS, PROXY_DEPLOYER_ADDRESS } from './constants.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { ReadClient, WriteClient } from './ethereumWallet.js'
import { FORK_UTILS_ABI } from '../ABI/ForkUtils.js'
import { AUGUR_FORK_UTILS_BYTECODE } from './augurForkUtilsContract.js'
import { MARKET_ABI } from '../ABI/MarketAbi.js'
import { min } from './utils.js'

export const getAugurForkUtilsAddress = () => getContractAddress({ bytecode: AUGUR_FORK_UTILS_BYTECODE, from: PROXY_DEPLOYER_ADDRESS, opcode: 'CREATE2', salt: numberToBytes(0) })

export const deployAugurForkUtils = async (writeClient: WriteClient) => {
	const hash = await writeClient.sendTransaction({ to: PROXY_DEPLOYER_ADDRESS, data: AUGUR_FORK_UTILS_BYTECODE })
	await writeClient.waitForTransactionReceipt({ hash })
}

export const getAvailableDisputesFromForkedMarkets = async (readClient: ReadClient, account: AccountAddress) => {
	let offset = 0n
	const pageSize = 10n
	let pages: { market: `0x${ string }`, bond: `0x${ string }`, amount: bigint }[] = []
	do {
		const page = await readClient.readContract({
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

export const forkReportingParticipants = async (writeClient: WriteClient, reportingParticipants: readonly AccountAddress[]) => {
	return await writeClient.writeContract({
		abi: FORK_UTILS_ABI,
		functionName: 'forkAndRedeemReportingParticipants',
		address: getAugurForkUtilsAddress(),
		args: [reportingParticipants]
	})
}

export const getReportingParticipantsForMarket = async (readClient: ReadClient, market: AccountAddress) => {
	let offset = 0n
	const pageSize = 10n
	let pages: { size: bigint; stake: bigint; payoutNumerators: readonly bigint[]; }[] = []
	const numParticipants = await readClient.readContract({
		abi: MARKET_ABI,
		functionName: 'getNumParticipants',
		address: market,
		args: []
	})
	do {
		if (offset > numParticipants) return pages
		const currentPageSize = min(numParticipants - offset, pageSize)
		const page = await readClient.readContract({
			abi: FORK_UTILS_ABI,
			functionName: 'getReportingParticipantsForMarket',
			address: getAugurForkUtilsAddress(),
			args: [market, offset, currentPageSize]
		})
		pages.push(...page[0].filter((page) => page.size > 0n || page.stake > 0n))
		if (page[1]) break
		offset += pageSize
	} while(true)
	return pages
}

type AggregatedData = {
	size: bigint
	stake: bigint
	payoutNumerators: readonly bigint[]
}

export const aggregateByPayoutDistribution = ( pages: { size: bigint; stake: bigint; payoutNumerators: readonly bigint[]; }[]): AggregatedData[] => {
	const map = new Map<string, AggregatedData>()
	const payoutDistributionHash = (payoutNumerators: readonly bigint[]) => keccak256(encodePacked(['uint256[]'], [payoutNumerators]))
	for (const page of pages) {
		const hash = payoutDistributionHash(page.payoutNumerators)
		if (map.has(hash)) {
			const existing = map.get(hash)!
			map.set(hash, { size: existing.size + page.size, stake: existing.stake + page.stake, payoutNumerators: existing.payoutNumerators })
		} else {
			map.set(hash, { size: page.size, stake: page.stake, payoutNumerators: page.payoutNumerators })
		}
	}
	return Array.from(map.values())
}
