import os
import shutil

def fix_extensions_and_duplicates():
    directories = ['components', 'views', 'hooks', 'utils', 'services', 'server/src', 'server/routes', 'server/services']
    base_path = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify'
    
    # Phase 1: Fix " 2.tsx" and " 2.ts" etc.
    print("Phase 1: Fixing ' 2.*' duplicates...")
    for root_dir in directories:
        full_root = os.path.join(base_path, root_dir)
        if not os.path.exists(full_root):
            continue
            
        for root, dirs, files in os.walk(full_root):
            for file in files:
                if ' 2.' in file:
                    old_path = os.path.join(root, file)
                    new_file = file.replace(' 2.', '.')
                    new_path = os.path.join(root, new_file)
                    
                    if os.path.exists(new_path):
                        # Both exist. Compare them.
                        if os.path.getsize(old_path) == os.path.getsize(new_path):
                            print(f"Deleting identical duplicate: {old_path}")
                            os.remove(old_path)
                        else:
                            print(f"Warning: {old_path} and {new_path} differ. Keeping both for now but renaming might be needed.")
                    else:
                        print(f"Renaming {old_path} -> {new_path}")
                        shutil.move(old_path, new_path)

    # Phase 2: Fix missing extensions
    print("\nPhase 2: Fixing missing extensions...")
    for root_dir in directories:
        full_root = os.path.join(base_path, root_dir)
        if not os.path.exists(full_root):
            continue
            
        for root, dirs, files in os.walk(full_root):
            for file in files:
                if '.' not in file:
                    # Potential missing extension
                    old_path = os.path.join(root, file)
                    
                    # Detect content type
                    with open(old_path, 'r', errors='ignore') as f:
                        content = f.read(1000)
                    
                    extension = None
                    if 'import' in content or 'export' in content or 'const' in content:
                        if '<' in content and '>' in content:
                            extension = '.tsx'
                        else:
                            extension = '.ts'
                    
                    if extension:
                        new_path = old_path + extension
                        if os.path.exists(new_path):
                            if os.path.getsize(old_path) == os.path.getsize(new_path):
                                print(f"Deleting identical extensionless file: {old_path}")
                                os.remove(old_path)
                            else:
                                print(f"Warning: {old_path} without extension differs from {new_path}. Keeping.")
                        else:
                            print(f"Renaming {old_path} -> {new_path}")
                            shutil.move(old_path, new_path)

if __name__ == "__main__":
    fix_extensions_and_duplicates()
