#!/bin/bash

# Find all .ts files in src/components that contain JSX and rename them to .tsx
find src/components -name "*.ts" -type f ! -name "*.d.ts" ! -name "index.ts" -exec grep -l "<[A-Z]" {} \; 2>/dev/null | while read file; do
    newfile="${file%.ts}.tsx"
    echo "Renaming: $file -> $newfile"
    mv "$file" "$newfile"
done

echo "Done! Renamed files with JSX from .ts to .tsx"
