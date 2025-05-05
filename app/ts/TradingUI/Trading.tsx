import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { fetchMarketData, getDisputeWindow, getDisputeWindowInfo, getForkValues } from '../utils/augurContractUtils.js'
import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress, EthereumAddress, EthereumQuantity, NonHexBigInt } from '../types/types.js'
import { Market, MarketData } from '../SharedUI/Market.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'
import { Input } from '../SharedUI/Input.js'
import { deployAugurConstantProductMarket, deployAugurConstantProductMarketRouter, enterPosition, exitPosition, expectedSharesAfterSwap, expectedSharesNeededForSwap, getAugurConstantProductMarketRouterAddress, getShareBalances, isAugurConstantProductMarketRouterDeployed, isThereAugurConstantProductmarket, mintLiquidity, setERC1155Approval } from '../utils/augurConstantProductMarketUtils.js'
import { bigintToDecimalString, bigintToDecimalStringWithUnknown, decimalStringToBigint, isDecimalString } from '../utils/ethereumUtils.js'
import { approveErc20Token, getAllowanceErc20Token } from '../utils/erc20.js'
import { AUGUR_SHARE_TOKEN, DAI_TOKEN_ADDRESS, UNIV4_MAX_TICK, UNIV4_MIN_TICK } from '../utils/constants.js'

interface DeployProps {
	isRouterDeployed: OptionalSignal<boolean>
	maybeWriteClient: OptionalSignal<WriteClient>
}

const ONE_YEAR_IN_SECONDS = 31536000n
const AUGUR_SHARE_DECIMALS = 15n

const DeployRouter = ({ maybeWriteClient, isRouterDeployed }: DeployProps) => {
	const deploy = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing write client')
		await deployAugurConstantProductMarketRouter(writeClient)
		isRouterDeployed.deepValue = true
	}
	if (isRouterDeployed.deepValue === true || isRouterDeployed.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<p class = 'error-component' style = 'width: 100%; margin-left: 10px; text-align: center;'>Augur Constant Product Market Router is not deployed.</p>
		<button class = 'button button-primary' onClick = { deploy }>Deploy Router</button>
	</div>
}

interface DeployAugurConstantProductMarketProps {
	isConstantProductMarketDeployed: OptionalSignal<boolean>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketAddress: OptionalSignal<AccountAddress>
}

const DeployAugurConstantProductMarket = ({ maybeWriteClient, isConstantProductMarketDeployed, marketAddress }: DeployAugurConstantProductMarketProps) => {
	const deploy = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing write client')
		if (marketAddress.deepValue === undefined) throw new Error('missing market address')
		await deployAugurConstantProductMarket(writeClient, marketAddress.deepValue)
		isConstantProductMarketDeployed.deepValue = true
	}
	if (isConstantProductMarketDeployed.deepValue === true || isConstantProductMarketDeployed.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<p class = 'error-component' style = 'width: 100%; margin-left: 10px; text-align: center;'>Constant Product Market missing for the pool</p>
		<button class = 'button button-primary' onClick = { deploy }>Deploy Augur Constant Product Market</button>
	</div>
}

interface AllowancesProps {
	maybeWriteClient: OptionalSignal<WriteClient>
	requiredDaiApproval: OptionalSignal<bigint>
	allowedDai: OptionalSignal<bigint>
}

const Allowances = ( { maybeWriteClient, requiredDaiApproval, allowedDai }: AllowancesProps) => {
	const daiAllowanceToBeSet = useOptionalSignal<bigint>(undefined)
	const cannotSetDaiAllowance = useComputed(() => {
		if (maybeWriteClient.deepValue === undefined) return true
		if (daiAllowanceToBeSet.deepValue === undefined || daiAllowanceToBeSet.deepValue <= 0n) return true
		return false
	})
	const approveDai = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (daiAllowanceToBeSet.deepValue === undefined || daiAllowanceToBeSet.deepValue <= 0n) throw new Error('not valid allowance')
		await approveErc20Token(writeClient, DAI_TOKEN_ADDRESS, getAugurConstantProductMarketRouterAddress(), daiAllowanceToBeSet.deepValue)
		allowedDai.deepValue = await getAllowanceErc20Token(writeClient, DAI_TOKEN_ADDRESS, writeClient.account.address, getAugurConstantProductMarketRouterAddress())
	}

	function setMaxDaiAllowance() {
		daiAllowanceToBeSet.deepValue = 2n ** 256n - 1n
	}

	return <div class = 'form-grid'>
		<h3>Allowances</h3>
		<div style = { { display: 'grid', gap: '0.5em', gridTemplateColumns: 'auto auto auto' } }>
			<div style = { { alignContent: 'center' } }>
				Allowed DAI: { bigintToDecimalStringWithUnknown(allowedDai.deepValue, 18n, 2) } DAI (required: { bigintToDecimalStringWithUnknown(requiredDaiApproval.deepValue, 18n, 2) } DAI)
			</div>
			<div style = { { display: 'flex', alignItems: 'baseline', gap: '0.5em' } }>
				<Input
					class = 'input reporting-panel-input'
					type = 'text'
					placeholder = 'REP to allow'
					style = { { maxWidth: '300px' } }
					value = { daiAllowanceToBeSet }
					sanitize = { (amount: string) => amount.trim() }
					tryParse = { (amount: string | undefined) => {
						if (amount === undefined) return { ok: false } as const
						if (!isDecimalString(amount.trim())) return { ok: false } as const
						const parsed = decimalStringToBigint(amount.trim(), 18n)
						return { ok: true, value: parsed } as const
					}}
					serialize = { (amount: EthereumQuantity | undefined) => {
						if (amount === undefined) return ''
						return bigintToDecimalString(amount, 18n, 18)
					}}
				/>
				<span class = 'unit'>DAI</span>
				<button class = 'button button-secondary button-small ' style = { { whiteSpace: 'nowrap' } } onClick = { setMaxDaiAllowance }>Max</button>
			</div>
			<button class = 'button button-secondary button-small' style = { { width: '100%', whiteSpace: 'nowrap' } } disabled = { cannotSetDaiAllowance } onClick = { approveDai }>
				Set DAI allowance
			</button>
		</div>
	</div>
}

interface LiquidityProvidingProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketData: OptionalSignal<MarketData>
	currentTimeInBigIntSeconds: Signal<bigint>
}
const LiquidityProviding = ({ maybeReadClient, maybeWriteClient, marketData, currentTimeInBigIntSeconds }: LiquidityProvidingProps) => {
	const tokenInputAmount = useOptionalSignal<bigint>(undefined)
	//const expectedLiquidity = useOptionalSignal<bigint>(undefined)
	const mintLiquidityButton = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		if (tokenInputAmount.deepValue === undefined) return
		const aLotTimeInFuture = currentTimeInBigIntSeconds.value + ONE_YEAR_IN_SECONDS
		const setsToBuy = tokenInputAmount.deepValue
		const amountYesMax = setsToBuy
		const amountNoMax = setsToBuy
		await mintLiquidity(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, setsToBuy, UNIV4_MIN_TICK, UNIV4_MAX_TICK, amountNoMax, amountYesMax, aLotTimeInFuture)
	}
	const refresh = async () => {
		if (maybeReadClient.deepValue === undefined) return
		if (tokenInputAmount.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		//const amountYes = tokenInputAmount.deepValue
		//const amountNo = tokenInputAmount.deepValue
		//expectedLiquidity.deepValue = await getExpectedLiquidity(maybeReadClient.deepValue, marketData.deepValue.marketAddress, UNIV4_MIN_TICK, UNIV4_MAX_TICK, amountNo, amountYes)
		//expectedCost.deepValue = tokenInputAmount.deepValue * 10n ** 18n / marketData.deepValue.numTicks
	}
	const setApproval = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		const router = getAugurConstantProductMarketRouterAddress()
		await setERC1155Approval(maybeWriteClient.deepValue, AUGUR_SHARE_TOKEN, router, true)
	}
	const burnLiquidityButton = async() => {
		if (maybeWriteClient.deepValue === undefined) return
		if (maybeReadClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		/*const marketSharesBalances2 = await getShareBalances(maybeReadClient.deepValue, marketData.deepValue.marketAddress, maybeWriteClient.deepValue.account.address)
		const noShare2 = marketSharesBalances2[1] - 10n // min out does not account for fees
 		const yesShare2 = marketSharesBalances2[2] - 10n
		const expectedSetsSold2 = yesShare2 + 2n */
		//await burnLiquidity(maybeReadClient.deepValue, positionTokenId2, noShare2, yesShare2, YEAR_2030)
	}
	return <>
		<p> Liquidity providing</p>
		<p> Amount to invest</p>
		<Input
			class = 'input scalar-input'
			type = 'text'
			placeholder = 'Allocation'
			key = 'scalar-input'
			value = { tokenInputAmount }
			sanitize = { (amount: string) => amount.trim() }
			tryParse = { (amount: string | undefined) => {
				if (amount === undefined) return { ok: false } as const
				if (!isDecimalString(amount.trim())) return { ok: false } as const
				const parsed = decimalStringToBigint(amount.trim(), AUGUR_SHARE_DECIMALS)
				return { ok: true, value: parsed } as const
			} }
			serialize = { (amount: NonHexBigInt | undefined) => {
				if (amount === undefined) return ''
				return bigintToDecimalString(amount, AUGUR_SHARE_DECIMALS, 3)
			} }
			invalidSignal = { useSignal(false) }
		/> DAI
		<button class = 'button button-primary' onClick = { refresh }>refresh</button>
		<button class = 'button button-primary' onClick = { setApproval }>setApproval</button>
		<button class = 'button button-primary' onClick = { mintLiquidityButton }>Mint Liquidity</button>
		<button class = 'button button-primary' onClick = { burnLiquidityButton }>Burn Liquidity</button>
	</>
}

interface TradingViewProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketData: OptionalSignal<MarketData>
	currentTimeInBigIntSeconds: Signal<bigint>
}

const TradingView = ({ maybeReadClient, maybeWriteClient, marketData, currentTimeInBigIntSeconds }: TradingViewProps) => {
	const daiInputAmount = useOptionalSignal<bigint>(undefined)
	const yesBalance = useOptionalSignal<bigint>(undefined)
	const noBalance = useOptionalSignal<bigint>(undefined)
	const invalidBalance = useOptionalSignal<bigint>(undefined)
	const buySelected = useSignal<boolean>(true)
	const yesSelected = useSignal<boolean>(true)
	const expectedSharesOut = useOptionalSignal<bigint>(undefined)

	const canExitNoShareAmount = useOptionalSignal<bigint>(undefined)
	const canExitNoExpectedDai = useOptionalSignal<bigint>(undefined)

	const canExitYesShareAmount = useOptionalSignal<bigint>(undefined)
	const canExitYesExpectedDai = useOptionalSignal<bigint>(undefined)

	const refresh = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (maybeReadClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		const shareBalances = await getShareBalances(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, maybeWriteClient.deepValue.account.address)
		invalidBalance.deepValue = shareBalances[0]
		yesBalance.deepValue = shareBalances[1]
		noBalance.deepValue = shareBalances[2]

		if (invalidBalance.deepValue === undefined) throw new Error('invalid balance was undefined')
		if (invalidBalance.deepValue > 4n) {
			// can exit not:
			const setsToSell = 10000n // invalidBalance.deepValue - 4n
			const noNeededForSwap = await expectedSharesNeededForSwap(maybeReadClient.deepValue, marketData.deepValue.marketAddress, false, setsToSell)
			if (noNeededForSwap.success) {
				canExitNoShareAmount.deepValue = setsToSell + noNeededForSwap.result
				canExitNoExpectedDai.deepValue = setsToSell * marketData.deepValue.numTicks
			} else {
				canExitNoShareAmount.deepValue = undefined
				canExitNoExpectedDai.deepValue = undefined
			}

			// can exit yes
			const yesNeededForSwap = await expectedSharesNeededForSwap(maybeReadClient.deepValue, marketData.deepValue.marketAddress, true, setsToSell)
			if (yesNeededForSwap.success) {
				canExitYesShareAmount.deepValue = setsToSell + yesNeededForSwap.result
				canExitYesExpectedDai.deepValue = setsToSell * marketData.deepValue.numTicks
			} else {
				canExitNoShareAmount.deepValue = undefined
				canExitNoExpectedDai.deepValue = undefined
			}
		} else {
			canExitNoShareAmount.deepValue = 0n
			canExitNoExpectedDai.deepValue = 0n
			canExitYesShareAmount.deepValue = 0n
			canExitYesExpectedDai.deepValue = 0n
		}

		if (daiInputAmount.deepValue === undefined) return
		if (buySelected) {
			const baseSharesExpected = daiInputAmount.deepValue / marketData.deepValue.numTicks
			if (yesSelected) {
				const expectedSwapShares = await expectedSharesAfterSwap(maybeReadClient.deepValue, marketData.deepValue.marketAddress, true, baseSharesExpected)
				expectedSharesOut.deepValue = baseSharesExpected + expectedSwapShares
			} else {
				const expectedSwapShares = await expectedSharesAfterSwap(maybeReadClient.deepValue, marketData.deepValue.marketAddress, false, baseSharesExpected)
				expectedSharesOut.deepValue = baseSharesExpected + expectedSwapShares
			}
		} else {
			if (yesSelected) {

			}
			else {
			}
		}

		/*
const setsToSell = shareBalances[0] - 4n
		const noNeededForSwap = await expectedSharesNeededForSwap(participantClient1, false, setsToSell)
		const noSharesNeeded = setsToSell + noNeededForSwap
		const expectedDaiFromShares = setsToSell * numTicks
		*/
	}

	const buyYes = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		if (daiInputAmount.deepValue === undefined) return
		const aLotTimeInFuture = currentTimeInBigIntSeconds.value + ONE_YEAR_IN_SECONDS
		const minSharesOut = 0n // TODO FIX
		await enterPosition(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, daiInputAmount.deepValue, true, minSharesOut, aLotTimeInFuture)
	}
	const buyNo = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		if (daiInputAmount.deepValue === undefined) return
		const aLotTimeInFuture = currentTimeInBigIntSeconds.value + ONE_YEAR_IN_SECONDS
		const minSharesOut = 0n // TODO FIX
		await enterPosition(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, daiInputAmount.deepValue, false, minSharesOut, aLotTimeInFuture)
	}
	const sellYes = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		if (daiInputAmount.deepValue === undefined) return
		const aLotTimeInFuture = currentTimeInBigIntSeconds.value + ONE_YEAR_IN_SECONDS
		const shareBalances = await getShareBalances(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, maybeWriteClient.deepValue.account.address)
		const setsToSell = shareBalances[0] - 4n
		const yesNeededForSwap = await expectedSharesNeededForSwap(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, true, setsToSell)
		if (!yesNeededForSwap.success) throw new Error('failed to exit')
		const yesSharesNeeded = setsToSell + yesNeededForSwap.result
		await exitPosition(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, daiInputAmount.deepValue, yesSharesNeeded, aLotTimeInFuture)
	}
	const sellNo = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		if (daiInputAmount.deepValue === undefined) return
		const aLotTimeInFuture = currentTimeInBigIntSeconds.value + ONE_YEAR_IN_SECONDS
		const shareBalances = await getShareBalances(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, maybeWriteClient.deepValue.account.address)
		const setsToSell = shareBalances[0] - 4n
		const noNeededForSwap = await expectedSharesNeededForSwap(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, false, setsToSell)
		if (!noNeededForSwap.success) throw new Error('failed to exit')
		const noSharesNeeded = setsToSell + noNeededForSwap.result
		await exitPosition(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, daiInputAmount.deepValue, noSharesNeeded, aLotTimeInFuture)
	}
	const execute = async () => {
		if (buySelected) {
			if (yesSelected) return await buyYes()
			return await buyNo()
		}
		if (yesSelected) return await sellYes()
		return await sellNo()
	}
	return <>
		<p> Trading </p>
		<div>
			user balances
			<div> yes: { bigintToDecimalStringWithUnknown(yesBalance.deepValue, AUGUR_SHARE_DECIMALS, 2) } </div>
			<div> no: { bigintToDecimalStringWithUnknown(noBalance.deepValue, AUGUR_SHARE_DECIMALS, 2) } </div>
			<div> invalid: { bigintToDecimalStringWithUnknown(invalidBalance.deepValue, AUGUR_SHARE_DECIMALS, 2) } </div>

			<div> canExitYes: { bigintToDecimalStringWithUnknown(canExitYesShareAmount.deepValue, AUGUR_SHARE_DECIMALS, 15) } for { bigintToDecimalStringWithUnknown(canExitYesExpectedDai.deepValue, 18n, 2) } </div>
			<div> canExitNo: { bigintToDecimalStringWithUnknown(canExitNoShareAmount.deepValue, AUGUR_SHARE_DECIMALS, 15) } for { bigintToDecimalStringWithUnknown(canExitNoExpectedDai.deepValue, 18n, 2) } </div>
		</div>
		<div class = 'invalid-check-box-container'>
			<label class = 'custom-input-label invalid-check-box-container-inner'>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'Buy'
					checked = { buySelected.value }
					onChange = { (event ) => {
						const target = event.target as HTMLInputElement
						buySelected.value = target.checked
					} }
				/>
				<span class = 'invalid-tag'>Buy</span>
			</label>
		</div>
		<div class = 'invalid-check-box-container'>
			<label class = 'custom-input-label invalid-check-box-container-inner'>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'Yes'
					checked = { yesSelected.value }
					onChange = { (event ) => {
						const target = event.target as HTMLInputElement
						yesSelected.value = target.checked
					} }
				/>
				<span class = 'invalid-tag'>Yes</span>
			</label>
		</div>
		Amount to invest
		<Input
			class = 'input scalar-input'
			type = 'text'
			placeholder = 'Allocation'
			key = 'scalar-input'
			value = { daiInputAmount }
			sanitize = { (amount: string) => amount.trim() }
			tryParse = { (amount: string | undefined) => {
				if (amount === undefined) return { ok: false } as const
				if (!isDecimalString(amount.trim())) return { ok: false } as const
				const parsed = decimalStringToBigint(amount.trim(), 18n)
				return { ok: true, value: parsed } as const
			} }
			serialize = { (amount: NonHexBigInt | undefined) => {
				if (amount === undefined) return ''
				return bigintToDecimalString(amount, 18n, 18)
			} }
		/>
		DAI
		<p>Expected shares out: { bigintToDecimalStringWithUnknown(expectedSharesOut.deepValue, AUGUR_SHARE_DECIMALS, 2) }</p>
		<button class = 'button button-primary' onClick = { refresh }>refresh</button>
		<button class = 'button button-primary' onClick = { execute }>Execute</button>
	</>
}

interface TradingProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
	currentTimeInBigIntSeconds: Signal<bigint>
}

export const Trading = ({ maybeReadClient, maybeWriteClient, universe, reputationTokenAddress, currentTimeInBigIntSeconds }: TradingProps) => {
	const marketAddress = useOptionalSignal<AccountAddress>(undefined)
	const marketData = useOptionalSignal<MarketData>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)

	const isInvalidMarketAddress = useSignal<boolean>(false)
	const isRouterDeployed = useOptionalSignal<boolean>(undefined)
	const requiredDaiApproval = useOptionalSignal<bigint>(undefined)
	const daiApprovedForRouter = useOptionalSignal<bigint>(undefined)

	const isConstantProductMarketDeployed = useOptionalSignal<boolean>(undefined)

	const clear = () => {
		marketData.deepValue = undefined
	}

	useSignalEffect(() => {
		if (marketAddress.deepValue === undefined) {
			clear()
		} else {
			refreshData()
		}
	})

	const refreshData = async () => {
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) throw new Error('missing readClient')
		isRouterDeployed.deepValue = await isAugurConstantProductMarketRouterDeployed(readClient)
		console.log(`router deployed: ${isRouterDeployed.deepValue}`)
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		if (isRouterDeployed.deepValue === false) return
		clear()
		if (marketAddress.deepValue === undefined) throw new Error('market not defined')
		marketData.deepValue = await fetchMarketData(readClient, marketAddress.deepValue)
		const disputeWindowAddress = await getDisputeWindow(readClient, marketAddress.deepValue)
		if (EthereumAddress.parse(disputeWindowAddress) !== 0n) {
			disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress)
		}
		forkValues.deepValue = await getForkValues(readClient, reputationTokenAddress.deepValue)

		isConstantProductMarketDeployed.deepValue = await isThereAugurConstantProductmarket(readClient, marketAddress.deepValue)

		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		daiApprovedForRouter.deepValue = await getAllowanceErc20Token(writeClient, DAI_TOKEN_ADDRESS, writeClient.account.address, getAugurConstantProductMarketRouterAddress())
	}

	return <div class = 'subApplication'>
		<DeployRouter isRouterDeployed = { isRouterDeployed } maybeWriteClient = { maybeWriteClient }/>
		<div style = 'display: grid; width: 100%; gap: 10px;'>
			<Market marketData = { marketData } universe = { universe } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds } addressComponent = { <>
				<div style = { { display: 'grid', gridTemplateColumns: 'auto min-content', gap: '0.5rem' } }>
					<Input
						style = 'height: fit-content;'
						key = 'market-reporting-input'
						class = 'input'
						type = 'text'
						width = '100%'
						placeholder = 'Market address'
						value = { marketAddress }
						sanitize = { (addressString: string) => addressString }
						tryParse = { (marketAddressString: string | undefined) => {
							if (marketAddressString === undefined) return { ok: false } as const
							const parsed = EthereumAddress.safeParse(marketAddressString.trim())
							if (parsed.success) return { ok: true, value: marketAddressString.trim() } as const
							return { ok: false } as const
						}}
						serialize = { (marketAddressString: string | undefined) => {
							if (marketAddressString === undefined) return ''
							return marketAddressString.trim()
						} }
						invalidSignal = { isInvalidMarketAddress }
					/>
					<button class = 'button button-primary' onClick = { refreshData }>Refresh</button>
				</div>
			</> }>
				<p>
					<DeployAugurConstantProductMarket maybeWriteClient = { maybeWriteClient } isConstantProductMarketDeployed = { isConstantProductMarketDeployed } marketAddress = { marketAddress }/>
					<Allowances maybeWriteClient = { maybeWriteClient } requiredDaiApproval = { requiredDaiApproval } allowedDai = { daiApprovedForRouter }/>
					<LiquidityProviding maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient } marketData = { marketData } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>
					<TradingView maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient } marketData = { marketData } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>
				</p>
			</Market>
		</div>
	</div>
}
