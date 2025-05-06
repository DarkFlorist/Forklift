import { JSX } from 'preact/jsx-runtime'
import { type Signal } from '@preact/signals'

interface PriceInputParams {
	style?: JSX.CSSProperties
	children?: preact.ComponentChildren
	upperText: string
	bottomElement?: JSX.Element
	currency?: Signal<JSX.Element>
}

export const BigInputBox = ({ upperText, children, currency, style, bottomElement }: PriceInputParams) => {
	return <div class = 'transaction-importance-box' style = { style }>
		<div style = 'display: grid;'>
			<p class = 'gray-text'> { upperText } </p>
			<div class = 'swap-box'>
				<span class = 'grid swap-grid'>
					<div class = 'log-cell' style = 'justify-content: left;'>
						{ children  }
					</div>
					<div class = 'log-cell' style = 'justify-content: right;'>
						{ currency?.value }
					</div>
				</span>
			</div>
			{ bottomElement === undefined ? <p></p> : bottomElement }
		</div>
	</div>
}
