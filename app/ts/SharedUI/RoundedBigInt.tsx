import { ReadonlySignal, useComputed } from '@preact/signals'
import { bigintToDecimalString, bigintToRoundedDecimalString, isPracticallyInfinite } from '../utils/ethereumUtils.js'
import { CopyToClipboard } from './CopyToClipboard.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'

type BaseRoundedDecimalStringParams = {
	computedValue: ReadonlySignal<bigint | undefined>
	power: bigint
	maxDecimals: number
	roundUp?: boolean | undefined
	showPracticallyInfinite?: boolean
}

function BaseRoundedDecimalString({ computedValue, power, maxDecimals, roundUp, showPracticallyInfinite }: BaseRoundedDecimalStringParams) {
	const approxValue = useComputed(() => {
		if (computedValue.value === undefined) return '?'
		if (showPracticallyInfinite && isPracticallyInfinite(computedValue.value, power)) return 'Practically Infinite'
		const roundedValue = bigintToRoundedDecimalString(computedValue.value, power, maxDecimals, roundUp)
		const exactValue = bigintToDecimalString(computedValue.value, power)
		if (roundedValue === exactValue) return `${ roundedValue }`
		return `~${ roundedValue }`
	})

	const copyContent = useComputed(() => computedValue.value === undefined ? '?' : bigintToDecimalString(computedValue.value, power))
	const copyMessage = useComputed(() => `Copied ${ copyContent.value }`)

	return (
		<span style = 'display: inline; text-decoration: underline; text-decoration-style: dotted;'>
			<CopyToClipboard content = { copyContent.value } copyMessage = { copyMessage.value }>
				<span className = 'noselect nopointer'>{ approxValue.value }</span>
			</CopyToClipboard>
		</span>
	)
}

export type RoundedDecimalStringsParams = {
	value: ReadonlySignal<bigint>
	power: bigint
	maxDecimals: number
	roundUp?: boolean
}

export function RoundedDecimalString({ value, power, maxDecimals, roundUp}: RoundedDecimalStringsParams) {
	return <BaseRoundedDecimalString computedValue = { value } power = { power } maxDecimals = { maxDecimals } roundUp = { roundUp }/>
}

export type RoundedDecimalStringWithUnknownParams = {
	value: OptionalSignal<bigint> | ReadonlySignal<bigint | undefined>
	power: bigint
	maxDecimals: number
	roundUp?: boolean
}

export function RoundedDecimalStringWithUnknown({ value, power, maxDecimals, roundUp }: RoundedDecimalStringWithUnknownParams) {
	const computedValue = useComputed(() => 'deepValue' in value ? value.deepValue : value.value)
	return <BaseRoundedDecimalString computedValue = { computedValue } power = { power } maxDecimals = { maxDecimals } roundUp = { roundUp }/>
}

export type RoundedDecimalStringWithUnknownAndPracticallyInfiniteParams = {
	value: OptionalSignal<bigint>
	power: bigint
	maxDecimals: number
}

export function RoundedDecimalStringWithUnknownAndPracticallyInfinite({ value, power, maxDecimals }: RoundedDecimalStringWithUnknownAndPracticallyInfiniteParams) {
	const computedValue = useComputed(() => value.deepValue)
	return <BaseRoundedDecimalString computedValue = { computedValue } power = { power } maxDecimals = { maxDecimals } showPracticallyInfinite = { true }/>
}
