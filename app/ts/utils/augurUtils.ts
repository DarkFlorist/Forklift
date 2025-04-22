import { MarketData } from '../SharedUI/Market.js'
import { OutcomeStake } from '../SharedUI/MarketReportingOptions.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { getLastCompletedCrowdSourcer } from './augurContractUtils.js'
import { GENESIS_UNIVERSE, MARKET_TYPES, YES_NO_OPTIONS } from './constants.js'
import { assertNever } from './errorHandling.js'
import { bigintToDecimalString, stringToUint8Array, stripTrailingZeros } from './ethereumUtils.js'
import { indexOfMax } from './utils.js'

// TODO, try to come up with nice ways to call universes (based on market information)
export const getUniverseName = (universeAddress: AccountAddress) => {
	if (BigInt(universeAddress) == BigInt(GENESIS_UNIVERSE)) return 'Genesis'
	return universeAddress
}

export const isGenesisUniverse = (universeAddress: AccountAddress | undefined) => universeAddress !== undefined && getUniverseName(universeAddress) === 'Genesis'

export const getAllPayoutNumeratorCombinations = (numOutcomes: bigint, numTicks: EthereumQuantity): readonly bigint[][] => Array.from({ length: Number(numOutcomes) }, (_, outcome) => Array.from({ length: Number(numOutcomes) }, (_, index) => index === outcome ? numTicks : 0n))

type MarketType = 'Yes/No' | 'Categorical' | 'Scalar'
const getYesNoCategoricalOutcomeName = (index: number, marketType: 'Yes/No' | 'Categorical', outcomes: readonly `0x${ string }`[]) => {
	if (index === 0) return 'Invalid'
	if (marketType === 'Yes/No') return YES_NO_OPTIONS[index]
	const outcomeName = outcomes[index - 1]
	if (outcomeName === undefined) return undefined
	return new TextDecoder().decode(stripTrailingZeros(stringToUint8Array(outcomeName)))
}

const getScalarOutComeName = (payoutNumerators: readonly [bigint, bigint, bigint], unit: string | undefined, numTicks: bigint, minPrice: bigint, maxPrice: bigint) => {
	if (payoutNumerators[0] > 0n) return 'Invalid'
	const tradeInterval = getTradeInterval(maxPrice - minPrice, numTicks)
	return `${ bigintToDecimalString((payoutNumerators[1] + minPrice) * tradeInterval, 18n) }${unit === undefined ? '' : unit }`
}

export const getOutComeName = (payoutNumerators: readonly bigint[], marketData: MarketData) => {
	const malformedOutcomeName = `Malformed Outcome (${ payoutNumerators.join(', ') })`
	const marketType = MARKET_TYPES[marketData.hotLoadingMarketData.marketType]
	if (marketType === undefined) throw new Error('unknown market type')
	switch(marketType) {
		case 'Categorical':
		case 'Yes/No': {
			if (payoutNumerators.length !== 3 || payoutNumerators[0] === undefined || payoutNumerators[1] === undefined || payoutNumerators[2] === undefined) return malformedOutcomeName
			var indexOfMaxValue = indexOfMax(payoutNumerators)
			if (indexOfMaxValue === undefined) return malformedOutcomeName
			if (payoutNumerators.filter((numerator) => numerator > 0).length > 0) return malformedOutcomeName
			const name = getYesNoCategoricalOutcomeName(indexOfMaxValue, marketType, marketData.hotLoadingMarketData.outcomes)
			if (name === undefined) return malformedOutcomeName
			return name
		}
		case 'Scalar': {
			if (payoutNumerators.length !== 3 || payoutNumerators[0] === undefined || payoutNumerators[1] === undefined || payoutNumerators[2] === undefined) return malformedOutcomeName
			if (marketData.hotLoadingMarketData.displayPrices[0] === undefined || marketData.hotLoadingMarketData.displayPrices[1] === undefined) return malformedOutcomeName
			return getScalarOutComeName([payoutNumerators[0], payoutNumerators[1], payoutNumerators[2]], marketData.parsedExtraInfo?._scalarDenomination, marketData.hotLoadingMarketData.numTicks, marketData.hotLoadingMarketData.displayPrices[0], marketData.hotLoadingMarketData.displayPrices[1])
		}
		default: assertNever(marketType)
	}
}

export const getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket = (marketType: MarketType, numOutcomes: bigint, numTicks: bigint, outcomes: readonly `0x${ string }`[]) => {
	if (marketType === 'Scalar') throw new Error ('Scalar markets not implemented')
	const allPayoutNumerators = getAllPayoutNumeratorCombinations(numOutcomes, numTicks)
	return allPayoutNumerators.map((payoutNumerators, index) => {
		const outcomeName = getYesNoCategoricalOutcomeName(index, marketType, outcomes)
		if (outcomeName === undefined) throw new Error(`outcome did not found for index: ${ index }. Outcomes: [${ outcomes.join(',') }]`)
		return { outcomeName, payoutNumerators }
	})
}

// todo, make path typesafe
export const getUniverseUrl = (universe: AccountAddress, path: string) => `/#/${ path }?universe=${ universe }`

// https://github.com/AugurProject/augur/blob/bd13a797016b373834e9414096c6086f35aa628f/packages/augur-core/src/contracts/reporting/Market.sol#L384C51-L384C91
export const requiredStake = (allStake: bigint, stakeInOutcome: bigint) => (2n * allStake) - (3n * stakeInOutcome)

export const maxStakeAmountForOutcome = (outcomeStake: OutcomeStake, totalStake: bigint, isSlowReporting: boolean, preemptiveDisputeCrowdsourcerStake: bigint, disputeThresholdForDisputePacing: bigint, lastCompletedCrowdSourcer: Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>) => {
	const alreadyContributed = outcomeStake.alreadyContributedToOutcomeStake || 0n

	// there's a bug in https://github.com/AugurProject/augur/blob/master/packages/augur-core/src/contracts/reporting/Market.sol#L383 that results the total stake calculation being wrong. This happens only when prestaking on speed rounds. The bug causes size and stake deviate from each other
	if (!isSlowReporting && lastCompletedCrowdSourcer !== undefined && lastCompletedCrowdSourcer.size !== lastCompletedCrowdSourcer.stake && outcomeStake.status === 'Winning') {
		return disputeThresholdForDisputePacing - preemptiveDisputeCrowdsourcerStake - alreadyContributed
	}

	const requiredStakeForTheRound = requiredStake(totalStake, outcomeStake.repStake)
	if (isSlowReporting) return outcomeStake.status === 'Losing' ? requiredStakeForTheRound - alreadyContributed : 0n
	return (outcomeStake.status === 'Losing' ? requiredStakeForTheRound : disputeThresholdForDisputePacing - totalStake - preemptiveDisputeCrowdsourcerStake) - alreadyContributed
}

// https://github.com/AugurProject/augur/blob/bd13a797016b373834e9414096c6086f35aa628f/packages/augur-core/src/contracts/Augur.sol#L321
export function getTradeInterval(displayRange: bigint, numTicks: bigint): bigint {
	const MAX_NUM_TICKS = 2n ** 256n - 2n
	const MIN_TRADE_INTERVAL = 10n ** 14n  // We ignore "dust" portions of the min interval and for huge scalars have a larger min value
	const TRADE_INTERVAL_VALUE = 10n ** 19n // Trade value of 10 DAI
	if (numTicks === MAX_NUM_TICKS ) return MIN_TRADE_INTERVAL
	let displayAmount = TRADE_INTERVAL_VALUE * ( 10n ** 18n ) / displayRange
	let displayInterval = MIN_TRADE_INTERVAL
	while (displayInterval < displayAmount) {
		displayInterval = displayInterval * 10n
	}
	return displayInterval * displayRange / numTicks / ( 10n ** 18n )
}

export const getPayoutNumeratorsFromScalarOutcome = (invalid: boolean, selectedScalarOutcome: undefined | bigint, minPrice: bigint, maxPrice: bigint, numTicks: bigint) => {
	if (invalid) return [numTicks, 0n, 0n] as const
	if (selectedScalarOutcome === undefined) throw new Error('selectedScalarOutcome is undefined')
	const tradeInterval = getTradeInterval(maxPrice - minPrice, numTicks)
	const scaled = (selectedScalarOutcome - minPrice) / tradeInterval
	if (scaled > numTicks) throw new Error('selectedScalarOutcome is is too big')
	if (scaled < 0n) throw new Error('selectedScalarOutcome is is too small')
	return [0n, scaled, numTicks - scaled] as const
}
