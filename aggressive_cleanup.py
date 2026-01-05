import os

def aggressive_cleanup():
    directories = ['components', 'views', 'hooks', 'utils', 'services', 'server/src', 'server/routes', 'server/services']
    base_path = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify'
    
    for root_dir in directories:
        full_root = os.path.join(base_path, root_dir)
        if not os.path.exists(full_root):
            continue
            
        for root, dirs, files in os.walk(full_root):
            for file in files:
                if '.' not in file:
                    old_path = os.path.join(root, file)
                    
                    # Check if a version with extension exists
                    found = False
                    for ext in ['.tsx', '.ts', '.js', '.jsx']:
                        if os.path.exists(old_path + ext):
                            print(f"Force deleting extensionless file as version with {ext} exists: {old_path}")
                            os.remove(old_path)
                            found = True
                            break
                    
                    if not found:
                        # No extension version exists. Rename it.
                        with open(old_path, 'r', errors='ignore') as f:
                            content = f.read(2000)
                        
                        ext = '.ts'
                        if '<' in content and ('import React' in content or 'export const' in content):
                            ext = '.tsx'
                        
                        new_path = old_path + ext
                        print(f"Force renaming {old_path} -> {new_path}")
                        os.rename(old_path, new_path)

if __name__ == "__main__":
    aggressive_cleanup()
