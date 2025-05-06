
// Contracts
export const PROXY_DEPLOYER_ADDRESS = '0x7a0d94f55792c434d74a40883c6ed8545e406d12'
export const AUGUR_PROXY_DEPLOYER = '0x4e59b44847b379578588920ca78fbf26c0b4956c'
export const AUGUR_CONTRACT = '0x23916a8F5C3846e3100e5f587FF14F3098722F5d'
export const GENESIS_UNIVERSE = '0x49244BD018Ca9fd1f06ecC07B9E9De773246e5AA'
export const DEFAULT_UNIVERSE = GENESIS_UNIVERSE
export const DAI_TOKEN_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
export const HOT_LOADING_ADDRESS = '0x5836BEdB48834474C8e11fBc005E7fB2C2a35D7d'
export const FILL_ORDER_CONTRACT = '0xc42E71b9A6E38DD05cFB51Be6751a4d10d66ba35'
export const ORDERS_CONTRACT = '0x483156fE50F752c63aA671a806dB10d5Cabd7A8f'
export const BUY_PARTICIPATION_TOKENS_CONTRACT = '0x1aaCc93f3Ee47D7DE20171468D9C2458D5602483'
export const REDEEM_STAKE_ADDRESS = '0x9ac7B28A7e684d1b2776d6b9045E8f9150F58401'
export const AUDIT_FUNDS_ADDRESS = '0x73961558c6d1E8C5df845975d4D49dcA3db18887'
export const REPUTATION_V1_TOKEN_ADDRESS = '0x1985365e9f78359a9B6AD760e32412f4a445E862'
export const DISPUTE_CROWDSOURCER_FACTORY_ADDRESS = '0xd69769FA07c710c7b5b4c7F7f9189dbFd325976d'
export const AUGUR_SHARE_TOKEN = '0x9e4799ff2023819b1272eee430eadf510eDF85f0'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const UNIV4_POOL_MANAGER = '0x000000000004444c5dc75cB358380D2e3dE08A90'
export const UNIV4_POSITION_MANAGER = '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e'
export const UNIV4_MIN_TICK = -8000
export const UNIV4_MAX_TICK = 8000
export const ONE_YEAR_IN_SECONDS = 31536000n
export const AUGUR_SHARE_DECIMALS = 15n
export const DAI_LOGO = 'img/dai-logo.svg'
export const YES_LOGO = 'img/yes-logo.svg'
export const NO_LOGO = 'img/no-logo.svg'

// Reporting
export const REPORTING_STATES = [
	'PreReporting',
	'DesignatedReporting',
	'OpenReporting',
	'CrowdsourcingDispute',
	'AwaitingNextWindow',
	'AwaitingFinalization',
	'Finalized',
	'Forking',
	'AwaitingForkMigration'
] as const

export const MARKET_TYPES = [
	'Yes/No',
	'Categorical',
	'Scalar'
] as const

export const YES_NO_OPTIONS = [
	'Invalid',
	'Yes',
	'No'
] as const
