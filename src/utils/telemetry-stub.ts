/**
 * Stub file for telemetry functionality
 * All functions are no-ops to allow code to compile without telemetry infrastructure
 */

// Type stubs
export type Span = { end: () => void; setAttribute: (key: string, value: any) => void }

// No-op telemetry functions
export function logOTelEvent(...args: any[]): void {
  // No-op
}

export function redactIfDisabled(value: any): any {
  return value;
}

export function startInteractionSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endInteractionSpan(...args: any[]): void {
  // No-op
}

export function logPluginLoadErrors(...args: any[]): void {
  // No-op
}

export function logPluginsEnabledForSession(...args: any[]): void {
  // No-op
}

export function logSkillsLoaded(...args: any[]): void {
  // No-op
}

export function buildPluginCommandTelemetryFields(...args: any[]): Record<string, any> {
  return {};
}

export function buildPluginTelemetryFields(...args: any[]): Record<string, any> {
  return {};
}

export function isBetaTracingEnabled(): boolean {
  return false;
}

export function clearBetaTracingState(...args: any[]): void {
  // No-op
}

// Perfetto tracing stubs
export function isPerfettoTracingEnabled(): boolean {
  return false;
}

export function registerAgent(...args: any[]): void {
  // No-op
}

export function unregisterAgent(...args: any[]): void {
  // No-op
}

export function startToolSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endToolSpan(...args: any[]): void {
  // No-op
}

export function startApiSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endApiSpan(...args: any[]): void {
  // No-op
}

export function recordApiLatency(...args: any[]): void {
  // No-op
}

export function beginPerfettoSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endPerfettoSpan(...args: any[]): void {
  // No-op
}

// Instrumentation stubs
export function shutdownTelemetry(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function flushTelemetry(...args: any[]): Promise<void> {
  return Promise.resolve();
}

// Additional telemetry span stubs
export function startToolBlockedOnUserSpan(...args: any[]): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function startCompactSpan(...args: any[]): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function startQuerySpan(...args: any[]): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function endSpan(...args: any[]): void {
  // No-op
}

export function setSpanAttribute(...args: any[]): void {
  // No-op
}

// Complete set of telemetry span stubs
export function endToolExecutionSpan(...args: any[]): void {
  // No-op
}

export function startToolExecutionSpan(...args: any[]): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function endToolBlockedOnUserSpan(...args: any[]): void {
  // No-op
}

export function endHookSpan(...args: any[]): void {
  // No-op
}

export function startHookSpan(...args: any[]): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function startLLMRequestSpan(...args: any[]): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function endLLMRequestSpan(...args: any[]): void {
  // No-op
}

export function startUserInputPerfettoSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endUserInputPerfettoSpan(...args: any[]): void {
  // No-op
}

export function startInteractionPerfettoSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endInteractionPerfettoSpan(...args: any[]): void {
  // No-op
}

export function startLLMRequestPerfettoSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endLLMRequestPerfettoSpan(...args: any[]): void {
  // No-op
}

export function startToolPerfettoSpan(...args: any[]): any {
  return { end: () => {} };
}

export function endToolPerfettoSpan(...args: any[]): void {
  // No-op
}

export function addBetaInteractionAttributes(...args: any[]): void {
  // No-op
}

export function addBetaLLMRequestAttributes(...args: any[]): void {
  // No-op
}

export function addBetaLLMResponseAttributes(...args: any[]): void {
  // No-op
}

export function addBetaToolInputAttributes(...args: any[]): void {
  // No-op
}

export function addBetaToolResultAttributes(...args: any[]): void {
  // No-op
}

export function addToolContentEvent(...args: any[]): void {
  // No-op
}

export function classifyPluginCommandError(...args: any[]): string {
  return 'unknown';
}

export function emitPerfettoCounter(...args: any[]): void {
  // No-op
}

export function emitPerfettoInstant(...args: any[]): void {
  // No-op
}

export function executeInSpan<T>(callback: () => T): T {
  return callback();
}

export function getCurrentSpan(): any {
  return { end: () => {}, setAttribute: () => {} };
}

export function getEnabledVia(): string {
  return 'disabled';
}

export function getPerfettoEvents(): any[] {
  return [];
}

export function getTelemetryPluginScope(): string {
  return '';
}

export function hashPluginId(...args: any[]): string {
  return '';
}

export function initializePerfettoTracing(...args: any[]): void {
  // No-op
}

export function initializeTelemetry(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function isEnhancedTelemetryEnabled(): boolean {
  return false;
}

export function isTelemetryEnabled(): boolean {
  return false;
}

export function resetPerfettoTracer(): void {
  // No-op
}

export function truncateContent(...args: any[]): string {
  return '';
}

export function bootstrapTelemetry(...args: any[]): void {
  // No-op
}
