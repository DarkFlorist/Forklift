import { mainnet } from 'viem/chains'
import { ERC20_ABI } from '../ABI/Erc20Abi.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { createReadClient, createWriteClient } from './ethereumWallet.js'

export const approveErc20Token = async (approver: AccountAddress, tokenAddress: AccountAddress, approvedAdress: AccountAddress, amount: EthereumQuantity) => {
	const client = createWriteClient(approver)
	return await client.writeContract({
		chain: mainnet,
		abi: ERC20_ABI,
		functionName: 'approve',
		address: tokenAddress,
		args: [approvedAdress, amount]
	})
}

export const getErc20TokenBalance = async(reader: AccountAddress, tokenAddress: AccountAddress, account: AccountAddress) => {
	const client = createReadClient(reader)
	return await client.readContract({
		abi: ERC20_ABI,
		functionName: 'balanceOf',
		address: tokenAddress,
		args: [account]
	})
}
