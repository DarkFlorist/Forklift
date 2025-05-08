import { priceToTick, tickToPrice } from './augurConstantProductMarketUtils.js'

export const parsePositionInfo = (positionInfo: bigint) => {
	const hasSubscriber = Number(positionInfo & 0xFFn) !== 0
	const tickLower = Number((positionInfo >> 8n) & 0xFFFFFFn)
	const tickUpper = Number((positionInfo >> 32n) & 0xFFFFFFn)
	const poolId = (positionInfo >> 56n) & ((1n << 200n) - 1n)
	const toSignedInt24 = (x: number) => x >= 0x800000 ? x - 0x1000000 : x
	return {
		poolId,
		tickUpper: toSignedInt24(tickUpper),
		tickLower: toSignedInt24(tickLower),
		hasSubscriber
	}
}

export const zeroOnePriceToTick = (price: number, tickSpacing: number) => {
	if (price === 1) return priceToTick(Infinity, tickSpacing)
	if (price === 0) return priceToTick(0, tickSpacing)
	return priceToTick(price/(1 - price), tickSpacing)
}

export const tickToZeroToOnePrice = (tick: number) => {
	const price = tickToPrice(tick)
	return price/(1 + price)
}
