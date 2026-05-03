# Contributing to Claude Code Clean

Thank you for your interest in contributing! This project maintains a strict **privacy-first** philosophy.

---

## 🔒 Privacy Guidelines

### ❌ Absolutely Prohibited

The following will **never** be accepted:

1. **Telemetry/Analytics**
   - No data collection
   - No usage tracking
   - No event logging to external services
   - No user identification

2. **Fingerprinting**
   - No device fingerprinting
   - No environment tracking
   - No user profiling
   - No unique identifiers

3. **Auto-Updates**
   - No automatic downloads
   - No remote version enforcement
   - No kill switches
   - No forced updates

4. **Remote Control**
   - No remote configuration
   - No feature flags from servers
   - No A/B testing
   - No server-side policy enforcement

### ✅ Always Required

All contributions must:

1. **Respect Privacy**
   - No new network requests (except Claude API)
   - All behavior user-controlled
   - No hidden functionality

2. **Pass Tests**
   ```bash
   ./tests/verify-privacy.sh
   ./tests/simple-runtime-test.sh
   ```

3. **Document Changes**
   - Clear commit messages
   - Update relevant documentation
   - Explain any new dependencies

---

## 🚀 How to Contribute

### 1. Setup Development Environment

```bash
git clone https://github.com/YOUR_USERNAME/claude-code-clean.git
cd claude-code-clean
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
# Privacy verification
./tests/verify-privacy.sh

# Runtime tests
./tests/simple-runtime-test.sh

# Manual testing
bun start --help
bun start --version
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

## 📝 Pull Request Guidelines

### PR Description Must Include

1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How does it work?
4. **Privacy Impact** - Does it affect privacy? How?
5. **Testing** - What tests did you run?

### Example PR Description

```markdown
## What
Adds support for custom system prompts via CLI flag

## Why
Users requested ability to customize system behavior without editing files

## How
- Added --system-prompt flag
- Reads from file or inline string
- No default prompt tracking

## Privacy Impact
✅ No privacy impact
- No data sent to servers
- All processing local
- User-provided data only

## Testing
- [x] ./tests/verify-privacy.sh (passed)
- [x] ./tests/simple-runtime-test.sh (passed)
- [x] Manual testing with various prompts
```

---

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues
2. Run privacy tests to verify it's not a telemetry issue
3. Try with `--debug` flag

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
- Bun version: 1.3.5
- Claude Code Clean version: 1.0.0-clean

**Privacy Check**
- [ ] Ran ./tests/verify-privacy.sh
- [ ] No telemetry-related errors

**Logs**
```
paste relevant logs here
```
```

---

## 💡 Feature Requests

### What We'll Consider

✅ **Privacy-respecting features:**
- Better offline support
- Local caching improvements
- UI/UX enhancements
- Performance optimizations
- Better error messages

❌ **What we won't add:**
- Any telemetry/analytics
- Cloud sync features
- Usage tracking
- Auto-updates
- Remote configuration

### Feature Request Template

```markdown
**Feature Description**
Clear description of the feature

**Use Case**
Why is this needed?

**Privacy Impact**
How does this affect privacy?

**Implementation Ideas**
(Optional) How might this work?
```

---

## 🔍 Code Review Process

### What Reviewers Check

1. **Privacy compliance** - No tracking code
2. **Functionality** - Does it work?
3. **Tests** - Do tests pass?
4. **Documentation** - Is it documented?
5. **Code quality** - Is it maintainable?

### Approval Requirements

- At least 1 maintainer approval
- All tests passing
- No privacy violations
- Documentation updated

---

## 🧪 Testing Guidelines

### Required Tests

1. **Privacy Tests**
   ```bash
   ./tests/verify-privacy.sh
   ```
   Must show 100% pass rate

2. **Runtime Tests**
   ```bash
   ./tests/simple-runtime-test.sh
   ```

3. **Manual Testing**
   - Test with `bun start --help`
   - Test with actual API calls (if applicable)
   - Test error cases

### Adding New Tests

If your PR adds new functionality:

1. Add test cases to `tests/verify-privacy.sh`
2. Document test procedures in `TESTING.md`
3. Show test results in PR description

---

## 📖 Documentation

### What to Document

- New features
- Changed behavior
- New configuration options
- Breaking changes

### Where to Document

- `README.md` - Overview and getting started
- `PRIVACY_README.md` - Privacy-related changes
- `TESTING.md` - Test procedures
- Code comments - Implementation details

---

## 🎯 Development Principles

1. **Privacy First** - No compromises
2. **User Control** - User decides everything
3. **Transparency** - No hidden behavior
4. **Simplicity** - Simple is better
5. **Offline-First** - Work without internet (except API calls)

---

## ❓ Questions?

- Open an issue for general questions
- Tag maintainers for urgent matters
- Read existing docs first

---

## 🙏 Thank You!

Every contribution helps make Claude Code Clean better for everyone.

Your commitment to privacy is appreciated! 🔒
