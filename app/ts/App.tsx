import { batch, Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { AccountAddress, EthereumQuantity } from './types/types.js'
import { OptionalSignal, useOptionalSignal } from './utils/OptionalSignal.js'
import { createReadClient, createWriteClient, getAccounts, getChainId, ReadClient, requestAccounts, WriteClient } from './utils/ethereumWallet.js'
import { CreateYesNoMarket } from './CreateMarketUI/components/CreateMarket.js'
import { assertNever, ensureError } from './utils/errorHandling.js'
import { Reporting } from './ReportingUI/components/Reporting.js'
import { ClaimFunds } from './ClaimFundsUI/ClaimFunds.js'
import { JSX } from 'preact'
import { DAI_TOKEN_ADDRESS, DEFAULT_UNIVERSE, GENESIS_REPUTATION_V2_TOKEN_ADDRESS } from './utils/constants.js'
import { bigintToDecimalString, formatUnixTimestampIso, formatUnixTimestampIsoDate, getEthereumBalance } from './utils/ethereumUtils.js'
import { getUniverseName } from './utils/augurUtils.js'
import { getForkValues, getReputationTokenForUniverse, getUniverseForkingInformation, isKnownUniverse } from './utils/augurContractUtils.js'
import { SomeTimeAgo } from './ReportingUI/components/SomeTimeAgo.js'
import { Migration } from './MigrationUI/components/Migration.js'
import { getErc20TokenBalance, getErc20TokenSymbol } from './utils/erc20.js'
import { bigintSecondsToDate, humanReadableDateDelta } from './utils/utils.js'
import { deployAugurExtraUtilities, getCurrentBlockTimeInBigIntSeconds, isAugurExtraUtilitiesDeployed } from './utils/augurExtraUtilities.js'
import { PageNotFound } from './PageNotFoundUI/PageNotFoundUI.js'
import { paramsToHashPath, parseHashPath } from './utils/hashRouter.js'
import { RepV1Migration } from './RepV1Migration/RepV1Migration.js'
import { MarketLink, UniverseLink } from './SharedUI/links.js'
import { Spinner } from './SharedUI/Spinner.js'

interface UniverseComponentProps {
	universe: OptionalSignal<AccountAddress>
	repTokenName: Signal<string>
}

const UniverseComponent = ({ universe, repTokenName }: UniverseComponentProps) => {
	if (universe.deepValue === undefined) return <p> No universe selected</p>
	const universeName = getUniverseName(universe.deepValue)
	return <p class = 'sub-title'>Universe:<b>{ ` ${ universeName }` }</b> ({ repTokenName })</p>
}

interface UniverseForkingNoticeProps {
	universeForkingInformation: OptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>
	currentTimeInBigIntSeconds: Signal<bigint>
	pathSignal: Signal<string>
}

const UniverseForkingNotice = ({ universeForkingInformation, currentTimeInBigIntSeconds, pathSignal }: UniverseForkingNoticeProps) => {
	if (universeForkingInformation.deepValue !== undefined && universeForkingInformation.deepValue.isForking) {
		const forkingEndTime = bigintSecondsToDate(universeForkingInformation.deepValue.forkEndTime)
		return <div class = 'universe-forking-notice'>
			<p>
				<SomeTimeAgo currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds } priorTimestamp = { forkingEndTime } countBackwards = { true } diffToText = {
					(time: number) => {
						if (universeForkingInformation.deepValue === undefined) return <></>
						if (universeForkingInformation.deepValue.isForking === false) return <></>
						const forkingMarketSignal = new Signal(universeForkingInformation.deepValue.forkingMarket)
						const universeSignal = new Signal(universeForkingInformation.deepValue.universe)
						if (time <= 0) return <>
							The universe <b>{ getUniverseName(universeForkingInformation.deepValue.universe) } </b> has forked off.
							A disagreement on the outcome of the market <MarketLink address = { forkingMarketSignal } pathSignal = { pathSignal }/> has caused the fork.
							Please use some other universe.
						</>
						return <>
							The universe <b> <UniverseLink address = { universeSignal } pathSignal = { pathSignal }/></b> is currently forking.
							The fork will conclude in { humanReadableDateDelta(time) } ({ formatUnixTimestampIso(universeForkingInformation.deepValue.forkEndTime) }).
							This fork was triggered by a disagreement over the outcome of the market <MarketLink address = { forkingMarketSignal } pathSignal = { pathSignal }/>.
							Please migrate your reputation tokens before the fork ends to avoid losing them. You can migrate your tokens from migration page: <UniverseLink address = { universeSignal } pathSignal = { pathSignal }/>.
						</>
					}
				}/>
			</p>
		</div>
	}
	return <></>
}

interface WalletComponentProps {
	maybeReadClient: OptionalSignal<ReadClient>
	maybeWriteClient: OptionalSignal<WriteClient>
	loadingAccount: Signal<boolean>
	children?: preact.ComponentChildren
}

const WalletComponent = ({ maybeReadClient, maybeWriteClient, loadingAccount, children }: WalletComponentProps) => {
	if (loadingAccount.value) return <></>
	const accountAddress = useComputed(() => maybeReadClient.deepValue?.account?.address)
	const connect = async () => {
		updateWalletSignals(maybeReadClient, maybeWriteClient, await requestAccounts())
	}
	return <div class = 'wallet-container'>
		{ accountAddress.value !== undefined ? <>
			<span class = 'wallet-connected-label'>
				Connected with { accountAddress.value }
			</span>
			{ children }
		</> : (
			<button class = 'wallet-connect-button' onClick = { connect }>
				Connect Wallet
			</button>
		) }
	</div>
}

interface WalletBalancesProps {
	daiBalance: OptionalSignal<EthereumQuantity>
	repBalance: OptionalSignal<EthereumQuantity>
	ethBalance: OptionalSignal<EthereumQuantity>
	repTokenName: Signal<string>
}

const WalletBalances = ({ daiBalance, repBalance, ethBalance, repTokenName }: WalletBalancesProps) => {
	const balances = []
	if (ethBalance.deepValue !== undefined) balances.push(`${ bigintToDecimalString(ethBalance.deepValue, 18n, 2) } ETH`)
	if (repBalance.deepValue !== undefined) balances.push(`${ bigintToDecimalString(repBalance.deepValue, 18n, 2) } ${ repTokenName }`)
	if (daiBalance.deepValue !== undefined) balances.push(`${ bigintToDecimalString(daiBalance.deepValue, 18n, 2) } DAI`)

	return <div class = 'wallet-balances'>
		{ balances.map((balance, i) => (
			<span key = { i }>{ balance }</span>
		)) }
		{ balances.length !== 3 ? <Spinner/> : <></>}
	</div>
}

interface TabsProps {
	tabs: readonly { title: string, path: string, component: JSX.Element, hide: boolean }[]
	activeTab: Signal<number>
}

const Tabs = ({ tabs, activeTab }: TabsProps) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const innerRef = useRef<HTMLDivElement>(null)
	const indicatorRef = useRef<HTMLDivElement>(null)
	const handleTabClick = (index: number) => {
		if (tabs[index] === undefined) throw new Error(`invalid Tab index: ${ index }`)
		activeTab.value = index
		const queryIndex = window.location.hash.indexOf('?')
		const query = queryIndex !== -1 ? window.location.hash.slice(queryIndex) : ''
		window.location.hash = `#/${ tabs[index].path }${ query }`
	}

	useEffect(() => {
		const inner = innerRef.current
		const indicator = indicatorRef.current
		const activeBtn = inner?.querySelector<HTMLButtonElement>('.tab-button.active')

		if (inner && activeBtn && indicator) {
			const innerBox = inner.getBoundingClientRect()
			const buttonBox = activeBtn.getBoundingClientRect()

			const offsetLeft = buttonBox.left - innerBox.left
			const width = buttonBox.width

			indicator.style.transform = `translateX(${ offsetLeft }px)`
			indicator.style.width = `${ width }px`
		}
	})

	return (
		<div>
			{/* use the ref on the container */}
			<div class = 'tabs-container' ref = { containerRef }>
				<div class = 'tabs-inner' ref = { innerRef }>
					{ tabs.map((tab, index) => ({ ...tab, index })).filter((tab) => !tab.hide).map((tab) => (
						<button
							key = { tab.index }
							class = { `tab-button ${ activeTab.value === tab.index ? 'active' : '' }` }
							onClick = { () => handleTabClick(tab.index) }
						>
							{ tab.title }
						</button>
					)) }
					<div class = 'tab-indicator' ref = { indicatorRef }></div>
				</div>
			</div>
			<div>
				{ tabs[activeTab.value]?.component }
			</div>
		</div>
	)
}

const updateWalletSignals = (maybeReadClient: OptionalSignal<ReadClient>, maybeWriteClient: OptionalSignal<WriteClient>, account: AccountAddress | undefined) => {
	maybeReadClient.deepValue = account === undefined ? createReadClient(undefined) : createWriteClient(account)
	maybeWriteClient.deepValue = account === undefined ? undefined : createWriteClient(account)
}

const Time = ( { currentTimeInBigIntSeconds }: { currentTimeInBigIntSeconds: Signal<bigint>}) => {
	const time = useComputed(() => formatUnixTimestampIsoDate(currentTimeInBigIntSeconds.value))
	return <div class = 'time'>
		<span>{ time }</span>
	</div>
}

export function App() {
	const errorString = useOptionalSignal<string>(undefined)
	const loadingAccount = useSignal<boolean>(false)
	const isWindowEthereum = useSignal<boolean>(true)
	const maybeReadClient = useOptionalSignal<ReadClient>(undefined)
	const maybeWriteClient = useOptionalSignal<WriteClient>(undefined)
	const isAugurExtraUtilitiesDeployedSignal = useOptionalSignal<boolean>(undefined)
	const chainId = useSignal<number | undefined>(undefined)
	const inputTimeoutRef = useRef<number | null>(null)
	const universe = useOptionalSignal<AccountAddress>(undefined)
	const selectedMarket = useOptionalSignal<AccountAddress>(undefined)
	const universeForkingInformation = useOptionalSignal<Awaited<ReturnType<typeof getUniverseForkingInformation>>>(undefined)
	const reputationTokenAddress = useOptionalSignal<AccountAddress>(undefined)
	const account = useOptionalSignal<AccountAddress>(undefined)
	const activeTab = useSignal(0)
	const currentTimeInBigIntSeconds = useSignal<bigint>(BigInt(Math.floor(Date.now() / 1000)))

	const ethBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const repBalance = useOptionalSignal<EthereumQuantity>(undefined)
	const daiBalance = useOptionalSignal<EthereumQuantity>(undefined)

	const forkValues = useOptionalSignal<Awaited<ReturnType<typeof getForkValues>>>(undefined)

	const pathSignal = useSignal<string>('')
	const updateTokenBalancesSignal = useSignal<number>(0)

	const repTokenName = useSignal<string>('REP')

	const tabs = [
		{ title: '404', path: '404', component: <PageNotFound/>, hide: true },
		{ title: 'Market Creation', path: 'market-creation', component: <CreateYesNoMarket repTokenName = { repTokenName } updateTokenBalancesSignal = { updateTokenBalancesSignal } maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient } universe = { universe } reputationTokenAddress = { reputationTokenAddress } repBalance = { repBalance } daiBalance = { daiBalance }/>, hide: false },
		{ title: 'Reporting', path: 'reporting', component: <Reporting repTokenName = { repTokenName } updateTokenBalancesSignal = { updateTokenBalancesSignal } repBalance = { repBalance } maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient } universe = { universe } forkValues = { forkValues } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds } selectedMarket = { selectedMarket }/>, hide: false },
		{ title: 'Claim Funds', path: 'claim-funds', component: <ClaimFunds pathSignal = { pathSignal } updateTokenBalancesSignal = { updateTokenBalancesSignal } maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient }/>, hide: false },
		{ title: 'Universe Migration', path: 'migration', component: <Migration repTokenName = { repTokenName } updateTokenBalancesSignal = { updateTokenBalancesSignal } maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient } reputationTokenAddress = { reputationTokenAddress } universe = { universe } universeForkingInformation = { universeForkingInformation } pathSignal = { pathSignal } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>, hide: false },
		{ title: 'Rep V1 Migration', path: 'RepV1Migration', component: <RepV1Migration updateTokenBalancesSignal = { updateTokenBalancesSignal } maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient }/>, hide: false }
	] as const

	useEffect(() => {
		const handleHashChange = () => { pathSignal.value = window.location.hash }
		window.addEventListener('hashchange', handleHashChange)
		handleHashChange()
		return () => { window.removeEventListener('hashchange', handleHashChange) }
	}, [])

	useSignalEffect(() => {
		const hashpath = parseHashPath(pathSignal.value, tabs.map((tab) => tab.path))
		window.history.pushState({}, '', pathSignal.value)

		const goTo404 = () => {
			activeTab.value = 0 // 404
			window.location.hash = `#/404`
		}

		if (hashpath.tabIndex !== -1) {
			activeTab.value = hashpath.tabIndex
		} else {
			goTo404()
		}

		switch(hashpath.universe.type) {
			case 'found': {
				universe.deepValue = hashpath.universe.address
				break
			}
			case 'foundAndInvalid': {
				goTo404()
				break
			}
			case 'notFound': {
				universe.deepValue = DEFAULT_UNIVERSE
				break
			}
			default: assertNever(hashpath.universe)
		}

		switch(hashpath.selectedMarket.type) {
			case 'found': {
				selectedMarket.deepValue = hashpath.selectedMarket.address
				break
			}
			case 'foundAndInvalid': {
				goTo404()
				break
			}
			case 'notFound': {
				selectedMarket.deepValue = undefined
				break
			}
			default: assertNever(hashpath.selectedMarket)
		}
	})

	useSignalEffect(() => {
		const hashpath = parseHashPath(pathSignal.value, tabs.map((tab) => tab.path))
		if (hashpath.selectedMarket.address === selectedMarket.deepValue && hashpath.universe.address === universe.deepValue) return
		pathSignal.value = paramsToHashPath(tabs[activeTab.value]?.path || '404', selectedMarket.deepValue, universe.deepValue)
	})

	useEffect(() => {
		const id = setInterval(async () => {
			if (maybeReadClient.deepValue) {
				currentTimeInBigIntSeconds.value = await getCurrentBlockTimeInBigIntSeconds(maybeReadClient.deepValue)
			} else {
				currentTimeInBigIntSeconds.value = BigInt((new Date()).getSeconds() * 1000)
			}
		}, 12000)
		return () => clearInterval(id)
	})

	const setError = (error: unknown) => {
		if (error === undefined) {
			errorString.value = undefined
			return
		}
		const ensured = ensureError(error)
		errorString.deepValue = ensured.message
	}

	const updateChainId = async () => {
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) return
		chainId.value = await getChainId(readClient)
	}

	const setUniverseIfValid = async () => {
		const readClient = maybeReadClient.deepPeek()
		if (readClient === undefined) return
		if (universe.deepValue === undefined) return
		if (!(await isKnownUniverse(readClient, universe.deepValue))) throw new Error(`${ universe.deepValue } is not an universe recognized by Augur.`)
	}

	useEffect(() => {
		if (window.ethereum === undefined) {
			isWindowEthereum.value = false
			return
		}
		isWindowEthereum.value = true
		window.ethereum.on('accountsChanged', (accounts) => {
			updateWalletSignals(maybeReadClient, maybeWriteClient, accounts[0])
			account.deepValue = accounts[0]
		})
		window.ethereum.on('chainChanged', async () => { updateChainId() })
		const fetchAccount = async () => {
			try {
				loadingAccount.value = true
				const fetchedAccount = await getAccounts()
				updateWalletSignals(maybeReadClient, maybeWriteClient, fetchedAccount)
				account.deepValue = fetchedAccount
				updateChainId()
				if (maybeReadClient.deepValue != undefined) {
					isAugurExtraUtilitiesDeployedSignal.deepValue = await isAugurExtraUtilitiesDeployed(maybeReadClient.deepValue)
				}
			} catch(e) {
				setError(e)
			} finally {
				loadingAccount.value = false
			}
			setUniverseIfValid()
		}
		fetchAccount()
		return () => {
			if (inputTimeoutRef.current !== null) {
				clearTimeout(inputTimeoutRef.current)
			}
		}
	}, [])

	const deployAugurExtraUtilitiesButton = async () => {
		const writeClient = maybeWriteClient.deepPeek()
		if (writeClient === undefined) throw new Error('writeClient missing')
		await deployAugurExtraUtilities(writeClient)
		isAugurExtraUtilitiesDeployedSignal.deepValue = true
	}

	const updateTokenBalances = async (writeClient: WriteClient | undefined, reputationTokenAddress: AccountAddress | undefined) => {
		if (writeClient === undefined) return
		const daiPromise = getErc20TokenBalance(writeClient, DAI_TOKEN_ADDRESS, writeClient.account.address)
		const ethPromise = getEthereumBalance(writeClient, writeClient.account.address)
		if (reputationTokenAddress) {
			repBalance.deepValue = await getErc20TokenBalance(writeClient, reputationTokenAddress, writeClient.account.address)
		}
		daiBalance.deepValue = await daiPromise
		ethBalance.deepValue = await ethPromise
	}

	useSignalEffect(() => {
		const universeInfo = async (readClient: ReadClient | undefined, universe: AccountAddress | undefined) => {
			if (readClient === undefined) return
			if (universe === undefined) return
			batch(() => {
				reputationTokenAddress.deepValue = undefined
				repTokenName.value = 'REP'
				universeForkingInformation.deepValue = undefined
			})
			const universeForkingPromise = getUniverseForkingInformation(readClient, universe)
			const reputationTokenAddressNotSignal = await getReputationTokenForUniverse(readClient, universe)
			const repTokenNameNotSignal = reputationTokenAddressNotSignal === GENESIS_REPUTATION_V2_TOKEN_ADDRESS ? `RepV2` : await getErc20TokenSymbol(readClient, reputationTokenAddressNotSignal)
			const universeForkingInformationNotSignal = await universeForkingPromise
			batch(() => {
				reputationTokenAddress.deepValue = reputationTokenAddressNotSignal
				repTokenName.value = repTokenNameNotSignal
				universeForkingInformation.deepValue = universeForkingInformationNotSignal
			})
		}
		universeInfo(maybeReadClient.deepValue, universe.deepValue).catch(console.error)
	})

	useSignalEffect(() => { updateTokenBalancesSignal.value; updateTokenBalances(maybeWriteClient.deepValue, reputationTokenAddress.deepValue).catch(console.error) })

	const updateForkValues = async (maybeReadClient: ReadClient | undefined, reputationTokenAddress: AccountAddress | undefined) => {
		if (reputationTokenAddress === undefined) return
		if (maybeReadClient === undefined) return
		forkValues.deepValue = await getForkValues(maybeReadClient, reputationTokenAddress)
	}

	useSignalEffect(() => { updateForkValues(maybeReadClient.deepValue, reputationTokenAddress.deepValue).catch(console.error) })

	if (universe.deepValue === undefined) return <main><p> loading... </p></main>

	return <main style = 'overflow: auto;'>
		<div class = 'app'>
			<div style = 'display: grid; justify-content: space-between; padding: 10px; grid-template-columns: auto auto auto;'>
				<div class = 'forklift'>
					<img src = 'favicon.ico' alt = 'Icon' />
					<div>
						<span>Augur Forklift</span>
						<UniverseComponent universe = { universe } repTokenName = { repTokenName }/>
					</div>
				</div>
				{ isAugurExtraUtilitiesDeployedSignal.deepValue === false ? <button class = 'button button-primary' onClick = { deployAugurExtraUtilitiesButton }>Deploy Augur Extra Utilities</button> : <div></div> }
				<div style = 'display: flex; align-items: center;'>
					<WalletComponent loadingAccount = { loadingAccount } maybeReadClient = { maybeReadClient } maybeWriteClient = { maybeWriteClient }>
						<WalletBalances ethBalance = { ethBalance } daiBalance = { daiBalance } repBalance = { repBalance } repTokenName = { repTokenName }/>
						<Time currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds }/>
					</WalletComponent>
				</div>
			</div>
			<UniverseForkingNotice universeForkingInformation = { universeForkingInformation } currentTimeInBigIntSeconds = { currentTimeInBigIntSeconds } pathSignal = { pathSignal }/>
		</div>
		<Tabs tabs = { tabs } activeTab = { activeTab }/>
		<footer class = 'site-footer'>
			<div>
				Augur Forklift by&nbsp;
				<a href = 'https://dark.florist' target = '_blank' rel = 'noopener noreferrer'>
					Dark Florist
				</a>
			</div>
			<nav class = 'footer-links'>
				<a href = 'https://discord.gg/BeFnJA5Kjb' target = '_blank'>Discord</a>
				<a href = 'https://twitter.com/DarkFlorist' target = '_blank'>Twitter</a>
				<a href = 'https://github.com/DarkFlorist' target = '_blank'>GitHub</a>
			</nav>
		</footer>
	</main>
}
