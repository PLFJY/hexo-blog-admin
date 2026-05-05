import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const devVars = '.dev.vars'
const hiddenDevVars = '.dev.vars.local'
const require = createRequire(import.meta.url)
const viteCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`))
    })
  })

const hadDevVars = existsSync(devVars)

try {
  if (hadDevVars) {
    await rename(devVars, hiddenDevVars)
  }
  await run(process.execPath, [viteCli, 'build'])
} finally {
  if (hadDevVars && existsSync(hiddenDevVars)) {
    await rename(hiddenDevVars, devVars)
  }
}
