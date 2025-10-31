import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress, EthereumQuantity } from '../../types/types.js'
import { fetchMarketData, getChildUniverse, getDisputeWindow, getDisputeWindowInfo, getForkValues, getParentUniverse, getUniverseForkingInformation, migrateFromRepV1toRepV2GenesisToken, migrateReputationToChildUniverseByPayout } from '../../utils/augurContractUtils.js'
import { approveErc20Token, getAllowanceErc20Token, getErc20TokenBalance } from '../../utils/erc20.js'
import { REPUTATION_V1_TOKEN_ADDRESS } from '../../utils/constants.js'
import { getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket, getUniverseName, getUniverseUrl, isGenesisUniverse } from '../../utils/augurUtils.js'
import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { addressString, bigintToDecimalString, decimalStringToBigint, formatUnixTimestampIso } from '../../utils/ethereumUtils.js'
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
export const DisplayForkValues = ({ forkValues }: GetForkValuesProps) => {
	if (forkValues.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<span><b>Fork Values</b></span>
		<div style = 'display: grid'>
			<span><b>Fork Reputation Goal (rep required for universe to win):</b>{ bigintToDecimalString(forkValues.deepValue.forkReputationGoal, 18n, 2) } REP</span>
		</div>
	</div>
}

const GENESIS_REPUTATION_V2_TOKEN_ADDRESS = '0x221657776846890989a759BA2973e427DfF5C9bB'

export const Migration = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, reputationTokenAddress, universe, universeForkingInformation, pathSignal, currentTimeInBigIntSeconds }: MigrationProps) => {
	const v2ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const v1ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const isGenesisUniverseField = useComputed(() => isGenesisUniverse(universe.deepValue))
	const forkingoutcomeStakes = useOptionalSignal<readonly MarketOutcomeOption[]>(undefined)
	const forkingMarketData = useOptionalSignal<MarketData>(undefined)
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const repV2ToMigrateToNewUniverse = useSignal<string>('')
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
		update(maybeReadClient.deepValue).catch(console.error)
	})

	const update = async (readClient: ReadClient | undefined ) => {
		if (readClient === undefined) return
		if (readClient.account?.address === undefined) return
		if (reputationTokenAddress.deepValue === undefined) return
		isRepV1ApprovedForMigration.deepValue = undefined
		v2ReputationBalance.deepValue = await getErc20TokenBalance(readClient, reputationTokenAddress.deepValue, readClient.account.address)
		if (isGenesisUniverse(universe.deepValue)) {
			// retrieve v1 balance only for genesis universe as its only relevant there
			v1ReputationBalance.deepValue = await getErc20TokenBalance(readClient, REPUTATION_V1_TOKEN_ADDRESS, readClient.account.address)
			parentUniverse.deepValue = addressString(0n) // we know that genesis doesn't have parent universe
			isRepV1ApprovedForMigration.deepValue = await getAllowanceErc20Token(readClient, REPUTATION_V1_TOKEN_ADDRESS, readClient.account.address, GENESIS_REPUTATION_V2_TOKEN_ADDRESS) >= v1ReputationBalance.deepValue
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
		}
	}

	const migrateReputationToChildUniverseByPayoutButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		if (forkingoutcomeStakes.deepValue === undefined) throw new Error('missing forkingoutcomeStakes')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('selectedPayoutNumerators not selected')
		if (repV2ToMigrateToNewUniverse.value.trim() === '') throw new Error ('Input missing')
		const repV2ToMigrateToNewUniverseBigInt = decimalStringToBigint(repV2ToMigrateToNewUniverse.value, 18n)
		await migrateReputationToChildUniverseByPayout(writeClient, reputationTokenAddress.deepValue, selectedPayoutNumerators.deepValue, repV2ToMigrateToNewUniverseBigInt)

		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const migrateFromRepV1toRepV2GenesisTokenButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		await migrateFromRepV1toRepV2GenesisToken(writeClient, GENESIS_REPUTATION_V2_TOKEN_ADDRESS)

		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const approveRepV1ForMigration = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (v1ReputationBalance.deepValue === undefined) throw new Error('missing v1ReputationBalance balance')
		await approveErc20Token(writeClient, REPUTATION_V1_TOKEN_ADDRESS, GENESIS_REPUTATION_V2_TOKEN_ADDRESS, v1ReputationBalance.deepValue)

		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const getChildUniverseButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (forkingoutcomeStakes.deepValue === undefined) throw new Error('missing forkingoutcomeStakes')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('Selected outcome not found')
		if (forkingMarketData.deepValue === undefined) throw new Error('Forking market missing')
		childUniverseAddress.deepValue = await getChildUniverse(writeClient, forkingMarketData.deepValue.universe, selectedPayoutNumerators.deepValue, forkingMarketData.deepValue.numTicks, forkingMarketData.deepValue.numOutcomes)
	}

	const isApproveRepV1ForMigrationDisabled = useComputed(() => {
		if (isRepV1ApprovedForMigration.deepValue === undefined) return true
		if (isRepV1ApprovedForMigration.deepValue === true) return true
		if (v1ReputationBalance.deepValue === undefined) return true
		if (v1ReputationBalance.deepValue === 0n) return true
		return false
	})
	const isMigrateFromRepV1toRepV2GenesisTokenButtonDisabled = useComputed(() => {
		if (isRepV1ApprovedForMigration.deepValue === undefined) return true
		if (isRepV1ApprovedForMigration.deepValue === false) return true
		if (v1ReputationBalance.deepValue === undefined) return true
		if (v1ReputationBalance.deepValue === 0n) return true
		return false
	})
	if (universe.deepValue === undefined || reputationTokenAddress.deepValue === undefined || universeForkingInformation.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
				<h1>Universe { getUniverseName(universe.deepValue) }</h1>
				<section class = 'details-grid'>
					{ [
						['Universe Address', universe.deepValue],
						...parentUniverse.deepValue === undefined || BigInt(parentUniverse.deepValue) === 0n ? [] : [['Parent Universe Name', getUniverseName(parentUniverse.deepValue)]],
						...parentUniverse.deepValue === undefined || BigInt(parentUniverse.deepValue) === 0n ? [] : [['Parent Universe Address', <a href = '#' onClick = { (event) => { event.preventDefault(); pathSignal.value = parentUniverseUrl.value } }> { parentUniverse.value }</a>]],
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
					)) }
				</section>
			{ universeForkingInformation.deepValue.isForking ? <>
					<Market marketData = { forkingMarketData } universe = { universe } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }>
						<SelectUniverse marketData = { forkingMarketData } disabled = { migrationDisabled } outcomeStakes = { forkingoutcomeStakes } selectedPayoutNumerators = { selectedPayoutNumerators }/>
					</Market>
					<DisplayForkValues forkValues = { forkValues }/>
					<p> Child universe address: <a href = '#' onClick = { (event) => { event.preventDefault(); pathSignal.value = childUniverseUrl.value } }> { childUniverseAddress.value }</a></p>
					<div style = 'margin-top: 0.5rem'>
						<label>
							Amount to migrate to new universe:{' '}
							<input
								type = 'text'
								placeholder = ''
								value = { repV2ToMigrateToNewUniverse.value }
								onChange = { (event) => {
									const target = event.target as HTMLInputElement
									repV2ToMigrateToNewUniverse.value = target.value
								} }
							/>
						</label>
					</div>
				<button class = 'button button-primary' onClick = { getChildUniverseButton }>Refresh child universe for the selection</button>
				<button class = 'button button-primary' onClick = { migrateReputationToChildUniverseByPayoutButton }>Migrate Reputation to the new universe</button>
			</> : <></> }
			{ isGenesisUniverseField.value ? <>
				<h1>Reputation V1 to V2 Migration</h1>
				<span><b>You have: </b>{ v1ReputationBalance.deepValue !== undefined ? `${ bigintToDecimalString(v1ReputationBalance.deepValue, 18n, 2) } REPv1 ` : '? REPv1 ' }
				and { v2ReputationBalance.deepValue !== undefined ? `${ bigintToDecimalString(v2ReputationBalance.deepValue, 18n, 2) } REPv2` : '? REPv2' }
				</span>
				<button class = 'button button-primary' disabled = { isApproveRepV1ForMigrationDisabled } onClick = { approveRepV1ForMigration }>Approve Reputation V1 For Migration</button>
				<button class = 'button button-primary' disabled = { isMigrateFromRepV1toRepV2GenesisTokenButtonDisabled } onClick = { migrateFromRepV1toRepV2GenesisTokenButton }>Migrate Reputation V1 Tokens To Reputation V2</button>
			</> : <></> }
		</section>
	</div>
}
