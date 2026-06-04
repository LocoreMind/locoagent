/**
 * BrowserTargetManager — the per-platform browser-target layer.
 *
 * A "target" is one Chrome instance: its CDP port, isolated profile dir, optional
 * upstream proxy, and device emulation. The registry at config/browser-targets.json
 * is the single source of truth, read by setup-chrome.ts, workflow-engine.ts, and
 * doctor.ts so they never disagree about which port/profile a platform uses.
 *
 * Resolution reuses the existing host/device layers: a null/absent profile is
 * derived as `defaultWorkProfile(host)-<platform>` (isolated per platform → cookie
 * isolation). The `useLegacyProfile` flag derives the no-suffix path so the
 * pre-existing X login (in `locoagent-chrome-profile`) keeps working without a
 * re-login.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectHost, defaultWorkProfile, type HostOS } from './host'
import { resolveDevice, isDeviceTarget, type DeviceTarget } from './device'

export interface TargetEntry {
  cdpPort: number
  /** Explicit --user-data-dir. Null/absent → derived from host layer. */
  profile?: string | null
  /** Derive the no-suffix legacy profile (X back-compat) when no explicit profile. */
  useLegacyProfile?: boolean
  proxy?: string | null
  device?: DeviceTarget | null
  account?: string
}

export interface Registry {
  version: number
  targets: Record<string, TargetEntry>
}

export interface ResolvedTarget {
  platform: string
  cdpPort: number
  profile: string
  proxy?: string
  device: DeviceTarget
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Absolute path to the registry file shipped at the project root. */
export function defaultRegistryPath(): string {
  return join(PROJECT_ROOT, 'config', 'browser-targets.json')
}

/** Parse + validate registry JSON. Throws on malformed input. */
export function parseRegistry(json: string): Registry {
  const parsed = JSON.parse(json) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('browser-targets registry must be a JSON object')
  }
  const reg = parsed as Partial<Registry>
  if (!reg.targets || typeof reg.targets !== 'object') {
    throw new Error('browser-targets registry is missing a "targets" object')
  }
  return { version: reg.version ?? 1, targets: reg.targets }
}

/** Read the registry and resolve every entry into a concrete target. */
export function loadTargets(
  registryPath: string = defaultRegistryPath(),
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): Record<string, ResolvedTarget> {
  if (!existsSync(registryPath)) {
    throw new Error(`browser-targets registry not found at ${registryPath}`)
  }
  const reg = parseRegistry(readFileSync(registryPath, 'utf-8'))
  const out: Record<string, ResolvedTarget> = {}
  for (const [platform, entry] of Object.entries(reg.targets)) {
    out[platform] = resolveEntry(platform, entry, env, host)
  }
  return out
}

/** Resolve a single platform; throws a clear error if it is not in the registry. */
export function resolveTarget(
  platform: string,
  registryPath: string = defaultRegistryPath(),
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): ResolvedTarget {
  const all = loadTargets(registryPath, env, host)
  const t = all[platform]
  if (!t) {
    throw new Error(
      `Unknown platform "${platform}". Known: ${Object.keys(all).join(', ') || '(none)'}. ` +
        `Add it to ${registryPath}.`,
    )
  }
  return t
}

function resolveEntry(
  platform: string,
  entry: TargetEntry,
  env: NodeJS.ProcessEnv,
  host: HostOS,
): ResolvedTarget {
  if (typeof entry.cdpPort !== 'number' || !Number.isFinite(entry.cdpPort)) {
    throw new Error(`browser-targets: platform "${platform}" has an invalid cdpPort: ${entry.cdpPort}`)
  }
  const explicit = entry.profile?.trim()
  const base = defaultWorkProfile(host, env)
  const profile = explicit
    ? explicit
    : entry.useLegacyProfile
      ? base
      : `${base}-${platform}`
  const device =
    entry.device && isDeviceTarget(entry.device) ? entry.device : resolveDevice(env)
  const resolved: ResolvedTarget = { platform, cdpPort: entry.cdpPort, profile, device }
  const proxy = entry.proxy?.trim()
  if (proxy) resolved.proxy = proxy
  return resolved
}

/** True if Chrome's CDP endpoint is serving on this port. Shared health probe. */
export async function cdpUp(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`)
    return res.ok
  } catch {
    return false
  }
}

/** Per-platform health snapshot for doctor / status output. */
export async function healthCheck(
  platform: string,
  registryPath: string = defaultRegistryPath(),
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): Promise<{ platform: string; port: number; profile: string; up: boolean }> {
  const t = resolveTarget(platform, registryPath, env, host)
  return { platform, port: t.cdpPort, profile: t.profile, up: await cdpUp(t.cdpPort) }
}
