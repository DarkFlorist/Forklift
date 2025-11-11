
import * as funtypes from 'funtypes'

export type AccountAddress = `0x${ string }`

const BigIntParser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{1,64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded number.` }
		return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16)}` }
	},
}

const Bytes32Parser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded 32 byte value.` }
		return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(64, '0')}` }
	},
}

const AddressParser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{40})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded address.` }
		return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(40, '0')}` }
	},
}

export const LiteralConverterParserFactory: <TInput, TOutput> (input: TInput, output: TOutput) => funtypes.ParsedValue<funtypes.Runtype<TInput>, TOutput>['config'] = (input, output) => {
	return {
		parse: value => (value === input) ? { success: true, value: output } : { success: false, message: `${value} was expected to be literal.` },
		serialize: value => (value === output) ? { success: true, value: input } : { success: false, message: `${value} was expected to be literal.`  }
	}
}

const BigIntParserNonHex: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^[0-9]+$/.test(value)) return { success: false, message: `${ value } is not a string encoded number.` }
		return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${ typeof value } is not a bigint.`}
		return { success: true, value: `${ value.toString() }` }
	},
}

export const NonHexBigInt = funtypes.String.withParser(BigIntParserNonHex)
export type NonHexBigInt = funtypes.Static<typeof NonHexBigInt>

export const EthereumAddress = funtypes.String.withParser(AddressParser)
export type EthereumAddress = funtypes.Static<typeof EthereumAddress>

export const EthereumQuantity = funtypes.String.withParser(BigIntParser)
export type EthereumQuantity = funtypes.Static<typeof EthereumQuantity>

export const EthereumBytes32 = funtypes.String.withParser(Bytes32Parser)
export type EthereumBytes32 = funtypes.Static<typeof EthereumBytes32>

export type MarketType = 'Yes/No' | 'Categorical' | 'Scalar'

export type UniverseInformation = {
	universeAddress: AccountAddress
	reputationTokenAddress: AccountAddress
	repTokenName: string
}
