import * as cp from 'child_process'
import * as os from 'os'
import { AutoLanguageClient, ActiveServer } from 'atom-languageclient'
import * as path from 'path'
import { CompositeDisposable, FilesystemChangeEvent } from 'atom'
import * as languageServer from 'ocaml-language-server'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import * as pkg from '../package.json'
import config from './config'
import * as Utils from './utils'
import { DeepPartial, Config, FileExtension } from './types'

const confFile = ".atom/ide-reason.json"
const defaultConfig = merge<Config>(
  languageServer.ISettings.defaults.reason,
  {
    path: {
      bsc: 'bsc',
    },
  },
)

const scopes = [
  'ocaml',
  'reason',
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

    this.subscriptions = new CompositeDisposable()

    this.subscriptions.add(
      atom.commands.add('atom-workspace', {
        [`${pkg.name}:generate-config`]: () => this.generateConfig().catch(console.error)
      }),
      atom.commands.add('atom-workspace', {
        [`${pkg.name}:restart-all-servers`]: () => this.restartAllServers().catch(console.error)
      }),
    )

    this.subscriptions.add(
      atom.commands.add('atom-text-editor[data-grammar~="reason"]', {
        [`${pkg.name}:generate-interface`]: () => this.generateInterfaceFromEditor('re'),
      }),
      atom.commands.add('atom-text-editor[data-grammar~="ocaml"]', {
        [`${pkg.name}:generate-interface`]: () => this.generateInterfaceFromEditor('ml'),
      }),
      atom.commands.add(".tree-view .file .name[data-name$=\\.re]", {
        [`${pkg.name}:generate-interface`]: event => this.generateInterfaceFromTreeView(event, 're'),
      }),
      atom.commands.add(".tree-view .file .name[data-name$=\\.ml]", {
        [`${pkg.name}:generate-interface`]: event => this.generateInterfaceFromTreeView(event, 'ml'),
      }),
    )

    this.subscriptions.add(
      atom.notifications.onDidAddNotification(notification => this.autoDismissBrokenPipeError(notification)),
      atom.project.onDidChangeFiles(events => this.notifyServersOnProjectConfigChange(events)),
    )
  }

  showWarning(message: string, detail?: string) {
    atom.notifications.addWarning(message, {
      detail,
      dismissable: true,
    })
  }

  showError(message: string, error: Error) {
    atom.notifications.addError(message, {
      detail: error.stack ? error.stack.toString() : undefined,
      dismissable: true,
    })
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
        curProject = atom.project.relativizePath(editorPath)[0] || curProject
      }
    }
    const confPath = path.join(curProject, confFile)
    if (fs.existsSync(confPath)) {
      return this.showWarning('ide-reason.json already exists!', confPath)
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

  // Interface generator
  generateInterfaceFromTreeView(event: any, ext: FileExtension) {
    this.generateInterface(event.target.dataset.path, ext)
  }

  generateInterfaceFromEditor(ext: FileExtension) {
    const activeEditor = atom.workspace.getActiveTextEditor()
    if (!activeEditor) {
      this.showWarning("No active editor found")
      return
    }
    const srcAbsPath = activeEditor.getPath()
    if (!srcAbsPath) {
      this.showWarning(
        "Can't generate interface file from unsaved buffer. Save source file first.",
      )
      return
    }
    this.generateInterface(srcAbsPath, ext)
  }

  generateInterface(srcAbsPath: string, ext: FileExtension) {
    const [root, srcRelPath] = atom.project.relativizePath(srcAbsPath)
    if (!root) {
      this.showWarning("Can't find root directory of the project")
      return
    }
    let namespace = ''
    try {
      const bsconf = Utils.readFileConf<{ namespace: boolean; name: string }>(path.join(root, 'bsconfig.json'))
      if (bsconf.namespace) {
        namespace = bsconf.name ? '-' + Utils.capitalize(bsconf.name) : namespace
      }
    } catch (error) {
      console.warn('[ide-reason] read bsconfig.json failed:', error)
    }

    const baseRelPath = srcRelPath.substring(0, srcRelPath.length - 3)
    const cmiAbsPath = path.join(root, "lib", "bs", baseRelPath + namespace + ".cmi")
    const interfaceAbsPath = path.join(root, baseRelPath + '.' + ext + "i")

    let bscBin;
    if (this.confPerProject && this.confPerProject.path && this.confPerProject.path.bsc) {
      bscBin =
        path.isAbsolute(this.confPerProject.path.bsc)
        ? this.confPerProject.path.bsc
        : path.join(root, this.confPerProject.path.bsc)
    } else {
      bscBin = atom.config.get(this.getRootConfigurationKey()).path.bsc
    }

    if (!bscBin) {
      this.showWarning(
        "Provide path to `bsc` binary in config: Path > bsc",
      )
      return
    }

    const cmd =
      ext === 'ml'
      ? `${bscBin} ${cmiAbsPath}`
      : `${bscBin} -bs-re-out ${cmiAbsPath}`
    cp.exec(cmd, (error, stdout) => {
      if (error) {
        this.showError("Oops! Can't generate interface file", error)
        return
      }
      const writeFile = () => {
        fs.outputFile(interfaceAbsPath, stdout, error => {
          if (error) {
            this.showError("Oops! Can't write generated interface file", error)
            return
          }
          atom.workspace.open(interfaceAbsPath)
        })
      }
      if (fs.existsSync(interfaceAbsPath)) {
        let override = confirm(`This interface file already exists, should we override it?\n\n${interfaceAbsPath}`)
        if (override) {
          writeFile()
        }
      } else {
        writeFile()
      }
    })
  }
}

module.exports = new ReasonMLLanguageClient()

module.exports.config = config
