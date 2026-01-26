export async function abortGuard<ReturnValue>(abortController: AbortController | undefined, call: () => Promise<ReturnValue>): Promise<ReturnValue> {
	if (abortController === undefined) return await call()
	if (abortController.signal.aborted) throw new Error('Signal aborted')
	const value = await call()
	if (abortController.signal.aborted) throw new Error('Signal aborted')
	return value
}


export const silenceChromeUnCaughtPromise = async <ReturnValue>(maybeAwaitedFunction: Promise<ReturnValue>) => {
	maybeAwaitedFunction.catch(() => undefined)
	return maybeAwaitedFunction
}

export async function promiseAllMapAbortSafe<InputType, OutputType>(values: readonly InputType[], mapper: (value: InputType, index: number) => Promise<OutputType>): Promise<OutputType[]> {
	const guardedPromises = values.map(async (value, index) => {
		const promise = mapper(value, index)
		promise.catch(() => undefined)
		return await promise
	})
	return await silenceChromeUnCaughtPromise(Promise.all(guardedPromises))
}
