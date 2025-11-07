import { useEffect, useState } from 'preact/hooks'
import { AccountAddress } from '../types/types.js'
import { fetchMarketData, getDisputeWindowInfo, getForkValues } from '../utils/augurContractUtils.js'
import { getOutcomeName, getTradeInterval, getUniverseName, getYesNoCategoricalOutcomeName } from '../utils/augurUtils.js'
import { assertNever } from '../utils/errorHandling.js'
import { bigintToDecimalString, formatUnixTimestampIso } from '../utils/ethereumUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { bigintSecondsToDate, humanReadableDateDelta, humanReadableDateDeltaFromTo } from '../utils/utils.js'
import { JSX } from 'preact/jsx-runtime'
import { Signal, useComputed } from '@preact/signals'
import { SomeTimeAgo } from '../ReportingUI/components/SomeTimeAgo.js'
import { EtherScanAddress } from './links.js'

export type MarketData = Awaited<ReturnType<typeof fetchMarketData>>

interface DisplayExtraInfoProps {
	marketData: OptionalSignal<MarketData>
}

export const DisplayExtraInfo = ({ marketData }: DisplayExtraInfoProps) => {
	if (marketData.deepValue === undefined) return <></>
	if (marketData.deepValue.parsedExtraInfo === undefined) {
		return <>
			<span>ERROR! Failed to parse Extra data, this market is likely invalid. Unparsed extra data:</span>
			<span>{ marketData.deepValue.extraInfo }</span>
		</>
	}
	return <>
		<span>{ marketData.deepValue.parsedExtraInfo.longDescription }</span>
	</>
}

interface MarketOutcomesProps {
	marketData: OptionalSignal<MarketData>
}

export const MarketOutcomes = ({ marketData }: MarketOutcomesProps) => {
	if (marketData.deepValue === undefined) return <></>
	switch(marketData.deepValue.marketType) {
		case 'Yes/No':
		case 'Categorical': {
			const marketType = marketData.deepValue.marketType
			const outcomes = marketData.deepValue.outcomes
			const outcomeNames = Array.from({ length: Number(marketData.deepValue.numOutcomes) }).map((_, index) => getYesNoCategoricalOutcomeName(index, marketType, outcomes))
			return <>
				<strong>{ marketData.deepValue.marketType } Market</strong>
				<ul>
					{ outcomeNames.map((outcome) => <li key = { outcome }>{ outcome }</li>) }
				</ul>
			</>
		}
		case 'Scalar': {
			const minValue = marketData.deepValue.displayPrices[0] || 0n
			const maxValue = marketData.deepValue.displayPrices[1] || 0n
			const tradeInterval = getTradeInterval(maxValue - minValue, marketData.deepValue.numTicks)
			const unit = marketData.deepValue?.parsedExtraInfo?._scalarDenomination || 'unknown'

			return <>
				<strong>Scalar market</strong>
				A value between { bigintToDecimalString(minValue, 18n) } and { bigintToDecimalString(maxValue, 18n) }
				<br />
				Increment: { bigintToDecimalString(tradeInterval, 18n) }
				<br />
				Unit: "{ unit }"
			</>
		}
	}
}

interface MarketStateProps {
	marketData: OptionalSignal<MarketData>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
}

export const MarketState = ({ marketData, forkValues }: MarketStateProps) => {
	const data = marketData.deepValue
	if (data === undefined) return ''
	const state = data.reportingState

	const isSlowReporting = useComputed(() => marketData.deepValue?.lastCompletedCrowdSourcer !== undefined
		&& forkValues.deepValue !== undefined
		&& marketData.deepValue.lastCompletedCrowdSourcer.size >= forkValues.deepValue.disputeThresholdForDisputePacing
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
			const winningPayout = marketData.deepValue.winningPayout
			const winningOptionName = getOutcomeName(winningPayout, marketData.deepValue)
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
	addressComponent?: JSX.Element
	children?: preact.ComponentChildren
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
	currentTimeInBigIntSeconds: Signal<bigint>
	repTokenName: Signal<string>
}

const Countdown = ({ end, currentTimeInBigIntSeconds }: { end: Signal<bigint | undefined>, currentTimeInBigIntSeconds: Signal<bigint> }) => {
	const [timeLeft, setTimeLeft] = useState('')
	useEffect(() => {
		const timer = setInterval(() => {
			if (end.value === undefined) return
			if (bigintSecondsToDate(end.value).getTime() - Date.now() <= 0) {
				setTimeLeft('The Market Has Ended')
				clearInterval(timer)
				return
			}
			setTimeLeft(humanReadableDateDeltaFromTo(currentTimeInBigIntSeconds.value, end.value))
		}, 1000)
		return () => clearInterval(timer)
	}, [end, currentTimeInBigIntSeconds])

	return <span className = 'countdown'>Ends in: { timeLeft }</span>
}

interface ResolvingToProps {
	marketData: OptionalSignal<MarketData>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
	currentTimeInBigIntSeconds: Signal<bigint>
}

const ResolvingTo = ({ disputeWindowInfo, marketData, forkValues, currentTimeInBigIntSeconds }: ResolvingToProps) => {
	const isSlowReporting = useComputed(() => marketData.deepValue?.lastCompletedCrowdSourcer !== undefined
		&& forkValues.deepValue !== undefined
		&& marketData.deepValue?.lastCompletedCrowdSourcer.size >= forkValues.deepValue.disputeThresholdForDisputePacing
	)
	const winningOptionName = useComputed(() => {
		const winningPayout = marketData.deepValue?.winningPayout.length === 0 ? marketData.deepValue.lastCompletedCrowdSourcer?.payoutNumerators : marketData.deepValue?.winningPayout
		if (winningPayout === undefined) return undefined
		if (winningOptionName === undefined) return undefined
		if (marketData.deepValue === undefined) return undefined
		return getOutcomeName(winningPayout, marketData.deepValue)
	})
	const endDate = useComputed(() => {
		if (disputeWindowInfo.deepValue === undefined) return undefined
		return bigintSecondsToDate(disputeWindowInfo.deepValue.endTime)
	})
	if (endDate.value === undefined) return <></>
	if (winningOptionName.value === undefined) return <></>
	return <SomeTimeAgo priorTimestamp = { endDate.value } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds } countBackwards = { true } diffToText = {
		(time: number) => {
			if (time <= 0) return <p>The market has resolved to "<b>{ winningOptionName.value }</b>"</p>
			if (disputeWindowInfo.deepValue === undefined) return <></>
			if (disputeWindowInfo.deepValue.isActive || !isSlowReporting.value) return <div class = 'warning-box'> <p>
				Resolving To "<b>{ winningOptionName.value }</b>" if not disputed in { humanReadableDateDelta(time) } ({ formatUnixTimestampIso(disputeWindowInfo.deepValue.endTime) })
			</p> </div>
			const timeUntilNext = humanReadableDateDeltaFromTo(currentTimeInBigIntSeconds.value, disputeWindowInfo.deepValue.startTime)
			const nextWindowLength = humanReadableDateDeltaFromTo(disputeWindowInfo.deepValue.startTime, disputeWindowInfo.deepValue.endTime)
			return <div class = 'warning-box'> <p>
				Resolving To "<b>{ winningOptionName.value }</b>" if not disputed in the next dispute round. Next round starts in { timeUntilNext } ({ formatUnixTimestampIso(disputeWindowInfo.deepValue.startTime) } and lasts { nextWindowLength })
			</p> </div>
		}
	}/>
}

export const Market = ({ repTokenName, marketData, universe, addressComponent, children, forkValues, disputeWindowInfo, currentTimeInBigIntSeconds }: MarketProps) => {
	if (marketData.deepValue === undefined) return <div>
		<div className = 'market-card'>
			{ addressComponent }
		</div>
	</div>
	const endTime = useComputed(() => marketData.deepValue?.endTime)
	return <div>
		{ universe.deepValue !== undefined && BigInt(universe.deepValue) !== BigInt(marketData.deepValue.universe) ? <>
			<div class = 'error-box'>
				<p> This Market is for universe { getUniverseName(marketData.deepValue.universe) } while you are on universe { getUniverseName(universe.deepValue) }!</p>
			</div>
		</> : <></> }
		<div className = 'market-card'>
			{ addressComponent }
			{ marketData.deepValue.reportingState !== 'CrowdsourcingDispute' && marketData.deepValue.reportingState !== 'AwaitingNextWindow' ? <></> : <>
				<ResolvingTo marketData = { marketData } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>
			</> }
			<header className = 'market-header'>
				<h1>{ marketData.deepValue.parsedExtraInfo?.description || marketData.deepValue.marketAddress }</h1>
				<div className = 'status-bar'>
					<span className = 'state'>{ <MarketState marketData = { marketData } forkValues = { forkValues } /> }</span>
					<Countdown end = { endTime } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>
				</div>
				<div style = { { display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' } }>
					<div>
						<span>{ bigintToDecimalString(marketData.deepValue.openInterest, 18n, 2) } DAI Open Interest</span>
					</div>
					<div>
						{ formatUnixTimestampIso(marketData.deepValue.endTime) }
					</div>
				</div>
			</header>

			<section className = 'description'>
				<DisplayExtraInfo marketData = { marketData } />
			</section>

			<section className = 'market-outcomes detail'>
				<MarketOutcomes marketData = { marketData } />
			</section>

			<section className = 'details-grid'>
				{ [
					...marketData.deepValue.owner === marketData.deepValue.marketCreator && marketData.deepValue.marketCreator === marketData.deepValue.designatedReporter ?
						[['Owner/Creator/Designated Reporter', <EtherScanAddress address = { useComputed(() => marketData.deepValue?.owner) }/>]]
					: [
						['Market Owner', <EtherScanAddress address = { useComputed(() => marketData.deepValue?.owner) }/>],
						['Market Creator', <EtherScanAddress address = { useComputed(() => marketData.deepValue?.marketCreator) }/>],
						['Designated Reporter', <EtherScanAddress address = { useComputed(() => marketData.deepValue?.designatedReporter) }/>],
					],
					['Fee', marketData.deepValue.feeDivisor === 0n ? '0.00%' : `${ (100 / Number(marketData.deepValue.feeDivisor)).toFixed(2) }%` ],
					['Reporting Fee', marketData.deepValue.reportingFeeDivisor === 0n ? '0.00%' : `${ (100 / Number(marketData.deepValue.reportingFeeDivisor)).toFixed(2) }%` ],
					['Affiliate Fee', marketData.deepValue.affiliateFeeDivisor === 0n ? '0.00%' : `${ (100 / Number(marketData.deepValue.affiliateFeeDivisor)).toFixed(2) }%` ],

					['Validity Bond', `${ bigintToDecimalString(marketData.deepValue.validityBond, 18n, 2) } DAI`],
					['Rep Bond', `${ bigintToDecimalString(marketData.deepValue.repBond, 18n, 2) } ${ repTokenName } `],

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
