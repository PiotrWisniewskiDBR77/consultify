import json
import os
import glob

def deep_merge(source, target):
    """
    Recursively merges source into target.
    If a key exists in source but not in target, it's added from source.
    """
    for key, value in source.items():
        if isinstance(value, dict):
            # get node or create one
            node = target.setdefault(key, {})
            if not isinstance(node, dict):
                # If target has a string where source has a dict, overwrite it
                target[key] = value
            else:
                deep_merge(value, node)
        else:
            if key not in target:
                target[key] = value
    return target

def sync_locale_namespace(source_path, target_path):
    print(f"Syncing {target_path}...")
    if not os.path.exists(source_path):
        print(f"  Source {source_path} missing. Skipping.")
        return

    with open(source_path, 'r', encoding='utf-8') as f:
        source_data = json.load(f)
    
    if os.path.exists(target_path):
        with open(target_path, 'r', encoding='utf-8') as f:
            target_data = json.load(f)
    else:
        target_data = {}
        
    synced_data = deep_merge(source_data, target_data)
    
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(synced_data, f, ensure_ascii=False, indent=2)

def cleanup_duplicate_files(locales_dir):
    print(f"Cleaning up duplicate files in {locales_dir}...")
    # Pattern to match files with spaces and numbers like "translation 2.json"
    patterns = [
        os.path.join(locales_dir, "*", "* [0-9]*.json"),
        os.path.join(locales_dir, "*", "*[0-9].json") # Match discovery2.json too if any
    ]
    for pattern in patterns:
        for file_path in glob.glob(pattern):
            try:
                os.remove(file_path)
                print(f"  Deleted garbage file: {file_path}")
            except Exception as e:
                print(f"  Failed to delete {file_path}: {e}")

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    locales_dir = os.path.join(root_dir, 'public/locales')
    source_locale = 'en'
    
    namespaces = ['translation.json', 'assessment-module.json', 'discovery.json']
    target_locales = ['pl', 'de', 'es', 'ar', 'jp', 'ja']
    
    cleanup_duplicate_files(locales_dir)
    
    for locale in target_locales:
        locale_dir = os.path.join(locales_dir, locale)
        if not os.path.exists(locale_dir):
            os.makedirs(locale_dir)
            
        for ns in namespaces:
            source_path = os.path.join(locales_dir, source_locale, ns)
            target_path = os.path.join(locales_dir, locale, ns)
            sync_locale_namespace(source_path, target_path)

if __name__ == "__main__":
    main()
