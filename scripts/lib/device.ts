/**
 * Device-target abstraction. Maps LocoAgent's logical targets to the
 * `agent-browser -p <profile>` device-emulation profiles. The agent runs on a
 * desktop host; iOS/Android are browser emulations, not native runtimes.
 */

export type DeviceTarget = 'desktop' | 'ios' | 'android'

export interface DeviceSpec {
  /** agent-browser device profile name, or null for no emulation (desktop). */
  abProfile: string | null
  label: string
}

export const DEVICE_REGISTRY: Record<DeviceTarget, DeviceSpec> = {
  desktop: { abProfile: null, label: 'Desktop Chrome' },
  ios: { abProfile: 'ios', label: 'iPhone (mobile web)' },
  android: { abProfile: 'android', label: 'Android (mobile web)' },
}

export function isDeviceTarget(v: string): v is DeviceTarget {
  return v === 'desktop' || v === 'ios' || v === 'android'
}

/** Resolve the active device target from env (DEVICE_PROFILE), default desktop. */
export function resolveDevice(env: NodeJS.ProcessEnv = process.env): DeviceTarget {
  // A blank/whitespace DEVICE_PROFILE (e.g. an empty `.env` placeholder) means
  // "use the default", not an invalid target — fall back to desktop.
  const raw = (env.DEVICE_PROFILE ?? '').trim().toLowerCase() || 'desktop'
  if (!isDeviceTarget(raw)) {
    throw new Error(
      `Invalid DEVICE_PROFILE "${raw}". Valid values: desktop, ios, android.`,
    )
  }
  return raw
}

/** agent-browser CLI args to emulate this target, e.g. ['-p','ios'] or []. */
export function agentBrowserProfileArgs(target: DeviceTarget): string[] {
  const spec = DEVICE_REGISTRY[target]
  return spec.abProfile ? ['-p', spec.abProfile] : []
}
