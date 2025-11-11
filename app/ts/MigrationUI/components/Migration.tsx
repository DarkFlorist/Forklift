import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress, EthereumQuantity } from '../../types/types.js'
import { fetchMarketData, getChildUniverse, getDisputeWindow, getDisputeWindowInfo, getForkValues, getParentUniverse, getRepTotalTheoreticalSupply, getTotalSupply, getUniverseForkingInformation, getWinningChildUniverse, migrateReputationToChildUniverseByPayout } from '../../utils/augurContractUtils.js'
import { getErc20TokenBalance } from '../../utils/erc20.js'
import { AugurMarkets, InvalidRules } from '../../utils/constants.js'
import { getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket, getUniverseName, isGenesisUniverse, getOutcomeName } from '../../utils/augurUtils.js'
import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { addressString, bigintToDecimalString, formatUnixTimestampIso } from '../../utils/ethereumUtils.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { MarketOutcomeWithUniverse } from '../../SharedUI/YesNoCategoricalMarketReportingOutcomes.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { SelectUniverse } from '../../SharedUI/SelectUniverse.js'
import { humanReadableDateDelta } from '../../utils/utils.js'
import { EtherScanAddress, MarketLink, OptionalUniverseLink } from '../../SharedUI/links.js'
import { CenteredBigSpinner } from '../../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../../SharedUI/SendTransactionButton.js'

interface MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	pathSignal: Signal<string>
	currentTimeInBigIntSeconds: Signal<bigint>
	updateTokenBalancesSignal: Signal<number>
	repTokenName: Signal<string>
	showUnexpectedError: (error: unknown) => void
}

interface GetForkValuesProps {
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	repTokenName: Signal<string>
}
// todo modify this to show this with the current rep in different universes and not just the goal
const DisplayForkValues = ({ forkValues, repTokenName }: GetForkValuesProps) => {
	if (forkValues.deepValue === undefined) return <></>
	return <div style = 'padding-top: 10px; padding-bottom: 10px'>Fork Reputation Goal ({ repTokenName } required for universe to win): { bigintToDecimalString(forkValues.deepValue.forkReputationGoal, 18n, 2) } { repTokenName }</div>
}

export const Migration = ({ repTokenName, updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, reputationTokenAddress, universe, universeForkingInformation, pathSignal, currentTimeInBigIntSeconds, showUnexpectedError }: MigrationProps) => {
	const reputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const forkingOutcomeStakes = useOptionalSignal<readonly MarketOutcomeWithUniverse[]>(undefined)
	const forkingMarketData = useOptionalSignal<MarketData>(undefined)
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const parentUniverse = useOptionalSignal<AccountAddress>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const migrationDisabled = useComputed(() => false)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const isRepV1ApprovedForMigration = useOptionalSignal<boolean>(true)
	const repTotalTheoreticalSupply = useOptionalSignal<EthereumQuantity>(undefined)
	const repSupply = useOptionalSignal<EthereumQuantity>(undefined)
	const winningUniverse = useOptionalSignal<AccountAddress>(undefined)
	const pendingTransactionStatus = useSignal<TransactionStatus>(undefined)
	const loading = useSignal<boolean>(false)

	useSignalEffect(() => {
		universe.deepValue
		universeForkingInformation.deepValue
		update(maybeReadClient.deepValue).catch(showUnexpectedError)
	})

	const update = async (readClient: ReadClient | undefined ) => {
		if (readClient === undefined) return
		if (readClient.account?.address === undefined) return
		if (reputationTokenAddress.deepValue === undefined) return
		if (universe.deepValue === undefined) return
		loading.value = true
		winningUniverse.deepValue = undefined
		parentUniverse.deepValue = undefined
		disputeWindowInfo.deepValue = undefined
		disputeWindowAddress.deepValue = undefined
		isRepV1ApprovedForMigration.deepValue = undefined
		forkingMarketData.deepValue = undefined
		forkingOutcomeStakes.deepValue = undefined
		forkValues.deepValue = undefined
		repTotalTheoreticalSupply.deepValue = undefined
		repSupply.deepValue = undefined
		reputationBalance.deepValue = undefined
		try {
			reputationBalance.deepValue = await getErc20TokenBalance(readClient, reputationTokenAddress.deepValue, readClient.account.address)
			if (isGenesisUniverse(universe.deepValue)) {
				// retrieve v1 balance only for genesis universe as its only relevant there
				parentUniverse.deepValue = addressString(0n) // we know that genesis doesn't have parent universe
			} else if (universe.deepValue !== undefined) {
				parentUniverse.deepValue = await getParentUniverse(readClient, universe.deepValue)
			}
			if (universeForkingInformation.deepValue?.isForking) {
				const forkingMarket = await fetchMarketData(readClient, universeForkingInformation.deepValue.forkingMarket)
				forkingMarketData.deepValue = forkingMarket
				const outcomeStakes = getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket(forkingMarketData.deepValue.marketType, forkingMarketData.deepValue.numOutcomes, forkingMarketData.deepValue.numTicks, forkingMarketData.deepValue.outcomes)
				forkingOutcomeStakes.deepValue = await Promise.all(outcomeStakes.map(async (outcomeStakes) => {
					return {
						...outcomeStakes,
						universeAddress: await getChildUniverse(readClient, forkingMarket.universe, outcomeStakes.payoutNumerators, forkingMarket.numTicks, forkingMarket.numOutcomes)
					}
				}))

				forkValues.deepValue = await getForkValues(readClient, reputationTokenAddress.deepValue)
				disputeWindowAddress.deepValue = await getDisputeWindow(readClient, universeForkingInformation.deepValue.forkingMarket)
				if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
					disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress.deepValue)
				}
				winningUniverse.deepValue = await getWinningChildUniverse(readClient, universe.deepValue)
			}
			repTotalTheoreticalSupply.deepValue = await getRepTotalTheoreticalSupply(readClient, reputationTokenAddress.deepValue)
			repSupply.deepValue = await getTotalSupply(readClient, reputationTokenAddress.deepValue)
		} catch(error: unknown) {
			return showUnexpectedError(error)
		} finally {
			loading.value = false
		}
	}

	const migrateReputationToChildUniverseByPayoutButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		if (forkingOutcomeStakes.deepValue === undefined) throw new Error('missing forkingOutcomeStakes')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('selectedPayoutNumerators not selected')
		if (reputationBalance.deepValue === undefined) throw new Error('reputationBalance not selected')
		return await migrateReputationToChildUniverseByPayout(writeClient, reputationTokenAddress.deepValue, selectedPayoutNumerators.deepValue, reputationBalance.deepValue)
	}

	const refresh = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const isMigrateDisabled = useComputed(() => {
		if (forkValues.deepValue === undefined) return true
		if (selectedPayoutNumerators.deepValue === undefined) return true
		if (forkingMarketData.deepValue === undefined) return true
		if (reputationTokenAddress.deepValue === undefined) return true
		if (reputationBalance.deepValue === undefined) return true
		if (reputationBalance.deepValue === 0n) return true
		return false
	})

	const universeValues = useComputed(() => {
		if (universeForkingInformation.deepValue === undefined || parentUniverse.deepValue === undefined || repTotalTheoreticalSupply.deepValue === undefined || repSupply.deepValue === undefined) return <CenteredBigSpinner/>

		return [
			['Universe Address', <EtherScanAddress address = { new Signal(universe.deepValue) } />],
			...parentUniverse.deepValue === undefined || BigInt(parentUniverse.deepValue) === 0n ? [] : [['Parent Universe Address', <OptionalUniverseLink address = { parentUniverse } pathSignal = { pathSignal }/> ]],
			['Reputation Address For The Universe', <EtherScanAddress address = { new Signal(reputationTokenAddress.deepValue) } />],
			['Token supply and theoretical supply', `${ bigintToDecimalString(repSupply.deepValue, 18n, 2) } ${ repTokenName } / ${ bigintToDecimalString(repTotalTheoreticalSupply.deepValue, 18n, 2) } ${ repTokenName } (${ bigintToDecimalString(repSupply.deepValue * 10000n / repTotalTheoreticalSupply.deepValue, 2n, 2)}%)`],
			...universeForkingInformation.deepValue.forkEndTime === undefined ? [] : [['Forking End Time', `${ humanReadableDateDelta(Number(universeForkingInformation.deepValue.forkEndTime - currentTimeInBigIntSeconds.value)) } (${ formatUnixTimestampIso(universeForkingInformation.deepValue.forkEndTime) })`]],
			...universeForkingInformation.deepValue.forkingMarket === undefined ? [] : [['Forking Market', <MarketLink address = { new Signal(universeForkingInformation.deepValue.forkingMarket) } pathSignal = { pathSignal }/>]],
			...winningUniverse.deepValue === undefined ? [] : [['Winning Universe', <OptionalUniverseLink address = { winningUniverse } pathSignal = { pathSignal }/>]],
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

	const migrationButton = useComputed(() => {
		if (!isMigrationPeriodActive.value) return <></>
		return <div class = 'button-group'>
			<SendTransactionButton
				className = 'button button-primary button-group-button'
				transactionStatus = { pendingTransactionStatus }
				sendTransaction = { migrateReputationToChildUniverseByPayoutButton }
				maybeWriteClient = { maybeWriteClient }
				disabled = { isMigrateDisabled }
				text = { useComputed(() => `Migrate ${ reputationBalance.deepValue === undefined ? '?' : bigintToDecimalString(reputationBalance.deepValue, 18n, 2) } ${ repTokenName } to the "${ selectedPayoutNumerators.deepValue === undefined || forkingMarketData.deepValue === undefined ? '?' : getOutcomeName(selectedPayoutNumerators.deepValue, forkingMarketData.deepValue) }" universe`) }
				callBackWhenIncluded = { refresh }
			/>
		</div>
	})

	const forkValuesComponent = useComputed(() => {
		if (universeForkingInformation.deepValue === undefined) return <CenteredBigSpinner/>
		if (!isMigrationPeriodActive.value) return <></>
		return <DisplayForkValues repTokenName = { repTokenName } forkValues = { forkValues }/>
	})

	if (universe.deepValue === undefined || reputationTokenAddress.deepValue === undefined || universeForkingInformation.deepValue === undefined) {
		return <div class = 'subApplication'>
			<section class = 'subApplication-card'>
				<CenteredBigSpinner/>
			</section>
		</div>
	}
	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<h1>Universe { getUniverseName(universe.deepValue) } ({ repTokenName })</h1>
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
					<Market loading = { loading } repTokenName = { repTokenName } marketData = { forkingMarketData } universe = { universe } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }>
						<span>
							<SelectUniverse repTokenName = { repTokenName } pathSignal = { pathSignal } marketData = { forkingMarketData } disabled = { migrationDisabled } outcomeStakes = { forkingOutcomeStakes } selectedPayoutNumerators = { selectedPayoutNumerators }/>
							{ forkValuesComponent }
						</span>
					</Market>
					{ migrationButton }
				</div>
			</> : <></> }
		</section>
	</div>
}
