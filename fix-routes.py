#!/usr/bin/env python3
"""Fix route handler type issues in all route files."""
import re
import os
from pathlib import Path

def fix_route_file(filepath):
    """Fix a single route file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Skip if already fixed
    if 'RequestHandler' in content and 'as { handle?: unknown }' in content:
        return False
    
    # Add RequestHandler to imports if Router is imported
    if 'import { Router }' in content and 'RequestHandler' not in content:
        content = content.replace(
            'import { Router }',
            'import { Router, type RequestHandler }'
        )
    
    # Find the variable name (e.g., "governanceRoutesJS")
    var_match = re.search(r'const (\w+RoutesJS)', content)
    if not var_match:
        return False
    
    var_name = var_match.group(1)
    
    # Pattern 1: Single line if statement
    pattern1 = rf'if\s*\(\s*typeof\s+{re.escape(var_name)}\s*===\s*[\'"]function[\'"]\s*\|\|\s*\({re.escape(var_name)}\s*&&\s*typeof\s+{re.escape(var_name)}\.handle\s*===\s*[\'"]function[\'"]\s*\)\s*\)'
    
    # Pattern 2: Multi-line if statement
    pattern2 = rf'if\s*\(\s*typeof\s+{re.escape(var_name)}\s*===\s*[\'"]function[\'"]\s*\|\|\s*\(\s*{re.escape(var_name)}\s*&&\s*typeof\s+{re.escape(var_name)}\.handle\s*===\s*[\'"]function[\'"]\s*\)\s*\)'
    
    replacement = f'''if (typeof {var_name} === 'function') {{
    // If it's a router function, use it
    router.use({var_name} as RequestHandler);
}} else if ({var_name} && typeof ({var_name} as {{ handle?: unknown }}).handle === 'function') {{
    // If it's a Router object with handle method, use it
    router.use({var_name} as RequestHandler);
}} else {{
    // Fallback or error
    console.error('{filepath.split("/")[-1].replace(".routes.ts", "")}.js did not export a valid router');
}}'''
    
    # Try to match and replace
    if re.search(pattern1, content):
        # Find the router.use line and the else block
        lines = content.split('\n')
        new_lines = []
        i = 0
        in_if_block = False
        replaced = False
        
        while i < len(lines):
            line = lines[i]
            
            # Check if this is the problematic if line
            if pattern1.replace('\\', '') in line or (f'typeof {var_name} ===' in line and '.handle' in line):
                # Replace with new pattern
                new_lines.append(f'if (typeof {var_name} === \'function\') {{')
                new_lines.append(f'    // If it\'s a router function, use it')
                new_lines.append(f'    router.use({var_name} as RequestHandler);')
                new_lines.append(f'}} else if ({var_name} && typeof ({var_name} as {{ handle?: unknown }}).handle === \'function\') {{')
                new_lines.append(f'    // If it\'s a Router object with handle method, use it')
                new_lines.append(f'    router.use({var_name} as RequestHandler);')
                new_lines.append(f'}} else {{')
                in_if_block = True
                replaced = True
                i += 1
                # Skip the router.use line and else block
                while i < len(lines):
                    if 'router.use(' in lines[i] and var_name in lines[i]:
                        i += 1
                        continue
                    elif '} else {' in lines[i] or '} else' in lines[i]:
                        i += 1
                        # Skip until we find the closing brace
                        while i < len(lines) and not (lines[i].strip() == '}' and not in_if_block):
                            if lines[i].strip() == '}':
                                in_if_block = False
                            i += 1
                        break
                    elif lines[i].strip() == '}' and in_if_block:
                        in_if_block = False
                        i += 1
                        break
                    else:
                        i += 1
                continue
            else:
                new_lines.append(line)
                i += 1
        
        if replaced:
            content = '\n'.join(new_lines)
    
    # If no replacement happened, try a simpler approach
    if content == original_content:
        # Simple string replacement approach
        old_pattern = f'if (typeof {var_name} === \'function\' || ({var_name} && typeof {var_name}.handle === \'function\'))'
        new_pattern = f'''if (typeof {var_name} === 'function') {{
    // If it's a router function, use it
    router.use({var_name} as RequestHandler);
}} else if ({var_name} && typeof ({var_name} as {{ handle?: unknown }}).handle === 'function')'''
        
        if old_pattern in content:
            content = content.replace(old_pattern, new_pattern)
            # Fix the router.use line
            content = re.sub(
                rf'router\.use\({var_name}\);',
                f'    router.use({var_name} as RequestHandler);\n}} else {{',
                content,
                count=1
            )
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    
    return False

# Find all route files
route_files = []
for root, dirs, files in os.walk('server/src/routes'):
    for file in files:
        if file.endswith('.routes.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
                if 'typeof' in content and '.handle' in content and 'RequestHandler' not in content:
                    route_files.append(filepath)

# Fix each file
fixed_count = 0
for filepath in route_files:
    if fix_route_file(filepath):
        fixed_count += 1
        print(f'Fixed: {filepath}')

print(f'\nFixed {fixed_count} out of {len(route_files)} route files')
