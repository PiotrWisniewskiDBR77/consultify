# KANON KARTY — jeden model kanoniczny (best-of, decyzja D-7)

> **Dla:** Piotr (nie-koder). **Co to jest:** JEDEN model karty, wypracowany jako *best-of* z dwóch
> dzisiejszych systemów — zgodnie z Twoją decyzją **D-7**: *„weź najlepsze z tego jak wyglądają Decyzje
> i Taski, weź najlepsze z Inicjatyw, stwórz jeden kanon i użyj go jako standard."* To **NIE** jest
> „cardSets kasuje Initiative". To **nadzbiór**: model cardSets (czyste dane, egzekwuje `core`) WCHŁANIA
> najlepsze z Initiative (prompt AI per karta, opis, kolumny, szablony widoczności per-instancja).
>
> **To jest PROJEKT (dokument + zalążek typu), NIE migracja.** Zero zmian w 7 artefaktach. Powstały tylko:
> ten dokument + nowy, **nieużywany** plik typu `src/components/standard/cardContract.types.ts` (§4).
> Migracja artefaktów = OSOBNY etap PO Twoim akcepcie, POC-first (CLAUDE.md reguła #9).
>
> **Baza dowodów:** worktree `fix/prv-mywork-preview` (origin/demo). Każde twierdzenie: `plik:linia`,
> albo jawne **„DO DECYZJI PIOTRA"** (gdy kodu brak — nie zgadujemy).
>
> **Poprzednicy (ten dokument je scala w jeden model):** `_KONTRAKT_KARTY_SSOT_2026-07-22.md` (tabela master
> 100 kart), `_DWA_SYSTEMY_KART_MAPA_2026-07-22.md` (A vs B), `_ROZJAZD_TAKSONOMIA_KART_2026-07-22.md`
> (kod vs doc), `_WIDMA_ODWOLANIA_KART_2026-07-22.md` (martwe cytaty).

---

## 0. TL;DR — jedną kartką

- **Jeden schemat karty** (9 pól, §1). Bierze etykietę+`core` z **A** (`cardSets.ts`), a opis+prompt AI+kolumnę
  z **B** (Initiative DB). Dokłada trzy pola, których DZIŚ NIE MA nigdzie jako deklaracja: **rola AI**,
  **próg** (placeholder) i **klasa artefaktu S/L**.
- **Katalog zunifikowany: 65 żywych kart → 51 kanonicznych id** (§2). Dedup zdejmuje 14 dubli
  (`comments` ×4, `activity-log`/`history` ×4, `attachments`/`attachments-links`/`resources-links` ×3,
  `dependencies` ×2, `governance`/`governance-escalation` ×2) do jednego wpisu każdy.
- **9 kart rozjechanych** dostaje jawny werdykt (§2.3): `competencyRequirements`/`skillsGap` (brak wiersza DB),
  `initiativeTeam`/`linkedItems` (martwe dublety), `watchers` (placeholder), `raciEscalation` (rozjazd klucza
  `raci`), `material-quality`/`traceability` (tylko DOC „wymagane", brak kodu → DO DECYZJI).
- **Model kompozycji** (§3): każdy artefakt = **rdzeń nieusuwalny** + **węższy zestaw domyślny** (NIE „pokaż
  wszystko") + dodawalne. Szablony Initiative (`visible_sections` per-inicjatywa) wchłonięte jako **„zestaw
  generowany"**, nie drugi silnik.
- **Egzekwowanie D-8** (§4): nowy typ `cardContract.types.ts` czyni stany niedozwolone **martwymi typem** —
  karta bez `id`/`label`/`roli`/`kompozycji` = **błąd kompilacji** (zweryfikowane: tsc `@ts-expect-error`
  skonsumowane, exit 0). Bramka `check-artefakt-struktura.mjs` (już istnieje) dokłada egzekwowanie strukturalne.

---

## 1. SCHEMAT KANONICZNEJ KARTY (9 pól)

Każda karta w systemie deklaruje **9 pól**. Kolumna „skąd" pokazuje *best-of* — z którego systemu pole pochodzi.

| # | Pole | Znaczenie | Skąd (best-of) | Dowód |
|---|------|-----------|----------------|-------|
| 1 | **id** (kanoniczny) | stały identyfikator = id sekcji renderowanej przez artefakt | **A** (kod = prawda) | `cardSets.ts:35`; Initiative `registry.ts:50-83` |
| 2 | **label** (en/pl) | dwujęzyczna etykieta | **A** `label{en,pl}` + **B** `name`/`name_pl` | `cardSets.ts:37`; `529_...sql:19-20` |
| 3 | **opis** (en/pl) | „co karta ma zawierać" (zakres treści) | **B** (A tego nie ma) | `529_...sql:21-22` (`description`/`description_pl`) |
| 4 | **grupa** | kubełek layoutu (CONTENT / BETWEEN THE LINES / EVIDENCE / CONTROL / AUDIT) | **A** `group` + **B** `category` | `cardSets.ts:41`; `529_...sql:25` |
| 5 | **rola_AI** | pisze · asystuje · dane · systemowa · transakcyjna | **NOWE** (dziś rozproszone w promptach) | KONTRAKT §2 „brak jednej deklaracji" |
| 6 | **ai_prompt** | szablon generacji treści (albo jawny brak z powodem) | **B** `ai_prompt_template` | `529_...sql:38` |
| 7 | **prog** | kiedy karta „gotowa" — **PLACEHOLDER na decyzję** | **NOWE** (w kodzie brak progu per-karta) | KONTRAKT §2 „★ prawda o progu" |
| 8 | **kompozycja** | rdzeń · domyślna · dodawalna · ukryta-domyślna (per artefakt) | **A** `core` + **B** `column_position`/`default_order`/szablon | `cardSets.ts:48`; `529_...sql:26-27` |
| 9 | **klasa artefaktu** | S (drawer, ≤4 sekcje) / L (pełna strona) | **NOWE** (SSOT: `standard/registry.ts`) | `registry.ts:46` (`KartaNKlasa`) |

Dodatkowo (higiena, nie „pole treści"): **statusKanonu** (czysta / rozjazd / martwa / do-decyzji) — uczciwa flaga
z audytu, żeby karta nie udawała, że wszystko czyste; **orgCustomizowalna** (nadzbiór B `organization_id`,
`529_...sql:15`).

### 1.1 Trzy pola, których DZIŚ NIE MA (i dlatego karty się rozjeżdżają)

- **rola_AI (5).** Dziś nie istnieje jako deklaracja — wynika pośrednio z tego, czy istnieje serwis generacji.
  Skutek: 13/26 sekcji Initiative ma prompt, Decision 4/8, Task 4/10 — **reszta MILCZY**
  (`StandardArtifactShell.types.ts:116-117`). Kanon czyni z niej pole wymagane i **wiąże z promptem** (§4.2).
- **prog (7).** KONTRAKT §2 (★): *w całym kodzie NIE MA progu kompletności per-karta*. Są tylko: scoring CAŁEJ
  karty ≥90 dla insight/initiative (`cardContentFormulaValidator.ts:59`) i doradcze minima pól
  (`cardContentValidator.ts:78-101`, jawnie „ADVISORY ONLY … never to block"). Kanon **nie wymyśla liczby** —
  koduje BRAK decyzji jako pełnoprawny wariant (`do-decyzji-piotra`) i cytuje najbliższą realną liczbę jako
  kontekst. **Decyzje D-1/D-2/D-3 pozostają otwarte.**
- **klasa S/L (9).** Istnieje jako `KartaNKlasa` w `standard/registry.ts:46`, ale **nie na poziomie karty**.
  Kanon niesie ją na przynależności (S ⇒ artefakt ≤4 sekcje lewej kolumny — SPEC-N §2.1).

---

## 2. KATALOG ZUNIFIKOWANY — 65 żywych kart → 51 kanonicznych id

### 2.1 Skąd „100" i skąd „65"

Nagłówek zadania mówi o ~100 kartach. Uczciwy rachunek z **żywego kodu**:

| Źródło | Liczba | Status |
|--------|-------:|--------|
| Insight `INSIGHT_SPEC.catalog` (`cardSets.ts:71-223`) | 18 | żywe |
| Initiative `SECTION_REGISTRY` (`registry.ts:50-83`) | 29 | żywe |
| Decision `DECISION_SPEC.catalog` (`cardSets.ts:416-489`) | 8 | żywe |
| Task `TASK_SPEC.catalog` (`cardSets.ts:494-576`) | 10 | żywe |
| **Suma żywa** | **65** | **wpięte w runtime** |
| cardSets `INITIATIVE_SPEC` (`cardSets.ts:228-411`) | 25 | **martwa kopia** (0 konsumentów, DWA_SYSTEMY §3a) |
| DOC §7 `n-mode-card-standard.md` (Insight 4 · Decision 8 · Task ~9 · Initiative ~10) | ~31 | **martwe w kodzie** (ROZJAZD §2) |

„~100" = **65 żywych + ~35 widm** (martwa kopia cardSets-initiative + taksonomia DOC §7). Kanon buduje się na
**65 żywych** (kod = prawda — ROZJAZD §0.1), a widma DOC trafiają do §2.3 jako alias / backlog / DO DECYZJI.

### 2.2 Katalog kanoniczny — 51 id (zdeduplikowane)

Legenda ról kompozycji: **rdzeń** = nieusuwalna · **dom.** = domyślnie widoczna · **dod.** = dodawalna
(poza domyślnym) · **ukr.** = ukryta-domyślna. „Artefakty" = gdzie karta żyje (po dedup).

#### A. Rodzina INSIGHT — treść pisze AI (16 id)

| # | kanoniczny id | label (pl) | rola AI | kompozycja (Insight) | dowód |
|---|---------------|-----------|---------|----------------------|-------|
| 1 | `executive-summary` | Podsumowanie | pisze | **rdzeń** | `cardSets.ts:85` |
| 2 | `artifact-actions` | Dalsze akcje | pisze | **rdzeń** | `cardSets.ts:78` |
| 3 | `consulting-readout` | Odczyt konsultingowy | pisze | dom. | `cardSets.ts:88` |
| 4 | `themes` | Tematy | pisze | dom. | `cardSets.ts:93` |
| 5 | `issues-risks` | Problemy i ryzyka | pisze | dom. | `cardSets.ts:95` |
| 6 | `opportunities` | Przestrzenie szans | pisze | dom. | `cardSets.ts:101` |
| 7 | `evidence-map` | Mapa dowodów | pisze | dom. | `cardSets.ts:143` |
| 8 | `candidate-triage` | Wnioski i dowody | pisze | dom. | `cardSets.ts:149` (label drift — §2.3) |
| 9 | `source-pack` | Źródła | dane/AI | dom. | `cardSets.ts:154` |
| 10 | `report-pack` | Pakiet raportu | pisze | dom. | `cardSets.ts:156` |
| 11 | `people` | Perspektywy | pisze | dod. (full) | `cardSets.ts:107` |
| 12 | `signals` | Sygnały | pisze | dod. (full) | `cardSets.ts:113` |
| 13 | `analysis-matrix` | Macierz analizy | pisze | dod. (full) | `cardSets.ts:119` |
| 14 | `consensus-divergence` | Zgoda i rozbieżności | pisze | dod. (full) | `cardSets.ts:125` |
| 15 | `implicit-assumptions` | Ukryte założenia | pisze | dod. (full) | `cardSets.ts:131` |
| 16 | `silences` | Przemilczenia | pisze | dod. (full) | `cardSets.ts:137` |

#### B. Rodzina INITIATIVE — treść pisze AI + kontrola (21 id)

| # | kanoniczny id | label (pl) | rola AI | kompozycja (Initiative) | dowód |
|---|---------------|-----------|---------|-------------------------|-------|
| 17 | `overview` | Opis inicjatywy | pisze | **rdzeń** (dziś dom.) | `cardSets.ts:235`; `registry.ts:140` |
| 18 | `problemDefinition` | Definicja problemu | pisze | dom. | `registry.ts:141` |
| 19 | `targetState` | Stan docelowy | pisze | dom. | `registry.ts:142` |
| 20 | `scope` | Zakres i rezygnacja | pisze | dom. | `registry.ts:143` |
| 21 | `tasks` | Zadania i kamienie milowe | pisze | dom. | `registry.ts:144` |
| 22 | `decisions` | Decyzje | pisze | dom. | `registry.ts:145` |
| 23 | `raid` | Rejestr RAID | pisze | dom. | `registry.ts:146` |
| 24 | `gates` | Bramki / gotowość | pisze | dom. | `registry.ts:147` |
| 25 | `financialAnalysis` | Analiza finansowa | pisze | dom. (ROZJAZD „enum dead" — §2.3) | `registry.ts:148` |
| 26 | `financialImpact` | Wpływ finansowy (P&L) | pisze | dom. | `registry.ts:149` |
| 27 | `kpis` | KPI i korzyści | pisze | dom. | `registry.ts:150` |
| 28 | `competencyRequirements` | Wymagane kompetencje | asystuje (brak promptu) | dom. — **ROZJAZD** (§2.3) | `registry.ts:151` |
| 29 | `skillsGap` | Luka kompetencyjna | asystuje (brak promptu) | dom. — **ROZJAZD** (§2.3) | `registry.ts:152` |
| 30 | `pilot` | Pilotaż | pisze | **ukr.** | `registry.ts:165` |
| 31 | `control` | Panel sterowania | pisze/asyst. | **rdzeń** | `cardSets.ts:307`; `registry.ts:155` |
| 32 | `team` | Zespół | dane | dom. | `registry.ts:156` |
| 33 | `timeline` | Harmonogram | dane | dom. | `registry.ts:157` |
| 34 | `resources` | Zasoby | pisze | dom. | `registry.ts:158` |
| 35 | `stakeholders` | Interesariusze (RACI) | dane | dom. | `registry.ts:159` |
| 36 | `tags` | Tagi | dane | dom. | `registry.ts:162` |
| 37 | `reminders` | Przypomnienia i eskalacja | dane/reguły | dom. | `registry.ts:163` |

#### C. Rodzina DECISION — treść pisze AI (4 id)

| # | kanoniczny id | label (pl) | rola AI | kompozycja (Decision) | dowód |
|---|---------------|-----------|---------|-----------------------|-------|
| 38 | `context-problem` | Zakres decyzji | pisze | **rdzeń** | `cardSets.ts:418` (wchłania DOC `decision-scope` — §2.3) |
| 39 | `options-tradeoffs` | Opcje i trade-offy | pisze | dom. | `cardSets.ts:426` |
| 40 | `risk-impact` | Ryzyko i wpływ | pisze | dom. | `cardSets.ts:432` |
| 41 | `consequences` | Konsekwencje | pisze | dom. | `cardSets.ts:438` |

#### D. Rodzina TASK — treść pisze AI (5 id)

| # | kanoniczny id | label (pl) | rola AI | kompozycja (Task) | dowód |
|---|---------------|-----------|---------|-------------------|-------|
| 42 | `description-scope` | Opis i zakres | pisze | **rdzeń** | `cardSets.ts:496` (wchłania DOC `task-brief` — §2.3) |
| 43 | `implementation` | Pomysły realizacji | pisze | dom. | `cardSets.ts:504` |
| 44 | `risk-alternatives` | Ryzyko i alternatywy | pisze | dom. | `cardSets.ts:510` |
| 45 | `checklist` | Lista kontrolna | pisze | dom. | `cardSets.ts:516` |
| 46 | `evidence` | Dowody | pisze | dom. | `cardSets.ts:527` |

#### E. WSPÓLNE — system / dane, jeden kanoniczny wpis dla wielu artefaktów (5 id)

To jest sedno dedup: te karty pojawiają się w kilku artefaktach pod (czasem) różnymi id — kanon scala je w **jeden** wpis.

| # | kanoniczny id | label (pl) | rola AI | występuje w (po dedup) | wchłania (aliasy) | dowód |
|---|---------------|-----------|---------|------------------------|-------------------|-------|
| 47 | `comments` | Komentarze | transakcyjna | Insight · Initiative · Decision · Task | — | `cardSets.ts:162,296,450,535` |
| 48 | `activity-log` | Aktywność / historia | systemowa | Insight · Decision · Task · Initiative | Initiative **`history`** | `cardSets.ts:168,462,547`; `registry.ts:154` |
| 49 | `attachments` | Załączniki i powiązania | dane | Initiative · Task · Decision | Task **`attachments-links`**, Decision **`resources-links`**, Initiative **`linkedItems`** (legacy) | `cardSets.ts:330,541,456` |
| 50 | `dependencies` | Zależności | dane | Initiative · Task | — | `registry.ts:160`; `cardSets.ts:522` |
| 51 | `governance` | RACI i eskalacja | asystuje | Decision · Task · Initiative | Decision **`governance-escalation`**, Initiative **`raciEscalation`** (rozjazd klucza — §2.3) | `cardSets.ts:444,529`; `registry.ts` |

**Dedup w liczbach:** 65 żywych instancji − 14 dubli = **51 kanonicznych**. Zdjęte duble: `comments` 4→1,
`activity-log`(+`history`) 4→1, `attachments`(+2 aliasy) 3→1, `dependencies` 2→1, `governance`(+alias) 2→1,
plus zwinięte legacy `initiativeTeam`→`team`, `linkedItems`→`attachments`, `watchers`→(placeholder).

### 2.3 Karty ROZJECHANE — jawny werdykt i gdzie trafiają

Zgodnie z zadaniem — karty rozjechane nie znikają po cichu; każda dostaje trasę.

| karta (jak w kodzie) | rozjazd | werdykt kanonu | dowód |
|----------------------|---------|----------------|-------|
| `competencyRequirements` | w registry + cardSets, **brak wiersza w seedzie DB**, brak `name_pl`, brak promptu | **zostaje** jako id kanoniczny #28, `statusKanonu: rozjazd`; rola `asystuje` (generator proponuje). DO DECYZJI: zaseedować w DB czy zostawić fallback-only | DWA_SYSTEMY §3b; KONTRAKT §3.2 |
| `skillsGap` | brak wiersza DB; ma własną tabelę `skills_gap` | **zostaje** #29, `rozjazd`; rola `asystuje`. DO DECYZJI: DB-type vs własna tabela | KONTRAKT §3.2 |
| `financialAnalysis` | DB aktywna, ale komentarz `enum is dead per F0` (`initiativeGeneratorBrain.ts:50`) | **zostaje** #25, `rozjazd`. DO DECYZJI: żywy enum czy martwy | KONTRAKT §3.2 |
| `initiativeTeam` | brak typu DB, **dubluje `team`**, order „Legacy" | **martwa** → `statusKanonu: martwa`, `kanonicznyZamiennik: team` (#32). Uśmiercić | `registry.ts:72,129,167` |
| `linkedItems` | brak typu DB, nakłada się z `attachments` | **martwa** → zamiennik `attachments` (#49). Uśmiercić | `registry.ts:79,131,169` |
| `watchers` | registry mapuje na `OverviewSection` („simpler UI — can be enhanced later"), brak typu DB, brak promptu | **placeholder** → `statusKanonu: do-decyzji-piotra`. Zbudować własny UI czy skreślić | `registry.ts:82,166` |
| `raciEscalation` | rozjazd KLUCZA: DB/nawigacja = `raci`, registry/widoczność = `raciEscalation` | **zwinięte do `governance`** (#51) jako alias; **DO DECYZJI: który klucz kanoniczny** (`raci` vs `raciEscalation`) | KONTRAKT §3.2; `registry.ts:73,168` |
| `material-quality` | **DOC oznacza WYMAGANĄ** (§7.8.1), w kodzie **NIE ISTNIEJE** | **do-decyzji-piotra**: luka implementacji czy przeterminowany plan? Nie wchodzi do 51 do decyzji | ROZJAZD §2.1, §5 |
| `traceability` | DOC WYMAGANA (linia 1043), brak w kodzie | **do-decyzji-piotra** (jak wyżej) | ROZJAZD §2.1 |
| `candidate-triage` (label) | KOD „Wnioski i dowody" vs DOC „Triage kandydatów" — **różnica SENSU** | **zostaje** #8 z labelem kodu; DO DECYZJI: jedna karta czy dwie | ROZJAZD §2.1, §5.2 |
| `decision-scope`, `task-brief`, `recommendation` (DOC) | DOC-only; `decision-scope`/`task-brief` = to samo co `context-problem`/`description-scope` | `decision-scope`→#38, `task-brief`→#42 (aliasy); `recommendation` = **backlog** (DO DECYZJI) | ROZJAZD §2.2, §2.3 |

---

## 3. MODEL KOMPOZYCJI — rdzeń + zestaw domyślny + dodawalne

### 3.1 Zasada (D-4/D-5): rdzeń nieusuwalny + WĘŻSZY zestaw domyślny

Kanon wyraża kompozycję **per artefakt** przez pole `kompozycja` (przynależność karty do artefaktu z rolą):

- **rdzeń** (`rola: 'rdzen'`) — nieusuwalny, tylko chowany. Egzekwowany dziś w A: `removeCard` przerywa dla
  core (`useCardLayout.ts:190`), UI chowa „X" (`NModeCardManager.tsx:364`). **B tego nie ma** — migracja 529
  ma **0 kolumn `is_core`** (zweryfikowane). To jest najważniejsza rzecz, którą kanon bierze z A i **daje
  Initiative**.
- **zestaw domyślny** — węższy niż katalog. Dziś rozjazd: Insight ma prawdziwy `default` (12 z 18,
  `cardSets.ts:176-192`), ale **Initiative = „pokaż wszystko"** (24/29 `DEFAULT_VISIBLE=true`,
  `registry.ts:138-170`). D-5: **tniemy Initiative do węższego domyślnego** (kandydat: dzisiejszy zestaw
  `minimal` = overview, problemDefinition, targetState, scope, tasks, kpis, control — `cardSets.ts:377`).
- **dodawalne / ukryte-domyślne** — w katalogu, poza domyślnym (zestaw „full" lub biblioteka).

### 3.2 Rdzeń per artefakt (D-4) — stan dziś + propozycja

| artefakt | klasa | rdzeń DZIŚ | propozycja kanonu (DO ZATWIERDZENIA) | dowód |
|----------|:-----:|-----------|--------------------------------------|-------|
| Insight | L | `artifact-actions`, `executive-summary` | bez zmian | `cardSets.ts:78,85` |
| Decision | L | `context-problem` | bez zmian | `cardSets.ts:418` |
| Task | L | `description-scope` | bez zmian | `cardSets.ts:496` |
| Initiative | L | **BRAK** (registry nie zna `core`) | **nadać rdzeń**: `overview` + `control` (już zadeklarowane w martwym cardSets `:235,307`) | DWA_SYSTEMY §2 |
| Tool · Interview · Notification | S/S/L | brak kart | patrz §3.4 (sieroty w kontrakcie) | — |

### 3.3 Szablony Initiative wchłonięte jako „zestaw generowany" (nie drugi silnik)

To jest kluczowy ruch *best-of*, który godzi A z B **bez utraty bogactwa B**:

- **A** ma zestawy nazwane statyczne (`sets[]`: `default`/`minimal`/`full`, `cardSets.ts:63`), przełączane na
  żywo jednym klikiem (`NModeCardManager.tsx:286-305`).
- **B** ma szablony w DB (`initiative_templates.visible_sections`+`section_order`, `529_...sql:184-187`),
  per-organizacja, per-inicjatywa.

**Kanon:** oba to ten sam pojęciowo obiekt — *nazwany zestaw widocznych kart w kolejności*. Statyczny `sets[0]`
i `template.visible_sections` różnią się tylko **źródłem** (plik TS vs wiersz DB), nie **kształtem**. Kanon
definiuje:

```
Zestaw = { id, label{en,pl}, cards: id[], zrodlo: 'statyczny' | 'szablon-db' | 'org-custom' }
```

- Insight/Decision/Task: zestawy `statyczne` (dziś `sets[]`) — bez potrzeby DB.
- Initiative: zestaw domyślny = `szablon-db` (dzisiejsze `DEFAULT_VISIBLE_SECTIONS`), warianty = szablony org.
- **Skutek:** „który system kanonem" znika. Zostaje jeden `useCardLayout` + `NModeCardManager` (interfejs z A),
  karmiony danymi per-artefakt (statyczny TS **lub** adapter DB→kanon dla Initiative). To dokładnie „hybryda"
  rekomendowana w DWA_SYSTEMY §4, wyrażona jako **jeden model danych**.

### 3.4 Sieroty w kontrakcie (D-6) — Interview · Tool · Notification

D-6: **wszystkie 7 artefaktów pod kontraktem** — także te bez bogatych kart, ale z **jawną klasą/redukcją**,
nie zwolnione po cichu.

| sierota | klasa | co niesie | miejsce w kanonie |
|---------|:-----:|-----------|-------------------|
| **Notification** | S | wiadomość systemowa; panel skrócony (Właściwości + Historia), **bez Komentarzy** (plan K2) | w kontrakcie z redukcją: rdzeń = treść wiadomości; `comments` **pominięta z powodem** (wzorzec `PominietaSekcjaPanelu`, `StandardArtifactShell.types.ts:188`) |
| **Tool** | S | ekran-katalog narzędzia (statyczna baza wiedzy) | w kontrakcie klasy S (≤4 sekcje); rola AI sekcji = `dane`/`asystuje`, prompt = jawny brak z powodem |
| **Interview** | L | narzędzie zasilające Insight; „sekcje" = pytania szablonu, nie karty-treści | w kontrakcie: produktem jest **Insight** (ma pełne karty); Interview deklaruje klasę L i minimalny zestaw. DO DECYZJI: czy dostaje własne karty-treści |

Zasada: sierota **jest w kontrakcie** z uzasadnioną redukcją (`statusKanonu`/`PominietaSekcjaPanelu.reason`),
żeby „lżejsza" nie znaczyło „poza standardem" (D-6, wbrew wcześniejszej rekomendacji „zwolnić" z KONTRAKT §5).

---

## 4. ZALĄŻEK TYPU (D-8) — `src/components/standard/cardContract.types.ts`

**Utworzony:** `src/components/standard/cardContract.types.ts` (NOWY, **nieużywany** — zero konsumentów, zero
importu z artefaktów). To jest zalążek do POC, nie wpięcie. Reużywa TYLKO `KartaNKey`/`KartaNKlasa` z
siostrzanego `standard/registry.ts` (jeden SSOT klasy S/L).

### 4.1 Co typ wymusza (dlaczego „nie da się obejść", jak StandardTable)

SPEC-N §0 (cyt. w `StandardArtifactShell.types.ts:9`): *„`StandardTable` nie da się obejść, a `NModeShell` —
da się, i obchodzi go 8/8"*. Ten typ przenosi tę własność na kartę — **czyni stany niedozwolone
niewyrażalnymi**:

| reguła kanonu | realizacja w typie | co się dzieje przy złamaniu |
|---------------|--------------------|-----------------------------|
| karta MUSI mieć `id` | pole wymagane `KanonicznaKartaBaza.id` | **błąd kompilacji** |
| karta MUSI mieć `label{en,pl}` | pole wymagane | **błąd kompilacji** |
| karta MUSI mieć `rola_AI` | dyskryminanta unii `RolaAISpojna` | brak → **żadna gałąź nie pasuje = błąd** |
| karta MUSI mieć `kompozycję` | `KompozycjaKarty = [Przynaleznosc, ...][]` (**krotka niepusta**) | `[]` → **błąd kompilacji** |
| „AI pisze" ⇒ prompt istnieje | unia `KartaPiszacaAI` wymaga `aiPrompt: AiPromptTresc` | `pisze`+`{none}` → **błąd** |
| „dane/system" ⇒ jawny brak promptu | `KartaBezGeneracjiAI` wymaga `aiPrompt: BrakAiPrompt` | milczenie **niemożliwe** |
| klasa S/L per przynależność | `PrzynaleznoscArtefaktu.klasa: KartaNKlasa` wymagana | brak → **błąd** |

Wzorzec 1:1 z istniejącym `StandardArtifactShell.types.ts` (brandowane typy-błędy w PL, np.
`BladZarezerwowanegoIdSekcji:67`). Mój odpowiednik: `BladNiekompletnejKarty<Pole>` + warta `SprawdzKomplet<T>`
(ta sama ochrona `[X] extends [never]` przed rozpadem po `never`, `:84-88`).

### 4.2 Dowód, że działa (zweryfikowane, nie „powinno")

Uruchomiłem **zakresowy** type-check (2-plikowy graf + tester z `@ts-expect-error`, `--skipLibCheck`, bez
pełnego tsc repo — zgodnie z higieną robotnika):

- ✅ Poprawna karta „AI pisze" (rdzeń Insight, prog `scoring-calosci` 90) — **kompiluje się**.
- ✅ Poprawna karta danych (`comments`, `transakcyjna`, `{none}`, 2 przynależności) — **kompiluje się**.
- ❌ Karta bez `rolaAI` — `@ts-expect-error` **skonsumowany** (czyli realnie błąd).
- ❌ `rolaAI:'pisze'` z `aiPrompt:{none}` — **skonsumowany**.
- ❌ `kompozycja: []` — **skonsumowany**.

Wynik: **`tsc … exit 0`, zero nadmiarowych dyrektyw** — gdyby którykolwiek zły przypadek NIE dał błędu, tsc
zgłosiłby „Unused '@ts-expect-error'" i exit ≠ 0. Zalążek egzekwuje schemat. (Tester tymczasowy usunięty —
plik pozostaje bez konsumentów.) Dodatkowo `esbuild` per-plik = transform OK.

### 4.3 Kształt typu (skrót — pełny plik w `src/components/standard/cardContract.types.ts`)

```
RolaAI          = 'pisze' | 'asystuje' | 'dane' | 'systemowa' | 'transakcyjna'
AiPromptSlot    = { szablon } | { none, reason }                 // nadzbiór B ai_prompt_template
RolaAISpojna    = { rolaAI:'pisze'|'asystuje', aiPrompt:{szablon} }   // AI pisze ⇒ prompt
                | { rolaAI:'dane'|'systemowa'|'transakcyjna', aiPrompt:{none} }
ProgKompletnosci= {do-decyzji-piotra} | {scoring-calosci,prog,dowod} | {doradczy,…} | {per-karta,prog}
RolaKompozycji  = 'rdzen' | 'domyslna' | 'dodawalna' | 'ukryta-domyslna'   // core z A
Przynaleznosc   = { artefakt:KartaNKey, rola:RolaKompozycji, klasa:KartaNKlasa, kolumna?, kolejnosc? }
KompozycjaKarty = [Przynaleznosc, ...Przynaleznosc[]]            // NIEPUSTA — brak = błąd
StatusKanonu    = {czysta} | {rozjazd,…} | {martwa,zamiennik,…} | {do-decyzji-piotra,…}
KanonicznaKarta = { id, label, opis?, grupa, ikona, prog, kompozycja, statusKanonu } & RolaAISpojna
```

### 4.4 Jak `check-artefakt-struktura.mjs` (już istnieje) egzekwuje to strukturalnie

Typ łapie stany na **poziomie kompilacji** (literały w miejscu wywołania — ROZJAZD §4.1 uczciwie: karta
budowana dynamicznie ucieka typowi). Bramka `scripts/check-artefakt-struktura.mjs` domyka to na **poziomie
strukturalnym / runtime** — jest komplementarna, nie dubluje:

| warstwa | co łapie | dziś |
|---------|----------|------|
| **typ** `cardContract.types.ts` | brak pola karty (id/label/rola/kompozycja/prog/klasa), niespójność rola↔prompt — na literałach | zalążek (§4.2) |
| **bramka** `check-artefakt-struktura.mjs` | montaż powłoki (NModeHeader, `ArtifactRightPanel`), kanoniczna **kolejność sekcji** panelu, `evidence` między relations a comments, crimson w centrum | **już zbudowana**, tryb raportu (`:30`, exit 0) |

Bramka parsuje 7 artefaktów AST-lite (`:127 scanSectionIds`) i raportuje per artefakt. Wpięcie kanonu:

1. **Dziś (ten projekt):** bramka mierzy strukturę powłoki; typ mierzy schemat karty. Rozłączne, oba żywe.
2. **Faza kompozycji (po akcepcie):** adapter `cardSets`/DB → `KanonicznaKarta[]`; bramka dostaje **czwarty
   test (e):** „każda sekcja renderowana przez artefakt ma wpis w katalogu kanonicznym i odwrotnie" — analogicznie
   do dzisiejszego skanu id (`ID_KEY_RE:119`). Rozjazd id kod↔katalog = FLAGA.
3. **Egzekwowanie `klasa`:** bramka porówna `Przynaleznosc.klasa` z `REJESTR_KART_N[artefakt].klasa`
   (`registry.ts:84`) — denormalizacja na karcie musi się zgadzać ze SSOT klasy → rozjazd = FLAGA.
4. **`--strict`** (`:430`) awansuje FLAGĘ do exit 1 — wtedy kontrakt karty staje się warunkiem wejścia jak
   `check-list-canon.sh` dla tabel (D-8). **Próg wymagalności = decyzja Piotra** (bramka świadomie tego nie
   rozstrzyga, `:32`).

---

## 5. DO DECYZJI PIOTRA (zebrane — druga tura)

Kanon **nie wymyśla** żadnej z tych liczb/wyborów (twarda zasada: brak w kodzie = DO DECYZJI):

- **D-1/D-2/D-3 (progi):** czy wprowadzamy próg per-karta i jaką liczbę? `gates.readinessScore` → PROCEED przy
  ilu? Minima pól (dziś doradcze) awansują do bramki? — pole `prog` czeka jako `do-decyzji-piotra`.
- **D-4 (rdzeń Initiative):** zatwierdzić `overview` + `control` jako nieusuwalne?
- **D-5 (zestaw domyślny Initiative):** zejść z „pokaż wszystko" (24/29) do węższego (kandydat = dzisiejszy
  `minimal`, 7 kart)?
- **Rozjazdy (§2.3):** `competencyRequirements`/`skillsGap` — zaseedować w DB? `raciEscalation` vs `raci` —
  który klucz kanoniczny? `material-quality`/`traceability` — zbudować (luka) czy skreślić (przeterminowane)?
  `candidate-triage` — jedna karta czy dwie (findingi vs kandydaci)? `watchers` — własny UI czy skreślić?
- **D-6 (sieroty):** potwierdzić redukcje Notification (bez Komentarzy) / Tool (S) / Interview (produkt=Insight)?
- **D-8 (moment egzekwowania):** kiedy `--strict` bramki staje się warunkiem wejścia na demo?

---

## 6. Czego NIE zweryfikowano (uczciwie)

- **Osobiście otwarte:** `cardSets.ts` (cały), `registry.ts` (cały), `check-artefakt-struktura.mjs` (cały),
  `StandardArtifactShell.types.ts` (wzorzec typu), `standard/registry.ts` (KartaNKey/Klasa), migracja 529
  (nagłówek + brak `is_core` = 0 trafień grep). Type-check zalążka: uruchomiony zakresowo (§4.2).
- **Przyjęte z dokumentów-poprzedników (nie re-otwierane per-linia):** numery `529:*`, `initiativeGeneratorBrain.ts:*`,
  `completenessConfigs.ts:*`, prompty DB, callerzy walidatorów — cytowane za KONTRAKT/DWA_SYSTEMY/ROZJAZD.
- **Treść kart** czytana z KODU (cardSets/registry/migracja), **nie z żywej bazy demo** — realny stan wierszy
  `initiative_section_types` na demo niesprawdzony (fallback vs seed).
- **Liczba „100"** = rekonstrukcja (§2.1: 65 żywych + ~35 widm), nie policzona pozycja-po-pozycji w DOC §7.
- **Pełny `tsc`/`vitest`** — NIE uruchamiany (zakaz higieny). Zalążek sprawdzony esbuild + zakresowy tsc 2-plik.
- **Rola AI per-karta** dla części kart (np. `source-pack` dane/AI, `control` pisze/asyst.) — zgrubna, na
  podstawie istnienia serwisu generacji, nie prześledzenia każdej sekcji.

---

*Wygenerowano na origin/demo (worktree fix/prv-mywork-preview). Zero edycji 7 artefaktów. Powstały: ten
dokument + `src/components/standard/cardContract.types.ts` (zalążek, nieużywany). Migracja = osobny etap po
akcepcie Piotra, POC-first.*
