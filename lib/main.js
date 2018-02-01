const cp = require('child_process')
const {AutoLanguageClient} = require('atom-languageclient')
const atom = require('atom')
const path = require('path')

const scopes = [ 'source.reason', 'source.ocaml', 'source.re', 'source.ml', 'source.rei', 'source.mli' ]

function flatten1(array) {
  return [].concat(...array)
}

function joinEnvPath(...paths) {
  return flatten1(paths)
    .filter(Boolean)
    .join(path.delimiter)
}

function readFileConf(file, property) {
  try {
    return require(path.join(projectPath, 'package.json'))[property] || ''
  } catch (e) { }
  return ''
}

const pathFromPkg = readFileConf('package.json', 'reasonToolchainPath')
const pathFromFile = readFileConf('ide-reason.json', 'toolchainPath')
const extraPath = joinEnvPath(pathFromPkg, pathFromFile)

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
    return super.spawnChildNode([serverPath, '--node-ipc' ], {
        stdio: [null, null, null, 'ipc'],
        pwd: projectPath,
        env: Object.assign({}, process.env, {
          PATH: joinEnvPath(extraPath, process.env.PATH)
        }),
      })
  }
}

module.exports = new ReasonMLLanguageClient()
