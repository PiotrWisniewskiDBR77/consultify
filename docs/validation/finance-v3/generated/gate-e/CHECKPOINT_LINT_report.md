# CHECKPOINT LINT — raport domknięcia (Finance v3, checkpoint gate-e)

Tryb: kontrolowane zamrożenie. Zero nowych funkcji, zero refaktorów, zero zmian logiki —
wyłącznie formatowanie (prettier) i kolejność importów (simple-import-sort), zgodnie z
istniejącą konfiguracją repo (`eslint.config.js`, `.prettierrc`).

- Worktree: `/Users/piotrwisniewski/consultify-wt/fv3-product`
- Gałąź: `codex/finance-v3-complete-product-integration`
- SHA na starcie sesji: `75032c9abe4fb34141bdc4d67a5141bccb59b560`
- **SHA końcowy (po naprawie, 9 commitów): `2a95b2500ed5969050ad64960f4e98bed16d7b26`**
- Baseline sesji (do wyznaczenia zakresu plików): `ee5736a5a62ebd19442ed63e897c0bf890102ab6`
- Data: 2026-08-12

## 1. Jak repo uruchamia lint

- `package.json` → `"lint": "eslint . --quiet"`, brak dedykowanego `lint:fix`/`format` — naprawę
  robi się `eslint <pliki> --fix` (standardowa flaga ESLint, nie skrypt repo).
- `eslint.config.js` (flat config, ESLint 9.39.2): reguła `prettier/prettier: 'error'` (przez
  `eslint-plugin-prettier` + `eslint-config-prettier`) i `simple-import-sort/imports: 'error'`,
  `simple-import-sort/exports: 'error'`. Blok `files: ['**/*.{ts,tsx}']` — **eslint w tym repo
  liczy formatowanie WYŁĄCZNIE dla `.ts`/`.tsx`** (nie `.js`/`.mjs`/`.md`/`.json`/`.png`).
- `.prettierrc`: `singleQuote: true`, `printWidth: 100`, `trailingComma: "es5"`, `arrowParens: "always"`, reszta domyślna.
- Globalne `ignores` w `eslint.config.js` wykluczają m.in. `tests/**`, `server/scripts/**` oraz —
  istotne dla tego audytu — **`**/*2.ts` / `**/*2.tsx`** (bez spacji), co przypadkiem łapie też
  pliki kończące się na `V2.tsx`/`v2.tsx` (patrz §3).

## 2. Zakres plików

`git diff --name-only ee5736a5a6..HEAD` → 284 plików zmienionych w tej sesji. Z tego **129 to
`.ts`/`.tsx`** (jedyne rozszerzenia objęte lintem wg `files:` powyżej) — to jest pełny,
jawny zakres tej naprawy. Pozostałe 155 plików (`.png`, `.md`, `.txt`, `.json`, `.mjs`, `.sh`)
nie są w domenie eslint/prettier w tym repo i nie były dotykane.

Z tych 129 plików **8 jest strukturalnie poza zasięgiem eslint** (dopasowanie do wpisu
`ignores` w `eslint.config.js`, niezależnie od tej sesji — stan sprzed naprawy):

| Plik | Powód wykluczenia |
|---|---|
| `dev-render/screens/finance-statement-pack-workspace-v2.tsx` | `**/*2.tsx` (kończy się na `v2.tsx`) |
| `src/components/Finance/statementPackWorkspaceV2/CanonicalStatementTableV2.tsx` | `**/*2.tsx` |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | `**/*2.tsx` |
| `server/scripts/finance-v3-audit/j2-crosstenant-probe.ts` | `server/scripts/**` |
| `server/scripts/finance-v3-audit/j3-concurrency-probe.ts` | `server/scripts/**` |
| `server/scripts/finance-v3-audit/j4-rbac-probe.ts` | `server/scripts/**` |
| `tests/components/Finance/SourceStep.fixc-lineage-chain.verify.test.tsx` | `tests/**` |
| `tests/unit/finance/rawEnumLeakScanner.test.ts` | `tests/**` |

Tak więc **121 z 129** plików było realnie w zasięgu autofix-a. To nie jest coś, co ta sesja
wprowadziła — to zastany kształt `eslint.config.js`; zgłaszam informacyjnie, bo tłumaczy, dlaczego
te 8 plików nie ma żadnych wpisów w pomiarach lintu poniżej.

## 3. Pomiar PRZED naprawą

Komenda (pliki jawną listą z `git diff --name-only ee5736a5a6..HEAD`, przefiltrowane do
`.ts`/`.tsx`, uruchomione w porcjach po 15 plików żeby uniknąć niejasności formatera):

```
node_modules/.bin/eslint <lista 129 plików> --quiet -f json
```

**Wynik: 3887 błędów, 0 ostrzeżeń** (przy `--quiet` ostrzeżenia i pliki bez błędów znikają z
JSON-a — stąd dalej osobny pomiar ostrzeżeń w kroku PO, patrz §5).

| Reguła | Liczba błędów |
|---|---:|
| `prettier/prettier` | 3846 |
| `simple-import-sort/imports` | 41 |
| **Razem** | **3887** |

(Orkiestrator wcześniej zmierzył „2749 błędów w 103 plikach" — inna liczba niż moje 3887/114,
prawdopodobnie inny sposób zliczania lub starzejący się pomiar, zgodnie ze złotą regułą #1
[„audyty starzeją się w ~3 dni"] zaufałem świeżemu pomiarowi z tej sesji, nie cudzej liczbie.)

## 4. Naprawa

```
node_modules/.bin/eslint <lista 129 plików> --fix
```

- **114 plików zmienionych**, wszystkie w obrębie 129-plikowej listy zakresu (zweryfikowane
  `comm -13` między listą wejściową a `git status --porcelain` po fix-ie — zero plików spoza
  zakresu dotkniętych).
- Exit code po `--fix`: `0`.
- Po naprawie: **0 błędów, 226 ostrzeżeń** (patrz §5 — ostrzeżenia nie są w mandacie tej sesji,
  wymagałyby zmian logiki).

### 4.1 Incydent podczas commitowania: fałszywe naruszenie `check-list-canon.sh`

Pre-commit hook (`.husky/pre-commit` → `scripts/check-list-canon.sh`, wspólny `core.hooksPath`
dla wszystkich worktree) **zablokował commit** dla 4 plików:

- `src/components/Finance/Valuation/steps/MethodsWeightsStep.tsx`
- `src/components/Finance/Valuation/steps/ResultsStep.tsx`
- `src/components/Finance/Valuation/steps/SensitivityStep.tsx`
- `src/components/Finance/baseline/AssumptionsView.tsx`

**Przyczyna źródłowa (zdiagnozowana, nie logika biznesowa):** te pliki mają świadomie
oznaczone tabele wyjątkiem `§27-exempt` (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md).
`scripts/check-list-canon.sh` wykrywa wyjątek wyłącznie REGEXEM PO POJEDYNCZEJ LINII:
`grep -nE '<table[ >/]' plik | grep -v '§27-exempt'` — wymaga, żeby znacznik
`data-canon="§27-exempt"` (lub komentarz z `§27-exempt`) był na TEJ SAMEJ fizycznej linii co
otwierający `<table`. Przed naprawą te tagi `<table ...>` mieściły się w jednej (długiej) linii.
Po `eslint --fix` prettier rozbił długie atrybuty JSX na wiele linii (zgodnie z `printWidth: 100`
— to jest POPRAWNE, zamierzone działanie prettiera) — `<table` wylądował na osobnej linii bez
znacznika, `<thead>`/`<tbody>`/`role="table"` przestały być rozpoznawane jako część
wyjątkowanej tabeli → skrypt zgłosił 2–3 „nowe" naruszenia na plik, mimo że treść (i wyjątek)
merytorycznie się nie zmieniły — to fałszywy alarm wynikający z interakcji dwóch niezależnych
narzędzi (prettier vs. jednolinijkowy heurystyczny grep), a nie prawdziwa regresja kanonu.

**Naprawa (bez zmiany logiki):** dodano komentarz `// prettier-ignore` /
`{/* prettier-ignore */}` bezpośrednio przed każdym z 4 otwierających tagów `<table>`, co
każe prettierowi (i przez to regule `prettier/prettier`) zostawić DOKŁADNIE ten jeden węzeł
JSX w oryginalnej, jednolinijkowej postaci — identycznej z treścią sprzed tej sesji dla tego
konkretnego tagu. Reszta każdego pliku (importy, pozostałe JSX) została znormalizowana
normalnie. Nie dotknięto `scripts/check-list-canon.sh` (poza mandatem tej sesji, plik-strażnik
opisany w CLAUDE.md jako nienaruszalny bezpiecznik).

Weryfikacja tej korekty:
- `bash scripts/check-list-canon.sh <4 pliki>` → `✓ brak NOWYCH naruszeń kanonu tabel` (exit 0).
- `eslint <4 pliki>` → 0 błędów (0 nowych ostrzeżeń poza zastanymi `no-restricted-syntax` w
  `AssumptionsView.tsx`, niepowiązanymi z tabelą — inline `style={{minWidth}}`, obecne od dawna).
- `vitest run src/components/Finance/Valuation/__tests__ src/components/Finance/baseline/__tests__`
  → 14/14 plików, 100/100 testów PASS.

To jedyny przypadek w tej sesji, gdzie automatyczna naprawa formatowania wymagała ręcznej
interwencji — i interwencja nie zmienia logiki/zachowania, tylko przywraca dokładnie to, co
było w pliku przed naprawą dla jednego węzła JSX (żeby zewnętrzny, niepowiązany strażnik nie
gubił kontekstu).

## 5. Pomiar PO naprawie (stan finalny, po commitach)

```
node_modules/.bin/eslint <ta sama lista 129 plików> -f json
```

**Wynik: 0 błędów, 226 ostrzeżeń** (exit code narzędzia 0 — ESLint zwraca >0 tylko gdy są
błędy lub przy `--max-warnings`, którego tu nie użyto).

Rozbicie 226 ostrzeżeń wg reguły (żadne nie jest formatowaniem/kolejnością importów — to są
reguły jakości kodu, których naprawa wymagałaby zmiany logiki, więc **NIE naprawiano ich**,
zgodnie z zakresem sesji):

| Reguła | Liczba | Charakter |
|---|---:|---|
| `@typescript-eslint/no-explicit-any` | 122 | wymaga typowania — zmiana kodu |
| `@typescript-eslint/no-non-null-assertion` | 44 | wymaga przeprojektowania asercji null |
| `no-restricted-syntax` (inline `style={{}}` / hex) | 28 | wymaga zamiany na tokeny Tailwind |
| `@typescript-eslint/no-unused-vars` | 13 | wymaga usunięcia/przemianowania zmiennych |
| *(plik zignorowany przez config)* | 8 | pliki z §2 — poza zasięgiem eslint z definicji |
| `react-hooks/exhaustive-deps` | 6 | wymaga analizy zależności hooków |
| `react-refresh/only-export-components` | 3 | wymaga zmiany struktury eksportu |
| `no-console` | 2 | wymaga usunięcia console.log |

**Cel „zero błędów formatowania" osiągnięty: 3887 → 0.** 226 ostrzeżeń pozostaje świadomie
nienaruszone — to dług przedistniejący, niezwiązany z `prettier/prettier` ani
`simple-import-sort/*`, i naprawa wymagałaby zmian logiki zakazanych w tej sesji.

## 6. Dowód niezmienności zachowania

### 6.1 Metoda

Ponieważ naprawa działa na working tree (bez commitów aż do końca), zbudowano **osobny,
tymczasowy `git worktree`** wskazujący na `HEAD` sprzed naprawy (`75032c9abe`, ten sam kod co
przed `--fix`), z symlinkowanym `node_modules`/`server/node_modules` (żeby uniknąć pełnej
reinstalacji — zgodnie ze znaną pułapką „worktree bez node_modules psuje się cicho"). Ten sam
zestaw testów uruchomiono w baseline-worktree (PRZED) i w worktree docelowym po naprawie i
commitach (PO), tymi samymi komendami i flagami (`--maxWorkers=2`, `NODE_ENV=test`).
Worktree baseline usunięty po pomiarze (`git worktree remove --force`).

Zakres „testy Finance i Economics": katalogi `src/components/Finance`, `src/components/Economics`,
`tests/components/Finance`, `tests/components/Economics`, `tests/unit/finance`,
`tests/unit/backend/economics` (root), `server/src/routes/v8/finance-v2` +
`server/src/services/finance` (server) — plus rozproszone pliki testowe z „finance"/"economic"
w nazwie spoza tych katalogów (hooki flag, `financeV2.*.api.test.ts`, ~38 plików serwerowych
typu `*Finance*.test.ts`/`*economics*.test.ts` poza ww. katalogami). Pliki przekazywane
jawną listą/katalogami (nie pojedynczymi >20-30 argumentami — znana pułapka vitest „No test
files found"), podzielone na porcje gdzie trzeba.

### 6.2 Wyniki — root (`vitest run` z korzenia repo)

**Batch A — katalogi Finance/Economics (src+tests):**

| | PRZED (`75032c9abe`) | PO (`2a95b2500e`, ostateczny) |
|---|---|---|
| Pliki | 3 failed \| 164 passed (167) | 3 failed \| 164 passed (167) *(finalny re-run; pośredni run tuż po `--fix`, przed commitami, pokazał 4/163 — patrz §6.4, flake)* |
| Testy | 7 failed \| 1556 passed (1563) | 7 failed \| 1556 passed (1563) |
| Exit code | 1 | 1 |
| Czas | 61 s | 63 s (finalny re-run) |

3 nieudane pliki/7 testów to **zastany, przedistniejący stan** (m.in.
`tests/unit/finance/financeFallbackGating.test.ts` — oczekiwanie `MODULE_ECONOMICS === 'open'`
kontra realny `'closed'` w konfiguracji flag; niepowiązane z formatowaniem) — identyczne w obu
pomiarach, ta sama lista testów po nazwie.

**Batch B — pliki rozproszone (hooki flag + `financeV2.*.api.test.ts`, 15 plików):**

| | PRZED | PO |
|---|---|---|
| Pliki | 15 passed (15) | 15 passed (15) |
| Testy | 108 passed (108) | 108 passed (108) |
| Exit code | 0 | 0 |

Identyczne.

### 6.3 Wyniki — server (`vitest run` z `server/`)

**Batch C — `routes/v8/finance-v2` + `services/finance` (72 pliki):**

| | PRZED | PO |
|---|---|---|
| Pliki | 21 passed \| 51 skipped (72) | 21 passed \| 51 skipped (72) |
| Testy | 422 passed \| 535 skipped (957) | 422 passed \| 535 skipped (957) |
| Exit code | 0 | 0 |

(51 plików skip = testy wymagające realnej `RUN_DB_TESTS=1`/PG — nieuruchamiane w żadnym z
dwóch pomiarów, spójnie.)

**Batch D — 38 rozproszonych plików `*inance*`/`*conomic*` (podzielone na 2 porcje po 19):**

| | PRZED (porcja 1) | PO (porcja 1) | PRZED (porcja 2) | PO (porcja 2) |
|---|---|---|---|---|
| Pliki | 2 failed \| 17 passed (19) | 2 failed \| 17 passed (19) | 1 failed \| 13 passed \| 5 skipped (19) | 1 failed \| 13 passed \| 5 skipped (19) |
| Testy | 4 failed \| 329 passed \| 10 skipped (343) | 4 failed \| 329 passed \| 10 skipped (343) | 2 failed \| 326 passed \| 46 skipped (374) | 2 failed \| 326 passed \| 46 skipped (374) |
| Exit code | 1 | 1 | 1 | 1 |

Identyczne co do liczby i nazwy nieudanych testów w obu porcjach — zastany dług, niepowiązany
z tą sesją.

### 6.4 Znany flake — potwierdzony, nie regresja

Pierwszy pomiar „PO" (uruchomiony od razu po `eslint --fix`, przed dodaniem 4 plików z §4.1 i
przed commitami) pokazał **4 nieudane pliki / 8 testów** zamiast 3/7 — dodatkowa awaria:
`src/components/Finance/Prediction/__tests__/PredictionWorkspace.test.tsx`. To dokładnie znany,
udokumentowany w briefie flake. Zweryfikowano 3 izolowane przebiegi tego pliku:

```
run 1: 11 passed (11)
run 2: 1 failed | 10 passed (11)   ← flake
run 3: 11 passed (11)
```

~1/3 przebiegów pada, zgodnie z opisem. **Finalny pomiar (po wszystkich 9 commitach, §6.2)
odtworzył dokładnie liczby z baseline (3/7, bez flake'a)** — traktuję to jako potwierdzenie,
nie jako coś do „naprawienia" (to nie jest w zakresie tej sesji formatującej).

### 6.5 `tsc --noEmit`

```
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```

- **Exit code: 0**
- Czas: 88 s (pomiar tuż po `--fix`, przed 4-plikową korektą) i **86 s (pomiar finalny, po
  wszystkich 9 commitach)** — oba `exit 0`. Mierzone przez `cmd > plik 2>&1; code=$?` (bez
  potoku do `tail`, bez `PIPESTATUS`).

### 6.6 `git diff --check`

```
git diff --check                    → exit 0 (pusty output)
git diff HEAD~9 HEAD --check         → exit 0 (pusty output, cały zakres 9 commitów naprawy)
```

Brak białych znaków na końcu linii / konfliktowych markerów w żadnym z 114 zmienionych plików.

## 7. Commity (9 partii, jak zalecono)

Pliki dodawane IMIENNIE (`git add -f <lista>`, nigdy `-A`/`.`). Każdy commit przeszedł pełny
zestaw hooków pre-commit repo (check-list-canon, check-artefakt, check-triada, check-gestosc,
check-focus-canon — wszystkie „brak NOWYCH naruszeń" / dług nie rośnie).

| # | SHA | Plików | Zakres |
|---|---|---:|---|
| 1/9 | `043b26b165` | 14 | dev-render/*, server routes __tests__ |
| 2/9 | `26e0b4fa24` | 14 | server routes/services, Economics, Finance/Analysis |
| 3/9 | `ea412dc4dc` | 14 | Finance/Analysis, BaselineWorkspace, Prediction |
| 4/9 | `6de183bfe8` | 14 | Prediction/Valuation (w tym 3 pliki z korektą §4.1) |
| 5/9 | `9c9ee340d4` | 14 | Valuation/baseline (w tym `AssumptionsView.tsx` z korektą §4.1) |
| 6/9 | `9b6b7cf2c9` | 14 | baseline/comments/compare panels |
| 7/9 | `9cccfbbf03` | 14 | exportImport/lineage/savedViews panels |
| 8/9 | `427e357d7f` | 14 | shared/statementPackWorkspaceV2 |
| 9/9 | `2a95b2500e` | 2 | hooks/services/api resztki |

**SHA końcowy: `2a95b2500ed5969050ad64960f4e98bed16d7b26`**

## 8. Podsumowanie dla orkiestratora

- **Błędy formatowania/importów: 3887 → 0** (w 121 z 129 plików w zakresie sesji; 8 plików
  strukturalnie poza zasięgiem eslint z definicji repo — §3).
- **114 plików zmienionych, 0 poza zakresem** (zweryfikowane `comm`).
- **226 ostrzeżeń pozostaje celowo nienaruszonych** — wymagałyby zmiany logiki, poza mandatem;
  pełne rozbicie wg reguły w §5.
- **1 incydent wymagający ręcznej, ale zero-logicznej interwencji**: fałszywe naruszenie
  `check-list-canon.sh` w 4 plikach spowodowane interakcją prettiera z jednolinijkową
  heurystyką strażnika (§4.1) — naprawione przez `prettier-ignore` na 4 konkretnych węzłach
  JSX, zweryfikowane osobno (hook + eslint + testy).
- **Zachowanie niezmienione**: testy Finance+Economics identyczne PRZED/PO (poza 1 znanym,
  zweryfikowanym flakiem, który finalny pomiar odtworzył jako NIEobecny — zgodny z baseline).
- **`tsc --noEmit`: exit 0** (86–88 s).
- **`git diff --check`: exit 0** (bez białych znaków/konfliktów).
- **9 commitów, partiami po ~14 plików**, SHA końcowy `2a95b2500ed5969050ad64960f4e98bed16d7b26`.
- Nic nie pominięto z zakresu sesji (129/129 plików `.ts`/`.tsx` z diff `ee5736a5a6..HEAD`
  przetworzonych; 121 realnie lintowalnych, wszystkie 0 błędów).
