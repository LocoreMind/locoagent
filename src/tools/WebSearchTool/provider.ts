import { getAPIProvider } from '../../utils/model/providers.js'
import {
  getAnthropicApiKeyWithSource,
  getAuthTokenSource,
} from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export type WebSearchProvider = 'parallel' | 'native' | 'disabled'

/** Resolve before making a request. A failed explicit provider never falls back. */
export function getWebSearchProvider(): WebSearchProvider {
  const selected = process.env.LOCOAGENT_SEARCH_PROVIDER?.trim()
  if (selected) {
    if (selected === 'parallel' || selected === 'native' || selected === 'disabled') {
      return selected
    }
    throw new Error('LOCOAGENT_SEARCH_PROVIDER must be parallel, native, or disabled')
  }

  const provider = getAPIProvider()
  // These explicit backend choices already have native search support.
  if (provider === 'vertex' || provider === 'foundry') return 'native'
  if (provider === 'firstParty') {
    if (getAuthTokenSource().hasToken || process.env.ANTHROPIC_API_KEY) return 'native'
    // In CI/test, the auth reader requires a key and deliberately ignores saved
    // login. Don't turn that assertion into a failure of anonymous search.
    const canReadKey = process.env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR ||
      (!isEnvTruthy(process.env.CI) && process.env.NODE_ENV !== 'test')
    if (canReadKey &&
        getAnthropicApiKeyWithSource({ skipRetrievingKeyFromApiKeyHelper: true }).source !== 'none') {
      return 'native'
    }
  }
  // OpenAI-compatible/Bedrock backends have no native WebSearch implementation.
  return 'parallel'
}
