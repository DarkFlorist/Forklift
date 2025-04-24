import { useEffect, useState } from 'preact/hooks'
import { ExtraInfo } from '../CreateMarketUI/types/createMarketTypes.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { fetchHotLoadingMarketData } from '../utils/augurContractUtils.js'
import { getUniverseName } from '../utils/augurUtils.js'
import { assertNever } from '../utils/errorHandling.js'
import { bigintToDecimalString, formatUnixTimestampISO } from '../utils/ethereumUtils.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { bigintSecondsToDate, humanReadableDateDeltaFromTo } from '../utils/utils.js'
import { JSX } from 'preact/jsx-runtime'

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

export const MarketState = ({ marketData }: DisplayExtraInfoProps) => {
	const data = marketData.deepValue?.hotLoadingMarketData
	if (data === undefined) return ''
	const state = data.reportingState
	switch(state) {
		case 'AwaitingFinalization': return 'Awaiting For Finalization'
		case 'AwaitingForkMigration': return 'Awaiting For Fork Migration'
		case 'AwaitingNextWindow': return `Disputing Round: ${ data.disputeRound }: Awaiting For Next The Reporting Window`
		case 'CrowdsourcingDispute': return `Disputing Round: ${ data.disputeRound }: Awaiting For Possible Disputes`
		case 'DesignatedReporting': return 'Awaiting For Designated Reporter'
		case 'Finalized': return 'Finalized'
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

export const Market = ({ marketData, universe, repBond, addressComponent, children }: MarketProps) => {
	if (marketData.deepValue === undefined || repBond.deepValue === undefined) return <div>
		<div className = 'market-card'>
			{ addressComponent }
		</div>
	</div>
	return <div>
		{ universe.deepValue !== undefined && BigInt(universe.deepValue) !== BigInt(marketData.deepValue.hotLoadingMarketData.universe) ? <>
			<div style = 'padding: 10px; background-color: red;'>
				<p> This Market is for universe { getUniverseName(marketData.deepValue.hotLoadingMarketData.universe) } while you are on universe { getUniverseName(universe.deepValue) }!</p>
			</div>
		</> : <></> }
		<div className = 'market-card'>
			{ addressComponent }
			<header className = 'market-header'>
				<h1>{ marketData.deepValue.parsedExtraInfo?.description || marketData.deepValue.marketAddress }</h1>
				<div className = 'status-bar'>
					<span className = 'state'>{ <MarketState marketData = { marketData } /> }</span>
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

			<section className='details-grid'>
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
