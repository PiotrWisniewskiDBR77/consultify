#!/usr/bin/env python3
"""
Script to automatically migrate wrapper services from verbose wrappers to lazy-loaded ES modules
"""

import os
import re
from pathlib import Path
from typing import Optional

SERVICES_DIR = Path("server/src/services")
TEMPLATE = '''/**
 * {name} Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Lazy-loaded ES module wrapper for backward compatibility during migration
 */

import {{ createCachedLazyService }} from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const load{name_camel} = createCachedLazyService('../../services/{js_name}.js');

// Export default instance (for backward compatibility)
export default load{name_camel}();
'''

def extract_service_name(filepath: Path) -> tuple[str, str]:
    """Extract service name from filepath"""
    name = filepath.stem
    # Convert to camelCase for function name
    parts = name.split('_')
    camel = ''.join(part.capitalize() for part in parts)
    return name, camel

def is_simple_wrapper(content: str) -> bool:
    """Check if file is a simple wrapper that can be auto-migrated"""
    # Check for the pattern: cache, promise, load function, export default
    has_cache = 'Cache' in content or 'cache' in content
    has_promise = 'Promise' in content or 'promise' in content
    has_load_function = 'load' in content.lower() and 'function' in content.lower()
    has_export_default = 'export default' in content
    has_dynamic_import = 'import(' in content
    
    # Simple wrapper pattern: has cache/promise pattern and dynamic import
    return (has_cache or has_promise) and has_dynamic_import and has_export_default

def migrate_file(filepath: Path) -> bool:
    """Migrate a single service file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Skip if already migrated
        if 'createCachedLazyService' in content:
            return False
        
        # Skip if not a simple wrapper
        if not is_simple_wrapper(content):
            return False
        
        # Extract service name
        service_name, camel_name = extract_service_name(filepath)
        
        # Generate new content
        new_content = TEMPLATE.format(
            name=service_name.replace('Service', '').replace('service', '').capitalize(),
            name_camel=camel_name,
            js_name=service_name
        )
        
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
            
            # Migrate if it's a simple wrapper
            if is_simple_wrapper(content):
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




