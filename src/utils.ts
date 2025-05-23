import { get } from 'node:https'
import { readFile } from 'node:fs/promises'
import { RegionCampaigns } from './modules/brave'

export enum Exchange {
  Uphold = 'Uphold',
  Coinbase = 'Coinbase',
  Gemini = 'Gemini',
}

export interface TransactionOrder {
  BAT: string;
  date: number;
  site: Exchange;
}

export interface TransparencyFile {
  wallets: number;
  updated: number;
  users: Record<
    string,
    {
      mau: number;
      dau: number;
    }
  >;
  bat: {
    transactions: number;
    price: number;
    holders: number;
    marketcap: number;
    history: Record<number, number>;
  };
  transactions: Record<string, TransactionOrder>;
  metrics: {
    growth: Record<string, number>;
    categories: Record<string, number>;
    categoryGrowth: Record<string, Record<string, number>>;
  };
  braveAds: RegionCampaigns[];
}

export const channelLabels = {
  website: 'Websites',
  twitter: 'Twitter',
  youtube: 'YouTube',
  reddit: 'Reddit',
  github: 'GitHub',
  vimeo: 'Vimeo',
  twitch: 'Twitch'
} as Record<string, string>

export function labelize (platformStats: Record<string, number>) {
  const labelized = {} as Record<string, number>
  for (const platform in platformStats) {
    labelized[channelLabels[platform]] = platformStats[platform]
  }
  return labelized
}

export function roundToNearest (number: number, nearest: number): number {
  return Math.round(number / nearest) * nearest
}

export async function getFile (filepath: string) {
  let contents: string
  if (filepath.startsWith('http')) {
    contents = await new Promise<string>((resolve, reject) => {
      get(filepath, (response) => {
        let data = ''
        response.on('data', (chunk) => (data += chunk))
        response.on('end', () => resolve(data))
      }).on('error', (error) => {
        reject(error)
      })
    })
  } else {
    contents = await readFile(filepath, 'utf-8')
  }

  if (filepath.endsWith('.json')) {
    try {
      return JSON.parse(contents)
    } catch (error) {
      console.error(`Error parsing JSON from ${filepath}:`, error)
      return {}
    }
  }
  return contents
}

export function debugLOG (message: string | object) {
  if (process.env.DEBUG === 'true') {
    console.log(message)
  }
}
