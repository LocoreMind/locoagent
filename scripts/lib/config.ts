/**
 * Central configuration resolver. One pure function over process.env (already
 * populated from .env by stubs/globals.ts) shared by setup-chrome.ts and
 * doctor.ts so they never disagree about host/device/chrome paths.
 */
import {
  detectHost,
  defaultWorkProfile,
  resolveChromeBinary,
  type HostOS,
} from './host'
import { resolveDevice, type DeviceTarget } from './device'

export interface LocoConfig {
  host: HostOS
  device: DeviceTarget
  chromeBin: string
  /** Isolated, persistent `--user-data-dir`. Never the user's real profile. */
  workProfile: string
  debugPort: number
}

/**
 * Read an env var, treating blank/whitespace-only as absent. Env values can
 * arrive empty from a blank `.env` placeholder or an exported-but-empty shell
 * var; in both cases the intent is "use the default", not the empty string.
 */
function pick(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): LocoConfig {
  const device = resolveDevice(env)
  const workProfile = pick(env.CHROME_WORK_PROFILE) ?? defaultWorkProfile(host, env)
  const debugPort = parseInt(pick(env.CHROME_DEBUG_PORT) ?? '9222', 10)
  const chromeBin = resolveChromeBinary(pick(env.CHROME_BIN), host)
  return { host, device, chromeBin, workProfile, debugPort }
}
