import { Signal } from '@preact/signals'

type UnexpectedErrorParams = {
	unexpectedError: Signal<string | undefined>
}

export const UnexpectedError = ({ unexpectedError }: UnexpectedErrorParams) => {
	if (unexpectedError.value === undefined) return <></>
	return (
		<div class = 'unexpected-error-component'>
			<div class = 'error-message-container'>
				<p class = 'error-text'> { unexpectedError.value } </p>
			</div>
			<button
				class = 'error-close-button'
				onClick = { () => { unexpectedError.value = undefined } }
			>
				close
			</button>
		</div>
	)
}
