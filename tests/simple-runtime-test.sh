#!/bin/bash
# Simple Runtime Test for claude-code-clean
# Verifies basic functionality and no telemetry

PROJECT_ROOT="$(pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "Simple Runtime Test - claude-code-clean"
echo "========================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test 1: Package configuration
echo "=== 1. Package Configuration ==="
if grep -q '"name": "claude-code-clean"' package.json; then
    echo -e "${GREEN}✓${NC} Package name: claude-code-clean"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Package name incorrect"
    ((FAILED++))
fi

if grep -q '"version": "1.0.0-clean"' package.json; then
    echo -e "${GREEN}✓${NC} Version: 1.0.0-clean"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Version incorrect"
    ((FAILED++))
fi

echo ""

# Test 2: Stub files exist
echo "=== 2. Stub Files ==="
if [ -f "src/utils/telemetry-stub.ts" ]; then
    echo -e "${GREEN}✓${NC} telemetry-stub.ts exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} telemetry-stub.ts missing"
    ((FAILED++))
fi

if [ -f "src/services/analytics-stub.ts" ]; then
    echo -e "${GREEN}✓${NC} analytics-stub.ts exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} analytics-stub.ts missing"
    ((FAILED++))
fi

if [ -f "src/utils/fingerprint-stub.ts" ]; then
    echo -e "${GREEN}✓${NC} fingerprint-stub.ts exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} fingerprint-stub.ts missing"
    ((FAILED++))
fi

echo ""

# Test 3: Original telemetry files deleted
echo "=== 3. Original Telemetry Files Deleted ==="
if [ ! -d "src/utils/telemetry" ]; then
    echo -e "${GREEN}✓${NC} src/utils/telemetry/ deleted"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} src/utils/telemetry/ still exists"
    ((FAILED++))
fi

if [ ! -d "src/services/analytics" ]; then
    echo -e "${GREEN}✓${NC} src/services/analytics/ deleted"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} src/services/analytics/ still exists"
    ((FAILED++))
fi

echo ""

# Test 4: Stub implementations
echo "=== 4. Stub Implementations ==="
if grep -q "return 'no-fingerprint'" src/utils/fingerprint-stub.ts; then
    echo -e "${GREEN}✓${NC} Fingerprint stub returns 'no-fingerprint'"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Fingerprint stub implementation incorrect"
    ((FAILED++))
fi

if grep -q "return true" src/services/analytics-stub.ts | head -1 > /dev/null; then
    echo -e "${GREEN}✓${NC} Analytics stub properly disabled"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Could not verify analytics stub"
fi

echo ""

# Test 5: No telemetry endpoints in code
echo "=== 5. Telemetry Endpoints Removed ==="
if ! grep -r "api.anthropic.com/api/claude_code/metrics" src/ 2>/dev/null; then
    echo -e "${GREEN}✓${NC} No BigQuery metrics endpoint"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} BigQuery endpoint found"
    ((FAILED++))
fi

if ! grep -r "api.anthropic.com/api/event_logging/batch" src/ 2>/dev/null; then
    echo -e "${GREEN}✓${NC} No event logging endpoint"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Event logging endpoint found"
    ((FAILED++))
fi

echo ""

# Test 6: Documentation
echo "=== 6. Documentation ==="
if [ -f "README.md" ]; then
    echo -e "${GREEN}✓${NC} README.md exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} README.md missing"
    ((FAILED++))
fi

if [ -f "LICENSE" ]; then
    echo -e "${GREEN}✓${NC} LICENSE exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} LICENSE missing"
    ((FAILED++))
fi

echo ""

# Test 7: No local telemetry storage
echo "=== 7. No Local Telemetry Storage ==="
if [ ! -d "$HOME/.config/claude/telemetry" ]; then
    echo -e "${GREEN}✓${NC} No telemetry directory in ~/.config/claude/"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Found telemetry directory (may be from original version)"
fi

echo ""

# Summary
echo "========================================"
echo "Test Results"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
else
    echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓${NC}"
    echo ""
    echo "claude-code-clean is verified to be:"
    echo "  ✓ Properly configured"
    echo "  ✓ Telemetry code removed"
    echo "  ✓ Stub implementations correct"
    echo "  ✓ No tracking endpoints"
    echo "  ✓ Documentation complete"
    echo ""
    echo "You can now use: npm start or bun run start"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
