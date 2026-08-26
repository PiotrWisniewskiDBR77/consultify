# INSTRUKCJA DYŻURU nr 24 — Codex — „Meetings blok 3: dowody, macierz dostępu i dokończenia — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–23. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **trzecim i ostatnim blokiem mechaniki Meetings**. Dwa poprzednie
zostały odebrane i **scalone** do `codex/m03-admin-20260824`:

- **dzień 16** (`DEC-2026-08-26-92`) — uczestnicy, ICS, wysyłka ze strażnikami,
  migracja `20261075`;
- **dzień 19** (`DEC-2026-08-26-108` → FIX-y → `DEC-2026-08-26-111`) — H.1 opcją B,
  edycja i odwoływanie serii, resolver załączników, migracja `20261090`.

`DEC-111` kończy się listą **„POZOSTAJE do przyszłego bloku"**. Ta instrukcja
jest tą listą, rozpisaną na siedem pozycji z dowodami. Cytat wiążący
(`OWNER_DECISION_LEDGER_2026-08-24.md:163`):

> POZOSTAJE do przyszłego bloku: pełna macierz G.2, T.1/T.2, test DST, H.2
> (BRAK_API — `createInitiativeService` bez `idempotencyKey`; funnel My Work
> `idempotencyKey` PRZYJMUJE i jest do zbudowania), luka `materialTitle`
> w `GET /:id/notes` (JOIN bez resolvera — wskazana przez samą instrukcję),
> trasy occurrence bez `requireMeetingAdmin`. Moduł Meetings pozostaje
> ZAMKNIĘTY bramką `closed`.

Materiały wiążące, które czytasz **przed** startem (są w repo, na Twojej bazie):

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY19_REPORT_20260826.md
docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY16_REPORT_20260826.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY19_MEETINGS_BLOCK2_INSTRUKCJA.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY16_MEETINGS_FINAL_INSTRUKCJA.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md
```

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

1. **★ CAŁE `src/` JEST POZA ZAKRESEM. Bez wyjątku.** Ekrany Meetings, karta
   spotkania, lista uczestników, przyciski „odwołaj serię", polonizacja —
   **robią robotnicy wewnętrzni**, po prototypie i akcepcie właściciela na
   czystym zrzucie (CLAUDE.md reguła 7: właściciel **nigdy** nie jest pierwszym
   testerem wizualnym). Ty budujesz **TYŁ**: trasy, serwisy, kontrakty
   odpowiedzi, testy, macierz dostępu. Jeżeli front wymaga zmiany — **wypisujesz
   kontrakt dla robotnika frontowego w raporcie**, nie dotykasz `src/`.
   **Jedyny wyjątek odczytowy:** `src/utils/betaAccess.ts` wolno **CZYTAĆ**
   (serwerowa bramka go importuje). **Zmiana tego pliku = odrzucenie dyżuru.**
2. **★★ STRAŻNICY WYSYŁKI SĄ NIETYKALNI (`DEC-65`, `DEC-92`).**
   `captured` (brak live transportu) i `blocked_demo` (organizacja demo) stoją
   **przed** mailerem w `server/src/services/meeting/meetingInvitationService.ts`.
   Ich testy — `server/src/services/meeting/__tests__/meetingDay16.pg.test.ts:166`
   i `:182` (`expect(emailSendSpy).not.toHaveBeenCalled()`) — **mają zostać
   zielone i nieosłabione**. Dotknięcie ścieżki wysyłki z regresem strażników =
   **odrzucenie dyżuru**, niezależnie od jakości reszty. Pozycja `G` dotyka
   gałęzi live — czytaj §G.3 zanim napiszesz pierwszą linię.
3. **★ MODUŁ ZOSTAJE ZAMKNIĘTY.** `src/utils/betaAccess.ts:53`
   (`MODULE_MEETING: 'closed'`) **nie zmienia wartości**. Stan `open` w macierzy
   `A` badasz **wyłącznie** wstrzykniętym resolverem statusu w teście —
   szczegóły i pułapka w §A.3. Zmiana wartości domyślnej = odrzucenie dyżuru.
4. **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej
   flagi.** Jeżeli uznasz, że potrzebujesz flagi — to jest **STOP**, nie
   improwizacja (CLAUDE.md reguła 9).
5. **★ ZAKAZ ATRAPY Z ZEWNĘTRZNYM SKUTKIEM (Z22 / `DEC-2026-08-26-108`).**
   W tym module to ma nazwisko i datę: `DELETE /:id/occurrence` dla
   `scope='all'` i `'this_and_following'` zwracał **200**, w bazie **zero
   zmian**, po czym **rozsyłał `METHOD:CANCEL` do uczestników** — ludzie
   dostawali odwołanie spotkania, które nadal istniało. Naprawione FIX-em 1
   dnia 19. **Każda Twoja pozycja z efektem na zewnątrz (wysyłka, zadanie
   w My Work, materiał) musi mieć dowód zmiany w bazie odczytany niezależnym
   połączeniem — przed dowodem efektu.**
6. **★ Uczciwy brak > udawana kompletność.** Nie zawyżasz statusów, nie
   deklarujesz „N/N PASS" na wybranym podzbiorze, nie nazywasz `CZĘŚCIOWO`
   słowem `ZROBIONE_WG_DoD`. Dzień 19 dostał za to `MERGE WSTRZYMANY`
   (`DEC-108`, P1), a po uczciwym przeliczeniu — `SUPERVISOR_ACCEPT`
   (`DEC-111`). Kopiujesz jego **poprawioną** uczciwość, nie jego pierwszy
   raport.
7. **Odbiór wizualny i decyzja o pokazaniu właścicielowi = nadzorca, po dyżurze.**
   W raporcie piszesz „gotowe do odbioru przez nadzorcę", **nigdy** „gotowe do
   pokazania właścicielowi".
8. **`DEC-65` — dane demo są chronione, wspólna baza jest święta.** Zero Railway,
   zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo, **zero
   realnych wysyłek e-mail**. Migracje = `MIGRATION_PREPARED`, addytywne,
   kompatybilne wstecz, z dowodem idempotencji na jednorazowym lokalnym
   kontenerze.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**. Nadzorca podaje Ci
   **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/admin55-*`, `codex/meetings-day16-*`, `codex/meetings-day19-*`
   ani `codex/preserve-*`.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker **JEST** przodkiem,
   ale tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).** Ten
   dyżur zakłada, że **dni 16 i 19 wraz z FIX-ami są w Twojej bazie**.
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu:

   ```bash
   # (a) DZIEŃ 16 SCALONY — uczestnicy, wysyłka, ICS
   ls server/src/services/meeting/meetingDay16Service.ts
   ls server/src/services/meeting/meetingInvitationService.ts
   ls server/migrations/20261075_meetings_day16_*.sql
   grep -n "blocked_demo" server/src/services/meeting/meetingInvitationService.ts

   # (b) DZIEŃ 19 + FIX-1 SCALONE — realne odwołanie serii, nie atrapa
   grep -n "recurrence_status=CASE WHEN" server/src/services/meeting/meetingOccurrenceService.ts
   grep -n "input.cancel ? 'cancelled' : null" server/src/services/meeting/meetingOccurrenceService.ts
   ls tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts

   # (c) DZIEŃ 19 + FIX-4 SCALONY — precondition retry
   grep -n "RETRY_NOT_ALLOWED" server/src/routes/meeting.routes.ts
   grep -n "RETRY_NOT_ALLOWED" server/src/services/meetingBoundary/meetingBoundaryService.ts
   ls server/migrations/20261090_meetings_day19_note_materialization.sql

   # (d) rdzeń, który rozszerzasz — musi istnieć DOKŁADNIE tak
   grep -n "router.use(closedBetaModuleGate)" server/src/routes/meeting.routes.ts        # oczekiwane: 257
   grep -n "function requireMeetingAdmin" server/src/routes/meeting.routes.ts            # oczekiwane: 124
   grep -n "async function handleOccurrenceMutation" server/src/routes/meeting.routes.ts # oczekiwane: ~1171
   grep -n "a.title_snapshot AS material_title" server/src/services/meetingBoundary/meetingBoundaryService.ts  # oczekiwane: 2 trafienia (282, 311)
   grep -n "getArtifactForUser" server/src/services/meeting/meetingAttachmentService.ts
   grep -n "idempotencyKey: string; sourceType: string; sourceId: string;" server/src/services/TaskService.ts  # oczekiwane: 111

   # (e) czego NIE WOLNO cofnąć — strażnicy wysyłki
   grep -n "not.toHaveBeenCalled" server/src/services/meeting/__tests__/meetingDay16.pg.test.ts  # oczekiwane: 166, 182
   grep -n "MODULE_MEETING: 'closed'" src/utils/betaAccess.ts                                    # oczekiwane: 53
   ```

   **Brak (a) lub (b) = STOP całego dyżuru** — pracujesz na bazie sprzed scaleń
   i budowałbyś cudzą robotę drugi raz.
   Brak (c) = STOP (retry bez preconditionu tworzy osierocone artefakty — nie
   wolno na tym stawiać).
   Brak (d) = STOP z opisem (ktoś już to ruszył — sprawdź, kto i czym).
   Brak (e) = **STOP bezwzględny** (ktoś rozbroił strażników wysyłki albo
   otworzył moduł).

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 177
   grep -n "DEC-2026-08-26-108" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-111" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-92"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-87"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-98"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY19_REPORT_20260826.md      # oczekiwane 288
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md # oczekiwane 102
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestr rośnie) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   wskazanych decyzji się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/meetings-day24-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-meetings-day24 codex/meetings-day24-<data>
   cd /private/tmp/consultify-meetings-day24
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Dlaczego                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/meetings-day24-<data>`                                                                                                                                                                                                                                                                                                | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                                               |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani gałęzi `codex/admin55-*`, `codex/initiatives-*`, `codex/meetings-day16-*`, `codex/meetings-day19-*`, `codex/staging-fixes-*`                                                                                                                                                                                                                                            | `demo` = święta baza; tamte gałęzie są historią odebraną                                                                        |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                                                                               | Krach 3/4 powstał tak; DEC-95                                                                                                   |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                                                                                  | Wymagania są w rejestrze uwag i decyzjach                                                                                       |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` — patrz Blok 0                                                                                                                                                                                                                             | Chroniony, brudny worktree właściciela                                                                                          |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-day24-instrukcja`, `consultify-meetings-day19`, `consultify-superadmin-day22`, `consultify-finance-day23`, `consultify-staging-fixes`)                                                                                                                                                                                                                                          | Cudze worktree, część w użyciu                                                                                                  |
| Z7      | **Nie zajmujesz portów sesyjnych** (3777, 3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4110/4111, 4280/4281, 4290/4291, 4294/4295, 4300–4306, 4312, 4319, 4324/4325, 4336/4337, 4339/4340, 4348/4349, 4370, 4380/4381, 4418, 4428, 4480/4481, 5000, 5037, 5432, 5447, 5449, 5467, 5471, 5474, 5481, 5483, 5493, 5495). **Twój kontener PG = 5497**; lokalny runtime, jeśli konieczny — **4352/4353**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu | 5493/5495 zajmują odbiory dni 21/22, 5474 audyt Tools, 5483 dzień 23                                                            |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (DEC-65)                                                                                                                                                                                                                                                                                                                                 | Produkcja/demo poza zakresem                                                                                                    |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą                                                                                                                                                                                                                                     | „dane demo = twarz produktu" (DEC-65)                                                                                           |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu". Dotyczy w szczególności `MODULE_MEETING`, `MEETING_INVITES_LIVE`, `BETA_ADMINS_EXEMPT`                                                                                                                                                                                                                                            | CLAUDE.md reguła 9                                                                                                              |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/meetings/*`                                                                                                                                                                                                                                                                                                                    | Gramatyka zaakceptowana (`DEC-2026-08-24-07`)                                                                                   |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY24_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`                                                                                                                                                                                      | Repo tonie w dokumentach-duchach                                                                                                |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie. Jeżeli uważasz, że decyzja się myli — piszesz **erratę w raporcie**, nie patch w rejestrze                                                                                                                                                                                                                                                            | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                                      |
| **Z14** | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** `meetingIntelligenceService` **wołasz bez zmian** albo w ogóle. Zero nowych wywołań `llmService`                                                                                                                                                                                                                                                                                         | Silnik AI = osobny moduł, ostatni w programie; DEC-51                                                                           |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `failed`.** `materializationStatus='failed'` **zostaje**; `deliveryStatus='failed'` dla jednego odbiorcy **zostaje**; `accessible:false` z `title:null` **zostaje**                                                                                                                                                                                                                           | Uczciwy pusty stan > udawany wynik                                                                                              |
| **Z16** | **★★ `server/src/services/effectiveAccessService.ts` jest ABSOLUTNIE NIETYKALNY** — także `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/services/v8/artifactRegistryService.ts`, `server/src/services/v8/recurrenceEngine.ts`. Wolno **czytać** i **wołać**                                                                                                                                 | Model uprawnień i rejestr artefaktów naprawiane in-house; Z17 dnia 19 pilnował tego samego                                      |
| **Z17** | **★ Zakaz wszystkiego poza modułem Meetings** — z imiennymi licencjami z ramki poniżej. Cały front, powłoka SPEC-A, kanon triady: **NIE**                                                                                                                                                                                                                                                                                                                          | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                                                  |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                                                                                                | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                                        |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — CZTERY zmienne, nie dwie.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia** i **liczba SKIPPED**                                                                                                                    | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (DEC-96/98); dzień 19 mierzył bez `MOCK_DB=false` — patrz ramka |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą                                                                                                                                                                                                                                                                                                                                                          | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech żywych martwych gałęziach                                               |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`) — każda pozycja z wywołaniem zewnętrznym musi mieć **test domyślnego okablowania**                                                                                                                                                                                                                                                                                      | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate`                                  |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — sukces + efekt na zewnątrz przy braku zmiany w bazie = odrzucenie pozycji. **W tym module to jest lekcja dnia 19: CANCEL bez zmiany w bazie**                                                                                                                                                                                                                                                   | `DELETE /occurrence` rozsyłał `CANCEL` do ludzi, nie zmieniwszy nic                                                             |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z pełnego zakresu §0.4a, z rozbiciem **zastane / wprowadzone** i liczbą **SKIPPED**                                                                                                                                                                                                                                                                                                               | Dzień 19 zadeklarował „98/98 PASS" przy 189/193 w zakresie własnej instrukcji i dwóch wniesionych czerwonych                    |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts:386-388`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★★ Z19 — CZTERY zmienne w tej samej linii, i dlaczego to nie jest biurokracja.**
Sprawdziłem to w kodzie dla Ciebie i **to jest najważniejsza errata tej
instrukcji** (szczegóły i konsekwencje w §1.4 pkt 1):

- `server/src/database/Database.ts:81` — `process.env.MOCK_DB === 'true'`
  podstawia **mock DB BEZWARUNKOWO**, niezależnie od `RUN_DB_TESTS`;
- `tests/setup.ts:382` — `process.env.MOCK_DB = process.env.MOCK_DB || 'true'`,
  czyli **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**;
- `tests/setup.ts:542-573` — globalny mock `auth.middleware.js`: przy **braku**
  nagłówka `Authorization` i przy `MOCK_DB !== 'false'` wstrzykuje użytkownika
  `role: 'owner', isSuperAdmin: true` i woła `next()`. Czyli **anonim dostaje
  200 zamiast 401** — nie dlatego, że produkt jest dziurawy, tylko dlatego, że
  pomiar był robiony bez `MOCK_DB=false`.

Dlatego **każde** uruchomienie testu dotykającego bazy ma env **w tej samej
linii**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Pakiet w całości `SKIPPED` zaraportowany
jako `PASS` = zawyżenie i podstawa odrzucenia.**

**★ Z20 — jak wygląda dowód osiągalności.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki)
  → montaż w Gateway.ts (plik:linia)
  → middleware routera (verifyToken / isAuthenticated / closedBetaModuleGate)
  → handler trasy (plik:linia)
  → serwis (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
  → odczyt, który ten wiersz podnosi (plik:linia)
```

Montaż jest w `server/src/Gateway.ts:769` (`app.use('/api/meeting', meetingRoutes)`).
**Ostatni wiersz jest obowiązkowy** — zapis, którego żaden odczyt nie podnosi,
jest z punktu widzenia produktu niewidoczny: pozycja `CZĘŚCIOWO`, nie
`ZROBIONE_WG_DoD`.

**★ Z21 — co to znaczy „test domyślnego okablowania".**
Test, który buduje własny `express()` i **wstrzykuje własny serwis**, nie dowodzi
niczego o produkcji. Wzorzec dopuszczalny (i jedyny wzorzec dowodowy tego
dyżuru) to `tests/integration/routes/meeting.day19.postgres.integration.test.ts:41-45`:
importuje **realny router** (`server/src/routes/meeting.routes.js`), montuje go
pod `/api/meeting` i mockuje **wyłącznie** `auth.middleware.js` (bo nie ma
sesji przeglądarki) oraz `Logger.js` (bo szum). **Serwisy Meetings, bramka beta,
baza — realne.** Każde odstępstwo od tego wzorca wymaga jawnego wpisu w raporcie
z uzasadnieniem.

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/meeting.routes.ts                              (D, E, F)
  server/src/services/meetingBoundary/meetingBoundaryService.ts    (TYLKO §D — dwa odczyty notatek)
  server/src/services/meeting/meetingOccurrenceService.ts          (TYLKO jeśli §C udowodni defekt — patrz §C.4)
  server/src/services/meeting/meetingNoteTaskFunnelService.ts      (NOWY plik, §F)
  server/src/services/meeting/__tests__/day24.*.test.ts            (NOWE pliki)
  server/src/services/meetingBoundary/__tests__/day24.*.test.ts    (NOWE pliki)
  server/src/routes/__tests__/day24.*.test.ts                      (NOWE pliki)
  tests/integration/routes/meeting.day24.*.postgres.integration.test.ts  (NOWE pliki, git add -f)
  server/migrations/2026115<x>_meetings_day24_*.sql                (NOWE pliki, numeracja wg §0.3 — najpewniej ŻADNA)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY24_REPORT_20260826.md          (jedyny nowy dokument)

IMIENNE LICENCJE (wolno WOŁAĆ/CZYTAĆ istniejące, NIE zmieniać ich kodu):
  §A   — server/src/middleware/betaGate.middleware.ts::createModuleGate / closedBetaModuleGate
         (CZYTASZ i WOŁASZ; ZMIANA PLIKU = STOP — patrz pułapka §A.3)
         src/utils/betaAccess.ts (CZYTASZ; ZMIANA = ODRZUCENIE DYŻURU)
         server/src/middleware/auth.middleware.ts (CZYTASZ; ZMIANA = STOP — to globalny wall całej aplikacji)
  §D   — server/src/services/v8/artifactRegistryService.ts::getArtifactForUser
         (WOŁASZ; ZMIANA PLIKU = STOP, Z16)
  §F   — server/src/services/TaskService.ts::createTask (WOŁASZ z parametrem `command`; ZMIANA PLIKU = STOP)
         server/src/database/Database.ts::getDatabase (WOŁASZ; NIE zmieniasz)
         wzorzec funnela — server/src/services/myWork/agentApprovedMaterializationService.ts:230-238
         (CZYTASZ jako wzorzec idempotentnego lejka; NIE zmieniasz)
  §G   — server/src/services/meeting/meetingInvitationService.ts
         (CZYTASZ; ZMIANA = STOP — patrz §G.3; wolno TYLKO napisać test)
         server/src/services/emailService.ts (CZYTASZ; mockujesz LOKALNIE w swoim teście; NIE zmieniasz)
  wzorzec testu — tests/integration/routes/meeting.day19.postgres.integration.test.ts (CZYTASZ jako wzorzec)
                  server/src/services/meetingBoundary/__tests__/meetingBoundaryMountedAuth.pg.test.ts
                  (CZYTASZ jako wzorzec realnego JWT + realnych wierszy users/organizations)

NIE WOLNO:
  CAŁE src/**  (poza ODCZYTEM src/utils/betaAccess.ts)   ← podział FRONT/TYŁ; zero wyjątków,
                                                            także „jedna linia importu"
  server/src/services/meeting/meetingInvitationService.ts ← §G to TEST, nie zmiana kodu
  server/src/services/meeting/meetingDay16Service.ts      ← odebrane DEC-92
  server/src/services/meeting/meetingAttachmentService.ts ← odebrane DEC-111 (czytasz jako wzorzec §D)
  server/src/services/v8/artifactRegistryService.ts       ← Z16
  server/src/services/v8/recurrenceEngine.ts              ← Z16 (STOP dnia 19 był zasadny)
  server/src/services/artifactHandoff/**                  ← kręgosłup, wołany bez zmian
  server/src/services/TaskService.ts                      ← WOŁASZ, nie zmieniasz
  server/src/services/initiativeService.ts / createInitiativeService  ← H.2 Initiatives = BRAK_API, patrz §F.6
  server/src/middleware/auth.middleware.ts · betaGate.middleware.ts   ← czytasz, nie zmieniasz
  server/migrations/<istniejące pliki>                    ← TYLKO ODCZYT (nowe DDL = nowy plik)
  tests/e2e/**  ·  tests/acceptance/**                    ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  test(meeting): full access matrix for the real router (role x module state x tenant) (A)
  test(meeting): HTTP tests on the real router and real PG for every day16/day19 route (B)
  test(meeting): prove the series split keeps UNTIL correct across a DST boundary (C)
  fix(meeting): resolve material title per user instead of per organization (D)
  fix(meeting): gate occurrence mutations the same way the neighbouring mutations are gated (E)
  feat(meeting): idempotent note action item to My Work task funnel (F)
  test(meeting): prove one failing recipient does not block the rest of the invite batch (G)
  docs(meeting): raise 08_MEETINGS acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**. Wyjątek: istniejący
  `tests/unit/backend/middleware/meetingBetaGate.test.ts:36-47` **czyta źródło
  routera i asertuje dokładny ciąg trzech linii `router.use(...)`** — tego testu
  **nie ruszasz**, ale musisz go mieć na uwadze: **każde przestawienie kolejności
  tych trzech linii wywali go**. Dodawanie nowych `router.use(...)` **po** nich
  jest bezpieczne.
- **Typy punktowo** (`npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 24 MA PRZYDZIELONY PRZEDZIAŁ `20261150`–`20261159`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261149` to pule dni 22–23 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na Twojej bazie to `20261123`;
     **nie** bierz `20261124`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^20261150'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_meetings_day24_<temat>.sql`.
     `migrate.postgres.ts` stosuje migracje w porządku **alfabetycznym nazw
     plików**, więc kolizja numeru to cicha katastrofa — dokładnie ta, którą
     wykrył odbiór dnia 18 (`DEC-107`).

  3. **★ ZERO nowych kluczy obcych.** Meetings świadomie ich nie ma
     (`20260826_meetings_day10_decisions.sql:2` — „No foreign keys: meetings and
     meeting_follow_ups may be bootstrapped lazily"). Nie powielasz.
  4. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65)** — warunek
     oddania każdej pozycji z migracją. Jednorazowy kontener, trzy przebiegi,
     wyniki do raportu. **Sprzątanie kontenera I wolumenów jest obowiązkowe.**
  5. **★★ NAJPEWNIEJ NIE POTRZEBUJESZ ŻADNEJ MIGRACJI.** Sprawdziłem to za
     Ciebie i wynik jest w §F.4: nośnik idempotencji dla funnela `F` **już
     istnieje** — `tasks.idempotency_key` z częściowym unikatem
     `idx_tasks_idempotency_org ON tasks(organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
     (`server/migrations/20260804_m02a_tasks_tenant_idempotency.sql:52-54`).
     **Migracja bez udowodnionego braku obiektu na świeżej bazie = pozycja
     odrzucona.** Jeżeli mimo to uznasz, że migracja jest konieczna — najpierw
     dowód `\d tasks` i `\di idx_tasks_idempotency_org` z Twojego kontenera
     w raporcie, potem plik.
- **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
  **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `null` z powodem,
   **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi.
3. **Zero atrap.** Brak API → wpis `BRAK_API`. **I zero atrap z zewnętrznym
   skutkiem (Z22)**: jeżeli trasa zwraca `deliveries` z `method:'CANCEL'`,
   w bazie MUSI być zmiana stanu — dowodzisz ją osobnym `SELECT` przed i po.
4. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**
   (wzorzec: `tests/integration/routes/meeting.day19.postgres.integration.test.ts`).
   Test na zmockowanym `meetingService` **nie zastępuje** tego wymogu — to
   dokładnie dług, który zamyka pozycja `B`.
6. **★ DOWÓD OSIĄGALNOŚCI (Z20)** — pełna ścieżka od realnego wejścia do zapisu
   **i do odczytu, który ten wiersz podnosi**. Bez ostatniego ogniwa pozycja
   jest `CZĘŚCIOWO`.
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z21)** — realny router, realne serwisy;
   mockowanie ograniczone do `auth.middleware.js`, `Logger.js` i — wyłącznie
   w `§G` — `emailService.js`. Każdy inny mock wymaga wpisu w raporcie.
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query. Test
   wysyła obcą organizację w body i dostaje `404`/`403`, nie `200`.
9. **★ Kontrola negatywna roli** — żądanie bez wymaganej roli jest ODRZUCONE
   (`403`) **i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy przed
   i po).
10. **Realny PG w jednorazowym Dockerze** (port 5497, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (Z19), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem.
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem. Klucze i18n tworzysz **wyłącznie** dla napisów, które
> faktycznie wychodzą z Twojego API (kody i komunikaty błędów), i wtedy parytet
> PL+EN obowiązuje w tym samym commicie.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

Przed oddaniem raportu:

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/meeting.routes.ts`,
   `server/src/services/meetingBoundary/meetingBoundaryService.ts`,
   ewentualnie `server/src/services/meeting/meetingOccurrenceService.ts`.
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum
   (każde z jawnym KOMPLETEM env w tej samej linii tam, gdzie dotyka bazy — Z19):

   ```bash
   # --- pakiety bez bazy ---
   npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
   npx vitest run server/src/services/__tests__/meetingService.test.ts
   npx vitest run server/src/services/meeting/__tests__/meetingInvitationService.test.ts
   npx vitest run server/src/utils/ics/__tests__
   npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
   npx vitest run tests/unit/meeting

   # --- pakiety na realnym PG (KOMPLET czterech zmiennych w tej samej linii) ---
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run server/src/services/meetingBoundary/__tests__
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run server/src/services/meeting/__tests__
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run server/src/routes/__tests__/meeting.day10.records.routes.pg.test.ts
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run tests/integration/routes/meeting.day19.postgres.integration.test.ts
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run tests/integration/routes/meeting.materialization-retry.postgres.integration.test.ts
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run tests/integration/routes/meeting.decision-follow-up-records.postgres.integration.test.ts

   # --- konsumenci SPOZA Meetings, dotknięci przez §F (muszą zostać zielone) ---
   npx vitest run tests/unit/backend/services/taskService.test.ts
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
     npx vitest run server/src/services/myWork/__tests__

   # --- regresja frontu (NIE zmieniasz frontu, ale musi zostać jak było) ---
   npx vitest run src/components/Meeting/__tests__
   ```

   Pakiet `myWork/__tests__` i `taskService.test.ts` są w zakresie **nie
   dlatego, że je zmieniasz** (nie wolno Ci), tylko dlatego, że **muszą pozostać
   zielone** — to jest Twój dowód, że `§F` nie ruszył cudzego lejka.

4. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem `zastane / wprowadzone`
   i z liczbą SKIPPED:**
   ```
   Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
     czerwone ZASTANE (były czerwone na bazie, przed moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
     SKIPPED z powodu env: <lista> ← jeśli niepuste, pomiar jest CZĘŚCIOWY
   ```
   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   §0.4a = zawyżenie i podstawa odrzucenia** (`DEC-108`, P1 dnia 19).
   **Deklaracja „PASS" przy pakiecie w całości SKIPPED = to samo.**
5. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
6. **Baseline liczysz PRZED pierwszym commitem** (Blok 0 pkt 8) — inaczej nie
   masz jak odróżnić zastanego od wprowadzonego.

   **★ DWA ZNANE CZERWONE ZASTANE, zgłoszone przez dyżur dnia 19** — masz je
   potwierdzić albo obalić w baseline, **z komendą z KOMPLETEM czterech
   zmiennych**:

   | Plik                                                                                  | Objaw wg dnia 19                     | Co masz zrobić                                                                                       |
   | ------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
   | `server/src/services/meetingBoundary/__tests__/meetingBoundaryMountedAuth.pg.test.ts` | anonim oczekuje `401`, dostaje `200` | **§1.4 pkt 1 twierdzi, że to artefakt pomiaru, nie defekt.** Zmierz z `MOCK_DB=false` i rozstrzygnij |
   | `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx`                         | brak tekstu `Ship v2`                | Potwierdź jako zastane. **NIE naprawiasz** (front, Z17)                                              |

   Jeżeli pierwszy z nich **zzielenieje** przy poprawnym env — to jest wynik
   **cenny**: wpisujesz go do „Erraty" jako zamknięcie zastanego czerwonego
   przez poprawny pomiar, **bez zmiany kodu**, i mówisz to wprost.
   Jeżeli **nie zzielenieje** — masz realny defekt uwierzytelnienia, który jest
   **poza Twoim zakresem** (`auth.middleware.ts`, Z17): opisujesz go
   w „Znaleziskach", nie naprawiasz.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- zmienić `MODULE_MEETING: 'closed'` na `'open'` — to jest **odrzucenie
  dyżuru**, nie STOP;
- dotknąć `meetingInvitationService.ts` (`§G` to **test**, nie zmiana kodu),
  albo osłabić którąkolwiek asercję `not.toHaveBeenCalled()` na mailerze;
- dotknąć `effectiveAccessService.ts`, `artifactRegistryService.ts` albo
  `recurrenceEngine.ts` (Z16) — STOP **zawsze**, także „addytywnie";
- dodać `idempotencyKey` do `createInitiativeService` (H.2 Initiatives) —
  to jest **BRAK_API**, tak rozstrzygnięte w `DEC-108`, i tak zostaje;
- osłabić/usunąć asercję w teście istniejącym wcześniej (jeżeli test jest
  sprzeczny z nowym kontraktem — wzorzec FIX-2 dnia 19: **udowodnij wspólny
  korzeń, zaktualizuj TEST, wpisz przed/po do raportu**, nie usuwaj);
- przestawić kolejność `router.use(verifyToken); router.use(isAuthenticated);
router.use(closedBetaModuleGate);` (wywali
  `tests/unit/backend/middleware/meetingBetaGate.test.ts:42-45`);
- dodać migrację nieaddytywną, z kluczem obcym, albo z numerem **spoza
  przedziału `20261150`–`20261159`**;
- stworzyć flagę funkcyjną albo zmienić domyślną wartość istniejącej (Z10);
- wejść we `src/**` z zapisem (Z17) — **także po to, żeby „tylko pokazać nowe
  pole"**;
- wysłać cokolwiek na zewnątrz (Z22/DEC-65) — także „na `smtp.example.com`
  na próbę";
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
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

Meetings przeszedł trzy dyżury. Dzień 10 zbudował rdzeń (spotkania, decyzje,
follow-upy). Dzień 16 dołożył uczestników, ICS i wysyłkę ze strażnikami. Dzień 19
dołożył materializację notatek opcją B, edycję i odwoływanie serii, resolver
załączników.

**Każdy z nich zostawił dług dowodowy, nie dług funkcjonalny.** Odbiór dnia 19
(`DEC-108`) nazwał to precyzyjnie i to jest Twoja mapa:

- macierz dostępu `G.2` **nigdy nie została zrobiona w całości** — jest bramka
  8/8 w izolacji, nie ma macierzy realnego routera;
- testy tras dnia 16 chodzą na **zmockowanym `meetingService`**
  (`server/src/routes/__tests__/meeting.routes.test.ts:14`) — to nie jest dowód
  produkcyjny w rozumieniu Z21;
- test DST **był wymagany przez instrukcję dnia 19 i nie został dowieziony**;
- `materialTitle` w `GET /:id/notes` idzie **JOIN-em po samym `organization_id`**
  — użytkownik z odebranym dostępem do materiału i tak zobaczy tytuł;
- trasy `occurrence` **nie mają żadnej bramki roli**;
- funnel My Work **był do zbudowania** i nie został (STOP dotyczył wyłącznie
  Initiatives);
- częściowa awaria SMTP **jest zaimplementowana (FIX-7) i przetestowana tylko
  jednostkowo** — brak dowodu na realnym PG.

**Nie zaczynasz od zera i nie powtarzasz dni 16/19 — dowozisz ich dowody i pięć
konkretnych domknięć.**

### 1.2. ZAKRES — dokładnie siedem pozycji, nic więcej

| Poz.    | Nazwa                               | Stan zastany                                                                                     | Twój produkt                                                                                                      |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **A**   | **G.2 — macierz dostępu**           | Bramka 8/8 w izolacji; brak macierzy realnego routera                                            | Macierz rola × stan modułu × ścieżka × tenant × anonim na realnym routerze + **instrukcja otwarcia dla nadzorcy** |
| **B**   | **T — testy HTTP realnego routera** | Trasy dnia 16 testowane na zmockowanym `meetingService`; realny router pokryty tylko dla dnia 19 | Pakiet real-router/PG dla **wszystkich** tras dni 16 i 19 + **osobny pakiet negatywów tenanta**                   |
| **C**   | **Test DST rozszczepienia serii**   | Wymagany przez instrukcję dnia 19, niedowieziony                                                 | Dowód, że `UNTIL` jest poprawny w UTC przez granicę zmiany czasu; ewentualna errata do `recurrenceId`             |
| **D**   | **Luka `materialTitle`**            | JOIN po `organization_id`, bez `getArtifactForUser`                                              | Reguła U.4 zamknięta: odebrany dostęp → `materialTitle: null`, bez linku                                          |
| **E**   | **Bramka roli na `occurrence`**     | Tylko `getMeeting` + `canAccessMeeting`                                                          | Spójna bramka wg §E.2 (**UWAGA: errata — cel to NIE `requireMeetingAdmin` wszędzie**)                             |
| **F**   | **H.2 — funnel My Work**            | `TaskService.createTask` przyjmuje `idempotencyKey`; funnel nie istnieje                         | Punkt działania „notatka → zadanie My Work" z idempotencją i replayem                                             |
| **G**   | **Test częściowej awarii SMTP**     | FIX-7 dnia 16 w kodzie, test tylko jednostkowy                                                   | Test na realnym PG: jeden z N odbiorców `failed`, reszta dostarczona, wiersze `meeting_invitation_deliveries`     |
| **R.1** | `MODULE_ACCEPTANCE.md` 08_MEETINGS  | nie podniesiony o dzień 24                                                                       | Podniesienie o **faktycznie dowieziony** zakres                                                                   |

### 1.3. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `src/`** (poza odczytem `betaAccess.ts`). Ekrany Meetings, karta
   spotkania, lista uczestników, przycisk „odwołaj serię", polonizacja —
   **robotnicy wewnętrzni po prototypie i akcepcie właściciela**. Jeżeli Twoja
   praca wymaga zmiany frontu: **wypisujesz kontrakt w raporcie** (§1.6).
2. **★ OTWARCIE MODUŁU.** Bramka `closed` zostaje. Produktem pozycji `A` jest
   **instrukcja otwarcia**, nie otwarcie.
3. **★ REALNE WYSYŁKI.** Strażnicy `captured` / `blocked_demo` są nietykalni.
   `§G` dotyka gałęzi live **wyłącznie przez lokalny mock mailera** — §G.3.
4. **H.2 dla Initiatives.** `createInitiativeService` nie przyjmuje
   `idempotencyKey`; dodanie tego = Z17 i Z16. Pozostaje **`BRAK_API`**, tak
   rozstrzygnięte w `DEC-108`. **Nie ruszasz.**
5. **Publiczny link do materiału dla gościa zewnętrznego** — dzień 19 zgłosił
   STOP (brak modelu bezpiecznego share-linka). **Nadal STOP, nadal nie budujesz.**
6. **Nagrywanie i transkrypcja.** `MEETING_CAPTURE_POLICY`
   (`meeting.routes.ts:50-54`) jest kontraktem: `recordingEnabled: false`,
   `automaticTranscriptionEnabled: false`. Test kontraktowy
   `tests/unit/meeting/meetingCaptureDefaultOff.contract.test.ts` musi zostać
   zielony. **Nie dokładasz pól przyjmowanych przez `/generate-notes`** —
   whitelist `MANUAL_NOTE_FIELDS` jest zamknięta.
7. **Silnik AI notatek** (`meetingIntelligenceService`) — Z14.

### 1.4. ★★ ERRATA DO MATERIAŁU ŹRÓDŁOWEGO — przeczytaj, zanim uwierzysz zleceniu

Zlecenie, na podstawie którego powstała ta instrukcja, zawierało cztery
nieścisłości. **Zweryfikowałem je w kodzie na Twojej bazie.** Poniższe ustalenia
są wiążące i mają pierwszeństwo przed brzmieniem `DEC-108`/`DEC-111`.
**Twoim obowiązkiem jest zweryfikować je jeszcze raz** i zgłosić, gdyby stan
kodu się rozjechał — poprzedni dyżurni wyłapywali takie rzeczy i to podnosiło
jakość.

---

**1. „Zastane czerwone: anonim 401 → 200" NAJPRAWDOPODOBNIEJ NIE JEST DEFEKTEM
PRODUKTU, tylko artefaktem pomiaru.**

Dowód (przeczytaj te trzy miejsca sam):

```bash
sed -n '380,384p' tests/setup.ts        # MOCK_DB = process.env.MOCK_DB || 'true'
sed -n '542,573p' tests/setup.ts        # globalny mock auth.middleware.js
sed -n '79,90p'  server/src/database/Database.ts   # MOCK_DB === 'true' → mock DB BEZWARUNKOWO
```

`tests/setup.ts:542-573` mockuje `auth.middleware.js` globalnie. Logika mocka:

- jest nagłówek `Authorization` → woła **realny** `verifyToken`;
- **nie ma** nagłówka **i** `process.env.MOCK_DB !== 'false'` → wstrzykuje
  `req.user = { role: 'owner', isSuperAdmin: true, organizationId: 'test-org-id' }`
  i woła `next()`.

Raport dnia 19 podaje, że wszystkie przebiegi miały env
`DATABASE_URL=... RUN_DB_TESTS=1 NODE_ENV=test DB_TYPE=postgres` — **bez
`MOCK_DB=false`**. Wtedy `tests/setup.ts:382` ustawia `MOCK_DB='true'`, więc
anonimowy `GET /api/meeting` **z definicji** dostaje 200. To nie produkt
przepuszcza anonima — to harness.

**Co robisz:** w Bloku 0 mierzysz baseline **z kompletem czterech zmiennych**
i rozstrzygasz to jednoznacznie. Wynik (obojętnie który) jest obowiązkową
pozycją raportu i **wpływa bezpośrednio na wiersz „anonim" macierzy `A`** — bo
macierz mierzona bez `MOCK_DB=false` byłaby fikcją.

**Ostrzeżenie dodatkowe:** `Database.ts:81` mockuje bazę przy `MOCK_DB === 'true'`
**niezależnie od `RUN_DB_TESTS`**, podczas gdy synchroniczny `getDatabaseInstance()`
(`Database.ts:130-136`) honoruje `RUN_DB_TESTS=1` i zwraca realny Postgres. Przy
`MOCK_DB=true` masz więc **bazę mieszaną**: część ścieżek realna, część mock.
To jest dokładnie ten rodzaj cichego fałszu, który Z19 ma wykluczyć. **Cztery
zmienne. Zawsze.**

---

**2. Pozycja `E` — „`requireMeetingAdmin` na trasach occurrence, niespójne
z `DELETE /:id` i `PATCH /:id/status`" jest w połowie NIEPRAWDZIWA.**

`PATCH /:id/status` **nie używa** `requireMeetingAdmin`. Została z niego
**świadomie zdjęta** — `meeting.routes.ts:588-592`:

> FIX-M-3 (DEC-58 sceptyk, 2026-08-25): this route used to require
> `requireMeetingAdmin` (admin/owner/superadmin only). Relaxed to the same
> admin-OR-creator check `PUT /:id` already applies above.

Stan faktyczny bramek na mutacjach (sprawdź sam, `grep -n`):

| Trasa                                           | Bramka                          | Odmowa    |
| ----------------------------------------------- | ------------------------------- | --------- |
| `DELETE /:id`                                   | `requireMeetingAdmin` (`:567`)  | `403`     |
| `PUT /:id`                                      | admin **lub** twórca (`:388`)   | `404`     |
| `PATCH /:id/status`                             | admin **lub** twórca (`:600`)   | `404`     |
| `POST /:id/participants`                        | admin **lub** twórca (`:434`)   | `404`     |
| `POST /:id/invitations/send`                    | admin **lub** twórca (`:536`)   | **`403`** |
| `POST /:id/notes/:noteId/decision`              | `requireMeetingAdmin` (`:1027`) | `403`     |
| `POST /:id/notes/:noteId/materialization/retry` | `requireMeetingAdmin` (`:1075`) | `403`     |
| `PATCH /:id/occurrence`                         | **brak bramki roli**            | —         |
| `DELETE /:id/occurrence`                        | **brak bramki roli**            | —         |

Ślepe nałożenie `requireMeetingAdmin` na obie trasy `occurrence` cofnęłoby
dokładnie to, co sceptyk `DEC-58` już raz odkręcił. **Rozstrzygnięcie tej
instrukcji jest w §E.2** — i wymaga od Ciebie zapisania uzasadnienia w raporcie,
nie ślepego wykonania.

Przy okazji: kody odmowy **są niespójne** (`404` vs `403` przy tym samym
warunku). **Nie ujednolicasz ich w tym dyżurze** (zmieniłoby to kontrakt
istniejących tras i cudze testy) — **dokumentujesz je w macierzy `A`** jako
stan faktyczny.

---

**3. `idx_meeting_follow_ups_source_dedup` NIE JEST nośnikiem idempotencji dla
pozycji `F`.**

`server/migrations/20260826_meetings_day10_decisions.sql:41-48` — to unikat na
`(meeting_id, source_kind, COALESCE(source_note_id,''), source_index)`
`WHERE source_index IS NOT NULL`. Dedupuje **follow-upy wewnątrz Meetings**
tworzone z notatki. Funnel `F` tworzy **zadanie w My Work**, więc jego nośnikiem
idempotencji jest strona zadań:

```
server/migrations/20260804_m02a_tasks_tenant_idempotency.sql:52-54
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_idempotency_org
  ON tasks(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

plus zaimplementowany już replay w `TaskService.createTask`
(`server/src/services/TaskService.ts:139-150`): przy podanym `command` szuka
wiersza po `(organization_id, idempotency_key)`, przy niezgodności
`source_type`/`source_id` rzuca `TASK_IDEMPOTENCY_COLLISION`.

**Wniosek: pozycja `F` NIE POTRZEBUJE MIGRACJI.** Sprawdzasz to na swoim
kontenerze (`\di idx_tasks_idempotency_org`) i wpisujesz do raportu.

---

**4. Przedział migracji: „zajęte do 20261149" jest myląco sformułowane.**

Na Twojej bazie **najwyższa widoczna** migracja to `20261123`. Numery
`20261124`–`20261149` są **zarezerwowane dla dni 22–23 i prac wewnętrznych**,
których gałęzie **nie są jeszcze scalone** — dlatego `ls` ich nie pokaże.
**Nie bierzesz `20261124` „bo wolny".** Twój przedział to `20261150`–`20261159`
i najpewniej nie użyjesz żadnego numeru.

---

### 1.5. Mapa plików, które Cię obchodzą

```
TRASY
  server/src/routes/meeting.routes.ts                       1240 linii, 31 tras
    :50-54    MEETING_CAPTURE_POLICY (kontrakt: brak nagrywania)
    :82-101   statusForSpineErrorCode — mapowanie kodów kręgosłupa na HTTP
    :124-135  requireMeetingAdmin / isMeetingAdmin
    :143-152  canAccessMeeting (admin | twórca | uczestnik po id/e-mailu)
    :154-157  denyMeetingAccess — świadome 404 zamiast 403
    :181-224  validateRecurrenceRule — whitelist RRULE (FIX-2 dnia 16)
    :255-261  verifyToken → isAuthenticated → closedBetaModuleGate → ensureMeetingTables
    :992-1004 GET /:id/notes           ← pozycja D
    :1171-1229 handleOccurrenceMutation ← pozycje C, E
    :1231-1238 PATCH/DELETE /:id/occurrence

SERWISY
  server/src/services/meetingService.ts                     rdzeń dnia 10
  server/src/services/meeting/meetingDay16Service.ts        uczestnicy (NIE ruszasz)
  server/src/services/meeting/meetingInvitationService.ts   wysyłka + strażniki (NIE ruszasz; §G to test)
    :20-23    isLiveTransportEnabled — MEETING_INVITES_LIVE + SMTP_HOST + SMTP_USER
    :73-119   blocked_demo → captured → live (FIX-7: try/catch per odbiorca)
    :121-141  INSERT do meeting_invitation_deliveries z fallback:false
  server/src/services/meeting/meetingOccurrenceService.ts   serie
    :12-25    recurrenceUntilBefore / withUntil  ← pozycja C
    :54-81    scope='all' (FIX-1: recurrence_status='cancelled')
    :83-119   scope='this'
    :121-166  scope='this_and_following' (split + reparent wyjątków)
  server/src/services/meeting/meetingAttachmentService.ts   WZORZEC dla pozycji D
    :29-83    resolveAttachment — getArtifactForUser, accessible/title/href
  server/src/services/meetingBoundary/meetingBoundaryService.ts
    :269-296  getMeetingNote        ← pozycja D (JOIN a.title_snapshot, :282)
    :298-325  listMeetingNotesForMeeting ← pozycja D (JOIN a.title_snapshot, :311)

BRAMKI
  src/utils/betaAccess.ts:53                MODULE_MEETING: 'closed'  (TYLKO ODCZYT)
  server/src/middleware/betaGate.middleware.ts
    :27-47    createModuleGate(moduleId, resolveStatus)  ← wstrzykiwalny resolver
    :55-57    closedBetaModuleGate — woła createModuleGate BEZ resolvera  ← pułapka §A.3
  server/src/middleware/auth.middleware.ts:1224  verifyToken (TYLKO ODCZYT)
  server/src/Gateway.ts:769                 app.use('/api/meeting', meetingRoutes)

LEJEK MY WORK (pozycja F)
  server/src/services/TaskService.ts
    :19-30    CreateTaskSchema — UWAGA: projectId musi być UUID
    :110-114  createTask(input, userId, command?)
    :131-138  organization_id czytane z tabeli users (!)
    :139-150  replay po idempotency_key + TASK_IDEMPOTENCY_COLLISION
    :335-346  verifyProjectAccess — rzuca AuthorizationError
  server/src/services/myWork/agentApprovedMaterializationService.ts:230-238   WZORZEC

TESTY, KTÓRE MUSZĄ ZOSTAĆ ZIELONE
  server/src/services/meeting/__tests__/meetingDay16.pg.test.ts:166,182  strażnicy mailera
  tests/unit/backend/middleware/meetingBetaGate.test.ts:36-47            asercja na źródle routera
  tests/unit/meeting/meetingCaptureDefaultOff.contract.test.ts           kontrakt braku nagrywania
```

### 1.6. Podział FRONT / TYŁ — co robisz Ty, co robotnik frontowy

Ty budujesz **TYŁ**. Dla każdej pozycji, która zmienia kształt odpowiedzi API,
wpisujesz do raportu **kontrakt dla robotnika frontowego** w formacie:

```
| Trasa | Metoda | Body | Odpowiedź (pola) | Kody błędów | Co front ma pokazać |
```

W szczególności **musisz** dostarczyć kontrakt dla:

- `D` — `materialTitle` może być `null` mimo `materialArtifactId != null`
  (front **nie może** wtedy renderować linku do materiału);
- `E` — nowy kod odmowy na trasach `occurrence`;
- `F` — nowa trasa funnela wraz z semantyką `replayed`.

**Nie tworzysz kluczy i18n dla napisów UI.** Tworzysz je wyłącznie dla
komunikatów, które faktycznie wychodzą z Twojego API — i wtedy parytet PL+EN
w tym samym commicie.

### 1.7. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **Dzień 19, P0:** trasa zwracała `200` i rozsyłała `CANCEL`, nie zmieniwszy
   nic w bazie. **Lekcja:** dowód zmiany w bazie **przed** dowodem efektu.
2. **Dzień 19, P1:** „98/98 PASS" na wybranym podzbiorze przy 189/193
   w rzeczywistym zakresie. **Lekcja:** Z23, pełny zakres, rozbicie
   zastane/wprowadzone.
3. **Dzień 19, P1:** dwie regresje o wspólnym korzeniu (`targetRecordId`) —
   zmiana kontraktu była **poprawna**, testy nie zostały zaktualizowane.
   **Lekcja:** gdy Twój kontrakt jest lepszy, aktualizujesz **test** i wpisujesz
   przed/po; nie usuwasz asercji po cichu.
4. **Dzień 18, P0:** 8/8 testów zielonych nad martwym kodem, bo każdy
   wstrzykiwał własne zależności. **Lekcja:** Z21.
5. **Dzień 17:** pomiar wejściowy na cudzej bazie. **Lekcja:** Z19, dowód celu
   połączenia.
6. **Ten dyżur, nowa pułapka:** `projectId` w `CreateTaskSchema` jest walidowane
   jako **UUID**. Identyfikatory spotkań i organizacji w testach Meetings
   **nie są UUID-ami**. Ślepe przekazanie `meeting.projectId` do `createTask`
   wywali walidację zoda. Patrz §F.5.
7. **Ten dyżur, nowa pułapka:** `TaskService.createTask` czyta
   `organization_id` **z tabeli `users`** (`TaskService.ts:131-138`) i rzuca
   `NotFoundError('User organization')`, gdy wiersza nie ma. Testy Meetings
   w stylu dnia 19 **nie zakładają wierszy `users`** — mockują tylko nagłówki.
   Test funnela `F` **musi** założyć realne `organizations` + `users` (wzorzec:
   `meetingBoundaryMountedAuth.pg.test.ts:47-73`).

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Zależności — symlink, nie instalacja (`DEC-86`).**

   ```bash
   cd /private/tmp/consultify-meetings-day24
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules
   ls node_modules/.bin/vitest && echo "DEPS OK"
   ```

   To **jedyny** dozwolony kontakt z chronionym katalogiem (Z5), wyłącznie do
   odczytu. `npm ci` w worktree jest niewskazane.

2. **Kontener PG — NAJPIERW baza, POTEM jakikolwiek pomiar (Z19 / DEC-96).**

   ```bash
   docker run -d --name cx-day24-pg \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day24 \
     -p 5497:5432 pgvector/pgvector:pg16
   sleep 8
   docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "SELECT current_database(), inet_server_port();"
   ```

   **Obraz `pgvector/pgvector:pg16` jest OBOWIĄZKOWY.** `postgres:15` nie ma
   rozszerzenia `vector` i **nie przechodzi migracji** — cały pomiar poleci
   w gruz na losowym pliku i stracisz godzinę na diagnozę cudzego problemu.

3. **Pełne migracje projektu — dwa przebiegi + dry-run.**

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --strict 2>&1 | tail -20   # przebieg 1
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --strict 2>&1 | tail -5    # przebieg 2: MUSI być 0
   DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --dry-run 2>&1 | tail -5   # Pending: 0
   ```

   Liczby z przebiegów 1/2/dry są obowiązkową pozycją raportu (dzień 19 podał
   `842 / 0 / 0`).

4. **Sprawdzenie kluczowych obiektów, na których stoją Twoje pozycje.**

   ```bash
   docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "\d meetings"    | grep -E "recurrence_|split_from"
   docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "\d meeting_note_materializations"
   docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "\d meeting_invitation_deliveries"
   docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "\di idx_tasks_idempotency_org"
   docker exec cx-day24-pg psql -U postgres -d cx_day24 -c "\d v8_output_artifacts" | grep -E "title_snapshot|origin_record_id"
   ```

   Brak `idx_tasks_idempotency_org` → **STOP pozycji `F`** z wpisem (nie
   improwizujesz migracji bez zgody nadzorcy — patrz §0.3 pkt 5).

5. **Namespace migracji — sprawdź i zapisz.**

   ```bash
   ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5
   ls server/migrations | grep '^2026115'   # MUSI być puste
   ```

6. **Weryfikacja stanu wejściowego z §0.1 pkt 3** — wszystkie `grep`/`ls`,
   wynik do raportu.

7. **Inwentarz tras (produkt cząstkowy pozycji `A`, robisz go TERAZ).**

   ```bash
   grep -n "^router\.\(get\|post\|patch\|put\|delete\)" -A 1 server/src/routes/meeting.routes.ts
   ```

   Oczekiwane: **31 tras**. Jeżeli liczba się nie zgadza — wpis w „Korektach".

8. **★ BASELINE — PRZED pierwszym commitem, komplet komend §0.4a.**
   Zapisz liczby **per plik**. Bez tego nie odróżnisz zastanego od
   wprowadzonego i cały raport jest nieweryfikowalny (`DEC-108`, P1).
   Baseline uruchamiasz **z kompletem czterech zmiennych** — to jest moment,
   w którym rozstrzygasz erratę §1.4 pkt 1.

9. **Sprzątanie na końcu dyżuru (obowiązkowe, wpis do raportu):**

   ```bash
   docker rm -f cx-day24-pg
   docker volume prune -f
   ```

---

## A. G.2 — PEŁNA MACIERZ DOSTĘPU REALNEGO ROUTERA

### A.1. Co ma powstać

Dwa produkty:

1. **Macierz** — tabela w raporcie, wypełniona **zmierzonymi** kodami HTTP,
   nie przewidywanymi.
2. **Instrukcja otwarcia modułu** dla nadzorcy — dokładna sekwencja kroków
   i lista testów do przepuszczenia po flipie, **bez wykonywania flipa**.

### A.2. Wymiary macierzy

| Wymiar          | Wartości                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Rola**        | `anonim` · `USER` (członek org, nie uczestnik) · `USER` (uczestnik spotkania) · `USER` (twórca) · `ADMIN` · `OWNER` · `SUPERADMIN` |
| **Stan modułu** | `closed` (domyślny) · `open` (wstrzyknięty resolver — §A.3)                                                                        |
| **Tenant**      | własna organizacja · **obca organizacja** (ten sam identyfikator zasobu, inny token)                                               |
| **Ścieżka**     | reprezentanci pięciu klas — §A.4                                                                                                   |

Iloczyn pełny byłby nieczytelny. **Macierz obowiązkowa** to: 7 ról × 2 stany
modułu × 5 ścieżek reprezentatywnych = **70 komórek**, plus **5 komórek
tenanta obcego** (jedna na klasę ścieżki, rola `ADMIN` obcej organizacji).
Razem **75 zmierzonych komórek**.

### A.3. ★★ PUŁAPKA — jak wstrzyknąć stan `open`, NIE zmieniając domyślnej

Zlecenie mówi „open przez wstrzykiwany `resolveStatus`". **Sprawdź sam, zanim
zaczniesz:** parametr `resolveStatus` istnieje na `createModuleGate`
(`betaGate.middleware.ts:27-29`), ale trasa Meetings montuje
`closedBetaModuleGate` (`meeting.routes.ts:257`), które woła
`createModuleGate('MODULE_MEETING')` **bez żadnego parametru**
(`betaGate.middleware.ts:55-57`). **Nie ma więc szwu wstrzyknięcia na
zamontowanym routerze.** Zamontowanie własnego `createModuleGate(..., () => 'open')`
**przed** routerem niczego nie da — wewnętrzne `router.use(closedBetaModuleGate)`
i tak wykona się później i odmówi.

**Kolejność opcji, którą masz wykonać:**

- **Opcja 1 (preferowana):** lokalny `vi.mock` **modułu SSOT**, nie bramki:

  ```ts
  vi.mock('../../../src/utils/betaAccess.js', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return { ...actual, BETA_MENU_STATUS: { ...actual.BETA_MENU_STATUS, MODULE_MEETING: 'open' } };
  });
  ```

  Działa, bo domyślny resolver `createModuleGate` czyta `BETA_MENU_STATUS[id]`
  **przy każdym wywołaniu**, a nie raz przy imporcie. **Zero zmian w kodzie
  produkcyjnym.** Osobny plik testowy na stan `open` (mock modułowy jest
  per plik) — to jest cecha, nie wada: mieszanie obu stanów w jednym pliku
  byłoby mniej czytelne.

- **Opcja 2 (jeśli 1 nie zadziała):** lokalny `vi.mock` na
  `betaGate.middleware.js`, którego `closedBetaModuleGate` deleguje do
  **realnego** `createModuleGate('MODULE_MEETING', () => 'open')`. Wolno, bo
  mock jest lokalny (Z18 dotyczy mocków **globalnych**). **Musisz wtedy jawnie
  napisać w raporcie, że stan `open` jest mierzony przez mock bramki, więc
  komórki `open` dowodzą zachowania _routera przy otwartym module_, a nie
  samego mechanizmu bramki** — ten drugi ma własny, zielony pakiet
  `meetingBetaGate.test.ts`.

- **Opcja 3: STOP.** Jeżeli obie zawiodą — wpis STOP, macierz oddajesz
  wypełnioną **tylko dla `closed`**, jawnie oznaczając połowę `open` jako
  `NIEZMIERZONE`. **Nigdy** nie zmieniasz `betaAccess.ts`.

**Zakaz absolutny:** `sed`, patch, „tymczasowa zmiana i cofnięcie" na
`src/utils/betaAccess.ts`. Wykryjemy to w diffie i w reflogu.

### A.4. Pięć klas ścieżek (reprezentanci)

| Klasa                             | Reprezentant                         | Dlaczego reprezentatywny                          |
| --------------------------------- | ------------------------------------ | ------------------------------------------------- |
| **Odczyt listy**                  | `GET /api/meeting`                   | filtrowanie `canAccessMeeting` po stronie serwera |
| **Odczyt obiektu**                | `GET /api/meeting/:id/notes`         | `canAccessMeeting` + `denyMeetingAccess` (404)    |
| **Mutacja miękka**                | `PATCH /api/meeting/:id/status`      | admin **lub** twórca, odmowa `404`                |
| **Mutacja twarda**                | `DELETE /api/meeting/:id`            | `requireMeetingAdmin`, odmowa `403`               |
| **Mutacja z efektem na zewnątrz** | `DELETE /api/meeting/:id/occurrence` | bramka roli po pozycji `E` + wysyłka `CANCEL`     |

### A.5. Jak mierzysz (Z21)

Realny router, realna baza, **realne wiersze `users`/`organizations`
i realne tokeny JWT** — wzorzec `meetingBoundaryMountedAuth.pg.test.ts:30-73`,
nie skrót nagłówkowy z dnia 19. Uzasadnienie: macierz ma odpowiadać na pytanie
„co dostanie prawdziwy człowiek z przeglądarki", a skrót nagłówkowy omija realny
`verifyToken` i **nie umie zmierzyć wiersza `anonim`**.

Komórka `anonim` mierzona **bez** nagłówka `Authorization`, przy `MOCK_DB=false`
(patrz errata §1.4 pkt 1).

### A.6. DoD pozycji A

1. 75 zmierzonych komórek w raporcie, każda z faktycznym kodem HTTP.
2. Plik testowy (albo dwa — `closed` i `open`) w
   `tests/integration/routes/meeting.day24.access-matrix.postgres.integration.test.ts`
   (`git add -f`), realny router + realny PG, **każda komórka to asercja**.
3. Ani jednej komórki `200` dla obcej organizacji.
4. Jawny wpis: które komórki są `NIEZMIERZONE` i dlaczego.
5. **Instrukcja otwarcia modułu** — sekcja raportu w formacie:
   ```
   1. Plik i linia do zmiany: src/utils/betaAccess.ts:53 ('closed' → 'open')
   2. Testy do przepuszczenia PO zmianie, w tej kolejności: <lista komend>
   3. Komórki macierzy, które ZMIENIĄ wynik: <lista>
   4. Czego zmiana NIE robi: <np. nie rusza BETA_ADMINS_EXEMPT, nie otwiera frontu>
   5. Jak cofnąć: <jedna linia>
   ```
6. **Moduł pozostaje `closed`** — dowód `grep -n "MODULE_MEETING" src/utils/betaAccess.ts`
   w raporcie, na końcu dyżuru.

---

## B. T — TESTY HTTP REALNEGO ROUTERA NA REALNYM PG DLA WSZYSTKICH TRAS DNI 16 i 19

### B.1. Dług, który zamykasz

`server/src/routes/__tests__/meeting.routes.test.ts:14` mockuje **cały**
`meetingService`. Wszystkie trasy dnia 16 (uczestnicy, wysyłka) mają więc pokrycie
**nad atrapą**. To jest dokładnie wzorzec, za który dzień 18 dostał P0
(`DEC-107`, Z21). Dzień 19 pokrył realnym routerem tylko własne trasy.

**Nie usuwasz i nie osłabiasz `meeting.routes.test.ts`** — on testuje warstwę
walidacji i ma zostać. **Dokładasz** pakiet real-router/PG obok.

### B.2. Zakres — wszystkie trasy dni 16 i 19

**Dzień 16 (uczestnicy + wysyłka):**

```
GET    /api/meeting/:id/participants
POST   /api/meeting/:id/participants
PATCH  /api/meeting/:id/participants/:participantId
DELETE /api/meeting/:id/participants/:participantId
POST   /api/meeting/:id/invitations/send
```

**Dzień 19 (notatki, załączniki, serie):**

```
GET    /api/meeting/:id/notes
POST   /api/meeting/:id/notes/:noteId/decision
POST   /api/meeting/:id/notes/:noteId/materialization/retry
GET    /api/meeting/:id/attachments
POST   /api/meeting/:id/attachments
DELETE /api/meeting/:id/attachments/:attachmentId
PATCH  /api/meeting/:id/occurrence
DELETE /api/meeting/:id/occurrence
```

**13 tras. Każda ma mieć minimum cztery przypadki** (happy · błąd · pusty ·
negatyw tenanta). Trasy, które mają już pokrycie real-router/PG z dnia 19
(`occurrence` PATCH/DELETE, `notes/decision`, `materialization/retry`) —
**sprawdzasz, czy komplet czterech jest spełniony**, i uzupełniasz brakujące
przypadki zamiast dublować istniejące. **Dublowanie liczy się jako zawyżenie.**

### B.3. Osobny pakiet negatywów tenanta

Drugi plik, wyłącznie o izolacji:
`tests/integration/routes/meeting.day24.tenant-negatives.postgres.integration.test.ts`.

Dla **każdej z 13 tras**:

1. zasób powstaje w organizacji A;
2. żądanie idzie z tokenem organizacji B, z **tym samym identyfikatorem** zasobu
   w URL;
3. asercja: `404` albo `403` (wg macierzy `A`), **nigdy `200`**;
4. **asercja mutacyjna**: `SELECT count(*)` z niezależnego `pg.Pool` **przed
   i po** — dla mutacji liczba się **nie zmienia**;
5. dodatkowo dla tras z ciałem żądania: wysyłasz `organizationId` **obcej**
   organizacji w body i sprawdzasz, że serwer go **ignoruje** (bierze org
   z tokenu).

**★ Dowód mutacyjny testu (wymóg `DEC-107`):** dla **co najmniej dwóch** tras
wykonujesz lokalnie **neutralizację filtru organizacji** w kodzie serwisu,
potwierdzasz, że Twój test **czerwienieje**, **cofasz zmianę** i wpisujesz to
do raportu. Test, którego neutralizacja filtru nie wywala, jest bezzębny —
dokładnie tak dzień 18 dostał P1.

### B.4. DoD pozycji B

1. Dwa nowe pliki (`git add -f`), realny router + realny PG.
2. Tabela w raporcie: `trasa × {happy, błąd, pusty, negatyw tenanta} × wynik`,
   13 wierszy, bez pustych komórek.
3. Dowód mutacyjny dla ≥2 tras (przed/po, z cytatem zmiany).
4. `meeting.routes.test.ts` **nietknięty i zielony**.
5. Zero realnych wysyłek — `POST /:id/invitations/send` mierzony w organizacji
   nie-demo, bez `MEETING_INVITES_LIVE` → oczekiwany status `captured`
   i **asercja, że mailer nie był wołany**.

---

## C. TEST DST DLA ROZSZCZEPIENIA SERII

### C.1. Czego dotyczy

`scope='this_and_following'` ucina oryginalną serię przez dopisanie `UNTIL=`
do reguły (`meetingOccurrenceService.ts:20-25`), a wartość `UNTIL` liczy
`recurrenceUntilBefore` (`:12-18`): `new Date(recurrenceId) - 1s`, potem
`toISOString()` z usuniętymi separatorami i milisekundami — czyli forma
`YYYYMMDDTHHMMSSZ`, **w UTC**.

Instrukcja dnia 19 wymagała dowodu, że to jest poprawne **przez granicę zmiany
czasu**. Dowodu nie ma.

### C.2. Scenariusz obowiązkowy

Seria cotygodniowa w strefie **`Europe/Warsaw`**, przechodząca przez koniec
czasu letniego **2026-10-25** (przejście CEST → CET, UTC+2 → UTC+1):

1. Utwórz spotkanie: `startAt` w połowie października, `timezone: 'Europe/Warsaw'`,
   `recurrenceRule: 'FREQ=WEEKLY;COUNT=8'`.
2. Wykonaj `PATCH /:id/occurrence` ze `scope: 'this_and_following'`
   i `recurrenceId` wskazującym **pierwszą okazję PO zmianie czasu**
   (listopadową), podanym jako **instant w UTC** (`...Z`).
3. Odczytaj `recurrence_rule` mastera **niezależnym `pg.Pool`**.
4. **Asercje:**
   - `UNTIL` kończy się na `Z` (jest w UTC);
   - wartość `UNTIL` to **dokładnie** `recurrenceId − 1 s` wyrażone w UTC —
     policz ją w teście z `Date`, nie wpisuj literału „na oko";
   - `UNTIL` **nie jest przesunięty o godzinę** względem tej wartości
     (to jest sedno testu — błąd DST objawiłby się dokładnie tak);
   - nowy master ma `split_from_meeting_id = <id mastera>`
     i `recurrence_parent_id IS NULL`;
   - **powtórz cały scenariusz z drugą serią przechodzącą przez początek czasu
     letniego (2027-03-28, CET → CEST)** — kierunek przesunięcia jest odwrotny
     i tylko dwa kierunki razem dowodzą, że nie ma stałego offsetu.

### C.3. ★ Drugi test w tej samej pozycji — `recurrenceId` bez strefy

To jest realne ryzyko, które masz **zmierzyć i opisać**, a nie założyć.
`recurrenceUntilBefore` woła `new Date(recurrenceId)`. Dla ciągu ISO **bez**
sufiksu strefy (`'2026-11-01T08:00:00'`) JavaScript interpretuje wartość jako
**czas lokalny procesu**, więc `UNTIL` przesunie się o offset maszyny, na której
działa serwer.

**Co robisz:**

1. napisz test, który wysyła `recurrenceId` **bez** strefy i **odczytuje
   faktyczny `UNTIL`** z bazy;
2. uruchom ten sam test dwa razy: raz `TZ=UTC`, raz `TZ=Europe/Warsaw`
   (zmienna w tej samej linii komendy);
3. jeżeli wyniki się **różnią** — masz udowodnioną zależność od strefy procesu.
   **To jest znalezisko, nie automatyczna naprawa** — patrz §C.4.

### C.4. Decyzja o naprawie — ostrożnie

Jeżeli §C.3 udowodni zależność od strefy procesu, masz **dwie** ścieżki
i **wybierasz jedną, uzasadniając ją w raporcie**:

- **(a) Walidacja na wejściu (preferowana, addytywna).** `handleOccurrenceMutation`
  (`meeting.routes.ts:1175-1186`) już waliduje `recurrenceId` na CR/LF. Dokładasz
  wymóg jawnej strefy (sufiks `Z` albo `±HH:MM`) → `400 INVALID_OCCURRENCE`.
  Ryzyko: **złamanie istniejących wywołań**. Sprawdź `grep -rn "recurrenceId"`
  po `src/` i testach; jeżeli **jakikolwiek** istniejący test lub kod frontu
  wysyła wartość bez strefy — **to jest STOP**, nie „napraw i popraw cudzy test".
- **(b) Sam test + errata.** Zostawiasz kod, dowozisz test dokumentujący
  zachowanie i wpisujesz to jako otwarte znalezisko z propozycją kontraktu dla
  frontu.

**Zakaz:** dotykania `recurrenceEngine.ts` (Z16) i przeliczania stref w
`meetingOccurrenceService` „przy okazji". Konwersja strefowa to osobna decyzja
produktowa.

### C.5. DoD pozycji C

1. Plik `tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts`
   (`git add -f`), realny router + realny PG.
2. Oba kierunki DST (jesień 2026 i wiosna 2027), po komplecie asercji.
3. Wynik testu `TZ=UTC` vs `TZ=Europe/Warsaw` dla `recurrenceId` bez strefy —
   dwie liczby w raporcie.
4. Jawna decyzja (a) albo (b) z uzasadnieniem.
5. `meeting.occurrence-cancel.postgres.integration.test.ts` **nadal 3/3**.

---

## D. LUKA `materialTitle` — ZAMKNIĘCIE WG REGUŁY U.4

### D.1. Defekt (potwierdzony w kodzie)

`meetingBoundaryService.ts:282` i `:311` — obie ścieżki odczytu notatek
podnoszą tytuł materiału tak:

```sql
LEFT JOIN v8_output_artifacts a
  ON a.artifact_id = mm.artifact_id AND a.organization_id = n.organization_id
```

Warunek to **wyłącznie zgodność organizacji**. Użytkownik, któremu **odebrano
dostęp** do materiału (grant cofnięty, wypadł z projektu), nadal dostanie
`materialTitle` w odpowiedzi `GET /:id/notes` i `POST /:id/notes/:noteId/decision`.

Reguła U.4, odebrana pozytywnie dla załączników (`DEC-108`: „resolver dla
załączników poprawny — `title`/`href` = `null` po odebraniu dostępu, brak zwrotu
`title_snapshot`"), tu **nie jest zastosowana**.

### D.2. Wzorzec do skopiowania

`server/src/services/meeting/meetingAttachmentService.ts:29-83` —
`resolveAttachment`:

```ts
const artifact = await getArtifactForUser({
  organizationId, artifactId, userId, roleKey,
});
if (artifact) { accessible = true; title = ...; href = ...; }
// zwraca title: accessible ? title : null, href: accessible ? href : null
```

`getArtifactForUser` (`server/src/services/v8/artifactRegistryService.ts:3210-3236`)
sprawdza granty i przynależność do projektu. **Wołasz go, nie zmieniasz** (Z16).

### D.3. Co budujesz

1. **Obie** funkcje odczytu w `meetingBoundaryService.ts` przyjmują dodatkowo
   `userId` i `roleKey` (parametry **opcjonalne z wartością domyślną**, żeby nie
   wywalić istniejących wywołań — sprawdź `grep -rn "listMeetingNotesForMeeting\|getMeetingNote" server/src`
   i wypisz wszystkich wołających do raportu).
2. `material_title` **przestaje wychodzić z JOIN-a** jako wartość końcowa.
   Kolejność: JOIN dalej podnosi `title_snapshot` (potrzebny jako fallback dla
   ścieżki uprzywilejowanej), ale zwracane `materialTitle` przechodzi przez
   resolver.
3. **Kontrakt (identyczny jak dla załączników):** brak dostępu →
   `materialTitle: null`. `materialArtifactId` **zostaje** (to identyfikator,
   nie treść — front i tak nie wyrenderuje linku bez tytułu), ale **musisz to
   jawnie rozstrzygnąć i zapisać w raporcie**; jeżeli uznasz, że identyfikator
   też jest przeciekiem — zeruj oba i napisz dlaczego.
4. **★ Wydajność:** `listMeetingNotesForMeeting` zwraca N notatek. Naiwne
   wołanie `getArtifactForUser` w pętli to N × (backfill + granty + projekty).
   **Wymóg:** rozwiązujesz **tylko unikalne, niepuste `material_artifact_id`**
   i cache'ujesz wynik w obrębie jednego wywołania (`Map<artifactId, item|null>`).
   Liczbę wywołań resolvera **mierzysz spy'em w teście** i wpisujesz do raportu
   (`N notatek, K unikalnych materiałów → K wywołań`). Bez tego pozycja jest
   `CZĘŚCIOWO` — dzień 21 dostał P1 za burzę autoryzacyjną O(3N)
   (`DEC-104`, znalezisko 4).

### D.4. Testy (minimum sześć)

| #   | Przypadek                                                  | Oczekiwanie                                            |
| --- | ---------------------------------------------------------- | ------------------------------------------------------ |
| 1   | notatka zmaterializowana, użytkownik **ma** dostęp         | `materialTitle` = realny tytuł z `v8_output_artifacts` |
| 2   | notatka zmaterializowana, dostęp **odebrany**              | `materialTitle: null`                                  |
| 3   | notatka niezmaterializowana                                | `materialTitle: null`, `materialArtifactId: null`      |
| 4   | obca organizacja                                           | `404`, zero wycieku tytułu                             |
| 5   | `POST /:id/notes/:noteId/decision` (druga ścieżka odczytu) | ta sama reguła co w `GET /:id/notes`                   |
| 6   | N notatek, K unikalnych materiałów                         | dokładnie K wywołań resolvera (spy)                    |

Wszystkie na realnym routerze i realnym PG.

### D.5. DoD pozycji D

1. Obie ścieżki odczytu zamknięte (nie tylko `GET /:id/notes` — zlecenie
   wymienia jedną, w kodzie są dwie; to jest errata do zapisania).
2. Sześć testów wyżej, zielone.
3. Dowód „przed": test cofnięty do stanu sprzed naprawy **odtwarza wyciek**
   (wzorzec FIX-ów dnia 19 — `DEC-111`: „każdy z ODTWORZENIEM BŁĘDU PRZED
   NAPRAWĄ jako dowodem").
4. Pomiar liczby wywołań resolvera.
5. Kontrakt dla frontu (§1.6).
6. Lista wszystkich wołających obu funkcji, z potwierdzeniem, że żaden się nie
   wywalił.

---

## E. BRAMKA ROLI NA TRASACH `occurrence`

### E.1. Stan faktyczny

`handleOccurrenceMutation` (`meeting.routes.ts:1171-1229`) robi
`getMeeting` + `canAccessMeeting` — czyli **każdy uczestnik** spotkania (także
zwykły `USER`, wpisany jako attendee) może:

- przesunąć całą serię (`scope: 'all'`),
- rozszczepić serię,
- **odwołać serię** i spowodować rozesłanie `METHOD:CANCEL` do wszystkich.

To jest szersze niż jakakolwiek inna mutacja w tym routerze.

### E.2. ★ ROZSTRZYGNIĘCIE (czytaj erratę §1.4 pkt 2 przed wykonaniem)

Zlecenie mówi „`requireMeetingAdmin` na trasach occurrence, dla spójności
z `DELETE /:id` i `PATCH /:id/status`". **`PATCH /:id/status` tej bramki nie ma
— została z niego świadomie zdjęta przez `FIX-M-3` pod `DEC-58`.** Ślepe
wykonanie zlecenia cofnęłoby cudzą, odebraną decyzję.

**Wykonujesz podział wg dotkliwości, nie wg jednej bramki dla obu tras:**

| Trasa                    | Bramka do nałożenia                                 | Uzasadnienie                                                                                                                              |
| ------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PATCH /:id/occurrence`  | **admin LUB twórca spotkania** (wzorzec `PUT /:id`) | Edycja serii to ta sama klasa co edycja spotkania; `DEC-58` już rozstrzygnął, że edycja własnego spotkania nie wymaga admina              |
| `DELETE /:id/occurrence` | **`requireMeetingAdmin`** (wzorzec `DELETE /:id`)   | Odwołanie serii jest destrukcyjne **i ma efekt na zewnątrz** (`CANCEL` do wszystkich uczestników) — ta sama klasa co skasowanie spotkania |

**Kod odmowy:** dla `PATCH` — `denyMeetingAccess` (`404`), spójnie z `PUT /:id`
i `PATCH /:id/status`. Dla `DELETE` — `403` z `requireMeetingAdmin`, spójnie
z `DELETE /:id`.

**Uzasadnienie tego podziału jest OBOWIĄZKOWĄ pozycją raportu.** Jeżeli uważasz,
że podział jest zły — **STOP z kontraktem**, nie cicha zmiana. Nadzorca
rozstrzygnie.

### E.3. Implementacja

`handleOccurrenceMutation` przyjmuje już parametr `cancel: boolean`.
Bramkę nakładasz **po** `getMeeting` i `canAccessMeeting` (żeby nieistniejące
i cudze spotkanie dalej dawało `404`, nie `403` — inaczej `403` staje się
oraklem istnienia zasobu):

```
meeting = getMeeting(...)
if (!meeting || !canAccessMeeting(...)) → 404          // bez zmian
if (cancel && !requireMeetingAdmin(req, res)) return    // DELETE
if (!cancel && !isMeetingAdmin(req) && meeting.createdBy !== userId) → 404   // PATCH
```

**Uwaga na kolejność `router.use(...)`** — nie dodajesz nowego `router.use`
przed trzema istniejącymi (§0.3, test `meetingBetaGate.test.ts:42-45`).

### E.4. Testy (minimum osiem)

| #   | Rola × trasa                                      | Oczekiwanie                            |
| --- | ------------------------------------------------- | -------------------------------------- |
| 1   | `ADMIN`, `PATCH`                                  | `200`, zmiana w bazie                  |
| 2   | twórca (`USER`), `PATCH`                          | `200`, zmiana w bazie                  |
| 3   | uczestnik nie-twórca (`USER`), `PATCH`            | `404`, **zero zmian w bazie**          |
| 4   | `ADMIN`, `DELETE`                                 | `200`, `recurrence_status='cancelled'` |
| 5   | twórca (`USER`), `DELETE`                         | `403`, **zero zmian w bazie**          |
| 6   | uczestnik nie-twórca (`USER`), `DELETE`           | `403`, **zero zmian w bazie**          |
| 7   | obca organizacja, obie trasy                      | `404`, zero zmian                      |
| 8   | odmowa **nie wysyła zaproszeń** (spy na mailerze) | `sendMeetingInvitations` niewołane     |

Przypadek 8 jest krytyczny (Z22): odmowa, po której poszedłby `CANCEL`, byłaby
tą samą klasą błędu co P0 dnia 19.

### E.5. DoD pozycji E

1. Obie trasy zabramkowane wg §E.2.
2. Osiem testów wyżej, realny router + realny PG.
3. Dowód „zero zmian w bazie" liczbą wierszy przed/po dla każdej odmowy.
4. Uzasadnienie podziału w raporcie.
5. `meeting.occurrence-cancel.postgres.integration.test.ts` i
   `meeting.day19.postgres.integration.test.ts` **nadal zielone** — one wołają
   te trasy z rolą `administrator`, więc powinny przejść; **jeżeli nie
   przechodzą, to znaczy, że Twoja bramka jest za szeroka.**
6. Kontrakt dla frontu (nowy kod odmowy).

---

## F. H.2 — FUNNEL „NOTATKA → ZADANIE MY WORK" Z IDEMPOTENCJĄ

### F.1. Co jest, a czego nie ma

`TaskService.createTask` **przyjmuje** trzeci argument `command`
(`TaskService.ts:110-114`) z `idempotencyKey`/`sourceType`/`sourceId` i ma
gotowy replay (`:139-150`). Potwierdził to dzień 19 i potwierdza `DEC-111`.
**Nie ma punktu wejścia**, który by go użył dla Meetings.

`createInitiativeService` `idempotencyKey` **nie przyjmuje** — H.2 dla
Initiatives pozostaje **`BRAK_API`** (Z17: dodanie = zmiana cudzego serwisu).
**Nie ruszasz.**

### F.2. Kontrakt trasy

```
POST /api/meeting/:id/notes/:noteId/action-items/:index/task
```

- **Warunek wstępny:** notatka istnieje w tej organizacji i tym spotkaniu,
  ma `status: 'approved'`. Notatka `proposed`/`rejected` → `409` z kodem
  `NOTE_NOT_APPROVED` (mapowanie przez istniejące
  `statusForSpineErrorCode`, gdzie `NOT_APPROVED` → `409`).
- **`:index`** wskazuje pozycję w `actionItems` notatki. Poza zakresem →
  `404 ACTION_ITEM_NOT_FOUND`.
- **Bramka roli:** `requireMeetingAdmin` — ta sama co
  `POST /:id/notes/:noteId/decision` (zatwierdzanie treści AI do systemu pracy
  jest tą samą klasą działania).
- **Odpowiedź `200`:** `{ task: { id, title, status }, replayed: boolean }`.
- **`replayed: true`** przy powtórzeniu z tym samym kluczem — **bez drugiego
  wiersza w `tasks`**.
- **`409 TASK_IDEMPOTENCY_COLLISION`** gdy `TaskService` wykryje ten sam klucz
  z innym źródłem.

### F.3. Klucz idempotencji

Wzorzec z `agentApprovedMaterializationService.ts:226-238`:

```
idempotencyKey = `meeting-note-action:${noteId}:${index}`
sourceType     = 'meeting_note_action_item'
sourceId       = `${meetingId}:${noteId}:${index}`
```

Klucz jest **deterministyczny z tożsamości źródła**, nie losowy. Unikat
`idx_tasks_idempotency_org` na `(organization_id, idempotency_key)` daje
gwarancję także pod współbieżnością.

### F.4. Brak migracji

Potwierdzone w §1.4 pkt 3: nośnik istnieje. **Nie dodajesz migracji.**
Powiązanie zwrotne (zadanie → notatka) niesie `tasks.source_type` /
`tasks.source_id`, zapisywane przez sam `createTask` (`TaskService.ts:156,174-175`).
Jeżeli uznasz, że potrzebujesz **własnej tabeli powiązań po stronie Meetings** —
to jest **STOP z uzasadnieniem**, nie migracja „na wszelki wypadek".

### F.5. ★★ TRZY PUŁAPKI, które wywalą Ci ten punkt

1. **`projectId` musi być UUID.** `CreateTaskSchema.projectId` to
   `z.string().uuid().optional().nullable()` (`TaskService.ts:20`).
   `meeting.projectId` w Meetings **nie musi** być UUID-em. **Przekazujesz
   `projectId` tylko wtedy, gdy przechodzi walidację UUID; w przeciwnym razie
   `null`.** Zapisz tę decyzję w raporcie.
2. **`organization_id` czytane z tabeli `users`.** `TaskService.ts:131-138`
   robi `SELECT organization_id FROM users WHERE id = $1` i rzuca
   `NotFoundError('User organization')`, gdy wiersza nie ma. Twój test **musi**
   założyć realne wiersze `organizations` + `users` (wzorzec
   `meetingBoundaryMountedAuth.pg.test.ts:47-73`), a nie tylko mockować
   nagłówki jak dzień 19. **To jest też dowód tenanta:** organizacja zadania
   pochodzi z `users`, nie z body.
3. **`verifyProjectAccess` rzuca `AuthorizationError`** (`TaskService.ts:335-346`)
   przy `projectId` bez członkostwa. Mapujesz to na `403`, nie na `500`.
   Test obowiązkowy.

### F.6. Zakaz rozszerzania

- **Nie budujesz** wariantu dla Initiatives (`BRAK_API`).
- **Nie tworzysz** funnela „notatka → decyzja" ani „notatka → notatnik", mimo
  że `agentApprovedMaterializationService` je ma. Jedna trasa, jeden cel.
- **Nie ruszasz** `meeting_follow_ups` — follow-upy Meetings to inny obiekt niż
  zadanie My Work i mieszanie ich to osobna decyzja produktowa.

### F.7. Testy (minimum siedem), wszystkie real-router + real-PG

| #   | Przypadek                                    | Oczekiwanie                                                 |
| --- | -------------------------------------------- | ----------------------------------------------------------- |
| 1   | notatka `approved`, indeks poprawny, `ADMIN` | `200`, wiersz w `tasks` (readback niezależnym `pg.Pool`)    |
| 2   | powtórzenie tego samego żądania              | `200`, `replayed: true`, **`count(*)` w `tasks` bez zmian** |
| 3   | notatka `proposed`                           | `409 NOTE_NOT_APPROVED`, **zero wierszy w `tasks`**         |
| 4   | notatka `rejected`                           | `409 NOTE_NOT_APPROVED`, **zero wierszy**                   |
| 5   | indeks poza zakresem                         | `404 ACTION_ITEM_NOT_FOUND`, zero wierszy                   |
| 6   | rola `USER`                                  | `403`, zero wierszy                                         |
| 7   | obca organizacja (ten sam `noteId`)          | `404`, zero wierszy                                         |

Dodatkowo **test współbieżności**: dwa równoległe żądania z tym samym kluczem →
dokładnie **jeden** wiersz w `tasks`, obie odpowiedzi `200`. (Wzorzec:
`meeting.day19` sprawdza `replayed` sekwencyjnie; tu potrzebny `Promise.all`.)

### F.8. DoD pozycji F

1. Nowy serwis `server/src/services/meeting/meetingNoteTaskFunnelService.ts`
   - trasa w `meeting.routes.ts`.
2. Siedem testów + test współbieżności, zielone.
3. **Dowód osiągalności (Z20)** pełną ścieżką, z ostatnim ogniwem: **którą
   listą My Work to zadanie zostanie podniesione** (plik:linia zapytania, które
   je zwróci). Bez tego pozycja jest `CZĘŚCIOWO` — zadanie, którego My Work nie
   pokazuje, jest funkcjonalnie niewidoczne.
4. `server/src/services/myWork/__tests__` i `taskService.test.ts` **zielone**.
5. Kontrakt dla frontu.
6. Jawny wpis: **Initiatives = `BRAK_API`**, z jednozdaniowym powodem.

---

## G. TEST CZĘŚCIOWEJ AWARII SMTP (I.2 z dnia 16)

### G.1. Co już jest

`meetingInvitationService.ts:96-119` (FIX-7 dnia 16): `sendEmail` jest w
`try/catch` **wewnątrz pętli po odbiorcach**, więc wyjątek dla jednego odbiorcy
daje mu `status: 'failed'` i **nie przerywa** pętli. Test jednostkowy istnieje:
`server/src/services/meeting/__tests__/meetingInvitationService.test.ts`
(2 przypadki, wszystko zmockowane).

**Brakuje dowodu na realnym PG** — czyli że `setParticipantDelivery`
i `INSERT INTO meeting_invitation_deliveries` faktycznie zapisują właściwe
statusy dla właściwych uczestników.

### G.2. Scenariusz

1. Realne PG, realny router, spotkanie z **organizatorem + trzema odbiorcami**.
2. `emailService.send` mockowany **lokalnie** tak, że rzuca **wyłącznie** dla
   drugiego odbiorcy, a dla pozostałych zwraca `true`.
3. `POST /:id/invitations/send`.
4. **Asercje na odpowiedzi:** trzy wpisy `deliveries`; drugi ma
   `status: 'failed'` i `error`; pierwszy i trzeci `status: 'sent'`.
5. **Asercje na bazie (niezależny `pg.Pool`, to jest sedno):**
   - `meeting_invitation_deliveries` ma **trzy** wiersze dla tej próby, ze
     statusami w tej samej kolejności i z niepustym `error` **tylko** dla
     drugiego;
   - `meeting_participants.delivery_status` (przez `setParticipantDelivery`)
     zgadza się per uczestnik;
   - `sequence` we wszystkich trzech wierszach jest **taki sam**.
6. **Test odwrotności:** awaria **pierwszego** odbiorcy — pozostali dwaj i tak
   dostają wiersze. (Bez tego nie wiadomo, czy pętla nie kończy się po prostu
   na końcu listy.)

### G.3. ★★ JAK DOTKNĄĆ GAŁĘZI LIVE, NIE ŁAMIĄC DEC-65

Gałąź `sendEmail` jest osiągalna **tylko** gdy `isLiveTransportEnabled()`
(`:20-23`) zwróci `true`, czyli `MEETING_INVITES_LIVE === 'true'`
**i** `SMTP_HOST` **i** `SMTP_USER`. Reguły bezwzględne:

1. **`emailService.send` MUSI być zamockowany LOKALNIE w Twoim pliku testowym**
   (`vi.mock('../../services/emailService.js', ...)`) **zanim** ustawisz
   cokolwiek w env. Wzorzec: `meetingInvitationService.test.ts:24-26`.
2. **`SMTP_HOST` ustawiasz na wartość niemarszrutowalną**, np.
   `smtp.example.invalid` — TLD `.invalid` jest zarezerwowany i nie rozwiąże
   się w DNS. **Nigdy** realny host.
3. Env ustawiasz **w `beforeEach`/`beforeAll` swojego pliku**, przywracasz
   w `afterEach`/`afterAll`. **Nigdy** w linii komendy i **nigdy** globalnie —
   inaczej zatrujesz inne pakiety w tym samym przebiegu.
4. **`DEMO_ORG_ID` nie ustawiasz**, a organizacja testowa **nie może** się
   nazywać `demo-org` (domyślna wartość, `:41`) — inaczej wpadniesz w gałąź
   `blocked_demo` i nie zmierzysz niczego.
5. **Strażnicy zostają zielone.** Po skończeniu pozycji uruchamiasz
   `server/src/services/meeting/__tests__/meetingDay16.pg.test.ts` i pokazujesz
   w raporcie, że asercje `not.toHaveBeenCalled()` (`:166`, `:182`) dalej
   przechodzą. **Nie zmieniasz `meetingInvitationService.ts`** — ta pozycja to
   **test**, nie zmiana kodu.
6. **Zero realnych wysyłek.** W raporcie oświadczasz to jawnie, z listą
   ustawionych zmiennych i miejscem ich ustawienia.

Jeżeli dojdziesz do wniosku, że gałęzi live nie da się dotknąć bezpiecznie —
**STOP z uzasadnieniem**. Lepszy uczciwy STOP niż wysłany e-mail.

### G.4. DoD pozycji G

1. Plik `tests/integration/routes/meeting.day24.smtp-partial-failure.postgres.integration.test.ts`
   (`git add -f`), realny router + realny PG, mock **wyłącznie** mailera
   (+ `auth.middleware`/`Logger` wg wzorca).
2. Dwa scenariusze (awaria drugiego, awaria pierwszego), po komplecie asercji
   bazodanowych.
3. Dowód, że `meetingInvitationService.ts` **nie został zmieniony**
   (`git diff codex/m03-admin-20260824...HEAD -- server/src/services/meeting/meetingInvitationService.ts`
   → **pusty**).
4. Strażniki dnia 16 zielone, z cytatem wyniku.
5. Oświadczenie o braku realnej wysyłki.

---

## R.1. `MODULE_ACCEPTANCE.md` — 08_MEETINGS

Podnosisz **wyłącznie o faktycznie dowieziony zakres**. Dzień 19 dostał pochwałę
za to, że jego diff w tym pliku „dodaje dokładnie jeden token: `CZĘŚCIOWO`"
(`DEC-108`). Trzymaj ten poziom.

- Jedna nowa linia (albo aktualizacja istniejącej linii `DAY19-*`) z zakresem
  dnia 24, z **prawdziwymi** statusami per pozycja.
- **Zakaz** podnoszenia `MTG-OWNER-01` (odbiór właściciela, `OWNER_GATE_PENDING`)
  — to nie Twoja bramka.
- **Zakaz** wpisywania czegokolwiek o otwarciu modułu.
- Jeżeli struktura pliku nie ma miejsca na atomowy wpis — **STOP z opisem**
  (wzorzec: STOP `R.1` dnia 18 uznany za zasadny, `DEC-107`).

---

## 2. SZABLON RAPORTU

Plik: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY24_REPORT_20260826.md`

```markdown
# Meetings dzień 24 (blok 3) — raport dyżuru 20260826

Baza: `codex/m03-admin-20260824` @ «MARKER_SHA»
Marker: POTWIERDZONY / BRAK
Gałąź: `codex/meetings-day24-<data>`
Worktree: `/private/tmp/consultify-meetings-day24`
Port PG: 5497 · obraz: pgvector/pgvector:pg16 · kontener `cx-day24-pg` usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

## Dowód celu połączenia (Z19/DEC-96)

<dosłowny wynik SELECT current_database(), inet_server_port()>
<komplet CZTERECH zmiennych, którym poprzedzasz każdy przebieg DB>

## Warunki wstępne

| Warunek | Wynik |
| Marker | |
| Dzień 16 + FIX-1..9 | |
| Dzień 19 + FIX-1..4 | |
| Ledger (177 linii, DEC-87/92/98/108/111) | |
| Migracje bazowe (przebieg 1 / 2 / dry) | |
| Namespace 20261150-20261159 wolny | |
| Baseline §0.4a PRZED pierwszym commitem | |
| Rozstrzygnięcie erraty §1.4 pkt 1 (anonim 401/200) | |

## Pozycje — tabela zbiorcza

| Pozycja | Status | Commit | Dowód (jedno zdanie) |
| A (macierz G.2) | | | |
| B (testy HTTP + negatywy tenanta) | | | |
| C (DST) | | | |
| D (materialTitle) | | | |
| E (bramka occurrence) | | | |
| F (funnel My Work) | | | |
| G (częściowa awaria SMTP) | | | |
| R.1 | | | |

Statusy dozwolone: ZROBIONE_WG_DoD · CZĘŚCIOWO · BRAK_API · STOP · NIE_ZACZĘTE.

## A — macierz dostępu (75 komórek)

<tabela: rola × stan modułu × ścieżka × kod HTTP; osobno negatywy tenanta>

### Instrukcja otwarcia modułu dla nadzorcy (5 punktów wg §A.6)

### Jak zmierzono stan `open` (opcja 1/2/3 z §A.3)

## B — pokrycie 13 tras

<tabela: trasa × {happy, błąd, pusty, negatyw tenanta}>

### Dowód mutacyjny (≥2 trasy): co zneutralizowano, co się zapaliło

## C — DST

| Kierunek | recurrenceId | UNTIL zmierzony | UNTIL oczekiwany | Wynik |

### recurrenceId bez strefy: TZ=UTC vs TZ=Europe/Warsaw

### Decyzja (a) walidacja / (b) test+errata — uzasadnienie

## D — materialTitle

| Przypadek | Przed | Po | Dowód |

### Odtworzenie wycieku przed naprawą

### Pomiar wywołań resolvera (N notatek, K materiałów, K wywołań)

### Wołający obu funkcji

## E — bramka occurrence

| Rola × trasa | Kod | Zmiana w bazie | Wysyłka |

### Uzasadnienie podziału PATCH/DELETE (errata §1.4 pkt 2)

## F — funnel My Work

### Dowód osiągalności (Z20) z ostatnim ogniwem: gdzie My Work to podnosi

### Idempotencja: sekwencyjna + współbieżna

### Initiatives: BRAK_API — powód

## G — częściowa awaria SMTP

### Dowód pustego diffu meetingInvitationService.ts

### Strażniki day16 zielone (cytat)

### Oświadczenie: zero realnych wysyłek, lista zmiennych i miejsce ustawienia

## Kontrakt dla frontu

| Trasa | Metoda | Body | Odpowiedź | Błędy | Co front ma pokazać |

## Migracje

<„brak migracji — nośnik idempotencji istnieje: idx_tasks_idempotency_org, dowód \di" ALBO plik + trzy przebiegi>

## Testy — pomiar §0.4a (Z23)

Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
czerwone ZASTANE: <lista>
czerwone WPROWADZONE: <lista + SHA>
SKIPPED z powodu env: <lista>
ZASIĘG PEŁNY / CZĘŚCIOWY (+ co pominięto i dlaczego)

## Errata i korekty wobec instrukcji

<w tym potwierdzenie/obalenie czterech punktów §1.4>

## Znaleziska (NIE naprawiane przeze mnie)

## STOP-y

### STOP — <pozycja>

Powód: / Dowód: / Co zrobiłbym przy decyzji X: / Stan:

## Bezpieczniki — dowody

- Z5 (chroniony checkout):
- Z10 (zero flag): `git diff ... -- src/utils/betaAccess.ts` → pusty
- Z16 (nietykalne): `git diff ...` na effectiveAccessService/artifactRegistryService/recurrenceEngine → pusty
- Z17 (licencje): pusty diff na KAŻDYM pliku licencjonowanym
- Z18 (globalna infra testowa): `git diff ... -- tests/setup.ts tests/helpers tests/__mocks__ vitest*.config.ts server/vitest*.ts` → pusty
- DEC-65 (wysyłka): zero realnych e-maili, strażniki zielone
- Moduł nadal `closed`: `grep -n "MODULE_MEETING" src/utils/betaAccess.ts`

## Licznik

<N pozycji: X ZROBIONE_WG_DoD, Y CZĘŚCIOWO, Z BRAK_API/STOP>. Moduł NIE został otwarty.

## Czego NIE zrobiłem i dlaczego
```

---

## 3. LISTA KONTROLNA PRZED ODDANIEM

Odhacz **każdy** punkt. Brak odhaczenia = raport niekompletny.

- [ ] Marker zweryfikowany; gałąź z markera; zero rebase.
- [ ] Kontener `pgvector/pgvector:pg16` na porcie 5497; migracje 3 przebiegi;
      dowód celu połączenia w raporcie.
- [ ] **Każdy** przebieg DB miał **CZTERY** zmienne w tej samej linii.
- [ ] Baseline policzony **przed** pierwszym commitem.
- [ ] Errata §1.4 pkt 1 (anonim 401/200) **rozstrzygnięta** i opisana.
- [ ] Errata §1.4 pkt 2 (`PATCH /:id/status` bez `requireMeetingAdmin`)
      potwierdzona; podział bramek z §E.2 uzasadniony.
- [ ] Errata §1.4 pkt 3 (`idx_meeting_follow_ups_source_dedup` ≠ nośnik
      idempotencji `F`) potwierdzona; `\di idx_tasks_idempotency_org` w raporcie.
- [ ] Errata §1.4 pkt 4 (przedział migracji) potwierdzona; `ls | grep '^2026115'`
      pusty przed ewentualnym plikiem.
- [ ] Commit per pozycja; `prettier` przed każdym commitem.
- [ ] Nowe pliki w `tests/` dodane przez `git add -f`.
- [ ] Każda nowa powierzchnia ma ≥4 testy zachowania, w tym negatyw tenanta.
- [ ] Każda pozycja ma dowód osiągalności (Z20) **z ostatnim ogniwem**.
- [ ] Dowód mutacyjny dla ≥2 tras (§B.3).
- [ ] Odtworzenie błędu przed naprawą dla `D` (i `E`, jeśli dotyczy).
- [ ] `meeting.routes.test.ts`, `meetingBetaGate.test.ts`,
      `meetingCaptureDefaultOff.contract.test.ts` — **nietknięte i zielone**.
- [ ] `meetingDay16.pg.test.ts:166,182` — strażniki mailera **zielone**.
- [ ] `meetingInvitationService.ts` — **pusty diff**.
- [ ] `src/**` — **pusty diff** (poza brakiem zmian; odczyt `betaAccess.ts` ok).
- [ ] `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
      `vitest*.config.ts`, `server/vitest*.ts` — **pusty diff**.
- [ ] `MODULE_MEETING: 'closed'` — bez zmian, `grep` w raporcie.
- [ ] Zero nowych flag; zero zmian domyślnych.
- [ ] Zero realnych wysyłek e-mail; oświadczenie w raporcie.
- [ ] Zero Railway, zero zdalnych migracji, zero zapisów do wspólnej bazy.
- [ ] Pomiar §0.4a **bez zawężania**, z rozbiciem zastane/wprowadzone i SKIPPED.
- [ ] `ZASIĘG PEŁNY` albo `CZĘŚCIOWY` z wyliczeniem pominięć.
- [ ] Kontrakt dla frontu wypisany dla `D`, `E`, `F`.
- [ ] Kontener i wolumeny sprzątnięte.
- [ ] Raport zawiera sekcję „Czego NIE zrobiłem i dlaczego".
- [ ] **Zero `git push` na `origin`.** Ewentualny push tylko na `github-backup`,
      tylko własnej gałęzi, tylko na koniec.

---

## 4. JEDNO ZDANIE NA KONIEC

Ten dyżur nie dokłada Meetings funkcji — **dokłada mu dowodów**. Dwa poprzednie
bloki zbudowały mechanikę i oba zostały wstrzymane na odbiorze za to, że
**dowód był słabszy niż deklaracja**. Twoja robota jest zrobiona dobrze wtedy,
gdy nadzorca może odtworzyć każdą Twoją liczbę jedną komendą z Twojego raportu —
a nie wtedy, gdy tabela jest pełna zielonych znaczków.
