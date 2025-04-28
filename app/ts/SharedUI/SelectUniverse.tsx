import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { MarketData } from './Market.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { MarketOutcomeOption, MarketReportingForYesNoAndCategoricalWithoutStake } from './YesNoCategoricalMarketReportingOptions.js'
import { ScalarInput } from './ScalarMarketReportingOptions.js'

type SelectUniverseProps = {
	marketData: OptionalSignal<MarketData>
	enabled: Signal<boolean>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeOption[]>
	selectedPayoutNumerators: OptionalSignal<readonly bigint[]>
}

export function SelectUniverse({ marketData, enabled, outcomeStakes, selectedPayoutNumerators }: SelectUniverseProps) {
	const selectedScalarOutcome = useOptionalSignal<bigint>(undefined)
	const selectedScalarOutcomeInvalid = useSignal<boolean>(false)
	const selectedOutcome = useSignal<string | null>(null)

	const minValue = useComputed(() => marketData.deepValue?.hotLoadingMarketData.displayPrices[0] || 0n)
	const maxValue = useComputed(() => marketData.deepValue?.hotLoadingMarketData.displayPrices[1] || 0n)
	const numTicks = useComputed(() => marketData.deepValue?.hotLoadingMarketData.numTicks || 0n)
	const scalarDenomination = useComputed(() => marketData.deepValue?.parsedExtraInfo?._scalarDenomination || '')

	useSignalEffect(() => {
		const payoutNumerators = outcomeStakes.deepValue?.find((outcome) => outcome.outcomeName === selectedOutcome.value)?.payoutNumerators
		if (!payoutNumerators) return
		if (selectedOutcome.value === null) throw new Error('Invalid input')
		selectedPayoutNumerators.deepValue = payoutNumerators
	})
	useSignalEffect(() => {
		if (selectedScalarOutcomeInvalid.value) {
			selectedPayoutNumerators.deepValue = [numTicks.value, 0n, 0n]
		} else if (selectedScalarOutcome.deepValue === undefined) {
			selectedPayoutNumerators.deepValue = undefined
		} else {
			selectedPayoutNumerators.deepValue = [0n, selectedScalarOutcome.deepValue, numTicks.value - selectedScalarOutcome.deepValue]
		}
	})
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.hotLoadingMarketData.marketType === 'Scalar') {
		return <ScalarInput value = { selectedScalarOutcome } invalid = { selectedScalarOutcomeInvalid } minValue = { minValue } maxValue = { maxValue } numTicks = { numTicks } unit = { scalarDenomination }/>
	}
	return <MarketReportingForYesNoAndCategoricalWithoutStake outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } enabled = { enabled }/>
}
