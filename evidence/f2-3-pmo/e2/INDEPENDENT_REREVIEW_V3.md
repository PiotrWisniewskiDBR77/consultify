# F2-3 PMO E2 — third fresh independent skeptical rereview

**Werdykt: HOLD. Poprzednie blokady techniczne zostały odebrane, ale ekran nadal fałszuje przypisania ról: obie osoby są grupowane jako `MEMBER`, mimo że PostgreSQL i edytory zwracają dwie różne role projektowe.**

Rereview wykonano 2026-09-13 na gałęzi `codex/pmo-projekty-role-statusy-20260913`, HEAD i baza `ba25e564592f4a803ecf53edf81b7d8c84524426`. Przed zapisaniem raportu SHA-256 dokładnego manifestu wynosił `ed07d1786c264d8ba519b3bf13f06e95dab3386244d1b17a0a33719ad02a3a1c`; wszystkie 56/56 wpisów przeszły `shasum -a 256 -c`, a dryf zamrożonego zakresu wynosił 0. Raport jest osobnym artefaktem review, więc nie należał do manifestu autora.

## Ustalenie blokujące

### P1 — sekcja przypisań ról pokazuje nieprawdziwy model zespołu

`getProjectMembers` zwraca kanoniczną rolę w polu `projectRole` (`ProjectController.ts:1175-1206`). Edytory wierszy także prawidłowo preferują `member.projectRole`. Jednak `roleGroups` grupuje wyłącznie po `m.role` i przy jego braku bezwarunkowo podstawia `MEMBER` (`MyProjects.tsx:525-536`). W rezultacie zamrożony dowód z prawdziwego built-browser flow pokazuje:

```text
ROLE (PRZYPISANIA)
MEMBER
Anna Sponsor, Jan Kowalski
2
```

Ten sam fixture ma w PostgreSQL role `PROJECT_SPONSOR` i `TASK_ASSIGNEE`, a po edycji `PROJECT_SPONSOR` i `PROJECT_LEADER`. Użytkownik widzi więc poprawne wartości w selektorach, lecz obok dostaje sprzeczne podsumowanie, że obie osoby mają jedną rolę `MEMBER`. To narusza centralny warunek E2: pokazać realne przypisania ról i wyprowadzać z nich model odpowiedzialności. Obecny test i18n nie wykrywa błędu, ponieważ renderuje syntetyczny komponent z samych tablic tłumaczeń zamiast produkcyjnej sekcji `roleGroups`.

Warunek naprawy: grupować po `projectRole` z kontrolowanym fallbackiem do zgodnego legacy `role`, dodać test zachowania produkcyjnej transformacji/renderu dla dwóch różnych ról i ponowić browser proof z asercją nazw obu grup przed oraz po edycji.

## Ustalenie P2

### P2 — opis dowodu filled przekracza to, co widać na PNG

Oba obrazy `12_e2_*` są prawdziwym stanem wypełnionym, ale kadr kończy się w tabeli zespołu. Sekcje „Odpowiedzialności ról”, „Plan komunikacji” i „Wejścia do akceptacji” znajdują się poniżej viewportu i nie są widoczne na tych PNG. Skrypt jedynie czeka, aż ich locatory mają stan DOM `visible`, po czym robi pełnoekranowy screenshot przy górze panelu. Asercja `filled responsibilities, communication and approval inputs captured light and dark` jest zatem zbyt szeroka. Pełny tekst strony i testy zachowania dowodzą treści, ale nie są wizualnym odbiorem tych trzech sekcji. Kolejny freeze powinien dodać light/dark screenshots po przewinięciu dolnej części preview albo zawęzić claim.

## Poprzednie HOLD-y odebrane

- Per-route capability enforcement jest realne dla POST/PATCH członków i PUT komunikacji (`enforceMode: 'enforce'`). Świeży niezależny bieg przez ApiGateway/JWT/PostgreSQL 18 przeszedł 5/5, retry 0; użytkownik bez capability dostał 403, a SQL nie zmienił zespołu ani komunikacji. Read-only operating model zwraca dla niego `canManageTeam=false` i `canManageCommunication=false`.
- Edycja istniejącego członka przechodzi z produkcyjnego UI przez `Api.updateProjectTeamMember` do PATCH i PostgreSQL; browser readback potwierdza `PROJECT_LEADER` oraz `allocation_percent=75`.
- Świeży focused behavior run przeszedł 4 pliki i 13/13 testów, retry 0. Zestaw obejmuje EN+PL dla selektorów, list przypisań, odpowiedzialności i wejść akceptacji oraz test flagi i modelu domenowego.
- Pełny zapis polskiego body z built frontu nie zawiera żadnego z 27 zakazanych technicznych identyfikatorów ról, akcji i approval. Widoczne etykiety oraz opisy są ludzkie.
- Obejrzano 10 PNG 1440×900: osobne loading, empty, no-permission i unassigned-role w light/dark oraz filled w light/dark. Stany są rozróżnialne i realne; no-permission pokazuje komunikat o braku prawa do zapisu, a unassigned-role pokazuje ludzką etykietę wymaganej roli.
- Browser JSON ma 7 asercji i 0 console errors, 0 page errors oraz 0 odpowiedzi HTTP >=400. Aborty telemetryczne zostały odseparowane od ruchu biznesowego.
- Cleanup browser fixture działa w `finally`. Zamrożony readback to `organizationRows=0`, `dependentRows=0`; świeże niezależne zapytanie po rerun RealPG także zwróciło 0 nazwanych organizacji i 0 danych fixture browserowego.
- Świeży produkcyjny `npm run build` przeszedł (`10714 modules transformed`, `built in 45.07s`). Ostrzeżenia CSS/chunk size są zastane i nie zmieniają werdyktu E2.
- Frontend TypeScript pozostaje neutralną deltą, nie zielonym typecheckiem repo: base i candidate są byte-identical, oba mają SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`, a żadna diagnostyka nie wskazuje ścieżki E2.
- Flaga ma dokładny warunek `import.meta.env.VITE_PMO_PROJECTS === 'true'`; brak lub inna wartość pozostaje OFF. `git diff --check` przechodzi.
- Nie ma pliku migracji ani zmian schematu. E3 nie został rozpoczęty.

## Warunki kolejnego rereview

1. Naprawić źródło przypisań ról i udowodnić dwie różne grupy z realnego API oraz zmianę grupy po UI→PATCH→PG.
2. Dodać light/dark dowód dolnych sekcji filled albo ograniczyć opis dowodu do faktycznie widocznego kadru.
3. Wygenerować nowy exact manifest i wykonać kolejne niezależne rereview bez commitu, pushu, E3, deployu ani migracji.
