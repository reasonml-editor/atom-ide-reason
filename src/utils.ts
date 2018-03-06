import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs-extra'
import { Config, DeepPartial } from './types'


export function readFileConf(file: string): DeepPartial<Config> {
  try {
    if (fs.existsSync(file)) {
      return fs.readJsonSync(file, { encoding: 'utf-8' })
    }
  } catch (e) {
    console.error(e)
  }
  return {}
}
