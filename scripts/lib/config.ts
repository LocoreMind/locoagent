/**
 * Central configuration resolver. One pure function over process.env (already
 * populated from .env by stubs/globals.ts) shared by setup-chrome.ts and
 * doctor.ts so they never disagree about host/device/chrome paths.
 */
import {
  detectHost,
  defaultSourceProfile,
  defaultWorkProfile,
  resolveChromeBinary,
  type HostOS,
} from './host'
import { resolveDevice, type DeviceTarget } from './device'

export interface LocoConfig {
  host: HostOS
  device: DeviceTarget
  chromeBin: string
  sourceProfile: string
  workProfile: string
  debugPort: number
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  host: HostOS = detectHost(),
): LocoConfig {
  const device = resolveDevice(env)
  const sourceProfile = env.CHROME_SOURCE_PROFILE ?? defaultSourceProfile(host, env)
  const workProfile = env.CHROME_WORK_PROFILE ?? defaultWorkProfile()
  const debugPort = parseInt(env.CHROME_DEBUG_PORT ?? '9222', 10)
  const chromeBin = resolveChromeBinary(env.CHROME_BIN, host)
  return { host, device, chromeBin, sourceProfile, workProfile, debugPort }
}
