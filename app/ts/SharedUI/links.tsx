import { Signal } from '@preact/signals'
import { AccountAddress } from '../types/types.js'
import { getMarketUrl, getUniverseName, getUniverseUrl } from '../utils/augurUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'

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
