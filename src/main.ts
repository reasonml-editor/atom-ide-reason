import * as cp from 'child_process'
import * as os from 'os'
import { AutoLanguageClient, ActiveServer } from 'atom-languageclient'
import * as path from 'path'
import { CompositeDisposable, FilesystemChangeEvent } from 'atom';
import * as languageServer from 'ocaml-language-server'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import * as pkg from '../package.json'
import config from './config'
import * as Utils from './utils'
import { DeepPartial, Config } from './types'

const confFile = ".atom/ide-reason.json"
const defaultConfig = languageServer.ISettings.defaults.reason

const scopes = [
  'source.reason',
  'source.ocaml',
  'source.re',
  'source.ml',
  'source.rei',
  'source.mli',
]

class ReasonMLLanguageClient extends AutoLanguageClient {
  subscriptions: CompositeDisposable | null = null
  confPerProject: DeepPartial<Config> = {}
  servers: { [K: string]: ActiveServer } = {}

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

    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        [`${pkg.name}:generate-config`]: () => this.generateConfig().catch(console.error)
      }),
      atom.commands.add('atom-workspace', {
        [`${pkg.name}:restart-all-servers`]: () => this.restartAllServers().catch(console.error)
      }),
    )

    this.subscriptions.add(
      atom.notifications.onDidAddNotification(notification => this.autoDismissBrokenPipeError(notification)),
      atom.project.onDidChangeFiles(events => this.notifyServersOnProjectConfigChange(events)),
    )
  }

  autoDismissBrokenPipeError(notification: any) {
    if (!notification.message.includes('Broken pipe')) return
    setTimeout(() => notification.dismiss(), 1000)
  }

  notifyServersOnProjectConfigChange(events: Array<any>) {
    events = events.filter(e => e.path.endsWith(confFile))
    if (events.length > 0) {
      for (const projectPath in this.servers) {
        const event = events.find(e => e.path.startsWith(projectPath))
        if (event) {
          const server = this.servers[projectPath]
          const globalConf = atom.config.get(this.getRootConfigurationKey())
          const fileConf = Utils.readFileConf(event.path)
          server.connection.didChangeConfiguration(merge(globalConf, fileConf))
        }
      }
    }
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

  postInitialization(server: ActiveServer) {
    this.servers[server.projectPath] = server
    server.process.on('exit', () => {
      delete this.servers[server.projectPath]
    })
  }

  startServerProcess(projectPath: string) {
    const serverPath = require.resolve('ocaml-language-server/bin/server')


    const confFromFile: DeepPartial<Config> = Utils.readFileConf(path.join(projectPath, confFile)) || {}
    this.confPerProject = confFromFile
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
