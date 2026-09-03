#!/usr/bin/env python3
"""Szybsza wersja: jeden przebieg buduje zbior wszystkich importowanych nazw bazowych,
potem O(kandydaci) sprawdzenie membership zamiast N*M regex."""
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEARCH_DIRS = ['src', 'dev-render', 'server', 'tests']
COMPONENT_DIR = 'src/components'

EXCLUDE_SUFFIXES = ('.test.tsx', '.test.ts', '.stories.tsx', '.stories.ts')
EXCLUDE_DIR_PARTS = ('__tests__', '__mocks__', '__stories__')

IMPORT_RE = re.compile(r"""(?:from\s+|import\(\s*)['"]([^'"]+)['"]""")

def list_candidates():
    candidates = []
    base = os.path.join(ROOT, COMPONENT_DIR)
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIR_PARTS]
        for fn in filenames:
            if not fn.endswith('.tsx'):
                continue
            if fn.endswith(EXCLUDE_SUFFIXES):
                continue
            if fn == 'index.tsx':
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            candidates.append(rel)
    return candidates

def build_imported_basenames():
    """Jeden przebieg: dla kazdego pliku zrodlowego wyciagnij specyfikatory importu,
    zapisz set 'ostatni segment sciezki' (basename bez rozszerzenia)."""
    basenames = set()
    # basename -> lista (importer, specifier) dla dowodu
    evidence = {}
    exts = ('.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs')
    for sd in SEARCH_DIRS:
        base = os.path.join(ROOT, sd)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in ('node_modules', '.git', 'dist', 'build')]
            for fn in filenames:
                if not fn.endswith(exts):
                    continue
                full = os.path.join(dirpath, fn)
                try:
                    with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                        text = f.read()
                except Exception:
                    continue
                for m in IMPORT_RE.finditer(text):
                    spec = m.group(1)
                    last = spec.rstrip('/').split('/')[-1]
                    if not last:
                        continue
                    basenames.add(last)
                    evidence.setdefault(last, []).append(os.path.relpath(full, ROOT))
    return basenames, evidence

def main():
    candidates = list_candidates()
    print(f"# Kandydaci .tsx w src/components: {len(candidates)}", file=sys.stderr)
    basenames, evidence = build_imported_basenames()
    print(f"# Unikalnych basename importowanych: {len(basenames)}", file=sys.stderr)

    results = []
    for rel in candidates:
        name = os.path.splitext(os.path.basename(rel))[0]
        if name not in basenames:
            results.append(rel)

    print(f"# Kandydaci BEZ importera: {len(results)}", file=sys.stderr)
    for rel in sorted(results):
        print(rel)

if __name__ == '__main__':
    main()
