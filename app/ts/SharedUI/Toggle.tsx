import { type Signal } from '@preact/signals'
import { JSX } from 'preact/jsx-runtime'

type ToggleProps<T extends string> = {
	options: T[]
	selectedSignal: Signal<T>
	style?: JSX.CSSProperties
	buttonStyles?: JSX.CSSProperties[]
}

export const Toggle = <T extends string>({ options, selectedSignal, style, buttonStyles }: ToggleProps<T>) => {
	const handleToggle = (value: T) => {
		selectedSignal.value = value
	}
	return <div class = 'toggle-group' style = { style }>
		{ options.map((option, index) => (
			<button key = { option } class = { `toggle-button ${ selectedSignal.value === option ? 'active' : '' }` } style = { buttonStyles === undefined ? {} : buttonStyles[index] } onClick = { () => handleToggle(option) }>
				{ option }
			</button>
		)) }
	</div>
}

