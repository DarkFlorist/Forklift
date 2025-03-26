import { Signal, useSignal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { AccountAddress } from './types/types.js'
import { OptionalSignal, useOptionalSignal } from './utils/OptionalSignal.js'
import { getAccounts, getChainId, requestAccounts } from './utils/ethereumWallet.js'
import { DeployContract } from './ConstantProductUI/components/DeployContract.js'
import { CreateYesNoMarket } from './CreateMarketUI/components/CreateMarket.js'
import { ensureError } from './utils/errorHandling.js'
import { Reporting } from './ReportingUI/components/Reporting.js'
import { ClaimFunds } from './ClaimFundsUI/ClaimFunds.js'
import { isAugurConstantProductMarketDeployed } from './utils/contractDeployment.js'

interface WalletComponentProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
	loadingAccount: Signal<boolean>
	isWindowEthereum: Signal<boolean>
}

const WalletComponent = ({ maybeAccountAddress, loadingAccount, isWindowEthereum }: WalletComponentProps) => {
	if (!isWindowEthereum.value) return <p class = 'paragraph'> An Ethereum enabled wallet is required to make immutable domains.</p>
	if (loadingAccount.value) return <></>
	const connect = async () => {
		maybeAccountAddress.deepValue = await requestAccounts()
	}
	return maybeAccountAddress.value !== undefined ? (
		<p style = 'color: gray; justify-self: right;'>{ `Connected with ${ maybeAccountAddress.value }` }</p>
	) : (
		<button class = 'button is-primary' style = 'justify-self: right;' onClick = { connect }>
			{ `Connect wallet` }
		</button>
	)
}

interface TabsProps {
	maybeAccountAddress: OptionalSignal<AccountAddress>
	areContractsDeployed: Signal<boolean | undefined>
}
const Tabs = ({ maybeAccountAddress, areContractsDeployed }: TabsProps) => {
	const activeTab = useSignal(0)
	const tabs = [
		{ title: 'Trading', path: 'trading', component: <DeployContract maybeAccountAddress = { maybeAccountAddress } areContractsDeployed = { areContractsDeployed }/> },
		{ title: 'Market Creation', path: 'market-creation', component: <CreateYesNoMarket maybeAccountAddress = { maybeAccountAddress }/> },
		{ title: 'Reporting', path: 'reporting', component: <Reporting maybeAccountAddress = { maybeAccountAddress }/> },
		{ title: 'Claim Funds', path: 'claim-funds', component: <ClaimFunds maybeAccountAddress = { maybeAccountAddress }/> }
	]

	useEffect(() => {
		const path = window.location.hash.replace('#/', '')
		const tabIndex = tabs.findIndex(tab => tab.path === path)
		if (tabIndex !== -1) {
			activeTab.value = tabIndex
		}
	}, [])

	const handleTabClick = (index: number) => {
		if (tabs[index] === undefined) throw new Error(`invalid Tab index: ${ index }`)
		activeTab.value = index
		window.location.hash = `#/${ tabs[index].path }`
	}

	return (
		<div>
			<div style = { { display: 'flex', gap: '10px', borderBottom: '2px solid #ccc' } }>
				{ tabs.map((tab, index) => (
					<button
						key = { index }
						onClick = { () => handleTabClick(index) }
						style = { {
							padding: '10px',
							border: 'none',
							background: activeTab.value === index ? '#ddd' : 'transparent',
							cursor: 'pointer',
							borderBottom: activeTab.value === index ? '2px solid black' : 'none'
						}}
					>
						{ tab.title }
					</button>
				)) }
			</div>
			<div style = { { padding: '10px' } }>
				{ tabs[activeTab.value]?.component ?? null }
			</div>
		</div>
	)
}

export function App() {
	const errorString = useOptionalSignal<string>(undefined)
	const loadingAccount = useSignal<boolean>(false)
	const isWindowEthereum = useSignal<boolean>(true)
	const areContractsDeployed = useSignal<boolean | undefined>(undefined)
	const maybeAccountAddress = useOptionalSignal<AccountAddress>(undefined)
	const chainId = useSignal<number | undefined>(undefined)
	const inputTimeoutRef = useRef<number | null>(null)

	const setError = (error: unknown) => {
		if (error === undefined) {
			errorString.value = undefined
			return
		}
		const ensured = ensureError(error)
		errorString.deepValue = ensured.message
	}

	const updateChainId = async () => {
		const account = maybeAccountAddress.deepPeek()
		if (account === undefined) return
		chainId.value = await getChainId(account)
	}

	useEffect(() => {
		if (window.ethereum === undefined) {
			isWindowEthereum.value = false
			return
		}
		isWindowEthereum.value = true
		window.ethereum.on('accountsChanged', function (accounts) { maybeAccountAddress.deepValue = accounts[0] })
		window.ethereum.on('chainChanged', async () => { updateChainId() })
		const fetchAccount = async () => {
			try {
				loadingAccount.value = true
				const fetchedAccount = await getAccounts()
				if (fetchedAccount) maybeAccountAddress.deepValue = fetchedAccount
				updateChainId()
			} catch(e) {
				setError(e)
			} finally {
				loadingAccount.value = false
				areContractsDeployed.value = await isAugurConstantProductMarketDeployed(maybeAccountAddress.deepValue)
			}
		}
		fetchAccount()
		return () => {
			if (inputTimeoutRef.current !== null) {
				clearTimeout(inputTimeoutRef.current)
			}
		}
	}, [])

	return <main style = 'overflow: auto;'>
		<div class = 'app'>
			<WalletComponent loadingAccount = { loadingAccount } isWindowEthereum = { isWindowEthereum } maybeAccountAddress = { maybeAccountAddress }/>
			<div style = 'display: block'>
				<div class = 'augur-constant-product-market'>
					<img src = 'favicon.svg' alt = 'Icon' style ='width: 60px;'/> Augur Constant Product Market
				</div>
				<p class = 'sub-title'>Swap Augur tokens!</p>
			</div>
		</div>
		<Tabs maybeAccountAddress = { maybeAccountAddress } areContractsDeployed = { areContractsDeployed }/>
		<div class = 'text-white/50 text-center'>
			<div class = 'mt-8'>
				Augur Constant Product Market by&nbsp;
				<a class = 'text-white hover:underline' href='https://dark.florist'>
					Dark Florist
				</a>
			</div>
			<div class = 'inline-grid'>
				<a class = 'text-white hover:underline' href='https://discord.gg/BeFnJA5Kjb'>
					Discord
				</a>
				<a class = 'text-white hover:underline' href='https://twitter.com/DarkFlorist'>
					Twitter
				</a>
				<a class = 'text-white hover:underline' href='https://github.com/DarkFlorist'>
					Github
				</a>
			</div>
		</div>
	</main>
}
