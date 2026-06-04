/**
 * agent-browser config pin. agent-browser, left unconfigured, launches its OWN
 * bundled "Chrome for Testing" on a random port instead of attaching to our
 * isolated CDP Chrome — so social logins land in a throwaway profile and the
 * user can never stay signed in. Pinning `cdp` in agent-browser.json makes
 * EVERY agent-browser command (even a bare `open`) attach to the CDP port, and
 * if that port is down it fails fast with a clear error instead of silently
 * spawning Chrome for Testing.
 *
 * Config search order is: ~/.agent-browser/config.json < ./agent-browser.json
 * (cwd) < env < flags. We pin at the project root and also point
 * AGENT_BROWSER_CONFIG at it (see stubs/globals.ts) so the pin holds regardless
 * of the working directory a command is run from.
 *
 * NOTE: agent-browser's `cdp` key is a STRING ("9222"), not an integer — an
 * integer is rejected as "invalid type: integer".
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Absolute path to the project-level agent-browser.json pin. */
export function agentBrowserConfigPath(projectRoot: string): string {
  return join(projectRoot, 'agent-browser.json')
}

/**
 * Merge `cdp: "<port>"` into the agent-browser config at the project root,
 * preserving any other keys a user may have added. Writes only when the content
 * actually changes (so default-port users never see a spurious git diff).
 * Returns the config path.
 */
export function syncAgentBrowserConfig(projectRoot: string, port: number): string {
  const path = agentBrowserConfigPath(projectRoot)
  let current: Record<string, unknown> = {}
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        current = parsed as Record<string, unknown>
      }
    } catch {
      /* malformed file → rewrite it from scratch with just the pin */
    }
  }
  const next = { ...current, cdp: String(port) }
  // Stable 2-space formatting + trailing newline so re-runs are idempotent.
  const rendered = JSON.stringify(next, null, 2) + '\n'
  if (!existsSync(path) || readFileSync(path, 'utf-8') !== rendered) {
    writeFileSync(path, rendered)
  }
  return path
}
