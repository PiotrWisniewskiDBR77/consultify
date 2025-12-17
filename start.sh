#!/bin/bash
# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in your PATH."
    echo "Please install Node.js and npm from https://nodejs.org/"
    exit 1
fi

echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully."
    echo "Starting application..."
    npm run dev
else
    echo "Error installing dependencies. Please check the logs."
    exit 1
fi
