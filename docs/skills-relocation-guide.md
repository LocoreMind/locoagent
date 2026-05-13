# Skills Relocation Guide: `.claude/skills/` -> `locoagent/skills/`

How to make skills load from `locoagent/skills/` instead of (or in addition to) `.claude/skills/`.

---

## Current Skill Loading Architecture

### Skill Sources (5 sources, priority order)

| Source | Path | Description |
|--------|------|-------------|
| **Managed (policy)** | `<managed-path>/.claude/skills/` | Enterprise-managed skills |
| **User** | `~/.claude/skills/` | Per-user global skills |
| **Project** | `.claude/skills/` (relative to cwd, walking up to git root) | Project-specific skills |
| **Additional dirs** | `<dir>/.claude/skills/` (via `--add-dir`) | Explicit extra directories |
| **Legacy commands** | `.claude/commands/` | Deprecated, still supported |

All project-level skills are **hardcoded** to `.claude/skills/` subdirectories.

### Key Files

| File | Role |
|------|------|
| `src/skills/loadSkillsDir.ts` | **Core skill loader** - loads, parses, deduplicates skills |
| `src/utils/markdownConfigLoader.ts` | `getProjectDirsUpToHome()` - walks directory tree to find `.claude/<subdir>` paths |
| `src/utils/skills/skillChangeDetector.ts` | File watcher for hot-reload of changed skills |
| `src/utils/permissions/filesystem.ts` | Permission rules for `.claude/skills/` paths |
| `src/utils/sandbox/sandbox-adapter.ts` | Sandbox write-block rules for `.claude/skills/` |

### Skill Format

Skills **must** use directory format: `<skills-dir>/<skill-name>/SKILL.md`

Single `.md` files directly in the skills directory are NOT supported by `loadSkillsFromSkillsDir()`.

```
.claude/skills/
  x-com/
    SKILL.md      <-- loaded as /x-com
  my-deploy/
    SKILL.md      <-- loaded as /my-deploy
```

### Loading Flow

```
getSkillDirCommands(cwd)                         // src/skills/loadSkillsDir.ts:638
  |
  +--> managedSkillsDir  = <managed>/.claude/skills/
  +--> userSkillsDir     = ~/.claude/skills/
  +--> projectSkillsDirs = getProjectDirsUpToHome('skills', cwd)
  |      |
  |      +--> walks from cwd up to git root
  |      +--> checks: join(currentDir, '.claude', 'skills')  <-- HARDCODED
  |      +--> returns array of existing dirs
  |
  +--> Promise.all([
  |      loadSkillsFromSkillsDir(managedSkillsDir, 'policySettings'),
  |      loadSkillsFromSkillsDir(userSkillsDir, 'userSettings'),
  |      projectSkillsDirs.map(dir => loadSkillsFromSkillsDir(dir, 'projectSettings')),
  |      additionalDirs.map(dir => loadSkillsFromSkillsDir(join(dir,'.claude','skills'), 'projectSettings')),
  |      loadSkillsFromCommandsDir(cwd),   // legacy
  |    ])
  |
  +--> deduplicate by resolved path (symlinks)
  +--> separate conditional skills (with paths frontmatter)
  +--> return unconditional skills
```

### Dynamic Skill Discovery

When files are read/edited, `discoverSkillDirsForPaths()` walks from the file's directory up to cwd, checking for `.claude/skills/` at each level:

```typescript
// src/skills/loadSkillsDir.ts:877
const skillDir = join(currentDir, '.claude', 'skills')
```

This is a separate hardcoded reference.

### Skill Change Detector (Hot Reload)

`src/utils/skills/skillChangeDetector.ts` watches these paths for changes:

```
~/.claude/skills/                    // userSettings
.claude/skills/   (resolved to abs)  // projectSettings
```

Both paths constructed via `getSkillsPath()` which returns `.claude/skills` for projectSettings.

---

## Where `.claude/skills/` is Hardcoded

### 1. `getProjectDirsUpToHome()` in `src/utils/markdownConfigLoader.ts:253`

```typescript
const claudeSubdir = join(current, '.claude', subdir)
// subdir = 'skills' -> produces <dir>/.claude/skills
```

This function walks from cwd up to git root, collecting existing `.claude/skills/` directories.

### 2. `discoverSkillDirsForPaths()` in `src/skills/loadSkillsDir.ts:877`

```typescript
const skillDir = join(currentDir, '.claude', 'skills')
```

Dynamic discovery during file operations.

### 3. `getSkillsPath()` in `src/skills/loadSkillsDir.ts:82-94`

```typescript
case 'projectSettings':
  return `.claude/${dir}`    // dir = 'skills' -> '.claude/skills'
```

Used by `SkillsMenu.tsx` and `skillChangeDetector.ts`.

### 4. `skillChangeDetector.ts:197-202`

```typescript
const projectSkillsPath = getSkillsPath('projectSettings', 'skills')
// resolves to .claude/skills
```

### 5. Permission & Sandbox rules in `src/utils/permissions/filesystem.ts`

```typescript
// Line 110
prefix: '/.claude/skills/',
// Line 235
const skillsDir = join(getOriginalCwd(), '.claude', 'skills')
```

### 6. Sandbox adapter in `src/utils/sandbox/sandbox-adapter.ts:247-249`

```
// Block writes to .claude/skills in both original and current working directories.
```

### 7. UI & documentation strings (non-functional)

- `src/components/skills/SkillsMenu.tsx:104` - help text
- `src/services/tips/tipRegistry.ts:394` - tip text
- `src/commands/init.ts:169` - init prompt
- `src/skills/bundled/skillify.ts:68` - skillify instructions

---

## Modification Plan: Enable `locoagent/skills/`

### Approach A: Add project-root `skills/` as an additional source (Recommended)

Add `locoagent/skills/` (i.e. `<project-root>/skills/`) as a new skill source alongside `.claude/skills/`. This preserves backward compatibility.

#### Files to Modify

**1. `src/skills/loadSkillsDir.ts` - `getSkillDirCommands()`** (line 638)

Add the project-root `skills/` directory as an additional source:

```typescript
// After line 642:
// const projectSkillsDirs = getProjectDirsUpToHome('skills', cwd)

// ADD: project-root skills/ directory (locoagent/skills/)
const projectRootSkillsDir = join(cwd, 'skills')
```

Then add it to the `Promise.all` array (after projectSkillsDirs loading):

```typescript
// Add to the Promise.all array:
loadSkillsFromSkillsDir(projectRootSkillsDir, 'projectSettings'),
```

And merge into `allSkillsWithPaths`:

```typescript
const allSkillsWithPaths = [
  ...managedSkills,
  ...userSkills,
  ...projectSkillsNested.flat(),
  ...projectRootSkills,          // <-- ADD
  ...additionalSkillsNested.flat(),
  ...legacyCommands,
]
```

**2. `src/skills/loadSkillsDir.ts` - `discoverSkillDirsForPaths()`** (line 861)

Add a check for `skills/` alongside `.claude/skills/`:

```typescript
// After line 877:
// const skillDir = join(currentDir, '.claude', 'skills')

// Also check for direct skills/ directory
const directSkillDir = join(currentDir, 'skills')
```

**3. `src/utils/skills/skillChangeDetector.ts` - `getWatchablePaths()`** (line 171)

Add the project-root `skills/` to the watch list:

```typescript
// After the project skills directory block (~line 197):
// Add project-root skills/ directory
const projectRootSkillsPath = platformPath.resolve('skills')
try {
  await fs.stat(projectRootSkillsPath)
  paths.push(projectRootSkillsPath)
} catch {
  // Path doesn't exist, skip it
}
```

**4. `src/utils/permissions/filesystem.ts`** (line 235)

Add the project-root skills dir to the permission check:

```typescript
const skillsDir = join(getOriginalCwd(), '.claude', 'skills')
const rootSkillsDir = join(getOriginalCwd(), 'skills')  // ADD
```

**5. `src/utils/sandbox/sandbox-adapter.ts`** (line 247)

Add sandbox write-block for the project-root `skills/` directory.

#### Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `src/skills/loadSkillsDir.ts` | Add `skills/` to `getSkillDirCommands()` and `discoverSkillDirsForPaths()` | ~15 lines |
| `src/utils/skills/skillChangeDetector.ts` | Watch `skills/` for hot-reload | ~8 lines |
| `src/utils/permissions/filesystem.ts` | Add permission rules for `skills/` | ~5 lines |
| `src/utils/sandbox/sandbox-adapter.ts` | Add sandbox block for `skills/` | ~3 lines |

### Approach B: Symlink (Zero Code Changes)

Create a symlink from `.claude/skills` to `skills/`:

```bash
cd locoagent
mkdir -p skills
rm -rf .claude/skills
ln -s ../skills .claude/skills
```

This works because `loadSkillsFromSkillsDir()` follows symlinks (`entry.isSymbolicLink()` is checked at line 425). The existing code handles symlinked directories transparently.

**Pros:** Zero code changes, immediate effect.
**Cons:** Requires symlink to be committed/maintained. On Windows, symlinks may require admin rights.

### Approach C: Replace `.claude/skills/` entirely

Modify `getSkillsPath()` to return `skills` instead of `.claude/skills` for project settings:

```typescript
case 'projectSettings':
  return dir   // 'skills' instead of '.claude/skills'
```

And modify `getProjectDirsUpToHome()` to use `skills/` instead of `.claude/skills/`.

**Pros:** Clean, single source.
**Cons:** Breaking change - all existing `.claude/skills/` stop working. Not recommended unless you never plan to use upstream `.claude/skills/` convention.

---

## Recommendation

**Use Approach B (symlink) for immediate results**, then implement **Approach A** for a proper solution when ready to modify code.

The symlink approach requires exactly one command:

```bash
cd /Users/jason/Projects/msj-locoremind/locoagent
mkdir -p skills
# Move existing skills from .claude/skills/ to skills/
cp -r .claude/skills/* skills/ 2>/dev/null || true
rm -rf .claude/skills
ln -s ../skills .claude/skills
```

After this, `locoagent/skills/x-com/SKILL.md` will be loaded as `/x-com` automatically. Both `locoagent/skills/` and `.claude/skills/` resolve to the same location.
