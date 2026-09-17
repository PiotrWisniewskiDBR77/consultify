# Wpis 86 — D-66 + D-69 (DEC-539, STAGE-1) — dowody pomiarowe

Data pomiaru: 2026-09-18 (CEST). Stanowisko B, gałąź `qoder/b-d66-seed-stage-20260918`.

## Baza dowodu

- Kopia DUMPU 22: `~/Developer/kopie/staging-pre-wdrozenie22-20260917T1636.dump`
  (250 437 913 B, `pg_dump` 17 → kontener `pgvector/pgvector:pg17`,
  `qoder-b-pg-d66`, `127.0.0.1:6612`, baza `consultify_dump`, `pg_restore` exit 0).
- Migracje nałożone na kopię: **3 oczekujące, w tym `20262260`** —
  `migracje-dump22.log`:
  `20262260_initiatives_lifecycle_stage.sql`, `20262300_showcase_date_roll.sql`,
  `20262301_meetings_agenda_lifecycle.sql`.
- Test RealPG asertuje obecność `20262260` w `schema_migrations` w `beforeAll`
  (zielony nie może oznaczać „triggera po prostu nie było").

## D-66 — `parity-zielone.log` (4/4 PASS)

`server/src/services/demo/__tests__/demoSeedStageParity.pg.test.ts`:

1. `startDemoSession` na bazie Z `20262260` kończy się sukcesem
   (`datasetComplete === true`) — przed naprawą rzucał
   `[ClosureDeliveryReceipt] materialized DONE receipt was not persisted`.
2. Liczby `initiatives.status` klonu = liczby z szablonu seeda (PRZED == PO),
   liczone tym samym normalizatorem (`normalizeInitiativeStatus`, fallback DRAFT).
3. 0 rozbieżnych par status↔agregat; każdy zasiany CLOSED ma stage `CLOSED`
   (nie `REGISTERED_DRAFT`) w agregacie I w kolumnie `lifecycle_stage`.
4. Każdy zasiany CLOSED ma swój wiersz w `closure_delivery_receipts`.

Dodatkowo align po seedzie melduje `already-aligned=21 wrote=0` — klon rodzi się
spójny, align nie ma już czego naprawiać.

## D-66 — dowód mutacyjny `parity-mutacja-czerwona.log` (4/4 FAIL)

Mutacja: naprawa stage'a w seedzie wyłączona (agregat zostaje na
`REGISTERED_DRAFT` z rejestru). Wynik: wszystkie 4 testy czerwone, pierwszy z
DOKŁADNIE pierwotnym błędem `[ClosureDeliveryReceipt] materialized DONE receipt
was not persisted` (`closureDeliveryReceiptService.ts:224`). Mutacja cofnięta,
pomiar powtórzony → 4/4 zielone.

Ten sam przebieg udowodnił D-69 na żywej bazie: w logu widać
`tenant demo-org-session-d66b98fc9d-mu63igyr rolled back`, a pomiar po biegu
`orgs=0 initiatives=0 sessions=0` — sierocy org nie został.

## D-69 — `d69-mutacja-czerwona.log` (1 FAIL / 4 PASS)

Mutacja: przywrócony goły `await seedAtelierToysDemoDataset(...)` bez
`try/catch`. Czerwony dokładnie test purge'u
(`★ the partial tenant is purged: no orphan clone org, no demo_sessions row, no
preferences`); po przywróceniu naprawy 5/5 zielone.

## D-19 v3 bez skipa — `livealign-zielone.log` (2/2 PASS)

Wpis 78 tolerował pad seeda jako skip środowiskowy; D-66 naprawił jego przyczynę,
więc skip-guard usunięto (każdy pad seeda = twardy czerwony). Przy okazji
zmierzono, że dawny sposób budowania rozbieżności w teście 2 (UPDATE agregatu na
`REGISTERED_DRAFT`) jest na bazie z `20262260` samounieważniający — kaskada
natychmiast wyprowadza z niego kolumnę, więc `counts.align === 0`. Rozbieżność
budowana jest teraz przez KOLUMNĘ (`UPDATE initiatives SET status='IN_EXECUTION'`),
tak jak robił to przed-D-66 seed.

## Bramka liczbowa

| Pozycja | Wynik |
| --- | --- |
| `server` `tsc --noEmit` | 0 błędów |
| root `tsc --noEmit` (8 GB) | 156 błędów ≤ baseline 169 |
| `check-list-canon.sh` | 345 ≤ 346 (dług spadł o 1) |
| `check-artefakt.sh` | 8 = 8 |
| `check:jezyk:ci` | exit 0, „nic nie wzrosło" |
| `npm run build` (8 GB) | exit 0, `✓ built in 53.56s` |
| Testy per plik | patrz niżej |

## Sąsiedzi katalogu — `sasiedzi-katalog-demo.log`

22 pliki nie-`.pg.` z `server/src/services/demo/__tests__/`, każdy osobno
(`--retry=0`): 17 exit 0, 5 exit 1. Wszystkie 5 zmierzono TAKŻE na bazie
(detached worktree `qoder-wt/consultify-w1-base`, `16309beba5`; katalogi
`server/src/services/demo` i `.../initiatives` identyczne z bazą mojej gałęzi
`e1e9f5d176`) — **te same nazwy czerwonych testów, więc ZASTANA, nie NOWA**:

- `atelierFinanceCoherence.test.ts` — 2 czerwone (FIN-005)
- `atelierPresentationDeckSeed.test.ts` — 1 czerwony
- `atelierSeedIdempotency.test.ts` — 1 czerwony
- `atelierSpineCoherence.test.ts` — 1 czerwony
- `demoSeedFailurePropagation.test.ts` — 1 czerwony

Nowe/zmienione pliki testowe tego zadania: `demoSeedStageParity.pg.test.ts` 4/4,
`demoSessionSeedAbort.test.ts` 5/5, `demoSessionLiveAlign.pg.test.ts` 2/2,
`tests/backend/__tests__/align-initiative-aggregate-state.test.ts` 21 passed
+ 1 skipped (blok RealPG poza zakresem env).
