# Inicjatywy pokazują 0 pozycji — RAPORT (MVP fix)

Gałąź: `mvp/inicjatywy-pusta-lista`, bazowa SHA `9e3bdbd1f8` (origin/staging, repo `/private/tmp/m03`).
Commit naprawy: `41095d586c` — `[ODMROZENIE 05_INITIATIVES DEC-397] fix(initiatives): backfill list from legacy /api/initiatives when runtime-v1 projection is empty`.

## Przyczyna (zmierzona, nie hipoteza)

`InitiativesHub.fetchData` (src/components/Initiatives/InitiativesHub.tsx:504, przed naprawą)
karmił się **wyłącznie** `listRegisteredInitiatives()`
(src/services/initiatives-execution/runtimeApi.ts:1042) → `GET /api/initiatives/runtime-v1/initiatives`.
Ten endpoint (server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1949) czyta
projekcję event-sourced `ie_aggregate_state`
(server/src/domain/initiatives-execution/postgresInitiativeReader.ts:1335, `listInitiativesPage`).

Klasyczny `GET /api/initiatives` (server/src/routes/pmo/initiatives.routes.ts:1178 →
`InitiativeController.getInitiatives`, server/src/controllers/InitiativeController.ts:174) czyta
**inną, klasyczną tabelę SQL** `initiatives` — osobny rejestr, nigdy niesynchronizowany
z `ie_aggregate_state`.

Zmierzone na stanowisku lokalnym (org DBR77, `audyt@dbr77.local`, bearer token przez
`POST /api/auth/login`):

| Endpoint | Wynik |
|---|---|
| `GET /api/initiatives` (legacy) | 200, tablica **71** rekordów |
| `GET /api/initiatives/runtime-v1/initiatives` (to woła UI) | 200, `{initiatives: [], nextCursor: null}` — **0** |

71 rekordów istnieje realnie (zasiane bezpośrednio do klasycznej tabeli / sprzed migracji na
runtime-v1) i nigdy nie zostało "wypromowane" przez runtime-v1 command surface (jedyny pisarz
do `ie_aggregate_state` — `createInitiativeWriteTruth` →
`registerSourceProposal`/`submitSourceProposal`, src/services/initiativeWriteTruth.ts:149).
Dwa osobne rejestry, ekran czytał ten pusty — wzorzec "Dwa rejestry — licznik mierzy rozjazd" /
"Zbudowane, ale niepodłączone".

Status w 71 legacy rekordach jest już w słowniku `InitiativeStatus` (EXECUTING/DRAFT/PLANNING/…)
— hipoteza "status spoza słownika" ze zlecenia **nie potwierdziła się** jako przyczyna główna
(sprawdzone: wszystkie 71 statusów są w enumie), ale bezpiecznik na nieznany status i tak
dodany w mapperze (patrz niżej) na przyszłość.

## Naprawa (SSOT, nie obejście per ekran)

- `src/services/initiatives-execution/runtimeApi.ts`: nowy `listLegacyInitiatives()` — czyta
  klasyczny `GET /api/initiatives` (ten sam wzorzec `readJson`/`RuntimeApiError` co reszta pliku).
- `src/components/Initiatives/initiativeRegisterProjection.ts`: nowy
  `toCanonicalInitiativeRegisterItemFromLegacyRow()` (mapuje legacy wiersz na `PortfolioInitiative`;
  nieznany status → `InitiativeStatus.DRAFT` + surowa wartość zachowana w `displayStatus` —
  zasada „brak danych nie ukrywa rekordu") oraz `mergeLegacyInitiativesIntoRegister()`
  (canonical/runtime-v1 wygrywa przy kolizji id, legacy dokleja tylko brakujące wiersze).
- `src/components/Initiatives/InitiativesHub.tsx` (`fetchData`): woła `listRegisteredInitiatives()`
  i `listLegacyInitiatives()` równolegle, scala PRZED istniejącym pipeline'em filtrów
  (scope/status/lifecycle/search) — żaden nowy filtr per ekran, sam SSOT wzbogacony.

## Dowód mutacyjny

`src/components/Initiatives/__tests__/initiativeRegisterProjection.legacyMerge.test.ts` — fikstura
to REALNA odpowiedź API (`tests/fixtures/initiatives-local.json`, 71 wierszy, `curl` z prawdziwym
tokenem).

- Z naprawą: **5/5 PASS** (merge daje 71 widocznych, brak duplikatów, unknown-status → DRAFT
  widoczny, no-legacy-rows → referencja niezmieniona).
- Ręcznie przywrócone stare zachowanie (`mergeLegacyInitiativesIntoRegister` zwraca tylko
  `canonicalRows`, bez merge'a): **2/5 FAIL** — `expected 0 to be 71` — dokładnie odtwarza
  zmierzony defekt.

## PRZED / PO (zrzut na żywo, sesja Playwright `audyt@dbr77.local`)

| | Port | Wiersze tabeli (`table tbody tr`) | Błędy konsoli |
|---|---|---|---|
| PRZED (bez naprawy) | 3090 (`stanowisko-noc`, kod bez fixa) | **0** | 0 |
| PO (własny vite, ten sam kod + fix, ta sama baza/API :4100) | 3091 | **62** | 0 |

62 zamiast 71 to poprawne — domyślny filtr "Aktywne" (scope) wyklucza DONE/CANCELLED/ARCHIVED
(71 − 5 DONE − 3 CANCELLED − 1 ARCHIVED = 62), dokładnie jak przed defektem robił dla
runtime-v1-only danych. Zakładka „Wszystkie" liczy 67 (Menu 3 preset, osobny licznik —
niezmieniony przez tę naprawę).

Zrzuty: `evidence/mvp-inicjatywy-lista/PRZED-3090.png` (+ `.json`),
`evidence/mvp-inicjatywy-lista/PO-3091.png` (+ `.json`).

## Rodzina (grep siblings)

`grep -rln listRegisteredInitiatives src/components/**/*.tsx` → wyłącznie
`InitiativesHub.tsx` (+ jego testy). Żaden inny Hub nie konsumuje tego samego
źródła/wzorca — brak rodzeństwa do naprawy.

## Statyczne bramki

- esbuild (platform=browser) na 3 dotkniętych plikach: **OK**, brak błędów.
- `vitest run src/components/Initiatives/__tests__/`: **184 passed / 4 failed** — te same
  4 nieudane testy (financialNarrativeBlocks i18n-key mismatch, InitiativesHub.smoke.test.tsx
  fetchMock timing) failują IDENTYCZNIE na kodzie sprzed naprawy (zweryfikowane: podmieniono
  3 pliki z powrotem na `HEAD~1`, uruchomiono te same testy — te same 2 pliki testowe czerwone,
  ta sama liczba testów) — pre-istniejące, niepowiązane z tą zmianą.
- `bash scripts/check-list-canon.sh` na 3 dotkniętych plikach: **OK**, 0 nowych naruszeń.
- `git commit` przeszedł przez pełny łańcuch pre-commit hooków (check-artefakt, check-triada,
  check-gestosc, check-focus-canon, check-flags-env-static, verify-canonical-16) — 0 nowych
  naruszeń.
