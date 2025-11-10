import { Signal, useComputed } from '@preact/signals'
import { Spinner } from './Spinner.js'


type SendTransactionButtonProps = {
	isLoading: Signal<boolean>
	startLoading: () => Promise<void>
	disabled: Signal<boolean>
	text: Signal<string>
	className?: string
	style?: Record<string, string | number>
}

export const LoadingButton = ({ style, className, isLoading, startLoading, disabled, text }: SendTransactionButtonProps) => {
	const onClick = async () => {
		try {
			isLoading.value = true
			await startLoading()
		} finally {
			isLoading.value = false
		}
	}

	const disableButton = useComputed(() => isLoading.value || disabled.value)
	const spinner = useComputed(() => isLoading.value ? <Spinner/> : <></>)
	return <div class = { 'loading-button' }>
		<button
			style = { style ?? { width: '100%' } }
			class = { className ?? 'button button-primary loading-button' }
			disabled = { disableButton }
			onClick = { onClick }>
				{ text.value } { spinner.value }
		</button>
	</div>
}
