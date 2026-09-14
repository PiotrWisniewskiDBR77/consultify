# F2-3 PMO E2 — fresh independent skeptical rereview

**Werdykt: HOLD. Poprawki backendowe są realne, lecz poprzedni warunek browser-state nadal nie został dostarczony, a techniczne identyfikatory nadal są widoczne w polskim UI.**

Rereview wykonano 2026-09-13 na gałęzi `codex/pmo-projekty-role-statusy-20260913`, HEAD i baza `ba25e564592f4a803ecf53edf81b7d8c84524426`. Przed zapisaniem tego raportu SHA-256 manifestu wynosił `aaca3b53add40e62b0999cea69bae9faba5a0754716722b1d8c3032201a7ef7a`; wszystkie 38/38 wpisów przeszły `shasum -a 256 -c`, a dryf zamrożonego zakresu wynosił 0. Nie ma commitu E2, dlatego przedmiotem rereview jest dokładnie zamrożony zestaw plików, nie nowy SHA Git.

## Ustalenia blokujące

### P1 — obowiązkowy dowód stanów przeglądarkowych nadal nie istnieje

Poprzedni review wymagał dowodu zbudowanego frontu dla stanów: pusty, ładowanie, brak uprawnień oraz rola bez obsady, oprócz jasnego i ciemnego motywu oraz kontroli konsoli. `browser-proof.mjs` tworzy wyłącznie jeden projekt z dwoma członkami, otwiera jego wypełniony preview, edytuje jednego członka i wykonuje dwa zrzuty tego samego stanu z danymi. Nie tworzy ani nie asertywnie sprawdza żadnego z czterech wymaganych stanów. Lista pięciu elementów w `14_browser_result.json` opisuje pięć asercji jednego scenariusza; nie jest dowodem pięciu stanów UI.

Zrzuty `12_e2_light_1440x900.png` i `13_e2_dark_1440x900.png` są rzeczywistymi obrazami 1440×900 i pokazują poprawnie zamontowany `StandardTable` oraz `StandardPreview` w obu motywach. `14_browser_result.json` podaje 0 błędów konsoli, page errors i odpowiedzi HTTP >=400. To odbiera część light/dark/console, ale nie odbiera poprzedniego P1 dotyczącego stanów produktu.

### P2 — techniczne identyfikatory pozostają widoczne w polskim UI

Naprawiono tłumaczenie akapitów „Może / Nie może”, lecz ten sam model nadal pokazuje surowe identyfikatory w innych miejscach. Zamrożony `browser-body-pl.txt` zawiera między innymi `PROJECT SPONSOR`, `TASK ASSIGNEE`, `approve-business-case`, `manage-delivery` i `deliver-assigned-work`. Źródło potwierdza przyczynę:

- opcje edycji i dodawania roli używają `role.replace(/_/g, ' ')`;
- sekcja „Role (assignments)” renderuje surowe `role`;
- „Odpowiedzialności ról” renderują `row.roleKey.replace(/_/g, ' ')` i `row.accountableFor.join(', ')`.

Test `ProjectRolePermissionCopy.i18n.test.tsx` obejmuje tylko osobny komponent akapitu i cztery wybrane permission keys. Browser proof filtruje tylko akapity zawierające „może:”, więc nie wykrywa surowych wartości w selektorach, przypisaniach i macierzy odpowiedzialności. Poprzedni warunek „zastąpić techniczne slug-i widocznymi opisami EN/PL” pozostaje niespełniony.

### P2 — browser fixture pozostaje w lokalnym PostgreSQL

Po dowodzie autora oraz po świeżym biegu testów tras kontrolne zapytanie do `127.0.0.1:6458/f23_e1` zwraca 1 organizację spośród fixture'ów `F23 PMO`, `F23 foreign`, `F2-3 PMO Browser`. Pozostał deterministyczny fixture `F2-3 PMO Browser`, ponieważ `browser-proof.mjs` nie ma cleanupu. Test tras sprząta własne dane prawidłowo; skrypt browserowy powinien zapewnić cleanup w `finally` i udowodnić zero rekordów po biegu.

## Co niezależnie potwierdzono

- Per-route capability enforcement jest rzeczywiste: POST i PATCH członków oraz PUT komunikacji mają `enforceMode: 'enforce'`, bez globalnej zmiany trybu.
- Świeży niezależny bieg przez pełny `ApiGateway`, JWT i lokalny PostgreSQL 18 (`127.0.0.1:6458/f23_e1`) przeszedł 4/4, retry 0. Aktor `TASK_ASSIGNEE` dostał 403 dla POST/PATCH zespołu i PUT komunikacji; zapytania SQL potwierdziły brak mutacji po odmowie. Autoryzowany zapis i tenant isolation przeszły.
- Edycja istniejącego członka jest podłączona w produkcyjnym UI do `Api.updateProjectTeamMember`. Zamrożony browser proof wykonał PATCH, a bezpośredni odczyt PG potwierdził `WORKSTREAM_OWNER` i `allocation_percent=75`.
- Świeży niezależny bieg focused behavior przeszedł 4 pliki i 10/10 testów, retry 0.
- Świeży niezależny `npm run build` zakończył się kodem 0. Ostrzeżenia o wielkości chunków i przestarzałym Browserslist są zastanym długiem, nie regresją E2.
- Pełny frontend TypeScript pozostaje neutralną deltą: baza i kandydat mają po 866 linii diagnostyk, pliki są byte-identical o SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`, a diagnostyki ścieżek E2 = 0. Nie jest to claim zielonego typechecku repo.
- Flaga ma dokładny warunek `import.meta.env.VITE_PMO_PROJECTS === 'true'`; brak i wartości inne niż `true` pozostają OFF. Nie dodano nowej pozycji menu.
- `git diff --check` przechodzi. W zmianach względem bazy nie ma pliku migracji ani schematu; migracja nie jest wymagana.

## Warunki kolejnego rereview

1. Dostarczyć built-browser evidence dla stanów pusty, ładowanie, brak uprawnień i wymagana rola bez obsady, z asercjami zachowania, zrzutami oraz kontrolą konsoli/HTTP.
2. Użyć ludzkich etykiet i opisów EN/PL we wszystkich widocznych miejscach: selektory, przypisania ról, odpowiedzialności i acceptance inputs; dodać test zachowania obejmujący cały renderowany ekran, nie tylko `ProjectRolePermissionCopy`.
3. Dodać niezawodny cleanup browser fixture i readback `0` po biegu.
4. Wygenerować nowy manifest po poprawkach i wykonać świeży niezależny rereview.
