import * as cp from 'child_process'
import * as os from 'os'
import { AutoLanguageClient, ActiveServer } from 'atom-languageclient'
import * as path from 'path'
import { CompositeDisposable, FilesystemChangeEvent, TextEditor, Point, TextBuffer, Range } from 'atom'
import * as languageServer from 'ocaml-language-server'
import * as fs from 'fs-extra'
import merge from 'deepmerge'
import * as pkg from '../package.json'
import config from './config'
import * as Utils from './utils'
import { DeepPartial, Config, FileExtension } from './types'
import { TextEdit } from 'atom-ide';

const CONFIG_FILE = ".atom/ide-reason.json"
const DEFAULT_PER_PROJECT_CONFIG = {
  server: { tool: 'rls' },
  rls: {
    refmt: 'refmt',
    lispRefmt: 'lispRefmt',
    format_width: 80,
    autoRebuild: true,
  },
  ols: languageServer.ISettings.defaults.reason,
  autocompleteResultsFirst: true,
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

const InsertFinalNewLineKey = 'whitespace.ensureSingleTrailingNewline'

class ReasonMLLanguageClient extends AutoLanguageClient {
  subscriptions: CompositeDisposable | null = null
  servers: { [K: string]: ActiveServer } = {}

  config: Config = atom.config.get(this.getRootConfigurationKey()) || {}
  configPerProject: DeepPartial<Config> | null = null
  insertFinalNewLine: boolean = atom.config.get(InsertFinalNewLineKey) || false

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
          autoRebuild: config.rls.autoRebuild,
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
    atom.config.observe(this.getRootConfigurationKey(), (value) => {
      this.config = value || this.config
    })
    atom.config.observe(InsertFinalNewLineKey, value => {
      this.insertFinalNewLine = value
    })
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
    const serverPath = require.resolve(`../rls/rls-${process.platform}-${pkg.rls_version}.exe`)
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

  getRlsBin() {
    switch (process.platform) {
      case "darwin": return "bin.native"
      case "linux": return "bin.native.linux"
      case "win32": return "bin.native.exe"
      default: throw new Error("Unknown platform")
    }
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

  filterChangeWatchedFiles(file: string) {
    switch (this.config.server.tool) {
      case 'rls': {
        return file.includes("/bsconfig.json") || file.includes("/.merlin")
      }
      case 'ols': {
        return !file.includes("/.git")
      }
      default: return true
    }
  }

  provideAutocomplete() {
    return Object.assign(super.provideAutocomplete(), {
      suggestionPriority: this.config.autocompleteResultsFirst ? 5 : 1,
    });
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

  showErrorMessage(message: string, detail?: string) {
    atom.notifications.addError(message, {
      detail,
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

  findBinRoot(location: string): string | null {
    return this.findRoot(location, ["node_modules", "bs-platform", "lib", "bsb.exe"]);
  }

  findProjectRoot(location: string): string | null {
    return this.findRoot(location, ["bsconfig.json"]);
  }

  findRoot(location: string, test: string[]): string | null {
    const dirs = location.split(path.sep);

    if (dirs.length === 0 || (dirs.length === 1 && dirs[0] === "")) {
      return null;
    }

    const file = path.join(...dirs, ...test);

    if (fs.existsSync(file)) {
      return location;
    } else {
      let parent = path.join(...dirs.slice(0, -1));
      return this.findRoot(
        parent[0] === path.sep ? parent : path.sep + parent,
        test,
      );
    }
  }

  generateInterface(srcAbsPath: string, ext: FileExtension) {
    const location = path.dirname(srcAbsPath);
    const binRoot = this.findBinRoot(location);
    const projectRoot = this.findProjectRoot(location);

    if (!projectRoot) {
      this.showErrorMessage("Can't find root directory of the project");
      return
    }
    const file = path.basename(srcAbsPath);
    const srcRelPath = path.relative(projectRoot, srcAbsPath);

    let namespace = ''
    try {
      const bsconf = Utils.readFile<{ name: string; namespace: boolean }>(path.join(projectRoot, "bsconfig.json"))
      if (bsconf && bsconf.namespace) {
        namespace = bsconf.name ? '-' + Utils.capitalize(bsconf.name) : namespace
      }
    } catch (error) {
      console.warn("[ide-reason] read bsconfig.json failed:", error)
    }

    const baseRelPath = srcRelPath.substring(0, srcRelPath.length - 3)
    const cmiAbsPath = path.join(projectRoot, "lib", "bs", baseRelPath + namespace + ".cmi")
    const interfaceAbsPath = path.join(projectRoot, baseRelPath + '.' + ext + "i")

    let bscBin;
    const projectBscBin =
      binRoot
      ? path.join(binRoot, "node_modules", "bs-platform", "lib", "bsc.exe")
      : null;
    if (projectBscBin && fs.existsSync(projectBscBin)) {
      bscBin = projectBscBin;
    } else {
      try {
        cp.execSync("which bsc");
      } catch (error) {
        console.error(error);
        this.showErrorMessage("Can't find bs-platform binary. Make sure you have it installed.");
        return;
      }
      this.showWarning("Using global `bsc` binary.");
      bscBin = "bsc";
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
  provideOnSaveCodeFormat() {
    return {
        grammarScopes: this.getGrammarScopes(),
        priority: 1,
        formatOnSave: this.getFileCodeFormat.bind(this),
    };
  }
  async getFileCodeFormat(editor: TextEditor) {
    if (!this.config.formatOnSave) {
      return []
    }
    let textBuf = new TextBuffer({ text: editor.getText() })

    let edits = await super.getFileCodeFormat(editor as any)
     // diff text edits for consistent cursor position
    for (const edit of edits) {
      textBuf.setTextInRange(edit.oldRange, edit.newText, { undo: 'skip', normalizeLineEndings: true })
    }
    // Fix atom-languageclient's format-on-save feature conflicts with `insert final new line`.
    if (
      this.insertFinalNewLine &&
      textBuf.getLastLine() !== ''
    ) {
      textBuf.append('\n', { undo: 'skip', normalizeLineEndings: true })
    }
    edits = Utils.diff(editor.getText(), textBuf.getText())
    return edits
  }
}

module.exports = new ReasonMLLanguageClient()

module.exports.config = config
