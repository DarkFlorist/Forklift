import { useEffect } from 'preact/hooks'
import { useComputed, useSignal } from '@preact/signals'
import { JSX } from 'preact'

interface SomeTimeAgoProps {
	priorTimestamp: Date,
	countBackwards?: boolean,
	diffToText?: (secondsDiff: number) => JSX.Element
}

export function SomeTimeAgo(props: SomeTimeAgoProps) {
	const getTimeDiff = () => (props.priorTimestamp.getTime() - new Date().getTime()) / 1000
	const timeDiff = useSignal(getTimeDiff())
	const diffTotext = props.diffToText !== undefined ? props.diffToText : humanReadableDateDelta
	const humanReadableTimeDiff = useComputed(() => diffTotext(props.countBackwards ? timeDiff.value : -timeDiff.value))
	useEffect(() => {
		const id = setInterval(() => { timeDiff.value = getTimeDiff() }, 1000)
		return () => clearInterval(id)
	})
	useEffect(() => { timeDiff.value = getTimeDiff() }, [props.priorTimestamp])
	return <>{ humanReadableTimeDiff.value }</>
}

export function humanReadableDateDelta(secondsDiff: number) {
	if (secondsDiff <= 0) return '0 seconds'
	if (secondsDiff > 3600 * 24 * 1.5) return `${ Math.floor((secondsDiff + 1800) / 3600 / 24) } days`
	if (secondsDiff > 3600 * 1.5) return `${ Math.floor((secondsDiff + 1800) / 3600) } hours`
	if (secondsDiff > 60 * 1.5) return `${ Math.floor((secondsDiff + 30) / 60) } minutes`
	return `${ Math.floor(secondsDiff + 0.5) } seconds`
}
