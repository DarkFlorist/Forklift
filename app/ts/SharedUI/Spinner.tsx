export function Spinner(props: { spinnerHeight?: string }) {
	const spinnerHeight = props.spinnerHeight ?? '1em'
	return <svg
		style = { { height: spinnerHeight } }
		class = 'spinner'
		viewBox = "0 0 100 100"
		xmlns = "http://www.w3.org/2000/svg"
	>
		<circle cx = "50" cy = "50" r = "45" />
	</svg>
}

export function BigSpinner() {
	return <Spinner spinnerHeight = '2em' />
}

export function CenteredBigSpinner() {
	return <div style = 'margin-inline: auto; padding: 20px;'>
		<BigSpinner />
	</div>
}

export function PageLoadingSpinner() {
	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<CenteredBigSpinner />
		</section>
	</div>
}
