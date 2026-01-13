import * as funtypes from 'funtypes'

type TransactionParams = funtypes.Static<typeof TransactionParams>
const TransactionParams = funtypes.ReadonlyPartial({
	chainid: funtypes.String,
	to: funtypes.String,
	from: funtypes.String,
	value: funtypes.String,
	data: funtypes.String,
	gas: funtypes.Union(funtypes.String, funtypes.Number),
	maxFeePerGas: funtypes.String,
	maxPriorityFeePerGas: funtypes.String,
	nonce: funtypes.Number,
})

export type TransactionParamsTuple = funtypes.Static<typeof TransactionParamsTuple>
export const TransactionParamsTuple = funtypes.Tuple(TransactionParams)
