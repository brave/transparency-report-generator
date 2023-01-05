import fetch from "node-fetch";
import { debugLOG } from "../utils.js";

const ADS_SERVER_STATS_CREDENTIAL = process.env.ADS_SERVER_STATS_CREDENTIAL;

interface GeoCode {
  code: string;
  name: string;
}

export interface RegionCampaigns {
  country: string;
  count: string;
  name?: string;
}

export interface RewardsInstanceCount {
  date: string;
  total_number_of_wallets: string;
}

/**
 * https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API#get-token-info
 */
export interface TokenInfoPrice {
  rate: number;
  currency: string;
  diff: number;
  diff7d: number;
  diff30d: number;
  marketCapUsd: number;
  availableSupply: number;
  volume24h: number;
  ts: number;
}

export interface TokenInfo {
  address: string;
  totalSupply: string;
  name: string;
  symbol: string;
  decimals: string;
  price: TokenInfoPrice;
  owner: string;
  countOps: number;
  transfersCount: number;
  holdersCount: number;
  issuancesCount: number;
  lastUpdated: number;
}

export interface CryptoCompareResponse {
  Response: string;
  Message: string;
  HasWarning: boolean;
  Type: number;
  Data: CryptoCompareDataSet;
}

export interface CryptoCompareDataSet {
  Aggregated: boolean;
  TimeFrom: number;
  TimeTo: number;
  Data: CryptoCompareData[];
}

export interface CryptoCompareData {
  time: number;
  high: number;
  low: number;
  open: number;
  volumefrom: number;
  volumeto: number;
  close: number;
  conversionType: string;
  conversionSymbol: string;
}

// TODO: Sparse data; nothing after 2022-04-01.
export async function getRewardsPayoutRecordHistory(): Promise<
  RewardsInstanceCount[]
> {
  debugLOG("Requesting count of Rewards instances");
  const endpoint = `https://ads-serve.brave.com/v1/stat/payout`;
  const headers = { Authorization: `Bearer ${ADS_SERVER_STATS_CREDENTIAL}` };
  const response = (await (
    await fetch(endpoint, { headers })
  ).json()) as RewardsInstanceCount[];
  debugLOG(`Retrieved count of Rewards instances (x${response.length})`);
  return response.sort((a: RewardsInstanceCount, b: RewardsInstanceCount) =>
    a.date.localeCompare(b.date)
  );
}

export async function getBATInfo(): Promise<TokenInfo> {
  debugLOG("Requesting BAT info from ethplorer.io");
  const address = "0x0d8775f648430679a709e98d2b0cb6250d2887ef";
  const endpoint = `https://api.ethplorer.io/getTokenInfo/${address}?apiKey=freekey`;
  const response = (await (await fetch(endpoint)).json()) as TokenInfo;
  debugLOG("Retrieved BAT info from ethplorer.io");
  return response;
}

// https://min-api.cryptocompare.com/documentation?key=Historical&cat=dataHistoday
export async function getBATHistory(): Promise<CryptoCompareResponse> {
  debugLOG("Requesting BAT price history from cryptocompare.com");
  const endpoint = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BAT&tsym=USD&limit=2000`;
  const options = { method: "POST" };
  const response = (await (
    await fetch(endpoint, options)
  ).json()) as CryptoCompareResponse;
  debugLOG("Retrieved BAT price history from cryptocompare.com");
  return response;
}

export async function getSupportedRegionGeoCodes(): Promise<GeoCode[]> {
  debugLOG("Requesting list of supported regions from ads-static.brave.com");
  const endpoint = `https://ads-static.brave.com/v1/geoCode`;
  const response = (await (await fetch(endpoint)).json()) as GeoCode[];
  debugLOG("Retrieved list of supported regions from ads-static.brave.com");
  return response;
}

export async function getActiveCampaigns(): Promise<RegionCampaigns[]> {
  debugLOG("Requesting list of active campaigns from ads-serve.brave.com");
  const endpoint = `https://ads-serve.brave.com/v1/stat/campaign/summary`;
  const headers = { Authorization: `Bearer ${ADS_SERVER_STATS_CREDENTIAL}` };
  const regionCodes = await getSupportedRegionGeoCodes();
  const response = (await (
    await fetch(endpoint, { headers })
  ).json()) as RegionCampaigns[];
  debugLOG("Retrieved list of active campaigns from ads-serve.brave.com");
  // Get `name` from regionCodes and add to response entries
  return response.map((entry: RegionCampaigns) => {
    const regionCode = regionCodes.find(
      (code: GeoCode) => code.code === entry.country
    );
    if (regionCode) {
      return { ...entry, name: regionCode.name };
    }
    return entry;
  });
}
