import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress, EthereumQuantity, UniverseInformation } from '../../types/types.js'
import { fetchMarketData, getChildUniverse, getDisputeWindow, getDisputeWindowInfo, getForkValues, getParentUniverse, getRepTotalTheoreticalSupply, getTotalSupply, getUniverseForkingInformation, getUniverseInformation, getWinningChildUniverse, migrateReputationToChildUniverseByPayout } from '../../utils/augurContractUtils.js'
import { getErc20TokenBalance } from '../../utils/erc20.js'
import { AugurMarkets, InvalidRules } from '../../utils/constants.js'
import { getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket, getUniverseName, isGenesisUniverse, getOutcomeName, getRepTokenName } from '../../utils/augurUtils.js'
import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { bigintToDecimalString, decimalStringToBigint, formatUnixTimestampIso, isDecimalString } from '../../utils/ethereumUtils.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { MarketOutcomeWithUniverse } from '../../SharedUI/YesNoCategoricalMarketReportingOutcomes.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { SelectUniverse } from '../../SharedUI/SelectUniverse.js'
import { humanReadableDateDelta } from '../../utils/utils.js'
import { EtherScanAddress, MarketLink, OptionalUniverseLink } from '../../SharedUI/links.js'
import { CenteredBigSpinner } from '../../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../../SharedUI/SendTransactionButton.js'
import { Input } from '../../SharedUI/Input.js'
import { useState } from 'preact/hooks'

interface MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	pathSignal: Signal<string>
	currentTimeInBigIntSeconds: Signal<bigint>
	updateTokenBalancesSignal: Signal<number>
	showUnexpectedError: (error: unknown) => void
}

export const Migration = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, universe, universeForkingInformation, pathSignal, currentTimeInBigIntSeconds, showUnexpectedError }: MigrationProps) => {
	const reputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const forkingOutcomeStakes = useOptionalSignal<readonly MarketOutcomeWithUniverse[]>(undefined)
	const forkingMarketData = useOptionalSignal<MarketData>(undefined)
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const parentUniverse = useOptionalSignal<UniverseInformation>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const migrationDisabled = useComputed(() => false)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const repTotalTheoreticalSupply = useOptionalSignal<EthereumQuantity>(undefined)
	const repSupply = useOptionalSignal<EthereumQuantity>(undefined)
	const winningUniverse = useOptionalSignal<UniverseInformation>(undefined)
	const pendingTransactionStatus = useSignal<TransactionStatus>(undefined)
	const loading = useSignal<boolean>(false)

	const reputationToMigrate = useOptionalSignal<EthereumQuantity>(undefined)

	useSignalEffect(() => {
		universeForkingInformation.deepValue
		update(maybeReadClient.deepValue).catch(showUnexpectedError)
	})

	const update = async (readClient: ReadClient | undefined ) => {
		if (readClient === undefined) return
		if (universe.deepValue === undefined) return
		if (universeForkingInformation.deepValue === undefined) return
		loading.value = true
		try {
			if (readClient.account?.address !== undefined) {
				reputationBalance.deepValue = await getErc20TokenBalance(readClient, universe.deepValue.reputationTokenAddress, readClient.account.address)
			} else {
				reputationBalance.deepValue = 0n
			}
			if (isGenesisUniverse(universe.deepValue.universeAddress)) {
				// retrieve v1 balance only for genesis universe as its only relevant there
				parentUniverse.deepValue = undefined
			} else if (universe.deepValue !== undefined) {
				parentUniverse.deepValue = await getUniverseInformation(readClient, await getParentUniverse(readClient, universe.deepValue.universeAddress), false)
			}
			if (universeForkingInformation.deepValue?.isForking) {
				const forkingMarket = await fetchMarketData(readClient, universeForkingInformation.deepValue.forkingMarket)
				forkingMarketData.deepValue = forkingMarket
				const outcomeStakes = getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket(forkingMarketData.deepValue.marketType, forkingMarketData.deepValue.numOutcomes, forkingMarketData.deepValue.numTicks, forkingMarketData.deepValue.outcomes)
				forkingOutcomeStakes.deepValue = await Promise.all(outcomeStakes.map(async (outcomeStakes) => {
					const childUniverse = await getChildUniverse(readClient, forkingMarket.universe.universeAddress, outcomeStakes.payoutNumerators, forkingMarket.numTicks, forkingMarket.numOutcomes)
					return {
						...outcomeStakes,
						universe: BigInt(childUniverse) === 0x0n ? undefined : await getUniverseInformation(readClient, childUniverse, false)
					}
				}))

				forkValues.deepValue = await getForkValues(readClient, universe.deepValue.reputationTokenAddress)
				disputeWindowAddress.deepValue = await getDisputeWindow(readClient, universeForkingInformation.deepValue.forkingMarket)
				if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
					disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress.deepValue)
				}
				const winningUniverseAddress = await getWinningChildUniverse(readClient, universe.deepValue.universeAddress)
				if (winningUniverseAddress !== undefined && BigInt(winningUniverseAddress) !== 0x0n) {
					winningUniverse.deepValue =  await getUniverseInformation(readClient, winningUniverseAddress, false)
				} else {
					winningUniverse.deepValue = undefined
				}
			}
			repTotalTheoreticalSupply.deepValue = await getRepTotalTheoreticalSupply(readClient, universe.deepValue.reputationTokenAddress)
			repSupply.deepValue = await getTotalSupply(readClient, universe.deepValue.reputationTokenAddress)
		} finally {
			loading.value = false
		}
	}

	const migrateReputationToChildUniverseByPayoutButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (universe.deepValue?.reputationTokenAddress === undefined) throw new Error('missing reputationTokenAddress')
		if (forkingOutcomeStakes.deepValue === undefined) throw new Error('missing forkingOutcomeStakes')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('selectedPayoutNumerators not selected')
		if (reputationToMigrate.deepValue === undefined) throw new Error('reputationBalance not selected')
		return await migrateReputationToChildUniverseByPayout(writeClient, universe.deepValue.reputationTokenAddress, selectedPayoutNumerators.deepValue, reputationToMigrate.deepValue)
	}

	const refresh = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		updateTokenBalancesSignal.value++
		await update(writeClient).catch(showUnexpectedError)
	}

	const isMigrateDisabled = useComputed(() => {
		if (forkValues.deepValue === undefined) return true
		if (selectedPayoutNumerators.deepValue === undefined) return true
		if (forkingMarketData.deepValue === undefined) return true
		if (universe.deepValue === undefined) return true
		if (reputationBalance.deepValue === undefined) return true
		if (reputationBalance.deepValue === 0n) return true
		if (reputationToMigrate.deepValue === undefined || reputationToMigrate.deepValue === 0n) return true
		if (reputationToMigrate.deepValue > reputationBalance.deepValue) return true
		return false
	})

	const universeAddress = useComputed(() => universe.deepValue?.universeAddress)
	const reputationTokenAddress = useComputed(() => universe.deepValue?.reputationTokenAddress)
	const forkingMarketAddress = useComputed(() => universeForkingInformation.deepValue?.forkingMarket)

	const universeValues = useComputed(() => {
		if (universeForkingInformation.deepValue === undefined || repTotalTheoreticalSupply.deepValue === undefined || repSupply.deepValue === undefined) return <CenteredBigSpinner/>
		return [
			['Universe Address', <EtherScanAddress address = { universeAddress } />],
			...parentUniverse.deepValue === undefined ? [] : [['Parent Universe Address', <OptionalUniverseLink universe = { parentUniverse } pathSignal = { pathSignal }/> ]],
			['Reputation Address For The Universe', <EtherScanAddress address = { reputationTokenAddress } />],
			['Token supply and theoretical supply', `${ bigintToDecimalString(repSupply.deepValue, 18n, 2) } ${ getRepTokenName(universe.deepValue?.repTokenName) } / ${ bigintToDecimalString(repTotalTheoreticalSupply.deepValue, 18n, 2) } ${ getRepTokenName(universe.deepValue?.repTokenName) } (${ bigintToDecimalString(repSupply.deepValue * 10000n / repTotalTheoreticalSupply.deepValue, 2n, 2)}%)`],
			...universeForkingInformation.deepValue.forkEndTime === undefined ? [] : [['Forking End Time', `${ humanReadableDateDelta(Number(universeForkingInformation.deepValue.forkEndTime - currentTimeInBigIntSeconds.value)) } (${ formatUnixTimestampIso(universeForkingInformation.deepValue.forkEndTime) })`]],
			...universeForkingInformation.deepValue.forkingMarket === undefined ? [] : [['Forking Market', <MarketLink address = { forkingMarketAddress } pathSignal = { pathSignal }/>]],
			...winningUniverse.deepValue === undefined ? [] : [['Winning Universe', <OptionalUniverseLink universe = { winningUniverse } pathSignal = { pathSignal }/>]],
		].map(([label, val]) => (
			<div className = 'detail' key = { label }>
				<strong>{ label }</strong>
				<span>{ val }</span>
			</div>
		))
	})

	const isMigrationPeriodActive = useComputed(() => {
		if (universeForkingInformation.deepValue === undefined) return false
		if (!universeForkingInformation.deepValue.isForking) return false
		if (universeForkingInformation.deepValue.forkEndTime > currentTimeInBigIntSeconds.value) return true
		return false
	})

	const forkingText = useComputed(() => {
		if (universeForkingInformation.deepValue === undefined) return <CenteredBigSpinner/>
		if (!universeForkingInformation.deepValue.isForking) return <p></p>
		if (universeForkingInformation.deepValue.forkEndTime > currentTimeInBigIntSeconds.value) {
			return <span class = 'universe-forking'>
				<h2>The Universe is forking! Please migrate your Reputation tokens!</h2>
				<p>Please read the market description carefully and migrate your Reputation tokens to the outcome that you believe is the truthfull outcome of this market. Please also check the market against Augur V2 Reporting rules.</p>
			</span>
		}
		return <span class = 'universe-forking'>
			<h2>The Universe has forked!</h2>
			<p>Reputation token migration period has ended.</p>
		</span>
	})

	const migrateButtonText = useComputed(() => `Migrate ${ reputationToMigrate.deepValue === undefined ? '?' : bigintToDecimalString(reputationToMigrate.deepValue, 18n, 2) } ${ getRepTokenName(universe.deepValue?.repTokenName) } to the "${ selectedPayoutNumerators.deepValue === undefined || forkingMarketData.deepValue === undefined ? '?' : getOutcomeName(selectedPayoutNumerators.deepValue, forkingMarketData.deepValue) }" universe`)

	const repName = useComputed(() => getRepTokenName(universeForkingInformation.deepValue?.universe.repTokenName))

	const [MigrationButton] = useState(() => () => {
		if (!isMigrationPeriodActive.value) return <></>
		if (universeForkingInformation.deepValue === undefined) return <></>
		if (forkingMarketData.deepValue === undefined) return <></>
		if (forkingOutcomeStakes.deepValue === undefined) return <></>

		const setMaxReputationToMigrate = async () => {
			reputationToMigrate.deepValue = reputationBalance.deepValue
		}

		return <div>
			<div style = { { display: 'flex', alignItems: 'baseline', gap: '0.5em', paddingBottom: '10px', paddingTop: '10px' } }>
				<Input
					class = 'input reporting-panel-input'
					type = 'text'
					placeholder = { useComputed(() => `REP`) }
					disabled = { useComputed(() => false) }
					style = { { maxWidth: '300px' } }
					value = { reputationToMigrate }
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
				<span class = 'unit'>{ repName.value }</span>
				<button class = 'button button-secondary button-small ' style = { { whiteSpace: 'nowrap' } } onClick = { setMaxReputationToMigrate }>Max</button>
			</div>

			<div class = 'button-group'>
				<SendTransactionButton
					className = 'button button-primary button-group-button'
					transactionStatus = { pendingTransactionStatus }
					sendTransaction = { migrateReputationToChildUniverseByPayoutButton }
					maybeWriteClient = { maybeWriteClient }
					disabled = { isMigrateDisabled }
					text = { migrateButtonText }
					callBackWhenIncluded = { refresh }
				/>
			</div>
		</div>
	})

	if (universe.deepValue === undefined || universeForkingInformation.deepValue === undefined) {
		return <div class = 'subApplication'>
			<section class = 'subApplication-card'>
				<CenteredBigSpinner/>
			</section>
		</div>
	}
	const universeName = useComputed(() => universe.deepValue === undefined ? '' : getUniverseName(universe.deepValue))
	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<h1>Universe { universeName.value }</h1>
			<section class = 'details-grid'>
				{ universeValues.value }
			</section>
			{ universeForkingInformation.deepValue.isForking ? <>
				{ forkingText }
				<div class = 'reportingRules detail'>
					<h2>Reporting Rules</h2>
					<p>The market should resolve invalid if: </p>
					<ul>
						{ InvalidRules.map((rule) => <li> { rule } </li>) }
					</ul>

					<p>Additional rules: </p>
					<ul>
						{ AugurMarkets.map((rule) => <li> { rule } </li>) }
					</ul>
				</div>

				<div class = 'forkMarket'>
					<span class = 'border-text'>Forking Market</span>
					<Market loading = { loading } marketData = { forkingMarketData } universe = { universe } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }>
						<span>
							<SelectUniverse maybeWriteClient = { maybeWriteClient } universe = { universe } refreshStakes = { refresh } pathSignal = { pathSignal } marketData = { forkingMarketData } disabled = { migrationDisabled } outcomeStakes = { forkingOutcomeStakes } selectedPayoutNumerators = { selectedPayoutNumerators }/>
						</span>
					</Market>
					<MigrationButton/>
				</div>
			</> : <></> }
		</section>
	</div>
}
