/**
 * Host OS single source of truth. Detects the operating system the agent runs
 * on and supplies all host-specific Chrome / profile / temp / process defaults.
 * Pure (no side effects) except killChrome(), which is only invoked explicitly.
 */
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

export type HostOS = 'windows' | 'macos' | 'linux'

export function detectHost(platform: NodeJS.Platform = process.platform): HostOS {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

/** Ordered list of default Chrome binary paths to probe for this host. */
export function chromeBinaryCandidates(
  host: HostOS,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (host === 'windows') {
    const pf = env['ProgramFiles'] ?? 'C:\\Program Files'
    const pf86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const local = env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local')
    return [
      join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
  }
  if (host === 'macos') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
}

/** Default path to the user's real Chrome profile dir for this host. */
export function defaultSourceProfile(
  host: HostOS,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (host === 'windows') {
    const local = env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local')
    return join(local, 'Google', 'Chrome', 'User Data', 'Default')
  }
  if (host === 'macos') {
    return join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default')
  }
  return join(homedir(), '.config', 'google-chrome', 'Default')
}

/** Cross-platform temp work-profile dir (replaces hardcoded /tmp). */
export function defaultWorkProfile(): string {
  return join(tmpdir(), 'locoagent-chrome-profile')
}

/** explicit (CHROME_BIN) if it exists → first existing candidate → throw. */
export function resolveChromeBinary(
  explicit: string | undefined,
  host: HostOS = detectHost(),
): string {
  if (explicit) {
    if (existsSync(explicit)) return explicit
    throw new Error(`CHROME_BIN is set to "${explicit}" but that file does not exist.`)
  }
  for (const candidate of chromeBinaryCandidates(host)) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    `Could not find Chrome on this ${host} host. Set CHROME_BIN in .env to the Chrome binary path.`,
  )
}

/** Host-aware best-effort kill of running Chrome. Non-fatal if none running. */
export async function killChrome(host: HostOS = detectHost()): Promise<void> {
  const cmd =
    host === 'windows'
      ? ['taskkill', '/F', '/IM', 'chrome.exe']
      : host === 'macos'
        ? ['killall', 'Google Chrome']
        : ['pkill', '-f', 'chrome']
  try {
    Bun.spawnSync(cmd, { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    /* "no matching process" is success */
  }
}
