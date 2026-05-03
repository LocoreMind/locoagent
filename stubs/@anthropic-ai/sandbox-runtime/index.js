// Stub for @anthropic-ai/sandbox-runtime
export class SandboxManager {
  constructor() {}
  async start() {}
  async stop() {}
  static isSupportedPlatform() { return false }
  static checkDependencies() { return { errors: ['sandbox-runtime stub'] } }
  static wrapWithSandbox(...args) { return args[0] }
  static async initialize() {}
  static updateConfig() {}
  static async reset() {}
  static getFsReadConfig() { return {} }
  static getFsWriteConfig() { return {} }
}
export const SandboxRuntimeConfigSchema = {}
export class SandboxViolationStore {
  constructor() {}
  getViolations() { return [] }
}
