import { Signal, useSignal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { AccountAddress, EthereumAddress } from './types/types.js'
import { OptionalSignal, useOptionalSignal } from './utils/OptionalSignal.js'
import { getAccounts, getChainId, requestAccounts } from './utils/ethereumWallet.js'
import { DeployContract } from './ConstantProductUI/components/DeployContract.js'
import { CreateYesNoMarket } from './CreateMarketUI/components/CreateMarket.js'
import { ensureError } from './utils/errorHandling.js'
import { Reporting } from './ReportingUI/components/Reporting.js'
import { ClaimFunds } from './ClaimFundsUI/ClaimFunds.js'
import { isAugurConstantProductMarketDeployed } from './utils/contractDeployment.js'
import { JSX } from 'preact'
import { DEFAULT_UNIVERSE } from './utils/constants.js'
import { addressString, formatUnixTimestampISO } from './utils/ethereumUtils.js'
import { getUniverseName } from './utils/augurUtils.js'
import { getReputationTokenForUniverse, getUniverseForkingInformation } from './utils/augurContractUtils.js'
import { humanReadableDateDelta, SomeTimeAgo } from './ReportingUI/components/SomeTimeAgo.js'
import { Migration } from './MigrationUI/components/Migration.js'

interface UniverseComponentProps {
	universe: OptionalSignal<AccountAddress>
}

const UniverseComponent = ({ universe }: UniverseComponentProps) => {
	if (universe.deepValue === undefined) return <p> No universe selected</p>
	const universeName = getUniverseName(universe.deepValue)
	return <p style = 'color: gray; justify-self: left;'>Universe:<b>{ ` ${ universeName }` }</b></p>
}


interface UniverseForkingNoticeProps {
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
}

const UniverseForkingNotice = ({ universeForkingInformation }: UniverseForkingNoticeProps) => {
	if (universeForkingInformation.deepValue !== undefined && universeForkingInformation.deepValue.isForking) {
		const forkingEndTime = new Date(Number(universeForkingInformation.deepValue.forkEndTime) * 1000)
		return <div style = 'padding: 10px; background-color: red;'>
			<p>
				<SomeTimeAgo priorTimestamp = { forkingEndTime } countBackwards = { true } diffToText = {
					(time: number) => {
						if (universeForkingInformation.deepValue === undefined) return <></>
						if (universeForkingInformation.deepValue.isForking === false) return <></>
						if (time <= 0) return <>
							The universe <b>{ getUniverseName(universeForkingInformation.deepValue.universe) } </b> has forked off.
							Disagreements on the outcome of the market { universeForkingInformation.deepValue.forkingMarket } has caused the fork.
							Please use some other universe.
						</>
						return <>
							The Universe <b>{ getUniverseName(universeForkingInformation.deepValue.universe) }</b> is forking.
							The fork ends in { humanReadableDateDelta(time) } ({ formatUnixTimestampISO(universeForkingInformation.deepValue.forkEndTime) }).
							Disagreements on the outcome of the market { universeForkingInformation.deepValue.forkingMarket } has caused the fork.
						</>
					}
				}/>
			</p>
		</div>
	}
	return <></>
}

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
	tabs: readonly { title: string, path: string, component: JSX.Element }[]
	activeTab: Signal<number>
}

const Tabs = ({ tabs, activeTab }: TabsProps) => {
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
	const universe = useOptionalSignal<AccountAddress>(undefined)
	const universeForkingInformation = useOptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>(undefined)
	const reputationTokenAddress = useOptionalSignal<AccountAddress>(undefined)
	const activeTab = useSignal(0)

	const tabs = [
		{ title: 'Trading', path: 'trading', component: <DeployContract maybeAccountAddress = { maybeAccountAddress } areContractsDeployed = { areContractsDeployed }/> },
		{ title: 'Market Creation', path: 'market-creation', component: <CreateYesNoMarket maybeAccountAddress = { maybeAccountAddress } universe = { universe } reputationTokenAddress = { reputationTokenAddress }/> },
		{ title: 'Reporting', path: 'reporting', component: <Reporting maybeAccountAddress = { maybeAccountAddress } universe = { universe } reputationTokenAddress = { reputationTokenAddress }/> },
		{ title: 'Claim Funds', path: 'claim-funds', component: <ClaimFunds maybeAccountAddress = { maybeAccountAddress }/> },
		{ title: 'Migration', path: 'migration', component: <Migration maybeAccountAddress = { maybeAccountAddress } reputationTokenAddress = { reputationTokenAddress } universe = { universe } universeForkingInformation = { universeForkingInformation } /> }
	] as const

	useEffect(() => {
		const hash = window.location.hash.replace('#/', '')
		const [path, params] = hash.split('?')
		const tabIndex = tabs.findIndex(tab => tab.path === path)
		if (tabIndex !== -1) {
			activeTab.value = tabIndex
		}

		const searchParams = new URLSearchParams(params)
		const universeParam = searchParams.get('universe')
		const parsed = EthereumAddress.safeParse(universeParam)
		if (universeParam && parsed.success) {
			universe.deepValue = addressString(parsed.value)
		} else {
			universe.deepValue = addressString(BigInt(DEFAULT_UNIVERSE))
		}
	}, [])

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

	useEffect(() => {
		const universeInfo = async () => {
			if (maybeAccountAddress.deepValue === undefined) return
			if (universe.deepValue === undefined) return
			universeForkingInformation.deepValue = await getUniverseForkingInformation(maybeAccountAddress.deepValue, universe.deepValue)
			reputationTokenAddress.deepValue = await getReputationTokenForUniverse(maybeAccountAddress.deepValue, universe.deepValue)
		}
		universeInfo()
	}, [maybeAccountAddress.value, universe.value])

	if (universe.deepValue === undefined) return <main><p> loading... </p></main>

	return <main style = 'overflow: auto;'>
		<div class = 'app'>
			<div style = 'display: flex; justify-content: space-between;'>
				<UniverseComponent universe = { universe}/>
				<WalletComponent loadingAccount = { loadingAccount } isWindowEthereum = { isWindowEthereum } maybeAccountAddress = { maybeAccountAddress }/>
			</div>
			<UniverseForkingNotice universeForkingInformation = { universeForkingInformation }/>
			<div style = 'display: block'>
				<div class = 'augur-constant-product-market'>
					<img src = 'favicon.svg' alt = 'Icon' style ='width: 60px;'/> Augur Constant Product Market
				</div>
				<p class = 'sub-title'>Swap Augur tokens!</p>
			</div>
		</div>
		<Tabs tabs = { tabs } activeTab = { activeTab }/>
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
