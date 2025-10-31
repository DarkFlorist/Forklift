import { OptionalSignal, useOptionalSignal } from '../utils/OptionalSignal.js'
import { EthereumQuantity } from '../types/types.js'
import { migrateFromRepV1toRepV2GenesisToken } from '../utils/augurContractUtils.js'
import { approveErc20Token, getAllowanceErc20Token, getErc20TokenBalance } from '../utils/erc20.js'
import { REPUTATION_V1_TOKEN_ADDRESS } from '../utils/constants.js'
import { Signal, useComputed, useSignalEffect } from '@preact/signals'
import { bigintToDecimalString } from '../utils/ethereumUtils.js'
import { ReadClient, WriteClient } from '../utils/ethereumWallet.js'

interface RepV1MigrationProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	updateTokenBalancesSignal: Signal<number>
}

const Info = ({ text }: { text: Signal<string | undefined> }) => {
	if (text.value === undefined) return <></>
	return <div class = 'claim-option'>
		<div class = 'claim-info'>
			<span>
				{ text.value }
			</span>
		</div>
	</div>
}

const GENESIS_REPUTATION_V2_TOKEN_ADDRESS = '0x221657776846890989a759BA2973e427DfF5C9bB'

export const RepV1Migration = ({ updateTokenBalancesSignal, maybeReadClient, maybeWriteClient }: RepV1MigrationProps) => {
	const v2ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const v1ReputationBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const isRepV1ApprovedForMigration = useOptionalSignal<boolean>(true)
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
		await migrateFromRepV1toRepV2GenesisToken(writeClient, GENESIS_REPUTATION_V2_TOKEN_ADDRESS)

		updateTokenBalancesSignal.value++
		await update(writeClient)
	}

	const approveRepV1ForMigration = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing writeClient')
		if (v1ReputationBalance.deepValue === undefined) throw new Error('missing v1ReputationBalance balance')
		await approveErc20Token(writeClient, REPUTATION_V1_TOKEN_ADDRESS, GENESIS_REPUTATION_V2_TOKEN_ADDRESS, v1ReputationBalance.deepValue)

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
		if (v1ReputationBalance.deepValue === undefined) return undefined
		if (v2ReputationBalance.deepValue === undefined) return undefined
		return `You have ${ bigintToDecimalString(v1ReputationBalance.deepValue, 18n, 2) } REPv1 and ${ bigintToDecimalString(v2ReputationBalance.deepValue, 18n, 2) } REPv2`
	})

	return <div class = 'subApplication'>
		<section class = 'subApplication-card'>
			<h1>Reputation V1 to V2 Migration</h1>
			<Info text = { repV1Info } />
			<div class = 'button-group'>
				<button class = 'button button-primary button-group-button' disabled = { isApproveRepV1ForMigrationDisabled } onClick = { approveRepV1ForMigration }>Approve Reputation V1 For Migration</button>
				<button class = 'button button-primary button-group-button' disabled = { isMigrateFromRepV1toRepV2GenesisTokenButtonDisabled } onClick = { migrateFromRepV1toRepV2GenesisTokenButton }>Migrate Reputation V1 Tokens To Reputation V2</button>
			</div>
		</section>
	</div>
}
