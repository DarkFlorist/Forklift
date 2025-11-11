import { UserRejectedRequestError } from 'viem'

export function jsonStringify(value: unknown, space?: string | number | undefined): string {
	return JSON.stringify(value, (_, value) => {
		if (typeof value === 'bigint') return `0x${ value.toString(16) }n`
		if (value instanceof Uint8Array) return `b'${ Array.from(value).map(x => x.toString(16).padStart(2, '0')).join('') }'`
		// cast works around https://github.com/uhyo/better-typescript-lib/issues/36
		return value as JSONValueF<unknown>
	}, space)
}

export function ensureError(caught: unknown) {
	return (caught instanceof Error) ? caught
		: typeof caught === 'string' ? new Error(caught)
		: typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string' ? new Error(caught.message)
		: new Error(`Unknown error occurred.\n${ jsonStringify(caught) }`)
}

export function assertNever(value: never): never {
	throw new Error(`Unhandled discriminated union member: ${ JSON.stringify(value) }`)
}

export const isUserRejectedRequest = (error: unknown) => {
	if (error instanceof UserRejectedRequestError) return true
	const potentialError = error as { code?: unknown; name?: unknown; message?: unknown } | undefined
	if (!potentialError) return false
	if (potentialError.code === 4001) return true
	if (potentialError.name === 'UserRejectedRequestError') return true
	if (typeof potentialError.message === 'string' && /user rejected|user denied|transaction rejected/i.test(potentialError.message)) return true
	return false
}

