import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'

const CODEX_ALIAS_MODELS: Record<
  string,
  {
    model: string
    reasoningEffort?: ReasoningEffort
  }
> = {
  codexplan: {
    model: 'gpt-5.4',
    reasoningEffort: 'high',
  },
  codexspark: {
    model: 'gpt-5.3-codex-spark',
  },
} as const

type CodexAlias = keyof typeof CODEX_ALIAS_MODELS
type ReasoningEffort = 'low' | 'medium' | 'high'

export type ProviderTransport = 'chat_completions' | 'codex_responses'

export type ResolvedProviderRequest = {
  transport: ProviderTransport
  requestedModel: string
  resolvedModel: string
  baseUrl: string
  reasoning?: {
    effort: ReasoningEffort
  }
}

export type ResolvedCodexCredentials = {
  apiKey: string
  accountId?: string
  authPath?: string
  source: 'env' | 'auth.json' | 'none'
}

type ModelDescriptor = {
  raw: string
  baseModel: string
  reasoning?: {
    effort: ReasoningEffort
  }
}

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNestedString(
  value: unknown,
  paths: string[][],
): string | undefined {
  for (const path of paths) {
    let current = value
    let valid = true
    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        valid = false
        break
      }
      current = (current as Record<string, unknown>)[key]
    }
    if (!valid) continue
    const stringValue = asTrimmedString(current)
    if (stringValue) return stringValue
  }
  return undefined
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split('.')
  if (parts.length < 2) return undefined

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function parseReasoningEffort(value: string | undefined): ReasoningEffort | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized
  }
  return undefined
}

function parseModelDescriptor(model: string): ModelDescriptor {
  const trimmed = model.trim()
  const queryIndex = trimmed.indexOf('?')
  if (queryIndex === -1) {
    const alias = trimmed.toLowerCase() as CodexAlias
    const aliasConfig = CODEX_ALIAS_MODELS[alias]
    if (aliasConfig) {
      return {
        raw: trimmed,
        baseModel: aliasConfig.model,
        reasoning: aliasConfig.reasoningEffort
          ? { effort: aliasConfig.reasoningEffort }
          : undefined,
      }
    }
    return {
      raw: trimmed,
      baseModel: trimmed,
    }
  }

  const baseModel = trimmed.slice(0, queryIndex).trim()
  const params = new URLSearchParams(trimmed.slice(queryIndex + 1))
  const alias = baseModel.toLowerCase() as CodexAlias
  const aliasConfig = CODEX_ALIAS_MODELS[alias]
  const resolvedBaseModel = aliasConfig?.model ?? baseModel
  const reasoning =
    parseReasoningEffort(params.get('reasoning') ?? undefined) ??
    (aliasConfig?.reasoningEffort
      ? { effort: aliasConfig.reasoningEffort }
      : undefined)

  return {
    raw: trimmed,
    baseModel: resolvedBaseModel,
    reasoning: typeof reasoning === 'string' ? { effort: reasoning } : reasoning,
  }
}

function isCodexAlias(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  const base = normalized.split('?', 1)[0] ?? normalized
  return base in CODEX_ALIAS_MODELS
}

export function isLocalProviderUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false
  try {
    return LOCALHOST_HOSTNAMES.has(new URL(baseUrl).hostname)
  } catch {
    return false
  }
}

export function isCodexBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false
  try {
    const parsed = new URL(baseUrl)
    return (
      parsed.hostname === 'chatgpt.com' &&
      parsed.pathname.replace(/\/+$/, '') === '/backend-api/codex'
    )
  } catch {
    return false
  }
}

export function resolveProviderRequest(options?: {
  model?: string
  baseUrl?: string
  fallbackModel?: string
}): ResolvedProviderRequest {
  const requestedModel =
    options?.model?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    options?.fallbackModel?.trim() ||
    'gpt-4o'
  const descriptor = parseModelDescriptor(requestedModel)
  const rawBaseUrl =
    options?.baseUrl ??
    process.env.OPENAI_BASE_URL ??
    process.env.OPENAI_API_BASE ??
    undefined
  const transport: ProviderTransport =
    isCodexAlias(requestedModel) || isCodexBaseUrl(rawBaseUrl)
      ? 'codex_responses'
      : 'chat_completions'

  return {
    transport,
    requestedModel,
    resolvedModel: descriptor.baseModel,
    baseUrl:
      (rawBaseUrl ??
        (transport === 'codex_responses'
          ? DEFAULT_CODEX_BASE_URL
          : DEFAULT_OPENAI_BASE_URL)
      ).replace(/\/+$/, ''),
    reasoning: descriptor.reasoning,
  }
}

export function resolveCodexAuthPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = asTrimmedString(env.CODEX_AUTH_JSON_PATH)
  if (explicit) return explicit

  const codexHome = asTrimmedString(env.CODEX_HOME)
  if (codexHome) return join(codexHome, 'auth.json')

  return join(homedir(), '.codex', 'auth.json')
}

export function parseChatgptAccountId(
  token: string | undefined,
): string | undefined {
  if (!token) return undefined
  const payload = decodeJwtPayload(token)
  const fromClaim = asTrimmedString(
    payload?.['https://api.openai.com/auth.chatgpt_account_id'],
  )
  if (fromClaim) return fromClaim
  return asTrimmedString(payload?.chatgpt_account_id)
}

function loadCodexAuthJson(
  authPath: string,
): Record<string, unknown> | undefined {
  if (!existsSync(authPath)) return undefined
  try {
    const raw = readFileSync(authPath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

export function resolveCodexApiCredentials(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedCodexCredentials {
  const envApiKey = asTrimmedString(env.CODEX_API_KEY)
  const envAccountId =
    asTrimmedString(env.CODEX_ACCOUNT_ID) ??
    asTrimmedString(env.CHATGPT_ACCOUNT_ID)

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      accountId: envAccountId ?? parseChatgptAccountId(envApiKey),
      source: 'env',
    }
  }

  const authPath = resolveCodexAuthPath(env)
  const authJson = loadCodexAuthJson(authPath)
  if (!authJson) {
    return {
      apiKey: '',
      authPath,
      source: 'none',
    }
  }

  const apiKey = readNestedString(authJson, [
    ['access_token'],
    ['accessToken'],
    ['tokens', 'access_token'],
    ['tokens', 'accessToken'],
    ['auth', 'access_token'],
    ['auth', 'accessToken'],
    ['token', 'access_token'],
    ['token', 'accessToken'],
    ['tokens', 'id_token'],
    ['tokens', 'idToken'],
  ])
  const accountId =
    envAccountId ??
    readNestedString(authJson, [
      ['account_id'],
      ['accountId'],
      ['tokens', 'account_id'],
      ['tokens', 'accountId'],
      ['auth', 'account_id'],
      ['auth', 'accountId'],
    ]) ??
    parseChatgptAccountId(apiKey)

  if (!apiKey) {
    return {
      apiKey: '',
      accountId,
      authPath,
      source: 'none',
    }
  }

  return {
    apiKey,
    accountId,
    authPath,
    source: 'auth.json',
  }
}
