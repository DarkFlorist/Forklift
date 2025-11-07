import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { EthereumQuantity } from '../types/types.js'
import { migrateFromRepV1toRepV2GenesisToken } from '../utils/augurContractUtils.js'
import { approveErc20Token, getAllowanceErc20Token, getErc20TokenBalance } from '../utils/erc20.js'
import { GENESIS_REPUTATION_V2_TOKEN_ADDRESS, REPUTATION_V1_TOKEN_ADDRESS } from '../utils/constants.js'
import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'
import { CenteredBigSpinner } from '../SharedUI/Spinner.js'
import { SendTransactionButton, TransactionStatus } from '../SharedUI/SendTransactionButton.js'

interface RepV1MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	updateTokenBalancesSignal: Signal<number>
}

const Info = ({ text }: { text: string }) => {
	return <div class = 'claim-option'>
		<div class = 'claim-info'>
			<span>
				{ text }
			</span>
		</div>
	</div>
}

export const RepV1Migration = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient }: RepV1MigrationProps) => {
	const v2ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const v1ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const isRepV1ApprovedForMigration = useOptionalSignal<boolean>(true)

	const pendingApproveTransactionStatus = useSignal<TransactionStatus>(undefined)
	const pendingMigrateTransactionStatus = useSignal<TransactionStatus>(undefined)

	useSignalEffect(() => {
		update(maybeReadClient.deepValue).catch(console.error)
	})

	const update = async (readClient: ReadClient | undefined ) => {
		if (readClient === undefined) return
		if (readClient.account?.address === undefined) return
		isRepV1ApprovedForMigration.deepValue = undefined
		v2ReputationBalance.deepValue = await getErc20TokenBalance(readClient, GENESIS_REPUTATION_V2_TOKEN_ADDRESS, readClient.account.address)
		v1ReputationBalance.deepValue = await getErc20TokenBalance(readClient, REPUTATION_V1_TOKEN_ADDRESS, readClient.account.address)
		isRepV1ApprovedForMigration.deepValue = await getAllowanceErc20Token(readClient, REPUTATION_V1_TOKEN_ADDRESS, readClient.account.address, GENESIS_REPUTATION_V2_TOKEN_ADDRESS) >= v1ReputationBalance.deepValue
	}

	const migrateFromRepV1toRepV2GenesisTokenButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		return await migrateFromRepV1toRepV2GenesisToken(writeClient, GENESIS_REPUTATION_V2_TOKEN_ADDRESS)
	}

	const approveRepV1ForMigration = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (v1ReputationBalance.deepValue === undefined) throw new Error('missing v1ReputationBalance balance')
		return await approveErc20Token(writeClient, REPUTATION_V1_TOKEN_ADDRESS, GENESIS_REPUTATION_V2_TOKEN_ADDRESS, v1ReputationBalance.deepValue)
	}

	const refresh = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const isApproveRepV1ForMigrationDisabled = useComputed(() => {
		if (isRepV1ApprovedForMigration.deepValue === undefined) return true
		if (isRepV1ApprovedForMigration.deepValue === true) return true
		if (v1ReputationBalance.deepValue === undefined) return true
		if (v1ReputationBalance.deepValue === 0n) return true
		return false
	})
	const isMigrateFromRepV1toRepV2GenesisTokenButtonDisabled = useComputed(() => {
		if (isRepV1ApprovedForMigration.deepValue === undefined) return true
		if (isRepV1ApprovedForMigration.deepValue === false) return true
		if (v1ReputationBalance.deepValue === undefined) return true
		if (v1ReputationBalance.deepValue === 0n) return true
		return false
	})

	const repV1Info = useComputed(() => {
		if (v1ReputationBalance.deepValue === undefined || v2ReputationBalance.deepValue === undefined) return <CenteredBigSpinner/>
		return <Info text = { `You have ${ bigintToDecimalString(v1ReputationBalance.deepValue, 18n, 2) } REPv1 and ${ bigintToDecimalString(v2ReputationBalance.deepValue, 18n, 2) } REPv2` } />
	})

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<h1>Reputation V1 to V2 Migration</h1>
			{ repV1Info }
			<div class = 'button-group'>
				<SendTransactionButton
					className = 'button button-primary button-group-button'
					transactionStatus = { pendingApproveTransactionStatus }
					sendTransaction = { approveRepV1ForMigration }
					maybeWriteClient = { maybeWriteClient }
					disabled = { isApproveRepV1ForMigrationDisabled }
					text = { useComputed(() => 'Approve Reputation V1 For Migration') }
					callBackWhenIncluded = { refresh }
				/>
				<SendTransactionButton
					className = 'button button-primary button-group-button'
					transactionStatus = { pendingMigrateTransactionStatus }
					sendTransaction = { migrateFromRepV1toRepV2GenesisTokenButton }
					maybeWriteClient = { maybeWriteClient }
					disabled = { isMigrateFromRepV1toRepV2GenesisTokenButtonDisabled }
					text = { useComputed(() => 'Migrate Reputation V1 Tokens To Reputation V2') }
					callBackWhenIncluded = { refresh }
				/>
			</div>
		</section>
	</div>
}
