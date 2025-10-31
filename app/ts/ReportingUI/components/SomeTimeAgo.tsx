import { Signal, useComputed } from '@preact/signals'
import { JSX } from 'preact'
import { humanReadableDateDelta } from '../../utils/utils.js'

interface SomeTimeAgoProps {
	priorTimestamp: Date,
	countBackwards?: boolean,
	diffToText?: (secondsDiff: number) => JSX.Element
	currentTimeInBigIntSeconds: Signal<bigint>
}

export function SomeTimeAgo(props: SomeTimeAgoProps) {
	const diffTotext = props.diffToText !== undefined ? props.diffToText : humanReadableDateDelta
	const humanReadableTimeDiff = useComputed(() => {
		const timeDiff = props.priorTimestamp.getTime()/ 1000 - Number(props.currentTimeInBigIntSeconds.value)
		return diffTotext(props.countBackwards ? timeDiff : -timeDiff)
	})
	return <>{ humanReadableTimeDiff.value }</>
}
