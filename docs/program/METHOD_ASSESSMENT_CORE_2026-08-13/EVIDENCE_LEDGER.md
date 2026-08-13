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

## Otwarte / niezweryfikowane

- G1.9 — implementacja TIER: **potwierdzony BRAK** (grep `TIER`/`80:20`/`band`
  w `siriStructure.ts` = 0 trafień) → do zbudowania od zera.
- Stan tabel na **żywej** bazie demo/dev: NOT VERIFIED (powyższe dotyczy kodu
  migracji, nie żywej bazy — zgodnie z złotą regułą wymaga `information_schema`).
- Wartość `ENABLE_V8_GLOBAL` na dev/demo/prod: NOT VERIFIED.
- Czy Audits czyta `siriStructure.ts`/`drdStructure.ts`: NOT VERIFIED (COORD-03).
