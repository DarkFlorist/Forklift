import { NonHexBigInt } from '../types/types.js'
import { Input } from './Input.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { Signal, useComputed } from '@preact/signals'
import { getTradeInterval, requiredStake } from '../utils/augurUtils.js'
import { bigintToDecimalString, decimalStringToBigint, isDecimalString } from '../utils/ethereumUtils.js'
import { BigIntSlider } from './BigIntSlider.js'
import { getLastCompletedCrowdSourcer } from '../utils/augurContractUtils.js'
import { OutcomeStake } from './YesNoCategoricalMarketReportingOptions.js'

type ScalarInputProps = {
	value: OptionalSignal<bigint>
	minValue: Signal<bigint>
	maxValue: Signal<bigint>
	numTicks: Signal<bigint>
	unit: Signal<string>
	invalid: Signal<boolean>
	disabled: Signal<boolean>
}

export function ScalarInput({ value, minValue, maxValue, numTicks, unit, invalid, disabled }: ScalarInputProps) {
	const tradeInterval = useComputed(() => getTradeInterval(maxValue.value - minValue.value, numTicks.value))
	const isSliderAndInputDisabled = useComputed(() => disabled.value || invalid.value)
	return <div style = { { display: 'grid', gridTemplateColumns: 'min-content min-content auto', gap: '0.5rem', alignItems: 'center' } }>
		<div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content', gap: '0.5rem' } }>
			<BigIntSlider
				min = { minValue }
				max = { maxValue }
				value = { value }
				step = { numTicks }
				disabled = { isSliderAndInputDisabled }
			/>
			<Input
				class = 'input'
				type = 'text'
				placeholder = 'Allocation'
				disabled = { isSliderAndInputDisabled }
				value = { value }
				sanitize = { (amount: string) => amount.trim() }
				tryParse = { (amount: string | undefined) => {
					if (amount === undefined) return { ok: false } as const
					if (!isDecimalString(amount.trim())) return { ok: false } as const
					const parsed = decimalStringToBigint(amount.trim(), 18n)
					const scaledMin = minValue.value
					const scaledMax = maxValue.value
					if (parsed < scaledMin) return { ok: false }
					if (parsed > scaledMax) return { ok: false }
					if ((parsed / tradeInterval.value) * tradeInterval.value !== parsed) return { ok: false }
					return { ok: true, value: parsed } as const
				}}
				serialize = { (amount: NonHexBigInt | undefined) => {
					if (amount === undefined) return ''
					return bigintToDecimalString(amount, 18n, 18)
				} }
			/>
			<span>{ unit.value }</span>
		</div>
		<div>
			<p> OR </p>
		</div>
		<div>
			<label>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'Invalid'
					disabled = { disabled }
					checked = { invalid.value }
					onChange = { (event ) => {
						const target = event.target as HTMLInputElement
						invalid.value = target.checked
					} }
				/>
				{'Invalid'}
			</label>
		</div>
		<span>{ `Range ${ bigintToDecimalString(minValue.value, 18n) } - ${ bigintToDecimalString(maxValue.value, 18n) } (increment: ${ bigintToDecimalString(tradeInterval.value, 18n) })` }</span>
	</div>
}

type ReportedScalarInputsProps = {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
}

export const ReportedScalarInputs = ({ outcomeStakes, preemptiveDisputeCrowdsourcerStake  }: ReportedScalarInputsProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	const totalStake = useComputed(() => outcomeStakes.deepValue === undefined ? 0n : outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n))
	return <div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content max-content', gap: '0.5rem', alignItems: 'center' } }> {
		outcomeStakes.deepValue.map((outcomeStake) => <>
			<span>{ outcomeStake.outcomeName } ({ outcomeStake.status })</span>
			{ totalStake.value === 0n ? <><span></span><span></span></> : <>
				<span>{ bigintToDecimalString(outcomeStake.repStake, 18n, 2) } REP</span>
				<span>
					{ outcomeStake.status === 'Winning'
						? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } REP`
						: `Required for Dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP`
					}
				</span>
			</> }
			<span>
				{ outcomeStake.alreadyContributedToOutcomeStake === undefined ? <></> : <>
				(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcomeStake, 18n, 2) } REP / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } REP)
				</> }
			</span>
		</>)
	} </div>
}
