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
