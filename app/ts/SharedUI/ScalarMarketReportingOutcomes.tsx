import { NonHexBigInt, UniverseInformation } from '../types/types.js'
import { Input } from './Input.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { Signal, useComputed, useSignal } from '@preact/signals'
import { getPayoutNumeratorsFromScalarOutcome, getScalarOutcomeName, getTradeInterval, requiredStake } from '../utils/augurUtils.js'
import { bigintToDecimalString, decimalStringToBigint, isDecimalString } from '../utils/ethereumUtils.js'
import { BigIntSlider } from './BigIntSlider.js'
import { OutcomeStake } from './YesNoCategoricalMarketReportingOutcomes.js'
import { UniverseLink } from './links.js'
import { SendTransactionButton, TransactionStatus } from './SendTransactionButton.js'
import { WriteClient } from '../utils/ethereumWallet.js'
import { createChildUniverse } from '../utils/augurContractUtils.js'

type ScalarInputProps = {
	value: OptionalSignal<bigint>
	minValue: Signal<bigint>
	maxValue: Signal<bigint>
	numTicks: Signal<bigint>
	unit: Signal<string>
	invalid: Signal<boolean>
	disabled: Signal<boolean>
	selectedOutcomeUniverse: Signal<UniverseInformation | undefined>
	pathSignal: Signal<string>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	refreshStakes: () => Promise<void>
}

export function ScalarInput({ refreshStakes, maybeWriteClient, universe, value, minValue, maxValue, numTicks, unit, invalid, disabled, selectedOutcomeUniverse, pathSignal }: ScalarInputProps) {
	const tradeInterval = useComputed(() => getTradeInterval(maxValue.value - minValue.value, numTicks.value))
	const isSliderAndInputDisabled = useComputed(() => disabled.value || invalid.value)
	const invalidInput = useSignal<boolean>(false)
	const transactionStatus = useSignal<TransactionStatus>(undefined)

	const createUniverse = async () => {
		if (maybeWriteClient.deepValue === undefined) throw new Error('client missing')
		if (universe.deepValue?.universeAddress === undefined) throw new Error('universe missing')
		const selectedPayoutNumerators = getPayoutNumeratorsFromScalarOutcome(invalid.value, value.deepValue, minValue.value, maxValue.value, numTicks.value)
		return await createChildUniverse(maybeWriteClient.deepValue, universe.deepValue.universeAddress, selectedPayoutNumerators)
	}

	const universeLinkOrButton = useComputed(() => {
		if (selectedOutcomeUniverse.value === undefined) {
			const selectedPayoutNumerators = getPayoutNumeratorsFromScalarOutcome(invalid.value, value.deepValue, minValue.value, maxValue.value, numTicks.value)
			const outcomeName = getScalarOutcomeName(selectedPayoutNumerators, unit.value, numTicks.value, minValue.value, maxValue.value)
			return <SendTransactionButton
				className = 'button button-secondary'
				transactionStatus = { transactionStatus }
				sendTransaction = { createUniverse }
				maybeWriteClient = { maybeWriteClient }
				disabled = { disabled }
				text = { new Signal(`Create "${ outcomeName }" Universe`) }
				callBackWhenIncluded = { refreshStakes }
			/>
		} else {
			return <>
				<p> <UniverseLink universe = { selectedOutcomeUniverse } pathSignal = { pathSignal }/></p>
				( { selectedOutcomeUniverse.value?.repTokenName })
			</>
		}
	})

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
		{ universeLinkOrButton.value }
	</div>
}

type ReportedScalarInputsProps = {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	universe: Signal<UniverseInformation>
}

export const ReportedScalarInputs = ({ outcomeStakes, preemptiveDisputeCrowdsourcerStake, universe }: ReportedScalarInputsProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>

	const totalStake = useComputed(() => outcomeStakes.deepValue === undefined ? 0n : outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n))
	return <div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content max-content', gap: '0.5rem', alignItems: 'center' } }> {
		outcomeStakes.deepValue.map((outcomeStake) => <div class = 'reporting-round'>
			<span><b>Option: { outcomeStake.outcomeName } ({ outcomeStake.status })</b></span>
			{ totalStake.value === 0n ? <><span></span><span></span></> : <>
				<span>Stake: { bigintToDecimalString(outcomeStake.repStake, 18n, 2) } { universe.value.repTokenName }</span>
				<span>
					{ outcomeStake.status === 'Winning'
						? `Prestaked: ${ bigintToDecimalString(preemptiveDisputeCrowdsourcerStake.deepValue || 0n, 18n, 2) } ${ universe.value.repTokenName }`
						: `Required for Dispute: ${ bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } ${ universe.value.repTokenName }`
					}
				</span>
			</> }
			<span>
				{ outcomeStake.alreadyContributedToOutcomeStake === undefined ? <></> : <>
				(Already contributed: { bigintToDecimalString(outcomeStake.alreadyContributedToOutcomeStake, 18n, 2) } { universe.value.repTokenName } / { bigintToDecimalString(requiredStake(totalStake.value, outcomeStake.repStake), 18n, 2) } { universe.value.repTokenName })
				</> }
			</span>
		</div>)
	} </div>
}
