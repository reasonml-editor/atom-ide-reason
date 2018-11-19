const path = require('path')
const fs = require('fs')
const { spawn, spawnSync } = require('child_process')
const download = require('download')
const pkg = require('../package.json')
const os = require('os')


const RlsDir = './rls'

function getLocalRlsPath(platform) {
  return `${RlsDir}/rls-${platform}-${pkg.rls_version}.exe`
}

const Platforms = ['linux', 'darwin', 'win32']
const LocalRlsBins = fs.readdirSync(RlsDir)
  .filter(file => file.startsWith('rls-'))
  .map(file => path.join(RlsDir, file))
const CurrentVersion = LocalRlsBins[0] ? (LocalRlsBins[0].match(/-(\d+\.\d+\.\d+)/) || [])[1] : '0'

if (CurrentVersion === pkg.rls_version) {
  console.log(`Local rls binaries${CurrentVersion} are fine, skip downloading.`)

} else {
  console.log('Local rls binaries are outdated, start downloading...')
  LocalRlsBins.map(f => fs.unlinkSync(f))
  Platforms.forEach(platform => {
    let rlsPath = getLocalRlsPath(platform)
    let remotePlatform = {
      'win32': 'windows',
      'darwin': 'macos',
      'linux': 'linux',
    }[platform]
    let filename = path.basename(rlsPath)
    const tmpdir = path.join(os.tmpdir(), `rls-${Math.random().toString(36).slice(2)}`)
    download(`https://github.com/jaredly/reason-language-server/releases/download/${pkg.rls_version}/${remotePlatform}.zip`, tmpdir, { extract: true }).then(() => {
      fs.copyFileSync(path.join(tmpdir, 'reason-language-server', 'reason-language-server.exe'), rlsPath)
      console.log(`${rlsPath} is downloaded!`)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
  })
}
