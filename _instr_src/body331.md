## Po co ten dyżur istnieje

Dyżury 295 (dowody Mojej Pracy) i 298 (silnik raportu Oceny) zostały wybrane przez właściciela
03.09 wieczorem na TERAZ i miały zostać domknięte przez dyżur 322. **Żaden z nich nie został
rozpoczęty** — worktree dla obu w ogóle nie istnieje (worktree 312, które miało je zrobić
najpierw, zostało po zakończeniu tamtego dyżuru usunięte). Obie pozycje mają kształt „biblioteka
bez wywołania": poprawny, samodzielnie testowany kod bez realnego wołacza produkcyjnego albo bez
dowodu, że mierzy właściwy obiekt.

**Pozycja (a) — 295.** Enumeracja kontrolek czterech narzędzi Idei istnieje
(`ideaTools.controlEnumeration.test.tsx`) i deklaruje mianownik 226 unikalnych sygnatur (suma
kolumny `unique`: whiteboard 53 + mindmap 65 + processflow 81 + idea-table 27). Ale: (1) test jest
`describe.runIf(Boolean(HARNESS_URL))` — bez zmiennej `DAY295_IDEA_HARNESS_URL` **przechodzi z
zerem uruchomionych przypadków**, co wygląda jak PASS, a jest brakiem pomiaru; (2) wpis
`idea-table` w kontrakcie wskazuje na ekran `dev-render/screens/idea-table.tsx`, który montuje
`<IdeaTableScreen>` — to jest **LISTA Idei** (rekord jako wiersz tabeli), nie narzędzie budowania
tabeli. Realne `<IdeaTableTool>` (`src/components/MyWork/IdeaTableTool.tsx`) jest montowane przez
`<IdeaMapWorkspace initialTool="table">` na zupełnie innym ekranie —
`dev-render/screens/idea-table-timeline-stuck.tsx`. Mianownik `27` policzony na złym ekranie nic
nie mówi o prawdziwym narzędziu; (3) tam gdzie test faktycznie coś sprawdza, robi to na poziomie
DOM (`aria-label`, `role`, `aria-expanded`) — nie na poziomie efektu. Odbiorca zweryfikował, że
test zostaje zielony nawet po wypatroszeniu handlera jednej z kontrolek — klasyczny kształt „test
scenariusza nie broni zabezpieczenia".

**Pozycja (b) — 298.** `acceptedDrdReportModel.ts` (133 linie) i `methodSessionReportMetadataService.ts`
(105 linii) mają po jednym trafieniu `git grep` — własna definicja, zero konsumentów. DOCX
wyrenderowany z tego modelu jest **piksel-w-piksel identyczny** z zaakceptowanym 21-stronicowym
prototypem (`DEC-2026-09-03-385`, „Ten raport jest po prostu fantastyczny"). Ale podłączenie nie
jest proste dopisanie importu: repo ma **już DWA inne, żywe pipeline'y** generujące raport
z tej samej sesji DRD:

1. **DOCX** — `assessmentReportContractService.build()` + `buildAssessmentDrdReportSchema()`,
   zamontowany na `/sessions/:sessionId/assessment-report.docx` w `method-core.routes.ts`.
2. **HTML** — `generateDrdReport()` (`drdReportGenerator.ts`) wołany przez
   `buildDrdReportHtmlServer()` (`drdReportService.ts`), zamontowany w
   `assessment-reports.routes.ts` (linie ok. 1105-1148). Ten pipeline ma **już wpięty, żywy
   narrator LLM** (`drdLlmNarrator.ts`, `makeLlmNarrator`) — kod importuje `llmService`
   bezwarunkowo w bloku `try/catch` „fail-open" (jeśli import padnie, cicho spada na
   deterministyczny stub) i **nie ma przy tym żadnej flagi funkcyjnej `ENABLE_*`**. To jest
   fakt zastany, nie coś do naprawienia w tym dyżurze — dopóki Twoja analiza relacji (R4) nie
   każe scalić tego pipeline'u z `acceptedDrdReportModel`.

Podłączenie trzeciego silnika bez zmierzenia dwóch pierwszych grozi trzema konkurencyjnymi
generatorami tego samego dokumentu.

**Sprostowanie, którego nie wolno pominąć.** Poprzednia instrukcja (298) zakładała, że
`methodSessionReportMetadataService.save()` sprawdza tenanta dopiero przez `get()` PO zapisie —
**to jest błędna premisa nadzorcy, nie ustalenie wykonawcy**. Realny kod (linie ok. 69-90) ma
`INSERT ... SELECT ?,... WHERE EXISTS (SELECT 1 FROM method_sessions WHERE id = ? AND
organization_id = ?) ON CONFLICT (session_id) DO UPDATE ...` — warunek tenantowy stoi **w samym
zapytaniu zapisu**, przed `ON CONFLICT`. STOP, który dyżur 298 zgłosił wobec tej pozycji, był
**zasadny**. Twoim zadaniem w R5 jest zweryfikować to mutacyjnie, nie przepisać ślepo cudzą
diagnozę w żadną stronę.

## ★ Zmierz moje liczby sam

Twierdzę: worktree 331 nie istnieje (tworzysz od zera); kontrakt enumeracji ma `idea-table:
unique 27`, suma czterech wierszy = 226; test jest `describe.runIf(Boolean(HARNESS_URL))`;
ekran `idea-table` montuje `<IdeaTableScreen>` (lista), ekran `idea-table-timeline-stuck` montuje
realny `<IdeaTableTool>` przez `initialTool="table"`; `NOTEBOOK_PAGE_CONFLICT` istnieje w
`my-work.routes.ts` (trzy miejsca, ok. 1486/1603/1723) z frontowym wołaczem w
`NotebookContent.tsx`; `buildAcceptedDrdReportModel` i `methodSessionReportMetadataService` mają
po jednym trafieniu `git grep` (własna definicja); `save()` ma `WHERE EXISTS` w zapytaniu zapisu;
`assessment-reports.routes.ts` woła `llmService` bezwarunkowo, bez flagi. **Jeśli Twój pomiar
przeczy mojej liczbie, obowiązuje Twój — zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Pozycja | Licencja | Zastępczy produkt |
| --- | --- | --- | --- |
| `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | (a) | **★ PEŁNA LICENCJA** — poprawka mianownika `idea-table` (screen + oczekiwana liczba), wzmocnienie asercji do dowodu efektu | — |
| `src/components/MyWork/IdeaTableTool.tsx` i trzy siostrzane narzędzia Idei w `src/components/MyWork/**` | (a) | **★ WĄSKA LICENCJA: wyłącznie jeśli enumeracja znajdzie kontrolkę bez efektu (MARTWA)** — naprawa punktowa albo wpis `MARTWE` z plik:linia | Wpis `MARTWE` w raporcie |
| `dev-render/screens/idea-table-timeline-stuck.tsx`, `dev-render/main.tsx` (rejestracja ekranu) | (a) | **TYLKO ODCZYT** — ekran istnieje, wykorzystujesz go jako cel pomiaru | — |
| `server/src/routes/v8/my-work.routes.ts` | (a) | **★ WĄSKA LICENCJA: wyłącznie ciało odpowiedzi `409 NOTEBOOK_PAGE_CONFLICT`** (dodanie pola, NIE zmiana kodu statusu ani logiki blokady) | Czerwony kontrakt + brief |
| `src/components/MyWork/NotebookContent.tsx` | (a) | **★ WĄSKA LICENCJA: wyłącznie UI reakcji na 409** (komunikat, wybór zachowaj/weź cudze, odświeżenie) | Czerwony kontrakt + brief |
| `src/components/Initiatives/**` | (a), R5 | **★ WĄSKA LICENCJA: wyłącznie ujednolicenie do kanonu `standard/`** (6 bloków podglądu) | Czerwony kontrakt + brief |
| `server/src/services/report/acceptedDrdReportModel.ts`, `server/src/services/report/methodSessionReportMetadataService.ts` | (b) | **★ PEŁNA LICENCJA** | — |
| `server/src/routes/method-core.routes.ts` | (b) | **★ WĄSKA LICENCJA: wyłącznie podłączenie/wywołanie silnika**, w miejscu ustalonym w R4. **ZAKAZ** zmiany istniejących tras poza tym jednym punktem | Czerwony kontrakt + brief |
| `server/src/routes/assessment-reports.routes.ts`, `server/src/services/report/drdReportGenerator.ts`, `server/src/services/report/drdLlmNarrator.ts`, `server/src/services/report/drdReportService.ts` | (b) | **TYLKO ODCZYT — WYJĄTEK: wolno dotknąć WYŁĄCZNIE jeśli R4 jawnie ustali scalenie z `acceptedDrdReportModel`**, z opisem promienia rażenia PRZED zmianą | Wpis `DO DECYZJI WŁAŚCICIELA` z promieniem rażenia |
| `server/migrations/2026200[0-9]*.sql`, `server/migrations/202620[1][0-9]*.sql` | (b) | **★ PEŁNA LICENCJA, wyłącznie addytywnie**, przedział `20262000`–`20262019`, dla ewentualnej kolumny/flagi metryki badania | — |
| `tests/unit/backend/security/**`, `**/*.pg.test.ts` (NOWE) | (a),(b) | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`, `CODEX_DAY298_SILNIK_RAPORTU_OCENY_REPORT.md` | — | **PEŁNA LICENCJA na DOPISYWANIE** sekcji „Dopisek dyżuru 331" na końcu. **ZAKAZ kasowania istniejącej treści** | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | wszystkie | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | wszystkie | **TYLKO ODCZYT** | Musisz przechodzić zielono |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | — | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY331_MOJAPRACA_I_SILNIK_REPORT.md` | R6 | **JEDYNY nowy raport zbiorczy** (`Z13`) | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis w raporcie z plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt 295+298 + plik postępu | TAK | NIE | bazowe | Wszystko przeczytane, plik postępu założony | brak |
| R1 (a) | Pomiar + enumeracja NA WŁAŚCIWYM EKRANIE | TAK | NIE | wg instr. 295 + 1 mianownik poprawiony | Kontrakt `idea-table` wskazuje `idea-table-timeline-stuck`; mianownik przeliczony; dowód mutacyjny celujący w handler, nie w DOM | `feat(myWork): enumeracja na wlasciwym ekranie tabeli Idei (331 R1)` |
| R2 (a) | Ścieżka 409 na produkcyjnej trasie | TAK | NIE — dowód: `Z12` nie chroni `NotebookContent.tsx` całościowo | 1 test wyścigu | Dwóch klientów edytuje tę samą stronę notatnika przez `my-work.routes.ts`; front reaguje na 409 (komunikat + wybór) | `feat(myWork): 409 NOTEBOOK_PAGE_CONFLICT na produkcyjnej trasie (331 R2)` |
| R3 (a) | Komplet dowodu Idei + Inicjatywy kanon | TAK | NIE | wg instr. 295 R4-R5 | 4×8 kadrów + Inicjatywy do kanonu `standard/` | `docs(myWork): dowod 4 narzedzi + inicjatywy kanon (331 R3)` |
| R4 (b) | Relacja pipeline'ów + podłączenie | TAK | NIE — dowód: `Z12` nie chroni `method-core.routes.ts` całościowo | 1 test relacji | Wszystkie pipeline'y raportu w `server/src/services/report/` wymienione; relacja `acceptedDrdReportModel` ↔ DOCX ↔ HTML ustalona pisemnie; silnik podłączony zgodnie z ustaleniem | `feat(report): relacja pipeline'ow + podlaczenie acceptedDrdReportModel (331 R4)` |
| R5 (b) | Tenant + narrator | TAK | NIE | 2 testy | Warunek tenantowy zweryfikowany mutacyjnie (naprawiony TYLKO jeśli dowód pokaże defekt); narrator za flagą OFF TYLKO jeśli podłączasz nową ścieżkę | `fix(report): weryfikacja tenantowa + narrator za flaga (331 R5)` |
| R6 | Raport zbiorczy | NIE | NIE | n/d | Struktura `§R.2`, TWIERDZENIA NIEZWERYFIKOWANE niepuste | `docs(day331): raport` |

> Żadna pozycja nie wymaga zmiany pliku jawnie nietykalnego bez wyjątku wymienionego w `B.1`.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Suma `unique` w kontrakcie enumeracji (4 ekrany) | 226 (53+65+81+27) | `grep -oE 'unique: [0-9]+' src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | TAK |
| 2 | `unique` dla `idea-table` (mierzony na ZŁYM ekranie) | 27 | jw., wiersz `idea-table` | ★ NIE — ekran jest listą, nie narzędziem; R1 przelicza na właściwym |
| 3 | Wystąpienia `initialTool="table"` w ekranach idea-table* | 1 (w `idea-table-timeline-stuck.tsx`) | `grep -n initialTool dev-render/screens/idea-table*.tsx` | TAK |
| 4 | Wołacze `buildAcceptedDrdReportModel` poza definicją/testem | 0 | `git grep -n 'buildAcceptedDrdReportModel' -- server src scripts \| grep -v __tests__` → 1 wiersz (definicja) | TAK |
| 5 | Wołacze `methodSessionReportMetadataService` poza singletonem/testem | 0 | analogicznie | TAK |
| 6 | Pipeline'y raportu DRD już podłączone (poza `acceptedDrdReportModel`) | 2 (DOCX, HTML) | `git grep -rn 'assessment-report.docx\|buildDrdReportHtmlServer' server/src/routes` | TAK — zmierz, czy nie ma trzeciego |
| 7 | Miejsca `NOTEBOOK_PAGE_CONFLICT` w produkcyjnej trasie | 3 | `grep -c NOTEBOOK_PAGE_CONFLICT server/src/routes/v8/my-work.routes.ts` | TAK |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik/katalog | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- |
| 1 | `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | R1 | ZEROWE |
| 2 | `server/src/routes/v8/my-work.routes.ts` (wąsko, ciało 409) | R2 | NISKIE |
| 3 | `src/components/MyWork/NotebookContent.tsx` | R2 | NISKIE |
| 4 | `src/components/Initiatives/**` | R3 | NISKIE |
| 5 | `server/src/services/report/**`, `server/src/routes/method-core.routes.ts` | R4-R5 | NISKIE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY331_MOJAPRACA_I_SILNIK_REPORT.md` | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/routes/assessment-reports.routes.ts`, `drdReportGenerator.ts`, `drdLlmNarrator.ts` | R4 | Tylko jeśli R4 ustali scalenie z `acceptedDrdReportModel` — z opisanym promieniem rażenia PRZED zmianą |
| `server/migrations/20262000-20262019` (NOWE) | R4 | Tylko jeśli metryka badania wymaga nowej kolumny |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/Interview/** — dyżur 330
scripts/dev/testy-puste-skan.mjs, tests/unit/config/noEmptyAssertions.test.ts — dyżur 332
server/scripts/migrationOrdering.ts, tests/unit/backend/schema/** — dyżur 333
server/src/routes/notebook.routes.ts (P07_CONCURRENT_EDIT_CONFLICT) — trasa bez wołacza, poza zakresem
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6357 | `lsof -nP -iTCP:6357 -sTCP:LISTEN` → puste |
| Port harnessu | 5497 | `lsof -nP -iTCP:5497 -sTCP:LISTEN` → puste |
| Kontener | `cx-day331-pg` | `docker ps` → brak |
| Baza | `cx331` | n/d przed startem |
| Przedział migracji | `20262000`–`20262019` | `ls server/migrations/ \| grep -cE '^202620(0[0-9]\|1[0-9])'` → 0 |
| Gałąź | `codex/day331-mojapraca-i-silnik-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day331-mojapraca-i-silnik` | nie istnieje |
| Flagi | narrator LLM (298, tylko jeśli nowa ścieżka), default OFF | `grep -rn <nazwa flagi> → 0 miejsc z true na stałe` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day331-mojapraca-i-silnik
git diff --name-only --cached | tee /private/tmp/cx-day331-mojapraca-i-silnik-artefakty/staged.txt
grep -iE 'Interview/|testy-puste-skan|migrationOrdering|notebook\.routes\.ts$' /private/tmp/cx-day331-mojapraca-i-silnik-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — ODCZYT I PLIK POSTĘPU

Przeczytaj `INSTRUKCJA_DYZUR_295.md` i `INSTRUKCJA_DYZUR_298.md` w całości. Wykonaj 10 komend
`§0.1`. Załóż `/private/tmp/cx-day331-postep.md` z dwiema pozycjami, stan `NIEROZPOCZĘTE`.
Aktualizujesz po każdej pozycji.

Prawo zatrzymania po tej pozycji.

## R1 — (a) POMIAR + ENUMERACJA NA WŁAŚCIWYM EKRANIE

Popraw kontrakt w `ideaTools.controlEnumeration.test.tsx`: wpis dla narzędzia tabeli ma wskazywać
ekran `idea-table-timeline-stuck` (`initialTool="table"`), nie `idea-table` (lista). Uruchom
harness (`DAY295_IDEA_HARNESS_URL` ustawione na Twój `dev-render` na porcie 5497), zmierz REALNĄ
liczbę widocznych kontrolek na nowym ekranie (bazowe + po otwarciu każdego menu) — zastąp `27`
zmierzoną wartością, zapisz w raporcie jako korektę mianownika. Dla WSZYSTKICH czterech narzędzi
wzmocnij asercję z samej obecności w DOM na dowód EFEKTU: dla reprezentatywnej próbki kontrolek
(minimum 10 na narzędzie) sprawdź, że kliknięcie wywołuje zmianę stanu/handler/trasę, nie tylko
że element istnieje z odpowiednim `role`/`aria-label`. **Dowód mutacyjny obowiązkowy i musi
celować w ZABEZPIECZENIE**: usuń handler jednej z sprawdzanych kontrolek w `IdeaTableTool.tsx`
(albo siostrzanym narzędziu), uruchom test — musi zaczerwienić się; przywróć przez `cp` (`Z27`)
— musi wrócić do zielonego.

Commit po R1. Zapis w pliku postępu.

## R2 — (a) ŚCIEŻKA 409 NA PRODUKCYJNEJ TRASIE

Kontener z pełnym łańcuchem migracji od zera na porcie 6357. Dwóch klientów edytuje tę samą
stronę notatnika przez `PUT`/`PATCH` na `server/src/routes/v8/my-work.routes.ts` — dowód
wyścigu: drugi zapis dostaje `409` z kodem `NOTEBOOK_PAGE_CONFLICT` i ciałem zawierającym świeżą
wersję strony (`data: fresh`). Front (`NotebookContent.tsx`): komunikat pl/en, wybór „zachowaj
moje / weź cudze / porównaj", odświeżenie po wyborze; zrzuty stanu konfliktu light/dark. **Zakaz
robienia tego dowodu na `notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT`)** — ta trasa nie ma
frontowego wołacza, dowód na niej nie mówi nic o produkcie.

Commit po R2. Zapis w pliku postępu.

## R3 — (a) KOMPLET DOWODU + INICJATYWY DO KANONU

4 narzędzia × 8 kadrów (pl/en × light/dark × 1440/1024) na PRAWIDŁOWYCH ekranach (patrz R1) +
przebieg klawiaturą (`Tab`×5, bez pułapki fokusa). A11y zero realnych naruszeń. Inicjatywy:
napraw rozjazdy z kanonem `standard/` (6 bloków podglądu) tym samym mechanizmem co w
Realizacji/Ocenie; zrzuty PRZED/PO na REALNYM rekordzie otwartym z listy (nie z fikstury
pokazowej — patrz pamięć „inicjatywy-odbior-na-fiksturze-pokazowej"); test
`initiativeRecordCanon` zielony, jeśli istnieje.

Commit po R3. Zapis w pliku postępu.

## R4 — (b) RELACJA PIPELINE'ÓW + PODŁĄCZENIE

**Krok 1 — zmierz WSZYSTKIE pipeline'y, nie zakładaj że są dwa.** `git grep` po
`generateDrdReport\|buildDrdReport\|assessmentReportContractService\|acceptedDrdReportModel`
w całym `server/src/services/report/` i `server/src/routes/`. Na dzień pisania tej instrukcji
zidentyfikowane są: (1) DOCX przez `assessmentReportContractService` na
`/sessions/:sessionId/assessment-report.docx`; (2) HTML przez `generateDrdReport`/
`buildDrdReportHtmlServer` na `assessment-reports.routes.ts`, z już wpiętym, bezflagowym
narratorem LLM. **Sprawdź, czy jest trzeci** — nie zakładaj kompletności tej listy.

**Krok 2 — ustal relację pisemnie.** Dla `acceptedDrdReportModel` względem KAŻDEGO znalezionego
pipeline'u odpowiedz: ZASTĘPUJE (ten sam dokument, nowy silnik), UZUPEŁNIA (dodatkowa sekcja
metadanych z `methodSessionReportMetadataService` — zespół doradczy, kalendarz, rekomendacje) czy
to INNA funkcja produktowa (inny format/odbiorca). Jeśli wniosek różni się od założeń instrukcji
298 — to jest wynik merytoryczny, zapisz go i zaprojektuj podłączenie zgodnie z nim, nie ze
starym założeniem.

**Krok 3 — podłącz.** Realna ścieżka HTTP → silnik → odpowiedź, zgodnie z ustaloną relacją.

Commit po R4. Zapis w pliku postępu.

## R5 — (b) TENANT + NARRATOR

**Warunek tenantowy — zweryfikuj, nie zakładaj defektu.** `save()` ma dziś `WHERE EXISTS (SELECT
1 FROM method_sessions WHERE id = ? AND organization_id = ?)` w SAMYM `INSERT ... SELECT`, przed
`ON CONFLICT`. Dowód mutacyjny w OBIE strony: (a) spróbuj zapisać jako obcy tenant (inny
`organizationId` niż właściciel sesji) — sprawdź, czy zapis faktycznie nic nie zmienia (0 wierszy
dotkniętych, `get()` po tej próbie zwraca stan sprzed); (b) usuń warunek `WHERE EXISTS` i
powtórz — sprawdź, czy TERAZ obcy NADPISUJE. Jeśli (a) pokazuje, że ochrona już działa — napisz
to wprost w raporcie jako obaloną tezę poprzedniej instrukcji, NIE dopisuj drugiego warunku na
wyrost. Jeśli chcesz zamknąć teoretyczne okno wyścigu między `SELECT EXISTS` a zapisem, opakuj
całość w jawną transakcję z testem negatywnym „właściciel zapisuje / obcy nie nadpisuje", ale to
jest wzmocnienie obronne, nie naprawa potwierdzonego błędu.

**Narrator LLM — TYLKO jeśli R4 podłącza nową ścieżkę.** Jeśli R4 Krok 3 tworzy nowe wywołanie
generowania (niezależne od istniejącego bezflagowego wpięcia w `assessment-reports.routes.ts`):
nowa flaga, domyślnie OFF (także przy braku zmiennej środowiskowej), test fail-safe (błąd modelu
→ raport i tak powstaje, bez sekcji narracyjnej). **Nie dotykasz** istniejącego wpięcia w
`assessment-reports.routes.ts`/`drdReportGenerator.ts` — ono nie ma dziś flagi i to jest
ZNALEZISKO do raportu (`DO DECYZJI WŁAŚCICIELA` z opisem promienia rażenia), nie zadanie do
naprawy tutaj.

Commit po R5. Zapis w pliku postępu.

## R6 — RAPORT ZBIORCZY

Stan obu pozycji (domknięta/częściowa/nierozpoczęta, z powodem), stan pliku postępu, poprawiony
mianownik enumeracji Idei z R1, mapa wszystkich znalezionych pipeline'ów raportu i decyzja o
relacji z R4, wynik weryfikacji tenantowej z R5 (potwierdzona ochrona albo naprawiony defekt),
znalezisko o bezflagowym narratorze istniejącego pipeline'u HTML jako `DO DECYZJI WŁAŚCICIELA`,
TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1-R2 domknięte, R3 rozpoczęte, R4-R5 nietknięte, plik
postępu aktualny" jest pełnowartościowym wynikiem. Podłączenie trzeciego silnika raportu bez
zmierzenia dwóch istniejących nie jest wynikiem — jest nowym długiem.
