# Odbiór paczki 5 — zatwierdzanie odpowiedzi Wywiadu (2026-09-13)

**WERDYKT: WRACA DO CODEXA — trzy pliki testowe są czerwone po scaleniu, w tym jedna regresja zamrożonej bramki cyklu życia Wywiadu, którą paczka wyłączyła po cichu. Sama mechanika (ledger, migracja, ścieżka manager↔użytkownik) działa i została zmierzona okiem na realnym ekranie; wraca wyłącznie na trzy punkty testowe plus decyzja właściciela o fladze.**

Odbiór wykonany z mandatem „obalić, nie potwierdzić". Wszystko poniżej jest zmierzone w tej sesji; nic nie jest przepisane z meldunku Codexa.

## Adresy

| Rzecz | Wartość |
| --- | --- |
| Gałąź Codexa | `codex/interview-answer-approval-20260913`, HEAD `06b34552455c987037bc1db99f318e5bd3addd81` |
| Kopia zapasowa (zweryfikowana) | `refs/remotes/origin/backup/codex/interview-answer-approval-20260913-20260913` = `06b3455245` — zgodna 1:1 |
| Baza kandydata | `0de4dc9c666f7285767e6830e87e4833512ce3cf` |
| Wspólny przodek | `cfea70de8a02df900f22416e0728de383d1bde26` (dokładnie ta, którą deklarował Codex) |
| **SHA scalenia** | **`d73ccb90a73d2bba18575a81200c49a06b37bbb7`** na `integracja/kandydat-paczka5-20260913` |
| Stanowisko | `/Users/piotrwisniewski/Developer/wt/paczka5` (worktree z `wt/kandydat-20260913`) |
| Zasoby | PG 6482 i 6483 (kontenery `od5-pg`, `od5-stg`), API 4312/4313/4314, preview 5321 |

### KROK 0 — czy Codex ogłosił ACCEPT
Tak. `OD_CODEXA.md`, Wpis 3 z 19:05: „Paczka 5 (…) ma niezależny ACCEPT, commit `06b34552…` i zweryfikowany backup o identycznym SHA". Wcześniejszy HOLD z 11:00 (Wpis 2, cztery P1 backendu) oraz HOLD UI z 18:42 zostały zdjęte. Odbiór pełny był więc uprawniony.

### Scalenie
`git merge --no-ff` przeszło **bez ani jednego konfliktu**. Pliki dotknięte przez obie strony: `public/locales/en/translation.json`, `public/locales/pl/translation.json`, `src/services/api.ts` — w każdym zmiany leżą w rozłącznych miejscach, scalenie zachowało obie strony (sprawdzone porównaniem z obiema gałęziami). Paczka to 117 plików (33 420 wstawień), z czego kod produkcyjny i testy to 29 plików / 7 763 wstawienia; reszta to katalogi dowodowe Codexa.

## Tabela kroków

| Krok | Wynik | Dowód |
| --- | --- | --- |
| Scalenie `--no-ff` | **PASS**, 0 konfliktów | `d73ccb90a7` |
| Migracja 2× na pustej bazie (ścisły migrator, 6482) | **PASS** — bieg 1: 915 zastosowanych, exit 0; bieg 2: `Applying migrations: 0`, exit 0; 1802 tabele; `schema_migrations.status='success'` | `ODBIOR_PACZKA5_ZRZUTY_20260913/MIGRACJA_PUSTA_BAZA_BIEG{1,2}.log` |
| Migracja na zrzucie schematu stagingu (pg18, 6483, 1809 tabel, SHA `bf580feb5a…`) | **PASS** — 2× exit 0, drugi bieg same `NOTICE … already exists, skipping`, 0 wierszy danych | `MIGRACJA_SCHEMAT_STAGINGU_BIEG{1,2}.log` |
| `cd server && npx tsc --noEmit` | **PASS** — 0 błędów | log pusty |
| Front `tsc --noEmit` (8 GB) | **PASS** — 189 błędów = próg; **0 w plikach paczki** | pomiar per plik |
| `scripts/check-list-canon.sh` | **PASS** — naruszeń 349, baseline 349 | — |
| `scripts/check-artefakt.sh` | **PASS** — 8 / 0 / 117, dokładnie baseline | — |
| `pomiar-jezyka --baseline` | **PASS** — exit 0, „nic nie wzrosło", spadki K3a −247, K4pl −9, K4en −9, K5en −1, K7 −5 | — |
| `npm run build` (8 GB) | **PASS** — exit 0, 10 717 modułów, 46,6 s | `BUILD.log` |
| Testy paczki — front/root (7 plików) | **PASS** — 7/7, 112/112 | — |
| Testy paczki — serwer bez bazy (4 pliki) | **FAIL 1/4** — `interviewAnswerDecisionMigration.test.ts` (patrz D3) | — |
| Testy paczki — `.pg.`/`realpg` na 6482 (`RUN_DB_TESTS=1 MOCK_DB=false`) | **FAIL 1/3** — `interviewAnswerApproval.gateway.pg.test.ts` (patrz D2); pozostałe 15/15 PASS | — |
| Sąsiedzi `src/components/Interview/__tests__` (baza vs scalenie) | **FAIL — 1 nowa czerwień** (baza 4 błędy / 3 pliki → scalenie 5 błędów / 4 pliki) | patrz D1 |
| Parytet przy nieustawionych flagach | **PASS co do zgodności, ALE brak flagi** — patrz niżej | `PARYTET_BAZA.json` / `PARYTET_SCALENIE.json` |
| Przeklikanie realnego ekranu (1440×900, jasny + ciemny) | **PASS** — pełna ścieżka; 0 błędów konsoli i 0 4xx/5xx na ekranach managera | zrzuty + `KONSOLA_*.json` |

## Mechanika migracji na wdrożeniu — odpowiedź dla CTO

**Migracja jest stosowana AUTOMATYCZNIE w potoku wdrożenia, ale przez bramkę pre-deploy, a nie przez start aplikacji. Jeśli ta bramka nie wykona się na żywej bazie, serwis po wdrożeniu NIE wstanie.** To nie jest teza — zmierzone.

Dowód łańcucha:

1. `railway.json:11` — `"preDeployCommand": "node dist/scripts/release-migration-gate.js"`.
2. `server/scripts/release-migration-gate.ts:322-352` — bramka uruchamia **pełny ścisły łańcuch**: `migrate.postgres.js --dir <katalog migracji>`, bez `--only`, `--safe`, `--allow-checksum-drift`; niezerowy status = „Release blocked". To ten przebieg zapisuje wiersz w `schema_migrations`.
3. `server/docker-entrypoint.sh:25` — wejście kontenera to `node dist/src/index.js`; **entrypoint nie uruchamia żadnej migracji**.
4. `server/src/index.ts:435-436` — start aplikacji uruchamia runtime'owy runner Table Platform (`services/tablePlatform/migrationRunner.js`), który plik **widzi** (`20262170_…` pasuje do `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/`) i stosuje go atomowo, ale kwituje w `tp_migration_history`, **nie** w `schema_migrations`.
5. `server/src/startup/databaseReadiness.ts:196-201` — po migracjach liczony jest `evaluateSqlChain`; stan inny niż `ok` ⇒ `notReady`, a `shouldExitProcess = isProduction` (linia 110) ⇒ `process.exit(1)` w produkcji.

**Pomiar potwierdzający (baza `nopre` na 6482: usunięte obie tabele i wiersz w `schema_migrations`, start API 4314):**
```
/api/ready → {"status":"not_ready", "sqlMigrations":{"state":"pending","pending":1,
  "detail":"1 pending migration(s): 20262170_interview_answer_decisions.sql"},
  "error":"SQL migration chain not acceptable (pending)…"}
log: [Readiness] … Refusing readiness.
po starcie: tabele interview_answer_decision* = 2, schema_migrations 20262170 = 0
```
Czyli: runtime'owy runner sam **utworzy tabele**, ale nie zaspokoi bramki łańcucha SQL — serwis zostanie odmówiony (a w produkcji ubity i w pętli restartu).

**Procedura dla CTO.** Przed wdrożeniem upewnij się, że usługa demo na Railway ma faktycznie ustawione `preDeployCommand` z `railway.json` (historycznie niosła `["true"]` — komentarz w nagłówku `release-migration-gate.ts`; tego nie da się sprawdzić z repo). Jeżeli ma — nic nie robisz, bramka zastosuje migrację sama. Jeżeli nie ma albo nie masz pewności, uruchom ręcznie ścisły łańcuch **przed** przełączeniem ruchu:

```
DB_TYPE=postgres DATABASE_URL="<PUBLICZNY URL bazy demo>" \
  npx tsx server/scripts/migrate.postgres.ts --dir server/migrations
```

(bez `--only`, bez `--safe`, bez `--allow-checksum-drift`). Weryfikacja po wdrożeniu: `/api/health/migrations` ma pokazać `sqlMigrations.state:"ok"` i `pending:0`.

**Sama migracja jest czysta:** `server/migrations/20262170_interview_answer_decisions.sql` to wyłącznie `CREATE TABLE IF NOT EXISTS` (2) i `CREATE [UNIQUE] INDEX IF NOT EXISTS` (8). Zero `ALTER` na istniejących tabelach, zero danych, zero `DROP`. Addytywna i idempotentna — potwierdzone dwoma biegami na pustej bazie i dwoma na schemacie stagingu.

## Parytet przy flagach OFF

**Paczka nie wprowadza ŻADNEJ flagi.** Grep po kodzie produkcyjnym paczki (`git diff cfea70de8a codex/… -- server/src src` z wykluczeniem testów) daje: 0 nowych `process.env`, 0 nowych `import.meta.env`, 0 nowych `VITE_*`, 0 wywołań przełącznika funkcji. Tryb zatwierdzania czyta addytywny klucz organizacji `organization_ai_policy.policy.interview.answerApproval.mode`; przy jego braku obowiązuje `DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE = 'manager'` (`interviewAnswerApprovalPolicy.ts:7`). Panel „Answer approval" renderuje się bezwarunkowo, gdy sesja ma `assignmentId` (`InterviewWorkspace.tsx`).

Skutek: **po wdrożeniu funkcja włącza się od razu dla każdej organizacji naraz.** Nie ma czego wyłączyć bez cofnięcia kodu. To jest sprzeczne z CLAUDE.md §7 (wygląd tylko za flagą domyślnie OFF do akceptu) i §9 (zakaz masowego włączania). Nie blokuję tego sam — to decyzja właściciela/CTO — ale musi być podjęta świadomie i **przed** wdrożeniem.

**Pomiar zgodności istniejących tras (ta sama sekwencja żądań, baza `0de4dc9c66` na 4313 vs scalenie na 4312, identyczna fikstura):**

| Żądanie | Baza | Scalenie | Ocena |
| --- | --- | --- | --- |
| `GET /interview/sessions` | 200 | 200 | ładunek identyczny |
| `GET /interview/sessions/:id` | 200 | 200 | identyczny |
| `GET /interview/assignments/:id/review-access` | 200 | 200 | identyczny |
| `GET /interview/assignments` (respondent) | 403 | 403 | identyczny |
| `PATCH /interview/questions/:id` (bez `expectedUpdatedAt`) | 428 | 428 | identyczny |
| `POST /interview/assignments/:id/submit` | 200 | 200 | **tylko dwa NOWE klucze**: `answerApproval`, `aiAnswerApproval`; żaden istniejący klucz nie zniknął ani się nie zmienił |
| `GET …/answer-approvals` | 404 | 200 | nowa trasa (zamierzone) |

Czyli na poziomie kontraktu HTTP paczka jest **ściśle addytywna**. Kosztem jest to, że `submit` pisze teraz do dwóch nowych tabel w tej samej transakcji — istniejący przepływ zyskał nowy tryb awarii.

## Przeklikanie realnego ekranu

Lokalne API 4312 + realny front 5321 (nie dev-render, nie harness ekranowy), fikstura: organizacja, manager (ADMIN), użytkownik (MEMBER), sesja wywiadu z **3 pytaniami**, bez wpisu polityki AI (czyli tryb domyślny). Pełna ścieżka wykonana ręcznie w przeglądarce i powtórzona skryptowo pod zrzuty:

1. użytkownik odpowiada i wysyła → manager widzi trzy pozycje „Pending approval" z akcjami `Approve answer` / `Send answer back`,
2. manager wpisuje powód i odsyła jedną odpowiedź → pozycja zmienia się na „Sent back for correction", powód widnieje przy niej, `POST …/answer-decisions → 200`,
3. użytkownik widzi nagłówek „Sent back", powód przy właściwym pytaniu, **tylko odesłana odpowiedź jest edytowalna** (pozostałe `textarea` mają `disabled`) — poprawia ją, `PATCH /interview/questions/… → 200`, i wysyła ponownie, `POST …/submit → 200`,
4. manager zatwierdza wszystkie trzy → „Approved", akcje znikają.

Stan bazy po ścieżce jest spójny: kwity mają rosnące `ordinal` w obrębie zgłoszenia, `manager_sent_back` niesie powód, aktorzy są rozdzieleni (`od5-respondent` / `od5-manager`), `policy_mode='manager'`, `policy_version=1`, a polecenia mają rosnący `assignment_sequence` i status `applied`.

**Tryb domyślny to „manager" — potwierdzone bez wpisu polityki w bazie.**

Kanon na zrzutach: teksty po angielsku, klucze i18n obecne w `en` i `pl` (+27 kluczy w obu katalogach), przyciski używają tokenów `bg-c-success` i `c-warning` — **zero crimson / zero `primary-*`** w nowej powłoce (potwierdzone odczytem `getComputedStyle`: `rgb(2,104,51)` i `rgb(163,84,28)`). Motyw ciemny renderuje się poprawnie i różni się od jasnego (różne sumy kontrolne, sprawdzone także wzrokiem).

Błędy: **0 błędów konsoli i 0 odpowiedzi 4xx/5xx na wszystkich ekranach managera** (`KONSOLA_MANAGER.json`, `KONSOLA_PENDING.json`). Na ekranie użytkownika 2 błędy konsoli — patrz D6, zastane.

### Zrzuty (1440×900, `ODBIOR_PACZKA5_ZRZUTY_20260913/`)

| Krok | Jasny | Ciemny |
| --- | --- | --- |
| 1. manager widzi odpowiedzi do decyzji | `1-manager-pending-light-1440x900.png` | `1-manager-pending-dark-1440x900.png` |
| 2. po odesłaniu do poprawy | `2-manager-sent-back-light-1440x900.png` | `2-manager-sent-back-dark-1440x900.png` |
| 3. użytkownik widzi powód | `3-respondent-sees-reason-light-1440x900.png` | `3-respondent-sees-reason-dark-1440x900.png` |
| 4. manager zatwierdził wszystko | `4-manager-approved-light-1440x900.png` | `4-manager-approved-dark-1440x900.png` |

## Defekty

### D1 — P2, REGRESJA. Zamrożona bramka cyklu życia Wywiadu jest po scaleniu czerwona
`src/components/Interview/__tests__/InterviewApprovalLifecycle.ownerContract.test.ts > persists submit lifecycle state and answer history in one fail-closed transaction` jest **zielony na bazie `0de4dc9c66` i czerwony po scaleniu** (baza: 4 błędy w 3 plikach; scalenie: 5 błędów w 4 plikach — ten jeden plik to cała różnica).

Przyczyna: test asertuje literał źródła `"UPDATE interview_sessions SET status = 'submitted'"`, a paczka przełamała ten SQL na wiele linii (`InterviewController.ts:4774-4778`). Zachowanie jest zachowane — ten sam `UPDATE`, dołożone `updated_at`/`last_activity_at` i fail-closed `changes !== 1`. Czerwona jest sama bramka, nie funkcja.

To jednak dokładnie klasa „test scenariusza nie broni zabezpieczenia": po scaleniu zamrożona bramka nie chroni już niczego, a plik jest czerwony. Naprawa jest mała — albo asercja odporna na białe znaki, albo literał w jednej linii. **Nie wolno tego scalać na czerwono.**

### D2 — P2. Test bramkowy Gateway/JWT/PG ma twardy pin nazwy bazy
`server/src/routes/v8/__tests__/interviewAnswerApproval.gateway.pg.test.ts:41`:
```
expect(target.pathname).toBe('/interview_staging_schema_clone_v3');
```
Na kontenerze 6482 z bazą `postgres` plik jest **czerwony, a jego 3 testy pomijane** — dowód „real ApiGateway + JWT + PostgreSQL 18" jest nieodtwarzalny poza maszyną autora. Potwierdziłem to, zakładając bazę o dokładnie tej nazwie: wtedy 3/3 PASS. To ta sama klasa, którą hook zatrzymał Codexowi w F2-E („nowy test zawierał literalny pin nazwy bazy") — tu przeszła.

### D3 — P2. Test migracji zależy od katalogu uruchomienia
`server/src/services/interview/__tests__/interviewAnswerDecisionMigration.test.ts:6-9` liczy ścieżkę jako `resolve(process.cwd(), 'server/migrations/…')`. Z katalogu głównego 4/4 PASS; uruchomiony z `server/` (czyli tak, jak `cd server && npx vitest`) wywala się na `ENOENT … /server/server/migrations/…`. Powinien liczyć ścieżkę od `import.meta.url`.

### D4 — P1 procesowy (decyzja właściciela). Brak flagi = masowe włączenie
Opisane wyżej w „Parytet". Zgłaszam jako punkt do świadomej decyzji przed wdrożeniem, nie jako błąd kodu.

### D5 — P3. Dowód Codexa na nogę „użytkownik poprawia i wysyła" był niepełny
`RUNTIME_V4_RESPONDENT_BUSINESS_GREEN.json` nie zawiera **ani jednego** żądania zapisu odpowiedzi — jedyny nie-GET poza telemetrią to `POST …/submit`, a poprawka została udowodniona polem `correctionReadFromRenderedTextarea`, czyli odczytem tekstu z pola. Realny zapis nie był wykonany. Domknąłem to sam: `PATCH /interview/questions/… → 200` i ponowne `submit → 200` na żywym froncie. Zgłaszam dla higieny dowodowej — funkcja działa.

### D6 — P3, ZASTANE (nie regresja). Ekran użytkownika ma 2 błędy konsoli
`GET /api/v8/interview/insights?scope=active` → 403 dla roli MEMBER, stąd `[InterviewHub] Failed to load insights`. Zmierzone na obu API: baza 403, scalenie 403 — **zastane**. Paczka odbramkowała drugie wywołanie insightów w głównym efekcie `InterviewHub`, ale `loadInsights` (identyczny z bazą) został niezabezpieczony. Skutkiem kryterium „błędy konsoli = 0" nie jest spełnione na ekranie użytkownika.

### D7 — P2, ZASTANE (nie regresja), ale widoczne na ekranie tej paczki
Przycisk „Next" w warsztacie pytań ma klasy `bg-c-surface text-white`; w motywie **jasnym** daje to tło `rgb(255,255,255)` i tekst `rgb(255,255,255)` — **biały napis na białym tle, kontrast 1:1, etykieta niewidoczna**. Widać to na `1-manager-pending-light` i `2-manager-sent-back-light` (pusta biała pastylka w prawym dolnym rogu). W ciemnym motywie napis jest czytelny. Klasy są identyczne na bazie `cfea70de8a` (`InterviewSingleQuestionRuntime.tsx:2785`), więc to **nie jest regresja paczki** — ale jest to pierwsza rzecz, którą właściciel zobaczy na ekranie, który ta paczka dostarcza. Osobna, mała poprawka.

### Obserwacja bez wagi
Nowy panel „Answer approval" jest własną, bespoke sekcją w centrum warsztatu pytań — nie `StandardTable`/`StandardPreview`. To ekran-artefakt (SPEC-A), nie lista (SPEC-L), więc `check-list-canon` słusznie milczy, a `check-artefakt` przechodzi na baseline. Główna akcja to jednak wypełniony zielony przycisk (`bg-c-success`), podczas gdy kanon triady każe CTA trzymać neutralne. Do rozstrzygnięcia przez właściciela na zrzucie — nie traktuję tego jako defektu.

## Czego NIE potwierdziłem jako defekt (żeby nie zgłosić fałszywej czerwieni)
- Pierwsze `PATCH /interview/questions/:id → 403` dla użytkownika **nie jest błędem paczki** — to skutek mojej złej fikstury (`interview_sessions.owner_id` ustawiony na managera). W realnym przepływie `startAssignment` tworzy sesję przez `createSessionFromTemplate({ user, … })` wywołane **przez adresata**, więc właścicielem sesji jest użytkownik. Po poprawieniu fikstury zapis przechodzi 200. Strażnik własności sesji jest zastany (identyczny na `cfea70de8a`).
- Pusta biała pastylka na zrzutach jasnych to D7 (zastane), nie artefakt przyrządu — zmierzone `getComputedStyle`.

## Stan
Scalenie leży wyłącznie lokalnie na `integracja/kandydat-paczka5-20260913` (`d73ccb90a7`). **Nie pushowano niczego.** Gałąź Codexa nietknięta. Kontenery i procesy odbioru posprzątane.
