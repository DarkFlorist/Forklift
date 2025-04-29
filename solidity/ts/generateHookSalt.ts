import { HOOK_IMPLEMENTATION_CODE } from './testsuite/simulator/utils/constants.js';
import { getAugurConstantProductMarketRouterAddress } from './testsuite/simulator/utils/utilities.js'

console.log(`Searching for salt`)

let salt = 0n
while (true) {
	const addressAttempt = getAugurConstantProductMarketRouterAddress(salt)
	if (addressAttempt.endsWith(HOOK_IMPLEMENTATION_CODE)) {
		console.log(`!!! Salt found: ${salt}`)
		process.exit()
	}
	salt++;
}
