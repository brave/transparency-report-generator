import fetch from 'node-fetch'
import crypto from 'node:crypto'
import { debugLOG, Exchange, TransactionOrder } from '../utils.js'

const KEY = process.env.GEMINI_API_KEY
const SECRET = process.env.GEMINI_API_SECRET

if (!KEY || !SECRET) {
  throw new Error('Gemini API key and secret are required')
}

/**
 * https://docs.gemini.com/rest-api/#get-past-trades
 */
enum TradeTypes {
  Buy = 'Buy',
  Sell = 'Sell',
}

interface Trade {
  price: number;
  amount: string;
  timestamp: number;
  timestampms: number;
  type: TradeTypes;
  aggressor: boolean;
  fee_currency: string;
  fee_amount: number;
  tid: number;
  order_id: string;
  client_order_id: string;
  exchange: 'gemini';
  is_clearing_fill: boolean;
  symbol: string;
  break?: string;
}

interface Order {
  order_id: string,
  id: string,
  symbol: string,
  exchange: string,
  avg_execution_price: string,
  side: 'buy' | 'sell',
  type: 'exchange limit' | 'exchange stop limit' | 'exchange market',
  timestamp: string,
  timestampms: number,
  is_live: boolean,
  is_cancelled: boolean,
  is_hidden: false,
  was_forced: boolean,
  executed_amount: string,
  client_order_id: string,
  options: [],
  price: string,
  original_amount: string,
  remaining_amount: string,
  trades: Trade[]
}

function signRequest (secret: string, payload: string): string {
  return crypto.createHmac('sha384', secret).update(payload).digest('hex')
}

export async function getOrdersSince (timestamp = 0): Promise<Order[]> {
  const endpoint = 'https://api.gemini.com/v1/orders/history'

  const payload = Buffer.from(
    JSON.stringify({
      nonce: Date.now(),
      request: '/v1/orders/history',
      symbol: 'batusd',
      timestamp,
      limit_orders: 500
    })
  )

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': '0',
      'X-GEMINI-APIKEY': KEY ?? '',
      'X-GEMINI-PAYLOAD': payload.toString('base64'),
      'X-GEMINI-SIGNATURE': signRequest(SECRET ?? '', payload.toString('base64')),
      'Cache-Control': 'no-cache'
    }
  }

  const response = await fetch(endpoint, options)

  if (!response.ok) {
    debugLOG(`Failed to retrieve orders from Gemini: ${response.statusText}`)
    return []
  }

  const orders = (await response.json()) as Order[]

  return orders.filter((order) => {
    return order.side === 'buy' &&
      order.trades.length > 0 &&
      order.is_cancelled === false
  })
}

/**
 * We used to request trades, and then attempt to aggregate the trades into
 * specific orders. Instead, we now rely on the /v1/orders/history endpoint
 * via our `getOrdersSince` method. This should yield more accurate results
 * with less room for error.
 * https://docs.gemini.com/rest-api/#trade-history
 */
export async function getOrders (since = 0): Promise<Record<string, TransactionOrder>> {
  const results: Record<string, TransactionOrder> = {}

  let lastTimestamp = since

  while (true) {
    const orders = await getOrdersSince(lastTimestamp)

    // If no orders are returned, we've reached the end of the history
    if (Object.keys(orders).length === 0) {
      break
    }

    // Add the orders to the results
    for (const order of orders) {
      results[order.order_id] = {
        date: order.timestampms,
        site: Exchange.Gemini,
        BAT: order.trades.reduce((sum, { amount }) => {
          return sum + parseFloat(amount)
        }, 0).toString()
      }
    }

    // Update the last timestamp to the next timestamp
    lastTimestamp = parseInt(orders[0].timestamp) + 1
  }

  console.groupEnd()
  return results
}
