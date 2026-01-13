import { toHex } from 'viem'
import { addressString, bytes32String } from '../utils/ethereumUtils.js'
import { GetSafeInfoReply, HashParams, SafeGetBlockNumber, SafeTxHashReply, TxHashReply } from './safeTypes.js'
import { safeRequest, safeSendTransaction } from './safe.js'
import { TransactionParamsTuple } from './ethereumTypes.js'

type EventCallback = (eventData: unknown) => void

// The API is based on Ethereum JavaScript API Provider Standard. Link: https://eips.ethereum.org/EIPS/eip-1193
export class SafeAppProvider {
	private readonly safe: GetSafeInfoReply
	private submittedTxs = new Map<string, unknown>()

	constructor(safe: GetSafeInfoReply) {
		this.safe = safe
	}

	async connect(): Promise<void> {
		this.emit('connect', { chainId: this.chainId })
	}

	private eventListeners: Record<string, EventCallback[]> = { }

	public on(eventName: string, callback: EventCallback) {
		const existingListeners = this.eventListeners[eventName] ?? []
		this.eventListeners[eventName] = [ ...existingListeners, callback ]
	}

	public emit(eventName: string, eventData: unknown) {
		const listeners = this.eventListeners[eventName] ?? []
		for (const listener of listeners) {
			listener(eventData)
		}
	}

	async disconnect(): Promise<void> {
		return
	}

	public get chainId(): number {
		return this.safe.data.chainId
	}

	async request(request: { method: string; params?: unknown }): Promise<unknown> {
		const { method, params = [] } = request
		switch (method) {
			case 'eth_accounts': return [addressString(this.safe.data.safeAddress)]
			case 'net_version':
			case 'eth_chainId': return toHex(this.safe.data.chainId)
			case 'safe_setSettings':
			case 'wallet_getCapabilities':
			case 'wallet_showCallsStatus':
			case 'wallet_sendCalls':
			case 'wallet_getCallsStatus':
			case 'eth_sign':
			case 'personal_sign':
			case 'eth_signTypedData':
			case 'eth_signTypedData_v4': throw new Error(`Not implemented method: ${ method }`)

			case 'eth_sendTransaction': {
				const firstParam = TransactionParamsTuple.parse(params)[0]

				const transactionToSend = {
					to: firstParam.to ?? '',
					value: firstParam.value ?? '0',
					data: firstParam.data ?? '0x',
					nonce: firstParam.nonce ?? 0,
					gas: firstParam.gas
				}

				if (typeof firstParam.gas === 'string' && firstParam.gas.startsWith('0x')) {
					transactionToSend.gas = parseInt(firstParam.gas, 16)
				}

				const resp = SafeTxHashReply.parse(await safeSendTransaction({ txs: [transactionToSend], params: { safeTxGas: transactionToSend.gas } }))

				// Store fake transaction
				this.submittedTxs.set(resp.safeTxHash, {
					from: this.safe.data.safeAddress,
					hash: resp.safeTxHash,
					gas: 0,
					gasPrice: '0x00',
					nonce: 0,
					input: transactionToSend.data,
					value: transactionToSend.value,
					to: transactionToSend.to,
					blockHash: null,
					blockNumber: null,
					transactionIndex: null,
				})
				return resp.safeTxHash
			}
			case 'eth_blockNumber': return SafeGetBlockNumber.parse((await safeRequest('eth_getBlockByNumber', ['latest']))).number
			case 'eth_getBalance': return await safeRequest('eth_getBalance', params)
			case 'eth_getCode': return await safeRequest('eth_getCode', params)
			case 'eth_getTransactionCount': return await safeRequest('eth_getTransactionCount', params)
			case 'eth_getStorageAt': return await safeRequest('eth_getStorageAt', params)
			case 'eth_getBlockByNumber': return await safeRequest('eth_getBlockByNumber', params)
			case 'eth_getBlockByHash': return await safeRequest('eth_getBlockByHash', params)
			case 'eth_getTransactionByHash': {
				let txHash = bytes32String(HashParams.parse(params)[0])
				try {
					const resptxHash = bytes32String(TxHashReply.parse(await safeRequest('eth_getTransactionByHash', [txHash])).txHash)
					txHash = resptxHash || txHash
				} catch (e) {}
				// Use fake transaction if we don't have a real tx hash
				if (this.submittedTxs.has(txHash)) return this.submittedTxs.get(txHash)
				return await safeRequest('eth_getTransactionByHash', [txHash]).then((tx: unknown) => {
					// We set the tx hash to the one requested, as some provider assert this
					if (tx) {
						if (typeof tx !== 'object' || Array.isArray(tx)) throw new Error('Transaction is not a valid object')
						if (!('hash' in tx)) throw new Error('Transaction object cannot accept a hash property')
						tx['hash'] = txHash
					}
					return tx
				})
			}
			case 'eth_getTransactionReceipt': {
				let txHash = bytes32String(HashParams.parse(params)[0])
				try {
					const resptxHash = bytes32String(TxHashReply.parse(await safeRequest('eth_getTransactionByHash', [txHash])).txHash)
					txHash = resptxHash || txHash
				} catch (e) {}
				return safeRequest('eth_getTransactionReceipt', [txHash]).then((tx: unknown) => {
					// We set the tx hash to the one requested, as some provider assert this
					if (tx) {
						if (typeof tx !== 'object' || Array.isArray(tx)) throw new Error('Transaction is not a valid object')
						if (!('transactionHash' in tx)) throw new Error('Transaction object cannot accept a hash property')
						tx['transactionHash'] = txHash
					}
					return tx
				})
			}

			case 'eth_estimateGas': return await safeRequest('eth_getEstimateGas', params)
			case 'eth_call': return await safeRequest('eth_call', params)
			case 'eth_getLogs': return await safeRequest('eth_getPastLogs', params)
			case 'eth_gasPrice': return await safeRequest('eth_getGasPrice', [])
			case 'wallet_getPermissions': return await safeRequest('eth_getPermissions', [])
			case 'wallet_requestPermissions': return await safeRequest('eth_requestPermissions', params)
			default: throw Error(`"${ request.method }" not implemented`)
		}
	}

	// this method is needed for ethers v4
	// https://github.com/ethers-io/ethers.js/blob/427e16826eb15d52d25c4f01027f8db22b74b76c/src.ts/providers/web3-provider.ts#L41-L55
	send(request: { method: string, params?: unknown, id: number}, callback: (error: unknown, response?: unknown) => void): void {
		if (!request) callback('Undefined request')
		this.request(request).then((result) => callback(null, { jsonrpc: '2.0', id: request.id, result })).catch((error) => callback(error, null))
	}
}
