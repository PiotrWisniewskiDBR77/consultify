#!/bin/bash

# Script to help setup LinkedIn OAuth credentials
# Usage: ./scripts/setup-linkedin-oauth.sh

echo "🔗 Konfiguracja LinkedIn OAuth dla Consultify"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Plik .env nie istnieje. Tworzenie...${NC}"
    touch .env
    echo "# Environment variables" >> .env
    echo "" >> .env
fi

echo -e "${BLUE}📝 Podaj dane dostępowe z LinkedIn Developers:${NC}"
echo ""
echo "1. Przejdź na: https://www.linkedin.com/developers/apps"
echo "2. Wybierz swoją aplikację (lub utwórz nową)"
echo "3. Przejdź do zakładki 'Auth'"
echo "4. Skopiuj Client ID i Client Secret"
echo ""

# Get Client ID
read -p "Wklej LINKEDIN_CLIENT_ID: " CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
    echo -e "${YELLOW}⚠️  Client ID jest pusty. Pomijam...${NC}"
    exit 1
fi

# Get Client Secret
read -p "Wklej LINKEDIN_CLIENT_SECRET: " CLIENT_SECRET
if [ -z "$CLIENT_SECRET" ]; then
    echo -e "${YELLOW}⚠️  Client Secret jest pusty. Pomijam...${NC}"
    exit 1
fi

# Default callback URL
CALLBACK_URL="http://localhost:3005/api/auth/linkedin/callback"
read -p "Callback URL [$CALLBACK_URL]: " USER_CALLBACK_URL
CALLBACK_URL=${USER_CALLBACK_URL:-$CALLBACK_URL}

echo ""
echo -e "${BLUE}📝 Dodawanie zmiennych do pliku .env...${NC}"

# Remove existing LinkedIn entries
sed -i.bak '/^LINKEDIN_CLIENT_ID=/d' .env
sed -i.bak '/^LINKEDIN_CLIENT_SECRET=/d' .env
sed -i.bak '/^LINKEDIN_CALLBACK_URL=/d' .env
rm -f .env.bak

# Add new entries
echo "" >> .env
echo "# OAuth: LinkedIn" >> .env
echo "LINKEDIN_CLIENT_ID=$CLIENT_ID" >> .env
echo "LINKEDIN_CLIENT_SECRET=$CLIENT_SECRET" >> .env
echo "LINKEDIN_CALLBACK_URL=$CALLBACK_URL" >> .env

echo ""
echo -e "${GREEN}✅ Konfiguracja zapisana!${NC}"
echo ""
echo "📋 Dodane zmienne:"
echo "   LINKEDIN_CLIENT_ID=$CLIENT_ID"
echo "   LINKEDIN_CLIENT_SECRET=${CLIENT_SECRET:0:10}..."
echo "   LINKEDIN_CALLBACK_URL=$CALLBACK_URL"
echo ""
echo "🔄 Następne kroki:"
echo "   1. Uruchom ponownie serwer: npm run dev"
echo "   2. Sprawdź konfigurację: ./scripts/check-linkedin-oauth.sh"
echo "   3. Przetestuj logowanie przez LinkedIn w aplikacji"
echo ""















