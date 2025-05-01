import { Signal, useComputed } from '@preact/signals'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { EthereumQuantity } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { getForkValues } from '../utils/augurContractUtils.js'
import { maxStakeAmountForOutcome, requiredStake } from '../utils/augurUtils.js'
import { MarketData } from './Market.js'

export type OutcomeStake = {
	outcomeName: string
	repStake: bigint
	status: 'Winning' | 'Losing'
	payoutNumerators: readonly EthereumQuantity[]
	alreadyContributedToOutcomeStake: undefined | bigint
}

type MarketReportingOptionsForYesNoAndCategoricalProps = {
	marketData: OptionalSignal<MarketData>
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	isSlowReporting: Signal<boolean>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	areOptionsDisabled: Signal<boolean>
	canInitialReport: Signal<boolean>
}

export const MarketReportingOptionsForYesNoAndCategorical = ({ marketData, outcomeStakes, selectedOutcome, preemptiveDisputeCrowdsourcerStake, isSlowReporting, forkValues, areOptionsDisabled, canInitialReport }: MarketReportingOptionsForYesNoAndCategoricalProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	const totalStake = useComputed(() => outcomeStakes.deepValue === undefined ? 0n : outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n))

	const maxStakeAmountForEachOption = useComputed(() => {
		if (selectedOutcome.value === null) return []
		if (outcomeStakes.deepValue === undefined) return []
		if (forkValues.deepValue === undefined) return []
		const disputeThresholdForDisputePacing = forkValues.deepValue.disputeThresholdForDisputePacing
		return outcomeStakes.deepValue.map((outcomeStake) => maxStakeAmountForOutcome(outcomeStake, totalStake.value, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, disputeThresholdForDisputePacing, marketData.deepValue?.lastCompletedCrowdSourcer))
	})

	return <div class = 'outcome-options'> {
		outcomeStakes.deepValue.map((outcomeStake, index) => (
			<div class = 'outcome-option' key = { outcomeStake.outcomeName }>
				<input
					disabled = { !canInitialReport.value && (areOptionsDisabled || maxStakeAmountForEachOption.value[index] === 0n) }
					type = 'radio'
					name = 'selectedOutcome'
					class = 'custom-input'
					checked = { selectedOutcome.value === outcomeStake.outcomeName }
					onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
				/>
				<div class = 'outcome-info'>
					<b>{ outcomeStake.outcomeName } ({ outcomeStake.status })</b>

					{ totalStake.value !== 0n && (
						<>
							<span>{ bigintToDecimalString(outcomeStake.repStake, 18n, 2) } REP</span>
							<span>
								{ outcomeStake.status === 'Winning'
									? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } REP`
									: `Required for Dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP`
								}
							</span>
						</>
					)}

					{ outcomeStake.alreadyContributedToOutcomeStake !== undefined && (
						<span class = 'outcome-contrib'>
							(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcomeStake, 18n, 2) } REP / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP)
						</span>
					)}
				</div>
			</div>
		))
	} </div>
}

export type MarketOutcomeOption = {
	outcomeName: string
	payoutNumerators: readonly EthereumQuantity[]
}

type MarketReportingForYesNoAndCategoricalWithoutStakeProps = {
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeOption[]>
	disabled: Signal<boolean>
}

export const MarketReportingForYesNoAndCategoricalWithoutStake = ({ outcomeStakes, selectedOutcome, disabled }: MarketReportingForYesNoAndCategoricalWithoutStakeProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	return outcomeStakes.deepValue.map((outcomeStake) => (
		<span key = { outcomeStake.outcomeName }>
			<label>
				<input
					disabled = { disabled }
					type = 'radio'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedOutcome.value === outcomeStake.outcomeName }
					onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
				/>
				{' '}
				{ outcomeStake.outcomeName }
			</label>
		</span>
	))
}
