#!/bin/bash
# Seed Notifications for Testing
# Run: ./server/scripts/seed-notifications.sh

cd "$(dirname "$0")/../.."

DB="server/consultinity.db"

# Get user ID
USER_ID=$(sqlite3 "$DB" "SELECT id FROM users WHERE email='piotr.wisniewski@dbr77.com' LIMIT 1;")

if [ -z "$USER_ID" ]; then
    echo "❌ User piotr.wisniewski@dbr77.com not found"
    exit 1
fi

echo "👤 Found user: $USER_ID"

# Clear existing notifications
echo "🗑️  Clearing existing notifications..."
sqlite3 "$DB" "DELETE FROM notifications WHERE user_id='$USER_ID';"

# Generate UUIDs (simplified - using timestamp-based IDs)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
TODAY=$(date -u +"%Y-%m-%d")
YESTERDAY=$(date -v-1d +"%Y-%m-%d" 2>/dev/null || date -d "yesterday" +"%Y-%m-%d")
TWO_DAYS_AGO=$(date -v-2d +"%Y-%m-%d" 2>/dev/null || date -d "2 days ago" +"%Y-%m-%d")
THREE_DAYS_AGO=$(date -v-3d +"%Y-%m-%d" 2>/dev/null || date -d "3 days ago" +"%Y-%m-%d")
WEEK_AGO=$(date -v-7d +"%Y-%m-%d" 2>/dev/null || date -d "7 days ago" +"%Y-%m-%d")

echo "📝 Inserting test notifications..."

# Function to insert notification
insert_notification() {
    local TYPE="$1"
    local TITLE="$2"
    local MESSAGE="$3"
    local SEVERITY="$4"
    local SCOPE="$5"
    local PROJECT="$6"
    local READ="$7"
    local DATE="$8"
    local RELATED_TYPE="$9"
    
    local ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "notif-$(date +%s)-$RANDOM")
    local DATA="{\"severity\":\"$SEVERITY\",\"scope\":\"$SCOPE\",\"projectName\":\"$PROJECT\",\"relatedObjectType\":\"$RELATED_TYPE\"}"
    
    sqlite3 "$DB" "INSERT INTO notifications (id, user_id, type, severity, title, message, data, related_object_type, is_read, created_at) VALUES ('$ID', '$USER_ID', '$TYPE', '$SEVERITY', '$TITLE', '$MESSAGE', '$DATA', '$RELATED_TYPE', $READ, '${DATE}T09:00:00.000Z');"
    echo "   ✅ $TITLE"
}

# Critical notifications (today, unread)
insert_notification "TASK_OVERDUE" "⚠️ Zadanie przeterminowane: Przygotuj prezentację Q1" "Zadanie miało termin 2 dni temu. Wymaga natychmiastowej uwagi." "CRITICAL" "PROJECT" "Digital Transformation" 0 "$TODAY" "TASK"

insert_notification "DECISION_REQUIRED" "🔔 Wymagana decyzja: Wybór dostawcy chmury" "Czekasz na zatwierdzenie decyzji. Termin: jutro." "WARNING" "PROJECT" "Cloud Migration" 0 "$TODAY" "DECISION"

# Yesterday (unread)
insert_notification "AI_RECOMMENDATION" "🤖 AI wykryło możliwość optymalizacji" "AI sugeruje przegrupowanie priorytetów w projekcie ERP Upgrade." "INFO" "PROJECT" "ERP Upgrade" 0 "$YESTERDAY" "INITIATIVE"

insert_notification "TASK_ASSIGNED" "📋 Nowe zadanie: Przegląd dokumentacji API" "Anna Kowalska przypisała Ci nowe zadanie." "INFO" "PROJECT" "Integration Hub" 0 "$YESTERDAY" "TASK"

# 2 days ago (unread)
insert_notification "GATE_PENDING_APPROVAL" "🚧 Bramka Stage Gate wymaga zatwierdzenia" "Inicjatywa HR Automation oczekuje na Twoje zatwierdzenie." "WARNING" "PROJECT" "HR Automation" 0 "$TWO_DAYS_AGO" "GATE"

# Older (read)
insert_notification "AI_RISK_DETECTED" "⚡ AI wykryło potencjalne ryzyko" "Możliwe opóźnienie w projekcie Data Lake z powodu braku zasobów." "WARNING" "PROJECT" "Data Lake" 1 "$THREE_DAYS_AGO" "PROJECT"

insert_notification "PERSONAL_REMINDER" "⏰ Przypomnienie: Spotkanie zespołu" "Za 30 minut rozpoczyna się cotygodniowe spotkanie." "INFO" "PERSONAL" "" 1 "$THREE_DAYS_AGO" ""

insert_notification "INITIATIVE_UPDATE" "📊 Aktualizacja inicjatywy: ML Pipeline" "Postęp wzrósł do 75%." "INFO" "PROJECT" "ML Platform" 1 "$THREE_DAYS_AGO" "INITIATIVE"

insert_notification "TASK_BLOCKED" "🚫 Zadanie zablokowane" "Brak dostępu do VPN blokuje konfigurację środowiska." "WARNING" "PROJECT" "Security Upgrade" 1 "$WEEK_AGO" "TASK"

insert_notification "SYSTEM_UPDATE" "🔄 Aktualizacja systemu" "Nowa wersja platformy Consultinity jest dostępna." "INFO" "SYSTEM" "" 1 "$WEEK_AGO" ""

echo ""
echo "🎉 Done! Inserted 10 test notifications"
echo "🔄 Refresh your browser to see the notifications"
