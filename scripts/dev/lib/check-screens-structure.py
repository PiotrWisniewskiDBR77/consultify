#!/usr/bin/env python3
"""Strukturalna kontrola spisu ekranow dev-render/main.tsx — BEZ zaleznosci.

POWOD (2026-09-01): bramka opierala sie wylacznie na esbuild. W katalogu bez
zainstalowanych pakietow esbuild jest niedostepny, bramka pisala "pominieto"
i konczyla sie kodem 0 — czyli PRZEPUSCILA plik, ktory sie nie parsuje.
Zdarzylo sie to DWA RAZY tego samego dnia, przy scaleniach metoda
"zachowaj obie strony", ktora gubi klamre zamykajaca wpisu.

"Pominieto sprawdzenie" bylo czytane jako "sprawdzenie przeszlo" — dokladnie
ten ksztalt, przed ktorym program ostrzega. Ta kontrola nie ma zaleznosci,
wiec nigdy sie nie pomija.
"""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'dev-render/main.tsx'
lines = open(path, encoding='utf-8').read().split('\n')

start = next((i for i, l in enumerate(lines) if l.startswith('const SCREENS')), None)
if start is None:
    print('✘ nie znaleziono spisu ekranow (const SCREENS) w ' + path)
    sys.exit(2)

bad, i = [], start + 1
while i < len(lines):
    l = lines[i]
    if l.startswith('};'):
        break
    if l.startswith("  '") and l.rstrip().endswith('{'):
        j, closed = i + 1, False
        while j < len(lines):
            if lines[j].startswith('  },'):
                closed = True
                break
            if lines[j].startswith('};'):
                break
            if lines[j].startswith("  '") and lines[j].rstrip().endswith('{'):
                break
            j += 1
        if not closed:
            bad.append((i + 1, l.strip()[:70]))
        i = j
    else:
        i += 1

if bad:
    print('✘ wpisy spisu ekranow BEZ klamry zamykajacej (plik sie nie sparsuje):')
    for n, t in bad:
        print(f'    linia {n}: {t}')
    sys.exit(1)

print('✓ struktura spisu ekranow poprawna (kazdy wpis domkniety)')
sys.exit(0)
