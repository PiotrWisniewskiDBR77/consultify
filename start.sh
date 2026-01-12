#!/bin/bash
# Consultify Local Startup Script
# This script prepares and starts the application for local development

set -e  # Exit on error

echo "=========================================="
echo "Consultify - Local Startup"
echo "=========================================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed or not in your PATH."
    echo "Please install Node.js and npm from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js version should be >= 18.x (current: $(node -v))"
    echo "Consider upgrading: https://nodejs.org/"
fi

# Check for .env.local file
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo "⚠️  Warning: No .env.local or .env file found!"
    echo "Creating .env.local from template..."
    echo ""
    echo "# Consultify Environment Variables" > .env.local
    echo "NODE_ENV=development" >> .env.local
    echo "PORT=3005" >> .env.local
    echo "FRONTEND_URL=http://localhost:3000" >> .env.local
    echo "DB_TYPE=sqlite" >> .env.local
    echo "SQLITE_PATH=./server/consultify.db" >> .env.local
    echo "REDIS_URL=redis://localhost:6379" >> .env.local
    echo "MOCK_REDIS=false" >> .env.local
    echo "JWT_SECRET=supersecretkey_change_this_in_production" >> .env.local
    echo "GEMINI_API_KEY=your_gemini_api_key_here" >> .env.local
    echo ""
    echo "📝 Created .env.local - Please configure it with your API keys!"
    echo "   See LOCAL_SETUP.md for detailed instructions."
    echo ""
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
echo ""

# Check if server has its own package.json
if [ -f "server/package.json" ]; then
    echo "Installing backend dependencies..."
    cd server
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        npm install
    else
        echo "Backend dependencies already installed (skipping)"
    fi
    cd ..
else
    echo "No separate server/package.json found (using root dependencies)"
fi

echo "Installing frontend dependencies..."
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    npm install
else
    echo "Frontend dependencies already installed (skipping)"
fi

# Check database
echo ""
echo "🔍 Checking database configuration..."
if grep -q "DB_TYPE=sqlite" .env.local 2>/dev/null || grep -q "DB_TYPE=sqlite" .env 2>/dev/null; then
    echo "✓ Using SQLite database (will be created automatically)"
elif grep -q "DB_TYPE=postgres" .env.local 2>/dev/null || grep -q "DB_TYPE=postgres" .env 2>/dev/null; then
    echo "✓ Using PostgreSQL database"
    if ! command -v psql &> /dev/null; then
        echo "⚠️  Warning: psql not found. Make sure PostgreSQL is running."
    fi
fi

# Check Redis (optional)
if grep -q "MOCK_REDIS=true" .env.local 2>/dev/null || grep -q "MOCK_REDIS=true" .env 2>/dev/null; then
    echo "✓ Redis disabled (MOCK_REDIS=true)"
else
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping &> /dev/null; then
            echo "✓ Redis is running"
        else
            echo "⚠️  Warning: Redis not responding. Set MOCK_REDIS=true to disable."
        fi
    else
        echo "⚠️  Warning: redis-cli not found. Set MOCK_REDIS=true if Redis is not available."
    fi
fi

# Start application
echo ""
echo "=========================================="
echo "🚀 Starting Consultify..."
echo "=========================================="
echo ""
echo "Frontend will be available at: http://localhost:3000"
echo "Backend API will be available at: http://localhost:3005"
echo ""
echo "Press Ctrl+C to stop the application"
echo ""

npm run dev
