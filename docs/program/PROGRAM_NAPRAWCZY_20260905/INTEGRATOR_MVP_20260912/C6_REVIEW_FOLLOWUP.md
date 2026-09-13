# C6 — follow-up niezależnego review źródeł

12.09.2026. Reviewer scope_audit, nie autor C6. Wyłącznie `git show`/`git grep` stałych commitów w `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git`: `056841ea1ad61fa0fa1f75da3288740899912d99`, `d81a818a270cab9a44de489ecda03f4f32130478`, `eb1b87ba315c03a24ff9ff9667a3ef4f3855584b` (poniższe numery linii dotyczą ostatniego z nich, chyba że zaznaczono inaczej). Przeczytano pełną instrukcję C6 oraz wcześniejsze C6_INDEPENDENT_REVIEW i C6_EXPORT_SECOND_REVIEW. Nie odczytywano WIP autora, nie uruchamiano kodu, testów, przeglądarki, migracji ani PG. Jedyny zapis: ten raport. **Brak nowego runtime PASS/RED.**

Nie zgłaszam ponownie jako nowych: pierwotnych R1–R6, trzech ustaleń drugiego review ani aliasów FK obecnie poprawianych przez autora. Poniżej dodatkowe konkretne przypadki i luki dowodowe. Budżet E3 pozostaje u autora; nie oceniano jego WIP.

## F1 · P1 · Materiał zaszyfrowanych credentials pozostaje w eksporcie

**Ryzyko:** `integration_secrets` nie pasuje do zakotwiczonego `SECURITY_TABLE_PATTERN` (`organizationLifecycleService.ts:143`), a `encrypted_value` nie pasuje do wzorca wykluczanych kolumn. Tabela ma bezpośrednie `organization_id`, więc normalny eksport ją odczyta. Usunięcie pola `secret_key` nie usuwa zawartości `encrypted_value`. To konkretny przypadek schematu, odrębny od wcześniej zgłoszonych camelCase kluczy.

**Źródła:** `server/migrations/20260719_baseline_gap.sql:5170` definiuje `integration_secrets(organization_id, secret_key, encrypted_value)`. `server/src/services/v8/pmSyncRefreshExecutionService.ts:105–146` szyfruje obiekt zawierający clientSecret/refreshToken i zapisuje encrypted_value. `enterprisePlatformService.ts:200–204` w zwykłym readerze celowo zwraca tylko metadane kluczy, bez encrypted_value.

**Potrzebny test:** rzeczywista tabela integration_secrets, fikcyjny zaszyfrowany marker utworzony istniejącym writerem; JSON i CSV tenant-admin nie zawierają ciphertext ani pola encrypted_value, a niesekretne dane connectora pozostają. Osobny tenant kontrolny, bez wypisywania markerów w logach.

**Rekomendacja:** jawna klasa security dla tabeli/kolumny na podstawie faktycznej semantyki. Nie traktować szyfrowania jako prawa administratora do eksportu credentials. Włączyć ten przypadek do odbioru obecnego fixu eksportu.

## F2 · P1 · JSON jako TEXT omija redakcję zagnieżdżonych kluczy

**Ryzyko:** `sanitizeExportValue` (`organizationLifecycleService.ts:192–201`) rekursywnie przetwarza obiekty/tablice, ale zwraca string bez analizy. Poprawka normalizacji camelCase działa więc na JSONB zdekodowanym przez pg, lecz nie na serializowanym JSON w TEXT.

**Źródła:** `20260719_baseline_gap.sql:5116–5123` ma `integration_connectors.config_json TEXT`; `:5156–5164` ma `integration_queue.payload_json TEXT`. `enterprisePlatformService.ts:27–35` zapisuje `JSON.stringify(data.configJson ?? {})`; `:78` analogicznie aktualizuje. Są to realne formaty, nie wymyślona tabela testowa. Writer config przyjmuje obiekt, nie dowodzi usuwania z niego wszystkich secret keys.

**Potrzebny test:** ten sam obiekt `{businessLabel: 'keep', apiKey: sentinel, nested: {clientSecret: sentinel}}` w realnym JSONB i w realnym config_json TEXT. Oba formaty eksportu muszą zachować businessLabel i usunąć sekrety; dodatkowo poprawnie obsłużyć malformed JSON bez cichej deklaracji pełnej bezpiecznej redakcji. To rozszerzenie testu reprezentacji danych, nie ponowne zgłoszenie samego regex camelCase.

**Rekomendacja:** polityka znanych kolumn JSON/TEXT i jawne zachowanie przy nieparsowalnej wartości. Nie usuwać całego payloadu biznesowego ani nie próbować bezwarunkowo interpretować każdego opisu użytkownika jako JSON.

## F3 · P1 policy consistency · Nowy eksport org pomija istniejący legal-hold kontrakt eksportu

**Ryzyko:** `ownership.routes.ts:52–72` wykonuje authorization → read-only snapshot → export, bez odczytu org policy. Tenant z hold może pobrać plik tą nową ścieżką, mimo istniejącego kontraktu aplikacji blokującego eksport przy hold. To nie jest twierdzenie o zewnętrznym prawie ani nowa polityka reviewera.

**Źródła:** `server/src/routes/dataExport.routes.ts:17–25,56` używa requireNoLegalHold dla Data export request; `server/src/routes/admin/legal-hold.routes.ts:35–41` komunikuje `blockedOperations: ['data_export','organization_deletion']`; `docs/product/V4_IMPLEMENTATION_PROGRAM.md:240` deklaruje enforcement delete/export. Nowy route nie ma analogicznego wywołania.

**Potrzebny test:** ta sama organizacja hold=1: istniejący eksport oraz GET org/export JSON/CSV; spójna kontrolowana odmowa i brak pliku. Następnie hold=0 i legalny eksport. Jeśli nowa decyzja dopuszcza eksport pod hold, integrator musi wskazać tę decyzję i ujednolicić kontrakt/komunikat; nie zakładać wyjątku.

**Rekomendacja:** rozstrzygnąć i naprawić w ramach obecnej polityki eksportu. Nie osłabiać globalnego hold.

## F4 · P2 evidence · Test „concurrent hold” nie uruchamia DELETE przed COMMIT blokera

**Ryzyko:** `organization-self-service-legal-hold.http.pg.test.ts:63` tworzy obiekt Supertest, następnie czeka 100 ms, zapisuje hold, robi COMMIT w :66 i dopiero `await deletion` w :67. Request jest lazy. Lokalny kod biblioteki `node_modules/superagent/lib/request-base.js:243–269` rozpoczyna `self.end(...)` dopiero w `.then()`. Test opisuje współbieżność, ale jego konstrukcja dowodzi sekwencji „najpierw aktywny hold, potem DELETE”. Nie jest to pomiar nowej regresji implementacji.

**Co kod poprawia:** `d81a818a27` daje wspólny advisory xact lock dla delete i upsertOrgPolicy, BEGIN przed lockiem, świeży odczyt hold wewnątrz transakcji oraz 423 LEGAL_HOLD / 503 POLICY_READ_FAILED w obu ścieżkach delete. To sensowna korekta poprzedniego findingu. `FOR SHARE` chroni istniejący rekord; pierwszy INSERT koordynuje wspólny advisory lock. Brak tabeli nadal jest jawnym wyjątkiem legacy i nie jest tym samym co błąd odczytu.

**Potrzebny test:** uruchomić promise żądania przed zmianą policy, potwierdzić rzeczywiste oczekiwanie jego backend PID na advisory lock (nie sam sleep), potem canonical upsert/COMMIT → DELETE423; odwrotna kolejność również z jasno określonym wynikiem. Osobno first-policy INSERT, aktualizacja hold i wymuszony błąd SELECT→503, readback wszystkich danych i brak success receipt. Pełny ApiGateway/JWT, nie tylko sam router.

**Rekomendacja:** poprawić przyrząd odbioru, zanim concurrency otrzyma PASS. Nie przeprojektowywać poprawnej kooperacji locków na podstawie tego findingu.

## F5 · P2 completeness · Public-only discovery nie uzasadnia „complete” dla całego schematu

**Ryzyko:** discovery kolumn/tabel ogranicza się do public (`organizationLifecycleService.ts:68–91,151`), a manifest bezwarunkowo deklaruje `complete: true` w :333. Migracje zawierają dane tenantów w schemacie v8, np. `v8.v8_conflict_records`, `v8.v8_conflict_resolutions` (`20260719_baseline_gap.sql:11045–11071`) oraz `v8.v8_content_governance`/`v8.v8_context_snapshots` (:11143, :11154 i dalej). Nie są one klasą credentials. Fizyczny stan zastosowania migracji pozostaje UNKNOWN w tym review.

**Potrzebny test:** ledger + realny katalog schematów na kopii; jeżeli te relacje są aktywne, tenant A/B z legalnym rekordem w jawnie kwalifikowanej relacji v8. Sprawdzić obecność A i brak B w obu formatach oraz zgodność manifestu. Jeżeli produkt używa przeniesionych public tabel, wykazać mapping i brak pominiętych aktywnych relacji. Nie dodawać wszystkich schematów automatycznie: część ma osobną politykę bezpieczeństwa.

**Rekomendacja:** manifest kompletności oparty na jawnym objętym kontraktem zbiorze schematów/tabel. To inna oś od znanego błędu FK aliasów. Pozostałe cross-org kontrole nadal muszą obejmować shared user i wielokolumnowe scope; wcześniejsze findingi nie są zamknięte przez ten raport.

## Populated delete z immutable receipts — wynik poszukiwania reuse

**Nie znaleziono gotowego bezpiecznego kontraktu pełnego purge organizacji, który zachowuje istniejące immutable receipts i rozwiązuje ich FK do usuwanego org/users.** Nie oznacza to, że taki kontrakt nie może istnieć poza sprawdzonym repo; oznacza brak podstaw do wskazania obecnego kodu jako gotowego rozwiązania.

Znalezione elementy:

1. `20262180_organization_self_service_deletion_receipts.sql:1–24`: nowy immutable receipt bez FK do kasowanego org/użytkownika; `ownership.routes.ts:96–103` zapisuje go w tej samej transakcji co delete. To użyteczny wzorzec **nowego** potwierdzenia, ale nie rozwiązuje starszych FK/triggerów.
2. `executionBudgetDeleteCommandService.ts` + `20261034_execution_budget_delete_commands.sql`: istniejący pojedynczy command ma digest, idempotency key, terminal receipt, uprawnienia i transakcję. Receipt sam ma organization FK i append-only trigger. Można reużyć wzorca polecenia/readback, nie traktować go jako silnika tenant purge.
3. `20261030_settings_account_deletion_request_lifecycle.sql:1–53`: jawnie request/cancel/status, **nie wykonanie deletion**; immutable receipt trzyma RESTRICT do org/users/request. Potwierdza znany R4, nie jest nowym findingiem.
4. `docs/program/evidence/closure/codex/SET-MVP-DELETE-001/DECISION_PACKET.md` rozdziela request/cancel od purge i ma nierozstrzygniętą macierz retencji klas danych. Nowsza instrukcja C6 E4 autoryzuje przygotowanie funkcji usunięcia, więc stary dokument nie unieważnia automatycznie obecnego mandatu. Jednak sama instrukcja nie określa technicznej retencji/przenoszenia wcześniejszych receipts. Integrator powinien wskazać właściwe nowe rozstrzygnięcie i zachować brakujące komórki jako UNKNOWN.
5. `scripts/dane/usun-organizacje.ts` zawiera opcję wyłączania triggerów użytkownika (:1022/:1187). **To nie jest dopuszczalne reuse** dla tej paczki. Nie proponuję DROP trigger/FK, kopiowania pod nową tożsamość ani zgadywanego rehome.

**Bezpieczny następny odbiór:** populated disposable tenant utworzony normalnymi writerami (w tym request→cancel oraz budget delete generujący receipt), drugi tenant i shared member; próba self-service delete przy istniejącej polityce powinna albo wykonać uzgodniony, dowiedziony kontrakt retencji, albo jawnie odmówić i zachować całość. Odmowa/rollback jest poprawną ochroną, lecz nie jest PASS wymagania pełnego populated delete. Żaden success receipt przy odmowie. Do czasu kontraktu R4 pozostaje HOLD; nie odblokowywać siłowo.

## Dodatkowy test wyniku transakcji

`superadmin.routes.ts:856–867` robi COMMIT, potem await emitAuditEvent wewnątrz tego samego try/catch. Awaria audytu może więc zwrócić błąd po wykonanym usunięciu; ROLLBACK nie cofnie COMMIT. Self-service również nie rozróżnia utraty ACK COMMIT od znanego rollback. To source-risk, bez runtime potwierdzenia. Do odbioru: fault injection po COMMIT oraz utrata ACK, odczyt trwałego receipt po request digest i brak zachęty do ślepego powtórzenia. Zachować rozdział „wynik nieznany” vs „nie wykonano”.

## Rekomendacja do integratora

Eksport: nadal HOLD do sprawdzenia F1/F2/F3 na dokładnym SHA obecnego fixu; F5 wymaga weryfikacji aktywnego schematu, nie automatycznej przebudowy. Legal-hold delete: poprawa źródłowa oceniona pozytywnie, ale concurrency pozostaje NOT_PROVEN z obecnego testu. Populated delete: R4/HOLD bez nowej interpretacji retencji. Do autora przekazać konkretne rozszerzenia fixture i prób, nie nową ogólną procedurę. Ten raport nie przyznaje runtime PASS ani zgody na live.


## Minimalny zestaw lokalnego odbioru poprawek

Właściciel wykonania: C6, dopiero po ustaleniu nowego exact SHA. Ten reviewer nie uruchomił żadnej z prób. Ustalenia F1–F3 są SOURCE_FINDING, F4 jest SOURCE_EVIDENCE_GAP, F5 jest SOURCE_SCHEMA_RISK zależnym od katalogu zastosowanej kopii. Zachować nazwy testów/fullName i identyczne mianowniki RED→GREEN; nie zaliczać następstw skasowania fixture jako nowych niezależnych barier.

| Próba | Minimalne fixture/akcja | Odbiór |
|---|---|---|
| EX-SEC-01 | A/B, rzeczywisty integration_secrets + business connector; fikcyjny encrypted_value; real tenant-admin GET JSON i CSV | Brak ciphertext/sekretnego pola, legalny connector obecny, brak B. |
| EX-SEC-02 | Ten sam zagnieżdżony obiekt w JSONB i TEXT config_json; legalny businessLabel; wariant malformed TEXT | Sekrety nieobecne, dane legalne zachowane; malformed ma jawny wynik zgodny z polityką, nie fałszywe complete. |
| EX-HOLD-01 | Ta sama A hold=1 → istniejąca trasa data export oraz nowa org/export w obu formatach; potem canonical release→eksport | Spójne istniejące zachowanie hold: odmowa bez pliku; po release legalny sukces. |
| DEL-HOLD-01 | Uruchomione HTTP DELETE czeka na sprawdzony PID/lock; drugi writer wykonuje canonical policy upsert; następnie COMMIT | 423 i niezmienione dane/brak success receipt. Osobno pierwszy INSERT policy, nie tylko UPDATE istniejącego wiersza. |
| DEL-HOLD-02 | Wymuszony błąd odczytu policy na tej samej ścieżce; nie usuwać tabeli, bo brak tabeli jest osobnym legacy kontraktem | 503 POLICY_READ_FAILED, brak delete/receipt, UI nie komunikuje sukcesu. |
| EX-SCHEMA-01 | Katalog zastosowanych migracji; po jednym A/B record w aktywnej public i v8 relacji biznesowej | Eksport + manifest zgadza się z deklarowanym zakresem; brak B. Jeśli relacja v8 nieaktywna, jawne N/A z katalogiem, nie arbitralne pominięcie. |
| DEL-RECEIPT-01 | Populated A po canonical request→cancel oraz legalnym budget-delete, shared user z B | Do czasu decyzji retencji: kontrolowana odmowa i pełny rollback. Po zatwierdzeniu kontraktu: wymagany osobny full-delete/readback oraz zachowane receipts/B, bez override triggerów/FK. |
| DEL-OUTCOME-01 | Awaria emitAuditEvent po COMMIT i osobno utrata ACK COMMIT | Znany wynik sukcesu nie zamienia się w pozorny rollback; wynik nieznany ma bezpieczny readback po digest/idempotency, bez ślepej ponownej destrukcji. |

Dotychczasowe znane cross-org graph, FK-alias, business-session i >20k case nadal są w zestawie autora; ta tabela ich nie zastępuje ani nie zgłasza ponownie.
