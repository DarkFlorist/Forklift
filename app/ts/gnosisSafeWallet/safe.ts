import { GetSafeInfoReply, SafeReply, WalletConnection } from './safeTypes.js'
import { createReadClient, createWriteClient, getAccounts, requestAccounts } from '../utils/ethereumWallet.js'
import { createWalletClient, custom, publicActions, UserRejectedRequestError } from 'viem'
import { mainnet } from 'viem/chains'
import { SafeAppProvider } from './safeProvider.js'
import { TIMEOUT, VERSION } from './constants.js'
import { addressString } from '../utils/ethereumUtils.js'

export const tryConnectingSafe = async () => {
	const id = crypto.randomUUID()
	return new Promise<GetSafeInfoReply>((resolve, reject) => {
		const messageListener = (event: MessageEvent) => {
			if (event.source !== window.parent) return
			const parsedReply = GetSafeInfoReply.safeParse(event.data)
			if (!parsedReply.success) return
			if (parsedReply.value.id !== id) return
			window.removeEventListener('message', messageListener)
			resolve(parsedReply.value)
		}
		window.addEventListener('message', messageListener)
		window.parent.postMessage({ ...VERSION, method: 'getSafeInfo', id }, '*')
		setTimeout(() => {
			window.removeEventListener('message', messageListener)
			reject(new Error(TIMEOUT))
		}, 200)
	})
}

export const safeRequest = async (rpcMethod: string, params: unknown): Promise<unknown> => {
	const id = crypto.randomUUID()
	return new Promise((resolve, reject) => {
		const messageListener = (event: MessageEvent) => {
			if (event.source !== window.parent) return
			const parsedReply = SafeReply.safeParse(event.data)
			if (!parsedReply.success) return
			if (parsedReply.value.id !== id) return
			if (!parsedReply.value.success) return reject(new Error(parsedReply.value.error))
			window.removeEventListener('message', messageListener)
			return resolve(parsedReply.value.data)
		}
		window.addEventListener('message', messageListener)
		window.parent.postMessage({ ...VERSION, method: 'rpcCall', params: { call: rpcMethod, params }, id }, '*')
		setTimeout(() => {
			window.removeEventListener('message', messageListener)
			reject(new Error(TIMEOUT))
		}, 60_000)
	})
}

export const safeSendTransaction = async (params: unknown): Promise<unknown> => {
	const id = crypto.randomUUID()
	return new Promise((resolve, reject) => {
		const messageListener = (event: MessageEvent) => {
			if (event.source !== window.parent) return
			const parsedReply = SafeReply.safeParse(event.data)
			if (!parsedReply.success) return
			if (parsedReply.value.id !== id) return
			if (!parsedReply.value.success) {
				if (parsedReply.value.error.includes('Transaction was rejected')) return reject(new UserRejectedRequestError(new Error('User rejected the request')))
				return reject(new Error(parsedReply.value.error))
			}
			window.removeEventListener('message', messageListener)
			return resolve(parsedReply.value.data)
		}
		window.addEventListener('message', messageListener)
		window.parent.postMessage({ ...VERSION, method: 'sendTransactions', params, id }, '*')
	})
}

export const priorityConnectSafeIfFailsConnectWindowEthereum = async (askWallet: boolean): Promise<WalletConnection | undefined> => {
	try {
		const safeInfo = await tryConnectingSafe()
		return { type: 'window.post' as const, safeInfo }
	} catch(error: unknown) {
		if (error instanceof Error && error.message.includes(TIMEOUT)) {
			if (window.ethereum === undefined) return undefined
			const address = askWallet ? await requestAccounts() : await getAccounts()
			return { type: 'window.ethereum' as const, address }
		}
		throw error
	}
}

export const createReadClientFromConnection = (connection: WalletConnection | undefined, rpcToUse: string) => {
	if (connection === undefined) return createReadClient(undefined, rpcToUse)
	if (connection.type === 'window.ethereum') return createReadClient(connection.address, rpcToUse)
	const safeAppProvider = new SafeAppProvider(connection.safeInfo)
	return createWalletClient({ chain: mainnet, transport: custom(safeAppProvider) }).extend(publicActions)
}

export const createWriteClientFromConnection = (connection: WalletConnection) => {
	if (connection.type === 'window.ethereum') {
		if (connection.address === undefined) throw new Error('cannot create write client from undefined')
		return createWriteClient(connection.address)
	} else {
		const safeAppProvider = new SafeAppProvider(connection.safeInfo)
		return createWalletClient({ account: addressString(connection.safeInfo.data.safeAddress), chain: mainnet, transport: custom(safeAppProvider), cacheTime: 10_000 }).extend(publicActions)
	}
}
