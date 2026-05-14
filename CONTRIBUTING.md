# Contributing to LocoAgent

Thank you for your interest in contributing to LocoAgent! We welcome contributions that help improve the agent's capabilities, reliability, and platform coverage.

---

## How to Contribute

### 1. Setup Development Environment

```bash
git clone https://github.com/LocoreMind/locoagent.git
cd locoagent
bun install
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Edit code
- Add/update tests
- Update documentation

### 4. Run Tests

```bash
# Manual testing
bun start --help
bun start --version

# Test with a simple task
bun start -p "open X.com and take a screenshot"
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: description of your changes"
```

**Commit message format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Pull Request Guidelines

### PR Description Must Include

1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How does it work?
4. **Testing** - What tests did you run?

### Example PR Description

```markdown
## What
Adds LinkedIn platform skill with 15+ operations

## Why
Users requested LinkedIn support for automated engagement

## How
- Created skills/linkedin/SKILL.md with operation playbooks
- Added navigation, engagement, and profile operations
- Tested with real LinkedIn sessions

## Testing
- [x] Manual testing with interactive mode
- [x] Verified all operations complete successfully
- [x] Tested edge cases (private profiles, rate limits)
```

---

## Key Contribution Areas

### New Platform Skills

Add playbooks for new social media platforms:

1. Create `skills/<platform>/SKILL.md`
2. Document all supported operations with step-by-step browser automation instructions
3. Include element selectors, navigation flows, and error handling
4. Test thoroughly with real browser sessions

### New Workflows

Add automated pipelines:

1. Create `workflows/<id>.json` (definition with config)
2. Create `workflows/executors/<script>.ts` (executor script)
3. Test with `bun run workflow run --id <id>`

### New Tools

Extend agent capabilities by adding tool implementations in `src/tools/`.

### Bug Fixes

Especially welcome in:
- Browser automation edge cases
- Platform-specific element selector changes
- Workflow execution reliability
- LLM provider compatibility

---

## Bug Reports

### Before Reporting

1. Check existing issues
2. Try with `--debug` flag
3. Check if the issue is platform-specific (e.g., X.com UI change)

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Run command...
2. See error...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: macOS/Linux/Windows
- Bun version:
- LocoAgent version:
- Browser: Chrome version
- Platform: X.com / LinkedIn / etc.

**Logs**
paste relevant logs here
```

---

## Feature Requests

### What We Welcome

- New platform skills (LinkedIn, Reddit, Bluesky, etc.)
- New workflow types
- Better browser automation reliability
- UI/UX enhancements for the trajectory monitor
- Performance optimizations
- Better error messages and recovery

### Feature Request Template

```markdown
**Feature Description**
Clear description of the feature

**Use Case**
Why is this needed?

**Implementation Ideas**
(Optional) How might this work?
```

---

## Code Review Process

### What Reviewers Check

1. **Functionality** - Does it work?
2. **Reliability** - Does it handle edge cases?
3. **Documentation** - Is it documented?
4. **Code quality** - Is it maintainable?

### Approval Requirements

- At least 1 maintainer approval
- All tests passing
- Documentation updated

---

## Development Principles

1. **Real Browser, Real Sessions** - Always operate through actual Chrome sessions
2. **Platform Skills First** - Encode platform knowledge as reusable playbooks
3. **Deduplication** - Always check the operation log before acting
4. **Simplicity** - Simple is better than complex
5. **Multi-Provider** - Support any LLM provider, don't lock in

---

## Questions?

- Open an issue for general questions
- Tag maintainers for urgent matters
- Read existing docs first

---

Thank you for helping make LocoAgent better!
