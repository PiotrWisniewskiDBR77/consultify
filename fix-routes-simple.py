#!/usr/bin/env python3
"""Fix route handler type issues - simple approach."""
import re
import os

def fix_file(filepath):
    """Fix a single route file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Skip if already properly fixed
    if 'RequestHandler' in content and 'as { handle?: unknown }' in content and '} else {' in content:
        return False
    
    # Add RequestHandler import
    if 'import { Router }' in content and 'RequestHandler' not in content:
        content = content.replace('import { Router }', 'import { Router, type RequestHandler }')
    
    # Find variable name
    match = re.search(r'const (\w+RoutesJS)', content)
    if not match:
        return False
    
    var = match.group(1)
    
    # Pattern to match: if (typeof X === 'function' || (X && typeof X.handle === 'function'))
    old_pattern = f"if (typeof {var} === 'function' || ({var} && typeof {var}.handle === 'function'))"
    
    if old_pattern in content:
        # Replace the if statement
        new_if = f"""if (typeof {var} === 'function') {{
    // If it's a router function, use it
    router.use({var} as RequestHandler);
}} else if ({var} && typeof ({var} as {{ handle?: unknown }}).handle === 'function') {{
    // If it's a Router object with handle method, use it
    router.use({var} as RequestHandler);
}} else {{
    // Fallback or error"""
        
        content = content.replace(old_pattern, new_if)
        
        # Fix the router.use line - remove the old one and ensure proper structure
        lines = content.split('\n')
        new_lines = []
        i = 0
        skip_next_router_use = False
        
        while i < len(lines):
            line = lines[i]
            
            # Skip the old router.use line if it's the one we're replacing
            if f'router.use({var})' in line and 'as RequestHandler' not in line and skip_next_router_use:
                skip_next_router_use = False
                i += 1
                # Skip the else block that follows
                if i < len(lines) and '} else {' in lines[i]:
                    i += 1
                continue
            
            # Check if we just added the new pattern and need to skip old router.use
            if f'// If it\'s a Router object with handle method' in line:
                skip_next_router_use = True
            
            new_lines.append(line)
            i += 1
        
        content = '\n'.join(new_lines)
        
        # Ensure proper closing
        if 'console.error' in content and '} else {' not in content.split('console.error')[0].split('\n')[-2]:
            # Find the console.error line and add proper closing
            content = re.sub(
                r'(console\.error\([^)]+\);)',
                r'    \1\n}',
                content,
                count=1
            )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    
    return False

# Find files that need fixing
files_to_fix = []
for root, dirs, files in os.walk('server/src/routes'):
    for file in files:
        if file.endswith('.routes.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
                # Check if it has the problematic pattern but not the fix
                if 'typeof' in content and '.handle' in content:
                    if 'as { handle?: unknown }' not in content or '} else {' not in content.split('.handle')[0]:
                        files_to_fix.append(filepath)

fixed = 0
for filepath in files_to_fix:
    if fix_file(filepath):
        fixed += 1
        print(f'Fixed: {filepath}')

print(f'\nFixed {fixed} out of {len(files_to_fix)} files')
