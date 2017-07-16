const cp = require('child_process')
const {AutoLanguageClient} = require('atom-languageclient')
const atom = require('atom')

const scopes = [ 'source.reason', 'source.ocaml', 'source.re', 'source.ml', 'source.rei', 'source.mli' ]

class ReasonmlLanguageClient extends AutoLanguageClient {

  getGrammarScopes () { return scopes }
  getLanguageName () { return 'Reason' }
  getServerName () { return 'ocamlmerlin' }
  getConnectionType() { return 'ipc' }
  // getConnectionType() { return 'stdio' }
  startServerProcess (projectPath) {
    const serverPath = require.resolve('ocaml-language-server')
    const p = cp.spawn('node', [serverPath, '--node-ipc' ], {
      stdio: [null, null, null, 'ipc'],
      pwd: projectPath,
    })
    p.on('error', console.error)
    return p
  }
}

module.exports = new ReasonmlLanguageClient()
