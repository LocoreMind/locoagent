import { afterAll, beforeEach, expect, spyOn, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import '../stubs/globals'

// Isolate both saved credentials and environment credentials before loading auth.
const envKeys = [
  'CLAUDE_CONFIG_DIR', 'LOCOAGENT_SEARCH_PROVIDER', 'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR', 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',
  'CLAUDE_CODE_REMOTE', 'CLAUDE_CODE_ENTRYPOINT',
]
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
const configDir = mkdtempSync(join(tmpdir(), 'locoagent-search-'))
for (const key of envKeys) delete process.env[key]
process.env.CLAUDE_CONFIG_DIR = configDir

const { WebSearchTool } = await import('../src/tools/WebSearchTool/WebSearchTool')
const { getWebSearchProvider } = await import('../src/tools/WebSearchTool/provider')
const { getSessionId, regenerateSessionId } = await import('../src/bootstrap/state')
const { clearOAuthTokenCache, getApiKeyFromConfigOrMacOSKeychain } = await import('../src/utils/auth')
const { _setGlobalConfigCacheForTesting, enableConfigs } = await import('../src/utils/config')
const { getTools } = await import('../src/tools')
const { getEmptyToolPermissionContext } = await import('../src/Tool')

const originalFetch = globalThis.fetch
const requests: { method: string; headers: Headers; body: any; url: string }[] = []
let mode = 'success'
let structured = true
const result = {
  results: [
    { title: 'Example', url: 'https://example.com/docs', excerpts: ['Useful current facts.'] },
    { title: 'Child', url: 'https://docs.example.com/help', excerpts: ['Child domain.'] },
    { title: 'Other', url: 'https://example.com.evil.test/', excerpts: ['Other domain.'] },
    { title: 'Invalid', url: 'javascript:alert(1)', excerpts: ['Invalid URL.'] },
    { title: 'Credentials', url: 'https://user:secret@example.com/', excerpts: ['Not a source.'] },
  ],
}

// Exercise the real MCP SDK handshake, discovery and tools/call wire protocol.
// Intercept at fetch so endpoint, headers and arguments remain observable.
const fixtureFetch = async (url: any, init?: RequestInit): Promise<Response> => {
  const endpoint = String(url)
  if (endpoint !== 'https://search.parallel.ai/mcp') throw new Error(`Unexpected endpoint: ${endpoint}`)
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(String(init.body)) : undefined
  requests.push({ method, headers: new Headers(init?.headers), body, url: endpoint })
  if (method === 'GET') return new Response(null, { status: 405 })
  if (method === 'DELETE') return new Response(null, { status: 204 })
  if (!body?.id && body?.id !== 0) return new Response(null, { status: 202 })
  const json = (value: unknown) => Response.json({ jsonrpc: '2.0', id: body.id, result: value })
  if (body.method === 'initialize') {
    return json({ protocolVersion: body.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } })
  }
  if (body.method === 'tools/list') {
    return json({ tools: mode === 'missing' ? [] : [{ name: 'web_search', inputSchema: { type: 'object' } }] })
  }
  if (body.method === 'tools/call') {
    if (mode === 'wait') {
      return new Promise((_, reject) => {
        const signal = init!.signal!
        if (signal.aborted) reject(signal.reason)
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }
    if (mode === 'http') return new Response('Service unavailable', { status: 503 })
    if (mode === 'quota') return json({ isError: true, content: [{ type: 'text', text: 'Free anonymous quota exceeded' }] })
    if (mode === 'malformed') return json({ content: [{ type: 'text', text: '{bad json' }] })
    return json({ content: [{ type: 'text', text: JSON.stringify(result) }], ...(structured ? { structuredContent: result } : {}) })
  }
  throw new Error(`Unexpected MCP method: ${body.method}`)
}

function context(agentId?: string, controller = new AbortController()) {
  return { agentId, abortController: controller } as any
}
const call = (input = { query: 'current example documentation' }, ctx = context()) =>
  getTools(getEmptyToolPermissionContext()).find(tool => tool.name === 'WebSearch')!
    .call(input, ctx, undefined as any, undefined as any) as ReturnType<typeof WebSearchTool.call>
const toolCalls = () => requests.filter(request => request.body?.method === 'tools/call')

beforeEach(() => {
  for (const key of envKeys) if (key !== 'CLAUDE_CONFIG_DIR') delete process.env[key]
  writeFileSync(join(configDir, '.claude.json'), '{}')
  _setGlobalConfigCacheForTesting(null)
  getApiKeyFromConfigOrMacOSKeychain.cache.clear()
  clearOAuthTokenCache()
  requests.length = 0
  mode = 'success'
  structured = true
  globalThis.fetch = Object.assign(fixtureFetch, { preconnect: originalFetch.preconnect }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  _setGlobalConfigCacheForTesting(null)
  getApiKeyFromConfigOrMacOSKeychain.cache.clear()
  clearOAuthTokenCache()
  rmSync(configDir, { recursive: true, force: true })
})

test('fresh no-key resolver enables WebSearch and consumes MCP links and excerpts', async () => {
  expect(getWebSearchProvider()).toBe('parallel')
  expect(WebSearchTool.isEnabled()).toBe(true)
  const { data } = await call()
  const block = WebSearchTool.mapToolResultToToolResultBlockParam(data, 'test-tool-id')
  expect(block.tool_use_id).toBe('test-tool-id')
  expect(block.content).toContain('https://example.com/docs')
  expect(block.content).toContain('Useful current facts.')
  expect(block.content).not.toContain('javascript:')
  expect(block.content).not.toContain('secret')
  expect(await WebSearchTool.prompt()).not.toContain('only available in the US')
  expect(requests.some(request => request.body?.method === 'tools/list')).toBe(true)
  for (const request of requests) {
    expect(request.url).toBe('https://search.parallel.ai/mcp')
    expect(request.headers.get('User-Agent')).toStartWith('locoagent/1.1.0')
    expect(request.headers.has('Authorization')).toBe(false)
  }
  expect(toolCalls()[0].body.params.arguments.search_queries).toEqual(['current example documentation'])
})

test('OpenAI-compatible models without native search use Parallel', async () => {
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  expect(getWebSearchProvider()).toBe('parallel')
  expect(WebSearchTool.isEnabled()).toBe(true)
  await call()
  expect(toolCalls()).toHaveLength(1)
})

test('saved native API key and explicit auth selections remain native', () => {
  writeFileSync(join(configDir, '.claude.json'), JSON.stringify({ primaryApiKey: 'saved-test-key' }))
  _setGlobalConfigCacheForTesting(null)
  getApiKeyFromConfigOrMacOSKeychain.cache.clear()
  // The config reader intentionally substitutes a static config in NODE_ENV=test.
  const environment = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'development'
    enableConfigs()
    expect(getWebSearchProvider()).toBe('native')
  } finally { process.env.NODE_ENV = environment }
  process.env.LOCOAGENT_SEARCH_PROVIDER = 'parallel'
  expect(getWebSearchProvider()).toBe('parallel')
  delete process.env.LOCOAGENT_SEARCH_PROVIDER
  process.env.ANTHROPIC_AUTH_TOKEN = 'test-token'
  expect(getWebSearchProvider()).toBe('native')
})

test('Vertex and Foundry choices and explicit native override are preserved', () => {
  process.env.CLAUDE_CODE_USE_VERTEX = '1'
  expect(getWebSearchProvider()).toBe('native')
  delete process.env.CLAUDE_CODE_USE_VERTEX
  process.env.CLAUDE_CODE_USE_FOUNDRY = '1'
  expect(getWebSearchProvider()).toBe('native')
  delete process.env.CLAUDE_CODE_USE_FOUNDRY
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  process.env.LOCOAGENT_SEARCH_PROVIDER = 'native'
  expect(WebSearchTool.isEnabled()).toBe(false)
})

test('disabled search makes no request and retains normal permission gate', async () => {
  expect((await WebSearchTool.checkPermissions({ query: 'example' })).behavior).toBe('passthrough')
  process.env.LOCOAGENT_SEARCH_PROVIDER = 'disabled'
  expect(WebSearchTool.isEnabled()).toBe(false)
  expect(getTools(getEmptyToolPermissionContext()).some(tool => tool.name === 'WebSearch')).toBe(false)
  await expect(WebSearchTool.call({ query: 'example' }, context(), undefined as any, undefined as any)).rejects.toThrow('disabled')
  expect(requests).toHaveLength(0)
})

test('tool deny rules remove WebSearch before dispatch', () => {
  const permissions = { ...getEmptyToolPermissionContext(), alwaysDenyRules: { localSettings: ['WebSearch'] } }
  expect(getTools(permissions).some(tool => tool.name === 'WebSearch')).toBe(false)
  expect(requests).toHaveLength(0)
})

test('domain filtering removes both links and excerpts, with hostname boundaries', async () => {
  const included = await call({ query: 'example docs', allowed_domains: ['example.com'] } as any)
  const text = String(WebSearchTool.mapToolResultToToolResultBlockParam(included.data, 'id').content)
  expect(text).toContain('docs.example.com')
  expect(text).not.toContain('evil.test')
  expect(text).not.toContain('Other domain.')
  const excluded = await call({ query: 'example docs', blocked_domains: ['example.com'] } as any)
  const filtered = String(WebSearchTool.mapToolResultToToolResultBlockParam(excluded.data, 'id').content)
  expect(filtered).not.toContain('Useful current facts.')
  expect(filtered).toContain('evil.test')
  expect((await WebSearchTool.validateInput({ query: 'example', allowed_domains: ['a'], blocked_domains: ['b'] })).result).toBe(false)
})

test('MCP JSON text responses are consumed when structuredContent is absent', async () => {
  structured = false
  expect((await call()).data.results).toHaveLength(4)
})

test('session ownership survives follow-ups, quotas, interleaving and new chat', async () => {
  regenerateSessionId()
  const parent = getSessionId()
  await call(undefined, context('research-a'))
  mode = 'quota'
  await expect(call(undefined, context('research-a'))).rejects.toThrow('quota')
  mode = 'success'
  await Promise.all([call(undefined, context('research-b')), call(undefined, context('research-a'))])
  const ids = toolCalls().map(request => request.body.params.arguments.session_id)
  expect(ids[0]).toMatch(/^[a-f0-9]{64}$/)
  expect(ids[1]).toBe(ids[0])
  expect(ids[3]).toBe(ids[0])
  expect(ids[2]).not.toBe(ids[0])
  expect(ids[0]).not.toContain(parent)
  regenerateSessionId()
  await call(undefined, context('research-a'))
  expect(toolCalls().at(-1)!.body.params.arguments.session_id).not.toBe(ids[0])
})

test('service and parsing errors surface without provider fallback', async () => {
  process.env.LOCOAGENT_SEARCH_PROVIDER = 'parallel'
  for (const failure of ['quota', 'malformed', 'http', 'missing']) {
    mode = failure
    await expect(call()).rejects.toThrow()
  }
})

test('pre-aborted, in-flight cancellation and timeout stop MCP requests', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(call(undefined, context(undefined, controller))).rejects.toThrow()
  expect(requests).toHaveLength(0)
  mode = 'wait'
  const pending = new AbortController()
  const search = call(undefined, context(undefined, pending))
  while (toolCalls().length === 0) await Bun.sleep(1)
  pending.abort(new Error('User cancelled search'))
  await expect(search).rejects.toThrow()
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  const timeoutSpy = spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(10))
  try { await expect(call()).rejects.toThrow() } finally { timeoutSpy.mockRestore() }
})
