# Wpis 89 — RG-1 v3 (DEC-572) — bliźniak niesie sourceDataSnapshot z zamrożonej sesji

Data pomiarów: 2026-09-17/18 (kanał CEST). Gałąź `qoder/b-rg1v3-snapshot-20260918`, baza linii `487605f93f`.

## Defekt (zgłoszenie CTO, wdrożenie 25 na stagingu)

`ensureLegacyAssessmentTwinForSession` zapisywał bliźniaka `assessments` z pustymi
literalami snapshotu (`'{}', '{}'` w `legacyTwinService.ts`), więc
`reportBuilderService.getAssessmentSourceData` (:468-507) czytał `answers={}`,
`scores={}` i raport generował się BEZ danych sesji Method Core (tekst ogólny).

## KROK 0 — zmierzony łańcuch odczytu (file:line)

- `NewAssessmentReportModal.tsx:248` → `POST /api/v8/assessment/legacy-twin/:sessionId`
  (`server/src/routes/v8/assessment.routes.ts:673-721`, serwis :693).
- `legacyTwinService.ts:145` (stan PRZED): `?, 'APPROVED', '100', '{}', '{}', '{}'`.
- `reportBuilderService.getAssessmentSourceData:468-507`: `answers_json`→`answers` (:501),
  `score_summary`→`scores` (:502), `context_snapshot`→`context` (:503).
- `reportBuilderService.getSourceDataForReport:2465-2559`: grupowanie `answers.drd.areas`
  po prefiksie osi 1..7 (:2483-2527) + przeliczenie `scores.axes` gdy puste (:2529-2556).
- `reportGenerationService.generateSectionContent:1285-1319` → prompt: `scores` (:558, :612,
  :654), `axisData` (:626-634); branch deterministyczny matrix :1429-1478 zapisuje
  `generated_content` + `source_data_snapshot` (:1468).
- Front: `ReportEditor.tsx:299-320` (detekcja JSON) i `blocks/SmartBlockRenderer.tsx:53,128`
  → `blocks/MatrixHeatmap.tsx` w widoku „View".

Kształt zamrożonej sesji (pomiar na kopii dumpu): `method_outputs.current_json`/`target_json`
= `{unitId: poziom}` po 39 kluczy; `method_events` ANSWER_CONFIRMED = 104 zdarzeń / 39
`unit_id`; `method_findings` = 39; `aggregation_json.byGroup` = `{}` (brak kanonicznej
agregacji osi — stąd arytmetyka osi musiała zostać wydzielona do wspólnego modułu).
Adapter (bez nowego SQL): `methodOutputService.listOutputsBySession`
(`method-core/outputs/MethodOutputService.ts:538-555`) — ten sam wybór co
`assessmentReportContractService.build:236-239`.

## Naprawa

- NOWY `server/src/services/assessment/drdAxisAggregation.ts` — arytmetyka osi DRD
  przepisana 1:1 z `getSourceDataForReport` (`buildDrdAxesData`, `deriveAssessmentScores`),
  używana przez czytnik raportu I pisarza bliźniaka (zero dryfu).
- `legacyTwinService.ts`: `buildLegacyTwinSnapshotFromSession` mapuje `current/target`
  1:1 na `answers.drd.areas` (pomija jednostki bez pomiaru), liczy `scores` wspólną
  arytmetyką; INSERT pisze snapshot; `backfillTwinSnapshotIfEmpty` dopisuje snapshot do
  bliźniaków z v2 (warunek: `source_type='method_core_session' AND answers_json` pusty),
  bo oba klucze idempotencji zwracają istniejący wiersz. Test 4 dowodzi, że obcy wiersz
  o tym samym PK (`source_type='imported'`) NIE jest nadpisywany.
- `reportBuilderService.ts`: inline arytmetyka zastąpiona wywołaniem wspólnego modułu.

## Środowisko dowodu

Kontener `qoder-b-pg-89` (pgvector/pgvector:pg17), `127.0.0.1:6612`, DB `consultify_dump`,
restore z `~/Developer/kopie/staging-pre-wdrozenie25-20260917T2048.dump`
(250 686 337 B), `pg_restore` exit 0. Sesja NW `a9c8f477-8d8f-4d31-804d-a39700de4b0a`
(org `468b234c-66c4-54e1-b626-5e0fb3a92f6a`), szablon `tpl-drd-full-diagnostic-v2`
(14 sekcji, matrix = `overall_maturity`).

## Zmierzone liczby payloadu (z tego kontenera, nie z głowy)

- `TWIN_AREAS=39`, `SECTIONS=14`.
- `score_summary.axes`: 1→3.1 (target 4.4, gap 1.3), 2→2.4 (3.6/1.2), 3→2.2 (3.6/1.4),
  4→3.0 (4.4/1.4), 5→2.8 (4.0/1.2), 6→2.8 (4.6/1.8), 7→2.0 (3.4/1.4); `overallScore=2.6`,
  `maxScore=7`.
- `generated_content` sekcji matrix = `{"type":"assessment_matrix","scaleMax":7,"axes":[…]}`
  z tymi samymi wartościami.
- Higiena po każdym przebiegu: bliźniaki=0, raporty=0, artefakty=0, origin links=0
  (zmierzone `psql` w kontenerze po ostatnim przebiegu).

## Testy i mutacje

- `legacyTwinSnapshot.realpg.test.ts` (REAL PG, dump): 4/4 PASS — `w89-realpg-zielone2.log`,
  `w89-snapshot-zielone.log`.
- MUTACJA 1 (pisarz snapshotu wyłączony): 3 failed | 1 passed —
  `w89-snapshot-mutacja-czerwona.log` („expected +0 to be 39", „expected [] to have a length
  of 7 but got +0", „expected false to be true").
- `drdAxisAggregation.test.ts`: 7/7 PASS (fixtura = REALNE obszary osi 1 i 7 sesji NW).
- MUTACJA 2 (zaokrąglenie `round1` zepsute): 2 failed | 5 passed —
  `w89-axes-mutacja-czerwona.log`.
- Sąsiedzi zieloni: `reportGenerationService.test.ts` 2/2,
  `reportBuilderService.contract.test.ts` 4/4, `reportBuilderService.sourceRefsE2E.test.ts`
  3/3, `legacyTwinService.realdb.test.ts` 5/5 (`w89-realdb-zielone.log`).
- Sąsiedzi CZERWONI = ZASTANE (identycznie na bazie `487605f93f` w worktree `base-89`):
  `routes/v8/__tests__/assessment.routes.test.ts` („no tests", brak
  `validateOrgMembership` w mocku) — `w89-head-routes.log` vs `w89-base-routes.log`;
  `assessmentTargetLevel.day25.pg.test.ts` 1 failed | 10 passed („expected 400 to be 201")
  — `w89-head-day25.log` vs `w89-base-day25.log`.

## Bramka liczbowa (pierwszy plan; logi w tym katalogu)

1. `cd server && npx tsc --noEmit -p tsconfig.json` → exit 0, `grep -c 'error TS'` = 0
   (`w89-gate-tsc-server.log` pusty, bo brak błędów).
2. MUTACJA PRZYRZĄDU tsc (serwer): dopisane `export const w89Probe: number = "s";`
   → licznik 1 (`w89-gate-tsc-server-mut.log`), cofnięte.
3. Root tsc (8 GB): HEAD = 156 (`w89-gate-tsc-root.log`), BAZA `base-89` = 156
   (`w89-gate-tsc-root-base.log`) → nie wzrosło. MUTACJA PRZYRZĄDU (root): 157
   (`w89-gate-tsc-root-mut.log`), cofnięte.
4. `bash scripts/check-list-canon.sh` → 345 / baseline 346 (nie rośnie).
   `bash scripts/check-artefakt.sh` → 8 / baseline 8.
5. `npm run check:jezyk:ci` → exit 0 („nic nie wzrosło") — `w89-gate-jezyk.log`.
6. `NODE_OPTIONS=--max-old-space-size=8192 npm run build` → exit 0 — `w89-gate-build.log`.

## Zrzuty UI (EN, 1440×900, motyw ze store aplikacji, `--bez-chrome`)

Harness `dev-render` (port 5410 z puli B), ekran `rg1-opened-report` z payloadem
zmierzonym powyżej (fabularne liczby v2 „2.4 / 42 obszary / 0–4" USUNIĘTE):

- `rg1v3-report-en-light.png`, `rg1v3-report-en-dark.png` — edytor, sekcje z danymi sesji.
- `rg1v3-matrix-en-light.png`, `rg1v3-matrix-en-dark.png` — widok „View", sekcja
  „Overall Maturity Overview": 7 osi ze zmierzonymi wynikami 3.1/3.0/2.8/2.8/2.4/2.2/2.0,
  gapy, skala 1–7, overall 37% (2.6/7).
- `KONSOLA-BLEDY` i `SIEC-4XX5XX` puste przy każdym zrzucie → bledyKonsoli=0.
