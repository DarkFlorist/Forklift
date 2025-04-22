import type { ComponentChild, JSX } from 'preact'

interface ErrorProps {
	text: ComponentChild
	warning?: boolean,
	containerStyle?: JSX.CSSProperties
}

export function ErrorComponent(props: ErrorProps) {
	const boxColor = props.warning === true ? 'var(--warning-box-color)' : 'var(--error-box-color)'
	const textColor = props.warning === true ? 'var(--warning-box-text)' : 'var(--error-box-text)'
	const containerStyle = { margin: '10px', backgroundColor: 'var(--bg-color)', ...props.containerStyle }
	return (
		<div style = { containerStyle }>
			<div className = 'notification' style = { `background-color: ${ boxColor }; display: flex; align-items: center; padding: 10px`}>
				<span class = 'icon' style = 'margin-left: 0px; margin-right: 5px; width: 2em; height: 2em; min-width: 2em; min-height: 2em;'>
					<img src = '../img/warning-sign-black.svg' style = 'width: 2em; height: 2em;'/>
				</span>
				<p style = { `marging-left: 10px; color: ${ textColor }` }> { props.text } </p>
			</div>
		</div>
	)
}
