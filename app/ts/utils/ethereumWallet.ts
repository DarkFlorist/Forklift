import 'viem/window'
import { AccountAddress } from '../types/types.js'
import { createPublicClient, createWalletClient, custom, http, publicActions } from 'viem'
import { mainnet } from 'viem/chains'

export const requestAccounts = async () => {
	if (window.ethereum === undefined) throw new Error('no window.ethereum injected')
	const reply = await window.ethereum.request({ method: 'eth_requestAccounts', params: undefined })
	return reply[0]
}

export const getAccounts = async () => {
	if (window.ethereum === undefined) throw new Error('no window.ethereum injected')
	const reply = await window.ethereum.request({ method: 'eth_accounts', params: undefined })
	return reply[0]
}

export const createReadClient = (accountAddress: AccountAddress | undefined) => {
	if (window.ethereum === undefined || accountAddress === undefined) {
		return createPublicClient({ chain: mainnet, transport: http('https://ethereum.dark.florist', { batch: { wait: 100 } }), cacheTime: 10_000 })
	}
	return createWalletClient({ chain: mainnet, transport: custom(window.ethereum) }).extend(publicActions)
}

export const createWriteClient = (accountAddress: AccountAddress) => {
	if (window.ethereum === undefined) throw new Error('no window.ethereum injected')
	if (accountAddress === undefined) throw new Error('no accountAddress!')
	return createWalletClient({ account: accountAddress, chain: mainnet, transport: custom(window.ethereum), cacheTime: 10_000 }).extend(publicActions)
}

export type ReadClient = ReturnType<typeof createReadClient> | ReturnType<typeof createWriteClient>
export type WriteClient = ReturnType<typeof createWriteClient>

export const getChainId = async (readClient: ReadClient) => {
	return await readClient.getChainId()
}
