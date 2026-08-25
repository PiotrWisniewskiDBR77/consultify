# INSTRUKCJA DYŻURU nr 15 — Codex — „Superadmin fala 2 + bramki bezpieczeństwa: domknięcie 11 operacji P33, audyt zawieszenia organizacji, trzy niebezpieczne endpointy, uniwersalny audyt mutacji admina"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–14. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

Data wystawienia: 2026-08-25.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Poprzednie dyżury: Admin/Superadmin (nr 1–2), My Work (nr 3), Results
i Finance (nr 4), Initiatives (nr 5), Szablony (nr 6), Assessment (nr 7),
Results c.d. (nr 8), Initiatives c.d. (nr 9), Meetings (nr 10), Execution
(nr 11), Partner (nr 12), Interview Creator (nr 13), Audits (nr 14).

**Ten dyżur kontynuuje dokładnie JEDEN z nich: dyżur nr 2, sekcję C
(„Superadmin fala 1", `DEC-2026-08-25-18`).** Reszta zakresu to cztery
pozycje MUST z rejestru werdyktu trójkąta: `TRI-MUST-07`, `TRI-MUST-08`,
`TRI-MUST-11`, `TRI-MUST-12`.

**Uwaga o warstwach — przeczytaj, żeby się nie pomylić.**

| Warstwa                              | Trasy runtime   | Kto tam wchodzi             | Rejestr odbiorowy                                     |
| ------------------------------------ | --------------- | --------------------------- | ----------------------------------------------------- |
| **Superadmin** (konsola platformowa) | `/superadmin/*` | wyłącznie rola `SUPERADMIN` | **brak karty odbioru** — osobny tor prac (patrz §1.2) |
| **Admin** (panel tenanta)            | `/admin/*`      | OWNER/ADMIN organizacji     | `modules/14_ADMIN/MODULE_ACCEPTANCE.md`               |
| **Settings**                         | `/settings/*`   | każdy zalogowany            | `modules/15_SETTINGS/`                                |

`SUPERADMIN` **nie dziedziczy** `/admin/*` — to jest świadoma decyzja P0
(`ADM-RAW-P0-001`), potwierdzona w runtime. Nie zmieniasz tego. Ekran
`health/platform-operations` w **Adminie klienta** (`AdminSettingsModule.tsx`,
`CAN_ACCESS_PLATFORM_OPERATIONS = false`) to **coś zupełnie innego** niż
zakładka `platform-operations` w `/superadmin/system`, którą rozbudowujesz.
Nie myl ich, nie linkuj jednego do drugiego, nie odblokowuj tej stałej.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Ten dyżur to MECHANIKA TYLNA. Backend + wiring. Ekrany budujesz WYŁĄCZNIE
tam, gdzie powłoka już istnieje.**

Konkretnie:

1. **Jedyna powłoka, którą wolno Ci rozbudować, to istniejący ekran
   `PlatformOperationsView.tsx`** (zakładka `platform-operations`
   w `/superadmin/system`, zbudowana w fali 1 commitem `894aa3b016`).
   Rozbudowa = dołożenie kart akcji do istniejącego układu, nie nowa powłoka.
2. **Żadnego nowego ekranu, żadnej nowej sekcji w sidebarze, żadnej nowej
   zakładki w innym module.** Jeżeli pozycja wymagałaby nowego ekranu — to
   jest **STOP**, nie improwizacja.
3. **Jeżeli mimo wszystko powstanie NOWA powierzchnia wizualna** (nowa karta
   akcji z własnym układem, nowy dialog, nowa tabela), to:
   - idzie **za flagą domyślnie OFF** (wzorzec: `src/utils/myWorkCalendarV2Flag.ts`
     — query `?ff_*` / localStorage / env, `?? false` na końcu);
   - **przechodzi obowiązkowy WEWNĘTRZNY POLISH-PASS** (§P.6) **wykonany
     przez Ciebie**, zanim ktokolwiek ją zobaczy. Polish-pass = zrzut własny
     light + dark + PL + EN + lista czekowania z §P.6, wynik w raporcie.
   - **Właściciel nigdy nie jest pierwszym testerem wizualnym** (CLAUDE.md
     reguła 7). Twoja rola kończy się na „gotowe do zrzutu przez nadzorcę".
4. **Wszystko, co budujesz, musi być realne.** Kontrolka bez działającego
   API **nie powstaje** — zamiast niej idzie wpis `BRAK_API` do raportu.
   Przycisk, który „na razie nic nie robi", jest gorszy niż jego brak.
5. **`effectiveAccessService` = Z16, NIETYKALNY.** Model uprawnień ról
   naprawiany jest in-house. Wolno **czytać** i **cytować w raporcie**.
6. **FREEZE (`DEC-2026-08-25-65`) obowiązuje przez cały dyżur.** Zero
   deployów, zero Railway, zero zdalnych migracji/seedów/resetów, zero
   zapisów do wspólnej bazy demo. Migracje: `MIGRATION_PREPARED` +
   `REMOTE_EXECUTION_NOT_AUTHORIZED` + test kompatybilności wstecz
   z zamrożonym demo. Szczegóły w §0.3.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości
reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

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
   Nie improwizuj bazy. Nie startuj z `origin/demo`, nie startuj z `main`,
   nie startuj z `Londyn`, nie startuj z żadnej gałęzi `codex/preserve-*`
   ani `codex/wave3-16-module-acceptance-*`. Załóż raport, wpisz pozycję STOP
   z wynikiem obu komend powyżej i zakończ dyżur. To jedyna dopuszczalna
   reakcja.

   Powód twardości: `codex/m03-admin-20260824` niesie **komplet materiałów
   wiążących tego dyżuru** — werdykt trójkąta z MUST-ami 07/08/11/12,
   raport kompletności superadmina, rejestr decyzji z `DEC-2026-08-25-18`
   i `DEC-2026-08-25-65`, oraz **cały dorobek fali 1** (ekran
   `PlatformOperationsView`, warunkowe potwierdzenie statusu organizacji).
   Praca poza tą bazą = zbudowanie fali 2 na nieistniejącej fali 1.

3. **Sprawdź, że materiały wiążące faktycznie widzisz** (warunek wstępny,
   nie formalność):

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md   # oczekiwane 185
   grep -n "TRI-MUST-07\|TRI-MUST-08\|TRI-MUST-11" docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md  # oczekiwane 334
   grep -n "TRI-MUST-12" docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md
   grep -n "DEC-2026-08-25-65" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   wc -l src/views/superadmin/PlatformOperationsView.tsx        # oczekiwane ~310 (fala 1)
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/ADMIN55_DAY2_REPORT_2026-08-25.md
   ```

   Brak któregokolwiek = **STOP**. W szczególności brak
   `PlatformOperationsView.tsx` oznacza, że **nie jesteś na gałęzi z falą 1**
   i cały §P nie ma na czym stanąć.

4. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/superadmin-day15-<data> codex/m03-admin-20260824
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD` — np.
   `codex/superadmin-day15-20260826`.)

5. Pracujesz we **własnym worktree**, nigdy w cudzym:

   ```bash
   git worktree add /private/tmp/consultify-superadmin-day15 codex/superadmin-day15-<data>
   cd /private/tmp/consultify-superadmin-day15
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                              | Dlaczego                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — w ogóle, na żadną gałąź                                                                                                                                                                                                                                                                                                                                                       | Push wykonuje wyłącznie nadzorca sesji głównej; dodatkowo trwa FREEZE (`DEC-65`)                                                                                  |
| Z2      | **Nie dotykasz `origin/demo`** ani lokalnego `demo`, ani `Londyn`, ani `develop`, ani `main`                                                                                                                                                                                                                                                                                                                       | `demo` = święta, ZAMROŻONA baza deployu (`DEC-65`)                                                                                                                |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**                                                                                                                                                                                                                                                                                                                  | Krach 3/4 powstał dokładnie tak                                                                                                                                   |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików oznaczonych `PRESERVED_PRODUCT_WIP` / `NO_COPY` w `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md`                                                                                                                                                                                                                                      | Wymagania są **już** przełożone na rejestr uwag i decyzje                                                                                                         |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git diff`, ani `cat`, ani `grep -r`**                                                                                                                                                                                                                                                                  | Chroniony, brudny worktree właściciela                                                                                                                            |
| Z6      | **Nie dotykasz cudzych worktree** — w szczególności `/private/tmp/consultify-m03-admin`, `/private/tmp/consultify-admin55-*`, `/private/tmp/consultify-day2-*`, `/private/tmp/consultify-day1[0-4]-*`, `/private/tmp/consultify-creator-day13`, `/private/tmp/consultify-audits-*`, `/private/tmp/consultify-demo-hardening-20260825`, `/private/tmp/consultify-day15-instrukcja` (worktree autora tej instrukcji) | Część jest w użyciu przez równoległe dyżury; nadpisanie kasuje cudze dowody                                                                                       |
| Z7      | **Nie zajmujesz portów 3100, 3200, 3987, 3997, 4017, 4067, 4312, 4418, 4428, 5000, 5037, 5432, 5433, 5435, 8080, 8081, 8099** ani portów 4280–4310 (dyżury 4–13)                                                                                                                                                                                                                                                   | 3987 = sesja nadzorcza; 5432/5433/5435 = żywe bazy. Twoje porty: **4340/4341** (runtime), **4342** (jednorazowy PostgreSQL)                                       |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak zmiennych env, brak redeployu, brak logów produkcyjnych, brak odczytu projektu `a6d59e88-263d-45f3-96bc-861f66bf467b`                                                                                                                                                                                                                                     | FREEZE `DEC-65`: „stop operacji chmurowych"                                                                                                                       |
| Z9      | **Żadnej bazy poza jednorazowym lokalnym kontenerem.** Nigdy baza demo/staging/produkcyjna, nigdy cudza retained-DB                                                                                                                                                                                                                                                                                                | „Dane demo = twarz produktu" + FREEZE zakazuje zapisów do wspólnej bazy                                                                                           |
| **Z10** | **Zero nowych flag funkcyjnych POZA jedną, jawnie dopuszczoną w §P.5** (flaga nowej powierzchni, domyślnie OFF). Zero zmian wartości domyślnej JAKIEJKOLWIEK istniejącej flagi. Zero zmian `CAN_ACCESS_PLATFORM_OPERATIONS = false` w Adminie klienta                                                                                                                                                              | CLAUDE.md reguła 9 (zakaz masowego włączania)                                                                                                                     |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`**, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts` ani `src/views/superadmin/SuperAdminView.tsx` w części synchronizacji `currentView ↔ URL` (`:83-95`)                                                                                                                                                                                                | Decyzja P0 + znany wyścig nawigacyjny naprawiany in-house (§1.6)                                                                                                  |
| **Z12** | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY15_REPORT_20260826.md`. Żadnego innego dokumentu — także żadnej „karty odbioru superadmina" (to jest decyzja właściciela, nie Twoja)                                                                                                                                           | Repo tonie w dokumentach-duchach                                                                                                                                  |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** ani werdyktów w `TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md` / `SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md`. Wolno je **czytać i cytować**                                                                                                                                                                                                    | Rejestry są `SIGNED / FINAL`                                                                                                                                      |
| **Z14** | **Nie budujesz egzekwowania polityk bezpieczeństwa, których dziś nie ma.** `platform/mfa-override` i `platform/sso-override` zapisują wyłącznie klucz w tabeli `settings` — **nikt tego klucza nie czyta**. Nie dopisujesz konsumenta. Twoim produktem jest UI nad istniejącym zapisem **z uczciwą etykietą** albo `STOP` (§P.3)                                                                                   | To jest dokładnie `TRI-MUST-02` (przełączniki-placebo). Zbudowanie drugiego placebo = odrzucenie pozycji                                                          |
| **Z15** | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** W szczególności `src/components/SuperAdmin/data/DataExportPanel.tsx:69` **świadomie** jest wyłączony z uczciwym komunikatem — nie „naprawiasz" go przez podpięcie czegokolwiek bez pozycji z §P                                                                                                                                              | Uczciwy pusty stan > udawany ekran                                                                                                                                |
| **Z16** | **Nie dotykasz `server/src/services/**/effectiveAccessService*`**, `server/src/middleware/superAdmin.middleware.ts` w części definicji capability (`:43-49`, `:168-170`), `server/src/services/frameworkEntitlementService.ts` ani żadnego pliku definiującego capability ról. Wolno **czytać** i **cytować w raporcie**                                                                                           | Model uprawnień naprawiany in-house (`TRI-MUST-13`, wildcard ADMIN). Dopisanie capability do trasy P33 = §P.4, i to jest JEDYNY dozwolony dotyk warstwy uprawnień |
| **Z17** | **★ Zakaz wszystkiego poza zakresem tego dyżuru.** Ostra granica w ramce poniżej                                                                                                                                                                                                                                                                                                                                   | Program konsolidacji jest „jeden obszar na raz"                                                                                                                   |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config.ts`, `server/vitest.config.v8-db.ts`, ani żadnego mocka/helpera współdzielonego przez całe repo. **Naruszenie Z18 = automatyczne odrzucenie CAŁEGO dyżuru**            | **Lekcja z odbioru dnia 2:** Codex po cichu zmienił globalny mock w `tests/setup.ts` i wywalił **27 testów w cudzych modułach**                                   |

**Zasięg Z18 — konkretnie, bo to jest zakaz, który najłatwiej złamać
„w dobrej wierze".**

```
tests/setup.ts                     ← plik, na którym poległ dyżur nr 2
tests/helpers/**                   (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts
vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

**Co robisz, gdy potrzebujesz innego zachowania mocka.** Dokładnie jedno
z dwóch, zawsze **opt-in, nigdy globalnie**:

1. **`vi.mock` lokalnie w Twoim pliku testowym** — mock żyje i umiera razem
   z tym jednym plikiem;
2. **dedykowany helper w NOWYM pliku**, importowany jawnie tylko przez Twoje
   testy (np. `server/src/routes/__tests__/day15SuperadminHarness.ts`).

**Nie wolno**: „tylko dodam jedno pole do globalnego mocka", „to jest
addytywne, nic nie zepsuje", „inaczej mój test nie przejdzie". Jeśli Twój
test nie przechodzi bez zmiany globalnego mocka — to jest **STOP**.

**Zasięg Z17 — konkretnie. Granica jest ostra i przebiega tak:**

```
WOLNO (Twój zakres):
  server/src/routes/superadmin.routes.ts                  (§P.1 katalogi celów, §P.4 capability)
  server/src/routes/security.routes.ts                    (§S.1, §S.2 — trasy sesji)
  server/src/routes/admin-data.routes.ts                  (§S.3 — kontrola org na 4 trasach)
  server/src/routes/access-control.routes.ts              (§S.4 — trasa tenant-scoped)
  server/src/routes/adminP32.routes.ts                    (§A.1 — WYŁĄCZNIE ekstrakcja logAction)
  server/src/services/adminAudit*                         (§A.1, §A.2 — pisarz audytu)
  server/src/middleware/adminAudit*.middleware.ts         (NOWY plik, §A.2)
  server/src/routes/<mutacje admina bez audytu>           (§A.3 — WYŁĄCZNIE dopięcie audytu)
  server/src/controllers/SuperAdminController.ts          (§T.1 — WYŁĄCZNIE weryfikacja, patrz STOP)
  server/migrations/20260826_day15_*.sql                  (NOWE pliki, nazwa wg §0.3)
  src/views/superadmin/PlatformOperationsView.tsx         (§P.2, §P.5, §P.6)
  src/services/superadminPlatformOperationsApi.ts         (§P.1, §P.2)
  src/views/superadmin/SystemModule.tsx                   (WYŁĄCZNIE gdyby §P wymagało — patrz §P.5)
  public/locales/{pl,en}/translation.json                 (TYLKO klucze superadmin.platformOperations.* i admin.audit.*)
  src/utils/<nowa flaga>.ts                               (§P.5, JEDNA, domyślnie OFF)
  tests/integration/**  ·  server/src/**/__tests__/**     (NOWE pliki)
  docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY15_REPORT_20260826.md   (jedyny nowy dokument)

NIE WOLNO:
  server/src/services/**/effectiveAccessService*          ← Z16
  server/src/middleware/superAdmin.middleware.ts :43-49 :168-170  ← Z16 (definicja capability)
  src/views/superadmin/SuperAdminView.tsx  ·  src/components/layout/SuperAdminSidebar.tsx
  src/routes/AppRoutes.tsx  ·  src/routes/routeConfig.ts  ·  src/components/ProtectedRoute.tsx
  src/views/admin/AdminSettingsModule.tsx                 ← CAN_ACCESS_PLATFORM_OPERATIONS zostaje false
  src/components/standard/**  ·  src/components/MyWork/shared/ConfirmDialog  ← WOLNO UŻYWAĆ, NIE ZMIENIAĆ
  jakikolwiek moduł tenanta (Meetings, My Work, Initiatives, Results, Finance,
  Assessment, Interview, Execution, Audits, Partner, Chat, Tools, Materials)
  tests/e2e/**  ·  tests/acceptance/**                    ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
czego dokładnie brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej
linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Nie zbiorcze
  „wire superadmin everywhere".
- **Conventional commits**, wzór:
  ```
  feat(superadmin): platform target catalogs for gated actions (P.1)
  feat(superadmin): expose remaining P33 operator actions (P.2)
  fix(security): tenant-safe session routes with role guard (S.1, S.2)
  fix(admin-data): resolve organization from the token, never from the URL (S.3)
  feat(admin): universal audit trail for admin mutations (A.2)
  test(security): request-level cross-org negatives for admin surfaces (T.3)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem.**
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest`
  repo.** Punktowo, np.:
  ```bash
  npx vitest run src/views/superadmin/__tests__
  npx vitest run server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts
  npx vitest run tests/integration/routes/<Twój nowy pakiet>
  ```
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**:
  happy path · ścieżka błędu (4xx/5xx z API) · pusty stan · **negatyw
  cross-org na warstwie żądania** (obcy `organizationId` dostaje 403/404,
  nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `expect(source).toContain('...')`, **nie liczy się do DoD**.
  W tym repo takie testy istnieją — m.in.
  `src/views/superadmin/__tests__/SystemModule.platformOperations.test.ts:10`
  (asercja na tekście źródła `switch`) — i wolno Ci je zostawić, ale
  **każda Twoja pozycja musi mieć co najmniej jeden test, który wywołuje
  realny handler / renderuje realny komponent i sprawdza WYNIK.**
- **★ NEGATYWY CROSS-ORG NA WARSTWIE SIECI, NIE NA WARSTWIE FUNKCJI.**
  Test, który woła handler bezpośrednio z podstawionym `req`, **nie jest
  dowodem izolacji** — obchodzi cały łańcuch montowania routera.
  Dowodem jest `supertest` przeciwko realnie zmontowanej aplikacji Express,
  z realnym tokenem drugiej organizacji. Wzorzec do skopiowania podaje §T.3.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok
  kodu w `src/` i `server/src/` dodają się normalnie.
- **Sprawdzanie typów punktowo**, nie całe repo:
  ```bash
  npx tsc --noEmit -p tsconfig.json    # ZAKAZANE (godziny, wyczerpuje stertę)
  npx esbuild src/views/superadmin/PlatformOperationsView.tsx --loader:.tsx=tsx --outfile=/dev/null   # OK
  ```
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`,
     `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`.
     **Zakaz** `DROP`, `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`,
     bezwarunkowego `UPDATE`.
  2. **Nazewnictwo:** `server/migrations/20260826_day15_<temat>.sql`.
     Pułapka sortowania: `migrate.postgres.ts` stosuje migracje w **zwykłym
     porządku alfabetycznym nazw plików**, nie chronologicznym. Nie dodajesz
     **żadnego** klucza obcego do tabel sortujących się później.
  3. **★ FREEZE (`DEC-65`) — status migracji.** Każda migracja tego dyżuru
     jest oznaczana w raporcie jako **`MIGRATION_PREPARED`** +
     **`REMOTE_EXECUTION_NOT_AUTHORIZED`**. Nie uruchamiasz jej nigdzie poza
     własnym jednorazowym kontenerem. W raporcie dodatkowo deklarujesz
     **kompatybilność wsteczną z zamrożonym demo**: czy kod działa na bazie
     **bez** Twojej migracji (kolumna/tabela nieobecna) — jeśli nie działa,
     to jest **STOP**, bo zamrożone demo nie dostanie tej migracji.
  4. **★ DOWÓD IDEMPOTENCJI NA ŚWIEŻEJ BAZIE — warunek oddania pozycji
     z migracją.** Trzy przebiegi, wyniki wklejone do raportu:
     ```bash
     docker run -d --name cx-day15-pg \
       --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
       -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day15 \
       -p 4342:5432 pgvector/pgvector:pg16

     export DATABASE_URL="postgres://postgres:cx@localhost:4342/cx_day15"
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (1) świeży przebieg
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (2) powtórka → "Applying migrations: 0"
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry      # (3) dry-run → "Pending migrations: 0"
     ```
     **Sprzątanie jest obowiązkowe i jest częścią dowodu** (2026-08-25 dysk
     VM Dockera osiągnął 100% przez 72 osierocone wolumeny — nie powtarzaj tego):
     ```bash
     docker rm -f cx-day15-pg
     docker volume ls -q | grep -i cx-day15 | xargs -r docker volume rm
     docker ps -a --filter name=cx-day15 --format '{{.Names}}'    # oczekiwany wynik: PUSTY
     docker volume ls -q | grep -i cx-day15                       # oczekiwany wynik: PUSTY
     ```
     Jeżeli przebieg (1) zatrzyma się na **cudzej, niezwiązanej** migracji
     (znany, udokumentowany stan repo — `TRI-OBS-18`), **to nie jest Twój
     defekt**: wklejasz do raportu nazwę pliku, na którym replay stanął,
     i wykonujesz dowód (1)(2)(3) **celowany na Twoje migracje** przez
     ręczne `psql -f`. Oznaczasz to jako `IDEMPOTENCJA_CELOWANA`.
  5. **Zero migracji danych, które zmieniają znaczenie istniejących
     wierszy.** Backfill dozwolony wyłącznie jako
     `INSERT ... ON CONFLICT DO NOTHING` z kluczem deduplikacji.
- **Hooki pre-commit działają i będą Cię blokować** (od 2026-08-25
  `core.hooksPath` jest realnie ustawiony — `TRI-MUST-16`). Nie obchodź ich
  przez `--no-verify`. Jeśli hook blokuje — popraw kod, nie hook.
  ```bash
  bash scripts/check-list-canon.sh src/views/superadmin/PlatformOperationsView.tsx
  bash scripts/check-action-coverage.sh          # R10 — rejestr akcji
  ```
  **`scripts/check-list-canon.sh --update` jest w tym dyżurze ZAKAZANE.**
  Baseline `scripts/check-list-canon.baseline.txt` **nie zmienia się**.
- **Dane demo = twarz produktu.** Każdy probe sprząta po sobie. Zero rekordów
  testowych zostawionych w jakiejkolwiek bazie.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków, zero
   `sampleData`, zero zaszytych tablic, zero `localStorage` jako źródła
   prawdy. Pusty wynik z API = uczciwy pusty stan, nie fikcyjne dane.
2. **Zapis z readbackiem** — po `POST`/`PUT`/`PATCH` ekran ponownie odczytuje
   stan z serwera i pokazuje to, co serwer faktycznie zapisał. Zakaz
   optymistycznego „sukces" bez potwierdzenia.
3. **Zero atrap.** Każda kontrolka, którą widać, coś robi. Kontrolka, dla
   której nie ma API — **nie powstaje**; zamiast niej idzie wpis `BRAK_API`
   do raportu. Przełącznik, który zapisuje klucz, którego nikt nie czyta,
   jest atrapą (Z14) — albo dostaje uczciwą etykietę „zapis bez
   egzekwowania", albo nie powstaje.
4. **Minimum 4 testy zachowania** przechodzą: happy · błąd · pusty stan ·
   **negatyw cross-org na warstwie żądania**. Testy grepujące źródło nie
   liczą się (§0.3).
5. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson
   `#85182F`. Czerwień **wyłącznie** semantyka krytyczna — w tym ekranie
   `--c-danger` **wolno** dla oznaczenia ryzyka `critical` przy akcji
   nieodwracalnej, **nie wolno** dla nagłówka sekcji, aktywnej zakładki
   ani CTA. Fokus = niebieski
   `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
6. **i18n PL + EN OD RAZU**, w tym samym commicie co kod — **klucz tworzysz
   w chwili tworzenia napisu, nie „na końcu"**. Zero polskich literałów
   w JSX, zero angielskich literałów w JSX. Stan zastany: **267 kluczy
   `superadmin.*` w PL i 267 w EN, parytet pełny**, ale **namespace
   `superadmin.platformOperations` NIE ISTNIEJE** — ekran fali 1 ma napisy
   zaszyte po polsku (§P.4). Twój dyżur to naprawia i utrzymuje parytet.
7. **Light i dark** — powierzchnia wygląda poprawnie w obu motywach.
8. **★ Zrzut własny dla każdej NOWEJ powierzchni wizualnej** (nowa karta
   akcji, nowy dialog, nowa sekcja) — dev-render/harness z danymi z fixture,
   **light i dark**, wykonany przez Ciebie. Zrzut czysty: zero gwiazdek,
   zero ozdób, tokeny `c-*`. **Bez zrzutu pozycja wizualna jest CZĘŚCIOWA.**
   Wzorzec skryptu: `scripts/dev/*-screenshots.mjs`.
9. **Plik przepuszczony przez `prettier`** przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja z odbioru dnia 2:** raport deklarował „N/N PASS", ale liczone było
wyłącznie na plikach własnych. Równolegle 27 testów w cudzych modułach było
czerwonych — przez zmianę w pliku współdzielonym.

**Przed oddaniem raportu wykonujesz pomiar zasięgu:**

1. Wypisz **wszystkie** pliki, które dotknąłeś:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Z tej listy wyodrębnij pliki **współdzielone**. **W tym dyżurze
   z definicji współdzielone są:**
   - `server/src/routes/superadmin.routes.ts` (~5000 linii, dziesiątki ekranów),
   - `server/src/routes/adminP32.routes.ts` (19 wywołań `logAction`, cały panel Admina),
   - `server/src/routes/security.routes.ts` i `access-control.routes.ts`
     (montowane globalnie — patrz §S),
   - `public/locales/{pl,en}/translation.json`,
   - każdy **nowy middleware** (§A.2) — bo dotknie każdej trasy, do której
     go wepniesz.
   ```bash
   grep -rln "superadmin.routes" server/src/ tests/ | head -20
   grep -rln "adminP32" server/src/ src/ tests/ | head -20
   grep -rln "access-control" server/src/ src/ tests/ | head -20
   ```
3. **Uruchom testy KATALOGÓW konsumentów**, nie tylko własnych plików.
   Minimum dla tego dyżuru:
   ```bash
   npx vitest run server/src/routes/__tests__
   npx vitest run src/views/superadmin/__tests__
   npx vitest run tests/integration/routes           # jeżeli katalog istnieje
   npx vitest run tests/unit/backend/middleware
   ```
   jeżeli dotknąłeś `translation.json`:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
   node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"
   npx vitest run src/i18n                            # jeżeli istnieje pakiet parytetu
   ```
4. **W raporcie deklarujesz zasięg jawnie**, w sekcji „Testy":
   - `ZASIĘG PEŁNY` — uruchomiłeś testy wszystkich katalogów konsumentów
     plików współdzielonych, które dotknąłeś, i podajesz ich wyniki;
   - `ZASIĘG CZĘŚCIOWY` — uruchomiłeś tylko własne pliki. **Wtedy piszesz to
     wprost i wymieniasz, czego nie uruchomiłeś i dlaczego.**

**To nie jest pełny `vitest` repo** (nadal zakazany — §0.3). To jest pomiar
celowany: katalogi konsumentów tego, co ruszyłeś.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy
improwizacja.**

Konkretnie zatrzymujesz się i opisujesz problem, gdy:

- musiałbyś **osłabić albo usunąć asercję w teście istniejącym wcześniej**;
- musiałbyś **zbudować kontrolkę, dla której nie ma API** albo dla której
  API zapisuje wartość, której **nikt nie czyta** (Z14) — wtedy nie budujesz
  jej wcale; wpis `BRAK_API` / `ZAPIS_BEZ_EGZEKWOWANIA` z pełną tabelą jest
  **wynikiem pełnowartościowym**;
- musiałbyś **zmienić definicję capability** albo `effectiveAccessService`
  (Z16) — dopięcie istniejącego `requireSuperAdminCapability` do trasy to
  §P.4 i **jedyny** dozwolony dotyk; cokolwiek szerszego = STOP;
- musiałbyś **zmienić zachowanie trasy, którą wołają istniejące ekrany**,
  w sposób, który je zepsuje (np. nagłe wymaganie nowego pola) — poprawna
  droga to **nowa trasa obok** + migracja konsumenta, wzorzec:
  `1de731c5c1 fix(interview-v4): resolve tenant from the token only`;
- musiałbyś **przepisać `SuperAdminController` na inny styl bazodanowy**
  (kontroler używa stylu callbackowego `deps.db.run(...)`, a nie `DbPromise`)
  — to jest STOP, tak samo jak w dyżurze nr 2;
- musiałbyś dodać migrację **nieaddytywną**, albo taką, bez której kod
  **nie działa na zamrożonym demo** (`DEC-65`);
- musiałbyś **stworzyć drugą flagę funkcyjną** (Z10 dopuszcza dokładnie jedną);
- musiałbyś **zmienić `SuperAdminView` / `SuperAdminSidebar` / `AppRoutes` /
  `routeConfig`** (Z11);
- musiałbyś **naprawić znany wyścig nawigacyjny superadmina** (§1.6) — nie
  naprawiasz, odnotowujesz;
- musiałbyś **wykonać cokolwiek w chmurze** — Railway, zdalna baza, deploy,
  seed na wspólnej bazie (Z8, Z9, `DEC-65`);
- **test nie przechodzi i naprawa wymagałaby zmiany GLOBALNEGO mocka lub
  configu vitest (Z18)** — to jest STOP zawsze, bez wyjątku;
- **pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module** — nie
  „naprawiasz" ich po cichu: opisujesz w raporcie, który commit je zapalił;
- musiałbyś **zgadnąć rozstrzygnięcie kwestii otwartej** z §1.7. **Nie
  zgadujesz** — piszesz propozycję i STOP.

Format wpisu STOP w raporcie:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

24 sierpnia nadzorca podpisał werdykt kompletności trójkąta
**Admin + Settings + Superadmin**
(`docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md`).
Werdykt zamknął sześć pozycji MUST, ale przy okazji pracy nad instrukcjami
nocnymi odkryto cztery nowe, które **blokują wdrożenie**:

| ID            | Problem wg werdyktu                                                                                                                                                                             | Wiersz                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `TRI-MUST-07` | trzy niebezpieczne endpointy: `GET /api/security/sessions/all` bez guardu roli; `DELETE /sessions/:id` bez sprawdzenia przynależności; `/api/admin-data/*` — organizacja z URL zamiast z tokenu | `:65`                                              |
| `TRI-MUST-08` | audyt mutacji admina nie jest uniwersalny: projekcja `/api/admin/audit-logs` ma tylko 2 źródła; mutacje zespołów, domen, ai-settings/ai-governance nie zostawiają wpisu (narusza `AC-005`)      | `:75`                                              |
| `TRI-MUST-11` | `GET /api/access-control/requests`: superadmin-only i **bez filtra organizacji** — ekran „Access requests" nie może go wołać                                                                    | `:78`                                              |
| `TRI-MUST-12` | audyt ścieżki zawieszenia organizacji (jedyna klikalna ścieżka omijała audyt)                                                                                                                   | `SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md:333` |

Równolegle, 24 sierpnia, powstał
**`SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md`** — analiza kompletności
warstwy platformowej. Jej ustalenie nr 1 brzmiało: _„Backend platformowy jest
gotowy i audytowany — brakuje frontu. Wszystkie dziesięć krytycznych akcji
operatorskich P33 nie ma ani jednego wywołania z aplikacji."_

25 sierpnia dyżur nr 2 (sekcja C, `DEC-2026-08-25-18`) zbudował **falę 1**:
ekran „Operacje platformowe" jako zakładka `platform-operations`
w `/superadmin/system` — z **5 z 11** akcji. Sześć zostało świadomie
pominiętych, z powodem: _„brak bezpiecznej listy celu lub kontrolowanego
katalogu zakresu"_ (`ADMIN55_DAY2_REPORT_2026-08-25.md:47`, `:116`).

**Twój dyżur to fala 2.** Domykasz te sześć akcji — o ile da się to zrobić
uczciwie — i zamykasz cztery pozycje MUST bezpieczeństwa.

### 1.2. ★ Status warstwy Superadmin — przeczytaj, żeby nie zawyżać raportu

Warstwa `/superadmin/*` jest **poza programem 16 modułów Fali 3** i **nie ma
karty odbioru ani właściciela odbioru**
(`SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md:318`, `:332`). Bilans z tego
raportu: 60 wymagań — 18 `JEST_PEŁNE`, 11 `JEST_CZĘŚCIOWE`, 12
`TYLKO_BACKEND`, 19 `BRAK`; z 20 wymagań `KRYTYCZNE_DLA_MVP` **16 nie ma
działającej ścieżki z UI**.

**Konsekwencja dla Ciebie:** nie piszesz w raporcie, że „warstwa Superadmin
jest gotowa", „moduł domknięty" ani „gotowe do pokazania właścicielowi".
Maksymalny poziom, jaki możesz zaraportować, to **`TECHNICAL_PASS`** dla
konkretnych pozycji, które zbudowałeś. Karta odbioru tej warstwy to decyzja
właściciela, nie Twój produkt (Z12).

### 1.3. Decyzje wiążące

| Decyzja                  | Treść istotna dla Ciebie                                                                                                                                                                                                                                                                                                                                                                                                                     | Miejsce                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `DEC-2026-08-25-18`      | Superadmin = odrębny, jawny tor prac. Fala 1 = ekran „Operacje platformowe" + naprawa `TRI-MUST-12`                                                                                                                                                                                                                                                                                                                                          | `OWNER_DECISION_LEDGER_2026-08-24.md:70`  |
| **`DEC-2026-08-25-65`**  | **Kontrakt rozdzielenia staging/demo/production + FREEZE.** Do komunikatu „FREEZE ZAKOŃCZONY": zakaz deployów, zmian Railway/domen/env, zdalnych migracji/seedów/resetów, zapisów do wspólnej bazy, merge/force-push na `demo`/`develop`/`main`. Migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED` **z testem kompatybilności wstecz z zamrożonym demo**. Kolizje → `COORDINATION_REQUIRED`, nie samodzielne rozwiązywanie | `OWNER_DECISION_LEDGER_2026-08-24.md:117` |
| `ADM-RAW-P0-001`         | SUPERADMIN nie dziedziczy `/admin/*` — świadoma decyzja P0, nie defekt                                                                                                                                                                                                                                                                                                                                                                       | `TRIANGLE_..._VERDICT:22`                 |
| `TRI-MUST-13` / `FIX-12` | wildcard `'*'` roli ADMIN → deny-lista owner-only. **Model uprawnień naprawiany in-house**                                                                                                                                                                                                                                                                                                                                                   | `TRIANGLE_..._VERDICT:84`, `:93`          |

### 1.4. ★ KOREKTY WOBEC ZLECENIA — pięć rzeczy, które zweryfikowałem za Ciebie

**To jest najważniejsza sekcja tej instrukcji.** Zlecenie, na podstawie
którego powstał ten dyżur, opierało się na werdykcie z 24 sierpnia. Werdykt
**zestarzał się o kilkanaście godzin**. Zweryfikowałem każdą z czterech
pozycji na tipie `codex/m03-admin-20260824` — cztery z pięciu twierdzeń
wymagają korekty. **Kod jest prawdą, nie werdykt i nie ta instrukcja.**
Każdą korektę **potwierdzasz u siebie przed budową** i wynik wpisujesz do
raportu.

---

**KOREKTA 1 — `TRI-MUST-12` jest w większości ZAMKNIĘTY. Nie budujesz go od
nowa.**

Commit `0ad8dd9dd8` (25.08, 07:15) — czyli **po** podpisaniu raportu
kompletności (`1e5378d8b3`, 24.08, 22:21) — wprowadził:

- `superadmin.routes.ts:45` — `STATUS_CHANGES_REQUIRING_CONFIRMATION`
  = `suspended | blocked | cancelled`;
- `:48-68` — `conditionalOrganizationConfirmation`, bramkujące **na realnym
  przejściu** (porównuje status z ciała ze statusem w bazie), powód
  odkładany do `res.locals.organizationStatusChangeReason` (`:63-64`);
- `:696-702` — trasa `PUT /organizations/:id` z tym middleware + `requireAudit`;
- `SuperAdminController.ts:361-393` — emisja `organization.status_changed`
  z `before`/`after`/`reason`, **fail-closed** (`503` przy nieudanym zapisie
  audytu, `:391`);
- `server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts`
  — **5 testów** (raport dnia 2 mówi o 3 — plik urósł).

Twierdzenie z raportu kompletności „grep `superadmin/tenants` w całym `src/`
= 0" jest **nieaktualne**: `PlatformOperationsView.tsx:38-45` woła audytowaną
trasę `POST /tenants/:id/suspend`.

**Zostają trzy luki** — i one są Twoim zakresem w §T:

1. **Reaktywacja nie jest audytowana na trasie `PUT`.** `'active'` nie jest
   ani w `STATUS_CHANGES_REQUIRING_CONFIRMATION` (`:45`), ani w
   `criticalStatusChange` (`SuperAdminController.ts:361`) — odwieszenie
   organizacji nie zostawia śladu.
2. **Żaden formularz superadmina nie oferuje wartości `suspended`.**
   `OrganizationsView.tsx:606-608` = `active | pending | blocked`;
   `SuperAdminOrgDetailsModal.tsx:268-270` = `active | trial | blocked`.
   Czyli „ścieżka zawieszenia", którą audytowano, jest z UI **nieosiągalna**
   — jedyny realny zapis `suspended` idzie przez `POST /tenants/:id/suspend`.
3. **Zawieszenie nic nie egzekwuje.** `AuthController.ts:325` bramkuje
   `pending`, `:332` bramkuje `blocked` — **gałęzi `suspended` nie ma**;
   `grep -rn "suspended" server/src/middleware/` = 0 trafień.
   `POST /tenants/:id/suspend` (`:831-834`) **tylko liczy** użytkowników
   organizacji do metadanych — nie unieważnia sesji, nie zmienia statusu
   użytkowników. Wiersz audytowy dokumentuje akcję, która nie ma skutku.

---

**KOREKTA 2 — `TRI-MUST-07` punkt C (`/api/admin-data/*`) jest NIEAKTUALNY
w zacytowanej postaci, ale zostawia CZTERY realne dziury.**

`admin-data.routes.ts:44-56` ma już router-level `verifyToken` (`:44`),
`requireRole('super_admin','admin','owner')` (`:45`) **oraz hook
`router.param('orgId')`** (`:48-56`), który 403-uje, gdy `callerOrgId !== orgId`
(z wyjątkiem `super_admin`). Czyli „org z URL zamiast z tokenu" **nie jest
dziś eksploatowalne dla tras z `:orgId`**.

**Ale** `router.param('orgId')` odpala się **wyłącznie** dla tras, których
wzorzec zawiera `:orgId`. Cztery trasy w tym samym pliku kluczują na
`:eventId` / `:sessionId` i **nie mają żadnej kontroli organizacji**:

| Trasa                                   | Linia  | SQL                                                                 | Skutek                                      |
| --------------------------------------- | ------ | ------------------------------------------------------------------- | ------------------------------------------- |
| `PUT /security-events/:eventId/resolve` | `:277` | `UPDATE security_events SET resolved=1 … WHERE id = ?` (`:291-297`) | zamknięcie cudzego zdarzenia bezpieczeństwa |
| `DELETE /sessions/:sessionId`           | `:498` | `DELETE FROM user_sessions WHERE id = ?` (`:505`)                   | wylogowanie dowolnego użytkownika platformy |
| `PUT /scheduled-events/:eventId`        | `:791` | dynamiczny `UPDATE scheduled_events … WHERE id = ?` (`:858-865`)    | edycja cudzego zdarzenia                    |
| `DELETE /scheduled-events/:eventId`     | `:879` | `DELETE FROM scheduled_events WHERE id = ?` (`:886`)                | kasowanie cudzego zdarzenia                 |

Bramką jest wyłącznie „bycie adminem/ownerem **gdziekolwiek**". To są
cross-tenant IDOR-y. Dodatkowo `apiAuthRateLimiter` jest w tym pliku
**zaimportowany i nigdy nieużyty** (`:15`, jedno wystąpienie).

---

**KOREKTA 3 — `GET /api/security/sessions/all` NIE jest wyciekiem
cross-tenant. Jest wyciekiem WEWNĄTRZ tenanta.**

`security.routes.ts:158-190`: łańcuch to `verifyToken` **i nic więcej**
(mount `Gateway.ts:1002`, bez middleware na mount). **Ale** zapytanie
(`:167-170`) ma `WHERE u.organization_id = ?` związane z
`req.user.organizationId` (`:162`) — organizacja idzie **z tokenu**.

Realny defekt: **brak guardu roli**. Dowolny zalogowany użytkownik,
w tym `GUEST`, dostaje do 200 sesji **wszystkich kolegów z organizacji** —
e-mail, imię, nazwisko, IP, user-agent, lokalizację, urządzenie. Wzorzec
poprawny leży **w tym samym pliku**: `requireOrgAdmin` (`:27-44`, czyta
`organization_members.role`, przepuszcza `OWNER`/`ADMIN`), użyty w `/settings`
(`:55`, `:89`). Siostrzana trasa `GET /sessions` (`:123-156`) poprawnie
zawęża `AND s.user_id = ?`.

---

**KOREKTA 4 — `DELETE /sessions/:id` jest gorszy, niż mówi werdykt, i nie
jest sam.**

`security.routes.ts:192-200`: handler **w ogóle nie czyta `req.user`**.
SQL (`:197`): `DELETE FROM user_sessions WHERE id = ?`. Brak `organization_id`,
brak `user_id`, brak `EXISTS`. Odpowiedź zawsze `{success:true}`. To jest
**destrukcyjny IDOR cross-tenant**.

Trzy dalsze dziury w **tym samym pliku**, których werdykt nie wymienia:

| Trasa                           | Linia                      | Problem                                                                                                         |
| ------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DELETE /sessions/user/:userId` | `:202-210`, SQL `:207`     | kasuje **wszystkie** sesje dowolnego użytkownika, cross-tenant — większy zasięg niż `:sessionId`                |
| `GET /security/audit-logs`      | `:291-328`, SQL `:297-306` | `activity_logs` **bez żadnego `WHERE`** → zrzut dziennika aktywności całej platformy dla dowolnego zalogowanego |
| `GET /security/api-keys/usage`  | `:331-353`, SQL `:337-346` | agregat `api_logs` **bez żadnego `WHERE`** → koszty i wolumen API wszystkich tenantów                           |

**Dobra wiadomość:** front **nie woła** żadnej z tych tras (grep w `src/` = 0;
najbliższe trafienie, `SessionManagementPanel.tsx:81`, celuje w **inny,
nieistniejący** router `/security-policies/sessions/all`). Naprawa jest więc
bezpieczna dla UI.

---

**KOREKTA 5 — `TRI-MUST-08`: uniwersalny audyt JUŻ ISTNIEJE i JUŻ JEST
ZAMONTOWANY. To jest przede wszystkim defekt PROJEKCJI, nie brak pisarza.**

`server/src/index.ts:1274` → `app.use('/api/', auditLogMiddleware);`
(`server/src/middleware/auditLog.middleware.ts:228-474`) obejmuje **każde**
żądanie `/api/*`, pomija `GET/OPTIONS/HEAD` (`:236-239`), odpala się tylko
przy 2xx (`:369`) i **potrójnie zapisuje** — `activity_logs` (`:387`),
`audit_events` (`:401`), `audit_log` (`:424`).

Czyli mutacje zespołów, domen i ai-governance **zostawiają ślad** — tylko
**projekcja go nie czyta**. `readTenantAdminAuditProjection`
(`adminP32.routes.ts:2231-2255`) to **merge w JS dwóch nóg**, nie SQL UNION:
noga A = `adminAuditService.getLogs` → tabela `admin_audit_logs`; noga B =
`SELECT … FROM role_change_audit_events`. Obie z twardym `LIMIT 1000`
**przed** filtrowaniem i paginacją (`:3026-3034`).

Trzy defekty, nie jeden:

1. **projekcji** — czyta 2 z 5 dostępnych tabel;
2. **wierności** — middleware wywodzi `resourceType`/`entityId` z segmentów
   URL (`:283-289`), nie z semantyki domeny, i nie ma `risk_score`/`status`,
   których wymagają statystyki i filtry ekranu (`adminP32.routes.ts:3050-3053`);
3. **gwarancji** — zapisy są `fire-and-forget` (nigdy `await`), a middleware
   **całkowicie pomija żądanie**, gdy `!organizationId || !userId`
   (`:374-376`). Do tego `adminAuditService.logAction` jest wprawdzie
   `await`-owany, ale ma `try/catch`, który połyka błąd (`adminAuditService.ts:96`)
   — **fail-open**: nieudany audyt nigdy nie blokuje mutacji.

Realna luka pokrycia po stronie _semantycznej_: **83 mutujące trasy modułu
Admin, 20 pisze wiersz widziany przez projekcję, 63 nie** (tabela w §A.1).
Najgroźniejsze: `admin/break-glass.routes.ts` (dostęp awaryjny),
`admin/service-accounts.routes.ts` (poświadczenia maszynowe),
`admin-bulk.routes.ts` (masowa zmiana ról), `access-control.routes.ts`
(zatwierdzanie wniosków), `admin/domains.routes.ts` (przejęcie domeny).

---

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`INSERT OR REPLACE` w trasach P33 to składnia SQLite.** Cztery z sześciu
   niewystawionych akcji (`mfa-override`, `sso-override`, `ai/models/*/suspend`,
   `virtual-workers/*/suspend`) zapisują przez
   `INSERT OR REPLACE INTO settings (key, value, updated_at)`. Na PostgreSQL
   przepisuje to `adaptQuery` (`PostgresDatabase.ts:1043-1085`) na
   `ON CONFLICT (…) DO UPDATE`, biorąc cel z rejestru
   `server/src/database/conflictTargets.ts` — `settings: ['key']` (`:89`).
   Tabela `settings` ma `key TEXT PRIMARY KEY`
   (`migrations/000_initdb_core_tables.sql:100`), więc **powinno** działać.
   **Sprawdź to realnie na świeżym PostgreSQL**, zanim wystawisz te akcje
   w UI (§P.1 krok 0). Cztery różne pliki tworzą `settings` z **różnymi
   zestawami kolumn** (`000_initdb_core_tables.sql:100`,
   `000_z_core_baseline.sql:139`, `232_configuration_module_tables.sql:138`,
   `259_p31_settings_registry_cleanup.sql:4` — ten ostatni z `value TEXT NOT NULL`).
   Wygrywa ten, który wykona się pierwszy.
2. **`admin_audit_logs` może nie istnieć na świeżo zmigrowanej bazie.**
   Tworzą ją wyłącznie `236_security_module_extended.sql:170`
   i `900_prod_missing_tables_hotfix.sql:841` — **żaden z tych plików nie
   pasuje do `MIGRATION_PATTERN`** (`migrationIdentity.ts:56`,
   `/^(7\d{2}|\d{8})_.*\.sql$/`) ani nie jest w allowliście (`:73-149`).
   Powstaje tylko przez bootstrap `DatabaseInitializer` (`:42`, `:159`).
   To jest wprost `TRI-OBS-18`. **Nie naprawiasz klasyfikatora migracji** —
   odnotowujesz w raporcie, jeśli Twój przebieg to potwierdzi.
3. **`ai_settings_audit` nie istnieje nigdzie poza `never-ran/`.**
   `AISettingsService.ts:85` wstawia do tabeli, którą tworzy wyłącznie
   `server/migrations/never-ran/090_ai_settings_system.sql.sql:117`.
   Ten zapis **cicho zawodzi na realnym Postgresie**. Znalezisko do raportu,
   nie do naprawy (chyba że §A.3 obejmie ai-settings innym pisarzem).
4. **Dziewięć z jedenastu tras P33 nie ma bramki capability.**
   `requireSuperAdminCapability('security_ops')` mają tylko
   `force-reset-mfa` (`:905`) i `lockdown` (`:1205`). Pozostałe dziewięć —
   w tym `purge` i `suspend` — przechodzi każdy superadmin. Do tego
   `superAdmin.middleware.ts:168-170` przyznaje **każdej** roli `superadmin`
   komplet pięciu capability, bo żaden wystawca tokenu nie ustawia claimu.
   Zakres §P.4 jest **wąski i jawny**; szerzej = Z16 = STOP.
5. **Ekran fali 1 nie ma i18n.** `PlatformOperationsView.tsx:21-63` ma
   etykiety i opisy **zaszyte po polsku**; namespace
   `superadmin.platformOperations` **nie istnieje** w żadnym pliku locale
   (stan zastany: 267 kluczy `superadmin.*` PL / 267 EN, parytet pełny).
   §P.4 to naprawia.
6. **Do zakładki `platform-operations` nie ma deep-linku.**
   `SuperAdminView.tsx:137` montuje `<SystemModule />` **bez `initialTab`**,
   a `SystemModule.tsx:126` otwiera się domyślnie na `integrations`.
   Operator musi ręcznie znaleźć zakładkę. **Nie naprawiasz tego przez
   zmianę `SuperAdminView`** (Z11) — odnotowujesz (§1.6).
7. **Znany wyścig nawigacyjny superadmina.** `SuperAdminView.tsx:83-95`
   normalizuje adres do `/superadmin/customers`, gubiąc cel deep-linku.
   **NIE NAPRAWIASZ** (§1.6). Nie obchodzisz też hackiem (`setTimeout`,
   `replaceState`, blokada nawigacji).
8. **`requireConfirmation` nie robi re-auth.** Czyta **wyłącznie ciało
   żądania** (`confirmAction.middleware.ts:56-59`, `:83-84`): `confirmation`
   (`true` albo string `"true"`) i `reason` (min. 3 znaki po odfiltrowaniu
   znaków niewidzialnych). Kody: `428 CONFIRMATION_REQUIRED` (`:122-125`),
   `428 CONFIRMATION_INVALID_TYPE` (`:91`), `428 CONFIRMATION_STRING_TOO_LONG`
   (`:103`), `422 REASON_REQUIRED` (`:132-135`), `422 REASON_INVALID_TYPE`
   (`:113`), `422 REASON_TOO_LONG` (`:142`), `401 ADMIN_IDENTITY_REQUIRED`
   (`:154`), `503 AUDIT_UNAVAILABLE` (`:211`). Skutek uboczny: wiersz
   w `superadmin_confirmed_actions` (`:187-204`).
9. **Type-to-confirm ma DOKŁADNIE JEDNA akcja: `purge`**
   (`superadmin.routes.ts:1129-1136`, `422 TYPE_TO_CONFIRM_FAILED`
   - `expectedName`). Dokładanie pola przepisania nazwy tam, gdzie backend go
     nie sprawdza, to **teatr bezpieczeństwa** — uczy operatora, że
     przepisywanie nazwy nic nie znaczy. Nie robisz tego.
10. **Nie ma w repo ani jednego testu odnoszącego się do `TRI-MUST-07`
    czy `TRI-MUST-11`.** Werdykt mówi „5/5 negatywów TRI-MUST-07 czysto"
    (`:91`) — to było **żywe sondowanie runtime**, nie test regresyjny.
    Dokładnie tę lukę zamyka §Q.

### 1.6. ★ Czego ten dyżur NIE robi — cztery rzeczy, jawnie

1. **Nie naprawia wyścigu nawigacyjnego superadmina** ani braku deep-linku
   do zakładki `platform-operations` (pułapki 6 i 7). Naprawa idzie in-house,
   przy module SuperAdmin. Odnotowujesz obserwację w raporcie: jaki adres,
   po jakim czasie, dokąd przerzuca.
2. **Nie naprawia modelu uprawnień** (`effectiveAccessService`, wildcard
   ADMIN, brak claimu `superadminCapabilities`). Z16. Wolno czytać i cytować.
3. **Nie buduje egzekwowania zawieszenia organizacji.** To, że `suspended`
   nic nie blokuje (`KOREKTA 1`, luka 3), jest **znaleziskiem do raportu**
   i pozycją do decyzji właściciela — nie zadaniem, które podejmujesz
   z własnej inicjatywy. Dopisanie gałęzi `suspended` do `AuthController`
   zmienia zachowanie logowania dla całej platformy podczas FREEZE = STOP.
4. **Nie naprawia klasyfikatora migracji** (`TRI-OBS-18`, `TRI-MUST-05`).
   To jest bramka fazy 3, osobny blok roboczy.

### 1.7. Pozycje otwarte — pięć rzeczy, których NIE ZGADUJESZ

Każda z nich kończy się **wpisem STOP w raporcie** z propozycją. To kosztuje
minuty, nie godziny, a bez nich nadzorca nie ma czym podjąć decyzji.

1. **`platform/mfa-override` i `platform/sso-override` — wystawiać czy nie?**
   Obie zapisują klucz w `settings` (`platform:mfa_override`,
   `platform:sso_override`), którego **nikt nie czyta** (grep konsumentów =
   przedmiot Twojej weryfikacji w §P.3). Wystawienie ich w UI bez konsumenta
   to drugi `TRI-MUST-02` (przełącznik-placebo). Propozycja domyślna:
   **nie wystawiać**, wpis `ZAPIS_BEZ_EGZEKWOWANIA` + STOP.
2. **`data/bulk-export` — jaki katalog zakresu?** Trasa przyjmuje dowolny
   `scope` string i **niczego nie eksportuje** — zwraca `status:'queued'`
   bez kolejki (`superadmin.routes.ts:1092-1115`). Wystawienie przycisku
   „Eksportuj" nad tym to atrapa. Propozycja domyślna: **nie wystawiać**,
   wpis `BRAK_API` + STOP; jednocześnie **nie ruszasz**
   `DataExportPanel.tsx:69`, który jest uczciwie wyłączony (Z15).
3. **Reaktywacja organizacji — audytować na `PUT` czy wymusić `POST /reactivate`?**
   Dwie drogi (§T.2). Nie wybierasz sam, jeśli obie są kosztowne — opisujesz
   i STOP.
4. **Zakres uniwersalnego audytu — projekcja czy pisarze?** §A daje dwie
   drogi (A.2 „poszerz projekcję" vs A.3 „dopnij pisarza per trasa").
   Jeśli po inwentarzu (A.1) okaże się, że żadna nie mieści się w dyżurze —
   robisz **A.1 + jedną z nich na wąskim, najgroźniejszym podzbiorze**
   i STOP na resztę.
5. **Trasa tenant-scoped dla `access-control/requests` — nowa czy zmieniona?**
   Zmiana istniejącej zepsuje ewentualnych konsumentów superadmina
   (dziś: zero w `src/`). Propozycja domyślna: **nowa trasa obok**,
   stara nietknięta (§S.4).

---

## 2. MAPA TECHNICZNA — skrót niezbędny

### 2.1. Rozmiar obszaru — żebyś wiedział, w co wchodzisz

```
server/src/routes/superadmin.routes.ts        ~5000 linii, dziesiątki ekranów-konsumentów
server/src/routes/adminP32.routes.ts          ~3100 linii, 20 mutacji, 19 wywołań logAction
server/src/routes/security.routes.ts          ~360 linii  ← §S.1, §S.2
server/src/routes/admin-data.routes.ts        ~900 linii  ← §S.3
server/src/routes/access-control.routes.ts    ~540 linii  ← §S.4
src/views/superadmin/PlatformOperationsView.tsx   310 linii ← §P
src/services/superadminPlatformOperationsApi.ts    41 linii ← §P
```

### 2.2. Jedenaście akcji P33 — stan faktyczny na Twojej bazie

Wszystkie w `server/src/routes/superadmin.routes.ts`, sekcja
`// GATED ACTIONS — P33 §2.3.2` (`:806-808`). Wszystkie mają
`requireConfirmation` + `requireAudit` i wykonują się przez
`executeAtomicGatedAction` (`:246-273`): `BEGIN TRANSACTION` → operacja →
`insertAuditEventAtomic` (`:165-215`, tabela `audit_events`) → `COMMIT`;
nieudany zapis audytu = `503 AUDIT_UNAVAILABLE`.

| #   | Trasa                                                    | Linie        | `capability`             | Zdarzenie audytowe            | UI?     |
| --- | -------------------------------------------------------- | ------------ | ------------------------ | ----------------------------- | ------- |
| 1   | `POST /tenants/:id/suspend`                              | `:811-862`   | —                        | `tenant.suspended`            | **TAK** |
| 1b  | `POST /tenants/:id/reactivate`                           | `:865-899`   | —                        | `tenant.reactivated`          | **TAK** |
| 2   | `POST /users/:id/force-reset-mfa`                        | `:903-939`   | `security_ops` (`:905`)  | `user.mfa_reset`              | **TAK** |
| 3   | `POST /platform/mfa-override`                            | `:942-976`   | —                        | `platform.mfa_override`       | NIE     |
| 4   | `POST /platform/sso-override`                            | `:979-1011`  | —                        | `platform.sso_override`       | NIE     |
| 5   | `POST /ai/models/:modelId/suspend`                       | `:1014-1047` | —                        | `ai.model_suspended`          | NIE     |
| 6   | `POST /connectors/:connectorId/emergency-kill`           | `:1050-1089` | —                        | `connector.emergency_kill`    | NIE     |
| 8   | `POST /data/bulk-export`                                 | `:1092-1115` | —                        | `data.bulk_export`            | NIE     |
| 9   | `POST /tenants/:id/purge` (type-to-confirm `:1129-1136`) | `:1118-1164` | —                        | `tenant.data_purge`           | **TAK** |
| 10  | `POST /virtual-workers/:workerId/suspend`                | `:1167-1200` | —                        | `ai.virtual_worker_suspended` | NIE     |
| —   | `POST /tenants/:id/lockdown`                             | `:1203-1239` | `security_ops` (`:1205`) | `tenant.emergency_lockdown`   | **TAK** |

Numeracja `#1..#10` pochodzi z komentarzy w kodzie i **nie jest ciągła**
(brak `#7`, `lockdown` bez numeru). Tras jest **jedenaście**.
**Zweryfikuj listę u siebie przed budową** i wpisz wynik do raportu:

```bash
grep -n "requireConfirmation(" server/src/routes/superadmin.routes.ts
grep -n "confirmTenantName\|TYPE_TO_CONFIRM" server/src/routes/superadmin.routes.ts
grep -n "requireSuperAdminCapability" server/src/routes/superadmin.routes.ts
```

### 2.3. Ekran fali 1 — punkty zaczepienia

```
src/views/superadmin/PlatformOperationsView.tsx
  :11        type ActionId = 'suspend'|'reactivate'|'purge'|'lockdown'|'reset_mfa'
  :12-20     ActionDefinition { id, label, description, risk, targetType, path, purge? }
  :21-63     ACTIONS — pięć wpisów, etykiety ZASZYTE PO POLSKU  ← §P.4
  :86-99     load() → getPlatformOperationTargets()
  :101-114   targetsFor / pendingTarget / confirmationValid / grouped(high|critical)
  :116-134   execute() → runPlatformOperation(path, {confirmation, reason, confirmTenantName?})
  :142-151   mapowanie błędów: CONFIRMATION_REQUIRED/428, REASON_REQUIRED,
             TYPE_TO_CONFIRM_FAILED, 404, 403
  :294-303   pole przepisania nazwy — renderowane WYŁĄCZNIE dla purge
src/services/superadminPlatformOperationsApi.ts
  :18-35     getPlatformOperationTargets → GET /superadmin/organizations + /superadmin/users
  :37-41     runPlatformOperation → apiPost(`/superadmin${path}`, body)
src/views/superadmin/SystemModule.tsx
  :99        RENDERABLE_TABS zawiera 'platform-operations'
  :126       initialTab || 'integrations'   ← domyślna zakładka, NIE Twoja
  :226       pozycja zakładki
  :259-260   case 'platform-operations': return <PlatformOperationsView />
```

Testy zastane: `src/views/superadmin/__tests__/PlatformOperationsView.test.tsx`
(7 przypadków renderu) oraz
`src/views/superadmin/__tests__/SystemModule.platformOperations.test.ts:10`
— **test grepujący źródło** (asercja na tekście `switch`), niebehawioralny.

### 2.4. Warstwy izolacji tenanta — czego użyć w §S

Nie ma jednego `tenantScope`. Cztery warstwy, od najsłabszej:

| Warstwa                             | Plik:linia                                                                                                 | Kontrakt                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `verifyToken`                       | `server/src/middleware/auth.middleware.ts:1136`                                                            | wypełnia `req.user`, `req.userId`, `req.organizationId` z JWT                                                                       |
| `requireOrgAccess()`                | `server/src/middleware/rbac.middleware.ts:211`                                                             | sprawdza, że org id **istnieje** i ma poprawną składnię; **nie pyta bazy**                                                          |
| `validateOrgMembership`             | mount `Gateway.ts:462`                                                                                     | członkostwo z bazy, ale **60 s cache i FAIL-OPEN przy błędzie bazy** (udokumentowane w `auditsStrictMembership.middleware.ts:1-10`) |
| **`requireActiveTenantMembership`** | `server/src/middleware/auditsStrictMembership.middleware.ts:146` (wariant bez bypassu superadmina: `:168`) | **najmocniejsza: bez cache, FAIL-CLOSED**, czyta `organization_members` przy każdym żądaniu                                         |

Pomocnik do ciała handlera: `server/src/utils/requestOrganization.ts:19`
`requireRequestOrganizationId(req, res)`.

**Wzorce poprawne do skopiowania — wszystkie istnieją w repo:**

- guard roli w tym samym pliku co defekt: `security.routes.ts:27-44`
  (`requireOrgAdmin`), użycie `:55`, `:89`;
- filtr organizacji w tym samym pliku co defekt:
  `access-control.routes.ts:317-327` (`GET /codes`);
- wariant „wczytaj wiersz, potem porównaj org":
  `access-control.routes.ts:508-520` (`DELETE /codes/:id`) — **to jest
  dokładnie kształt potrzebny dla §S.2 i §S.3**;
- pełna trasa wzorcowa: `server/src/routes/resultsVnext/kpiScorecard.routes.ts:138-142`
  (+ obrona w głąb `:158-166`);
- **wzorzec commita**, gdy trzeba przeciąć org z URL: `1de731c5c1`
  „fix(interview-v4): resolve tenant from the token only, gate the router centrally".

### 2.5. Warstwy audytu — pięć tabel, pięć kształtów

| Tabela                         | Kto pisze                                                                                                                                                                | Migracja                                                                         | Świeża baza?                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `admin_audit_logs`             | `adminAuditService.logAction` (`:80-83`), **fail-open**                                                                                                                  | `236_security_module_extended.sql:170`, `900_prod_missing_tables_hotfix.sql:841` | **NIE przez runner** (poza `MIGRATION_PATTERN` i allowlistą) — tylko `DatabaseInitializer` ⚠️ |
| `role_change_audit_events`     | IAM (`orgPeopleIamService`)                                                                                                                                              | `20260816_admin_iam_operations.sql:1`                                            | TAK ✅                                                                                        |
| `audit_events`                 | `insertAuditEventAtomic` (`superadmin.routes.ts:165`), `requireAudit`/`emitAuditEvent` (`requireAudit.middleware.ts:74`, **fail-closed**), `auditLogMiddleware` (`:401`) | `20260809_artifact_studio_audit_and_presentation_cards.sql:7`                    | TAK ✅                                                                                        |
| `audit_log`                    | `auditService.log` przez `auditLogMiddleware:424`                                                                                                                        | —                                                                                | —                                                                                             |
| `activity_logs`                | `ActivityService.log` przez `auditLogMiddleware:387`                                                                                                                     | —                                                                                | —                                                                                             |
| `superadmin_confirmed_actions` | `requireConfirmation` (`:187-204`)                                                                                                                                       | `20260301_superadmin_guardrails.sql:2`                                           | TAK ✅                                                                                        |

Niezgodności kształtu, które blokują naiwny `UNION ALL`:
kolumna tenanta `organization_id` vs **`org_id`**; aktor `admin_id` vs
`actor_id` vs `actor_user_id`; akcja `action_type` vs `action`; czas
`created_at` vs **`ts`**; `risk_score`/`status` **wyłącznie** na
`admin_audit_logs` (a projekcja ich używa — `adminP32.routes.ts:3050-3053`;
noga IAM je **fabrykuje** z zaszytego mapowania, `:2215`).

### 2.6. Testy zastane — co Cię pilnuje i co skopiujesz

| Plik                                                                              | Harness                                                                                                                 | Rola dla Ciebie                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/routes/__tests__/cross-org-idor.test.ts`                              | supertest + realny router, baza mockowana; `buildAdminDataApp()` `:242-248`; mock auth `:42-73` z mutowalnym `mockUser` | **GŁÓWNY WZORZEC §Q.** Nagłówek `:1-14` mówi wprost: każda naprawa bezpieczeństwa **musi** mieć tu odpowiadający test 403/404. Blok `:1286-1322` (admin-data, 401/403/200/200) klonujesz dla nowych tras |
| `server/src/routes/audits/__tests__/mounting.integration.test.ts`                 | **realny `Gateway.initializeRoutes`** (`:31-35`), realne tokeny HS256, token obcej organizacji `:172`                   | wzorzec „czy trasa jest zamontowana i czy guard realnie odpala"; połowa bez bazy działa zawsze                                                                                                           |
| `server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts`        | **realny PostgreSQL**, dwie organizacje, `appAsOrg()` `:39-52`, fixture `:64-81`                                        | wzorzec `realdb`; nagłówek `:4-10`: nie ufaj samej odpowiedzi HTTP — potwierdź odmowę bezpośrednim `SELECT`                                                                                              |
| `server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts`        | realny router + supertest, mock tylko warstwy bazy                                                                      | najświeższy, najmniejszy wzorzec (25.08)                                                                                                                                                                 |
| `server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts`                 | **realny PostgreSQL**, `describe.skipIf` na `RUN_DB_TESTS=1 && MOCK_DB=false` (`:11-14`)                                | **jedyny test w repo, który dowodzi realnych wierszy audytu w realnej bazie** — i pokrywa wyłącznie nogę IAM. Twój wzorzec dla §A                                                                        |
| `server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts` | supertest, mockowany express                                                                                            | 5 testów `TRI-MUST-12`. **NIE OSŁABIASZ ich ani jednej asercji**                                                                                                                                         |
| `tests/integration/helpers/integrationTestHelper.ts:65-107`                       | `createTestApp()` → realny Gateway, SQLite per worker                                                                   | helper współdzielony — **wolno WOŁAĆ, nie wolno ZMIENIAĆ (Z18)**                                                                                                                                         |

W repo **nie ma testcontainers**. Testy `*.pg.test.ts` podpinają się do
zewnętrznego `DATABASE_URL` i same się pomijają, gdy go brak.

### 2.7. Flagi — wzorzec, jeżeli §P.5 go uruchomi

Wzorzec jednego modułu na flagę: `src/utils/<nazwa>Flag.ts`. Kanoniczne
implementacje: `src/utils/triModeFlag.ts` (`:28-30` klucze, `:68` funkcja),
`src/utils/myWorkCalendarV2Flag.ts` (cały plik, 33 linie).
Kolejność rozstrzygania, od najwyższego: `?ff_<key>=0|1` →
`localStorage["ff.<key>"]` → `import.meta.env.VITE_<KEY>` → **`false`**.
Rejestr opisowy: `src/utils/chatV9FeatureFlags.ts:218` (`CHAT_V9_FLAGS`),
procedura rejestracji w nagłówku `:43-47`.

### 2.8. Kanon UI — co obowiązuje w tym obszarze

Ekran `PlatformOperationsView` **nie jest ekranem listowym** w rozumieniu
TRIADY (nie ma tabeli obiektów domenowych) — jest panelem operacji. Nadal
obowiązują: tokeny `c-*`, zero crimsonu dekoracyjnego, fokus `--c-focus`,
light+dark, i18n PL+EN. **Jeśli dołożysz tabelę** (np. katalog konektorów) —
wtedy obowiązuje `StandardTable` i `bash scripts/check-list-canon.sh` musi
przejść bez wzrostu długu.

---

## §P. SEKCJA SUPERADMIN FALA 2 — ekran 11 operacji P33 — sześć pozycji

**Cel sekcji:** doprowadzić ekran „Operacje platformowe" ze stanu **5/11**
do stanu, w którym **każda z jedenastu akcji jest albo wystawiona
i działająca, albo uczciwie opisana w raporcie z powodem**. Trzecia
możliwość — „wystawiona, ale nic nie robi" — nie istnieje (DoD 3, Z14).

**Nie budujesz nowego ekranu.** Rozbudowujesz istniejący
`PlatformOperationsView.tsx` z fali 1.

---

### P.1 — Katalogi celów operacji (pozycja pierwsza, blokująca resztę §P)

**Dlaczego to jest pierwsze.** Fala 1 pominęła sześć akcji z jednego powodu:
_„brak bezpiecznej listy celu"_. Wpisywanie surowego UUID przez operatora
przy akcji nieodwracalnej to proszenie się o pomyłkę. Dopóki nie ma listy
do wyboru, akcja nie może wejść na ekran.

**Krok 0 — weryfikacja, czy zapis w ogóle działa na PostgreSQL.**
Zanim zaczniesz budować katalogi, sprawdź, czy akcje, dla których je budujesz,
mają szansę zadziałać. Cztery z sześciu zapisują przez
`INSERT OR REPLACE INTO settings` (pułapka §1.5 pkt 1). Na jednorazowym
kontenerze z §0.3:

```bash
psql "$DATABASE_URL" -c "\d settings"
# oczekiwane: kolumna key z PRIMARY KEY (inaczej ON CONFLICT (key) wysypie się)
psql "$DATABASE_URL" -c "INSERT INTO settings (key, value, updated_at) VALUES ('day15:probe','x',CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
psql "$DATABASE_URL" -c "DELETE FROM settings WHERE key='day15:probe';"   # SPRZĄTASZ PO SOBIE
```

Wynik wklejasz do raportu. **Jeśli zapis nie działa — te akcje nie wchodzą
na ekran**, wpis `BRAK_API` + STOP, i to jest wynik pełnowartościowy.

**Co budujesz — trzy trasy odczytu w `superadmin.routes.ts`.**
Wyłącznie `GET`, wyłącznie odczyt, bez `requireConfirmation` (potwierdzenie
jest przy akcji, nie przy liście). Wzorzec bramkowania i kształtu odpowiedzi:
istniejące `GET /superadmin/organizations` (`:672`) i `GET /superadmin/users`
(`:763-773`), które ekran już konsumuje.

| Trasa                                     | Źródło danych                                                                                                                                                           | Kształt wiersza                 | Uwaga                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /superadmin/connectors`              | `SELECT connector_id, COUNT(DISTINCT organization_id) AS affected_tenants, COUNT(*) AS integrations FROM integrations WHERE status != 'disabled' GROUP BY connector_id` | `{ id, name, affectedTenants }` | kill-switch działa **na wszystkie organizacje naraz** (`superadmin.routes.ts:1073-1077`) — operator **musi** widzieć liczbę dotkniętych tenantów **przed** kliknięciem. Wzorzec agregatu: `adminIntegrations.routes.ts:95-100` (tam tenant-scoped — Twoja trasa jest platformowa i to jest świadome) |
| `GET /superadmin/ai/models`               | katalog modeli + status z `settings` (`ai:model:<id>:status`)                                                                                                           | `{ id, name, status }`          | jeśli **nie ma** wiarygodnego katalogu modeli po stronie serwera — **nie wymyślasz go**. `LLMManagementView.tsx:51` `FALLBACK_PROVIDER_MODELS` to **zaszyty katalog w kliencie**, domieszany do wyników serwera (`:158-160`) — **NIE JEST źródłem prawdy** i nie wolno go użyć jako listy celów      |
| `GET /superadmin/virtual-workers/catalog` | **istnieje już** `GET /api/virtual-workers` (`src/views/superadmin/VirtualWorkersModule/WorkersList.tsx:52`)                                                            | `{ id, name, status }`          | **najpierw sprawdź, czy nie wystarczy istniejąca trasa.** Jeśli wystarczy — nowej **nie tworzysz**, tylko konsumujesz istniejącą i wpisujesz to do raportu jako `JUŻ_BYŁO`                                                                                                                           |

**Zasada:** nowa trasa powstaje **tylko wtedy**, gdy nie ma istniejącej,
która zwraca to samo. Inwentarz robisz **przed** pisaniem:

```bash
grep -n "router.get(" server/src/routes/superadmin.routes.ts | grep -iE "organizations|users|connector|model|worker|integration"
grep -rn "api/virtual-workers'" src/ server/src/routes/ | head
```

**Rozszerzenie klienta:** `src/services/superadminPlatformOperationsApi.ts`
— `getPlatformOperationTargets()` (`:18-35`) dostaje dodatkowe legi
w `Promise.all`. **Zachowaj obecne zachowanie odporne na kształt**
(`listPayload`, `:9-16`) i **nie psuj** obecnych dwóch nóg: jeżeli nowa noga
zwróci błąd, dwie stare mają nadal działać (dziś jedno `Promise.all` wywala
całość — to jest **realna regresja, którą wprowadzisz**, jeśli nie użyjesz
`Promise.allSettled` albo osobnych zapytań).

**Testy (min. 4):** happy (lista niepusta) · pusty katalog → uczciwy pusty
stan, **nie** ukryta akcja · błąd jednej z nóg → pozostałe katalogi nadal
działają · **negatyw na warstwie żądania**: wołający bez roli `SUPERADMIN`
dostaje 401/403, nigdy 200.

**DoD:** każda nowa trasa jest `GET`, bramkowana jak siostrzane trasy
superadmina; zero nowych tabel; klient odporny na porażkę pojedynczej nogi;
≥4 testy; wpis w raporcie z tabelą „cel akcji → skąd lista → JEST/BRAK".

---

### P.2 — Wystawienie akcji, dla których katalog istnieje

**Zakres:** dokładnie te akcje z sześciu pozostałych, dla których `P.1`
dostarczył realną listę celów **i** krok 0 potwierdził, że zapis działa.
Realistycznie: `ai/models/:id/suspend`, `connectors/:id/emergency-kill`,
`virtual-workers/:id/suspend`. `mfa-override` i `sso-override` → `P.3`.
`data/bulk-export` → §1.7 poz. 2 (STOP).

**Jak dokładasz.** Rozszerzasz `ACTIONS`
(`PlatformOperationsView.tsx:21-63`) i `ActionId` (`:11`). Struktura
`ActionDefinition` (`:12-20`) wymaga rozszerzenia o nowe `targetType`
(`'connector' | 'aiModel' | 'virtualWorker'`) — i to jest **cała** zmiana
modelu. Nie przepisujesz ekranu.

**Kontrakt dialogu — bez zmian wobec fali 1, bo jest poprawny:**

1. nazwa akcji i skutek w zdaniu prostym;
2. **cel nazwany po imieniu**, nie ID;
3. **pole `reason`**, walidacja min. 3 znaki po stronie UI (`:107`);
4. **type-to-confirm WYŁĄCZNIE dla `purge`** (`:294-303`) — nie rozszerzasz
   go na nic innego (pułapka §1.5 pkt 9);
5. dla `critical` — jawne ostrzeżenie o nieodwracalności;
6. **dla `connectors/:id/emergency-kill` dodatkowo: liczba dotkniętych
   tenantów z katalogu `P.1`, w dialogu, przed przyciskiem.** To jest jedyna
   akcja na tym ekranie o zasięgu wielotenantowym.

Ciało żądania zawsze `{ confirmation: true, reason }`.

**Obsługa wyniku — bez zmian:** wpis w sekcji „Ostatnie operacje w tej sesji"
(znacznik czasu · akcja · cel · wynik · powód). **Zero optymistycznego
sukcesu przed odpowiedzią serwera.**

**Testy (min. 4 na akcję-rodzinę, nie na każdą akcję z osobna):**
render nowej karty · brak powodu → przycisk zablokowany · sukces → wpis
w logu sesji · błąd (403 albo 404) obsłużony bez fałszywego sukcesu ·
**negatyw**: kill-switch bez wybranego celu nie wysyła żądania.

**DoD:** każda wystawiona akcja ma `ConfirmDialog` + `reason`; kill-switch
pokazuje zasięg; zero zmian w kontrakcie backendu w tej pozycji; ≥4 testy
behawioralne; i18n (P.4); zrzut light+dark (P.6); wpis w raporcie
z **listą akcji wystawionych ORAZ listą świadomie pominiętych wraz
z powodem**.

---

### P.3 — `mfa-override` i `sso-override`: inwentarz konsumenta, potem decyzja

**To jest pozycja inwentarzowa. Jej produktem może być STOP i to jest
w porządku.**

Obie trasy (`:942-976`, `:979-1011`) zapisują wyłącznie klucz w `settings`:
`platform:mfa_override`, `platform:sso_override`. **Sprawdź, czy ktokolwiek
ten klucz czyta:**

```bash
grep -rn "platform:mfa_override\|platform:sso_override" server/src/ src/ | grep -v "superadmin.routes.ts"
grep -rn "mfa_override\|sso_override" server/src/middleware/ server/src/services/ | head -20
```

| Wynik                              | Co robisz                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| są realni konsumenci               | wystawiasz obie akcje jak w `P.2`, **plus `GET` bieżącego stanu** (przełącznik musi pokazywać, co jest ustawione — inaczej operator nie wie, czy włącza, czy wyłącza) |
| **zero konsumentów** (spodziewane) | **NIE wystawiasz.** Wpis `ZAPIS_BEZ_EGZEKWOWANIA` + STOP wg §1.7 poz. 1. **Nie dopisujesz konsumenta** — to jest Z14 i byłby to drugi `TRI-MUST-02`                   |

**Zakaz absolutny:** zbudowanie przełącznika, który zapisuje wartość, której
nikt nie czyta. Panel, który potwierdza politykę nieistniejącą, to dokładnie
defekt, za który werdykt trójkąta ukarał trzy przełączniki Admina
(`TRI-MUST-02`, `:29`).

**DoD:** tabela inwentarza konsumentów w raporcie (klucz → grep → liczba
trafień → werdykt); akcja wystawiona **albo** STOP z propozycją; zero kodu
dopisującego konsumenta.

---

### P.4 — i18n ekranu: naprawa długu fali 1 (pozycja tania, obowiązkowa)

**Stan zastany:** `PlatformOperationsView.tsx` ma **wszystkie** napisy
zaszyte po polsku — etykiety i opisy akcji (`:21-63`), nagłówek (`:184`),
komunikaty błędów (`:94`, `:142-151`). Namespace
`superadmin.platformOperations` **nie istnieje** w żadnym pliku locale.
Parytet zastany: `superadmin.*` → **PL 267 / EN 267**.

**Co robisz:**

1. Przenosisz **wszystkie** napisy ekranu do
   `superadmin.platformOperations.*` w **obu** plikach locale, w tym samym
   commicie co kod.
2. Klucze semantyczne, nie generowane (`actions.suspend.label`,
   `actions.suspend.description`, `risk.critical`, `errors.reasonRequired`,
   `session.title`…). **Zakaz kluczy typu `text1`, `autoN`** — dyżur nr 2
   już raz musiał to naprawiać commitem `348ad00aaa`.
3. **Zero fallbacków `defaultValue`** w wywołaniach `t()` — brakujący klucz
   ma być widoczny, nie zamaskowany.
4. Reużywasz istniejących kluczy tam, gdzie pasują:
   `superadmin.confirm.*` (`title`, `reasonLabel`, `reasonPlaceholder`,
   `reasonRequired`, `cancel`, `proceed`, `auditNotice`) — **sprawdź je
   przed tworzeniem nowych**.

Weryfikacja przed commitem:

```bash
# polskie literały w JSX — musi być pusto
grep -rnE ">[^<>{]*[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ][^<>{]*<" src/views/superadmin/PlatformOperationsView.tsx
# walidacja JSON + parytet superadmin.*
node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"
```

Liczby „przed" i „po" (PL/EN, `superadmin.*`) wpisujesz do raportu.

**Testy (min. 2, behawioralne):** render z locale `pl` i `en` pokazuje
różne napisy (dowód, że klucz naprawdę działa) · brak klucza nie renderuje
surowej ścieżki klucza w miejscu etykiety akcji.

**DoD:** zero literałów w JSX; parytet PL/EN utrzymany i udowodniony
liczbami; zero `defaultValue`; ≥2 testy.

---

### P.5 — Flaga nowej powierzchni (WARUNKOWA — tylko jeśli powstała nowa powierzchnia)

**Kiedy ta pozycja w ogóle istnieje.** Rozbudowa `ACTIONS` o kolejne karty
w istniejącym układzie **nie jest** nową powierzchnią i **nie wymaga flagi**.
Flaga jest wymagana, gdy dołożysz:

- nową tabelę/listę (np. katalog konektorów jako `StandardTable`),
- nową sekcję ekranu o własnym układzie,
- nowy dialog o kształcie innym niż `ConfirmDialog` fali 1.

**Jak.** Dokładnie **jedna** flaga, wzorzec `src/utils/myWorkCalendarV2Flag.ts`
(33 linie) albo `src/utils/triModeFlag.ts`:

```
src/utils/superadminPlatformOpsV2Flag.ts
  QUERY   = 'ff_superadminPlatformOpsV2'
  STORAGE = 'ff.superadmin_platform_ops_v2'
  ENV     = 'VITE_SUPERADMIN_PLATFORM_OPS_V2'
  kolejność: query ?? localStorage ?? env ?? false      ← DOMYŚLNIE FALSE
```

Rejestrujesz ją w rejestrze opisowym wg procedury z nagłówka
`src/utils/chatV9FeatureFlags.ts:43-47` (deskryptor + `EXPECTED_IDS`
w teście rejestru).

**Zakazy:** druga flaga = STOP (Z10). Zmiana wartości domyślnej istniejącej
flagi = STOP. Włączenie flagi „żeby zobaczyć" i zostawienie jej włączonej =
naruszenie CLAUDE.md reguła 9.

**DoD:** flaga domyślnie OFF udowodniona testem (`isEnabled()` bez query,
bez localStorage, bez env → `false`); ekran przy OFF wygląda dokładnie jak
przed dyżurem (test regresji); wpis w raporcie z nazwą flagi i trzema
kluczami.

---

### P.6 — ★ WEWNĘTRZNY POLISH-PASS (obowiązkowy dla KAŻDEJ zmiany wizualnej)

**Powód, dosłownie z CLAUDE.md reguła 7:** _właściciel nigdy nie jest
pierwszym testerem wizualnym_. Zanim ktokolwiek zobaczy Twój ekran, Ty
renderujesz go sam, robisz zrzut sam i sam odhaczasz listę. To nie jest
formalność — to jest bramka.

**Procedura, w tej kolejności:**

1. **Render realnego ekranu** — dev-render/harness z danymi z fixture,
   **bez logowania właściciela**, port `4340/4341`. Wzorzec skryptu:
   `scripts/dev/*-screenshots.mjs`.
2. **Zrzut własny: light + dark, PL + EN** — cztery zrzuty minimum,
   dla każdej nowej powierzchni.
3. **Lista czekowania — odhaczasz literalnie, każdy punkt, ZA KAŻDYM RAZEM:**

   | #   | Punkt                                                                             | Jak sprawdzasz                                                                                         |
   | --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
   | 1   | zero crimsonu dekoracyjnego                                                       | `grep -rnE "bg-c-accent\|primary-[0-9]\|btn-primary\|#85182F\|#A51C30\|#D42B3D" <Twoje pliki>` — pusto |
   | 2   | `--c-danger` tylko dla ryzyka `critical`/nieodwracalności                         | wzrokiem na zrzucie                                                                                    |
   | 3   | fokus niebieski `--c-focus` na każdym polu i przycisku                            | tabulatorem po ekranie, zrzut ze stanem fokusu                                                         |
   | 4   | tokeny `c-*`, zero surowych hexów                                                 | grep jw.                                                                                               |
   | 5   | light **i** dark czytelne (kontrast tekstu, obramowania widoczne)                 | dwa zrzuty obok siebie                                                                                 |
   | 6   | PL **i** EN bez rozjechanego układu (EN bywa dłuższy)                             | dwa zrzuty                                                                                             |
   | 7   | zero polskich literałów w JSX                                                     | grep z `P.4` — pusto                                                                                   |
   | 8   | zero gwiazdek, emoji, ozdobników                                                  | wzrokiem                                                                                               |
   | 9   | stan pusty jest uczciwy (brak celów → komunikat, nie pusta lista bez wyjaśnienia) | zrzut ze stanem pustym                                                                                 |
   | 10  | stan błędu jest uczciwy (błąd katalogu ≠ „brak celów")                            | zrzut ze stanem błędu                                                                                  |
   | 11  | akcja `critical` wizualnie oddzielona od `high`                                   | wzrokiem                                                                                               |
   | 12  | przycisk zablokowany, dopóki `reason` < 3 znaki                                   | zrzut ze stanem zablokowanym                                                                           |
   | 13  | responsywność: brak poziomego przewijania przy 1280 i 1024                        | dwa zrzuty                                                                                             |
   | 14  | a11y: każde pole ma etykietę powiązaną (`htmlFor`/`aria-label`)                   | odczyt kodu + test                                                                                     |

4. **Wynik listy wpisujesz do raportu jako tabelę 14 wierszy
   `punkt → OK/NIE OK → dowód`.** Punkt `NIE OK` bez naprawy = pozycja
   `CZĘŚCIOWO`, nie `ZROBIONE_WG_DoD`.
5. **Zrzuty zostają w repo** — `docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/evidence-superadmin-day15/`.

**Czego NIE robisz:** nie piszesz „gotowe do pokazania właścicielowi".
Piszesz **„gotowe do zrzutu przez nadzorcę"**. Nie włączasz flagi na stałe.
Nie prosisz nikogo o „włącz flagę i zobacz" jako pierwsze sprawdzenie —
pierwsze sprawdzenie robisz Ty, zrzutem.

---

## §T. SEKCJA TRI-MUST-12 — AUDYT ZAWIESZENIA ORGANIZACJI — trzy pozycje

**Przeczytaj `KOREKTA 1` w §1.4, zanim napiszesz linijkę kodu.**
Rdzeń `TRI-MUST-12` **jest już naprawiony** (commit `0ad8dd9dd8`). Twoim
zadaniem **nie jest** budowa od nowa, tylko: (a) **dowiedzenie**, że naprawa
działa na realnej bazie, a nie tylko na mocku; (b) domknięcie trzech luk,
które naprawa zostawiła.

---

### T.1 — Dowód na realnej bazie: audyt zawieszenia faktycznie ląduje w tabeli

**Dlaczego to jest osobna pozycja.** Cały istniejący dowód `TRI-MUST-12`
to **testy na mockowanym Expressie**
(`server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts`,
5 testów: mockowany `emitAuditEvent`, brak realnej bazy) plus **ręczne
sondowanie runtime** przy odbiorze dnia 2 („19/21 OK"), po którym w repo
**nie ma artefaktu nazywającego endpoint**. To jest dokładnie ta klasa
dowodu, którą CLAUDE.md odrzuca: „testy przeszły" ≠ „działa".

**Co robisz — test `realdb`, wzorzec:**
`server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts`
(bramka `describe.skipIf` na `RUN_DB_TESTS=1 && MOCK_DB=false &&
DATABASE_URL ~ ^postgres`, `:11-14`) oraz
`server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts`
(dwie organizacje, `appAsOrg()` `:39-52`).

Przebiegi do udowodnienia, każdy z **bezpośrednim `SELECT` z `audit_events`**,
nie tylko z odpowiedzi HTTP (nagłówek `cross-tenant.routes.pg.test.ts:4-10`
mówi o tym wprost):

| #   | Scenariusz                                                             | Oczekiwane HTTP                          | Oczekiwany wiersz w `audit_events`                                                                                                                    |
| --- | ---------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PUT /superadmin/organizations/:id` — zmiana **samej nazwy**           | 200                                      | **brak nowego wiersza** `organization.status_changed` (dowód, że nie zepsułeś zwykłej edycji)                                                         |
| 2   | `PUT` ze `status:'blocked'` **bez** `confirmation`                     | **428** `CONFIRMATION_REQUIRED`          | brak                                                                                                                                                  |
| 3   | `PUT` ze `status:'blocked'`, `confirmation:true`, `reason`             | 200                                      | `action='organization.status_changed'`, `before.status`, `after.status='blocked'`, `metadata.reason`, `metadata.via='superadmin.update_organization'` |
| 4   | `POST /superadmin/tenants/:id/suspend` z `{confirmation:true, reason}` | 200                                      | `action='tenant.suspended'` z `before`/`after` i `metadata.affectedUsers`                                                                             |
| 5   | `POST /tenants/:id/suspend` **bez** `reason`                           | **422** `REASON_REQUIRED`                | brak                                                                                                                                                  |
| 6   | `POST /tenants/:id/suspend` na organizacji już zawieszonej             | **409** (`superadmin.routes.ts:823-829`) | brak                                                                                                                                                  |
| 7   | **negatyw fail-closed:** symulowana awaria zapisu audytu przy `PUT`    | **503**                                  | brak wiersza **i brak zmiany statusu** (transakcja wycofana)                                                                                          |

Scenariusz 7 realizujesz wzorcem z
`server/src/services/__tests__/adminIamCommandService.pg.test.ts:173`
(trigger `BEFORE INSERT` wymuszający błąd). **Nie mockujesz globalnie** (Z18).

**Sprzątanie:** wszystkie rekordy fixture kasujesz na koniec. `docker rm -f`

- `docker volume rm` wg §0.3.

**DoD:** 7 przebiegów, każdy z asercją na wierszu w bazie (albo jego braku);
zero zmian w istniejącym pakiecie 5 testów (nie osłabiasz ani jednej
asercji); wynik „przed/po" w raporcie; `IDEMPOTENCJA_*` jeśli dotknąłeś
migracji.

---

### T.2 — Luka 1: reaktywacja organizacji nie zostawia śladu

**Stan zastany.** `'active'` nie jest ani w
`STATUS_CHANGES_REQUIRING_CONFIRMATION` (`superadmin.routes.ts:45`), ani
w `criticalStatusChange` (`SuperAdminController.ts:361`). Odwieszenie
organizacji przez `PUT /organizations/:id` **nie emituje niczego**.
Dedykowana trasa `POST /tenants/:id/reactivate` (`:865-899`) emituje
`tenant.reactivated` poprawnie — ale to inna ścieżka.

**Asymetria jest defektem sama w sobie:** dziennik audytu, w którym
widać zawieszenia, a nie widać odwieszeń, jest **gorszy niż żaden** — sugeruje
stan, którego nie ma.

**Dwie drogi. Wybierasz JEDNĄ i uzasadniasz w raporcie:**

| Droga                           | Na czym polega                                                                                                                                  | Koszt   | Ryzyko                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(A) audyt bez potwierdzenia** | rozszerzasz **wyłącznie** `criticalStatusChange` w kontrolerze (`SuperAdminController.ts:361`) o przejście do `'active'` **z** stanu `suspended | blocked | cancelled`; `STATUS_CHANGES_REQUIRING_CONFIRMATION` (`:45`) **zostaje bez zmian** — reaktywacja nie wymaga potwierdzenia, bo nie jest destrukcyjna | S   | minimalne; zwykła edycja i przejścia `pending`/`trial` nietknięte |
| **(B) pełna symetria**          | dokładasz `'active'` także do listy wymagającej potwierdzenia                                                                                   | S       | **zmienia zachowanie konsoli** — operator, który dziś odwiesza jednym kliknięciem, zaczyna dostawać 428. To jest zmiana produktowa, nie naprawa    |

**Domyślnie wybierasz (A).** Droga (B) wymagałaby decyzji właściciela —
jeśli uznasz, że jest lepsza, to jest **STOP z propozycją**, nie
samodzielna zmiana.

**★ PUŁAPKA IMPLEMENTACYJNA — ta sama, na której stanął dyżur nr 2.**
`SuperAdminController.updateOrganization` wykonuje zapis w **stylu
callbackowym** (`deps.db.run(sql, params, function (err) { … })`), a nie
przez `DbPromise`. **Nie przepisujesz tego kontrolera.** Emisję zdarzenia
robisz **wewnątrz callbacku po udanym zapisie**, dokładnie tam, gdzie
robi to obecna gałąź `organization.status_changed` (`:377-393`) — czyli
rozszerzasz istniejący warunek, nie budujesz drugiej ścieżki.
**Jeśli okaże się, że nie da się bez przepisania kontrolera — STOP.**

**Kształt zdarzenia** (identyczny jak istniejące, tylko inne wartości):

```
action:       'organization.status_changed'
resourceType: 'organization'
resourceId:   <id organizacji>
before:       { status: <status sprzed zmiany> }
after:        { status: 'active' }
metadata:     { reason: <powód lub ''>, via: 'superadmin.update_organization' }
```

**Testy (min. 3, dołożone do istniejącego pakietu, bez osłabiania go):**
`blocked → active` bez `confirmation` → **200** (nie 428) **oraz** wiersz
audytowy · `active → active` (brak realnego przejścia) → 200, **brak**
nowego wiersza · `pending → active` → 200 + wiersz (albo brak — **decydujesz
i zapisujesz decyzję w raporcie**, byle test pilnował faktycznego zachowania).

**DoD:** reaktywacja z trzech stanów krytycznych zostawia wiersz; zwykła
edycja i `pending`/`trial` nietknięte (dowiedzione testem); kontroler nie
przepisany na inny styl bazodanowy; ≥3 testy; wpis w raporcie z wybraną
drogą i uzasadnieniem.

---

### T.3 — Luka 2 i 3: inwentarz, nie naprawa

**To jest pozycja dowodowa. Produktem są dwie tabele w raporcie, nie kod.**

**Luka 2 — żaden formularz superadmina nie oferuje `suspended`.**

```bash
grep -n "suspended\|'blocked'\|'active'\|'pending'\|'trial'" src/views/superadmin/OrganizationsView.tsx | head -20
grep -n "suspended\|'blocked'\|'active'\|'trial'" src/views/superadmin/SuperAdminOrgDetailsModal.tsx | head -20
```

Stan zastany: `OrganizationsView.tsx:606-608` = `active | pending | blocked`;
`SuperAdminOrgDetailsModal.tsx:268-270` = `active | trial | blocked`.
Kontroler dopuszcza sześć statusów. **Wniosek do sprawdzenia i zapisania:**
„ścieżka zawieszenia", którą audytowano w `TRI-MUST-12`, jest z UI
**nieosiągalna** — jedyny realny zapis `suspended` idzie przez
`POST /tenants/:id/suspend` (ekran `PlatformOperationsView`).

**Co robisz:** tabelę w raporcie
`formularz → dostępne wartości → których brakuje → skutek`.
**Czy dokładasz `suspended` do listy wartości?** **NIE — bez decyzji
właściciela.** Dołożenie wartości do listy rozwijanej to zmiana produktowa
(dwa różne mechanizmy zawieszania w dwóch różnych miejscach konsoli).
STOP z propozycją: **ujednolicić na `POST /tenants/:id/suspend`** i usunąć
statusy destrukcyjne z formularzy edycji.

**Luka 3 — zawieszenie nic nie egzekwuje.**

```bash
grep -rn "suspended" server/src/middleware/ | head
grep -n "pending\|blocked\|suspended" server/src/controllers/AuthController.ts | head -20
grep -rn "organization.*status" server/src/middleware/auth.middleware.ts | head
```

Stan zastany: `AuthController.ts:325` bramkuje `pending`, `:332` bramkuje
`blocked`, **gałęzi `suspended` nie ma**; `grep` w `server/src/middleware/`
= 0 trafień. `POST /tenants/:id/suspend` (`:831-834`) **tylko liczy**
użytkowników do metadanych — nie unieważnia sesji, nie zmienia statusu
użytkowników.

**Co robisz:** tabelę
`warstwa → czy sprawdza status organizacji → dowód plik:linia → skutek`,
i **STOP**. **Nie dopisujesz gałęzi `suspended` do `AuthController`** —
to zmienia zachowanie logowania dla **całej platformy** podczas FREEZE
(`DEC-65`) i wymaga decyzji właściciela plus osobnego odbioru.

**DoD:** dwie tabele w raporcie z dowodami `plik:linia`; dwa wpisy STOP
z propozycjami; **zero kodu** w tej pozycji.

---

## §S. SEKCJA TRI-MUST-07 / TRI-MUST-11 — NIEBEZPIECZNE ENDPOINTY — pięć pozycji

**Przeczytaj `KOREKTY 2, 3, 4` w §1.4.** Trzy z czterech twierdzeń werdyktu
wymagają korekty, a przy okazji weryfikacji znalazłem **pięć dziur, których
werdykt nie wymienia**. Twój zakres to **stan faktyczny kodu**, nie brzmienie
werdyktu.

**Reguła nadrzędna tej sekcji:** front **nie woła** dziś żadnej z tych tras
(grep w `src/` = 0 dla A, B i D; dla C tylko trasy `:orgId`, już bezpieczne).
Naprawa jest więc **bezpieczna dla UI** — i **nie podpinasz do niej żadnego
ekranu**. Instrukcja nocna zakazywała podpinania UI i ten zakaz zostaje
w mocy: budujesz **trasy tenant-bezpieczne**, nie ekrany.

---

### S.1 — `GET /api/security/sessions/all`: guard roli

**Stan zastany:** `security.routes.ts:158-190`, łańcuch = `verifyToken`
i nic więcej (mount `Gateway.ts:1002`, bez middleware na mount).
Organizacja idzie **z tokenu** (`:162`, `WHERE u.organization_id = ?` `:167-170`)
— **nie ma wycieku cross-tenant**. Jest wyciek **wewnątrz** tenanta:
dowolny zalogowany, w tym `GUEST`, widzi do 200 sesji kolegów z e-mailem,
IP, user-agentem, lokalizacją i urządzeniem.

**Co robisz:** dopinasz `requireOrgAdmin` — **funkcję, która już jest w tym
pliku** (`:27-44`, czyta `organization_members.role`, przepuszcza
`OWNER`/`ADMIN`), użytą w `/settings` (`:55`, `:89`). Wzorzec wywołania:

```ts
const denial = await requireOrgAdmin(req);
if (denial) return res.status(403).json(denial);
```

**Nie tworzysz nowego middleware.** Nie zmieniasz zapytania — jest poprawne.

**Testy (min. 4, warstwa żądania):** OWNER → 200 z listą · ADMIN → 200 ·
**MEMBER/GUEST → 403** · brak tokenu → 401 · **negatyw cross-org**: token
organizacji B nie widzi ani jednej sesji użytkownika organizacji A
(asercja na zawartości, nie tylko na kodzie).

---

### S.2 — `DELETE /api/security/sessions/*`: przynależność, dwie trasy

**Stan zastany — dwie trasy, obie bez żadnej kontroli:**

| Trasa                           | Linie      | SQL                                                    | Zasięg                                                                                |
| ------------------------------- | ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `DELETE /sessions/:sessionId`   | `:192-200` | `DELETE FROM user_sessions WHERE id = ?` (`:197`)      | dowolna sesja na platformie                                                           |
| `DELETE /sessions/user/:userId` | `:202-210` | `DELETE FROM user_sessions WHERE user_id = ?` (`:207`) | **wszystkie** sesje dowolnego użytkownika — większy zasięg, **nie ma go w werdykcie** |

Handler `:192-200` **w ogóle nie czyta `req.user`**. Odpowiedź zawsze
`{success:true}`.

**Co robisz — wzorzec „wczytaj wiersz, potem porównaj org", kanoniczny
w tym repo: `access-control.routes.ts:508-520` (`DELETE /codes/:id`):**

1. `SELECT` sesji (albo użytkownika) razem z `organization_id` właściciela;
2. brak wiersza → **404** (nie 200);
3. `organization_id` ≠ organizacja z tokenu → **404** (nie 403 — nie
   potwierdzasz istnienia cudzego zasobu);
4. użytkownik kasujący **cudzą** sesję **w swojej organizacji** → wymaga
   `requireOrgAdmin` (jak `S.1`); kasowanie **własnej** sesji → dozwolone
   bez roli;
5. dopiero potem `DELETE`.

**To samo dla obu tras.** Trasa `/user/:userId` dodatkowo wymaga
`requireOrgAdmin` zawsze (masowe wylogowanie kogoś to akcja
administracyjna).

**★ Kompatybilność z zamrożonym demo (`DEC-65`):** zmiana zaostrza kontrakt
istniejących tras. Ponieważ **front ich nie woła** (grep = 0), ryzyko regresji
jest zerowe — **ale to musisz udowodnić greppem w raporcie**, nie założyć.

**Testy (min. 5, warstwa żądania):** własna sesja → 200 i wiersz zniknął
(potwierdzone `SELECT`) · cudza sesja w swojej org jako ADMIN → 200 ·
cudza sesja w swojej org jako MEMBER → 403 · **sesja innej organizacji →
404 i wiersz NADAL ISTNIEJE** (asercja SQL, nie tylko HTTP) · nieistniejące
`id` → 404, nie 200.

---

### S.3 — `/api/admin-data/*`: cztery trasy bez kontroli organizacji

**Stan zastany:** router ma już `verifyToken` (`:44`),
`requireRole('super_admin','admin','owner')` (`:45`) i hook
`router.param('orgId')` (`:48-56`) — „org z URL zamiast z tokenu"
**nie jest już eksploatowalne dla tras z `:orgId`**. Ale hook odpala się
**tylko** dla wzorców zawierających `:orgId`. Cztery trasy kluczują inaczej
(tabela w `KOREKTA 2`): `:277`, `:498`, `:791`, `:879`.

**Co robisz — dla każdej z czterech, ten sam wzorzec „load-then-check":**

1. `SELECT` wiersza (`security_events`, `user_sessions`, `scheduled_events`)
   razem z jego `organization_id`;
2. brak → **404**;
3. `organization_id` ≠ org z tokenu **i** wołający nie jest `super_admin`
   → **404**;
4. dopiero potem `UPDATE`/`DELETE`.

Kryterium spójności: **ten sam wyjątek dla `super_admin`, co w istniejącym
hooku** (`:50-53`) — nie wprowadzasz drugiej, niespójnej reguły w tym samym
pliku.

**Dodatkowo (tanie, jedna linia):** `apiAuthRateLimiter` jest w tym pliku
**zaimportowany i nigdy nieużyty** (`:15`). Dopinasz go do czterech
naprawianych tras. Jeżeli uznasz, że to zmienia zachowanie istniejących
konsumentów — **sprawdź greppem**, że ich nie ma, i zapisz wynik.

**Testy (min. 4 na trasę-rodzinę):** własna org → 200/204 i skutek widoczny
w bazie · **obca org → 404 i wiersz NIETKNIĘTY** (asercja SQL) ·
`super_admin` cross-org → 200 (świadomy wyjątek, zgodny z `:50-53`) ·
nieistniejące id → 404.

**Wzorzec testowy jest gotowy:** `server/src/routes/__tests__/cross-org-idor.test.ts`
— harness `buildAdminDataApp()` (`:242-248`), mock auth z mutowalnym
`mockUser` (`:42-73`), i **gotowy blok dla `admin-data` `:1286-1322`**
(401/403/200/200), który klonujesz dla czterech nowych tras. Nagłówek tego
pliku (`:1-14`) mówi wprost: każda naprawa bezpieczeństwa **musi** mieć tu
odpowiadający test.

---

### S.4 — `GET /api/access-control/requests` (TRI-MUST-11): trasa tenant-scoped

**Stan zastany:** `access-control.routes.ts:89-122` — `verifyToken` +
`requireSuperAdmin` (alias `verifySuperAdmin`, `superAdmin.middleware.ts:192`),
zapytanie `SELECT * FROM access_requests …` **bez filtra organizacji**
(`:96-101`), mimo że kolumna `organization_id` istnieje (czytana `:117`,
zapisywana przy zatwierdzeniu `:193`). Ekran „Access requests" tenanta
**nie może** tego wołać. Front nie woła (grep = 0 dla `GET`).

**Co robisz — nowa trasa OBOK, stara nietknięta:**

```
GET /api/access-control/requests/organization      ← nowa, tenant-scoped
```

- guard: `verifyToken` + `verifyAdmin` (**dokładnie ten, którego używają
  trasy `/codes` w tym samym pliku** — `:257`, `:309`, `:501`);
- organizacja **wyłącznie z tokenu**, nigdy z query/paramu;
- zapytanie: `… WHERE organization_id = ?` (+ opcjonalny filtr `status`);
- **wzorzec do skopiowania leży trzy trasy niżej**:
  `access-control.routes.ts:317-327` (`GET /codes`).

**Dlaczego nowa trasa, a nie zmiana starej:** zmiana `:89` zepsułaby
ewentualnego konsumenta superadmina (przegląd wszystkich wniosków to
uprawniona funkcja platformowa). Wzorzec commita:
`1de731c5c1 fix(interview-v4): resolve tenant from the token only`.
Jeżeli po greppie okaże się, że **nikt** nie woła `:89` i nie ma go
w żadnym ekranie — możesz **zaproponować** jej wycofanie, ale
**nie wycofujesz jej sam** (STOP z propozycją).

**Trzy mutacje w tym samym pliku bez kontroli organizacji**
(`PUT /requests/:id/approve` `:128`, `PUT /requests/:id/reject` `:214`) są
superadmin-only i **zostają jak są** — chyba że §A obejmie je audytem
(patrz `A.3`). Odnotowujesz je w raporcie.

**Testy (min. 4):** ADMIN swojej org → 200, widzi **wyłącznie** wnioski
swojej organizacji (asercja na zawartości) · MEMBER → 403 · **token org B
nie widzi ani jednego wniosku org A** · brak tokenu → 401 · stara trasa
`:89` **nadal zwraca to samo co przed dyżurem** (test regresji).

---

### S.5 — Dwie trasy z zerowym filtrem organizacji (znalezisko poza werdyktem)

**Stan zastany — w tym samym pliku co `S.1`/`S.2`:**

| Trasa                              | Linie                            | SQL                                        | Skutek                                                                    |
| ---------------------------------- | -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `GET /api/security/audit-logs`     | `:291-328`, zapytanie `:297-306` | `activity_logs` **bez żadnego `WHERE`**    | zrzut dziennika aktywności **całej platformy** dla dowolnego zalogowanego |
| `GET /api/security/api-keys/usage` | `:331-353`, zapytanie `:337-346` | agregat `api_logs` **bez żadnego `WHERE`** | koszty i wolumen API **wszystkich tenantów**                              |

To są **prawdziwe wycieki cross-tenant** — groźniejsze niż `S.1`.
W werdykcie ich nie ma, bo powstał przed tą weryfikacją.

**Co robisz:** filtr organizacji **z tokenu** w obu zapytaniach + guard roli
`requireOrgAdmin` (jak `S.1`). Jeżeli tabela nie ma kolumny organizacji —
**sprawdzasz to przed naprawą** i wtedy jest to **STOP** z propozycją
(np. `JOIN` przez `users.organization_id`), nie improwizacja:

```bash
psql "$DATABASE_URL" -c "\d activity_logs"
psql "$DATABASE_URL" -c "\d api_logs"
```

**Testy (min. 3 na trasę):** OWNER/ADMIN → 200 z danymi **wyłącznie** swojej
organizacji · MEMBER → 403 · **token org B nie widzi ani jednego wiersza
org A** (asercja na zawartości).

**Jeżeli zabraknie czasu:** `S.5` jest jedyną pozycją §S, którą wolno
zostawić jako **udokumentowane znalezisko z propozycją naprawy** zamiast
kodu — pod warunkiem, że `S.1`–`S.4` są domknięte. Wtedy wpis w raporcie
musi zawierać dokładny plik:linia, zapytanie i proponowany filtr.

---

## §A. SEKCJA TRI-MUST-08 — UNIWERSALNY AUDYT MUTACJI ADMINA — cztery pozycje

**Przeczytaj `KOREKTA 5` w §1.4, zanim cokolwiek zaprojektujesz.**
Uniwersalny pisarz audytu **już istnieje i już jest zamontowany globalnie**
(`server/src/index.ts:1274` → `auditLogMiddleware`). To jest przede wszystkim
**defekt projekcji**, wtórnie **defekt wierności**, i dopiero na końcu
**defekt gwarancji**. Zbudowanie od zera drugiego uniwersalnego middleware
byłoby powieleniem istniejącego mechanizmu — i **jest zakazane**.

---

### A.1 — Inwentarz (pozycja tania, obowiązkowa, PIERWSZA)

**Produktem jest tabela w raporcie. Bez niej reszta §A jest zgadywaniem.**

```bash
# (a) co czyta projekcja
sed -n '2231,2255p' server/src/routes/adminP32.routes.ts
grep -n "readTenantAdminAuditProjection\|role_change_audit_events" server/src/routes/adminP32.routes.ts

# (b) ilu pisarzy semantycznych jest dziś
grep -c "logAction" server/src/routes/adminP32.routes.ts        # oczekiwane 19
grep -rn "adminAuditService.logAction\|logAction(" server/src/routes/ | grep -v adminP32 | head -20

# (c) mutacje bez audytu, per plik
for f in $(grep -rl "router\.\(post\|put\|patch\|delete\)(" server/src/routes/admin*.ts server/src/routes/admin/*.ts server/src/routes/organization/teams.routes.ts server/src/routes/ai/ai-settings.routes.ts server/src/routes/ai-governance.routes.ts server/src/routes/access-control.routes.ts 2>/dev/null); do
  m=$(grep -cE "^\s*router\.(post|put|patch|delete)\(" "$f");
  a=$(grep -cE "logAction|emitAuditEvent|auditEventsService" "$f");
  echo "$m mutacji / $a audytów  $f";
done

# (d) czy uniwersalny middleware naprawdę jest zamontowany
grep -n "auditLogMiddleware" server/src/index.ts
sed -n '370,380p' server/src/middleware/auditLog.middleware.ts   # warunek pominięcia
```

**Punkt odniesienia** (mój pomiar na tej bazie — **zweryfikuj u siebie
i wpisz swoje liczby**): **83 mutujące trasy modułu Admin, 20 pisze wiersz
widziany przez projekcję, 63 nie.** Największe skupiska:

| Plik                                                                                                                              | Mutacji | Audytowanych | Bez audytu                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | ------------------------------------------------------------ |
| `adminP32.routes.ts`                                                                                                              | 20      | 19           | 1 (`POST /sso-self/validate` — dry-run, słusznie bez audytu) |
| `admin/enterprise-compliance.routes.ts`                                                                                           | 10      | 0            | **10**                                                       |
| `ai/ai-settings.routes.ts`                                                                                                        | 5       | 1            | **4**                                                        |
| `access-control.routes.ts`                                                                                                        | 6       | 0            | **6**                                                        |
| `ai-governance.routes.ts`                                                                                                         | 6       | 0            | **6**                                                        |
| `admin-data.routes.ts`                                                                                                            | 6       | 0            | **6**                                                        |
| `organization/teams.routes.ts`                                                                                                    | 5       | 0            | **5**                                                        |
| `admin/domains.routes.ts`                                                                                                         | 4       | 0            | **4**                                                        |
| `admin/backup.routes.ts`                                                                                                          | 4       | 0            | **4**                                                        |
| `admin-bulk.routes.ts`                                                                                                            | 3       | 0            | **3**                                                        |
| `admin/break-glass.routes.ts`                                                                                                     | 2       | 0            | **2**                                                        |
| `admin/service-accounts.routes.ts`                                                                                                | 2       | 0            | **2**                                                        |
| pozostałe (`ai-quality`, `health-panel`, `seats`, `guests`, `sessions`, `security-alerts`, `organization-profile`, `adminAlerts`) | 9       | 0            | **9**                                                        |

**Ranking dotkliwości — to on wyznacza, gdzie zaczynasz `A.3`:**

1. `admin/break-glass.routes.ts` — przyznanie/odebranie dostępu awaryjnego;
2. `admin/service-accounts.routes.ts` — poświadczenia maszynowe;
3. `admin-bulk.routes.ts` — masowa zmiana ról;
4. `access-control.routes.ts` — zatwierdzanie/odrzucanie wniosków o dostęp;
5. `admin/domains.routes.ts` — przejęcie i weryfikacja domeny
   (uwaga: stan weryfikacji trzymany jest w **pamięci procesu**, `Map`,
   `admin/domains.routes.ts:180` — znalezisko do raportu).

**DoD:** tabela `plik → mutacji → audytowanych → bez audytu` z Twoimi
liczbami; ranking dotkliwości; potwierdzenie lub obalenie mojego pomiaru
83/20/63; wpis, czy `auditLogMiddleware` faktycznie jest zamontowany.

---

### A.2 — Projekcja przestaje kłamać (droga główna)

**Cel:** `GET /api/admin/audit-logs` pokazuje mutacje, które **już są
zapisywane** przez `auditLogMiddleware`, a których projekcja dziś nie czyta.

**Stan zastany:** `readTenantAdminAuditProjection`
(`adminP32.routes.ts:2231-2255`) to **merge w JS dwóch nóg**, nie SQL UNION:
noga A = `adminAuditService.getLogs` → `admin_audit_logs`; noga B =
`SELECT … FROM role_change_audit_events`. Obie z **twardym `LIMIT 1000`
przed** filtrowaniem i paginacją (`:3026-3034`) — czyli `?limit/?offset`
paginują już obcięte okno. Deduplikacja po `${organization_id}:${id}`,
sortowanie w JS.

**Co robisz — dokładasz TRZECIĄ nogę: `audit_events`, tenant-scoped.**

Trzy rzeczy, które muszą się zgodzić, i każda jest pułapką:

| Problem                          | Stan                                                                                                                                                                                                                   | Co robisz                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **nazwy kolumn**                 | `audit_events` ma **`org_id`** (nie `organization_id`), **`ts`** (nie `created_at`), `action` **i** `action_type`, `actor_id` **i** `actor_user_id` (`20260809_artifact_studio_audit_and_presentation_cards.sql:7-25`) | normalizacja w JS, wzorem istniejącego `normalizeIamAuditEvent` (`adminP32.routes.ts:2213-2229`)                                                                                                         |
| **`risk_score` / `status`**      | istnieją **wyłącznie** na `admin_audit_logs`; projekcja ich używa w statystykach (`:3050-3053`) i filtrach; noga IAM **fabrykuje** je z zaszytego mapowania (`:2215`)                                                  | **nie fabrykujesz nowych liczb z sufitu.** Albo mapowanie jawne i udokumentowane w kodzie (jak IAM), albo pole `null` + ekran uczciwie pokazuje „—". **Zmyślony `risk_score` jest gorszy niż jego brak** |
| **`LIMIT 1000` przed paginacją** | zastany defekt obu nóg                                                                                                                                                                                                 | **nie „naprawiasz" tego przy okazji** — trzecia noga dostaje **ten sam** limit, żeby zachowanie było spójne. Rozwiązanie problemu okna to osobna pozycja; odnotowujesz w „Znaleziskach"                  |

**Filtr tenanta jest obowiązkowy i idzie z sesji admina**, nie z query:
`WHERE org_id = ?`. **Negatyw cross-org na warstwie żądania jest warunkiem
oddania pozycji** — projekcja audytu, która pokazuje cudze wiersze, jest
gorsza niż projekcja niepełna.

**Ryzyko wydajności:** `audit_events` jest tabelą, do której pisze **każde**
mutujące żądanie `/api/*` całej aplikacji — jest o rząd wielkości większa
niż dwie pozostałe. Bez indeksu na `(org_id, ts)` zapytanie będzie wolne.
Jeśli indeksu nie ma — dokładasz go migracją addytywną
(`CREATE INDEX IF NOT EXISTS`, `20260826_day15_*.sql`, reguły §0.3).
Sprawdzasz przed:

```bash
psql "$DATABASE_URL" -c "\d audit_events"
```

**Testy (min. 5, w tym realdb):** projekcja zawiera wiersz z `audit_events`
po realnej mutacji · zachowuje wiersze obu istniejących nóg (**test regresji
— istniejący pakiet `adminP32.auditProjection.pg.test.ts` musi przejść bez
zmian**) · deduplikacja nie gubi wierszy · sortowanie po czasie jest spójne
mimo trzech różnych kolumn czasu · **negatyw cross-org**: admin org B nie
widzi w projekcji ani jednego wiersza org A.

**DoD:** trzecia noga tenant-scoped; zero zmyślonych `risk_score`; istniejący
pakiet `pg.test.ts` zielony **bez modyfikacji**; ≥5 testów, w tym co najmniej
jeden `realdb`; indeks dołożony albo udowodniony jako istniejący.

---

### A.3 — Pisarz semantyczny dla najgroźniejszych mutacji (droga uzupełniająca)

**Kiedy to robisz:** dla tras, w których `resourceType`/`entityId` wywiedzione
przez `auditLogMiddleware` z **segmentów URL** (`:283-289`) są bezużyteczne —
a to dotyczy dokładnie tych najgroźniejszych (break-glass, service accounts,
bulk role change, access requests, domains).

**Wzorzec — `logAction` z `adminP32.routes.ts`**, czyli
`adminAuditService.logAction` (`server/src/services/adminAuditService.ts:54-104`).
Przeczytaj go **w całości** przed użyciem, bo ma trzy właściwości, o których
trzeba wiedzieć:

1. sygnatura to **nietypowany worek** (`data: any`, `:56`) — czyta
   `{ adminId, actionType, details }`, organizację rozstrzyga kaskadą
   `organizationId ?? orgId ?? details.orgId ?? details.organizationId` (`:67-69`);
2. `resource_type` domyślnie **przyjmuje wartość `actionType`** (`:72-74`),
   bo kolumna jest `NOT NULL` — jeśli chcesz sensowny typ zasobu,
   **musisz go podać jawnie**;
3. **jest `await`-owany, ale fail-open**: `INSERT` opakowany w `try/catch`,
   który połyka błąd i tylko `logger.warn` (`:79-102`). **Nieudany audyt
   nigdy nie blokuje mutacji.**

**★ Decyzja projektowa, którą podejmujesz świadomie i zapisujesz w raporcie:**
dla akcji z rankingu 1–3 (break-glass, service accounts, bulk role change)
**fail-open jest złym kontraktem**. Istnieje alternatywa **fail-closed**:
`requireAudit` + `req.emitAuditEvent` (`requireAudit.middleware.ts:74`,
rzuca przy nieudanym zapisie, `:245-247`, pozwalając trasie zwrócić
`503 AUDIT_UNAVAILABLE`) — używana już przez `superadmin.routes.ts`,
`my-work.routes.ts` (~20 miejsc) i osiem innych routerów, ale
**przez ŻADEN plik modułu Admin**.

| Droga                                  | Pisarz               | Tabela             | Zachowanie przy awarii | Widoczna w projekcji dziś |
| -------------------------------------- | -------------------- | ------------------ | ---------------------- | ------------------------- |
| (i) `logAction`                        | `adminAuditService`  | `admin_audit_logs` | **fail-open**          | TAK (noga A)              |
| (ii) `requireAudit` + `emitAuditEvent` | `AuditEventsService` | `audit_events`     | **fail-closed (503)**  | dopiero po `A.2`          |

**Nie mieszasz obu w jednej trasie.** Wybierasz **jedną** i uzasadniasz.
Domyślna rekomendacja: **(ii) dla rankingu 1–3, (i) dla reszty** — ale
tylko jeżeli `A.2` jest zrobione, bo inaczej wiersze (ii) nie pojawią się
na ekranie. Jeżeli `A.2` nie wyszło — używasz (i) wszędzie i zapisujesz to
jako świadome ograniczenie.

**Pułapka `admin_audit_logs` na świeżej bazie:** tabelę tworzą wyłącznie
`236_security_module_extended.sql:170` i `900_prod_missing_tables_hotfix.sql:841`,
**żaden nie pasuje do `MIGRATION_PATTERN`** (`migrationIdentity.ts:56`)
ani nie jest w allowliście (`:73-149`) — powstaje tylko przez
`DatabaseInitializer` (`:42`, `:159`). Jeśli Twój przebieg §0.3 to
potwierdzi — **odnotowujesz jako rozszerzenie `TRI-OBS-18`, nie naprawiasz
klasyfikatora**.

**Zakres:** **maksymalnie pięć plików z górnych pozycji rankingu.**
Nie „wszystkie 63 trasy" — to jest praca na kilka dyżurów i skończyłaby się
63 płytkimi wpisami zamiast pięcioma użytecznymi.

**Testy (min. 4, w tym realdb):** mutacja → wiersz w tabeli z poprawnym
`organization_id`, `actor`, `action_type` i `resource_type` (**nie**
`resource_type === action_type`) · mutacja nieudana (4xx) → **brak** wiersza ·
przy drodze (ii): awaria zapisu audytu → **503 i mutacja wycofana** ·
**negatyw cross-org**: wiersz ma organizację wołającego, nie organizację
z ciała żądania.

---

### A.4 — Kontrakt `AC-005` w liczbach (pozycja dowodowa, bez kodu)

Spec Admina wymaga: _„every Admin mutation defines … audit trail"_.
Po `A.1`–`A.3` podajesz w raporcie **stan przed i po**:

```
Mutacji modułu Admin ogółem:                  <N>
Widocznych w projekcji PRZED dyżurem:         <N>   (<%>)
Widocznych w projekcji PO dyżurze:            <N>   (<%>)
Z pisarzem semantycznym (nie tylko URL-owym): <N>
Fail-closed:                                  <N>
Nadal bez żadnego śladu:                      <N>   ← lista plików
```

**Nie zaokrąglasz w górę. Nie liczysz do pokrycia tras, których nie
sprawdziłeś.** Jeśli `AC-005` nadal nie jest spełnione w 100% — piszesz to
wprost, z listą pozostałych plików. To jest **poprawny wynik**; zawyżony
odsetek jest defektem raportu.

---

## §Q. SEKCJA TESTY — pięć pozycji

### Q.1 — ★ Jedyna dopuszczalna zmiana testu istniejącego

**Zasada: nie zmieniasz żadnego.** W szczególności **nie dotykasz**:

- `server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts`
  (5 asercji `TRI-MUST-12`),
- `server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts`
  (jedyny realdb-dowód audytu w repo),
- `server/src/routes/__tests__/cross-org-idor.test.ts` (poza **dopisaniem**
  nowych bloków — dopisywanie jest w porządku, zmiana istniejących nie),
- `src/views/superadmin/__tests__/PlatformOperationsView.test.tsx`
  (7 przypadków fali 1).

**Jedyny wyjątek:** test, który asertuje **dokładny kształt** odpowiedzi,
którą rozszerzyłeś addytywnie (np. `toEqual` na obiekcie, do którego
dołożyłeś pole). Wtedy: zmieniasz `toEqual` na `toMatchObject`
**bez usuwania ani jednej istniejącej asercji**, i wpisujesz to do raportu
w tabeli „asercje przed / asercje po / czy któraś osłabiona: **NIE**".

Jeśli test nie przechodzi z innego powodu — **STOP**, nie „poprawka testu".

### Q.2 — Kontrakty per nowa powierzchnia

Każda nowa trasa (`P.1`, `S.4`) i każda zmieniona (`S.1`, `S.2`, `S.3`,
`S.5`, `A.2`, `A.3`) dostaje pakiet: happy · 4xx · pusty stan ·
**negatyw cross-org**. Minimum cztery testy zachowania na powierzchnię.

### Q.3 — ★ Negatywy cross-org jako osobny, jawny pakiet

**To jest najważniejsza pozycja testowa całego dyżuru** i jednocześnie ta,
której dziś w repo brakuje: **nie istnieje ani jeden test odnoszący się do
`TRI-MUST-07` czy `TRI-MUST-11`** (werdykt mówi „5/5 negatywów czysto"
— to było żywe sondowanie runtime, nie test regresyjny, `:91`).

**Wymagania twarde:**

1. **Warstwa żądania, nie warstwa funkcji.** `supertest` przeciwko realnie
   zmontowanemu routerowi/aplikacji. Test wołający handler bezpośrednio
   z podstawionym `req` **nie liczy się do DoD** — obchodzi cały łańcuch
   montowania.
2. **Asercja na skutku, nie tylko na kodzie HTTP.** Przy operacji
   destrukcyjnej: `SELECT` potwierdzający, że wiersz **nadal istnieje**.
   Nagłówek `cross-tenant.routes.pg.test.ts:4-10` mówi to wprost.
3. **Dwie realne organizacje**, nie jedna z podmienionym id w tokenie tam,
   gdzie da się mieć dwie.
4. **Pakiet jest jawny** — jeden plik albo jeden `describe` per obszar,
   nazwany tak, żeby dało się go uruchomić osobno i pokazać w raporcie.

**Harnessy do skopiowania, w kolejności preferencji:**

- `server/src/routes/__tests__/cross-org-idor.test.ts` — `buildAdminDataApp()`
  `:242-248`, mock auth `:42-73`, gotowy blok `:1286-1322`. **Główny wzorzec
  dla `S.3`.**
- `server/src/routes/audits/__tests__/mounting.integration.test.ts` —
  realny `Gateway.initializeRoutes` (`:31-35`), token obcej organizacji
  (`:172`). Połowa bez bazy działa zawsze. **Wzorzec dla `S.1`/`S.2`/`S.4`.**
- `server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts`
  — realny PostgreSQL, `appAsOrg()` `:39-52`, fixture `:64-81`.
  **Wzorzec dla `T.1` i `A.2`/`A.3`.**
- `server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts`
  — najmniejszy, najświeższy (25.08).

**Bramkowanie testów realdb:** `describe.skipIf` na
`RUN_DB_TESTS=1 && MOCK_DB=false && DATABASE_URL ~ ^postgres`
(wzorzec `adminP32.auditProjection.pg.test.ts:11-14`). W repo **nie ma
testcontainers** — testy podpinają się do zewnętrznego `DATABASE_URL`
i same się pomijają, gdy go brak. **W raporcie podajesz, czy realdb
faktycznie się wykonały, czy zostały pominięte** — „pominięte" zaraportowane
jako „PASS" to fałszowanie dowodu.

**Macierz minimalna do wypełnienia w raporcie:**

| Trasa                                              | Brak tokenu | Zła rola | **Obca organizacja**       | Własna organizacja | Skutek potwierdzony SQL |
| -------------------------------------------------- | ----------- | -------- | -------------------------- | ------------------ | ----------------------- |
| `GET /security/sessions/all`                       | 401         | 403      | 0 wierszy                  | 200                | n/d                     |
| `DELETE /security/sessions/:id`                    | 401         | 403      | **404 + wiersz istnieje**  | 200                | TAK                     |
| `DELETE /security/sessions/user/:userId`           | 401         | 403      | **404 + wiersze istnieją** | 200                | TAK                     |
| `PUT /admin-data/security-events/:eventId/resolve` | 401         | 403      | **404 + niezmieniony**     | 200                | TAK                     |
| `DELETE /admin-data/sessions/:sessionId`           | 401         | 403      | **404 + wiersz istnieje**  | 200                | TAK                     |
| `PUT /admin-data/scheduled-events/:eventId`        | 401         | 403      | **404 + niezmieniony**     | 200                | TAK                     |
| `DELETE /admin-data/scheduled-events/:eventId`     | 401         | 403      | **404 + wiersz istnieje**  | 200                | TAK                     |
| `GET /access-control/requests/organization`        | 401         | 403      | 0 wierszy                  | 200                | n/d                     |
| `GET /security/audit-logs`                         | 401         | 403      | 0 wierszy                  | 200                | n/d                     |
| `GET /security/api-keys/usage`                     | 401         | 403      | 0 wierszy                  | 200                | n/d                     |
| `GET /admin/audit-logs` (po `A.2`)                 | 401         | 403      | 0 wierszy                  | 200                | n/d                     |
| katalogi `P.1`                                     | 401         | 403      | n/d (platformowe)          | 200                | n/d                     |

### Q.4 — i18n PL + EN, parytet utrzymany

```bash
node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8'));console.log('PL OK')"
node -e "JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8'));console.log('EN OK')"
# parytet superadmin.* — przed i po
node -e "
const k=o=>{const r=[];(function w(x,p){for(const q in x){const v=x[q],n=p?p+'.'+q:q;v&&typeof v==='object'?w(v,n):r.push(n)}})(o,'');return r};
const pl=k(JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json','utf8')));
const en=k(JSON.parse(require('fs').readFileSync('public/locales/en/translation.json','utf8')));
const f=a=>a.filter(x=>x.startsWith('superadmin.'));
console.log('PL',f(pl).length,'EN',f(en).length);
console.log('PL-only',f(pl).filter(x=>!f(en).includes(x)));
console.log('EN-only',f(en).filter(x=>!f(pl).includes(x)));
"
# polskie literały w JSX — musi być pusto
grep -rnE ">[^<>{]*[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ][^<>{]*<" src/views/superadmin/PlatformOperationsView.tsx
```

Stan zastany: **PL 267 / EN 267**, `PL-only` i `EN-only` puste.
Twój dyżur ten parytet **utrzymuje** — obie listy po dyżurze muszą być puste.

### Q.5 — Dane dowodowe i zrzuty w jednym miejscu

Fixture do zrzutów: skrypt `scripts/dev/` **własny, nowy**, nie modyfikacja
cudzego seeda. Zrzuty: `modules/14_ADMIN/evidence-superadmin-day15/`.
**Każdy probe sprząta po sobie** — zero rekordów testowych w jakiejkolwiek
bazie po zakończeniu dyżuru. Nazwy w danych dowodowych **bez słowa „test"**
w tytułach obiektów domenowych (heurystyki szkiców potrafią je ukryć).

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~60 min, NIE pomijasz)

1. **Marker i baza** (§0.1). Wynik obu komend do raportu:
   ```bash
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   `MARKER BRAK` = koniec dyżuru, raport z jedną pozycją STOP.
2. **Materiały wiążące** (§0.1 pkt 3). Brak któregokolwiek = STOP.
3. **★ Weryfikacja pięciu KOREKT z §1.4 — obowiązkowa, przed budową.**
   Nie wierzysz tej instrukcji na słowo, tak jak ona nie wierzy werdyktowi:
   ```bash
   # KOREKTA 1 — TRI-MUST-12
   grep -n "STATUS_CHANGES_REQUIRING_CONFIRMATION\|conditionalOrganizationConfirmation" server/src/routes/superadmin.routes.ts
   grep -n "organization.status_changed\|criticalStatusChange" server/src/controllers/SuperAdminController.ts
   grep -n "'active'\|'pending'\|'blocked'\|'trial'" src/views/superadmin/OrganizationsView.tsx | head
   grep -n "suspended" server/src/controllers/AuthController.ts server/src/middleware/*.ts

   # KOREKTA 2 — admin-data
   sed -n '44,60p' server/src/routes/admin-data.routes.ts
   grep -nE "router\.(put|delete)\('/(security-events|sessions|scheduled-events)" server/src/routes/admin-data.routes.ts

   # KOREKTA 3 i 4 — security.routes
   sed -n '155,215p' server/src/routes/security.routes.ts
   sed -n '285,355p' server/src/routes/security.routes.ts

   # KOREKTA 5 — audyt
   grep -n "auditLogMiddleware" server/src/index.ts
   sed -n '2231,2255p' server/src/routes/adminP32.routes.ts

   # stan fali 1
   grep -n "ActionId\|ACTIONS" src/views/superadmin/PlatformOperationsView.tsx | head
   ```
   **Każda rozbieżność wobec §1.4 idzie do sekcji „Korekty wobec instrukcji"
   w raporcie.** Kod jest prawdą.
4. **Stan wyjściowy testów — „przed"**, do porównania na końcu:
   ```bash
   npx vitest run server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts
   npx vitest run src/views/superadmin/__tests__
   npx vitest run server/src/routes/__tests__/cross-org-idor.test.ts
   npx vitest run server/src/routes/__tests__/adminP32.routes.test.ts
   bash scripts/check-list-canon.sh 2>&1 | tail -5
   ```
5. **Kontener PostgreSQL + replay migracji „przed"** (§0.3) — żebyś wiedział,
   czy replay stoi na cudzej migracji **zanim** dołożysz własną.
6. **Załóż plik raportu** i wypełnij nagłówek + tabelę warunków wstępnych.

### Blok 1 — bezpieczeństwo, część tania i pewna (S.1 → S.2 → S.3)

Zaczynasz od §S, nie od §P. Powód: to są **realne dziury bezpieczeństwa**,
front ich nie woła (zerowe ryzyko regresji UI), wzorce naprawy istnieją
w tych samych plikach, a wzorzec testowy jest gotowy do sklonowania.
Największa wartość na jednostkę ryzyka w całym dyżurze.

Kolejność wewnątrz: `S.1` (jedna linia guardu) → `S.2` (dwie trasy, wzorzec
load-then-check) → `S.3` (cztery trasy, ten sam wzorzec, gotowy blok testowy).

### Blok 2 — bezpieczeństwo, część wymagająca decyzji (S.4 → S.5)

`S.4` to nowa trasa obok starej — samodzielna, niskie ryzyko.
`S.5` może skończyć się STOP-em, jeśli tabele nie mają kolumny organizacji.

### Blok 3 — TRI-MUST-12 (T.1 → T.2 → T.3)

`T.1` jest **dowodem**, nie budową — i to on decyduje, czy `TRI-MUST-12`
wolno zaraportować jako domknięte. `T.2` jest tani (jeden warunek
w kontrolerze). `T.3` to dwie tabele i dwa STOP-y — kosztuje minuty.

### Blok 4 — audyt (A.1 → A.2 → A.3 → A.4)

`A.1` **zawsze**, bez wyjątku — bez inwentarza reszta jest zgadywaniem.
`A.2` to droga główna (jedna noga projekcji domyka najwięcej mutacji naraz).
`A.3` **maksymalnie pięć plików** z górnych pozycji rankingu.
`A.4` to liczby — pięć minut, ale bez nich raport nie ma wartości zarządczej.

### Blok 5 — Superadmin fala 2 (P.1 → P.2 → P.3 → P.4)

**Tu prawie na pewno zabraknie czasu i to jest przewidziane.**
Kolejność posortowana malejąco po stosunku wartości do kosztu:

- **P.4** (i18n) jest **tania i samodzielna** — jeśli widzisz, że zabraknie
  czasu na resztę §P, **zrób ją i tak**: naprawia realny dług fali 1
  i nie zależy od niczego;
- **P.1** blokuje `P.2` — bez katalogów celów nie ma czego wystawiać;
- **P.2** ma sens tylko dla tych akcji, dla których `P.1` się udało;
- **P.3** to inwentarz + prawdopodobny STOP — kosztuje minuty;
- **P.5** istnieje tylko warunkowo (nowa powierzchnia);
- **P.6** (polish-pass) jest **obowiązkowy dla każdej zmiany wizualnej**
  i nie jest opcjonalny. Jeżeli nie masz czasu na polish-pass — **nie
  robisz zmiany wizualnej**.

### Blok 6 — domknięcie (obowiązkowo, ~80 min, NIE pomijasz)

1. **Pomiar zasięgu testów** wg §0.4a: lista dotkniętych plików,
   wyodrębnienie współdzielonych, testy katalogów konsumentów, jawna
   deklaracja `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY`.
2. **OSIEM DOWODÓW — wszystkie do raportu, wszystkie obowiązkowe:**
   ```bash
   # (1) Z18 — globalna infrastruktura testowa            oczekiwany wynik: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"

   # (2) Z16 — uprawnienia i capability                   oczekiwany wynik: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "effectiveAccessService|frameworkEntitlement|superAdmin\.middleware"
   # (jeżeli superAdmin.middleware.ts wystąpi — MUSI to być wyłącznie §P.4/§P.2
   #  dopięcie ISTNIEJĄCEGO requireSuperAdminCapability do trasy, nigdy zmiana :43-49 ani :168-170)

   # (3) Z11 — nawigacja i trasy                          oczekiwany wynik: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "SuperAdminView|SuperAdminSidebar|AppRoutes|routeConfig|ProtectedRoute|AdminSettingsModule"

   # (4) Migracje — TYLKO Twoje, TYLKO 20260826_day15_*
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"

   # (5) Flagi — maksymalnie JEDNA nowa, domyślnie OFF
   git diff codex/m03-admin-20260824...HEAD -- src/utils/ | grep -E "^\+.*(QUERY|STORAGE|ENV)\s*="
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*defaultValue"     # oczekiwany: PUSTY

   # (6) Z17 — zakres plików                              każdy plik wymaga uzasadnienia
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -vE "^(server/src/routes/(superadmin|security|admin-data|access-control|adminP32)\.routes\.ts|server/src/routes/admin/|server/src/routes/organization/teams\.routes\.ts|server/src/routes/ai/|server/src/routes/ai-governance\.routes\.ts|server/src/services/adminAudit|server/src/middleware/adminAudit|server/src/controllers/SuperAdminController\.ts|server/migrations/20260826_day15_|src/views/superadmin/(PlatformOperationsView|SystemModule)|src/services/superadminPlatformOperationsApi\.ts|src/utils/|public/locales/|scripts/dev/|tests/|docs/program/waves/WAVE_03_ACCEPTANCE/(SUPERADMIN_DAY15_REPORT|modules/14_ADMIN/evidence-superadmin-day15))"

   # (7) Kanon tabel — baseline nietknięty
   bash scripts/check-list-canon.sh 2>&1 | tail -5
   git diff codex/m03-admin-20260824...HEAD -- scripts/check-list-canon.baseline.txt
   # drugi wynik MUSI być pusty; pierwszy: liczba naruszeń NIE ROŚNIE

   # (8) Higiena Dockera — po dowodzie migracji
   docker ps -a --filter name=cx-day15 --format '{{.Names}}'    # oczekiwany wynik: PUSTY
   docker volume ls -q | grep -i cx-day15                       # oczekiwany wynik: PUSTY
   ```
3. **Ponowne uruchomienie pakietów z Bloku 0 kroku 4** i wklejenie wyników
   „po" obok „przed".
4. **Oświadczenia FREEZE i WIP** (§9.1).
5. Domknięcie raportu.

### Zasada nadrzędna kolejności

**Lepiej pięć pozycji domkniętych co do DoD niż dwadzieścia „prawie".**
Jeżeli zostaje Ci godzina, nie zaczynaj nowej pozycji — zrób Blok 6,
uporządkuj commity i zamknij dyżur czysto. **Blok 6 nie jest opcjonalny.**

**Jeżeli musisz wybrać między pozycjami**, priorytet jest taki:

1. **S.2 + S.3** — siedem tras z destrukcyjnym IDOR-em cross-tenant,
   zerowe ryzyko regresji UI, gotowy wzorzec testowy. Najwyższa wartość
   w całym dyżurze;
2. **S.1** — jedna linia, zamyka wyciek danych osobowych wewnątrz tenanta;
3. **A.1** — inwentarz audytu; bez niego nikt nie wie, jak duża jest dziura;
4. **T.1** — dowód realdb dla `TRI-MUST-12`; bez niego pozycja MUST nie może
   być zaraportowana jako zamknięta;
5. **P.4** — i18n ekranu fali 1; tanie, samodzielne, naprawia realny dług.

**Pięć pozycji otwartych z §1.7 NIE jest odkładalnych** — ich produktem jest
STOP w raporcie, a to kosztuje minuty, nie godziny. Dyżur bez tych pięciu
STOP-ów zostawia nadzorcę bez pytań, na które musi odpowiedzieć.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY15_REPORT_20260826.md
```

Raport leży **na poziomie fali**. Nie tworzysz drugiego pliku nigdzie indziej,
nie zmieniasz `MODULE_ACCEPTANCE.md` żadnego modułu (warstwa Superadmin nie
ma karty odbioru — §1.2), nie zmieniasz rejestrów decyzji ani werdyktów (Z12,
Z13).

### 9.1. Szablon

```markdown
# Superadmin dzień 15 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź robocza: codex/superadmin-day15-<data>
Worktree: /private/tmp/consultify-superadmin-day15
Porty użyte: 4340/4341 (albo: żadne) · Kontener PG: cx-day15-pg (usunięty: TAK/NIE)
Czas pracy: <od>–<do>

## Oświadczenie o chronionym WIP (Z4/Z5)

Nie otwierałem, nie czytałem i nie kopiowałem katalogu
/Users/piotrwisniewski/Developer/Consultify — ani plików, ani diffów, ani gita.
Nie wchodziłem do cudzych worktree (Z6). TAK / NIE

## Oświadczenie FREEZE (DEC-2026-08-25-65)

Nie wykonałem żadnej operacji chmurowej: zero Railway (CLI, env, redeploy,
logi, odczyt projektu), zero deployów, zero zdalnych migracji/seedów/resetów,
zero zapisów do wspólnej bazy demo/staging, zero push/merge na
demo/develop/main/Londyn. TAK / NIE
Wszystkie migracje tego dyżuru: MIGRATION_PREPARED /
REMOTE_EXECUTION_NOT_AUTHORIZED. TAK / n/d
Kompatybilność wstecz z zamrożonym demo (kod działa BEZ moich migracji):
UDOWODNIONA / NIE DOTYCZY / STOP

## ★ Weryfikacja pięciu KOREKT z §1.4 (Blok 0 krok 3)

| Korekta | Twierdzenie instrukcji | Stan u mnie | Dowód |
| 1 | TRI-MUST-12 naprawiony na trasie PUT, 3 luki | POTWIERDZONE / INNE | |
| 2 | admin-data ma router.param('orgId'), 4 trasy bez kontroli | | |
| 3 | sessions/all bez guardu roli, ale org z tokenu | | |
| 4 | DELETE sessions bez kontroli + 3 dalsze dziury | | |
| 5 | auditLogMiddleware zamontowany globalnie; defekt projekcji | | |

## Warunki wstępne — wynik sprawdzenia

| Sprawdzenie                                         | Oczekiwane      | Wynik | Dowód                          |
| --------------------------------------------------- | --------------- | ----- | ------------------------------ |
| Marker jest przodkiem tipa                          | TAK             |       | `git merge-base --is-ancestor` |
| PlatformOperationsView.tsx istnieje (fala 1)        | ~310 linii      |       | `wc -l`                        |
| ACTIONS zawiera 5 akcji                             | TAK             |       | `:21-63`                       |
| tras P33 z requireConfirmation                      | 11              |       | `grep -c`                      |
| tras P33 z requireSuperAdminCapability              | 2               |       | `grep`                         |
| type-to-confirm                                     | tylko purge     |       | `grep confirmTenantName`       |
| namespace superadmin.platformOperations             | NIE ISTNIEJE    |       | node                           |
| i18n superadmin.*: PL 267 / EN 267, parytet         | TAK             |       | node                           |
| auditLogMiddleware zamontowany                      | index.ts:1274   |       | `grep`                         |
| projekcja audit-logs: liczba źródeł                 | 2               |       | `:2231-2255`                   |
| mutacji Admin ogółem / audytowanych                 | 83 / 20         |       | §A.1                           |
| check-list-canon: <N> / baseline <N>                | dług nie rośnie |       | skrypt                         |
| superadmin-organization-status-confirmation (przed) | 5/5 PASS        |       |                                |
| PlatformOperationsView.test (przed)                 | X/X PASS        |       |                                |
| cross-org-idor.test (przed)                         | X/X PASS        |       |                                |
| adminP32.routes.test (przed)                        | X/X PASS        |       |                                |
| replay migracji na świeżej bazie (przed)            | <stan>          |       | Blok 0 krok 5                  |

## Pozycje — tabela zbiorcza

| Pozycja | Zakres                                   | Status | Commit | Testy | Zrzuty | Uwagi |
| ------- | ---------------------------------------- | ------ | ------ | ----- | ------ | ----- |
| P.1     | katalogi celów operacji                  |        |        |       | n/d    |       |
| P.2     | wystawienie pozostałych akcji P33        |        |        |       |        |       |
| P.3     | mfa/sso override — inwentarz konsumenta  |        |        |       | n/d    |       |
| P.4     | i18n ekranu fali 1                       |        |        |       |        |       |
| P.5     | flaga nowej powierzchni (warunkowa)      |        |        |       | n/d    |       |
| P.6     | wewnętrzny polish-pass                   |        |        |       |        |       |
| T.1     | dowód realdb audytu zawieszenia          |        |        |       | n/d    |       |
| T.2     | audyt reaktywacji                        |        |        |       | n/d    |       |
| T.3     | inwentarz luk 2 i 3                      |        |        | n/d   | n/d    |       |
| S.1     | guard roli na /security/sessions/all     |        |        |       | n/d    |       |
| S.2     | przynależność na DELETE /sessions/*      |        |        |       | n/d    |       |
| S.3     | cztery trasy admin-data bez kontroli org |        |        |       | n/d    |       |
| S.4     | trasa tenant-scoped access-control       |        |        |       | n/d    |       |
| S.5     | dwie trasy z zerowym filtrem org         |        |        |       | n/d    |       |
| A.1     | inwentarz audytu mutacji                 |        |        | n/d   | n/d    |       |
| A.2     | trzecia noga projekcji                   |        |        |       | n/d    |       |
| A.3     | pisarz semantyczny (≤5 plików)           |        |        |       | n/d    |       |
| A.4     | AC-005 w liczbach                        |        |        | n/d   | n/d    |       |
| Q.1     | (nie ruszam testów istniejących)         |        |        | n/d   | n/d    |       |
| Q.2     | kontrakty per powierzchnia               |        |        |       | n/d    |       |
| Q.3     | pakiet negatywów cross-org               |        |        |       | n/d    |       |
| Q.4     | i18n PL+EN parytet                       |        |        |       | n/d    |       |
| Q.5     | fixture i zrzuty                         |        |        |       |        |       |

(Status ∈ ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · JUŻ_BYŁO · BRAK_API ·
ZAPIS_BEZ_EGZEKWOWANIA · BRAK_UI_JEST_API · NIE_ZACZĘTE)

## Tabele werdyktów — główny produkt pozycji

### P.1 — katalogi celów

| Akcja | Typ celu | Skąd lista | JEST / BRAK | Zapis działa na PG? |

### P.2 — akcje wystawione i pominięte

| Akcja | Wystawiona? | Powód pominięcia | Zasięg pokazany operatorowi |

### P.3 — konsumenci przełączników

| Klucz w settings | Grep | Liczba trafień | Werdykt |

### P.4 — i18n

| Miara | Przed | Po |
| klucze superadmin.* PL / EN | 267 / 267 | |
| polskie literały w JSX ekranu | <N> | 0 |
| defaultValue w t() | <N> | 0 |

### P.6 — polish-pass (14 punktów)

| # | Punkt | OK / NIE OK | Dowód |

### T.1 — siedem przebiegów realdb

| # | Scenariusz | HTTP oczekiwane | HTTP wynik | Wiersz w audit_events | SQL potwierdzony |

### T.2 — audyt reaktywacji

| Przejście | Potwierdzenie wymagane? | Wiersz audytowy? | Test |

### T.3 — luka 2 (wartości statusu w formularzach)

| Formularz | Plik:linia | Dostępne wartości | Brakujące | Skutek |

### T.3 — luka 3 (egzekwowanie zawieszenia)

| Warstwa | Sprawdza status organizacji? | Dowód plik:linia | Skutek |

### S — macierz negatywów cross-org (§Q.3)

| Trasa | Brak tokenu | Zła rola | Obca org | Własna org | Skutek potwierdzony SQL |

### A.1 — inwentarz mutacji

| Plik | Mutacji | Audytowanych | Bez audytu | Dotkliwość |

### A.4 — AC-005 w liczbach

| Miara | Przed | Po |

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — mfa-override / sso-override (zapis bez egzekwowania)

### STOP — data/bulk-export (brak katalogu zakresu, brak realnego eksportu)

### STOP — reaktywacja: droga (A) czy (B)

### STOP — zakres uniwersalnego audytu: projekcja czy pisarze

### STOP — access-control/requests: nowa trasa czy zmiana istniejącej

### STOP — <pozostałe, jeśli wystąpiły>

## Znaleziska (problemy w istniejącym kodzie — NIE naprawiane przeze mnie)

| # | Plik:linia | Co znalazłem | Dlaczego nie naprawiłem |
(oczekiwane co najmniej: brak deep-linku do zakładki platform-operations ·
wyścig SuperAdminView :83-95 · 9 z 11 tras P33 bez bramki capability ·
superAdmin.middleware.ts:168-170 przyznaje każdemu superadminowi komplet
capability · admin_audit_logs poza MIGRATION_PATTERN i allowlistą ·
ai_settings_audit tworzone wyłącznie w never-ran/ · LIMIT 1000 przed
paginacją w projekcji audytu · apiAuthRateLimiter zaimportowany i nieużyty
w admin-data.routes.ts:15 · stan weryfikacji domen w pamięci procesu
(admin/domains.routes.ts:180) · SessionManagementPanel.tsx:81 woła
nieistniejącą trasę /security-policies/sessions/all · restoreBackup
w api.ts:17752 bez żadnego importera · logAction fail-open
(adminAuditService.ts:96) · auditLogMiddleware pomija żądanie przy braku
org/user (:374-376))

## Korekty wobec instrukcji

(miejsca, gdzie instrukcja mówiła coś innego niż zastany kod — z dowodem)

## Migracje

| Plik | Addytywna? | Idempotencja | Backfill | Dowód (1)(2)(3) | Status FREEZE |
Deklaracja: IDEMPOTENCJA_PEŁNA / IDEMPOTENCJA_CELOWANA (+ nazwa cudzej
migracji, na której zatrzymał się replay)
Kompatybilność wstecz z zamrożonym demo: UDOWODNIONA / STOP
Higiena Dockera: kontener usunięty TAK/NIE · wolumeny usunięte TAK/NIE

## Testy

### Testy własne

| Plik testowy | Nowy/zmieniony | Behawioralny? | Warstwa żądania? | realdb? | Wynik |
(★ „Behawioralny?" — grep-testy oznaczasz NIE i nie liczysz do DoD)
(★ „realdb?" — jeśli test został POMINIĘTY przez skipIf, piszesz POMINIĘTY,
nigdy PASS)

### Zmiana testu istniejącego

| Test | Asercje przed | Asercje po | Czy któraś osłabiona? |
| (oczekiwane: BRAK ZMIAN we wszystkich) | | | MUSI BYĆ: NIE |

### Pomiar zasięgu (§0.4a)

Deklaracja: **ZASIĘG PEŁNY** / **ZASIĘG CZĘŚCIOWY**
Pliki współdzielone, które dotknąłem:
| Plik | Kto go importuje / woła spoza mojego zakresu |
Testy katalogów konsumentów:
| Katalog | Komenda | Wynik |
Czego NIE uruchomiłem i dlaczego:
(w szczególności: tests/e2e i tests/acceptance — Z17 zabrania mi tam wchodzić)

### Osiem dowodów Bloku 6
```

$ <komenda (1)>
<wynik — oczekiwany: pusty>
… (2)…(8)

```

### Testy stanu wyjściowego — przed i po
| Test | Przed | Po |
| superadmin-organization-status-confirmation.test.ts | 5/5 | |
| PlatformOperationsView.test.tsx | | |
| cross-org-idor.test.ts | | |
| adminP32.routes.test.ts | | |
| adminP32.auditProjection.pg.test.ts | | |
| check-list-canon (pełny skan) | <N>/<N> | |

## Zrzuty (P.6 / Q.5)
| Powierzchnia | Light | Dark | PL | EN | Plik |

## Licznik
Pozycji w zakresie: 23 (P:6 · T:3 · S:5 · A:4 · Q:5)
Domkniętych wg DoD: <N>   Częściowo: <N>   STOP: <N>
JUŻ_BYŁO: <N>   BRAK_API: <N>   ZAPIS_BEZ_EGZEKWOWANIA: <N>   NIE_ZACZĘTE: <N>
Pozycji otwartych ze STOP-em: <N> z 5

Akcji P33 wystawionych: <N> z 11 (przed dyżurem: 5)
Tras z naprawionym filtrem tenanta: <N>
Mutacji Admin widocznych w projekcji audytu: <N> z <N> (przed: 20 z 83)

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Dowód albo nie ma tego w raporcie.** Każde „działa" ma `plik:linia`,
   wynik komendy albo SHA commita.
2. **STOP jest wynikiem pełnowartościowym.** `BRAK_API` i
   `ZAPIS_BEZ_EGZEKWOWANIA` z pełną tabelą są **lepsze** niż UI nad pustką.
   W tym dyżurze trzy pozycje są z góry podejrzane o taki wynik
   (`P.3` mfa/sso, `data/bulk-export`, `S.5` przy braku kolumny organizacji)
   i nikt nie będzie tym rozczarowany.
3. **Test pominięty przez `skipIf` to NIE jest test zdany.** Piszesz
   `POMINIĘTY` i podajesz powód (brak `DATABASE_URL`, `MOCK_DB=true`).
   Raportowanie pominiętych jako `PASS` to fałszowanie dowodu.
4. **Nie piszesz „gotowe do pokazania właścicielowi" ani „warstwa Superadmin
   domknięta".** Piszesz „gotowe do zrzutu przez nadzorcę" (§1.2, §1.6).
5. **Nie raportujesz poziomu wyższego niż `TECHNICAL_PASS`.**
6. **Test grepujący źródło zawsze oznaczasz jako niebehawioralny.**
   Pozycja mająca wyłącznie takie testy jest odbierana jako `CZĘŚCIOWO`,
   niezależnie od liczby asercji.
7. **Nie oceniasz decyzji właściciela.** Jeśli decyzja wydaje Ci się zła,
   opisujesz **skutek techniczny** w „Znaleziskach", bez oceny.
8. **Raport piszesz na bieżąco**, po każdej pozycji. Nie na końcu z pamięci.
9. **Liczby podajesz swoje, zmierzone.** Liczby z tej instrukcji (83/20/63,
   267/267, 5/11, 11 tras) są **punktem odniesienia do weryfikacji**, nie
   wartościami do przepisania.

---

## 10. ŚCIĄGA

### 10.1. Pliki, które otwierasz najczęściej

```
# MATERIAŁY WIĄŻĄCE — otwierasz PRZED pierwszą linią kodu
docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md   :65 :75 :78 :84
docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_COMPLETENESS_REPORT_2026-08-25.md  :158 :308 :311 :318 :333
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md           :70 (DEC-18) :117 (DEC-65)
docs/program/waves/WAVE_03_ACCEPTANCE/ADMIN55_DAY2_REPORT_2026-08-25.md             :43-48 :85-88 :116

# §P — fala 2
server/src/routes/superadmin.routes.ts        :246-273 :364-380 :672 :763 :806-1239
server/src/middleware/confirmAction.middleware.ts  :56-59 :62 :83-84 :122-146 :187-204
server/src/middleware/requireAudit.middleware.ts   :74 :100-108 :243-247
server/src/middleware/superAdmin.middleware.ts     :43-49 :168-170 :192 :517-579   (TYLKO ODCZYT — Z16)
src/views/superadmin/PlatformOperationsView.tsx    :11 :21-63 :86-134 :142-151 :294-303
src/services/superadminPlatformOperationsApi.ts    :9-16 :18-35 :37-41
src/views/superadmin/SystemModule.tsx              :99 :126 :226 :259-260
src/utils/myWorkCalendarV2Flag.ts                  (wzorzec flagi, TYLKO ODCZYT)
src/utils/chatV9FeatureFlags.ts                    :43-47 :218   (rejestr flag)

# §T — TRI-MUST-12
server/src/routes/superadmin.routes.ts             :45 :48-68 :696-702 :811-899
server/src/controllers/SuperAdminController.ts     :326-403 (:361 :377-393 :400-405)
src/views/superadmin/OrganizationsView.tsx         :293-342 :606-608 :1336-1365
src/views/superadmin/SuperAdminOrgDetailsModal.tsx :169-179 :268-270 :551-575
server/src/controllers/AuthController.ts           :325 :332
server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts  (NIE ZMIENIASZ)

# §S — bezpieczeństwo
server/src/routes/security.routes.ts               :27-44 :55 :89 :123-156 :158-190 :192-210 :291-353
server/src/routes/admin-data.routes.ts             :15 :44-56 :277 :291-297 :498 :505 :791 :858-865 :879 :886
server/src/routes/access-control.routes.ts         :89-122 :257 :269 :309-332 :387 :501 :508-520
server/src/middleware/auditsStrictMembership.middleware.ts   :1-10 :109-113 :146 :168
server/src/utils/requestOrganization.ts            :19
server/src/routes/resultsVnext/kpiScorecard.routes.ts        :138-142 :158-166   (wzorzec)
server/src/Gateway.ts                              :642-645 :923 :1002 :1011 :462

# §A — audyt
server/src/routes/adminP32.routes.ts               :2140 :2213-2229 :2231-2255 :3016-3063
server/src/services/adminAuditService.ts           :25 :30-52 :54-104 :118-161
server/src/middleware/auditLog.middleware.ts       :228-474 (:236-239 :283-289 :356 :369 :374-376 :387 :401 :424)
server/src/index.ts                                :1274
server/src/services/AuditEventsService.ts          :62 :88
server/migrations/236_security_module_extended.sql        :170-194
server/migrations/20260816_admin_iam_operations.sql       :1-12
server/migrations/20260809_artifact_studio_audit_and_presentation_cards.sql  :7-40
server/src/services/tablePlatform/migrationIdentity.ts    :56 :73-149 :160-162

# testy — wzorce
server/src/routes/__tests__/cross-org-idor.test.ts               :1-14 :42-73 :242-248 :1286-1322
server/src/routes/audits/__tests__/mounting.integration.test.ts  :27-35 :97-104 :143-192
server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts  :4-10 :39-52 :64-81
server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts  :11-14 :136-168
server/src/routes/my-work/__tests__/signals.routes.org-isolation.test.ts  :31-42 :152-186
tests/integration/helpers/integrationTestHelper.ts               :16-27 :65-107   (WOŁAĆ, NIE ZMIENIAĆ — Z18)
```

### 10.2. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# bezpieczniki
bash scripts/check-list-canon.sh src/views/superadmin/PlatformOperationsView.tsx
bash scripts/check-list-canon.sh                     # pełny skan (bez --update!)
bash scripts/check-action-coverage.sh

# zakazane klasy (crimson) — przed commitem UI
grep -rnE "bg-c-accent|primary-[0-9]|btn-primary|#85182F|#A51C30|#D42B3D" <Twoje pliki>

# polskie literały w nowym JSX — musi być pusto
grep -rnE ">[^<>{]*[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ][^<>{]*<" <Twoje nowe pliki .tsx>

# test celowany (NIGDY pełny vitest/tsc)
npx vitest run server/src/routes/__tests__/cross-org-idor.test.ts
npx vitest run server/src/routes/__tests__/superadmin-organization-status-confirmation.test.ts
npx vitest run src/views/superadmin/__tests__

# testy realdb (wymagają jednorazowego kontenera)
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="postgres://postgres:cx@localhost:4342/cx_day15" \
  npx vitest run server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts

# typy punktowo
npx esbuild src/views/superadmin/PlatformOperationsView.tsx --loader:.tsx=tsx --outfile=/dev/null

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie
docker run -d --name cx-day15-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day15 -p 4342:5432 pgvector/pgvector:pg16
export DATABASE_URL="postgres://postgres:cx@localhost:4342/cx_day15"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day15-pg && docker volume ls -q | grep -i cx-day15 | xargs -r docker volume rm

# nowe pliki w tests/ wymagają -f (pliki __tests__ obok kodu — normalnie)
git add -f tests/integration/routes/<nowy>.test.ts

# POMIAR ZASIĘGU (§0.4a) — przed oddaniem raportu
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.3. Dziesięć rzeczy, które najłatwiej zepsuć

1. **★ Zbudowanie `TRI-MUST-12` od nowa.** On jest naprawiony
   (`0ad8dd9dd8`). Twoja robota to **dowód realdb** i **trzy luki**.
   Przepisanie tego, co działa, to strata dyżuru i ryzyko regresji.
2. **★ „Naprawienie" `/api/admin-data/*` przez przeniesienie org z URL do
   tokenu.** To już zostało zrobione (`router.param('orgId')`, `:48-56`).
   Realne dziury są na **czterech trasach z `:eventId`/`:sessionId`**.
3. **★ Zbudowanie drugiego uniwersalnego middleware audytu.** Jeden już jest
   i już jest zamontowany (`index.ts:1274`). Defekt jest w **projekcji**.
4. **★ Wystawienie przełącznika, którego nikt nie czyta.**
   `mfa-override`/`sso-override` zapisują klucz bez konsumenta. To jest
   dokładnie `TRI-MUST-02`, za który werdykt już raz ukarał Admina.
5. **★ Rozszerzenie type-to-confirm poza `purge`.** Backend sprawdza nazwę
   **tylko tam** (`:1129-1136`). Pole przepisania nazwy przy akcji, która go
   nie waliduje, uczy operatora, że przepisywanie nic nie znaczy.
6. **Zepsucie `getPlatformOperationTargets` przez dołożenie nogi do
   `Promise.all`.** Jeden nieudany katalog wywali cały ekran, łącznie
   z pięcioma działającymi akcjami. `allSettled` albo osobne zapytania.
7. **Zmyślony `risk_score` w trzeciej nodze projekcji.** Kolumna istnieje
   tylko na `admin_audit_logs`. Wymyślona liczba ryzyka jest gorsza niż jej
   brak — operator podejmie na jej podstawie decyzję.
8. **Test wołający handler bezpośrednio zamiast przez `supertest`.**
   Obchodzi łańcuch montowania i **nie dowodzi niczego** o izolacji tenanta.
   Nie liczy się do DoD.
9. **Zaraportowanie pominiętego testu `realdb` jako `PASS`.**
   `describe.skipIf` cicho pomija cały blok, gdy brak `DATABASE_URL`.
10. **★ Zmiana globalnego mocka albo configu vitest, żeby własny test
    przeszedł (Z18).** Tak zniknęło 27 testów w cudzych modułach
    w dyżurze nr 2 — cicho, bo nikt ich nie uruchamiał.

### 10.4. Tokeny kolorów (jedyne dozwolone)

```
--c-text            --c-surface           --c-success
--c-text-secondary  --c-surface-raised    --c-danger
--c-text-muted      --c-border            --c-info
                    --c-border-subtle     --c-focus
```

`--c-accent` = crimson = **wyłącznie marka**, nigdy element UI.
Fokus zawsze: `focus-visible:ring-2 ring-[color:var(--c-focus)]`.

W tym obszarze `--c-danger` **wolno** użyć wyłącznie dla: poziomu ryzyka
`critical`, ostrzeżenia o nieodwracalności, nieudanego zapisu. **Nie wolno**
dla: nagłówka sekcji, aktywnej zakładki, CTA, chipa statusu organizacji,
etykiety „Ostatnie operacje", ani poziomu ryzyka `high` (to jest stan
podwyższony, nie błąd — użyj neutralnego albo pomarańczowego).

---

## 11. NA KONIEC

Ten dyżur robi cztery rzeczy, a trzy z nich są naprawą tego, co dziś
w systemie jest **nieprawdą**.

**Pierwsza — siedem tras przestaje pozwalać na kasowanie cudzych danych.**
`DELETE /api/security/sessions/:id` nie czyta `req.user` w ogóle: dowolny
zalogowany użytkownik dowolnej organizacji może wylogować dowolną osobę na
platformie, a odpowiedź zawsze brzmi `{success:true}`. Siostrzana trasa
`/sessions/user/:userId` robi to samo dla **wszystkich** sesji wskazanej
osoby. Cztery trasy w `admin-data` pozwalają zamknąć cudze zdarzenie
bezpieczeństwa i skasować cudze zdarzenie zaplanowane. Dwie trasy
w `security.routes.ts` zrzucają dziennik aktywności i koszty API **całej
platformy** każdemu zalogowanemu. Front nie woła żadnej z nich — więc
naprawa jest tania i bezpieczna, a jej brak jest tylko kwestią czasu.

**Druga — dziennik audytu przestaje pokazywać jedną piątą prawdy.**
Dziś projekcja `/api/admin/audit-logs` czyta **dwie z pięciu** tabel, które
realnie zbierają ślady. Skutek: 63 z 83 mutacji panelu Admina — w tym
przyznanie dostępu awaryjnego, utworzenie poświadczeń maszynowych, masowa
zmiana ról i przejęcie domeny — **nie pojawiają się na ekranie audytu**,
mimo że część z nich jest zapisywana. Kontrakt spec `AC-005` mówi „every
Admin mutation defines … audit trail". Po tym dyżurze albo jest to prawdą
w liczbach, albo raport podaje dokładny odsetek i listę tego, co zostało.
**Trzeciej możliwości nie ma.**

**Trzecia — operator dostaje resztę narzędzi, które backend już ma.**
Jedenaście akcji P33 jest zaimplementowanych z potwierdzeniem, audytem
i transakcją. Fala 1 wystawiła pięć. Sześć pozostałych czeka nie dlatego,
że backend ich nie ma, tylko dlatego, że **nie było bezpiecznej listy celu**.
Katalog konektorów z liczbą dotkniętych tenantów, katalog modeli, katalog
pracowników wirtualnych — to jest cała brakująca różnica między „operacja
przez curl-a" a „operacja z konsoli, z nazwą celu i powodem".

**Czwarta — `TRI-MUST-12` dostaje dowód, którego nigdy nie miał.**
Naprawa jest w kodzie od 25 sierpnia, ale cały jej dowód to testy na
mockowanym Expressie i jedno ręczne sondowanie, po którym w repo nie ma
artefaktu nazywającego endpoint. Po `T.1` będzie siedem przebiegów na realnej
bazie z asercją na wierszu w `audit_events`. **A przy okazji wyjdzie na jaw,
że zawieszenie organizacji dziś niczego nie blokuje** — i to jest znalezisko
warte więcej niż połowa kodu tego dyżuru.

Trzy rzeczy, których ten dyżur **nie robi**, i to jest celowe: nie naprawia
modelu uprawnień (Z16, tor in-house), nie naprawia nawigacji superadmina
(wyścig `SuperAdminView`, tor in-house), nie buduje egzekwowania zawieszenia
organizacji (decyzja właściciela + osobny odbiór, podczas FREEZE
niedopuszczalne).

Jedna rzecz, którą ten dyżur ma zrobić **lepiej niż poprzednie**: nie
zostawić ani jednej kontrolki, która wygląda na działającą, a nie jest.
`ZAPIS_BEZ_EGZEKWOWANIA` z pełną tabelą jest odpowiedzią. Przełącznik, który
„zapisuje, ale nikt tego nie czyta", nie jest.

I dziewięć rzeczy, które sprawdzimy **przed** wszystkim innym przy odbiorze:
czy `git diff --name-only` nie zawiera ani jednego pliku globalnej
infrastruktury testowej (Z18); czy nie ruszyłeś `effectiveAccessService`
ani definicji capability (Z16); czy nie ruszyłeś `SuperAdminView`,
`SuperAdminSidebar`, `AppRoutes` ani `routeConfig` (Z11); czy wszystkie
migracje są addytywne, mają datę `20260826`, dowód idempotencji i status
`MIGRATION_PREPARED`; czy powstała **co najwyżej jedna** flaga i jest
domyślnie OFF; czy `check-list-canon.baseline.txt` jest nietknięty; czy
kontener PostgreSQL został usunięty **razem z wolumenami**; czy każdy test
`realdb` faktycznie się wykonał, a nie został cicho pominięty; i **czy każdy
negatyw cross-org jest zrobiony przez `supertest` na warstwie żądania,
z potwierdzeniem `SELECT`-em, że cudzy wiersz nadal istnieje**.

Dyżur, który zapali cudze testy, zalegalizuje cudzy dług, ruszy chmurę
podczas FREEZE, wystawi przełącznik bez konsumenta albo zaraportuje pominięty
test jako zdany, zostaje odrzucony w całości — niezależnie od tego, jak dobre
są pozostałe pozycje.

Powodzenia. Korekty z §1.4 zweryfikowane w Bloku 0, raport na bieżąco,
inwentarz przed każdą pozycją, STOP bez wahania zamiast zgadywania, prettier
przed każdym commitem, polish-pass przed każdą zmianą wizualną, Blok 6 zawsze.
