# ★ 219 — Rozliczenia i SCIM: schematy zgadzają się na bazie z migracji; i18n naprawiony w kodzie, luka w bramce — dyżur `codex/day219-admin-schematy-20260901`, commity `24a2da92f4`/`b93910bc69`/`180c86b1c4` — 01.09.2026

**Ocena: A-.** Naprawa schematu (Billing + SCIM) jest solidna i zweryfikowana przeze mnie
niezależnie na świeżym Postgresie zbudowanym wyłącznie z migracji. i18n jest naprawiony
w KODZIE poprawnie (potwierdzone czytaniem diffu), ale znalazłem realną, niezerową lukę w
bramce testowej R3d — nie łapie ona błędnej mapy w gałęzi `currentView`, mimo że
instrukcja wprost żądała pokrycia `pathSection/tabParam/currentView`.

## Środowisko audytu (odtworzone niezależnie od wykonawcy)
Kontener własny `cx-aud219-pg` (`pgvector/pgvector:pg17`, port `6642`). Pełny łańcuch
migracji od pustej bazy: **komplet zastosowany, `EXIT=0`**; drugi przebieg: `Applying
migrations: 0` (idempotentny).

## R1 — Billing: `invoices.issue_date` — POTWIERDZONE na żywej bazie
`\d invoices` po migracji: kolumna `issue_date` istnieje, `DEFAULT CURRENT_TIMESTAMP`.
Decyzja o DEFAULT uzasadniona poprawnie: 5 ścieżek `INSERT INTO invoices` w `server/src`
nie podają `issue_date` jawnie (zmierzyłem to samo: `billing.routes.ts`,
`billing/billing.routes.ts`, `superadmin.routes.ts`, `InvoiceService.ts`,
`BillingCommandService.ts`). `150_billing_phase2.sql` (numer 150 < 500, nie zaczyna się
od `000_z_core_baseline`) faktycznie wykluczony z Postgresa przez
`migrate.postgres.ts:266-269` — potwierdza pierwotną diagnozę „przyczyna to filtr
migratora, nie brakująca migracja źródłowa".

**Mutacja wykonana przeze mnie** (nie przepisana z raportu): cofnąłem `fallback:false` →
`fallback:true` w `readBillingInvoices`.
```
RED:  R1 "distinguishes a missing issue_date column..." FAIL
      -status: "unavailable"  +status: "ok"  (błąd znów udaje pustkę)
GREEN (po cp-restore): 3/3 PASS
```
UI nadal pokazuje `due_date`, nie `issue_date` — **to jest zgodne z instrukcją**, R1b
wyraźnie mówi, że wystawienie `issue_date` w UI to osobna decyzja produktowa poza
zakresem tej naprawy schematu. Nie jest to defekt.

## R2 — SCIM: `organization_id` — POTWIERDZONE na żywej bazie, obie tabele
`\d scim_group_mappings` i `\d scim_sync_logs` po migracji: obie mają `organization_id`
+ indeks. `scim_tokens`/`scim_conflict_log` miały kolumnę już wcześniej — potwierdzone.
Migracja (nie `hasColumn`-owy wzorzec) uzasadniona poprawnie: `organization_id` na
tabeli tenant-scoped to granica bezpieczeństwa, nie opcjonalny wymiar.

**Mutacja wykonana przeze mnie:** `ALTER TABLE scim_group_mappings DROP COLUMN
organization_id` na żywym kontenerze po migracji, potem ten sam pakiet testów.
```
RED:  cała suita pada już przy fixture — "column organization_id of relation
      scim_group_mappings does not exist" (dokładnie ten sam błąd co T8/R2c(4))
GREEN (po ręcznym ADD COLUMN + CREATE INDEX): kolumna i indeks przywrócone
```
Para dowodowa izolacji (org-A widzi swój mapping, org-B nie widzi cudzego) —
`R2 keeps the foreign SCIM mapping invisible while the owner mapping remains visible`
— **PASS** na moim kontenerze przez realny `ApiGateway` + JWT.

**Rzetelne ujawnienie długu, zweryfikowane przeze mnie:** `integrations/scim.routes.ts`
ma dwa `INSERT` (`scim_group_mappings:1061`, `scim_sync_logs:236`), **żaden nie ustawia
`organization_id`** — potwierdzone grepem i odczytem kodu. Wykonawca to znalazł, opisał
jako aktywny (nie teoretyczny) dług POZA licencją tego dyżuru, i słusznie nie naprawił
pliku spoza `Z17`/tabeli licencji. To jest dokładnie poprawne zachowanie przy napotkaniu
czegoś poza zakresem — ujawnić, nie ukryć i nie „przy okazji" naprawić.

## R3 — i18n globalnej nawigacji — kod poprawny, bramka ma lukę (mój ustalenie)
Diff `useBreadcrumbs.ts`: `ADMIN_SECTION_TITLES` przepisane na `{key, fallback}`,
osiem etykiet ma jedno źródło prawdy w obu ścieżkach (`pathSection`/`tabParam` ORAZ
łańcuch `else if (currentView...)`) — **zweryfikowałem czytaniem całego diffu**, każda
z dziewięciu gałęzi `currentView` (`ADMIN_USERS`…`ADMIN_SECURITY` + `else`) woła
`adminSectionTitle(...)` z poprawnym kluczem, zero osobnych angielskich literałów.
Tłumaczenia PL dodane dla wszystkich 8 kluczy w `adminSection.*`, EN zachowuje oryginał.
`AppRoutes.tsx:915/1075` faktycznie woła hook i przekazuje wynik do `MainLayout`.

**Baseline testu `useBreadcrumbs.day219.test.ts`: 16/16 PASS**, potwierdzone u mnie.

**★ Luka znaleziona adwersaryjnie.** Wszystkie 16 przypadków testowych ustawiają
`pathname = '/admin/<sekcja>'`, więc **zawsze** trafiają w gałąź
`if (pathSection && ADMIN_SECTION_TITLES[pathSection])` — łańcuch `else if
(currentView === AppView.ADMIN_TEAM) ...` (i pozostałych 8 gałęzi `currentView`) **nigdy
nie jest wykonywany przez tę suitę**. Zmutowałem jedną linię na BŁĘDNY klucz zamiast na
literał angielski:
```
- else if (currentView === AppView.ADMIN_TEAM) sub = adminSectionTitle('people');
+ else if (currentView === AppView.ADMIN_TEAM) sub = adminSectionTitle('billing');
```
Wynik: **16/16 PASS mimo błędnego mapowania** — czyli mylne przypisanie sekcji
(np. „Zespół" pokazujący etykietę „Rozliczenia") wypuszczone by się nie złapało.
Instrukcja R3d wprost żąda: „dla każdej z ośmiu wartości `pathSection/tabParam/
currentView`" — bramka pokrywa tylko pierwsze dwie z trzech ścieżek. Kod jest
poprawny (zweryfikowałem ręcznie każdą linię), ale **twierdzenie w raporcie
„zmierzono osiągalność wszystkich ośmiu ścieżek" jest prawdziwe tylko dla ścieżki
URL, nie dla ścieżki `currentView`-bez-URL** — mutacja pozostaje niewykryta.
Cofnąłem mutację (`cp` z kopii), diff czysty.

## Migracje, kolejność alfabetyczna, drugi przebieg
Cały łańcuch (w tym `20260719_baseline_gap.sql` przed `20260936`/`20260937`) przechodzi
bezbłędnie od pustej bazy w JEDNYM przebiegu — brak śladu pułapki „migracja czyta
kolumnę zanim ta, która ją tworzy, zdążyła się wykonać". Drugi przebieg: `Applying
migrations: 0`.

## Rozłączność z 218
`git diff` `adminP32.routes.ts` dla 219 dotyka wyłącznie `readBillingInvoices`
(~1587-1600) i handlera `/billing/invoices` (~2729-2732); `readScimSummary` (~2021-2114)
**nietknięty w tym pliku** — naprawa SCIM to wyłącznie migracja, zero zmian w zapytaniu
(poprawne, bo `CREATE TABLE IF NOT EXISTS` już miało `organization_id` w definicji;
problemem był wyłącznie stan istniejącej tabeli, nie kod zapytania). Zero nakładania
linii z dyżurem 218. Kolizja w `MODULE_ACCEPTANCE.md` (ten sam punkt wstawienia) —
identyczna jak opisana w karcie 218, do ręcznego scalenia przez nadzorcę.

## FIX-219 (niekrytyczny, do rozważenia przed pełnym zamknięciem R3)
**FIX-219-1.** Rozszerzyć `useBreadcrumbs.day219.test.ts` o przypadki, w których
`pathname` NIE zawiera sekcji (np. `/admin` gołe) i `currentView` ustawiane na każdą z
dziewięciu wartości (`ADMIN_USERS`, `ADMIN_PROJECTS`, `ADMIN_LLM`, `ADMIN_KNOWLEDGE`,
`ADMIN_FEEDBACK`, `ADMIN_BILLING`, `ADMIN_ANALYTICS`, `ADMIN_ORGANIZATION`,
`ADMIN_TEAM`, `ADMIN_WORKSPACE`, `ADMIN_AI`, `ADMIN_SECURITY`), asertując zarówno
brak angielskiego literału JAK I poprawność klucza (nie tylko „coś się przetłumaczyło").
Bramka bez tego nie spełnia R3d dosłownie, mimo że kod źródłowy jest poprawny.

## Werdykt
**SCALIĆ z zastrzeżeniem FIX-219-1.** R1 i R2 (rdzeń zamówienia — niezgodności schematu)
są naprawione i zweryfikowane mutacyjnie własnymi rękami audytora, na bazie zbudowanej
wyłącznie z migracji. R3 jest naprawiony w kodzie poprawnie, ale gate nie dowodzi tego,
co deklaruje raport — to różnica między „działa" i „udowodnione, że działa" (`Z34`).
Żadna z tych spraw nie jest blokująca dla schematów Billing/SCIM, które są sednem tego
dyżuru.

## Odpowiedź wprost
**Czy schematy Rozliczeń i SCIM zgadzają się teraz na bazie zbudowanej wyłącznie z
migracji: TAK, potwierdzone niezależnie.** `invoices.issue_date` istnieje z sensownym
DEFAULT; wszystkie cztery tabele SCIM (`scim_tokens`, `scim_group_mappings`,
`scim_sync_logs`, `scim_conflict_log`) mają `organization_id` po pełnym łańcuchu migracji
na świeżym kontenerze, drugi przebieg idempotentny. Jedyne zastrzeżenie: nowe wiersze
zapisywane przez `integrations/scim.routes.ts` (plik poza licencją tego dyżuru) nadal nie
ustawiają `organization_id` — to świadomy, ujawniony dług, nie ukryta wada schematu.
