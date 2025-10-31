import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress, EthereumQuantity } from '../../types/types.js'
import { fetchMarketData, getChildUniverse, getDisputeWindow, getDisputeWindowInfo, getForkValues, getParentUniverse, getUniverseForkingInformation, migrateReputationToChildUniverseByPayout } from '../../utils/augurContractUtils.js'
import { getErc20TokenBalance } from '../../utils/erc20.js'
import { AugurMarkets, InvalidRules } from '../../utils/constants.js'
import { getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket, getUniverseName, getUniverseUrl, isGenesisUniverse, getOutcomeName } from '../../utils/augurUtils.js'
import { Signal, useComputed, useSignalEffect } from '@preact/signals'
import { addressString, bigintToDecimalString, formatUnixTimestampIso } from '../../utils/ethereumUtils.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { MarketOutcomeOption } from '../../SharedUI/YesNoCategoricalMarketReportingOptions.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { SelectUniverse } from '../../SharedUI/SelectUniverse.js'

interface MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	pathSignal: Signal<string>
	currentTimeInBigIntSeconds: Signal<bigint>
	updateTokenBalancesSignal: Signal<number>
}

interface GetForkValuesProps {
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
}
// todo modify this to show this with the current rep in different universes and not just the goal
const DisplayForkValues = ({ forkValues }: GetForkValuesProps) => {
	if (forkValues.deepValue === undefined) return <></>
	return <div style = 'padding-top: 10px; padding-bottom: 10px'>Fork Reputation Goal (REP required for universe to win): { bigintToDecimalString(forkValues.deepValue.forkReputationGoal, 18n, 2) } REP</div>
}

export const Migration = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, reputationTokenAddress, universe, universeForkingInformation, pathSignal, currentTimeInBigIntSeconds }: MigrationProps) => {
	const reputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const forkingoutcomeStakes = useOptionalSignal<readonly MarketOutcomeOption[]>(undefined)
	const forkingMarketData = useOptionalSignal<MarketData>(undefined)
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const parentUniverse = useOptionalSignal<AccountAddress>(undefined)
	const childUniverseAddress = useOptionalSignal<AccountAddress>(undefined)
	const childUniverseUrl = useComputed(() => childUniverseAddress.deepValue === undefined ? '' : getUniverseUrl(childUniverseAddress.deepValue, 'migration'))
	const parentUniverseUrl = useComputed(() => parentUniverse.deepValue === undefined ? '' : getUniverseUrl(parentUniverse.deepValue, 'migration'))
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const migrationDisabled = useComputed(() => false)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const isRepV1ApprovedForMigration = useOptionalSignal<boolean>(true)
	useSignalEffect(() => {
		universe.deepValue
		universeForkingInformation.deepValue
		update(maybeReadClient.deepValue).catch(console.error)
	})

	const update = async (readClient: ReadClient | undefined ) => {
		if (readClient === undefined) return
		if (readClient.account?.address === undefined) return
		if (reputationTokenAddress.deepValue === undefined) return
		isRepV1ApprovedForMigration.deepValue = undefined
		reputationBalance.deepValue = await getErc20TokenBalance(readClient, reputationTokenAddress.deepValue, readClient.account.address)
		if (isGenesisUniverse(universe.deepValue)) {
			// retrieve v1 balance only for genesis universe as its only relevant there
			parentUniverse.deepValue = addressString(0n) // we know that genesis doesn't have parent universe
		} else if (universe.deepValue !== undefined) {
			parentUniverse.deepValue = await getParentUniverse(readClient, universe.deepValue)
		}
		if (universeForkingInformation.deepValue?.isForking) {
			forkingMarketData.deepValue = await fetchMarketData(readClient, universeForkingInformation.deepValue.forkingMarket)
			forkingoutcomeStakes.deepValue = getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket(forkingMarketData.deepValue.marketType, forkingMarketData.deepValue.numOutcomes, forkingMarketData.deepValue.numTicks, forkingMarketData.deepValue.outcomes)
			forkValues.deepValue = await getForkValues(readClient, reputationTokenAddress.deepValue)
			disputeWindowAddress.deepValue = await getDisputeWindow(readClient, universeForkingInformation.deepValue.forkingMarket)
			if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
				disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress.deepValue)
			}
			await refreshChildUniverse()
		}
	}

	const migrateReputationToChildUniverseByPayoutButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		if (forkingoutcomeStakes.deepValue === undefined) throw new Error('missing forkingoutcomeStakes')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('selectedPayoutNumerators not selected')
		if (reputationBalance.deepValue === undefined) throw new Error('reputationBalance not selected')
		await migrateReputationToChildUniverseByPayout(writeClient, reputationTokenAddress.deepValue, selectedPayoutNumerators.deepValue, reputationBalance.deepValue)

		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const refreshChildUniverse = async () => {
		childUniverseAddress.deepValue = undefined
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) return
		if (forkingoutcomeStakes.deepValue === undefined) return
		if (selectedPayoutNumerators.deepValue === undefined) return
		if (forkingMarketData.deepValue === undefined) return
		childUniverseAddress.deepValue = await getChildUniverse(writeClient, forkingMarketData.deepValue.universe, selectedPayoutNumerators.deepValue, forkingMarketData.deepValue.numTicks, forkingMarketData.deepValue.numOutcomes)
	}

	useSignalEffect(() => {
		if (maybeWriteClient.deepValue === undefined) return
		if (forkingoutcomeStakes.deepValue === undefined) return
		if (selectedPayoutNumerators.deepValue === undefined) return
		if (forkingMarketData.deepValue === undefined) return
		refreshChildUniverse().catch(console.error)
	})

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
		if (universeForkingInformation.deepValue === undefined) return <></>
		if (parentUniverse.deepValue === undefined) return <></>
		return [
			['Universe Address', universe.deepValue],
			...parentUniverse.deepValue === undefined || BigInt(parentUniverse.deepValue) === 0n ? [] : [['Parent Universe Address', <a href = '#' onClick = { (event) => { event.preventDefault(); pathSignal.value = parentUniverseUrl.value } }> { getUniverseName(parentUniverse.deepValue) }</a>]],
			['Reputation Address For The Universe', reputationTokenAddress.deepValue],
			['Is Universe Forking', universeForkingInformation.deepValue.isForking ? 'Yes' : 'No'],
			['Forking End Time', universeForkingInformation.deepValue.forkEndTime === undefined ? 'Not Forking' : formatUnixTimestampIso(universeForkingInformation.deepValue.forkEndTime)],
			['Has Forking Time Ended', universeForkingInformation.deepValue.forkEndTime !== undefined && universeForkingInformation.deepValue.forkEndTime < currentTimeInBigIntSeconds.value ? 'Yes' : 'No'],
			['Forking Market', universeForkingInformation.deepValue.forkingMarket === undefined ? 'No Forking Market' : universeForkingInformation.deepValue.forkingMarket],
		].map(([label, val]) => (
			<div className = 'detail' key = { label }>
				<strong>{ label }</strong>
				<span>{ val }</span>
			</div>
		))
	})

	if (universe.deepValue === undefined || reputationTokenAddress.deepValue === undefined || universeForkingInformation.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<h1>Universe { getUniverseName(universe.deepValue) }</h1>
			<section class = 'details-grid'>
				{ universeValues.value }
			</section>
			{ universeForkingInformation.deepValue.isForking ? <>
				<span class ='universe-forking'>
					<h2>The Universe is forking! Please migrate your Reputation tokens!</h2>
					<p>Please read the market description carefully and migrate your Reputation tokens to the outcome that you believe is the truthfull outcome of this market. Please also check the market against Augur V2 Reporting rules.</p>
				</span>
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
					<Market marketData = { forkingMarketData } universe = { universe } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }>
						<span>
							<SelectUniverse marketData = { forkingMarketData } disabled = { migrationDisabled } outcomeStakes = { forkingoutcomeStakes } selectedPayoutNumerators = { selectedPayoutNumerators }/>
							<DisplayForkValues forkValues = { forkValues }/>
						</span>
					</Market>
					{ childUniverseAddress.deepValue !== undefined && BigInt(childUniverseAddress.deepValue) !== 0n ? <p> "{ selectedPayoutNumerators.deepValue === undefined || forkingMarketData.deepValue === undefined ? '?' : getOutcomeName(selectedPayoutNumerators.deepValue, forkingMarketData.deepValue) }" universe address: <a href = { childUniverseUrl.value } onClick = { (event) => {
						event.preventDefault(); pathSignal.value = childUniverseUrl.value
						console.log(`pathSignal.value = ${ childUniverseUrl.value }`)
						} }> { childUniverseAddress.value }</a></p> : <></> }
					<div class = 'button-group'>
						<button class = 'button button-primary button-group-button' onClick = { migrateReputationToChildUniverseByPayoutButton } disabled = { isMigrateDisabled.value }>Migrate { forkValues.deepValue === undefined ? '?' : bigintToDecimalString(forkValues.deepValue.forkReputationGoal, 18n, 2) } REP to the "{ selectedPayoutNumerators.deepValue === undefined || forkingMarketData.deepValue === undefined ? '?' : getOutcomeName(selectedPayoutNumerators.deepValue, forkingMarketData.deepValue) }" universe</button>
					</div>
				</div>
			</> : <></> }
		</section>
	</div>
}
