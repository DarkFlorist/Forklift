import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { getAvailableDisputes, getAvailableReports, getAvailableShareData, redeemStake } from '../utils/augurContractUtils.js'
import { forkReportingParticipants, getAvailableDisputesFromForkedMarkets } from '../utils/augurExtraUtilities.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'
import { MarketLink } from '../SharedUI/links.js'
import { CenteredBigSpinner } from '../SharedUI/Spinner.js'

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
}

const DisplayShareData = ({ availableShareData, selectedShares, pathSignal }: DisplayShareDataProps) => {
	const results = useComputed(() => {
		if (availableShareData.deepValue === undefined) return <CenteredBigSpinner/>
		if (availableShareData.deepValue.length == 0) return <ClaimInfo text = 'No claims available'/>
		return availableShareData.deepValue.map((shareEntry) => <>
			<span class = 'claim-option' key = { shareEntry.market }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedShares.value.includes(shareEntry.market) }
					disabled = { shareEntry.payout === 0n }
					onChange = { () => {
						selectedShares.value = filterIfExistsAddOtherwise(selectedShares.value, shareEntry.market)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(shareEntry.market) } pathSignal = { pathSignal }/></b>{ ': ' } `${ bigintToDecimalString(shareEntry.payout, 18n, 2) } DAI`</span>
				</div>
			</span>
		</>)
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem winning shares</h1></span>
			<div class = 'claim-options'>
				{ results }
			</div>
		</div>
	</div>
}

interface DisplayDisputesDataProps {
	availableDisputes: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>
	selectedDisputes: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
}

const DisplayDisputesData = ({ availableDisputes, selectedDisputes, pathSignal }: DisplayDisputesDataProps) => {
	const results = useComputed(() => {
		if (availableDisputes.deepValue === undefined) return <CenteredBigSpinner/>
		if (availableDisputes.deepValue.length == 0) return <ClaimInfo text = 'No claims available'/>
		return availableDisputes.deepValue.map((disputeEntry) => <>
			<span class = 'claim-option' key = { disputeEntry.bond }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedDisputes.value.includes(disputeEntry.market) }
					disabled = { disputeEntry.amount === 0n }
					onChange = { () => {
						selectedDisputes.value = filterIfExistsAddOtherwise(selectedDisputes.value, disputeEntry.bond)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(disputeEntry.market) } pathSignal = { pathSignal }/> { ': ' }</b>
					{ ' -  ' }Bond { disputeEntry.bond }{ ': ' }{ `${ bigintToDecimalString(disputeEntry.amount, 18n, 2) } REP` }</span>
				</div>
			</span>
		</>)
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem Participation Token rewards</h1></span>
			<div class = 'claim-options'>
				{ results }
			</div>
		</div>
	</div>
}

interface ForkAndRedeemDisputeCrowdSourcersProps {
	availableClaimsFromForkingDisputeCrowdSourcers: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>
	selectedForkedCrowdSourcers: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
}

const ForkAndRedeemDisputeCrowdSourcers = ({ availableClaimsFromForkingDisputeCrowdSourcers, selectedForkedCrowdSourcers, pathSignal }: ForkAndRedeemDisputeCrowdSourcersProps) => {
	const results = useComputed(() => {
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined) return <CenteredBigSpinner/>
		if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue.length === 0) return <ClaimInfo text = { 'No claims available' }/>
		return availableClaimsFromForkingDisputeCrowdSourcers.deepValue.map((disputeEntry) => <>
			<span class = 'claim-option' key = { disputeEntry.bond }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedForkedCrowdSourcers.value.includes(disputeEntry.market) }
					disabled = { disputeEntry.amount === 0n }
					onChange = { () => {
						selectedForkedCrowdSourcers.value = filterIfExistsAddOtherwise(selectedForkedCrowdSourcers.value, disputeEntry.bond)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(disputeEntry.market) } pathSignal = { pathSignal }/> { ': ' }</b>
					{ ' -  ' }Bond { disputeEntry.bond }{ ': ' }{ `${ bigintToDecimalString(disputeEntry.amount, 18n, 2) } REP` }</span>
				</div>
			</span>
		</>)
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem forked dispute crowdsourcers</h1></span>
			<div class = 'claim-options'>
				{ results }
			</div>
		</div>
	</div>
}

interface DisplayReportsDataProps {
	availableReports: OptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>
	selectedReports: Signal<readonly AccountAddress[]>
	pathSignal: Signal<string>
}

const DisplayReportsData = ({ availableReports, selectedReports, pathSignal }: DisplayReportsDataProps) => {
	const results = useComputed(() => {
		if (availableReports.deepValue === undefined) return <CenteredBigSpinner/>
		if (availableReports.deepValue.length === 0) return <ClaimInfo text = 'No claims available'/>
		return availableReports.deepValue.map((initialReport) => <>
			<span class = 'claim-option' key = { initialReport.bond }>
				<input
					type = 'checkbox'
					class = 'custom-input'
					name = 'selectedOutcome'
					checked = { selectedReports.value.includes(initialReport.market) }
					disabled = { initialReport.amount === 0n }
					onChange = { () => {
						selectedReports.value = filterIfExistsAddOtherwise(selectedReports.value, initialReport.bond)
					} }
				/>
				<div class = 'claim-info'>
					<span><b>Market <MarketLink address = { new Signal(initialReport.market) } pathSignal = { pathSignal }/> { ': ' }</b>
					{ ' -  ' } Bond { initialReport.bond }{ ': ' }{ `${ bigintToDecimalString(initialReport.amount, 18n, 2) } REP` }</span>
				</div>
			</span>
		</>)
	})

	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem winning initial reporter or dispute crowdsourcer bonds</h1></span>
			<div class = 'claim-options'>
				{ results }
			</div>
		</div>
	</div>
}

interface ClaimFundsProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	updateTokenBalancesSignal: Signal<number>
	pathSignal: Signal<string>
}

export const ClaimFunds = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, pathSignal }: ClaimFundsProps) => {
	const availableShareData = useOptionalSignal<Awaited<ReturnType<typeof getAvailableShareData>>>(undefined)
	const availableDisputes = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>(undefined)
	const availableReports = useOptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>(undefined)
	const availableClaimsFromForkingDisputeCrowdSourcers = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>(undefined)

	const selectedShares = useSignal<readonly AccountAddress[]>([])
	const selectedDisputes = useSignal<readonly AccountAddress[]>([])
	const selectedReports = useSignal<readonly AccountAddress[]>([])
	const selectedForkedCrowdSourcers = useSignal<readonly AccountAddress[]>([])

	useSignalEffect(() => {
		queryForData(maybeReadClient.deepValue).catch(console.error)
	})

	const queryForData = async (readClient: ReadClient | undefined) => {
		if (readClient === undefined) return
		availableShareData.deepValue = undefined
		availableDisputes.deepValue = undefined
		availableReports.deepValue = undefined
		selectedShares.value = []
		selectedDisputes.value = []
		selectedReports.value = []
		if (readClient.account?.address === undefined) throw new Error('account missing')
		availableShareData.deepValue = (await getAvailableShareData(readClient, readClient.account.address)).filter((data) => data.payout > 0n)
		availableDisputes.deepValue = (await getAvailableDisputes(readClient, readClient.account.address)).filter((data) => data.amount > 0n)
		availableReports.deepValue = (await getAvailableReports(readClient, readClient.account.address)).filter((data) => data.amount > 0n)
		availableClaimsFromForkingDisputeCrowdSourcers.deepValue = (await getAvailableDisputesFromForkedMarkets(readClient, readClient.account.address)).filter((data) => data.amount > 0n)
	}

	const claim = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('writeClient missing')
		const reportingParticipants = Array.from(selectedReports.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
		const disputeWindows = Array.from(selectedDisputes.value) // Dispute Windows (Participation Tokens) the msg sender has tokens for
		if (reportingParticipants.length === 0 && disputeWindows.length === 0) return
		await redeemStake(writeClient, reportingParticipants, disputeWindows)
		updateTokenBalancesSignal.value++
		await queryForData(writeClient)
		selectedDisputes.value = []
		selectedReports.value = []
	}
	const claimWinningShares = async () => {
		throw new Error('TODO: not implemented claimin of winning shares')
		/*updateTokenBalancesSignal.value++
		selectedShares.value = []
		await queryForData(writeClient)
		*/
	}
	const claimForkDisputes = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		const selected = Array.from(selectedForkedCrowdSourcers.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
		if (selected.length === 0) return
		await forkReportingParticipants(writeClient, selected)
		updateTokenBalancesSignal.value++
		selectedForkedCrowdSourcers.value = []
		await queryForData(writeClient)
	}

	const claimWinningSharesDisabled = useComputed(() => selectedShares.value.length === 0)
	const participationTokensDisabled = useComputed(() => selectedDisputes.value.length + selectedReports.value.length === 0)
	const claimForkDisputesDisabled = useComputed(() => selectedForkedCrowdSourcers.value.length === 0)

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<div style = 'display: grid; width: 100%; gap: 10px;'>
				<div style = 'display: grid; width: 100%; gap: 10px;'>
					<DisplayShareData pathSignal = { pathSignal } availableShareData = { availableShareData } selectedShares = { selectedShares }/>
					{ availableShareData.deepValue === undefined || availableShareData.deepValue.length == 0 ? <></> : <button class = 'button button-primary' onClick = { claimWinningShares } disabled = { claimWinningSharesDisabled.value }>Redeem Winning shares from { selectedShares.value.length } markets</button> }
					<DisplayDisputesData pathSignal = { pathSignal } availableDisputes = { availableDisputes } selectedDisputes = { selectedDisputes }/>
					<DisplayReportsData pathSignal = { pathSignal } availableReports = { availableReports } selectedReports = { selectedReports }/>
					{ availableDisputes.deepValue === undefined || availableReports.deepValue === undefined || availableDisputes.deepValue.length + availableReports.deepValue.length == 0 ? <></> : <button class = 'button button-primary' onClick = { claim } disabled = { participationTokensDisabled.value }>Redeem { useComputed(() => selectedDisputes.value.length + selectedReports.value.length) } Participation Tokens, winning initial reporter and dispute crowdsourcer bonds</button> }
					<ForkAndRedeemDisputeCrowdSourcers pathSignal = { pathSignal } availableClaimsFromForkingDisputeCrowdSourcers = { availableClaimsFromForkingDisputeCrowdSourcers } selectedForkedCrowdSourcers = { selectedForkedCrowdSourcers }/>
					{ availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined || availableClaimsFromForkingDisputeCrowdSourcers.deepValue.length == 0 ? <></> : <button class = 'button button-primary' onClick = { claimForkDisputes } disabled = { claimForkDisputesDisabled.value }>Redeem { selectedForkedCrowdSourcers.value.length } fork disputes</button> }
				</div>
			</div>
		</section>
	</div>
}
