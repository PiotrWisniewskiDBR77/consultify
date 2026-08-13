# Method Assessment Core — Evidence Ledger

> Trwały rejestr dowodów. Każdy wpis: gate · wymaganie · owner · pliki · SHA ·
> polecenie · exit code · runtime · expected · observed · dowód · werdykt.
> Werdykty: PASS · FAIL · BLOCKED · NOT VERIFIED.
> **Zasada: „testy przeszły" ≠ „działa". Deklaracja agenta ≠ dowód.**

## Kontekst biegu

| Pole | Wartość |
| --- | --- |
| Branch | `codex/method-assessment-core-20260813` |
| Baseline SHA | `f3e7df565e0da826ba110d85aad3c3c81a1087f1` (== `origin/demo`) |
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/method-assessment-core` |
| Główny worktree | BRUDNY (338 zmian, gałąź `codex/sync-demo-20260729`) — NIE TYKANY |
| Data startu | 2026-08-13 |
| Koordynator | Codex (przez Piotra) |
| Zakaz | merge · push · deploy |

---

## G0 — Bezpieczeństwo git i baza

| # | Wymaganie | Owner | Polecenie | Exit | Expected | Observed | Werdykt |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| G0.1 | Ustalony root repo i branch | Opus | `git rev-parse --show-toplevel; git rev-parse --abbrev-ref HEAD` | 0 | root + branch | root=`.../DRD/consultify`, branch=`codex/sync-demo-20260729`, HEAD=`635fd2d48d` | PASS |
| G0.2 | Główny worktree brudny → praca w izolacji | Opus | `git status --porcelain \| wc -l` | 0 | liczba zmian | **338** zmian → praca w osobnym worktree | PASS |
| G0.3 | Baza = `origin/demo` (reguła CLAUDE.md) | Opus | `git rev-parse origin/demo` | 0 | SHA | `f3e7df565e` | PASS |
| G0.4 | Nowa gałąź + izolowany worktree | Opus | `git worktree add -b codex/method-assessment-core-20260813 <wt> origin/demo` | 0 | czysty worktree | HEAD=`f3e7df565e`, `git status --porcelain` = 0 linii | PASS |
| G0.5 | Zero operacji destrukcyjnych | Opus | — | — | brak reset/clean/stash/push/merge | Nie wykonano żadnej | PASS |

---

## G1 — Zgodność runtime z kanonem metodyk (weryfikacja własna Opusa)

| # | Wymaganie | Pliki | Polecenie | Expected (kanon) | Observed (runtime) | Werdykt |
| --- | --- | --- | --- | --- | --- | --- |
| G1.1 | DRD: 7 osi | `src/services/drdStructure.ts:1762` | odczyt `DRD_STRUCTURE` | 7 osi | 7 osi (AXIS_1..AXIS_7) | PASS |
| G1.2 | DRD: 39 obszarów (nie 34) | `src/services/drdStructure.ts` | skrypt zliczający `id: 'NX'` | 39 | **39** (1A–1I, 2A–2E, 3A–3E, 4A–4E, 5A–5E, 6A–6E, 7A–7E) | PASS |
| G1.3 | DRD: skale per oś 7/5/5/7/6/6/5 | `src/services/drdStructure.ts` | skrypt max `level:` per oś | oś1=7, oś2=5, oś3=5, oś4=7, oś5=6, oś6=6, oś7=5 | oś1=7(9 obsz.), oś2=5(5), oś3=5(5), oś4=7(5), oś5=6(5), oś6=6(5), oś7=5(5) | PASS |
| G1.4 | SIRI: 16 dimensions jako source of truth | `src/services/siriStructure.ts:180,264` | odczyt + zliczenie wpisów | 16D = źródło prawdy, 8 pillars = agregacja | **ODWROTNIE**: `SIRI_DIMENSIONS` = **8** wpisów (źródło prawdy), `SIRI_PRIORITISATION_AREAS` = **16** wpisów (pochodne) | **FAIL — luka do zamknięcia** |
| G1.5 | SIRI: Bands 0–5 | `src/services/siriStructure.ts:121` | zliczenie `level:` | 0,1,2,3,4,5 | 0,1,2,3,4,5 (6 poziomów) | PASS |
| G1.6 | SIRI: 16D nie może być imputowane | `src/services/siriStructure.ts:531` `compute16DScores` | odczyt kodu | 16D mierzone niezależnie | **16D DZIEDZICZY** wynik rodzica 8D gdy brak własnego (`?? dimScore.current`) → dane fabrykowane | **FAIL — luka do zamknięcia** |
| G1.7 | SIRI: zakaz nieautoryzowanej średniej („8D average") | `src/services/siriStructure.ts:555` `aggregate16Dto8D` | odczyt kodu | agregacja wg wersjonowanych reguł metody | **prosta średnia arytmetyczna** `reduce/length` bez reguły metodycznej | **FAIL — luka do zamknięcia** |
| G1.8 | SIRI: Assessment Matrix ≠ Prioritisation Matrix | `src/services/siriStructure.ts:264` | odczyt kodu | dwie odrębne macierze, TIER po freeze | **SKLEJONE**: `SIRI_PRIORITISATION_AREAS` pełni jednocześnie rolę 16 wymiarów oceny i macierzy priorytetyzacji | **FAIL — luka do zamknięcia** |
| G1.9 | SIRI: TIER Prioritisation Matrix (horizon, cost, 5 KPI, Best-in-Class, PM Impact) | — | grep | implementacja TIER | NOT VERIFIED (do potwierdzenia w inwentarzu) | NOT VERIFIED |

**Wniosek G1:** struktura **DRD jest zgodna z kanonem i nie wymaga przebudowy** —
wymaga kompilacji do Method Packa oraz silnika progresji/evidence/scoringu.
Struktura **SIRI wymaga przebudowy persystencji 8D → 16D**, jawnej agregacji
16D → 8 pillars oraz **odseparowania TIER** od macierzy oceny. Dokładnie te braki
przewiduje `ASSESSMENT_KB_SIRI.md` §7.

### Nazewnictwo — pułapka do udokumentowania

Runtime i kanon używają tych samych słów w innym znaczeniu:

| Kanon (SIRI) | Runtime `siriStructure.ts` | Liczność |
| --- | --- | ---: |
| building block | `SIRI_BUILDING_BLOCKS` | 3 = 3 ✅ |
| **pillar** | `SIRI_DIMENSIONS` ⚠️ | 8 = 8 |
| **dimension** | `SIRI_PRIORITISATION_AREAS` ⚠️ | 16 = 16 |
| Prioritisation Matrix (TIER) | *brak odrębnego bytu* | — |

Każda zmiana w SIRI musi jawnie adresować tę inwersję, inaczej „naprawa"
pogłębi rozjazd.

---

## G2 — Inwentarz runtime (A1) i **korekty Opusa**

A1 dostarczył inwentarz. Opus powtórzył pomiary krytyczne. **Trzy twierdzenia A1
okazały się błędne.** Poniżej stan po weryfikacji.

### G2.A — Twierdzenia A1 OBALONE przez pomiar Opusa

| # | Twierdzenie A1 | Pomiar Opusa | Werdykt |
| --- | --- | --- | --- |
| G2.1 | „`SIRI_DIMENSIONS` = **24 wymiary**" | Parsowanie tablicy przez dopasowanie nawiasów: `SIRI_DIMENSIONS` = **8**, `SIRI_PRIORITISATION_AREAS` = **16**. A1 policzył wystąpienia `buildingBlock:` w **całym pliku** (8+16=24) zamiast w jednej tablicy. | **A1 BŁĄD** |
| G2.2 | „Tabele `assessment_evidence`, `assessment_findings`, `assessment_capa_actions`, `assessment_evidence_clause_map`, `assessment_evidence_access_audit`, `assessment_ai_scoring_proposals`, `assessment_eval_datasets`, `assessment_eval_runs`, `assessment_report_reviews` istnieją **tylko** w pomijanym `never-ran/` → router `/api/assessments-v4` i `/api/assessment-evidence` prawdopodobnie 500-ują" | **Wszystkie 9 tabel jest tworzonych** przez `server/migrations/20260719_baseline_gap.sql` — plik **w katalogu kanonicznym**, wciągany przez `getAllMigrations()`. A1 grepował `CREATE TABLE` **wielkimi literami**; ten plik używa `create table if not exists` **małymi**. | **A1 FAŁSZYWY ALARM P0** |
| G2.3 | „`assessment_axis_comments` / `assessment_benchmarks` — komponenty frontu mogą uderzać w nieistniejące tabele" | Tabele faktycznie **nie są tworzone** kanonicznie — ale `grep` po `server/src` daje **ZERO** wywołań obu. Martwe definicje w `never-ran/`, bez konsumenta. | **A1 częściowo — bez skutku** |

**Metanauka (wpisana do pamięci projektu):** narzędzie pomiarowe A1 skłamało
dwukrotnie i **w obie strony** — raz zawyżyło (24 wymiary), raz wywołało fałszywy
alarm krytyczny (9 nieistniejących tabel). Żadnego z tych błędów nie wykrył autor.
Powtórzenie pomiaru przez Opusa było konieczne, nie ceremonialne.
Także **własne** narzędzie Opusa zawiodło raz (cytowanie w `zsh` rozbiło pętlę
`grep` i zwróciło 11× fałszywe „BRAK") — pomiar powtórzono w `node`.

### G2.B — Ustalenia A1 POTWIERDZONE przez Opusa

| # | Ustalenie | Dowód | Werdykt |
| --- | --- | --- | --- |
| G2.4 | `getAllMigrations()` jest **nierekurencyjny** → `never-ran/` (158 plików) nigdy nie biegnie | `server/scripts/migrate.postgres.ts:83-93`, `fs.readdirSync(dir)` bez rekurencji; `ls server/migrations/never-ran \| wc -l` = 158 | PASS |
| G2.5 | Pięć powierzchni **już istnieje** w kodzie za flagą `assessmentFiveSurfacesV1` | `src/components/assessment/AssessmentHub.tsx:707-739` — taby: `library`, `processes`, `outputs`, `reports`, `initiatives` | PASS |
| G2.6 | Nomenklatura `method pack` **nie istnieje** w kodzie | grep `src` + `server/src` = 0 trafień | PASS |
| G2.7 | Teresa **nie jest podłączona** do Assessment | `src/actions/teresaActionManifest.ts`, grep `assessment` = 0 trafień | PASS |
| G2.8 | `/api/v8/assessment` jest **za bramką** `ENABLE_V8_GLOBAL` | `server/src/middleware/v8FeatureGate.middleware.ts:14-21` → 404 gdy flaga ≠ `'true'` | PASS |

### G2.C — Konsekwencja dla COORD-01 (nazwy powierzchni)

Kod **już rozstrzygnął** spór częściowo: `AssessmentHub.tsx` używa
`processes` (za kanonem, wbrew briefowi) **i** `reports` (za briefem, wbrew
kanonowi `Deliverables`). Rekomendacja do Codexa niezmieniona, ale koszt zmiany
jest teraz znany: **jedna etykieta**, nie pięć.

### G2.D — Konsekwencja dla COORD-02 (SIRI) — **zakres maleje**

16 identyfikatorów w `SIRI_PRIORITISATION_AREAS` **to są kanoniczne 16 wymiarów
SIRI**: `vertical_integration`, `horizontal_integration`,
`integrated_product_lifecycle`, `shop_floor_automation`, `enterprise_automation`,
`facility_automation`, `shop_floor_connectivity`, `enterprise_connectivity`,
`facility_connectivity`, `shop_floor_intelligence`, `enterprise_intelligence`,
`facility_intelligence`, `workforce_learning`, `leadership_competency`,
`strategy_governance`, `inter_intra_collaboration`.

Czyli **dane kanoniczne już są w repo, tylko pod błędną nazwą i w błędnej roli**
(pochodne zamiast źródła prawdy). To zmienia SIRI z „przebudowa metodyki" na
„odwrócenie roli + jawna agregacja + wydzielenie TIER" — istotnie taniej.

---

## G3 — Kernel: kontrakt wspólny (Opus, własne autorstwo)

| # | Wymaganie | Pliki | Polecenie | Exit | Werdykt |
| --- | --- | --- | --- | ---: | --- |
| G3.1 | Kontrakt kernela kompiluje się w trybie strict | `src/method-core/contracts/{events,session,methodPack,teresa,index}.ts` | `npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck <5 plików>` | **0** | PASS |
| G3.2 | Kernel nie zawiera reguł metodyk | jw. | przegląd autorski | — | PASS — zero odwołań do DRD/SIRI/ADMA; metody wchodzą przez `MethodAdapter` |
| G3.3 | Commit bez preview Teresy niereprezentowalny | `teresa.ts` | konstrukcja typu — `TeresaCommitRequest` wymaga `previewId` | — | PASS (poziom typów) |
| G3.4 | `frozen` nie jest terminalny | `session.ts` | `METHOD_SESSION_TRANSITIONS.frozen` zawiera `active` | — | PASS |
| G3.5 | Manifest kontraktu dla Tools i Audits | `SHARED_CONTRACT_MANIFEST.md` | — | — | PASS — Contract SHA `e3b8be6cd7` |

---

## G4 — DRD Method Pack + adapter (A3, **zweryfikowane niezależnie przez Opusa**)

Branch `codex/mac-a3-drd-20260813` → scalone do gałęzi zespołu jako `22fe28069c`.

### G4.A — Powtórzenie pomiarów A3 przez Opusa

| # | Twierdzenie A3 | Pomiar własny Opusa | Werdykt |
| --- | --- | --- | --- |
| G4.1 | „33 testy przechodzą, exit 0" | Własny przebieg: `npx vitest run src/method-core/methods/drd --config vitest.config.ts` → **EXIT=0**, `Test Files 4 passed`, `Tests 33 passed (33)` | **POTWIERDZONE** |
| G4.2 | „39/39 obszarów, skale per oś" | Sonda Opusa: `1A`=[1..7], `4A`=[1..7], `5A`=[1..6], `2A`=[1..5], `7A`=[1..5], `units.length`=39 | **POTWIERDZONE** |
| G4.3 | „aboveGap nie podnosi currentLevel" | Sonda Opusa, wejście `confirmedLevels=[1,2,4,5]` → wynik `{currentLevel:2, blockedAtLevel:3, aboveGapLevels:[4,5]}` | **POTWIERDZONE** |
| G4.4 | „brak dowodu → needs_evidence, nigdy 0" | Sonda Opusa, wejście puste → `{proposedLevel:null, verdict:'needs_evidence'}` | **POTWIERDZONE** |
| G4.5 | „readiness uczciwy" | Sonda Opusa → `readiness='methodology_review'`, `canStartSession()`=**false** | **POTWIERDZONE** |
| G4.6 | „kompilacja jest deterministyczna" | **Test A3 był PUSTY** — `compileDrdPack()` ma module-level `cached`, więc drugie wywołanie zwraca **ten sam obiekt**; `JSON.stringify(a)===JSON.stringify(a)` jest prawdziwe trywialnie | **A3 TEST WADLIWY** |
| G4.7 | determinizm — pomiar poprawny | Sonda Opusa z `vi.resetModules()` między kompilacjami → dwa niezależne przebiegi, **802 744 znaki identyczne** | **POTWIERDZONE dopiero po naprawie testu** |

Sonda Opusa (`zz-opus-probe.test.ts`, 4/4 PASS, exit 0) jest **trwałą częścią suity**,
nie jednorazowym sprawdzeniem — commit `0dedfb4e13`.

### G4.B — Luki zgłoszone przez A3 (uczciwie, nie ukryte)

| Pole kontraktu | Pokrycie | Skutek |
| --- | --- | --- |
| `expectedEvidence` (poziomy) | **233/233** wypełnione | ok |
| pytania z QBank v2 | **699/699** (3 × 233) | ok |
| `misScoringTraps` | **0/233** | brak źródła w repo |
| `distinctionFromPrevious` / `distinctionFromNext` | **0/233** | brak źródła |
| `negativeEvidence`, `examples` | **0/233** | brak źródła |
| `plainLanguageExplanation` i 10 dalszych pól pytania | **0/699** | brak źródła |
| `whyItMatters` | wypełnione, ale granulacja **osiowa (7 hintów)**, nie per-pytanie | jawnie oznaczone |

To jest **powód**, dla którego `readiness` = `methodology_review`, a nie `released`.
Pack **nie może** wystartować sesji produkcyjnej i kod to egzekwuje.
Kanon (`ASSESSMENT_METHOD_PACK_CONTRACT.md` §6) wymaga dokładnie takiej uczciwości.

### G4.C — Rozbieżność zgłoszona przez A3 do rozstrzygnięcia

`maturityPathwayDrdData.ts` / `getMaturityPathway()` używa **innego modelu DRD**
(`D1..D8`, poziomy `I..V`) niż zweryfikowany model 7 osi / 39 obszarów.
A3 **nie podłączył** pathway i zgłosił to zamiast wybrać po cichu — słusznie.
→ nowy punkt koordynacyjny **COORD-06**.

### G4.D — Ujawniona domyślna decyzja inżynierska (nie kanon)

`DRD_DEFAULT_MINIMUM_EVIDENCE_STRENGTH = 'E2'` **nie pochodzi z kanonu DRD** —
jest domyślną polityką wywnioskowaną ze wzorca QBank („Dowód" zawsze żąda
artefaktu). Jawnie udokumentowana w kodzie i zgłoszona. Wymaga potwierdzenia
właściciela metodyki.

---

## Otwarte / niezweryfikowane

- G1.9 — implementacja TIER: **potwierdzony BRAK** (grep `TIER`/`80:20`/`band`
  w `siriStructure.ts` = 0 trafień) → do zbudowania od zera.
- Stan tabel na **żywej** bazie demo/dev: NOT VERIFIED (powyższe dotyczy kodu
  migracji, nie żywej bazy — zgodnie z złotą regułą wymaga `information_schema`).
- Wartość `ENABLE_V8_GLOBAL` na dev/demo/prod: NOT VERIFIED.
- Czy Audits czyta `siriStructure.ts`/`drdStructure.ts`: NOT VERIFIED (COORD-03).

---

## G5 — SIRI Method Pack + TIER (A4, zweryfikowane niezależnie)

| # | Twierdzenie A4 | Pomiar własny Opusa | Werdykt |
| --- | --- | --- | --- |
| G5.1 | „11/11 testów, exit 0" | Własny przebieg → **EXIT=0**, `Tests 11 passed (11)` | POTWIERDZONE |
| G5.2 | „16 wymiarów = jednostki oceny, Bands 0–5" | Sonda Opusa: `units.length`=16, każdy `levelScale`=[0..5], 8 filarów, **zero sierot** | POTWIERDZONE |
| G5.3 | „no-leapfrog działa" | Sonda: `[0,1,4]` → `{currentLevel:1, blockedAtLevel:2, aboveGapLevels:[4]}` | POTWIERDZONE |
| G5.4 | „readiness `draft`, uczciwy" | Sonda → `readiness='draft'`, `canStartSession()`=**false** | POTWIERDZONE |
| G5.5 | „`prioritise()` nie duplikuje formuły" | Odczyt kodu: importuje i woła `buildDefaultInputs`, `rankByImpactValue` — brak reimplementacji | POTWIERDZONE |
| G5.6 | „silnik PM: brak normalizacji (Step 6)" | **Opus odczytał whitepaper sam** (str. 36): Step 6 istnieje i jest obowiązkowy. Dowód liczbowy: `IV(costProfile=1)=1,8` vs `IV(costProfile=100)=31,5` | POTWIERDZONE |
| G5.7 | „wagi domyślne nie pasują do presetów" | **Opus odczytał Figure 12 sam** (str. 29): 30/40/30, 45/30/25, 60/20/20. Kod: 0,3/0,3/0,4 | POTWIERDZONE |
| G5.8 | *(A4 nie zgłosił)* ujemny Proximity nieobcinany | **Znalezione przez Opusa.** Whitepaper str. 36 Step 4: „If the difference has a negative value, indicate 0". Dowód: `BIC=1, AMS=5` → `IV=−1,6` | **NOWY DEFEKT** |

Uczciwość licencyjna A4: **nie transkrybował** stron 32–69 Module 2 (macierz per
wymiar z klauzulą „no part may be reproduced"). Zamiast zmyślić — oznaczył
**96/96** poziomów jako `EVIDENCE_MISSING`. QBank v1: **0 z 16** wymiarów ma
dedykowane pytania. To jest powód `readiness='draft'`.

---

## G6 — Runtime kernela (A2, zweryfikowane niezależnie)

| # | Twierdzenie A2 | Pomiar własny Opusa | Werdykt |
| --- | --- | --- | --- |
| G6.1 | „polecenie testowe z briefu daje fałszywy fail" | Własny przebieg polecenia **z mojego briefu** → `No test files found`, **EXIT=1**. `vitest --config` nie zmienia `root`. | **A2 MA RACJĘ — mój brief był błędny** |
| G6.2 | „71/71, exit 0" | Własny przebieg `npx vitest run server/src/method-core` → **EXIT=0**, `Tests 71 passed (71)` | POTWIERDZONE |
| G6.3 | „`server/` nie może importować z korzenia" | Odczyt `server/tsconfig.json`: `rootDir: "."`, `include: ["src/**/*"]`; `build: tsc --build`, `start: node dist/src/index.js` | POTWIERDZONE — kopia uzasadniona |
| G6.4 | „kopia bajt-w-bajt" | `endsWith()` na 5 plikach: **true**, delta = 1202 znaki nagłówka. Twierdzenie „bajt-w-bajt" dotyczy **treści pod nagłówkiem**, nie całego pliku — sformułowanie w podsumowaniu A2 nieprecyzyjne, sama kopia poprawna | POTWIERDZONE z zastrzeżeniem |
| G6.5 | „ryzyko ręcznej synchronizacji zostaje otwarte" | **Zamknięte przez Opusa**: `contractMirrorDrift.test.ts` — 7/7 PASS na zgodnych plikach, **EXIT=1 po wstrzyknięciu rozjazdu** (test negatywny wykonany, strażnik nie jest pusty) | **RYZYKO ZAMKNIĘTE** |

### G6.A — Braki zgłoszone przez A2 (uczciwie)

- `readiness_blocked` (wariant `TransitionRefusal`) — **brak implementacji**,
  hak w typach bez logiki.
- Konflikt optymistycznej blokady nie ma dedykowanego `TransitionRefusal.kind`
  w zamrożonym kontrakcie — zgłaszany jako `illegal_transition` wobec świeżego
  stanu. **Brak testu współbieżności.**
- Zachowanie na prawdziwym Postgresie (partial unique index, `ON CONFLICT`,
  realny race na `23505`) — **NOT VERIFIED**, zero uruchomień na bazie.

---

## G7 — Bramka integracyjna na gałęzi scalonej

| Bramka | Polecenie | Exit | Wynik |
| --- | --- | ---: | --- |
| Testy `method-core` (łącznie) | `npx vitest run src/method-core --config vitest.config.ts` | **0** | `Test Files 12 passed`, **`Tests 131 passed (131)`** |
| Testy runtime serwera | `npx vitest run server/src/method-core` | **0** | `Test Files 5 passed`, `Tests 78 passed (78)` |
| Type-check (scoped tsconfig z aliasami `@/`) | `npx tsc -p .tmp-opus-tsconfig.json` | **0** | **0 linii wyjścia** |

**Uwaga metodologiczna do liczby 131:** filtr `src/method-core` jest dopasowaniem
po **podciągu**, więc jeden przebieg objął także `server/src/method-core`.
131 = 53 (metodyki DRD+SIRI) + 78 (runtime serwera). Podanie 131 jako „testów
frontu" byłoby zawyżeniem — dlatego rozbicie jest tutaj jawne.

**Pułapki narzędziowe napotkane przez Opusa w tej sesji (4):**
1. `PIPESTATUS` zgubił kod wyjścia `tsc` → pomiar powtórzony z `; echo "EXIT=$?"`.
2. Cytowanie w `zsh` rozbiło pętlę `grep` → 11× fałszywe „BRAK", powtórzone w `node`.
3. `zsh` nie word-splituje `$FILES` → `tsc` dostał jedną nazwę pliku, TS6054.
4. Alias `@/` nie działa z gołych flag CLI → wymagany scoped `tsconfig`.

---

## G8 — Fala 2: A5 · A8 · A11 · A12 · A7 (weryfikacja własna Opusa)

### G8.A — Wyniki potwierdzone własnymi przebiegami

| Agent | Zakres | Twierdzenie | Pomiar Opusa | Werdykt |
| --- | --- | --- | --- | --- |
| A5 | powłoka Workspace | 27/27, 8 zrzutów | własny przebieg **EXIT=0, 27/27**; zrzuty istnieją, **obejrzane** | POTWIERDZONE |
| A8 | Outputs/Reports/Initiatives | 59 front + 96 serwer | własny przebieg **EXIT=0**, 59/59 i 96/96 | POTWIERDZONE |
| A11 | COORD-08 silnik wersjonowany | 28/28, legacy bit w bit | własny przebieg **EXIT=0, 28/28** | POTWIERDZONE |
| A12 | rejestry COORD-06/07 | 233/233, 699/699, 96/96 | liczby zgodne z `report` kompilatorów | POTWIERDZONE |
| A7 | SIRI vertical slice | 254/254, 6 zrzutów | własny przebieg **EXIT=0, 254/254**; zrzuty obejrzane | POTWIERDZONE |

### G8.B — Defekty znalezione przez Opusa w pracy agentów

| # | Gdzie | Defekt | Dowód | Status |
| --- | --- | --- | --- | --- |
| G8.1 | A5 `InterviewFocusPanel.tsx` | `weak` **i** `conflicting` → `c-danger`. Kanon §7: czerwień **wyłącznie** dla blockera. Dodatkowo **niespójność wewnętrzna**: `missing` (stan gorszy) miał `c-warning`, `weak` (lepszy) `c-danger`; komponent siostrzany `MethodNavigator` miał już mapowanie **poprawne** | odbiór wizualny zrzutu `interview-light.png` | **NAPRAWIONE** — `conflicting`→danger, reszta→warning; 8 zrzutów zregenerowanych i obejrzane ponownie |
| G8.2 | A11 legacy `rankByImpactValue` | twierdzenie „bit w bit" wymagało dowodu | porównanie **ciał funkcji** wobec `3faac01e98`: `calculateImpactValue` IDENTYCZNE, `buildDefaultInputs` IDENTYCZNE, `rankByImpactValue` różni się **wyłącznie 2 polami traceability**, **zero usuniętych linii** | POTWIERDZONE |
| G8.3 | A7 `factory_observation` | zgłoszony jako otwarta zależność od kontraktu | A7 **nie tknął** zamkniętego zbioru kernela (`git diff` na `contracts/` = pusty) — postąpił prawidłowo | **ROZSTRZYGNIĘTE** przez Opusa: podtyp kernelowego `observation`, dodane `toKernelEvidenceType()` |

### G8.C — Weryfikacja gwarancji COORD-08 „zero cichej zmiany" (sonda Opusa, 5/5)

| Sprawdzenie | Wynik |
| --- | --- |
| bez flagi domyślna ścieżka | **`legacy_v1`** ✅ |
| `siri_pm_v2` wchodzi tylko jawnym parametrem | ✅ |
| `prioritise()` odrzuca dane niezamrożone | ✅ — guard **mocniejszy** niż w briefie: wymaga `sessionState==='frozen'` **oraz** `frozenSnapshotId` |
| `planningHorizon` obowiązkowy | ✅ — brak cichego presetu domyślnego |
| presety = Figure 12 | ✅ `30/40/30 · 45/30/25 · 60/20/20` |
| v2 obcina ujemny Proximity | ✅ `IV = 0` |
| legacy **nadal** daje ujemny | ✅ `IV = −1,6` — dowód, że legacy nie został po cichu poprawiony |

### G8.D — ★ Rozgraniczenie bramki: co jest moje, a co zastane

Przebieg z filtrem `src/services/__tests__` dał **3 pliki FAIL / 15 testów**:
`server/src/services/__tests__/artifactRegistryPresentationTemplatePosture.test.ts`,
`artifactRegistryService.retry.test.ts`, `mapOutlineBlueprintToDeckSlides.test.ts`.

**To NIE jest regresja tej pracy.** Dowody:
1. `git log f3e7df565e..HEAD` dla każdego z tych plików → **0 commitów** (nietknięte).
2. Te same testy uruchomione w worktree `mac-a2-kernel` (stan `e3b8be6cd7` = `origin/demo` + same pliki kontraktu, zero zmian w `server/src/services/`) → **FAIL, EXIT=1, 13 testów**.

Czyli defekt jest **dziedziczony z `origin/demo`**, obszar Artifact Studio, poza zakresem tego zespołu.

**Pułapka pomiarowa do zapamiętania:** filtr ścieżki w vitest jest dopasowaniem po **podciągu** — `src/services/__tests__` złapało także `server/src/services/__tests__`, a `src/method-core` łapie `server/src/method-core`. Bramkę trzeba podawać **rozłącznie**, inaczej raportuje się cudze defekty jako swoje albo zawyża liczbę testów.

**Bramka zespołu (rozłącznie, bez cudzych obszarów):**

| Zakres | Polecenie | Exit | Wynik |
| --- | --- | ---: | --- |
| metodyki + workspace (front) | `npx vitest run src/method-core src/components/method-workspace --config vitest.config.ts` | **0** | **254/254** |
| runtime kernela (serwer) | `npx vitest run server/src/method-core` | **0** | **96/96** |

---

## G9 — ★ Disposable PostgreSQL: migracje od zera i dowody bazodanowe

Pierwszy w tym programie dowód **na realnej bazie**, nie na mocku.

### Środowisko

| Pole | Wartość |
| --- | --- |
| Obraz | `pgvector/pgvector:pg15` (PostgreSQL **15.18**, pgvector **0.8.6**) |
| Kontener | `mac-pg-disposable`, port **55440** (55433 był zajęty przez tunel ssh) |
| Połączenie | `postgresql://mac:mac@localhost:55440/mac_test` |
| Charakter | **disposable** — zero związku z demo/staging/prod |

### G9.A — Migracje od zera

| # | Krok | Polecenie | Exit | Wynik |
| --- | --- | --- | ---: | --- |
| G9.1 | próba z `postgres:15-alpine` | `npx tsx server/scripts/migrate.postgres.ts` | **1** | `✗ 20260719_baseline_gap.sql: extension "vector" is not available` — obraz bez pgvector |
| G9.2 | **migracje na `pgvector/pgvector:pg15`** | `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=... npx tsx server/scripts/migrate.postgres.ts` | **0** | **`✅ Postgres migrations complete`** |
| G9.3 | liczba tabel po migracji | `information_schema.tables` | — | **1366** tabel |

**Bezpiecznik `localhost`:** `server/src/config/databaseTargetResolver.ts` blokuje
lokalną bazę poza testami. Furtka jest **sankcjonowana, nie obchodzona**:
`allowLocalDatabaseForTests()` przepuszcza przy `NODE_ENV=test`. Użyto jej zgodnie
z przeznaczeniem.

### G9.B — Tabele kernela istnieją w realnej bazie

Obie moje migracje (`20260813_method_core_kernel.sql`,
`20260813_method_outputs.sql`) zastosowały się w normalnym przebiegu.
Utworzone **11 tabel**: `method_events`, `method_evidence`, `method_findings`,
`method_initiative_drafts`, `method_outputs`, `method_packs`,
`method_report_snapshots`, `method_session_roles`, `method_sessions`,
`method_snapshots`, `method_teresa_previews`.

### G9.C — ★ Idempotencja dowiedziona na realnym Postgresie

Pozycja, którą A2 zostawił jako **NOT VERIFIED** („partial unique index,
`ON CONFLICT`, realny wyścig — tylko logicznie, zero uruchomień na bazie").

Indeks faktycznie istnieje:
```
ux_method_events_session_idempotency
  UNIQUE INDEX ON public.method_events USING btree (session_id, idempotency_key)
  WHERE (idempotency_key IS NOT NULL)
```

Próba na żywej bazie:

| Test | Oczekiwane | Zmierzone | Werdykt |
| --- | ---: | ---: | --- |
| ten sam `idempotency_key` wstawiony **2×** | 1 wiersz | **1** | **PASS** |
| dwa eventy **bez** klucza (`NULL`) | 2 wiersze | **2** | **PASS** |

Drugi `INSERT` zwrócił `INSERT 0 0` — `ON CONFLICT DO NOTHING` pochłonął duplikat
dokładnie zgodnie z projektem. Partial index poprawnie **nie obejmuje** `NULL`,
więc zdarzenia bez klucza nie są ze sobą mylone.

### G9.D — Integralność referencyjna działa (znalezione przy próbie)

Baza odrzuciła kolejno:
- `method_events_organization_id_fkey` → `organizations(id)`,
- `method_events_session_id_fkey` → `method_sessions(id)`.

Czyli **izolacja tenantów jest egzekwowana na poziomie schematu**, nie tylko
w kodzie aplikacji. `method_sessions_organization_id_fkey` ma
`ON DELETE CASCADE`, a `revision_of_session_id` → `ON DELETE SET NULL`
(rewizja nie kasuje przodka).

### G9.E — Co to zamyka i czego **nadal** nie dowodzi

**Zamknięte:** schemat wstaje od zera · moje migracje są addytywne i stosują się ·
partial unique index działa · FK i kaskady działają · idempotencja działa.

**Nadal NOT VERIFIED:** ścieżka **HTTP** UI → serwer · odczyt po restarcie
przeglądarki **z bazy** · realny wyścig współbieżny (dwa równoległe `append`) ·
`409`/version conflict · retry bez podwójnego Outputu · role i cross-org przez API.
To jest zakres A9, nieuruchomiony w tym kroku.

---

## G10 — Ścieżka HTTP (P0) i **blokada A9**

### G10.A — Warstwa routera: DZIAŁA na realnym Postgresie

| # | Wymaganie | Dowód (przebieg własny Opusa) | Werdykt |
| --- | --- | --- | --- |
| G10.1 | Router zamontowany | `server/src/Gateway.ts:820` → `app.use('/api/method', methodCoreRoutes)` | PASS |
| G10.2 | Testy integracyjne na **realnej bazie** | `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://mac:mac@localhost:55440/mac_test npx vitest run server/src/method-core` → **EXIT=0**, `Tests 115 passed (115)` | PASS |
| G10.3 | Migracja P0 stosuje się przyrostowo | `Applying migrations: 1 → 20260813_method_core_http_idempotency.sql`, `✅ complete` | PASS |
| G10.4 | Tabela idempotencji `create` | `method_session_create_idempotency` istnieje w bazie | PASS |

### G10.B — ★ BLOKADA: serwer nigdy nie osiąga gotowości

Próbowałem przeprowadzić **realny obieg HTTP** przez uruchomiony serwer
(nie przez vitest montujący router). Serwer **wstaje, ale nigdy nie zaczyna
obsługiwać tras biznesowych**.

| Krok | Polecenie / obserwacja |
| --- | --- |
| start | `PORT=3099 NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=... npx tsx src/index.ts` |
| log | `✅ Server started on port 3099` · `[Postgres] Schema initialization completed successfully` · `[AI:CircuitBreaker] initialized` — **i koniec** |
| żądanie | `GET /api/method/packs` → **HTTP 503** `{"error":"Server starting","code":"SERVER_STARTING","database":"initializing"}` |

**Dwa sprzeczne raporty gotowości w tym samym procesie:**

| Endpoint | Odpowiedź |
| --- | --- |
| `/api/health` | `{"status":"ok","database":"connected","dbResponseTime":7}` |
| `/api/health/ready` | `{"status":"ready","checks":{"database":true,...}}` |
| **`/api/ready`** (ten, który bramkuje trasy) | **`{"status":"not_ready","database":"initializing","error":null,"migrations":{"state":"pending","detail":null}}`** |

**Charakter defektu:**
- `migrations.state` zostaje na `pending` i **nigdy się nie ustala**;
- `error: null` — **nie ma żadnego komunikatu błędu**, proces po prostu wisi;
- log zamarza po inicjalizacji schematu (73 linie, brak przyrostu po >60 s);
- proces żyje, port odpowiada, ale **każda trasa `/api/*` zwraca 503**;
- `DISABLE_TP_MIGRATIONS=true` **nie pomaga** — zawieszenie jest przed tym krokiem albo flaga nie jest honorowana na tej ścieżce.

**To nie jest defekt wprowadzony przez tę pracę.** Dotyczy sekwencji startowej
aplikacji (`server/src/index.ts` → `settleDatabaseReadiness`), nietkniętej przez
żaden agent tej fali. Ujawnił się dopiero przy **realnym uruchomieniu** serwera
przeciw świeżo zmigrowanej bazie — czyli dokładnie tam, gdzie kazał patrzeć
koordynator.

### G10.C — Skutek dla A9

**A9 jest BLOCKED w krokach 2–16.** Nie da się:
utworzyć sesji przez HTTP · zamknąć i otworzyć przeglądarki · potwierdzić
odczytu z bazy · wykonać freeze/approval/Report/Initiative przez sieć —
dopóki serwer nie zaczyna obsługiwać tras.

**Co mimo to jest dowiedzione:** warstwa HTTP kernela **działa przeciw realnemu
Postgresowi** (115/115), łącznie z idempotencją, 409, izolacją tenantów i
retry-bez-duplikatu-Outputu. Testy montują router bezpośrednio, omijając
zablokowaną bramkę startową.

### G10.D — Świadoma decyzja P0, którą podtrzymuję

`DrdHttpSessionRuntime` **nie został podłączony** do `DrdMethodWorkspaceScreen`.
P0 powołał się na regułę #7 (właściciel nie jest pierwszym testerem wizualnym).
Podtrzymuję: podłączenie bez możliwości zrobienia zrzutu z **działającego**
backendu byłoby zmianą domyślnie renderowanego ekranu bez odbioru wzrokowego.
Ekran nadal używa runtime'u na `localStorage`.

**Konsekwencja, nazwana wprost:** wymaganie koordynatora „UI nie może utrzymywać
drugiej prawdy równoległej do serwera" **NIE jest jeszcze spełnione**.
Jest odblokowane po stronie serwera, zablokowane po stronie startu aplikacji.

---

## G11 — ★ BLOKADA ZDJĘTA: realny obieg HTTP przez żywy serwer

### G11.A — Przyczyna blokady (A14, zweryfikowana przez Opusa)

To **nie było zawieszenie**. Sekwencja inicjalizacji bazy **nigdy się nie uruchomiła**.

`server/src/index.ts` miał **dwie** bramki sprawdzające wyłącznie
`E2E_MODE`/`ENABLE_TEST_GATEWAY` i **ignorujące `RUN_DB_TESTS=1`**:

1. `databaseInitPromise` — pod `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` warunek
   dawał `false`, więc cały async IIFE ustawiający `dbReady` **nie wykonywał się
   w ogóle**. Stąd `error: null` — nie było błędu, bo nie było próby.
   Dowód: log **nigdy** nie zawierał `[Server] Initializing database...`;
   `pg_stat_activity` nie pokazywał żadnego zapytania w toku (zero blokady).
2. Montaż API Gateway — montował okrojony zestaw tras, pomijając
   `apiGateway.initializeRoutes(app)`. Po naprawie (1) trasa dawała **404**,
   nie 503 — czyli realnie nie istniała.

Naprawa: `server/src/startup/testModeGates.ts` (czyste funkcje
`shouldRunDatabaseInit`/`shouldMountFullGateway`) + `withTimeout.ts`
(`DB_READINESS_TIMEOUT_MS`, domyślnie 120 s) — realnie wisząca operacja kończy
się **błędem, nie ciszą**.

### G11.B — Serwer osiąga gotowość (przebieg własny Opusa)

```
PORT=3099 NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
  DATABASE_URL="postgresql://mac:mac@localhost:55440/mac_test" npx tsx src/index.ts
```
| Sprawdzenie | Wynik |
| --- | --- |
| log | `[Server] Initializing database...` → **`✅ Database ready — serving traffic`** |
| `/api/ready` | **`{"status":"ready","database":"ready","migrations":{"state":"ok","detail":"0 applied, 461 already up to date"}}`** |
| `/api/method/packs` bez tokena | **401** (nie 503, nie 404 — trasa obsługiwana, auth egzekwowane) |

Bramka **nadal blokuje** przy niekompletnym schemacie: z `DISABLE_TP_MIGRATIONS=true`
→ `/api/ready` **503** `not_ready` z **jawnym `error`**, trasy **503**.
Zabezpieczenie nie zostało rozbrojone.

### G11.C — ★ Realny obieg HTTP: żywy serwer + realny PostgreSQL

Skrypt Opusa, prawdziwy JWT (`config.JWT_SECRET`, `issuer`/`audience`),
prawdziwe `fetch`, weryfikacja **zapytaniami SQL do bazy**:

| # | Krok | HTTP | Dowód z bazy | Werdykt |
| --- | --- | ---: | --- | --- |
| 1 | `POST /sessions` (create) | **201** | id `ceb2b94c-e2f9-40ab-b2c5-80a476e278ff` | PASS |
| 2 | `POST /sessions` **retry** z tym samym `Idempotency-Key` | **200** | **ten sam id**; `count(method_sessions)` = **1** | PASS |
| 3 | `POST /events` **×2** z tym samym kluczem | 201 / 201 | `count(method_events … idempotency_key)` = **1** | PASS |
| 4 | `GET /sessions/:id` (resume) | **200** | `state=draft`, `version=1` — **odczyt z bazy** | PASS |
| 5 | dostęp **cross-org** | **403** | — | PASS |
| 6 | **bez auth** | **401** | — | PASS |
| 7 | `POST /transition` ze **stale version** (999) | **409** | zero zapisu | PASS |

Stan końcowy w bazie: `state=draft version=1`, event `ANSWER_CONFIRMED` utrwalony.

### G11.D — Bramka gotowości packa działa uczciwie

Pierwsza próba `POST /sessions` **odmówiła**: **422**
`{"error":"pack_not_released","refusal":{"kind":"pack_not_released","methodPackId":"drd"}}`
— bo pack DRD ma `readiness='methodology_review'`.

Sesja powstała dopiero po **trzech niezależnych warunkach** demo bypass:
środowisko nie-produkcyjne **∧** flaga operatora `METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true`
**∧** jawne żądanie klienta. Sam `demoBypass: true` w body **nie wystarczył**.
`method_packs.readiness` **pozostało `methodology_review`** — bypass go nie podniósł.

### G11.E — Co to zamyka, a czego nadal nie

**Zamknięte:** serwer wstaje przeciw świeżo zmigrowanej bazie · trasy kernela
obsługiwane · auth, role, izolacja org · idempotencja create i append ·
optimistic concurrency 409 · odczyt po zapisie z bazy · bramka packa i demo bypass.

**Nadal NOT VERIFIED:** freeze→Output przez HTTP w tym obiegu (kroki 10–16 A9) ·
restart **przeglądarki** i odczyt z bazy przez UI · `DrdHttpSessionRuntime`
**nie jest podłączony** do ekranu — wymaganie „UI nie może utrzymywać drugiej
prawdy" **wciąż niespełnione** · A10 (odbiór ręczny) · MPQ.
