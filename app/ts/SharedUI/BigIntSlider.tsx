import { useRef, useEffect } from 'preact/hooks'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { Signal, useComputed } from '@preact/signals'
import { clamp } from '../utils/utils.js'

type BigIntSliderProps = {
	min: Signal<bigint>
	max: Signal<bigint>
	value: OptionalSignal<bigint>
	step: Signal<bigint>
	disabled: Signal<boolean>
}

export function BigIntSlider({ min, max, value, step, disabled }: BigIntSliderProps) {
	const trackRef = useRef<HTMLDivElement>(null)
	const isDragging = useRef(false)
	const totalRange = useComputed(() => max.value - min.value)

	const valueToPercent = (v: bigint) => {
		if (totalRange.value === 0n) return 0
		const relative = v - min.value
		return clamp(Number(relative * 10000n / totalRange.value) / 100, 0, 100)
	}

	const percentToValue = (percent: number) => {
		const clamped = Math.max(0, Math.min(100, percent))
		const raw = min.value + (totalRange.value * BigInt(Math.round(clamped * 100))) / 10000n
		const steps = (raw - min.value) / step.value
		const snapped = min.value + steps * step.value
		return clamp(snapped, min.value, max.value)
	}

	const handleMove = (clientX: number) => {
		if (disabled.value || !trackRef.current) return
		const rect = trackRef.current.getBoundingClientRect()
		const offsetX = clientX - rect.left
		const pct = (offsetX / rect.width) * 100
		value.deepValue = percentToValue(pct)
	}

	const onPointerDown = (e: PointerEvent) => {
		if (disabled.value) return
		isDragging.current = true
		trackRef.current?.setPointerCapture(e.pointerId)
		handleMove(e.clientX)
	}

	useEffect(() => {
		const move = (e: PointerEvent) => {
			if (!isDragging.current || disabled.value) return
			handleMove(e.clientX)
		}
		const up = (e: PointerEvent) => {
			isDragging.current = false
			trackRef.current?.releasePointerCapture(e.pointerId)
		}
		document.addEventListener('pointermove', move)
		document.addEventListener('pointerup', up)
		return () => {
			document.removeEventListener('pointermove', move)
			document.removeEventListener('pointerup', up)
		}
	}, [disabled])

	const percent = useComputed(() => value.deepValue === undefined ? undefined : valueToPercent(value.deepValue))

	return <div
		ref = { trackRef }
		class = { `bigint-slider ${ disabled.value ? 'disabled' : '' }` }
		style = { { touchAction: 'none', pointerEvents: disabled.value ? 'none' : 'auto', opacity: disabled.value ? 0.5 : 1 } }
		onPointerDown = { onPointerDown }>
		{ percent === undefined ? <></> : <>
			<div class = 'bigint-slider-track' style = { { width: `${ percent }%` } } />
			<div class = 'bigint-slider-thumb' style = { { left: `calc(${ percent }% - 8px)` } } />
		</> }
	</div>
}
