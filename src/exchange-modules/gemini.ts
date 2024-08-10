import fetch from "node-fetch";
import crypto from "node:crypto";
import { debugLOG, Exchange, TransactionOrder } from "../utils.js";

const KEY = process.env.GEMINI_API_KEY;
const SECRET = process.env.GEMINI_API_SECRET;

if (!KEY || !SECRET) {
  throw new Error("Gemini API key and secret are required");
}

/**
 * https://docs.gemini.com/rest-api/#get-past-trades
 */
enum TradeTypes {
  Buy = "Buy",
  Sell = "Sell",
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
  exchange: "gemini";
  is_clearing_fill: boolean;
  symbol: string;
  break?: string;
}

function signRequest(secret: string, payload: string): string {
  return crypto.createHmac("sha384", secret).update(payload).digest("hex");
}

/**
 * The Gemini API does not provide an endpoint to get all past Orders. As a result,
 * we can only query previous trades, and construct a list of Order IDs from there.
 * This is not ideal as it could result in the inclusion of incomplete Orders.
 *
 * TODO: Query the /v1/orders endpoint to get the status of individual Order IDs to
 * see if they are active, or complete. This would enable us to better communicate
 * when an Order is still open, and when it has been completed.
 *
 * https://docs.gemini.com/rest-api/#trade-history
 */
export async function getOrders(
  timestamp = 0
): Promise<Record<string, TransactionOrder>> {
  console.group("Gemini");
  const results: Record<string, TransactionOrder> = {};

  /**
   * This timestamp corresponds to early test purchases made on Gemini.
   * We would like to exclude those from the results since they are small
   * and insignificant. By adding 1ms, we will retrieve only trades which
   * occurred after these earlier test transactions.
   */
  let hasTrades = true;
  let afterTimestamp = timestamp || 1649111057653;

  while (hasTrades) {
    const afterDate = new Date(afterTimestamp).toLocaleString();

    debugLOG(
      `Requesting transactions${timestamp > 0 ? ` since ${afterDate}` : ``}`
    );

    const payload = Buffer.from(
      JSON.stringify({
        nonce: Date.now(),
        request: "/v1/mytrades",
        symbol: "batusd",
        timestamp: afterTimestamp + 1,
        limit_trades: 500,
      })
    );

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "0",
        "X-GEMINI-APIKEY": KEY ?? "",
        "X-GEMINI-PAYLOAD": payload.toString("base64"),
        "X-GEMINI-SIGNATURE": signRequest(
          SECRET ?? "",
          payload.toString("base64")
        ),
        "Cache-Control": "no-cache",
      },
    };

    const endpoint = "https://api.gemini.com/v1/mytrades";
    const response = await fetch(endpoint, options);

    if (!response.ok) {
      debugLOG(
        `Failed to retrieve transactions from Gemini${
          timestamp > 0 ? `since ${afterDate}` : ``
        }`
      );
      debugLOG(await response.text());
      break;
    }

    const trades = (await response.json()) as Trade[];

    if (trades.length == 0) {
      debugLOG(`No more transactions to retrieve from Gemini`);
      hasTrades = false;
    }

    if ( trades.length > 0 ) {
      const firstDate = new Date(trades[0].timestampms).toLocaleString();
      const lastDate = new Date(trades[trades.length - 1].timestampms).toLocaleString();
      debugLOG(`Retrieved ${trades.length} trades spanning ${lastDate} to ${firstDate}`);

      /**
       * Because trades are sorted with the most recent first, we can
       * add 1ms to the first item's timestamp to ensure we don't get
       * duplicate trades in the next request.
       * See: https://docs.gemini.com/rest-api/#get-past-trades
       */
      afterTimestamp = trades[0].timestamp;

      for (const trade of trades) {

        if (trade.type !== TradeTypes.Buy) continue;

        const id = trade.order_id;
        const time = trade.timestampms;
        const amount = parseFloat(trade.amount);

        /**
         * A trade for this order has already been encountered.
         * Let's push the date back for this order if necessary,
         * and increase the total amount of associated BAT too.
         */
        if (results[id]) {
          const newAmount = parseFloat(results[id].BAT) + amount;
          results[id].date = Math.min(results[id].date, time);
          results[id].BAT = newAmount.toString();
          continue;
        }

        /**
         * This is the first time we've encountered this order.
         */
        results[id] = {
          date: time,
          site: Exchange.Gemini,
          BAT: amount.toString(),
        };
      }
    }
  }

  console.groupEnd();
  return results;
}
