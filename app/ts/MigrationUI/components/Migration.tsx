import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, EthereumAddress, EthereumQuantity, UniverseInformation } from '../../types/types.js'
import { fetchMarketData, getChildUniverse, getDisputeWindow, getDisputeWindowInfo, getForkValues, getParentUniverse, getReputationTotalTheoreticalSupply, getTotalSupply, getUniverseForkingInformation, getUniverseInformation, getWinningChildUniverse, migrateReputationToChildUniverseByPayout } from '../../utils/augurContractUtils.js'
import { getErc20TokenBalance } from '../../utils/erc20.js'
import { AugurMarkets, InvalidRules } from '../../utils/constants.js'
import { getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket, getUniverseName, isGenesisUniverse, getOutcomeName, getRepTokenName, hasForkEnded } from '../../utils/augurUtils.js'
import { ReadonlySignal, Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { bigintToRoundedDecimalString } from '../../utils/ethereumUtils.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { MarketOutcomeWithUniverse } from '../../SharedUI/YesNoCategoricalMarketReportingOutcomes.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { SelectUniverse } from '../../SharedUI/SelectUniverse.js'
import { filterIfExistsAddOtherwise, humanReadableDateDelta } from '../../utils/utils.js'
import { EtherScanAddress, MarketLink, OptionalUniverseLink } from '../../SharedUI/links.js'
import { CenteredBigSpinner } from '../../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../../SharedUI/SendTransactionButton.js'
import { Input } from '../../SharedUI/Input.js'
import { useState } from 'preact/hooks'
import { parse18DecimalBigintForInput, parseAddressForInput, serialize18DecimalBigintForInput, serializeAddressForInput } from '../../utils/inputParsing.js'
import { getAvailableDisputesFromForkedMarkets, redeemStakeBatch } from '../../utils/augurExtraUtilities.js'
import { LoadingButton } from '../../SharedUI/LoadingButton.js'
import { promiseAllMapAbortSafe } from '../../utils/abortGuard.js'
import { RoundedDecimalString, RoundedDecimalStringWithUnknown } from '../../SharedUI/RoundedBigInt.js'
import { IsoTimestamp } from '../../SharedUI/IsoTimestamp.js'

interface ForkAndRedeemDisputeCrowdSourcersProps {
	forkingMarketData: OptionalSignal<MarketData>
	availableClaimsFromForkingDisputeCrowdSourcers: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>
	isAugurExtraUtilitiesDeployedSignal: OptionalSignal<boolean>
	selectedForkedCrowdSourcers: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
	isLoadingDisputeCrowdSourcers: ReadonlySignal<boolean>
	viewingAddress: OptionalSignal<AccountAddress>
}

const ClaimInfo = ({ text }: { text: string }) => {
	return <div class = 'claim-option'>
		<div class = 'claim-info'>
			<span>
				{ text }
			</span>
		</div>
	</div>
}

const ForkAndRedeemDisputeCrowdSourcers = ({ viewingAddress, forkingMarketData, isAugurExtraUtilitiesDeployedSignal, availableClaimsFromForkingDisputeCrowdSourcers, selectedForkedCrowdSourcers, pathSignal, isLoadingDisputeCrowdSourcers }: ForkAndRedeemDisputeCrowdSourcersProps) => {
	const results = useComputed(() => {
		if (isAugurExtraUtilitiesDeployedSignal.deepValue === false) return <ClaimInfo text = 'Deploy extra utils to see...'/>
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined) return isLoadingDisputeCrowdSourcers.value ? <CenteredBigSpinner/> : <ClaimInfo text = 'Click below to check whether you have any claims available'/>
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue.length === 0) return <ClaimInfo text = { 'No claims available' }/>
		return availableClaimsFromForkingDisputeCrowdSourcers.deepValue.map((disputeEntry) => {
			if (forkingMarketData.deepValue === undefined) return
			return <span class = 'claim-option' key = { disputeEntry.bond }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedForkedCrowdSourcers.value.includes(disputeEntry.bond) }
					onChange = { () => {
						selectedForkedCrowdSourcers.value = filterIfExistsAddOtherwise(selectedForkedCrowdSourcers.value, disputeEntry.bond)
					} }
				/>
				<div class = 'claim-info'>
					{ disputeEntry.marketData === undefined ? <>
						<div><b>Market <MarketLink address = { new Signal(forkingMarketData.deepValue.marketAddress) } pathSignal = { pathSignal }/></b></div>
						<div>Migrate <RoundedDecimalString value = { new Signal(disputeEntry.amount) } power = { 18n } maxDecimals = { 2 }/> { getRepTokenName(disputeEntry.universeData.repTokenName) } to { getOutcomeName(disputeEntry.payoutNumerators, forkingMarketData.deepValue) }</div>

					</> : <>
						<div><b>Market <MarketLink address = { new Signal(disputeEntry.market) } pathSignal = { pathSignal }/></b></div>
						<div>Migrate <RoundedDecimalString value = { new Signal(disputeEntry.amount) } power = { 18n } maxDecimals = { 2 }/> { getRepTokenName(disputeEntry.universeData.repTokenName) } to { getOutcomeName(disputeEntry.payoutNumerators, disputeEntry.marketData) }</div>
					</> }
				</div>
			</span>
		})
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem forked dispute crowdsourcers</h1></span>
			<Input
				style = 'height: fit-content;'
				key = 'market-reporting-input'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = 'Claim for a different address (if empty, claim for your address)'
				value = { viewingAddress }
				sanitize = { (addressString: string) => addressString }
				tryParse = { parseAddressForInput }
				serialize = { serializeAddressForInput }
			/>
			<div class = 'claim-options' style = 'padding-top: 20px;'>
				{ results.value }
			</div>
		</div>
	</div>
}

interface MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	pathSignal: Signal<string>
	currentTimeInBigIntSeconds: ReadonlySignal<bigint>
	updateTokenBalancesSignal: Signal<number>
	showUnexpectedError: (error: unknown) => void
	isAugurExtraUtilitiesDeployedSignal: OptionalSignal<boolean>
}

let updateDataAbortController: AbortController | undefined = undefined
let queryAvailableClaimsAbortController: AbortController | undefined = undefined

export const Migration = ({ isAugurExtraUtilitiesDeployedSignal, updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, universe, universeForkingInformation, pathSignal, currentTimeInBigIntSeconds, showUnexpectedError }: MigrationProps) => {
	const reputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const forkingOutcomeStakes = useOptionalSignal<readonly MarketOutcomeWithUniverse[]>(undefined)
	const forkingMarketData = useOptionalSignal<MarketData>(undefined)
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const parentUniverse = useOptionalSignal<UniverseInformation>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const migrationDisabled = useComputed(() => universeForkingInformation.deepValue === undefined || hasForkEnded(universeForkingInformation.deepValue, currentTimeInBigIntSeconds.value))
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const repTotalTheoreticalSupply = useOptionalSignal<EthereumQuantity>(undefined)
	const repSupply = useOptionalSignal<EthereumQuantity>(undefined)
	const winningUniverse = useOptionalSignal<UniverseInformation>(undefined)
	const pendingTransactionStatus = useSignal<TransactionStatus>(undefined)
	const loading = useSignal<boolean>(false)

	const selectedForkedCrowdSourcers = useSignal<readonly AccountAddress[]>([])
	const reputationToMigrate = useOptionalSignal<EthereumQuantity>(undefined)
	const pendingForkDisputesTransactionStatus = useSignal<TransactionStatus>(undefined)
	const claimForkDisputesDisabled = useComputed(() => selectedForkedCrowdSourcers.value.length === 0 || isAugurExtraUtilitiesDeployedSignal.deepValue !== true)

	const viewingAddress = useOptionalSignal<AccountAddress>(undefined)
	const claimForAddress = useComputed(() => viewingAddress.deepValue === undefined ? maybeWriteClient.deepValue?.account.address : viewingAddress.deepValue)
	const availableClaimsFromForkingDisputeCrowdSourcers = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>(undefined)

	const claimForkDisputes = async () => {
		if (maybeWriteClient.deepValue === undefined) throw Error('no write client')
		if (isAugurExtraUtilitiesDeployedSignal.deepValue !== true) throw new Error('extra utils not deployed')
		const selected = Array.from(selectedForkedCrowdSourcers.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
		if (selected.length === 0) throw new Error('nothing to claim')
		if (claimForAddress.value === undefined) throw new Error('no claiming for address')
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined) throw new Error('no claims')
		const needForking = selected.filter((selectedBond) => availableClaimsFromForkingDisputeCrowdSourcers.deepValue?.some((claim) => selectedBond === claim.bond && BigInt(claim.market) !== 0n) === true)
		const directlyClaimable = selected.filter((selectedBond) => availableClaimsFromForkingDisputeCrowdSourcers.deepValue?.some((claim) => selectedBond === claim.bond && BigInt(claim.market) === 0n) === true)
		if (needForking.length + directlyClaimable.length !== selected.length) throw new Error('claim mismatch')
		return await redeemStakeBatch(maybeWriteClient.deepValue, directlyClaimable, needForking, claimForAddress.value)
	}

	const isForkDisputesDisabled = useComputed(() => isAugurExtraUtilitiesDeployedSignal.deepValue !== true)

	useSignalEffect(() => {
		universeForkingInformation.deepValue
		update(maybeReadClient.deepValue).catch(showUnexpectedError)
	})

	const clearData = () => {
		selectedForkedCrowdSourcers.value = []
		availableClaimsFromForkingDisputeCrowdSourcers.deepValue = undefined
	}

	useSignalEffect(() => {
		maybeWriteClient.deepValue
		claimForAddress.value
		clearData()
	})
	const update = async (readClient: ReadClient | undefined ) => {
		if (readClient === undefined) return
		if (universe.deepValue === undefined) return
		if (universeForkingInformation.deepValue === undefined) return

		if (updateDataAbortController !== undefined) updateDataAbortController.abort()
		const abortController = new AbortController()
		updateDataAbortController = abortController
		loading.value = true
		try {
			if (readClient.account?.address !== undefined) {
				reputationBalance.deepValue = await getErc20TokenBalance(readClient, universe.deepValue.reputationTokenAddress, readClient.account.address, abortController)
			} else {
				reputationBalance.deepValue = 0n
			}
			if (isGenesisUniverse(universe.deepValue.universeAddress)) {
				// retrieve v1 balance only for genesis universe as its only relevant there
				parentUniverse.deepValue = undefined
			} else if (universe.deepValue !== undefined) {
				parentUniverse.deepValue = await getUniverseInformation(readClient, await getParentUniverse(readClient, universe.deepValue.universeAddress, abortController), false, abortController)
			}
			if (universeForkingInformation.deepValue?.isForking) {
				const forkingMarket = await fetchMarketData(readClient, universeForkingInformation.deepValue.forkingMarket, abortController)
				forkingMarketData.deepValue = forkingMarket
				const outcomeStakes = getYesNoCategoricalOutcomeNamesAndNumeratorCombinationsForMarket(forkingMarketData.deepValue.marketType, forkingMarketData.deepValue.numOutcomes, forkingMarketData.deepValue.numTicks, forkingMarketData.deepValue.outcomes)
				forkingOutcomeStakes.deepValue = await promiseAllMapAbortSafe(outcomeStakes, async (outcomeStakes) => {
					const childUniverse = await getChildUniverse(readClient, forkingMarket.universe.universeAddress, outcomeStakes.payoutNumerators, forkingMarket.numTicks, forkingMarket.numOutcomes, abortController)
					return {
						...outcomeStakes,
						universe: BigInt(childUniverse) === 0x0n ? undefined : await getUniverseInformation(readClient, childUniverse, false, abortController)
					}
				})

				forkValues.deepValue = await getForkValues(readClient, universe.deepValue.reputationTokenAddress, abortController)
				disputeWindowAddress.deepValue = await getDisputeWindow(readClient, universeForkingInformation.deepValue.forkingMarket, abortController)
				if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
					disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress.deepValue, abortController)
				}
				const winningUniverseAddress = await getWinningChildUniverse(readClient, universe.deepValue.universeAddress, abortController)
				if (winningUniverseAddress !== undefined && BigInt(winningUniverseAddress) !== 0x0n) {
					winningUniverse.deepValue =  await getUniverseInformation(readClient, winningUniverseAddress, false, abortController)
				} else {
					winningUniverse.deepValue = undefined
				}
			}
			repTotalTheoreticalSupply.deepValue = await getReputationTotalTheoreticalSupply(readClient, universe.deepValue.reputationTokenAddress, abortController)
			repSupply.deepValue = await getTotalSupply(readClient, universe.deepValue.reputationTokenAddress, abortController)
		} catch (error: unknown) {
			if (abortController.signal.aborted) return
			throw error
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
	const percentage = useComputed(() => repSupply.deepValue === undefined || repTotalTheoreticalSupply.deepValue === undefined ? undefined : repSupply.deepValue * 10000n / repTotalTheoreticalSupply.deepValue)

	const universeValues = useComputed(() => {
		if (universeForkingInformation.deepValue === undefined || repTotalTheoreticalSupply.deepValue === undefined || repSupply.deepValue === undefined) return <CenteredBigSpinner/>
		return [
			['Universe Address', <EtherScanAddress address = { universeAddress } />],
			...parentUniverse.deepValue === undefined ? [] : [['Parent Universe Address', <OptionalUniverseLink universe = { parentUniverse } pathSignal = { pathSignal }/> ]],
			['Reputation Address For The Universe', <EtherScanAddress address = { reputationTokenAddress } />],
			['Token supply and theoretical supply', <><RoundedDecimalStringWithUnknown value = { repSupply } power = { 18n } maxDecimals = { 2 }/> { getRepTokenName(universe.deepValue?.repTokenName) } / <RoundedDecimalStringWithUnknown value = { repTotalTheoreticalSupply } power = { 18n } maxDecimals = { 2 }/> { getRepTokenName(universe.deepValue?.repTokenName) } (<RoundedDecimalStringWithUnknown value = { percentage } power = { 2n } maxDecimals = { 2 }/>%)</>],
			...universeForkingInformation.deepValue.forkEndTime === undefined ? [] : [['Forking End Time', `${ humanReadableDateDelta(Number(universeForkingInformation.deepValue.forkEndTime - currentTimeInBigIntSeconds.value)) } ( ${ <IsoTimestamp timestamp = { universeForkingInformation.deepValue.forkEndTime }/> })`]],
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
				<p>Please read the market description carefully and migrate your Reputation tokens to the outcome that you believe is the truthfull outcome of this market. Please also check the market against Augur V2 Reporting rules.
				<br/><br/>If you participated in the dispute process, you must claim each crowdsourcer individually. Below is a list of all the crowdsourcers you participated in and can claim.
				</p>
			</span>
		}
		return <span class = 'universe-forking'>
			<h2>The Universe has forked!</h2>
			<p>Reputation token migration period has ended.</p>
		</span>
	})

	const migrateButtonText = useComputed(() => `Migrate ${ reputationToMigrate.deepValue === undefined ? '?' : bigintToRoundedDecimalString(reputationToMigrate.deepValue, 18n, 2) } ${ getRepTokenName(universe.deepValue?.repTokenName) } to the "${ selectedPayoutNumerators.deepValue === undefined || forkingMarketData.deepValue === undefined ? '?' : getOutcomeName(selectedPayoutNumerators.deepValue, forkingMarketData.deepValue) }" universe`)

	const isLoadingDisputeCrowdSourcers = useSignal<boolean>(false)
	const queryAvailableClaimsFromForkingDisputeCrowdSourcers = async () => {
		const readClient = maybeReadClient.deepValue
		if (readClient === undefined) return
		if (claimForAddress.value === undefined) return
		if (universeForkingInformation.deepValue === undefined) return

		if (queryAvailableClaimsAbortController !== undefined) queryAvailableClaimsAbortController.abort()
		const abortController = new AbortController()
		queryAvailableClaimsAbortController = abortController

		selectedForkedCrowdSourcers.value = []
		availableClaimsFromForkingDisputeCrowdSourcers.deepValue = undefined
		isLoadingDisputeCrowdSourcers.value = true
		try {
			if (isAugurExtraUtilitiesDeployedSignal.deepValue !== true) throw new Error('extra utils not deployed')
			const disputesClaims = await getAvailableDisputesFromForkedMarkets(readClient, claimForAddress.value, abortController)
			availableClaimsFromForkingDisputeCrowdSourcers.deepValue = disputesClaims
				.filter((data) => data.universe === universeForkingInformation.deepValue?.universe.universeAddress)
			if (hasForkEnded(universeForkingInformation.deepValue, currentTimeInBigIntSeconds.value)) {
				// if fork has ended, users can claim from forked dispute crowdsourcers only
				availableClaimsFromForkingDisputeCrowdSourcers.deepValue =
					availableClaimsFromForkingDisputeCrowdSourcers.deepValue.filter((data) => BigInt(data.market) === 0x0n )
			}
		} catch (error: unknown) {
			if (abortController.signal.aborted) return
			showUnexpectedError(error)
		} finally {
			isLoadingDisputeCrowdSourcers.value = false
			updateTokenBalancesSignal.value++
		}
	}

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
					style = { { maxWidth: '300px' } }
					value = { reputationToMigrate }
					sanitize = { (amount: string) => amount.trim() }
					tryParse = { parse18DecimalBigintForInput }
					serialize = { serialize18DecimalBigintForInput }
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
	const redeemForStringExtension = useComputed(() => viewingAddress.value === undefined ? '' : ` for ${ viewingAddress.value }`)

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

				<ForkAndRedeemDisputeCrowdSourcers viewingAddress = { viewingAddress } forkingMarketData = { forkingMarketData } isAugurExtraUtilitiesDeployedSignal = { isAugurExtraUtilitiesDeployedSignal } isLoadingDisputeCrowdSourcers = { isLoadingDisputeCrowdSourcers } pathSignal = { pathSignal } availableClaimsFromForkingDisputeCrowdSourcers = { availableClaimsFromForkingDisputeCrowdSourcers } selectedForkedCrowdSourcers = { selectedForkedCrowdSourcers }/>

				<LoadingButton isLoading = { isLoadingDisputeCrowdSourcers } startLoading = { queryAvailableClaimsFromForkingDisputeCrowdSourcers } disabled = { isForkDisputesDisabled } className = 'button loading-button button-secondary'>
					{ availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined ? 'Fetch possible claims' : 'Refresh possible claims' }
				</LoadingButton>
				{ availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined || availableClaimsFromForkingDisputeCrowdSourcers.deepValue.length === 0 ? <></> : <>
					<SendTransactionButton
						className = 'button button-primary'
						transactionStatus = { pendingForkDisputesTransactionStatus }
						sendTransaction = { claimForkDisputes }
						maybeWriteClient = { maybeWriteClient }
						disabled = { claimForkDisputesDisabled }
						text = { useComputed(() => `Redeem ${ selectedForkedCrowdSourcers.value.length } fork disputes${ redeemForStringExtension.value }` )}
						callBackWhenIncluded = { queryAvailableClaimsFromForkingDisputeCrowdSourcers }
					/>
				</> }
			</> : <></> }
		</section>
	</div>
}
