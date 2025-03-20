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

export const bigintToNumberFormatParts = (amount: bigint, decimals = 18, maximumSignificantDigits = 4) => {
	const formattedString = formatUnits(amount, decimals)
	const [ integerPartRaw, fractionPartRaw = '' ] = formattedString.split('.')
	if (integerPartRaw === undefined) throw new Error('failed to format bigint to string')
	const absoluteIntPart = BigInt(integerPartRaw.replace('-', ''))
	const useCompact = absoluteIntPart >= 10000n * 10n ** BigInt(decimals)

	const partsMap = new Map<Intl.NumberFormatPartTypes, string>()

	if (useCompact) {
		const suffixes = [
			{ value: 1000000000000n, symbol: 'T' },
			{ value: 1000000000n, symbol: 'G' },
			{ value: 1000000n, symbol: 'M' },
			{ value: 1000n, symbol: 'k' }
		]
		let chosenSuffix = ''
		let divisor = 1n
		for (const { value, symbol } of suffixes) {
			if (absoluteIntPart >= value) {
				divisor = value
				chosenSuffix = symbol
				break
			}
		}
		const fractionLength = fractionPartRaw.length
		const totalScale = 10n ** BigInt(fractionLength)
		const fullValueBigInt = BigInt(integerPartRaw) * totalScale + (fractionPartRaw ? BigInt(fractionPartRaw) : 0n)

		const maxFracDigits = maximumSignificantDigits
		const scaleFactor = 10n ** BigInt(maxFracDigits)
		const scaledValue = fullValueBigInt * scaleFactor / (divisor * totalScale)
		const scaledStr = scaledValue.toString().padStart(maxFracDigits + 1, '0')
		const integerPartCompact = scaledStr.slice(0, -maxFracDigits) || '0'
		const fractionPartCompact = scaledStr.slice(-maxFracDigits).replace(/0+$/, '')
		partsMap.set('integer', integerPartCompact)
		if (fractionPartCompact) {
			partsMap.set('decimal', '.')
			partsMap.set('fraction', fractionPartCompact)
		}
		partsMap.set('compact', chosenSuffix)
		return partsMap
	} else {
		const numValue = parseFloat(formattedString)
		const formatterOptions: Intl.NumberFormatOptions = {
			useGrouping: false,
			maximumSignificantDigits: maximumSignificantDigits,
			maximumFractionDigits: 3
		}
		const formatter = new Intl.NumberFormat('en-US', formatterOptions)
		const parts = formatter.formatToParts(numValue)
		for (const part of parts) {
			partsMap.set(part.type, part.value)
		}
		return partsMap
	}
}


export const bigintToRoundedPrettyDecimalString = (amount: bigint, decimals: bigint, maximumSignificantDigits = 4) => {
	if (decimals > 100n) throw new Error('Too many decimals provided')
	const numberParts = bigintToNumberFormatParts(amount, Number(decimals), maximumSignificantDigits)
	let numberString = ''
	for (const [_type, value] of numberParts) numberString += value
	return numberString
}

export const formatUnixTimestampISO = (timestamp: bigint): string => {
	const date = new Date(Number(timestamp) * 1000)
	return date.toISOString()
}
