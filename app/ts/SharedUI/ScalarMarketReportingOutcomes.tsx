import { AccountAddress, NonHexBigInt } from '../types/types.js'
import { Input } from './Input.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { Signal, useComputed, useSignal } from '@preact/signals'
import { getTradeInterval, requiredStake } from '../utils/augurUtils.js'
import { bigintToDecimalString, decimalStringToBigint, isDecimalString } from '../utils/ethereumUtils.js'
import { BigIntSlider } from './BigIntSlider.js'
import { OutcomeStake } from './YesNoCategoricalMarketReportingOutcomes.js'
import { UniverseLink } from './links.js'

type ScalarInputProps = {
	value: OptionalSignal<bigint>
	minValue: Signal<bigint>
	maxValue: Signal<bigint>
	numTicks: Signal<bigint>
	unit: Signal<string>
	invalid: Signal<boolean>
	disabled: Signal<boolean>
	selectedOutcomeUniverseAddress: Signal<AccountAddress | undefined>
	pathSignal: Signal<string>
}

export function ScalarInput({ value, minValue, maxValue, numTicks, unit, invalid, disabled, selectedOutcomeUniverseAddress, pathSignal }: ScalarInputProps) {
	const tradeInterval = useComputed(() => getTradeInterval(maxValue.value - minValue.value, numTicks.value))
	const isSliderAndInputDisabled = useComputed(() => disabled.value || invalid.value)
	const invalidInput = useSignal<boolean>(false)
	return <div class = 'scalar-options-container' key = 'scalar-input-container3'>
		<div class = 'slider-input-info-container' key = 'scalar-input-container2'>
			<div class = 'slider-input-container' key = 'scalar-input-container'>
				<BigIntSlider
					min = { minValue }
					max = { maxValue }
					value = { value }
					step = { numTicks }
					disabled = { isSliderAndInputDisabled }
					key = 'scalar-slider'
				/>
				<Input
					class = 'input scalar-input'
					type = 'text'
					placeholder = 'Allocation'
					key = 'scalar-input'
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
					} }
					serialize = { (amount: NonHexBigInt | undefined) => {
						if (amount === undefined) return ''
						return bigintToDecimalString(amount, 18n, 18)
					} }
					invalidSignal = { invalidInput }
				/>
				<div class = 'unit'> { unit.value } </div>
			</div>

			<span class = 'note'>
				{ `Range ${ bigintToDecimalString(minValue.value, 18n) } - ${ bigintToDecimalString(maxValue.value, 18n) } (increment: ${ bigintToDecimalString(tradeInterval.value, 18n) })` }
			</span>
		</div>

		<div class = 'or-divider'>
			OR
		</div>

		<div class = 'invalid-check-box-container'>
			<label class = 'custom-input-label invalid-check-box-container-inner' style = { { cursor: disabled.value ? 'not-allowed' : 'pointer' } }>
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
				<span class = 'invalid-tag'>Invalid</span>
			</label>
		</div>
		<p> Universe Address: <UniverseLink address = { selectedOutcomeUniverseAddress } pathSignal = { pathSignal }/></p>
	</div>
}

type ReportedScalarInputsProps = {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	repTokenName: Signal<string>
}

export const ReportedScalarInputs = ({ outcomeStakes, preemptiveDisputeCrowdsourcerStake, repTokenName }: ReportedScalarInputsProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	const totalStake = useComputed(() => outcomeStakes.deepValue === undefined ? 0n : outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n))
	return <div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content max-content', gap: '0.5rem', alignItems: 'center' } }> {
		outcomeStakes.deepValue.map((outcomeStake) => <div class = 'reporting-round'>
			<span><b>Option: { outcomeStake.outcomeName } ({ outcomeStake.status })</b></span>
			{ totalStake.value === 0n ? <><span></span><span></span></> : <>
				<span>Stake: { bigintToDecimalString(outcomeStake.repStake, 18n, 2) } { repTokenName }</span>
				<span>
					{ outcomeStake.status === 'Winning'
						? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } ${ repTokenName }`
						: `Required for Dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } ${ repTokenName }`
					}
				</span>
			</> }
			<span>
				{ outcomeStake.alreadyContributedToOutcomeStake === undefined ? <></> : <>
				(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcomeStake, 18n, 2) } { repTokenName } / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } { repTokenName })
				</> }
			</span>
		</div>)
	} </div>
}
