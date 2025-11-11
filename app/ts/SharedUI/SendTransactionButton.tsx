import { Signal, useComputed } from '@preact/signals'
import { EtherScanTransactionHash } from './links.js'
import { Spinner } from './Spinner.js'
import { WriteClient } from '../utils/ethereumWallet.js'
import { OptionalSignal } from '../utils/OptionalSignal.js'
import { ensureError, isUserRejectedRequest } from '../utils/errorHandling.js'

export type TransactionStatus = {
	status: 'waitingToBeIncluded' | 'included' | 'includedAndCallingBack',
	hash: `0x${ string }`
} | {
	status: 'waitingUserToApprove',
	hash: undefined
} | {
	status: 'error',
	message: string,
	hash: `0x${ string }` | undefined
}  | undefined


type TransactionHashProps = {
	transactionStatus: Signal<TransactionStatus>
}

export const TransactionHash = ({ transactionStatus }: TransactionHashProps) => {
	if (transactionStatus.value?.hash === undefined) return <></>
	const spinner = transactionStatus.value.status === 'waitingToBeIncluded' ? <Spinner/>: <></>
	return <p>Transaction Hash: <EtherScanTransactionHash hash = { transactionStatus.value.hash } /> { spinner }</p>
}

type SendTransactionButtonProps = {
	transactionStatus: Signal<TransactionStatus>
	sendTransaction: () => Promise<`0x${ string }`>
	callBackWhenIncluded: () => Promise<void>
	maybeWriteClient: OptionalSignal<WriteClient>
	disabled: Signal<boolean>
	text: Signal<string>
	className?: string
	style?: Record<string, string | number>
}

export const SendTransactionButton = ({ style, className, transactionStatus, sendTransaction, maybeWriteClient, disabled, text, callBackWhenIncluded }: SendTransactionButtonProps) => {
	const onClick = async () => {
		if (maybeWriteClient.deepValue === undefined) return
		try {
			transactionStatus.value = { status: 'waitingToBeIncluded', hash: await sendTransaction() }
		} catch(error: unknown) {
			if (isUserRejectedRequest(error)) {
				transactionStatus.value = { status: 'error', message: 'Rejected by wallet', hash: undefined }
				return
			}
			console.error(error)
			transactionStatus.value = { status: 'error', message: ensureError(error).message, hash: undefined }
			return
		}
		if (transactionStatus.value.status === 'waitingToBeIncluded') {
			try {
				const transactionReceipt = await maybeWriteClient.deepValue.waitForTransactionReceipt({ hash: transactionStatus.value.hash })
				if (transactionStatus.value.status === 'waitingToBeIncluded') {
					transactionStatus.value = { status: 'includedAndCallingBack', hash: transactionStatus.value.hash }
					await callBackWhenIncluded()
					transactionStatus.value = { status: 'included', hash: transactionStatus.value.hash }
				}
				if (transactionReceipt.status === 'reverted') {
					transactionStatus.value = { status: 'error', message: 'Transaction reverted!', hash: transactionStatus.value.hash }
					return
				}
			} catch (error: unknown) {
				console.error(error)
				transactionStatus.value = { status: 'error', message: ensureError(error).message, hash: transactionStatus.value.hash }
				return
			}
		}
	}

	const disableButton = useComputed(() => {
		if (transactionStatus.value?.status === 'waitingToBeIncluded') return true
		if (transactionStatus.value?.status === 'includedAndCallingBack') return true
		if (transactionStatus.value?.status === 'waitingUserToApprove') return true
		return disabled.value
	})

	const spinner = useComputed(() => {
		if (transactionStatus.value === undefined || transactionStatus.value.status === 'included' || transactionStatus.value.status === 'error') return <></>
		return <Spinner/>
	})
	const error = useComputed(() => {
		if (transactionStatus.value?.status !== 'error') return <></>
		return <p class = 'error-component'> { transactionStatus.value?.message } </p>
	})
	return <div style = { 'width: 100%' }>
		<button
			style = { style ?? { width: '100%' } }
			class = { className ?? 'button button-primary' }
			disabled = { disableButton }
			onClick = { onClick }>
				{ text.value } { spinner.value }
		</button>
		{ error.value }
		<TransactionHash transactionStatus = { transactionStatus }/>
	</div>
}
