#!/usr/bin/env python3
"""Fix missing return statements in catch blocks."""
import re
import os

def fix_file(filepath):
    """Fix missing return statements."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern: catch block with res.status(...).json(...) without return
    # Look for: } catch ... { ... res.status(...).json(...); ... }
    
    # Find catch blocks that have res.status but no return before it
    pattern = r'(catch\s+[^{]+\{[^}]*?)(res\.status\([^)]+\)\.json\([^)]+\);)'
    
    def add_return(match):
        catch_block = match.group(1)
        res_call = match.group(2)
        
        # Check if return already exists before this res.status call
        # Look at the last 200 chars before res.status
        before_res = catch_block[-200:]
        if 'return ' in before_res and 'res.status' in before_res:
            # Already has return, skip
            return match.group(0)
        
        # Check if there's already a return on the same line or line before
        lines = catch_block.split('\n')
        if len(lines) > 1:
            last_line = lines[-1].strip()
            if last_line.startswith('return'):
                return match.group(0)
        
        # Add return
        return catch_block + 'return ' + res_call
    
    # Apply the fix
    content = re.sub(pattern, add_return, content, flags=re.DOTALL)
    
    # Also fix simple cases: res.status(...).json(...); at end of catch block
    # Pattern: } catch ... { ... res.status(...).json(...); }
    simple_pattern = r'(catch\s+[^{]+\{[^}]*?)(res\.status\([^)]+\)\.json\([^)]+\);\s*\})'
    
    def add_return_simple(match):
        catch_content = match.group(1)
        res_call_and_close = match.group(2)
        
        # Check if return already exists
        if 'return ' in catch_content[-100:]:
            return match.group(0)
        
        # Extract just the res.status call
        res_match = re.search(r'(res\.status\([^)]+\)\.json\([^)]+\);)', res_call_and_close)
        if res_match:
            res_call = res_match.group(1)
            return catch_content + 'return ' + res_call + '\n        }'
        
        return match.group(0)
    
    content = re.sub(simple_pattern, add_return_simple, content, flags=re.DOTALL)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    
    return False

# Find route files
files = []
for root, dirs, filenames in os.walk('server/src/routes'):
    for filename in filenames:
        if filename.endswith('.routes.ts'):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r') as f:
                content = f.read()
                # Check if file has catch blocks with res.status but might be missing returns
                if 'catch' in content and 'res.status' in content:
                    # Count catch blocks vs return statements in catch blocks
                    catch_count = len(re.findall(r'catch\s+[^{]+\{', content))
                    return_in_catch = len(re.findall(r'catch\s+[^{]+\{[^}]*?return\s+res\.status', content, re.DOTALL))
                    if catch_count > return_in_catch:
                        files.append(filepath)

fixed = 0
for filepath in files[:30]:  # Process first 30 files
    if fix_file(filepath):
        fixed += 1
        print(f'Fixed: {filepath}')

print(f'\nFixed {fixed} out of {len(files)} files (processed first 30)')
