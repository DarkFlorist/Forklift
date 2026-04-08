import { Abi, ContractFunctionArgs, ContractFunctionName, encodeFunctionData, encodePacked, ReadContractReturnType, zeroAddress } from 'viem'
import { mainnet } from 'viem/chains'
import { AccountAddress, EthereumAddress, RemoveFields } from '../types/types.js'
import { ReadClient, WriteClient } from './ethereumWallet.js'
import { SAFE_ABI } from '../ABI/SafeAbi.js'
import { addressString } from './ethereumUtils.js'

export const getOwners = async (readClient: ReadClient, safeAddress: `0x${ string }`) => {
	return await readContractSafeWrapIfSafeIsEnabled(readClient, {
		abi: SAFE_ABI,
		functionName: 'getOwners',
		address: safeAddress,
		args: []
	})
}

export const execTransaction = async (writeClient: WriteClient, safeAddress: `0x${ string }`, to: AccountAddress, data: `0x${ string }`) => {
	const safeOwners = await getOwners(writeClient, safeAddress)
	if (safeOwners.length === 0) throw new Error(`Safe has no owners!`)
	// this signatrue is used when the transaction signer is one of the signers
	const signature = encodePacked(['uint256', 'uint256', 'bool'], [BigInt(writeClient.account.address), 0n, true])
	const value = 0n
	const operation = 0 // CALL
	const safeTxGas = 0n
	const baseGas = 0n
	const gasPrice = 0n
	const gasToken = zeroAddress
	const refundReceiver = zeroAddress

	return await writeClient.writeContract({
		chain: mainnet,
		abi: SAFE_ABI,
		functionName: 'execTransaction',
		address: safeAddress,
		args: [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signature]
	})
}

export const writeContractSafeWrapIfSafeIsEnabled = async (client: WriteClient, params: Parameters<WriteClient['writeContract']>[0]) => {
	const safeAddress = getSafeAddress()
	if (safeAddress === undefined) return await client.writeContract(params)
	const data = encodeFunctionData({ abi: params.abi, functionName: params.functionName, args: params.args })
	return await execTransaction(client, safeAddress, params.address, data)
}

export const getSafeAddress = () => {
	const safeAddress = localStorage.getItem('safeAddress')
	if (safeAddress === null) return undefined
	const parsed = EthereumAddress.safeParse(safeAddress.trim())
	if (!parsed.success) throw new Error('invalid safe address. Please adjust safe address in the settings by correcting it or removing it.')
	return addressString(parsed.value)
}

export const readContractSafeWrapIfSafeIsEnabled = async <const TAbi extends Abi | readonly unknown[], TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>, TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>>(
	client: ReadClient,
	params: {
		abi: TAbi
		functionName: TFunctionName
		args?: TArgs
		address: AccountAddress
		account?: AccountAddress
	} & RemoveFields<Parameters<ReadClient['readContract']>[0], 'abi' | 'functionName' | 'args' | 'address' | 'account'>,
): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs>> => {
	const safeAddress = getSafeAddress()
	if (safeAddress === undefined) return await client.readContract(params)
	return await client.readContract({ ...params, account: safeAddress })
}

export const getCurrentReadAccount = (client: ReadClient | undefined) => {
	if (client === undefined) return undefined
	if (client.account?.address === undefined) return undefined
	const safeAddress = getSafeAddress()
	if (safeAddress === undefined) return client.account?.address
	return safeAddress
}

export const getCurrentWriteAccount = (client: WriteClient) => {
	const safeAddress = getSafeAddress()
	if (safeAddress === undefined) return client.account.address
	return safeAddress
}

export const maybeGetCurrentWriteAccount = (client: WriteClient | undefined) => {
	if (client === undefined) return undefined
	return getCurrentWriteAccount(client)
}

export const isValidSafeAccountWalletCombination = async (client: WriteClient) => {
	const safeAddress = getSafeAddress()
	if (safeAddress === undefined) return true
	const owners = await getOwners(client, safeAddress)
	if (owners.find((owner) => BigInt(owner) === BigInt(client.account.address)) !== undefined) return true
	return false
}
