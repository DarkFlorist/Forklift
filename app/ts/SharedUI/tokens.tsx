import { DAI_LOGO, NO_LOGO, YES_LOGO } from '../utils/constants.js'

export const DaiNameAndSymbol = () => {
	return <>
		<img class = 'currency-image' src = { DAI_LOGO } />
		<p>DAI</p>
	</>
}

export const YesNameAndSymbol = () => {
	return <>
		<img class = 'currency-image' src = { YES_LOGO } />
		<p>YES</p>
	</>
}

export const NoNameAndSymbol = () => {
	return <>
		<img class = 'currency-image' src = { NO_LOGO } />
		<p>NO</p>
	</>
}
