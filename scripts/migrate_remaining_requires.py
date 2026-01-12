#!/usr/bin/env python3
"""
Script to migrate remaining require() calls to dynamic import in controllers, middleware, cron, etc.
"""

import re
from pathlib import Path

def migrate_require_to_import(content: str, filepath: Path) -> tuple[str, bool]:
    """Migrate require() calls to dynamic import"""
    changed = False
    
    # Pattern 1: const x = require('module')
    pattern1 = r"const\s+(\w+)\s*=\s*require\(['\"]([^'\"]+)['\"]\)"
    
    def replace_require(match):
        nonlocal changed
        var_name = match.group(1)
        module_path = match.group(2)
        
        # Skip node_modules and already migrated
        if 'node_modules' in module_path or 'createCachedLazyService' in content:
            return match.group(0)
        
        changed = True
        
        # Convert relative path if needed
        if module_path.startswith('../../'):
            # Already relative
            import_path = module_path.replace('.js', '') if module_path.endswith('.js') else module_path
        elif module_path.startswith('../'):
            import_path = module_path.replace('.js', '') if module_path.endswith('.js') else module_path
        else:
            import_path = module_path
        
        # Add .js extension if not present and not node_modules
        if not import_path.endswith('.js') and not import_path.startswith('@'):
            import_path += '.js'
        
        return f"const {var_name} = await import('{import_path}').then(m => m.default || m)"
    
    # Replace require() calls
    new_content = re.sub(pattern1, replace_require, content)
    
    # Pattern 2: require('module') in object/function calls
    # This is more complex and may need manual review
    
    return new_content, changed

def migrate_file(filepath: Path) -> bool:
    """Migrate a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Skip if already migrated or no require()
        if 'createCachedLazyService' in content or 'require(' not in content:
            return False
        
        # Skip node_modules
        if 'node_modules' in content and 'require(' in content:
            # Check if it's actually using node_modules require
            if re.search(r"require\(['\"][^'\"]*node_modules", content):
                return False
        
        new_content, changed = migrate_require_to_import(content, filepath)
        
        if changed:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"✅ Migrated {filepath.relative_to(Path('server/src').parent)}")
            return True
        return False
    except Exception as e:
        print(f"❌ Error migrating {filepath.name}: {e}")
        return False

def main():
    """Main migration function"""
    src_dir = Path("server/src")
    
    # Directories to process
    dirs_to_process = [
        src_dir / "controllers",
        src_dir / "middleware",
        src_dir / "cron",
        src_dir / "utils",
    ]
    
    migrated = 0
    skipped = 0
    errors = 0
    
    for dir_path in dirs_to_process:
        if not dir_path.exists():
            continue
        
        for filepath in sorted(dir_path.rglob("*.ts")):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Skip if already migrated
                if 'createCachedLazyService' in content or 'require(' not in content:
                    skipped += 1
                    continue
                
                if migrate_file(filepath):
                    migrated += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f"❌ Error processing {filepath.name}: {e}")
                errors += 1
    
    print(f"\n📊 Migration Summary:")
    print(f"   ✅ Migrated: {migrated}")
    print(f"   ⏭️  Skipped: {skipped}")
    print(f"   ❌ Errors: {errors}")

if __name__ == "__main__":
    main()





