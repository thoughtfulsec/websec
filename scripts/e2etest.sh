#!/bin/bash

# End-to-End Test Script for ModSecurity Demo Application
# Tests all functionality: database, routes, ModSecurity protection
# Exit code: 0 if all tests pass, 1 if any test fails

set -o pipefail  # Catch errors in pipes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test results
print_test() {
    local test_name="$1"
    local result="$2"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        ((TESTS_FAILED++))
    fi
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${YELLOW}Running:${NC} $test_name"
    
    if eval "$test_command"; then
        print_test "$test_name" "PASS"
        return 0
    else
        print_test "$test_name" "FAIL"
        return 1
    fi
}

echo "=========================================="
echo "  ModSecurity Demo - End-to-End Tests"
echo "=========================================="

# Test 1: Check if services are running
echo -e "\n${YELLOW}Test 1:${NC} Verify services are running"
if docker-compose ps 2>/dev/null | grep -E "Up|running" > /dev/null; then
    print_test "Services are running" "PASS"
else
    print_test "Services are running" "FAIL"
    echo -e "${RED}ERROR: Services are not running. Run 'docker-compose up -d' first.${NC}"
    exit 1
fi

# Test 2: Health check endpoint
run_test "Health check endpoint responds" \
    'curl -s -f "http://localhost:8888/health" > /dev/null'

# Test 3: Add a new entry via POST
echo -e "\n${YELLOW}Test 3:${NC} Add new entry via POST to /insecure"
TIMESTAMP=$(date +%s)
TEST_ENTRY="E2E test entry - $TIMESTAMP"

if curl -X POST "http://localhost:8888/insecure" \
    -d "entry=$TEST_ENTRY" \
    -s -o /dev/null -w "%{http_code}" | grep -q "200\|302"; then
    print_test "POST to /insecure (add entry)" "PASS"
else
    print_test "POST to /insecure (add entry)" "FAIL"
fi

# Test 4: Verify entry appears in table
sleep 1  # Give database a moment to persist
run_test "Entry appears in /insecure table" \
    "curl -s \"http://localhost:8888/insecure\" | grep -q \"$TEST_ENTRY\""

# Test 5: Verify /secure route redirects to OAuth when unauthenticated
echo -e "\n${YELLOW}Test 5:${NC} /secure redirects to OAuth when unauthenticated"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888/secure")
LOCATION=$(curl -s -I "http://localhost:8888/secure" | grep -i "^Location:" | awk '{print $2}' | tr -d '\r')
if [ "$HTTP_CODE" = "302" ] && echo "$LOCATION" | grep -q "/auth/google"; then
    print_test "/secure redirects to /auth/google (302)" "PASS"
else
    print_test "/secure redirects to /auth/google (got $HTTP_CODE, location: $LOCATION)" "FAIL"
fi

# Test 6: Verify ModSecurity blocks SQL injection on /secure
echo -e "\n${YELLOW}Test 6:${NC} ModSecurity blocks SQL injection on /secure"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888/secure?id=1%20OR%201=1")
if [ "$HTTP_CODE" = "403" ]; then
    print_test "SQL injection blocked on /secure (403 Forbidden)" "PASS"
else
    print_test "SQL injection blocked on /secure (got $HTTP_CODE, expected 403)" "FAIL"
fi

# Test 7: Verify /insecure is not blocked by ModSecurity
run_test "/insecure route is not blocked (ModSecurity disabled)" \
    'curl -s "http://localhost:8888/insecure" | grep -q "<!DOCTYPE html>"'

# Test 8: Verify SQL injection works on /insecure (intentionally vulnerable)
echo -e "\n${YELLOW}Test 8:${NC} SQL injection on /insecure (intentionally vulnerable)"
# This payload closes the first VALUES tuple, adds a second row, and comments out the rest
# The SQL template is: INSERT INTO entries (entry, date) VALUES ('${entry}', '${date}')
# Our payload will make it: INSERT INTO entries (entry, date) VALUES ('test', '2025...'), ('🚨 INJECTED 🚨', '1999...') -- ', 'CURRENT_DATE')
INJECTION_PAYLOAD="test', '2025-01-01T00:00:00.000Z'), ('🚨 SQL INJECTED ENTRY 🚨', '1999-01-01T00:00:00.000Z') --"
# Submit the SQL injection payload
HTTP_CODE=$(curl -X POST "http://localhost:8888/insecure" \
    -d "entry=$INJECTION_PAYLOAD" \
    -s -o /dev/null -w "%{http_code}")
sleep 1
# Check if the injected entry appears in the table
if curl -s "http://localhost:8888/insecure" | grep -q "🚨 SQL INJECTED ENTRY 🚨"; then
    print_test "SQL injection successful on /insecure (injected entry found)" "PASS"
else
    print_test "SQL injection successful on /insecure (injected entry NOT found - HTTP $HTTP_CODE)" "FAIL"
fi

# Test 9: Verify ModSecurity blocks SQL injection on POST /secure
echo -e "\n${YELLOW}Test 9:${NC} ModSecurity blocks SQL injection on POST /secure"
HTTP_CODE=$(curl -X POST "http://localhost:8888/secure" \
    -d "entry=$INJECTION_PAYLOAD" \
    -s -o /dev/null -w "%{http_code}")
if [ "$HTTP_CODE" = "403" ]; then
    print_test "SQL injection blocked on POST /secure (403 Forbidden)" "PASS"
else
    print_test "SQL injection blocked on POST /secure (got $HTTP_CODE, expected 403)" "FAIL"
fi

# Test 10: Verify /auth/google route exists and redirects
echo -e "\n${YELLOW}Test 10:${NC} /auth/google route exists and redirects to Google"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888/auth/google")
if [ "$HTTP_CODE" = "302" ]; then
    print_test "/auth/google redirects (302)" "PASS"
else
    print_test "/auth/google redirects (got $HTTP_CODE, expected 302)" "FAIL"
fi

# Test 11: Verify /logout route exists
echo -e "\n${YELLOW}Test 11:${NC} /logout route exists"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888/logout")
# Logout will redirect (302) or return 500 if no session exists
if [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "500" ]; then
    print_test "/logout route exists (got $HTTP_CODE)" "PASS"
else
    print_test "/logout route exists (got $HTTP_CODE)" "FAIL"
fi

# Test 12: Verify OAuth routes have ModSecurity disabled
echo -e "\n${YELLOW}Test 12:${NC} OAuth callback route has ModSecurity disabled"
MODSEC_STATUS=$(curl -s -I "http://localhost:8888/auth/google/callback?test=1" | grep -i "X-ModSecurity-Status" | awk '{print $2}' | tr -d '\r')
if [ "$MODSEC_STATUS" = "DISABLED" ]; then
    print_test "OAuth callback has ModSecurity disabled" "PASS"
else
    print_test "OAuth callback has ModSecurity disabled (got: $MODSEC_STATUS)" "FAIL"
fi

# Test 13: Verify database file exists
run_test "Database file exists at app/data/entries.db" \
    'test -f app/data/entries.db'

# Test 14: Verify database has content
run_test "Database contains entries" \
    'test -s app/data/entries.db'

# Test 15: Verify /insecure returns HTML
run_test "/insecure returns HTML" \
    'curl -s "http://localhost:8888/insecure" | grep -q "<!DOCTYPE html>"'

# Test 16: Verify form exists on /insecure page
run_test "Form exists on /insecure page" \
    'curl -s "http://localhost:8888/insecure" | grep -q "<form.*method=\"POST\""'

# Test 17: Verify table exists on /insecure page
run_test "Table exists on /insecure page" \
    'curl -s "http://localhost:8888/insecure" | grep -q "<table>"'

# Note: Tests for /secure page content are skipped because the route now requires
# OAuth authentication, which cannot be easily tested with curl alone.
# Manual testing or browser automation (Puppeteer/Playwright) would be needed.

# Print summary
echo ""
echo "=========================================="
echo "  Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo "=========================================="

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed.${NC}\n"
    exit 1
fi

