#!/bin/bash

# Script to check LinkedIn OAuth configuration
# Usage: ./scripts/check-linkedin-oauth.sh

echo "🔍 Sprawdzanie konfiguracji LinkedIn OAuth..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Plik .env nie istnieje!${NC}"
    echo "   Utwórz plik .env w głównym katalogu projektu."
    exit 1
fi

echo -e "${GREEN}✅ Plik .env istnieje${NC}"
echo ""

# Check LinkedIn variables
LINKEDIN_CLIENT_ID=$(grep -E "^LINKEDIN_CLIENT_ID=" .env | cut -d '=' -f2 | tr -d ' ' | tr -d '"')
LINKEDIN_CLIENT_SECRET=$(grep -E "^LINKEDIN_CLIENT_SECRET=" .env | cut -d '=' -f2 | tr -d ' ' | tr -d '"')
LINKEDIN_CALLBACK_URL=$(grep -E "^LINKEDIN_CALLBACK_URL=" .env | cut -d '=' -f2 | tr -d ' ' | tr -d '"')

echo "📋 Sprawdzanie zmiennych środowiskowych:"
echo ""

if [ -z "$LINKEDIN_CLIENT_ID" ]; then
    echo -e "${RED}❌ LINKEDIN_CLIENT_ID nie jest ustawione${NC}"
else
    echo -e "${GREEN}✅ LINKEDIN_CLIENT_ID: ${LINKEDIN_CLIENT_ID:0:10}...${NC}"
fi

if [ -z "$LINKEDIN_CLIENT_SECRET" ]; then
    echo -e "${RED}❌ LINKEDIN_CLIENT_SECRET nie jest ustawione${NC}"
else
    echo -e "${GREEN}✅ LINKEDIN_CLIENT_SECRET: ${LINKEDIN_CLIENT_SECRET:0:10}...${NC}"
fi

if [ -z "$LINKEDIN_CALLBACK_URL" ]; then
    echo -e "${YELLOW}⚠️  LINKEDIN_CALLBACK_URL nie jest ustawione (użyje domyślnej wartości)${NC}"
else
    echo -e "${GREEN}✅ LINKEDIN_CALLBACK_URL: $LINKEDIN_CALLBACK_URL${NC}"
fi

echo ""
echo "🌐 Sprawdzanie statusu OAuth przez API..."

# Check if server is running
if curl -s http://localhost:3005/api/auth/oauth/status > /dev/null 2>&1; then
    echo ""
    echo "📊 Status OAuth:"
    curl -s http://localhost:3005/api/auth/oauth/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3005/api/auth/oauth/status
    
    LINKEDIN_STATUS=$(curl -s http://localhost:3005/api/auth/oauth/status | grep -o '"linkedin":[^}]*"configured":[^,}]*' | grep -o 'true\|false')
    
    echo ""
    if [ "$LINKEDIN_STATUS" = "true" ]; then
        echo -e "${GREEN}✅ LinkedIn OAuth jest skonfigurowane i działa!${NC}"
    else
        echo -e "${RED}❌ LinkedIn OAuth nie jest skonfigurowane${NC}"
        echo "   Sprawdź logi serwera i upewnij się, że zmienne środowiskowe są poprawne."
    fi
else
    echo -e "${YELLOW}⚠️  Serwer nie działa na porcie 3005${NC}"
    echo "   Uruchom serwer za pomocą: npm run dev"
fi

echo ""
echo "📝 Następne kroki:"
echo "   1. Jeśli wszystko jest ✅, możesz przetestować logowanie przez LinkedIn"
echo "   2. Otwórz http://localhost:3000 i kliknij przycisk 'LinkedIn' w formularzu logowania"
echo "   3. Jeśli masz problemy, sprawdź przewodnik: LINKEDIN_OAUTH_SETUP.md"






