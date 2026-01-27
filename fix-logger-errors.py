#!/usr/bin/env python3
"""Fix logger.error calls that pass unknown instead of Error | null."""
import re
import os

def fix_file(filepath):
    """Fix logger.error calls in a file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern: logger.error('message', err) where err is from catch (err: unknown)
    # Replace with: logger.error('message', err instanceof Error ? err : null)
    
    # Find catch blocks with unknown and logger.error calls
    pattern = r'(catch\s*\([^:]+:\s*unknown\)\s*\{[^}]*?logger\.error\([^,]+,\s*)(\w+)(\s*[^}]*?\})'
    
    def replace_func(match):
        prefix = match.group(1)
        err_var = match.group(2)
        suffix = match.group(3)
        
        # Check if already fixed
        if f'{err_var} instanceof Error' in match.group(0):
            return match.group(0)
        
        # Replace logger.error('msg', err) with logger.error('msg', err instanceof Error ? err : null)
        new_suffix = re.sub(
            rf'logger\.error\(([^,]+),\s*{re.escape(err_var)}\s*\)',
            rf'logger.error(\1, {err_var} instanceof Error ? {err_var} : null)',
            suffix
        )
        
        return prefix + err_var + new_suffix
    
    # Try the complex pattern first
    content = re.sub(pattern, replace_func, content, flags=re.DOTALL)
    
    # Simpler pattern: logger.error('msg', err) where err is likely unknown
    # Only replace if err is not already checked
    simple_pattern = r'logger\.error\(([^,]+),\s*(\w+)\s*\)'
    
    def simple_replace(match):
        msg = match.group(1)
        err_var = match.group(2)
        
        # Check if this err variable is from a catch (err: unknown) block nearby
        # Look backwards in the file for catch block
        start_pos = match.start()
        # Get context before this match
        before = content[:start_pos]
        
        # Check if there's a catch (err_var: unknown) before this
        catch_pattern = rf'catch\s*\(\s*{re.escape(err_var)}\s*:\s*unknown\s*\)'
        if re.search(catch_pattern, before[-500:]):  # Check last 500 chars
            # Check if already fixed
            if f'{err_var} instanceof Error' not in content[start_pos:start_pos+200]:
                return f'logger.error({msg}, {err_var} instanceof Error ? {err_var} : null)'
        
        return match.group(0)
    
    # Apply simple replacement
    content = re.sub(simple_pattern, simple_replace, content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    
    return False

# Find files with logger.error
files = []
for root, dirs, filenames in os.walk('server/src'):
    for filename in filenames:
        if filename.endswith('.ts'):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r') as f:
                content = f.read()
                if 'logger.error' in content and 'catch' in content and 'unknown' in content:
                    # Check if it needs fixing
                    if 'instanceof Error' not in content or content.count('logger.error') > content.count('instanceof Error'):
                        files.append(filepath)

fixed = 0
for filepath in files[:50]:  # Limit to first 50 files
    if fix_file(filepath):
        fixed += 1
        print(f'Fixed: {filepath}')

print(f'\nFixed {fixed} out of {len(files)} files (processed first 50)')
