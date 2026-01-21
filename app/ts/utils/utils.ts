import { hexToBytes, padHex, stringToHex } from 'viem'
import { AccountAddress } from '../types/types'

export const bigintSecondsToDate = (seconds: bigint) => {
	if (seconds > 8640000000000n) throw new Error(`Too big seconds value: ${ seconds }`)
	if (seconds < 0) throw new Error(`Got negative seconds: ${ seconds }`)
	return new Date(Number(seconds) * 1000)
}

export const dateToBigintSeconds = (date: Date) => BigInt(date.getTime()) / 1000n

export function humanReadableDateDelta(secondsDiff: number) {
	if (secondsDiff <= 0) return '0 seconds'
	else if (secondsDiff > 3600 * 24 * 1.5) return `${ Math.floor((secondsDiff + 1800) / 3600 / 24) } days`
	else if (secondsDiff > 3600 * 1.5) return `${ Math.floor((secondsDiff + 1800) / 3600) } hours`
	else if (secondsDiff > 60 * 1.5) return `${ Math.floor((secondsDiff + 30) / 60) } minutes`
	else return `${ Math.floor(secondsDiff + 0.5) } seconds`
}

export const humanReadableDateDeltaFromTo = (from: bigint, to: bigint) => humanReadableDateDelta(Number(to - from))

export const min = (left: bigint, right: bigint) => left < right ? left : right
export const max = (left: bigint, right: bigint) => left > right ? left : right
export const abs = (x: bigint) => (x < 0n) ? -1n * x : x
export const clamp = <T>(val: T, min: T, max: T) => val < min ? min : val > max ? max : val
export const indexOfMax = (array: readonly bigint[]) => {
	var greatest = array[0]
	var indexOfGreatest = 0
	for (var i = 1; i < array.length; i++) {
		const element = array[i]
		if (element === undefined) throw new Error('element was undefined')
		if (!greatest || element > greatest) {
			greatest = element
			indexOfGreatest = i
		}
	}
	return indexOfGreatest
}

export const isNumeric = (value: string) => /^-?\d+$/.test(value)

export function areEqualArrays<T>(first: T[], second: T[]) {
	if (first === second) return true
	if (first.length !== second.length) return false
	return first.every((value, index) => value === second[index])
}

export const isValidUrl = (possibleUrl: string) => {
	const urlPattern = /^(https?:\/\/)[\w\-]+(\.[\w\-]+)+([\/\w\-.?=&%]*)?$/
	return urlPattern.test(possibleUrl)
}

export const getUsedRpc = () => {
	const rpc = localStorage.getItem('rpc')
	if (rpc === null) return 'https://ethereum.dark.florist'
	return rpc
}

export const convertStringToBytes32 = (inputText: string) => {
	const utf8Hex = stringToHex(inputText)
	const utf8Bytes = hexToBytes(utf8Hex)
	if (utf8Bytes.length > 32) throw new Error('Input text exceeds 32 byte limit for bytes32')
	return padHex(utf8Hex, { size: 32, dir: 'right' })
}

export const formatDateForDatetimeLocal = (date: Date) => {
	const isoString = date.toISOString()
	return isoString.slice(0, 16)
}

export const currentDateInAYear = () => new Date(new Date().setFullYear(new Date().getFullYear() + 1))

export const filterIfExistsAddOtherwise = (array: readonly AccountAddress[], newEntry: AccountAddress) => {
	if (array.find((entry) => entry === newEntry)) {
		return array.filter(((entry) => entry !== newEntry))
	} else {
		return [...array, newEntry]
	}
}
