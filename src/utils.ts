import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import { Config, DeepPartial, ToolKeys } from './types'
import * as cjson from 'cjson'


const toolkeys: ToolKeys[] = [
  "bsb", "bsc", "env", "esy", "ocamlfind", "ocamlmerlin", "opam", "rebuild", "refmt", "refmterr", "rtop"
]

function flatten1<T>(array: T[]) {
  return ([] as T[]).concat(...array)
}

function parseConf(conf: any, property: string = "toolchainPath") {
  if (!conf || !conf[property]) {
    return conf
  }
  let confFromPath: DeepPartial<Config> = {path: {}}
  const toolchainPaths: string[] = flatten1([conf[property]])
  delete conf[property]
  for (const toolname of toolkeys) {
    for (const toolchainPath of toolchainPaths) {
      if (fs.existsSync(path.join(toolchainPath, toolname))) {
        if (confFromPath.path) {
          confFromPath.path[toolname] = path.join(toolchainPath, toolname)
        }
        break;
      }
    }
  }
  return merge(merge({}, confFromPath), conf)
}

export function readFileConf<Config>(file: string): DeepPartial<Config> {
  try {
    if (fs.existsSync(file)) {
      const conf = cjson.load(file)
      return parseConf(conf)
    }
  } catch (e) {
    console.error(e)
  }
  return {}
}

export function capitalize(str: string) {
  if (!str) {
    return str
  }
  return str[0].toUpperCase() + str.slice(1)
}
