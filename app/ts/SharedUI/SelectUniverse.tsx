import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { MarketData } from './Market.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { MarketOutcomeWithUniverse, MarketReportingForYesNoAndCategoricalWithoutStake } from './YesNoCategoricalMarketReportingOutcomes.js'
import { ScalarInput } from './ScalarMarketReportingOutcomes.js'
import { getPayoutNumeratorsFromScalarOutcome } from '../utils/augurUtils.js'
import { areEqualArrays } from '../utils/ethereumUtils.js'
import { WriteClient } from '../utils/ethereumWallet.js'
import { UniverseInformation } from '../types/types.js'

type SelectUniverseProps = {
	marketData: OptionalSignal<MarketData>
	disabled: Signal<boolean>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeWithUniverse[]>
	selectedPayoutNumerators: OptionalSignal<readonly bigint[]>
	pathSignal: Signal<string>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	refreshStakes: () => Promise<void>
}

export function SelectUniverse({ marketData, disabled, outcomeStakes, selectedPayoutNumerators, pathSignal, maybeWriteClient, universe, refreshStakes }: SelectUniverseProps) {
	const selectedScalarOutcome = useOptionalSignal<bigint>(undefined)
	const selectedScalarOutcomeInvalid = useSignal<boolean>(false)
	const selectedOutcome = useSignal<string | null>(null)

	const minValue = useComputed(() => marketData.deepValue?.displayPrices[0] || 0n)
	const maxValue = useComputed(() => marketData.deepValue?.displayPrices[1] || 0n)
	const numTicks = useComputed(() => marketData.deepValue?.numTicks || 0n)
	const scalarDenomination = useComputed(() => marketData.deepValue?.parsedExtraInfo?._scalarDenomination || '')
	const selectedOutcomeUniverse = useComputed(() => {
		const selected = selectedPayoutNumerators.deepValue
		if (selected === undefined) return undefined
		if (outcomeStakes.deepValue === undefined) return undefined
		return outcomeStakes.deepValue.find((outcomeStake) => areEqualArrays(outcomeStake.payoutNumerators, selected))?.universe
	})
	useSignalEffect(() => {
		const payoutNumerators = outcomeStakes.deepValue?.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!payoutNumerators) return
		if (selectedOutcome.value === null) throw new Error('Invalid input')
		selectedPayoutNumerators.deepValue = payoutNumerators
	})
	useSignalEffect(() => {
		if (selectedScalarOutcome.deepValue === undefined) return
		selectedPayoutNumerators.deepValue = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minValue.value, maxValue.value, numTicks.value)
	})
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.marketType === 'Scalar') {
		return <ScalarInput selectedOutcomeUniverse = { selectedOutcomeUniverse } pathSignal = { pathSignal } value = { selectedScalarOutcome } invalid = { selectedScalarOutcomeInvalid } minValue = { minValue } maxValue = { maxValue } numTicks = { numTicks } unit = { scalarDenomination } disabled = { disabled } maybeWriteClient = { maybeWriteClient } universe = { universe } refreshStakes = { refreshStakes }/>
	}
	return <MarketReportingForYesNoAndCategoricalWithoutStake pathSignal = { pathSignal } outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } disabled = { disabled } maybeWriteClient = { maybeWriteClient } universe = { universe } refreshStakes = { refreshStakes }/>
}
