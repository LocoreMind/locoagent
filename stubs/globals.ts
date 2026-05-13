// Build-time macro replacement stub
// Injected via bunfig.toml preload

// Load .env from project root into process.env at startup
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) {
      process.env[key] = val
    }
  }
}

// Inject --dangerously-skip-permissions into argv when SKIP_PERMISSIONS=1
if (process.env.SKIP_PERMISSIONS === '1') {
  const flag = '--dangerously-skip-permissions'
  if (!process.argv.includes(flag)) {
    process.argv.push(flag)
  }
}

;(globalThis as any).MACRO = {
  VERSION: '2.0.0',
  BUILD_TIME: new Date().toISOString(),
  PACKAGE_URL: '@anthropic-ai/locoagent',
  NATIVE_PACKAGE_URL: '@anthropic-ai/locoagent-native',
  FEEDBACK_CHANNEL: 'https://github.com/anthropics/locoagent/issues',
  ISSUES_EXPLAINER: 'Report issues at https://github.com/anthropics/locoagent/issues',
  VERSION_CHANGELOG: '',
}
