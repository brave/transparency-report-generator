import fetch from 'node-fetch'
import { channelLabels, debugLOG } from '../utils.js'

interface GrowthRecord {
  record_date: string;
  total: number;
}

interface CategoryGrowthStats {
  [key: string]: Record<string, number>;
}

export async function getCreatorGrowth () {
  throw new Error('This function is deprecated: braveBAT.info is no longer available')
  debugLOG('Requesting creator growth from BraveBAT.info')
  const endpoint = 'https://bravebat.info/api/v2/creator_stats/daily_summary/'
  const results = {} as CategoryGrowthStats
  for (const channel of Object.keys(channelLabels)) {
    const records = (await (
      await fetch(endpoint + channel)
    ).json()) as GrowthRecord[]
    if (records.length === 0) {
      throw new Error(`No records found for channel '${channel}'`)
    }

    /**
     * Make sure records are in chronological order so that
     * when we iterate, the most recent data is always last.
     */
    records.sort((a, b) => {
      const aDate = new Date(a.record_date)
      const bDate = new Date(b.record_date)
      return aDate.getTime() < bDate.getTime() ? -1 : 1
    })

    for (const record of records) {
      const yearMonth = record.record_date.slice(0, 7)
      if (!results[yearMonth]) {
        results[yearMonth] = {}
      }
      if (!results[yearMonth][channel]) {
        results[yearMonth][channel] = 0
      }
      results[yearMonth][channel] = record.total
    }
  }
  debugLOG('Retrieved creator growth from BraveBAT.info')
  return results
}
