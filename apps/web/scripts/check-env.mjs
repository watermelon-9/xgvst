import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production'
const envFile = path.join(projectRoot, `.env.${mode}`)

if (!fs.existsSync(envFile)) {
  console.error(`[env-check] missing ${envFile}`)
  process.exit(1)
}

const raw = fs.readFileSync(envFile, 'utf8')
const lines = raw.split(/\r?\n/).filter(Boolean)
const map = new Map()
for (const line of lines) {
  if (line.startsWith('#') || !line.includes('='))
    continue
  const idx = line.indexOf('=')
  map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
}

const required = ['VITE_API_BASE_URL', 'VITE_WS_BASE_URL']
for (const key of required) {
  if (!map.get(key)) {
    console.error(`[env-check] missing ${key} in ${path.basename(envFile)}`)
    process.exit(1)
  }
}

if (mode === 'production') {
  const api = map.get('VITE_API_BASE_URL')
  const ws = map.get('VITE_WS_BASE_URL')
  if (!api.startsWith('https://')) {
    console.error('[env-check] production API must use https://')
    process.exit(1)
  }
  if (!ws.startsWith('wss://')) {
    console.error('[env-check] production WS must use wss://')
    process.exit(1)
  }
}

console.log(`[env-check] ${mode} env ok`)