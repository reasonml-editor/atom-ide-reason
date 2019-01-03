import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import { Config, DeepPartial, OLSToolKeys } from './types'
import * as cjson from 'cjson'
import { diffWordsWithSpace, diffLines } from 'diff'
import { Point, Range } from 'atom'
import { TextEdit } from 'atom-ide';

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


export function diff(original: string, text: string) {
  let pos = new Point(0, 0)
  let edits: TextEdit[] = []
  for (let { value, added, removed } of diffLines(original, text, { ignoreCase: false, newlineIsToken: true, ignoreWhitespace: false })) {
    const m = value.match(/\r\n|\n|\r/g)
    const row = m ? m.length : 0

    const newlineIndex = Math.max(
      value.lastIndexOf('\n'),
      value.lastIndexOf('\r')
    )
    const col = value.length - (newlineIndex + 1)

    const endPos = pos.traverse([row, col])

    if (added) {
      edits.push({ oldRange: new Range(pos, pos), newText: value, oldText: '' })
      pos = endPos
    } else if (removed) {
      edits.push({ oldRange: new Range(pos, endPos), newText: '', oldText: value })
    } else {
      pos = endPos
    }
  }
  return edits
}
