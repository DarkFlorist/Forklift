import { Signal } from '@preact/signals'
import { OptionalSignal } from '../../utils/OptionalSignal.js'
import { deployAugurConstantProductMarketContract } from '../../utils/contractDeployment.js'
import { WriteClient } from '../../utils/ethereumWallet.js'

interface DeployProps {
	areContractsDeployed: Signal<boolean | undefined>
	maybeWriteClient: OptionalSignal<WriteClient>
}

export const DeployContract = ({ maybeWriteClient, areContractsDeployed }: DeployProps) => {
	const deploy = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('missing write client')
		await deployAugurConstantProductMarketContract(writeClient)
		areContractsDeployed.value = true
	}
	if (areContractsDeployed.value !== false) return <></>
	return <div class = 'subApplication'>
		<p class = 'error-component' style = 'width: 100%; margin-left: 10px; text-align: center;'>Augur Constant Product Market contract is not deployed.</p>
		<button class = 'button button-primary' onClick = { deploy }>Deploy contract</button>
	</div>
}
