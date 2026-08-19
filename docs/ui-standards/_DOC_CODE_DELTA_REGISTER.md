---
doc_kind: DOC_CODE_DELTA_REGISTER
spec_status: APPROVED_SPEC
last_measured: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Rejestr rozbieżności dokumentacja↔kod (SSOT)

## Zasada nadrzędna

Audyt dokumentacji UI wykazał wzorzec: gdy dokumentacja i kod się rozjeżdżały, kolejne redakcje wielokrotnie
„rozstrzygały" rozjazd wyborem wartości, która **wygląda ładniej na papierze**, zamiast zmierzyć, co
realnie stoi w `src/`. Jedynym miejscem, które zrobiło to uczciwie, jest
`docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` §0 — grep 151 plików, nazwane systemy, zadania
konwergencji zamiast deklaracji. Ten rejestr uogólnia tę metodę na cały `docs/ui-standards/`.

**Twarda reguła:** wpis w tym rejestrze powstaje WYŁĄCZNIE na podstawie realnego `grep`/odczytu kodu
uruchomionego w chwili pisania wpisu — z konkretną liczbą i ścieżką pliku. Zakaz wpisów opartych na
deklaracji innego dokumentu, na audycie sprzed więcej niż kilku dni, albo na pamięci „tak było". Audyty
starzeją się w ~3 dni (złota reguła CLAUDE.md) — dlatego każdy wpis niesie **datę pomiaru** i **polecenie**,
którym dowolny agent może go powtórzyć w 10 sekund. Gdy kierunek rozstrzygnięcia nie jest oczywisty
(dokument i kod są sobie równie odległe od „prawdy", albo nikt jeszcze nie zdecydował, które ma się
zmienić), wpis mówi to wprost jako `NIEROZSTRZYGNIĘTA` — nie zgaduje.

## Tabela

| # | Delta | Kierunek | Status |
|---|---|---|---|
| D-01 | Fokus: `ring-primary-*` (crimson) zamiast `ring-c-focus` (niebieski) | dług KODU | OTWARTA |
| D-02 | Menu 3: wysokość dokument 44 px vs kod ≈48 px | **48 px jest kanonem**; kod już zgodny wymiarowo | **ZAMKNIĘTA 2026-08-03** |
| D-03 | Preview listowy: `MyProjects.tsx` omija `TableWithPreviewLayout` (SSOT) | dług KODU | OTWARTA |
| D-04 | Drawery `IdeaTableTool.tsx` poza zakresem 320–420 px | dług KODU | OTWARTA |
| D-05 | `primary-500`/`primary-600` jako tło/obramowanie (stan aktywny/akcent) poza fokusem | dług KODU | OTWARTA |

---

## D-01 — Fokus: crimson zamiast niebieskiego

**Co mówi dokument:** `TRIADA_KANON.md:167` — `--c-focus` / `--c-focus-solid` **„niebieski, nigdy crimson"**
(`rgba(91,141,239,.45)` / `#5b8def`). Zgodne z CLAUDE.md „Pułapka nr 1": `primary` w tailwind = crimson
`#85182F`, fokus MUSI iść przez `c-focus`, hook `check-list-canon.sh`/`check-artefakt.sh` blokuje
naruszenia w zakresie, który obejmują.

**Co mówi kod (zmierzone 2026-08-02):**
```
grep -rl "ring-primary-500" src/ | wc -l   →  119
grep -rl "ring-c-focus" src/ | wc -l       →  259
```
(dla porównania, `ring-primary-` z dowolnym numerem, nie tylko `-500`: `grep -rl "ring-primary-" src/ | wc -l` → 137)

**Polecenie powtórzenia pomiaru:**
```bash
grep -rl "ring-primary-500" src/ | wc -l
grep -rl "ring-c-focus" src/ | wc -l
```

**Kierunek:** dług KODU. Większość plików (259) już jest zgodna z kanonem (`c-focus`) — dokumentacja
została poprawiona i jest z nim zgodna, to NIE jest przypadek „doc podąża za ładniejszym kodem". Pozostaje
jednak 119 plików, które wciąż wiążą fokus z paletą `primary-500` (crimson), czyli łamią kanon i hook.
To zastany dług do sprowadzenia do zera, nie do udokumentowania jako druga „legalna" wartość.

**Status:** OTWARTA.

---

## D-02 — Menu 3: wysokość dokument 44 px vs kod ≈48 px

**Co mówi dokument:** `docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md:92` — „contextual
command / Menu 3 = 44 px". Ten sam wiersz już sam siebie oznacza jako otwarty dług:
> „44 px — **DŁUG DOC↔KOD, otwarty.** Zmierzone w kodzie: `MENU_3_ROW_CLASS`
> (`src/components/shared/ModuleMenu3.tsx:53-54`, `px-4 py-2`) + `MENU_3_INNER_CLASS` (`min-h-8`) dają
> wysokość ≈48 px, nie 44 px. Rozbieżność nie jest tu rozstrzygana (ani doc→48, ani kod→44 nie jest
> wybrany w tym kroku); do decyzji."

**Co mówi kod (zmierzone 2026-08-02):** `src/components/shared/ModuleMenu3.tsx:53-56`
```ts
export const MENU_3_ROW_CLASS =
  'px-4 py-2 mb-2 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/[0.05]';
export const MENU_3_INNER_CLASS = ...min-h-8...
```
`py-2` (2×8px=16px) + treść wewnętrzna `min-h-8` (32px) → wysokość realna ≈48 px, nie 44 px zadeklarowane
w kontrakcie tokenów.

**Polecenie powtórzenia pomiaru:**
```bash
grep -n "MENU_3_ROW_CLASS" -A3 src/components/shared/ModuleMenu3.tsx
```

**Rozstrzygnięcie 2026-08-03:** 48 px jest wartością kanoniczną dla całego rzędu Menu 3. Interaktywne
triggery zachowują minimalny hit target 44×44 px, ale nie definiuje on wysokości całego rzędu. Kod
`MENU_3_ROW_CLASS` + `MENU_3_INNER_CLASS` jest już zgodny wymiarowo; dokumentację zaktualizowano.

**Status:** ZAMKNIĘTA (bez zmiany runtime).

---

## D-03 — Preview listowy: `MyProjects.tsx` omija SSOT

**Co mówi dokument:** `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` §7.2 — szerokość preview
pochodzi WYŁĄCZNIE z komponentu (`StandardPreview`/`PreviewPaneShell`/`TableWithPreviewLayout`), zakaz
sztywnej szerokości na kontenerze preview typu `w-[420px]`, `w-[360px]`, `w-[460px]`. Ten sam paragraf już
nazywa `MyProjects.tsx` po imieniu jako naruszenie („Weryfikacja w kodzie 2026-08-02"), więc ten wpis
transkrybuje istniejące ustalenie, nie tworzy nowego sporu.

**Co mówi kod (zmierzone 2026-08-02):**
```
grep -n "w-\[420px\]" src/components/MyWork/MyProjects.tsx
  864:            <aside className="w-[420px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
  1084:           <aside className="w-[420px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">

grep -rln "TableWithPreviewLayout" src/ | wc -l   →  28
```

**Polecenie powtórzenia pomiaru:**
```bash
grep -n "w-\[420px\]" src/components/MyWork/MyProjects.tsx
grep -rln "TableWithPreviewLayout" src/ | wc -l
```

**Kierunek:** dług KODU. 28 plików już korzystają z SSOT (`TableWithPreviewLayout`, szerokość
`clamp(340px, 28%, 480px)` zaimplementowana na `TableWithPreviewLayout.tsx:437,455`); `MyProjects.tsx` jest
dwukrotny wyjątek, hard-coduje `w-[420px]` zamiast osadzać komponent. Dokument ma rację, kod ma dług
migracyjny na dwóch konkretnych liniach.

**Status:** OTWARTA.

---

## D-04 — Drawery `IdeaTableTool.tsx` poza zakresem 320–420 px

**Co mówi dokument:** `docs/ui-standards/00-foundation/FOUNDATION_TOKEN_CONTRACT.md` §4 — „preview/drawer
default 360 px", „preview/drawer zakres 320–420 px", „form drawer wide 420 px" (górna granica).
`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` CHANGELOG 2026-08-02 §9.1a konsoliduje pięć wcześniej
sprzecznych wartości do jednej i nazywa `IdeaTableTool.tsx` po imieniu: „`IdeaTableTool.tsx` używa 460/480
(poza zakresem)".

**Co mówi kod (zmierzone 2026-08-02):**
```
grep -n "w-\[4[68]0px\]" src/components/MyWork/IdeaTableTool.tsx
  4542:  w-[460px]   (Consultify Link Panel)
  4584:  w-[480px]   (Automations Manager)
  4616:  w-[480px]   (Sync Manager)
  4649:  w-[480px]
  4674:  w-[480px]
```

**Polecenie powtórzenia pomiaru:**
```bash
grep -n "w-\[4[68]0px\]" src/components/MyWork/IdeaTableTool.tsx
```

**Kierunek:** dług KODU. Wartość dokumentu jest już skonsolidowana i świadomie zdecydowana (2026-08-02,
patrz CHANGELOG cytowany wyżej); pięć drawerów w `IdeaTableTool.tsx` przekracza górną granicę 420 px o
40–60 px. Zastany dług do sprowadzenia do zakresu, nie druga legalna wartość.

**Status:** OTWARTA.

---

## D-05 — `primary-500`/`primary-600` jako tło/obramowanie poza fokusem

**Co mówi dokument:** CLAUDE.md „Pułapka nr 1": `primary` w tailwind = crimson `#85182F`. Czerwień
WYŁĄCZNIE semantyka krytyczna (danger/destructive); CTA/stany aktywne = neutralne. `check-artefakt.sh`
egzekwuje to już w powłoce artefaktów (`primary-*` KAŻDY numer zakazany, z ratchetem per plik); ten wpis
mierzy ten sam wzorzec w całym `src/`, nie tylko w zakresie tamtego hooka.

**Co mówi kod (zmierzone 2026-08-02):**
```
grep -rl "bg-primary-500\|bg-primary-600\|border-primary-500" src/ | wc -l   →  289
```

**Polecenie powtórzenia pomiaru:**
```bash
grep -rl "bg-primary-500\|bg-primary-600\|border-primary-500" src/ | wc -l
```

**Kierunek:** dług KODU. 289 plików wiążą tło lub obramowanie z paletą crimson poza kontekstem
krytycznym/destrukcyjnym — znacznie szerszy zasięg niż D-01 (fokus), bo obejmuje CTA i stany aktywne,
dokładnie ten wzorzec, który CLAUDE.md nazywa „pułapką nr 1". Ten pomiar jest surowy (nie odróżnia
świadomego użycia `danger`/`destructive` opisanego jako `bg-primary-600` od nadużycia jako CTA) — służy
jako punkt startowy skryptu `scripts/check-focus-canon.sh`, nie jako gotowa lista do ślepej naprawy.

**Status:** OTWARTA.

---

## Jak dodać wpis

1. Zmierz realnym poleceniem (`grep`/inny odczyt kodu) — nie cytuj innego dokumentu ani audytu.
2. Wpis MUSI zawierać: co mówi dokument (plik + sekcja/linia), co mówi kod (plik + linia + liczba),
   polecenie, którym każdy może powtórzyć pomiar, kierunek rozstrzygnięcia (`dług dokumentu` /
   `dług kodu` / `NIEROZSTRZYGNIĘTA`) i datę pomiaru.
3. Jeśli kierunek nie jest oczywisty — napisz `NIEROZSTRZYGNIĘTA` wprost. Zgadywanie „na oko", która strona
   ma rację, jest dokładnie tym błędem, który ten rejestr ma powstrzymać.
4. Zakaz wpisów bez liczby. „Dokumentacja mówi X, kod chyba robi Y" nie jest wpisem — jest hipotezą do
   zmierzenia najpierw.
5. Wpis starzeje się. Jeśli od `last_measured` minęło więcej niż ~2 tygodnie i wpis wpływa na bieżącą
   decyzję, powtórz pomiar przed użyciem liczby dalej.
