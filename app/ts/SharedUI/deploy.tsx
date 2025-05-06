import { AccountAddress } from '../types/types.js'
import { deployAugurConstantProductMarket } from '../utils/augurConstantProductMarketUtils.js'
import { ensureAugurConstantProductMarketRouterDeployed } from '../utils/augurDeployment.js'
import { WriteClient } from '../utils/ethereumWallet'
import { OptionalSignal } from '../utils/OptionalSignal.js'

interface DeployProps {
	isRouterDeployed: OptionalSignal<boolean>
	maybeWriteClient: OptionalSignal<WriteClient>
}

export const DeployRouter = ({ maybeWriteClient, isRouterDeployed }: DeployProps) => {
	const deploy = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing write client')
		await ensureAugurConstantProductMarketRouterDeployed(writeClient)
		isRouterDeployed.deepValue = true
	}
	if (isRouterDeployed.deepValue === true || isRouterDeployed.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<p class = 'error-component' style = 'width: 100%; margin-left: 10px; text-align: center;'>Augur Constant Product Market Router is not deployed.</p>
		<button class = 'button button-primary' onClick = { deploy }>Deploy Router</button>
	</div>
}

interface DeployAugurConstantProductMarketProps {
	isConstantProductMarketDeployed: OptionalSignal<boolean>
	maybeWriteClient: OptionalSignal<WriteClient>
	marketAddress: OptionalSignal<AccountAddress>
}

export const DeployAugurConstantProductMarket = ({ maybeWriteClient, isConstantProductMarketDeployed, marketAddress }: DeployAugurConstantProductMarketProps) => {
	const deploy = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing write client')
		if (marketAddress.deepValue === undefined) throw new Error('missing market address')
		await deployAugurConstantProductMarket(writeClient, marketAddress.deepValue)
		isConstantProductMarketDeployed.deepValue = true
	}
	if (isConstantProductMarketDeployed.deepValue === true || isConstantProductMarketDeployed.deepValue === undefined) return <></>
	return <div class = 'subApplication'>
		<p class = 'error-component' style = 'width: 100%; margin-left: 10px; text-align: center;'>Constant Product Market missing for the pool</p>
		<button class = 'button button-primary' onClick = { deploy }>Deploy Augur Constant Product Market</button>
	</div>
}
