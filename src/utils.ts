import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import { Config, DeepPartial, OLSToolKeys } from './types'
import * as cjson from 'cjson'

const toolkeys: OLSToolKeys[] = [
  "bsb",
  "env",
  "esy",
  "ocamlfind",
  "ocamlmerlin",
  "opam",
  "rebuild",
  "refmt",
  "refmterr",
  "rtop",
]

function flatten1<T>(array: T[]) {
  return ([] as T[]).concat(...array)
}

export function readFile<Config>(file: string) {
  try {
    if (fs.existsSync(file)) {
      return cjson.load(file)
    }
  } catch (e) {
    console.error(e)
  }
  return null
}

export function readPerProjectConfig(file: string) {
  const configFromFile = readFile(file)

  if (!configFromFile || !configFromFile.toolchainPath) {
    return configFromFile
  }

  let configFromPath: any = {ols: {path: {}}}
  const toolchainPaths: string[] = flatten1([configFromFile.toolchainPath])
  delete configFromFile.toolchainPath
  for (const toolname of toolkeys) {
    for (const toolchainPath of toolchainPaths) {
      if (fs.existsSync(path.join(toolchainPath, toolname))) {
        configFromPath.ols.path[toolname] = path.join(toolchainPath, toolname)
        break;
      }
    }
  }

  return merge(merge({}, configFromPath), configFromFile)
}

export function capitalize(str: string) {
  if (!str) {
    return str
  }
  return str[0].toUpperCase() + str.slice(1)
}
