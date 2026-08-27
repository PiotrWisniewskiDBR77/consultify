# Poświadczenia dzień 39 — usunięcie zaszytych haseł z kodu — raport dyżuru 2026-08-28

## Marker i baza

- Worktree: `/private/tmp/cx-creds39`; gałąź: `codex/creds-day39c-20260828`; wejściowy HEAD: `a2fa7a075a33f63f467f5d4ecd5af1aed729a3be`.
- Związany marker: `23652ec80a`.
- `git merge-base --is-ancestor 23652ec80a codex/m03-admin-20260824`: `MARKER_OK_23652ec80a`.
- Tip `codex/m03-admin-20260824` jest równy markerowi; brak rozejścia.
- `git fetch origin --prune` i `git fetch github-backup --prune`: wykonane bez błędu.

## Oświadczenie o chronionym checkoutcie (Z5)

Nie dotykałem `/Users/piotrwisniewski/Developer/Consultify` poza symlinkiem `node_modules` (odczyt).

## Oświadczenie Z28

Nie wykonałem żadnego połączenia do `*.consultify.ai`, `*.consultify.com`, `*.railway.app` ani do zdalnej bazy.

## Oświadczenie Z18

W tym raporcie nie występuje wartość żadnego hasła. Wszystkie odwołania używają `<HASŁO>` albo nazwy zmiennej.

## Oświadczenie Z27

`git stash list`: pusto przed rozpoczęciem zmian.

## Warunki wstępne

| punkt | wynik |
| --- | --- |
| a | Mapa PIN do kont istnieje w `AuthView.tsx`; pięć wpisów zawiera hasło. Szeroki grep `password: '` daje 11, nie oczekiwane 5, ponieważ dalsza część widoku zawiera dodatkowe wartości lokalno-testowe. |
| b | Filtr hostowy obejmuje localhost, domeny demo/stage/staging, publiczne domeny produktu oraz `*.railway.app`. |
| c | Definicja mapy i jej konsument w `handleQuickAccess` istnieją; gałąź demo woła `Api.demoLogin`. |
| d | Oba wskazane testy istnieją i zastany kontrakt asertuje literał. |
| e | `scripts/seed-m16-demo.py` nadal zawiera poświadczenie i zdalny BASE; `KOLIZJA_38`, plik nietykalny. |
| f | Oba skrypty M16 zawierają poświadczenie i zdalny BASE. |
| g | `billing.spec.ts` ma zastany wzorzec `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` z lokalnym fallbackiem. |
| h | Brak istniejącego strażnika o wskazanych nazwach. |
| i | Przedział migracji `20261280-89` pusty. |
| j | Pliki dnia 38 istnieją i mają po 0 trafień literału. |

## Baseline testowy

- Własny PG: `pgvector/pgvector:pg16`, kontener `cx-day39-pg`, `127.0.0.1:5689`, baza `cx_day39`.
- Każdy test uruchamiany z jawnymi `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5689/cx_day39 RUN_DB_TESTS=1 MOCK_DB=false` w tej samej linii.
- Instrukcyjne `--reporter=basic`: błąd startowy Vitest 4.1.8 (`Failed to load custom Reporter from basic`).
- Powtórzenie bez nieobsługiwanej flagi: 2/2 pliki PASS, 8/8 testów PASS, 0 SKIPPED.

## D.1 — INWENTARZ POLICZONY

### Trzy metody

Liczenie wykonano samodzielnie na śledzonych plikach tekstowych (`git grep -I`), z wyłączeniem `dist/**` i `coverage/**`; literał był składany wyłącznie w pamięci procesu.

| metoda | wynik |
| --- | ---: |
| M1: surowy literał | 194 pliki |
| M2: literał po odfiltrowaniu oczywistych ciągów dłuższych | 104 pliki, 274 linie |
| M3: realne adresy kont lub literał w kontekście hasła | 211 plików; część hasłowa 55 plików |

Metodą wiążącą jest M2 rozszerzona kontrolą kontekstu M3, ponieważ obejmuje miejsca wymagające ręcznej klasyfikacji, nie utożsamiając samego adresu e-mail z poświadczeniem.

Liczba 145 z briefu nie jest zgodna z metodą wiążącą; własny wynik to 104 pliki i 274 linie.

### Pięć kategorii

| kategoria | pliki | linie | uwagi |
| --- | ---: | ---: | --- |
| (a) kod produkcyjny frontu | 2 | 7 | `AuthView.tsx` jest P0; placeholder telefonu w ustawieniach to fałszywka |
| (b) kod produkcyjny serwera | 0 | 0 | zgodnie z oczekiwaniem |
| (c) skrypty i seedy | 17 | 62 | 16 własnych, 1 `KOLIZJA_38` |
| (d) testy | 69 | 184 | rzeczywiste poświadczenia e2e oraz fałszywki: OTP, kolory, kwoty, identyfikatory |
| (e) dokumentacja | 16 | 21 | procedury i historyczne raporty; dwa trafienia są fałszywe |
| **suma** | **104** | **274** | zgodna z M2 |

### Pełna lista kategorii (c)

- `docs/qa/runs/2026-07-05-m06-audyt/_audit_script.mjs`
- `scripts/seed-m16-demo.py` — `KOLIZJA_38`, nie dotykam
- `scripts/test-m16-api-sweep.py`
- `scripts/test-m16-upload-fixtures.py`
- `server/scripts/dev-ensure-admin.ts`
- `server/scripts/fix-dbr77-credentials.sh`
- `server/scripts/seed-dbr77-restore-demo.ts`
- `server/scripts/seed-interview-demo.ts`
- `server/scripts/seed-production-dbr77-users.ts`
- `server/scripts/seedEnglishTestData.js`
- `server/scripts/seedLegolexDemoOrg.js`
- `server/scripts/seed_dbr77_postgres.js`
- `server/scripts/test_login.cjs`
- `server/seed/seed_dbr77_complete.js`
- `server/seed/seed_dbr77_users.js`
- `server/seeds/demoUser.js`
- `server/seeds/demoUser_demo.js`

### Testy wymagające oczyszczenia

- `src/views/__tests__/AuthView.quickAccess.test.ts` i `tests/components/AuthView.quick-access-guard.test.tsx` — D.2.
- Wszystkie trafienia w `tests/e2e/**` zawierające wartość w polu hasła albo opis realnego konta — D.5.
- `tests/integration/publicSystemSurface.contract.test.ts` — zastany strażnik konkretnego wycieku; zostanie przepisany tak, by składał wzorzec bez literału.
- Pliki `tests/e2e/*.spec` bez `.ts` są `MARTWY_PLIK`; Playwright ich nie zbiera, ale sekret zostanie usunięty.

### Dokumentacja wymagająca oczyszczenia

- `Harvard/Testy manualne/TESTY_M16_FINANSE.md`
- `Harvard/_HANDOFF_USPOJNIENIE_2026-06-25.md`
- `Harvard/wdrozenie-100/M15-PLAN-DOMKNIECIA-100.md`
- `Harvard/wdrozenie-100/_KARTY_SESJI/SESJA_2026-07-03_1.md`
- `Harvard/wdrozenie-100/_NOCNY_PLAYBOOK_3RUNDY.md`
- `Harvard/wdrozenie-100/_PLAN_TESTOW_WYKONAWCZY_M14_5x30.md`
- `docs/product/work-packets/IMPLEMENTATION_CONTROL_BOARD.md`
- `docs/product/work-packets/V8_SINGLE_ORG_SHADOW_PILOT.md`
- `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/SEC-PUB-002_PUBLIC_SYSTEM_SURFACE.md`
- `docs/testing/AI_CHAT_SMOKE_TESTS.md`
- `docs/testing/CHAT_P0_MANUAL_QA_CHECKLIST_2026-05-06.md`
- `docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`
- `docs/testing/TESTING_OPERATING_SYSTEM_PRO_2026-05-06.md`
- `docs/testing/reports/IDEA_MIND_MAP_P0_P2_FINAL_GO_GATE_2026-05-17.md`

### (f) Trafienia fałszywe / poza zakresem

- `src/components/settings/notifications/NotificationChannelsSettings.tsx`: placeholder numeru telefonu.
- `docs/api/IAM_MODULE_API`: przykładowy token MFA, nie hasło konta.
- `docs/operations/DEPLOYMENT_GUIDE.md`: fragment identyfikatora strefy Route53.
- Testy niezwiązane z logowaniem: sześciocyfrowe OTP, wartości finansowe, kolory CSS, skróty/hash, identyfikatory przesyłek i syntetyczne klucze API. Nie są hasłem konta i nie będą masowo zmieniane.
- `public/locales/**`, `.env*.example`, `docker-compose.yml`, `vitest.config.ts`, `dev-render/**`, `out/**`: znane fałszywki lub obszary poza zakresem; ewentualne sekrety innej klasy są wyłącznie znaleziskiem, nie naprawą D.39.

## Inwentarz konsumentów wykonany przed zmianą

| plik / grupa | konsumenci |
| --- | --- |
| `src/views/AuthView.tsx` | `src/routes/AppRoutes.tsx`; cztery testy komponentowe importujące `AuthView`; dwa testy importujące helpery quick-access |
| `src/config/quickAccess.ts` | nowy moduł, planowany konsument: `AuthView.tsx` i testy D.2 |
| `.env.example` | wzorzec konfiguracji deweloperskiej; brak wykonawczego importu |
| dwa skrypty `scripts/test-m16-*` | brak wpisu package/workflow; instrukcja D.39 i uruchomienie ręczne |
| `server/scripts/fix-dbr77-credentials.sh` | `package.json` skrypt `fix:credentials` |
| `server/scripts/seed-production-dbr77-users.ts` | `package.json` skrypt `db:seed:dbr77` |
| `server/scripts/dev-ensure-admin.ts` | ręczny skrypt operacyjny; opisany w runbooku OPS-SEC-001 |
| `server/scripts/seed-interview-demo.ts` | ręczny seed; wpisy w rejestrze lease |
| pozostałe skrypty/seedy D.4 | brak wywołania w `package.json`, Makefile lub workflow; tylko dokumentacja albo brak — `MARTWY_SKRYPT`/ręczne użycie |
| `tests/e2e/m16/_m16.ts` | `m16-w1-w3.spec.ts`, `m16-w4-w6.spec.ts` |
| pliki `tests/e2e/**/*.spec.ts` | discovery Playwright i `package.json:test:e2e`; punktowo `--list`, bez wykonania |
| pliki `tests/e2e/*.spec` bez rozszerzenia `.ts` | brak discovery — `MARTWY_PLIK` |
| `tests/integration/publicSystemSurface.contract.test.ts` | discovery Vitest `test:integration` |
| dokumenty D.6 | konsumenci ludzcy/proceduralni; brak wykonawczego importu |

## Pozycje — tabela zbiorcza

| poz. | status | commit SHA | dowód | konsumenci | równoważność |
| --- | --- | --- | --- | --- | --- |
| D.1 | ZROBIONE_WG_DoD | `1d10bdfe26` | trzy własne pomiary i klasyfikacja | tabela powyżej | nie dotyczy |
| D.2 | CZĘŚCIOWO | `1e1dfd0efb` | 25/25 testów PASS; brak sekretu i domen uprzywilejowanych | policzeni | mapa syntetyczna działa; brak mapy odmawia |
| D.3 | CZĘŚCIOWO | do uzupełnienia po commicie | build OOM; dowód zastępczy | Vite | brak artefaktu do rozstrzygnięcia |
| D.4 | NIE_ZACZĘTE | — | — | policzeni | — |
| D.5 | NIE_ZACZĘTE | — | — | policzeni | — |
| D.6 | NIE_ZACZĘTE | — | — | policzeni | — |
| D.7 | NIE_ZACZĘTE | — | — | — | — |
| R.1 | NIE_ZACZĘTE | — | — | — | — |

## D.2 — front

### Wariant B+

Mapa PIN do konta została całkowicie usunięta z kodu i zastąpiona rygorystycznie walidowanym JSON-em z `VITE_QUICK_ACCESS_MAP`. Brak albo błędna wartość daje pustą mapę, a filtr hostowy pozostaje niezależną drugą bramką. Wariant A odrzucono, bo usuwa użyteczne narzędzie; wariant C odrzucono, bo pozostawiałby publiczną enumerację kont bez zachowania wygody.

### Krok 4 — dowód i STOP

- `isDemoLoginGatewayOpen` wymaga `NODE_ENV=test`, jawnego gateway flag oraz odpowiednio długiego `TEST_SUPPORT_KEY`; `/demo-login` zwraca poza tym `410 DEMO_LOGIN_DEPRECATED`.
- `/register-demo` jest żywy, ale jego kontrakt wymaga `email`, `password`, a w kliencie również przekazania zaakceptowanych dokumentów i czasu zgody. Nie jest więc bezpoświadczeniowym endpointem, który czterocyfrowy skrót może legalnie wywołać bez dodatkowego wejścia użytkownika.
- Zgodnie z §D.2 krok 4 otrzymuje STOP, a produkcyjny skrót jest wyłączony. Nie zmieniono serwera auth.

### STOP — D.2 krok 4

- Co miałem zrobić: skierować publiczny skrót demo do istniejącego endpointu bez poświadczeń.
- Czego brakuje: taki endpoint nie istnieje na związanym markerze; wskazany kandydat rejestracyjny wymaga nowych poświadczeń i zgód prawnych.
- Co sprawdziłem: implementacje `/demo-login`, `/register-demo`, sygnaturę `Api.registerDemo` oraz obu istniejących konsumentów.
- Wariant 1: właściciel zatwierdza przejście skrótu do istniejącego formularza rejestracji demo; zachowuje legal consent, ale skrót nie loguje jednym krokiem.
- Wariant 2: osobny dyżur projektuje anonimowy, ograniczony endpoint demo; zachowuje jednoetapowy skrót, ale rozszerza powierzchnię auth i wymaga decyzji bezpieczeństwa.
- Rekomendacja: wariant 1 jako bezpieczny i zgodny z żywym kontraktem; nie wymaga otwierania zamkniętego gatewaya.

### Zmienione asercje

| plik | PRZED | PO | dlaczego to nie osłabienie |
| --- | --- | --- | --- |
| `src/views/__tests__/AuthView.quickAccess.test.ts` | konkretne realne konta i hasło | brak env, syntetyczna mapa, zły host, prod-public, zły JSON i zły kształt | testuje granice zachowania i nie utrwala sekretu |
| `tests/components/AuthView.quick-access-guard.test.tsx` | realne PIN-y i konta | panel default-OFF, syntetyczne credentials/demo, host allowlist i blokada prod | zachowuje hostową regresję i dodaje konfigurację fail-closed |
| `tests/components/AuthView.fail-closed-errors.contract.test.tsx` | niejawna zależność od zaszytej mapy | syntetyczny wpis demo przez `vi.stubEnv` | zachowuje test bezpiecznego błędu bez realnego sekretu |

### Dowody

- Literał hasła: `AuthView.tsx=0`, `quickAccess.ts=0`.
- Domeny `dbr77`, `plastmetcentrum`, `ateliertoys-demo` w tych dwóch plikach: `0`.
- Szeroki wzorzec `password: '` w całym `AuthView.tsx`: `5`, wszystkie to puste wartości stanu formularza; kryterium `0` z instrukcji jest błędne dla całego pliku i nie oznacza poświadczenia.
- `.gitignore:36:.env.local` potwierdza ignorowanie `.env.local`.
- Prettier: 4 pliki TS/TSX; esbuild: 5 plików TS/TSX — OK.
- Testy pełnego zakresu importerów `AuthView`: 5/5 plików PASS, 25/25 testów PASS, 0 SKIPPED, z wymaganym własnym PG i kompletem env.

## D.3 — dowód na artefakcie

- `env -u VITE_QUICK_ACCESS_MAP npx vite build --mode production`: transformacja 10 503 modułów zakończona, następnie `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` przy renderowaniu chunków.
- Zgodnie z instrukcją nie zwiększano heapu i nie zmieniano `vite.config.ts`.
- `dist/` po nieudanym buildzie usunięto; `git status` potwierdził `dist_czysty`.
- Kontrola pozytywna z mapą syntetyczną: `NIEWYKONANA — build artefaktu niewykonalny z powodu OOM`.
- Dowód zastępczy: w produkcyjnym `src/` poza `__tests__` nie ma literału w `AuthView.tsx` ani `quickAccess.ts`; dziewięć innych plików ma ten sam ciąg cyfr w kontekstach niepoświadczeniowych (placeholdery, kolory, wartości formularzy). Skan domen znajduje 15 plików z adresami/kontaktami domenowymi niezależnymi od mapy quick-access.
- Zdanie rozstrzygające: **NIE_PROVEN — nie powstał zbudowany artefakt, więc nie twierdzę, że bundel produkcyjny nie zawiera poświadczeń ani adresów kont administracyjnych.** Kod mapy P0 jest oczyszczony, lecz bramka artefaktowa pozostaje otwarta.

## Errata i korekty wobec instrukcji

- Związany marker to `23652ec80a`; stare przykłady komend z `87e7cecf3a` w treści są nieaktualne. Wszystkie porównania raportu używają związanego markera.
- Szeroki grep w `AuthView.tsx` daje 11 zamiast 5; pięć trafień należy do mapy P0, pozostałe wymagają klasyfikacji, nie masowej zmiany.
- Vitest 4.1.8 nie obsługuje `--reporter=basic` jako wbudowanego reportera.

## Znaleziska

- Zastane przykłady `ENCRYPTION_KEY` i syntetycznych kluczy API są inną klasą sekretu lub danymi testowymi. Nie zostały uznane za poświadczenia konta ani zmienione w D.39.

## Gotowość

Raport roboczy; D.1 zakończone, dalsze pozycje oczekują wykonania.
