import { EthereumAddress, EthereumQuantity } from '../types/types.js'
import { bigintToDecimalString, decimalStringToBigint, isDecimalString } from './ethereumUtils.js'

export const parseAddressForInput = (maybeAddressString: string | undefined) => {
	if (maybeAddressString === undefined) return { ok: false } as const
	const parsed = EthereumAddress.safeParse(maybeAddressString.trim())
	if (parsed.success) return { ok: true, value: maybeAddressString.trim() } as const
	return { ok: false } as const
}

export const serializeAddressForInput = (maybeAddressString: string | undefined) => {
	if (maybeAddressString === undefined) return ''
	return maybeAddressString.trim()
}

export const parseDecimalBigintForInput = (maybeAmount: string | undefined, decimals: bigint) => {
	if (maybeAmount === undefined) return { ok: false } as const
	if (!isDecimalString(maybeAmount.trim())) return { ok: false } as const
	const parsed = decimalStringToBigint(maybeAmount.trim(), decimals)
	return { ok: true, value: parsed } as const
}

export const serializeDecimalBigintForInput = (maybeAmount: EthereumQuantity | undefined, decimals: bigint) => {
	if (maybeAmount === undefined) return ''
	return bigintToDecimalString(maybeAmount, decimals)
}

export const parse18DecimalBigintForInput = (maybeAmount: string | undefined) => parseDecimalBigintForInput(maybeAmount, 18n)
export const serialize18DecimalBigintForInput = (maybeAmount: EthereumQuantity | undefined) => serializeDecimalBigintForInput(maybeAmount, 18n)

export const parse16DecimalBigintForInput = (maybeAmount: string | undefined) => parseDecimalBigintForInput(maybeAmount, 16n)
export const serialize16DecimalBigintForInput = (maybeAmount: EthereumQuantity | undefined) => serializeDecimalBigintForInput(maybeAmount, 16n)

export const parseCommaSeparatedString = (maybeCommaSeparatedArray: string | undefined) => {
	if (maybeCommaSeparatedArray === undefined) return { ok: false } as const
	const categories = maybeCommaSeparatedArray.split(',').map((element) => element.trim())
	return { ok: true, value: categories } as const
}

export const serializeCommaSeparatedString = (maybeCommaSeparatedArray: readonly string[] | undefined) => {
	if (maybeCommaSeparatedArray === undefined) return ''
	return maybeCommaSeparatedArray.join(', ')
}
