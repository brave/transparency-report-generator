import * as Utils from "./utils.js";
import * as Brave from "./modules/brave.js";
import * as BBI from "./modules/braveBATInfo.js";
import * as Uphold from "./exchange-modules/uphold.js";
import * as Gemini from "./exchange-modules/gemini.js";
import * as Coinbase from "./exchange-modules/coinbase.js";

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
export const handler = async () => {
  // Get existing data, if any
  let source: Utils.TransparencyFile = {} as Utils.TransparencyFile;
  try {
    source = await Utils.getFile("https://brave.com/transparency-data.json");
    /**
     * If verbose logging is enabled, log how long it has been since
     * the source file was last updated.
     */
    if (process.env.DEBUG === "true") {
      const hoursAgo = ((Date.now() - source.updated) / (36e5)).toFixed(1);
      console.log(`Last updated ${hoursAgo} hours ago`);
    }
  } catch (err) {
    Utils.debugLOG((err as Error).message);
  }

  // Update 'users' property
  console.group("Active Users");

  await Brave.getMauDau()
    .then((data) => {

      if (!source.users) {
        source.users = {};
      }

      for (const [date, stats] of Object.entries(data)) {

        // If we have any zero values in stats, skip this entry
        if (Object.values(stats).some((value) => value === 0)) {
          continue;
        }

        let index = date;

        // Convert YYYY-MM-DD to YYYY-MM
        if (/\d{4}-\d{2}-\d{2}/.test(index)) {
          index = date.substring(0, 7);
        }

        source.users[index] = {
          mau: stats.browser_mau_adjusted,
          dau: stats.browser_dau_monthly_avg,
        };
      }
      // Sort entries with recent dates earlier in the object
      source.users = Object.fromEntries(
        Object.entries(source.users).sort(([aDate], [bDate]) => {
          return aDate < bDate ? 1 : -1;
        })
      );
    })
    .catch((err: Error) => {
      console.log(err);
    });

  console.groupEnd();

  // Update 'metrics' property
  console.group("Metrics (bravebat.info)");

  // Ensure that the 'metrics' property exists
  if (!source.metrics) {
    source.metrics = {
      growth: {},
      categories: {},
      categoryGrowth: {},
    };
  }

  await BBI.getCreatorGrowth()
    .then((results) => {
      const entries = Object.entries(results);
      const [, latestStats] = entries[entries.length - 1];
      // Transfer all new data to the source object
      for (const [month, stats] of entries) {
        source.metrics.categoryGrowth[month] = Utils.labelize(stats);
        source.metrics.growth[month] = Object.values(stats).reduce(
          (a, b) => a + b
        );
      }
      // Apply up-to-date category figures to the source object
      for (const channelType in latestStats) {
        const label: string = Utils.channelLabels[channelType];
        const stats: number = latestStats[channelType];
        source.metrics.categories[label] = stats;
      }
    })
    .catch((err: Error) => {
      console.log(err);
    });

  console.groupEnd();

  // Update 'transactions' property
  console.group(`Updating transactions`);

  // Ensure that the 'transactions' property exists
  if (!source.transactions) {
    source.transactions = {};
  }

  /**
   * Update 'transactions' property.
   *
   * To avoid having to completely rebuild the entire transaction
   * array with each run, we'll start by finding the most recent txns
   * for Gemini and Coinbase. The timestamps for these transactions can
   * then be provided to the respective `getOrders` methods. This will
   * allow us to only retrieve the transactions that have occurred since
   * the last run, if any. Uphold requires a different approach, as it
   * uses a manually-updated list of transaction IDs. As such, if we have
   * fewer Uphold transactions than we do transaction IDs, we'll request
   * the delta and append it to the existing list.
   */
  try {
    const initialTxns = Object.keys(source.transactions);

    if (initialTxns.length) {
      console.log(`Existing transactions: ${initialTxns.length}`);

      const txns = Object.entries(source.transactions);
      const upholdTxns = txns.filter(
        ([, { site }]) => site === Utils.Exchange.Uphold
      );
      const geminiTxns = txns.filter(
        ([, { site }]) => site === Utils.Exchange.Gemini
      );
      const cnbaseTxns = txns.filter(
        ([, { site }]) => site === Utils.Exchange.Coinbase
      );

      // Update Uphold only if necessary
      const upholdTransactionIDs = await Uphold.getTransactionIDs(
        upholdTxns.length
      );
      if (upholdTxns.length < upholdTransactionIDs.length) {
        for (const upholdTransactionID of upholdTransactionIDs) {
          if (upholdTransactionID in source.transactions === false) {
            const details = await Uphold.getTransactionByID(
              upholdTransactionID
            );
            source.transactions[upholdTransactionID] = details;
          }
        }
      }

      // Get most recent timestamp for Gemini
      // TODO: Make sure this timestamp works as intended
      const geminiTimestamp = Math.max(
        ...geminiTxns.map(([, { date }]) => date)
      );
      const geminiOrders = await Gemini.getOrders(geminiTimestamp);
      for (const [id, details] of Object.entries(geminiOrders)) {
        source.transactions[id] = details;
      }

      // Get most recent timestamp for Coinbase
      const coinbaseTimestamp = Math.max(
        ...cnbaseTxns.map(([, { date }]) => date)
      );
      const coinbaseOrders = await Coinbase.getOrders(coinbaseTimestamp);
      for (const [id, details] of Object.entries(coinbaseOrders)) {
        source.transactions[id] = details;
      }
    } else {
      source.transactions = {
        ...(await Uphold.getOrders()),
        ...(await Gemini.getOrders()),
        ...(await Coinbase.getOrders()),
      };
    }
    const finalTxns = Object.keys(source.transactions);
    if (finalTxns.length > initialTxns.length) {
      console.log(`New transactions: ${finalTxns.length - initialTxns.length}`);
    } else if (finalTxns.length === initialTxns.length) {
      console.log(`No new transactions`);
    }
  } catch (err) {
    console.log((err as Error).message);
  }

  console.groupEnd();

  // Update 'braveAds' property
  console.group("Brave Rewards, Ads, and BAT History");

  await Brave.getActiveCampaigns()
    .then((data) => {
      source.braveAds = data;
    })
    .catch((err: Error) => {
      console.log(err);
    });

  /**
   * Update 'bat' property.
   *
   * This information is derived from the public blockchain, and
   * is retrieved via ethplorer.io. These metrics DO NOT pertain
   * to the operation of Brave Rewards. As such, the 'holders'
   * count is not indicative of the number of users within the
   * Brave Rewards program. Likewise, the number of 'transfers'
   * is not the same as the number of tips/contributions issued
   * by Rewards users to verified content creators.
   */
  await Promise.all([Brave.getBATInfo(), Brave.getBATHistory()])
    .then(([I, H]) => {
      source.bat = {
        price: I.price.rate,
        holders: I.holdersCount,
        marketcap: I.price.marketCapUsd,
        transactions: I.transfersCount,
        history: H.Data.Data.reduce(
          (acc, cur: Brave.CryptoCompareData) => {
            return (acc[cur.time] = cur.close), acc;
          },
          {} as Record<number, number>
        ),
      };
    })
    .catch((err: Error) => {
      console.log(err);
    });

  // Update 'wallets' property
  await Brave.getRewardsPayoutRecordHistory()
    .then((data) => {
      const latestCount = data[data.length - 1];
      if (latestCount) {
        // Round to nearest 10,000
        const wallets = Utils.roundToNearest(
          parseInt(latestCount.total_number_of_wallets),
          10_000
        );
        if (source.wallets && wallets !== source.wallets) {
          Utils.debugLOG(
            `Updating wallets from ${source.wallets} to ${wallets}`
          );
        } else if (!source.wallets) {
          Utils.debugLOG(`Setting wallets to ${wallets}`);
        }
        source.wallets = wallets;
      }
    })
    .catch((err: Error) => {
      console.log(err);
    });

  console.groupEnd();

  // Update 'updated' property
  source.updated = Date.now();

  return source;
};
