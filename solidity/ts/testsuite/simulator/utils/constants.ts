// common contract addresses
export const UNISWAP_V2_ROUTER_ADDRESS = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488Dn
export const SUSHISWAP_V2_ROUTER_ADDRESS = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9Fn
export const UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564n
export const MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11n // Contract for bundling bulk call transactions, deployed on every chain. https://github.com/mds1/multicall
export const ETHEREUM_LOGS_LOGGER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeEn
//export const DAI_ADDRESS = 0x6B175474E89094C44Da98b954EedeAC495271d0Fn
export const AUGUR_ADDRESS = 0x23916a8F5C3846e3100e5f587FF14F3098722F5dn
export const AUGUR_UNIVERSE_ADDRESS = 0x49244BD018Ca9fd1f06ecC07B9E9De773246e5AAn
export const AUGUR_SHARE_TOKEN = 0x9e4799ff2023819b1272eee430eadf510eDF85f0n;
// export const UNISWAP_V3_NFT_ROUTER = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88n
// export const SUSHISWAP_FACTORY_ADDRESS = 0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Acn
export const NULL_ADDRESS = 0x0000000000000000000000000000000000000000n
export const BURN_ADDRESS = 0x0000000000000000000000000000000000000001n

export const Multicall3ABI = [
	'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
	'function getEthBalance(address) returns (uint256)',
]

// Other
export const MOCK_ADDRESS = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefn
export const ENS_PUBLIC_RESOLVER = 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63n
export const ENS_TOKEN_WRAPPER = 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401n //mainnet only
export const ENS_ETH_REGISTRAR_CONTROLLER = 0x253553366Da8546fC250F225fe3d25d0C782303bn
export const ENS_ETHEREUM_NAME_SERVICE = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85n
export const ENS_PUBLIC_RESOLVER_2 = 0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41n
export const ENS_REGISTRY_WITH_FALLBACK = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1en
export const ENS_REVERSE_REGISTRAR = 0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cbn
export const PROXY_DEPLOYER_ADDRESS = 0x7a0d94f55792c434d74a40883c6ed8545e406d12n
export const VITALIK = 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045n

// Testing
export const TEST_ADDRESSES = [
	0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266n,
	0x70997970C51812dc3A010C7d01b50e0d17dc79C8n,
	0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BCn,
	0x90F79bf6EB2c4f870365E785982E1f101E93b906n,
	0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65n,
	0x9965507D1a55bcC2695C58ba16FB37d819B0A4dcn,
	0x976EA74026E726554dB657fA54763abd0C3a0aa9n
]
export const YEAR_2030 = 1902074321n

// ENS Fuses
export const CANNOT_UNWRAP = 1n
export const CANNOT_BURN_FUSES = 2n
export const CANNOT_TRANSFER = 4n
export const CANNOT_SET_RESOLVER = 8n
export const CANNOT_SET_TTL = 16n
export const CANNOT_CREATE_SUBDOMAIN = 32n
export const CANNOT_APPROVE = 64n
export const PARENT_CANNOT_CONTROL = 1n << 16n
export const IS_DOT_ETH = 1n << 17n
export const CAN_EXTEND_EXPIRY = 1n << 18n
export const CAN_DO_EVERYTHING = 0n

// https://blog.logrocket.com/understanding-resolving-metamask-error-codes/#4001
export const METAMASK_ERROR_USER_REJECTED_REQUEST = 4001
export const METAMASK_ERROR_NOT_AUTHORIZED = 4100
export const METAMASK_ERROR_FAILED_TO_PARSE_REQUEST = -32700
export const METAMASK_ERROR_BLANKET_ERROR = -32603
// const METAMASK_ERROR_METHOD_NOT_SUPPORTED_BY_PROVIDER = 4200
// const METAMASK_ERROR_CHAIN_NOT_ADDED_TO_METAMASK = 4902
// const METAMASK_ERROR_NOT_CONNECTED_TO_APPROPRIATE_CHAIN = 4901
// const METAMASK_ERROR_REQUEST_STRUCTURE_INCORRECT = -32600
// const METAMASK_ERROR_METHOD_DOES_NOT_EXIST = -32601
// const METAMASK_ERROR_INVALID_ARGUMENT = -32602
// const METAMASK_ERROR_TRANSACTION_REJECTD = -32003
// const METAMASK_ERROR_METHOD_NOT_SUPPORTED = -32004
// const METAMASK_ERROR_RATE_LIMITED = -32005

export const ERROR_INTERCEPTOR_DISABLED = { error: { code: METAMASK_ERROR_USER_REJECTED_REQUEST, message: 'The Interceptor is disabled' } }
export const METAMASK_ERROR_ALREADY_PENDING = { error: { code: -32002, message: 'Access request pending already.' } }
export const ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS = { error: { code: 2, message: 'Interceptor: No active address' } }
export const METAMASK_ERROR_NOT_CONNECTED_TO_CHAIN = { error: { code: 4900, message: 'Interceptor: Not connected to chain' } }
export const ERROR_INTERCEPTOR_GET_CODE_FAILED = { error: { code: -40001, message: 'Interceptor: Get code failed' } } // I wonder how we should come up with these numbers?
export const ERROR_INTERCEPTOR_GAS_ESTIMATION_FAILED = -40002
// const ERROR_INTERCEPTOR_NOT_READY = { error: { code: 1, message: 'Interceptor: Not ready' } }
// const ERROR_INTERCEPTOR_UNKNOWN_ORIGIN = { error: { code: 400, message: 'Interceptor: Unknown website origin' } }

export const ICON_ACTIVE = '../img/head.png' as const
export const ICON_ACCESS_DENIED = '../img/head-access-denied.png' as const
export const ICON_NOT_ACTIVE = '../img/head-not-active.png' as const
export const ICON_SIMULATING = '../img/head-simulating.png' as const
export const ICON_SIGNING = '../img/head-signing.png' as const
export const ICON_SIGNING_NOT_SUPPORTED = '../img/head-signing-unsupported-network.png' as const
export const ICON_INTERCEPTOR_DISABLED = '../img/head-interceptor-disabled.png' as const

export const ICON_ACTIVE_WITH_SHIELD = '../img/head-shield.png' as const
export const ICON_ACCESS_DENIED_WITH_SHIELD = '../img/head-access-denied-shield.png' as const
export const ICON_NOT_ACTIVE_WITH_SHIELD = '../img/head-not-active-shield.png' as const
export const ICON_SIMULATING_WITH_SHIELD = '../img/head-simulating-shield.png' as const
export const ICON_SIGNING_WITH_SHIELD = '../img/head-signing-shield.png' as const
export const ICON_SIGNING_NOT_SUPPORTED_WITH_SHIELD = '../img/head-signing-unsupported-network-shield.png' as const

export const DEFAULT_TAB_CONNECTION = { icon: ICON_NOT_ACTIVE, iconReason: 'The website has not requested to connect to The Interceptor.' }
// export const DEFAULT_TAB_CONNECTION_INTERCEPTOR_DISABLED = { icon: ICON_INTERCEPTOR_DISABLED, iconReason: 'The Interceptor is completely disabled by user request.' }

export const ETHEREUM_COIN_ICON = '../../img/coins/ethereum.png'

export const DEFAULT_CALL_ADDRESS = 0x1n

export const MAX_BLOCK_CACHE = 5

export const TIME_BETWEEN_BLOCKS = 12
export const GAS_PER_BLOB = 2n**17n
export const METAMASK_LOGO = '../img/signers/metamask.svg'
export const BRAVE_LOGO = '../img/signers/brave.svg'
export const COINBASEWALLET_LOGO = '../img/signers/coinbasewallet.svg'

export const ETHEREUM_EIP1559_ELASTICITY_MULTIPLIER = 4n // Bounds the maximum gas limit an EIP-1559 block may have, Ethereum = 4, Polygon = 8, lets just default to 4
export const ETHEREUM_EIP1559_BASEFEECHANGEDENOMINATOR = 8n // Bounds the amount the base fee can change between blocks.

export const MOCK_PRIVATE_KEYS_ADDRESS = 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdfn // an address represeting 0x1 privatekey

export const KNOWN_CONTRACT_CALLER_ADDRESSES = [
	0xca11bde05977b3631167028862be2a173976ca11n // curve multicaller
]

export const WARNING_COLOR = '#FFC107'
export const PRIMARY_COLOR = '#58a5b3'

export const CANNOT_SIMULATE_OFF_LEGACY_BLOCK = 'Cannot simulate off a legacy block'

export const NEW_BLOCK_ABORT = 'New Block Abort'
export const QUINTILLION = 10n**18n
