#!/usr/bin/env python3
"""Fix missing else blocks in route files."""
import re
import os

def fix_file(filepath):
    """Fix missing else block."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern: router.use(...as RequestHandler); followed by // Fallback or error without } else {
    pattern = r'(router\.use\([^)]+as RequestHandler\);\s*// Fallback or error\s*console\.error\([^)]+\);)'
    
    replacement = r'router.use(\1 as RequestHandler);\n} else {\n    // Fallback or error\n    console.error(\2);\n}'
    
    # Find the pattern and fix it
    match = re.search(r'router\.use\((\w+RoutesJS) as RequestHandler\);\s*// Fallback or error\s*console\.error\(([^)]+)\);', content)
    
    if match:
        var_name = match.group(1)
        error_msg = match.group(2)
        
        old_text = f'router.use({var_name} as RequestHandler);\n    // Fallback or error\n    console.error({error_msg});'
        new_text = f'router.use({var_name} as RequestHandler);\n}} else {{\n    // Fallback or error\n    console.error({error_msg});\n}}'
        
        if old_text in content and '} else {' not in content.split(old_text)[0].split('\n')[-1]:
            content = content.replace(old_text, new_text)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    
    return False

# Get list of files to fix
files = []
for root, dirs, filenames in os.walk('server/src/routes'):
    for filename in filenames:
        if filename.endswith('.routes.ts'):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r') as f:
                content = f.read()
                if '// Fallback or error' in content and '} else {' not in content.split('// Fallback or error')[0].split('\n')[-2]:
                    files.append(filepath)

fixed = 0
for filepath in files:
    if fix_file(filepath):
        fixed += 1
        print(f'Fixed: {filepath}')

print(f'\nFixed {fixed} files')
