import fetch from "node-fetch";
import { channelLabels, debugLOG } from "../utils.js";

type MAUDAULabels = "Brave Browser MAU (M)" | "Brave Browser DAU (M)";

interface ActiveUsers {
  labels: string[];
  data: {
    [key in MAUDAULabels]: number[];
  };
}

interface ActiveUsersSet {
  mau: ActiveUsers;
  dau: ActiveUsers;
}

interface GrowthRecord {
  record_date: string;
  total: number;
}

interface CategoryGrowthStats {
  [key: string]: Record<string, number>;
}

async function getUsersMAU(): Promise<ActiveUsers> {
  debugLOG("Requesting MAUs from BraveBAT.info");
  const endpoint = `https://bravebat.info/charts/mau`;
  const response = (await (await fetch(endpoint)).json()) as ActiveUsers;
  debugLOG("Retrieved MAUs from BraveBAT.info");
  return response;
}

async function getUsersDAU(): Promise<ActiveUsers> {
  debugLOG("Requesting DAUs from BraveBAT.info");
  const endpoint = `https://bravebat.info/charts/dau`;
  const response = (await (await fetch(endpoint)).json()) as ActiveUsers;
  debugLOG("Retrieved DAUs from BraveBAT.info");
  return response;
}

export async function getUsers(): Promise<ActiveUsersSet> {
  debugLOG("Requesting users from BraveBAT.info");
  const mau = await getUsersMAU();
  const dau = await getUsersDAU();
  debugLOG("Retrieved users from BraveBAT.info");
  return { mau, dau };
}

export async function getCreatorGrowth() {
  debugLOG("Requesting creator growth from BraveBAT.info");
  const endpoint = `https://bravebat.info/api/v2/creator_stats/daily_summary/`;
  const results = {} as CategoryGrowthStats;
  for (const channel of Object.keys(channelLabels)) {
    const records = (await (
      await fetch(endpoint + channel)
    ).json()) as GrowthRecord[];
    if (records.length === 0) {
      throw new Error(`No records found for channel '${channel}'`);
    }

    /**
     * Make sure records are in chronological order so that
     * when we iterate, the most recent data is always last.
     */
    records.sort((a, b) => {
      const aDate = new Date(a.record_date);
      const bDate = new Date(b.record_date);
      return aDate.getTime() < bDate.getTime() ? -1 : 1;
    });

    for (const record of records) {
      const yearMonth = record.record_date.slice(0, 7);
      if (!results[yearMonth]) {
        results[yearMonth] = {};
      }
      if (!results[yearMonth][channel]) {
        results[yearMonth][channel] = 0;
      }
      results[yearMonth][channel] = record.total;
    }
  }
  debugLOG("Retrieved creator growth from BraveBAT.info");
  return results;
}
