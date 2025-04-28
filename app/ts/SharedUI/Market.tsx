import { useEffect, useState } from 'preact/hooks'
import { ExtraInfo } from '../CreateMarketUI/types/createMarketTypes.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { fetchHotLoadingMarketData, getDisputeWindowInfo, getForkValues, getLastCompletedCrowdSourcer } from '../utils/augurContractUtils.js'
import { getOutComeName, getUniverseName } from '../utils/augurUtils.js'
import { assertNever } from '../utils/errorHandling.js'
import { bigintToDecimalString, formatUnixTimestampISO } from '../utils/ethereumUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { bigintSecondsToDate, humanReadableDateDelta, humanReadableDateDeltaFromTo } from '../utils/utils.js'
import { JSX } from 'preact/jsx-runtime'
import { useComputed } from '@preact/signals'
import { SomeTimeAgo } from '../ReportingUI/components/SomeTimeAgo.js'

export type MarketData = {
	marketAddress: `0x${ string }`
	parsedExtraInfo: ExtraInfo | undefined
	hotLoadingMarketData: Awaited<ReturnType<typeof fetchHotLoadingMarketData>>
}

interface DisplayExtraInfoProps {
	marketData: OptionalSignal<MarketData>
}

export const DisplayExtraInfo = ({ marketData }: DisplayExtraInfoProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.parsedExtraInfo === undefined) {
		return <>
			<span>ERROR! Failed to parse Extra data, this market is likely invalid. Unparsed extra data:</span>
			<span>{ marketData.deepValue.hotLoadingMarketData.extraInfo }</span>
		</>
	}
	return <>
		<span>{ marketData.deepValue.parsedExtraInfo.longDescription }</span>
	</>
}

interface MarketStateProps {
	marketData: OptionalSignal<MarketData>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
}

export const MarketState = ({ marketData, lastCompletedCrowdSourcer, forkValues }: MarketStateProps) => {
	const data = marketData.deepValue?.hotLoadingMarketData
	if (data === undefined) return ''
	const state = data.reportingState

	const isSlowReporting = useComputed(() => lastCompletedCrowdSourcer.deepValue !== undefined
		&& forkValues.deepValue !== undefined
		&& lastCompletedCrowdSourcer.deepValue.size >= forkValues.deepValue.disputeThresholdForDisputePacing
	)

	switch(state) {
		case 'AwaitingFinalization': return 'Awaiting For Finalization'
		case 'AwaitingForkMigration': return 'Awaiting For Fork Migration'
		case 'AwaitingNextWindow': return `Disputing Round: ${ data.disputeRound }: Awaiting For Next The Reporting Window`
		case 'CrowdsourcingDispute': {
			if (isSlowReporting.value) return <>Disputing Slow Round: { data.disputeRound }</>
			return <>Disputing Speed Round: { data.disputeRound }</>
		}
		case 'DesignatedReporting': return 'Awaiting For Designated Reporter To Report'
		case 'Finalized': {
			if (marketData.deepValue === undefined) return 'Finalized'
			const winningPayout = marketData.deepValue.hotLoadingMarketData.winningPayout
			const winningOptionName = getOutComeName(winningPayout, marketData.deepValue)
			if (winningOptionName === undefined) return 'Finalized'
			return `Finalized as ${ winningOptionName }`
		}
		case 'Forking': return 'Forking'
		case 'OpenReporting': return 'Awaiting For Anyone To Report'
		case 'PreReporting': return 'Reporting Not Started'
		default: assertNever(state)
	}
}

interface MarketProps {
	marketData: OptionalSignal<MarketData>
	universe: OptionalSignal<AccountAddress>
	repBond: OptionalSignal<EthereumQuantity>
	addressComponent?: JSX.Element
	children?: preact.ComponentChildren
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
}

const Countdown = ({ end }: { end: bigint }) => {
	const [timeLeft, setTimeLeft] = useState('')

	useEffect(() => {
		const timer = setInterval(() => {
			if (bigintSecondsToDate(end).getTime() - Date.now() <= 0) {
				setTimeLeft('The Market Has Ended')
				clearInterval(timer)
				return
			}
			setTimeLeft(humanReadableDateDeltaFromTo(new Date(), bigintSecondsToDate(end)))
		}, 1000)
		return () => clearInterval(timer)
	}, [ end ])

	return <span className='countdown'>{ timeLeft }</span>
}

interface ResolvingToProps {
	marketData: OptionalSignal<MarketData>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
}

const ResolvingTo = ({ disputeWindowInfo, marketData, lastCompletedCrowdSourcer, forkValues}: ResolvingToProps) => {
	const isSlowReporting = useComputed(() => lastCompletedCrowdSourcer.deepValue !== undefined
		&& forkValues.deepValue !== undefined
		&& lastCompletedCrowdSourcer.deepValue.size >= forkValues.deepValue.disputeThresholdForDisputePacing
	)
	if (disputeWindowInfo.deepValue === undefined) return <></>
	if (marketData.deepValue === undefined) return <></>
	const winningPayout = marketData.deepValue?.hotLoadingMarketData.winningPayout.length === 0 ? lastCompletedCrowdSourcer.deepValue?.payoutNumerators : marketData.deepValue?.hotLoadingMarketData.winningPayout
	if (winningPayout === undefined) return <></>
	const winningOptionName = getOutComeName(winningPayout, marketData.deepValue)
	if (winningOptionName === undefined) return <></>
	const endDate = bigintSecondsToDate(disputeWindowInfo.deepValue.endTime)
	return <SomeTimeAgo priorTimestamp = { endDate } countBackwards = { true } diffToText = {
		(time: number) => {
			if (time <= 0) return <p>The market has resolved to "<b>{ winningOptionName }</b>"</p>
			if (disputeWindowInfo.deepValue === undefined) return <></>
			if (disputeWindowInfo.deepValue.isActive || !isSlowReporting.value) return <div class = 'warning-box'> <p>
				Resolving To "<b>{ winningOptionName }</b>" if not disputed in { humanReadableDateDelta(time) } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.endTime) })
			</p> </div>
			const timeUntilNext = humanReadableDateDeltaFromTo(new Date(), bigintSecondsToDate(disputeWindowInfo.deepValue.startTime))
			const nextWindowLength = humanReadableDateDeltaFromTo(bigintSecondsToDate(disputeWindowInfo.deepValue.startTime), bigintSecondsToDate(disputeWindowInfo.deepValue.endTime))
			return <div class = 'warning-box'> <p>
				Resolving To "<b>{ winningOptionName }</b>" if not disputed in the next dispute round. Next round starts in { timeUntilNext } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.startTime) } and lasts { nextWindowLength })
			</p> </div>
		}
	}/>
}

export const Market = ({ marketData, universe, repBond, addressComponent, children, lastCompletedCrowdSourcer, forkValues, disputeWindowInfo }: MarketProps) => {
	if (marketData.deepValue === undefined || repBond.deepValue === undefined) return <div>
		<div className = 'market-card'>
			{ addressComponent }
		</div>
	</div>
	return <div>
		{ universe.deepValue !== undefined && BigInt(universe.deepValue) !== BigInt(marketData.deepValue.hotLoadingMarketData.universe) ? <>
			<div class = 'error-box'>
				<p> This Market is for universe { getUniverseName(marketData.deepValue.hotLoadingMarketData.universe) } while you are on universe { getUniverseName(universe.deepValue) }!</p>
			</div>
		</> : <></> }

		<div className = 'market-card'>
			{ addressComponent }
			{ marketData.deepValue.hotLoadingMarketData.reportingState !== 'CrowdsourcingDispute' ? <></> : <>
				<ResolvingTo marketData = { marketData } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo }/>
			</> }
			<header className = 'market-header'>
				<h1>{ marketData.deepValue.parsedExtraInfo?.description || marketData.deepValue.marketAddress }</h1>
				<div className = 'status-bar'>
					<span className = 'state'>{ <MarketState marketData = { marketData } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer } forkValues = { forkValues } /> }</span>
					<Countdown end = { marketData.deepValue.hotLoadingMarketData.endTime } />
				</div>
				<div style = { { display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' } }>
					<div>
						<span>{ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.openInterest, 18n, 2) } DAI Open Interest</span>
					</div>
					<div>
						{ formatUnixTimestampISO(marketData.deepValue.hotLoadingMarketData.endTime) }
					</div>
				</div>
			</header>

			<section className = 'description'>
				<DisplayExtraInfo marketData = { marketData } />
			</section>

			<section className = 'details-grid'>
				{ [
					['Owner', marketData.deepValue.hotLoadingMarketData.owner],
					['Market Creator', marketData.deepValue.hotLoadingMarketData.marketCreator],
					['Designated Reporter', marketData.deepValue.hotLoadingMarketData.designatedReporter],

					['Fee', marketData.deepValue.hotLoadingMarketData.feeDivisor === 0n ? '0.00%' : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.feeDivisor)).toFixed(2) }%` ],
					['Reporting Fee', marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor === 0n ? '0.00%' : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.reportingFeeDivisor)).toFixed(2) }%` ],
					['Affiliate Fee', marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor === 0n ? '0.00%' : `${ (100 / Number(marketData.deepValue.hotLoadingMarketData.affiliateFeeDivisor)).toFixed(2) }%` ],

					['Validity Bond', `${ bigintToDecimalString(marketData.deepValue.hotLoadingMarketData.validityBond, 18n, 2) } DAI`],
					['Rep Bond', `${ bigintToDecimalString(repBond.deepValue, 18n, 2) } REP `],

					['Categories', (marketData.deepValue.parsedExtraInfo?.categories || []).join(', ')],
					['Tags', (marketData.deepValue.parsedExtraInfo?.tags || []).join(', ')],
				].map(([label, val]) => (
					<div className = 'detail' key = { label }>
						<strong>{ label }</strong>
						<span>{ val }</span>
					</div>
				)) }
			</section>
			{ children }
		</div>
	</div>
}
