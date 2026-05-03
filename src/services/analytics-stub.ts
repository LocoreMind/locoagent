/**
 * Stub file for analytics functionality
 * All functions are no-ops to allow code to compile without analytics infrastructure
 */

// Type stubs
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = Record<string, any>;
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = Record<string, any>;

// No-op analytics functions
export function logEvent(...args: any[]): void {
  // No-op
}

export function initializeGrowthBook(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function refreshGrowthBookAfterAuthChange(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function hasGrowthBookEnvOverride(): boolean {
  return false;
}

export function isAnalyticsDisabled(): boolean {
  return true;
}

export function getFeatureValue_CACHED_MAY_BE_STALE(key: string, defaultValue?: any): any {
  return defaultValue;
}

export function getFeatureValue_CACHED_WITH_REFRESH(key: string, defaultValue?: any): any {
  return defaultValue;
}

export function getFeatureValue_DEPRECATED(key: string, defaultValue?: any): any {
  return defaultValue;
}

export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(gate: string): boolean {
  return false;
}

export function checkGate_CACHED_OR_BLOCKING(gate: string): Promise<boolean> {
  return Promise.resolve(false);
}

export function initializeAnalyticsGates(...args: any[]): void {
  // No-op
}

export function initializeAnalyticsSink(...args: any[]): void {
  // No-op
}

export function shutdownDatadog(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function shutdown1PEventLogging(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function sanitizeToolNameForAnalytics(toolName: string): string {
  return toolName;
}

export function getDynamicConfig_BLOCKS_ON_INIT(key: string, defaultValue?: any): Promise<any> {
  return Promise.resolve(defaultValue);
}

export function onGrowthBookRefresh(callback: () => void): void {
  // No-op
}

export function getDynamicConfig_CACHED_MAY_BE_STALE(key: string, defaultValue?: any): any {
  return defaultValue;
}

export function logEventTo1P(...args: any[]): void {
  // No-op
}

export function isFeedbackSurveyDisabled(): boolean {
  return true;
}

export function resetGrowthBook(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function getFileExtensionForAnalytics(path: string): string {
  return path.split('.').pop() || '';
}

export function isToolDetailsLoggingEnabled(): boolean {
  return false;
}

export function isUserPromptsLoggingEnabled(): boolean {
  return false;
}

// Additional analytics functions
export function extractToolInputForTelemetry(...args: any[]): any {
  return {};
}

export function extractToolResponseForTelemetry(...args: any[]): any {
  return {};
}

export function buildMCPToolTelemetryFieldsAnonymized(...args: any[]): Record<string, any> {
  return {};
}

export function getQueryIdForLogging(): string {
  return 'stub-query-id';
}

// Complete set of analytics stubs from original
export function mcpToolDetailsForAnalytics(...args: any[]): Record<string, any> {
  return {};
}

export function extractMcpToolDetails(...args: any[]): Record<string, any> {
  return {};
}

export function extractSkillName(...args: any[]): string {
  return '';
}

export function getAllGrowthBookFeatures(): Record<string, any> {
  return {};
}

export function getApiBaseUrlHost(): string {
  return '';
}

export function getEventMetadata(): Record<string, any> {
  return {};
}

export function getEventSamplingConfig(...args: any[]): Record<string, any> {
  return {};
}

export function getFileExtensionsFromBashCommand(...args: any[]): string[] {
  return [];
}

export function getGrowthBookConfigOverrides(): Record<string, any> {
  return {};
}

export function is1PEventLoggingEnabled(): boolean {
  return false;
}

export function isAnalyticsToolDetailsLoggingEnabled(): boolean {
  return false;
}

export function isSinkKilled(): boolean {
  return true;
}

export function logEventAsync(...args: any[]): Promise<void> {
  return Promise.resolve();
}

export function logGrowthBookExperimentTo1P(...args: any[]): void {
  // No-op
}

export function refreshGrowthBookFeatures(): Promise<void> {
  return Promise.resolve();
}

export function reinitialize1PEventLoggingIfConfigChanged(): Promise<void> {
  return Promise.resolve();
}

export function setGrowthBookConfigOverride(...args: any[]): void {
  // No-op
}

export function setupPeriodicGrowthBookRefresh(...args: any[]): void {
  // No-op
}

export function shouldSampleEvent(...args: any[]): boolean {
  return false;
}

export function checkSecurityRestrictionGate(...args: any[]): boolean {
  return false;
}

export function clearGrowthBookConfigOverrides(): void {
  // No-op
}

export function attachAnalyticsSink(...args: any[]): void {
  // No-op
}

export function initializeDatadog(...args: any[]): void {
  // No-op
}

export function initialize1PEventLogging(...args: any[]): void {
  // No-op
}
