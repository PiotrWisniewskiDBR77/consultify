#!/bin/bash
# Check for potential case-sensitivity issues that would fail in Docker/Linux
# This script checks for imports that might have case mismatches

set -e

echo "🔍 Checking for potential case-sensitivity issues..."

cd "$(dirname "$0")/.."

# Find all TypeScript imports that reference files with different casing
# This is a heuristic check - actual case issues won't show on macOS filesystem

issues=0

# Check for imports that might have case issues
# Look for patterns like: import from './ai/aiPipeline' vs './ai/AIPipeline'
grep -r "from.*['\"]\.\/.*[a-z].*[A-Z]" src/ --include="*.ts" --include="*.tsx" | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    import_path=$(echo "$line" | grep -o "from ['\"][^'\"]*['\"]" | sed "s/from ['\"]//" | sed "s/['\"]//")
    
    # Check if the import path contains mixed case that might be problematic
    if echo "$import_path" | grep -q "[a-z].*[A-Z]\|[A-Z].*[a-z]"; then
        # Extract the filename part
        filename=$(basename "$import_path" .js)
        filename_ts="${filename}.ts"
        
        # Check if file exists (case-insensitive on macOS, but we're checking for warnings)
        if [ ! -f "src/$import_path" ] && [ ! -f "src/${import_path%.js}.ts" ]; then
            echo "⚠️  Potential case-sensitivity issue in $file:"
            echo "   Import: $import_path"
            echo "   (This might fail on case-sensitive filesystems)"
            issues=$((issues + 1))
        fi
    fi
done

if [ $issues -eq 0 ]; then
    echo "✅ No obvious case-sensitivity issues found"
else
    echo ""
    echo "⚠️  Found $issues potential case-sensitivity issues"
    echo "   (These may not be errors on macOS but could fail in Docker/Linux)"
fi

exit 0
