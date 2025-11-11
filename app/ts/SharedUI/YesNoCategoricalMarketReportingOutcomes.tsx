import { Signal, useComputed } from '@preact/signals'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { getForkValues } from '../utils/augurContractUtils.js'
import { maxStakeAmountForOutcome, requiredStake } from '../utils/augurUtils.js'
import { MarketData } from './Market.js'
import { UniverseLink } from './links.js'

export type OutcomeStake = {
	outcomeName: string
	repStake: bigint
	status: 'Winning' | 'Losing' | 'Tie'
	payoutNumerators: readonly EthereumQuantity[]
	alreadyContributedToOutcomeStake: undefined | bigint
	universeAddress: AccountAddress | undefined
}

type MarketReportingOutcomesForYesNoAndCategoricalProps = {
	marketData: OptionalSignal<MarketData>
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	isSlowReporting: Signal<boolean>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	areOutcomesDisabled: Signal<boolean>
	canInitialReport: Signal<boolean>
	repTokenName: Signal<string>
}

export const MarketReportingOptionsForYesNoAndCategorical = ({ repTokenName, marketData, outcomeStakes, selectedOutcome, preemptiveDisputeCrowdsourcerStake, isSlowReporting, forkValues, areOutcomesDisabled, canInitialReport }: MarketReportingOutcomesForYesNoAndCategoricalProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	const totalStake = useComputed(() => outcomeStakes.deepValue === undefined ? 0n : outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n))

	const maxStakeAmountForEachOutcome = useComputed(() => {
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
					disabled = { !canInitialReport.value && (areOutcomesDisabled || maxStakeAmountForEachOutcome.value[index] === 0n) }
					type = 'radio'
					name = 'selectedOutcome'
					class = 'custom-input'
					checked = { selectedOutcome.value === outcomeStake.outcomeName }
					onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
				/>
				<div class = 'outcome-info'>
					<b>{ outcomeStake.outcomeName }</b>
					{ totalStake.value !== 0n && (
						<>
							<span>{ bigintToDecimalString(outcomeStake.repStake, 18n, 2) } { repTokenName }</span>
							<span>
								{ outcomeStake.status === 'Winning'
									? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } ${ repTokenName }`
									: `Required for dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } ${ repTokenName }`
								}
							</span>
						</>
					)}

					{ outcomeStake.alreadyContributedToOutcomeStake !== undefined && (
						<span class = 'outcome-contrib'>
							(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcomeStake, 18n, 2) } { repTokenName } / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } { repTokenName })
						</span>
					)}
				</div>
				{ outcomeStake.status === 'Winning' ? <>
					<span class = 'outcome-status-winning'>
						{ outcomeStake.status }
					</span>
					</> : <></>
				}
				{ outcomeStake.status === 'Losing' ? <>
					<span class = 'outcome-status-losing'>
						{ outcomeStake.status }
					</span>
					</> : <></>
				}
			</div>
		))
	} </div>
}

export type MarketOutcome = {
	outcomeName: string
	payoutNumerators: readonly EthereumQuantity[]
}

export type MarketOutcomeWithUniverse = {
	outcomeName: string
	payoutNumerators: readonly EthereumQuantity[]
	universeAddress: AccountAddress | undefined
}

type MarketReportingForYesNoAndCategoricalWithoutStakeProps = {
	selectedOutcome: Signal<string | null>
	pathSignal: Signal<string>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeWithUniverse[]>
	disabled: Signal<boolean>
	repTokenName: Signal<string>
}

export const MarketReportingForYesNoAndCategoricalWithoutStake = ({ outcomeStakes, selectedOutcome, disabled, pathSignal, repTokenName }: MarketReportingForYesNoAndCategoricalWithoutStakeProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	return <div class = 'outcome-options'>
		{
			outcomeStakes.deepValue.map((outcomeStake) => (
				<div class = 'outcome-option' key = { outcomeStake.outcomeName } style = { 'grid-template-columns: max-content max-content 1fr;'}>
					<input
						disabled = { disabled }
						type = 'radio'
						class = 'custom-input'
						name = 'selectedOutcome'
						checked = { selectedOutcome.value === outcomeStake.outcomeName }
						onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
					/>
					<div class = 'outcome-info'>
						<b>{ outcomeStake.outcomeName }</b>
					</div>
					<div style = { 'justify-self: end;' }>
						{ outcomeStake.universeAddress === undefined || BigInt(outcomeStake.universeAddress) === 0n ? <p>Universe address not known</p> : <>
							<p> Universe: <UniverseLink address = { useComputed(() => outcomeStake.universeAddress) } pathSignal = { pathSignal }/> ({ repTokenName })</p>
						</> }
					</div>
				</div>
			))
		}
	</div>
}
