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

const RLS_VERSION = "1.0.0-beta.7"

const CONFIG_FILE = ".atom/ide-reason.json"
const DEFAULT_PER_PROJECT_CONFIG = {
  server: { tool: 'rls' },
  rls: {
    refmt: 'refmt',
    lispRefmt: 'lispRefmt',
    format_width: 80,
  },
  ols: languageServer.ISettings.defaults.reason,
  interfaceGenerator: { bsc: './node_modules/bs-platform/lib/bsc.exe' },
}

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
  servers: { [K: string]: ActiveServer } = {}

  config: Config = atom.config.get(this.getRootConfigurationKey()) || {}
  configPerProject: DeepPartial<Config> | null = null

  getLanguageName () { return 'Reason' }
  getGrammarScopes () { return scopes }
  getRootConfigurationKey() { return 'ide-reason' }

  getServerName () {
    switch (this.config.server.tool) {
      case 'rls': return 'reason'
      case 'ols': return 'ocamlmerlin'
      default: return 'reason'
    }
  }

  getConfigPropKeypath(...keys: string[]) {
    return this.getRootConfigurationKey() + '.' + keys.join('.')
  }

  updateConfig(projectPath: string) {
    const configGlobal = atom.config.get(this.getRootConfigurationKey())
    const configPerProject = Utils.readPerProjectConfig(path.join(projectPath, CONFIG_FILE))

    this.config = merge(configGlobal, configPerProject || {})
    this.configPerProject = configPerProject
  }

  mapConfigurationObject(config: Config) {
    config = merge(merge({}, config), this.configPerProject || {})

    switch (config.server.tool) {
      case 'rls':
        return {
          refmt: config.rls.refmt,
          lispRefmt: config.rls.lispRefmt,
          format_width: config.rls.formatWidth,
          per_value_codelens: false,
          dependencies_codelens: false,
          opens_codelens: false,
        }
      case 'ols':
        return {
          reason: {
            codelens: {
              enabled: false,
              unicode: true,
            },
            debounce: config.ols.debounce,
            diagnostics: {
              tools: config.ols.diagnostics.tools,
              merlinPerfLogging: false,
            },
            format: config.ols.format,
            path: config.ols.path,
            server: config.ols.server,
          },
        }
      default: throw Error('Invalid language server identifier')
    }
  }

  notifyServersOnProjectConfigChange(events: Array<any>) {
    events = events.filter(e => e.path.endsWith(CONFIG_FILE))
    if (events.length > 0) {
      for (const projectPath in this.servers) {
        const event = events.find(e => e.path.startsWith(projectPath))
        if (event) {
          const nextConfigPerProject = Utils.readPerProjectConfig(path.join(projectPath, CONFIG_FILE))
          this.updateConfig(projectPath)
          const server = this.servers[projectPath]
          const mappedConfig = this.mapConfigurationObject(this.config)
          server.connection.didChangeConfiguration({settings: mappedConfig})
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
    const confPath = path.join(curProject, CONFIG_FILE)
    if (fs.existsSync(confPath)) {
      return this.showWarning('ide-reason.json already exists!', confPath)
    }
    await fs.outputFile(
      confPath,
      JSON.stringify(DEFAULT_PER_PROJECT_CONFIG, null, 2),
      'utf-8',
    )
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

  startServerProcess(projectPath: string) {
    this.updateConfig(projectPath)

    switch (this.config.server.tool) {
      case 'rls': return this.startRls(projectPath)
      case 'ols': return this.startOls(projectPath)
      default: throw Error('Invalid language server identifier')
    }
  }

  startRls(projectPath: string) {
    const serverPath = require.resolve(`../rls/rls-${process.platform}-${RLS_VERSION}.exe`)
    return Promise.resolve(cp.spawn(serverPath, [], {
      cwd: projectPath,
      env: this.getEnv(),
    }))
  }

  startOls(projectPath: string) {
    const serverPath = require.resolve('ocaml-language-server/bin/server')
    return this.spawnChildNode([serverPath, '--node-ipc'], {
      stdio: [null, null, null, 'ipc'],
      cwd: projectPath,
      env: this.getEnv(),
    })
  }

  getEnv() {
    const PATH = process.env.PATH +
      (os.platform() === 'darwin'
        ? (path.delimiter + '/usr/local/bin') // Temporarily fix: https://github.com/atom/atom/issues/14924
        : '')
    return Object.assign({}, process.env, { PATH })
  }

  getConnectionType() {
    return this.config.server.tool === 'ols' ? 'ipc': 'stdio'
  }

  postInitialization(server: ActiveServer) {
    this.servers[server.projectPath] = server
    server.process.on('exit', () => {
      delete this.servers[server.projectPath]
    })
  }

  deactivate() {
    let result = super.deactivate()
    if (this.subscriptions) {
      this.subscriptions.dispose()
    }
    return result
  }

  // Notifications
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

  // TODO: Remove when OLS support will be dropped
  autoDismissBrokenPipeError(notification: any) {
    if (!notification.message.includes('Broken pipe')) return
    setTimeout(() => notification.dismiss(), 1000)
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
      const bsconf = Utils.readFile<{ name: string; namespace: boolean }>(path.join(root, 'bsconfig.json'))
      if (bsconf && bsconf.namespace) {
        namespace = bsconf.name ? '-' + Utils.capitalize(bsconf.name) : namespace
      }
    } catch (error) {
      console.warn('[ide-reason] read bsconfig.json failed:', error)
    }

    const baseRelPath = srcRelPath.substring(0, srcRelPath.length - 3)
    const cmiAbsPath = path.join(root, "lib", "bs", baseRelPath + namespace + ".cmi")
    const interfaceAbsPath = path.join(root, baseRelPath + '.' + ext + "i")

    let bscBin;
    if (this.configPerProject && this.configPerProject.interfaceGenerator && this.configPerProject.interfaceGenerator.bsc) {
      bscBin =
        path.isAbsolute(this.configPerProject.interfaceGenerator.bsc)
        ? this.configPerProject.interfaceGenerator.bsc
        : path.join(root, this.configPerProject.interfaceGenerator.bsc)
    } else {
      bscBin = this.config.interfaceGenerator.bsc
    }

    if (!bscBin) {
      this.showWarning(
        "Provide path to `bsc` binary in config: Interface generator > bsc",
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
