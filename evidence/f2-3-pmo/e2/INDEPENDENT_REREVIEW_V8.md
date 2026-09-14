# F2-3 PMO E2 — świeży niezależny rereview V8

**Werdykt: ACCEPT dla dokładnego manifestu V8. Governed-error delta zamyka ostatnią blokadę commita: trasa członka zespołu zwraca wyłącznie kod maszynowy, klient lokalizuje go przez istniejący normalizator, a użytkownik PL nie widzi kodu ani angielskiego zdania serwera.**

Rereview wykonano 2026-09-13 21:44 CDT na gałęzi `codex/pmo-projekty-role-statusy-20260913`, przy bazie i niezmienionym HEAD `ba25e564592f4a803ecf53edf81b7d8c84524426`. SHA-256 dokładnego manifestu V8 wynosi `053ac6b969fc5fffc1f628165f37012bc2c348ef51b0ed54f5c7e66885488e67`; świeże `shasum -a 256 -c` potwierdziło 98/98 plików, dryf 0. Ten raport jest oddzielnym artefaktem niezależnego review i nie należy do manifestu autora.

## Zamknięcie delty po V6/V5

- `CreateProjectModal` zachowuje naprawę V6: X i Cancel są `type="button"`, Create jest `type="submit"`; dostępna nazwa X używa `t('common.close')` bez angielskiego fallbacku.
- `POST /api/pmo/projects/:projectId/members` dla osoby spoza aktywnego członkostwa organizacji zwraca dokładnie HTTP 400 z `{ code: 'PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED', error: 'PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED' }`. W tej kopercie nie ma zdania serwera.
- `Api.addProjectTeamMember` przechodzi przez wspólne `handleResponse`, które wywołuje `normalizeApiErrorMessage`. Kod jest zarejestrowany w `API_ERROR_FALLBACKS_EN` i w zasobach `errors.*` obu języków. Świeży test zachowania rzeczywistej koperty potwierdza wynik PL `Wybrana osoba musi być aktywnym członkiem organizacji projektu.` oraz brak surowego kodu i `HTTP 400`.
- Istniejące zachowanie pozostało zachowane: modal nadal rozróżnia Cancel/X/Create, role nadal grupują rzeczywisty `projectRole`, edycja roli i pojemności jest trwała, a uprawnienia zapisu są egzekwowane przed SQL.

## Świeże dowody niezależne

- Dokładny manifest: 98/98 SHA PASS, dryf 0.
- Focused behavior: 7 plików, 19/19 PASS, retry 0. Obejmuje błąd governed PL, modal, realny kształt przypisań, EN+PL, kontrakt list, model domenowy oraz flagę/routing.
- ApiGateway + JWT + lokalny real PostgreSQL `127.0.0.1:6458/f23_e1`: 5/5 PASS, retry 0. Potwierdzono 400 z kodem maszynowym, 403 przy braku capability z zerową mutacją SQL, zapis roli/pojemności, zapis ustawień komunikacji oraz izolację tenantów.
- J0 staged: PASS, bez wzrostu i bez zmiany baseline; spadki K3a -247, K4pl -9, K4en -9, K7 -2.
- i18n zachowania roli: 4/4 PASS w EN i PL. Oba pliki locale są poprawnym JSON-em.
- Action gates: scoped coverage 1/1 pliku, 0 nowych naruszeń; pełny rejestr PASS — 234 akcje, 124 stringi runtime, 7 zdarzeń, 4 metody API; staged MyWork 4 pliki, 0 nowych naruszeń.
- Zamrożony feature-enabled build: PASS, 10 715 modułów, 34.18 s. Zachowany wcześniejszy bieg na domyślnym limicie 4 GB kończy się OOM i nie jest używany jako dowód; wynik 8 GB jest terminalnie zielony.
- Frontend TypeScript jest neutralną deltą, nie zielonym repo: baza i kandydat mają po 866 linii diagnostyk; wyjścia są bajtowo identyczne, wspólny SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`.
- `git diff --cached --check` dla kodu i locale: PASS. Pełny staged check raportuje wyłącznie historyczne whitespace w zachowanych logach dowodowych, bez błędu źródłowego.

Pomocniczy, niestanowiący bramki E2 skrypt `scripts/i18n/check-help.mjs` nadal kończy się na zastanym konflikcie kształtu klucza `help.managementReports` (`approvalWorkflow in Managementberichte`). Nie dotyczy on dodanych kluczy E2 ani testu parity użytego w zamrożonym manifeście; J0 i testy EN/PL są zielone. Nie znaleziono nowego P1/P2. Nie rozpoczęto E3, migracji, deployu ani pushu.
