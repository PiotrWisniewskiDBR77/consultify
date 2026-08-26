# INSTRUKCJA DYŻURU nr 16 — Codex — „Meetings: DOKOŃCZENIE modułu — realny przepływ notatka→Materials/My Work/Initiatives z rodowodem, uczestnicy z tożsamością i statusem zaproszenia, PEŁNA cykliczność (to / to i następne / wszystkie), PEŁNA wysyłka zaproszeń realnym dostawcą ICS/e-mail, domknięta macierz ról"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–15. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **kontynuacją i domknięciem** dyżuru nr 10. Dyżur nr 10 zbudował
tylną mechanikę **strukturalnych Decyzji i follow-upów** (`decision-records` /
`follow-up-records`, migracja `20260826_meetings_day10_decisions.sql`), przełącznik
statusu modułu (`G.1`) i naprawę „Briefu operatora" (`B.1`). Ten dyżur robi to,
czego dyżur nr 10 świadomie **nie dotknął** i co właściciel domówił decyzją
**`DEC-2026-08-26-82` (pełny zakres TERAZ)**:

- **§H** — realny przepływ zatwierdzonej notatki do Materials / My Work / Initiatives z rodowodem w obie strony;
- **§U** — wymagania kalendarzowe właściciela `MYW-CAL-REC-001..003` (strefa czasowa, cykliczność, uczestnicy z tożsamością i statusem, artefakty dołączone);
- **§I** — **PEŁNA wysyłka zaproszeń** realnym dostawcą (generacja ICS + e-mail przez istniejącą infrastrukturę mailową repo);
- **§C** — **PEŁNA cykliczność**: model seria + wystąpienia + wyjątki oraz semantyka edycji „to wystąpienie" / „to i następne" / „cała seria";
- **§G** — domknięcie **macierzy ról × stan × ścieżka × tenant** na realnym routerze (`G.2`).

**Uwaga o numeracji — przeczytaj, żeby się nie pomylić.**

| Moduł | Katalog rejestru w repo | Trasy runtime | Decyzja o gramatyce tras |
| --- | --- | --- | --- |
| Meetings | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/` | `/meetings` (lista), `/meetings/:meetingId` (karta), `/meetings/:meetingId/{minutes,decisions}`, `/meetings/:meetingId/notes/:noteId` | `DEC-2026-08-24-07` (`OWNER_DECISION_LEDGER_2026-08-24.md:29`) |

`/meeting` (liczba pojedyncza) i `/meeting?meetingId=X` to **trwałe
przekierowania**, nie druga tożsamość modułu. Rejestr odbiorowy fali to
**`modules/08_MEETINGS/`** i tylko on jest wiążący.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Moduł Meetings jest dziś ZAMKNIĘTY dla ról klienckich i po Twoim dyżurze
nadal ma być zamknięty. Otwarcie wykonuje nadzorca, po odbiorze, jedną
zmianą konfiguracji — nie Ty.**

1. **NIE zmieniasz `MODULE_MEETING: 'closed'`** (`src/utils/betaAccess.ts:53`)
   na `'open'`. NIE usuwasz `MODULE_MEETING` z listy zablokowanych
   (`src/utils/pilotAccess.ts:66`). NIE odmontowujesz `closedBetaModuleGate`
   (`server/src/routes/meeting.routes.ts:146`). Twoim produktem w `G.2` jest
   **przetestowana macierz** obu stanów, nie samo otwarcie.
2. **Nie powstaje żadna nowa flaga funkcyjna.** Zero. Jeżeli uznasz, że
   potrzebujesz flagi — to jest **STOP**, nie improwizacja (CLAUDE.md reguła 9).
3. **Wszystko, co budujesz, musi być realne.** Zakaz atrap jest w tym dyżurze
   ostrzejszy niż zwykle: „materializacja" notatki, która wskazuje samą siebie,
   kolumna licząca dane bez ścieżki zapisu, przycisk „Zaproś" bez wysyłki —
   każda taka rzecz albo **działa naprawdę**, albo idzie do raportu jako
   `BRAK_API`/STOP. **Kontrolka bez działania = STOP, nigdy „na razie
   zostawiam".**
4. **★ PEŁNA WYSYŁKA to NIE atrapa „wysłano".** Decyzja `DEC-82` wprost odrzuca
   „tylko status w bazie". Masz **wygenerować realny ICS** i **wysłać go realnym
   mailerem repo** — ALE (patrz §I i ★ pkt 5) **wyłącznie do adresów
   w organizacjach testowych/scoped, NIGDY do danych demo**, a w dev/test
   w trybie przechwytywania (log), tak by **z tego dyżuru nie wyszedł ani jeden
   realny e-mail**.
5. **★ DEC-65 — dane demo są chronione, wspólna baza jest święta.** Baza demo
   = „twarz produktu". Ten dyżur **nie dotyka Railway, nie robi zdalnych
   migracji, nie pisze do wspólnej bazy demo**. Migracje przygotowujesz jako
   `MIGRATION_PREPARED` z testem kompatybilności wstecz i dowodem idempotencji
   na **jednorazowym lokalnym kontenerze**. Wysyłka e-maili chodzi **tylko**
   przeciw lokalnym organizacjom testowym w tym kontenerze — nigdy przeciw
   `DEMO_ORG_ID`.
6. **Karta `/meetings/:id` — PRAWY PANEL to NIE Twój zakres.** `DEC-82`
   zamówił poprawkę prawego panelu karty (zwijana metryczka SPEC-A wzorem
   Decisions/Tools/Tasks) — robi to **osobny robotnik wewnętrzny na gałęzi
   `codex/meetings-rightpanel-20260826`** (front). Ty budujesz **mechanikę
   tylną**. Prawego panelu / powłoki SPEC-A nie dotykasz (Z17, §1.4). To jest
   koordynacja, nie duplikat.
7. **Odbiór wizualny = nadzorca, po dyżurze.** Reguła 7 CLAUDE.md: właściciel
   nigdy nie jest pierwszym testerem wizualnym. W raporcie piszesz „gotowe do
   zrzutu przez nadzorcę", **nigdy** „gotowe do pokazania właścicielowi" ani
   „gotowe do otwarcia modułu".
8. **Migracje TAK, ale wyłącznie addytywne i z dowodem idempotencji.** Ten
   dyżur jest ciężki migracyjnie (uczestnicy, strefa, cykliczność, załączniki,
   wysyłka). Reguły §0.3 są twarde i bez wyjątków.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości
reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.
   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: c2f90af290**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor c2f90af290 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*` ani `codex/wave3-16-module-acceptance-*`. Załóż raport,
   wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

3. **★ Weryfikacja stanu dyżuru nr 10 (warunek wstępny, NIE formalność).**
   Ten dyżur zakłada, że backend dnia 10 (`decision-records` /
   `follow-up-records`, migracja `20260826_meetings_day10_decisions.sql`,
   parametryzowana bramka `G.1`) **jest w Twojej bazie**. W chwili pisania tej
   instrukcji te commity leżą na gałęzi `codex/meetings-day10-20260825`
   i **mogły jeszcze nie być scalone do `codex/m03-admin-20260824`**. Sprawdzasz
   to sam i **wynik jest obowiązkową pozycją raportu**:

   ```bash
   # (a) czy strukturalne API decyzji jest w bazie?
   grep -rn "decision-records\|follow-up-records" server/src/routes/meeting.routes.ts | head
   ls server/migrations/ | grep -i "meetings_day10_decisions"
   # (b) czy parametryzowana bramka G.1 jest w bazie?
   grep -n "createModuleGate\|BETA_MENU_STATUS" server/src/middleware/betaGate.middleware.ts
   # (c) gałęzie źródłowe dnia 10
   git branch -a --contains "$(git rev-list -1 codex/meetings-day10-20260825 2>/dev/null || echo HEAD)" 2>/dev/null | head
   ```

   - **SCALONE** (grep w (a) i (b) coś zwraca) → budujesz **do przodu**:
     rozszerzasz istniejące tabele/serwisy, nie tworzysz ich drugi raz.
   - **NIESCALONE** (grep pusty) → **to nie jest STOP całego dyżuru** —
     większość zakresu (§U uczestnicy, §C cykliczność, §I wysyłka, §H
     materializacja) **nie zależy** od `decision-records`. Postępujesz tak:
     * §H.2 (handoff działań) używa kolumn źródłowych na `meeting_follow_ups`
       (`source_kind`, `source_note_id`, `source_index`, `organization_id`).
       Dodajesz je **addytywnie własną migracją** z `ADD COLUMN IF NOT EXISTS`
       (jest no-opem, jeśli dzień 10 już je dodał — patrz §H.2 i §0.3);
     * §G.2 wymaga parametryzowanej bramki — jeśli `G.1` nie ma w bazie,
       **budujesz minimalny odpowiednik w zakresie §G.2** (patrz §G), bo bez
       tego nie da się przetestować stanu `open` bez zmiany wartości domyślnej
       (a to jest Z10).
     Wynik `SCALONE / NIESCALONE` opisujesz w raporcie w sekcji „Koordynacja".

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 134
   grep -n "DEC-2026-08-26-82" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :134
   grep -n "DEC-2026-08-25-58" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :110
   grep -n "DEC-2026-08-25-65" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :117
   grep -n "MYW-CAL-REC-00\|SET-INT-REC-001" docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md
   grep -n "MET-F-006" docs/modules/13_meeting/CURRENT_CONTRACT.md
   ```

   Brak któregokolwiek = **STOP**.

5. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/meetings-day16-<data> codex/m03-admin-20260824
   git worktree add /private/tmp/consultify-meetings-day16 codex/meetings-day16-<data>
   cd /private/tmp/consultify-meetings-day16
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD`.)

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/meetings-day16-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn` ani `codex/meetings-day10-*`, `codex/meetings-rightpanel-*` | `demo` = święta baza; tamte gałęzie należą do równoległych strumieni |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych** | Krach 3/4 powstał tak |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są już w rejestrze uwag i decyzjach |
| **Z5** | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`** | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, w szczególności `consultify-meetings-day10`, `consultify-day16-instrukcja`, `consultify-audits-block`, `consultify-meetings-rightpanel*` | Cudze worktree, część w użyciu |
| Z7 | **Nie zajmujesz portów sesyjnych** (3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4300/4301/4302, 4312, 4370, 4418, 4428, 4480/4481). Jeśli potrzebujesz lokalnego runtime — **4304/4305**; kontener PG — **4306** | 4300–4302 zajął dyżur nr 10 |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak zmiennych env produkcyjnych, brak redeployu, brak zdalnych migracji/seedów (DEC-65) | Produkcja/demo poza zakresem |
| Z9 | **Żadnej bazy poza jednorazowym lokalnym kontenerem** — nigdy baza demo/staging/produkcyjna, nigdy cudza retained-DB | „dane demo = twarz produktu" (DEC-65) |
| **Z10** | **Zero nowych flag. Zero zmian wartości domyślnej flagi. Zero zmian `MODULE_MEETING: 'closed'` → `'open'`. Zero odmontowania `closedBetaModuleGate`** | CLAUDE.md reguła 9 + ★ pkt 1 |
| Z11 | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/meetings/*` (`DEC-2026-08-24-07`) | Gramatyka zaakceptowana; decyzje P0 poza zakresem |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY16_REPORT_<data>.md`. Jedyny inny dokument, który wolno zmienić, to `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1` | Repo tonie w dokumentach-duchach |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **Nie budujesz generowania treści modelem.** `generate-notes` i „Brief operatora" traktujesz jako powierzchnie nad istniejącymi serwisami. Nie podpinasz dostawcy modelu, nie włączasz przechwytywania (`capture`) | Silnik AI = moduł agenta, ostatni w programie |
| Z15 | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych** (`MeetingHub` rozróżnia błąd-briefu ≠ brak-briefu; `meetingService` odmawia fałszywego sukcesu przy nieznanym follow-upie) | Uczciwy pusty stan > udawany ekran |
| **Z16** | **Nie dotykasz `server/src/services/**/effectiveAccessService*`**, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts` poza jawnym zakresem `G.2`. Wolno **czytać** i **cytować** | Model uprawnień naprawiany in-house |
| **Z17** | **★ Zakaz wszystkiego poza modułem Meetings** — z imiennymi wyjątkami z ramki poniżej (wołanie istniejących serwisów My Work / Initiatives / Materials, kopiowanie wzorca kalendarza, dostawca mailowy). Prawy panel karty i powłoka SPEC-A: NIE (należy do `rightpanel`) | „jeden moduł na raz"; karta ma akcept `DEC-54` |
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

Gdy potrzebujesz innego zachowania mocka (**dotyczy zwłaszcza `nodemailer` w §I**):
**opt-in, nigdy globalnie** — albo `vi.mock` lokalnie w Twoim pliku testowym,
albo dedykowany helper w **nowym** pliku importowanym tylko przez Twoje testy
(np. `server/src/services/meeting/__tests__/meetingDay16MailHarness.ts`). Nie
dopisujesz do `tests/__mocks__/nodemailer`. Jeśli Twój test nie przechodzi bez
zmiany globalnego mocka — to jest **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/meeting.routes.ts
  server/src/services/meetingService.ts
  server/src/services/meetingBoundary/**                        (+ __tests__ obok)
  server/src/services/meeting/**                                (NOWE serwisy: uczestnicy, wysyłka, cykliczność, ICS)
  server/migrations/20260914_meetings_day16_*.sql               (NOWE pliki, nazwa wg §0.3)
  server/src/utils/ics/**                                       (NOWY wspólny generator ICS wyekstrahowany — patrz §I.1)
  src/components/Meeting/**                                     (Hub, karta CENTRUM, __tests__)
  src/services/api.ts                                           (WYŁĄCZNIE dopisanie funkcji meeting* — plik współdzielony, ostrożnie)
  public/locales/{pl,en}/translation.json                      (TYLKO klucze meeting.*)
  scripts/dev/*meeting*screenshots*.mjs · scripts/dev/seed-wave3-meetings-owner-review.mjs   (TYLKO §T.5)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/evidence/**            (TYLKO nowe zrzuty §R.2)
  docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY16_REPORT_<data>.md            (jedyny nowy dokument)
  tests/unit/meeting/**  ·  tests/integration/routes/meeting.*                     (NOWE pliki)

IMIENNE WYJĄTKI POZA MODUŁEM (wolno WOŁAĆ istniejące, NIE zmieniać ich kodu/schematu/UI):
  §H.1 — server/src/services/v8/artifactRegistryService.ts::registerArtifactOrigin  (WOŁASZ)
         + wave5ArtifactRuntimeService (wstawienie treści dokumentu)                (WOŁASZ/wzorzec)
  §H.2 — server/src/services/TaskService.ts::createTask                             (WOŁASZ)
         server/src/services/initiative/createInitiativeService.ts::createInitiative(WOŁASZ)
         wzorzec: server/src/services/myWork/agentApprovedMaterializationService.ts (CZYTASZ jako wzorzec)
  §H   — server/src/services/artifactHandoff/handoffSpineService.ts                 (WOŁASZ materializeProposal; NIE zmieniasz TARGET_KINDS/PRODUCER_KINDS)
  §H.3 — jeden konsument kolumny „Źródło" po stronie Materials (front)              (zmiana ograniczona do wyświetlenia pola, które i tak jedzie z API — patrz §H.3)
  §U.5 — src/components/MyWork/Calendar/CalendarAttendeesField.tsx                  (CZYTASZ i kopiujesz wzorzec; NIE importujesz, NIE zmieniasz)
  §C   — server/src/services/v8/recurrenceEngine.ts + RecurrenceModel              (WOŁASZ; NIE zmieniasz)
  §I.1 — server/src/services/emailService.ts::send                                 (WOŁASZ; NIE zmieniasz)
         server/src/services/invitation/InvitationSendingService.ts                (CZYTASZ jako wzorzec „prawdomównej wysyłki")
         escapeIcsText/formatIcsDate z server/src/routes/integrations/calendarIntegrations.routes.ts (EKSTRAHUJESZ do server/src/utils/ics/ — patrz §I.1)

NIE WOLNO:
  src/components/standard/**  ·  src/components/shared/**        ← WOLNO UŻYWAĆ, NIE ZMIENIAĆ
  powłoka SPEC-A karty + PRAWY PANEL (ArtifactRightPanel)        ← akcept DEC-54 + własność rightpanel (DEC-82)
  src/components/MyWork/**  (poza odczytem wzorca §U.5)
  server/src/services/artifactHandoff/handoffSpineService.ts    ← WOLNO CZYTAĆ i WOŁAĆ; zmiana kontraktu = STOP
  server/src/services/v8/recurrenceEngine.ts                    ← WOLNO WOŁAĆ; zmiana = STOP
  server/src/routes/integrations/calendarIntegrations.routes.ts ← WOLNO CZYTAĆ/EKSTRAHOWAĆ helpery; nie zmieniasz zachowania tej trasy
  server/migrations/20260827_calendar_events.sql                ← wzorzec kalendarza (TYLKO ODCZYT)
  server/migrations/20260623_meetings_baseline.sql · 20260912_claude_c_meeting_boundary.sql   ← TYLKO ODCZYT
  server/migrations/20260826_meeting_agenda_templates.sql (jeśli obecna)  ← WŁASNOŚĆ dnia 6
  tests/e2e/**  ·  tests/acceptance/**                          ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(meetings): materialize approved note as a real Materials artifact (H.1)
  feat(meetings): participants model with identity and invitation status (U.3)
  feat(meetings): timezone on the meeting model (U.1)
  feat(meetings): full recurrence series/exceptions with edit scopes (C.1, C.2)
  feat(meetings): real ICS invitation delivery via repo mailer (I.1)
  test(meetings): negative role matrix on the real router in both states (G.2)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**:
  happy · ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**. Każda pozycja ma
  co najmniej jeden test, który wywołuje realny handler / renderuje realny
  komponent i sprawdza WYNIK.
- **Typy punktowo** (`npx esbuild <plik> --loader:.tsx=tsx --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `src/`/`server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **Nazewnictwo `20260914_meetings_day16_<temat>.sql`.** Data **14** (dzień 10
     zajął `20260826`, `calendar_events` — `20260827`). `migrate.postgres.ts`
     stosuje migracje w **porządku alfabetycznym nazw plików**. W Bloku 0
     potwierdzasz, że prefiks `20260914_` jest wolny; jeśli nie — bump do
     pierwszego wolnego `20260915+` i wpis do raportu.
  3. **★ ZERO kluczy obcych** do `meetings`/`meeting_*`/`meeting_notes` (pułapka
     sortowania). Tenant i istnienie rodzica sprawdzasz **w warstwie aplikacji**,
     dokładnie jak `meetingService`/`meetingBoundaryService`.
  4. **Nie rozszerzasz `ensureMeetingTables()`** (`meetingService.ts:95-121`)
     o nowe kolumny — to leniwy bootstrap pod SQLite, nie ścieżka wdrożenia.
     Nowe kolumny/tabele idą **wyłącznie** migracją.
  5. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65) — warunek oddania
     każdej pozycji z migracją.** Jednorazowy kontener, trzy przebiegi, wyniki
     do raportu:
     ```bash
     docker run -d --name cx-day16-pg \
       --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
       -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day16 \
       -p 4306:5432 pgvector/pgvector:pg16
     export DATABASE_URL="postgres://postgres:cx@localhost:4306/cx_day16"
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict     # przebieg 1
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict     # przebieg 2 → 0 applied
     NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry  # dry → 0 pending
     docker rm -f cx-day16-pg && docker volume ls -q | grep -i cx-day16 | xargs -r docker volume rm
     ```
     Kompatybilność wstecz = migracja stosuje się czysto **na bazie
     zawierającej wiersze sprzed migracji** (stare `meetings` z pełnym
     `attendees_json`, bez `timezone`, bez cykliczności) i nie psuje ich odczytu.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków/`sampleData`/
   `localStorage` jako źródła prawdy. Pusty wynik = uczciwy pusty stan.
2. **Zapis z readbackiem** — po `POST/PUT/PATCH` ekran/serwis ponownie odczytuje
   stan z serwera. Wzorzec pilnowania fałszywego sukcesu:
   `updateMeetingFollowUpStatus` (`meetingService.ts`, `M12-F01`) — nie osłabiasz.
3. **Zero atrap.** Każda kontrolka coś robi. Brak API → wpis `BRAK_API`, nie
   przycisk-widmo. Etykieta „Wysłano" tylko jeśli dostawca faktycznie potwierdził.
4. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne. Testy grepujące źródło się nie liczą.
5. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson `#85182F`.
   Czerwień = wyłącznie semantyka krytyczna. Fokus = `c-focus`.
6. **i18n PL + EN OD RAZU**, w tym samym commicie co kod. Zero literałów w JSX.
7. **Light i dark** — powierzchnia poprawna w obu motywach.
8. **★ Zrzut własny dla każdej NOWEJ powierzchni wizualnej** (light+dark),
   wykonany przez Ciebie, do `modules/08_MEETINGS/evidence/day16/`. Zrzut czysty:
   zero gwiazdek, tokeny `c-*`. Bez zrzutu pozycja wizualna jest CZĘŚCIOWA.
9. **Plik przez `prettier`** przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

Przed oddaniem raportu:
1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu). W tym
   dyżurze z definicji współdzielone: `src/services/api.ts` (prawie całe UI),
   `public/locales/{pl,en}/translation.json`, oraz — **jeśli** dodałeś minimalny
   gate w §G.2 — `server/src/middleware/betaGate.middleware.ts` (mountowany przy
   wielu routerach).
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum:
   ```bash
   npx vitest run src/components/Meeting/__tests__
   npx vitest run server/src/services/__tests__/meetingService.test.ts
   npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
   npx vitest run server/src/services/meetingBoundary/__tests__
   npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
   npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
   npx vitest run tests/unit/meeting
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego).

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- osłabić/usunąć asercję w teście istniejącym wcześniej (48-przepływowy pakiet
  `meeting.m12-golden-flows` twardo asertuje `410` na trzech legacy endpointach
  — **nie odblokowujesz ich**);
- zmienić kontrakt `handoffSpineService` (`TARGET_KINDS`/`PRODUCER_KINDS`/stany)
  albo `recurrenceEngine` — wolno **wołać**, zmiana = STOP;
- dodać migrację nieaddytywną albo zmieniającą typ/znaczenie istniejącej kolumny;
- **włączyć moduł** dla ról klienckich lub zmienić `MODULE_MEETING`/odmontować
  bramkę (Z10);
- stworzyć flagę funkcyjną (Z10);
- zmienić gramatykę tras / powłokę SPEC-A / **prawy panel** (Z11, Z17);
- **odkryć, że mailera repo NIE ma** albo że jedyna droga wysyłki wymaga
  realnego konta/dostawcy zewnętrznego (OAuth Google/Outlook) — patrz §I: masz
  udokumentowany mailer SMTP; jeśli w chwili dyżuru okaże się usunięty/martwy,
  **nie budujesz atrapy „wysłano"** — STOP z opisem, jaki dostawca skonfigurować;
- **wysłać realny e-mail poza organizacją testową/scoped** (DEC-65) — to jest
  STOP, nigdy „wyślę tylko raz na próbę";
- zbudować kontrolkę bez API (→ `BRAK_API`, nie atrapa);
- dotknąć innego modułu poza wyjątkami z ramki Z17, uprawnień ról (Z16) lub
  `ProtectedRoute`/`AppRoutes` (Z11);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił;
- napotkać zmianę robioną równolegle przez `codex/meetings-day10-*` lub
  `codex/meetings-rightpanel-*` (§1.4) — nie dublujesz, odnotowujesz.

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

Moduł Meetings ma zaakceptowaną listę (`DEC-2026-08-25-52`) i kartę SPEC-A
(`DEC-2026-08-25-54`). Sceptyk nadzorcy obalił tezę o kompletności; właściciel
przyjął to decyzją `DEC-2026-08-25-58` (**pełny zakres**). Dyżur nr 10 domknął
tylną mechanikę Decyzji/follow-upów, przełącznik statusu (`G.1`) i „Brief
operatora" (`B.1`), ale **świadomie zostawił jako STOP-y**: wysyłkę zaproszeń,
pełną semantykę edycji serii, materializację notatki do Materials i cały model
uczestników.

Właściciel zdjął te STOP-y decyzją **`DEC-2026-08-26-82`** (24–26 sierpnia):

> „(1) wysyłka zaproszeń — realny dostawca (ICS/email), nie tylko status
> w bazie; (2) edycja serii cyklicznych — pełna »to / to i następne /
> wszystkie«. Idzie do dyżuru Codexa dzień 16 (Meetings dokończenie: przepływ
> notatka→Materials H, uczestnicy U, cykliczność, wysyłka, + prawy panel karty)."

Ten dyżur robi punkty **notatka→Materials (H)**, **uczestnicy (U)**,
**cykliczność (C)**, **wysyłka (I)** i domyka **macierz ról (G.2)**. Prawy panel
karty (front) robi osobny robotnik (§1.4).

### 1.2. Dokumenty wiążące merytorycznie

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
        :29   DEC-2026-08-24-07  gramatyka tras /meetings (WIĄŻĄCA, Z11)
        :110  DEC-2026-08-25-58  Meetings pełny zakres (nadrzędna teza dyżuru)
        :117  DEC-2026-08-25-65  kontrakt staging/demo/production (DEC-65, chroni bazę i wysyłkę)
        :134  DEC-2026-08-26-82  TEN DYŻUR — pełna wysyłka + pełna cykliczność + prawy panel
docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md
        :34   MYW-CAL-REC-001    strefa czasowa, cykliczność, lokalizacja/link, zaproszeni
        :35   MYW-CAL-REC-002    org/projekt + goście zewnętrzni, organizator, status zaproszenia, uprawnienia
        :36   MYW-CAL-REC-003    artefakty (idee, notatki) dołączane i linkowane w zaproszeniu
        :37   SET-INT-REC-001    centrum integracji (Google/Outlook OAuth) — NIE Twój zakres (patrz §I.4)
docs/modules/13_meeting/CURRENT_CONTRACT.md
        MET-F-006  „Protokół i publikacja w Materials" = gap (§H)
docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (TYLKO ODCZYT poza §R.1)
docs/ui-standards/TRIADA_KANON.md                      ← lista /meetings
Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md     ← karta SPEC-A, archetyp C (Rekord)
```

**Cytaty właściciela (`RECOVERED_OWNER_FEEDBACK_2026-08-22.md:98-99`):**
> „Ta część spotkań […] jest w ogóle niepotrzebna. Usuńmy ją. Czego nam
> brakuje? Możliwości zapraszania kogoś do spotkań." (REC-001..002)
> „Do spotkania warto byłoby móc dodawać […] z zestawu idei i z zestawu notatek
> […] osoba, która dostaje zaproszenie, też powinna mieć link do tego." (REC-003)

Wymagania `MYW-CAL-REC-001..003` (dosłownie, `:34-36`):
> REC-001: „Meetings require time range, timezone, recurrence, location/link and invitees."
> REC-002: „Meetings must invite organization/project users and external guests, expose organizer/invitation status and preserve permissions."
> REC-003: „Allow Ideas, Notes and other authorized Consultify artifacts to be attached to a meeting and linked from the invitation without leaking private material."

### 1.3. Decyzje wiążące

1. **`DEC-2026-08-24-07`** — gramatyka tras. **Nie zmieniasz** (Z11).
2. **`DEC-2026-08-25-58`** — Meetings pełny zakres; `CLOSED_FINAL` odroczone do
   odbioru.
3. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   staging pisze TYLKO w osobnych organizacjach testowych (tenant-scoped);
   migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED` z testem
   kompatybilności wstecz; zakaz zdalnych migracji/seedów/zapisów do wspólnej
   bazy. **To jest prawo nadrzędne nad §I (wysyłka) i wszystkimi migracjami.**
4. **`DEC-2026-08-26-82`** — pełna wysyłka + pełna cykliczność + prawy panel;
   dzień 10 UI **NIE scalony** do czasu poprawki prawego panelu.

### 1.4. ★ KOORDYNACJA — trzy strumienie, których NIE dublujesz

**(a) Dzień 10 — backend Meetings (`codex/meetings-day10-20260825`).** Niesie
`decision-records`/`follow-up-records`, `G.1`, `B.1`, migrację
`20260826_meetings_day10_decisions.sql`. **W chwili pisania tej instrukcji może
NIE być scalony do Twojej bazy** — sprawdzasz to w Bloku 0 (§0.1 pkt 3) i wynik
idzie do raportu. Jeśli scalony → budujesz do przodu (rozszerzasz). Jeśli nie →
budujesz to, co i tak jest w Twoim zakresie i **niezależne** (§U, §C, §I, §H
materializacja), a brakujące prerekwizyty (kolumny źródłowe follow-upów w §H.2,
minimalna parametryzacja bramki w §G.2) dokładasz **addytywnie**, w sposób,
który jest no-opem przy późniejszym scaleniu dnia 10.

**(b) Prawy panel karty — front (`codex/meetings-rightpanel-20260826`).**
`DEC-82` zamówił zwijaną metryczkę SPEC-A po prawej stronie karty spotkania
(wzorem Decisions/Tools/Tasks). **Robi to osobny robotnik.** Ty:
- **NIE dotykasz** `ArtifactRightPanel`, powłoki SPEC-A, prawego panelu karty;
- budujesz **CENTRUM** sekcji karty i **API**, które ten front skonsumuje
  (uczestnicy, strefa, cykliczność, załączniki, rodowód). To jest granica:
  Ty dajesz dane i pola centrum, on składa metryczkę po prawej.
- Jeśli Twoja praca wymagałaby wejścia w prawy panel — **STOP**, wpis „własność
  rightpanel".

**(c) Naprawy szybkie / i18n / gating przycisków — nadzorca.** Nie dublujesz
i nie poprawiasz istniejących literałów. Twoje i18n dotyczy **wyłącznie kluczy,
które sam tworzysz**.

W Bloku 0 sprawdzasz stan wszystkich trzech:
```bash
git log --oneline codex/m03-admin-20260824..codex/meetings-day10-20260825 | head -20
git log --oneline codex/m03-admin-20260824..codex/meetings-rightpanel-20260826 | head -20
```
Wynik → raport. **Zasada rozstrzygająca spór o zakres:** jeśli nie wiesz, czy
coś należy do Ciebie, czy do (b)/(c) — **należy do nich**, a Ty wpisujesz to do
„Znalezisk".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **★ „Materializacja" notatki wskazuje samą siebie.** `decideMeetingNote`
   (`server/src/services/meetingBoundary/meetingBoundaryService.ts:534-602`) przy
   akceptacji woła `materializeProposal({ targetRecordId: note.id, ... })`
   (`:584`) — wierszem-artefaktem jest **ta sama notatka**. Komentarz kontraktowy
   (`:518-533`) mówi to wprost i deleguje resztę „konsumentowi, który czyta
   `producer_kind = 'meeting'`". **Takiego konsumenta nie ma w repo.** To jest
   `MET-F-006 = gap` i sedno §H. Zweryfikuj sam:
   ```bash
   grep -rn "producer_kind = 'meeting'\|producerKind: 'meeting'\|sourceType: 'meeting'" server/src | grep -v __tests__
   ```
2. **★ Słownik Materials i słownik handoffu są ROZŁĄCZNE.** `handoffSpineService`
   `TARGET_KINDS = document | presentation | workbook | material` (`:49`),
   ale rejestr Materials (`registerArtifactOrigin`,
   `artifactRegistryService.ts:1289`) **nie zna `origin_runtime='meeting'`** —
   `ArtifactOriginRuntimeValues` (`server/src/types/artifactRegistry.ts:17-44`)
   ma m.in. `native_artifact`, ale nie `meeting`. Dlatego materiał ze spotkania
   rejestrujesz jako `originRuntime: 'native_artifact'`, a „spotkaniowość"
   niesiesz w `originSummary.sourceType: 'meeting'` (§H.1). **Nie rozszerzasz
   enuma ani CHECK-a bazy** — to byłaby zmiana słownika współdzielonego (STOP).
3. **Materiał na liście, którego nie da się otworzyć.** Dla
   `origin_runtime='native_artifact'` treść musi mieć schemat dokumentu
   w `metadata_json.documentStudioSchema`, inaczej `GET
   /api/document-studio/:artifactId` zwraca `404`. Materiał, który jest na
   liście, ale nie otwiera się, **nie liczy się jako ukończony**.
4. **Tytuł z „test"/„smoke"/„probe"/„E2E" znika z listy Materials** (heurystyka
   szkicu). Twoje dane dowodowe **nie mogą** mieć takiego tytułu.
5. **`?sampleData=materials-vnext` kłamie** — podmienia listę Materials na
   fixture. Weryfikując §H **nigdy** nie używaj tego parametru.
6. **`meetings.attendees_json` to płaska lista stringów** (`meetingService.ts`
   `MeetingRecord.attendees: string[]`), UI trzyma je jako tekst z `\n`, tabela
   pokazuje **tylko licznik**, wyszukiwarka szuka po treści stringa. Brak
   tożsamości uczestnika — korzeń `MYW-CAL-REC-002` i §U.3.
7. **Brak strefy czasowej NIGDZIE.** `meetings.start_at/end_at` to `TEXT`,
   `calendar_events` też nie ma strefy. Jesteś pierwszy — §U.1.
8. **`recurrenceEngine` jest gotowy, ale zna tylko wystąpienia i wyjątki, nie
   „zakresy edycji".** `materializeInstances` rozwija RRULE/RDATE/EXDATE +
   `exceptions[]` w oknie i **nie mutuje serii**. „to wystąpienie" mapuje się na
   wpis `exceptions[]`, „cała seria" na edycję mastera; **„to i następne"
   (rozszczepienie serii) budujesz sam** (§C). Wołasz, nie zmieniasz.
9. **Mailer repo ISTNIEJE i jest realny.** `emailService.send`
   (`server/src/services/emailService.ts`) używa `nodemailer`, czyta SMTP
   z `settings.smtp_*` albo env `SMTP_*`, **obsługuje `attachments`** (tu wchodzi
   ICS) i zwraca `deliveryStatus` prawdomównie (`requireDelivery`). Wzorzec
   prawdomównej wysyłki zaproszeń: `InvitationSendingService.ts` (SENT/FAILED,
   nigdy fałszywy sukces). **NIE ma MailHog/Ethereal/przechwytywacza** — jedyny
   tryb „bez wysyłki" to brak konfiguracji SMTP (log-only „Mock (Console)").
   Konsekwencja dla dev/test w §I.3.
10. **`demoWriteProtection`/`DEMO_ORG_ID='demo-org'`** blokuje zapisy dla org
    demo (`server/src/middleware/demoGuard.middleware.ts`). W §I dokładasz
    **własny** twardy strażnik: wysyłka wyłącznie gdy org ≠ `DEMO_ORG_ID`.
11. **Dwa uczciwe zachowania są chronione (Z15):** rozróżnienie błąd-briefu ≠
    brak-briefu i odmowa fałszywego sukcesu przy nieznanym follow-upie. Nie
    cofasz ich „przy okazji".
12. **★ Trzy legacy trasy zwracają `410` celowo** (`POST /:id/decisions`,
    `POST /:id/follow-ups`, `PATCH /:meetingId/follow-ups/:followUpId`) —
    pilnuje tego 48-przepływowy pakiet golden-flows (asercje `410`). **Nie
    odblokowujesz ich.** Strukturalny zapis idzie nowym zasobem (dnia 10).

### 1.6. Reguła 7 — nic nie idzie na ekran właściciela z tego dyżuru

W raporcie piszesz „gotowe do zrzutu przez nadzorcę". Karta `/meetings/:id` ma
akcept `DEC-54` — każde Twoje dołożenie do centrum wraca na zrzut, więc ma być
zgodne z powłoką co do tokenów i odstępów. **Prawego panelu nie ruszasz.**

### 1.7. Pozycje otwarte — trzy rzeczy, których NIE ZGADUJESZ

Większość STOP-ów dnia 10 właściciel zdjął `DEC-82`. Zostają trzy:

| # | Pozycja otwarta | Gdzie | Twój produkt |
| --- | --- | --- | --- |
| 1 | Handoff działań do My Work/Initiatives: automat przy akceptacji czy osobna decyzja człowieka? | §H.2 | Domyślnie **osobna świadoma decyzja człowieka** (spójne z governance notatek). STOP z propozycją, jeśli nadzorca chce inaczej |
| 2 | Los legacy `attendees_json`/`decisions_json` po backfillu | §U.3 | Domyślnie **backfill + kolumna źródłowa nietknięta, UI/API czyta nowy model**. STOP z opisem skutków |
| 3 | Domyślny szablon zaproszenia (treść e-maila/ICS): język, pola, `METHOD` | §I | Domyślnie **`METHOD:REQUEST`, TZID + RRULE, ATTENDEE+ORGANIZER, treść z i18n `meeting.invite.*`**. STOP, jeśli właściciel chce konkretny branding/treść |

---

## 2. MAPA TECHNICZNA — skrót niezbędny

**Wszystkie numery linii poniżej zostały zweryfikowane na tipie
`codex/m03-admin-20260824` w chwili wystawiania instrukcji. Mapa starzeje się
w ~3 dni. Blok 0 każe Ci ją zweryfikować i pracować na stanie faktycznym; każdą
rozbieżność wpisujesz do „Korekt wobec instrukcji".**

### 2.1. Backend — co JEST gotowe (i czego NIE budujesz od nowa)

```
# Model spotkania — legacy, all-TEXT, tworzony leniwie
meetings(id, organization_id, project_id, title, start_at, end_at, location,
         attendees_json, pre_read_json, agenda_json, decisions_json, status,
         created_by, created_at, updated_at)          meetingService.ts:95-121
  → BRAK timezone, BRAK cykliczności, uczestnicy = attendees_json (płaska lista)
meeting_follow_ups(id, meeting_id, title, owner, status, created_at, updated_at)
  → BRAK organization_id (tenant przez rodzica getMeeting)

# Governance notatek — GOTOWE, działa, ma testy
meeting_notes(...)                       migracja 20260912_claude_c_meeting_boundary.sql
                                         serwis meetingBoundary/meetingBoundaryService.ts
  proposeMeetingNote  → createProposal(producerKind:'meeting', targetKind:'material')  :331-451
  decideMeetingNote   → approve/reject; ★ materializuje targetRecordId=note.id (GAP)   :534-602
  getMeetingNote      → odczyt z LEFT JOIN stanu propozycji + receiptId                :252-272

# Kręgosłup handoffu — WSPÓŁDZIELONY (Chat, Ideas, Organization) — tylko WOŁANIE
artifact_handoff_proposals / artifact_handoff_receipts   handoffSpineService.ts
  PRODUCER_KINDS = idea|chat|meeting|organization  :46 ·  TARGET_KINDS = document|presentation|workbook|material :49
  createProposal :419 · approveProposal/rejectProposal :605/609
  materializeProposal(input, donatedQuery?) :651  → exactly-one receipt; przyjmuje DAROWANĄ transakcję

# Rejestr materiałów — TU MA WYLĄDOWAĆ PROTOKÓŁ (§H.1)
registerArtifactOrigin(params)   artifactRegistryService.ts:1289  (idempotent na (organizationId, originRuntime, originRecordId))
  wymagane: organizationId, outputType('report'|'presentation'|'sheet'), artifactFamily('document'|...),
            originRuntime(enum — użyj 'native_artifact'), originRecordId, createdBy
  opcjonalne: titleSnapshot (OBOWIĄZKOWY dla native_artifact!), originSummary{ sourceType:'meeting', ... }
  treść dokumentu: wave5ArtifactRuntimeService (insert), z metadata_json.documentStudioSchema
  ★ 'meeting' NIE jest origin_runtime — patrz pułapka 2

# My Work / Initiatives — istniejące funnele (WOŁASZ, nie zmieniasz)
TaskService.createTask(input, userId, command{idempotencyKey, sourceType, sourceId})   TaskService.ts:110
createInitiative(orgId, rawInput, options)  (sourceType/sourceId; !='manual' wymaga sourceId)  createInitiativeService.ts:217
  wzorzec „approved → real object": myWork/agentApprovedMaterializationService.ts:235-251

# Cykliczność — silnik GOTOWY (WOŁASZ)
recurrenceEngine.ts:  materializeInstances(start,end,model,winStart,winEnd) :32 · parseRRule :158 · validateRecurrenceModel :170
RecurrenceModel:  calendarInteropService.ts:112-123  (rrule, rdate, exdate, exceptions[], materializationRule:'window_only')
wzorzec kolumn:  calendar_events.sql  (recurrence_rule, recurrence_parent_id — BEZ strefy)   20260827_calendar_events.sql

# Wysyłka — mailer GOTOWY (WOŁASZ)
emailService.send({to,subject,html,template,data,attachments,requireDelivery})  emailService.ts  (nodemailer, SMTP z settings/env, attachments = ICS)
InvitationSendingService.ts  (wzorzec SENT/FAILED prawdomówny)
generator ICS (route-local, PUBLISH, bez TZID/RRULE/ATTENDEE): calendarIntegrations.routes.ts  escapeIcsText:19 formatIcsDate:28 VEVENT:222-279
demoGuard.middleware.ts  (DEMO_ORG_ID='demo-org', demoWriteProtection)

# Bramka modułu — TRZY miejsca
klient  src/utils/betaAccess.ts:53 (MODULE_MEETING:'closed', BETA_ADMINS_EXEMPT=true)
pilot   src/utils/pilotAccess.ts:66
serwer  server/src/middleware/betaGate.middleware.ts:25-37 (closedBetaModuleGate — zaszyta lista ról), mount meeting.routes.ts:146
```

### 2.2. Frontend — punkty zaczepienia

```
src/components/Meeting/MeetingHub.tsx
  attendees:string[] (płaska lista)  ·  modal tworzenia (textarea \n)  ·  kolumna "Attendees" = LICZNIK
  wyszukiwanie po treści stringa uczestnika
  RENDER briefu w panelu podglądu (dowód, że dane są)  ·  chip z surowym id pokwitowania (zalążek rodowodu §H.3)
src/components/Meeting/MeetingObjectPage.tsx
  sekcje 'details' | 'minutes' | 'decisions'  ·  sekcja "Protokół" (notatki)
  ★ POWŁOKA + PRAWY PANEL — DEC-54 + własność rightpanel — NIE RUSZASZ; zmieniasz wyłącznie CENTRUM sekcji
```

### 2.3. Testy zastane — co Cię pilnuje

| Plik | Co pilnuje | Twój stosunek |
| --- | --- | --- |
| `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts` | 48 przepływów + asercje `410` | **Ma zostać zielony bez zmian** |
| `server/src/services/__tests__/meetingService.test.ts` | CRUD, follow-upy, `M12-F01` | Rozszerzasz; nie osłabiasz |
| `server/src/routes/__tests__/meeting.routes.test.ts` | kontrakty tras | jw. |
| `tests/unit/backend/middleware/meetingBetaGate.test.ts` | macierz ról bramki (+ grep montażu) | Rozszerzasz o „po otwarciu" (§G.2); grep nie liczy się do DoD |
| `server/src/services/meetingBoundary/__tests__/*.pg.test.ts` | governance notatek na realnym PG | Rozszerzasz o materializację do Materials (§H.1) |
| `src/components/Meeting/__tests__/*` | Hub, karta, cykl życia | Rozszerzasz |
| `src/routes/__tests__/meetingsCanonicalRoute.test.ts` | gramatyka `DEC-07` | **Nie ruszasz** (Z11) |
| `tests/unit/meeting/meetingCaptureDefaultOff.contract.test.ts` | przechwytywanie OFF | **Nie ruszasz** (Z14) |

### 2.4. i18n i kanon UI

- i18n: parytet `meeting.*` PL/EN musi zostać pełny (§T.4). Klucz tworzysz
  w chwili tworzenia napisu.
- Lista `/meetings` — kanon triady, wyłącznie `StandardModuleBar`/`StandardTable`/
  preview. Zakaz własnych tabel (`scripts/check-list-canon.sh`).
- Karta `/meetings/:id` — SPEC-A, archetyp C (Rekord). **Powłoka + prawy panel
  poza zakresem.** Zmieniasz wyłącznie CENTRUM sekcji.
- Tokeny: `--c-text*`, `--c-surface*`, `--c-border*`, `--c-success/-danger/-info/-focus`.
  `--c-accent`=crimson=wyłącznie marka. Fokus `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
  `--c-danger` **wyłącznie** stan krytyczny (nieudany zapis, artefakt niedostępny,
  wysyłka FAILED). „Zaproszenie odrzucone" = stan neutralny, **nie** czerwień.

---

## §H. PRZEPŁYW NOTATKA → MATERIALS / MY WORK / INITIATIVES (bloker B3) — cztery pozycje

**Cel:** zatwierdzony protokół przestaje być „materiałem, którym jest on sam",
a staje się **realnym artefaktem w Materials**, z rodowodem w obie strony
i z opcjonalnym, świadomym przekazaniem działań do My Work i Initiatives.
Domyka `MET-F-006` (`gap`).

### H.1 — Zatwierdzony protokół zostaje REALNYM materiałem

Dziś `decideMeetingNote` przy akceptacji materializuje `targetRecordId: note.id`
(`meetingBoundaryService.ts:584`) — wskazuje samą notatkę.

**Co budujesz.** Po udanej akceptacji (`action: 'approve'`), w tej samej
logicznej operacji (transakcyjnie — patrz pkt 5):

1. Powstaje **wiersz treści dokumentu** (wzorzec `wave5ArtifactRuntimeService`)
   z protokołem złożonym z payloadu notatki (`summary`, `keyPoints`, `decisions`,
   `actionItems`). **Wiersz MUSI nieść `metadata_json.documentStudioSchema`**
   (pułapka 3), inaczej materiał nie otworzy się.
2. Powstaje **wiersz rejestru** przez `registerArtifactOrigin({ organizationId,
   outputType: 'report', artifactFamily: 'document', originRuntime:
   'native_artifact', originRecordId: <id treści>, titleSnapshot: <tytuł
   protokołu, BEZ słowa „test">, createdBy, originSummary: { sourceType:
   'meeting', sourceId: meetingId, sourceTable: 'meeting_notes', noteId,
   receiptId } })`. `titleSnapshot` **obowiązkowy** (inaczej „Untitled artifact").
   **Nie dodajesz `origin_runtime='meeting'`** (pułapka 2).
3. **`targetRecordId` w pokwitowaniu handoffu wskazuje NOWY materiał**, nie
   notatkę. To jest sedno naprawy B3. Wołasz `materializeProposal` z nowym
   `targetRecordId` — **bez** zmiany `TARGET_KINDS`/stanów.

**Wymagania twarde:**
1. **Dokładnie jeden materiał na jedną zatwierdzoną notatkę.** Idempotencja: unikat
   `(organization_id, origin_runtime, origin_record_id)` w rejestrze + unikat na
   `artifact_handoff_receipts(proposal_id)`. Powtórzone `decideMeetingNote`
   (ścieżka replay, już istnieje) **nie tworzy** drugiego materiału.
2. **`reject` nie tworzy niczego** (`receipt: null`).
3. **`handoffSpineService` nietknięty** — wołasz `materializeProposal`, w razie
   potrzeby przekazując **darowaną transakcję** (2. argument), żeby oba zapisy
   (materiał + pokwitowanie) były atomowe.
4. **Tenant.** Materiał powstaje w organizacji spotkania. Test negatywny: obca
   organizacja nie widzi materiału.
5. **Awaria rejestracji nie zostawia stanu połowicznego.** Albo jedna transakcja
   obejmująca oba zapisy (darowana transakcja z `materializeProposal`), albo
   jawny stan `failed` propozycji + błąd z możliwością ponowienia. **Ciche
   „prawie się udało" = odrzucenie pozycji.**

**Definicja ukończenia H.1:**
1. Test na realnym PG: spotkanie → notatka → akceptacja → `GET /api/artifacts`
   pokazuje nowy wiersz z poprawnym `titleSnapshot` i `originSummary.sourceType
   === 'meeting'`.
2. Replay: druga akceptacja → liczba materiałów bez zmian.
3. Reject → zero materiałów.
4. Tenant: obca organizacja nie widzi materiału.
5. **Cold readback**: nowy klient/serwis (nie ten sam obiekt w pamięci) →
   materiał jest, otwiera się (`GET /api/document-studio/:artifactId` = `200`,
   nie `404`).

### H.2 — Opcjonalne przekazanie działań do My Work i Initiatives

**★ Pozycja otwarta nr 1 — rozstrzygnięcie domyślne: handoff jest OSOBNĄ,
ŚWIADOMĄ decyzją człowieka, nie automatem przy akceptacji.** Powód: governance
notatek jest zbudowane na „nic nie materializuje się bez jawnej decyzji".
Automat złamałby tę zasadę. Jeśli nadzorca zdecyduje inaczej — STOP z propozycją.

**Co budujesz:** na zatwierdzonym protokole każdy punkt działania (`actionItems`)
da się **jednym jawnym gestem** przekazać do My Work (zadanie) **albo** do
Initiatives (inicjatywa/działanie).

**Zakres (Z17, wyjątek imienny):** wołasz **istniejące funnele**:
- My Work: `TaskService.createTask(input, userId, command{ idempotencyKey,
  sourceType: 'meeting_note', sourceId: <meetingId:noteId:index> })` —
  wzorzec `agentApprovedMaterializationService.ts:235`.
- Initiatives: `createInitiative(orgId, { title, sourceType: 'meeting_note',
  sourceId: <...> }, options)` — `sourceType != 'manual'` wymaga `sourceId`.
- **Nie zmieniasz** ich kodu/schematu/UI. Jeśli funnel nie przyjmuje parametru,
  którego potrzebujesz — **`BRAK_API`** z pełną tabelą, **bez kontrolki w UI**.

**Kolejność:** najpierw inwentarz funneli, potem decyzja, czy budujesz.

**Wymagania twarde, jeżeli budujesz:**
1. **Idempotencja per punkt działania.** Ten sam punkt przekazany dwa razy nie
   tworzy dwóch zadań. Klucz `(meeting_id, note_id, source_index, target_kind)`
   trzymany **po Twojej stronie** — na `meeting_follow_ups` (kolumny źródłowe:
   `source_kind`, `source_note_id`, `source_index`; jeśli dzień 10 ich nie
   scalił, dokładasz je **addytywnie** własną migracją `ADD COLUMN IF NOT
   EXISTS`, patrz §0.1 pkt 3 i §0.3) plus `idempotencyKey` przekazany do funnela.
2. **Pokwitowanie** przy punkcie działania: co powstało, gdzie, kiedy, z czyjej
   decyzji, z linkiem.
3. **Uczciwa porażka** (odmowa uprawnień/błąd cudzego modułu) → komunikat
   i możliwość ponowienia, **nigdy** cichy sukces.
4. **Zero automatu.** Akceptacja notatki sama z siebie nie tworzy zadań.

**Definicja ukończenia H.2:**
1. Tabela inwentarza: `Cel · Funnel · Istnieje? · Kontrakt · Werdykt (ZBUDOWANE/BRAK_API)`.
2. Jeżeli `ZBUDOWANE` — 4 testy behawioralne na cel: happy · powtórzenie
   (idempotencja) · odmowa uprawnień · obcy tenant.
3. Jeżeli `BRAK_API` — **brak kontrolki w UI.**
4. i18n PL+EN, light+dark, zrzuty własne.

### H.3 — Rodowód czytelny w obie strony

Dziś rodowód to surowy identyfikator pokwitowania w chipie na liście, i nic
więcej. Po stronie Materials kolumna „Źródło" pokazuje **runtime**
(`native_artifact`), nie moduł.

**Co budujesz — trzy rzeczy, ani jednej więcej:**
1. **Na karcie spotkania (CENTRUM sekcji „Protokół"):** przy zatwierdzonej
   notatce widać, **co z niej powstało** — nazwa materiału + link do
   Materials/Document Studio. Surowy `receiptId` zostaje dostępny (atrybut
   diagnostyczny), bo jest dowodem odbiorowym. **Prawego panelu nie dotykasz.**
2. **W Materials (jedyny wyjątek poza modułem, §H.3):** kolumna „Źródło"
   preferuje `originSummary.sourceType` przed `originRuntime`, tak by materiał ze
   spotkania pokazał się jako „Meeting". **Najpierw w Bloku 0 zlokalizuj
   faktycznego konsumenta FE** (kandydaci: `src/components/ReportsAndPresentations/
   useRapData.ts`, `src/types/materials.ts`, `dev-render/screens/*materialy*`) —
   zmiana ograniczona do **jednej linii/jednej reguły preferencji**, wzorem
   istniejącej `resolvePresentationSourceType`, jeśli taka jest. **Każda inna
   zmiana w Materials = STOP.**
3. **Po stronie API spotkania:** `GET /:id/notes` już dołącza stan propozycji
   i `receiptId` przez `LEFT JOIN` — rozszerzasz o tożsamość powstałego materiału
   (id + tytuł), **bez** zmiany kształtu pól istniejących.

**Definicja ukończenia H.3:**
1. Po akceptacji karta pokazuje nazwę materiału i link; link prowadzi pod adres,
   który istnieje (`200`, nie `404`).
2. Materials: wiersz ze spotkania ma w „Źródło" wartość wskazującą spotkanie;
   wiersz z czatu **nadal** pokazuje swoją wartość (brak regresji).
3. Notatka `proposed` **nie pokazuje** materiału (uczciwy stan).
4. `git diff` w konsumencie Materials = dokładnie jeden plik, jedna zmiana logiki.
5. Zrzuty: karta z rodowodem · lista Materials z „Źródło", light+dark.

### H.4 — Cold readback całej ścieżki (pozycja dowodowa, bez nowego kodu)

Uruchamiasz pełną ścieżkę na jednorazowym kontenerze, potem czytasz z zimnego
startu (nowy proces, nowe połączenie). Scenariusz obowiązkowy:
1. utworzenie spotkania, 2. wygenerowanie notatki z ręcznego tekstu,
3. **odczyt przed decyzją**: propozycja `pending`, pokwitowań `0`, materiałów `0`,
4. zatwierdzenie przez rolę uprawnioną,
5. **odczyt po decyzji**: propozycja `materialized`, pokwitowań `1`, materiałów
   `1`, materiał otwiera się (`200`),
6. **zimny odczyt** (nowy klient): pkt 5 identycznie,
7. **negatyw tenanta**: druga organizacja widzi `0` materiałów i `404` na notatce,
8. **negatyw roli**: rola bez uprawnień → odmowa i nic nie powstaje,
9. sprzątanie kontenera (dowód: `docker ps -a` → pusto).

**DoD H.4:** wszystkie dziewięć kroków w raporcie z surowymi wynikami (statusy
HTTP, liczby wierszy). Krok bez wyniku = niewykonany.

---

## §U. WYMAGANIA KALENDARZOWE — pięć pozycji (`MYW-CAL-REC-001..003`)

**Stan zastany:** uczestnicy = wolny tekst; brak strefy, cykliczności,
tożsamości, statusu zaproszenia, załączonych artefaktów.

**Kolejność sztywna:** `U.1 → U.2 → U.3 → U.4 → U.5`. `U.3` jest najdroższa.
Cykliczność ma osobną, pogłębioną sekcję §C (bo `DEC-82` żąda PEŁNEJ semantyki);
`U.2` tu to model danych, §C to semantyka edycji.

### U.1 — Strefa czasowa spotkania (`MYW-CAL-REC-001`, część)

**Problem:** `start_at`/`end_at` (`TEXT`) są konwertowane strefą przeglądarki
i nigdzie nie zapisane.

**Co budujesz:**
1. Migracja addytywna: `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS timezone
   TEXT` — identyfikator **IANA** (`Europe/Warsaw`), nie offset.
2. `start_at`/`end_at` **zostają ISO 8601 z Z (UTC)** — nie zmieniasz typu ani
   znaczenia. `timezone` mówi, w jakiej strefie umówiono spotkanie.
3. Domyślna wartość przy tworzeniu: strefa z ustawień użytkownika, inaczej strefa
   przeglądarki (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Zapisujesz
   jawnie, nie `NULL`.
4. Wyświetlanie: godzina w strefie spotkania **z etykietą strefy** wszędzie
   (lista, preview, karta „Termin"). Jeśli strefa spotkania ≠ strefa
   przeglądającego — obok godzina lokalna, jawnie oznaczona.
5. Stare wiersze bez `timezone` → jak dziś, z uczciwym „strefa nieokreślona".
   **Nie zgadujesz wstecz.**

**DoD U.1:** migracja addytywna + idempotencja; test dwóch stref (obie godziny,
etykiety); test wiersza sprzed migracji (bez wyjątku); zapis→readback zachowuje
`timezone`; i18n; zrzuty light+dark.

### U.2 — Model cykliczności (dane) (`MYW-CAL-REC-001`, część)

Semantyka edycji jest w §C. Tu budujesz **model**:
1. Migracja addytywna na `meetings`: `recurrence_rule TEXT` (RRULE, wzorem
   `calendar_events`), `recurrence_parent_id TEXT`, `recurrence_exception_at
   TEXT`, `recurrence_exdate_json TEXT`, `recurrence_status TEXT` (dla
   wystąpienia-wyjątku: `modified`|`cancelled`). **Bez klucza obcego.**
2. Odczyt listy **rozwija serię wirtualnie w oknie zapytania** przez
   `recurrenceEngine.materializeInstances` — instancja trafia do bazy **dopiero**
   przy pojedynczej edycji/odwołaniu (wiersz-wyjątek z `recurrence_parent_id`).
3. Twardy limit instancji na odpowiedź + okno czasowe (zero N+1, zero
   nieograniczonego rozwijania). Liczniki na liście liczą to samo, co tabela.
4. Zero regresji dla `recurrence_rule IS NULL` (dokładnie jak dziś).

**DoD U.2:** migracja + idempotencja; test reguły tygodniowej w oknie 4 tyg. = 4
wystąpienia; test regresji (spotkanie bez reguły); test limitu (reguła bez końca
w szerokim oknie nie zawiesza — twardy limit + uczciwa informacja o obcięciu);
zrzuty.

### U.3 — Uczestnicy: użytkownicy org + goście zewnętrzni ze statusem (`MYW-CAL-REC-002`)

**Najdroższa pozycja.** Zmienia model z płaskiej listy stringów na relację
z tożsamością.

**Nowa tabela (nie kolumna):**
```
meeting_participants
  id                TEXT PRIMARY KEY
  organization_id   TEXT NOT NULL
  meeting_id        TEXT NOT NULL          ← bez klucza obcego
  participant_kind  TEXT NOT NULL          ← 'user' | 'guest'
  user_id           TEXT                   ← dla kind='user'
  email             TEXT                   ← dla kind='guest'
  display_name      TEXT DEFAULT ''
  role              TEXT DEFAULT 'attendee'   ← organizer | attendee | optional
  invitation_status TEXT DEFAULT 'invited'    ← invited | accepted | declined | tentative | no_response
  delivery_status   TEXT DEFAULT 'pending'    ← pending | sent | failed  (dla §I; przy braku wysyłki 'pending')
  responded_at      TEXT
  invited_by        TEXT
  created_at        TEXT
  updated_at        TEXT
```
Indeksy: `(organization_id, meeting_id)`; **dwa unikaty częściowe**:
`(meeting_id, user_id) WHERE user_id IS NOT NULL` i `(meeting_id, lower(email))
WHERE email IS NOT NULL`.

**Backfill legacy:** `meetings.attendees_json` → wiersze `participant_kind='guest'`,
`display_name = string`, `invitation_status='no_response'`, `ON CONFLICT DO
NOTHING`. **`attendees_json` nietknięte** (pozycja otwarta nr 2).

**Organizator:** twórca (`meetings.created_by`) → wiersz `role='organizer'`,
`invitation_status='accepted'`. Zawsze widoczny, **nie da się usunąć** (próba →
`400`, nie ciche powodzenie).

**API — nowy zasób:**
```
GET    /api/meeting/:id/participants
POST   /api/meeting/:id/participants          → użytkownik ORG albo gość
PATCH  /api/meeting/:id/participants/:pid     → rola / status odpowiedzi
DELETE /api/meeting/:id/participants/:pid     → usunięcie (poza organizatorem)
```

**Wymagania twarde — bezpieczeństwo:**
1. **`kind='user'` walidowany serwerowo** wobec `users WHERE organization_id =
   <tenant z tokenu> AND status='active'`. Nie ufasz `userId` z ciała. Obcy →
   `400`/`404`, nigdy cichy zapis. (Ten sam kontrakt, co `CalendarAttendeesField`
   / `Api.searchOrgUsers`.)
2. **`kind='guest'` = wyłącznie e-mail + nazwa.** Zero konta, zero uprawnień.
   Walidacja formatu e-maila serwerowo.
3. **`invitation_status` zmienia wyłącznie: sam uczestnik (o sobie) albo
   organizator/rola uprawniona.** Test negatywny obowiązkowy.
4. **Tenant** — wszystkie trasy przez `getMeeting` + `canAccessMeeting`
   (istniejące helpery); `organizationId` **wyłącznie z tokenu**
   (`req.user?.organizationId`), nigdy z body/query.
5. **Status zaproszenia to stan; realna wysyłka to §I.** `invitation_status`
   i `delivery_status` są rozdzielone: pierwszy = odpowiedź zaproszonego, drugi =
   stan dostarczenia z §I. Bez §I `delivery_status` zostaje `pending`.

**DoD U.3:** migracja + idempotencja; backfill idempotentny; `attendees_json`
nietknięte (dowód: `git diff` + zapytanie); cztery trasy z readbackiem;
**minimum 6 testów**: happy (user) · happy (gość) · obcy `userId` odrzucony ·
duplikat odrzucony · usunięcie organizatora odrzucone · obcy tenant `404`; test
zmiany statusu przez nieuprawnionego → odmowa.

### U.4 — Artefakty dołączone do spotkania (`MYW-CAL-REC-003`)

**Co budujesz:**
1. Migracja addytywna, nowa tabela `meeting_attachments`:
   `id · organization_id · meeting_id · artifact_kind · artifact_id ·
   title_snapshot · attached_by · created_at`. `artifact_kind` = **lista
   zamknięta** (minimum `idea`, `note`/`material`). Unikat `(meeting_id,
   artifact_kind, artifact_id)`.
2. API: `GET/POST/DELETE /api/meeting/:id/attachments`.
3. **★ Kontrola uprawnień przy dołączaniu** („bez wycieku materiałów
   prywatnych"). Serwer **przed** zapisem sprawdza, że dołączający ma prawo do
   artefaktu **w tej organizacji**. Brak prawa → `403`/`404`, nigdy zapis.
4. **★ Negatyw odebranego dostępu.** Jeśli uprawnienie później odebrane —
   pozycja widoczna jako „artefakt niedostępny", **bez tytułu i bez linku**.
   `title_snapshot` służy wyłącznie liście dla uprawnionych.
5. UI: selektor artefaktów w CENTRUM karty (sekcja „Szczegóły"/„Protokół" — **nie
   nowa sekcja**, `DEC-54`), lista dołączonych z linkiem i odłączeniem.
6. „Podlinkowanie w zaproszeniu" (`REC-003`): dołączone artefakty **wchodzą do
   treści zaproszenia** dla zaproszonych **użytkowników organizacji** (link
   w e-mailu/ICS — §I). Dla gości zewnętrznych **nie budujesz publicznych
   linków do materiałów prywatnych** (wymagałoby modelu udostępniania na
   zewnątrz, którego nie ma) — w zaproszeniu gościa artefakt pojawia się jako
   tytuł bez linku, a raport zawiera STOP z opisem, czego brakuje do
   bezpiecznego linku zewnętrznego.

**DoD U.4:** migracja + idempotencja; testy: happy · dołączenie bez uprawnień
odrzucone · duplikat odrzucony · **odebrany dostęp → bez tytułu i linku** · obcy
tenant `404`; zero publicznych linków dla gości (STOP z opisem); i18n; zrzuty.

### U.5 — UI tworzenia i edycji spotkania

Po tej pozycji modal/karta odzwierciedlają model `U.1`–`U.4` i §C.

**Co budujesz (CENTRUM, nie powłoka, nie prawy panel):**
1. **Pole uczestników wzorem `CalendarAttendeesField`** — kopiujesz wzorzec do
   `src/components/Meeting/` (własny komponent, bo kontrakt szerszy: goście +
   status). Podpowiadanie przez istniejący org-scoped `Api.searchOrgUsers`
   (`GET /api/users/search`, filtruje `organization_id` + `status='active'`, min
   2 znaki). **Nie importujesz `CalendarAttendeesField`, nie używasz adminowego
   `GET /users`.**
2. **Dodanie gościa** — osobna, jawna ścieżka („zaproś przez e-mail") z walidacją
   i widocznym „gość spoza organizacji".
3. **Strefa czasowa** — wybór przy terminie, domyślnie wypełniony (§U.1).
4. **Cykliczność** — kontrolka reguły; przy edycji spotkania z serii **wybór
   zakresu zmiany** (§C: „to wystąpienie" / „to i następne" / „cała seria").
5. **Chipsy statusu zaproszenia** — rozróżnialne **bez koloru** (etykieta +
   kształt).
6. **Karta (CENTRUM):** sekcja „Szczegóły" pokazuje uczestników z tożsamością
   i statusem, organizatora wyróżnionego, strefę i regułę powtarzania. **Bez
   zmiany powłoki i prawego panelu.**
7. **Lista:** kolumna „Uczestnicy" liczy z nowego modelu (nie `attendees.length`);
   wyszukiwanie obejmuje nazwy i e-maile uczestników.

**DoD U.5:** wszystko na realnych danych z readbackiem; **zero atrap** (jeśli
część `U`/`C`/`I` skończyła się STOP-em — odpowiadająca kontrolka nie powstaje);
min. 4 testy renderujące realny modal (happy user · gość · błąd wyszukiwania
= uczciwy stan · edycja zachowuje pola); i18n PL+EN; light+dark; tokeny `c-*`;
`bash scripts/check-list-canon.sh src/components/Meeting/MeetingHub.tsx` bez
nowych naruszeń; zrzuty własne.

---

## §C. PEŁNA CYKLICZNOŚĆ — semantyka edycji serii (`DEC-82`, część 2) — dwie pozycje

**★ To jest pełny zakres, nie STOP.** `DEC-82` żąda „edycji serii cyklicznych —
pełna »to / to i następne / wszystkie«". Model danych masz z §U.2, silnik
z `recurrenceEngine`. Tu budujesz **operacje zapisu**.

### C.1 — Trzy zakresy edycji, każdy addytywny i odtwarzalny

Semantyka jak w kalendarzach (Google/Outlook):

1. **„to wystąpienie" (`this`)** — materializujesz **jeden** wiersz-wyjątek
   z `recurrence_parent_id = <seria>`, `recurrence_exception_at = <recurrenceId
   = start ISO wystąpienia>`, `recurrence_status = 'modified'` i nadpisanymi
   polami. Odpowiada wpisowi `exceptions[]` w `RecurrenceModel` (silnik nakłada
   je przy rozwijaniu). Pozostałe wystąpienia bez zmian.
2. **„cała seria" (`all`)** — edytujesz **master** (jego `recurrence_rule`/pola).
   Silnik re-rozwija. Istniejące wyjątki: decyzja jawna — domyślnie **zachowane**
   (wyjątek pozostaje wyjątkiem); jeśli edycja zmienia siatkę tak, że wyjątek
   traci kotwicę, opisujesz zachowanie w raporcie.
3. **„to i następne" (`this_and_following`)** — **rozszczepienie serii**:
   a) na masterze ustawiasz `UNTIL` (RRULE) na moment **przed** wybranym
   wystąpieniem; b) tworzysz **nowy master** od wybranego wystąpienia z nową
   regułą/polami i `recurrence_parent_id = NULL` (nowa seria), z zachowaniem
   powiązania rodowodowego (np. `split_from_meeting_id`). Wyjątki po cut-over
   przenoszą się do nowej serii. **`recurrenceEngine` tego nie robi — budujesz
   orkiestrację sam**, wołając silnik do walidacji reguł.

**Wymagania twarde:**
- Wszystkie trzy operacje **addytywne** (INSERT nowych wierszy + `UPDATE` pól
  własnych spotkania w granicach org; **żadnego `DELETE` serii**). Odwołanie
  pojedynczego wystąpienia = wyjątek `recurrence_status='cancelled'`, nie
  usunięcie serii.
- Każda operacja **tenant-scoped** (org z tokenu, rodzic przez `getMeeting`).
- Idempotencja: powtórzone „to wystąpienie" na tym samym `recurrenceId` nie
  tworzy drugiego wyjątku (unikat `(meeting_id/parent, recurrence_exception_at)`).
- **Jeśli którakolwiek z trzech operacji okazałaby się nieaddytywna albo
  niemożliwa do odtworzenia na świeżej bazie — STOP dla tej jednej operacji**
  (nie budujesz kontrolki, która ją obiecuje), reszta idzie dalej. `DEC-82` chce
  pełni, ale atrapa jest gorsza niż uczciwy `BRAK` jednej opcji.

### C.2 — API i spójność z listą/wysyłką

```
PATCH  /api/meeting/:id/occurrence            body: { recurrenceId, scope: 'this'|'this_and_following'|'all', changes }
DELETE /api/meeting/:id/occurrence            body: { recurrenceId, scope }   ← odwołanie (wyjątek), nie usunięcie serii
```
- Odczyt listy/licznika po edycji jest spójny z zapisem (readback).
- **Współpraca z §I:** edycja serii, która zmienia termin/miejsce, generuje
  **aktualizację zaproszenia** (`METHOD:REQUEST` z podbitym `SEQUENCE` w ICS)
  dla zakresu, którego dotyczy; odwołanie generuje `METHOD:CANCEL`. Jeśli §I nie
  została zbudowana (STOP), edycja serii **nie wysyła** i zostawia
  `delivery_status='pending'` — uczciwie, bez atrapy „zaktualizowano zaproszenia".

**DoD §C:** migracja (jeśli dokładasz kolumny ponad §U.2) addytywna +
idempotencja; testy behawioralne na realnym PG dla **każdego** z trzech
zakresów: „to" tworzy 1 wyjątek i nie rusza reszty; „to i następne" rozszczepia
(stary master z `UNTIL`, nowy master od cut-over); „cała seria" zmienia master
i re-rozwija; odwołanie = wyjątek `cancelled`, nie `DELETE`; regresja
niecykliczna; obcy tenant `404`. Zrzuty modala z trzema zakresami (light+dark).

---

## §I. PEŁNA WYSYŁKA ZAPROSZEŃ — realny dostawca ICS/e-mail (`DEC-82`, część 1) — trzy pozycje

**★ To jest pełny zakres, nie STOP.** Dyżur nr 10 zostawił wysyłkę jako STOP „brak
dostawcy". **Dostawca JEST** (§1.5 pułapka 9): `emailService.send` przez
`nodemailer`, z obsługą `attachments`. Budujesz **realną** generację ICS
i **realną** wysyłkę — z twardym zabezpieczeniem DEC-65.

**★ Warunek wstępny (Blok 0, obowiązkowy):** potwierdzasz, że mailer żyje:
```bash
grep -n "export async function send\|createTransport\|attachments" server/src/services/emailService.ts | head
grep -rn "InvitationSendingService" server/src | head
```
Jeśli `emailService.send` zniknął/jest atrapą bez `nodemailer` — **STOP** z opisem,
jaki dostawca skonfigurować (SMTP host/user/pass/from w `settings.smtp_*` lub
env `SMTP_*`). **Nie budujesz atrapy „wysłano".**

### I.1 — Generator ICS klasy zaproszenia (wspólny util)

Istniejący generator (`calendarIntegrations.routes.ts`, `escapeIcsText:19`,
`formatIcsDate:28`, blok `VEVENT:222-279`) jest **route-local**, emituje tylko
`METHOD:PUBLISH` + `DTSTART/DTEND` w UTC — bez `TZID`, `RRULE`, `ATTENDEE`,
`ORGANIZER`. **Nie zmieniasz zachowania tamtej trasy.** Zamiast tego:
1. **Ekstrahujesz** `escapeIcsText`/`formatIcsDate` do nowego wspólnego utila
   `server/src/utils/ics/icsBuilder.ts` (import w starej trasie na re-eksport,
   **bez zmiany jej zachowania** — jeśli to nie da się zrobić bezpiecznie,
   **kopiujesz** helpery do własnego utila i zostawiasz tamtą trasę nietkniętą).
2. Rozszerzasz util o zaproszenie: `TZID` (z `meetings.timezone`, §U.1),
   `RRULE` (z `recurrence_rule`, §U.2/§C), `ORGANIZER` (organizator z §U.3),
   `ATTENDEE` (uczestnicy z `PARTSTAT` z `invitation_status`), `UID` trwały per
   spotkanie/wystąpienie, `SEQUENCE` (podbijany przy edycji), `METHOD`
   (`REQUEST` przy zaproszeniu/aktualizacji, `CANCEL` przy odwołaniu).
3. **Czysto funkcyjny, bez I/O** — testowalny jednostkowo (asercje na treści
   VCALENDAR: obecność TZID, RRULE, ATTENDEE, poprawny escaping).

**DoD I.1:** util czysty, testy jednostkowe treści ICS (min.: zaproszenie
z uczestnikami i strefą; seria z RRULE; aktualizacja z `SEQUENCE`; odwołanie
`CANCEL`); stara trasa `calendarIntegrations` **bez zmiany zachowania** (jej
testy zielone).

### I.2 — Serwis wysyłki zaproszeń (realny mailer, prawdomówny wynik)

Nowy serwis `server/src/services/meeting/meetingInvitationService.ts`, wzorem
`InvitationSendingService.ts`:
1. Buduje ICS (§I.1), składa e-mail (`subject`, `html` z i18n `meeting.invite.*`,
   `attachments: [{ filename: 'invite.ics', content: <ics>, contentType:
   'text/calendar; method=REQUEST' }]`).
2. Woła `emailService.send({ ..., requireDelivery: true })` **per uczestnik**
   i zapisuje **prawdomówny** `delivery_status` na `meeting_participants`
   (`sent` tylko gdy `send` zwróci `true`; inaczej `failed`). **Zero fałszywego
   „Wysłano".**
3. Zapisuje pokwitowanie wysyłki (kto, kiedy, do kogo, wynik) — tabela
   `meeting_invitation_deliveries` (addytywna) albo kolumny na
   `meeting_participants` (`delivery_status`, `delivery_at`, `delivery_error`).
4. Trasa: `POST /api/meeting/:id/invitations/send` (body: opcjonalnie lista
   `participantIds` albo „wszyscy niewysłani"). Tenant + `canAccessMeeting`;
   tylko organizator/rola uprawniona wysyła.

**DoD I.2:** testy behawioralne (mock `nodemailer` **lokalnie**, Z18): happy
(wszyscy `sent`) · częściowa porażka (jeden `failed`, reszta `sent`, wynik
prawdomówny) · brak SMTP → `delivery_status` **nie** kłamie „sent" · obcy tenant
`404` · rola nieuprawniona `403`. **Readback:** po wysyłce `GET /participants`
pokazuje realne `delivery_status`.

### I.3 — ★ Strażnik DEC-65 — zero realnych maili z tego dyżuru

**To jest twardy warunek, nie zalecenie.** W repo **nie ma** MailHog/Ethereal —
jedyny wbudowany „bez wysyłki" to brak konfiguracji SMTP. Dokładasz **własny,
jawny strażnik** przed każdym `emailService.send` w §I.2:

1. **Zakaz wysyłki do org demo/chronionej.** Jeśli `organizationId ===
   (process.env.DEMO_ORG_ID || 'demo-org')` → **nie wysyłasz**, `delivery_status`
   = `blocked_demo` (nowy, jawny stan), wpis w logu. Nigdy przeciw danym demo
   (DEC-65). Wysyłka tylko dla **osobnych organizacji testowych/scoped**.
2. **Tryb przechwytywania dev/test.** Wprowadzasz jawną bramkę środowiskową:
   realny transport SMTP działa **wyłącznie** gdy skonfigurowany host/user
   i env `MEETING_INVITES_LIVE=true` (nowa zmienna **środowiskowa dev/ops, NIE
   flaga funkcyjna produktu** — nie dodaje się do `useFeatureFlags`/`betaAccess`;
   to przełącznik transportu, jak `SMTP_HOST`). W dev/test bez tej zmiennej —
   ścieżka **log-only** (treść ICS + adresat do logu), `delivery_status`
   raportowany jako `captured` (jawnie: „przechwycone, nie wysłane"), **nie**
   „sent". Jeśli nadzorca uzna `MEETING_INVITES_LIVE` za flagę funkcyjną i tym
   samym Z10 — to jest STOP z propozycją; domyślnie jest to zmienna transportu,
   analogiczna do `SMTP_HOST`, i nie narusza Z10.
3. **W żadnym teście** nie ustawiasz realnego `SMTP_HOST`/`MEETING_INVITES_LIVE`;
   `nodemailer` jest mockowany lokalnie (Z18). Dowód w raporcie: `grep`
   potwierdzający, że testy nie ustawiają realnego transportu.

**DoD I.3:** test: org == `DEMO_ORG_ID` → `blocked_demo`, `send` nie wołany
(spy) · dev/test bez `MEETING_INVITES_LIVE` → `captured`, realny transport nie
tknięty · jawny wpis w raporcie „zero realnych maili wysłanych z tego dyżuru"
z dowodem (log/spy). **Ten wpis jest obowiązkowy w raporcie.**

### I.4 — Granica z `SET-INT-REC-001` (Google/Outlook) — NIE budujesz

`SET-INT-REC-001` (centrum integracji, OAuth Google/Outlook, sync dwukierunkowy)
to **osobny, duży atom** poza tym dyżurem. Ty budujesz wysyłkę **e-mailem z ICS**
(standard iCalendar, działa z każdym klientem kalendarza jako zaproszenie).
**Nie** podpinasz OAuth, **nie** dotykasz `calendarProviders/*` (parse-only),
**nie** budujesz syncu. Jeśli wymaganie okaże się szersze niż „e-mail + ICS" —
STOP z odesłaniem do `SET-INT-REC-001`.

---

## §G. DOMKNIĘCIE OTWIERALNOŚCI — macierz ról (`G.2`)

**★ Twoim produktem jest PRZETESTOWANA MACIERZ, nie otwarcie. Zakaz włączania.**

Dyżur nr 10 (jeśli scalony) zrobił `G.1` (parametryzowana bramka czytająca
`BETA_MENU_STATUS.MODULE_MEETING`) i **częściowe** `G.2` (tylko stan `closed`).
Ten dyżur domyka `G.2` do pełnej macierzy realnego routera.

**Jeśli `G.1` NIE jest w bazie** (Blok 0, §0.1 pkt 3): budujesz **minimalny
odpowiednik** — bramkę parametryzowaną statusem czytanym z jednego jawnego
miejsca serwera (lustro `BETA_MENU_STATUS`), tak by stan `open` dało się
osiągnąć **przez parametryzację/resolver w teście**, nigdy przez zmianę wartości
domyślnej (Z10). `MODULE_MEETING` zostaje `'closed'`; `closedBetaModuleGate`
zostaje mountowany. Zachowanie przy `closed` = **dokładnie dzisiejsze**
(`OWNER`/`ADMIN`/`ADMINISTRATOR`/`SUPERADMIN` przechodzą, reszta `403`
`BETA_LOCKED`); istniejący `meetingBetaGate.test.ts` musi przejść **bez zmian**.

**G.2 — macierz negatywna, realny router (`supertest`), oba stany:**

| Wymiar | Wartości |
| --- | --- |
| Rola | `OWNER`, `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN`, `MEMBER`, `USER`, rola pusta, rola pilotowa |
| Stan modułu | `closed` (dziś) · `open` (po otwarciu, przez parametryzację) |
| Ścieżka | lista `GET /api/meeting` · karta `GET /api/meeting/:id` · zapis (`POST /api/meeting`) · **nowe zasoby** (`/participants`, `/invitations/send`) |
| Tenant | własny · obcy |

**Wymagania twarde:**
1. Stan `open` osiągasz **przez parametryzację bramki**, nigdy przez edycję
   wartości domyślnej (Z10).
2. **Anonim i obcy tenant odrzucani w OBU stanach.** Otwarcie modułu nie otwiera
   izolacji.
3. Test wywołuje **realny router** przez `supertest`, nie samą funkcję
   middleware. Grep-test montażu zostaje, ale nie liczy się do DoD.
4. Nowe zasoby (`/participants`, `/invitations/send`, `/attachments`,
   `/occurrence`) są **za tą samą bramką** — macierz je obejmuje.

**DoD §G.2:** tabela `Rola × Stan × Ścieżka × Tenant → oczekiwany status →
wynik`, wszystkie komórki wypełnione, zero „n/d" bez uzasadnienia; instrukcja
otwarcia dla nadzorcy (plik, linia, wartość przed/po, lista testów do
uruchomienia po przełączeniu); jawne „moduł NIE został otwarty".

---

## §T. TESTY — pięć pozycji

### T.1 — Jedyny dopuszczalny przypadek zmiany testu istniejącego
Nie osłabiasz asercji istniejących wcześniej. Jeśli test wymaga zmiany, bo
zmieniłeś kontrakt odpowiedzi **addytywnie** (nowe pole), i asercja jest
`toEqual` całego obiektu — dopisujesz pole, **nie** zmieniasz wartości
istniejących. Każdy taki przypadek: wpis w raporcie „przed/po". 48-przepływowy
golden-flows i `meetingsCanonicalRoute` — **nie ruszasz**; zapalenie = złamanie
Z11.

### T.2 — Kontrakty per nowy zasób
Dla `/participants`, `/attachments`, `/invitations/send`, `/occurrence`,
`decision`/materializacja: min. 4 testy behawioralne (happy · walidacja `400` ·
nieistniejący/`404` · obcy tenant `404`), realny router `supertest` na realnym
PG (wzorzec `meetingBoundary/__tests__/*.pg.test.ts`).

### T.3 — Negatywy tenanta jako osobny, jawny pakiet
Jeden plik z negatywami tenanta dla **wszystkich** nowych tras. Obcy
`organizationId` nigdy nie dostaje `200`.

### T.4 — i18n PL + EN, parytet utrzymany
Klucze `meeting.*` w PL i EN, parytet pełny (`PL-only []`, `EN-only []`). Nowe
napisy (uczestnicy, strefa, cykliczność, zaproszenie, statusy) mają klucze
w obu językach w tym samym commicie.

### T.5 — Dane dowodowe i zrzuty w jednym miejscu
Fixture i zrzuty: `scripts/dev/seed-wave3-meetings-owner-review.mjs` (rozszerzasz
o uczestników/serię/załączniki — **tytuły bez „test/smoke/probe/E2E"**). Zrzuty
do `modules/08_MEETINGS/evidence/day16/`, light+dark. Probe sprząta po sobie
(zero rekordów testowych w danych, które mają wyglądać jak produkcja).

### T.6 — Dostępność i responsywność
Nowe powierzchnie (pole uczestników, selektor artefaktów, modal zakresu edycji,
chipsy statusu) — fokus `c-focus`, statusy rozróżnialne bez koloru, działają
w wąskim widoku.

---

## §R. REJESTR I DOWODY — dwie pozycje

### R.1 — `MODULE_ACCEPTANCE.md` 08_MEETINGS do stanu faktycznego
Aktualizujesz sekcje odpowiadające zbudowanym pozycjom (H/U/C/I/G.2) do stanu
faktycznego — **wyłącznie to, co faktycznie działa i ma dowód**. Nie deklarujesz
gotowości, której nie ma. Nie zmieniasz statusów cudzych pozycji.

### R.2 — Komplet dowodów
Zrzuty (evidence/day16), wyniki testów, dowody idempotencji migracji, tabela
macierzy ról, wpis „zero realnych maili". Bez kompletu — pozycja `CZĘŚCIOWO`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz)
1. `git fetch --all --prune`; weryfikacja markera:
   ```bash
   git merge-base --is-ancestor c2f90af290 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   Brak → STOP i koniec dyżuru.
2. Weryfikacja stanu dnia 10 (§0.1 pkt 3) + materiałów wiążących (§0.1 pkt 4).
3. Gałąź + worktree (§0.1 pkt 5). Potwierdź wolny prefiks migracji `20260914_`.
4. **Koordynacja** — trzy strumienie (§1.4), wynik do raportu.
5. **Weryfikacja mapy technicznej z §2** — każdą rozbieżność do „Korekt".
   Obowiązkowo:
   ```bash
   grep -rn "producer_kind = 'meeting'\|sourceType: 'meeting'" server/src | grep -v __tests__
   grep -n "targetRecordId" server/src/services/meetingBoundary/meetingBoundaryService.ts | head
   grep -n "TARGET_KINDS\|PRODUCER_KINDS" server/src/services/artifactHandoff/handoffSpineService.ts
   grep -n "materializeInstances\|parseRRule" server/src/services/v8/recurrenceEngine.ts
   grep -n "export async function send\|attachments\|createTransport" server/src/services/emailService.ts
   grep -n "DEMO_ORG_ID\|demoWriteProtection" server/src/middleware/demoGuard.middleware.ts
   grep -n "MODULE_MEETING" src/utils/betaAccess.ts src/utils/pilotAccess.ts
   grep -n "closedBetaModuleGate" server/src/routes/meeting.routes.ts
   sed -n '1,40p' server/migrations/20260827_calendar_events.sql
   ```
6. **Dowód stanu wyjściowego testów** (§2.3) — wyniki do raportu.
7. **Kanon tabel** baseline: `bash scripts/check-list-canon.sh 2>&1 | tail -20`.
8. **Świeża baza** (są migracje): postaw kontener (§0.3 pkt 5), przebieg (1) na
   nietkniętym repo — punkt odniesienia replay.
9. Założenie raportu (§9) i wpisanie wyników 1–8.

### Blok 1 — materializacja do Materials (H.1 → H.3 → H.2 → H.4)
`H.3` przed `H.2` (rodowód to dowód, że `H.1` zadziałało); `H.2` najbardziej
narażone na `BRAK_API`. `H.4` (cold readback) zawsze na końcu, **nie pomijasz**.

### Blok 2 — model kalendarza (U.1 → U.2 → U.3 → U.4)
`U.1` (strefa) i `U.2` (model cykliczności) tanie i niezależne. `U.3`
(uczestnicy) najdroższa — jeśli zaczynasz z mniej niż połową bloku, nie
zaczynaj; domknij `U.1`+`U.2` czysto. `U.4` (artefakty) zależy od `U.3` tylko
w części „widoczne dla zaproszonych".

### Blok 3 — cykliczność edycji + wysyłka (C.1 → C.2 → I.1 → I.2 → I.3)
`§C` po `U.2`/`U.3` (potrzebuje modelu i uczestników). `§I` po `U.3` i `U.1`
(potrzebuje uczestników, strefy; ICS z RRULE potrzebuje `§C`). `I.3` (strażnik
DEC-65) **przed** pierwszym realnym `send` — nigdy odwrotnie. Jeśli którakolwiek
operacja `§C`/`§I` okaże się nieaddytywna/niemożliwa — STOP dla tej jednej,
reszta idzie dalej.

### Blok 4 — UI (U.5) i bramka (G.2)
`U.5` domyka to, co faktycznie zbudowałeś (zero atrap dla pozycji ze STOP-em).
`G.2` niezależne — jeśli czasu mało, zrób `G.2` (tanie, wartościowe) przed `U.5`.

### Blok 5 — domknięcie (obowiązkowo, ~80 min)
1. `T.2`–`T.6`, `R.1`, `R.2` dla tego, co faktycznie zbudowałeś.
2. Pomiar zasięgu (§0.4a): `ZASIĘG PEŁNY`/`CZĘŚCIOWY`.
3. **Siedem dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                       # tylko 20260914_meetings_day16_*
   git diff codex/m03-admin-20260824...HEAD -- src/utils/betaAccess.ts src/utils/pilotAccess.ts | grep -E "MODULE_MEETING"     # ZERO zmian 'closed'
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags)"                                    # PUSTY (zero flag)
   grep -rn "SMTP_HOST\|MEETING_INVITES_LIVE" tests server/src/**/__tests__ 2>/dev/null                                        # testy NIE ustawiają realnego transportu
   bash scripts/check-list-canon.sh 2>&1 | tail -5                                                                             # dług nie rośnie
   docker ps -a --filter name=cx-day16-pg                                                                                      # PUSTO (sprzątnięte)
   ```
4. **Zero realnych maili** — jawny dowód (log/spy).
5. Zrzuty light+dark do evidence/day16.

### Zasada nadrzędna kolejności
Lepiej **domknięte** `H`+`U.1`+`U.2`+`U.3`+`G.2` niż osiem pozycji „prawie".
Każda pozycja albo spełnia DoD, albo jest uczciwie oznaczona (STOP/`BRAK_API`/
`CZĘŚCIOWO`).

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:
```
docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY16_REPORT_<data>.md
```
(np. `MEETINGS_DAY16_REPORT_20260827.md`). Nie tworzysz drugiego pliku nigdzie
indziej (Z12).

### 9.1. Szablon

```markdown
# Meetings dzień 16 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: c2f90af290 — POTWIERDZONY / BRAK
Gałąź robocza: codex/meetings-day16-<data>
Worktree: /private/tmp/consultify-meetings-day16
Porty użyte: 4304/4305 (albo: żadne)  ·  Kontener PG: cx-day16-pg (usunięty: TAK/NIE)
Czas pracy: <od>–<do>

## Oświadczenie o chronionym WIP (Z4/Z5)
Nie otwierałem, nie czytałem i nie kopiowałem katalogu
/Users/piotrwisniewski/Developer/Consultify.                          TAK / NIE

## Koordynacja — wynik z Bloku 0
| Strumień | Sprawdzenie | Wynik | Konsekwencja |
| Dzień 10 backend | grep decision-records / createModuleGate | SCALONE / NIESCALONE | buduję do przodu / dokładam prerekwizyty addytywnie |
| Prawy panel (rightpanel) | git log ..rightpanel | <N / pusto> | nie dotykam prawego panelu ani powłoki SPEC-A |
| Naprawy szybkie nadzorcy | — | — | nie dubluję |
Potwierdzam, że NIE dotknąłem prawego panelu karty ani powłoki SPEC-A.   TAK / NIE

## Warunki wstępne — tabela (marker, ledger 134, DEC-82:134, DEC-58:110, DEC-65:117, mailer żyje, recurrenceEngine, testy przed)

## Pozycje — tabela zbiorcza
| Pozycja | Zakres | Status | Commit | Testy | Zrzuty | Uwagi |
| H.1 | zatwierdzony protokół → realny materiał | | | | | |
| H.2 | handoff do My Work / Initiatives | | | | | |
| H.3 | rodowód w obie strony | | | | | |
| H.4 | cold readback | | | | n/d | |
| U.1 | strefa czasowa | | | | | |
| U.2 | model cykliczności | | | | | |
| U.3 | uczestnicy org + goście + status | | | | | |
| U.4 | artefakty dołączone | | | | | |
| U.5 | UI tworzenia/edycji | | | | | |
| C.1 | trzy zakresy edycji serii | | | | | |
| C.2 | API + spójność z listą/wysyłką | | | | | |
| I.1 | generator ICS klasy zaproszenia | | | | n/d | |
| I.2 | serwis wysyłki (realny mailer) | | | | | |
| I.3 | strażnik DEC-65 (zero realnych maili) | | | | n/d | |
| G.2 | macierz ról w obu stanach | | | | n/d | |
| T.2–T.6, R.1, R.2 | testy i rejestr | | | | | |
(Status ∈ ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · JUŻ_BYŁO · BRAK_API · BRAK_UI_JEST_API · NIE_ZACZĘTE)

## Tabele werdyktów
### H.1 — materializacja  | Krok | Przed | Po | Dowód |  (targetRecordId: note.id → nowy materiał)
### H.2 — inwentarz funneli | Cel | Funnel | Istnieje? | Kontrakt | Werdykt |
### U.3 — uczestnicy | Rodzaj | Walidacja serwerowa | Status | Kto może zmienić | Test negatywny |
### C — zakresy edycji | Zakres | Addytywne? | Odtwarzalne na świeżej bazie? | Test |
### I — wysyłka | Scenariusz | Oczekiwane | Wynik |  (happy / częściowa porażka / brak SMTP / org demo → blocked_demo / dev bez LIVE → captured)
### G.2 — macierz | Rola | Stan | Ścieżka | Tenant | Oczekiwane | Wynik |

## ★ Wysyłka — dowód DEC-65
„Z tego dyżuru nie wyszedł ani jeden realny e-mail."  DOWÓD: <log/spy + grep, że testy nie ustawiają SMTP_HOST/MEETING_INVITES_LIVE>

## Instrukcja otwarcia modułu dla nadzorcy (produkt G.2)
| # | Plik | Linia | Wartość przed | Po | Uwaga |
Testy do uruchomienia po przełączeniu: <lista>. Otwarcie jedną zmianą? TAK/NIE.

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — handoff automatyczny vs decyzja człowieka (§H.2)
### STOP — los legacy attendees_json/decisions_json po backfillu (§U.3)
### STOP — treść/branding zaproszenia (§I, poz. otwarta 3)
### STOP — MEETING_INVITES_LIVE jako zmienna transportu vs flaga (§I.3) — jeśli nadzorca uzna za flagę
### STOP — publiczny link do artefaktu dla gościa zewnętrznego (§U.4)
### STOP — <pozostałe>

## Znaleziska (NIE naprawiane przeze mnie)
(oczekiwane m.in.: brak strefy w calendar_events · brak MailHog/przechwytywacza maili w repo ·
 słownik Materials bez origin_runtime='meeting' · ?sampleData=materials-vnext podmienia listę ·
 heurystyka szkicu ukrywa tytuły z „test")

## Korekty wobec instrukcji
## Migracje  (nazwy 20260914_meetings_day16_*, addytywność, dowód idempotencji, kompatybilność wstecz)
## Testy  (własne · zmiana testu istniejącego · pomiar zasięgu §0.4a · siedem dowodów Bloku 5)
## Zrzuty (R.2)
## Licznik  (pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte; moduł NIE otwarty)
## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania
- Status pozycji zgodny z DoD, nie z intencją.
- Każdy `BRAK_API`/`STOP` ma pełną tabelę/wpis (co, gdzie, jaki kontrakt).
- „gotowe do zrzutu przez nadzorcę", nigdy „do pokazania właścicielowi".

---

## 10. ŚCIĄGA

### 10.1. Komendy
```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>
# kanon list — na KAŻDYM dotkniętym .tsx listy
bash scripts/check-list-canon.sh src/components/Meeting/<plik>.tsx
# crimson / literały
grep -rnE "bg-c-accent|primary-[0-9]|btn-primary|#85182F|#A51C30" <Twoje pliki>
# test celowany (NIGDY pełny vitest/tsc)
npx vitest run server/src/services/meetingBoundary/__tests__
npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
# typy punktowo
npx esbuild src/components/Meeting/MeetingHub.tsx --loader:.tsx=tsx --outfile=/dev/null
# migracje — jednorazowy kontener (port 4306), dowód (1)(2)(3), sprzątanie
docker run -d --name cx-day16-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day16 -p 4306:5432 pgvector/pgvector:pg16
export DATABASE_URL="postgres://postgres:cx@localhost:4306/cx_day16"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict   # x2
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day16-pg && docker volume ls -q | grep -i cx-day16 | xargs -r docker volume rm
# nowe pliki w tests/ wymagają -f
git add -f tests/unit/meeting/<nowy>.test.ts
# pomiar zasięgu
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dziesięć rzeczy, które najłatwiej zepsuć
1. **Materializacja nadal wskazująca `note.id`** — B3 nie naprawiony, choćby
   reszta działała.
2. **Materiał na liście, którego nie da się otworzyć** (brak
   `documentStudioSchema` → `404`).
3. **Dodanie `origin_runtime='meeting'`** do słownika Materials — to zmiana
   współdzielonego enuma/CHECK-a (STOP). Używasz `native_artifact` +
   `originSummary.sourceType='meeting'`.
4. **Zmiana `handoffSpineService`/`recurrenceEngine`** — wołasz, nie zmieniasz.
5. **★ Realny e-mail do danych demo** albo bez trybu przechwytywania (DEC-65) —
   strażnik `I.3` przed pierwszym `send`.
6. **Etykieta „Wysłano" bez potwierdzenia dostawcy** — `delivery_status`
   prawdomówny, wzorem `InvitationSendingService`.
7. **„to i następne" jako atrapa** — jeśli rozszczepienia serii nie da się
   zrobić addytywnie/odtwarzalnie, to STOP dla tej opcji, nie fałszywa kontrolka.
8. **Dopisanie kolumn do `ensureMeetingTables()`** — kolumny idą migracją
   `20260914_*`.
9. **Migracja z kolizyjną datą** (`20260826`/`20260827` zajęte) albo z kluczem
   obcym do `meetings`.
10. **Zmiana globalnego mocka `nodemailer` albo configu vitest (Z18)** —
    mockujesz lokalnie w swoim pliku.

### 10.3. Tokeny kolorów (jedyne dozwolone)
```
--c-text  --c-text-secondary  --c-text-muted
--c-surface  --c-surface-raised  --c-border  --c-border-subtle
--c-success  --c-danger  --c-info  --c-focus
```
`--c-accent` = crimson = wyłącznie marka. `--c-danger` wyłącznie stan krytyczny
(nieudany zapis, artefakt niedostępny, wysyłka `failed`). „Zaproszenie
odrzucone"/„gość" = stan neutralny, nie czerwień.

---

## 11. NA KONIEC

Ten dyżur domyka to, co dyżur nr 10 świadomie zostawił, a właściciel domówił
`DEC-82`. Pięć rzeczy:

**Pierwsza — protokół wychodzi ze spotkania.** `MET-F-006` jest `gap`, a serwis
graniczny sam deleguje domknięcie „konsumentowi, który czyta `producer_kind =
'meeting'`". Takiego konsumenta nie ma. §H go buduje — i to jest najtańsza
wartość, bo `registerArtifactOrigin`, kręgosłup handoffu i pokwitowania **już
działają**. To podłączenie, nie budowa.

**Druga — spotkanie przestaje być zadaniem z listą imion w polu tekstowym.**
Uczestnik staje się bytem z tożsamością, statusem i (dla org) uprawnieniami;
strefa czasowa jest zapisana, artefakty dołączone bez wycieku prywatnych.

**Trzecia — cykliczność jest PEŁNA.** Nie „seria + wyjątki i tyle" — trzy
zakresy edycji jak w prawdziwym kalendarzu, z rozszczepieniem serii dla „to
i następne". A jeśli którejś operacji nie da się zrobić uczciwie — jest to
oznaczone, nie udawane.

**Czwarta — zaproszenia są NAPRAWDĘ wysyłane.** Realny ICS, realny mailer repo,
prawdomówny `delivery_status`. Ale **z tego dyżuru nie wychodzi ani jeden realny
e-mail**: strażnik DEC-65 blokuje org demo, a dev/test pracuje w trybie
przechwytywania. To jest różnica między „wysyłką" a „atrapą »wysłano«".

**Piąta — moduł staje się otwieralny, z przetestowaną macierzą.** Nie otwarty —
**otwieralny**. Samo otwarcie wykonuje nadzorca po odbiorze. Ty go nie
wykonujesz.

Jedna rzecz, którą ten dyżur ma zrobić lepiej niż poprzednie: nie zostawić ani
jednej kontrolki, która wygląda na działającą, a nie jest. `BRAK_API`/STOP
z pełną tabelą jest odpowiedzią. Przycisk, który „na razie nic nie robi", nie
jest. I dwie rzeczy, których pilnujemy przed wszystkim innym: **czy z tego
dyżuru nie wyszedł żaden realny e-mail** (DEC-65) i **czy każda widoczna
kontrolka faktycznie zapisuje dane, które da się odczytać na zimno**.

Prawy panel karty — nie Twój. Powłoka SPEC-A — nie Twoja. Reszta mechaniki —
Twoja, do końca. Powodzenia. Koordynacja w Bloku 0, raport na bieżąco, inwentarz
przed każdą pozycją, STOP bez wahania zamiast zgadywania, prettier przed każdym
commitem, Blok 5 zawsze, strażnik DEC-65 przed pierwszym `send`.
