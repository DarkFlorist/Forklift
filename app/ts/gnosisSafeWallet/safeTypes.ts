import * as funtypes from 'funtypes'
import { AccountAddress, EthereumAddress, EthereumBytes32 } from '../types/types.js'

export type GetSafeInfoReply = funtypes.Static<typeof GetSafeInfoReply>
export const GetSafeInfoReply = funtypes.ReadonlyObject({
	id: funtypes.String,
	success: funtypes.Boolean,
	version: funtypes.String,
	data: funtypes.ReadonlyObject({
		safeAddress: EthereumAddress,
		chainId: funtypes.Number,
		owners: funtypes.ReadonlyArray(EthereumAddress),
		threshold: funtypes.Number,
		isReadOnly: funtypes.Boolean,
		nonce: funtypes.Number,
		implementation: EthereumAddress,
		modules: funtypes.Unknown,
		fallbackHandler: EthereumAddress,
		guard: funtypes.Unknown,
		version: funtypes.String,
		network: funtypes.String
	})
})

export type WalletConnection = {
	type: 'window.ethereum'
	address: AccountAddress | undefined
} | {
	type: 'window.post'
	safeInfo: GetSafeInfoReply
}

export type SafeReply = funtypes.Static<typeof SafeReply>
export const SafeReply = funtypes.Union(
	funtypes.ReadonlyObject({
		id: funtypes.String,
		success: funtypes.Literal(true),
		version: funtypes.String,
		data: funtypes.String
	}),
	funtypes.ReadonlyObject({
		id: funtypes.String,
		success: funtypes.Literal(false),
		version: funtypes.String,
		error: funtypes.String
	})
)

export const HashParams = funtypes.Tuple(EthereumBytes32)

export type TxHashReply = funtypes.Static<typeof TxHashReply>
export const TxHashReply = funtypes.ReadonlyObject({ txHash: EthereumBytes32 })

export const SafeTxHashReply = funtypes.ReadonlyObject({ safeTxHash: funtypes.String })

export const SafeGetBlockNumber = funtypes.ReadonlyObject({ number: funtypes.String })
