import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod/v4'
import { version } from '../../../package.json'

const ENDPOINT = 'https://search.parallel.ai/mcp'
const TIMEOUT_MS = 60_000
const USER_AGENT = `locoagent/${version} (+https://github.com/LocoreMind/locoagent)`

const responseSchema = z.object({
  results: z.array(z.object({
    title: z.string().nullable().optional(),
    url: z.string(),
    excerpts: z.array(z.string()),
  })),
})

export type ParallelSearchInput = {
  query: string
  allowed_domains?: string[]
  blocked_domains?: string[]
}

function matchesDomain(host: string, domain: string): boolean {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '')
  return host === normalized || host.endsWith(`.${normalized}`)
}

/** One transport per invocation; conversation identity is supplied by the caller. */
export async function parallelSearch(
  input: ParallelSearchInput,
  sessionId: string,
  signal: AbortSignal,
): Promise<{ title: string; url: string; excerpts: string[] }[]> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
  requestSignal.throwIfAborted()
  const client = new Client({ name: 'locoagent', version })
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    requestInit: { headers: { 'User-Agent': USER_AGENT } },
    // Include discovery/handshake in the same timeout and cancellation boundary.
    fetch: (url, init) => fetch(url, {
      ...init,
      signal: AbortSignal.any([requestSignal, ...(init?.signal ? [init.signal] : [])]),
    }),
  })
  const options = { signal: requestSignal, timeout: TIMEOUT_MS }
  try {
    await client.connect(transport, options)
    const tools = await client.listTools({}, options)
    if (!tools.tools.some(tool => tool.name === 'web_search')) {
      throw new Error('Parallel Search MCP did not advertise web_search')
    }
    const response = CallToolResultSchema.parse(await client.callTool({
      name: 'web_search',
      arguments: {
        objective: input.query,
        search_queries: [input.query],
        session_id: sessionId,
      },
    }, CallToolResultSchema, options))
    if (response.isError) {
      throw new Error(`Parallel search failed: ${response.content
        .filter(block => block.type === 'text').map(block => block.text).join('\n')}`)
    }
    const payload = response.structuredContent ?? JSON.parse(
      response.content.filter(block => block.type === 'text').map(block => block.text).join('\n'),
    )
    const { results } = responseSchema.parse(payload)
    return results.flatMap(result => {
      let url: URL
      try { url = new URL(result.url) } catch { return [] }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return []
      const host = url.hostname.toLowerCase().replace(/\.$/, '')
      if (input.allowed_domains?.length &&
          !input.allowed_domains.some(domain => matchesDomain(host, domain))) return []
      if (input.blocked_domains?.some(domain => matchesDomain(host, domain))) return []
      return [{ title: result.title || result.url, url: result.url, excerpts: result.excerpts }]
    })
  } finally {
    await client.close().catch(() => {})
  }
}
