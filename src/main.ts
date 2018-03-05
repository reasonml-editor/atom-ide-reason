import * as cp from 'child_process'
import * as os from 'os'
import { AutoLanguageClient } from 'atom-languageclient'
import * as path from 'path'
import { CompositeDisposable } from 'atom';
import * as pkg from '../package.json'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import * as languageServer from 'ocaml-language-server'


type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]>
}

// hack for fix merge's types
import config from './config'

const confFile = ".atom/ide-reason.json"
const defaultConfig = languageServer.ISettings.defaults.reason
type Config = languageServer.ISettings['reason']

const scopes = [
  'source.reason',
  'source.ocaml',
  'source.re',
  'source.ml',
  'source.rei',
  'source.mli',
]

function flatten1<T>(array: T[]) {
  return ([] as T[]).concat(...array)
}

function joinEnvPath(...paths: (string | undefined)[]) {
  return flatten1(paths)
    .filter(Boolean)
    .join(path.delimiter)
}

function readFileConf(dir: string, file: string, property?: string) {
  try {
    file = path.join(dir, file)
    if (fs.existsSync(file)) {
      const conf = JSON.parse(fs.readFileSync(file, 'utf8'))
      return property ? conf[property] : conf
    }
  } catch (e) {
    console.error(e)
  }
  return null
}

class ReasonMLLanguageClient extends AutoLanguageClient {
  subscriptions: CompositeDisposable | null = null
  confPerProject: DeepPartial<Config> = {}

  getGrammarScopes () { return scopes }
  getLanguageName () { return 'Reason' }
  getServerName () { return 'ocamlmerlin' }
  getConnectionType() { return 'ipc' as 'ipc' }
  getRootConfigurationKey() { return 'ide-reason' }

  mapConfigurationObject(config: Config) {
    config = merge(merge({}, config), this.confPerProject)

    return {
      reason: {
        codelens: {
          enabled: false,
          unicode: true,
        },
        debounce: config.debounce,
        diagnostics: {
          tools: config.diagnostics.tools,
          merlinPerfLogging: false,
        },
        format: config.format,
        path: config.path,
        server: config.server,
      },
    }
  }

  activate() {
    super.activate()
    require('atom-package-deps').install('ide-reason')
      .then(() => {
        console.log('All dependencies installed, good to go')
      })

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      [`${pkg.name}:generateConfig`]: () => this.generateConfig().catch(console.error)
    }));
  }

  async generateConfig() {
    const paths = atom.project.getPaths()
    let curProject = paths[0]
    const editor = atom.workspace.getActiveTextEditor()
    if (editor) {
      const editorPath = editor.getPath()
      if (editorPath) {
        curProject = paths.filter(p => editorPath.startsWith(p))[0] || curProject
      }
    }
    const confPath = path.join(curProject, confFile)
    if (fs.existsSync(confPath)) {
      return atom.notifications.addWarning('ide-reason.json already exists!', {
        description: confPath,
      })
    }
    await fs.outputFile(
      confPath,
      JSON.stringify(defaultConfig, null, 2),
      'utf-8',
    )
  }

  startServerProcess(projectPath: string) {
    const serverPath = require.resolve('ocaml-language-server/bin/server')


    const confFromPkg: DeepPartial<Config> = readFileConf(projectPath, 'package.json', 'atom-reason') || {}
    const confFromFile: DeepPartial<Config> = readFileConf(projectPath, confFile) || {}
    this.confPerProject = merge(merge({}, confFromPkg), confFromFile)
    const envPath = process.env.PATH +
      (os.platform() === 'darwin'
        ? (path.delimiter + '/usr/local/bin') // Temporarily fix: https://github.com/atom/atom/issues/14924
        : '')
    return super.spawnChildNode([serverPath, '--node-ipc'], {
        stdio: [null, null, null, 'ipc'],
        cwd: projectPath,
        env: Object.assign({}, process.env, {
          PATH: envPath
        }),
      })
  }

  deactivate() {
    let result = super.deactivate()
    if (this.subscriptions) {
      this.subscriptions.dispose()
    }
    return result
  }
}

module.exports = new ReasonMLLanguageClient()

module.exports.config = config
