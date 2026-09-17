# FEEDBACK-1 K-08 — właściciel ręcznie tworzonej inicjatywy

**Werdykt: ACCEPT — P0=0, P1=0, P2=1; aktywny brak wyboru właściciela i wykryty w review błąd kwalifikacji per projekt zostały zamknięte. Wcześniejszego resetu projektu nie odtworzono na bazie i nie jest deklarowany jako naprawa tej paczki.**

## Tożsamość

- Tor: A / Codex-1.
- Gałąź: `codex/feedback-1-k08-initiative-form-20260917`.
- Baza: `be57c5dae677844a224d78d874d3ab52444a882d`.
- Zakres: W120 FEEDBACK-1 poz. 4b K-08. Reszta K-08 pozostaje w PROJECT-1 P1.
- Bez migracji, flag, stagingu, deployu, Railway i chronionych refów.

## Diagnoza i zachowanie

- Reset projektu nie jest aktywnym defektem na bazie: wcześniejszy `RequiredProjectPicker` trzyma `newProjectId`, nie nadpisuje niepustej wartości i ma `autoSelectFirst`. Ta paczka dodaje test regresyjny pełnego formularza, ale nie przypisuje sobie istniejącej naprawy.
- Formularz nie miał pola właściciela i zawsze wysyłał `currentUser.id`. Teraz pokazuje wymagany wybór właściciela, zachowuje ręczny wybór podczas wpisywania tytułu i opisu oraz przekazuje wybrane `initiativeOwnerId` do kanonicznego writera.
- Opcje pochodzą z kanonicznego `GET /api/initiatives/eligible-owners?projectId=...`. Endpoint używa tego samego `PostgresInitiativeReader` i tej samej reguły kwalifikacji co zapis: aktywne członkostwo organizacji oraz członkostwo projektu, `projects.owner_id` albo rola organizacyjna OWNER/ADMIN. Aktywny zwykły członek spoza projektu nie jest oferowany.
- Zmiana projektu natychmiast czyści wybór i ustawia ponownie tylko właściciela zwróconego przez kanoniczny endpoint. Błąd odczytu daje pustą listę i blokuje zapis; formularz nie podstawia surowego UUID ani danych z szerszej listy użytkowników.
- Puste pole właściciela zatrzymuje zapis i pokazuje konkretny komunikat EN/PL.

## Dowody

- Skupiony zestaw: baza **21/21 PASS**, kandydat **22/22 PASS**, `--retry=0`, jeden worker.
- Nowy test wybiera członka `u5` projektu 1, przełącza projekt na 2 i dowodzi usunięcia `u5`; aktywny `u4` spoza obu projektów i nieaktywny `u3` nigdy nie występują w opcjach. Następnie wybiera `u2`, wykonuje dwa rerendery przez title/summary, potwierdza zachowanie obu wyborów oraz payload `projectId=proj-2`, `initiativeOwnerId=u2`.
- RealPG po pełnych migracjach **925/925**: **6/6 PASS**. Dowód obejmuje aktywnego członka projektu, właściciela organizacji, outsidera, użytkownika obcej organizacji oraz użytkownika `REVOKED` z pozostawionym rekordem `project_members`.
- Mutacje RED: stare zachowanie (`scopeOwnerId=currentUser.id`) wysyła `u1` zamiast wybranego `u2`; usunięcie warunku `organization_members.status='ACTIVE'` z kanonicznego readera ujawnia w liście użytkownika `REVOKED`.
- Front TSC na exact-lock (`@types/node 22.19.3`) i tej samej pełnej materializacji: baza **152**, kandydat **152**, delta **0**; w zmienionych plikach **0**. Licznik środowiska linii z W179: **169**. Server TSC na exact-lock: **0**.
- Exact lock `@types/node`: **22.19.3**.
- Bramy: język PASS; flagi `196/208`, brakujące `0`; listy `346=346`; artefakty `8=8`; `git diff --check` PASS.
- Niezależny review v3: **ACCEPT, P0=0/P1=0/P2=1**. P2 dotyczy braku osobnego testu HTTP/JWT/router nowej trasy; reader ma dowód RealPG, a formularz ma test kontraktu API i zachowania.

## Granice

- Backend pozostaje jedynym źródłem prawdy dla kwalifikacji właściciela projektu: lista i writer korzystają z tej samej implementacji reguły, a writer nadal może zwrócić `INITIATIVE_OWNER_INELIGIBLE` przy zmianie stanu pomiędzy odczytem i zapisem.
- Nie wykonano zrzutów zgodnie z regułą kanału. Nie wykonywano zapisu na stagingu.
