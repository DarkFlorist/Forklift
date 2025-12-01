import { useComputed, useSignal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { isValidUrl } from '../utils/utils.js'

export const Settings = () => {
	const rpcCandidate = useSignal<string | undefined>()
	const refresh = () => {
		rpcCandidate.value = localStorage.getItem('rpc') || undefined
	}

	useEffect(() => { refresh() }, [])

	const handleRpc = (value: string) => {
		rpcCandidate.value = value
	}

	const setRpc = () => {
		if (rpcCandidate.value === undefined) return
		if (!isValidUrl(rpcCandidate.value)) return
		localStorage.setItem('rpc', rpcCandidate.value)
		location.reload()
	}

	const invalidUrl = useComputed(() => !(rpcCandidate.value != undefined && isValidUrl(rpcCandidate.value)))

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<div class = 'form-grid'>
				<div class = 'form-group'>
					<label>Ethereum RPC to use when an Ethereum wallet is not connected</label>
					<div style = { { display: 'grid', gridTemplateColumns: 'auto min-content', gap: '0.5rem' } }>
						<input
							class = 'input'
							type = 'text'
							placeholder = 'https://ethereum...'
							value = { rpcCandidate.value }
							onInput = { e => handleRpc(e.currentTarget.value) }
						/>
						<button class = 'button button-secondary button-small' disabled = { invalidUrl.value } onClick = { setRpc }> Set</button>
					</div>
					{ invalidUrl.value && rpcCandidate.value !== undefined ? <p class = 'error-component'>Invalid RPC URL</p> : <></> }
				</div>
			</div>
		</section>
	</div>
}
