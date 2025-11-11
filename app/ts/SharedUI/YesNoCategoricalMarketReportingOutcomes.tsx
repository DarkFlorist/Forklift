import { Signal, useComputed, useSignal } from '@preact/signals'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { EthereumQuantity, UniverseInformation } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { createChildUniverse, getForkValues } from '../utils/augurContractUtils.js'
import { maxStakeAmountForOutcome, requiredStake } from '../utils/augurUtils.js'
import { MarketData } from './Market.js'
import { UniverseLink } from './links.js'
import { SendTransactionButton, TransactionStatus } from './SendTransactionButton.js'
import { WriteClient } from '../utils/ethereumWallet.js'


export type MarketOutcomeWithUniverse = {
	outcomeName: string
	payoutNumerators: readonly EthereumQuantity[]
	universe: UniverseInformation | undefined
}

export type OutcomeStake = MarketOutcomeWithUniverse & {
	repStake: bigint
	status: 'Winning' | 'Losing' | 'Tie'
	alreadyContributedToOutcomeStake: undefined | bigint
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
	universe: Signal<UniverseInformation>
}

export const MarketReportingOptionsForYesNoAndCategorical = ({ universe, marketData, outcomeStakes, selectedOutcome, preemptiveDisputeCrowdsourcerStake, isSlowReporting, forkValues, areOutcomesDisabled, canInitialReport }: MarketReportingOutcomesForYesNoAndCategoricalProps) => {
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
							<span>{ bigintToDecimalString(outcomeStake.repStake, 18n, 2) } { universe.value.repTokenName }</span>
							<span>
								{ outcomeStake.status === 'Winning'
									? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } ${ universe.value.repTokenName }`
									: `Required for dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } ${ universe.value.repTokenName }`
								}
							</span>
						</>
					)}

					{ outcomeStake.alreadyContributedToOutcomeStake !== undefined && (
						<span class = 'outcome-contrib'>
							(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcomeStake, 18n, 2) } { universe.value.repTokenName } / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } { universe.value.repTokenName })
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

type OutcomeStakeComponentProps = {
	outcomeStake: MarketOutcomeWithUniverse
	selectedOutcome: Signal<string | null>
	pathSignal: Signal<string>
	disabled: Signal<boolean>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	refreshStakes: () => Promise<void>
}

export const OutcomeStakeComponent = ({ maybeWriteClient, universe, outcomeStake, selectedOutcome, pathSignal, disabled, refreshStakes }: OutcomeStakeComponentProps) => {
	const transactionStatus = useSignal<TransactionStatus>(undefined)
	const createUniverse = async () => {
		if (maybeWriteClient.deepValue === undefined) throw new Error('client missing')
		if (universe.deepValue?.universeAddress === undefined) throw new Error('universe missing')
		return await createChildUniverse(maybeWriteClient.deepValue, universe.deepValue.universeAddress, outcomeStake.payoutNumerators)
	}

	const universeLinkOrButton = useComputed(() => {
		if (outcomeStake.universe === undefined) {
			return <SendTransactionButton
				className = 'button button-secondary'
				transactionStatus = { transactionStatus }
				sendTransaction = { createUniverse }
				maybeWriteClient = { maybeWriteClient }
				disabled = { disabled }
				text = { new Signal(`Create "${ outcomeStake.outcomeName }" Universe`) }
				callBackWhenIncluded = { refreshStakes }
			/>
		} else {
			return <UniverseLink universe = { useComputed(() => outcomeStake.universe) } pathSignal = { pathSignal }/>
		}
	})

	return <div class = 'outcome-option' key = { outcomeStake.outcomeName } style = { 'grid-template-columns: max-content max-content 1fr;'}>
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
			{ universeLinkOrButton.value }
		</div>
	</div>
}

type MarketReportingForYesNoAndCategoricalWithoutStakeProps = {
	selectedOutcome: Signal<string | null>
	pathSignal: Signal<string>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeWithUniverse[]>
	disabled: Signal<boolean>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	refreshStakes: () => Promise<void>
}

export const MarketReportingForYesNoAndCategoricalWithoutStake = ({ outcomeStakes, selectedOutcome, disabled, pathSignal, refreshStakes, universe, maybeWriteClient }: MarketReportingForYesNoAndCategoricalWithoutStakeProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	return <div class = 'outcome-options'> {
		outcomeStakes.deepValue.map((outcomeStake) => <OutcomeStakeComponent refreshStakes = { refreshStakes } universe = { universe } maybeWriteClient = { maybeWriteClient } outcomeStake = { outcomeStake } selectedOutcome = { selectedOutcome } disabled = { disabled } pathSignal = { pathSignal }/>)
	} </div>
}
