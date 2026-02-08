#!/bin/bash
# Fix DBR77 Credentials - ALWAYS sets correct passwords and roles
# 
# Usage: ./server/scripts/fix-dbr77-credentials.sh
# Or:    npm run fix:credentials

cd "$(dirname "$0")/../.."

# Pick the SQLite DB to operate on:
# - Prefer SQLITE_PATH env (matches dev server)
# - Else default to repo dev DB
# - Else fallback to legacy server/consultinity.db if present
DB_PATH="${SQLITE_PATH:-}"
if [ -z "$DB_PATH" ]; then
  if [ -f "data/dev/consultinity.db" ]; then
    DB_PATH="data/dev/consultinity.db"
  elif [ -f "server/consultinity.db" ]; then
    DB_PATH="server/consultinity.db"
  else
    echo "❌ No SQLite DB found. Set SQLITE_PATH or create data/dev/consultinity.db"
    exit 1
  fi
fi

# Generate bcrypt hash for password '123456'
HASH='$2b$10$E58rGuDyiRBMosPDXp1bdu9PyFmpJ5VctXem3Zk0GYLlJv49ADUJm'

echo "🔧 Fixing DBR77 Credentials..."
echo "   DB: $DB_PATH"
echo ""

# Ensure DBR77 org exists (needed for login)
sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES ('org-dbr77-system', 'DBR77', 'full', 'active');"
sqlite3 "$DB_PATH" "UPDATE organizations SET name='DBR77', plan='full', status='active' WHERE id='org-dbr77-system';"

# Fix superadmin
sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name) VALUES ('user-admin-dbr77', 'org-dbr77-system', 'admin@dbr77.com', '$HASH', 'SUPERADMIN', 'active', 'Admin', 'DBR77');"
sqlite3 "$DB_PATH" "UPDATE users SET password='$HASH', role='SUPERADMIN', organization_id='org-dbr77-system', status='active' WHERE email='admin@dbr77.com';"
echo "   ✅ admin@dbr77.com → SUPERADMIN (password: 123456)"

# Fix piotr
sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name) VALUES ('user-piotr-dbr77', 'org-dbr77-system', 'piotr.wisniewski@dbr77.com', '$HASH', 'ADMIN', 'active', 'Piotr', 'Wiśniewski');"
sqlite3 "$DB_PATH" "UPDATE users SET password='$HASH', role='ADMIN', organization_id='org-dbr77-system', status='active' WHERE email='piotr.wisniewski@dbr77.com';"
echo "   ✅ piotr.wisniewski@dbr77.com → ADMIN (password: 123456)"

echo ""
echo "=================================================="
echo "✅ Credentials fixed!"
echo "=================================================="
echo ""
echo "📋 Login accounts:"
echo "   ┌─────────────────────────────────────────────┐"
echo "   │ SUPERADMIN: admin@dbr77.com / 123456        │"
echo "   │ ADMIN:      piotr.wisniewski@dbr77.com / 123456 │"
echo "   └─────────────────────────────────────────────┘"
echo ""
