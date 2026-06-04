/**
 * Host OS single source of truth. Detects the operating system the agent runs
 * on and supplies all host-specific Chrome / profile / temp / process defaults.
 * Pure (no side effects) except killChromeForProfile(), invoked explicitly.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
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

/**
 * Stable, persistent, isolated work-profile dir. Lives under a per-user data
 * location (NOT the temp dir) so a manual social-account login survives reboots
 * and temp-cleaners. This is the isolated `--user-data-dir` the CDP Chrome runs
 * on; it is never the user's real Chrome profile.
 */
export function defaultWorkProfile(
  host: HostOS = detectHost(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (host === 'windows') {
    const local = env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local')
    return join(local, 'locoagent-chrome-profile')
  }
  if (host === 'macos') {
    return join(homedir(), 'Library', 'Application Support', 'locoagent-chrome-profile')
  }
  const dataHome = env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share')
  return join(dataHome, 'locoagent-chrome-profile')
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

/**
 * TARGETED kill: terminate ONLY the Chrome instance running on the given
 * isolated `--user-data-dir`, matched by that path on the process command line.
 * Never touches the user's normal Chrome. Non-fatal if nothing matches.
 *
 * Used by `setup-chrome --reset` (and to clear a stale lock on the isolated
 * profile) — the kill-all approach is deliberately avoided.
 */
export async function killChromeForProfile(
  workProfile: string,
  host: HostOS = detectHost(),
): Promise<void> {
  try {
    if (host === 'windows') {
      // CIM lets us filter chrome.exe by its CommandLine (the --user-data-dir
      // value), so only our isolated instance is stopped.
      const ps =
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
        `Where-Object { $_.CommandLine -like '*${workProfile.replace(/'/g, "''")}*' } | ` +
        `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
      Bun.spawnSync(['powershell', '-NoProfile', '-Command', ps], {
        stdout: 'ignore',
        stderr: 'ignore',
      })
    } else {
      // pkill -f matches the full argv; the unique user-data-dir path scopes it.
      Bun.spawnSync(['pkill', '-f', `--user-data-dir=${workProfile}`], {
        stdout: 'ignore',
        stderr: 'ignore',
      })
    }
  } catch {
    /* "no matching process" is success */
  }
}
