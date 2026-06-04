/**
 * Shared `fetch` wrapper for the OpenAI-compatible and Codex shims.
 *
 * Why this exists: the shims (`openaiShim.ts`, `codexShim.ts`) talk to the
 * provider with a bare global `fetch`, which does NOT pick up the project's CA
 * configuration the way the native Anthropic path does (`proxy.ts` builds an
 * undici dispatcher with `ca: getCACertificates()`). That means a user behind a
 * TLS-intercepting proxy (corporate Zscaler, campus FortiGate, …) who correctly
 * sets `NODE_EXTRA_CA_CERTS` would still see "unable to get local issuer
 * certificate" on the DeepSeek/OpenAI path, because the custom CA never reached
 * the request.
 *
 * This wrapper closes that gap by attaching the resolved CA bundle via Bun's
 * `tls` fetch option, and rewrites raw SSL failures into an actionable message.
 */
import { getCACertificates } from 'src/utils/caCerts.js'
import { extractConnectionErrorDetails } from './errorUtils.js'

// Bun's `fetch` accepts a `tls` init option (ca/cert/key/rejectUnauthorized)
// that standard `RequestInit` doesn't type. Node's fetch ignores unknown init
// keys, so this stays a no-op there (Node honours NODE_EXTRA_CA_CERTS natively).
type ShimFetchInit = RequestInit & {
  tls?: { ca?: string[]; rejectUnauthorized?: boolean }
}

// Bun does not always surface a Node-style `.code` on TLS errors, so fall back
// to matching the human-readable message for the common interception phrases.
const SSL_MESSAGE_HINTS = [
  'unable to get local issuer certificate',
  'self-signed certificate',
  'self signed certificate',
  'unable to verify the first certificate',
  'certificate has expired',
  'untrusted',
  'sec_e_untrusted_root',
]

function looksLikeSSLError(error: unknown): boolean {
  if (extractConnectionErrorDetails(error)?.isSSLError) return true
  const message =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`
      : String(error ?? '')
  const lower = message.toLowerCase()
  return SSL_MESSAGE_HINTS.some(hint => lower.includes(hint))
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * `fetch` for the provider shims: injects the configured CA bundle and turns
 * raw TLS failures into a message that tells the user how to fix them.
 */
export async function shimFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const caCerts = getCACertificates()
  const finalInit: ShimFetchInit = caCerts
    ? { ...init, tls: { ca: caCerts } }
    : init

  try {
    return await fetch(url, finalInit as RequestInit)
  } catch (error) {
    if (looksLikeSSLError(error)) {
      const details = extractConnectionErrorDetails(error)
      const codePart = details?.code ? ` (${details.code})` : ''
      throw new Error(
        `TLS certificate error${codePart} connecting to ${hostOf(url)}. ` +
          `You are likely behind a TLS-intercepting proxy or firewall ` +
          `(corporate VPN, or a campus/office gateway such as FortiGate). ` +
          `Export that gateway's root CA to a .pem file and set ` +
          `NODE_EXTRA_CA_CERTS to its path in your .env, then restart. ` +
          `If the provider host is outright blocked on this network, switch ` +
          `networks (e.g. a phone hotspot) or pick a provider that is allowed. ` +
          `Run /doctor for details.`,
        { cause: error },
      )
    }
    throw error
  }
}
