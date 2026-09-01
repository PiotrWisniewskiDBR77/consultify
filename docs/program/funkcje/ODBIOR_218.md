# ★ 218 — AI Policy: trzy przyczyny zer, wszystkie trzy naprawione — dyżur `codex/day218-admin-polityki-20260901`, commit `99bdc944be` — 01.09.2026

**Ocena: A.** Nazwa commita („make AI policy summary states honest") sugerowała ryzyko,
że wykonawca tylko przestał udawać, zamiast naprawić. **To się nie potwierdziło.**
Audyt (świeży kontener Postgres, migracje od zera, realny `ApiGateway`, własne mutacje)
potwierdza: wszystkie TRZY przyczyny z `POMIAR_MODULOW_2026-08-31_WIECZOR.md` są
naprawione merytorycznie, nie tylko oznaczone jako błąd.

## Środowisko audytu (odtworzone niezależnie od wykonawcy)
Kontener własny `cx-aud218-pg` (`pgvector/pgvector:pg17`, port `6641`, poza zakazanymi
zakresami). Pełny łańcuch migracji od pustej bazy: **komplet zastosowany, `EXIT=0`**;
drugi przebieg: `Applying migrations: 0` (idempotentny). `llm_org_policies` istnieje po
migracji z poprawnym FK do `organizations` i indeksem.

## Trzy przyczyny — stan po naprawie, zmierzony, nie przeczytany

| przyczyna | naprawiona? | dowód |
|---|---|---|
| brak tabeli `llm_org_policies` | **TAK** | migracja `20260932_admin_llm_org_policies_table.sql`, addytywna, `\d` na świeżym Postgresie potwierdza kolumny i FK |
| rozjazd `governanceSummary` (front czytał `policyLevel/modelCount/budgetStatus`, backend miał `currentLevel/description/capabilities`) | **TAK** | front przepisany na `currentLevel/internetEnabled/auditRequired`; `modelCount`/`budgetStatus` **nie zastąpione fikcją** — `modelCount` zastąpiony realnym `internetEnabled`, `budgetStatus` realnym `auditRequired` (wybór R2b(a), dozwolony instrukcją) |
| rozjazd `contextPolicy` (front czytał `defaultSensitivity/allowExternalContext`, backend miał `categories/piiRedaction/retention`) | **TAK** | front czyta realny `piiRedaction`; `allowExternalContext` **uczciwie oznaczone `n/d`** — zweryfikowałem `contextGovernance.ts:15-22`: wszystkie 7 kategorii (`ORG_PROFILE`…`ORG_DOCUMENTS`) opisują dane WEWNĄTRZ organizacji, żadna nie odpowiada „kontekstowi zewnętrznemu" — decyzja wykonawcy o niefabrykowaniu jest poprawna merytorycznie, nie tylko ostrożna |

Dodatkowo: trzy niezależne statusy `governance/context/llm` (`ok`/`unavailable`)
rozróżniają teraz „zapytanie padło" od „wynik jest pusty" na WSZYSTKICH trzech
ścieżkach `readAiSummary`, nie tylko na tej, którą nazywał pierwotny opis usterki.

## Dowód przez realny ApiGateway + PostgreSQL — powtórzony własnymi rękami
`tests/integration/adminAiPolicySummary.day218.test.ts`, pełny env w jednej linii
(`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`,
`DATABASE_URL` na mój kontener, `--retry=0`), przez `ApiGateway.getInstance()
.initializeRoutes(app)`, podpisany JWT: **3/3 PASS** — zgodnie z raportem wykonawcy.
Komponent (`AdminAIControlCenterPanel.day218.test.tsx`): **3/3 PASS**.

## Mutacja RED→GREEN — wykonana przeze mnie, nie przepisana z raportu
Cofnąłem dokładnie ten sam bug, który dyżur naprawiał: `{ fallback: false }` →
`{ fallback: true }` w zapytaniu `llm_org_policies` (`adminP32.routes.ts:1523`).

```
RED:  1 FAIL — "reports unavailable instead of an honest empty state..."
      expected 'ok' to be 'unavailable'
GREEN (po cp-restore z kopii, bez git stash): 3/3 PASS
```

Dokładnie odtwarza wynik z raportu wykonawcy (`2/3 PASS, 1/3 FAIL` u niego —
różnica w liczniku wynika z resztkowego stanu mojego kontenera po poprzednim
przebiegu testu, sama asercja i miejsce awarii są identyczne).

## Dowód wzrokiem — zweryfikowany hash po hashu
6 zrzutów w `/private/tmp/cx-day218-admin-polityki-artefakty/` — SHA-256 **zgadzają się
co do bajtu** z raportem. Otworzyłem `full-light` i `unavailable-light`: kafelki
pokazują realnie różne treści („PROACTIVE / Internet włączony / on / Stan przeglądu:
APPROVED" kontra „Niedostępne (błąd sprawdzania)" na wszystkich trzech kafelkach) —
**to nie jest ta sama grafika pod dwiema nazwami** (bezpiecznik „duplikat zamiast
motywu" nie ma tu zastosowania, luminancje raportu 221–223 potwierdzają realny
kontrast light/dark).

## Higiena i rozłączność
Zero dotknięć `getAdminActor`/`verifyToken`/middleware (`Z12` czysty — 0 trafień w
diffie). Zero migracji poza przedziałem `20260932`. Push na `github-backup` potwierdzony
(`ls-remote` widzi gałąź). Rozłączność z 219: diff `adminP32.routes.ts` dotyka wyłącznie
`readAiSummary` (linie ~1483-1540); dyżur 219 dotyka `readBillingInvoices` (~1587) i
handlera `/billing/invoices` (~2729) — **zero nakładania się linii**, potwierdzone
niezależnym `git diff` obu gałęzi. Jedyna kolizja: oba dyżury dopisują nową sekcję w to
samo miejsce `MODULE_ACCEPTANCE.md` (przed `## Owner verdict`) — to konflikt tekstowy
przy scalaniu, nie nadpisanie kodu; nadzorca musi scalić ręcznie (dodać obie sekcje), nie
brać jednej wersji.

## Drobna uwaga (nieblokująca)
Zrzuty R4 pochodzą z `dev-render`, nie z kanonicznego `server/src/index.ts` — wykonawca
sam to zaznaczył w „TWIERDZENIA NIEZWERYFIKOWANE" jako `dev-render` dozwolony przez
instrukcję. Zgodne z `CLAUDE.md` regułą 7 (Piotr nie jest pierwszym testerem) — ekran
czeka na akcept właściciela na tych zrzutach, flaga nie została włączona domyślnie
(to naprawa istniejącego, już zamontowanego ekranu, nie nowy ekran w rozumieniu `Z11`).

## Werdykt
**SCALIĆ.** Trzy przyczyny zer — naprawione, nie zamiecione. Rozjazd kontraktu naprawiony
po stronie frontu, mapując na REALNE pola backendu (opcja lepsza niż samo „unavailable").
Zero fabrykowanych metryk. Mutacja potwierdza zabezpieczenie własnymi rękami audytora.

## Odpowiedź wprost
**Ile z trzech przyczyn zer na ekranie polityk faktycznie naprawiono: WSZYSTKIE TRZY.**
Nie jest to „wykonawca przestał udawać" (choć i to by było dopuszczalne) — jest to
rzeczywista naprawa: brakująca tabela dodana, oba rozjechane kontrakty przemapowane na
pola, które istnieją i są zasilane realnymi danymi z bazy, a jedyne pole bez realnego
odpowiednika (`allowExternalContext`) uczciwie oznaczone jako niedostępne z uzasadnieniem
opartym na pomiarze kodu źródłowego, nie na domysłach.
