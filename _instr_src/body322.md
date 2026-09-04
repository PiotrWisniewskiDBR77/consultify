## Po co ten dyżur istnieje

Cztery odbiory adwersaryjne z nocy 03.09 nazwały z imienia to, co jest zrobione, i to, co tylko
wygląda na zrobione. Dyżur 312 dostał sześć pozycji w kolejce i domknął tylko pozycję (a) —
częściowo, bo zastany WIP wycieków (296) okazał się przekazywać `undefined` zamiast realnego
`req` do mappera. Pozycje (b)-(f) **nie zostały rozpoczęte** — potwierdzone własnym pomiarem
raportu 312 („Pozycje 297, 293, 292, 298 i 295 nie zostały rozpoczęte w tym przebiegu") i moim
niezależnym pomiarem dzisiaj: worktree 297 i 292 mają dokładnie zero i dwa commity odpowiednio
ponad wspólnym przodkiem (zgodne z wcześniejszymi ustaleniami), 293 ma niecommitowany zastany
WIP czterech plików, a worktree dla (e) i (f) w ogóle nie istnieje (worktree 312 zostało po
zakończeniu tamtego dyżuru usunięte).

Dwie z pięciu pozycji — mapper wycieków (poza zakresem tego dyżuru) i silnik raportu Oceny (f) —
mają kształt „biblioteka bez wywołania": poprawny, samodzielnie testowany kod bez ani jednego
konsumenta produkcyjnego. Domknięcie oznacza tu **podłączenie**, nie kolejny test.

## ★ Warunek startu: trzy worktree już istnieją

Nie twórz nowych dla 292, 293 i 297. Katalogi istnieją, mają częściową pracę i własne gałęzie.
Zaczynasz od odczytania ich historii (i, dla 293, od PRZECZYTANIA zastanego niecommitowanego
diffu — nie odrzucasz go bez przeczytania) i kontynuujesz od pierwszej niewykonanej pozycji, na
tej samej gałęzi. Dla pozycji (f) i (e) pracujesz w NOWYM worktree z markera, bo poprzedni
(dyżuru 312) już nie istnieje.

## ★ Zmierz moje liczby sam

Twierdzę: 292 ma dwa commity ponad wspólnym przodkiem (R1+R2 zrobione, R3-R6 nie); 293 ma zero
commitów, ale NIECOMMITOWANY WIP czterech plików; 297 ma czysty worktree bez żadnego postępu;
`buildAcceptedDrdReportModel` i `methodSessionReportMetadataService` mają po jednym trafieniu
`git grep` — własna definicja, zero wołaczy; `idea-table.tsx` to lista, narzędzie tabeli jest
w `idea-table-timeline-stuck.tsx`. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Pozycja | Licencja | Zastępczy produkt |
| --- | --- | --- | --- |
| `scripts/dev/reachability-from-root.mjs` (NOWY) | (b) 297 | **★ PEŁNA LICENCJA** | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (NOWY) | (b) 297 | **★ PEŁNA LICENCJA** | — |
| `tests/unit/canon/reachabilityFromRoot.test.ts` (NOWY) | (b) 297 | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `src/**` — WYŁĄCZNIE poddrzewa dowiedzione jako martwe od korzenia w R1 pozycji (b) | (b) 297 | **★ WĄSKA LICENCJA: wyłącznie USUWANIE**, zero nowej logiki. Poza zakresem: `settings/*` (DAY55), `SuperAdmin/*` (dług decyzyjny, nie usuwasz) | Czerwony kontrakt + brief |
| `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/AssessmentLibraryTab.tsx`, `src/components/assessment/library/__tests__/**`, `tests/components/assessment/library/AssessmentLibraryTab.test.tsx`, `src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts` | (c) 293 | **★ PEŁNA LICENCJA w zakresie Biblioteki metodyk** (patrz `INSTRUKCJA_DYZUR_293.md`) | — |
| `src/components/Interview/**`, `src/components/Interview/__tests__/**` | (d) 292 | **★ PEŁNA LICENCJA w zakresie R3-R6 macierzy akcji** (patrz `INSTRUKCJA_DYZUR_292.md`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md` | (d) 292 | **PEŁNA LICENCJA** — uzupełnienie sekcji „Stan PO" | — |
| `server/src/services/report/acceptedDrdReportModel.ts`, `server/src/services/report/methodSessionReportMetadataService.ts` | (f) 298 | **★ PEŁNA LICENCJA** | — |
| `server/src/routes/method-core.routes.ts` | (f) 298 | **★ WĄSKA LICENCJA: WYŁĄCZNIE podłączenie/wywołanie silnika raportu**, w miejscu i sposobem ustalonym w R4 (po zbadaniu relacji z `assessmentReportContractService`). **ZAKAZ** zmiany istniejących tras poza tym jednym punktem | Czerwony kontrakt + brief |
| `server/migrations/2026110[1-9]*.sql`, `server/migrations/202611[1-4]*.sql` | (f) 298 | **★ PEŁNA LICENCJA, wyłącznie addytywnie**, dla ewentualnej kolumny/flagi metryki badania | — |
| `src/components/MyWork/IdeaTableTool.tsx` i trzy siostrzane narzędzia Idei w `src/components/MyWork/**`, `src/components/MyWork/__tests__/**` | (e) 295 | **★ PEŁNA LICENCJA w zakresie enumeracji kontrolek** (patrz `INSTRUKCJA_DYZUR_295.md`) | — |
| `src/components/Initiatives/**` | (e) 295 (R5) | **★ WĄSKA LICENCJA: wyłącznie ujednolicenie do kanonu `standard/`** (6 bloków podglądu, patrz instrukcja 295 R5) | Czerwony kontrakt + brief |
| `server/src/routes/v8/my-work.routes.ts` | (e) 295 | **★ WĄSKA LICENCJA: wyłącznie ciało odpowiedzi `409 NOTEBOOK_PAGE_CONFLICT`** (dodanie pola, nie zmiana kodu statusu ani logiki blokady) | Czerwony kontrakt + brief |
| `tests/unit/backend/security/**`, `**/*.pg.test.ts` (NOWE) | (f), (e) | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | wszystkie | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | wszystkie | **TYLKO ODCZYT** | Musisz przechodzić zielono, nie zmieniać reguł |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | — | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY322_RESZTA_DOMKNIEC_REPORT.md` | R6 | **JEDYNY nowy raport zbiorczy** (`Z13`) | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis w raporcie z plik:linia |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt 5 instrukcji + historia 3 worktree + plik postępu | TAK | NIE | bazowe | Wszystko przeczytane, plik postępu założony | brak (bez zmian) |
| R1 (b)297 | Martwe od korzenia | TAK | NIE — dowód: `Z12` nie wymienia plików `src/**` jako nietykalnych poza wyjątkami | wg instr. 297 | R1-R6 instrukcji 297 wykonane albo uczciwie opisane jako częściowe | per poddrzewo, patrz instr. 297 |
| R2 (c)293 | Biblioteka metodyk | TAK | NIE | wg instr. 293 | Zastany WIP oceniony i albo dokończony, albo cofnięty z uzasadnieniem; reszta instrukcji 293 wykonana | per pozycja instr. 293 |
| R3 (d)292 | R3-R6 menu Wywiadu + wzmocnienie 4. testu | TAK | NIE | wg instr. 292 + 1 wzmocniona asercja | R3-R6 wykonane, czwarty blok kontraktowy asertuje EFEKT, nie string | per pozycja instr. 292 |
| R4 (f)298 | Silnik raportu — relacja + podłączenie + tenant + flaga | TAK | NIE — dowód: `Z12` nie chroni `method-core.routes.ts` całościowo, tylko punktowo | wg instr. 298 + 1 test tenantowy + 1 test fail-safe | Relacja z istniejącym pipeline'em ustalona i opisana; silnik podłączony pod realną akcję; `save()` broni tenanta W ZAPISIE z transakcją; narrator za flagą OFF | per krok, patrz R4 poniżej |
| R5 (e)295 | Enumeracja kontrolek + 409 + Inicjatywy kanon | TAK | NIE | wg instr. 295 | Enumeracja z asercją efektu na właściwym ekranie; wyścig powtórzony na produkcyjnej trasie; Inicjatywy do kanonu | per pozycja instr. 295 |
| R6 | Raport zbiorczy | NIE | NIE | n/d | Struktura `§R.2`, TWIERDZENIA NIEZWERYFIKOWANE niepuste | `docs(day322): raport` |

> Żadna pozycja nie wymaga zmiany pliku jawnie nietykalnego bez wyjątku wymienionego w `B.1`.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Commity 292 ponad wspólnym przodkiem | 2 | `git -C /private/tmp/cx-day292-wywiad-menu log --oneline 58ef0771d7..HEAD \| wc -l` | TAK |
| 2 | Pliki zmienione w niecommitowanym WIP 293 | 4 + 1 nowy katalog | `git -C /private/tmp/cx-day293-biblioteka diff --stat` | TAK |
| 3 | Wołacze `buildAcceptedDrdReportModel` poza testem/definicją | 0 | `git grep -n 'buildAcceptedDrdReportModel' -- server src scripts \| grep -v __tests__` → 1 wiersz (definicja) | TAK |
| 4 | Wołacze `methodSessionReportMetadataService` poza testem/definicją | 0 | analogicznie | TAK |
| 5 | `initialTool="table"` w ekranach idea-table | 1 (w `idea-table-timeline-stuck.tsx`) | `grep -n initialTool dev-render/screens/idea-table*.tsx` | TAK |
| 6 | Sygnatury kontrolek z efektem dowiedzionym (przed R5) | 12 z 226 (liczba odbiorcy — zmierz swój mianownik na właściwym ekranie) | test enumeracji z instr. 295 R2, uruchomiony na `idea-table-timeline-stuck.tsx` | ★ SPRAWDŹ — poprzedni pomiar mógł stać na złym ekranie (21/14 zamiast 86/54) |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik/katalog | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- |
| 1 | `scripts/dev/reachability-from-root.mjs` | R1 | ZEROWE |
| 2 | `src/components/assessment/**` (w zakresie 293) | R2 | ★★ WYSOKIE — zastany WIP, nie Twój; czytaj przed zapisem |
| 3 | `src/components/Interview/**` | R3 | ŚREDNIE — dzielone z 292's własnym torem, ale to Twój worktree teraz |
| 4 | `server/src/services/report/**`, `server/src/routes/method-core.routes.ts` | R4 | NISKIE |
| 5 | `src/components/MyWork/IdeaTableTool.tsx` i siostrzane, `src/components/Initiatives/**` | R5 | NISKIE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY322_RESZTA_DOMKNIEC_REPORT.md` | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/migrations/2026110*.sql` (NOWY) | R4 | Tylko jeśli R4 ustali, że metryka badania wymaga nowej kolumny |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
public/locales/*/translation.json (poza dopiskami wymuszonymi przez nowe UI) — dyżur 317
scripts/dev/testy-puste-skan.mjs — dyżur 318
src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx — dyżur 323
server/src/middleware/appErrorMapper.ts i trasy wycieków — dyżur 296 (poza zakresem)
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6338 | `lsof -nP -iTCP:6338 -sTCP:LISTEN` → puste |
| Port harnessu | 5478 | `lsof -nP -iTCP:5478 -sTCP:LISTEN` → puste |
| Kontener | `cx-day322-pg` | `docker ps` → brak |
| Baza | `cx322` | n/d przed startem |
| Gałąź | `codex/day322-reszta-domkniecia-20260904` | nie istnieje |
| Worktree nowy | `/private/tmp/cx-day322-reszta-domkniec` | nie istnieje |
| Worktree reużywane | `cx-day292-wywiad-menu`, `cx-day293-biblioteka`, `cx-day297-martwe-od-korzenia` | istnieją, patrz weryfikacja (1) |
| Flagi | narrator LLM (298), default OFF | `grep -rn` nazwy flagi po jej dodaniu → 0 miejsc z `true` na stałe |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
WT="$1"   # /private/tmp/cx-day297-martwe-od-korzenia albo -293/-292/-reszta-domkniec, zależnie od pozycji
cd "$WT"
git diff --name-only --cached | tee /private/tmp/cx-day322-reszta-domkniec-artefakty/staged-$(basename "$WT").txt
grep -iE 'public/locales/|testy-puste-skan|InsightCreatorModal.a11y|appErrorMapper' /private/tmp/cx-day322-reszta-domkniec-artefakty/staged-$(basename "$WT").txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — PIĘĆ INSTRUKCJI I PLIK POSTĘPU

Przeczytaj w całości `INSTRUKCJA_DYZUR_292.md`, `_293.md`, `_295.md`, `_297.md`, `_298.md`.
Odczytaj historię trzech istniejących worktree (komendy weryfikacyjne (1)-(2) w `§0.1`). Załóż
`/private/tmp/cx-day322-postep.md` z pięcioma pozycjami, stan `NIEROZPOCZĘTE`. Aktualizujesz go
**po każdej pozycji**.

Prawo zatrzymania po tej pozycji.

## R1 — (b) 297 MARTWE OD KORZENIA, w `/private/tmp/cx-day297-martwe-od-korzenia`

Wykonaj R1-R6 instrukcji 297 w całości: napisz `scripts/dev/reachability-from-root.mjs`
(narzędzie AST rozumiejące TS/TSX, aliasy `@/`, importy dynamiczne, rejestry po stringu; korzenie
= wejście aplikacji, `dev-render/main.tsx`, testy), porównaj z inwentarzem 238 z poprzedniego
pomiaru per-plik, usuwaj poddrzewa martwe od korzenia (pomijając dług decyzyjny `settings/*`,
`SuperAdmin/*`) jedno poddrzewo = jeden commit, zbuduj cztery tabele („zbudowane niepodłączone",
„test bez produktu", „za flagą", „dług decyzyjny"), postaw bezpiecznik
`tests/unit/canon/reachabilityFromRoot.test.ts` z linią bazową i dowodem na jednym celowo dodanym
martwym pliku.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R2 — (c) 293 BIBLIOTEKA METODYK, w `/private/tmp/cx-day293-biblioteka`

**Zanim cokolwiek zrobisz:** `git diff` w całości, żeby przeczytać zastany niecommitowany WIP
czterech plików. Oceń: czy to poprawna realizacja R1/R2 instrukcji 293 (pomiar biblioteki, sesje
poza biblioteką)? Jeśli TAK — dokończ i commituj z opisem, że kontynuujesz zastany WIP. Jeśli
NIE (błędne, niekompletne w sposób szkodliwy) — opisz dlaczego w raporcie, zabezpiecz kopię
przez `cp` do scratcha (nigdy `git checkout --`/`git reset --hard`), i zacznij od właściwego
miejsca instrukcji 293. Dokończ pozostałe pozycje instrukcji 293 od tego punktu.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R3 — (d) 292 R3-R6 MENU WYWIADU, w `/private/tmp/cx-day292-wywiad-menu`

Wykonaj R3 (Sesje + Szablony), R4 (Skrzynka + Wnioski + Inicjatywy Wywiadu), R5 (dowód — zrzuty
kebaba i podglądu dla 6 typów, light/dark, pl/en, test kontraktowy, lista czekowania część B),
R6 (raport) instrukcji 292 w całości. Dodatkowo: wzmocnij czwarty blok
`interviewActionMatrix.contract.test.tsx` („is consumed by...") z `toContain('interviewActionMeta')`
na asercję EFEKTU — np. renderuj każdy z pięciu komponentów (host kebaba + 4 podglądy), otwórz
menu/pasek akcji i sprawdź, że akcja z macierzy faktycznie wywołuje odpowiadający handler/trasę,
nie tylko że string `interviewActionMeta` występuje w pliku źródłowym. Dowód mutacyjny: usuń
wywołanie handlera z jednego z pięciu plików, pokaż że nowy test czerwienieje; przywróć, pokaż
zielony.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R4 — (f) 298 SILNIK RAPORTU OCENY, w nowym worktree `/private/tmp/cx-day322-reszta-domkniec`

**Krok 1 — ustal relację, nie zakładaj.** Przeczytaj `acceptedDrdReportModel.ts`,
`methodSessionReportMetadataService.ts` i istniejący pipeline w `method-core.routes.ts`
(`assessmentReportContractService.build()` + `buildAssessmentDrdReportSchema()`, trasa
`/sessions/:sessionId/assessment-report.docx`). Odpowiedz pisemnie w raporcie: czy
`acceptedDrdReportModel` ma ZASTĄPIĆ istniejący pipeline, UZUPEŁNIĆ go (np. dodatkowa sekcja
metadanych: zespół doradczy, kalendarz, rekomendacje z `methodSessionReportMetadataService`), czy
to inna funkcja produktowa (np. inny format dokumentu, inny odbiorca). Jeśli po przeczytaniu
kodu wniosek jest inny niż zakładała instrukcja 298 — to jest MERYTORYCZNY wynik, zapisz go
i zaprojektuj podłączenie zgodnie z tym, co znajdziesz.

**Krok 2 — podłącz** zgodnie z ustaloną relacją, tak żeby istniała **realna ścieżka HTTP → silnik
→ odpowiedź**, nie tylko import bez wywołania.

**Krok 3 — warunek tenantowy z transakcją.** `methodSessionReportMetadataService.save()` dziś
sprawdza tenanta dopiero przez `get()` PO `INSERT`, bez transakcji — dowód mutacyjny: usuń warunek
organizacji, pokaż że obcy NADPISUJE wiersz mimo że `save()` i tak zgłasza odmowę (bezpiecznik
nagradza defekt). Naprawa: warunek tenantowy w SAMYM zapisie (`WHERE organization_id = $n` w
`UPDATE`/`INSERT ... ON CONFLICT`), transakcja, test negatywny „właściciel zapisuje / obcy nie
nadpisuje" z dowodem mutacyjnym w obie strony.

**Krok 4 — narrator LLM za flagą.** Nowa flaga, domyślnie OFF (także przy braku zmiennej
środowiskowej), test fail-safe: błąd modelu → raport i tak powstaje, bez sekcji narracyjnej.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R5 — (e) 295 DOWODY MOJEJ PRACY, w tym samym worktree

Wykonaj R1-R6 instrukcji 295 w całości, z dwiema korektami wymuszonymi pomiarem: (1) mianownik
enumeracji kontrolek liczysz na WŁAŚCIWYM ekranie narzędzia tabeli
(`dev-render/screens/idea-table-timeline-stuck.tsx`, `initialTool="table"`), nie na liście Idei —
jeśli to zmienia mianownik z 21/14 na rzędu 86/54, zapisz to wprost i dokończ enumerację na
poprawnym ekranie; (2) dowód wyścigu 409 powtarzasz na produkcyjnej trasie
`server/src/routes/v8/my-work.routes.ts` (kod `NOTEBOOK_PAGE_CONFLICT`), nie na
`notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT`), bo ta druga nie ma frontowego wołacza
i dowód na niej nie mówi nic o produkcie.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R6 — RAPORT ZBIORCZY

Stan każdej z pięciu pozycji (domknięta/częściowa/nierozpoczęta, z powodem), stan pliku postępu,
finalna zawartość czterech tabel z (b), decyzja o relacji dwóch pipeline'ów raportu z (f),
poprawiony mianownik enumeracji z (e), TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „297 i 293 domknięte, 292 rozpoczęte, 298 i 295
nietknięte, plik postępu aktualny" jest pełnowartościowym wynikiem. Zamknięcie w rejestrze
pozycji, której nie domknąłeś w całości, nie jest — rejestr, który kłamie, kosztuje więcej niż
praca, której nie zrobiono.
