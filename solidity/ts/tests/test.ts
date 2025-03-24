import { test } from 'node:test'
import { getMockedEthSimulateWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient } from '../testsuite/simulator/utils/viem.js'
import { RICH_ADDRESS } from '../testsuite/simulator/utils/constants.js'
import { deployAugurConstantProductMarketContract, isAugurConstantProductMarketDeployed, approveDai, getDaiAllowance, addLiquidity, getPoolLiquidityBalance, removeLiquidity, getDaiBalance, getReportingFee, getShareBalances, enterPosition, getAugurConstantProductMarketAddress, expectedSharesAfterSwap, exitPosition, getShareToken, setERC1155Approval } from '../testsuite/simulator/utils/utilities.js'
import assert from 'node:assert'

const numTicks = 1000n;

test('canDeployContract', async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), RICH_ADDRESS, 0)
	await deployAugurConstantProductMarketContract(client)
	const isDeployed = await isAugurConstantProductMarketDeployed(client)
	assert.ok(isDeployed, `Not Deployed!`)
})

test('canAddAndRemoveLiquidity', async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), RICH_ADDRESS, 0)
	await deployAugurConstantProductMarketContract(client)

	// Approve Dai for ACPM
	await approveDai(client)
	const allowance = await getDaiAllowance(client)
	assert.notEqual(allowance, 0n, `Approve failed`)

	const originalDaiBalance = await getDaiBalance(client)

	const lpToBuy = 10000000n
	const expectedCost = lpToBuy * numTicks

	// Provide Liquidity
	await addLiquidity(client, lpToBuy)
	const lpBalance = await getPoolLiquidityBalance(client)
	assert.strictEqual(lpBalance, lpToBuy, `Liquidity not bought correctly`)
	const afterBuyDaiBalance = await getDaiBalance(client)
	assert.strictEqual(originalDaiBalance - afterBuyDaiBalance, expectedCost, `Dai not removed as expected. Costed ${originalDaiBalance - afterBuyDaiBalance}. Expected: ${expectedCost}`)

	const acpmAddress = getAugurConstantProductMarketAddress()
	const acpmShareBalances = await getShareBalances(client, acpmAddress)
	assert.strictEqual(acpmShareBalances[0], lpToBuy, `ACPM did not get expected Invalid shares. Got: ${acpmShareBalances[0]}. Expected: ${lpToBuy}`)
	assert.strictEqual(acpmShareBalances[1], lpToBuy, `ACPM did not get expected No shares. Got: ${acpmShareBalances[1]}. Expected: ${lpToBuy}`)
	assert.strictEqual(acpmShareBalances[2], lpToBuy, `ACPM did not get expected Yes shares. Got: ${acpmShareBalances[2]}. Expected: ${lpToBuy}`)

	// Remove Liquidity
	await removeLiquidity(client, lpToBuy)
	const newLPBalance = await getPoolLiquidityBalance(client)
	assert.strictEqual(newLPBalance, 0n, `Liquidity not removed correctly`)

	const daiBalance = await getDaiBalance(client)
	const reportingFee = await getReportingFee(client)
	const expectedDaiBalance = originalDaiBalance - (expectedCost / reportingFee)
	assert.strictEqual(daiBalance, expectedDaiBalance, `Dai not returned as expected. Got ${daiBalance}. Expected: ${expectedDaiBalance}`)

	const shareBalances = await getShareBalances(client, client.account.address)
	assert.strictEqual(shareBalances[0], 0n, `User received Invalid shares incorrectly`)
	assert.strictEqual(shareBalances[1], 0n, `User received No shares incorrectly`)
	assert.strictEqual(shareBalances[2], 0n, `User received Yes shares incorrectly`)
})

test('canEnterAndExitYesPosition', async () => {
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
	assert.strictEqual(shareBalances[0], baseSharesExpected, `Did not receive expected Invalid shares when purchasing Yes: Got ${shareBalances[0]}. Expected: ${baseSharesExpected}`)
	assert.strictEqual(shareBalances[1], 0n, `Recieved No shares when purchasing Yes`)
	assert.strictEqual(shareBalances[2], expectedYesShares, `Did not recieve expected Yes shares when purchasing Yes: Got ${shareBalances[2]}. Expected: ${expectedYesShares}`)

	const daiBalance = await getDaiBalance(client)
	const expectedDaiBalance = originalDaiBalance - amountInDai
	assert.strictEqual(daiBalance, expectedDaiBalance, `Dai not sent as expected. Balance: ${daiBalance}. Expected: ${expectedDaiBalance}`)

	// Exit Position
	const shareTokenAddress = await getShareToken(client)
	const acpmAddress = getAugurConstantProductMarketAddress()
	await setERC1155Approval(client, shareTokenAddress, acpmAddress, true)
	await exitPosition(client, amountInDai)

	const daiBalanceAfterExit = await getDaiBalance(client)
	const expectedDaiBalanceAfterExit = expectedDaiBalance + amountInDai
	assert.strictEqual(daiBalanceAfterExit, expectedDaiBalanceAfterExit, `Dai not recieved as expected. Balance ${daiBalanceAfterExit}. Expected: ${expectedDaiBalanceAfterExit}`)

	const shareBalancesAfterExit = await getShareBalances(client, client.account.address)
	assert.strictEqual(shareBalancesAfterExit[0], 0n, `Did not close out Invalid position when exiting Yes position`)
	assert.strictEqual(shareBalancesAfterExit[1], 0n, `Recieved No shares when exiting a Yes position`)
	assert.strictEqual(shareBalancesAfterExit[2], 0n, `Did not close out Yes position when exiting Yes position`)
})

test('canEnterAndExitNoPosition', async () => {
	const client = createWriteClient(getMockedEthSimulateWindowEthereum(), RICH_ADDRESS, 0)
	await deployAugurConstantProductMarketContract(client)

	const lpToBuy = 10000000n
	await approveDai(client)
	await addLiquidity(client, lpToBuy)

	const originalDaiBalance = await getDaiBalance(client)

	// Enter position
	const amountInDai = 50000n
	const baseSharesExpected = amountInDai / numTicks
	const expectedSwapShares = await expectedSharesAfterSwap(client, baseSharesExpected, false)
	const expectedNoShares = baseSharesExpected + expectedSwapShares
	await enterPosition(client, amountInDai, false)

	const shareBalances = await getShareBalances(client, client.account.address)
	assert.strictEqual(shareBalances[0], baseSharesExpected, `Did not receive expected Invalid shares when purchasing No: Got ${shareBalances[0]}. Expected: ${baseSharesExpected}`)
	assert.strictEqual(shareBalances[1], expectedNoShares, `Did not recieve expected No shares when purchasing No: Got ${shareBalances[1]}. Expected: ${expectedNoShares}`)
	assert.strictEqual(shareBalances[2], 0n, `Recieved Yes shares when purchasing No`)

	const daiBalance = await getDaiBalance(client)
	const expectedDaiBalance = originalDaiBalance - amountInDai
	assert.strictEqual(daiBalance, expectedDaiBalance, `Dai not sent as expected. Balance: ${daiBalance}. Expected: ${expectedDaiBalance}`)

	// Exit Position
	const shareTokenAddress = await getShareToken(client)
	const acpmAddress = getAugurConstantProductMarketAddress()
	await setERC1155Approval(client, shareTokenAddress, acpmAddress, true)
	await exitPosition(client, amountInDai)

	const daiBalanceAfterExit = await getDaiBalance(client)
	const expectedDaiBalanceAfterExit = expectedDaiBalance + amountInDai
	assert.strictEqual(daiBalanceAfterExit, expectedDaiBalanceAfterExit, `Dai not recieved as expected. Balance ${daiBalanceAfterExit}. Expected: ${expectedDaiBalanceAfterExit}`)

	const shareBalancesAfterExit = await getShareBalances(client, client.account.address)
	assert.strictEqual(shareBalancesAfterExit[0], 0n, `Did not close out Invalid position when exiting No position`)
	assert.strictEqual(shareBalancesAfterExit[1], 0n, `Did not close out No position when exiting No position`)
	assert.strictEqual(shareBalancesAfterExit[2], 0n, `Recieved Yes shares when exiting a No position`)
})

// TODO
// remove partial liquidity
// swaps
// distinct lp with multiple market participants
// multiple lps with multiple market participants
// market resolution with above