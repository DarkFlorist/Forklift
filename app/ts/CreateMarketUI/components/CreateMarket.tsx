import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { createCategoricalMarket, createYesNoMarket, estimateGasCreateCategoricalMarket, estimateGasCreateYesNoMarket, getCreatedMarketAddressFromTransactionhash, getMarketRepBondForNewMarket, getMaximumMarketEndDate, getUniverseForkingInformation, getValidityBond } from '../../utils/augurContractUtils.js'
import { OptionalSignal, useOptionalSignal } from '../../utils/OptionalSignal.js'
import { AccountAddress, UniverseInformation } from '../../types/types.js'
import { AUGUR_CONTRACT, DAI_TOKEN_ADDRESS } from '../../utils/constants.js'
import { bigintToRoundedDecimalStringWithUnknown, bigintToRoundedDecimalStringWithUnknownAndPracticallyInfinite, formatUnixTimestampIso } from '../../utils/ethereumUtils.js'
import { approveErc20Token, getAllowanceErc20Token } from '../../utils/erc20.js'
import { ReadClient, WriteClient } from '../../utils/ethereumWallet.js'
import { currentDateInAYear, dateToBigintSeconds, formatDateForDatetimeLocal, isNumeric } from '../../utils/utils.js'
import { useEffect, useState } from 'preact/hooks'
import { Input } from '../../SharedUI/Input.js'
import { useThrottledSignalEffect } from '../../SharedUI/useThrottledSignalEffect.js'
import { ContractFunctionExecutionError } from 'viem'
import { SendTransactionButton, TransactionStatus } from '../../SharedUI/SendTransactionButton.js'
import { getRepTokenName } from '../../utils/augurUtils.js'
import { assertNever } from '../../utils/errorHandling.js'
import { MarketLink } from '../../SharedUI/links.js'
import { parse16DecimalBigintForInput, parse18DecimalBigintForInput, parseAddressForInput, parseCommaSeparatedString, serialize16DecimalBigintForInput, serialize18DecimalBigintForInput, serializeAddressForInput, serializeCommaSeparatedString } from '../../utils/inputParsing.js'

interface AllowancesProps {
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	marketCreationCostDai: OptionalSignal<bigint>
	marketCreationCostRep: OptionalSignal<bigint>
	allowedRep: OptionalSignal<bigint>
	allowedDai: OptionalSignal<bigint>
	showUnexpectedError: (error: unknown) => void
}

export const Allowances = ( { maybeWriteClient, universe, marketCreationCostDai, marketCreationCostRep, allowedRep, allowedDai, showUnexpectedError }: AllowancesProps) => {
	const daiAllowanceToBeSet = useOptionalSignal<bigint>(undefined)
	const repAllowanceToBeSet = useOptionalSignal<bigint>(undefined)

	const daiAllowanceTransactionStatus = useSignal<TransactionStatus>(undefined)
	const repAllowanceTransactionStatus = useSignal<TransactionStatus>(undefined)

	const cannotSetDaiAllowance = useComputed(() => {
		if (maybeWriteClient.deepValue === undefined) return true
		if (daiAllowanceToBeSet.deepValue === undefined || daiAllowanceToBeSet.deepValue <= 0n) return true
		return false
	})
	const cannotSetRepAllowance = useComputed(() => {
		if (maybeWriteClient.deepValue === undefined) return true
		if (universe.deepValue === undefined) return true
		if (repAllowanceToBeSet.deepValue === undefined || repAllowanceToBeSet.deepValue <= 0n) return true
		return false
	})

	const approveRep = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (universe.deepValue === undefined) throw new Error('missing universe')
		if (repAllowanceToBeSet.deepValue === undefined || repAllowanceToBeSet.deepValue <= 0n) throw new Error('not valid allowance')
		return await approveErc20Token(writeClient, universe.deepValue.reputationTokenAddress, universe.deepValue.universeAddress, repAllowanceToBeSet.deepValue)
	}

	const approveDai = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (daiAllowanceToBeSet.deepValue === undefined || daiAllowanceToBeSet.deepValue <= 0n) throw new Error('not valid allowance')
		return await approveErc20Token(writeClient, DAI_TOKEN_ADDRESS, AUGUR_CONTRACT, daiAllowanceToBeSet.deepValue)
	}

	const refreshBalances = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (universe.deepValue === undefined) throw new Error('missing universe')
		try {
			allowedDai.deepValue = await getAllowanceErc20Token(writeClient, DAI_TOKEN_ADDRESS, writeClient.account.address, AUGUR_CONTRACT)
			allowedRep.deepValue = await getAllowanceErc20Token(writeClient, universe.deepValue.reputationTokenAddress, writeClient.account.address, universe.deepValue.universeAddress)
		} catch(error: unknown) {
			return showUnexpectedError(error)
		}
	}

	function setMaxRepAllowance() {
		repAllowanceToBeSet.deepValue = 2n ** 256n - 1n
	}
	function setMaxDaiAllowance() {
		daiAllowanceToBeSet.deepValue = 2n ** 256n - 1n
	}

	const getAllowanceColor = ((allowed: bigint | undefined, required: bigint | undefined) => {
		if (allowed === undefined || required === undefined) return 'white'
		if (allowed < required) return '#b43c42'
		return 'rgb(0, 255, 198)'
	})

	const daiAllowance = useComputed(() => {
		const daiAmount = bigintToRoundedDecimalStringWithUnknownAndPracticallyInfinite(allowedDai.deepValue, 18n, 2)
		const required = bigintToRoundedDecimalStringWithUnknown(marketCreationCostDai.deepValue, 18n, 2, true)
		return <p style = { `margin: 0; color: ${ getAllowanceColor(allowedDai.deepValue, marketCreationCostDai.deepValue) }` }>Allowed <b>{ daiAmount }</b> DAI (required: { required }) </p>
	})

	const repAllowance = useComputed(() => {
		const repAmount = bigintToRoundedDecimalStringWithUnknownAndPracticallyInfinite(allowedRep.deepValue, 18n, 2)
		const repTokenName = getRepTokenName(universe.deepValue?.repTokenName)
		const required = bigintToRoundedDecimalStringWithUnknown(marketCreationCostRep.deepValue, 18n, 2, true)
		return <p style = { `margin: 0; color: ${ getAllowanceColor(allowedRep.deepValue, marketCreationCostRep.deepValue) }` }>Allowed <b>{ repAmount }</b> { repTokenName } (required: { required }) </p>
	})

	const repTokenName = useComputed(() => getRepTokenName(universe.deepValue?.repTokenName))
	return <div class = 'form-grid'>
		<h3>Allowances</h3>
		<div style = { { display: 'grid', gap: '0.5em', gridTemplateColumns: 'auto auto auto' } }>
			{ daiAllowance }
			<div style = { { display: 'flex', alignItems: 'baseline', gap: '0.5em' } }>
				<Input
					class = 'input reporting-panel-input'
					type = 'text'
					placeholder = { '' }
					style = { { maxWidth: '100px' } }
					value = { daiAllowanceToBeSet }
					sanitize = { (amount: string) => amount.trim() }
					tryParse = { parse18DecimalBigintForInput }
					serialize = { serialize18DecimalBigintForInput }
				/>
				<span class = 'unit'>DAI</span>
				<button class = 'button button-secondary button-small ' style = { { whiteSpace: 'nowrap' } } onClick = { setMaxDaiAllowance }>Max</button>
			</div>
			<SendTransactionButton
				className = 'button button-secondary button-small'
				style = { { width: '100%', whiteSpace: 'nowrap' } }
				transactionStatus = { daiAllowanceTransactionStatus }
				sendTransaction = { approveDai }
				maybeWriteClient = { maybeWriteClient }
				disabled = { cannotSetDaiAllowance }
				text = { useComputed(() => 'Set DAI allowance') }
				callBackWhenIncluded = { refreshBalances }
			/>
			{ repAllowance }
			<div style = { { display: 'flex', alignItems: 'baseline', gap: '0.5em' } }>
				<Input
					class = 'input reporting-panel-input'
					type = 'text'
					placeholder = ''
					style = { { maxWidth: '100px' } }
					value = { repAllowanceToBeSet }
					sanitize = { (amount: string) => amount.trim() }
					tryParse = { parse18DecimalBigintForInput }
					serialize = { serialize18DecimalBigintForInput }
				/>
				<span class = 'unit'>{ repTokenName.value }</span>
				<button class = 'button button-secondary button-small' style = { { whiteSpace: 'nowrap' } } onClick = { setMaxRepAllowance }>Max</button>
			</div>
			<SendTransactionButton
				className = 'button button-secondary button-small'
				style = { { width: '100%', whiteSpace: 'nowrap' } }
				transactionStatus = { repAllowanceTransactionStatus }
				sendTransaction = { approveRep }
				maybeWriteClient = { maybeWriteClient }
				disabled = { cannotSetRepAllowance }
				text = { useComputed(() => `Set ${ getRepTokenName(universe.deepValue?.repTokenName) } allowance`) }
				callBackWhenIncluded = { refreshBalances }
			/>
		</div>
	</div>
}

interface CostsParams {
	marketCreationCostDai: OptionalSignal<bigint>
	marketCreationCostRep: OptionalSignal<bigint>
	baseFee: OptionalSignal<bigint>
	marketCreationGasCost: OptionalSignal<bigint>
	universe: OptionalSignal<UniverseInformation>
}

export const Costs = ( { marketCreationCostDai, marketCreationCostRep, baseFee, marketCreationGasCost, universe }: CostsParams) => {
	const ethCost = useComputed(() => marketCreationGasCost.deepValue === undefined || baseFee.deepValue === undefined ? '?' : bigintToRoundedDecimalStringWithUnknown(marketCreationGasCost.deepValue * baseFee.deepValue, 18n, 6, true))
	const repTokenName = useComputed(() => getRepTokenName(universe.deepValue?.repTokenName))
	return <p>
		It costs <b> { ethCost.value } ETH</b> (gas cost), <b>{ bigintToRoundedDecimalStringWithUnknown(marketCreationCostDai.deepValue, 18n, 2, true) } DAI </b> and <b>{ bigintToRoundedDecimalStringWithUnknown(marketCreationCostRep.deepValue, 18n, 2, true) } { repTokenName.value }</b> to create a market. The { repTokenName.value } will be returned to you after a successful initial report and the DAI will be returned to you if the market resolves to non-invalid.
	</p>
}

interface CreateYesNoMarketProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	universe: OptionalSignal<UniverseInformation>
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	daiBalance: OptionalSignal<bigint>
	repBalance: OptionalSignal<bigint>
	updateTokenBalancesSignal: Signal<number>
	showUnexpectedError: (error: unknown) => void
	pathSignal: Signal<string>
}

const affiliateFeeOptions = [0, 1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 75, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((divisor) => ({
	id: divisor,
	name: divisor === 0 ? "0.00%" : `${ (100 / divisor).toFixed(2) }%`
}))

const outcomeOptions = [
	'yes-no',
	'categorical with 2 outcomes',
	'categorical with 3 outcomes',
	'categorical with 4 outcomes',
	'categorical with 5 outcomes',
	'categorical with 6 outcomes',
	'categorical with 7 outcomes'
] as const

const getNumberOfOutcomesToName = (outcomeOption: typeof outcomeOptions[number]) => {
	switch(outcomeOption) {
		case 'yes-no': return 0
		case 'categorical with 2 outcomes': return 2
		case 'categorical with 3 outcomes': return 3
		case 'categorical with 4 outcomes': return 4
		case 'categorical with 5 outcomes': return 5
		case 'categorical with 6 outcomes': return 6
		case 'categorical with 7 outcomes': return 7
		default: assertNever(outcomeOption)
	}
}

export const CreateYesNoMarket = ({ universeForkingInformation, updateTokenBalancesSignal, maybeReadClient, maybeWriteClient, universe, daiBalance, repBalance, showUnexpectedError, pathSignal }: CreateYesNoMarketProps) => {
	const endTime = useSignal<Date | undefined>(undefined)
	const feePerCashInAttoCash = useOptionalSignal<bigint>(0n)
	const affiliateValidator = useOptionalSignal<AccountAddress>('0x0000000000000000000000000000000000000000')
	const affiliateFeeDivisor = useOptionalSignal<number>(0)
	const designatedReporterAddress = useOptionalSignal<AccountAddress>(undefined)
	const description = useSignal<string>('')
	const longDescription = useSignal<string>('')
	const categories = useOptionalSignal<readonly string[]>(undefined)
	const tags = useOptionalSignal<readonly string[]>(undefined)
	const maximumMarketEndData = useOptionalSignal<bigint>(undefined)
	const marketCreationCostRep = useOptionalSignal<bigint>(undefined)
	const marketCreationCostDai = useOptionalSignal<bigint>(undefined)
	const allowedDai = useOptionalSignal<bigint>(undefined)
	const allowedRep = useOptionalSignal<bigint>(undefined)
	const marketCreationGasCost = useOptionalSignal<bigint>(undefined)
	const baseFee = useOptionalSignal<bigint>(undefined)
	const pendingCreateMarketTransactionStatus = useSignal<TransactionStatus>(undefined)
	const marketCreatedAddress = useSignal<AccountAddress | undefined>(undefined)

	const marketTypeWithNumberOfOutcomes = useSignal<typeof outcomeOptions[number]>('yes-no')

	const outcomeName = [1, 2, 3, 4, 5, 6, 7].map(() => useOptionalSignal<string>(undefined))

	const isUniverseForking = useComputed(() => universeForkingInformation.deepValue?.isForking)

	const refresh = async (readClient: ReadClient | undefined, writeClient: WriteClient | undefined, universe: UniverseInformation | undefined) => {
		if (isUniverseForking.value != false) return
		if (readClient === undefined) return
		baseFee.deepValue = (await readClient.getBlock()).baseFeePerGas || undefined
		maximumMarketEndData.deepValue = await getMaximumMarketEndDate(readClient)
		if (universe === undefined) return
		marketCreationCostRep.deepValue = await getMarketRepBondForNewMarket(readClient, universe.universeAddress)
		marketCreationCostDai.deepValue = await getValidityBond(readClient, universe.universeAddress)
		if (writeClient === undefined) return
		allowedRep.deepValue = await getAllowanceErc20Token(writeClient, universe.reputationTokenAddress, writeClient?.account.address, universe.universeAddress)
		allowedDai.deepValue = await getAllowanceErc20Token(writeClient, DAI_TOKEN_ADDRESS, writeClient?.account.address, AUGUR_CONTRACT)
	}

	useEffect(() => {
		designatedReporterAddress.deepValue = maybeWriteClient.deepValue?.account.address
	}, [maybeWriteClient.deepValue?.account.address])

	useSignalEffect(() => { refresh(maybeReadClient.deepValue, maybeWriteClient.deepValue, universe.deepValue).catch(showUnexpectedError) })

	const createMarketIssue = useComputed(() => {
		if (endTime.value === undefined) return 'Market end date has not been set'
		const seconds = dateToBigintSeconds(endTime.value)
		if (maximumMarketEndData.deepValue === undefined) return 'End Date has not been fetch'
		if (seconds > maximumMarketEndData.deepValue) return 'Market End data is too far in future'
		if (affiliateValidator.deepValue === undefined) return 'Affiliate validator is missing'
		if (affiliateFeeDivisor.deepValue === undefined) return 'Affiliate fee divisor is missing'
		if (designatedReporterAddress.deepValue === undefined) return 'Designated reporter is missing'
		if (description.value.length === 0) return 'Description is empty'
		if (longDescription.value.length === 0) return 'Long Description is empty'
		if (marketCreationCostRep.deepValue === undefined) return 'Market Creation Cost Rep is missing'
		if (marketCreationCostDai.deepValue === undefined) return 'Market Creation Cost Dai is missing'
		if (allowedRep.deepValue === undefined) return 'Could not fetch allowed REP'
		if (allowedDai.deepValue === undefined) return 'Could not fetch allowed Dai'
		if (allowedRep.deepValue < marketCreationCostRep.deepValue) return 'REP Allowance is not high enough'
		if (allowedDai.deepValue < marketCreationCostDai.deepValue) return 'DAI Allowance is not high enough'
		if (repBalance.deepValue === undefined) return 'Could not fetch REP Balance'
		if (daiBalance.deepValue === undefined) return 'Could not fetch DAI Balance'
		if (repBalance.deepValue < marketCreationCostRep.deepValue) return 'REP Balance is not high enough'
		if (daiBalance.deepValue < marketCreationCostDai.deepValue) return 'DAI Balance is not high enough'
		if (isUniverseForking.value !== false) return 'Universe is forking'
		if (marketTypeWithNumberOfOutcomes.value !== 'yes-no') {
			const outcomesToName = getNumberOfOutcomesToName(marketTypeWithNumberOfOutcomes.value)
			for (let i = 0; i < outcomesToName; i++) {
				if (outcomeName[i]?.deepValue === undefined || outcomeName[i]?.deepValue?.length === 0) return `Outcome Name ${ i + 1 } is missing`
			}
		}
		return undefined
	})

	const createMarketDisabled = useComputed(() => {
		if (universe.deepValue === undefined) return true
		return createMarketIssue.value !== undefined
	})

	const getOutComeNamesArray = () => {
		const nOutcomes = getNumberOfOutcomesToName(marketTypeWithNumberOfOutcomes.value)
		const outcomes = Array.from({ length: nOutcomes }, (_, index) => index).map((index) => outcomeName[index]?.deepValue).filter((deepValue): deepValue is string => deepValue !== undefined)
		if (outcomes.length !== nOutcomes) throw new Error('length mismath')
		return outcomes
	}

	const createMarket = async () => {
		marketCreatedAddress.value = undefined
		if (universe.deepValue === undefined) throw new Error('missing universe')
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (endTime.value === undefined) throw new Error('missing endTime')
		const marketEndTimeUnixTimeStamp = dateToBigintSeconds(endTime.value)
		if (affiliateValidator.deepValue === undefined) throw new Error('missing affiliateValidator')
		if (affiliateFeeDivisor.deepValue === undefined) throw new Error('missing affiliateFeeDivisor')
		if (designatedReporterAddress.deepValue === undefined) throw new Error('missing designatedReporterAddress')
		if (description.value.length === 0) throw new Error('missing description')
		if (feePerCashInAttoCash.deepValue === undefined) throw new Error('missing feePerCashInAttoCash')
		const extraInfoString = JSON.stringify({
			description: description.value,
			longDescription: longDescription.value,
			categories: categories.deepValue?.filter((element) => element.length > 0) || [],
			tags: tags.deepValue?.filter((element) => element.length > 0) || []
		})
		if (marketTypeWithNumberOfOutcomes.value === 'yes-no') {
			return await createYesNoMarket(universe.deepValue.universeAddress, writeClient, marketEndTimeUnixTimeStamp, feePerCashInAttoCash.deepValue, affiliateValidator.deepValue, BigInt(affiliateFeeDivisor.deepValue), designatedReporterAddress.deepValue, extraInfoString)
		}
		return await createCategoricalMarket(universe.deepValue.universeAddress, writeClient, marketEndTimeUnixTimeStamp, feePerCashInAttoCash.deepValue, affiliateValidator.deepValue, BigInt(affiliateFeeDivisor.deepValue), designatedReporterAddress.deepValue, getOutComeNamesArray(), extraInfoString)
	}

	useThrottledSignalEffect(() => {
		feePerCashInAttoCash.deepValue
		affiliateValidator.deepValue
		affiliateFeeDivisor.deepValue
		designatedReporterAddress.deepValue
		description.value
		longDescription.value
		categories.deepValue
		tags.deepValue
		allowedRep.deepValue
		allowedDai.deepValue
		repBalance.deepValue
		daiBalance.deepValue
		marketCreationCostDai.deepValue
		marketCreationCostRep.deepValue
		endTime.value
		marketTypeWithNumberOfOutcomes.value
		maximumMarketEndData.value
		return () => {
			const marketEndTimeUnixTimeStamp = endTime.value !== undefined ? dateToBigintSeconds(endTime.value) : maximumMarketEndData.deepValue
			const extraInfoString = JSON.stringify({
				description: description.value,
				longDescription: longDescription.value,
				categories: categories.deepValue?.filter((element) => element.length > 0) || [],
				tags: tags.deepValue?.filter((element) => element.length > 0) || []
			})
			const feePerCashInAttoCashValue = feePerCashInAttoCash.deepValue || 0n
			const affiliateValidatorValue = affiliateValidator.deepValue || '0x0000000000000000000000000000000000000000'
			const affiliateFeeDivisorValue = affiliateFeeDivisor.deepValue || 0
			const designatedReporterAddressValue = designatedReporterAddress.deepValue || '0x0000000000000000000000000000000000000000'
			const estimate = async () => {
				const canEstimate = () => {
					if (universe.deepValue === undefined) return false
					if (maybeReadClient.deepPeek() === undefined) return false
					if (marketEndTimeUnixTimeStamp === undefined) return false
					if (marketCreationCostRep.deepValue === undefined) return false
					if (marketCreationCostDai.deepValue === undefined) return false
					if (allowedRep.deepValue === undefined) return false
					if (allowedDai.deepValue === undefined) return false
					if (allowedRep.deepValue < marketCreationCostRep.deepValue) return false
					if (allowedDai.deepValue < marketCreationCostDai.deepValue) return false
					if (repBalance.deepValue === undefined) return false
					if (daiBalance.deepValue === undefined) return false
					if (repBalance.deepValue < marketCreationCostRep.deepValue) return false
					if (daiBalance.deepValue < marketCreationCostDai.deepValue) return false
					return true
				}
				if (!canEstimate()) {
					marketCreationGasCost.deepValue = undefined
					return
				}

				if (universe.deepValue === undefined) return
				const readClient = maybeReadClient.deepPeek()
				if (readClient === undefined) return
				if (marketEndTimeUnixTimeStamp === undefined) return
				try {
					if (marketTypeWithNumberOfOutcomes.value === 'yes-no') {
				    	marketCreationGasCost.deepValue = await estimateGasCreateYesNoMarket(universe.deepValue.universeAddress, readClient, marketEndTimeUnixTimeStamp, feePerCashInAttoCashValue, affiliateValidatorValue, BigInt(affiliateFeeDivisorValue), designatedReporterAddressValue, extraInfoString)
					} else {
						const outcomesToName = getNumberOfOutcomesToName(marketTypeWithNumberOfOutcomes.value)
						for (let i = 0; i < outcomesToName; i++) {
							if (outcomeName[i]?.deepValue === undefined || outcomeName[i]?.deepValue?.length === 0) return
						}
						marketCreationGasCost.deepValue = await estimateGasCreateCategoricalMarket(universe.deepValue.universeAddress, readClient, marketEndTimeUnixTimeStamp, feePerCashInAttoCashValue, affiliateValidatorValue, BigInt(affiliateFeeDivisorValue), designatedReporterAddressValue, getOutComeNamesArray(), extraInfoString)
					}
				} catch(error: unknown) {
					marketCreationGasCost.deepValue = undefined
					if (error instanceof ContractFunctionExecutionError) return
					showUnexpectedError(error)
				}
			}
			estimate()
		}
	}, 5000)

	function handleEndTimeInput(value: string) {
		endTime.value = new Date(value)
	}
	function handleAffiliateFee(value: string) {
		if (!isNumeric(value)) throw new Error('Affiliate fee is not numeric')
		affiliateFeeDivisor.deepValue = Number(value)
	}
	function handlemarketTypeWithNumberOfOutcomes(value: typeof outcomeOptions[number]) {
		marketTypeWithNumberOfOutcomes.value = value
	}

	function handleDescription(value: string) {
		description.value = value
	}
	function handleLongDescription(value: string) {
		longDescription.value = value
	}

	const marketCreated = async (transactionHash: `0x${ string }`) => {
		updateTokenBalancesSignal.value++
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) throw new Error('missing readClient')
		if (universe.deepValue === undefined) throw new Error('universe address')
		marketCreatedAddress.value = await getCreatedMarketAddressFromTransactionhash(readClient, transactionHash)
	}

	if (isUniverseForking.value === undefined) return <></>

	if (isUniverseForking.value === true) {
		return  <div class = 'subApplication'>
			<section class = 'subApplication-card'>
				<p> Market creation disabled due to an universe fork.</p>
			</section>
		</div>
	}

	const numberOfOutcomesToName = useComputed(() => {
		return getNumberOfOutcomesToName(marketTypeWithNumberOfOutcomes.value)
	})

	const [OutcomeNamesChooser] = useState(() => () => {
		return Array.from({ length: numberOfOutcomesToName.value }, (_, index) => index).map((index) => {
			if (outcomeName[index] === undefined) throw new Error('index overflow')
			return <input
				class = 'input'
				type = 'text'
				key = { index }
				placeholder = { `Outcome ${ index + 1 }` }
				value = { outcomeName[index].value }
				onInput = { (e) => {
					const nameSignal = outcomeName[index]
					if (nameSignal === undefined) throw new Error('index overflow')
					nameSignal.deepValue = e.currentTarget.value
				} }
			/>
		})
	})

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<div class = 'form-grid'>
				<div class = 'form-group'>
					<label>Title</label>
					<input
						class = 'input'
						type = 'text'
						placeholder = 'How many goats...'
						value = { description.value }
						onInput = { e => handleDescription(e.currentTarget.value) }
					/>
				</div>

				<div class = 'form-group'>
					<label>
						End Time (UTC){ ' ' }
						{ maximumMarketEndData.deepValue !== undefined && (
							<span class = 'note-text'>
								(Latest allowed date { formatUnixTimestampIso(maximumMarketEndData.deepValue) })
							</span>
						) }
					</label>
					<input
						class = 'input'
						min = { formatDateForDatetimeLocal(new Date()) }
						max = { formatDateForDatetimeLocal(maximumMarketEndData.deepValue !== undefined ? new Date(Number(maximumMarketEndData.deepValue) * 1000) : currentDateInAYear()) }
						type = 'datetime-local'
						onInput = { e => handleEndTimeInput(e.currentTarget.value) }
					/>
				</div>

				<div class = 'form-group'>
					<label>Market Creator Fee (%)</label>
					<Input
						class = 'input reporting-panel-input'
						type = 'text'
						placeholder = '0'
						disabled = { useSignal(false) }
						value = { feePerCashInAttoCash }
						sanitize = { (amount: string) => amount.trim() }
						tryParse = { parse16DecimalBigintForInput }
						serialize = { serialize16DecimalBigintForInput }
					/>
				</div>

				<div class = 'form-group'>
					<label>Affiliate Validator Address</label>
					<Input
						style = 'height: fit-content;'
						key = 'affiliateValidator-address'
						class = 'input'
						type = 'text'
						width = '100%'
						placeholder = '0x...'
						value = { affiliateValidator }
						sanitize = { (addressString: string) => addressString }
						tryParse = { parseAddressForInput }
						serialize = { serializeAddressForInput }
					/>
				</div>

				<div class = 'form-group'>
					<label>Affiliate Fee (%)</label>
					<select class = 'styled-select' onInput = { e => handleAffiliateFee(e.currentTarget.value) } value = { affiliateFeeOptions.find(f => f.id === affiliateFeeDivisor.deepValue)?.id }>
						{ affiliateFeeOptions.map(fee => (
							<option key = { fee.id } value = { fee.id }>
								{ fee.name }
							</option>
						)) }
					</select>
				</div>

				<div class = 'form-group'>
					<label>Designated Reporter Address</label>
					<Input
						style = 'height: fit-content;'
						key = 'designated-reporter-address'
						class = 'input'
						type = 'text'
						width = '100%'
						placeholder = '0x...'
						value = { designatedReporterAddress }
						sanitize = { (addressString: string) => addressString }
						tryParse = { parseAddressForInput }
						serialize = { serializeAddressForInput }
					/>
				</div>

				<div class = 'form-group'>
					<label>Long Description</label>
					<textarea
						class = 'input'
						placeholder = 'This market resolves...'
						style = { { minHeight: '100px', height: '200px',resize: 'vertical' } }
						value = { longDescription.value }
						onInput = { e => handleLongDescription(e.currentTarget.value) }
					/>
				</div>

				<div class = 'form-group'>
					<label>Categories (comma separated)</label>
					<Input
						style = 'height: fit-content;'
						key = 'designated-reporter-address'
						class = 'input'
						type = 'text'
						width = '100%'
						placeholder = 'Cryptocurrency, goats'
						value = { categories }
						sanitize = { (categoryString: string) => categoryString }
						tryParse = { parseCommaSeparatedString }
						serialize = { serializeCommaSeparatedString }
					/>
				</div>

				<div class = 'form-group'>
					<label>Tags (comma separated)</label>
					<Input
						style = 'height: fit-content;'
						key = 'designated-reporter-address'
						class = 'input'
						type = 'text'
						width = '100%'
						placeholder = 'Tardigrades, Eggs'
						value = { tags }
						sanitize = { (tagsString: string) => tagsString }
						tryParse = { parseCommaSeparatedString }
						serialize = { serializeCommaSeparatedString }
					/>
				</div>

				<div class = 'form-group' style = 'gap: 0.5em;'>
					<label>Outcomes</label>
					<select class = 'styled-select' onInput = { e => handlemarketTypeWithNumberOfOutcomes(e.currentTarget.value as typeof outcomeOptions[number]) } value = { outcomeOptions.find(f => f === marketTypeWithNumberOfOutcomes.value) }>
						{ outcomeOptions.map(outcomes => (
							<option key = { outcomes } value = { outcomes }>
								{ outcomes }
							</option>
						)) }
					</select>
					<OutcomeNamesChooser/>
				</div>
			</div>

			<Allowances maybeWriteClient = { maybeWriteClient } universe = { universe } marketCreationCostRep = { marketCreationCostRep } marketCreationCostDai = { marketCreationCostDai } allowedRep = { allowedRep } allowedDai = { allowedDai } showUnexpectedError = { showUnexpectedError }/>

			<Costs universe = { universe } marketCreationCostRep = { marketCreationCostRep } marketCreationCostDai = { marketCreationCostDai } baseFee = { baseFee } marketCreationGasCost = { marketCreationGasCost }/>
			<div>
				<div class = 'button-group'>
					<SendTransactionButton
						className = 'button button-primary button-group-button'
						transactionStatus = { pendingCreateMarketTransactionStatus }
						sendTransaction = { createMarket }
						maybeWriteClient = { maybeWriteClient }
						disabled = { createMarketDisabled }
						text = { useComputed(() => 'Create Market') }
						callBackWhenIncluded = { marketCreated }
					/>
				</div>
				{ createMarketIssue.value === undefined ? <></> : <p class = 'error-component'> { createMarketIssue.value } </p> }
				{ marketCreatedAddress.value !== undefined ? <p> Market Created!: <MarketLink address = { marketCreatedAddress } pathSignal = { pathSignal }/> </p> : <></> }
			</div>
		</section>
	</div>
}
