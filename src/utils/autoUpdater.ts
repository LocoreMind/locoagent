/**
 * Auto-updater stub for claude-code-clean
 * All auto-update functionality has been disabled for privacy and independence
 */

import { ClaudeError } from './errors.js'

class AutoUpdaterError extends ClaudeError {}

export type InstallStatus =
  | 'success'
  | 'no_permissions'
  | 'install_failed'
  | 'in_progress'

export type AutoUpdaterResult = {
  version: string | null
  status: InstallStatus
  notifications?: string[]
}

export type MaxVersionConfig = {
  external?: string
  ant?: string
  external_message?: string
  ant_message?: string
}

// Disabled: No version checks from remote servers
export async function assertMinVersion(): Promise<void> {
  // No-op: claude-code-clean does not enforce minimum versions
  return
}

// Disabled: No maximum version caps
export async function getMaxVersion(): Promise<string | undefined> {
  return undefined
}

// Disabled: No version messages from server
export async function getMaxVersionMessage(): Promise<string | undefined> {
  return undefined
}

// Disabled: No version skipping
export function shouldSkipVersion(targetVersion: string): boolean {
  return false
}

// Disabled: No update locks needed
export function getLockFilePath(): string {
  return ''
}

// Disabled: No updates from GCS
export async function getLatestVersionFromGcs(channel: string): Promise<string | null> {
  return null
}

// Disabled: No auto-updates
export async function checkForUpdates(): Promise<AutoUpdaterResult> {
  return {
    version: null,
    status: 'success',
    notifications: ['Auto-updates disabled in claude-code-clean']
  }
}

// Disabled: No installations
export async function installUpdate(version: string): Promise<AutoUpdaterResult> {
  return {
    version: null,
    status: 'success',
    notifications: ['Auto-updates disabled in claude-code-clean']
  }
}

// Export any other functions that might be imported elsewhere as no-ops
export async function checkAndInstallUpdate(): Promise<void> {
  // No-op
}

export async function getUpdateStatus(): Promise<string> {
  return 'disabled'
}

export function isAutoUpdateEnabled(): boolean {
  return false
}

// Additional stub exports
export async function checkGlobalInstallPermissions(): Promise<{ canInstall: boolean; reason?: string }> {
  return { canInstall: false, reason: 'Auto-updates disabled in claude-code-clean' }
}

export async function getLatestVersion(channel: string): Promise<string | null> {
  return null
}

export type NpmDistTags = {
  latest?: string
  beta?: string
  stable?: string
}

export async function getNpmDistTags(): Promise<NpmDistTags> {
  return {}
}

export async function getGcsDistTags(): Promise<NpmDistTags> {
  return {}
}

export async function getVersionHistory(limit: number): Promise<string[]> {
  return []
}

export async function installGlobalPackage(version: string): Promise<AutoUpdaterResult> {
  return {
    version: null,
    status: 'success',
    notifications: ['Auto-updates disabled in claude-code-clean']
  }
}

export async function removeShellAliases(): Promise<void> {
  // No-op
}

export async function addShellAliases(): Promise<void> {
  // No-op
}

export function isUpdateAvailable(current: string, latest: string): boolean {
  return false
}
