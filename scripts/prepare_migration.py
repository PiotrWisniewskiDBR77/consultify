
import re
import json
import os

# Read translations.ts
try:
    with open('translations.ts', 'r', encoding='utf-8') as f:
        content = f.read()
except FileNotFoundError:
    print("translations.ts not found in root")
    exit(1)

# Simple parsing logic
js_content = content.replace("import { Language } from './types';", "")
js_content = js_content.replace("export const translations =", "const translations =")
js_content += "\nmodule.exports = { translations };"

# Use .cjs extension to force CommonJS
with open('translations.ts_converted.cjs', 'w', encoding='utf-8') as f:
    f.write(js_content)

# Node script wrapper
node_script = """
const { translations } = require('./translations.ts_converted.cjs');
console.log(JSON.stringify(translations, null, 2));
"""

with open('migrate_dumper.cjs', 'w', encoding='utf-8') as f:
    f.write(node_script)
