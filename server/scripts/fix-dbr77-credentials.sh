#!/bin/bash
# Fix DBR77 Credentials - ALWAYS sets correct passwords and roles
# 
# Usage: ./server/scripts/fix-dbr77-credentials.sh
# Or:    npm run fix:credentials

cd "$(dirname "$0")/../.."

# Generate bcrypt hash for password '123456'
HASH='$2b$10$E58rGuDyiRBMosPDXp1bdu9PyFmpJ5VctXem3Zk0GYLlJv49ADUJm'

echo "🔧 Fixing DBR77 Credentials..."
echo ""

# Fix superadmin
sqlite3 server/consultinity.db "UPDATE users SET password='$HASH', role='SUPERADMIN' WHERE email='admin@dbr77.com';"
echo "   ✅ admin@dbr77.com → SUPERADMIN (password: 123456)"

# Fix piotr
sqlite3 server/consultinity.db "UPDATE users SET password='$HASH', role='ADMIN' WHERE email='piotr.wisniewski@dbr77.com';"
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
