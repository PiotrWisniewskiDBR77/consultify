# F2-3 PMO E2 — czwarty świeży niezależny rereview

**Werdykt: ACCEPT. Oba ustalenia z V3 są zamknięte, a w dokładnie zamrożonym zakresie nie znalazłem nowego P1 ani P2.**

Rereview wykonano 2026-09-13 na gałęzi `codex/pmo-projekty-role-statusy-20260913`, przy bazie i niezmienionym HEAD `ba25e564592f4a803ecf53edf81b7d8c84524426`. SHA-256 dokładnego manifestu autora wynosi `f98c766385b9d3785514907740ce20f2499bfc0d8ebea476b0108a69811ea865`; wszystkie 73/73 wpisów przeszły niezależne `shasum -a 256 -c`, dryf wynosi 0. Ten raport jest oddzielnym artefaktem review i nie należy do manifestu autora.

## Zamknięcie poprzednich ustaleń

### P1 — produkcyjne grupowanie po kanonicznym `projectRole`: zamknięte

- Prawdziwa trasa GET mapuje `project_members.project_role` na pole API `projectRole` w `ProjectController.getProjectMembers`.
- Produkcyjny `ProjectRoleAssignmentsSummary`, używany bezpośrednio przez `MyProjects`, preferuje `member.projectRole`; pole `role` pozostaje kontrolowanym fallbackiem zgodności, a brak obu wartości daje lokalizowany stan `UNASSIGNED`. Fałszywy fallback `MEMBER` został usunięty.
- Świeży test zachowania montuje produkcyjny komponent z realnym kształtem API. Pokazuje osobne grupy „Sponsor projektu” i „Członek zespołu”, a po rerenderze odpowiadającym utrwalonej edycji przenosi Jana do „Kierownik projektu” i usuwa poprzednią grupę. Świeży focused run: 5 plików, 14/14 PASS, retry 0.
- Zamrożony built-browser proof wykonuje realny GET, następnie UI → PATCH → PostgreSQL i potwierdza `PROJECT_LEADER` / 75%. Przed edycją asercje wymagają „Sponsor projektu” i „Członek zespołu”; po edycji wymagają „Sponsor projektu” i „Kierownik projektu” oraz odrzucają `MEMBER`.

### P2 — osobne dowody dolnych sekcji: zamknięte

Obejrzałem sześć zamrożonych PNG 1440×900: osobne light/dark dla odpowiedzialności (`29_*`), komunikacji (`30_*`) i wejść do akceptacji (`31_*`). Każda para pochodzi z przewinięcia właściwego elementu do viewportu i pokazuje żądaną sekcję w zbudowanym interfejsie. Odpowiedzialności pokazują macierz ról i poziomów decyzji, komunikacja pokazuje trzy ustawienia, a wejścia do akceptacji pokazują osoby wyliczone z ról projektowych. Tryby light i dark są czytelne i semantycznie zgodne.

## Świeże niezależne wyniki

- Focused unit/behavior/i18n/flag: 5 plików, 14/14 PASS, retry 0.
- ApiGateway + JWT + lokalny PostgreSQL 18 (`127.0.0.1:6458/f23_e1`): 5/5 PASS, retry 0. POST/PATCH zespołu i PUT komunikacji egzekwują capability w trybie `enforce`; odmowy zwracają 403 i nie wykonują mutacji SQL. Tenant isolation i read-only operating model także przechodzą. Po biegu kontrolny readback fixture'ów zwrócił organizacje/projekty/użytkowników `0/0/0`.
- Built frontend: PASS przy `NODE_OPTIONS=--max-old-space-size=8192`, `VITE_PMO_PROJECTS=true` i `VITE_API_URL=http://127.0.0.1:4217/api`; 10 715 modułów, build 35.74 s. Wcześniejsza próba bez jawnego limitu 8 GB zakończyła się OOM po transformacji; powtórka w wymaganym profilu pamięci przeszła i nie wskazuje defektu E2.
- Świeży browser proof na zbudowanym froncie, pełnym ApiGateway, JWT i RealPG: GREEN, 11/11 asercji, 0 błędów konsoli/strony/HTTP, readback `PROJECT_LEADER` / 75%, cleanup `organizationRows=0`, `dependentRows=0`. Pierwszy techniczny bieg został unieważniony, ponieważ stary proces preview proxy kierował względne endpointy na nieaktywny port 3001; po uruchomieniu preview z właściwym `VITE_API_TARGET=http://127.0.0.1:4217` ten sam niezmieniony kandydat przeszedł. Procesy API i preview zostały zatrzymane.
- Pełny frontend TypeScript: exit 2, 866 diagnostyk, lecz wynik kandydata jest byte-identical z bazą: SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`. Żadna diagnostyka nie dotyczy ścieżek E2; to neutralna delta, nie twierdzenie o zielonym repo.
- Flaga pozostaje opt-in: dokładny warunek `import.meta.env.VITE_PMO_PROJECTS === 'true'`; brak lub inna wartość daje OFF. Trasa z OFF wraca do `/my-work`, z ON montuje `MyProjects`; menu główne nie zostało rozszerzone.
- `git diff --check`: PASS. W różnicy względem bazy brak migracji i zmian schematu. E3 nie został rozpoczęty.

## Ocena końcowa

Zakres E2 spełnia warunki odbioru: realne role i pojemność per osoba, edycję istniejącego członka, egzekwowane uprawnienia, odpowiedzialności, plan komunikacji, wejścia do akceptacji, lokalizację EN+PL, standardowe listy, wymagane stany i dowód light/dark. Poprzednie P1 i P2 są zamknięte. Nie znalazłem nowego P1 ani P2. E2 jest **ACCEPT** do przekazania CTO; bez commitu, pushu, E3, deployu i migracji w ramach tego review.
