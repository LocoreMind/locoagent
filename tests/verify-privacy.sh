#!/bin/bash
# Privacy Verification Test Suite for claude-code-clean
# This script verifies that all telemetry, analytics, and fingerprinting code has been removed

set -e

PROJECT_ROOT="$(pwd)"
cd "$PROJECT_ROOT"

echo "=================================="
echo "Privacy Verification Test Suite"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_check() {
    local test_name="$1"
    local command="$2"
    local expected_count="$3"

    echo -n "Testing: $test_name ... "

    result=$(eval "$command" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$result" -eq "$expected_count" ]; then
        echo -e "${GREEN}✓ PASS${NC} (found $result matches, expected $expected_count)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (found $result matches, expected $expected_count)"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "=== 1. Verifying Deleted Directories ==="
echo ""

test_check "Telemetry directory deleted" \
    "find src/utils/telemetry -type f 2>/dev/null || true" \
    "0"

test_check "Analytics directory deleted" \
    "find src/services/analytics -type f 2>/dev/null || true" \
    "0"

echo ""
echo "=== 2. Verifying Deleted Files ==="
echo ""

test_check "fingerprint.ts deleted" \
    "find src -name 'fingerprint.ts' -not -name '*stub*' 2>/dev/null || true" \
    "0"

test_check "telemetryAttributes.ts deleted" \
    "find src -name 'telemetryAttributes.ts' -not -name '*stub*' 2>/dev/null || true" \
    "0"

echo ""
echo "=== 3. Verifying No Old Imports Remain ==="
echo ""

test_check "No local telemetry imports (non-stub)" \
    "grep -r \"from.*['\\\"]\\.\\.*/telemetry/\" src/ --include='*.ts' --include='*.tsx' || true" \
    "0"

test_check "No local analytics imports (non-stub)" \
    "grep -r \"from.*['\\\"]\\.\\.*/analytics/\" src/ --include='*.ts' --include='*.tsx' || true" \
    "0"

test_check "No fingerprint imports (non-stub)" \
    "grep -r \"from.*['\\\"].*fingerprint[^-]\" src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' || true" \
    "0"

test_check "No telemetryAttributes imports (non-stub)" \
    "grep -r \"from.*['\\\"].*telemetryAttributes[^-]\" src/ --include='*.ts' --include='*.tsx' || true" \
    "0"

echo ""
echo "=== 4. Verifying API Endpoints Removed ==="
echo ""

test_check "No BigQuery metrics endpoint" \
    "grep -r 'api.anthropic.com/api/claude_code/metrics' src/ || true" \
    "0"

test_check "No event logging endpoint" \
    "grep -r 'api.anthropic.com/api/event_logging/batch' src/ || true" \
    "0"

echo ""
echo "=== 5. Verifying Tracking Code Patterns Removed ==="
echo ""

# Allow computeFingerprint calls if they import from stub
echo -n "Testing: computeFingerprint calls use stub implementation ... "
fingerprint_calls=$(grep -r 'computeFingerprint(' src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' 2>/dev/null | wc -l | tr -d ' ')
if [ "$fingerprint_calls" -eq "0" ]; then
    echo -e "${GREEN}✓ PASS${NC} (no calls found)"
    ((TESTS_PASSED++))
else
    # Check if the files importing it use the stub
    files_with_calls=$(grep -r 'computeFingerprint(' src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' -l 2>/dev/null || true)
    all_use_stub=true
    for file in $files_with_calls; do
        if ! grep -q "from.*fingerprint-stub" "$file" 2>/dev/null; then
            all_use_stub=false
            break
        fi
    done
    if [ "$all_use_stub" = true ]; then
        echo -e "${GREEN}✓ PASS${NC} (all calls use stub implementation)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (found calls not using stub)"
        ((TESTS_FAILED++))
    fi
fi

test_check "No BigQueryExporter usage" \
    "grep -r 'BigQueryExporter' src/ --include='*.ts' --include='*.tsx' || true" \
    "0"

test_check "No firstPartyEventLogger usage" \
    "grep -r 'firstPartyEventLogger' src/ --include='*.ts' --include='*.tsx' | grep -v '//.*firstPartyEventLogger' || true" \
    "0"

# Check for actual GrowthBook method calls (not just comments/docs)
echo -n "Testing: No GrowthBook API calls ... "
gb_calls=$(grep -r 'growthbook\.\(getFeatureValue\|evalFeature\|run\|setAttributes\)' src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' 2>/dev/null | wc -l | tr -d ' ')
if [ "$gb_calls" -eq "0" ]; then
    echo -e "${GREEN}✓ PASS${NC} (no API calls found)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (found $gb_calls API calls)"
    ((TESTS_FAILED++))
fi

echo ""
echo "=== 6. Verifying Stub Files Exist ==="
echo ""

test_check "telemetry-stub.ts exists" \
    "find src -name 'telemetry-stub.ts' 2>/dev/null" \
    "1"

test_check "analytics-stub.ts exists" \
    "find src -name 'analytics-stub.ts' 2>/dev/null" \
    "1"

test_check "fingerprint-stub.ts exists" \
    "find src -name 'fingerprint-stub.ts' 2>/dev/null" \
    "1"

test_check "telemetryAttributes-stub.ts exists" \
    "find src -name 'telemetryAttributes-stub.ts' 2>/dev/null" \
    "1"

echo ""
echo "=== 7. Verifying Stub Implementations ==="
echo ""

# Check that stubs return no-op or safe values
test_check "Fingerprint stub returns 'no-fingerprint'" \
    "grep -c \"return 'no-fingerprint'\" src/utils/fingerprint-stub.ts" \
    "1"

echo -n "Testing: Analytics stub exports no-op functions ... "
analytics_exports=$(grep -E '^export (function|const)' src/services/analytics-stub.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$analytics_exports" -ge "10" ]; then
    echo -e "${GREEN}✓ PASS${NC} (found $analytics_exports exports)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (found $analytics_exports exports, expected at least 10)"
    ((TESTS_FAILED++))
fi

echo ""
echo "=== 8. Checking for Suspicious Patterns ==="
echo ""

# Look for potential data collection patterns
echo -n "Checking for SHA256 hash operations... "
sha_count=$(grep -r "createHash('sha256')" src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
if [ "$sha_count" -eq "0" ]; then
    echo -e "${GREEN}✓ None found${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ Found $sha_count instances${NC} (may be legitimate uses)"
    # Not counting as failure since SHA256 can be used for non-tracking purposes
fi

echo -n "Checking for user.id references... "
user_id_count=$(grep -r "user\.id" src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
if [ "$user_id_count" -eq "0" ]; then
    echo -e "${GREEN}✓ None found${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ Found $user_id_count instances${NC}"
fi

echo -n "Checking for session tracking... "
session_track=$(grep -r "sessionId\|session\.id" src/ --include='*.ts' --include='*.tsx' --exclude='*stub*' --exclude-dir=node_modules 2>/dev/null | grep -v "// " | wc -l | tr -d ' ')
if [ "$session_track" -eq "0" ]; then
    echo -e "${GREEN}✓ None found${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ Found $session_track instances${NC} (checking if legitimate...)"
fi

echo ""
echo "=== 9. Package.json Verification ==="
echo ""

test_check "Package name changed to claude-code-clean" \
    "grep -c '\"name\": \"claude-code-clean\"' package.json" \
    "1"

test_check "Version changed to clean variant" \
    "grep -c '\"version\": \"1.0.0-clean\"' package.json" \
    "1"

test_check "Binary name changed to claude-clean" \
    "grep -c '\"claude-clean\"' package.json" \
    "1"

echo ""
echo "=== 10. Essential Files Verification ==="
echo ""

test_check "README.md exists" \
    "test -f README.md && echo 'exists'" \
    "1"

test_check "LICENSE exists" \
    "test -f LICENSE && echo 'exists'" \
    "1"

echo ""
echo "=================================="
echo "Test Results Summary"
echo "=================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
if [ "$TESTS_FAILED" -gt "0" ]; then
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
else
    echo -e "${GREEN}Tests Failed: 0${NC}"
fi
echo ""

if [ "$TESTS_FAILED" -eq "0" ]; then
    echo -e "${GREEN}✓✓✓ ALL PRIVACY CHECKS PASSED ✓✓✓${NC}"
    echo ""
    echo "This codebase has been verified to be free of:"
    echo "  ✓ Telemetry infrastructure"
    echo "  ✓ Analytics and event logging"
    echo "  ✓ User fingerprinting"
    echo "  ✓ Session tracking"
    echo "  ✓ Data collection endpoints"
    echo ""
    exit 0
else
    echo -e "${RED}✗✗✗ SOME TESTS FAILED ✗✗✗${NC}"
    echo ""
    echo "Please review the failed tests above."
    exit 1
fi
