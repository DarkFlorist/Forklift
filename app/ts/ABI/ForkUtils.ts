export const FORK_UTILS_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_origin",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_nonce",
				"type": "uint256"
			}
		],
		"name": "addressFrom",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "contract IReportingParticipant[]",
				"name": "_reportingParticipants",
				"type": "address[]"
			}
		],
		"name": "forkAndRedeemReportingParticipants",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_disputeCrowdsourcerFactory",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_account",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_offset",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_num",
				"type": "uint256"
			}
		],
		"name": "getAvailableDisputesFromForkedMarkets",
		"outputs": [
			{
				"components": [
					{
						"internalType": "contract IMarket",
						"name": "market",
						"type": "address"
					},
					{
						"internalType": "contract IDisputeCrowdsourcer",
						"name": "bond",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					}
				],
				"internalType": "struct AuditForkUtilities.StakeData[]",
				"name": "_data",
				"type": "tuple[]"
			},
			{
				"internalType": "bool",
				"name": "_done",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "contract IMarket",
				"name": "_market",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_offset",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_num",
				"type": "uint256"
			}
		],
		"name": "getReportingParticipantsForMarket",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "size",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "stake",
						"type": "uint256"
					},
					{
						"internalType": "uint256[]",
						"name": "payoutNumerators",
						"type": "uint256[]"
					}
				],
				"internalType": "struct AuditForkUtilities.ReportingParticipant[]",
				"name": "_data",
				"type": "tuple[]"
			},
			{
				"internalType": "bool",
				"name": "_done",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
] as const
