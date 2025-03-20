import { runTestsSequentially } from '../testsuite/ethSimulateTestSuite.js'
import { getMockedEthSimulateWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient } from '../testsuite/simulator/utils/viem.js'
import { RICH_ADDRESS } from '../testsuite/simulator/utils/constants.js'
import { deployAugurConstantProductMarketContract, isAugurConstantProductMarketDeployed, approveDai, getDaiAllowance, addLiquidity, getPoolLiquidityBalance, removeLiquidity, getDaiBalance, getReportingFee, getShareBalances, enterPosition, getAugurConstantProductMarketAddress, expectedSharesAfterSwap, exitPosition, getShareToken, setERC1155Approval } from '../testsuite/simulator/utils/utilities.js'

const numTicks = 1000n;

const canDeployContract = async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), RICH_ADDRESS, 0)
	await deployAugurConstantProductMarketContract(client)
	const isDeployed = await isAugurConstantProductMarketDeployed(client)
	if (!isDeployed) throw new Error(`Not deployed!`)
}

const canAddAndRemoveLiquidity = async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), RICH_ADDRESS, 0)
	await deployAugurConstantProductMarketContract(client)

	// Approve Dai for ACPM
	await approveDai(client)
	const allowance = await getDaiAllowance(client)
	if (allowance == 0n) throw new Error(`Approve failed`)

	const originalDaiBalance = await getDaiBalance(client)

	const lpToBuy = 10000000n
	const expectedCost = lpToBuy * numTicks

	// Provide Liquidity
	await addLiquidity(client, lpToBuy)
	const lpBalance = await getPoolLiquidityBalance(client)
	if (lpBalance != lpToBuy) throw new Error(`Liquidity not bought correctly`)
	const afterBuyDaiBalance = await getDaiBalance(client)
	if (originalDaiBalance - afterBuyDaiBalance != expectedCost) throw new Error(`Dai not removed as expected. Costed ${originalDaiBalance - afterBuyDaiBalance}. Expected: ${expectedCost}`)

	const acpmAddress = getAugurConstantProductMarketAddress()
	const acpmShareBalances = await getShareBalances(client, acpmAddress)
	if (acpmShareBalances[0] != acpmShareBalances[1] || acpmShareBalances[1] != acpmShareBalances[2] || acpmShareBalances[0] != lpToBuy) throw new Error(`ACPM did not get expected shares. Got: ${acpmShareBalances[0]}. Expected: ${lpToBuy}`)

	// Remove Liquidity
	await removeLiquidity(client, lpToBuy)
	const newLPBalance = await getPoolLiquidityBalance(client)
	if (newLPBalance != 0n) throw new Error(`Liquidity not removed correctly`)
	const daiBalance = await getDaiBalance(client)

	const reportingFee = await getReportingFee(client)
	const expectedDaiBalance = originalDaiBalance - (expectedCost / reportingFee)
    if (daiBalance != expectedDaiBalance) throw new Error(`Dai not returned as expected. Got ${daiBalance}. Expected: ${expectedDaiBalance}`)

	const shareBalances = await getShareBalances(client, client.account.address)
	if (shareBalances[0] != shareBalances[1] || shareBalances[1] != shareBalances[2] || shareBalances[0] != 0n) throw new Error(`User received shares incorrectly`)
}

const canEnterAndExitPosition = async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), RICH_ADDRESS, 0)
	await deployAugurConstantProductMarketContract(client)

	const lpToBuy = 10000000n
	await approveDai(client)
	await addLiquidity(client, lpToBuy)

	const originalDaiBalance = await getDaiBalance(client)

	// Enter position
	const amountInDai = 50000n
	const baseSharesExpected = amountInDai / numTicks
	const expectedSwapShares = await expectedSharesAfterSwap(client, baseSharesExpected, true)
	const expectedYesShares = baseSharesExpected + expectedSwapShares
	await enterPosition(client, amountInDai, true)

	const shareBalances = await getShareBalances(client, client.account.address)
	if (shareBalances[1] != 0n) throw new Error(`Recieved No shares when purchasing Yes`)
	if (shareBalances[0] != baseSharesExpected) throw new Error(`Did not receive expected Invalid shares when purchasing Yes: Got ${shareBalances[0]}. Expected: ${baseSharesExpected}`)
	if (shareBalances[2] != expectedYesShares) throw new Error(`Did not recieve expected Yes shares when purchasing Yes: Got ${shareBalances[2]}. Expected: ${expectedYesShares}`)

	const daiBalance = await getDaiBalance(client)
	const expectedDaiBalance = originalDaiBalance - amountInDai
    if (daiBalance != expectedDaiBalance) throw new Error(`Dai not sent as expected. Balance: ${daiBalance}. Expected: ${expectedDaiBalance}`)

	// Exit Position
	const shareTokenAddress = await getShareToken(client)
	const acpmAddress = getAugurConstantProductMarketAddress()
	await setERC1155Approval(client, shareTokenAddress, acpmAddress, true)
	await exitPosition(client, amountInDai)

	const daiBalanceAfterExit = await getDaiBalance(client)
	const expectedDaiBalanceAfterExit = expectedDaiBalance + amountInDai
	if (daiBalanceAfterExit != expectedDaiBalanceAfterExit) throw new Error(`Dai not recieved as expected. Balance ${daiBalanceAfterExit}. Expected: ${expectedDaiBalanceAfterExit}`)

	const shareBalancesAfterExit = await getShareBalances(client, client.account.address)
	if (shareBalancesAfterExit[1] != 0n) throw new Error(`Recieved No shares when exiting a Yes position`)
	if (shareBalancesAfterExit[0] != 0n) throw new Error(`Did not close out Invalid position when exiting Yes position`)
	// Minimal dust expected
	if (shareBalancesAfterExit[2] > 1n) throw new Error(`Did not close out Yes position when exiting Yes position`)
}

// TODO
// remove partial liquidity
// swaps
// distinct lp with multiple market participants
// multiple lps with multiple market participants
// market resolution with above

const allTests = async () => {
	await runTestsSequentially([
		['Can deploy contract', canDeployContract, undefined],
		['Can add and remove liquidity', canAddAndRemoveLiquidity, undefined],
		['Can enter and exit position', canEnterAndExitPosition, undefined],
	])
}
allTests()
