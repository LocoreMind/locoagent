# CLAUDE.md → AGENT.md Rebranding Analysis

Phase 2 of the LocoAgent rebranding. This document maps every file and identifier that references `CLAUDE.md`, `CLAUDE.local.md`, `claudeMd`, `.claude/` directory, and related env vars / telemetry events.

---

## 1. String Literal References: `CLAUDE.md` / `CLAUDE.local.md` / `CLAUDE_MD`

**64 files** contain these string literals.

### 1.1 Core / Entry Point Files

| File | Notes |
|------|-------|
| `src/utils/claudemd.ts` | **Primary file** — all CLAUDE.md loading logic, env var handling, telemetry |
| `src/context.ts` | Context builder reads CLAUDE.md files |
| `src/main.tsx` | Startup, loads CLAUDE.md |
| `src/Tool.ts` | Tool definitions reference CLAUDE.md |
| `src/setup.ts` | Setup flow references CLAUDE.md |

### 1.2 Command Files

| File | Notes |
|------|-------|
| `src/commands/init.ts` | `/init` command — creates CLAUDE.md files |
| `src/commands/insights.ts` | References CLAUDE.md in insights |
| `src/commands/commit-push-pr.ts` | References CLAUDE.md for commit context |
| `src/commands/memory/memory.tsx` | Memory management references CLAUDE.md |
| `src/commands/add-dir/add-dir.tsx` | Directory addition references CLAUDE.md |

### 1.3 Component Files

| File | Notes |
|------|-------|
| `src/components/ClaudeMdExternalIncludesDialog.tsx` | **File rename needed** — dialog for external CLAUDE.md includes |
| `src/components/memory/MemoryFileSelector.tsx` | Memory file selector references CLAUDE.md |
| `src/components/Settings/Config.tsx` | Settings UI references CLAUDE.md |
| `src/components/TrustDialog/utils.ts` | Trust dialog references .claude/ and CLAUDE.md |

### 1.4 Utility Files

| File | Notes |
|------|-------|
| `src/utils/config.ts` | Config handling references CLAUDE.md |
| `src/utils/hooks.ts` | Hook utilities reference CLAUDE.md |
| `src/utils/permissions/yoloClassifier.ts` | Permission classifier references CLAUDE.md env vars |
| `src/utils/frontmatterParser.ts` | Parses CLAUDE.md frontmatter |
| `src/utils/analyzeContext.ts` | Context analysis references CLAUDE.md |
| `src/utils/markdownConfigLoader.ts` | Loads markdown config files including CLAUDE.md |
| `src/utils/status.tsx` | Status display references CLAUDE.md |
| `src/utils/api.ts` | API utils reference CLAUDE.md |

### 1.5 Tool Files

| File | Notes |
|------|-------|
| `src/tools/AgentTool/built-in/claudeCodeGuideAgent.ts` | Guide agent references CLAUDE.md |
| `src/tools/FileEditTool/FileEditTool.ts` | File edit tool references CLAUDE.md |
| `src/tools/FileWriteTool/FileWriteTool.ts` | File write tool references CLAUDE.md |
| `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts` | Worktree tool references CLAUDE.md |
| `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts` | Exit worktree references CLAUDE.md |

### 1.6 Skill Files

| File | Notes |
|------|-------|
| `src/skills/bundled/remember.ts` | Remember skill references CLAUDE.md |
| `src/skills/loadSkillsDir.ts` | Skill loader references CLAUDE.md |
| `src/skills/bundled/updateConfig.ts` | Config update skill references .claude/ |

### 1.7 Service Files

| File | Notes |
|------|-------|
| `src/services/MagicDocs/prompts.ts` | MagicDocs prompts reference CLAUDE.md |
| `src/services/SessionMemory/prompts.ts` | Session memory prompts reference CLAUDE.md |
| `src/services/settingsSync/` | Settings sync references CLAUDE.md |
| `src/services/teamMemorySync/index.ts` | Team memory sync references CLAUDE.md |
| `src/services/compact/compact.ts` | Compact service references CLAUDE.md |

### 1.8 Bridge / Integration Files

| File | Notes |
|------|-------|
| `src/bridge/workSecret.ts` | Work secret bridge references CLAUDE.md |
| `src/bridge/replBridge.ts` | REPL bridge references CLAUDE.md |
| `src/bridge/bridgePointer.ts` | Bridge pointer references CLAUDE.md |

### 1.9 Other Files

| File | Notes |
|------|-------|
| `src/memdir/memdir.ts` | Memory directory references CLAUDE.md |
| `src/utils/permissions/filesystem.ts` | Filesystem permissions (29 occurrences of .claude/) |
| Various test files | Test assertions reference CLAUDE.md |

---

## 2. Variable / Function Name References: `claudeMd` / `claude_md` / `claudemd`

**46 files** contain these identifier patterns. Key identifiers to rename:

### 2.1 Functions / Exports

```
loadClaudeMd()           → loadAgentMd()
parseClaudeMd()          → parseAgentMd()
getClaudeMdContent()     → getAgentMdContent()
claudeMdPermissionCheck  → agentMdPermissionCheck
claudeMdExternalIncludes → agentMdExternalIncludes
```

### 2.2 Variables / Types

```
claudeMd                 → agentMd
claudeMdContent          → agentMdContent
claudeMdPath             → agentMdPath
claudeMdFiles            → agentMdFiles
claudeLocalMd            → agentLocalMd
claudeMdEnabled          → agentMdEnabled
```

### 2.3 File Renames Required

| Current | New |
|---------|-----|
| `src/utils/claudemd.ts` | `src/utils/agentmd.ts` |
| `src/components/ClaudeMdExternalIncludesDialog.tsx` | `src/components/AgentMdExternalIncludesDialog.tsx` |

---

## 3. `.claude/` Directory References

**342 occurrences** across **120 files**.

### 3.1 Top Files by Occurrence Count

| File | Count | Notes |
|------|-------|-------|
| `src/utils/permissions/filesystem.ts` | 29 | Permission rules for .claude/ directory |
| `src/utils/claudemd.ts` | 20 | CLAUDE.md loading from .claude/ paths |
| `src/components/TrustDialog/utils.ts` | 14 | Trust dialog checks .claude/ |
| `src/commands/init.ts` | 9 | /init creates .claude/ directory |
| `src/utils/markdownConfigLoader.ts` | 8 | Loads configs from .claude/ |
| `src/skills/bundled/updateConfig.ts` | 8 | Updates config in .claude/ |
| `src/tools/BashTool/pathValidation.ts` | 7 | Path validation for .claude/ |
| `src/main.tsx` | 7 | Main entry references .claude/ |
| `src/utils/plugins/marketplaceManager.ts` | 7 | Plugin marketplace uses .claude/ |
| `src/utils/settings/types.ts` | 6 | Settings types reference .claude/ |

### 3.2 Decision: Rename `.claude/` → `.locoagent/` or keep?

**RECOMMENDATION: Keep `.claude/` for now** — reasons:

1. **342 occurrences across 120 files** — enormous scope of change
2. `.claude/` contains `settings.json`, `settings.local.json`, `skills/`, `rules/`, MCP config — many users have existing configurations
3. The directory name is not visible in user-facing UI (it's a hidden dotdir)
4. Breaking backward compatibility with existing project configs is high risk
5. Can be done as a separate phase with migration logic

**Alternative approach:** Add `.locoagent/` as an alias that takes precedence, falling back to `.claude/` for backward compatibility.

---

## 4. Environment Variables

**3 files** reference CLAUDE.md-specific env vars:

| Env Var | Files | Action |
|---------|-------|--------|
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | `src/utils/claudemd.ts`, `src/context.ts` | Rename → `LOCOAGENT_DISABLE_AGENT_MDS` (keep old as fallback) |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | `src/utils/claudemd.ts`, `src/utils/permissions/yoloClassifier.ts` | Rename → `LOCOAGENT_ADDITIONAL_DIRECTORIES_AGENT_MD` (keep old as fallback) |

---

## 5. Telemetry Events

**2 files** contain `tengu_claude_md` telemetry:

| File | Event |
|------|-------|
| `src/utils/claudemd.ts` | `tengu_claude_md_permission_error` |
| `src/components/ClaudeMdExternalIncludesDialog.tsx` | `tengu_claude_md_permission_error` |

**Action:** Rename to `tengu_agent_md_permission_error` or similar.

---

## 6. Execution Plan

### Phase 2a: File Content Changes (CLAUDE.md → AGENT.md strings)

1. **`src/utils/claudemd.ts`** — Replace all `CLAUDE.md` → `AGENT.md`, `CLAUDE.local.md` → `AGENT.local.md` string literals
2. **`src/commands/init.ts`** — Update /init command to create AGENT.md instead of CLAUDE.md
3. **`src/context.ts`** — Update context builder references
4. **All 64 files** — Systematic string replacement

### Phase 2b: Variable / Function / Type Renames

1. **`src/utils/claudemd.ts`** — Rename all `claudeMd*` identifiers to `agentMd*`
2. **All 46 files** — Update all `claudeMd` / `claude_md` variable references

### Phase 2c: File Renames

1. `src/utils/claudemd.ts` → `src/utils/agentmd.ts`
2. `src/components/ClaudeMdExternalIncludesDialog.tsx` → `src/components/AgentMdExternalIncludesDialog.tsx`
3. Update all import paths across the codebase

### Phase 2d: Env Vars

1. Add new env var names with fallback to old ones
2. Update all references in 3 files

### Phase 2e: Telemetry

1. Update telemetry event names in 2 files

### Phase 2f: `.claude/` Directory (DEFERRED)

1. Keep `.claude/` for now
2. Future: Add `.locoagent/` as preferred path with `.claude/` fallback

---

## 7. Risk Assessment

| Change | Risk | Scope |
|--------|------|-------|
| String literals `CLAUDE.md` → `AGENT.md` | Medium — users may have existing CLAUDE.md files | 64 files |
| Variable renames `claudeMd` → `agentMd` | Low — internal only | 46 files |
| File renames | Low — internal only | 2 files + all importers |
| Env var renames | Medium — external API | 3 files |
| `.claude/` directory | **HIGH** — breaks existing configs | 120 files, 342 occurrences |
| Telemetry events | Low — internal analytics | 2 files |
