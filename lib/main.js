const cp = require('child_process')
const {AutoLanguageClient} = require('atom-languageclient')
const atom = require('atom')

const scopes = [ 'source.reason', 'source.ocaml', 'source.re', 'source.ml', 'source.rei', 'source.mli' ]

class ReasonMLLanguageClient extends AutoLanguageClient {

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
    console.log('serverPath', serverPath)
    // const p = cp.spawn('node', [serverPath, '--node-ipc' ], {
    //   stdio: [null, null, null, 'ipc'],
    //   pwd: projectPath,
    // })
    // p.on('error', console.error)
    return super.spawnChildNode([serverPath, '--node-ipc' ], {
        stdio: [null, null, null, 'ipc'],
        pwd: projectPath,
      })
  }
}

module.exports = new ReasonMLLanguageClient()
