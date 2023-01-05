import fetch from "node-fetch";
import { debugLOG, Exchange, getFile, TransactionOrder } from "../utils.js";

/**
 * These are not complete interfaces. More information can be found
 * at https://uphold.com/en/developer/api/documentation/#transaction-object.
 */

interface Destination {
  amount: string;
}

interface UpholdTransaction {
  createdAt: string;
  destination: Destination;
}

export async function getTransactionIDs(
  knownIDs: number = 0
): Promise<string[]> {
  console.group("Uphold");
  debugLOG("Requesting transaction IDs");

  const filename = "transactionIDs";
  const contents = await getFile(filename);

  const IDs = contents
    .split(`\n`)
    .filter((id: string) => id && !id.startsWith("#"));

  debugLOG(`Retrieved ${IDs.length} Uphold transaction IDs`);

  if (IDs.length === knownIDs) {
    debugLOG("No new transactions");
  }

  console.groupEnd();

  return IDs;
}

export async function getTransactionByID(
  txnID: string
): Promise<TransactionOrder> {
  console.group("Uphold");
  debugLOG(`Requesting transaction ${txnID} from Uphold`);

  const endpoint = `https://api.uphold.com/v0/reserve/transactions/${txnID}`;
  const response = (await (await fetch(endpoint)).json()) as UpholdTransaction;

  debugLOG(`Retrieved details for transaction ${txnID} from Uphold`);
  console.groupEnd();
  return {
    date: new Date(response.createdAt).getTime(),
    site: Exchange.Uphold,
    BAT: parseFloat(response.destination.amount).toFixed(2),
  };
}

/**
 * Uphold's `getOrders` method differs a bit from that of the Gemini and Coinbase modules.
 * Instead of retrieving all transactions from the API, we instead load a list of transaction
 * IDs from a local file, and then use that list to retrieve the details of each transaction.
 * This method is provided for parity with the other modules.
 */
export async function getOrders(
  timestamp: number = 0
): Promise<Record<string, TransactionOrder>> {
  const transactions = await getTransactionIDs();
  const results: Record<string, TransactionOrder> = {};
  for (const transaction of transactions) {
    const order = await getTransactionByID(transaction);
    if (order.date > timestamp) {
      results[transaction] = order;
    }
  }
  return results;
}
