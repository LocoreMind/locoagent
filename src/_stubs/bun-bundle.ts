// Stub for bun:bundle feature() function
// All features return false - matches external/public build behavior
// This avoids loading codepaths that depend on missing internal directories
export function feature(_name: string): boolean {
  return false
}
