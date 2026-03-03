import { Signal, useComputed } from '@preact/signals'
import { formatUnixTimestampIso } from '../utils/ethereumUtils.js'

type IsoTimestampProps = {
	timestamp: Signal<bigint> | bigint
}

export const IsoTimestamp = ({ timestamp }: IsoTimestampProps) => {
	const iso = useComputed(() => formatUnixTimestampIso(typeof timestamp === 'bigint' ? timestamp : timestamp.value))
	const value = iso.value
	return <time dateTime = { value }><span>{value.slice(0, 10)}</span><span style = { { opacity: 0.25 } }>T</span><span>{value.slice(11, 19)}</span><span style = { { opacity: 0.25 } }>{value.slice(19)}</span></time>
}
