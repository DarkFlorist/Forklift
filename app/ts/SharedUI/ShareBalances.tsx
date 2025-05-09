import { AUGUR_SHARE_DECIMALS } from '../utils/constants.js'
import { bigintToDecimalStringWithUnknown } from '../utils/ethereumUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'


interface ShareBalancesProps {
	yesBalance: OptionalSignal<bigint>
	noBalance: OptionalSignal<bigint>
	invalidBalance: OptionalSignal<bigint>
}

export const ShareBalances = ({ yesBalance, noBalance, invalidBalance }: ShareBalancesProps ) => {
	return <div>
		<h3>Share Balances</h3>
		<p>Yes: { bigintToDecimalStringWithUnknown(yesBalance.deepValue, AUGUR_SHARE_DECIMALS, 2) } YES</p>
		<p>No: { bigintToDecimalStringWithUnknown(noBalance.deepValue, AUGUR_SHARE_DECIMALS, 2) } NO </p>
		<p>Invalid: { bigintToDecimalStringWithUnknown(invalidBalance.deepValue, AUGUR_SHARE_DECIMALS, 2) } INVALID</p>
	</div>
}
