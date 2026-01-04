#!/usr/bin/env python3
"""
Script to automatically migrate wrapper routes from createRequire to lazy-loaded ES modules
"""

import os
import re
from pathlib import Path
from typing import Optional

ROUTES_DIR = Path("server/src/routes")
TEMPLATE = '''/**
 * {name} Routes
 * API endpoints for {name}
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import {{ createLazyRoute }} from '../utils/lazyRouteLoader.js';

const router = createLazyRoute('{js_path}');

export default router;
'''

def extract_js_path(content: str) -> Optional[str]:
    """Extract JS path from require() call"""
    match = re.search(r"require\('(../../routes/[^']+\.js)'\)", content)
    if match:
        return match.group(1)
    return None

def get_route_name(filepath: Path) -> str:
    """Get route name from filename"""
    name = filepath.stem.replace('.routes', '')
    # Convert kebab-case to TitleCase
    return ''.join(word.capitalize() for word in name.split('-'))

def migrate_file(filepath: Path) -> bool:
    """Migrate a single route file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if it's a simple wrapper
        if 'createRequire' not in content and 'require(' not in content:
            return False
        
        # Extract JS path
        js_path = extract_js_path(content)
        if not js_path:
            print(f"⚠️  Could not extract JS path from {filepath.name}")
            return False
        
        # Generate new content
        route_name = get_route_name(filepath)
        new_content = TEMPLATE.format(name=route_name, js_path=js_path)
        
        # Write new content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Migrated {filepath.name}")
        return True
    except Exception as e:
        print(f"❌ Error migrating {filepath.name}: {e}")
        return False

def main():
    """Main migration function"""
    if not ROUTES_DIR.exists():
        print(f"❌ Routes directory not found: {ROUTES_DIR}")
        return
    
    migrated = 0
    skipped = 0
    errors = 0
    
    for filepath in sorted(ROUTES_DIR.glob("*.routes.ts")):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip if already migrated
            if 'createLazyRoute' in content:
                skipped += 1
                continue
            
            # Migrate if it's a wrapper
            if 'createRequire' in content or 'require(' in content:
                if migrate_file(filepath):
                    migrated += 1
                else:
                    errors += 1
        except Exception as e:
            print(f"❌ Error processing {filepath.name}: {e}")
            errors += 1
    
    print(f"\n📊 Migration Summary:")
    print(f"   ✅ Migrated: {migrated}")
    print(f"   ⏭️  Skipped: {skipped}")
    print(f"   ❌ Errors: {errors}")

if __name__ == "__main__":
    main()

