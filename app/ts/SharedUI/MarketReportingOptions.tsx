import { Signal } from '@preact/signals'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { EthereumQuantity } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'

export type OutcomeStake = {
	outcomeName: string
	repStake: bigint
	status: 'Winning' | 'Losing'
	payoutNumerators: EthereumQuantity[]
}

type MarketReportingOptionsProps = {
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
}

export const MarketReportingOptions = ({ outcomeStakes, selectedOutcome, preemptiveDisputeCrowdsourcerStake }: MarketReportingOptionsProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	// https://github.com/AugurProject/augur/blob/bd13a797016b373834e9414096c6086f35aa628f/packages/augur-core/src/contracts/reporting/Market.sol#L384C51-L384C91
	const requiredState = (allStake: bigint, stakeInOutcome: bigint) => (2n * allStake) - (3n * stakeInOutcome)

	const totalStake = outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n)
	return outcomeStakes.deepValue.map((outcomeStake) => (
		<span key = { outcomeStake.outcomeName }>
			<label>
				<input
					type = 'radio'
					name = 'selectedOutcome'
					checked = { selectedOutcome.value === outcomeStake.outcomeName }
					onChange = { () => { selectedOutcome.value = outcomeStake.outcomeName } }
				/>
				{' '}
				{ outcomeStake.outcomeName } ({ outcomeStake.status }): { bigintToDecimalString(outcomeStake.repStake, 18n) } REP. { outcomeStake.status === 'Winning' ? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n) } REP` : `Required for Dispute: ${ bigintToDecimalString(requiredState(totalStake, outcomeStake.repStake), 18n) } REP` }
			</label>
		</span>
	))
}

export type MarketOutcomeOption = {
	outcomeName: string
	payoutNumerators: EthereumQuantity[]
}

type MarketReportingWithoutStakeProps = {
	selectedOutcome: Signal<string | null>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeOption[]>
}

export const MarketReportingWithoutStake = ({ outcomeStakes, selectedOutcome }: MarketReportingWithoutStakeProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	return outcomeStakes.deepValue.map((outcomeStake) => (
		<span key = { outcomeStake.outcomeName }>
			<label>
				<input
					type = 'radio'
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
