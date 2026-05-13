# LocoAgent TUI Rebranding Analysis

Current state: The TUI interface retains the original Claude Code orange theme and "Claude Code" branding throughout. This document maps every file and location that needs modification to rebrand to **LocoAgent**.

---

## 1. Branding / Project Name Locations

### 1.1 MACRO Globals (`stubs/globals.ts`)

The build-time preload defines all branding strings:

```typescript
// stubs/globals.ts:34-42
MACRO = {
  VERSION: '2.0.0',
  PACKAGE_URL: '@anthropic-ai/claude-code',            // -> '@locoreagent/locoagent' or similar
  NATIVE_PACKAGE_URL: '@anthropic-ai/claude-code-native',
  FEEDBACK_CHANNEL: 'https://github.com/anthropics/claude-code/issues',  // -> your repo
  ISSUES_EXPLAINER: 'Report issues at https://github.com/anthropics/claude-code/issues',
  VERSION_CHANGELOG: '',
}
```

**Action:** Update `PACKAGE_URL`, `NATIVE_PACKAGE_URL`, `FEEDBACK_CHANNEL`, `ISSUES_EXPLAINER` to LocoAgent values.

### 1.2 System Prompt (`src/constants/prompts.ts`)

Multiple hardcoded "Claude Code" references:

| Line | Current Text | Context |
|------|-------------|---------|
| 217 | `/help: Get help with using Claude Code` | Help text |
| 822 | `You are Claude Code, Anthropic's official CLI for Claude.` | System prompt identity |
| 1074 | `Claude Code is available as a CLI in the terminal...` | Info text |
| 1077 | `Fast mode for Claude Code uses the same...` | Fast mode description |
| 1133 | `You are an agent for Claude Code, Anthropic's official CLI...` | Agent prompt (DEFAULT_AGENT_PROMPT) |

**Action:** Replace all "Claude Code" with "LocoAgent" (or your preferred display name). Update the identity description.

### 1.3 Logo / Welcome Screen

#### `src/components/LogoV2/LogoV2.tsx`

- **Line 251:** `color("claude", userTheme)("Claude Code")` - border title text
- **Line 252:** `color("claude", userTheme)(" Claude Code ")` - compact border title
- Uses `borderColor="claude"` for the logo border (theme key, not the text)

#### `src/components/LogoV2/CondensedLogo.tsx`

- **Line 91:** `<Text bold={true}>Claude Code</Text>` - condensed logo title

#### `src/components/LogoV2/WelcomeV2.tsx`

- **Line 12, 31, 116:** `"Welcome to Claude Code"` - welcome message text
- Uses `color="claude"` for the welcome text color (theme key)

**Action:** Replace all "Claude Code" strings with "LocoAgent". The `color="claude"` is a theme key (see section 2) and should be renamed if you want clean semantics.

### 1.4 Clawd Mascot (`src/components/LogoV2/Clawd.tsx`, `AnimatedClawd.tsx`)

The ASCII art mascot uses `clawd_body` and `clawd_background` theme colors. Currently renders the Claude mascot character. If you want a different mascot, these files need redesign.

---

## 2. Theme Color System (`src/utils/theme.ts`)

This is the **core file** defining all theme colors. The "orange" you see is the `claude` theme key.

### 2.1 The `claude` Color Key

The `claude` key is the primary brand color used for:
- Logo border (`borderColor="claude"`)
- Logo title text (`color("claude", ...)`)
- Welcome message color
- Internal dividers (`borderColor="claude"`)
- Brief mode label (`briefLabelClaude`)

**Current values across all 6 themes:**

| Theme | `claude` value | Description |
|-------|---------------|-------------|
| `dark` | `rgb(215,119,87)` | **Claude orange** |
| `light` | `rgb(215,119,87)` | Same orange |
| `dark-daltonized` | `rgb(255,153,51)` | Adjusted orange |
| `light-daltonized` | `rgb(255,153,51)` | Adjusted orange |
| `dark-ansi` | `ansi:redBright` | Terminal red-bright (approximation) |
| `light-ansi` | `ansi:redBright` | Terminal red-bright |

### 2.2 Related Orange / Claude-branded Colors

| Theme Key | dark value | Purpose |
|-----------|-----------|---------|
| `claude` | `rgb(215,119,87)` | Primary brand color |
| `claudeShimmer` | `rgb(235,159,127)` | Loading shimmer effect |
| `claudeBlue_FOR_SYSTEM_SPINNER` | `rgb(147,165,255)` | System spinner (not orange, blue) |
| `claudeBlueShimmer_FOR_SYSTEM_SPINNER` | `rgb(177,195,255)` | Spinner shimmer |
| `clawd_body` | `rgb(215,119,87)` | Mascot body color |
| `clawd_background` | `rgb(0,0,0)` | Mascot background |
| `briefLabelClaude` | `rgb(215,119,87)` | Brief mode "Claude" label |

### 2.3 Theme Type Definition (line 1-89)

The `Theme` type has **89 color keys**. The following are Claude-branded:

```typescript
claude: string
claudeShimmer: string
claudeBlue_FOR_SYSTEM_SPINNER: string
claudeBlueShimmer_FOR_SYSTEM_SPINNER: string
clawd_body: string
clawd_background: string
briefLabelClaude: string
```

**Action:** Either:
- **(A) Rename keys** (e.g., `claude` -> `brand`, `clawd_body` -> `mascot_body`) - requires updating all consumers
- **(B) Keep keys, change values** - simpler, just change the RGB values in all 6 theme definitions

### 2.4 Full Theme Color Change Locations

If changing the `claude` key color, these values must be updated in **all 6 themes** within `src/utils/theme.ts`:

| Theme | Lines |
|-------|-------|
| `lightTheme` | 115-191 |
| `lightAnsiTheme` | 197-272 |
| `darkAnsiTheme` | 278-353 |
| `lightDaltonizedTheme` | 359-434 |
| `darkTheme` | 440-515 |
| `darkDaltonizedTheme` | 521-596 |

---

## 3. Design System Files

### 3.1 `src/components/design-system/color.ts`

This is a **helper function**, not a color definition file. It resolves theme keys to actual colors. No hardcoded colors here. No changes needed unless you rename theme keys.

### 3.2 `src/components/design-system/ThemeProvider.tsx`

Theme context provider. No hardcoded colors or branding. No changes needed.

---

## 4. Summary: Complete Change Manifest

### Files to modify:

| # | File | Changes |
|---|------|---------|
| 1 | `stubs/globals.ts` | MACRO branding strings (5 values) |
| 2 | `src/utils/theme.ts` | `claude`, `claudeShimmer`, `clawd_body`, `briefLabelClaude` colors in all 6 themes (24+ values) |
| 3 | `src/constants/prompts.ts` | "Claude Code" -> "LocoAgent" in system prompts (~5 locations) |
| 4 | `src/components/LogoV2/LogoV2.tsx` | "Claude Code" text in border titles (2 locations) |
| 5 | `src/components/LogoV2/CondensedLogo.tsx` | "Claude Code" text (1 location) |
| 6 | `src/components/LogoV2/WelcomeV2.tsx` | "Welcome to Claude Code" (3 locations) |
| 7 | `src/components/LogoV2/Clawd.tsx` | Mascot art (optional - only if replacing mascot) |
| 8 | `src/components/LogoV2/AnimatedClawd.tsx` | Animated mascot (optional) |

### Optional (semantic cleanup):

| # | File | Changes |
|---|------|---------|
| 9 | `src/utils/theme.ts` type definition | Rename `claude` -> `brand`, `clawd_*` -> `mascot_*` |
| 10 | All consumers of `color="claude"` | Update to new key name |
| 11 | All consumers of `clawd_body`/`clawd_background` | Update to new key name |

---

## 5. Recommended New Theme Color

The current `claude` orange is `rgb(215,119,87)`. For LocoAgent, consider:

| Option | Color | Hex | Feel |
|--------|-------|-----|------|
| **Teal/Cyan** | `rgb(0,180,170)` | `#00B4AA` | Tech, AI, clean |
| **Electric Blue** | `rgb(59,130,246)` | `#3B82F6` | Professional, modern |
| **Emerald** | `rgb(16,185,129)` | `#10B981` | Growth, intelligence |
| **Indigo** | `rgb(99,102,241)` | `#636EF1` | Deep tech, premium |
| **Purple** | `rgb(139,92,246)` | `#8B5CF6` | Creative AI |

Each would need a corresponding `Shimmer` variant (typically +30-40 lightness).
