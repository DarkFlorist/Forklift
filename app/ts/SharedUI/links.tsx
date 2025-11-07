import { Signal, useComputed } from '@preact/signals'
import { AccountAddress } from '../types/types.js'
import { getMarketUrl, getUniverseName, getUniverseUrl } from '../utils/augurUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { Hex } from 'viem'

interface OptionalLinkProps {
	address: OptionalSignal<AccountAddress>
	pathSignal: Signal<string>
}

export const OptionalUniverseLink = ( { address, pathSignal }: OptionalLinkProps) => {
	if (address.deepValue === undefined) return <p>loading...</p>
	return <a href = { getUniverseUrl(address.deepValue) } onClick = { (event) => {
		event.preventDefault()
		if (address.deepValue === undefined) return
		pathSignal.value = getUniverseUrl(address.deepValue)
	} }> { getUniverseName(address.deepValue) }</a>
}

export const OptionalMarketLink = ( { address, pathSignal }: OptionalLinkProps) => {
	if (address.deepValue === undefined) return <p>loading...</p>
	return <a href = { getMarketUrl(address.deepValue) } onClick = { (event) => {
		event.preventDefault()
		if (address.deepValue === undefined) return
		pathSignal.value = getMarketUrl(address.deepValue)
	} }> { address.deepValue }</a>
}

interface LinkProps {
	address: Signal<AccountAddress | undefined>
	pathSignal: Signal<string>
}

export const UniverseLink = ( { address, pathSignal }: LinkProps) => {
	if (address.value === undefined) return <p></p>
	return <a href = { getUniverseUrl(address.value) } onClick = { (event) => {
		event.preventDefault()
		if (address.value === undefined) return
		pathSignal.value = getUniverseUrl(address.value)
	} }> { getUniverseName(address.value) }</a>
}

export const MarketLink = ( { address, pathSignal }: LinkProps) => {
	if (address.value === undefined) return <p>loading...</p>
	return <a href = { getMarketUrl(address.value) } onClick = { (event) => {
		event.preventDefault()
		if (address.value === undefined) return
		pathSignal.value = getMarketUrl(address.value)
	} }> { address.value }</a>
}

interface EtherscanProps {
	address: Signal<AccountAddress | undefined>
}

export const EtherScanAddress = ({ address }: EtherscanProps) => {
	if (address === undefined) return '?'
	const etherScan = useComputed(() => `https://etherscan.io/address/${ address.value }`)
	return <a target = '_blank' rel = 'noopener noreferrer' href = { etherScan }>{ address }
		<svg class = 'external-link' width = '24px' height = '24px' viewBox = '0 0 24 24'><g stroke-width = '2.1' fill = 'none' stroke-linecap = 'round' stroke-linejoin = 'round'><polyline points = '17 13.5 17 19.5 5 19.5 5 7.5 11 7.5'></polyline><path d = 'M14,4.5 L20,4.5 L20,10.5 M20,4.5 L11,13.5'></path></g></svg>
	</a>
}

interface EtherscanHashProps {
	hash: Hex
}

export const EtherScanTransactionHash = ({ hash }: EtherscanHashProps) => {
	const etherScan = useComputed(() => `https://etherscan.io/tx/${ hash }`)
	return <a target = '_blank' rel = 'noopener noreferrer' href = { etherScan }>{ hash }
		<svg class = 'external-link' width = '24px' height = '24px' viewBox = '0 0 24 24'><g stroke-width = '2.1' fill = 'none' stroke-linecap = 'round' stroke-linejoin = 'round'><polyline points = '17 13.5 17 19.5 5 19.5 5 7.5 11 7.5'></polyline><path d = 'M14,4.5 L20,4.5 L20,10.5 M20,4.5 L11,13.5'></path></g></svg>
	</a>
}
