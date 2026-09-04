# R2 — bezpiecznik i dowody mutacyjne

- Stan bazowy: 162 zbadane pliki, 350 ternary, 6 nieuzasadnionych identyczności, baseline 6; exit 0.
- Mutacja defektu w realnym ciele funkcji: `isPolish ? 'Mission & Context' : 'Mission & Context'` zwiększyła mianownik do 351 i dług do 7; komunikat wskazał `toolCompletion.ts:515`; exit 1.
- Mutacja uzasadniona w realnym ciele funkcji: `Status` oraz `SWOT` zwiększyła mianownik do 352, ale dług pozostał 6; exit 0.
- Mutacja podłogi: `--zakres=src/nie-ma-takiego` wypisała 0 plików i 0 ternary oraz `ETYKIETY FAIL: zero zbadanych obiektów`; exit 1.
- Po każdym przywróceniu przez `cp` diff produktu był pusty.
- Dwa testy jednostkowe bezpiecznika przeszły; pełne nazwy: `wykrywa prawdziwy defekt identycznych angielskich gałęzi`, `nie zgłasza uzasadnionych identyczności Status i SWOT`.

Lista uzasadnień nie została skopiowana: skrypt importuje `justification` z `scripts/dev/i18n-pl-audyt.mjs`. Separatory są rozpoznawane strukturalnie jako ciąg znaków interpunkcyjnych, a nie przez drugą listę wyjątków.
