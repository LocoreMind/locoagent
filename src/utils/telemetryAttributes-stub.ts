/**
 * Stub file for telemetry attributes functionality
 * All functions are no-ops to allow code to compile without telemetry attributes infrastructure
 */

export function getTelemetryAttributes(...args: any[]): Record<string, any> {
  return {};
}

export function setTelemetryAttribute(...args: any[]): void {
  // No-op
}

export function getTelemetryAttribute(key: string): any {
  return undefined;
}
