import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { getAvailableDisputes, getAvailableReports, getAvailableShareData, getUniverseForkingInformation, redeemStake } from '../utils/augurContractUtils.js'
import { claimMarketWinnings, forkReportingParticipants, getAvailableDisputesFromForkedMarkets } from '../utils/augurExtraUtilities.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'
import { MarketLink } from '../SharedUI/links.js'
import { CenteredBigSpinner } from '../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../SharedUI/SendTransactionButton.js'
import { useState } from 'preact/hooks'
import { getOutcomeName, getRepTokenName, hasForkEnded } from '../utils/augurUtils.js'
import { LoadingButton } from '../SharedUI/LoadingButton.js'
import { Input } from '../SharedUI/Input.js'
import { parseAddressForInput, serializeAddressForInput } from '../utils/inputParsing.js'

const filterIfExistsAddOtherwise = (array: readonly AccountAddress[], newEntry: AccountAddress) => {
	if (array.find((entry) => entry === newEntry)) {
		return array.filter(((entry) => entry !== newEntry))
	} else {
		return [...array, newEntry]
	}
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

interface DisplayShareDataProps {
	availableShareData: OptionalSignal<Awaited<ReturnType<typeof getAvailableShareData>>>
	selectedShares: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
	loading: Signal<boolean>
}

const DisplayShareData = ({ availableShareData, selectedShares, pathSignal, loading }: DisplayShareDataProps) => {
	const results = useComputed(() => {
		if (availableShareData.deepValue === undefined) return loading.value ? <CenteredBigSpinner/> : <></>
		if (availableShareData.deepValue.length == 0) return <ClaimInfo text = 'No claims available'/>
		return availableShareData.deepValue.map((shareEntry) => {
			return <span class = 'claim-option' key = { shareEntry.market }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedShares.value.includes(shareEntry.market) }
					onChange = { () => {
						selectedShares.value = filterIfExistsAddOtherwise(selectedShares.value, shareEntry.market)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(shareEntry.market) } pathSignal = { pathSignal }/></b>{ ': ' } `${ bigintToDecimalString(shareEntry.payout, 18n, 2) } DAI`</span>
				</div>
			</span>
		})
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem winning shares</h1></span>
			<div class = 'claim-options'>
				{ results.value }
			</div>
		</div>
	</div>
}

interface DisplayDisputesDataProps {
	availableDisputes: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>
	selectedDisputes: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
	loading: Signal<boolean>
}

const DisplayDisputesData = ({ availableDisputes, selectedDisputes, pathSignal, loading }: DisplayDisputesDataProps) => {
	const results = useComputed(() => {
		if (availableDisputes.deepValue === undefined) return loading.value ? <CenteredBigSpinner/> : <></>
		if (availableDisputes.deepValue.length == 0) return <ClaimInfo text = 'No claims available'/>
		return availableDisputes.deepValue.map((disputeEntry) => {
			return <span class = 'claim-option' key = { disputeEntry.bond }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedDisputes.value.includes(disputeEntry.bond) }
					onChange = { () => {
						selectedDisputes.value = filterIfExistsAddOtherwise(selectedDisputes.value, disputeEntry.bond)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(disputeEntry.market) } pathSignal = { pathSignal }/> { ': ' }</b>
					{ ' -  ' }Bond { disputeEntry.bond }{ ': ' }{ `${ bigintToDecimalString(disputeEntry.amount, 18n, 2) } ${ getRepTokenName(disputeEntry.marketData.universe.repTokenName) }` }</span>
				</div>
			</span>
		})
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem Participation Token rewards</h1></span>
			<div class = 'claim-options'>
				{ results.value }
			</div>
		</div>
	</div>
}

interface ForkAndRedeemDisputeCrowdSourcersProps {
	availableClaimsFromForkingDisputeCrowdSourcers: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>
	isAugurExtraUtilitiesDeployedSignal: OptionalSignal<boolean>
	selectedForkedCrowdSourcers: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
	loading: Signal<boolean>
}

const ForkAndRedeemDisputeCrowdSourcers = ({ isAugurExtraUtilitiesDeployedSignal, availableClaimsFromForkingDisputeCrowdSourcers, selectedForkedCrowdSourcers, pathSignal, loading }: ForkAndRedeemDisputeCrowdSourcersProps) => {
	const results = useComputed(() => {
		if (isAugurExtraUtilitiesDeployedSignal.deepValue === false) return <ClaimInfo text = 'Deploy extra utils to see...'/>
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined) return loading.value ? <CenteredBigSpinner/> : <></>
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue.length === 0) return <ClaimInfo text = { 'No claims available' }/>
		return availableClaimsFromForkingDisputeCrowdSourcers.deepValue.map((disputeEntry) => {
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
					<div><b>Market <MarketLink address = { new Signal(disputeEntry.market) } pathSignal = { pathSignal }/></b></div>
					<div>{ `Migrate ${ bigintToDecimalString(disputeEntry.amount, 18n, 2) } ${ getRepTokenName(disputeEntry.marketData.universe.repTokenName) } to ${ getOutcomeName(disputeEntry.payoutNumerators, disputeEntry.marketData) }` }</div>
				</div>
			</span>
		})
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem forked dispute crowdsourcers</h1></span>
			<div class = 'claim-options'>
				{ results.value }
			</div>
		</div>
	</div>
}

interface DisplayReportsDataProps {
	availableReports: OptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>
	selectedReports: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
	loading: Signal<boolean>
}

const DisplayReportsData = ({ availableReports, selectedReports, pathSignal, loading }: DisplayReportsDataProps) => {
	const results = useComputed(() => {
		if (availableReports.deepValue === undefined) return loading.value ? <CenteredBigSpinner/> : <></>
		if (availableReports.deepValue.length === 0) return <ClaimInfo text = 'No claims available'/>
		return availableReports.deepValue.map((initialReport) => {
			return <span class = 'claim-option' key = { initialReport.bond }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedReports.value.includes(initialReport.bond) }
					onChange = { () => {
						selectedReports.value = filterIfExistsAddOtherwise(selectedReports.value, initialReport.bond)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(initialReport.market) } pathSignal = { pathSignal }/> { ': ' }</b>
					{ ' -  ' } Bond { initialReport.bond }{ ': ' }{ `${ bigintToDecimalString(initialReport.amount, 18n, 2) } ${ getRepTokenName(initialReport.marketData.universe.repTokenName)} ` }</span>
				</div>
			</span>
		})
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem winning initial reporter or dispute crowdsourcer bonds</h1></span>
			<div class = 'claim-options'>
				{ results.value }
			</div>
		</div>
	</div>
}

interface ClaimFundsProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	updateTokenBalancesSignal: Signal<number>
	pathSignal: Signal<string>
	showUnexpectedError: (error: unknown) => void
	isAugurExtraUtilitiesDeployedSignal: OptionalSignal<boolean>
	currentTimeInBigIntSeconds: Signal<bigint>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
}

export const ClaimFunds = ({ currentTimeInBigIntSeconds, isAugurExtraUtilitiesDeployedSignal, updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, pathSignal, showUnexpectedError, universeForkingInformation }: ClaimFundsProps) => {
	const availableShareData = useOptionalSignal<Awaited<ReturnType<typeof getAvailableShareData>>>(undefined)
	const availableDisputes = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>(undefined)
	const availableReports = useOptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>(undefined)
	const availableClaimsFromForkingDisputeCrowdSourcers = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>(undefined)

	const loading = useSignal<boolean>(false)

	const selectedShares = useSignal<readonly AccountAddress[]>([])
	const selectedDisputes = useSignal<readonly AccountAddress[]>([])
	const selectedReports = useSignal<readonly AccountAddress[]>([])
	const selectedForkedCrowdSourcers = useSignal<readonly AccountAddress[]>([])

	const pendingClaimSharesTransactionStatus = useSignal<TransactionStatus>(undefined)
	const pendingDisputesAndReportsTransactionStatus = useSignal<TransactionStatus>(undefined)
	const pendingForkDisputesTransactionStatus = useSignal<TransactionStatus>(undefined)

	const claimWinningSharesDisabled = useComputed(() => selectedShares.value.length === 0)
	const participationTokensDisabled = useComputed(() => selectedDisputes.value.length + selectedReports.value.length === 0)
	const claimForkDisputesDisabled = useComputed(() => selectedForkedCrowdSourcers.value.length === 0 || isAugurExtraUtilitiesDeployedSignal.deepValue !== true)

	const viewingAddress = useOptionalSignal<AccountAddress>(undefined)
	const currentViewingAddress = useComputed(() => viewingAddress.deepValue === undefined ? maybeWriteClient.deepValue?.account.address : viewingAddress.deepValue)

	const [DisconnectedClaim] = useState(() => () => {
		return <div class = 'subApplication'>
			<section class = 'subApplication-card'>
				<p> Connect your wallet to see possible claims</p>
			</section>
		</div>
	})

	const clearData = () => {
		selectedShares.value = []
		selectedDisputes.value = []
		selectedReports.value = []
		selectedForkedCrowdSourcers.value = []
		availableShareData.deepValue = undefined
		availableDisputes.deepValue = undefined
		availableReports.deepValue = undefined
		availableClaimsFromForkingDisputeCrowdSourcers.deepValue = undefined
	}

	useSignalEffect(() => {
		maybeWriteClient.deepValue
		currentViewingAddress.value
		clearData()
	})

	const [ConnectedClaim] = useState(() => ({ writeClient }: { writeClient: WriteClient }) => {
		const isLoadingShareData = useSignal<boolean>(false)

		const queryShareData = async () => {
			selectedShares.value = []
			availableShareData.deepValue = undefined
			const readClient = maybeReadClient.deepValue
			if (readClient === undefined) return
			if (currentViewingAddress.value === undefined) return
			isLoadingShareData.value = true
			try {
				availableShareData.deepValue = (await getAvailableShareData(readClient, currentViewingAddress.value))
			} catch(error: unknown) {
				showUnexpectedError(error)
			} finally {
				isLoadingShareData.value = false
				updateTokenBalancesSignal.value++
			}
		}

		const isLoadingDisputesAndReports = useSignal<boolean>(false)
		const queryDisputesAndReports = async () => {
			const readClient = maybeReadClient.deepValue
			selectedDisputes.value = []
			selectedReports.value = []
			availableDisputes.deepValue = undefined
			availableReports.deepValue = undefined
			if (readClient === undefined) return
			if (currentViewingAddress.value === undefined) return
			isLoadingDisputesAndReports.value = true
			try {
				availableDisputes.deepValue = (await getAvailableDisputes(readClient, currentViewingAddress.value)).filter((data) => data.marketData.universe.universeAddress === universeForkingInformation.deepValue?.universe.universeAddress)
				availableReports.deepValue = (await getAvailableReports(readClient, currentViewingAddress.value)).filter((data) => data.marketData.universe.universeAddress === universeForkingInformation.deepValue?.universe.universeAddress)
			} catch(error: unknown) {
				showUnexpectedError(error)
			} finally {
				isLoadingDisputesAndReports.value = false
				updateTokenBalancesSignal.value++
			}
		}

		const isLoadingDisputeCrowdSourcers = useSignal<boolean>(false)
		const queryAvailableClaimsFromForkingDisputeCrowdSourcers = async () => {
			const readClient = maybeReadClient.deepValue
			isLoadingDisputeCrowdSourcers.value = true
			selectedForkedCrowdSourcers.value = []
			availableClaimsFromForkingDisputeCrowdSourcers.deepValue = undefined
			if (readClient === undefined) return
			if (currentViewingAddress.value === undefined) return
			if (universeForkingInformation.deepValue === undefined) return
			try {
				if (isAugurExtraUtilitiesDeployedSignal.deepValue !== true) throw new Error('extra utils not deployed')
				if (hasForkEnded(universeForkingInformation.deepValue, currentTimeInBigIntSeconds.value)) return
				const disputesClaims = await getAvailableDisputesFromForkedMarkets(readClient, currentViewingAddress.value)
				availableClaimsFromForkingDisputeCrowdSourcers.deepValue = disputesClaims
					.filter((data) => data.marketData.universe.universeAddress === universeForkingInformation.deepValue?.universe.universeAddress)
			} catch(error: unknown) {
				showUnexpectedError(error)
			} finally {
				isLoadingDisputeCrowdSourcers.value = false
				updateTokenBalancesSignal.value++
			}
		}

		const claim = async () => {
			const reportingParticipants = Array.from(selectedReports.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
			const disputeWindows = Array.from(selectedDisputes.value) // Dispute Windows (Participation Tokens) the msg sender has tokens for
			if (reportingParticipants.length === 0 && disputeWindows.length === 0) throw new Error('nothing to claim')
			return await redeemStake(writeClient, reportingParticipants, disputeWindows)
		}

		const claimWinningShares = async () => await claimMarketWinnings(writeClient, selectedShares.value)

		const claimForkDisputes = async () => {
			if (isAugurExtraUtilitiesDeployedSignal.deepValue !== true) throw new Error('extra utils not deployed')
			const selected = Array.from(selectedForkedCrowdSourcers.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
			if (selected.length === 0) throw new Error('nothing to claim')
			return await forkReportingParticipants(writeClient, selected)
		}

		const isForkDisputesDisabled = useComputed(() => isAugurExtraUtilitiesDeployedSignal.deepValue !== true)

		const redeemForStringExtension = useComputed(() => viewingAddress.value === undefined ? '' : ` for ${ viewingAddress.value }`)

		return <div class = 'subApplication'>
			<section class = 'subApplication-card'>
				<div style = 'display: grid; width: 100%; gap: 10px;'>
					<Input
						style = 'height: fit-content;'
						key = 'market-reporting-input'
						class = 'input'
						type = 'text'
						width = '100%'
						placeholder = 'Claim for a different address (if empty, claiming for your address)'
						value = { viewingAddress }
						sanitize = { (addressString: string) => addressString }
						tryParse = { parseAddressForInput }
						serialize = { serializeAddressForInput }
					/>
					<div style = 'display: grid; width: 100%; gap: 10px;'>
						<DisplayShareData loading = { loading } pathSignal = { pathSignal } availableShareData = { availableShareData } selectedShares = { selectedShares }/>
						<LoadingButton isLoading = { isLoadingShareData } startLoading = { queryShareData } disabled = { useSignal(false) } className = 'button loading-button button-secondary'>
							{ availableShareData.deepValue === undefined ? 'Fetch possible claims' : 'Refresh possible claims' }
						</LoadingButton>
						{ availableShareData.deepValue === undefined || availableShareData.deepValue.length == 0 ? <></> : <>
							<SendTransactionButton
								className = 'button button-primary'
								transactionStatus = { pendingClaimSharesTransactionStatus }
								sendTransaction = { claimWinningShares }
								maybeWriteClient = { maybeWriteClient }
								disabled = { claimWinningSharesDisabled }
								text = { useComputed(() => `Redeem Winning shares from ${ selectedShares.value.length } markets${ redeemForStringExtension.value }`) }
								callBackWhenIncluded = { queryShareData }
							/>
						</> }
						<DisplayDisputesData loading = { loading } pathSignal = { pathSignal } availableDisputes = { availableDisputes } selectedDisputes = { selectedDisputes }/>
						<DisplayReportsData loading = { loading } pathSignal = { pathSignal } availableReports = { availableReports } selectedReports = { selectedReports }/>
						<LoadingButton isLoading = { isLoadingDisputesAndReports } startLoading = { queryDisputesAndReports } disabled = { useComputed(() => false) } className = 'button loading-button button-secondary'>
							{ availableDisputes.deepValue === undefined || availableReports.deepValue === undefined ? 'Fetch possible claims' : 'Refresh possible claims' }
						</LoadingButton>
						{ availableDisputes.deepValue === undefined || availableReports.deepValue === undefined || availableDisputes.deepValue.length + availableReports.deepValue.length === 0 ? <></> : <>
							<SendTransactionButton
								className = 'button button-primary'
								transactionStatus = { pendingDisputesAndReportsTransactionStatus }
								sendTransaction = { claim }
								maybeWriteClient = { maybeWriteClient }
								disabled = { participationTokensDisabled }
								text = { useComputed(() => `Redeem ${ selectedDisputes.value.length + selectedReports.value.length } Participation Tokens, winning initial reporter or dispute crowdsourcer bonds${ redeemForStringExtension.value }` )}
								callBackWhenIncluded = { queryDisputesAndReports }
							/>
						</> }
						<ForkAndRedeemDisputeCrowdSourcers isAugurExtraUtilitiesDeployedSignal = { isAugurExtraUtilitiesDeployedSignal } loading = { loading } pathSignal = { pathSignal } availableClaimsFromForkingDisputeCrowdSourcers = { availableClaimsFromForkingDisputeCrowdSourcers } selectedForkedCrowdSourcers = { selectedForkedCrowdSourcers }/>

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
					</div>
				</div>
			</section>
		</div>
	})

	const writeClient = maybeWriteClient.deepValue
	if (writeClient === undefined) {
		return <DisconnectedClaim/>
	} else {
		return <ConnectedClaim writeClient = { writeClient }/>
	}
}
