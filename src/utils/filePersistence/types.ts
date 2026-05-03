/**
 * Shared types and constants for file persistence.
 */

/** Subdirectory name for outputs within a session directory. */
export const OUTPUTS_SUBDIR = 'outputs'

/** Maximum number of files to persist per turn. */
export const FILE_COUNT_LIMIT = 500

/** Default concurrency for upload operations. */
export const DEFAULT_UPLOAD_CONCURRENCY = 5

/** Timestamp marking the start of a turn (ms since epoch). */
export type TurnStartTime = number

/** A successfully persisted file. */
export interface PersistedFile {
  filename: string
  file_id: string
}

/** A file that failed to persist. */
export interface FailedPersistence {
  filename: string
  error: string
}

/** Event data emitted after file persistence completes. */
export interface FilesPersistedEventData {
  files: PersistedFile[]
  failed: FailedPersistence[]
}
