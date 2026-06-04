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

// Provider front door: translate the neutral, self-explanatory LLM_* variables
// into the legacy internal vars the rest of the codebase reads
// (CLAUDE_CODE_USE_OPENAI / OPENAI_* / ANTHROPIC_*). This is what lets a user who
// picked "DeepSeek" configure LLM_PROVIDER/LLM_API_KEY/LLM_MODEL without ever
// seeing the confusing OPENAI_* names. Runs here, at preload, so the mapping is
// in place before any module reads process.env.
//
// Non-destructive: an explicitly-set legacy var always wins, so existing setups
// and power users are unaffected. Only LLM_PROVIDER drives the OpenAI-vs-Anthropic
// toggle authoritatively, since it is an explicit user choice.
function normalizeProviderEnv() {
  const provider = (process.env.LLM_PROVIDER ?? '').trim().toLowerCase()
  const apiKey = (process.env.LLM_API_KEY ?? '').trim()
  const model = (process.env.LLM_MODEL ?? '').trim()
  const baseUrl = (process.env.LLM_BASE_URL ?? '').trim()

  // Nothing on the neutral front door → stay in pure legacy mode.
  if (!provider && !apiKey && !model && !baseUrl) return

  // Default base URL per known provider (anthropic uses the native SDK path).
  const PRESET_BASE: Record<string, string> = {
    deepseek: 'https://api.deepseek.com',
    openai: 'https://api.openai.com/v1',
  }

  const setIfUnset = (key: string, val: string) => {
    if (val && !(process.env[key] ?? '').trim()) process.env[key] = val
  }

  if (provider === 'anthropic') {
    // Native Anthropic SDK path — shim must be off.
    if (provider) process.env.CLAUDE_CODE_USE_OPENAI = ''
    setIfUnset('ANTHROPIC_API_KEY', apiKey)
    setIfUnset('ANTHROPIC_MODEL', model)
  } else {
    // DeepSeek / OpenAI / any OpenAI-compatible endpoint → the shim.
    if (provider) process.env.CLAUDE_CODE_USE_OPENAI = '1'
    setIfUnset('OPENAI_API_KEY', apiKey)
    setIfUnset('OPENAI_MODEL', model)
    setIfUnset('OPENAI_BASE_URL', baseUrl || PRESET_BASE[provider] || '')
  }
}
normalizeProviderEnv()

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
