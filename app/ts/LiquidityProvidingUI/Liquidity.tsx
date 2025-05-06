import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { Market, MarketData } from '../SharedUI/Market.js'
import { AUGUR_SHARE_TOKEN, DAI_TOKEN_ADDRESS, ONE_YEAR_IN_SECONDS } from '../utils/constants.js'
import { getAugurConstantProductMarketRouterAddress, isAugurConstantProductMarketRouterDeployed, isErc1155ApprovedForAll, isThereAugurConstantProductmarket, mintLiquidity, priceToTick, roundToClosestPrice } from '../utils/augurConstantProductMarketUtils.js'
import { Input } from '../SharedUI/Input.js'
import { bigintToDecimalString, decimalStringToBigint, isDecimalString } from '../utils/ethereumUtils.js'
import { AccountAddress, EthereumAddress, NonHexBigInt } from '../types/types.js'
import { DeployRouter } from '../SharedUI/deploy.js'
import { getAllowanceErc20Token } from '../utils/erc20.js'
import { fetchMarketData, getDisputeWindow, getDisputeWindowInfo, getForkValues } from '../utils/augurContractUtils.js'
import { TradingAndLiquidityProvidingAllowances } from '../SharedUI/TradingAndLiquidityProvidingAllowances.js'
import { DaiNameAndSymbol } from '../SharedUI/tokens.js'
import { useEffect } from 'preact/hooks'
import { BigInputBox } from '../SharedUI/BigInputBox.js'

interface LiquidityProvidingProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketData: OptionalSignal<MarketData>
	currentTimeInBigIntSeconds: Signal<bigint>
}
export const LiquidityProviding = ({ maybeReadClient, maybeWriteClient, marketData, currentTimeInBigIntSeconds }: LiquidityProvidingProps) => {
	const tokenInputAmount = useOptionalSignal<bigint>(0n)
	const liquidityLower = useOptionalSignal<number>(0)
	const liquidityUpper = useOptionalSignal<number>(1)

	useSignalEffect(() => {
		maybeWriteClient.deepValue
		marketData.deepValue
		refresh()
	})

	useEffect(() => { refresh() }, [])

	//const expectedLiquidity = useOptionalSignal<bigint>(undefined)
	const mintLiquidityButton = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		if (marketData.deepValue === undefined) return
		if (tokenInputAmount.deepValue === undefined) return
		if (liquidityLower.deepValue === undefined) return
		if (liquidityUpper.deepValue === undefined) return
		if (liquidityLower.deepValue < liquidityUpper.deepValue) return
		const aLotTimeInFuture = currentTimeInBigIntSeconds.value + ONE_YEAR_IN_SECONDS
		const setsToBuy = tokenInputAmount.deepValue / marketData.deepValue.numTicks
		const amountYesMax = setsToBuy
		const amountNoMax = setsToBuy
		const tickLower = priceToTick(liquidityLower.deepValue)
		const tickUpper = priceToTick(liquidityUpper.deepValue)
		await mintLiquidity(maybeWriteClient.deepValue, marketData.deepValue.marketAddress, setsToBuy, tickLower, tickUpper, amountNoMax, amountYesMax, aLotTimeInFuture)
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
		<section>
			<div class = 'form-grid'>
				<h3>Set Price Range</h3>
				<div class = 'price-range-grid'>
					<BigInputBox upperText = 'Min Liquidity' currency = { useComputed(() => <DaiNameAndSymbol/>) } style = { { borderRadius: '20px 0px 0px 20px' } }>
						<Input
							class = 'swap-amount'
							type = 'text'
							value = { liquidityLower }
							sanitize = { (amount: string) => amount.trim() }
							tryParse = { (amount: string | undefined) => {
								if (amount === undefined) return { ok: false } as const
								if (!isDecimalString(amount.trim())) return { ok: false } as const
								const rounded = roundToClosestPrice(Number(amount.trim()))
								if (rounded < 0 || rounded > 1) return { ok: false } as const
								return { ok: true, value: Math.round(rounded * 100) / 100 } as const
							} }
							serialize = { (amount: number | undefined) => {
								if (amount === undefined) return ''
								return amount.toString()
							} }
							invalidSignal = { useSignal(false) }
						/>
					</BigInputBox>
					<BigInputBox upperText = 'Max Liquidity' currency = { useComputed(() => <DaiNameAndSymbol/>) } style = { { borderRadius: '0px 20px 20px 0px' } }>
						<Input
							class = 'swap-amount'
							type = 'text'
							value = { liquidityUpper }
							sanitize = { (amount: string) => amount.trim() }
							tryParse = { (amount: string | undefined) => {
								if (amount === undefined) return { ok: false } as const
								if (!isDecimalString(amount.trim())) return { ok: false } as const
								const rounded = roundToClosestPrice(Number(amount.trim()))
								if (rounded < 0 || rounded > 1) return { ok: false } as const
								return { ok: true, value: Math.round(rounded * 100) / 100 } as const
							} }
							serialize = { (amount: number | undefined) => {
								if (amount === undefined) return ''
								return amount.toString()
							} }
							invalidSignal = { useSignal(false) }
						/>
					</BigInputBox>
				</div>
			</div>
		</section>
		<section>
			<div class = 'form-grid'>
				<h3>Set Deposit Amount</h3>
				<BigInputBox upperText = '' currency = { useComputed(() => <DaiNameAndSymbol/>) } style = { { width: '100%', minWidth: '100%'} }>
					<Input
						class = 'swap-amount'
						type = 'text'
						value = { tokenInputAmount }
						sanitize = { (amount: string) => amount.trim() }
						tryParse = { (amount: string | undefined) => {
							if (amount === undefined) return { ok: false } as const
							if (!isDecimalString(amount.trim())) return { ok: false } as const
							const parsed = decimalStringToBigint(amount.trim(), 18n)
							return { ok: true, value: parsed } as const
						} }
						serialize = { (amount: NonHexBigInt | undefined) => {
							if (amount === undefined) return ''
							return bigintToDecimalString(amount, 18n, 3)
						} }
						invalidSignal = { useSignal(false) }
					/>
				</BigInputBox>
			</div>
		</section>
		<section>
			<button class = 'button button-primary' style = 'width: 100%;' onClick = { mintLiquidityButton }>Provide Liquidity</button>
		</section>
		<section>
			<button class = 'button button-primary' onClick = { burnLiquidityButton }>Burn Liquidity</button>
		</section>
	</>
}

interface LiquidityProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
	currentTimeInBigIntSeconds: Signal<bigint>
}

export const Liquidity = ({ maybeReadClient, maybeWriteClient, universe, reputationTokenAddress, currentTimeInBigIntSeconds }: LiquidityProps) => {
	const marketAddress = useOptionalSignal<AccountAddress>(undefined)
	const marketData = useOptionalSignal<MarketData>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)

	const isInvalidMarketAddress = useSignal<boolean>(false)
	const isRouterDeployed = useOptionalSignal<boolean>(undefined)
	const requiredDaiApproval = useOptionalSignal<bigint>(undefined)
	const daiApprovedForRouter = useOptionalSignal<bigint>(undefined)
	const sharesApprovedToRouter = useOptionalSignal<boolean>(undefined)

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
		const router = getAugurConstantProductMarketRouterAddress()
		sharesApprovedToRouter.deepValue = await isErc1155ApprovedForAll(readClient, AUGUR_SHARE_TOKEN, writeClient.account.address, router)
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
				<TradingAndLiquidityProvidingAllowances maybeWriteClient = { maybeWriteClient } requiredDaiApproval = { requiredDaiApproval } allowedDai = { daiApprovedForRouter } sharesApprovedToRouter = { sharesApprovedToRouter }/>
				<LiquidityProviding maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient } marketData = { marketData } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>
			</Market>
		</div>
	</div>
}
