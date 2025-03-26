import { AccountAddress } from '../types/types.js'
import { GENESIS_UNIVERSE } from './constants.js'

// TODO, try to come up with nice ways to call universes (based on market information)
export const getUniverseName = (universeAddress: AccountAddress) => {
	if (BigInt(universeAddress) == BigInt(GENESIS_UNIVERSE)) return 'Genesis'
	return universeAddress
}
