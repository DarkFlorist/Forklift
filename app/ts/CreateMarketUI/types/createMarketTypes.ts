import * as funtypes from 'funtypes'
import { LiteralConverterParserFactory } from '../../types/types.js'

export type ExtraInfo = funtypes.Static<typeof ExtraInfo>
export const ExtraInfo = funtypes.Intersect(
	funtypes.ReadonlyObject({
		description: funtypes.String,
	}).asReadonly(),
	funtypes.Partial({
		categories: funtypes.ReadonlyArray(funtypes.String),
		tags: funtypes.ReadonlyArray(funtypes.String),
		longDescription: funtypes.String,
		template: funtypes.Unknown,
		_scalarDenomination: funtypes.Union(funtypes.String, funtypes.Literal(false)).withParser(LiteralConverterParserFactory<false | string, undefined>(false, undefined))
	})
)
