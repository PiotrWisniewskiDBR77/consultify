# J17 — dowody mutacyjne (RED) i premisa

Data: 2026-09-08. Gałąź `mvp/jezyk-j17-serwer-kody`, baza `59f92c2330`.

## Mutacja 1 — słownik EN znika, `translateApiError` pada
Usunięto wpis `MFA_SETUP_FAILED` z `src/utils/apiErrorFallbacks.ts`.
```
× translateApiError > znany kod: EN dostaje angielskie zdanie, PL polskie
  Tests  1 failed | 7 passed (8)
```
Przywrócone; po przywróceniu 8/8 zielone.

## Mutacja 2 — nowa polska odpowiedź bez kodu, ratchet źródłowy pada
Dopisano do `server/src/routes/knowledge.routes.ts`:
`res.status(400).json({ error: 'Nie mozna wykonac tej operacji' })`
```
× J17 — serwer nie wysyła polskiego zdania bez kodu błędu > zero naruszeń spoza zamrożonej listy długu
  + 'server/src/routes/knowledge.routes.ts:2151:Nie mozna wykonac tej operacji'
  Tests  1 failed | 3 passed (4)
```
Przywrócone (`grep -c mutacja-j17` = 0).

## Mutacja 3 — domena enumów znika, `enumLabel` pada
Usunięto domenę `initiativeGateReadiness` z `src/utils/enumLabel.ts`.
```
× enumLabel > znana wartość: EN po angielsku, PL po polsku
  Tests  1 failed | 6 passed (7)
```
Przywrócone.

## PREMISA SPRAWDZONA — czerwony test NIE jest z J17
`tests/unit/i18n/i18nTrescPolska.test.ts` jest czerwony (12 naruszeń), ale
**wszystkie 12 istnieją już w bazie gałęzi `59f92c2330`** i żadne nie dotyczy
kluczy J17 (`errors.*`, `enums.*`, `initiatives.columns.*`).
Zmierzone wprost na plikach z bazy:
```
assessment.templatePicker.filters.framework | BASE pl="Framework" en="Framework"
branch.main                                 | BASE pl="Main"      en="Main"
execution.table.rag                         | BASE pl="RAG"       en="RAG"
executionReports.level.PMO                  | BASE pl="PMO"       en="PMO"
initiatives.capacityAnalysis.columns.roles  | BASE pl="Role"      en="Roles"
mindmap.cornerPanel                         | BASE pl="Panel"     en="Panel"
reportBuilder.templatePicker.card.system    | BASE pl="System"    en="System"
```
`i18nTrescPolska.baseline.json` ma 261 wpisów i nie zawiera `branch.main`.
Baseline należy do J0/CTO — **nie aktualizuję go sam** (polecenie paczki).

## PREMISA SPRAWDZONA — 7 czerwonych testów Inicjatyw też NIE jest z J17

`npx vitest run src/components/Initiatives/__tests__` daje 7 czerwonych testów
w 6 plikach. Sprawdzone wprost: te same pliki przywrócone do wersji z bazy
gałęzi `59f92c2330` (`git checkout 59f92c2330 -- <7 plików>`, potem przywrócenie
mojej wersji) dają **identyczny wynik**:

```
--- BAZA ---            Test Files  4 failed (4)   Tests  7 failed | 10 passed (17)
--- Z MOIMI ZMIANAMI --- Test Files  4 failed (4)   Tests  7 failed | 10 passed (17)
```

Przyczyny (żadna nie dotyczy kodów błędów ani enumów):
* `PlanScenarioSurface.listaPlanow` — brak eksportu `listPlannableInitiatives` w atrapie modułu,
* `a19-jedna-tabela-render` — `useLocation()` poza `<Router>`,
* `financialNarrativeBlocks` — surowy klucz i18n zamiast tekstu (kategoria K1def/K3a),
* `initiativeKartaRealnyRekord` — mapowanie `displayStatus` `IN_EXECUTION`↔`EXECUTING`
  (linie `initiativeRegisterProjection.ts:350/432`, których mój diff nie dotyka).

## tsc

* `tsc -p server/tsconfig.json --noEmit` → **0**
* `tsc -p tsconfig.json --noEmit` → **192** (próg paczki: ≤192).
  Jedyne błędy w plikach, które ruszałem, to 2 wpisy w
  `initiativeRegisterColumns.shared.ts` na WYRAŻENIU, którego mój diff nie zmienia
  (`getLocalizedStatusLabel(value, t ?? ((key) => key))`) — identyczny kod i identyczny
  typ `t?: (key: string, fallback: string) => string` są w bazie `59f92c2330`
  (linie 202/221 i 78 pliku bazowego).
