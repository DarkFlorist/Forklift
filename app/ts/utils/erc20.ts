import { mainnet } from 'viem/chains'
import { ERC20_ABI } from '../ABI/Erc20Abi.js'
import { AccountAddress, EthereumQuantity } from '../types/types.js'
import { ReadClient, WriteClient } from './ethereumWallet.js'

export const approveErc20Token = async (writeClient: WriteClient, tokenAddress: AccountAddress, approvedAdress: AccountAddress, amount: EthereumQuantity) => {
	return await writeClient.writeContract({
		chain: mainnet,
		abi: ERC20_ABI,
		functionName: 'approve',
		address: tokenAddress,
		args: [approvedAdress, amount]
	})
}

export const getErc20TokenBalance = async(readClient: ReadClient, tokenAddress: AccountAddress, account: AccountAddress) => {
	return await readClient.readContract({
		abi: ERC20_ABI,
		functionName: 'balanceOf',
		address: tokenAddress,
		args: [account]
	})
}
