import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { contributeToMarketDispute, contributeToMarketDisputeOnTentativeOutcome, disavowCrowdsourcers, doInitialReport, fetchHotLoadingMarketData, finalizeMarket, getDisputeWindow, getDisputeWindowInfo, getForkValues, getPreemptiveDisputeCrowdsourcer, getReportingHistory, getStakeOfReportingParticipant, getWinningPayoutNumerators, migrateThroughOneFork, ReportingHistoryElement, getLastCompletedCrowdSourcer, getRepBond, getCrowdsourcerInfoByPayoutNumerator, derivePayoutDistributionHash } from '../../utils/augurContractUtils.js'
import { areEqualArrays, bigintToDecimalString, decimalStringToBigint, formatUnixTimestampISO, isDecimalString } from '../../utils/ethereumUtils.js'
import { ExtraInfo } from '../../CreateMarketUI/types/createMarketTypes.js'
import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress, EthereumAddress, EthereumQuantity } from '../../types/types.js'
import { SomeTimeAgo } from './SomeTimeAgo.js'
import { MarketReportingOptionsForYesNoAndCategorical, OutcomeStake } from '../../SharedUI/YesNoCategoricalMarketReportingOptions.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { getAllPayoutNumeratorCombinations, maxStakeAmountForOutcome, getOutComeName, getPayoutNumeratorsFromScalarOutcome } from '../../utils/augurUtils.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { bigintSecondsToDate, humanReadableDateDelta, humanReadableDateDeltaFromTo } from '../../utils/utils.js'
import { aggregateByPayoutDistribution, getReportingParticipantsForMarket } from '../../utils/augurForkUtilities.js'
import { ReportedScalarInputs, ScalarInput } from '../../SharedUI/ScalarMarketReportingOptions.js'
import { Input } from '../../SharedUI/Input.js'
import { assertNever } from '../../utils/errorHandling.js'
import { SelectUniverse } from '../../SharedUI/SelectUniverse.js'

interface ForkMigrationProps {
	marketData: OptionalSignal<MarketData>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeWriteClient: OptionalSignal<WriteClient>
	disabled: Signal<boolean>
	refreshData: () => Promise<void>
}

export const ForkMigration = ({ marketData, maybeWriteClient, outcomeStakes, disabled, refreshData }: ForkMigrationProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	const initialReportReason = useSignal<string>('')
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const disavowCrowdsourcersButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		await disavowCrowdsourcers(writeClient, marketData.deepValue.marketAddress)
		await refreshData()
	}
	const migrateThroughOneForkButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		if (outcomeStakes.deepValue === undefined) throw new Error('outcomeStakes missing')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('selectedPayoutNumerators not found')
		await migrateThroughOneFork(writeClient, marketData.deepValue.marketAddress, selectedPayoutNumerators.deepValue, initialReportReason.peek())
		await refreshData()
	}
	return <div class = 'panel'>
		<div style = 'display: grid'>
			<span><b>Market Fork Migration:</b></span>
			<SelectUniverse marketData = { marketData } disabled = { disabled } outcomeStakes = { outcomeStakes } selectedPayoutNumerators = { selectedPayoutNumerators }/>
			<label>
				Initial Report Reason:{' '}
				<input
					disabled = { disabled }
					type = 'text'
					value = { initialReportReason.value }
					onChange = { (event) => {
						const target = event.target as HTMLInputElement
						initialReportReason.value = target.value
					} }
				/>
			</label>
		</div>
		<div style = 'margin-top: 1rem'>
			<button class = 'button is-primary' onClick = { disavowCrowdsourcersButton } disabled = { disabled }>Disavow Crowdsourcers</button>
		</div>
		<div style = 'margin-top: 1rem'>
			<button class = 'button is-primary' onClick = { migrateThroughOneForkButton } disabled = { disabled }>Migrate Through One Fork</button>
		</div>
	</div>
}

interface DisplayStakesProps {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketData: OptionalSignal<MarketData>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	lastCompletedCrowdSourcer: OptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>
	repBond: OptionalSignal<EthereumQuantity>
	refreshData: () => Promise<void>
}

export const DisplayStakes = ({ outcomeStakes, maybeWriteClient, marketData, disputeWindowInfo, preemptiveDisputeCrowdsourcerStake, forkValues, lastCompletedCrowdSourcer, repBond, refreshData }: DisplayStakesProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	if (lastCompletedCrowdSourcer.deepValue === undefined) return <></>
	if (forkValues.deepValue === undefined) return <></>

	const selectedOutcome = useSignal<string | null>(null)
	const selectedScalarOutcome = useOptionalSignal<bigint>(undefined)
	const selectedScalarOutcomeInvalid = useSignal<boolean>(false)

	const reason = useSignal<string>('')
	const amountInput = useOptionalSignal<EthereumQuantity>(undefined)
	const isSlowReporting = useComputed(() => lastCompletedCrowdSourcer.deepValue !== undefined && forkValues.deepValue !== undefined && lastCompletedCrowdSourcer.deepValue.size >= forkValues.deepValue.disputeThresholdForDisputePacing)
	const isInitialReporting = useComputed(() => marketData.deepValue?.hotLoadingMarketData.reportingState === 'OpenReporting' || marketData.deepValue?.hotLoadingMarketData.reportingState === 'DesignatedReporting')
	const canInitialReport = useComputed(() => marketData.deepValue?.hotLoadingMarketData.reportingState === 'OpenReporting' || (marketData.deepValue?.hotLoadingMarketData.reportingState === 'DesignatedReporting' && marketData.deepValue.hotLoadingMarketData.designatedReporter === maybeWriteClient.deepValue?.account.address))

	const areOptionsDisabled = useComputed(() => !disputeWindowInfo.deepValue?.isActive && isSlowReporting.value)

	const maxStakeAmount = useComputed(() => {
		if (marketData.deepValue === undefined) return undefined
		if (forkValues.deepValue === undefined) return undefined
		if (outcomeStakes.deepValue === undefined) return undefined
		if (marketData.deepValue.hotLoadingMarketData.marketType === 'Scalar') {
			const numTicks = marketData.deepValue.hotLoadingMarketData.numTicks
			const minPrice = marketData.deepValue?.hotLoadingMarketData.displayPrices[0]
			const maxPrice = marketData.deepValue?.hotLoadingMarketData.displayPrices[1]
			if (minPrice === undefined || maxPrice === undefined) throw new Error('displayPrices is undefined')
			if (!selectedScalarOutcomeInvalid.value && selectedScalarOutcome.deepValue === undefined) return undefined
			const payoutNumerators = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)
			const existingOutComestake = outcomeStakes.deepValue.find((outcome) => areEqualArrays(outcome.payoutNumerators, payoutNumerators))
			const totalStake = outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n)
			const outcomeStake = existingOutComestake !== undefined ? existingOutComestake : {
				outcomeName: getOutComeName(payoutNumerators, marketData.deepValue),
				repStake: 0n,
				status: 'Losing',
				payoutNumerators,
				alreadyContributedToOutcomeStake: undefined
			} as const
			return maxStakeAmountForOutcome(outcomeStake, totalStake, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, forkValues.deepValue.disputeThresholdForDisputePacing, lastCompletedCrowdSourcer.deepValue)
		} else {
			if (selectedOutcome.value === null) return undefined
			const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
			const totalStake = outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n)
			if (outcomeStake === undefined) return undefined
			return maxStakeAmountForOutcome(outcomeStake, totalStake, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, forkValues.deepValue.disputeThresholdForDisputePacing, lastCompletedCrowdSourcer.deepValue)
		}
	})

	const isDisabled = useComputed(() => !disputeWindowInfo.deepValue?.isActive && isSlowReporting.value)
	const report = async (outcomeStake: OutcomeStake, reportReason: string, amount: bigint) => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('market missing')
		const market = marketData.deepValue.marketAddress

		const totalRepStake = outcomeStakes.deepValue?.reduce((prev, current) => prev + current.repStake, 0n)
		if (totalRepStake === 0n) await doInitialReport(writeClient, market, outcomeStake.payoutNumerators, reportReason, amount)
		else if (outcomeStake.status === 'Winning') {
			await contributeToMarketDisputeOnTentativeOutcome(
				writeClient,
				market,
				outcomeStake.payoutNumerators,
				amount,
				reportReason
			)
		} else {
			await contributeToMarketDispute(
				writeClient,
				market,
				outcomeStake.payoutNumerators,
				amount,
				reportReason
			)
		}
		await refreshData()
	}

	const handleReport = async () => {
		if (outcomeStakes.deepValue === undefined) throw new Error ('Outcome stakes missing')
		if (marketData.deepValue === undefined) throw new Error ('market data missing')
		if (amountInput.deepValue === undefined) throw new Error ('Input missing')
		if (marketData.deepValue.hotLoadingMarketData.marketType === 'Scalar') {
			const numTicks = marketData.deepValue.hotLoadingMarketData.numTicks
			const minPrice = marketData.deepValue?.hotLoadingMarketData.displayPrices[0]
			const maxPrice = marketData.deepValue?.hotLoadingMarketData.displayPrices[1]
			if (minPrice === undefined || maxPrice === undefined) throw new Error('displayPrices is undefined')
			const payoutNumerators = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)
			const invalidOutcomeStake = outcomeStakes.deepValue.find((outcome) => areEqualArrays(outcome.payoutNumerators, payoutNumerators))
			const reportingOutcomeStake = invalidOutcomeStake !== undefined ? invalidOutcomeStake : {
				outcomeName: getOutComeName(payoutNumerators, marketData.deepValue),
				repStake: 0n,
				status: 'Losing',
				payoutNumerators,
				alreadyContributedToOutcomeStake: undefined
			} as const
			try {
				await report(reportingOutcomeStake, reason.value, amountInput.deepValue)
			} catch (error) {
				console.error('Error reporting for payout numerators:', payoutNumerators.join(', '), error)
			}
		} else {
			if (selectedOutcome.value === null) throw new Error('Invalid input')
			const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
			if (!outcomeStake) throw new Error('Selected outcome not found')
			try {
				await report(outcomeStake, reason.value, amountInput.deepValue)
			} catch (error) {
				console.error('Error reporting for outcome:', outcomeStake.outcomeName, error)
			}
		}
	}

	const ResolvingTo = () => {
		if (outcomeStakes.deepValue === undefined) return <></>
		if (disputeWindowInfo.deepValue === undefined) return <></>
		const winningOption = outcomeStakes.deepValue.find((outcome) => outcome.status === 'Winning')
		if (winningOption === undefined) return <></>
		const endDate = bigintSecondsToDate(disputeWindowInfo.deepValue.endTime)
		return <div style = 'margin-top: 1rem'>
			<SomeTimeAgo priorTimestamp = { endDate } countBackwards = { true } diffToText = {
				(time: number) => {
					if (disputeWindowInfo.deepValue === undefined) return <></>
					if (time <= 0) return <>The market has resolved to "<b>{ winningOption.outcomeName }</b>".</>
					if (disputeWindowInfo.deepValue.isActive || !isSlowReporting.value) return <>Resolving To "<b>{ winningOption.outcomeName }</b>" if not disputed in { humanReadableDateDelta(time) } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.endTime) }).</>
					const timeUntilNext = humanReadableDateDeltaFromTo(new Date(), bigintSecondsToDate(disputeWindowInfo.deepValue.startTime))
					const nextWindowLength = humanReadableDateDeltaFromTo(bigintSecondsToDate(disputeWindowInfo.deepValue.startTime), bigintSecondsToDate(disputeWindowInfo.deepValue.endTime))
					return <>Resolving To "<b>{ winningOption.outcomeName }</b>" if not disputed in the next dispute round. Next round starts in { timeUntilNext } ({ formatUnixTimestampISO(disputeWindowInfo.deepValue.startTime) } and lasts { nextWindowLength }).</>
				}
			}/>
		</div>
	}

	const TotalRepStaked = () => {
		if (outcomeStakes.deepValue === undefined || forkValues.deepValue === undefined) return <></>
		return <div style = 'display: grid; margin-top: 1rem'>
			<span><b>Total Rep staked:</b>{ ' ' }{ bigintToDecimalString(outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n), 18n, 2) } REP</span>
			<span><b>Forking Augur after:</b>{ ' ' }{ bigintToDecimalString(forkValues.deepValue.disputeThresholdForFork, 18n, 2) } REP is staked within one round</span>
		</div>
	}

	const setMaxStake = () => {
		if (maxStakeAmount.value === undefined) {
			amountInput.deepValue = 0n
			return
		}
		amountInput.deepValue = maxStakeAmount.value
	}

	const minValue = useComputed(() => marketData.deepValue?.hotLoadingMarketData.displayPrices[0] || 0n)
	const maxValue = useComputed(() => marketData.deepValue?.hotLoadingMarketData.displayPrices[1] || 0n)
	const numTicks = useComputed(() => marketData.deepValue?.hotLoadingMarketData.numTicks || 0n)
	const scalarDenomination = useComputed(() => marketData.deepValue?.parsedExtraInfo?._scalarDenomination || '')

	const ReportingComponent = () => {
		if (marketData.deepValue === undefined) return <></>
		if (marketData.deepValue.hotLoadingMarketData.marketType === 'Scalar') {
			return <div key = { marketData.deepValue.marketAddress } style = { { display: 'grid', gridTemplateRows: 'max-content max-content', gap: '2rem', alignItems: 'center' } }>
				<ReportedScalarInputs outcomeStakes = { outcomeStakes } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer }/>
				<ScalarInput value = { selectedScalarOutcome } invalid = { selectedScalarOutcomeInvalid } minValue = { minValue } maxValue = { maxValue } numTicks = { numTicks } unit = { scalarDenomination } disabled = { areOptionsDisabled } />
			</div>
		} else {
			return <MarketReportingOptionsForYesNoAndCategorical outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } isSlowReporting = { isSlowReporting } forkValues = { forkValues } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer } areOptionsDisabled = { areOptionsDisabled } canInitialReport = { canInitialReport }/>
		}
	}

	return (
		<div class = 'panel'>
			<div style = 'display: grid'>
			<span><b>Market Reporting ({ isInitialReporting.value ? 'Initial reporting' : (isSlowReporting.value ? 'Slow reporting' : 'Fast reporting') }):</b></span>
			{ isDisabled.value ? <span><b>The reporting is closed for this round. Please check again in the next round.</b></span> : <></>}
				<ReportingComponent/>
				<TotalRepStaked/>
				<ResolvingTo/>
				<div style = 'margin-top: 1rem'>
					<label>
						Reason:{' '}
						<input
							type = 'text'
							value = { reason.value }
							disabled = { isDisabled.value }
							style = { 'width: 100%' }
							placeholder = 'Optional: Explain why you believe this outcome is correct'
							onChange = { (event) => {
								const target = event.target as HTMLInputElement
								reason.value = target.value
							} }
						/>
					</label>
				</div>
				<div style = 'margin-top: 0.5rem'>
					<div style = { { display: 'grid', gridTemplateColumns: 'max-content max-content max-content max-content max-content', gap: '0.5rem' } }>
						{ 'Amount: ' }
						<Input
							style = 'height: fit-content;'
							class = 'input'
							type = 'text'
							width = '100%'
							placeholder = 'REP to stake'
							disabled = { isDisabled.value }
							value = { amountInput }
							sanitize = { (amount: string) => amount.trim() }
							tryParse = { (amount: string | undefined) => {
								if (amount === undefined) return { ok: false } as const
								if (!isDecimalString(amount.trim())) return { ok: false } as const
								const parsed = decimalStringToBigint(amount.trim(), 18n)
								return { ok: true, value: parsed } as const
							}}
							serialize = { (amount: EthereumQuantity | undefined) => {
								if (amount === undefined) return ''
								return bigintToDecimalString(amount, 18n, 18)
							} }
						/>
						{ maxStakeAmount.value === undefined || isDisabled.value ? <></> : <>
							/ { bigintToDecimalString(maxStakeAmount.value, 18n, 2) } REP
							<button class = 'button is-primary' onClick = { setMaxStake }>Max</button>
							{ repBond.deepValue !== undefined && isInitialReporting.value ? `+ ${ bigintToDecimalString(repBond.deepValue,18n, 2) } (initial reporter bond)` : '' }
						</> }
					</div>
				</div>
				<div style = 'margin-top: 1rem'>
					<button class = 'button is-primary' disabled = { (isDisabled.value || maxStakeAmount.value === undefined || maxStakeAmount.value === 0n) && !isInitialReporting.value || amountInput.deepValue === undefined } onClick = { handleReport }>Report</button>
				</div>
			</div>
		</div>
	)
}

interface ReportingHistoryProps {
	reportingHistory: OptionalSignal<readonly ReportingHistoryElement[]>
	marketData: OptionalSignal<MarketData>
}
export const ReportingHistory = ({ reportingHistory, marketData }: ReportingHistoryProps) => {
	if (reportingHistory.deepValue === undefined) return <></>
	if (marketData.deepValue === undefined) return <></>
	return <div class = 'panel'>
		<span><b>Reporting history for the market</b></span>
		<div style = 'display: grid'>
			{ reportingHistory.deepValue.map((round) => {
				if (marketData.deepValue === undefined) return <></>
				const marketType = marketData.deepValue.hotLoadingMarketData.marketType
				if (marketType === undefined) throw new Error(`Invalid market type Id: ${ marketData.deepValue.hotLoadingMarketData.marketType }`)
				const outcomeName = getOutComeName(round.payoutNumerators, marketData.deepValue)
				return <span><b>{ round.type }{ 'Round ' }{ round.round }</b>{ ': ' }
					{ outcomeName }
					{ ' Stake: ' }{ bigintToDecimalString(round.stake, 18n, 2) }{ ' ' }REP
					{ ' Size: ' }{ bigintToDecimalString(round.size, 18n, 2) }{ ' ' }REP
				</span>
			})}
		</div>
	</div>
}

interface ReportingProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<AccountAddress>
	reputationTokenAddress: OptionalSignal<AccountAddress>
}

export const Reporting = ({ maybeReadClient, maybeWriteClient, universe, reputationTokenAddress }: ReportingProps) => {
	const marketAddress = useOptionalSignal<AccountAddress>(undefined)
	const marketData = useOptionalSignal<MarketData>(undefined)
	const outcomeStakes = useOptionalSignal<readonly OutcomeStake[]>(undefined)
	const disputeWindowAddress = useOptionalSignal<AccountAddress>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const preemptiveDisputeCrowdsourcerAddress = useOptionalSignal<AccountAddress>(undefined)
	const preemptiveDisputeCrowdsourcerStake = useOptionalSignal<bigint>(undefined)
	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)
	const reportingHistory = useOptionalSignal<readonly ReportingHistoryElement[]>(undefined)
	const lastCompletedCrowdSourcer = useOptionalSignal<Awaited<ReturnType<typeof getLastCompletedCrowdSourcer>>>(undefined)
	const repBond = useOptionalSignal<EthereumQuantity>(undefined)
	const isInvalidMarketAddress = useSignal<boolean>(false)

	const finalizeDisabled = useComputed(() => marketData.deepValue?.hotLoadingMarketData.reportingState !== 'AwaitingFinalization')
	const migrationDisabled = useComputed(() => marketData.deepValue?.hotLoadingMarketData.reportingState !== 'AwaitingForkMigration')

	const getParsedExtraInfo = (extraInfo: string) => {
		try {
			return ExtraInfo.parse(JSON.parse(extraInfo))
		} catch(error) {
			return undefined
		}
	}

	const clear = () => {
		marketData.deepValue = undefined
		outcomeStakes.deepValue = undefined
		disputeWindowAddress.deepValue = undefined
		disputeWindowInfo.deepValue = undefined
		preemptiveDisputeCrowdsourcerAddress.deepValue = undefined
		preemptiveDisputeCrowdsourcerStake.deepValue = 0n
		forkValues.deepValue = undefined
		reportingHistory.deepValue = undefined
		lastCompletedCrowdSourcer.deepValue = undefined
	}

	useSignalEffect(() => {
		if (marketAddress.deepValue === undefined) {
			clear()
		} else {
			refreshData()
		}
	})

	const refreshData = async () => {
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) throw new Error('missing readClient')
		if (reputationTokenAddress.deepValue === undefined) throw new Error('missing reputationTokenAddress')
		clear()
		if (marketAddress.deepValue === undefined) throw new Error('market not defined')
		const hotLoadingMarketData = await fetchHotLoadingMarketData(readClient, marketAddress.deepValue)
		lastCompletedCrowdSourcer.deepValue = await getLastCompletedCrowdSourcer(readClient, marketAddress.deepValue, hotLoadingMarketData.disputeRound)
		const parsedExtraInfo = getParsedExtraInfo(hotLoadingMarketData.extraInfo)
		marketData.deepValue = { marketAddress: marketAddress.deepValue, parsedExtraInfo, hotLoadingMarketData }
		const currentMarketData = marketData.deepValue

		const getAllInterestingPayoutNumerators = async() => {
			const reportingParticipants = await getReportingParticipantsForMarket(readClient, currentMarketData.marketAddress)
			switch (hotLoadingMarketData.marketType) {
				case 'Categorical':
				case 'Yes/No': {
					// its possible for Augur to have "malformed payout numerators" being reported. Such as you can report 80% yes and 20% no on Yes/No market.
					// We get these (along with valid ones that exist in the data) with `getReportingParticipantsForMarket`
					// we merge all valid ones with all existing ones to get all interesting (as in either reported ones, or ones that make sense to report for) reporting options
					const allValidPayoutNumerators = getAllPayoutNumeratorCombinations(hotLoadingMarketData.numOutcomes, hotLoadingMarketData.numTicks)
					const allPayoutNumeratorsWithDuplicates = [...allValidPayoutNumerators.map((numerator) => ({ size: 0n, stake: 0n, payoutNumerators: numerator })), ...reportingParticipants]
					return aggregateByPayoutDistribution(allPayoutNumeratorsWithDuplicates)
				}
				case 'Scalar': return aggregateByPayoutDistribution(reportingParticipants)
				default: assertNever(hotLoadingMarketData.marketType)
			}
		}
		const allInterestingPayoutNumerators = await getAllInterestingPayoutNumerators()
		const winningOption = await getWinningPayoutNumerators(readClient, marketAddress.deepValue)
		const winningIndex = winningOption === undefined ? -1 : allInterestingPayoutNumerators.findIndex((option) => areEqualArrays(option.payoutNumerators, winningOption))
		outcomeStakes.deepValue = await Promise.all(allInterestingPayoutNumerators.map(async (info, index) => {
			const payoutNumerators = info.payoutNumerators
			const payoutHash = EthereumQuantity.parse(derivePayoutDistributionHash(payoutNumerators, hotLoadingMarketData.numTicks, hotLoadingMarketData.numOutcomes))
			return {
				outcomeName: getOutComeName(payoutNumerators, currentMarketData),
				repStake: info.stake,
				status: index === winningIndex ? 'Winning' : 'Losing',
				payoutNumerators,
				alreadyContributedToOutcomeStake: (await getCrowdsourcerInfoByPayoutNumerator(readClient, currentMarketData.marketAddress, payoutHash))?.stake
			}
		}))
		disputeWindowAddress.deepValue = await getDisputeWindow(readClient, marketAddress.deepValue)
		if (EthereumAddress.parse(disputeWindowAddress.deepValue) !== 0n) {
			disputeWindowInfo.deepValue = await getDisputeWindowInfo(readClient, disputeWindowAddress.deepValue)
		}
		preemptiveDisputeCrowdsourcerAddress.deepValue = await getPreemptiveDisputeCrowdsourcer(readClient, marketAddress.deepValue)
		if (EthereumAddress.parse(preemptiveDisputeCrowdsourcerAddress.deepValue) !== 0n) {
			preemptiveDisputeCrowdsourcerStake.deepValue = await getStakeOfReportingParticipant(readClient, preemptiveDisputeCrowdsourcerAddress.deepValue)
		}
		repBond.deepValue = await getRepBond(readClient, marketAddress.deepValue)
		forkValues.deepValue = await getForkValues(readClient, reputationTokenAddress.deepValue)
		if (!(hotLoadingMarketData.reportingState === 'PreReporting'
			|| hotLoadingMarketData.reportingState === 'OpenReporting'
			|| hotLoadingMarketData.reportingState === 'DesignatedReporting')) {
			reportingHistory.deepValue = await getReportingHistory(readClient, marketAddress.deepValue, hotLoadingMarketData.disputeRound)
		}
	}

	const finalizeMarketButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (marketData.deepValue === undefined) throw new Error('missing market data')
		await finalizeMarket(writeClient, marketData.deepValue.marketAddress)
		await refreshData()
	}

	return <div class = 'subApplication'>
		<div style = 'display: grid; width: 100%; gap: 10px;'>
			<Input
				style = 'height: fit-content;'
				class = 'input'
				type = 'text'
				width = '100%'
				placeholder = 'Market address'
				value = { marketAddress }
				sanitize = { (addressString: string) => addressString }
				tryParse = { (marketAddressString: string | undefined) => {
					if (marketAddressString === undefined) return { ok: false } as const
					const parsed = EthereumAddress.safeParse(marketAddressString.trim())
					if (parsed.success) return { ok: true, value: marketAddressString.trim() } as const
					return { ok: false } as const
				}}
				serialize = { (marketAddressString: string | undefined) => {
					if (marketAddressString === undefined) return ''
					return marketAddressString.trim()
				} }
				invalidSignal = { isInvalidMarketAddress }
			/>
			<button class = 'button is-primary' onClick = { refreshData }>Refresh Data</button>
			<Market marketData = { marketData } universe = { universe } repBond = { repBond }/>
			<ReportingHistory marketData = { marketData } reportingHistory = { reportingHistory }/>
			<DisplayStakes outcomeStakes = { outcomeStakes } marketData = { marketData } maybeWriteClient = { maybeWriteClient } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } disputeWindowInfo = { disputeWindowInfo } forkValues = { forkValues } lastCompletedCrowdSourcer = { lastCompletedCrowdSourcer } repBond = { repBond } refreshData = { refreshData }/>
			{ marketData.deepValue === undefined ? <> </> : <button class = 'button is-primary' onClick = { finalizeMarketButton } disabled = { finalizeDisabled }>Finalize Market</button> }
			<ForkMigration marketData = { marketData } maybeWriteClient = { maybeWriteClient } outcomeStakes = { outcomeStakes } disabled = { migrationDisabled } refreshData = { refreshData }/>
		</div>
	</div>
}
