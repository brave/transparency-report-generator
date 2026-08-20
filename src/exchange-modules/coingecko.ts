import { debugLOG, toUnixSeconds } from '../utils.js'

export type CoinGeckoTokenPrice = [number, number];

const DOMAIN = 'https://api.coingecko.com'
const KEY = process.env.COINGECKO_PUBLIC_API_KEY ?? ''

async function getTokenPriceHistory (
  id: string,
  days = 365
): Promise<CoinGeckoTokenPrice[]> {
  const params = new URLSearchParams({
    precision: '4',
    days: days.toString(),
    interval: 'daily',
    vs_currency: 'usd',
    x_cg_demo_api_key: KEY
  })

  const path = `/api/v3/coins/${id}/market_chart`
  const endpoint = `${DOMAIN}${path}?${params.toString()}`

  const response = await fetch(endpoint)
  const data = await response.json()

  debugLOG(`Retrieved ${id} price history from ${DOMAIN}`)

  return data.prices as CoinGeckoTokenPrice[]
}

export async function getBATPriceHistory (): Promise<CoinGeckoTokenPrice[]> {
  const results = await getTokenPriceHistory('basic-attention-token', 365)
  // We prefer timestamps to be in seconds, not milliseconds
  return results.map(([t, p]) => [toUnixSeconds(t), p])
}
