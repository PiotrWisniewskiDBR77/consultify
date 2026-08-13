# Content Completion Register — DRD + SIRI (COORD-07)

> Agent: A12. Decyzja koordynatora: **COORD-07 APPROVED: DO NOT GENERATE.**
> Brakująca treść metodyczna **NIE jest generowana** przez ten dokument ani
> przez żadne narzędzie w tym zadaniu — to wyłącznie rejestr braków, zmierzony
> programowo z `compileDrdPack()` i `compileSiriPack()`, nie oszacowany.
> Zero `misScoringTrap`, zero `distinctionFromNext`, zero opisu poziomu, zero
> jakiejkolwiek treści DRD/SIRI zostało napisane w ramach tego zadania.
>
> Worktree: `/Users/piotrwisniewski/.codex/worktrees/mac-a12-registers`,
> branch `codex/mac-a12-registers-20260813`, baseline `3faac01e98`.

---

## 1. DRD — rejestr braków (z `compileDrdPack().report`)

Baza pomiaru: 39 obszarów, 233 pary obszar#poziom (`unitLevelPairsTotal`),
699 pytań (`questionsTotal` = 3 pytania × 233 par).

### 1.1 Braki na poziomie obszar#poziom (233 jednostki)

| Dokładny brak | Jednostka/poziom | Liczba wystąpień | Wymagany typ źródła | Wpływ na readiness | Osoba uprawniona |
| --- | --- | ---: | --- | --- | --- |
| `misScoringTraps` | per obszar#poziom | **233 / 233** | Materiały źródłowe Digital Pathfinder (DBR77) — warsztat/podręcznik metody, sekcja typowych błędów oceny per obszar; alternatywnie decyzja właściciela metodyki DRD spisana ad hoc per obszar | Blokuje `content_approved`+ (kontrakt `ASSESSMENT_METHOD_PACK_CONTRACT.md` §4 wymaga tego pola) | właściciel metodyki DRD |
| `distinctionFromPrevious` | per obszar#poziom | **233 / 233** | Materiały źródłowe Digital Pathfinder — opis granicy między kolejnymi poziomami drabiny danego obszaru | Blokuje `content_approved`+ | właściciel metodyki DRD |
| `distinctionFromNext` | per obszar#poziom | **233 / 233** | Materiały źródłowe Digital Pathfinder — jw., strona „w górę" drabiny | Blokuje `content_approved`+ | właściciel metodyki DRD |
| `negativeEvidence` | per obszar#poziom | **233 / 233** | Materiały źródłowe Digital Pathfinder lub decyzja lead assessora — katalog dowodów FAŁSZYWIE sugerujących poziom | Blokuje `content_approved`+ | właściciel metodyki DRD |
| `examples` (osobne od `expectedEvidence`) | per obszar#poziom | **233 / 233** | Materiały źródłowe Digital Pathfinder — ilustracyjne case'y per poziom | Blokuje `content_approved`+ | właściciel metodyki DRD |
| `requiredAttributes` | per obszar#poziom | **233 / 233** | Materiały źródłowe Digital Pathfinder — cechy wymagane do uznania poziomu za spełniony | Blokuje `content_approved`+ | właściciel metodyki DRD |
| `expectedEvidence` (poziom obszaru) | per obszar#poziom | **0 / 233** ✅ WYPEŁNIONE | — (brak luki) | — | — |

### 1.2 Braki na poziomie jednostki-obszaru (39 jednostek)

| Dokładny brak | Jednostka/poziom | Liczba wystąpień | Wymagany typ źródła | Wpływ na readiness | Osoba uprawniona |
| --- | --- | ---: | --- | --- | --- |
| respondent roles (poziom obszaru, `emptyUnitRespondentRoles`) | per obszar (jednostka) | **39 / 39** | Materiały źródłowe Digital Pathfinder lub decyzja lead assessora — kto w organizacji klienta typowo odpowiada na pytania tego obszaru | Obniża jakość UX Teresy (routing pytań), nie blokuje formalnie `content_approved`, ale wymagane przez `ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md` §5 na poziomie jednostki | lead assessor |
| zależności między obszarami (`emptyUnitDependsOnUnitIds`) | per obszar (jednostka) | **39 / 39** | Decyzja właściciela metodyki DRD — czy i jak obszary zależą od siebie (np. graf fundamentów Canon §7.3 dotyczy OSI, nie obszarów wprost — wymaga jawnego przełożenia) | Blokuje poprawne sekwencjonowanie pytań w sesji | właściciel metodyki DRD |

### 1.3 Braki na poziomie pytania (699 pytań = 3 × 233)

| Dokładny brak | Jednostka/poziom | Liczba wystąpień | Wymagany typ źródła | Wpływ na readiness | Osoba uprawniona |
| --- | --- | ---: | --- | --- | --- |
| `intent` | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder lub redakcja lead assessora — po co zadajemy to pytanie | Blokuje `ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md` §5 | lead assessor |
| `plainLanguageExplanation` | per pytanie | **699 / 699** | Redakcja lead assessora — przeformułowanie pytania prostym językiem dla klienta nietechnicznego | jw. | lead assessor |
| `glossaryRefs` | per pytanie | **699 / 699** | Słownik pojęć DRD (jeśli istnieje) lub decyzja właściciela metodyki, które terminy wymagają zdefiniowania | jw. | właściciel metodyki DRD |
| `positiveAnswerExample` | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder — przykład odpowiedzi spełniającej poziom | jw. | właściciel metodyki DRD |
| `partialAnswerExample` | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder — przykład odpowiedzi częściowej | jw. | właściciel metodyki DRD |
| `negativeAnswerExample` | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder — przykład odpowiedzi niespełniającej poziom | jw. | właściciel metodyki DRD |
| `expectedEvidence` (per pytanie, odrębne od `expectedEvidence` obszaru) | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder lub lead assessor — dowód oczekiwany na TO konkretne pytanie (węższy niż dowód całego poziomu) | jw. | lead assessor |
| `likelyRespondentRoles` | per pytanie | **699 / 699** | Decyzja lead assessora — kto w organizacji klienta odpowie na to konkretne pytanie | jw. | lead assessor |
| `followUpQuestionIds` | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder lub redakcja lead assessora — logika pytań pogłębiających | jw. | lead assessor |
| `commonMisunderstanding` | per pytanie | **699 / 699** | Materiały źródłowe Digital Pathfinder — typowe błędne rozumienie pytania przez respondenta | jw. | lead assessor |
| `allowedTeresaCapabilities` | per pytanie | **699 / 699** | Decyzja właściciela metodyki DRD + product — jakie akcje Teresa może wykonać w kontekście tego pytania (governance AI, nie treść metodyczna per se, ale wymaga zatwierdzenia) | jw. | właściciel metodyki DRD |
| `whyItMatters` | per pytanie | **granulacja osiowa** (7 hintów dla 7 osi, powielone na wszystkie pytania danej osi) — NIE per-pytanie, jawnie ujawnione w `fieldGaps.whyItMattersGranularity`, nie liczone jako „pusty" bo pole JEST wypełnione, tylko grubiej niż wymaga standard | 7 hintów istnieje / 699 potrzebnych granularnie | Materiały źródłowe Digital Pathfinder — dogranularyzacja hintu osiowego do poziomu pytania | Nie blokuje formalnie (pole niepuste), obniża jakość UX | lead assessor |

**Uwaga o kompletności innych pól:** `expectedEvidence` (poziom obszaru) i
pytania walidacyjne same w sobie (treść pytania, nie meta-pola) są
**w 100% pokryte** (233/233, 699/699) — to jedyne dwa wymiary treści, które
NIE są w tym rejestrze braków, bo braku nie ma.

---

## 2. SIRI — rejestr braków (z `compileSiriPack().report`)

Baza pomiaru: 16 wymiarów (`dimensionsTotal`), 8 filarów (`pillarsTotal`),
6 pasm na wymiar (Bands 0–5, `bandsPerDimension`=6), 96 poziomów łącznie
(`levelsTotal` = 16 × 6).

**Ograniczenie licencyjne — zapisane wprost, nie jako zwykły brak treści:**
Treść per wymiar (opisy pasm 0–5) pochodzi z **SIRI Assessor Training
Module 2, str. 32–69**, materiału z klauzulą *„no part may be
reproduced"*. To NIE jest luka do wypełnienia przez zespół — to
**prawna blokada transkrypcji**, którą może znieść wyłącznie posiadacz
licencji SIRI (Singapore EDB / SIRI programme), a nie właściciel metodyki
DRD ani lead assessor Consultify.

| Dokładny brak | Jednostka/poziom | Liczba wystąpień | Wymagany typ źródła | Wpływ na readiness | Osoba uprawniona |
| --- | --- | ---: | --- | --- | --- |
| Opisy pasm (Band descriptors) | per wymiar × pasmo | **96 / 96** (`levelsMarkedEvidenceMissing`) | **OGRANICZENIE LICENCYJNE**: SIRI Assessor Training Module 2, str. 32–69 — treść jest w istniejącym materiale, ale zakaz reprodukcji; wymaga formalnej zgody posiadacza licencji SIRI na transkrypcję lub przeformułowanie, nie tylko decyzji wewnętrznej | Trwale blokuje `readiness` > `draft` dopóki licencja nie zostanie rozstrzygnięta | posiadacz licencji SIRI (zewnętrzny) — NIE właściciel metodyki DRD |
| Bank pytań per wymiar × pasmo | per wymiar × pasmo | brak w repo (QBank v1 ma jeden ogólny kubeł `[dimension_id:all]`, Band 1 całkowicie nieobecny) | Brak źródła w repo — wymaga wytworzenia od zera przez lead assessora SIRI, niezależnie od transkrypcji Module 2 (pytania NIE są objęte zakazem reprodukcji materiału źródłowego, jeśli są autorsko sformułowane) | Blokuje `readiness` > `draft` | lead assessor (SIRI) |
| Tabele `DOR_c` / `DOR_k` (lookup) | globalne, per silnik PM | brak w repo | SIRI-PM Whitepaper, str. 38–39 — sprawdzić status licencyjny tego dokumentu osobno od Module 2 | Blokuje pełną funkcjonalność Prioritisation Matrix | właściciel metodyki DRD / lead assessor po weryfikacji licencji Whitepaper |
| Benchmarki Best-in-Class dla 14 branż | per branża | brak w repo | SIRI-PM Whitepaper, str. 40 | Blokuje branżowe porównania w raporcie | jw. |
| Wagi agregacji 16D → 8 filarów | globalne | brak zdefiniowanej reguły (obecna = `PENDING-OWNER-APPROVAL`) | Kanon SIRI nie definiuje tego wprost — wymaga JAWNEJ decyzji metodycznej, nie inżynierskiej | Blokuje wiarygodność wyniku na poziomie filaru | właściciel metodyki DRD (decyzja o regule agregacji) |

---

## 3. Gotowość techniczna vs gotowość metodologiczna

Rozdzielenie wymagane przez koordynatora — mechanika i treść oceniane są
osobno, żeby nie mylić „kod działa" z „metodyka jest kompletna".

### 3.1 Gotowość TECHNICZNA (co DZIAŁA — z `EVIDENCE_LEDGER.md`)

| Element | Dowód | Werdykt |
| --- | --- | --- |
| DRD: struktura 7 osi / 39 obszarów zgodna z kanonem | `EVIDENCE_LEDGER.md` G1.1–G1.3 | PASS |
| DRD Method Pack + adapter, `aboveGap`/`needs_evidence`/readiness egzekwowane w kodzie | `EVIDENCE_LEDGER.md` G4.1–G4.5, 33/33 testów, exit 0 | PASS |
| DRD: determinizm kompilacji (802 744 znaki identyczne między niezależnymi przebiegami) | `EVIDENCE_LEDGER.md` G4.7 | PASS |
| SIRI: 16 wymiarów jako jednostki oceny, Bands 0–5, zero sierot | `EVIDENCE_LEDGER.md` G5.2, 11/11 testów, exit 0 | PASS |
| SIRI: no-leapfrog, `readiness='draft'` uczciwie egzekwowany | `EVIDENCE_LEDGER.md` G5.3–G5.4 | PASS |
| SIRI: `prioritise()` nie duplikuje formuły PM | `EVIDENCE_LEDGER.md` G5.5 | PASS |
| Kernel: kontrakt wspólny kompiluje się w trybie strict, zero reguł metodyk w kernelu | `EVIDENCE_LEDGER.md` G3.1–G3.2 | PASS |
| Runtime serwera: 71/71 testów, exit 0; kopia kontraktu strzeżona testem rozjazdu | `EVIDENCE_LEDGER.md` G6.2, G6.5 | PASS |
| Bramka integracyjna na gałęzi scalonej: `method-core` 131 testów (53 metodyki + 78 serwer), type-check 0 linii wyjścia | `EVIDENCE_LEDGER.md` G7 | PASS |
| Niniejszy pomiar (A12): `compileDrdPack()`/`compileSiriPack()` uruchamiają się bez błędu, zwracają zmierzone liczby powyżej | `npx vitest run` — patrz §4 poniżej, exit 0 | PASS |

**Wniosek techniczny:** mechanika obu metodyk (struktura, kompilator,
no-leapfrog, readiness gate, testy) **działa i jest zweryfikowana
niezależnie** (Opus powtórzył pomiary A3/A4/A2, wykrywając po drodze
realne błędy w twierdzeniach robotników — patrz `EVIDENCE_LEDGER.md` G2.A,
G4.6, G5.8). To NIE jest to samo co gotowość treści.

### 3.2 Gotowość METODOLOGICZNA (co BLOKUJE `released` — z §1–2 powyżej)

| Element | Stan | Blokuje |
| --- | --- | --- |
| DRD: 7 pól kontraktowych na poziomie obszar#poziom (`misScoringTraps`, `distinctionFromPrevious/Next`, `negativeEvidence`, `examples`, `requiredAttributes`) | **0% pokrycia** (233/233 puste każde) | `content_approved`+ |
| DRD: 10 pól kontraktowych na poziomie pytania | **0% pokrycia** (699/699 puste każde) | `ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md` §5 |
| DRD: `whyItMatters` granularność | tylko osiowa (7/7 osi), nie per-pytanie | jakość UX, nie formalna blokada |
| DRD: przegląd i zatwierdzenie przez właściciela metodyki | **nie wykonany** | `content_approved`+ (kontrakt §6) |
| DRD: ścieżki dojrzałości (`getMaturityPathway`, D1..D8) | niepodłączone — COORD-06, patrz `DRD_PATHWAY_MAPPING_TASK.md` | brak ścieżek rozwoju w Output |
| SIRI: opisy pasm (96/96) | **zablokowane licencyjnie**, nie tylko brakujące | `draft` → wyżej, TRWALE do rozstrzygnięcia zewnętrznego |
| SIRI: bank pytań per wymiar | **0/16 wymiarów** ma dedykowane pytania | `draft` → wyżej |
| SIRI: `DOR_c`/`DOR_k`, benchmarki branżowe, wagi agregacji 16D→8 | brak / `PENDING-OWNER-APPROVAL` | pełna funkcjonalność Prioritisation Matrix |

**Wniosek metodologiczny:** DRD i SIRI mają **status readiness uczciwie
odzwierciedlony w kodzie** (`methodology_review` i `draft` odpowiednio),
i kod **egzekwuje** to (`canStartSession()` odmawia startu sesji
produkcyjnej dla obu). Domknięcie wymaga pracy właściciela metodyki DRD
(dla DRD) oraz — dla SIRI — dodatkowo formalnego rozstrzygnięcia licencji
z posiadaczem praw do Module 2, zanim jakikolwiek lead assessor może w ogóle
zacząć uzupełniać treść pasm.

---

## 4. Skrypt pomiarowy i jego wyjście (dowód pomiaru, nie przepisania)

Skrypt: jednorazowy test `src/method-core/__tests__/zzz-a12-measure-content-gaps.test.ts`
(utworzony, uruchomiony, **usunięty** natychmiast po przechwyceniu wyjścia —
nie wchodzi do żadnego commitu). Woła wyłącznie `compileDrdPack()` i
`compileSiriPack()` (funkcje z `src/method-core/methods/{drd,siri}/`) i
drukuje ich pola `coverage` / `fieldGaps` / `evidenceMissing` /
`discrepancies` / `readinessRationale` przez `console.log(JSON.stringify(...))`
— zero treści dopisanej ręcznie, zero wartości przepisanych z pamięci.

Polecenie:

```
npx vitest run src/method-core/__tests__/zzz-a12-measure-content-gaps.test.ts --reporter=verbose
```

Exit code: **0**.

Pełne, niezmodyfikowane wyjście (stdout):

```
 RUN  v4.1.8 /Users/piotrwisniewski/.codex/worktrees/mac-a12-registers

stdout | src/method-core/__tests__/zzz-a12-measure-content-gaps.test.ts > A12 content completion measurement (throwaway) > prints DRD report
=== DRD coverage ===
{
  "areasTotal": 39,
  "areasWithFullLevelCoverage": 39,
  "areaIdsMissingSomeLevelCoverage": [],
  "unitLevelPairsTotal": 233,
  "unitLevelPairsWithOverrideContent": 233,
  "questionsTotal": 699
}
=== DRD fieldGaps ===
{
  "levelsTotal": 233,
  "emptyExpectedEvidence": 0,
  "emptyMisScoringTraps": 233,
  "emptyDistinctionFromPrevious": 233,
  "emptyDistinctionFromNext": 233,
  "emptyNegativeEvidence": 233,
  "emptyExamples": 233,
  "emptyRequiredAttributes": 233,
  "unitsTotal": 39,
  "emptyUnitRespondentRoles": 39,
  "emptyUnitDependsOnUnitIds": 39,
  "questionsTotal": 699,
  "emptyQuestionIntent": 699,
  "emptyPlainLanguageExplanation": 699,
  "emptyGlossaryRefs": 699,
  "emptyPositiveAnswerExample": 699,
  "emptyPartialAnswerExample": 699,
  "emptyNegativeAnswerExample": 699,
  "emptyQuestionExpectedEvidence": 699,
  "emptyLikelyRespondentRoles": 699,
  "emptyFollowUpQuestionIds": 699,
  "emptyCommonMisunderstanding": 699,
  "emptyAllowedTeresaCapabilities": 699,
  "whyItMattersGranularity": "axis-level (7 hints reused across all questions in that axis) — NOT per-question"
}
=== DRD discrepancies ===
[
  "maturityPathwayDrdData.ts / getMaturityPathway() uses a DIFFERENT DRD dimension model (D1..D8, levels I..V, \"Canon §3.2 MAP-1.0\") than the 39-area/7-axis model compiled here (verified against ASSESSMENT_KB_DRD.md, which itself flags the old \"34 areas\" comment as wrong). MethodAdapter has no pathway hook, so it is NOT wired into this pack — flagging instead of silently picking one model.",
  "English QBank v2 (*.en.md) and English override files (*Axis*.en.ts) exist and are FULLY populated per grep, but were not compiled into this pack version (manifest.languages = [\"pl\"] only). Scope decision for this pass, not a content gap in the source."
]
=== DRD readinessRationale ===
methodology_review: structure (39/39 areas), level titles/canonical definitions, and QBank-derived questions/evidence/technology are 100% covered (233/233 area#level pairs, 699/699 questions from curated overrides) and scoring is deterministic with fixtures. However ASSESSMENT_METHOD_PACK_CONTRACT.md §4 requires distinctionFromPrevious/Next, misScoringTraps, negativeEvidence, requiredAttributes and separate `examples` per level, and ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md §5 requires intent, plainLanguageExplanation, glossaryRefs, answer examples, respondent roles, follow-ups, commonMisunderstanding and allowedTeresaCapabilities per question — NONE of these exist in any repo source, so they are empty across the board (see fieldGaps). The pack has not been reviewed or approved by the DRD method owner. Per §6 of the contract this cannot be content_approved or higher; it cannot be "draft" either since real, sourced, licensed content is compiled. methodology_review is the honest ceiling. canStartSession() correctly refuses this readiness.

stdout | src/method-core/__tests__/zzz-a12-measure-content-gaps.test.ts > A12 content completion measurement (throwaway) > prints SIRI report
=== SIRI coverage ===
{
  "dimensionsTotal": 16,
  "pillarsTotal": 8,
  "buildingBlocksTotal": 3,
  "bandsPerDimension": 6,
  "levelsTotal": 96,
  "levelsMarkedEvidenceMissing": 96,
  "dimensionsWithDedicatedQuestions": 0,
  "questionsTotal": 0
}
=== SIRI evidenceMissing ===
[
  "Per-dimension Band descriptors (Bands 0-5 x 16 dimensions) — source: SIRI Assessor Training Module 2, pp. 32-69. LICENSED, must not be transcribed.",
  "Per-dimension x Band question bank — no source in repo.",
  "DOR_c / DOR_k official lookup tables — SIRI-PM Whitepaper pp. 38-39, not encoded.",
  "Industry Best-in-Class benchmarks for 14 industries — Whitepaper p. 40, not encoded.",
  "16D -> 8 pillar aggregation weights — not defined by canon; current rule is PENDING-OWNER-APPROVAL."
]
=== SIRI discrepancies ===
[
  "siriStructure.ts names the 8 pillars \"SIRI_DIMENSIONS\" and the 16 canonical dimensions \"SIRI_PRIORITISATION_AREAS\" — inverted vs SIRI canon. This pack uses the canonical meaning; the legacy file is untouched pending COORD-02.",
  "QBank v1 holds one generic bucket keyed [dimension_id:all], not per-dimension content; Band 1 is absent from it entirely. Not compiled into questions."
]
=== SIRI readinessRationale ===
SIRI pack is 'draft': 96/96 band descriptors carry EVIDENCE_MISSING because the per-dimension assessment matrix is licensed source material that must not be transcribed, and 0/16 dimensions have dedicated questions. Mechanics (no-leapfrog, 80:20, aggregation, TIER) are implemented and tested; methodology CONTENT is not. Technical readiness and methodological readiness are deliberately reported apart.

 ✓ src/method-core/__tests__/zzz-a12-measure-content-gaps.test.ts > A12 content completion measurement (throwaway) > prints DRD report 129ms
 ✓ src/method-core/__tests__/zzz-a12-measure-content-gaps.test.ts > A12 content completion measurement (throwaway) > prints SIRI report 4ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  11:20:07
   Duration  2.16s (transform 652ms, setup 300ms, import 590ms, tests 137ms, environment 927ms)
```

---

## 5. Czego NIE wolno zrobić (przypomnienie z mandatu koordynatora)

- Nie generować `misScoringTraps`, `distinctionFromPrevious/Next`,
  `negativeEvidence`, `examples`, `requiredAttributes` ani żadnego z 10 pól
  pytania — ani ręcznie, ani modelem AI, ani jako „rozsądny placeholder".
- Nie transkrybować SIRI Assessor Training Module 2 str. 32–69 pod żadnym
  pretekstem — to złamanie licencji, nie luka repo.
- Nie podnosić `readiness` DRD/SIRI w kodzie bez faktycznego domknięcia
  powyższych braków — kod dziś **poprawnie** to blokuje
  (`canStartSession()` = false dla obu metodyk) i to ma zostać tak,
  dopóki treść nie zostanie dostarczona i zatwierdzona przez właściciela
  metodyki / lead assessora.
- Nie mylić „technicznie działa" (§3.1) z „gotowe do klienta" (§3.2) w
  żadnej komunikacji do Piotra czy koordynatora.

---

## 6. NOT VERIFIED w tym zadaniu

- Czy istnieje jakikolwiek roboczy szkic treści (`misScoringTraps` etc.) u
  właściciela metodyki DRD poza repo (np. w dokumentach Digital Pathfinder
  nieprzeniesionych jeszcze do kodu) — nie sprawdzano poza repo.
- Status prawny/licencyjny SIRI-PM Whitepaper (str. 38–40) osobno od
  Module 2 — `evidenceMissing` w kodzie nie precyzuje, czy Whitepaper ma
  taką samą klauzulę „no part may be reproduced"; NIE zweryfikowano treści
  samego PDF-a w tym zadaniu (poprzedni pomiar w `EVIDENCE_LEDGER.md` G5.6–G5.7
  czytał whitepaper dla innego celu — silnika PM, nie licencji).
- Czy `DRD_KNOWLEDGE_OVERRIDES` (miejsce na pytania kuratorowane, wg
  `DRD_CANON.md` linia 373) faktycznie odpowiada 1:1 zbiorowi override'ów
  zliczonemu przez `compileDrdPack()` — przyjęto zgodność na podstawie
  spójności liczb (233/233, 699/699), nie przeglądano ręcznie każdego pliku
  override.
