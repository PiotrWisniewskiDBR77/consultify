import os

def final_duplicate_cleanup():
    directories = ['components', 'views', 'hooks', 'utils', 'services', 'server/src', 'server/routes', 'server/services']
    base_path = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify'
    
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
                        print(f"Force deleting duplicate: {old_path} (original {new_path} exists)")
                        os.remove(old_path)
                    else:
                        print(f"Renaming lone duplicate: {old_path} -> {new_path}")
                        os.rename(old_path, new_path)

if __name__ == "__main__":
    final_duplicate_cleanup()
