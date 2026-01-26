import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { contributeToMarketDispute, contributeToMarketDisputeOnTentativeOutcome, disavowCrowdsourcers, doInitialReport, fetchMarketData, finalizeMarket, getDisputeWindow, getDisputeWindowInfo, getForkValues, getPreemptiveDisputeCrowdsourcer, getReportingHistory, getStakeOfReportingParticipant, getWinningPayoutNumerators, migrateThroughOneFork, ReportingHistoryElement, getCrowdsourcerInfoByPayoutNumerator, derivePayoutDistributionHash, getWinningChildUniverse, isMarketFinalized, getUniverseInformation, isValidAugurMarket, getUniverseForkingInformation } from '../../utils/augurContractUtils.js'
import { areEqualArrays, bigintToRoundedDecimalString } from '../../utils/ethereumUtils.js'
import { ReadonlySignal, Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { AccountAddress, EthereumAddress, EthereumQuantity, UniverseInformation } from '../../types/types.js'
import { MarketOutcomeWithUniverse, MarketReportingOptionsForYesNoAndCategorical, OutcomeStake } from '../../SharedUI/YesNoCategoricalMarketReportingOutcomes.js'
import { Market, MarketData } from '../../SharedUI/Market.js'
import { getAllPayoutNumeratorCombinations, maxStakeAmountForOutcome, getOutcomeName, getPayoutNumeratorsFromScalarOutcome, areValidScalarPayoutNumeratorOutcomes, getRepTokenName } from '../../utils/augurUtils.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { aggregateByPayoutDistribution, getReportingParticipantsForMarket } from '../../utils/augurExtraUtilities.js'
import { ReportedScalarInputs, ScalarInput } from '../../SharedUI/ScalarMarketReportingOutcomes.js'
import { Input } from '../../SharedUI/Input.js'
import { assertNever } from '../../utils/errorHandling.js'
import { SelectUniverse } from '../../SharedUI/SelectUniverse.js'
import { min } from '../../utils/utils.js'
import { CenteredBigSpinner } from '../../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../../SharedUI/SendTransactionButton.js'
import { LoadingButton } from '../../SharedUI/LoadingButton.js'
import { parse18DecimalBigintForInput, parseAddressForInput, serialize18DecimalBigintForInput, serializeAddressForInput } from '../../utils/inputParsing.js'
import { promiseAllMapAbortSafe, silenceChromeUnCaughtPromise } from '../../utils/abortGuard.js'

interface ForkMigrationProps {
	marketData: OptionalSignal<MarketData>
	outcomeStakes: OptionalSignal<readonly MarketOutcomeWithUniverse[]>
	maybeWriteClient: OptionalSignal<WriteClient>
	disabled: ReadonlySignal<boolean>
	forkingMarketFinalized: OptionalSignal<boolean>
	refreshData: () => Promise<void>
	pathSignal: Signal<string>
	universe: OptionalSignal<UniverseInformation>
}

export const ForkMigration = ({ universe, marketData, forkingMarketFinalized, maybeWriteClient, outcomeStakes, disabled, refreshData, pathSignal }: ForkMigrationProps) => {
	if (outcomeStakes.deepValue === undefined) return <></>
	if (disabled.value === true) return <></>
	const initialReportReason = useSignal<string>('')
	const selectedPayoutNumerators = useOptionalSignal<readonly bigint[]>(undefined)
	const disavowCrowdsourcersButtonStatus = useSignal<TransactionStatus>(undefined)
	const migrateThroughOneForkButtonStatus = useSignal<TransactionStatus>(undefined)

	const disavowCrowdsourcersButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		return await disavowCrowdsourcers(writeClient, marketData.deepValue.marketAddress)
	}

	const migrateThroughOneForkButtonDisabled = useComputed(() => disabled.value || selectedPayoutNumerators.deepValue === undefined || forkingMarketFinalized.deepValue !== true)
	const disavowCrowdsourcersButtonDisabled = useComputed(() => disabled.value || marketData.deepValue?.repBond === undefined || marketData.deepValue.repBond === 0n)

	const migrateThroughOneForkButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('marketData missing')
		if (outcomeStakes.deepValue === undefined) throw new Error('outcomeStakes missing')
		if (selectedPayoutNumerators.deepValue === undefined) throw new Error('selectedPayoutNumerators not found')
		return await migrateThroughOneFork(writeClient, marketData.deepValue.marketAddress, selectedPayoutNumerators.deepValue, initialReportReason.peek())
	}

	return <>
		<div style = 'display: grid; gap: 1.5rem;'>
			<span><b>Market Fork Migration:</b></span>
			<SelectUniverse maybeWriteClient = { maybeWriteClient } universe = { universe } refreshStakes = { refreshData } pathSignal = { pathSignal } marketData = { marketData } disabled = { disabled } outcomeStakes = { outcomeStakes } selectedPayoutNumerators = { selectedPayoutNumerators }/>
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
		<div class = 'button-group'>
			<SendTransactionButton
				className = 'button button-primary button-group-button'
				transactionStatus = { disavowCrowdsourcersButtonStatus }
				sendTransaction = { disavowCrowdsourcersButton }
				maybeWriteClient = { maybeWriteClient }
				disabled = { disavowCrowdsourcersButtonDisabled }
				text = { useComputed(() => 'Disavow Crowdsourcers') }
				callBackWhenIncluded = { refreshData }
			/>
			<SendTransactionButton
				className = 'button button-primary button-group-button'
				transactionStatus = { migrateThroughOneForkButtonStatus }
				sendTransaction = { migrateThroughOneForkButton }
				maybeWriteClient = { maybeWriteClient }
				disabled = { migrateThroughOneForkButtonDisabled }
				text = { useComputed(() => 'Migrate Through Fork') }
				callBackWhenIncluded = { refreshData }
			/>
		</div>
	</>
}

interface DisplayStakesProps {
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketData: OptionalSignal<MarketData>
	disputeWindowInfo: OptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>
	preemptiveDisputeCrowdsourcerStake: OptionalSignal<bigint>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	repBalance: OptionalSignal<bigint>
	refreshData: () => Promise<void>
	universe: OptionalSignal<UniverseInformation>
	pathSignal: Signal<string>
}

let fetchReportingHistoryAbortController: AbortController | undefined = undefined

export const DisplayStakes = ({ pathSignal, universe, outcomeStakes, maybeWriteClient, marketData, disputeWindowInfo, preemptiveDisputeCrowdsourcerStake, forkValues, refreshData, repBalance }: DisplayStakesProps) => {
	const selectedOutcome = useSignal<string | null>(null)
	const selectedScalarOutcome = useOptionalSignal<bigint>(undefined)
	const selectedScalarOutcomeInvalid = useSignal<boolean>(false)
	const pendingTransactionStatus = useSignal<TransactionStatus>(undefined)

	const reason = useSignal<string>('')
	const amountInput = useOptionalSignal<EthereumQuantity>(undefined)
	const isSlowReporting = useComputed(() => marketData.deepValue?.lastCompletedCrowdSourcer !== undefined && forkValues.deepValue !== undefined && marketData.deepValue.lastCompletedCrowdSourcer.size >= forkValues.deepValue.disputeThresholdForDisputePacing)
	const isInitialReporting = useComputed(() => marketData.deepValue?.reportingState === 'OpenReporting' || marketData.deepValue?.reportingState === 'DesignatedReporting')
	const canInitialReport = useComputed(() => marketData.deepValue?.reportingState === 'OpenReporting' || (marketData.deepValue?.reportingState === 'DesignatedReporting' && marketData.deepValue.designatedReporter === maybeWriteClient.deepValue?.account.address))

	const areOutcomesDisabled = useComputed(() => !disputeWindowInfo.deepValue?.isActive && isSlowReporting.value)

	const selectedOutcomeName = useComputed(() => {
		if (marketData.deepValue === undefined) return undefined
		if (marketData.deepValue.marketType === 'Scalar') {
			const numTicks = marketData.deepValue.numTicks
			const minPrice = marketData.deepValue?.displayPrices[0]
			const maxPrice = marketData.deepValue?.displayPrices[1]
			if (minPrice === undefined || maxPrice === undefined) return undefined
			if (!areValidScalarPayoutNumeratorOutcomes(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)) return undefined
			const payoutNumerators = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)
			return getOutcomeName(payoutNumerators, marketData.deepValue)
		} else {
			if (outcomeStakes.deepValue === undefined) return undefined
			if (selectedOutcome.value === null) return undefined
			const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
			if (!outcomeStake) return undefined
			return outcomeStake.outcomeName
		}
	})
	const reportDisabled = useComputed(() =>
		(isDisabled.value || maxStakeAmount.value === undefined || maxStakeAmount.value === 0n)
		&& !isInitialReporting.value
		|| amountInput.deepValue === undefined || repBalance.deepValue === undefined || amountInput.deepValue > repBalance.deepValue
	)

	const maxStakeAmount = useComputed(() => {
		if (marketData.deepValue === undefined) return undefined
		if (forkValues.deepValue === undefined) return undefined
		if (outcomeStakes.deepValue === undefined) return undefined
		if (marketData.deepValue.marketType === 'Scalar') {
			const numTicks = marketData.deepValue.numTicks
			const minPrice = marketData.deepValue?.displayPrices[0]
			const maxPrice = marketData.deepValue?.displayPrices[1]
			if (minPrice === undefined || maxPrice === undefined) throw new Error('displayPrices is undefined')
			if (!selectedScalarOutcomeInvalid.value && selectedScalarOutcome.deepValue === undefined) return undefined
			if (!areValidScalarPayoutNumeratorOutcomes(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)) return undefined
			const payoutNumerators = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)
			const existingOutComestake = outcomeStakes.deepValue.find((outcome) => areEqualArrays(outcome.payoutNumerators, payoutNumerators))
			const totalStake = outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n)
			const outcomeStake = existingOutComestake !== undefined ? existingOutComestake : {
				outcomeName: getOutcomeName(payoutNumerators, marketData.deepValue),
				repStake: 0n,
				status: 'Losing',
				payoutNumerators,
				alreadyContributedToOutcomeStake: undefined,
				universe: undefined
			} as const
			return maxStakeAmountForOutcome(outcomeStake, totalStake, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, forkValues.deepValue.disputeThresholdForDisputePacing, marketData.deepValue.lastCompletedCrowdSourcer)
		} else {
			if (selectedOutcome.value === null) return undefined
			const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
			const totalStake = outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n)
			if (outcomeStake === undefined) return undefined
			return maxStakeAmountForOutcome(outcomeStake, totalStake, isSlowReporting.value, preemptiveDisputeCrowdsourcerStake.deepValue || 0n, forkValues.deepValue.disputeThresholdForDisputePacing, marketData.deepValue.lastCompletedCrowdSourcer)
		}
	})

	const isDisabled = useComputed(() => !disputeWindowInfo.deepValue?.isActive && isSlowReporting.value)
	const report = async (outcomeStake: OutcomeStake, reportReason: string, amount: bigint) => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('account missing')
		if (marketData.deepValue === undefined) throw new Error('market missing')
		const market = marketData.deepValue.marketAddress

		const totalRepStake = outcomeStakes.deepValue?.reduce((prev, current) => prev + current.repStake, 0n)
		if (totalRepStake === 0n) return await doInitialReport(writeClient, market, outcomeStake.payoutNumerators, reportReason, amount)
		if (outcomeStake.status === 'Winning') return await contributeToMarketDisputeOnTentativeOutcome(writeClient, market, outcomeStake.payoutNumerators, amount, reportReason)
		return await contributeToMarketDispute(writeClient, market, outcomeStake.payoutNumerators, amount, reportReason)
	}

	const handleReport = async () => {
		if (outcomeStakes.deepValue === undefined) throw new Error ('Outcome stakes missing')
		if (marketData.deepValue === undefined) throw new Error ('market data missing')
		if (amountInput.deepValue === undefined) throw new Error ('Input missing')
		if (marketData.deepValue.marketType === 'Scalar') {
			const numTicks = marketData.deepValue.numTicks
			const minPrice = marketData.deepValue?.displayPrices[0]
			const maxPrice = marketData.deepValue?.displayPrices[1]
			if (minPrice === undefined || maxPrice === undefined) throw new Error('displayPrices is undefined')
			const payoutNumerators = getPayoutNumeratorsFromScalarOutcome(selectedScalarOutcomeInvalid.value, selectedScalarOutcome.deepValue, minPrice, maxPrice, numTicks)
			const invalidOutcomeStake = outcomeStakes.deepValue.find((outcome) => areEqualArrays(outcome.payoutNumerators, payoutNumerators))
			const reportingOutcomeStake = invalidOutcomeStake !== undefined ? invalidOutcomeStake : {
				outcomeName: getOutcomeName(payoutNumerators, marketData.deepValue),
				repStake: 0n,
				status: 'Losing',
				payoutNumerators,
				alreadyContributedToOutcomeStake: undefined,
				universe: undefined
			} as const
			return await report(reportingOutcomeStake, reason.value, amountInput.deepValue)
		} else {
			if (selectedOutcome.value === null) throw new Error('Invalid input')
			const outcomeStake = outcomeStakes.deepValue.find((outcome) => outcome.outcomeName === selectedOutcome.value)
			if (!outcomeStake) throw new Error('Selected outcome not found')
			return await report(outcomeStake, reason.value, amountInput.deepValue)
		}
	}

	const setMaxStake = () => {
		if (maxStakeAmount.value === undefined || repBalance.deepValue === undefined) {
			amountInput.deepValue = 0n
			return
		}
		amountInput.deepValue = min(repBalance.deepValue, maxStakeAmount.value)
	}

	const minValue = useComputed(() => marketData.deepValue?.displayPrices[0] || 0n)
	const maxValue = useComputed(() => marketData.deepValue?.displayPrices[1] || 0n)
	const numTicks = useComputed(() => marketData.deepValue?.numTicks || 0n)
	const scalarDenomination = useComputed(() => marketData.deepValue?.parsedExtraInfo?._scalarDenomination || '')

	const selectedOutcomeUniverse = useSignal<UniverseInformation | undefined>(undefined)

	const ReportingComponent = useComputed(() => {
		if (marketData.deepValue === undefined) return <></>
		if (universe.value === undefined) return <></>
		if (marketData.deepValue.marketType === 'Scalar') {
			return <div key = { marketData.deepValue.marketAddress } style = { { display: 'grid', gridTemplateRows: 'max-content max-content', gap: '2rem', alignItems: 'center' } }>
				<ReportedScalarInputs universe = { universe.value } outcomeStakes = { outcomeStakes } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake }/>
				<ScalarInput refreshStakes = { refreshData } maybeWriteClient = { maybeWriteClient } universe = { universe } pathSignal = { pathSignal } selectedOutcomeUniverse = { selectedOutcomeUniverse } value = { selectedScalarOutcome } invalid = { selectedScalarOutcomeInvalid } minValue = { minValue } maxValue = { maxValue } numTicks = { numTicks } unit = { scalarDenomination } disabled = { areOutcomesDisabled } />
			</div>
		} else {
			return <MarketReportingOptionsForYesNoAndCategorical universe = { universe.value } outcomeStakes = { outcomeStakes } selectedOutcome = { selectedOutcome } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } isSlowReporting = { isSlowReporting } forkValues = { forkValues } areOutcomesDisabled = { areOutcomesDisabled } canInitialReport = { canInitialReport } marketData = { marketData }/>
		}
	})

	if (outcomeStakes.deepValue === undefined || forkValues.deepValue === undefined) return <div class = 'reporting-panel'>
		<h3>Market Reporting:</h3>
		<CenteredBigSpinner/>
	</div>

	return <div class = 'reporting-panel'>
		<h3>Market Reporting:</h3>
		{ isDisabled.value && (<div class = 'warning-box'> <p>The reporting window for this round is closed. Please check again in the next round.</p></div>)}
		{ ReportingComponent }
		<div>
			<label>
				<span style = { { fontWeight: '500', display: 'block', marginBottom: '0.25rem' } }>Reason:</span>
				<input
					type = 'text'
					class = 'reporting-panel-input'
					value = { reason.value }
					disabled = { isDisabled.value }
					placeholder = 'Optional: Explain why you believe this outcome is correct'
					onChange = { (event) => {
						const target = event.target as HTMLInputElement
						reason.value = target.value
					} }
				/>
			</label>
		</div>

		<div>
			<label>
				<span style = { { fontWeight: '500', display: 'block', marginBottom: '0.25rem' } }>Amount:</span>
				<div style = { { display: 'flex', alignItems: 'center', gap: '0.5em' } }>
					<Input
						class = 'input reporting-panel-input'
						type = 'text'
						placeholder = { useComputed(() => `${ getRepTokenName(universe.deepValue?.repTokenName) } to stake`) }
						disabled = { isDisabled.value }
						style = { { maxWidth: '300px' } }
						value = { amountInput }
						sanitize = { (amount: string) => amount.trim() }
						tryParse = { parse18DecimalBigintForInput }
						serialize = { serialize18DecimalBigintForInput }
					/>
					<span class = 'unit'>{ getRepTokenName(universe.deepValue?.repTokenName)  }</span>
					{ maxStakeAmount.value !== undefined && !isDisabled.value && (
						<>
							<span style = 'white-space: nowrap'>/ { bigintToRoundedDecimalString(maxStakeAmount.value, 18n, 2, true) } { getRepTokenName(universe.deepValue?.repTokenName)  }</span>
							<button class = 'button button-primary button-small' onClick = { setMaxStake }>Max</button>
							{ marketData.deepValue?.repBond !== undefined && isInitialReporting.value && (
								<span style = 'white-space: nowrap'>+ { bigintToRoundedDecimalString(marketData.deepValue.repBond, 18n, 2, true) } (initial reporter bond)</span>
							)}
						</>
					)}
				</div>
			</label>
		</div>

		<SendTransactionButton
			transactionStatus = { pendingTransactionStatus }
			sendTransaction = { handleReport }
			maybeWriteClient = { maybeWriteClient }
			disabled = { reportDisabled }
			text = { useComputed(() => selectedOutcomeName.value !== undefined && amountInput.deepValue !== undefined && !reportDisabled.value ? `Report "${ selectedOutcomeName.value }" for ${ bigintToRoundedDecimalString(amountInput.deepValue, 18n, 2, true) } ${ getRepTokenName(universe.deepValue?.repTokenName) }` : 'Report') }
			callBackWhenIncluded = { refreshData }
		/>
		<p> Every non-prestaking and non-initial report that is decided to be correct will receive a 40% return in current or forked REP tokens once the dispute is resolved.</p>
	</div>
}

interface ReportingHistoryProps {
	reportingHistory: Signal<readonly ReportingHistoryElement[]>
	marketData: OptionalSignal<MarketData>
	outcomeStakes: OptionalSignal<readonly OutcomeStake[]>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	universe: OptionalSignal<UniverseInformation>
	maybeReadClient: OptionalSignal<ReadClient>
}
export const ReportingHistory = ({ maybeReadClient, reportingHistory, marketData, outcomeStakes, forkValues, universe }: ReportingHistoryProps) => {
	const loadingReportingHistory = useSignal<boolean>(false)
	if (loadingReportingHistory.value || marketData.deepValue === undefined || outcomeStakes.deepValue === undefined || forkValues.deepValue === undefined) {
		return <div class = 'reporting-history'>
			<h3>Reporting History:</h3>
			<CenteredBigSpinner/>
		</div>
	}

	const reportingHistoryFetchDisabled = useComputed(() => {
		const currentMarketData = marketData.deepValue
		if (currentMarketData === undefined) return true
		if (maybeReadClient.deepValue === undefined) return true
		if (!(currentMarketData.reportingState === 'PreReporting' || currentMarketData.reportingState === 'OpenReporting' || currentMarketData.reportingState === 'DesignatedReporting')) return false
		return true
	})

	const fetchReportingHistory = async () => {
		const currentMarketData = marketData.deepValue
		reportingHistory.value = []
		if (currentMarketData === undefined) throw new Error('missing reporting history')
		if (maybeReadClient.deepValue === undefined) throw new Error('missing client')
		if ((currentMarketData.reportingState === 'PreReporting' || currentMarketData.reportingState === 'OpenReporting' || currentMarketData.reportingState === 'DesignatedReporting')) return

		if (fetchReportingHistoryAbortController !== undefined) fetchReportingHistoryAbortController.abort()
		const abortController = new AbortController()
		fetchReportingHistoryAbortController = abortController
		try {
			reportingHistory.value = await getReportingHistory(maybeReadClient.deepValue, currentMarketData.marketAddress, currentMarketData.disputeRound, abortController)
		} catch (error: unknown) {
			if (abortController.signal.aborted) return
			throw error
		}
	}

	const repTokenName = useComputed(() => getRepTokenName(universe.deepValue?.repTokenName))

	return <div class = 'reporting-history'>
		<h3>Reporting History:</h3>

		{ reportingHistory.value.map((round) => {
			if (marketData.deepValue === undefined) return <></>

			const marketType = marketData.deepValue.marketType
			if (marketType === undefined) throw new Error(`Invalid market type Id: ${ marketData.deepValue.marketType }`)
			const outcomeName = getOutcomeName(round.payoutNumerators, marketData.deepValue)

			return <div class = 'reporting-round'>
				<span><b>{ round.type } Round { round.round }</b></span>
				<span>Outcome: { outcomeName }</span>
				<span>Stake: { bigintToRoundedDecimalString(round.stake, 18n, 2) } { repTokenName.value }</span>
				<span>Size: { bigintToRoundedDecimalString(round.size, 18n, 2) } { repTokenName.value }</span>
			</div>
		})}

		<LoadingButton isLoading = { loadingReportingHistory } startLoading = { fetchReportingHistory } disabled = { reportingHistoryFetchDisabled } className = 'button loading-button button-secondary'>
			Fetch Reporting History
		</LoadingButton>

		<div class = 'reporting-summary'>
			<span><b>Total { repTokenName.value } Staked:</b> { bigintToRoundedDecimalString(outcomeStakes.deepValue.reduce((current, prev) => prev.repStake + current, 0n), 18n, 2, true) } { repTokenName.value }</span>
			<span><b>Forking Augur After:</b> { bigintToRoundedDecimalString(forkValues.deepValue.disputeThresholdForFork, 18n, 2, true) } { repTokenName.value } staked within one round</span>
		</div>

	</div>
}

interface ReportingProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	forkValues: OptionalSignal<Awaited<ReturnType<typeof getForkValues>>>
	currentTimeInBigIntSeconds: ReadonlySignal<bigint>
	selectedMarket: OptionalSignal<AccountAddress>
	repBalance: OptionalSignal<bigint>
	updateTokenBalancesSignal: Signal<number>
	showUnexpectedError: (error: unknown) => void
	isAugurExtraUtilitiesDeployedSignal: OptionalSignal<boolean>
	pathSignal: Signal<string>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
}

let refreshDataAbortController: AbortController | undefined = undefined

export const Reporting = ({ pathSignal, isAugurExtraUtilitiesDeployedSignal, updateTokenBalancesSignal, repBalance, maybeReadClient, maybeWriteClient, universe, forkValues, currentTimeInBigIntSeconds, selectedMarket, showUnexpectedError, universeForkingInformation }: ReportingProps) => {
	const marketData = useOptionalSignal<MarketData>(undefined)
	const validAugurMarket = useOptionalSignal<boolean>(undefined)
	const outcomeStakes = useOptionalSignal<readonly OutcomeStake[]>(undefined)
	const disputeWindowInfo = useOptionalSignal<Awaited<ReturnType<typeof getDisputeWindowInfo>>>(undefined)
	const preemptiveDisputeCrowdsourcerAddress = useOptionalSignal<AccountAddress>(undefined)
	const preemptiveDisputeCrowdsourcerStake = useOptionalSignal<bigint>(undefined)
	const reportingHistory = useSignal<readonly ReportingHistoryElement[]>([])
	const forkingMarketFinalized = useOptionalSignal<boolean>(undefined)
	const isMarketDisavowed = useOptionalSignal<boolean>(undefined)
	const winningUniverse = useOptionalSignal<UniverseInformation>(undefined)
	const pendingTransactionStatus = useSignal<TransactionStatus>(undefined)
	const loading = useSignal<boolean>(false)

	const finalizeDisabled = useComputed(() => {
		if (marketData.deepValue?.reportingState === 'Forking' && winningUniverse.deepValue !== undefined) return false
		if (marketData.deepValue?.reportingState === 'AwaitingFinalization') return false
		return true
	})
	const migrationDisabled = useComputed(() => marketData.deepValue?.reportingState !== 'AwaitingForkMigration')
	const showReporting = useComputed(() => {
		const state = marketData.deepValue?.reportingState
		if (state === undefined) return undefined
		return state === 'CrowdsourcingDispute' || state === 'DesignatedReporting' || state === 'OpenReporting' || state === 'AwaitingNextWindow'
	})

	const clear = () => {
		marketData.deepValue = undefined
		outcomeStakes.deepValue = undefined
		disputeWindowInfo.deepValue = undefined
		preemptiveDisputeCrowdsourcerAddress.deepValue = undefined
		preemptiveDisputeCrowdsourcerStake.deepValue = 0n
		reportingHistory.value = []
		isMarketDisavowed.deepValue = undefined
		winningUniverse.deepValue = undefined
		validAugurMarket.deepValue = undefined
	}

	useSignalEffect(() => {
		selectedMarket.deepValue // when user changes market, we should clear all market address related fields
		clear()
	})

	useSignalEffect(() => { refreshData(maybeReadClient.deepValue, selectedMarket.deepValue).catch(showUnexpectedError) })

	useSignalEffect(() => {
		// auto refresh page if dispute window has passed
		currentTimeInBigIntSeconds.value
		const data = marketData.deepPeek()
		if (data === undefined || loading.peek()) return
		const disputeInfo = disputeWindowInfo.deepPeek()
		if (disputeInfo !== undefined && currentTimeInBigIntSeconds.value > disputeInfo.startTime && data.reportingState == 'AwaitingNextWindow') {
			refreshData(maybeReadClient.deepPeek(), selectedMarket.deepPeek()).catch(showUnexpectedError)
		}
		else if (currentTimeInBigIntSeconds.value >= data.endTime && data.reportingState === 'PreReporting') {
			refreshData(maybeReadClient.deepPeek(), selectedMarket.deepPeek()).catch(showUnexpectedError)
		}
	})

	const refreshData = async (maybeReadClient: ReadClient | undefined, selectedMarket: AccountAddress | undefined) => {
		if (maybeReadClient === undefined) return
		if (selectedMarket === undefined) return
		if (universe.deepValue === undefined) return
		if (isAugurExtraUtilitiesDeployedSignal.deepValue !== true) return
		if (refreshDataAbortController !== undefined) refreshDataAbortController.abort()
		const abortController = new AbortController()
		refreshDataAbortController = abortController

		forkingMarketFinalized.deepValue = undefined
		isMarketDisavowed.deepValue = undefined
		winningUniverse.deepValue = undefined
		loading.value = true
		reportingHistory.value = []
		try {
			validAugurMarket.deepValue = await isValidAugurMarket(maybeReadClient, selectedMarket, abortController)
			if (validAugurMarket.deepValue === false) return
			const marketdataPromise = silenceChromeUnCaughtPromise(fetchMarketData(maybeReadClient, selectedMarket, abortController))
			const disputeWindowAddressPromise = silenceChromeUnCaughtPromise(getDisputeWindow(maybeReadClient, selectedMarket, abortController))
			const preemptiveDisputeCrowdsourcerAddressPromise = silenceChromeUnCaughtPromise(getPreemptiveDisputeCrowdsourcer(maybeReadClient, selectedMarket, abortController))
			marketData.deepValue = await marketdataPromise
			const currentMarketData = marketData.deepValue
			const getAllInterestingPayoutNumerators = async() => {
				const reportingParticipants = await getReportingParticipantsForMarket(maybeReadClient, currentMarketData.marketAddress, abortController)
				switch (currentMarketData.marketType) {
					case 'Categorical':
					case 'Yes/No': {
						// its possible for Augur to have "malformed payout numerators" being reported. Such as you can report 80% yes and 20% no on Yes/No market.
						// We get these (along with valid ones that exist in the data) with `getReportingParticipantsForMarket`
						// we merge all valid ones with all existing ones to get all interesting (as in either reported ones, or ones that make sense to report for) reporting options
						const allValidPayoutNumerators = getAllPayoutNumeratorCombinations(currentMarketData.numOutcomes, currentMarketData.numTicks)
						const allPayoutNumeratorsWithDuplicates = [...allValidPayoutNumerators.map((numerator) => ({ size: 0n, stake: 0n, payoutNumerators: numerator })), ...reportingParticipants]
						return aggregateByPayoutDistribution(allPayoutNumeratorsWithDuplicates)
					}
					case 'Scalar': return aggregateByPayoutDistribution(reportingParticipants)
					default: assertNever(currentMarketData.marketType)
				}
			}
			if (showReporting.value) {
				const allInterestingPayoutNumerators = await getAllInterestingPayoutNumerators()
				const winningOutcome = await getWinningPayoutNumerators(maybeReadClient, selectedMarket, abortController)
				const winningIndex = winningOutcome === undefined ? -1 : allInterestingPayoutNumerators.findIndex((outcome) => areEqualArrays(outcome.payoutNumerators, winningOutcome))
				outcomeStakes.deepValue = await promiseAllMapAbortSafe(allInterestingPayoutNumerators, async (info, index) => {
					const payoutNumerators = info.payoutNumerators
					const payoutHash = EthereumQuantity.parse(derivePayoutDistributionHash(payoutNumerators, currentMarketData.numTicks, currentMarketData.numOutcomes))
					return {
						outcomeName: getOutcomeName(payoutNumerators, currentMarketData),
						repStake: info.stake,
						status: index === winningIndex ? 'Winning' : (winningIndex === -1 ? 'Tie' : 'Losing'),
						payoutNumerators,
						alreadyContributedToOutcomeStake: (await getCrowdsourcerInfoByPayoutNumerator(maybeReadClient, currentMarketData.marketAddress, payoutHash, abortController))?.stake,
						universe: undefined
					}
				})
				const disputeWindowAddress = await disputeWindowAddressPromise
				if (EthereumAddress.parse(disputeWindowAddress) !== 0n) {
					disputeWindowInfo.deepValue = await getDisputeWindowInfo(maybeReadClient, disputeWindowAddress, abortController)
				} else {
					disputeWindowInfo.deepValue = undefined
				}
				preemptiveDisputeCrowdsourcerAddress.deepValue = await preemptiveDisputeCrowdsourcerAddressPromise
				if (EthereumAddress.parse(preemptiveDisputeCrowdsourcerAddress.deepValue) !== 0n) {
					preemptiveDisputeCrowdsourcerStake.deepValue = await getStakeOfReportingParticipant(maybeReadClient, preemptiveDisputeCrowdsourcerAddress.deepValue, abortController)
				} else {
					preemptiveDisputeCrowdsourcerStake.deepValue = undefined
				}
			} else {
				preemptiveDisputeCrowdsourcerStake.deepValue = undefined
				disputeWindowInfo.deepValue = undefined
				outcomeStakes.deepValue = undefined
			}

			if (currentMarketData.reportingState === 'Forking') {
				const forkingMarketPromise = silenceChromeUnCaughtPromise(isMarketFinalized(maybeReadClient, selectedMarket, abortController))
				const winningUniverseAddress = await getWinningChildUniverse(maybeReadClient, currentMarketData.universe.universeAddress, abortController)
				if (winningUniverseAddress !== undefined && BigInt(winningUniverseAddress) !== 0n) {
					winningUniverse.deepValue = await getUniverseInformation(maybeReadClient, winningUniverseAddress, false, abortController)
				} else {
					winningUniverse.deepValue = undefined
				}
				forkingMarketFinalized.deepValue = await forkingMarketPromise

				if (universeForkingInformation.deepValue?.isForking === false) {
					universeForkingInformation.deepValue = await getUniverseForkingInformation(maybeReadClient, universe.deepValue, abortController)
				}
			} else {
				forkingMarketFinalized.deepValue = false
				winningUniverse.deepValue = undefined
			}
		} catch (error: unknown) {
			if (abortController.signal.aborted) return
			throw error
		} finally {
			loading.value = false
		}
	}

	const refreshDataButton = async () => {
		updateTokenBalancesSignal.value++
		await refreshData(maybeReadClient.deepValue, selectedMarket.deepValue).catch(showUnexpectedError)
	}

	const finalizeMarketButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (marketData.deepValue === undefined) throw new Error('missing market data')
		return await finalizeMarket(writeClient, marketData.deepValue.marketAddress)
	}

	const refreshDisabled = useComputed(() => {
		if (isAugurExtraUtilitiesDeployedSignal.deepValue !== true) return true
		if (maybeReadClient.deepValue === undefined) return true
		if (selectedMarket.deepValue === undefined) return true
		if (universe.deepValue === undefined) return true
		return false
	})

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<div style = 'display: grid; width: 100%; gap: 10px;'>
				<Market loading = { loading } marketData = { marketData } universe = { universe } forkValues = { forkValues } disputeWindowInfo = { disputeWindowInfo } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds } addressComponent = { <>
					<div style = { { display: 'grid', gridTemplateColumns: 'auto min-content', gap: '0.5rem' } }>
						<Input
							style = 'height: fit-content;'
							key = 'market-reporting-input'
							class = 'input'
							type = 'text'
							width = '100%'
							placeholder = 'Market address'
							value = { selectedMarket }
							sanitize = { (addressString: string) => addressString }
							tryParse = { parseAddressForInput }
							serialize = { serializeAddressForInput }
						/>
						<LoadingButton isLoading = { loading } startLoading = { refreshDataButton } disabled = { refreshDisabled }>
							Refresh
						</LoadingButton>
					</div>
				</> }>
					{ showReporting.value === true ? <>
						<ReportingHistory universe = { universe } maybeReadClient = { maybeReadClient } marketData = { marketData } reportingHistory = { reportingHistory } outcomeStakes = { outcomeStakes } forkValues = { forkValues }/>
						<DisplayStakes pathSignal = { pathSignal } universe = { universe } repBalance = { repBalance } outcomeStakes = { outcomeStakes } marketData = { marketData } maybeWriteClient = { maybeWriteClient } preemptiveDisputeCrowdsourcerStake = { preemptiveDisputeCrowdsourcerStake } disputeWindowInfo = { disputeWindowInfo } forkValues = { forkValues } refreshData = { refreshDataButton }/>
					</> : <></> }
					{ marketData.deepValue === undefined || finalizeDisabled.value ? <> </> : <>
						<SendTransactionButton
							transactionStatus = { pendingTransactionStatus }
							sendTransaction = { finalizeMarketButton }
							maybeWriteClient = { maybeWriteClient }
							disabled = { finalizeDisabled }
							text = { useComputed(() => 'Finalize Market') }
							callBackWhenIncluded = { refreshDataButton }
						/>
					</> }
					<ForkMigration universe = { universe } pathSignal = { pathSignal } forkingMarketFinalized = { forkingMarketFinalized } marketData = { marketData } maybeWriteClient = { maybeWriteClient } outcomeStakes = { outcomeStakes } disabled = { migrationDisabled } refreshData = { refreshDataButton }/>
				</Market>
				{ validAugurMarket.deepValue === false ? <>
					<p> Not a valid Augur V2 market </p>
				</> : <></> }
			</div>
		</section>
	</div>
}
