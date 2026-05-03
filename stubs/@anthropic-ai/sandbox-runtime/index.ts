// Stub for @anthropic-ai/sandbox-runtime
export type SandboxRuntimeConfig = any
export type SandboxViolationEvent = any
export type FsReadRestrictionConfig = any
export type FsWriteRestrictionConfig = any
export type IgnoreViolationsConfig = any
export type NetworkHostPattern = any
export type NetworkRestrictionConfig = any
export type SandboxAskCallback = any
export type SandboxDependencyCheck = any
export class SandboxManager {
  constructor(..._args: any[]) {}
  async start() {}
  async stop() {}
  static isSupportedPlatform(): boolean { return false }
  static checkDependencies(..._args: any[]): { errors: string[] } { return { errors: ['sandbox-runtime stub'] } }
  static wrapWithSandbox(..._args: any[]): any { return _args[0] }
  static async initialize(..._args: any[]) {}
  static updateConfig(..._args: any[]) {}
  static async reset() {}
  static getFsReadConfig(): any { return {} }
  static getFsWriteConfig(): any { return {} }
  static getNetworkRestrictionConfig(): any { return {} }
  static getIgnoreViolations(): any { return {} }
  static getAllowUnixSockets(): boolean { return false }
  static getAllowLocalBinding(): boolean { return false }
  static getEnableWeakerNestedSandbox(): boolean { return false }
  static getProxyPort(): number | null { return null }
  static getSocksProxyPort(): number | null { return null }
  static getLinuxHttpSocketPath(): string | null { return null }
  static getLinuxSocksSocketPath(): string | null { return null }
  static async waitForNetworkInitialization() {}
  static getSandboxViolationStore(): SandboxViolationStore { return new SandboxViolationStore() }
  static annotateStderrWithSandboxFailures(_command: string, stderr: string): string { return stderr }
  static cleanupAfterCommand(): void {}
  static getLinuxGlobPatternWarnings(): string[] { return [] }
  static refreshConfig(): void {}
}
export const SandboxRuntimeConfigSchema = {} as any
export class SandboxViolationStore {
  private _listeners: Array<(violations: any[]) => void> = []
  constructor(..._args: any[]) {}
  getViolations() { return [] }
  getTotalCount() { return 0 }
  subscribe(listener: (violations: any[]) => void): () => void {
    this._listeners.push(listener)
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener)
    }
  }
}
