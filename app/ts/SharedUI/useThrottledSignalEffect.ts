import { useSignalEffect } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'

export function useThrottledSignalEffect(effect: () => (() => void), delay: number) {
	const timeout = useRef<number | null>(null)
	const lastExecuted = useRef(0)
	const pendingEffect = useRef<(() => void) | null>(null)

	useSignalEffect(() => {
		const sideEffect = effect()
		const now = Date.now()
		const timeSinceLast = now - lastExecuted.current
		if (timeSinceLast >= delay) {
			lastExecuted.current = now
			sideEffect()
		} else {
			pendingEffect.current = sideEffect
			if (!timeout.current) {
				timeout.current = setTimeout(() => {
					lastExecuted.current = Date.now()
					timeout.current = null
					if (pendingEffect.current) {
						pendingEffect.current()
						pendingEffect.current = null
					}
				}, delay - timeSinceLast)
			}
		}
	})
	useEffect(() => {
		return () => {
			if (timeout.current) {
				clearTimeout(timeout.current)
				timeout.current = null
			}
		}
	}, [])
}
