
import json
import os

langs = ['EN', 'PL', 'DE', 'AR', 'JA']
lc_map = {'EN': 'en', 'PL': 'pl', 'DE': 'de', 'AR': 'ar', 'JA': 'ja'}

with open('scripts/full_translations.json', 'r') as f:
    full = json.load(f)

# Structure: full[section][key] = { EN: '...', PL: '...' }
# Target: en/translation.json -> { section: { key: '...' } }

def deep_get_lang(obj, target_lang):
    if isinstance(obj, dict):
        # Check if this node is a language leaf node (has EN, PL keys)
        if 'EN' in obj and 'PL' in obj:
            return obj.get(target_lang, "")
        
        # Otherwise recurse
        new_obj = {}
        for k, v in obj.items():
            val = deep_get_lang(v, target_lang)
            if val is not None:
                new_obj[k] = val
        return new_obj
    return obj

for lang in langs:
    lc = lc_map[lang]
    lang_data = deep_get_lang(full, lang)
    
    # Ensure dir exists
    path = f'public/locales/{lc}'
    os.makedirs(path, exist_ok=True)
    
    with open(f'{path}/translation.json', 'w', encoding='utf-8') as f:
        json.dump(lang_data, f, indent=2, ensure_ascii=False)

print("Split complete.")
