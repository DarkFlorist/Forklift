import { ReadonlySignal, Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { getAvailableDisputes, getAvailableReports, getAvailableShareData, getUniverseForkingInformation } from '../utils/augurContractUtils.js'
import { claimTradingProceedsForMarkets, redeemStakeBatch } from '../utils/augurExtraUtilities.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'
import { MarketLink } from '../SharedUI/links.js'
import { CenteredBigSpinner } from '../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../SharedUI/SendTransactionButton.js'
import { useState } from 'preact/hooks'
import { getRepTokenName } from '../utils/augurUtils.js'
import { LoadingButton } from '../SharedUI/LoadingButton.js'
import { Input } from '../SharedUI/Input.js'
import { parseAddressForInput, serializeAddressForInput } from '../utils/inputParsing.js'
import { filterIfExistsAddOtherwise } from '../utils/utils.js'

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
	loading: ReadonlySignal<boolean>
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
	loading: ReadonlySignal<boolean>
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

interface DisplayReportsDataProps {
	availableReports: OptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>
	selectedReports: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
	loading: ReadonlySignal<boolean>
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
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
}

let queryShareDataAbortController: AbortController | undefined = undefined
let queryDisputesAndreportsAbortController: AbortController | undefined = undefined

export const ClaimFunds = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, pathSignal, showUnexpectedError, universeForkingInformation }: ClaimFundsProps) => {
	const availableShareData = useOptionalSignal<Awaited<ReturnType<typeof getAvailableShareData>>>(undefined)
	const availableDisputes = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>(undefined)
	const availableReports = useOptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>(undefined)

	const loading = useSignal<boolean>(false)

	const selectedShares = useSignal<readonly AccountAddress[]>([])
	const selectedDisputes = useSignal<readonly AccountAddress[]>([])
	const selectedReports = useSignal<readonly AccountAddress[]>([])

	const pendingClaimSharesTransactionStatus = useSignal<TransactionStatus>(undefined)
	const pendingDisputesAndReportsTransactionStatus = useSignal<TransactionStatus>(undefined)

	const claimWinningSharesDisabled = useComputed(() => selectedShares.value.length === 0)
	const participationTokensDisabled = useComputed(() => selectedDisputes.value.length + selectedReports.value.length === 0)

	const viewingAddress = useOptionalSignal<AccountAddress>(undefined)
	const claimForAddress = useComputed(() => viewingAddress.deepValue === undefined ? maybeWriteClient.deepValue?.account.address : viewingAddress.deepValue)

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
		availableShareData.deepValue = undefined
		availableDisputes.deepValue = undefined
		availableReports.deepValue = undefined
	}

	useSignalEffect(() => {
		maybeWriteClient.deepValue
		claimForAddress.value
		clearData()
	})

	const [ConnectedClaim] = useState(() => ({ writeClient }: { writeClient: WriteClient }) => {
		const isLoadingShareData = useSignal<boolean>(false)

		const queryShareData = async () => {
			selectedShares.value = []
			availableShareData.deepValue = undefined
			const readClient = maybeReadClient.deepValue
			if (readClient === undefined) return
			if (claimForAddress.value === undefined) return
			if (queryShareDataAbortController !== undefined) queryShareDataAbortController.abort()
			const abortController = new AbortController()
			queryShareDataAbortController = abortController
			isLoadingShareData.value = true
			try {
				availableShareData.deepValue = (await getAvailableShareData(readClient, claimForAddress.value, abortController))
			} catch(error: unknown) {
				if (abortController.signal.aborted) return
				showUnexpectedError(error)
			} finally {
				isLoadingShareData.value = false
				updateTokenBalancesSignal.value++
			}
		}

		const isLoadingDisputesAndReports = useSignal<boolean>(false)
		const queryDisputesAndReports = async () => {
			const readClient = maybeReadClient.deepValue
			if (readClient === undefined) return
			if (claimForAddress.value === undefined) return

			if (queryDisputesAndreportsAbortController !== undefined) queryDisputesAndreportsAbortController.abort()
			const abortController = new AbortController()
			queryDisputesAndreportsAbortController = abortController
			isLoadingDisputesAndReports.value = true
			selectedDisputes.value = []
			selectedReports.value = []
			availableDisputes.deepValue = undefined
			availableReports.deepValue = undefined
			try {
				availableDisputes.deepValue = (await getAvailableDisputes(readClient, claimForAddress.value, abortController)).filter((data) => data.marketData.universe.universeAddress === universeForkingInformation.deepValue?.universe.universeAddress)
				availableReports.deepValue = (await getAvailableReports(readClient, claimForAddress.value, abortController)).filter((data) => data.marketData.universe.universeAddress === universeForkingInformation.deepValue?.universe.universeAddress)
			} catch(error: unknown) {
				if (abortController.signal.aborted) return
				showUnexpectedError(error)
			} finally {
				isLoadingDisputesAndReports.value = false
				updateTokenBalancesSignal.value++
			}
		}

		const claim = async () => {
			const reportingParticipants = Array.from(selectedReports.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
			const disputeWindows = Array.from(selectedDisputes.value) // Dispute Windows (Participation Tokens) the msg sender has tokens for
			if (reportingParticipants.length === 0 && disputeWindows.length === 0) throw new Error('nothing to claim')
			if (claimForAddress.value === undefined) throw new Error('no claiming for address')
			return await redeemStakeBatch(writeClient, [...reportingParticipants, ...disputeWindows], [], claimForAddress.value)
		}

		const claimWinningShares = async () => {
			if (claimForAddress.value === undefined) throw new Error('no claiming for address')
			return await claimTradingProceedsForMarkets(writeClient, selectedShares.value, claimForAddress.value)
		}

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
						placeholder = 'Claim for a different address (if empty, claim for your address)'
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
