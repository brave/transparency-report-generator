import { writeFile } from 'node:fs/promises'
import { handler } from './platform.js'

if (process.argv.includes('--verbose=true')) {
  process.env.DEBUG = 'true'
}

const data = await handler()

if (process.argv.includes('--save=true')) {
  await writeFile('transparency.json', JSON.stringify(data))
}
