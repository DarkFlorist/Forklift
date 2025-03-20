import { formatUnits } from 'viem'

export function hexToBytes(value: string) {
	const result = new Uint8Array((value.length - 2) / 2)
	for (let i = 0; i < result.length; ++i) {
		result[i] = Number.parseInt(value.slice(i * 2 + 2, i * 2 + 4), 16)
	}
	return result
}

export function dataString(data: Uint8Array | null) {
	if (data === null) return ''
	return Array.from(data).map(x => x.toString(16).padStart(2, '0')).join('')
}

export const addressString = (address: bigint): `0x${ string }` => `0x${ address.toString(16).padStart(40, '0') }`

export function dataStringWith0xStart(data: Uint8Array | null): `0x${ string }` {
	if (data === null) return '0x'
	return `0x${ dataString(data) }`
}

export function isDecimalString(value: string): boolean {
	return /^\d*\.?\d*$/.test(value)
}

export function decimalStringToBigint(value: string, power: bigint): bigint {
	if (!(isDecimalString(value))) throw new Error(`Value is not a decimal sring.`)
	let [integerPart, fractionalPart] = value.split('.')
	// null assertion is safe because the first element of a string.split will always be present when you split by anything other than empty string
	integerPart = integerPart!.padStart(1, '0')
	fractionalPart = (fractionalPart || '').slice(0, Number(power)).padEnd(Number(power), '0')
	return BigInt(`${ integerPart }${ fractionalPart }`)
}

export function bigintToDecimalString(value: bigint, power: bigint): string {
	const integerPart = value / 10n**power
	const fractionalPart = value % 10n**power
	if (fractionalPart === 0n) {
		return integerPart.toString(10)
	} else {
		return `${integerPart.toString(10)}.${fractionalPart.toString(10).padStart(Number(power), '0').replace(/0+$/, '')}`
	}
}

export function isSameAddress(address1: `0x${ string }` | undefined, address2: `0x${ string }` | undefined) {
	if (address1 === undefined && address2 === undefined) return true
	if (address1 === undefined || address2 === undefined) return false
	return address1.toLowerCase() === address2.toLowerCase()
}

export const bigintToNumberFormatParts = (amount: bigint, decimals = 18n, maximumSignificantDigits = 4) => {
	const floatValue = Number(formatUnits(amount, Number(decimals)))

	let formatterOptions: Intl.NumberFormatOptions = { useGrouping: false, maximumFractionDigits: 3 }

	// maintain accuracy if value is a fraction of 1 ex 0.00001
	if (floatValue % 1 === floatValue) formatterOptions.maximumSignificantDigits = maximumSignificantDigits

	// apply only compacting with prefixes for values >= 10k or values <= -10k
	if (Math.abs(floatValue) >= 1e4) {
		formatterOptions = { minimumFractionDigits: 0, notation: 'compact' }
	}

	const formatter = new Intl.NumberFormat('en-US', formatterOptions)
	const parts = formatter.formatToParts(floatValue)
	const partsMap = new Map<Intl.NumberFormatPartTypes, string>()

	for (const part of parts) {
		if (part.type === 'compact') {
			// replace American format with Metric prefixes https://www.ibiblio.org/units/prefixes.html
			const prefix = part.value.replace('K', 'k').replace('B', 'G')
			partsMap.set(part.type, prefix)
			continue
		}
		partsMap.set(part.type, part.value)
	}

	return partsMap
}

export const bigintToRoundedPrettyDecimalString = (amount: bigint, decimals?: bigint, maximumSignificantDigits = 4) => {
	const numberParts = bigintToNumberFormatParts(amount, decimals, maximumSignificantDigits)
	let numberString = ''
	for (const [_type, value] of numberParts) numberString += value
	return numberString
}

export const formatUnixTimestampISO = (timestamp: bigint): string => {
	const date = new Date(Number(timestamp) * 1000)
	return date.toISOString()
}
