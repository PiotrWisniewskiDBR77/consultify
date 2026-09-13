# C6 — niezależny review do W00

Data: 2026-09-12. Reviewer: canonical_writers. **Werdykt: HOLD dla odbioru pełnego C6 oraz E3/E4.** Istnieją lokalne dowody części zachowania, lecz poniższe błędy i brakujące scenariusze wykluczają uznanie dostawy za gotową do pilotażu.

## 1. Tożsamość i granice

- Review dotyczy wyłącznie `e29dd98236e3f3dfc03b522489429769b2ffb4e8`, WT `/Users/piotrwisniewski/Developer/codex-wt/codex6-gotowosc-pilotazu`, branch `codex/gotowosc-pilotazu-20260912`. HEAD i czysty status zweryfikowano na początku; marker `45c07b024c` jest przodkiem HEAD. Instrukcja zawiera placeholder `<<MARKER_SHA_6>>`; marker odczytano z raportu, nie wymyślono.
- Pełna instrukcja: `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX6_GOTOWOSC_PILOTAZU/01_INSTRUKCJA.md`; przeczytano również pełny `98_RAPORT.md`, odziedziczoną instrukcję C4 oraz `/Users/piotrwisniewski/Developer/codex-wt/codex6-artefakty/HANDOFF-ACTIVE.md`. Nie znaleziono AGENTS.md w WT ani sprawdzonych katalogach nadrzędnych.
- E3: `6117cdbf67` (poprzednia podstawa `76787fdd11`). E4: `cb251a2523`. E1 `0c65beabf6`, E2 `9f778907f6`, E5 `b2e4dd9459`.
- **Nie uruchamiano testów, aplikacji, bazy, migracji ani operacji live. Nie zmieniano repozytorium.** Odczytano kod, istniejące logi i dwa zrzuty. Żaden finding poniżej nie jest nowym pomiarem RED. Po informacji root o wznowieniu implementacji dalsze odczyty robiono przez `git show e29dd98236:path`; ten raport nie ocenia nowego WIP.
- Ścieżki źródłowe poniżej są względne do wskazanego WT i odnoszą się do starego exact SHA, nawet jeśli pliki robocze później się zmienią.

## 2. Findingi wymagające naprawy

### C6-R1 · P1 · E4: eksport ujawnia pola uwierzytelniania

Nowy tenant-admin GET w `server/src/routes/organization/ownership.routes.ts:48` deleguje do `exportOrganizationData`. W `server/src/services/organizationLifecycleService.ts:130`–158 każda tabela organizacji trafia do pliku przez `SELECT *`, bez redakcji kolumn. `server/migrations/000_initdb_core_tables.sql:57`–78 definiuje w `users` jednocześnie `organization_id`, `password`, `mfa_secret`, `mfa_backup_codes`. Uprawnienie administratora do danych organizacji nie jest uprawnieniem do materiału uwierzytelniania innych użytkowników. Problem dotyczy JSON i CSV, bo CSV serializuje ten sam obiekt (service:176).

**Odbiór naprawy:** jawna projekcja bezpiecznych danych wszystkich eksportowanych tabel; fikcyjne markery sekretów w wielu tabelach; rzeczywisty JWT/ApiGateway/PG eksport JSON i CSV nie może zawierać markerów ani nazw pól sekretów, a legalne dane muszą pozostać. Drugi tenant ma stanowić realną kontrolę negatywną. Nie drukować pobranych sekretów w logach.

### C6-R2 · P1 · E3: budżet edytowany w UI nie steruje nową bramką

`src/views/admin/OrgAISettingsView.tsx:302` zapisuje ustawienia przez AdminApi; edytowane `monthlyBudgetUSD` jest przy linii 794. `server/src/services/aiSettingsService.ts:326`–376 zapisuje je do `organization_ai_settings.monthly_budget_usd`. Nowy limiter (`server/src/services/ai/organizationCostLimiter.ts:37`) czyta/prowizjonuje `ai_budgets.budget_limit` (`server/src/services/aiBudgetService.ts:303`–325). Nie ma synchronizacji tych zapisów w tej ścieżce. Nowy odczyt Used/Monthly limit/Remaining również pochodzi z ai_budgets, obok innego edytowalnego budżetu.

**Scenariusz:** organizacja ma aktywne 50/50 USD w ai_budgets; administrator zapisuje Monthly Budget=100 w ustawieniach; stara bramka nadal odrzuca żądanie z komunikatem proszącym administratora o podniesienie budżetu. Samo istnienie osobnego CRUD budżetów nie naprawia tej konkretnej ścieżki UI.

**Odbiór:** jeden jawny kontrakt limitu; UI save → SQL → reload UI → real AI gate poniżej/powyżej zmienionego limitu. Bez ręcznego UPDATE wartości będącej przedmiotem testu. Zachować domyślne OFF i 50 USD dla nowej organizacji.

### C6-R3 · P1 · E4: legal hold może być pominięty przy błędzie odczytu

Handler DELETE (`ownership.routes.ts:75`) używa `requireNoLegalHold`. `server/src/services/OrgPoliciesService.ts:18`–32 zwraca false po każdym błędzie zapytania, także awarii DB. Zatem błąd samego odczytu polityki nie zatrzymuje późniejszej destrukcyjnej transakcji. Ponadto sprawdzenie odbywa się przed BEGIN/lockiem (handler:75–79), więc nie jest związane atomowo z usunięciem.

**Odbiór:** fail-closed dla błędu policy read; legal hold aktywny, nieaktywny i brak polityki zgodnie z istniejącym kontraktem; kontrolowane przeplatanie aktywacji hold z kasowaniem. Każda odmowa zachowuje dane i nie tworzy receipt sukcesu. Nie wyłączać globalnej ochrony.

### C6-R4 · P1 · E4: usunięcie używanego tenantu koliduje z trwałymi potwierdzeniami

`organizationLifecycleService.ts:236`–267 odkrywa bezpośrednie organization_id/FK, następnie wykonuje DELETE dla każdej tabeli. Ponawia tylko 23503; pozostałe wyjątki przerywają transakcję.

Konkretny kontrprzykład ze schematu: `server/migrations/20261030_settings_account_deletion_request_lifecycle.sql:8`–33 ma `account_deletion_request_receipts.organization_id` z FK RESTRICT i bezwarunkowy trigger BEFORE UPDATE OR DELETE rzucający wyjątek. Legalne requested/cancelled tworzy taki rekord przez trigger przy liniach 35–53. Jeżeli migracja i choć jeden taki rekord są obecne, masowy DELETE natrafi na immutable trigger, a cała operacja się wycofa. Stan zastosowania migracji w bazie **nie był sprawdzany** w tym read-only review.

Drugi przykład: `20260930_ai_agent_job_receipts.sql:24`–39 ma dzieci `ai_agent_job_attempts` bez organization_id, z FK do receipts i append-only. Discovery ich nie usuwa, więc istniejące próby blokują usunięcie rodzica. To również wymaga fixture z zastosowanym schematem.

**Odbiór:** populated tenant z legalną historią; jawna polityka zachowania/anonymizacji receipt zgodna z istniejącymi SSOT i referencjami, następnie pełny delete/readback. Nie naprawiać przez wyłączenie immutable triggerów ani przypadkowe kasowanie audytu. Sprawdzić także użytkownika z członkostwem w drugiej organizacji: brak uszkodzenia jej dostępu/danych pozostaje NOT_PROVEN.

### C6-R5 · P2 · E4: eksport jest niekompletny i po cichu obcina dane

Discovery w `organizationLifecycleService.ts:59`–97 obejmuje tylko bezpośredni FK do organizations lub kolumnę organization_id. Przykład pominiętych danych: `staffing_plan_roles`, schema `server/migrations/20260719_baseline_gap.sql:8901`–8914, jest związana przez staffing_plan_id, bez organization_id; staffing_plans przy 8916 ma organization_id. Eksport zawiera plan, ale nie jego role. Service:115/140 narzuca LIMIT 20000 na tabelę, bez total count ani oznaczenia truncation. Pole rowCounts liczy tylko zwrócone rekordy. Odczyty kolejnych tabel nie stanowią jednego snapshotu.

**Odbiór:** parent+children, tenant obcy, ponad 20 000 rekordów i kontrola kompletności obu formatów. Jeśli eksport ma być częściowy, musi jawnie odmawiać finalnego kompletnego artefaktu lub sygnalizować ograniczenie zgodnie z kontraktem; nie nazywać uciętego pliku pełnym eksportem. Root już skierował poprawkę credential/children/limit do istniejącego wykonawcy C6.

### C6-R6 · P2 · E4: zwykła odmowa przez legal hold jest błędem 500

`OrgPoliciesError` (`OrgPoliciesService.ts:8`) ma code, ale nie statusCode/status. Handler nie mapuje tego wyjątku. Globalny `server/src/utils/ErrorHandler.ts:247`–258 domyślnie wybiera 500. Tym samym aktywny legal hold kończy się błędem serwera zamiast kontrolowaną odmową. To analiza źródłowa ścieżki mappera, nie runtime pomiar.

**Odbiór:** real JWT request dla hold=1, stabilny status 4xx i czytelny komunikat UI; bez mutacji i bez success receipt. Naprawa lokalna, bez rozszerzania globalnego E3 mappera.

## 3. Dowody dostawy: co faktycznie wspierają

Katalog logów: `/Users/piotrwisniewski/Developer/codex-wt/codex6-artefakty/`.

| Zakres | Przeczytany dowód | Granica |
|---|---|---|
| E3 default OFF | `e3-green.log`: 3/3; `e3-mutation-red.log`: 1/3 fail na default OFF; source `organizationCostLimiter.codex6.test.ts` | aiBudgetService jest mockiem. Dowodzi kontraktu funkcji, nie prawdziwego księgowania kosztu. |
| E3 UI i próg | `e3-browser-http-pg-above-final.log`: 1/1; source `codex6-ai-budget-admin.spec.ts`; zrzut `evidence/pilotaz-ai-budget/01-admin-usage.png` odczytano wizualnie | Test sam INSERTuje 12.34/50 i UPDATEuje 49/50. UI pokazuje te kwoty. Poniżej progu asercja jedynie wyklucza napis AI_BUDGET_EXHAUSTED (linia 51); NO_PROVIDER/inna odmowa również może przejść. Brak dowodu udanego AI→naliczenie→SQL. |
| E4 trasy | `e4-mutation-red.log`: 2/3 fail; `e4-mutation-green.log`: 3/3 | Mutacja błędnej nazwy powoduje pierwszy real fail 200 zamiast 428; późniejszy 403 jest skutkiem wcześniejszego skasowania fixture, nie drugą niezależną barierą. Test montuje router w Express, nie cały ApiGateway. |
| E4 UI | `e4-browser-http-pg-final.log`: 1/1; source `codex6-organization-lifecycle.spec.ts`; zrzut `evidence/pilotaz-organization-lifecycle/01-export-delete-controls.png` | Dowód login/control/download/delete pustego disposable tenantu i surviving receipt. Nie dowodzi braku sekretów, pełnego eksportu, populated delete, hold ani concurrency. Obejrzany zrzut pokazuje Data Controls, ale sam kadr nie pokazuje końcowej kontroli kasowania. |
| E1 | raport jawnie mówi o page.request po rejestracji | Tworzenie wywiadu/oceny/inicjatywy/zadania/wyniku nie jest wyklikane. Zgodnie z instrukcją E1:37–51 pełna droga użytkownika i wszystkie kontrolki pozostają NOT_PROVEN. |
| E2 | raport podaje 4/12/12/3/6/1/1 i idempotentny seed | Raport jawnie przyznaje brak wizualnego rejestru KPI; instrukcja E2:65 wymaga widoczności danych w produkcie. Nie zmieniać tego na „opcjonalne” domknięcie. |
| E5 | raport: zapis feedback i chroniony endpoint czytający rekord, SQL ostatniej doby | Raport nie przedstawia dowodu admin list UI ani wszystkich appVersion/browser pól z E5:90–92. Te elementy NOT_PROVEN w tym review; nie twierdzę, że kod ich nie ma. |

C6 `98_RAPORT.md:5` twierdzi, że minimum osiągnięto; instrukcja §9:97 wymaga ukończonego E1/E2. Ujawnione ograniczenia są uczciwe, lecz nie zastępują brakującego odbioru UI. W00 powinno zapisać PARTIAL, a nie pełne PASS.

## 4. Dodatkowe ryzyka E3 i wymagany runtime

- `aiBudgetService.ts:349`–355 resetuje miesiąc UPDATE po wcześniejszym SELECT bez warunku wersji/miesiąca. Dwa równoległe odczyty starego miesiąca mogą wyzerować zużycie drugi raz po naliczeniu przez pierwszy request. Wniosek ze źródła, runtime NOT_PROVEN.
- Nowy preflight sprawdza cost=0; naliczenie następuje po providerze. `AIPipeline.ts:670`–687 i 743–760 łapie błąd recordUsage i tylko loguje. Brak rezerwacji/serializacji oznacza, że obecny dowód nie ustanawia ścisłego sufitu kosztu dla równoległych wywołań. Nie deklarować „rachunek ma twardy sufit” na podstawie syntetycznych 49/50.
- getUsageStats czyta current_usage bez miesięcznego resetu (aiBudgetService:425), więc świeży miesiąc przed pierwszym requestem może pokazać stare zużycie. Budżet domyślny powstaje dopiero w enforce; brak budżetu w nowej organizacji przed pierwszym AI nie został zmierzony.
- Nowe `/budget-usage` (ai-settings.routes.ts:314) sprawdza role/org z req.user, bez kanonicznego guardu aktywnego członkostwa obecnego w E4. Wymaga negatywnych prób odwołanego członkostwa/roli; bez odczytu aktualnego auth runtime nie klasyfikuję tego jako potwierdzony exploit.

Runtime po uzgodnieniu z root: zasoby C6 wyłącznie `cx-codex6-pg:6457`, `cx6_*`, API4216, preview5216, harness5597. Najpierw exact SHA poprawki i ledger migracji na disposable lokalnej bazie. Użyć rzeczywistego ApiGateway+JWT+PG; żadnych żywych kluczy ani ruchu do płatnego providera bez odrębnego uzgodnienia. Udany request i księgowanie można najpierw mierzyć kontrolowanym lokalnym providerem, jawnie oddzielając go od dowodu realnego rozliczenia komercyjnego.

Kolejność prób: R1/R5 eksport → R3/R6 legal hold → R4 populated deletion/rollback/receipt → R2 zapis budżetu UI → monthly reset/concurrent usage i pełny E3 cost readback. Utrzymać identyczne fullName w mutacji RED→GREEN i odróżnić następstwa uszkodzonego fixture od niezależnych wykryć. Następnie E1 pełne kliknięcia i E2 KPI UI; E5 lista administratora wraz z pełnym kontekstem. Dopiero potem niezależny review nowego exact SHA oraz odbiór do W00.

## 5. Dyspozycja integracyjna

Nie integrować starego E3/E4 jako gotowego MVP. Default OFF pozostaje OFF. Ten raport nie jest zgodą na staging, deploy, zmianę polityki retencji ani usunięcie jakiejkolwiek żywej organizacji. Root otrzymał findingi i wznowił istniejącego wykonawcę; jego nowe poprawki i przyszły runtime wymagają osobnego exact-SHA odbioru. Artefakt jest jedynym plikiem zapisanym przez tego reviewera.
