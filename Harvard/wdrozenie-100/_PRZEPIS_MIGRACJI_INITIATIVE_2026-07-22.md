# PRZEPIS MIGRACJI — artefakt INITIATIVE (na wiążący kontrakt karty)

> **Status:** RECON/PREP (nie migracja). Zero edycji komponentu produktu, zero push. Ten dokument to
> GOTOWY PRZEPIS, który armia wykona **po akcepcie POC (Decision) przez Piotra**, artefakt-po-artefakcie,
> za flagą OFF (CLAUDE.md #7/#9). **INITIATIVE = OSTATNI** w kolejce (KONTRAKT §9, R1) — najtrudniejszy:
> własny silnik (katalog w DB `initiative_section_types` + szablony per-org), 29 kart, nowy rdzeń, zejście
> z „pokaż wszystko".
>
> **Baza dowodów:** worktree `fix/prv-mywork-preview` (origin/demo). Każde twierdzenie: `plik:linia` albo
> jawne **„DO DECYZJI PIOTRA"**. SSOT modelu: `_KANON_KARTY_MODEL_2026-07-22.md`; kontrakt:
> `_KONTRAKT_KARTY_SSOT_2026-07-22.md`; typ: `src/components/standard/cardContract.types.ts`; bramka:
> `scripts/check-artefakt-struktura.mjs`.

---

## 0. TL;DR — jedną kartką

- **Initiative NIE używa `cardSets.ts`.** Renderuje własnym silnikiem: katalog z DB (`initiative_section_types`,
  seed `529`+`541`) → `SECTION_REGISTRY` (29 kluczy, `registry.ts:50-83`) → 2-kolumnowy layout
  (`InitiativeDocumentView.tsx:2133-2189`). To jest **System B** z D-7 — nadzbiór, którego kontrakt wchłania.
- **Adapter jest INNY niż dla Decision/Task/Insight.** Tam: statyczny `*_SPEC` (TS) → `KanonicznaKarta[]`.
  Tu: **DB rows + registry + DEFAULT_VISIBLE/ORDER → `KanonicznaKarta[]`** (adapter „DB→kanon", cardContract §31).
- **Mapowanie 29 → 26 kanonicznych** (§1): 21 rodziny Initiative + 5 wspólnych (dedup), + 2 martwe
  (`initiativeTeam`→`team`, `linkedItems`→`attachments`) + 1 placeholder (`watchers`).
- **Baseline bramki DZIŚ (§4):** Initiative = **FLAGA**, jedyny twardy defekt = **13 crimson w centrum**
  (głównie `InitiativeGatesWorkflowTable.tsx`). Powłoka OK (ArtifactRightPanel + kolejność kanoniczna).
- **Gotowość: TRUDNA** (§5) — 7 realnych ryzyk z dowodem, w tym dual-path render, rozjazd `key`↔`component_key`,
  org-custom bez id kanonicznego, martwy `INITIATIVE_SPEC` (nabity pistolet), zmiana widoczności domyślnej.

---

## 1. DESKRYPTOR — 29 kart Initiative → kanoniczne id (aliasy rozwiązane)

Źródło prawdy id = **kod** (registry.ts, kolejność jak w pliku). Rola AI wg KANON §2.2. Kompozycja wg
KONTRAKT §8.3 (D-4 rdzeń `overview`+`control`; D-5 domyślny = „minimal"-7). Klasa artefaktu = **L**
(`standard/registry.ts:84` — Initiative L). „Kan.#" = numer w katalogu kanonicznym (KANON §2.2).

### 1.1 LEWA KOLUMNA — content (16 kluczy registry)

| # | klucz registry | kanoniczne id | kan.# | rola AI | kompozycja (Initiative) | status | dowód |
|--:|----------------|---------------|:----:|---------|-------------------------|--------|-------|
| 1 | `overview` | `overview` | 17 | pisze | **RDZEŃ** (D-4, dziś dom.) | czysta | `registry.ts:52`; DB `529:107`; cardSets(martwy) `:235 core:true` |
| 2 | `problemDefinition` | `problemDefinition` | 18 | pisze | domyślna (minimal-7) | czysta | `registry.ts:53`; `529:110`; prompt `542:...WHERE key='problemDefinition'` |
| 3 | `targetState` | `targetState` | 19 | pisze | domyślna (minimal-7) | czysta | `registry.ts:54`; `529:113` |
| 4 | `scope` | `scope` | 20 | pisze | domyślna (minimal-7) | czysta | `registry.ts:55`; `529:116` |
| 5 | `tasks` | `tasks` | 21 | pisze | domyślna (minimal-7) | czysta | `registry.ts:56`; `529:119` |
| 6 | `decisions` | `decisions` | 22 | pisze | dodawalna | czysta | `registry.ts:57`; `529:122` |
| 7 | `raid` | `raid` | 23 | pisze | dodawalna | czysta | `registry.ts:58`; `529:125` |
| 8 | `gates` | `gates` | 24 | pisze | dodawalna | czysta (★ crimson w centrum, §4) | `registry.ts:59`; `529:128` |
| 9 | `financialAnalysis` | `financialAnalysis` | 25 | pisze | dodawalna | **ROZJAZD**: „enum dead per F0" | `registry.ts:60`; `529:131`; KANON §2.3 |
| 10 | `financialImpact` | `financialImpact` | 26 | pisze | dodawalna | czysta | `registry.ts:61`; `529:134` |
| 11 | `kpis` | `kpis` | 27 | pisze | domyślna (minimal-7) | czysta | `registry.ts:62`; `529:137` |
| 12 | `competencyRequirements` | `competencyRequirements` | 28 | asystuje (brak promptu) | dodawalna | **ROZJAZD**: brak wiersza DB | `registry.ts:63`; **brak w `529`** (seed kończy `watchers` `:178`) |
| 13 | `skillsGap` | `skillsGap` | 29 | asystuje (brak promptu) | dodawalna | **ROZJAZD**: brak wiersza DB; ma tab. `skills_gap` | `registry.ts:64`; **brak w `529`** |
| 14 | `pilot` | `pilot` | 30 | pisze | **ukryta-domyślna** | czysta | `registry.ts:65`; `529:140`; `DEFAULT_VISIBLE...pilot:false :165` |
| 15 | `comments` | `comments` | 47 (WSPÓLNA) | transakcyjna | domyślna | czysta | `registry.ts:66`; `529:143` |
| 16 | `history` | **`activity-log`** (alias) | 48 (WSPÓLNA) | systemowa | domyślna | alias `history`→`activity-log` | `registry.ts:67`; `529:146` |

### 1.2 PRAWA KOLUMNA — control / meta (13 kluczy registry)

| # | klucz registry | kanoniczne id | kan.# | rola AI | kompozycja (Initiative) | status | dowód |
|--:|----------------|---------------|:----:|---------|-------------------------|--------|-------|
| 17 | `control` | `control` | 31 | pisze/asystuje | **RDZEŃ** (D-4, dziś dom.) | czysta | `registry.ts:70`; `529:151`; cardSets(martwy) `:307 core:true` |
| 18 | `team` | `team` | 32 | dane (brak promptu) | domyślna | czysta | `registry.ts:71`; `529:154` |
| 19 | `initiativeTeam` | **`team`** (martwa) | 32 | — | **UŚMIERCIĆ** | martwa: dubluje `team`, brak typu DB | `registry.ts:72`; `DEFAULT_VISIBLE...false :167`; order „Legacy" `:129` |
| 20 | `raciEscalation` | **`governance`** (alias) | 51 (WSPÓLNA) | asystuje | ukryta-domyślna | **ROZJAZD kluczy** (R2) | `registry.ts:73`; DB key=`raci`→component=`raciEscalation` `541:7` |
| 21 | `timeline` | `timeline` | 33 | dane (brak promptu) | domyślna | czysta | `registry.ts:74`; `529:157` |
| 22 | `resources` | `resources` | 34 | pisze | domyślna | czysta | `registry.ts:75`; `529:160` |
| 23 | `stakeholders` | `stakeholders` | 35 | dane | domyślna | czysta (nakłada się z `raci`) | `registry.ts:76`; `529:163` |
| 24 | `dependencies` | `dependencies` | 50 (WSPÓLNA) | dane | domyślna | czysta | `registry.ts:77`; `529:166` |
| 25 | `attachments` | `attachments` | 49 (WSPÓLNA) | dane | domyślna | czysta | `registry.ts:78`; `529:169` |
| 26 | `linkedItems` | **`attachments`** (martwa) | 49 | — | **UŚMIERCIĆ** | martwa: brak typu DB, dubluje `attachments` | `registry.ts:79`; `DEFAULT_VISIBLE...false :169` |
| 27 | `tags` | `tags` | 36 | dane | domyślna | czysta | `registry.ts:80`; `529:172` |
| 28 | `reminders` | `reminders` | 37 | dane/reguły | domyślna | czysta | `registry.ts:81`; `529:175` |
| 29 | `watchers` | **placeholder** | — | (brak) | ukryta-domyślna | **do-decyzji**: mapuje na `OverviewSection` | `registry.ts:82` (`OverviewSection // simpler UI`); `529:178`; `DEFAULT_VISIBLE...false :166` |

**Bilans:** 29 kluczy → 26 żywych kanonicznych (21 rodzina Initiative #17-37 + 5 wspólnych #47-51),
− 2 martwe zwinięte (`initiativeTeam`→`team`, `linkedItems`→`attachments`), − 1 placeholder (`watchers`).

### 1.3 Rdzeń i zestaw domyślny (D-4 / D-5 — ZABLOKOWANE, KONTRAKT §0)

- **RDZEŃ (nieusuwalny):** `overview` + `control`. Dziś registry NIE zna pojęcia `core` — to najważniejsza
  rzecz, którą kontrakt DAJE Initiative (KANON §3.2; cardSets martwy już deklaruje `core:true` `:235,307`).
- **ZESTAW DOMYŚLNY = „minimal"-7:** `overview, problemDefinition, targetState, scope, tasks, kpis, control`
  (KONTRAKT §0 D-5). Dziś Initiative = „pokaż wszystko" 24/29 (`DEFAULT_VISIBLE_SECTIONS`, `registry.ts:138-170`).
  **To jest zmiana WIDZIALNA** (R6) — za flagą, do akceptu na zrzucie.

---

## 2. KROKI MIGRACJI (wykonywalne — armia po akcepcie POC)

> Każdy krok = addytywny, za flagą OFF, dane DB **nietknięte**. Wzorzec pętli: KONTRAKT §9 KROK 2.
> Higiena robotnika: esbuild per plik, **NIE** pełny tsc/vitest (CLAUDE.md HIGIENA).

**KROK 1 — Adapter DB→kanon (NOWY plik, nieużywany na starcie).**
Utwórz `src/components/Initiatives/sections/initiativeCardContract.ts` (nowy). Eksportuj funkcję
`buildInitiativeCanonicalCards(dbRows: SectionTypeInfo[]): KanonicznaKarta[]` która dla każdego z 29
kluczy woła `definiujKarteKanoniczna(...)` z `cardContract.types.ts`. Mapuj wg deskryptora §1:
- rola AI + `aiPrompt` (treść z DB `ai_prompt_template` albo `BrakAiPrompt{reason}` dla `dane/systemowa/transakcyjna`),
- kompozycja: `{ artefakt:'initiative', rola, klasa:'L', kolumna, kolejnosc, idWArtefakcie? }`,
- aliasy: `history`→`activity-log`, `raciEscalation`→`governance` (z `idWArtefakcie:'raciEscalation'`
  ORAZ notatką że DB key=`raci`), `linkedItems`→`attachments`, `initiativeTeam`→`team`,
- `statusKanonu` wg kolumny „status" deskryptora (rozjazd/martwa/do-decyzji).
Zero importu z tego pliku w produkcie (jak zalążek typu). Test zakresowy tsc na 2-plikowym grafie.

**KROK 2 — Rozstrzygnij źródło katalogu (R1) PRZED wpięciem.**
Adapter musi czytać z JEDNEGO źródła. Dziś render ma **dwie ścieżki** (`InitiativeDocumentView.tsx:2135-2169`):
DB rows (25 kluczy: 24 z `529` + `raci` z `541`) **albo** fallback `DEFAULT_VISIBLE_SECTIONS` (29 kluczy z
registry). Wybór = **DO DECYZJI PIOTRA** (§5 R1). Rekomendacja techniczna: kanon = **registry (29)** jako
nadzbiór, DB rows dokładają `ai_prompt_template`/`org-custom`; 4 klucze bez wiersza DB
(`competencyRequirements, skillsGap, initiativeTeam, linkedItems`) dostają `statusKanonu:'rozjazd'/'martwa'`.

**KROK 3 — Nowy rdzeń + węższy domyślny za flagą (D-4/D-5).**
Dodaj flagę `ENABLE_INITIATIVE_CARD_CONTRACT` (default OFF). Pod flagą: (a) `overview`+`control` nieusuwalne
(egzekwuj w UI usuwania jak `useCardLayout.ts:190` robi dla `core`); (b) domyślna widoczność = minimal-7
zamiast „pokaż wszystko" — NIE nadpisuj DB, tylko podmień `DEFAULT_VISIBLE_SECTIONS` konsumowane w
`InitiativeDocumentView.tsx:2123,2138` za flagą. Bez flagi — stare zachowanie 1:1.

**KROK 4 — Uśmierć martwe + rozstrzygnij placeholder.**
`initiativeTeam` (`registry.ts:72`) i `linkedItems` (`:79`) — usuń z registry LUB oznacz jako alias-only
(nie renderowane). `watchers` (`:82`, mapuje na `OverviewSection`) — DO DECYZJI PIOTRA (własny UI czy skreślić).
Uwaga: usunięcie kluczy z registry zmienia fallback-path (§KROK 2) — rób razem z KROK 2.

**KROK 5 — Domknij dług strukturalny bramki (§4).**
Napraw 13 crimson w centrum (głównie `InitiativeGatesWorkflowTable.tsx`, lista w §4) → `c-*`/neutralne
tokeny (crimson TYLKO semantyka krytyczna, CLAUDE.md #3). Cel: `check-artefakt-struktura.mjs --strict`
na Initiative = zielono.

**KROK 6 — Rozszerz bramkę o test (e) rozjazdu id (R2, opcjonalne w tej fali).**
Do `check-artefakt-struktura.mjs` dodaj test „każdy renderowany klucz Initiative ma wpis w katalogu
kanonicznym i odwrotnie" (analogicznie do `scanSectionIds`/`ID_KEY_RE:119`). Musi ogarnąć DUA identyfikatory
DB (`key` vs `component_key`) i org-custom (R4). To domyka egzekwowanie `klasa` (cardContract §4.4).

**KROK 7 — JA renderuję harness (reguła #7).**
Wyrenderuj `InitiativeDocumentView` w harnessie z mock-danymi (wzór: harness EV football-field), **oba motywy
(dark+light)**, zrzut czysty (zero gwiazdek/ozdób, tokeny `c-*`). Weryfikacja: rdzeń nieusuwalny (brak „X" na
overview/control), minimal-7 widoczne, reszta dodawalna. **DOPIERO potem Piotr patrzy — do AKCEPTU.**

**KROK 8 — BRAMA + re-tag.** Akcept Piotra na zrzutach → flaga domyślna ON + re-tag `demo-safe-<data>`
(reguła #8). Rollback: flaga OFF natychmiast; adapter addytywny → stary render wraca bez migracji danych.

---

## 3. ROZJAZDY / DECYZJE (teed-up — nie blokują struktury)

Wszystkie z KANON §2.3 / KONTRAKT §10, dotyczące Initiative:
- `competencyRequirements` / `skillsGap` — **zaseedować w DB** (`529`) czy zostawić fallback-only? (dziś brak wiersza)
- `raciEscalation` vs `raci` — **który klucz kanoniczny?** (DB/nawigacja=`raci` `541:7`, registry=`raciEscalation`)
- `financialAnalysis` — **żywy enum czy martwy?** (DB aktywna, komentarz „enum is dead per F0")
- `watchers` — **własny UI** czy **skreślić**? (dziś `OverviewSection` placeholder)
- `initiativeTeam` / `linkedItems` — potwierdzić uśmiercenie (zamienniki: `team` / `attachments`)
- D-5: potwierdzić skład minimal-7 (dziś kandydat) jako domyślny zestaw Initiative.

---

## 4. BASELINE BRAMKI (dług strukturalny DZIŚ, przed migracją)

`node scripts/check-artefakt-struktura.mjs` — Initiative (tryb raportu, exit 0):

```
▌ Initiative — src/components/Initiatives/InitiativeDocumentView.tsx
  (a) Menu 1 / NModeHeader : ✓ wprost <NModeHeader> (obejście NModeShell)   ← MIĘKKI sygnał
  (b) ArtifactRightPanel   : ✓ używa
  (c) Sekcje panelu        : [actions, properties, relations, evidence, comments, history]
        ✓ kolejność        : zgodna z kanonem
  (d) Crimson w centrum    : ✗ 13 naruszeń (skan 13 plików centrum)
  → STRUKTURA: FLAGA — crimson w centrum: 13
     wejście do kontraktu: Menu 1 wprost, z pominięciem NModeShell
```

- **Jedyny TWARDY defekt = 13 crimson w centrum.** Lokalizacje (pierwsze 8 z raportu):
  `InitiativeGatesWorkflowTable.tsx:130,131,154,155,957,1200,1254,1336` (+5 więcej w tym samym pliku/centrum).
- **Powłoka: CZYSTA** — ArtifactRightPanel obecny, kanoniczna kolejność 6 sekcji poprawna, evidence na miejscu.
- **Miękkie** (wejście do kontraktu, nie defekt): Menu 1 renderowane wprost `<NModeHeader>` z pominięciem
  `<NModeShell>` (świadome — jak Decision/Task/Notification).
- Kontekst całości: 7 artefaktów, 6 z twardym defektem, suma crimson w centrum = **100** (Initiative wnosi 13).

**Wniosek:** dług strukturalny Initiative jest MAŁY i skupiony (1 twardy defekt, 1 plik-centrum dominujący).
Powłoka nie wymaga pracy. `--strict` zielony = naprawa crimson w `InitiativeGatesWorkflowTable.tsx` (KROK 5).

---

## 5. RYZYKA (co pęknie — z dowodem plik:linia)

- **R1 — DUAL-PATH render (katalog DB vs fallback registry).** `InitiativeDocumentView.tsx:2135-2169`:
  gdy `sectionTypes.length>0` → katalog z DB (25 kluczy); inaczej → `DEFAULT_VISIBLE_SECTIONS` (29 z registry).
  Cztery klucze (`competencyRequirements`, `skillsGap`, `initiativeTeam`, `linkedItems`) SĄ w registry
  (`registry.ts:63,64,72,79`) ale **NIE w seedzie DB** (`529` kończy `watchers` `:178`). Skutek: te karty
  renderują się TYLKO na ścieżce fallback, znikają gdy DB zaseedowane. Adapter musi wybrać jedno źródło —
  inaczej katalog kanoniczny rozjeżdża się per-środowisko. **Waga: WYSOKA.**

- **R2 — rozjazd `key` ↔ `component_key` (kebab/camel/dwa-id).** DB `initiative_section_types` niesie DWA
  identyfikatory: `key` (widoczność, `visible_sections`) i `component_key` (rejestr). Dla `raci`: `key='raci'`
  ale `component_key='raciEscalation'` (`541:7`). Render filtruje po `st.key` a rozwiązuje komponent po
  `st.componentKey` (`InitiativeDocumentView.tsx:2172-2173`). Historia footguna: migracja `542` powstała bo
  wcześniejszy seed promptów użył snake_case (`problem_definition`) niepasującego do camelCase `key`
  (`problemDefinition`), zostawiając `ai_prompt_template` NULL (`542:5-8`). Adapter, który re-derywuje klucze,
  **powtórzy ten błąd**. **Waga: WYSOKA.**

- **R3 — martwy `INITIATIVE_SPEC` = nabity pistolet.** `cardSets.ts:228-411` (25 kart, stale) jest
  zarejestrowany w `DEFAULT_CARD_SETS.initiative` (`cardSets.ts:582`) i osiągalny przez
  `getCardSpec('initiative')` / `useCardLayout` (`useCardLayout.ts:149`). DZIŚ martwy — **0 konsumentów**
  Initiative (grep `NModeCardManager`/`useCardLayout` w `src/components/Initiatives/` = pusto). ALE jeśli
  migracja naiwnie poprowadzi Initiative przez `useCardLayout` (jak robi Decision, `DecisionDetailView.tsx:1363`),
  wciągnie 25-kartowy STALE spec zamiast 29 z registry. **Uśmiercić/wyregenerować `INITIATIVE_SPEC` z registry
  albo NIGDY nie routować Initiative przez `useCardLayout`.** **Waga: WYSOKA.**

- **R4 — org-custom bez id kanonicznego.** `initiative_section_types.organization_id` (`529:15`, indeks
  `529:95`) pozwala na sekcje per-organizacja; szablony niosą `visible_sections`/`section_order`/`section_config`
  (`529:184-187`, migracje `526`/`531`/`513`). Wiersz org-custom (`organization_id != NULL`) to karta BEZ wpisu
  w katalogu kanonicznym (51 id jest zamknięte). Test (e) bramki „każda sekcja ma wpis w katalogu"
  (KROK 6) **sflaguje org-custom jako rozjazd**. cardContract ma `orgCustomizowalna` (`cardContract.types.ts:221`)
  ale katalog kanoniczny jest stały → potrzebna świadoma ścieżka „karta org-custom = poza katalogiem, dozwolona".
  **Waga: ŚREDNIA-WYSOKA** (zależy czy demo ma org-custom rows — stan ŻYWEJ bazy niesprawdzony, patrz §6).

- **R5 — zmiana widoczności domyślnej (D-5) = regresja wizualna.** Zejście z „pokaż wszystko" (24/29,
  `registry.ts:138-163`) do minimal-7 zmienia KAŻDĄ inicjatywę bez jawnego szablonu (`visibleSections`
  fallback `InitiativeDocumentView.tsx:2123`). To dokładnie klasa zmiany, przed którą chroni reguła #9
  (masowe włączenie). **Musi być za flagą + akcept na zrzucie.** **Waga: ŚREDNIA** (mitygacja: flaga OFF).

- **R6 — 13 crimson w centrum blokuje `--strict`.** `InitiativeGatesWorkflowTable.tsx:130,131,154,155,957,
  1200,1254,1336` (+5) — `primary-*`/`c-accent` w centrum karty `gates`. Dopóki nieposprzątane,
  `check-artefakt-struktura.mjs --strict` = exit 1 na Initiative (KROK 5 to domyka). **Waga: NISKA** (skupione).

- **R7 — sieroty zależne + `raci`/`stakeholders` nakładka.** `stakeholders` (`529:163`, „Stakeholders RACI")
  i `raciEscalation`/`raci` (`541:7`, „RACI & Escalation") pojęciowo się nakładają — obie mapują RACI. Kanon
  zwija `raciEscalation`→`governance` (#51), ale `stakeholders` zostaje osobno (#35). Ryzyko podwójnej karty
  RACI na ekranie po migracji. **Waga: NISKA-ŚREDNIA** — do przeglądu przy KROK 3. Dowód: `529:163` vs `541:7`.

---

## 6. CZEGO NIE ZWERYFIKOWANO (uczciwie)

- **Osobiście otwarte:** `registry.ts` (cały), `529`+`541` (cały seed), `check-artefakt-struktura.mjs` (cały),
  `cardContract.types.ts` (cały), `InitiativeDocumentView.tsx:2100-2189` (render sekcji) + `:80-82,199,2172`
  (importy/filtr), `cardSets.ts:228-411,578-590` (martwy spec + mapa), `useCardLayout.ts:149,190`, `542:1-40`
  (fix kluczy).
- **ŻYWA baza demo — NIESPRAWDZONA.** Nie odpytano `initiative_section_types` na demo: ile wierszy realnie
  zaseedowanych, czy istnieją org-custom (`organization_id != NULL`), czy `ai_prompt_template` wypełnione po
  `542`. R1/R4 zakładają stan z migracji, nie z żywych rekordów (ZŁOTA REGUŁA #1 — do potwierdzenia przed
  wpięciem). **DO ZWERYFIKOWANIA przez armię na żywej bazie przed KROK 2.**
- **Liczba promptów Initiative** (KANON „13/26") nie policzona per-wiersz — prompty rozsiane w `530`, `539`,
  `540`, `541`, `542`, `20260628`, `20260702`; `529` sam NIE seeduje `ai_prompt_template` (INSERT 15 kolumn,
  bez promptu, `529:106-107`).
- **Pełny `tsc`/`vitest`** — NIE uruchamiany (zakaz higieny). Bramka strukturalna: uruchomiona (§4).
- **Harness render** — nie wykonany (to RECON; render = KROK 7 fazy migracji).
