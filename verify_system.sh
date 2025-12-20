#!/bin/bash

# Configuration
API_URL="http://localhost:3000/api"
EMAIL="piotr.wisniewski@dbr77.com"
PASSWORD="password123" # Assuming standard password from seed or manual reset if needed. 
                       # NOTE: Seed file says '123456', I will try that.
PASSWORD="123456"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================="
echo "   Task & Execution System Verification Script   "
echo "================================================="

# 1. Login
echo -e "\n1. Logging in as $EMAIL..."
LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESP | jq -r '.token')
ORG_ID=$(echo $LOGIN_RESP | jq -r '.user.organizationId')
USER_ID=$(echo $LOGIN_RESP | jq -r '.user.id')

if [ "$TOKEN" == "null" ]; then
  echo -e "${RED}Login Failed!${NC} Response: $LOGIN_RESP"
  exit 1
fi
echo -e "${GREEN}Login Successful!${NC}"

# 2. Create Initiative
echo -e "\n2. Creating Test Initiative..."
INITIATIVE_PAYLOAD="{\"name\":\"Test Initiative $(date +%s)\", \"summary\":\"Automated Test\", \"strategicIntent\":\"Grow\", \"applicantOneLiner\":\"Test One Liner\", \"killCriteria\":\"Kill if fail\"}"
INIT_RESP=$(curl -s -X POST "$API_URL/initiatives" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$INITIATIVE_PAYLOAD")

INIT_ID=$(echo $INIT_RESP | jq -r '.id')
if [ "$INIT_ID" == "null" ]; then
  echo -e "${RED}Initiative Creation Failed!${NC} Response: $INIT_RESP"
  exit 1
fi
echo -e "${GREEN}Initiative Created: $INIT_ID${NC}"

# 3. Create Task (Standard Priority = weight 1.0)
echo -e "\n3. Creating Task A (Standard Priority)..."
TASK_A_PAYLOAD="{\"title\":\"Task A\", \"initiativeId\":\"$INIT_ID\", \"priority\":\"medium\", \"estimatedHours\":5}"
TASK_A_RESP=$(curl -s -X POST "$API_URL/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$TASK_A_PAYLOAD")
TASK_A_ID=$(echo $TASK_A_RESP | jq -r '.id')
echo -e "${GREEN}Task A Created: $TASK_A_ID${NC}"

# 4. Check Initiative Progress (Should be 0)
echo -e "\n4. Checking Initiative Progress (Expect 0)..."
CHECK_1=$(curl -s -X GET "$API_URL/initiatives/$INIT_ID" -H "Authorization: Bearer $TOKEN")
PROG_1=$(echo $CHECK_1 | jq -r '.progress')
echo "Progress: $PROG_1%"
if [ "$PROG_1" != "0" ]; then echo -e "${RED}FAIL: Expected 0%${NC}"; else echo -e "${GREEN}PASS${NC}"; fi

# 5. Update Task A to 50% manually
echo -e "\n5. Updating Task A Progress to 50%..."
UPD_A_RESP=$(curl -s -X PUT "$API_URL/tasks/$TASK_A_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"progress\": 50}")

# 6. Check Initiative Progress (Expect 50%)
# Logic: (50 * 1.0) / 1.0 = 50
echo -e "\n6. Checking Initiative Progress (Expect 50)..."
sleep 1 # Wait for async recalc
CHECK_2=$(curl -s -X GET "$API_URL/initiatives/$INIT_ID" -H "Authorization: Bearer $TOKEN")
PROG_2=$(echo $CHECK_2 | jq -r '.progress')
echo "Progress: $PROG_2%"
if [ "$PROG_2" != "50" ]; then echo -e "${RED}FAIL: Expected 50%${NC}"; else echo -e "${GREEN}PASS${NC}"; fi

# 7. Create Task B (High Priority = weight 1.5)
echo -e "\n7. Creating Task B (High Priority)..."
TASK_B_PAYLOAD="{\"title\":\"Task B\", \"initiativeId\":\"$INIT_ID\", \"priority\":\"high\", \"progress\":0}"
TASK_B_RESP=$(curl -s -X POST "$API_URL/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$TASK_B_PAYLOAD")
TASK_B_ID=$(echo $TASK_B_RESP | jq -r '.id')
echo -e "${GREEN}Task B Created: $TASK_B_ID${NC}"

# 8. Check Initiative Progress (Expect 20%)
# Logic: Task A (50 * 1.0) + Task B (0 * 1.5) = 50. Total Weight = 2.5. Result = 50 / 2.5 = 20.
echo -e "\n8. Checking Initiative Progress (Expect 20)..."
sleep 1
CHECK_3=$(curl -s -X GET "$API_URL/initiatives/$INIT_ID" -H "Authorization: Bearer $TOKEN")
PROG_3=$(echo $CHECK_3 | jq -r '.progress')
echo "Progress: $PROG_3%"
if [ "$PROG_3" != "20" ]; then echo -e "${RED}FAIL: Expected 20%${NC}"; else echo -e "${GREEN}PASS${NC}"; fi

# 9. Test Force Completion Logic
echo -e "\n9. Completing Task B (Setting Status=done)..."
# We do NOT send progress=100, we expect backend to force it
UPD_B_RESP=$(curl -s -X PUT "$API_URL/tasks/$TASK_B_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"done\"}")
TASK_B_PROG=$(echo $UPD_B_RESP | jq -r '.progress')

echo "Task B Result Progress: $TASK_B_PROG%"
if [ "$TASK_B_PROG" != "100" ]; then echo -e "${RED}FAIL: Backend did not force 100% progress!${NC}"; else echo -e "${GREEN}PASS: Progress forced to 100%${NC}"; fi

# 10. Check Initiative Progress (Expect 80%)
# Logic: Task A (50 * 1.0) + Task B (100 * 1.5) = 50 + 150 = 200. Total Weight = 2.5. Result = 200 / 2.5 = 80.
echo -e "\n10. Checking Initiative Progress (Expect 80)..."
sleep 1
CHECK_4=$(curl -s -X GET "$API_URL/initiatives/$INIT_ID" -H "Authorization: Bearer $TOKEN")
PROG_4=$(echo $CHECK_4 | jq -r '.progress')
echo "Progress: $PROG_4%"
if [ "$PROG_4" != "80" ]; then echo -e "${RED}FAIL: Expected 80%${NC}"; else echo -e "${GREEN}PASS${NC}"; fi

# 11. Test Blocked Validations
echo -e "\n11. Testing Blocked Validation (Without Reason)..."
BLOCK_FAIL_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API_URL/tasks/$TASK_A_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"blocked\", \"blockedReason\": \"\"}")

if [ "$BLOCK_FAIL_RESP" == "400" ]; then
    echo -e "${GREEN}PASS: Rejected with 400 as expected${NC}"
else
    echo -e "${RED}FAIL: Expected 400, got $BLOCK_FAIL_RESP${NC}"
fi

echo -e "\n12. Testing Blocked Validation (With Reason)..."
BLOCK_OK_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API_URL/tasks/$TASK_A_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"blocked\", \"blockedReason\": \"Waiting on vendor\"}")

if [ "$BLOCK_OK_RESP" == "200" ]; then
    echo -e "${GREEN}PASS: Accepted with 200${NC}"
else
    echo -e "${RED}FAIL: Expected 200, got $BLOCK_OK_RESP${NC}"
fi

# 13. Test Delete Recalculation
echo -e "\n13. Deleting Task B (High value task)..."
DEL_RESP=$(curl -s -X DELETE "$API_URL/tasks/$TASK_B_ID" \
  -H "Authorization: Bearer $TOKEN")

# 14. Check Initiative Progress (Expect 50%)
# Logic: Back to just Task A (50 * 1.0). Weight 1.0. Result 50.
# Note: Task A is now blocked, but progress is still 50 unless we froze it.
# The calculation should still use the stored progress.
echo -e "\n14. Checking Initiative Progress after Delete (Expect 50)..."
sleep 1
CHECK_5=$(curl -s -X GET "$API_URL/initiatives/$INIT_ID" -H "Authorization: Bearer $TOKEN")
PROG_5=$(echo $CHECK_5 | jq -r '.progress')
echo "Progress: $PROG_5%"
if [ "$PROG_5" != "50" ]; then echo -e "${RED}FAIL: Expected 50%${NC}"; else echo -e "${GREEN}PASS${NC}"; fi

echo -e "\n======================================="
echo -e "   Verification Complete   "
echo -e "======================================="
