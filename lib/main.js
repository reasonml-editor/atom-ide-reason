const cp = require('child_process')
const {AutoLanguageClient} = require('atom-languageclient')
const atom = require('atom')
const path = require('path')
// const defaultInitOptions = require('ocaml-language-server').ISettings.defaults.reason

const scopes = [ 'source.reason', 'source.ocaml', 'source.re', 'source.ml', 'source.rei', 'source.mli' ]

function joinEnvPath(first, ...others) {
  if (others.length === 0) {
    return first
  }
  return (
    first && first
      .split(',')
      .map(p => p.trim())
      .join(path.delimiter) +
    path.delimiter
  ) +
  joinEnvPath(others)
}

class ReasonMLLanguageClient extends AutoLanguageClient {
  constructor(...props) {
    super(...props)
  }

  getGrammarScopes () { return scopes }
  getLanguageName () { return 'Reason' }
  getServerName () { return 'ocamlmerlin' }
  getConnectionType() { return 'ipc' }

  activate() {
    super.activate()
    require('atom-package-deps').install('ide-reason')
      .then(function() {
        console.log('All dependencies installed, good to go')
      })
  }

  startServerProcess (projectPath) {
    const serverPath = require.resolve('ocaml-language-server/bin/server')
    let pathFromPkg = ''
    try {
      pathFromPkg = require(path.join(projectPath, 'package.json')).reasonToolchainPath || ''
    } catch (e) { }
    let pathFromFile = ''
    try {
      pathFromFile = require(path.join(projectPath, 'ide-reason.json')).toolchainPath || ''
    } catch (e) { }
    return super.spawnChildNode([serverPath, '--node-ipc' ], {
        stdio: [null, null, null, 'ipc'],
        pwd: projectPath,
        env: Object.assign({}, Object.create(process.env), {
          PATH: joinEnvPath(pathFromPkg, pathFromFile, process.env.PATH),
        })
      })
  }
}

module.exports = new ReasonMLLanguageClient()
