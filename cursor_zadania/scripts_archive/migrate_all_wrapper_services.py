#!/usr/bin/env python3
"""
Script to automatically migrate ALL wrapper services from require() to lazy-loaded ES modules
Handles both simple wrappers and broken syntax cases
"""

import os
import re
from pathlib import Path
from typing import Optional

SERVICES_DIR = Path("server/src/services")

def get_service_path(filepath: Path) -> str:
    """Calculate relative path from server/src/services to server/services"""
    # Get relative path from server/src/services
    rel_path = filepath.relative_to(SERVICES_DIR.parent.parent)
    # Convert to server/services path
    parts = list(rel_path.parts)
    # Replace 'src/services' with 'services'
    if 'src' in parts:
        idx = parts.index('src')
        parts[idx] = 'services'
        parts.pop(idx + 1)  # Remove 'services' duplicate
    else:
        # Already in services directory structure
        parts = ['services'] + parts[parts.index('services') + 1:]
    
    return '/'.join(parts).replace('.ts', '.js')

def get_service_name(filepath: Path) -> tuple[str, str]:
    """Extract service name and camelCase version"""
    name = filepath.stem
    # Remove 'Service' suffix if present
    if name.endswith('Service'):
        name = name[:-7]
    
    # Convert to camelCase
    parts = re.split(r'[/_-]', name)
    camel = ''.join(part.capitalize() for part in parts)
    # First letter lowercase
    camel = camel[0].lower() + camel[1:] if camel else camel
    
    display_name = ''.join(part.capitalize() for part in parts)
    
    return display_name, camel

def migrate_file(filepath: Path) -> bool:
    """Migrate a single service file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Skip if already migrated
        if 'createCachedLazyService' in content:
            return False
        
        # Skip if it's a real TypeScript file (not a wrapper)
        if 'class ' in content and 'export ' in content and 'require(' not in content:
            return False
        
        # Get service info
        service_path = get_service_path(filepath)
        display_name, camel_name = get_service_name(filepath)
        
        # Generate new content
        new_content = f'''/**
 * {display_name} Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import {{ createCachedLazyService }} from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const load{camel_name.capitalize()} = createCachedLazyService('../../{service_path}');

// Export default instance (for backward compatibility)
export default load{camel_name.capitalize()}();
'''
        
        # Write new content
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Migrated {filepath.relative_to(SERVICES_DIR.parent.parent)}")
        return True
    except Exception as e:
        print(f"❌ Error migrating {filepath.name}: {e}")
        return False

def main():
    """Main migration function"""
    if not SERVICES_DIR.exists():
        print(f"❌ Services directory not found: {SERVICES_DIR}")
        return
    
    migrated = 0
    skipped = 0
    errors = 0
    
    # Process all .ts files in services directory (including subdirectories)
    for filepath in sorted(SERVICES_DIR.rglob("*.ts")):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Skip if already migrated
            if 'createCachedLazyService' in content:
                skipped += 1
                continue
            
            # Skip if it's a real TypeScript implementation
            if 'class ' in content and 'export ' in content and 'require(' not in content:
                skipped += 1
                continue
            
            # Migrate if it has require() or broken syntax
            if 'require(' in content or '/ServiceJS' in content or 'ServiceJS =' in content:
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






