import { useComputed, useSignal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { isValidUrl } from '../utils/utils.js'
import { createReadClient } from '../utils/ethereumWallet.js'
import { Input } from '../SharedUI/Input.js'
import { parseAddressForInput, serializeAddressForInput } from '../utils/inputParsing.js'
import { useOptionalSignal } from '../utils/OptionalSignal.js'

export const Settings = () => {
	const rpcCandidate = useSignal<string | undefined>()
	const safeAddress = useOptionalSignal<string>(undefined)
	const rpcFailedTest = useSignal<boolean>(false)
	const invalidSafeAddress = useSignal<boolean>(false)
	const refresh = () => {
		rpcCandidate.value = localStorage.getItem('rpc') || undefined
		safeAddress.deepValue = localStorage.getItem('safeAddress') || undefined
	}

	useEffect(() => { refresh() }, [])

	const handleRpc = (value: string) => {
		rpcCandidate.value = value
		rpcFailedTest.value = false
	}

	const setRpc = async () => {
		if (rpcCandidate.value === undefined) return
		if (!(await testRpc())) {
			rpcFailedTest.value = true
			return
		}
		localStorage.setItem('rpc', rpcCandidate.value)
		location.reload()
	}

	const setSafeAddress = async () => {
		if (safeAddress.deepValue === undefined || safeAddress.deepValue.length === 0) {
			localStorage.removeItem('safeAddress')
		} else {
			localStorage.setItem('safeAddress', safeAddress.deepValue)
		}
		location.reload()
	}

	const testRpc = async () => {
		if (rpcCandidate.value === undefined) return false
		if (!isValidUrl(rpcCandidate.value)) return false
		const readClient = createReadClient(undefined, rpcCandidate.value)
		try {
			const chainId = await readClient.getChainId()
			if (chainId !== 1) return false
		} catch(e) {
			console.error(e)
			return false
		}
		return true
	}

	const invalidUrl = useComputed(() => !(rpcCandidate.value != undefined && isValidUrl(rpcCandidate.value)))

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<div class = 'form-grid'>
				<div class = 'form-group'>
					<label>Ethereum RPC to use when an Ethereum wallet is not connected</label>
					<div style = { { display: 'grid', gridTemplateColumns: 'auto max-content', gap: '0.5rem' } }>
						<input
							class = 'input'
							type = 'text'
							placeholder = 'https://ethereum...'
							value = { rpcCandidate.value }
							onInput = { e => handleRpc(e.currentTarget.value) }
						/>
						<button class = 'button button-secondary' disabled = { invalidUrl.value } onClick = { setRpc }> Set RPC</button>
					</div>
					{ invalidUrl.value && rpcCandidate.value !== undefined ? <p class = 'error-component'>Invalid RPC URL</p> : <></> }
					{ rpcFailedTest.value === true ? <p class = 'error-component'>The given URL is not a valid Mainnet RPC URL</p> : <></> }
				</div>
				<div class = 'form-group'>
					<label>Safe Address to use to execute single signer safe commands (if empty, do not use Safe)</label>
					<div style = { { display: 'grid', gridTemplateColumns: 'auto max-content', gap: '0.5rem' } }>
						<Input
							style = 'height: fit-content;'
							key = 'affiliateValidator-address'
							class = 'input'
							type = 'text'
							width = '100%'
							placeholder = '0x...'
							value = { safeAddress }
							sanitize = { (addressString: string) => addressString }
							tryParse = { parseAddressForInput }
							serialize = { serializeAddressForInput }
							invalidSignal = { invalidSafeAddress }
						/>
						<button class = 'button button-secondary' disabled = { invalidSafeAddress.value } onClick = { setSafeAddress }> Set Safe Address</button>
					</div>
				</div>
			</div>
		</section>
	</div>
}
