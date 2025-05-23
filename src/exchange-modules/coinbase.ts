import fetch from 'node-fetch'
import crypto from 'node:crypto'
import { debugLOG, Exchange, TransactionOrder } from '../utils.js'

const KEY = process.env.COINBASE_API_KEY ?? ''
const SECRET = process.env.COINBASE_API_SECRET ?? ''
const PASSPHRASE = process.env.COINBASE_API_PASSPHRASE ?? ''

if (!KEY || !SECRET || !PASSPHRASE) {
  throw new Error('Coinbase API key, secret, and passphrase are required')
}

interface CoinbaseTime {
  data: {
    iso: string;
    epoch: number;
  };
}

interface CoinbaseOrder {
  id: string;
  client_oid: string;
  product_id: string;
  profile_id: string;
  side: string;
  type: string;
  created_at: string;
  done_at: string;
  done_reason: string;
  fill_fees: string;
  filled_size: string;
  executed_value: string;
  market_type: string;
  status: string;
  settled: boolean;
  post_only?: boolean;
  time_in_force?: string;
  price?: string;
  size?: string;
}

interface CoinbaseCursor {
  before?: string | null;
  after?: string | null;
}

export async function getCoinbaseTime (): Promise<number> {
  const endpoint = 'https://api.coinbase.com/v2/time'
  const response = (await (await fetch(endpoint)).json()) as CoinbaseTime
  return response.data.epoch
}

function signRequest (
  time: number,
  SECRET: string,
  path: string,
  method = 'GET',
  body = ''
): string {
  const key = Buffer.from(SECRET, 'base64')
  const hmac = crypto.createHmac('sha256', key)
  const what = time + method + path + body
  return hmac.update(what).digest('base64')
}

/**
 * https://docs.cloud.coinbase.com/exchange/reference/exchangerestapi_getorders
 */
async function _getOrders (
  since = 0,
  pageCursor: CoinbaseCursor = {}
): Promise<CoinbaseOrder[]> {
  debugLOG('Requesting orders from Coinbase')

  const time = await getCoinbaseTime()
  const endpoint = 'https://api.pro.coinbase.com'
  const params = new URLSearchParams({
    status: 'done',
    product_id: 'BAT-USD',
    limit: '100'
  })

  if (pageCursor.after) {
    params.set('after', pageCursor.after)
  }

  const path = `/orders?${params.toString()}`
  const options = {
    method: 'GET',
    headers: {
      'CB-ACCESS-KEY': KEY,
      'CB-ACCESS-PASSPHRASE': PASSPHRASE,
      'Content-Type': 'application/json',
      'CB-ACCESS-TIMESTAMP': time.toString(),
      'CB-ACCESS-SIGN': signRequest(time, SECRET, path)
    }
  }

  const response = await fetch(endpoint + path, options)
  const body = (await response.json()) as CoinbaseOrder[]

  if (!response.ok) {
    debugLOG('Failed to retrieve orders from Coinbase')
    debugLOG(`  Status: ${response.status}`)
    debugLOG(`  Response: ${JSON.stringify(body)}`)
    return []
  }

  debugLOG(`Coinbase returned ${body.length} orders.`)

  /**
   * If Coinbase indicates more data is available, we'll
   * recursively call this function to retrieve items until
   * we've retrieved all available orders.
   */
  if (response.headers.has('cb-after')) {
    const nextOrders = await _getOrders(since, {
      after: response.headers.get('cb-after')
    })
    body.push(...nextOrders)
  }

  return body
}

function isValidOrder (order: CoinbaseOrder, since: number): boolean {
  const doneAt = new Date(order.done_at).getTime()
  const { settled, side, status, product_id: productID } = order
  return (
    settled &&
    side === 'buy' &&
    status === 'done' &&
    doneAt > since &&
    productID === 'BAT-USD'
  )
}

export async function getOrders (
  since = 0
): Promise<Record<string, TransactionOrder>> {
  console.group('Coinbase')
  const orders = await _getOrders(since)

  const results = orders.reduce((acc, order) => {
    if (isValidOrder(order, since)) {
      acc[order.client_oid] = {
        date: new Date(order.done_at).getTime(),
        site: Exchange.Coinbase,
        BAT: order.filled_size
      }
    }
    return acc
  }, {} as Record<string, TransactionOrder>)

  console.groupEnd()
  return results
}
