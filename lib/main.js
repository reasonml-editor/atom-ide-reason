"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const cp = __importStar(require("child_process"));
const os = __importStar(require("os"));
const atom_languageclient_1 = require("atom-languageclient");
const path = __importStar(require("path"));
const atom_1 = require("atom");
const languageServer = __importStar(require("ocaml-language-server"));
const fs = __importStar(require("fs-extra"));
const deepmerge_1 = __importDefault(require("deepmerge"));
const pkg = __importStar(require("../package.json"));
const config_1 = __importDefault(require("./config"));
const Utils = __importStar(require("./utils"));
const confFile = ".atom/ide-reason.json";
const defaultConfig = deepmerge_1.default(languageServer.ISettings.defaults.reason, {
    path: {
        bsc: 'bsc',
    },
});
const scopes = [
    'ocaml',
    'reason',
    'source.reason',
    'source.ocaml',
    'source.re',
    'source.ml',
    'source.rei',
    'source.mli',
];
class ReasonMLLanguageClient extends atom_languageclient_1.AutoLanguageClient {
    constructor() {
        super(...arguments);
        this.subscriptions = null;
        this.confPerProject = {};
        this.servers = {};
    }
    getGrammarScopes() { return scopes; }
    getLanguageName() { return 'Reason'; }
    getServerName() { return 'ocamlmerlin'; }
    getConnectionType() { return 'ipc'; }
    getRootConfigurationKey() { return 'ide-reason'; }
    mapConfigurationObject(config) {
        config = deepmerge_1.default(deepmerge_1.default({}, config), this.confPerProject);
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
        };
    }
    activate() {
        super.activate();
        require('atom-package-deps').install('ide-reason')
            .then(() => {
            console.log('All dependencies installed, good to go');
        });
        this.subscriptions = new atom_1.CompositeDisposable();
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            [`${pkg.name}:generate-config`]: () => this.generateConfig().catch(console.error)
        }), atom.commands.add('atom-workspace', {
            [`${pkg.name}:restart-all-servers`]: () => this.restartAllServers().catch(console.error)
        }));
        this.subscriptions.add(atom.commands.add('atom-text-editor[data-grammar~="reason"]', {
            [`${pkg.name}:generate-interface`]: () => this.generateInterfaceFromEditor('re'),
        }), atom.commands.add('atom-text-editor[data-grammar~="ocaml"]', {
            [`${pkg.name}:generate-interface`]: () => this.generateInterfaceFromEditor('ml'),
        }), atom.commands.add(".tree-view .file .name[data-name$=\\.re]", {
            [`${pkg.name}:generate-interface`]: event => this.generateInterfaceFromTreeView(event, 're'),
        }), atom.commands.add(".tree-view .file .name[data-name$=\\.ml]", {
            [`${pkg.name}:generate-interface`]: event => this.generateInterfaceFromTreeView(event, 'ml'),
        }));
        this.subscriptions.add(atom.notifications.onDidAddNotification(notification => this.autoDismissBrokenPipeError(notification)), atom.project.onDidChangeFiles(events => this.notifyServersOnProjectConfigChange(events)));
    }
    showWarning(message, detail) {
        atom.notifications.addWarning(message, {
            detail,
            dismissable: true,
        });
    }
    showError(message, error) {
        atom.notifications.addError(message, {
            detail: error.stack ? error.stack.toString() : undefined,
            dismissable: true,
        });
    }
    autoDismissBrokenPipeError(notification) {
        if (!notification.message.includes('Broken pipe'))
            return;
        setTimeout(() => notification.dismiss(), 1000);
    }
    notifyServersOnProjectConfigChange(events) {
        events = events.filter(e => e.path.endsWith(confFile));
        if (events.length > 0) {
            for (const projectPath in this.servers) {
                const event = events.find(e => e.path.startsWith(projectPath));
                if (event) {
                    const server = this.servers[projectPath];
                    const globalConf = atom.config.get(this.getRootConfigurationKey());
                    const fileConf = Utils.readFileConf(event.path);
                    server.connection.didChangeConfiguration(deepmerge_1.default(globalConf, fileConf));
                }
            }
        }
    }
    generateConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = atom.project.getPaths();
            let curProject = paths[0];
            const editor = atom.workspace.getActiveTextEditor();
            if (editor) {
                const editorPath = editor.getPath();
                if (editorPath) {
                    curProject = atom.project.relativizePath(editorPath)[0] || curProject;
                }
            }
            const confPath = path.join(curProject, confFile);
            if (fs.existsSync(confPath)) {
                return this.showWarning('ide-reason.json already exists!', confPath);
            }
            yield fs.outputFile(confPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        });
    }
    postInitialization(server) {
        this.servers[server.projectPath] = server;
        server.process.on('exit', () => {
            delete this.servers[server.projectPath];
        });
    }
    startServerProcess(projectPath) {
        const serverPath = require.resolve('ocaml-language-server/bin/server');
        const confFromFile = Utils.readFileConf(path.join(projectPath, confFile)) || {};
        this.confPerProject = confFromFile;
        const envPath = process.env.PATH +
            (os.platform() === 'darwin'
                ? (path.delimiter + '/usr/local/bin') // Temporarily fix: https://github.com/atom/atom/issues/14924
                : '');
        return super.spawnChildNode([serverPath, '--node-ipc'], {
            stdio: [null, null, null, 'ipc'],
            cwd: projectPath,
            env: Object.assign({}, process.env, {
                PATH: envPath
            }),
        });
    }
    deactivate() {
        let result = super.deactivate();
        if (this.subscriptions) {
            this.subscriptions.dispose();
        }
        return result;
    }
    // Interface generator
    generateInterfaceFromTreeView(event, ext) {
        this.generateInterface(event.target.dataset.path, ext);
    }
    generateInterfaceFromEditor(ext) {
        const activeEditor = atom.workspace.getActiveTextEditor();
        if (!activeEditor) {
            this.showWarning("No active editor found");
            return;
        }
        const srcAbsPath = activeEditor.getPath();
        if (!srcAbsPath) {
            this.showWarning("Can't generate interface file from unsaved buffer. Save source file first.");
            return;
        }
        this.generateInterface(srcAbsPath, ext);
    }
    generateInterface(srcAbsPath, ext) {
        const [root, srcRelPath] = atom.project.relativizePath(srcAbsPath);
        if (!root) {
            this.showWarning("Can't find root directory of the project");
            return;
        }
        let namespace = '';
        try {
            const bsconf = Utils.readFileConf(path.join(root, 'bsconfig.json'));
            if (bsconf.namespace) {
                namespace = bsconf.name ? '-' + Utils.capitalize(bsconf.name) : namespace;
            }
        }
        catch (error) {
            console.warn('[ide-reason] read bsconfig.json failed:', error);
        }
        const baseRelPath = srcRelPath.substring(0, srcRelPath.length - 3);
        const cmiAbsPath = path.join(root, "lib", "bs", baseRelPath + namespace + ".cmi");
        const interfaceAbsPath = path.join(root, baseRelPath + '.' + ext + "i");
        let bscBin;
        if (this.confPerProject && this.confPerProject.path && this.confPerProject.path.bsc) {
            bscBin =
                path.isAbsolute(this.confPerProject.path.bsc)
                    ? this.confPerProject.path.bsc
                    : path.join(root, this.confPerProject.path.bsc);
        }
        else {
            bscBin = atom.config.get(this.getRootConfigurationKey()).path.bsc;
        }
        if (!bscBin) {
            this.showWarning("Provide path to `bsc` binary in config: Path > bsc");
            return;
        }
        const cmd = ext === 'ml'
            ? `${bscBin} ${cmiAbsPath}`
            : `${bscBin} -bs-re-out ${cmiAbsPath}`;
        cp.exec(cmd, (error, stdout) => {
            if (error) {
                this.showError("Oops! Can't generate interface file", error);
                return;
            }
            const writeFile = () => {
                fs.outputFile(interfaceAbsPath, stdout, error => {
                    if (error) {
                        this.showError("Oops! Can't write generated interface file", error);
                        return;
                    }
                    atom.workspace.open(interfaceAbsPath);
                });
            };
            if (fs.existsSync(interfaceAbsPath)) {
                let override = confirm(`This interface file already exists, should we override it?\n\n${interfaceAbsPath}`);
                if (override) {
                    writeFile();
                }
            }
            else {
                writeFile();
            }
        });
    }
}
module.exports = new ReasonMLLanguageClient();
module.exports.config = config_1.default;
