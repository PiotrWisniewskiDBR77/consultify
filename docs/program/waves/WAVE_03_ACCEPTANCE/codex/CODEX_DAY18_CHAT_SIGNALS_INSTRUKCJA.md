# INSTRUKCJA DYŻURU nr 18 — Codex — „Chat: PRODUCENT SYGNAŁÓW — mechanika tylna: silnik 10 reguł deterministycznych (EXECUTION · DECISION · RESULTS/KPI · FINANCE), model danych z adresatem, pipeline produkcji z ledgerem przebiegów, deduplikacja i świeżość, API feedu z filtrem organizacji i roli, warstwa AI INTERPRETED zbudowana za flagą OFF"

Dokument samodzielny. Zakładam, że dostajesz **tylko ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–17. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur realizuje **zaakceptowany projekt** producenta sygnałów
(`CHAT_SIGNALS_PRODUCER_DESIGN_2026-08-25.md`) w zakresie rozstrzygniętym
decyzją właściciela **`DEC-2026-08-26-89`**:

| Punkt decyzyjny | Wybór właściciela | Skutek dla Ciebie |
| --- | --- | --- |
| **D1 — zakres domen fali 1** | **B** | **10 reguł deterministycznych**: EXECUTION + DECISION + RESULTS (KPI) + FINANCE. Nie 4, nie 25. |
| **D2 — warstwa AI** | **B** | Warstwa deterministyczna **ON**; warstwa `INTERPRETED` **zbudowana w tym dyżurze**, ale **za flagą OFF**, fail-closed. |
| **D3 — adresat sygnału** | **B** | Feed **organizacyjny z filtrem roli**; kolumny `audience_user_id` / `audience_role`; sprawy własne **wyróżnione** (pole w DTO, nie osobny feed). |

Poprzedzająca decyzja `DEC-2026-08-25-36` („BUILD_PRODUCER_NOW") ustanowiła, że
budujemy realnego producenta zamiast ukrywać placebo. Projekt został napisany
i zaakceptowany. **Ten dyżur to jego wykonanie po stronie tylnej.**

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Twój zakres to WYŁĄCZNIE MECHANIKA TYLNA. Front feedu (UI panelu „Ważne
sygnały" w Chacie, przeniesienie triggera do prawej grupy nagłówka, znacznik
pochodzenia, rozwijany rodowód, pusty stan wyjaśniający cel) robi osobny
robotnik wewnętrzny. Nie dotykasz go — patrz §1.4 (podział FRONT/TYŁ).**

1. **Zero UI.** Nie zmieniasz ani jednego pliku w `src/`. Ani jednej linii
   `.tsx`. Twoim produktem są: migracje, typy, silnik reguł, evaluator,
   harmonogram, ledger przebiegów, trasy API i testy. Jeżeli uznasz, że
   „trzeba tylko dodać jedno pole w panelu" — to jest **STOP**, nie wyjątek.
2. **Zero nowych flag wizualnych.** Powstają dokładnie **dwie** flagi
   backendowe (`ENABLE_SIGNAL_PRODUCER`, `ENABLE_SIGNAL_INTERPRETER`), obie
   **default OFF**, obie z **realnym czytelnikiem w kodzie**. Flaga bez
   egzekwowania = placebo = odrzucenie pozycji (`DEC-2026-08-25-12`,
   `DEC-2026-08-25-21`).
3. **Zero atrap.** Ten dyżur powstał dlatego, że dzisiejszy „feed sygnałów" jest
   reinterpretacją napisu w kolumnie `type` tabeli `notifications`, a dwa
   istniejące emitery nie mają ani jednego wywołania produkcyjnego. **Reguła,
   która technicznie się kompiluje, ale na realnych danych nigdy nie trafia,
   jest dokładnie tym samym błędem w nowym opakowaniu.** Bramka odbioru (§T.3)
   wymaga od KAŻDEJ reguły dowodu: `≥1` sygnał otwarty **i** `≥1` auto-domknięcie
   na fixture.
4. **★ Warstwa AI: zbudowana, ale bez ani jednego wywołania na żywo z tego
   dyżuru.** `ENABLE_SIGNAL_INTERPRETER` = OFF. Provider AI wołasz **wyłącznie
   przez istniejącą abstrakcję** (`llmService` / `llmConfigService`) — nie
   piszesz własnego klienta HTTP, nie wstawiasz klucza. **Jeśli klucz AI nie
   jest ustawiony w Twoim środowisku (a nie będzie), to NIE jest awaria: to jest
   projektowana ścieżka `SKIPPED_NO_PROVIDER`.** Testy warstwy AI robisz
   **z mockiem providera lokalnie w swoim pliku testowym**. Wywołanie na żywo =
   wpis `STOP-BRAK_API` w raporcie, nigdy „ustawiłem klucz, żeby sprawdzić".
5. **★ `DEC-2026-08-25-65` (DEC-65) — zamrożenie.** Ten dyżur **nie dotyka
   Railway, nie robi zdalnych migracji ani seedów, nie pisze do wspólnej bazy
   demo, nie wykonuje deployów i nie wysyła niczego na zewnątrz** (żadnych
   maili, webhooków, wywołań providerów). Migracje przygotowujesz jako
   `MIGRATION_PREPARED`, z dowodem idempotencji i kompatybilności wstecz na
   **jednorazowym lokalnym kontenerze Postgres**.
6. **Migracje wyłącznie addytywne i kompatybilne z zamrożoną bazą demo.**
   `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `CREATE INDEX IF NOT EXISTS`. Zakaz `DROP`, `RENAME`, `ALTER COLUMN … TYPE`,
   bezwarunkowego `UPDATE`/`DELETE`.
7. **Odbiór wizualny = nadzorca, po dyżurze.** Reguła 7 CLAUDE.md: właściciel
   nigdy nie jest pierwszym testerem wizualnym. Ty w ogóle nie produkujesz
   powierzchni wizualnej — w raporcie piszesz „mechanika gotowa do konsumpcji
   przez blok frontowy", **nigdy** „gotowe do pokazania właścicielowi".
8. **Producent sygnałów NIE jest agentem** (`DEC-2026-08-25-23`). Moduł 17
   (Agent/Teresa) będzie **konsumentem** `work_signals`, nie producentem. Nie
   budujesz niczego, co wygląda jak agent, nie podpinasz się pod Teresę.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości
reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.
   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*` ani `codex/wave3-16-module-acceptance-*`. Załóż raport,
   wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

3. **★ Weryfikacja materiałów wiążących (warunek wstępny, NIE formalność).**

   ```bash
   # (a) rejestr decyzji — DEC-89 (ten dyżur), DEC-36, DEC-65, DEC-86, DEC-40, DEC-51, DEC-23
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 144
   grep -n "DEC-2026-08-26-89" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :141
   grep -n "DEC-2026-08-26-86" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :138
   grep -n "DEC-2026-08-25-65" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :117
   grep -n "DEC-2026-08-25-36" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :88
   # (b) PROJEKT WIĄŻĄCY — leży na gałęzi projektowej, NIE w Twojej bazie
   git show codex/chat-signals-design-20260825:docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/CHAT_SIGNALS_PRODUCER_DESIGN_2026-08-25.md | wc -l   # oczekiwane 763
   # (c) rejestr odbiorowy modułu Chat
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md
   grep -n "CHAT-OWN-004" docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/OWNER_REVIEW_2026-08-22.md
   ```

   Brak któregokolwiek = **STOP**.

   **★ Projekt wiążący czytasz `git show`-em, NIE scalasz gałęzi projektowej.**
   Jeżeli chcesz mieć go pod ręką: `git show … > /tmp/design_day18.md` poza
   repozytorium. **Nie commitujesz go do swojej gałęzi** (Z12).

4. **★ Weryfikacja łaty filtra organizacji (kontekst istniejący).** Poprzedni
   blok naprawił realny wyciek międzytenantowy w dzisiejszym feedzie. Sprawdź,
   że łata jest w Twojej bazie — **budujesz na niej, nie cofasz jej**:

   ```bash
   git merge-base --is-ancestor codex/signals-org-filter-fix-20260825 codex/m03-admin-20260824 && echo "ORG-FIX SCALONA" || echo "ORG-FIX NIESCALONA"
   grep -n "organization_id" server/src/routes/my-work/signals.routes.ts | head
   ls server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts
   ```

   - **SCALONA** (oczekiwane) → w `signals.routes.ts` istnieje sonda kolumny
     `notifHasOrgId` i filtr `AND organization_id = ?`, a test
     `signals.routes.org-isolation.test.ts` (219 linii) jest jej strażnikiem.
     **Ten test musi zostać zielony albo zostać uczciwie przepisany pod nowe
     źródło z ZACHOWANIEM wszystkich trzech asercji izolacji** — patrz §T.1.
   - **NIESCALONA** → to **nie jest STOP całego dyżuru**, ale jest **obowiązkowym
     wpisem w raporcie**: budujesz nowy read model z filtrem organizacji od
     razu poprawnie (§A.1), a rozbieżność opisujesz w „Korektach".

5. Tworzysz **własną świeżą gałąź** z tego tipa i własny worktree:

   ```bash
   git branch codex/chat-signals-day18-<data> codex/m03-admin-20260824
   git worktree add /private/tmp/consultify-chat-signals-day18 codex/chat-signals-day18-<data>
   cd /private/tmp/consultify-chat-signals-day18
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD`.)

6. **★ Zależności — jedyny autoryzowany kontakt z katalogiem właściciela
   (`DEC-2026-08-26-86`).** W świeżym worktree nie ma `node_modules`.
   **`npm ci` jest niewskazane.** Ustalony wzorzec programu:

   ```bash
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules \
         /private/tmp/consultify-chat-signals-day18/node_modules
   ls /private/tmp/consultify-chat-signals-day18/node_modules/.bin/vitest   # dowód
   ```

   **To jedyny dozwolony kontakt z `/Users/piotrwisniewski/Developer/Consultify`
   — wyłącznie odczyt zależności przez ten symlink.** Zakaz zapisu, zakaz
   `git` w tamtym katalogu, zakaz `grep -r`/`cat` na jego plikach źródłowych,
   zakaz czytania WIP właściciela (Z4/Z5).

7. **★ Numer migracji — NIE zgadujesz (reguła ogólna z `DEC-2026-08-26-86`).**
   Numer = **najwyższy istniejący prefiks w `server/migrations` + 1**, wyznaczony
   przez Ciebie w Bloku 0, i **przed utworzeniem KAŻDEGO pliku migracji**
   sprawdzasz zajętość:

   ```bash
   ls server/migrations | grep -oE '^[0-9]{8}' | sort -n | uniq | tail -3
   # → w chwili wystawiania instrukcji najwyższy to 20261075 (meetings_day16).
   #   Twój pierwszy numer = 20261076 LUB WYŻSZY, jeśli w międzyczasie doszły inne.
   ls server/migrations | grep '^20261076'   # MUSI BYĆ PUSTE zanim utworzysz plik
   ls server/migrations | grep '^20261077'   # jw. przed drugim plikiem
   ```

   Numer użyty i wynik obu `ls|grep` idą do raportu. `migrate.postgres.ts`
   stosuje migracje **w porządku alfabetycznym nazw plików**, więc numer rosnący
   jest wymogiem poprawności, nie kosmetyką. Konwencja nazw wymuszona przez
   `server/scripts/validate-migration-naming.ts` (`^\d{8}_[a-z0-9_]+\.sql$`):
   `2026107X_chat_signals_day18_<temat>.sql`.

8. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/chat-signals-day18-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `main`, ani cudzych gałęzi `codex/*` (w szczególności `codex/chat-signals-design-20260825` — czytasz ją `git show`, nie scalasz) | `demo` = święta baza; tamte gałęzie należą do równoległych strumieni |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych** | Krach 3/4 powstał tak |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze decyzji i w projekcie wiążącym |
| **Z5** | **★ Katalog `/Users/piotrwisniewski/Developer/Consultify` jest NIETYKALNY** — ani do zapisu, ani do odczytu plików źródłowych, ani `git`, ani `cat`, ani `grep -r`. **Jedyny wyjątek: symlink `node_modules` z §0.1 pkt 6 (`DEC-2026-08-26-86`)** | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` ani w `/Users/piotrwisniewski/Developer/Consultify-*` / `consultify-*` | Cudze worktree, część w użyciu |
| Z7 | **Nie zajmujesz portów sesyjnych.** **Port 3987 jest NIETYKALNY** (sesja główna). Zajęte przez inne dyżury: 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4300–4302, 4304/4305, 4306, 4312, 4370, 4418, 4428, 4480/4481. **Twoje: runtime 4318/4319, kontener PG 4320** | Kolizja portu wywala cudzą sesję |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak zmiennych env produkcyjnych, brak redeployu, brak zdalnych migracji/seedów (DEC-65) | Produkcja/demo poza zakresem, trwa freeze |
| Z9 | **Żadnej bazy poza jednorazowym lokalnym kontenerem** — nigdy baza demo/staging/produkcyjna, nigdy cudza retained-DB, nigdy `DATABASE_URL` z `.env` repo | „dane demo = twarz produktu" (DEC-65) |
| **Z10** | **Dokładnie DWIE nowe flagi backendowe, obie default OFF, obie z realnym czytelnikiem** (`ENABLE_SIGNAL_PRODUCER`, `ENABLE_SIGNAL_INTERPRETER`). **Zero flag frontowych. Zero zmian wartości domyślnej istniejącej flagi.** Flaga bez egzekwowania = STOP | CLAUDE.md reguła 9 + zakaz placebo (DEC-12/DEC-21) |
| Z11 | **Nie zmieniasz gramatyki tras** ani `src/routes/*`, `src/components/ProtectedRoute.tsx`. Nowa trasa API montuje się jedną linią wg licencji Z17 | Decyzje P0 poza zakresem |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_DAY18_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/13_CHAT/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1` | Repo tonie w dokumentach-duchach |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie. **Nie zmieniasz projektu wiążącego** — rozbieżność projekt↔runtime to wpis „Korekta", nie edycja projektu | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| Z14 | **Nie budujesz własnego klienta AI.** Provider wyłącznie przez `llmService`/`llmConfigService`. Zero `fetch` do API modelu, zero nowego SDK, zero klucza w kodzie/env/testach | `DEC-51` „zakaz atrapy AI" + kontrola kosztu |
| Z15 | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** `ChatSignalsPanel` rozróżnia `'none' \| 'forbidden' \| 'failed'` — Twoje API ma to rozróżnienie **umożliwiać**, nie kasować (403 ≠ 500 ≠ pusta lista) | Uczciwy pusty stan > udawany ekran |
| **Z16** | **★ `server/src/services/effectiveAccessService.ts` jest NIETYKALNY.** Tak samo `frameworkEntitlementService.ts` i `middleware/frameworkEntitlement.middleware.ts`. Wolno **czytać** i **cytować**; wolno **wołać** istniejące funkcje odczytowe. Każda zmiana w tych plikach = **STOP** | Model uprawnień naprawiany in-house, poza dyżurami |
| **Z17** | **★ Izolacja modułowa — zakaz pracy poza zakresem producenta sygnałów**, z imiennymi licencjami z ramki poniżej. Plik spoza ramki = nie Twój zakres, nawet „jedna linia importu" | „jeden moduł na raz"; równoległe strumienie |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**          (llmApi, server/database, node-cron, nodemailer, @google/generative-ai, aws-sdk-client-s3)
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

**To ograniczenie boli najbardziej w dwóch miejscach tego dyżuru i tam właśnie
obowiązuje najostrzej:**
- **`node-cron`** (§S.1 — harmonogram). Istnieje globalny mock. **Nie dopisujesz
  do niego.** `Scheduler` przyjmuje wstrzykiwany `schedule` (`Scheduler.ts:77`,
  `schedule: typeof cron.schedule = cron.schedule`) — testujesz przez
  wstrzyknięcie własnej atrapy harmonogramu w SWOIM pliku testowym.
- **`llmApi` / provider AI** (§W — warstwa interpretacyjna). **Nie dopisujesz do
  globalnego mocka.** Mockujesz `llmService` **lokalnie** (`vi.mock` w Twoim
  pliku) albo przez dedykowany helper w **nowym** pliku importowanym wyłącznie
  przez Twoje testy (np.
  `server/src/services/signals/__tests__/signalInterpreterHarness.ts`).

Jeśli Twój test nie przechodzi bez zmiany globalnego mocka — to jest **STOP**,
nie zmiana globalnego mocka. Bez „addytywnie, więc nic nie zepsuje".

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres — pliki NOWE albo należące do producenta sygnałów):
  server/migrations/2026107X_chat_signals_day18_*.sql          (NOWE pliki, numer wg §0.1 pkt 7)
  server/src/types/workSignals.ts                              (NOWY — słowniki i kontrakty)
  server/src/services/signals/**                               (NOWY katalog: rejestr reguł, evaluator,
                                                                harmonogram, read model, i18n serwerowe,
                                                                interpreter AI, __tests__ obok)
  server/src/jobs/workSignalProducerJob.ts                     (NOWY — wejście dla crona)
  server/src/routes/signals.routes.ts                          (NOWY — kanoniczne GET /api/signals)
  server/src/routes/my-work/signals.routes.ts                  (ISTNIEJĄCY — przemapowanie §A.2/§A.3)
  server/src/routes/my-work/__tests__/signals.routes.*.test.ts (ISTNIEJĄCY strażnik + NOWE)
  docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_DAY18_REPORT_20260826.md   (jedyny nowy dokument)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md    (TYLKO §R.1)
  tests/unit/signals/**  ·  tests/integration/routes/signals.*                  (NOWE pliki, git add -f)

★ LICENCJE IMIENNE NA PLIKI WSPÓŁDZIELONE — wolno DOKŁADNIE tyle, ile napisano:
  L1  server/src/config/FeatureFlags.ts
        WOLNO: dopisać DWIE pozycje do schematu Zod —
               ENABLE_SIGNAL_PRODUCER: z.boolean().default(false)
               ENABLE_SIGNAL_INTERPRETER: z.boolean().default(false)
        NIE WOLNO: zmienić wartości domyślnej ani opisu ŻADNEJ istniejącej flagi.
  L2  server/src/cron/Scheduler.ts
        WOLNO: dodać DOKŁADNIE JEDEN blok `cron.schedule(...)` (przebieg deterministyczny)
               i DOKŁADNIE JEDEN dla przebiegu interpretacyjnego, wzorem job7b (:204-221):
               dynamiczny `await import('../jobs/workSignalProducerJob.js')` w callbacku,
               kill-switch sprawdzany WEWNĄTRZ callbacku (nie przy rejestracji).
        NIE WOLNO: ruszać istniejących jobów, kolejności rejestracji, sygnatury `schedule`.
  L3  server/src/Gateway.ts
        WOLNO: dodać DOKŁADNIE JEDEN import i JEDNĄ linię montażu, wzorem :717:
               app.use('/api/signals', gatewayVerifyToken, orgMembershipGuard, signalsFeedRoutes);
        NIE WOLNO: zmieniać istniejących montaży, kolejności middleware, ani `orgMembershipGuard`.
  L4  server/src/routes/my-work.routes.ts
        WOLNO: NIC — sub-router sygnałów jest już zamontowany (:83 import, :2722 router.use).
               Jeśli okaże się, że musisz coś tu zmienić — STOP.

IMIENNE WYJĄTKI POZA ZAKRESEM (wolno WOŁAĆ/CZYTAĆ istniejące, NIE zmieniać ich kodu ani schematu):
  §E.3/§X.1 — server/src/services/v8/executionVisibilityService.ts::emitSignal (:182)   (WOŁASZ — adapter)
              …::rollupSignals (:674)                                                    (CZYTASZ jako kontrakt)
              server/src/types/executionVisibility.ts (:22-51)                           (IMPORTUJESZ słowniki; NIE rozszerzasz)
  §E.5      — v8_kpi_signals (tabela) + server/src/services/v8/resultsROIService.ts      (CZYTASZ dane/producenta)
  §E.6      — budget_overspend_signals (tabela) + tabele korzyści Finance V3             (CZYTASZ dane)
  §W.2      — server/src/domain/initiatives-execution/aiEvidenceGovernance.ts
                ::aiInputHash (:40)                                                      (IMPORTUJESZ funkcję)
                gate (:80-90)                                                            (KOPIUJESZ WZORZEC do swojego modułu; NIE zmieniasz pliku)
  §W.3      — server/src/services/ai/llmService.ts · llmConfigService.ts                 (WOŁASZ; NIE zmieniasz)
              server/src/services/aiBudgetService.ts                                     (WOŁASZ; NIE zmieniasz)
              server/src/services/aiRunLedgerService.ts                                  (CZYTASZ; jeśli brak generycznego
                                                                                          wejścia dla przebiegu spoza „action" — STOP, patrz §W.3)
  §S.3      — server/src/services/systemAlertNotifier.ts                                 (WOŁASZ przy status=FAILED)
  wszędzie  — server/src/utils/queryHelpers.ts · utils/dbSchema.ts · utils/asyncHandler.ts
              server/src/middleware/auth.middleware.ts (typ AuthRequest)                 (IMPORTUJESZ; NIE zmieniasz)
  Z16       — server/src/services/effectiveAccessService.ts                              (CZYTASZ/WOŁASZ odczyt; ZMIANA = STOP)

NIE WOLNO (nawet jednej linii):
  src/**                                       ← CAŁY FRONT. Zero .tsx, zero .ts w src/. Należy do bloku frontowego.
  public/locales/**                            ← słownik frontu; Twoje napisy mają WŁASNY słownik serwerowy (§A.1 pkt 6)
  server/src/services/notificationService.ts   ← kanał „powiadom o sygnale" = POZA ZAKRESEM dnia 18 (§1.7 poz. 2)
  server/src/services/aiNotificationTriggers.ts ← martwy producent legacy; nie reanimujesz, nie kasujesz (§X.2)
  server/migrations-v2/**                      ← baseline, TYLKO ODCZYT
  server/src/services/v8/executionVisibilityService.ts  ← WOŁASZ emitSignal; ZMIANA = STOP
  server/src/services/artifactHandoff/**       ← cudzy kręgosłup
  tests/e2e/**  ·  tests/acceptance/**  ·  tests/visual/**   ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" i spoza licencji
L1–L4 — to **nie jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz
w raporcie, idziesz dalej.

### 0.3. Higiena wykonania

- **★ Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(signals): additive work_signals table with audience columns (D.1)
  feat(signals): run ledger table and domain mute preference (D.2)
  feat(signals): declarative rule registry contract (E.1)
  feat(signals): differencing evaluator with dedupe and auto-resolve (E.2)
  feat(signals): four EXECUTION rules on real tenant data (E.3)
  feat(signals): canonical feed endpoint with org and role audience filter (A.1)
  feat(signals): interpreted layer behind a default-off flag, fail-closed (W.1, W.2, W.3)
  test(signals): cross-org and cross-role negative pack (A.4)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **Typy punktowo**: `npx esbuild <plik> --loader:.ts=ts --outfile=/dev/null`,
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT … ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN … TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **Numer wyznaczasz w Bloku 0** (§0.1 pkt 7) i sprawdzasz `ls | grep`
     **przed każdym plikiem**. Nazwa: `2026107X_chat_signals_day18_<temat>.sql`.
  3. **★ ZERO kluczy obcych** do tabel dziedzinowych (`tasks`, `decisions`,
     `initiatives`, `organizations`, `notifications`). Sygnał jest **obserwacją**,
     a nie własnością rekordu; FK do tabel o nieznanej kolejności migracji jest
     pułapką sortowania, a kasowanie podmiotu ma domykać sygnał regułą
     (`resolved_reason = 'SUBJECT_DELETED'`), nie kaskadą.
  4. **CHECK-i zakładasz przez `DO $$` z probą katalogu** (wzorzec
     `server/migrations/942_chat_m01p04a_attachment_status.sql:50-59`) — żeby
     powtórne uruchomienie nie wywaliło się na istniejącym ograniczeniu.
  5. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65) — warunek oddania
     każdej pozycji z migracją.** Jednorazowy kontener, trzy przebiegi, wyniki
     do raportu, **sprzątanie kontenera I wolumenów**:
     ```bash
     docker run -d --name cx-day18-pg \
       --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
       -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day18 \
       -p 4320:5432 pgvector/pgvector:pg16
     export DATABASE_URL="postgres://postgres:cx@localhost:4320/cx_day18"
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict        # przebieg 1
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict        # przebieg 2 → 0 applied
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry  # dry → 0 pending
     docker rm -f cx-day18-pg && docker volume ls -q | grep -i cx-day18 | xargs -r docker volume rm
     docker ps -a --filter name=cx-day18-pg                          # MUSI BYĆ PUSTO
     ```
     **Kompatybilność wstecz** = migracja stosuje się czysto na bazie
     zawierającej wiersze sprzed migracji (istniejące
     `my_work_signal_prefs`/`_snoozes`/`_dismissals` z kluczami postaci
     `notification:<id>`) i **nie psuje ich odczytu**.
- **Sprzątanie po sobie.** Kontener + wolumeny usunięte, żadnych rekordów
  testowych poza kontenerem, żadnych plików tymczasowych w repo.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane** — odczyt i zapis idą do realnej bazy. Zero `sampleData`,
   zero stałych zaszytych „przykładowych sygnałów", zero `localStorage`.
   Pusty wynik = uczciwa pusta lista, nigdy podstawiona.
2. **Zapis z readbackiem** — po zapisie stan czytany jest **ponownie z bazy**
   (nie z obiektu w pamięci). Dla evaluatora oznacza to: drugi przebieg czyta
   to, co zapisał pierwszy.
3. **Zero atrap.** Każda funkcja coś robi. Brak realnego źródła danych dla
   reguły → wpis `BRAK_DANYCH` + STOP dla tej jednej reguły, **nigdy** reguła
   zwracająca stałą.
4. **★ Minimum CZTERY testy zachowania**: happy · ścieżka błędu ·
   pusty/negatywny warunek (reguła NIE trafia) · **negatyw tenanta** (obcy
   `organizationId` dostaje 0 wierszy / 403 / 404, nigdy 200 z danymi).
   Dla tras dochodzi piąty: **negatyw roli** (§A.4).
5. **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
   i asertuje `toContain('…')`, **nie liczy się do DoD**. Każda pozycja ma co
   najmniej jeden test, który wywołuje realny handler / realny serwis
   i sprawdza WYNIK.
6. **★ Testy reguł na realnym PG w jednorazowym kontenerze**, nie na atrapie
   zapytania. Reguła, której nie udowodniłeś na realnym Postgresie, jest
   `CZĘŚCIOWA`.
7. **Idempotencja** — dwa przebiegi z rzędu na tych samych danych dają
   **identyczny** stan bazy (poza `last_observed_at`/`run_id`). Udowodnione
   testem, nie deklaracją.
8. **Izolacja tenantowa wymuszona strukturą** — `organization_id` jest
   **pierwszą kolumną każdego indeksu**, a każde zapytanie odczytu ma
   `WHERE organization_id = $1` z **tokenu**, nigdy z parametru żądania.
9. **Plik przez `prettier`** przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

Przed oddaniem raportu:
1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone**. W tym dyżurze z definicji współdzielone:
   `server/src/config/FeatureFlags.ts` (L1), `server/src/cron/Scheduler.ts` (L2),
   `server/src/Gateway.ts` (L3), `server/src/routes/my-work/signals.routes.ts`
   (konsumowany przez panel Chatu).
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum:
   ```bash
   npx vitest run server/src/routes/my-work/__tests__
   npx vitest run server/src/services/signals/__tests__
   npx vitest run tests/unit/signals
   npx vitest run server/src/cron/__tests__ 2>/dev/null || true
   npx vitest run server/src/config/__tests__ 2>/dev/null || true
   npx vitest run tests/integration/routes/signals.feed.postgres.integration.test.ts
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego).

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- **zgadnąć numer migracji** zamiast wyznaczyć „najwyższy + 1" z `ls|grep`
  (`DEC-2026-08-26-86`);
- osłabić/usunąć asercję w teście istniejącym wcześniej — w szczególności
  w `signals.routes.org-isolation.test.ts` (§T.1);
- dodać migrację nieaddytywną, FK do tabeli dziedzinowej, albo zmieniającą
  typ/znaczenie istniejącej kolumny;
- stworzyć trzecią flagę, zmienić default istniejącej, albo zostawić flagę
  bez realnego czytelnika (Z10);
- zmienić `effectiveAccessService` / `frameworkEntitlement*` (Z16);
- zmienić `emitSignal`/`rollupSignals`/`executionVisibility.ts` — wolno
  **wołać** i **importować słowniki**, zmiana = STOP;
- dotknąć czegokolwiek w `src/` (front) albo `public/locales/**`;
- **wywołać providera AI na żywo** (brak klucza = `STOP-BRAK_API`, nigdy
  „ustawię klucz na chwilę");
- **wysłać cokolwiek na zewnątrz** — mail, webhook, wywołanie zewnętrznego API
  (DEC-65);
- odkryć, że reguła nie ma realnego źródła danych w tej bazie (`BRAK_DANYCH` —
  nie budujesz tabeli źródłowej „przy okazji", to cudzy moduł);
- odkryć, że `aiRunLedgerService` nie ma generycznego wejścia dla przebiegu,
  który nie jest „action" (§W.3);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze;
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

Właściciel podczas przeglądu Chatu 2026-08-22, o panelu „Ważne sygnały":

> „Nie wiem, czy te sygnały do czegokolwiek są teraz wykorzystywane."
> — `modules/13_CHAT/OWNER_REVIEW_2026-08-22.md:63`

Zadanie `CHAT-OWN-004` (P1) brzmiało: ustalić producenta, schemat, semantykę
odświeżania, konsumenta i akcję właściciela; zachować funkcję **tylko jeśli ma
realną rolę end-to-end**. Kryterium odbioru dosłownie:

> „every signal shows source, freshness, severity and destination; zero state
> explains purpose; refresh reads canonical data; authorization and cross-tenant
> denial are proven."

Właściciel wybrał **budowę zamiast ukrycia** (`DEC-2026-08-25-36`), wbrew
wcześniejszemu wzorcowi ukrywania placebo. Powstał projekt
(`CHAT_SIGNALS_PRODUCER_DESIGN_2026-08-25.md`, 763 linie), właściciel rozstrzygnął
trzy punkty decyzyjne (`DEC-2026-08-26-89`, warianty **B/B/B**), i to jest
wykonanie mechaniki tylnej.

**Stan realny, który naprawiasz (zweryfikowany na tipie bazy — sprawdź sam
w Bloku 0):**

- **Rura A — panel Chatu.** Panel jest realny (`src/components/AIChat/ChatSignalsPanel.tsx`
  woła `GET /my-work/signals`), ale **zasilanie czyta nieprzeczytane
  powiadomienia** (`server/src/routes/my-work/signals.routes.ts:155`
  `FROM notifications`) i przepuszcza je przez **filtr podłańcuchowy nazwy typu**
  (`:41-46`: `t.includes('AI') || t.includes('RECOMMENDATION') || …`). Sygnał nie
  jest bytem — jest **reinterpretacją napisu w kolumnie `type`**.
- Jedynym producentem takich powiadomień jest
  `server/src/services/aiNotificationTriggers.ts`, którego **jedyny** konsument to
  ręczny endpoint `POST /api/ai/trigger-notification`. Brak harmonogramu, brak
  workera, brak reguły. **Feed jest pusty nie przez błąd, tylko przez brak
  producenta.**
- **Dokładka predykcyjna** (`signals.routes.ts:206-259`) jest **martwa
  w produkcji**: używa funkcji SQLite `datetime('now')` (`:214`) na Postgresie,
  całość opakowana w `try/catch` z cichym `logger.error('[signals:predictions]')`
  (`:259`). Nawet gdyby działała — zapisuje pole `message`, a konsument czyta
  `body`.
- **Rura B — My Work Home.** `rollupSignals`
  (`server/src/services/v8/executionVisibilityService.ts:674`) czyta
  `v8_execution_signals`; tabela i emiter `emitSignal` (`:182`) są poprawne,
  ale **`emitSignal` nie ma ani jednego wywołania produkcyjnego** — tylko
  definicję i testy. Druga pusta rura.

**To jest dokładnie ten wzorzec porażki, którego ten dyżur ma NIE powtórzyć:
schemat bez producenta, producent bez wywołania, błąd połknięty w `catch`.**

### 1.2. Dokumenty wiążące merytorycznie

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
        :72   DEC-2026-08-25-20  system tłumaczeń, PL wiodące (skutek: klucze i18n, nie gotowy tekst)
        :75   DEC-2026-08-25-23  Agent/Teresa = moduł 17; producent NIE jest agentem
        :88   DEC-2026-08-25-36  BUILD_PRODUCER_NOW — źródło tego dyżuru
        :92   DEC-2026-08-25-40  zakaz odkładania na po-MVP (dlatego warstwa AI powstaje TERAZ, choć OFF)
        :103  DEC-2026-08-25-51  zakaz atrapy AI; realny provider + pełny rodowód
        :117  DEC-2026-08-25-65  freeze staging/demo/production — prawo nadrzędne nad migracjami
        :138  DEC-2026-08-26-86  symlink node_modules autoryzowany; numer migracji = najwyższy + 1
        :141  DEC-2026-08-26-89  TEN DYŻUR — D1=B, D2=B, D3=B
PROJEKT WIĄŻĄCY (git show codex/chat-signals-design-20260825:…):
docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/CHAT_SIGNALS_PRODUCER_DESIGN_2026-08-25.md
        §2    definicja sygnału (pięć testów), taksonomia, anatomia
        §3    architektura pięciu warstw, rejestr reguł, evaluator, harmonogram, warstwa AI
        §4    model danych (work_signals, work_signal_runs, i18n przez klucze)
        §5    kontrakt z konsumentami (GET /api/signals, SignalDTO, przemapowanie /my-work/signals)
        §7    plan implementacji B1–B9 (Twoje pozycje to B1–B4, B6, B7, B8 w części tylnej)
        §8    dwanaście ryzyk R1–R12 — każde ma mieć odpowiednik w Twoim kodzie lub w STOP-ie
docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md    (TYLKO ODCZYT poza §R.1)
docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/OWNER_REVIEW_2026-08-22.md  (ODCZYT — CHAT-OWN-004)
```

**Kolejność rozstrzygania sporu:** rejestr decyzji > projekt wiążący > ta
instrukcja > realny kod. Jeżeli projekt mówi coś, czego runtime nie potwierdza
(np. numer linii, nazwa tabeli) — **pracujesz na stanie faktycznym** i wpisujesz
rozbieżność do „Korekt wobec instrukcji". Jeżeli projekt mówi coś sprzecznego
z `DEC-89` — obowiązuje `DEC-89`.

### 1.3. Decyzje wiążące — co z nich wynika dla kodu

1. **`DEC-2026-08-26-89` D1 = B** → **dokładnie 10 reguł deterministycznych**
   w falach: 4 × EXECUTION, 2 × DECISION, 2 × RESULTS (KPI), 2 × FINANCE.
   Nie dokładasz jedenastej „bo łatwa". Nie oddajesz dziewięciu bez STOP-a.
2. **`DEC-2026-08-26-89` D2 = B** → warstwa deterministyczna działa (za
   `ENABLE_SIGNAL_PRODUCER`, którą zdejmuje nadzorca na środowisku odbiorowym);
   warstwa `INTERPRETED` jest **zbudowana, otestowana z mockiem providera
   i zamknięta flagą `ENABLE_SIGNAL_INTERPRETER` = OFF**. „Zbudowana i wyłączona"
   ≠ „szkielet i TODO".
3. **`DEC-2026-08-26-89` D3 = B** → feed **organizacyjny**: `audience_user_id`
   NULL = adresat organizacyjny, `audience_role` NULL = wszyscy członkowie org.
   Sprawy własne **wyróżnione** — DTO niesie `isMine: boolean` (i to jest cała
   „własność" po stronie tylnej; wyróżnienie wizualne robi front).
4. **`DEC-2026-08-25-65` (DEC-65)** — zakaz deployów, zdalnych migracji, zapisów
   do wspólnej bazy, realnych wysyłek. Migracje = `MIGRATION_PREPARED`.
   **To jest prawo nadrzędne nad wszystkim poniżej.**
5. **`DEC-2026-08-25-51`** — zakaz atrapy AI. Warstwa `INTERPRETED` **nigdy nie
   tworzy faktu**: wolno jej łączyć, priorytetyzować i nazywać wzorzec w zbiorze
   sygnałów deterministycznych, które **już istnieją**. Model „zauważający" coś
   spoza tego zbioru = halucynacja = odmowa zapisu przez gate rodowodu.
6. **`DEC-2026-08-25-40`** — nic nie idzie do backlogu po-MVP. Dlatego warstwa
   AI powstaje w tym dyżurze, a nie „kiedyś".
7. **`DEC-2026-08-25-23`** — moduł 17 jest **konsumentem** `work_signals`.
   Nie budujesz w drugą stronę.
8. **`DEC-2026-08-25-20`** — PL wiodące. Sygnał trzyma w bazie **`title_key` +
   `title_params`**, nigdy gotowy tekst angielski. To naprawia dzisiejszą wadę
   (`aiNotificationTriggers` zapisuje gotowy EN do bazy, a polski UI wyświetla go
   dosłownie).

### 1.4. ★ PODZIAŁ FRONT / TYŁ — co należy do Ciebie, a co nie

To jest najważniejszy akapit koordynacyjny tego dyżuru.

| Warstwa | Właściciel | Zawartość |
| --- | --- | --- |
| **TYŁ — Twój dyżur** | Ty | migracje `work_signals` / `work_signal_runs` / kolumna preferencji domen · typy i słowniki · rejestr 10 reguł · evaluator różnicujący · harmonogram + on-demand + ledger przebiegów · read model + `GET /api/signals` + przemapowanie `GET /my-work/signals` · filtr organizacji i roli · serwerowe rozwijanie kluczy i18n · warstwa `INTERPRETED` za flagą OFF · adapter do `v8_execution_signals` · testy |
| **FRONT — NIE Twój** | osobny blok wewnętrzny | panel „Ważne sygnały" (`src/components/AIChat/ChatSignalsPanel.tsx`) · przeniesienie triggera do prawej grupy nagłówka (`CHAT-OWN-010`) · prezentacja `source`/`freshness`/`destination` · znacznik pochodzenia i rozwijany rodowód · pusty stan wyjaśniający cel · wyróżnienie spraw własnych · flagi frontowe · `public/locales/**` |

**Granica jest jednoznaczna: Ty dajesz kontrakt i dane, front je maluje.**

**Zgodność wstecz jest Twoim obowiązkiem, nie jego.** Dzisiejszy panel czyta
`{ key, type, title, body, severity, createdAt, projectId, projectName,
entityType, entityId }` (`ChatSignalsPanel.tsx:144-155`) i **`severity` zna tylko
`'INFO' | 'WARNING' | 'CRITICAL'`**. Twoje nowe pola są **supersetem** — panel
frontowy ma działać **bez zmian** w dniu wdrożenia backendu. Patrz pułapka 4
w §1.5.

**Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy coś należy do
Ciebie, czy do bloku frontowego — **należy do niego**, a Ty wpisujesz to do
„Znalezisk".

W Bloku 0 sprawdzasz stan strumieni:
```bash
git log --oneline codex/m03-admin-20260824..codex/chat-signals-design-20260825 | head
git log --oneline codex/m03-admin-20260824..codex/signals-org-filter-fix-20260825 | head   # oczekiwane: PUSTE (scalona)
```
Wynik → raport, sekcja „Koordynacja".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **★ Filtr podłańcuchowy nazwy typu jest sednem defektu, nie detalem.**
   `isAiSignalNotification` (`signals.routes.ts:41-46`) uznaje za „sygnał"
   powiadomienie, którego `type` zawiera napis `AI`/`RECOMMENDATION`/`INSIGHT`/
   `RISK`. **Ta funkcja ma zniknąć razem z odczytem z `notifications`** (§A.2).
   Dopóki żyje, każdy nowy schemat jest kosmetyką.
2. **★ Blok predykcyjny to martwy kod na Postgresie.** `datetime('now')` i
   `datetime('now','+3 days')` (`:214`, `:238`) to funkcje SQLite. Na Postgresie
   zapytanie rzuca, `catch` (`:259`) je połyka, feed cicho gaśnie. **Usuwasz go
   w §A.2** — i to jest dowód, że rozumiesz, dlaczego `try/catch` bez ledgera
   przebiegów jest niedopuszczalny (§S.3).
3. **★ Dwa emitery bez wywołań.** `emitSignal` i `aiNotificationTriggers` mają
   po zero produkcyjnych callerów. **Twoja reguła bez wywołania w evaluatorze,
   albo evaluator bez wywołania w harmonogramie, to ten sam błąd.** Bramka §T.3
   sprawdza wywołanie end-to-end, nie istnienie funkcji.
4. **★ `severity` frontu nie zna `blocker`.** Typ panelu ma
   `'INFO' | 'WARNING' | 'CRITICAL'`, a taksonomia bazy ma cztery wartości
   (`executionVisibility.ts:47`: `info | warning | critical | blocker`).
   **W polu legacy `severity` mapujesz `blocker → 'CRITICAL'`**, a pełną wartość
   niesiesz w nowym polu (`severityRaw` albo `severityLevel` — nazwę ustalasz
   i opisujesz w raporcie). **Nie wysyłaj `'BLOCKER'` w polu, którego konsument
   nie zna** — to zepsuje istniejący panel bez jednej linii zmiany w nim.
5. **★ Słownik ról jest brudny i ma warianty wielkości liter.**
   `server/src/types/index.ts:53-74` zawiera równolegle `owner`/`OWNER`,
   `admin`/`ADMIN`/`administrator`, `project_manager`/`PROJECT_MANAGER`,
   `member`/`MEMBER`, `consultant`/`CONSULTANT` itd. **`audience_role`
   zapisujesz w JEDNEJ, znormalizowanej postaci (`UPPER_SNAKE`), a porównanie
   w filtrze robisz po normalizacji obu stron.** Filtr roli, który porówna
   `'admin'` z `'ADMIN'` i nie trafi, jest cichym ukryciem sygnałów — gorszym
   niż wyciek, bo niewidocznym.
6. **★ Rola bierze się z tokenu i z członkostwa, nie z parametru żądania.**
   `auth.middleware.ts` mapuje rolę (`mapRoleForAuthenticatedUser`, `:517`)
   i czyta członkostwo z bazy (`:778`). **Nigdy** nie przyjmujesz `role`
   z query/body. Test negatywny roli (§A.4) ma to udowodnić.
7. **Nie istnieje tabela `signals`/`work_signals`.** Migracja
   `server/migrations/20260307_my_work_signals.sql` tworzy **wyłącznie trzy
   tabele preferencji**: `my_work_signal_prefs` (`:3`),
   `my_work_signal_snoozes` (`:11`), `my_work_signal_dismissals` (`:21`).
   Sygnały są dziś liczone przy odczycie — nie mają tożsamości, historii ani
   rodowodu. **Nie dublujesz tych trzech tabel** (§D.2, §A.3).
8. **Klucz sygnału zmienia postać.** Dziś `signal_key` = `notification:<id>`.
   Po zmianie = `work_signals.signal_id`. **Stare klucze mają współistnieć
   i wygasnąć naturalnie** (snooze ma `snoozed_until`), a nie zostać
   zmigrowane bezwarunkowym `UPDATE` (zakaz z §0.3).
9. **`v8_execution_signals` NIE jest do kasacji.** `rollupSignals` jest realnie
   czytany przez My Work Home; zerwanie tego psuje **drugi ekran**. Reguły
   domeny EXECUTION piszą do `work_signals` **oraz** wołają `emitSignal`
   (adapter, §X.1). To jedyny powód, dla którego wolno Ci `emitSignal` wołać —
   i nadal nie wolno go zmieniać.
10. **`aiRunLedgerService` jest „action-centric".** Eksportuje m.in.
    `ensureRunForAction(action)` — nie ma generycznego wejścia dla przebiegu,
    który nie jest „action". **Nie przerabiasz go.** Koszt i identyfikator
    przebiegu AI zapisujesz w `work_signal_runs.ai_run_id` (kolumna nullable),
    a brak generycznego API opisujesz jako STOP z propozycją (§W.3).
11. **Cron rejestruje się przez wstrzykiwany `schedule`.** `Scheduler.ts:77`
    ma `schedule: typeof cron.schedule = cron.schedule` — to jest Twój punkt
    testowania **bez** dotykania globalnego mocka `node-cron` (Z18). Wzorzec
    callbacku: job7b (`:204-221`), `await import()` **wewnątrz** callbacku.
12. **Kill-switch sprawdzasz WEWNĄTRZ callbacku, nie przy rejestracji.**
    Job zarejestrowany warunkowo znika z procesu i nie da się go włączyć bez
    restartu; job, który sam sprawdza flagę i kończy się statusem
    `SKIPPED_DISABLED` w ledgerze, jest **dowodem, że mechanizm żyje**.
13. **Panel prosi o `limit=50` i pokazuje 12** (`ChatSignalsPanel`
    `COLLAPSED_SIGNAL_COUNT = 12`). Reguła bez limitu utopi feed (ryzyko R1
    projektu). `maxPerRunPerOrg` domyślnie **25** jest wymogiem, nie sugestią.
14. **Uczciwe stany błędu są chronione (Z15).** Panel rozróżnia
    `'none' | 'forbidden' | 'failed'`. Twoje API musi to **umożliwiać**:
    brak członkostwa → `403`, awaria → `5xx`, brak sygnałów → `200` z pustą
    listą. **Zwracanie pustej listy zamiast 403 = odrzucenie pozycji.**

### 1.6. Reguła 7 — nic nie idzie na ekran właściciela z tego dyżuru

Nie produkujesz powierzchni wizualnej. W raporcie piszesz „mechanika gotowa do
konsumpcji przez blok frontowy", **nigdy** „gotowe do pokazania właścicielowi"
ani „można włączyć flagę i zobaczyć". Zdjęcie `ENABLE_SIGNAL_PRODUCER` na
środowisku odbiorowym wykonuje nadzorca — nie Ty.

### 1.7. Pozycje otwarte — trzy rzeczy, których NIE ZGADUJESZ

| # | Pozycja otwarta | Gdzie | Twój produkt |
| --- | --- | --- | --- |
| 1 | Czy `GET /my-work/signals` ma po przemapowaniu zwracać **tylko sygnały adresowane do mnie**, czy **cały feed organizacyjny** (jak `GET /api/signals`)? | §A.2 | Domyślnie **cały feed organizacyjny z filtrem roli** (D3=B), z `isMine` do wyróżnienia. STOP z propozycją, jeśli nadzorca chce inaczej |
| 2 | Kanał „powiadom o sygnale `critical`/`blocker`" przez `notificationService` | §1.4 / Z17 | **POZA ZAKRESEM dnia 18.** Projekt przewiduje go jako opcjonalny i jednostronny; DEC-65 zakazuje realnych wysyłek. Wpis w „Czego nie zrobiłem" |
| 3 | Nazwa pola pełnej wagi w DTO obok legacy `severity` (`severityRaw` / `severityLevel`) | §A.1, pułapka 4 | Wybierasz jedną, stosujesz konsekwentnie, **opisujesz w raporcie** jako kontrakt dla bloku frontowego |

---

## 2. MAPA TECHNICZNA — skrót niezbędny

**Wszystkie numery linii poniżej zostały zweryfikowane na tipie
`codex/m03-admin-20260824` w chwili wystawiania instrukcji. Mapa starzeje się
w ~3 dni. Blok 0 każe Ci ją zweryfikować i pracować na stanie faktycznym; każdą
rozbieżność wpisujesz do „Korekt wobec instrukcji".**

### 2.1. Co JEST gotowe (i czego NIE budujesz od nowa)

```
# Zamrożone słowniki — IMPORTUJESZ, nie wymyślasz
server/src/types/executionVisibility.ts
  :22-36  ExecutionSignalTypeValues — 13 zamrożonych typów wykonawczych
  :38-44  SourceObjectTypeValues = task|decision|initiative|project|program
  :47     SignalSeverityValues    = info|warning|critical|blocker
  :50     AggregationLevelValues  = task|initiative|project|pmo

# Druga rura (pusta) — adapter, NIE kasacja
server/src/services/v8/executionVisibilityService.ts
  :182  emitSignal(params)   ← ZERO produkcyjnych callerów; Ty stajesz się pierwszym (§X.1)
  :674  rollupSignals(...)   ← czytany przez My Work Home; kontrakt bez zmian

# Dzisiejszy feed — do przemapowania i odchudzenia
server/src/routes/my-work/signals.routes.ts   (387 linii)
  :41-46   isAiSignalNotification — filtr podłańcuchowy      → USUWASZ (§A.2)
  :86      odczyt muted_types_json z my_work_signal_prefs
  :135-139 sonda kolumny organization_id + filtr org         → ZACHOWUJESZ SENS, zmieniasz źródło
  :155     FROM notifications                                 → ZASTĘPUJESZ read modelem
  :206-259 blok predykcyjny (SQLite datetime na PG, cichy catch) → USUWASZ (§A.2)
  :260+    POST /signals/mute-type · /signals/:key/snooze · /signals/:key/dismiss  → ZOSTAJĄ (§A.3)
  mount:   server/src/routes/my-work.routes.ts:83 (import), :2722 (router.use)  → BEZ ZMIAN (L4)

# Strażnik izolacji — MUSI zostać zielony albo zostać uczciwie przepisany
server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts  (219 linii)
  dowodzi: (1) GET zwraca tylko wiersze org z tokenu; (2) snooze/dismiss na obcym kluczu = 404
           bez zapisu; (3) te same mutacje działają dla klucza z własnej org

# Preferencje użytkownika — NIE dublujesz
server/migrations/20260307_my_work_signals.sql
  :3   my_work_signal_prefs(user_id PK, organization_id, muted_types_json, quiet_hours_json, updated_at)
  :11  my_work_signal_snoozes(user_id, signal_key, snoozed_until)
  :21  my_work_signal_dismissals(user_id, signal_key, dismissed_at)

# Harmonogram
server/src/cron/Scheduler.ts
  :77       schedule: typeof cron.schedule = cron.schedule   ← wstrzykiwalny (punkt testowania, Z18)
  :204-221  job7b — wzorzec '*/15 * * * *' + await import() w callbacku

# Flagi backendowe
server/src/config/FeatureFlags.ts   — schemat Zod, wzorzec `z.boolean().default(false)`

# Autoryzacja i montaż tras
server/src/Gateway.ts
  :463  orgMembershipGuard = validateOrgMembership
  :717  app.use('/api/conversations', gatewayVerifyToken, orgMembershipGuard, conversationsRoutes)  ← WZORZEC (L3)
server/src/middleware/auth.middleware.ts
  :491/:517  mapRole / mapRoleForAuthenticatedUser   ← rola znormalizowana
  :778       odczyt członkostwa (role, status) z bazy

# Rodowód AI — wzorzec gatu (KOPIUJESZ WZORZEC, nie plik)
server/src/domain/initiatives-execution/aiEvidenceGovernance.ts
  :11-38  AIAnalysisProposal — kształt rodowodu (model/prompt/template/inputHash/evidenceRefs/confidence)
  :40     aiInputHash(v)  ← IMPORTUJESZ
  :80-90  twardy gate: brak inputHash | provider | model | prompt.version | template.version
          | pustego output | pustych evidenceRefs | confidence==='UNKNOWN'  → WYJĄTEK (nie ostrzeżenie)

# Warstwa AI — abstrakcja, przez którą WOLNO wołać
server/src/services/ai/llmService.ts        :678 class LLMService · :1892 export const llmService
server/src/services/ai/llmConfigService.ts  :94 gemini-2.0-flash (tier BUDGET :99) · :111 deepseek-chat (:116)
                                            :240 mapa tierów (BUDGET)
server/src/services/aiBudgetService.ts      budżet kosztowy
server/src/services/aiRunLedgerService.ts   :198 ensureRunForAction — ACTION-CENTRIC (pułapka 10)
wzorzec fail-closed „brak providera": server/src/routes/ai.routes.ts:355-368  → kod NO_LLM_PROVIDER

# Alarmowanie
server/src/services/systemAlertNotifier.ts  ← WOŁASZ przy przebiegu FAILED (§S.3)

# Migracje — konwencja i walidator
server/scripts/validate-migration-naming.ts  :34-37  ^\d{8}_[a-z0-9_]+\.sql$
najwyższy prefiks w chwili wystawiania instrukcji: 20261075  → WERYFIKUJESZ SAM (§0.1 pkt 7)
wzorzec CHECK-a z probą katalogu: server/migrations/942_chat_m01p04a_attachment_status.sql:50-59
```

### 2.2. Źródła danych dla 10 reguł — inwentarz obowiązkowy w Bloku 0

**Nie zakładasz, że tabela istnieje. Sprawdzasz.** Dla każdej z 10 reguł
wypełniasz wiersz tabeli w raporcie (§9.1, „Inwentarz źródeł"):

| `ruleId` | Domena | Warunek (wg projektu §3.2) | Kandydat na źródło | Sprawdzenie |
| --- | --- | --- | --- | --- |
| `exec.task.overdue` | EXECUTION | zadanie po terminie, status ≠ done | `tasks` | kolumny `due_date`, `status`, `organization_id`, `assignee_id` |
| `exec.task.due_soon_not_started` | EXECUTION | termin ≤ 3 dni, status `todo`/`blocked` | `tasks` | jw. |
| `exec.task.blocked_stale` | EXECUTION | `blocked` > 5 dni bez zmiany | `tasks` | `updated_at` |
| `exec.initiative.no_baseline` | EXECUTION | inicjatywa aktywna bez baseline | `initiatives` | kolumna/flaga baseline |
| `dec.pending_stale` | DECISION | decyzja `pending` > 5 dni | `decisions` | `status`, `created_at`, `decision_maker_id` |
| `dec.blocking_dependents` | DECISION | decyzja `pending` blokuje ≥1 obiekt | `decisions` + zależności | tabela zależności/blokad |
| `res.kpi_threshold_breached` | RESULTS | KPI poza progiem | `v8_kpi_signals` | realny producent: `resultsROIService` |
| `res.roi_confidence_dropped` | RESULTS | spadek pewności prognozy | Results VNext | tabela prognoz/pewności |
| `fin.budget_overspend` | FINANCE | przekroczenie budżetu inicjatywy | `budget_overspend_signals` | tabela obecna w katalogu PostgresDatabase.ts:293 |
| `fin.benefit_not_realized` | FINANCE | korzyść po terminie realizacji, brak potwierdzenia | Finance V3 / `benefit_*` | `benefit_achievements`, `benefit_attributions` i pokrewne |

Komendy inwentarza (Blok 0):
```bash
grep -rn "CREATE TABLE IF NOT EXISTS public.tasks\|CREATE TABLE IF NOT EXISTS public.decisions" server/migrations-v2/001_baseline_20260413.sql | head
grep -rn "v8_kpi_signals\|budget_overspend_signals" server/migrations-v2/001_baseline_20260413.sql | head
grep -rn "benefit_" server/migrations-v2/001_baseline_20260413.sql | grep "CREATE TABLE" | head
grep -rn "v8_kpi_signals" server/src/services/v8/resultsROIService.ts | head -3
```

**Werdykt per reguła: `ŹRÓDŁO_JEST` / `ŹRÓDŁO_INNE_NIŻ_W_PROJEKCIE` (podajesz
jakie) / `BRAK_DANYCH`.** `BRAK_DANYCH` = STOP dla tej jednej reguły, reszta
idzie dalej. **Nie budujesz brakującej tabeli źródłowej — to cudzy moduł.**

---

## §D. FUNDAMENT DANYCH — trzy pozycje

**Cel:** sygnał przestaje być liczbą wyliczaną przy odczycie, a staje się bytem
z tożsamością, historią, adresatem, dowodem i rodowodem. Zero UI, zero tras —
puste tabele są nieszkodliwe.

### D.1 — Tabela `work_signals`

**Co budujesz.** Migracja addytywna (numer wg §0.1 pkt 7,
`2026107X_chat_signals_day18_work_signals.sql`) tworząca `work_signals`
w kształcie z projektu §4.1. Kolumny obowiązkowe (nie skracasz listy):

```
signal_id (uuid PK) · organization_id · dedupe_key · domain · signal_type · origin
severity · subject_type · subject_id · project_id(NULL) · audience_user_id(NULL)
audience_role(NULL) · title_key · title_params(jsonb '{}') · body_key(NULL)
body_params(jsonb '{}') · evidence(jsonb '[]') · action(jsonb '{}')
rule_id · rule_version · provenance(jsonb NULL) · source_signal_ids(jsonb '[]')
status(default 'OPEN') · first_observed_at · last_observed_at · resolved_at(NULL)
resolved_reason(NULL) · expires_at(NULL) · run_id · created_at · updated_at
```

Indeksy — **`organization_id` jest pierwszą kolumną każdego z nich**:
```
uq_work_signals_open_key   UNIQUE (organization_id, dedupe_key) WHERE status='OPEN'   ← tożsamość + idempotencja
idx_work_signals_feed      (organization_id, status, severity, last_observed_at DESC)
idx_work_signals_audience  (organization_id, audience_user_id, status)
idx_work_signals_project   (organization_id, project_id, status)
idx_work_signals_subject   (organization_id, subject_type, subject_id)
```

CHECK-i na `domain` / `origin` / `severity` / `status` zakładasz **przez `DO $$`
z probą katalogu** (wzorzec `942_chat_m01p04a_attachment_status.sql:50-59`), żeby
powtórne uruchomienie nie wywaliło się na istniejącym ograniczeniu.

Słowniki (zgodne z projektem §2.3 i `DEC-89` D1):
- `domain` ∈ `EXECUTION | DECISION | RESULTS | FINANCE | ASSESSMENT | MEETINGS | MATERIALS | GOVERNANCE`
  (CHECK obejmuje wszystkie osiem, **reguły powstają tylko dla pierwszych czterech** —
  addytywność CHECK-a jest tańsza niż późniejsza migracja);
- `origin` ∈ `DETERMINISTIC | AGGREGATED | INTERPRETED`;
- `severity` ∈ `info | warning | critical | blocker` (import z
  `executionVisibility.ts:47`, **nie przepisujesz wartości ręcznie**);
- `status` ∈ `OPEN | RESOLVED | SUPERSEDED`;
- `resolved_reason` ∈ `CONDITION_CLEARED | SUBJECT_DELETED | SUPERSEDED | EXPIRED | USER_RESOLVED`.

**Wymagania twarde:**
1. **Zero kluczy obcych** (§0.3 pkt 3).
2. **Częściowy unikat po `status='OPEN'`** — daje idempotencję zapisu przy
   zachowaniu historii (rozwiązane sygnały zostają w tabeli).
3. **`title_key`/`title_params`, nigdy gotowy tekst** (`DEC-20`). Wiersz
   z angielskim zdaniem w `title_key` = odrzucenie pozycji.
4. Migracja **stosuje się czysto na bazie zawierającej stare wiersze
   preferencji** (kompatybilność wstecz, §0.3 pkt 5).

**Definicja ukończenia D.1:**
1. Trzy przebiegi migracji na jednorazowym kontenerze: (1) applied, (2) `0 applied`,
   (3) dry `0 pending` — wyniki w raporcie.
2. Test na realnym PG: wstawienie dwóch wierszy o tym samym
   `(organization_id, dedupe_key)` przy `status='OPEN'` → **drugi odrzucony**
   przez unikat; po `RESOLVED` pierwszego → drugi wchodzi.
3. Test: wstawienie z `severity='BLOCKER'` (wielkie litery) → **odrzucone przez
   CHECK** (dowód, że słownik jest egzekwowany, a nie ozdobny).
4. `\d work_signals` (albo zapytanie do `information_schema`) potwierdza, że
   `organization_id` jest pierwszą kolumną każdego indeksu — dowód w raporcie.
5. Kontener i wolumeny usunięte.

### D.2 — Ledger przebiegów `work_signal_runs` + preferencja domen

**Co budujesz.** Druga migracja (kolejny wolny numer, `ls|grep` przed
utworzeniem) z:

1. Tabelą `work_signal_runs` wg projektu §4.2:
   ```
   run_id (uuid PK) · organization_id · kind (DETERMINISTIC|INTERPRETED)
   trigger (CRON|ON_DEMAND|BACKFILL) · started_at · finished_at(NULL)
   status (RUNNING|OK|PARTIAL|FAILED|SKIPPED_NO_PROVIDER|SKIPPED_DISABLED)
   rules_evaluated · signals_opened · signals_updated · signals_resolved
   errors (jsonb '[]') · ai_run_id (text NULL) · duration_ms (integer NULL)
   idx_work_signal_runs_org (organization_id, started_at DESC)
   ```
2. Kolumną `muted_domains_json text DEFAULT '[]'` dokładaną **addytywnie** do
   `my_work_signal_prefs` (`ADD COLUMN IF NOT EXISTS`). Wyciszanie całej domeny
   jest realną potrzebą przy ośmiu domenach; wyciszanie po `signal_type` przy
   ~30 typach jest bezużyteczne.

**Dlaczego to jest pozycja, a nie detal.** Bez ledgera przebiegów zdanie
„producent działa" jest **nieweryfikowalne** — dokładnie ten błąd, przez który
dzisiejszy feed przeszedł odbiór jako „backend-driven". `work_signal_runs` jest
jedynym dowodem, że silnik żyje (ryzyko R3 projektu).

**Definicja ukończenia D.2:**
1. Trzy przebiegi migracji (jak D.1), wyniki w raporcie.
2. Test kompatybilności wstecz: baza z istniejącymi wierszami
   `my_work_signal_prefs` (z kluczami `notification:<id>` w snooze/dismiss) —
   migracja przechodzi, stare wiersze czytelne, `muted_domains_json` = `'[]'`.
3. Test: `INSERT` przebiegu ze statusem spoza słownika → odrzucony przez CHECK.
4. Kontener i wolumeny usunięte.

### D.3 — Typy i słowniki TypeScript

**Co budujesz.** `server/src/types/workSignals.ts` (NOWY plik) z:

- `SignalDomainValues` / `SignalOriginValues` / `SignalStatusValues` /
  `SignalResolvedReasonValues` — jako `as const` + typy pochodne;
- **`SignalSeverity` i `SourceObjectType` IMPORTOWANE** z
  `server/src/types/executionVisibility.ts` — **nie kopiujesz wartości**
  (Z17: importujesz, nie rozszerzasz);
- `SignalEvidence = { ref, refType, version, observedValue, observedAt }`;
- `SignalAction = { kind, route, params, permission }`;
- `SignalAudience = { userId: string | null; role: string | null }`;
- `WorkSignalRow` (kształt wiersza) i `SignalDTO` (kształt odpowiedzi, §A.1);
- `SignalRule` — kontrakt reguły (§E.1).

**Wymaganie twarde:** `SignalRule` musi mieć `action(hit)` i `evidence(hit)`
jako **pola obowiązkowe**, tak żeby reguła bez destynacji albo bez dowodu **nie
przeszła kompilacji**. Kryterium `destination` i `source` z `CHAT-OWN-004` ma
być wymuszone przez kompilator, nie przez recenzję.

**Definicja ukończenia D.3:**
1. `npx esbuild server/src/types/workSignals.ts --loader:.ts=ts --outfile=/dev/null` — czysto.
2. Test typów behawioralny: plik testowy definiuje regułę **bez `action`** i jest
   oznaczony `@ts-expect-error`; test przechodzi tylko wtedy, gdy kompilator
   faktycznie protestuje. (Alternatywnie: test runtime na walidatorze rejestru
   z §E.1 — patrz tam.)
3. `grep` dowodzi, że `SignalSeverity` jest importowane z `executionVisibility.ts`,
   a nie zadeklarowane od nowa.
4. Cztery testy zachowania wg §0.4 pkt 4 (dla walidatora słowników).

---

## §E. SILNIK REGUŁ — sześć pozycji

**Cel:** reguła jest **deklaracją**, nie kodem rozsianym po trasach. Evaluator
jest **różnicujący**, nie dopisujący. Dziesięć reguł produkuje realne sygnały na
realnych danych — albo uczciwie mówi `BRAK_DANYCH`.

### E.1 — Rejestr reguł: kontrakt i walidator

**Co budujesz.** `server/src/services/signals/ruleRegistry.ts` z kontraktem
z projektu §3.2:

```ts
interface SignalRule {
  ruleId: string;                 // 'exec.task.overdue'
  ruleVersion: number;            // bump = nowa tożsamość reguły
  domain: SignalDomain;
  signalType: string;
  severity: SignalSeverity | ((hit: RuleHit) => SignalSeverity);
  subjectType: SourceObjectType;
  evaluate(ctx: RuleContext): Promise<RuleHit[]>;   // ZAWSZE org-scoped; ctx wstrzykuje organizationId
  dedupeKey(hit: RuleHit): string;                  // stabilny między przebiegami
  evidence(hit: RuleHit): SignalEvidence[];         // OBOWIĄZKOWE
  action(hit: RuleHit): SignalAction;               // OBOWIĄZKOWE — jedna kanoniczna destynacja
  audience(hit: RuleHit): SignalAudience;           // D3=B: {userId|null, role|null}
  maxPerRunPerOrg: number;                          // domyślnie 25
  minSeverityToSurface: SignalSeverity;
  ttlHours?: number;
}
```

**Rozstrzygnięcia, których nie zmieniasz:**
- **Reguła nigdy nie pisze do tabel dziedzinowych.** Czyta i zwraca trafienia.
  Zapis jest **wyłącznie** w evaluatorze. To eliminuje ryzyko, że silnik
  sygnałów „naprawi" dane klienta.
- **`ruleVersion` jest częścią tożsamości.** Zmiana progu = bump wersji = stare
  sygnały domykane jako `SUPERSEDED`. Bez tego nie da się odpowiedzieć „dlaczego
  wczoraj był, dziś nie ma".
- **`ctx.organizationId` pochodzi z pętli evaluatora**, nigdy z żądania.
  `RuleContext` **nie ma** dostępu do obiektu żądania — to jest wymóg typu.

Do tego **walidator rejestru** (`validateRuleRegistry(rules)`), sprawdzany
w teście i przy starcie evaluatora: unikalność `ruleId`, `maxPerRunPerOrg > 0`,
`domain` ze słownika, obecność `action`/`evidence`/`audience`/`dedupeKey`.

**Definicja ukończenia E.1:**
1. Test: rejestr z dwiema regułami o tym samym `ruleId` → walidator rzuca.
2. Test: reguła z `maxPerRunPerOrg = 0` → walidator rzuca.
3. Test: reguła z `domain` spoza słownika → walidator rzuca.
4. Test happy: rejestr 10 reguł przechodzi walidację i zwraca 10 pozycji
   (po §E.3–§E.6; w commicie E.1 wystarczy fixture 1 reguły).
5. Dowód typu: reguła bez `action` nie kompiluje się (`@ts-expect-error`).

### E.2 — Evaluator różnicujący

**Co budujesz.** `server/src/services/signals/signalEvaluator.ts`. Algorytm
jednego przebiegu, **per organizacja**, dokładnie wg projektu §3.3:

1. Wczytaj otwarte sygnały org: `WHERE organization_id = $1 AND status = 'OPEN'`.
2. Dla każdej **włączonej** reguły uruchom `evaluate()` w jej oknie czasowym.
3. Zbuduj mapę trafień po `dedupe_key`.
4. **Różnica, nie append:**
   - klucz w trafieniach, brak w otwartych → `INSERT` (`first_observed_at = now`);
   - klucz w obu → `UPDATE last_observed_at`, `severity`, `evidence`, `run_id`;
   - klucz w otwartych, brak w trafieniach → `RESOLVED`,
     `resolved_reason = 'CONDITION_CLEARED'`;
   - zmienił się `rule_version` → `SUPERSEDED`.
5. Zastosuj `maxPerRunPerOrg` (sortowanie po `severity`, potem po
   `first_observed_at`).
6. Zapisz wiersz do `work_signal_runs` (liczby otwartych/zaktualizowanych/
   domkniętych, czas, błędy).

**★ Odporność — to jest sedno pozycji, nie dodatek.** Błąd jednej reguły:
- jest łapany **na poziomie reguły**,
- zapisywany do `work_signal_runs.errors` z `ruleId` i komunikatem,
- **nie przerywa przebiegu** pozostałych reguł,
- **ale przerywa różnicowanie dla tej jednej reguły** — jej otwarte sygnały
  **zostają otwarte**, nie są fałszywie domykane.

**Cicha porażka nie może wyglądać jak „warunek ustał".** To bezpośredni zakaz
powtórki wzorca z `signals.routes.ts:259` (błąd połknięty, feed cicho pusty).
Przebieg z ≥1 błędem reguły kończy się statusem **`PARTIAL`**, nie `OK`.

**Definicja ukończenia E.2:**
1. **Idempotencja (test na realnym PG):** dwa przebiegi z rzędu na tych samych
   danych → identyczny zbiór `(dedupe_key, status)`; liczba wierszy bez zmian;
   `signals_opened` drugiego przebiegu = 0.
2. **Auto-resolve (test na realnym PG):** dane spełniają warunek → sygnał
   `OPEN`; dane zmienione tak, że warunek ustaje → kolejny przebieg ustawia
   `RESOLVED` + `resolved_reason='CONDITION_CLEARED'` + `resolved_at`.
3. **Supersede:** bump `ruleVersion` → stary sygnał `SUPERSEDED`, nowy `OPEN`.
4. **Izolacja błędu:** reguła rzucająca wyjątek → przebieg `PARTIAL`, wpis
   w `errors` z jej `ruleId`, **sygnały tej reguły nadal `OPEN`**, sygnały
   pozostałych reguł przetworzone normalnie.
5. **Limit:** reguła zwracająca 100 trafień przy `maxPerRunPerOrg=25` → 25
   wierszy, wybrane wg `severity` malejąco, potem `first_observed_at` rosnąco.
6. **Negatyw tenanta:** przebieg dla org A nie tworzy, nie modyfikuje i nie
   domyka **ani jednego** wiersza org B (dowód: snapshot przed/po dla org B).

### E.3 — Cztery reguły EXECUTION

`exec.task.overdue` · `exec.task.due_soon_not_started` · `exec.task.blocked_stale` ·
`exec.initiative.no_baseline`.

**Co budujesz.** `server/src/services/signals/rules/execution/*.ts` — cztery
pliki, każdy eksportujący jedną `SignalRule`. Każda:
- czyta wyłącznie dane tenanta z `ctx.organizationId`;
- ma `evidence()` wskazujące **rekord (typ + id) i zmierzoną wartość**
  (np. `{ ref: taskId, refType: 'task', version: null, observedValue: 12, observedAt }`
  gdzie `12` = liczba dni po terminie);
- ma `action()` z **jedną kanoniczną destynacją** (`route` do realnego ekranu
  obiektu + `permission` wymagane do jej otwarcia);
- ma `audience()` wg **D3=B**: właściciel/wykonawca rekordu → `userId`;
  sygnał bez naturalnego właściciela → `userId: null` + `role` (np.
  `PROJECT_MANAGER`) albo `role: null` dla całej organizacji;
- ma `dedupeKey()` **stabilny między przebiegami** — zbudowany z `ruleId` +
  `subjectId` (i ewentualnie kubełka czasu, ale **nigdy** z `now()`).

**Adapter do `v8_execution_signals` należy do §X.1**, nie tutaj — tu skupiasz
się na poprawności reguły.

**Definicja ukończenia E.3 (dla KAŻDEJ z czterech reguł osobno):**
1. **Trafienie:** fixture na realnym PG z rekordem spełniającym warunek →
   dokładnie 1 sygnał, z poprawnym `signal_type`, `severity`, `subject_*`,
   `evidence[0].observedValue`, `action.route` i `audience`.
2. **Nietrafienie:** fixture z rekordem tuż poza progiem → **0 sygnałów**
   (dowód, że reguła nie jest „zawsze prawdziwa").
3. **Auto-resolve:** zmiana rekordu tak, by warunek ustał → sygnał `RESOLVED`.
4. **Negatyw tenanta:** identyczny rekord w org B → przebieg org A go nie widzi.
5. **`dedupeKey` stabilny:** dwa przebiegi → ten sam klucz (test asertuje
   równość, nie „istnienie").
6. Jeżeli źródło danych okazało się inne niż w projekcie — wpis w „Korektach"
   z podaniem faktycznej tabeli/kolumny. Jeżeli źródła nie ma —
   `BRAK_DANYCH` + STOP dla tej jednej reguły.

### E.4 — Dwie reguły DECISION

`dec.pending_stale` · `dec.blocking_dependents`.

DoD identyczne jak E.3, plus:
- `dec.blocking_dependents` **musi** nieść w `evidence[]` **listę blokowanych
  obiektów** (min. jeden `ref`), bo bez tego „blokuje ≥1 obiekt" jest opinią,
  nie dowodem (test dowodu z §2 projektu).
- `audience()` dla decyzji klienta: `userId: null`, `role` = rola decyzyjna
  (znormalizowana, pułapka 5). **To jest sedno D3=B** — sygnał „decyzja klienta
  wisi 8 dni i blokuje 3 zadania" nie ma naturalnego `user_id` i to była
  przyczyna, dla której dzisiejszy osobisty model wyprodukował pusty feed.

### E.5 — Dwie reguły RESULTS (KPI)

`res.kpi_threshold_breached` · `res.roi_confidence_dropped`.

DoD identyczne jak E.3, plus:
- **`v8_kpi_signals` jest ŹRÓDŁEM, nie duplikatem.** Ma realnego producenta
  (`resultsROIService`) i własne endpointy Results. Reguła **czyta** z niej
  i **nie pisze** do niej. Zapis do `v8_kpi_signals` = STOP.
- `res.roi_confidence_dropped` wymaga porównania **dwóch odczytów w czasie**
  (spadek pewności). Jeśli w bazie nie ma historii pewności prognozy —
  `BRAK_DANYCH` + STOP dla tej jednej reguły z opisem, jakiego pola brakuje.
  **Nie budujesz historii „przy okazji"** — to cudzy moduł.

### E.6 — Dwie reguły FINANCE

`fin.budget_overspend` · `fin.benefit_not_realized`.

DoD identyczne jak E.3, plus:
- `fin.budget_overspend` czyta `budget_overspend_signals` (potwierdź w Bloku 0);
  `evidence[]` niesie **kwotę przekroczenia i budżet**, nie samo „przekroczono".
- `fin.benefit_not_realized` = korzyść po terminie realizacji bez potwierdzenia.
  Inwentarz źródeł (§2.2) rozstrzyga, która tabela z rodziny `benefit_*` jest
  właściwa. **Werdykt inwentarza idzie do raportu niezależnie od wyniku.**

---

## §S. PIPELINE PRODUKCJI — trzy pozycje

**Cel:** producent **żyje** i da się to udowodnić. Rozstrzygnięcie projektu §3.4
jest wiążące: **batch, nie real-time** (sygnał jest stanem; real-time wymagałby
haków w każdym zapisie każdego modułu — to dokładnie ten dług, który wytworzył
~43 dzikie emisje notyfikacji).

### S.1 — Harmonogram deterministyczny + kill-switch

**Co budujesz.**
1. `server/src/jobs/workSignalProducerJob.ts` (NOWY) — wejście `runDeterministicTick()`:
   iteracja po **aktywnych organizacjach**, budżet czasu na organizację, wywołanie
   evaluatora, zapis przebiegu.
2. Flaga `ENABLE_SIGNAL_PRODUCER` w `FeatureFlags.ts` (licencja L1),
   `z.boolean().default(false)`.
3. Rejestracja w `Scheduler.ts` (licencja L2) — **jeden** blok
   `cron.schedule('*/15 * * * *', …)`, wzorem job7b (`:204-221`), z dynamicznym
   `await import('../jobs/workSignalProducerJob.js')` **wewnątrz** callbacku.

**★ Kill-switch sprawdzasz WEWNĄTRZ callbacku** (pułapka 12). Wyłączona flaga
oznacza: przebieg startuje, natychmiast kończy się statusem `SKIPPED_DISABLED`
w `work_signal_runs`, **zero zapisów do `work_signals`**. Job zarejestrowany
warunkowo (czyli nieobecny w procesie) = **odrzucenie pozycji**, bo nie da się
udowodnić, że mechanizm istnieje.

**Definicja ukończenia S.1:**
1. Test z **wstrzykniętą atrapą `schedule`** (`Scheduler.ts:77`, **bez dotykania
   globalnego mocka `node-cron`** — Z18): rejestracja zawiera dokładnie jeden
   nowy wpis z wyrażeniem `*/15 * * * *`.
2. Test: flaga OFF → wywołanie callbacku tworzy przebieg `SKIPPED_DISABLED`
   i **0 wierszy** w `work_signals`.
3. Test: flaga ON → callback woła evaluator dla każdej aktywnej organizacji
   (asercja na liczbie wywołań i na `organization_id` przekazanym w `ctx`).
4. Test: organizacja, dla której evaluator rzuca → przebieg tej organizacji
   `FAILED`/`PARTIAL`, **pozostałe organizacje przetworzone** (błąd jednej org
   nie zabija ticku).
5. Negatyw tenanta: przebieg org A nie dotyka wierszy org B.

### S.2 — Odświeżenie na żądanie z throttlem

**Co budujesz.** Endpoint on-demand uruchamiający przebieg dla **jednej**
organizacji (tej z tokenu), z throttlem **min. 60 s od ostatniego przebiegu tej
organizacji**. Spełnia kryterium „refresh reads canonical data" z `CHAT-OWN-004`.

**Wymagania twarde:**
1. `organizationId` **wyłącznie z tokenu**. Parametr `organizationId` w body/query
   jest ignorowany — a jeśli podany i różny od tokenowego, odpowiedź to `400`,
   nigdy przebieg dla obcej organizacji.
2. Throttle liczony z `work_signal_runs` (ostatni `started_at` dla tej org
   i `kind='DETERMINISTIC'`), nie z pamięci procesu.
3. Odpowiedź przy throttlingu: `429` z `retryAfterSeconds`, **nie** ciche `200`.
4. Flaga OFF → `SKIPPED_DISABLED` + odpowiedź mówiąca wprost, że producent jest
   wyłączony (front ma móc odróżnić „wyłączony" od „brak sygnałów").

**Definicja ukończenia S.2:**
1. Test happy: pierwsze wywołanie → `200`, nowy wiersz w `work_signal_runs`.
2. Test throttle: drugie wywołanie w ciągu 60 s → `429`, **bez** nowego wiersza.
3. Test negatywu tenanta: token org A + `organizationId` org B w body → `400`,
   zero przebiegów dla org B.
4. Test flagi OFF → `SKIPPED_DISABLED`, zero zapisów do `work_signals`.
5. Test braku członkostwa → `403` (nie `200` z pustą listą — Z15).

### S.3 — Ledger przebiegów jako dowód życia + alarm

**Co budujesz.** Warstwę zapisu `work_signal_runs` wywoływaną przez **każdy**
przebieg (cron i on-demand, deterministyczny i interpretacyjny), oraz wywołanie
`systemAlertNotifier` przy statusie `FAILED`.

**Wymagania twarde:**
1. **Każdy** przebieg zostawia wiersz — także `SKIPPED_DISABLED`
   i `SKIPPED_NO_PROVIDER`. Przebieg bez wiersza = przebieg, którego nie było.
2. `errors` to **lista obiektów** `{ ruleId, message, at }`, nie sklejony string.
3. `duration_ms` wypełniane zawsze.
4. **Zakaz cichego `catch`.** Każdy `catch` w tej ścieżce albo zapisuje do
   `errors` i podnosi status do `PARTIAL`/`FAILED`, albo re-throwuje. `catch`
   kończący się samym `logger.error` = odrzucenie pozycji (to jest dosłownie
   defekt `signals.routes.ts:259`, który naprawiasz).
5. Alarm przy `FAILED` przez `systemAlertNotifier` (WOŁASZ, nie zmieniasz).

**Definicja ukończenia S.3:**
1. Test: przebieg OK → wiersz ze statusem `OK`, niezerowe `rules_evaluated`,
   `duration_ms > 0`.
2. Test: przebieg z błędem jednej reguły → `PARTIAL`, `errors` zawiera wpis
   z `ruleId`.
3. Test: przebieg, który wywalił się globalnie → `FAILED` + **wywołanie**
   `systemAlertNotifier` (asercja na wywołaniu, mock lokalny).
4. Test: flaga OFF → `SKIPPED_DISABLED`.
5. **Test antyregresyjny na cichy catch:** przebieg, w którym zapytanie reguły
   rzuca — asercja, że status **nie jest** `OK`. (To jest test na wzorzec
   porażki, nie na implementację.)

---

## §A. API FEEDU — cztery pozycje

**Cel:** feed czyta **kanoniczne dane sygnałów**, nigdy `notifications`; jest
odfiltrowany po organizacji **z tokenu** i po roli; każdy sygnał niesie
`source`, `freshness`, `severity` i `destination` (cztery kryteria
`CHAT-OWN-004`).

### A.1 — `GET /api/signals` — kanoniczny read model

**Co budujesz.** `server/src/routes/signals.routes.ts` (NOWY) zamontowany
**jedną linią** w `Gateway.ts` (licencja L3):

```
app.use('/api/signals', gatewayVerifyToken, orgMembershipGuard, signalsFeedRoutes);
```

Parametry: `projectId?`, `domain?`, `severityMin?`, `origin?`,
`limit` (domyślnie 50, max 200), `cursor?`.

**Filtr — dokładnie taki i w tej kolejności:**
```sql
WHERE organization_id = $orgFromToken          -- ZAWSZE, z tokenu, nigdy z żądania
  AND status = 'OPEN'
  AND (audience_user_id IS NULL OR audience_user_id = $userId)
  AND (audience_role   IS NULL OR UPPER(audience_role) = ANY($normalizedUserRoles))
```

**Kształt odpowiedzi (`SignalDTO`) — superset, nie zamiana** (projekt §5.2):

```
// zgodność wstecz z dzisiejszym panelem (ChatSignalsPanel.tsx:144-155):
key · type · title · body · severity('INFO'|'WARNING'|'CRITICAL') · createdAt
projectId · projectName · entityType · entityId
// nowe pola wymagane przez CHAT-OWN-004:
domain · origin
severityRaw ('info'|'warning'|'critical'|'blocker')      ← pułapka 4; nazwę zatwierdzasz w raporcie
source { evidence[], ruleId, ruleVersion }               ← „skąd wiadomo"
freshness { lastObservedAt, runAt, nextRunAt|null }      ← „jak świeże"
destination { kind, route, params, permission, allowed } ← „gdzie to rozwiązać"
provenance? {...}                                        ← wyłącznie origin='INTERPRETED' (§W)
isMine (boolean)                                          ← D3=B: sprawy własne wyróżnione
titleKey · titleParams · bodyKey · bodyParams             ← surowe klucze dla frontu (DEC-20)
firstObservedAt · status
```

**Wymagania twarde:**
1. **`severity` legacy mapowane**: `blocker → 'CRITICAL'`, reszta na wielkie
   litery. Pełna wartość w `severityRaw`. Panel frontowy działa **bez zmian**.
2. **`destination.allowed` liczone po stronie serwera** — jeśli użytkownik nie
   ma uprawnienia do celu, akcja ma być renderowalna jako wyłączona
   z wyjaśnieniem, nie jako martwy klik. Uprawnienie sprawdzasz **odczytem**
   przez istniejące mechanizmy; **zmiana `effectiveAccessService` = STOP (Z16)**.
   Jeśli odczyt uprawnienia nie jest możliwy bez zmiany tego serwisu — zwracasz
   `allowed: null` i **wpisujesz STOP z opisem**, nigdy `allowed: true` na wiarę.
3. **`isMine`** = `audience_user_id === userId`. Nic więcej — wyróżnienie
   wizualne to front.
4. **Preferencje użytkownika respektowane w odczycie**: `muted_types_json`,
   `muted_domains_json`, snooze (`snoozed_until > now`), dismissals.
5. **Paginacja kursorowa** stabilna (`last_observed_at DESC, signal_id`), bez
   `OFFSET`.
6. **★ Rozwijanie kluczy i18n po stronie serwera z WŁASNEGO słownika.**
   `public/locales/**` należy do frontu (Z17) — tworzysz
   `server/src/services/signals/i18n/` z parami PL/EN dla wszystkich swoich
   `title_key`/`body_key`. **PL wiodące** (`DEC-20`). Brak klucza w słowniku →
   `title` = `title_key` (widoczna, uczciwa awaria), **nigdy** pusty string.
   Locale bierzesz z nagłówka żądania; domyślne `pl`.

**Definicja ukończenia A.1:**
1. **Test HTTP na realnym routerze** (supertest, jak istniejący strażnik
   izolacji): `200` z listą, wszystkie pola DTO obecne.
2. **Negatyw cross-org:** wiersze org B nie wychodzą w odpowiedzi dla tokenu
   org A — nawet gdy `audience_user_id` jest ten sam użytkownik.
3. **Negatyw cross-role:** sygnał z `audience_role='PROJECT_MANAGER'` nie
   wychodzi dla użytkownika o roli `MEMBER`; wychodzi po zmianie roli. Test
   pokrywa **warianty wielkości liter** (pułapka 5).
4. **Negatyw źródła roli:** `?role=PROJECT_MANAGER` w query **nie zmienia**
   wyniku (rola tylko z tokenu/członkostwa).
5. **Brak członkostwa → `403`**, nie `200` z pustą listą (Z15).
6. **Pusty stan:** organizacja bez sygnałów → `200` z `signals: []`.
7. **Zgodność wstecz:** odpowiedź waliduje się względem dzisiejszego typu panelu
   (test asertuje obecność i typ dziesięciu pól legacy oraz że `severity`
   nigdy nie ma wartości `'BLOCKER'`).
8. Test na realnym PG dla filtra i paginacji.

### A.2 — Przemapowanie `GET /my-work/signals` + usunięcie martwego kodu

**Co budujesz.** Endpoint **zostaje pod tym samym adresem** (panel Chatu go
zna), ale jego ciało zostaje wymienione:

1. Zamiast `SELECT … FROM notifications` (`signals.routes.ts:155`) woła **nowy
   read model** i mapuje na `SignalDTO`.
2. **Usuwasz** filtr podłańcuchowy `isAiSignalNotification` (`:41-46`).
3. **Usuwasz** blok predykcyjny (`:206-259`) — martwy na Postgresie
   (SQLite `datetime()`), z cichym `catch`, z niezgodnym polem `message` vs `body`.
4. **Odczyt feedu NIGDY nie sięga do `notifications`.** Po tej pozycji
   `grep -n "FROM notifications" server/src/routes/my-work/signals.routes.ts`
   w ścieżce odczytu feedu jest pusty (mutacje z §A.3 mogą jeszcze walidować
   stary klucz — patrz tam).

**Domyślne rozstrzygnięcie pozycji otwartej nr 1 (§1.7):** endpoint zwraca
**cały feed organizacyjny z filtrem roli**, tak samo jak `/api/signals`, z `isMine`.
Jeśli nadzorca zdecyduje inaczej — STOP z propozycją.

**Definicja ukończenia A.2:**
1. Test HTTP: `GET /my-work/signals` zwraca dane z `work_signals`, nie
   z `notifications` (fixture: powiadomienie z „AI" w typie **nie** pojawia się
   w feedzie; sygnał z `work_signals` **pojawia się**).
2. **Strażnik izolacji zielony** — patrz §T.1.
3. Negatyw cross-org i cross-role (jak A.1).
4. Pusty stan `200` + `signals: []`; brak członkostwa `403`.
5. `grep` dowodzi usunięcia `isAiSignalNotification` i bloku predykcyjnego
   (grep to **dowód usunięcia**, nie dowód działania — dowodem działania są
   testy 1–4).

### A.3 — Mutacje preferencji na nowej postaci klucza

**Co budujesz.** `POST /signals/mute-type`, `POST /signals/:key/snooze`,
`POST /signals/:key/dismiss` **zostają** — zmienia się tylko postać klucza
(`signal_key` = `work_signals.signal_id` zamiast `notification:<id>`) i dochodzi
**wyciszanie domeny** (`muted_domains_json` z §D.2).

**Wymagania twarde:**
1. **Walidacja własności klucza**: `signal_id` musi należeć do organizacji
   z tokenu **i** być adresowany do tego użytkownika lub jego roli — inaczej
   `404` (nie `403`, żeby nie potwierdzać istnienia cudzego sygnału) i **zero
   zapisów**. To dokładnie kontrakt, którego pilnuje istniejący strażnik.
2. **Stare klucze `notification:<id>` współistnieją** — nie migrujesz ich
   bezwarunkowym `UPDATE` (zakaz §0.3). Wygasają naturalnie
   (`snoozed_until`). Klucz nierozpoznany → `404`, nigdy `500`.
3. **Wyciszenie domeny** działa w odczycie (§A.1 pkt 4) — test dowodzi, że
   sygnał wyciszonej domeny znika z feedu, a innej domeny zostaje.

**Definicja ukończenia A.3:**
1. Happy: snooze/dismiss/mute-type/mute-domain zapisuje i odczyt feedu to
   respektuje (readback z bazy, nie z pamięci).
2. Negatyw cross-org: klucz sygnału org B → `404`, zero zapisów.
3. Negatyw cross-role: klucz sygnału adresowanego do innej roli → `404`.
4. Stary klucz `notification:<id>` → obsłużony bez `500`.
5. Pusty/nieznany klucz → `404`.

### A.4 — Pakiet negatywów cross-org i cross-role

**Co budujesz.** Osobny, jawny plik testowy (nie rozproszony po pozycjach)
dowodzący izolacji na **realnym routerze**:

| # | Scenariusz | Oczekiwane |
| --- | --- | --- |
| 1 | Użytkownik w dwóch organizacjach, token org A, sygnały w obu | tylko org A |
| 2 | Sygnał `audience_user_id` = ten sam user, ale org B | niewidoczny |
| 3 | Sygnał `audience_role='ADMIN'`, użytkownik `MEMBER` | niewidoczny |
| 4 | Sygnał `audience_role='admin'` (małe litery w bazie), użytkownik `ADMIN` | **widoczny** (normalizacja, pułapka 5) |
| 5 | `?organizationId=<org B>` w query przy tokenie org A | ignorowane albo `400`; **nigdy** dane org B |
| 6 | `?role=ADMIN` w query przy roli `MEMBER` w tokenie | ignorowane; wynik jak dla `MEMBER` |
| 7 | Brak członkostwa w organizacji z tokenu | `403` |
| 8 | Snooze/dismiss na kluczu org B | `404` + zero zapisów |
| 9 | Przebieg on-demand z `organizationId` org B w body | `400` + zero przebiegów org B |
| 10 | Sygnał `audience_user_id=NULL, audience_role=NULL` | widoczny dla **każdego** członka org (D3=B) |

**Definicja ukończenia A.4:** wszystkie dziesięć scenariuszy zielone na realnym
routerze (supertest) i na realnym PG dla scenariuszy zapisu; wynik w tabeli
raportu. Scenariusz, którego nie da się odtworzyć — STOP z opisem, nigdy
pominięcie.

---

## §W. WARSTWA AI `INTERPRETED` — trzy pozycje, wszystkie za flagą OFF

**Cel (`DEC-89` D2 = B + `DEC-40` + `DEC-51`):** warstwa powstaje **teraz**,
jest **kompletna i otestowana**, i jest **wyłączona**. Nie szkielet z TODO —
działający kod, który przy `ENABLE_SIGNAL_INTERPRETER=false` nie robi **nic**,
a przy braku providera odmawia działania **głośno i uczciwie**.

**Zasada nienaruszalna (projekt §2.3):** warstwa `INTERPRETED` **nigdy nie tworzy
faktu**. Wolno jej łączyć, priorytetyzować i nazywać wzorzec w zbiorze faktów,
które już istnieją jako sygnały deterministyczne. Model „zauważający" coś,
czego nie ma w żadnym sygnale deterministycznym, jest halucynacją i jest
odrzucany przez gate rodowodu.

### W.1 — Flaga i fail-closed przy braku providera

**Co budujesz.**
1. Flaga `ENABLE_SIGNAL_INTERPRETER` w `FeatureFlags.ts` (licencja L1),
   `z.boolean().default(false)`, z **realnym czytelnikiem** w ścieżce przebiegu
   interpretacyjnego.
2. Rejestracja drugiego jobu w `Scheduler.ts` (licencja L2): `'0 5 * * *'`
   (raz na dobę), kill-switch **wewnątrz** callbacku.
3. **Sonda providera** wzorem `ai.routes.ts:355-368`: brak skonfigurowanego
   providera → przebieg kończy się statusem **`SKIPPED_NO_PROVIDER`**
   w `work_signal_runs`, **zero sygnałów `INTERPRETED`**, zero sygnałów
   zastępczych, zero „AI zauważyło" bez AI.
4. **Próg wejścia:** przebieg uruchamia się **wyłącznie** dla organizacji
   mających **≥5 otwartych sygnałów deterministycznych**. Brak sygnałów → brak
   wywołania AI → brak kosztu.

**★ Twoje środowisko nie ma klucza AI i to jest stan projektowany.** Wszystkie
testy tej sekcji robisz **z mockiem `llmService` lokalnie w swoim pliku**
(Z18: nigdy globalny mock `llmApi`). Wywołanie na żywo = `STOP-BRAK_API`.

**Definicja ukończenia W.1:**
1. Test: flaga OFF → przebieg `SKIPPED_DISABLED`, **zero** wywołań `llmService`
   (asercja na mocku), zero wierszy `origin='INTERPRETED'`.
2. Test: flaga ON + brak providera → `SKIPPED_NO_PROVIDER`, zero wywołań, zero
   wierszy.
3. Test: flaga ON + provider + organizacja z 4 otwartymi sygnałami → **brak
   wywołania** (próg ≥5).
4. Test: flaga ON + provider + organizacja z 6 sygnałami → dokładnie jedno
   wywołanie providera.
5. Negatyw tenanta: przebieg org A nie czyta sygnałów org B (asercja na
   zawartości wejścia przekazanego do mocka).

### W.2 — Gate rodowodu

**Co budujesz.** Bramkę zapisu sygnału `INTERPRETED`, będącą **kopią wzorca**
z `aiEvidenceGovernance.ts:80-90` (kopiujesz wzorzec do swojego modułu —
**nie zmieniasz tamtego pliku**, Z17). Odrzucenie zapisu, jeśli brakuje
któregokolwiek:

- `evidenceRefs` = lista `signalId` sygnałów **deterministycznych**, **min. 2**
  (poniżej dwóch to nie synteza, tylko przepisanie);
- **każdy** `signalId` z `evidenceRefs` istnieje, jest `OPEN`, należy do **tej
  samej organizacji** i ma `origin='DETERMINISTIC'`;
- `inputHash` = `aiInputHash(wejście)` (funkcję **importujesz**);
- `model {provider, model, version}`, `prompt {promptId, version}`,
  `template {templateId, version}`;
- `confidence` ∈ `HIGH|MEDIUM|LOW` — `UNKNOWN` odrzucane.

**Bramka jest wyjątkiem, nie ostrzeżeniem z logiem.** Walidacja „miękka" =
odrzucenie pozycji.

**Definicja ukończenia W.2:**
1. Test: wyjście modelu z 1 `evidenceRef` → **wyjątek**, zero zapisów.
2. Test: `evidenceRef` wskazujący sygnał **innej organizacji** → wyjątek, zero
   zapisów. (To jest najostrzejszy negatyw tej sekcji.)
3. Test: `evidenceRef` wskazujący sygnał `INTERPRETED` (łańcuch AI→AI) →
   wyjątek.
4. Test: `confidence='UNKNOWN'` → wyjątek.
5. Test happy: pełny rodowód + 2 poprawne `evidenceRefs` → wiersz zapisany
   z `origin='INTERPRETED'`, `provenance` niepusty, `source_signal_ids`
   zawiera oba id.

### W.3 — Przebieg interpretacyjny: wejście, limit, koszt

**Co budujesz.**
1. **Kontrakt wejścia — wyłącznie** otwarte sygnały deterministyczne danej
   organizacji, znormalizowane do
   `{signalId, type, severity, subjectType, subjectId, observedValue, firstObservedAt}`.
   **Do modelu nie trafiają treści konwersacji, dokumentów ani danych
   osobowych.** To jest jednocześnie decyzja o prywatności i o koszcie.
2. **Kontrakt wyjścia — maksymalnie 3 sygnały `INTERPRETED` na organizację na
   dobę.** Limit egzekwowany, nie sugerowany.
3. **Model: tier `BUDGET`** (`llmConfigService.ts:99/:116/:240`), wołany przez
   `llmService`. Uzasadnienie z projektu: zadanie jest klasyfikacyjno-syntetyczne
   na małym, ustrukturyzowanym wejściu; tier `PREMIUM` byłby 25–40× droższy bez
   dowodu lepszej syntezy.
4. **Budżet i ledger:** sprawdzenie budżetu przez `aiBudgetService` **przed**
   wywołaniem; identyfikator przebiegu AI zapisany w `work_signal_runs.ai_run_id`.
   **`aiRunLedgerService` jest action-centric** (pułapka 10) — jeśli nie ma
   generycznego wejścia dla przebiegu spoza „action", **NIE przerabiasz go**:
   zapisujesz koszt w `work_signal_runs` i wpisujesz **STOP z propozycją**
   rozszerzenia ledgera jako osobnej pozycji dla nadzorcy.
5. **Sygnały `INTERPRETED` podlegają tym samym regułom cyklu życia** co
   deterministyczne: mają `dedupe_key`, wygasają (`ttlHours` / `expires_at`),
   i są domykane, gdy **którykolwiek** z ich sygnałów źródłowych przestaje być
   `OPEN` (`resolved_reason='SUPERSEDED'`). Sygnał AI oparty na nieistniejących
   już faktach jest kłamstwem (ryzyko R2 + R7).

**Definicja ukończenia W.3:**
1. Test: wejście przekazane do mocka providera **nie zawiera** żadnego pola
   spoza kontraktu wejścia (asercja na kluczach obiektu) — w szczególności
   zero treści tekstowych z konwersacji/dokumentów.
2. Test: model zwraca 5 propozycji → zapisane **3**, dwie odrzucone przez limit.
3. Test: budżet wyczerpany → **zero wywołań** providera, przebieg zakończony
   uczciwym statusem, wpis w `errors`.
4. Test cyklu życia: sygnał źródłowy przechodzi w `RESOLVED` → sygnał
   `INTERPRETED` na nim oparty przechodzi w `SUPERSEDED` przy kolejnym przebiegu.
5. Negatyw tenanta: wejście dla org A nie zawiera **ani jednego** sygnału org B.
6. Test idempotencji: dwa przebiegi tej samej doby → **brak duplikatów**
   (`dedupe_key` działa również dla `INTERPRETED`).

---

## §X. ZASILENIE DRUGIEJ RURY I SPRZĄTANIE — dwie pozycje

### X.1 — Adapter do `v8_execution_signals` (żeby My Work Home zaczął widzieć realne dane)

**Co budujesz.** Reguły domeny EXECUTION, po zapisie do `work_signals`, wołają
**dodatkowo** `emitSignal` (`executionVisibilityService.ts:182`), tak żeby
`rollupSignals` (`:674`) — czytany przez My Work Home — zaczął zwracać realne
liczby zamiast zera.

**Wymagania twarde:**
1. **`executionVisibilityService.ts` nietknięty** — wołasz, nie zmieniasz (Z17).
   Zmiana sygnatury albo zachowania `emitSignal` = STOP.
2. **`rollupSignals` bez zmiany kontraktu** — My Work Home nie może zauważyć
   niczego poza tym, że liczby przestały być zerami (ryzyko R12).
3. **Idempotencja po stronie adaptera**: powtórny przebieg nie mnoży wierszy
   w `v8_execution_signals`. Jeśli `emitSignal` nie ma własnej deduplikacji —
   adapter woła go **tylko przy przejściu sygnału w `OPEN`** (nowy `INSERT`),
   nie przy każdym `UPDATE last_observed_at`.
4. **Awaria adaptera nie wywraca przebiegu**: błąd `emitSignal` → wpis do
   `errors`, status `PARTIAL`, `work_signals` **zapisane poprawnie**. Kolejność
   ma znaczenie: kanoniczny zapis pierwszy, adapter drugi.
5. Mapowanie `signal_type` na 13 zamrożonych wartości
   (`executionVisibility.ts:22-36`) — **bez rozszerzania enuma**. Reguła, dla
   której nie ma odpowiednika w tym słowniku, **nie jest adaptowana** (wpis
   w raporcie), a jej sygnał kanoniczny i tak powstaje.

**Definicja ukończenia X.1:**
1. Test na realnym PG: przebieg z regułą EXECUTION → wiersz w `work_signals`
   **i** wiersz w `v8_execution_signals`.
2. Test idempotencji: dwa przebiegi → jeden wiersz w `v8_execution_signals`.
3. Test: `rollupSignals` dla tej organizacji zwraca niezerowy agregat.
4. Test: `emitSignal` rzuca → `work_signals` zapisane, przebieg `PARTIAL`,
   wpis w `errors`.
5. Negatyw tenanta: sygnał org A nie pojawia się w rollupie org B.

### X.2 — Sprzątanie martwego kodu

**Co budujesz (i czego NIE ruszasz):**

| Byt | Decyzja | Uzasadnienie |
| --- | --- | --- |
| Filtr `isAiSignalNotification` (`signals.routes.ts:41-46`) | **usunięty** w §A.2 | „sygnał" przestaje być napisem w kolumnie `type` |
| Blok predykcyjny (`signals.routes.ts:206-259`) | **usunięty** w §A.2 | martwy na PG, cichy `catch`, niezgodne pole |
| `server/src/services/aiNotificationTriggers.ts` | **NIE RUSZASZ** | ma jeszcze jednego callera (`POST /api/ai/trigger-notification`); kasowanie = zmiana cudzej trasy. Wpis w „Znaleziskach" |
| `automated_insights` (tabela) | **wpis w „Znaleziskach"** jako `HISTORICAL` | zero zapisów i zero odczytów w `server/src` — potwierdź `grep`-em; **nie kasujesz tabeli** (zakaz `DROP`) |
| `v8_kpi_signals`, `v8_radar_triage_signals` | **bez zmian** | pierwsza to źródło (§E.5), druga poza zakresem fali 1 |
| `MODULE_ACCEPTANCE.md` 13_CHAT | aktualizacja `CHAT-OWN-004` do stanu faktycznego (§R.1) | jedyny dokument poza raportem, który wolno zmienić |

**Definicja ukończenia X.2:**
1. `grep` potwierdza usunięcie dwóch bytów z §A.2 (dowód usunięcia).
2. `grep -rn "automated_insights" server/src` — wynik w raporcie jako dowód
   martwoty (albo zaprzeczenie, jeśli znajdziesz czytelnika — wtedy wpis
   „Korekta").
3. Testy §A.2 zielone (dowód, że usunięcie niczego nie zepsuło).
4. `git diff` pokazuje **zero** zmian w `aiNotificationTriggers.ts`.

---

## §T. TESTY — cztery pozycje

### T.1 — Jedyny dopuszczalny sposób potraktowania istniejącego strażnika

`server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts`
(219 linii) dowodzi izolacji na **dzisiejszym** źródle (`notifications`,
mockowana warstwa DB). Po §A.2 jego mocki przestaną odpowiadać ścieżce odczytu.

**Wolno dokładnie jedno:** przepisać mocki tak, by odpowiadały **nowemu** read
modelowi, **zachowując wszystkie trzy asercje** i **dokładając czwartą** (filtr
roli). **Nie wolno:** osłabić asercji, usunąć przypadku, oznaczyć `skip`, ani
„tymczasowo" zmienić oczekiwania z `404` na `200`.

Jeśli nie da się tego zrobić bez osłabienia — **STOP**, wpis do raportu,
i pozycja §A.2 zostaje `CZĘŚCIOWA`.

**Dowód w raporcie:** diff tego pliku + zdanie „żadna asercja izolacji nie
została osłabiona; dodano N-tą asercję (filtr roli)".

### T.2 — Testy jednostkowe reguł na fixture

**Dla każdej z 10 reguł** osobny plik (albo osobny `describe`) z czterema
przypadkami: trafienie · nietrafienie · auto-resolve · negatyw tenanta.
Fixture buduje dane **przez realne zapytania na realnym PG**, nie przez atrapę
warstwy zapytań: reguła zweryfikowana wyłącznie na mocku `queryAll` nie dowodzi,
że jej SQL w ogóle działa na Postgresie (to jest dokładnie defekt bloku
predykcyjnego, pułapka 2).

### T.3 — ★ Bramka reguł: każda reguła musi coś wyprodukować

**To jest test na wzorzec porażki, nie na implementację.** Na wspólnej fixture
przeglądowej (jedna organizacja, dane pokrywające wszystkie 10 warunków):

1. **Każda** reguła fali 1 produkuje **≥1 sygnał** — dowód, że nie jest pusta
   z definicji (ryzyko R6).
2. **Każda** reguła produkuje **≥1 auto-resolve** po zmianie danych — dowód, że
   sygnał znika sam (ryzyko R2).
3. `work_signal_runs` zawiera **≥3 kolejne przebiegi** ze statusem `OK`
   i niezerowym ruchem — dowód, że producent żyje (ryzyko R3).
4. Obcy tenant otrzymuje pusty wynik i **zero zapisów** (ryzyko R4).
5. Każdy widoczny sygnał ma **niepustą** `destination.route` i niepustą listę
   `evidence` — dowód czterech kryteriów `CHAT-OWN-004`.

Reguła, która nie przechodzi punktów 1–2, jest w raporcie `CZĘŚCIOWA`
z uzasadnieniem — **nigdy `ZROBIONE`**.

### T.4 — Testy HTTP na realnym routerze

Pakiet `tests/integration/routes/signals.feed.postgres.integration.test.ts`
(nowy, `git add -f`): realny Express + realny PG w jednorazowym kontenerze,
pokrywający scenariusze §A.4 (dziesięć) plus happy path §A.1 i §A.2.

**Zakaz testów grepujących źródło jako dowodu DoD** (§0.4 pkt 5).

---

## §R. REJESTR I DOWODY — jedna pozycja

### R.1 — `MODULE_ACCEPTANCE.md` 13_CHAT do stanu faktycznego

Aktualizujesz **wyłącznie** wpis `CHAT-OWN-004` (i, jeśli istnieje, powiązany
wiersz statusu): stan producenta, co zostało zbudowane, co jest za flagą, co
zostało jako STOP. **Nie przepisujesz dokumentu, nie dodajesz sekcji, nie
zmieniasz innych pozycji.** Jeżeli Twoja zmiana miałaby dotknąć czegokolwiek
poza `CHAT-OWN-004` — STOP.

**Zakaz deklaracji „domknięte".** Wpisujesz stan faktyczny: „producent
zbudowany, deterministyczna warstwa za `ENABLE_SIGNAL_PRODUCER` (OFF),
interpretacyjna za `ENABLE_SIGNAL_INTERPRETER` (OFF), front feedu poza zakresem
— blok frontowy". Odbiór wizualny należy do nadzorcy i właściciela.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~75 min, NIE pomijasz)
1. `git fetch --all --prune`; weryfikacja markera:
   ```bash
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   Brak → STOP i koniec dyżuru.
2. Materiały wiążące (§0.1 pkt 3) + łata filtra org (§0.1 pkt 4). Wyniki → raport.
3. Gałąź + worktree (§0.1 pkt 5) + symlink `node_modules` (§0.1 pkt 6).
4. **Numer migracji** (§0.1 pkt 7): `ls | grep -oE '^[0-9]{8}' | sort -n | tail -3`
   → wyznacz „najwyższy + 1", zapisz do raportu. `ls|grep` przed **każdym**
   plikiem migracji.
5. **Koordynacja** — stan strumieni (§1.4), wynik do raportu.
6. **Weryfikacja mapy technicznej z §2** — każdą rozbieżność do „Korekt".
   Obowiązkowo:
   ```bash
   grep -n "isAiSignalNotification\|FROM notifications\|datetime('now')" server/src/routes/my-work/signals.routes.ts
   grep -rn "emitSignal(" server/src --include="*.ts" | grep -v __tests__
   grep -n "ExecutionSignalTypeValues\|SignalSeverityValues" server/src/types/executionVisibility.ts
   grep -n "schedule: typeof cron.schedule" server/src/cron/Scheduler.ts
   grep -n "orgMembershipGuard\|gatewayVerifyToken" server/src/Gateway.ts | head -5
   grep -n "aiInputHash\|evidenceRefs.length\|confidence === 'UNKNOWN'" server/src/domain/initiatives-execution/aiEvidenceGovernance.ts
   grep -n "NO_LLM_PROVIDER" server/src/routes/ai.routes.ts
   grep -rn "automated_insights" server/src | head
   sed -n '1,30p' server/migrations/20260307_my_work_signals.sql
   ```
7. **★ Inwentarz źródeł dla 10 reguł** (§2.2) — tabela werdyktów do raportu.
   **To jest najważniejszy produkt Bloku 0**: reguła bez źródła to STOP, a nie
   niespodzianka w połowie dnia.
8. **Dowód stanu wyjściowego testów**:
   ```bash
   npx vitest run server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts
   ```
9. **Świeża baza**: postaw kontener `cx-day18-pg` na porcie **4320**, przebieg
   migracji na nietkniętym repo — punkt odniesienia replay.
10. Założenie raportu (§9) i wpisanie wyników 1–9.

### Blok 1 — fundament (D.1 → D.2 → D.3)
Tanie, niezależne, odblokowują wszystko inne. Bez czystych trzech przebiegów
migracji nie idziesz dalej.

### Blok 2 — silnik (E.1 → E.2 → E.3 → E.4)
`E.2` (evaluator) przed regułami — reguła bez evaluatora nie ma jak być
udowodniona. `E.3`/`E.4` na źródłach potwierdzonych w Bloku 0. Jeśli
którakolwiek reguła ma `BRAK_DANYCH` — STOP dla niej, reszta idzie dalej.

### Blok 3 — pipeline (S.1 → S.3 → S.2)
`S.3` (ledger) **przed** `S.2` (on-demand), bo throttle liczy się z ledgera.
`S.1` pierwszy, bo definiuje wejście.

### Blok 4 — API (A.1 → A.2 → A.3 → A.4)
`A.1` (nowy kanoniczny) przed `A.2` (przemapowanie starego) — przemapowanie ma
wołać gotowy read model, nie duplikować logiki. `A.4` na końcu bloku, jako
jawny pakiet.

### Blok 5 — reguły wyniku i pieniędzy + adapter (E.5 → E.6 → X.1)
To jest to, co odróżnia produkt doradczy od menedżera zadań (uzasadnienie D1=B).
Jeśli czasu jest mało — **te reguły są ważniejsze niż warstwa AI**, bo warstwa
AI i tak jest OFF.

### Blok 6 — warstwa AI (W.1 → W.2 → W.3)
Cała za flagą OFF, cała z mockiem providera. `W.2` (gate) przed `W.3` (przebieg)
— nigdy odwrotnie: nie budujesz ścieżki zapisu, zanim istnieje bramka, która ją
blokuje.

### Blok 7 — domknięcie (obowiązkowo, ~90 min)
1. `X.2`, `T.1`–`T.4`, `R.1` dla tego, co faktycznie zbudowałeś.
2. Pomiar zasięgu (§0.4a): `ZASIĘG PEŁNY`/`CZĘŚCIOWY`.
3. **Osiem dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/"                                                     # PUSTY (zero frontu)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^public/locales/"                                          # PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                       # tylko 2026107X_chat_signals_day18_*
   git diff codex/m03-admin-20260824...HEAD -- server/src/config/FeatureFlags.ts | grep -E "^[-+].*default"                    # tylko DWIE nowe, obie false
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "effectiveAccessService|frameworkEntitlement"                # PUSTY (Z16)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "executionVisibilityService|aiEvidenceGovernance|notificationService"  # PUSTY (Z17)
   docker ps -a --filter name=cx-day18-pg                                                                                     # PUSTO (sprzątnięte)
   ```
4. **Zero wywołań AI na żywo** — jawny dowód: `grep` dowodzi, że testy nie
   ustawiają klucza providera; wszystkie testy §W używają lokalnego mocka.
5. Wolumeny Dockera usunięte (`docker volume ls -q | grep -i cx-day18` → pusto).

### Zasada nadrzędna kolejności
Lepiej **domknięte** `D`+`E.1–E.4`+`S`+`A` niż wszystkie pozycje „prawie".
Każda pozycja albo spełnia DoD, albo jest uczciwie oznaczona
(STOP/`BRAK_DANYCH`/`CZĘŚCIOWO`). **Warstwa AI jest ostatnia nie dlatego, że
nieważna, ale dlatego, że jest OFF i nikt jej jutro nie zobaczy — a pusty feed
zobaczy każdy.**

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:
```
docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_DAY18_REPORT_20260826.md
```
Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Chat — producent sygnałów, dzień 18 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź robocza: codex/chat-signals-day18-<data>
Worktree: /private/tmp/consultify-chat-signals-day18
Porty użyte: 4318/4319 (albo: żadne)  ·  Kontener PG: cx-day18-pg na 4320 (usunięty: TAK/NIE)
Numer migracji wyznaczony: 2026107X (najwyższy zastany: <numer>)  ·  ls|grep przed każdym plikiem: TAK/NIE
Czas pracy: <od>–<do>

## Oświadczenie o chronionym katalogu (Z4/Z5)
Nie otwierałem, nie czytałem i nie kopiowałem plików źródłowych katalogu
/Users/piotrwisniewski/Developer/Consultify. Jedyny kontakt: symlink node_modules
autoryzowany przez DEC-2026-08-26-86.                                  TAK / NIE

## Oświadczenie o zakresie (★ krytyczne ograniczenie)
Nie zmieniłem ani jednego pliku w src/ ani w public/locales/.           TAK / NIE
Nie wywołałem providera AI na żywo; wszystkie testy §W z mockiem lokalnym.  TAK / NIE
Nie wysłałem niczego na zewnątrz (mail/webhook/API zewnętrzne) — DEC-65.   TAK / NIE

## Koordynacja — wynik z Bloku 0
| Strumień | Sprawdzenie | Wynik | Konsekwencja |
| Łata filtra org (signals-org-filter-fix) | git merge-base --is-ancestor | SCALONA / NIESCALONA | buduję na niej / buduję poprawnie od razu |
| Projekt wiążący (chat-signals-design) | git show … \| wc -l | 763 / inne | czytam, nie scalam |
| Blok frontowy feedu | — | — | nie dotykam src/ |

## Warunki wstępne — tabela
(marker, ledger 144 linie, DEC-89:141, DEC-86:138, DEC-65:117, DEC-36:88,
 projekt 763 linie, MODULE_ACCEPTANCE 13_CHAT, strażnik izolacji zielony przed zmianami)

## ★ Inwentarz źródeł dla 10 reguł (produkt Bloku 0)
| # | ruleId | Domena | Tabela/źródło faktyczne | Kolumny warunku | Werdykt |
| 1 | exec.task.overdue | EXECUTION | | | ŹRÓDŁO_JEST / ŹRÓDŁO_INNE / BRAK_DANYCH |
| 2 | exec.task.due_soon_not_started | EXECUTION | | | |
| 3 | exec.task.blocked_stale | EXECUTION | | | |
| 4 | exec.initiative.no_baseline | EXECUTION | | | |
| 5 | dec.pending_stale | DECISION | | | |
| 6 | dec.blocking_dependents | DECISION | | | |
| 7 | res.kpi_threshold_breached | RESULTS | | | |
| 8 | res.roi_confidence_dropped | RESULTS | | | |
| 9 | fin.budget_overspend | FINANCE | | | |
| 10 | fin.benefit_not_realized | FINANCE | | | |

## Pozycje — tabela zbiorcza
| Pozycja | Zakres | Status | Commit | Testy | Dowód | Uwagi |
| D.1 | tabela work_signals + indeksy org-first | | | | | |
| D.2 | work_signal_runs + muted_domains_json | | | | | |
| D.3 | typy i słowniki (kontrakt SignalRule) | | | | | |
| E.1 | rejestr reguł + walidator | | | | | |
| E.2 | evaluator różnicujący + izolacja błędu | | | | | |
| E.3 | 4 reguły EXECUTION | | | | | |
| E.4 | 2 reguły DECISION | | | | | |
| E.5 | 2 reguły RESULTS (KPI) | | | | | |
| E.6 | 2 reguły FINANCE | | | | | |
| S.1 | harmonogram + kill-switch | | | | | |
| S.2 | odświeżenie on-demand z throttlem | | | | | |
| S.3 | ledger przebiegów + alarm | | | | | |
| A.1 | GET /api/signals (org + rola + DTO) | | | | | |
| A.2 | przemapowanie /my-work/signals + usunięcie martwego kodu | | | | | |
| A.3 | mutacje na nowej postaci klucza | | | | | |
| A.4 | pakiet negatywów cross-org / cross-role | | | | | |
| W.1 | flaga INTERPRETER + fail-closed brak providera | | | | | |
| W.2 | gate rodowodu | | | | | |
| W.3 | przebieg interpretacyjny (wejście/limit/koszt) | | | | | |
| X.1 | adapter v8_execution_signals | | | | | |
| X.2 | sprzątanie martwego kodu | | | | | |
| T.1–T.4 | testy | | | | | |
| R.1 | MODULE_ACCEPTANCE 13_CHAT | | | | | |
(Status ∈ ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · BRAK_DANYCH · NIE_ZACZĘTE)

## Tabele werdyktów
### E.2 — evaluator | Scenariusz | Oczekiwane | Wynik |  (idempotencja · auto-resolve · supersede · izolacja błędu · limit · negatyw tenanta)
### T.3 — bramka reguł | ruleId | ≥1 sygnał? | ≥1 auto-resolve? | destination niepusta? | evidence niepuste? |
### A.4 — negatywy | # | Scenariusz | Oczekiwane | Wynik |  (dziesięć scenariuszy)
### S — przebiegi | Trigger | Flaga | Provider | Status w ledgerze | Zapisy do work_signals |
### W — warstwa AI | Scenariusz | Oczekiwane | Wynik |  (flaga OFF · brak providera · próg <5 · limit 3 · evidenceRefs<2 · cross-org ref · confidence UNKNOWN)

## ★ Dowód zamrożenia (DEC-65)
„Z tego dyżuru nie wyszła ani jedna zdalna operacja: zero deployów, zero zdalnych
migracji, zero zapisów do wspólnej bazy, zero wywołań AI na żywo, zero wysyłek."
DOWÓD: <osiem komend z Bloku 7 + wyniki>

## Migracje
| Plik | Numer | ls\|grep przed utworzeniem | Addytywna? | Przebieg 1 | Przebieg 2 (0 applied) | Dry (0 pending) | Kompatybilność wstecz |

## Flagi
| Flaga | Plik | Default | Realny czytelnik (plik:linia) | Test dowodzący egzekwowania |
| ENABLE_SIGNAL_PRODUCER | FeatureFlags.ts | false | | |
| ENABLE_SIGNAL_INTERPRETER | FeatureFlags.ts | false | | |

## Licencje Z17 — co faktycznie dotknąłem w plikach współdzielonych
| Licencja | Plik | Co dodałem | Czy tylko tyle, ile licencja pozwala? |
| L1 | server/src/config/FeatureFlags.ts | | |
| L2 | server/src/cron/Scheduler.ts | | |
| L3 | server/src/Gateway.ts | | |
| L4 | server/src/routes/my-work.routes.ts | NIC / <opis> | |

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — zakres /my-work/signals po przemapowaniu (§1.7 poz. 1)
### STOP — kanał notyfikacji dla severity critical/blocker (§1.7 poz. 2)
### STOP — nazwa pola pełnej wagi obok legacy severity (§1.7 poz. 3)
### STOP — generyczne wejście do aiRunLedgerService (§W.3)
### STOP — <pozostałe>

## Znaleziska (NIE naprawiane przeze mnie)
(oczekiwane m.in.: aiNotificationTriggers z jednym ręcznym callerem ·
 automated_insights bez czytelników i pisarzy · brak historii pewności prognozy dla res.roi_confidence_dropped ·
 warianty wielkości liter w słowniku ról · aiRunLedgerService action-centric)

## Korekty wobec instrukcji
## Testy  (własne · zmiana strażnika izolacji §T.1 · pomiar zasięgu §0.4a · osiem dowodów Bloku 7)
## Licznik  (pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte; obie flagi NADAL OFF)
## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania
- Status pozycji zgodny z DoD, nie z intencją.
- Każdy `BRAK_DANYCH`/`STOP` ma pełną tabelę/wpis (co, gdzie, jakiego pola
  brakuje, co bym zrobił po decyzji).
- „mechanika gotowa do konsumpcji przez blok frontowy", nigdy „gotowe do
  pokazania właścicielowi" ani „wystarczy włączyć flagę i zobaczyć".
- Reguła, która nie przeszła bramki §T.3, jest `CZĘŚCIOWA`. Zawsze.

---

## 10. ŚCIĄGA

### 10.1. Komendy
```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>
# numer migracji — PRZED KAŻDYM PLIKIEM
ls server/migrations | grep -oE '^[0-9]{8}' | sort -n | uniq | tail -3
ls server/migrations | grep '^2026107X'          # MUSI BYĆ PUSTE
# test celowany (NIGDY pełny vitest/tsc)
npx vitest run server/src/services/signals/__tests__
npx vitest run server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts
npx vitest run tests/integration/routes/signals.feed.postgres.integration.test.ts
# typy punktowo
npx esbuild server/src/services/signals/signalEvaluator.ts --loader:.ts=ts --outfile=/dev/null
# migracje — jednorazowy kontener (port 4320), dowód (1)(2)(3), sprzątanie
docker run -d --name cx-day18-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day18 -p 4320:5432 pgvector/pgvector:pg16
export DATABASE_URL="postgres://postgres:cx@localhost:4320/cx_day18"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict   # x2
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day18-pg && docker volume ls -q | grep -i cx-day18 | xargs -r docker volume rm
# nowe pliki w tests/ wymagają -f
git add -f tests/unit/signals/<nowy>.test.ts
# pomiar zasięgu
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć
1. **Reguła, która na realnych danych nigdy nie trafia** — pusty feed z ładniejszym
   schematem. Bramka §T.3 istnieje właśnie po to.
2. **Evaluator dopisujący zamiast różnicującego** — sygnały-zombie, feed kłamie
   po tygodniu.
3. **Cichy `catch`** — powtórka `signals.routes.ts:259`. Każdy błąd ląduje
   w `work_signal_runs.errors` i podnosi status.
4. **Błąd reguły domykający jej sygnały** — cicha porażka wygląda wtedy jak
   „warunek ustał". To gorsze niż brak sygnału.
5. **`severity: 'BLOCKER'`** wysłane w polu legacy, którego panel nie zna —
   psuje istniejący front bez jednej linii zmiany w nim.
6. **Filtr roli bez normalizacji wielkości liter** — ciche ukrycie sygnałów.
7. **`organizationId` albo `role` brane z żądania**, nie z tokenu.
8. **Zgadnięty numer migracji** zamiast `ls|grep` (`DEC-2026-08-26-86`).
9. **FK do tabel dziedzinowych** w migracji — pułapka sortowania.
10. **Osłabiony strażnik izolacji** (`signals.routes.org-isolation.test.ts`) —
    §T.1 dopuszcza tylko przepisanie mocków z zachowaniem wszystkich asercji.
11. **Zmiana globalnego mocka `node-cron` albo `llmApi`** (Z18) — testujesz przez
    wstrzykiwany `schedule` i lokalny `vi.mock`.
12. **Wywołanie providera AI na żywo** albo zostawienie
    `ENABLE_SIGNAL_INTERPRETER` na `true` — obie flagi kończą dyżur na `false`.

### 10.3. Cztery pytania, na które każdy sygnał musi umieć odpowiedzieć
```
Skąd wiadomo?  → source.evidence[] (rekord + zmierzona wartość)     ← CHAT-OWN-004 „source"
Jak świeże?    → freshness.lastObservedAt + runAt                    ← „freshness"
Jak ważne?     → severityRaw (info|warning|critical|blocker)         ← „severity"
Gdzie rozwiązać? → destination.route + permission + allowed          ← „destination"
```
Sygnał, który nie odpowiada na którekolwiek z nich, nie przechodzi odbioru —
niezależnie od tego, jak ładnie wygląda schemat bazy.

---

## 11. NA KONIEC

Ten dyżur buduje to, czego w Consultify **nigdy nie było**: producenta sygnałów.
Cztery rzeczy, które odróżniają go od dzisiejszego stanu.

**Pierwsza — sygnał staje się bytem.** Dziś „sygnał" to powiadomienie, którego
nazwa typu zawiera napis „AI". Po tym dyżurze sygnał ma tożsamość
(`dedupe_key`), historię (`first_observed_at`/`last_observed_at`), dowód
(`evidence[]` wskazujące rekord i zmierzoną wartość), adresata
(`audience_user_id`/`audience_role`), destynację (`action`) i warunek ustania.
Pięć testów z §2 projektu jest granicą: kandydat, który ich nie przechodzi, nie
jest sygnałem, tylko notyfikacją, metryką albo opinią.

**Druga — producent istnieje i da się to udowodnić.** W repozytorium są dziś
**dwa** poprawnie napisane emitery sygnałów, z których **żaden nie ma ani jednego
wywołania produkcyjnego**. Schemat bez producenta przeszedł odbiór jako
„backend-driven". Dlatego `work_signal_runs` nie jest dodatkiem — jest **jedynym
dowodem, że silnik żyje**, i dlatego bramka §T.3 wymaga od każdej reguły
sygnału **i** auto-domknięcia, a nie samego istnienia funkcji.

**Trzecia — feed mówi o wyniku i pieniądzach, nie o zadaniach.** Właściciel
wybrał D1 = B świadomie: „zadanie po terminie" ma każdy Jira; „KPI odchylone od
celu, korzyść niepotwierdzona po terminie" jest tym, po co konsultant otwiera
Consultify. Jeśli czasu zabraknie, reguły RESULTS i FINANCE są **ważniejsze**
niż warstwa AI — bo warstwa AI i tak jest wyłączona.

**Czwarta — AI jest zbudowane i wyłączone, i to nie jest sprzeczność.**
`DEC-40` zabrania odkładania na po-MVP, `DEC-51` zabrania atrapy AI, a reguła 7
CLAUDE.md zabrania, żeby właściciel był pierwszym testerem jakości syntezy.
Odpowiedź to kod kompletny, otestowany z mockiem providera, za flagą `false`,
z bramką rodowodu, która **fizycznie uniemożliwia** zapis sygnału bez co
najmniej dwóch dowodów z sygnałów deterministycznych tej samej organizacji.
Model, który „zauważa" coś spoza tego zbioru, zostaje odrzucony wyjątkiem —
nie ostrzeżeniem w logu.

Front feedu — nie Twój. `src/` — nie Twój. `effectiveAccessService` — nietykalny.
Globalne mocki — nietykalne. Reszta mechaniki — Twoja, do końca.

Powodzenia. Inwentarz źródeł w Bloku 0 przed czymkolwiek innym, numer migracji
z `ls|grep` przed każdym plikiem, commit per pozycja, prettier przed każdym
commitem, STOP bez wahania zamiast zgadywania, Blok 7 zawsze, obie flagi na
`false` na koniec.
