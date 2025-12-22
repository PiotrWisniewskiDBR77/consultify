#!/bin/bash

# OAuth Configuration Verification Script
# Checks if OAuth providers are properly configured

echo "🔍 OAuth Configuration Status Check"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "📡 Checking if server is running..."
if curl -s http://localhost:3005/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server is running on port 3005"
else
    echo -e "${RED}✗${NC} Server is not running on port 3005"
    echo "   Please start the server with: npm run dev"
    exit 1
fi

echo ""
echo "🔐 Checking OAuth Configuration..."
echo ""

# Fetch OAuth status
OAUTH_STATUS=$(curl -s http://localhost:3005/api/auth/oauth/status)

# Parse JSON response (basic parsing without jq)
GOOGLE_CONFIGURED=$(echo "$OAUTH_STATUS" | grep -o '"google":[^}]*"configured":[^,}]*' | grep -o 'true\|false')
LINKEDIN_CONFIGURED=$(echo "$OAUTH_STATUS" | grep -o '"linkedin":[^}]*"configured":[^,}]*' | grep -o 'true\|false')

# Google OAuth Status
echo "📧 Google OAuth:"
if [ "$GOOGLE_CONFIGURED" = "true" ]; then
    echo -e "   ${GREEN}✓ Configured${NC}"
else
    echo -e "   ${RED}✗ Not configured${NC}"
    echo -e "   ${YELLOW}→${NC} Missing: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET"
fi

echo ""

# LinkedIn OAuth Status
echo "💼 LinkedIn OAuth:"
if [ "$LINKEDIN_CONFIGURED" = "true" ]; then
    echo -e "   ${GREEN}✓ Configured${NC}"
else
    echo -e "   ${RED}✗ Not configured${NC}"
    echo -e "   ${YELLOW}→${NC} Missing: LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET"
fi

echo ""
echo "===================================="

# Summary
if [ "$GOOGLE_CONFIGURED" = "true" ] && [ "$LINKEDIN_CONFIGURED" = "true" ]; then
    echo -e "${GREEN}✓ All OAuth providers are configured!${NC}"
    echo ""
    echo "🧪 Test OAuth flows:"
    echo "   1. Open http://localhost:3000"
    echo "   2. Click 'Continue with Google' or 'Continue with LinkedIn'"
    echo "   3. Complete the OAuth flow"
    exit 0
elif [ "$GOOGLE_CONFIGURED" = "true" ] || [ "$LINKEDIN_CONFIGURED" = "true" ]; then
    echo -e "${YELLOW}⚠️  Some OAuth providers are configured${NC}"
    echo ""
    echo "📖 To configure the remaining provider(s):"
    echo "   See OAUTH_SETUP_GUIDE.md for detailed instructions"
    exit 0
else
    echo -e "${RED}✗ No OAuth providers are configured${NC}"
    echo ""
    echo "📖 Next steps:"
    echo "   1. Read OAUTH_SETUP_GUIDE.md"
    echo "   2. Create OAuth apps on Google & LinkedIn"
    echo "   3. Add credentials to .env file"
    echo "   4. Restart the server"
    echo "   5. Run this script again to verify"
    exit 1
fi
