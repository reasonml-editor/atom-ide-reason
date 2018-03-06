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
const defaultConfig = languageServer.ISettings.defaults.reason;
const scopes = [
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
        this.subscriptions.add(atom.project.onDidChangeFiles(events => {
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
        }));
    }
    generateConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = atom.project.getPaths();
            let curProject = paths[0];
            const editor = atom.workspace.getActiveTextEditor();
            if (editor) {
                const editorPath = editor.getPath();
                if (editorPath) {
                    curProject = paths.filter(p => editorPath.startsWith(p))[0] || curProject;
                }
            }
            const confPath = path.join(curProject, confFile);
            if (fs.existsSync(confPath)) {
                return atom.notifications.addWarning('ide-reason.json already exists!', {
                    description: confPath,
                });
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
}
module.exports = new ReasonMLLanguageClient();
module.exports.config = config_1.default;
