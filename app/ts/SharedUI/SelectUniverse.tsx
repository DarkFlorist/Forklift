import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { MarketData } from './Market.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { MarketOutcomeOption, MarketReportingForYesNoAndCategoricalWithoutStake } from './YesNoCategoricalMarketReportingOptions.js'
import { ScalarInput } from './ScalarMarketReportingOptions.js'
import { getPayoutNumeratorsFromScalarOutcome } from '../utils/augurUtils.js'

type SelectUniverseProps = {
	marketData: OptionalSignal<MarketData>
	disabled: Signal<boolean>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeOption[]>
	selectedPayoutNumerators: OptionalSignal<readonly bigint[]>
}

export function SelectUniverse({ marketData, disabled, outcomeStakes, selectedPayoutNumerators }: SelectUniverseProps) {
	const selectedScalarOutcome = useOptionalSignal<bigint>(undefined)
	const selectedScalarOutcomeInvalid = useSignal<boolean>(false)
	const selectedOutcome = useSignal<string | null>(null)

	const minValue = useComputed(() => marketData.deepValue?.displayPrices[0] || 0n)
	const maxValue = useComputed(() => marketData.deepValue?.displayPrices[1] || 0n)
	const numTicks = useComputed(() => marketData.deepValue?.numTicks || 0n)
	const scalarDenomination = useComputed(() => marketData.deepValue?.parsedExtraInfo?._scalarDenomination || '')

	useSignalEffect(() => {
		const payoutNumerators = outcomeStakes.deepValue?.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!payoutNumerators) return
		if (selectedOutcome.value === null) throw new Error('Invalid input')
		selectedPayoutNumerators.deepValue = payoutNumerators
	})
	useSignalEffect(() => {
		selectedPayoutNumerators.deepValue = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minValue.value, maxValue.value, numTicks.value)
	})
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.marketType === 'Scalar') {
		return <ScalarInput value = { selectedScalarOutcome } invalid = { selectedScalarOutcomeInvalid } minValue = { minValue } maxValue = { maxValue } numTicks = { numTicks } unit = { scalarDenomination } disabled = { disabled }/>
	}
	return <MarketReportingForYesNoAndCategoricalWithoutStake outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } disabled = { disabled }/>
}
