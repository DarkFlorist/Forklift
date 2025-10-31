import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress } from '../types/types.js'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { getAvailableDisputes, getAvailableReports, getAvailableShareData, redeemStake } from '../utils/augurContractUtils.js'
import { forkReportingParticipants, getAvailableDisputesFromForkedMarkets } from '../utils/augurExtraUtilities.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'


const ClaimInfo = ({ text }: { text: Signal<string | undefined> }) => {
	if (text === undefined) return <></>
	return <div class = 'claim-option'>
		<div class = 'claim-info'>
			<span>
				{ text.value }
			</span>
		</div>
	</div>
}

interface DisplayShareDataProps {
	availableShareData: OptionalSignal<Awaited<ReturnType<typeof getAvailableShareData>>>
	selectedShares: Signal<Set<AccountAddress>>
}

const DisplayShareData = ({ availableShareData, selectedShares }: DisplayShareDataProps) => {
	if (availableShareData.deepValue === undefined) return <></>
	if (availableShareData.deepValue.length === 0) {
		return <div class = 'claim'>
			<div style = 'display: grid'>
				<span><h1>Redeem winning shares</h1></span>
				<div class = 'claim-options'>
					<ClaimInfo text = { useComputed(() => 'No claims available') }/>
				</div>
			</div>
		</div>
	}
	const alreadyClaimed = useComputed(() => {
		const alreadyClaimed = availableShareData.deepValue?.filter((data) => data.payout === 0n ).length || 0
		if (alreadyClaimed === 0) return undefined
		return `Already redeemed ${ alreadyClaimed } markets`
	})
	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem winning shares</h1></span>
			<div class = 'claim-options'>
				<ClaimInfo text = { alreadyClaimed }/>
				{
					availableShareData.deepValue.filter((data) => data.payout > 0n ).map((shareEntry) => <>
					<span class = 'claim-option' key = { shareEntry.market }>
						<input
							type = 'checkbox'
							class = 'custom-input'
							name = 'selectedOutcome'
							checked = { selectedShares.value.has(shareEntry.market) }
							disabled = { shareEntry.payout === 0n }
							onChange = { () => {
								if (selectedShares.value.has(shareEntry.market)) selectedShares.value.delete(shareEntry.market)
								else selectedShares.value.add(shareEntry.market)
							} }
						/>
						<div class = 'claim-info'>
							<span><b>Market { shareEntry.market }</b>{ ': ' } `${ bigintToDecimalString(shareEntry.payout, 18n, 2) } DAI`</span>
						</div>
					</span>
					</>)
				}
			</div>
		</div>
	</div>
}

interface DisplayDisputesDataProps {
	availableDisputes: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>
	selectedDisputes: Signal<Set<AccountAddress>>
}

const DisplayDisputesData = ({ availableDisputes, selectedDisputes }: DisplayDisputesDataProps) => {
	if (availableDisputes.deepValue === undefined) return <></>
	if (availableDisputes.deepValue.length === 0) {
		return <div class = 'claim'>
			<div style = 'display: grid'>
				<span><h1>Redeem Participation Token rewards</h1></span>
				<div class = 'claim-options'>
					<ClaimInfo text = { useComputed(() => 'No claims available') }/>
				</div>
			</div>
		</div>
	}
	const alreadyClaimed = useComputed(() => {
		const alreadyClaimed = availableDisputes.deepValue?.filter((data) => data.amount === 0n ).length || 0
		if (alreadyClaimed === 0) return undefined
		return `Already redeemed ${ alreadyClaimed } markets`
	})
	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem Participation Token rewards</h1></span>
			<div class = 'claim-options'>
				<ClaimInfo text = { alreadyClaimed }/>
				{
					availableDisputes.deepValue.filter((data) => data.amount > 0n).map((disputeEntry) => <>
						<span class = 'claim-option' key = { disputeEntry.bond }>
							<input
								type = 'checkbox'
								class = 'custom-input'
								name = 'selectedOutcome'
								checked = { selectedDisputes.value.has(disputeEntry.bond) }
								disabled = { disputeEntry.amount === 0n }
								onChange = { () => {
									if (selectedDisputes.value.has(disputeEntry.bond)) selectedDisputes.value.delete(disputeEntry.bond)
									else selectedDisputes.value.add(disputeEntry.bond)
								} }
							/>
							<div class = 'claim-info'>
								<span><b>Market { disputeEntry.market }{ ': ' }</b>
								{ ' -  ' }Bond { disputeEntry.bond }{ ': ' }{ `${ bigintToDecimalString(disputeEntry.amount, 18n, 2) } REP` }</span>
							</div>
						</span>
					</>)
				}
			</div>
		</div>
	</div>
}

interface ForkAndRedeemDisputeCrowdSourcersProps {
	availableClaimsFromForkingDisputeCrowdSourcers: OptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>
	selectedForkedCrowdSourcers: Signal<Set<AccountAddress>>
}

const ForkAndRedeemDisputeCrowdSourcers = ({ availableClaimsFromForkingDisputeCrowdSourcers, selectedForkedCrowdSourcers }: ForkAndRedeemDisputeCrowdSourcersProps) => {
	if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue === undefined) return <></>
	if (availableClaimsFromForkingDisputeCrowdSourcers.deepValue.length === 0) {
		return <div class = 'claim'>
			<div style = 'display: grid'>
				<span><h1>Redeem forked dispute crowdsourcers</h1></span>
				<div class = 'claim-options'>
					<ClaimInfo text = { useComputed(() => 'No claims available') }/>
				</div>
			</div>
		</div>
	}
	const alreadyClaimed = useComputed(() => {
		const alreadyClaimed = availableClaimsFromForkingDisputeCrowdSourcers.deepValue?.filter((data) => data.amount === 0n ).length || 0
		if (alreadyClaimed === 0) return undefined
		return `Already redeemed ${ alreadyClaimed } markets`
	})
	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem forked dispute crowdsourcers</h1></span>
			<div class = 'claim-options'>
				<ClaimInfo text = { alreadyClaimed }/>
				{
					availableClaimsFromForkingDisputeCrowdSourcers.deepValue.filter((data) => data.amount > 0n).map((disputeEntry) => <>
						<span class = 'claim-option'  key = { disputeEntry.bond }>
							<input
								type = 'checkbox'
								class = 'custom-input'
								name = 'selectedOutcome'
								checked = { selectedForkedCrowdSourcers.value.has(disputeEntry.bond) }
								disabled = { disputeEntry.amount === 0n }
								onChange = { () => {
									if (selectedForkedCrowdSourcers.value.has(disputeEntry.bond)) selectedForkedCrowdSourcers.value.delete(disputeEntry.bond)
									else selectedForkedCrowdSourcers.value.add(disputeEntry.bond)
								} }
							/>
							<div class = 'claim-info'>
								<span><b>Market { disputeEntry.market }{ ': ' }</b>
								{ ' -  ' }Bond { disputeEntry.bond }{ ': ' }{ `${ bigintToDecimalString(disputeEntry.amount, 18n, 2) } REP` }</span>
							</div>
						</span>
					</>)
				}
			</div>
		</div>
	</div>
}

interface DisplayReportsDataProps {
	availableReports: OptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>
	selectedReports: Signal<Set<AccountAddress>>
}

const DisplayReportsData = ({ availableReports, selectedReports }: DisplayReportsDataProps) => {
	if (availableReports.deepValue === undefined) return <></>
	if (availableReports.deepValue.length === 0) {
		return <div class = 'claim'>
			<div style = 'display: grid'>
				<span><h1>Redeem winning initial reporter or dispute crowdsourcer bonds</h1></span>
				<div class = 'claim-options'>
					<ClaimInfo text = { useComputed(() => 'No claims available') }/>
				</div>
			</div>
		</div>
	}
	const alreadyClaimed = useComputed(() => {
		const alreadyClaimed = availableReports.deepValue?.filter((data) => data.amount === 0n ).length || 0
		if (alreadyClaimed === 0) return undefined
		return `Already redeemed ${ alreadyClaimed } markets`
	})
	return <div class = 'claim'>
		<div style = 'display: grid'>
			<span><h1>Redeem winning initial reporter or dispute crowdsourcer bonds</h1></span>
			<div class = 'claim-options'>
				<ClaimInfo text = { alreadyClaimed }/>
				{
					availableReports.deepValue.filter((data) => data.amount > 0n).map((initialReport) => <>
						<span key = { initialReport.bond }>
							<input
								type = 'radio'
								name = 'selectedOutcome'
								checked = { selectedReports.value.has(initialReport.bond) }
								disabled = { initialReport.amount === 0n }
								onChange = { () => {
									if (selectedReports.value.has(initialReport.bond)) selectedReports.value.delete(initialReport.bond)
									else selectedReports.value.add(initialReport.bond)
								} }
							/>
							<div class = 'claim-info'>
								<span><b>Market { initialReport.market }{ ': ' }</b>
								{ ' -  ' } Bond { initialReport.bond }{ ': ' }{ `${ bigintToDecimalString(initialReport.amount, 18n, 2) } REP` }</span>
							</div>
						</span>
					</>)
				}
			</div>
		</div>
	</div>
}

interface ClaimFundsProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	updateTokenBalancesSignal: Signal<number>
}

export const ClaimFunds = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient }: ClaimFundsProps) => {
	const availableShareData = useOptionalSignal<Awaited<ReturnType<typeof getAvailableShareData>>>(undefined)
	const availableDisputes = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputes>>>(undefined)
	const availableReports = useOptionalSignal<Awaited<ReturnType<typeof getAvailableReports>>>(undefined)
	const availableClaimsFromForkingDisputeCrowdSourcers = useOptionalSignal<Awaited<ReturnType<typeof getAvailableDisputesFromForkedMarkets>>>(undefined)

	const selectedShares = useSignal<Set<AccountAddress>>(new Set([]))
	const selectedDisputes = useSignal<Set<AccountAddress>>(new Set([]))
	const selectedReports = useSignal<Set<AccountAddress>>(new Set([]))
	const selectedForkedCrowdSourcers = useSignal<Set<AccountAddress>>(new Set([]))

	useSignalEffect(() => {
		queryForData(maybeReadClient.deepValue).catch(console.error)
	})

	const queryForData = async (readClient: ReadClient | undefined) => {
		if (readClient === undefined) return
		availableShareData.deepValue = undefined
		availableDisputes.deepValue = undefined
		availableReports.deepValue = undefined
		selectedShares.value = new Set([])
		selectedDisputes.value = new Set([])
		selectedReports.value = new Set([])
		if (readClient.account?.address === undefined) throw new Error('account missing')
		availableShareData.deepValue = await getAvailableShareData(readClient, readClient.account.address)
		availableDisputes.deepValue = await getAvailableDisputes(readClient, readClient.account.address)
		availableReports.deepValue = await getAvailableReports(readClient, readClient.account.address)
		availableClaimsFromForkingDisputeCrowdSourcers.deepValue = await getAvailableDisputesFromForkedMarkets(readClient, readClient.account.address)
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
	}
	const claimWinningShares = async () => {
		throw new Error('TODO: not implemented claimin of winning shares')
	}
	const claimForkDisputes = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		const selected = Array.from(selectedForkedCrowdSourcers.value) // Winning Initial Reporter or Dispute Crowdsourcer bonds the msg sender has stake in
		if (selected.length === 0) return
		await forkReportingParticipants(writeClient, selected)
		updateTokenBalancesSignal.value++
		await queryForData(writeClient)
	}

	const claimWinningSharesDisabled = useComputed(() => selectedShares.value.size == 0)
	const participationTokensDisabled = useComputed(() => selectedDisputes.value.size+selectedReports.value.size == 0)
	const claimForkDisputesDisabled = useComputed(() => selectedForkedCrowdSourcers.value.size == 0)

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<div style = 'display: grid; width: 100%; gap: 10px;'>
				<div style = 'display: grid; width: 100%; gap: 10px;'>
					<DisplayShareData availableShareData = { availableShareData } selectedShares = { selectedShares }/>
					<button class = 'button button-primary' onClick = { claimWinningShares } disabled = { claimWinningSharesDisabled.value }>Redeem Winning shares</button>
					<DisplayDisputesData availableDisputes = { availableDisputes } selectedDisputes = { selectedDisputes }/>
					<DisplayReportsData availableReports = { availableReports } selectedReports = { selectedReports }/>
					<button class = 'button button-primary' onClick = { claim } disabled = { participationTokensDisabled.value }>Redeem Participation Tokens, winning initial reporter and dispute crowdsourcer bonds</button>
					<ForkAndRedeemDisputeCrowdSourcers availableClaimsFromForkingDisputeCrowdSourcers = { availableClaimsFromForkingDisputeCrowdSourcers } selectedForkedCrowdSourcers = { selectedForkedCrowdSourcers }/>
					<button class = 'button button-primary' onClick = { claimForkDisputes } disabled = { claimForkDisputesDisabled.value }>Redeem fork disputes</button>
				</div>
			</div>
		</section>
	</div>
}
