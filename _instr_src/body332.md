## Po co ten dyżur istnieje

Dyżur 309 postawił bezpiecznik `noEmptyAssertions.test.ts` i odmówił zgadywania klasy `PUSTY` bez
dowodu mutacyjnego. Odbiorca adwersaryjny (04.09) wykonał pięć mutacji i rozstrzygnął pierwsze
kandydaty, zostawiając w `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` listę „Do następnego dyżuru":
rozbudować skaner o wykrywanie podmiotu-w-pliku-testu, rozstrzygnąć mutacją resztę kandydatów,
usunąć albo naprawić `api-extensions.test.ts`.

★ **Zanim zaplanujesz jakąkolwiek pracę: dwa z tych trzech punktów są już wykonane i scalone do
HEAD.** Dyżur 318 (commit `6539f82a9a` i trzy kolejne) rozbudował skaner o dokładnie tę detekcję
— funkcja `findSelfDefinedSubjects` istnieje, wyjście JSON niesie pola `selfDefinedSubjects` i
`selfDefinedSubjectsWithoutProductImports`, ze zweryfikowanym self-testem na fikstury
`MessageBubble`. `api-extensions.test.ts` jest usunięty. Próg bezpiecznika stoi dziś na
`candidates: 17` (nie 21 — cztery bloki zniknęły razem z usuniętym plikiem). Rejestr dowodów ma
już 9 rozstrzygnięć z 17: 4 `PUSTY` (`scimService`, `contentService`, i DWIE pozycje
`billingCron` — dyżur 318 rozstrzygnął OBIE, nie tylko jedną), 5 `NIE PUSTY`. **Zostaje 8
`NOT_PROVEN`**, każdy z udokumentowaną, uczciwą przyczyną (baseline czerwony, zerwany import,
zależność od żywej sieci zabronionej przez `Z15`, wymóg importu `server/src/index.ts` zabroniony
przez `Z30`/`Z31`).

Realny, jeszcze niewykonany trzon tego dyżuru jest inny niż mógłby sugerować stary rejestr: sam
detektor teraz **realnie liczy** pliki bez importu produktu — wychodzi rzędu 60-70 (nie 13, to
była tylko robocza ekstrapolacja jednego przykładu sprzed zbudowania detektora). **Ta lista nie
jest automatycznym wyrokiem `PUSTY`** — obejmuje zarówno prawdziwe atrapy podszywające się pod
nazwę realnego komponentu (potwierdzony przykład: `tests/components/AIChat/MessageBubble.test.tsx`
deklaruje `const MessageBubble = () => <div data-testid="message-bubble">...</div>` i renderuje
TĘ atrapę, nigdy nie importując `src/components/AIChat/Messages/MessageBubble.tsx`), jak i
legalne wzorce testowe nazwane `Harness`/`Probe`/`TestHarness`, które niczego nie udają. Ktoś
musi tę listę przejrzeć i rozstrzygnąć per plik — to jest praca ręczna, którą detektor celowo
zostawia człowiekowi.

## ★ Zmierz moje liczby sam

Twierdzę: skaner na moim markerze daje `files≈5403-5414`, `blocks≈42513`, `candidates:17`,
`skipped:0`, `gatedFiles:37`; rejestr dowodów ma 9 rozstrzygnięć (4 `PUSTY`, 5 `NIE PUSTY`), 8
`NOT_PROVEN`; `selfDefinedSubjects` niesie rzędu 190 wpisów, z czego rzędu 60-70 bez żadnego
importu z `src`/`server/src`; `MessageBubble.test.tsx` jest w tej liście z
`hasProductImport: false`. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój — zapisz
rozbieżność wprost, w szczególności jeśli różni się od liczb `13`/`21`/`12 pozostałych` z
historycznych dokumentów tego wątku: te liczby są STARE, sprzed scalenia 318.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Licencja | Zastępczy produkt |
| --- | --- | --- |
| `scripts/dev/testy-puste-skan.mjs` | **★ WĄSKA LICENCJA: wyłącznie rozszerzenie raportowania** (np. pole klasyfikacji triage per plik w `selfDefinedSubjects`). **ZAKAZ** przepisywania funkcji `findSelfDefinedSubjects` — ona działa i ma własny self-test | Czerwony kontrakt + brief |
| `tests/unit/config/noEmptyAssertions.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie stała `BASELINE.candidates` — wolno WYŁĄCZNIE obniżyć po realnym usunięciu/naprawie kandydata. **ZAKAZ** obniżania `files`, podnoszenia `candidates`/`skipped` | Czerwony kontrakt + brief |
| `tests/components/AIChat/MessageBubble.test.tsx` | **★ PEŁNA LICENCJA** — import realnego `src/components/AIChat/Messages/MessageBubble.tsx`, usunięcie atrapy lokalnej | — |
| Pliki z listy triage `selfDefinedSubjectsWithoutProductImports`, sklasyfikowane w R1 jako REALNY DEFEKT | **★ WĄSKA LICENCJA: wyłącznie naprawa importu/atrapy tego jednego pliku** | — |
| `server/src/routes/__tests__/table-platform.routes.test.ts`, `tests/components/Initiatives/CandidatesTable.t28.test.tsx`, `tests/integration/ai/ollama.integration.test.ts`, `tests/integration/pmo-project-members.integration.test.ts`, `tests/integration/services/workbook.p23ext.test.ts`, `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx` | **★ WĄSKA LICENCJA: wyłącznie blok `it` z tabeli `B.2` per plik, z dowodem mutacyjnym gdzie to bezpieczne** | Dokumentacja `NOT_PROVEN` z przyczyną, jeśli niebezpieczne |
| Pliki produkcyjne pod ośmioma kandydatami (np. `server/src/routes/table-platform.routes.ts` i analogiczne) | **★ WYŁĄCZNIE JAKO CEL MUTACJI DOWODOWEJ, ZAWSZE COFNIĘTEJ** (`Z32`/`Z27`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md` | **ZAKAZ EDYCJI RĘCZNEJ — WYŁĄCZNIE wyjście generatora**, regenerujesz uruchamiając skaner | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | **★ PEŁNA LICENCJA na DOPISYWANIE** nowej sekcji pod istniejącą treścią. **ZAKAZ kasowania cudzych wierszy** | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, jak obszedłeś to zmiennymi w linii komendy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY332_TESTY_PUSTE_RESZTA_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt rejestru + potwierdzenie stanu scalenia 318 | TAK | NIE | bazowe | 9 komend `§0.1` zmierzone, teza scalenia 318 potwierdzona | `node scripts/dev/testy-puste-skan.mjs` | brak |
| R1 | Triage 64 plików bez importu | TAK | NIE — dowód: `Z12` nie chroni `tests/`/`src/**/__tests__` | 1 nowa tabela | Każdy plik z listy sklasyfikowany REALNY DEFEKT / UZASADNIONY WZORZEC z uzasadnieniem, zapisany w rejestrze dowodów | plik triage w `evidence/day332/triage.md` | `docs(day332): triage 64 plikow bez importu produktu (332 R1)` |
| R2 | Naprawa `MessageBubble.test.tsx` + inne REALNE DEFEKTY z R1 | TAK | NIE | N dowodów mutacyjnych (N = liczba defektów z R1) | Każdy naprawiony plik importuje i renderuje realny komponent; test nadal zielony z realnym komponentem, czerwony gdy realny komponent zepsuty (dowód mutacyjny) | `npx vitest run <plik> --retry=0` przed/po mutacji | `fix(tests): <plik> renderuje realny komponent zamiast atrapy (332 R2)` |
| R3 | Mutacja 8 kandydatów NOT_PROVEN | TAK | NIE, poza wyjątkiem wiersza `Z12` na pliki produkcyjne (mutacja dowodowa, zawsze cofnięta) | do 8 dowodów | Każdy z ośmiu ma albo dowód mutacyjny w obie strony i nową klasę, albo udokumentowaną uczciwą przyczynę `NOT_PROVEN` (Z15/Z30/Z31/brak baseline) | per plik: `npx vitest run <plik> --retry=0` | commit per plik albo grupami pokrewnymi |
| R4 | Raport + regeneracja rejestru generowanego | NIE | NIE | n/d | Struktura `§R.2`, `node scripts/dev/testy-puste-skan.mjs` uruchomiony na końcu (regeneruje `REJESTR_TESTY_PUSTE_20260903.md`), TWIERDZENIA NIEZWERYFIKOWANE niepuste | — | `docs(day332): raport` |

> Żadna pozycja nie wymaga zmiany pliku przekrojowego poza mutacją dowodową (zawsze cofniętą).

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pliki testowe | ≈5403-5414 (rośnie naturalnie, `BASELINE` używa `toBeGreaterThanOrEqual`) | `node scripts/dev/testy-puste-skan.mjs` → `files` | TAK |
| 2 | Kandydaci sieć/baza | 17 (nie 21 — spadło po usunięciu `api-extensions.test.ts` w 318) | jw. → `candidates` | TAK |
| 3 | Już rozstrzygnięci | 9 (4 `PUSTY`, 5 `NIE PUSTY`) | `cat docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | TAK |
| 4 | Pozostali `NOT_PROVEN` | 8 | 17 − 9 | TAK |
| 5 | Pliki `selfDefinedSubjects` (wszystkie) | ≈190 | jw. → `len(selfDefinedSubjects)` | TAK |
| 6 | Pliki bez ŻADNEGO importu produktu (triage) | ≈60-70 (ZMIERZ SWOJĄ — to NIE jest „13" z historycznych dokumentów) | jw. → `selfDefinedSubjectsWithoutProductImports` | TAK — to jest GŁÓWNA pozycja tego dyżuru |
| 7 | Potwierdzony przykład defektu | 1 (`MessageBubble.test.tsx`) | `python3 -c "...filter file contains MessageBubble..."` (patrz `§0.1` komenda 5) | TAK |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `tests/components/AIChat/MessageBubble.test.tsx` | istniejący | R2 | ZEROWE |
| 2 | Pliki triage sklasyfikowane REALNY DEFEKT (liczba nieznana z góry) | istniejące | R2 | NISKIE |
| 3 | Do 8 plików kandydatów `NOT_PROVEN` z `B.2` | istniejące | R3 | NISKIE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | istniejący | R1,R3 | ŚREDNIE — plik ręczny, dopisujesz, nie nadpisujesz |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY332_TESTY_PUSTE_RESZTA_REPORT.md` | NOWY | R4 | ZEROWE |
| 6 | `scripts/dev/testy-puste-skan.mjs` (wąsko, raportowanie) | istniejący | R1 | NISKIE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| Pliki produkcyjne pod 8 kandydatami (np. `server/src/routes/table-platform.routes.ts`) | R3 | WYŁĄCZNIE tymczasowo w trakcie mutacji dowodowej; `git diff` po cofnięciu MUSI być pusty przed commitem |
| `tests/unit/config/noEmptyAssertions.test.ts` | R3 | Tylko jeśli liczba kandydatów spadnie po R3 (nigdy nie podnosisz) |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/Interview/** — dyżur 330
src/components/MyWork/**, server/src/services/report/** — dyżur 331
server/migrations/**, server/scripts/migrationOrdering.ts, tests/unit/backend/schema/** — dyżur 333
docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md (edycja ręczna) — generowany
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6358 | `lsof -nP -iTCP:6358 -sTCP:LISTEN` → puste |
| Port harnessu | 5498 | `lsof -nP -iTCP:5498 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day332-pg` | `docker ps` → brak |
| Nazwa bazy | `cx332` | n/d |
| Gałąź | `codex/day332-testy-puste-reszta-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day332-testy-puste-reszta` | nie istnieje |
| Flagi | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day332-testy-puste-reszta
git diff --name-only --cached | tee /private/tmp/cx-day332-testy-puste-reszta-artefakty/staged.txt
grep -iE 'Interview/|MyWork/|services/report/|migrationOrdering|REJESTR_TESTY_PUSTE_20260903' /private/tmp/cx-day332-testy-puste-reszta-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- server/src/routes/table-platform.routes.ts \
  && echo "★★ SPRAWDZ: czy to mutacja niecofnieta? Jesli TAK — cofnij przed commitem" \
  || echo "produkcja nietknieta OK"
```

---

## R0 — ODCZYT I POTWIERDZENIE STANU SCALENIA

Przeczytaj `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` w całości. Uruchom skaner, zapisz JSON do
artefaktów jako `przed.json`. Potwierdź na SWOIM markerze: `6539f82a9a` jest w historii pliku
skanera, `api-extensions.test.ts` nie istnieje, `BASELINE.candidates=17`, 9 rozstrzygnięć w
rejestrze, 8 `NOT_PROVEN`.

Prawo zatrzymania po tej pozycji.

## R1 — TRIAGE 64 PLIKÓW BEZ IMPORTU PRODUKTU

Dla każdego wpisu w `selfDefinedSubjectsWithoutProductImports` (pełna lista w polu
`selfDefinedSubjects` wyjścia JSON, filtrowana po `hasProductImport === false`): sprawdź, czy
nazwa lokalnie zdefiniowanego podmiotu (np. `MessageBubble`) odpowiada nazwie REALNEGO komponentu
gdzieś w `src/`/`server/src/` (np. `grep -rl "export.*function <Nazwa>\|export const <Nazwa>"
src/ server/src/`). Jeśli TAK i plik renderuje/wywołuje SWOJĄ lokalną definicję zamiast
importować tę realną — klasyfikuj **REALNY DEFEKT** (kształt „biblioteka bez wywołania"
przeniesiony do testów). Jeśli podmiot nazywa się `Harness`/`Probe`/`TestHarness`/`Mock*`/`Stub*`
i nie ma realnego komponentu o tej samej nazwie w produkcie — klasyfikuj **UZASADNIONY WZORZEC**
(legalny test double, nie udaje niczego). Zapisz tabelę: plik · nazwa podmiotu · klasa ·
uzasadnienie, dopisz do `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` pod nową sekcją.

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA REALNYCH DEFEKTÓW

Zacznij od potwierdzonego przykładu: w `MessageBubble.test.tsx` usuń lokalną definicję
`const MessageBubble = () => ...`, zaimportuj realny `src/components/AIChat/Messages/
MessageBubble.tsx`, dostosuj props/render do realnego kontraktu komponentu. Uruchom test — musi
przejść z realnym komponentem. Dowód mutacyjny: zepsuj coś istotnego w realnym `MessageBubble.tsx`
(np. usuń renderowanie treści wiadomości), uruchom test ponownie — musi się zaczerwienić; przywróć
przez `cp` (`Z27`). Powtórz analogicznie dla każdego innego pliku sklasyfikowanego **REALNY
DEFEKT** w R1.

Prawo zatrzymania po tej pozycji.

## R3 — MUTACJA 8 KANDYDATÓW NOT_PROVEN

Dla każdego z ośmiu (`E0001, E0003, E0008, E0009, E0010, E0011, E0013, E0014` — zweryfikuj
dokładne ID we własnym rejestrze, mogą się różnić): sprawdź, czy przyczyna `NOT_PROVEN`
udokumentowana 318 nadal stoi (baseline czerwony z powodu zerwanego importu — spróbuj naprawić
import i dopiero wtedy zmutować; zależność od żywej sieci — `ollama.integration.test.ts` łamie
`Z15`, zostaw `NOT_PROVEN` z tym uzasadnieniem; import `server/src/index.ts` — łamie `Z30`/`Z31`
w pełnym uruchomieniu, sprawdź czy da się wyizolować handler bez pełnego bootstrapu, jeśli nie —
zostaw `NOT_PROVEN`). Tam gdzie da się bezpiecznie odblokować zielony kierunek (np. naprawić
zerwaną ścieżkę importu w `CandidatesTable.t28.test.tsx` albo w `table-platform.routes.test.ts`),
zrób to, a potem wykonaj pełną mutację w obie strony i nadaj klasę `PUSTY`/`NIE PUSTY`. Każde
rozstrzygnięcie (albo utrzymanie `NOT_PROVEN` z przyczyną) dopisz do rejestru dowodów z komendami
i wynikami obu kierunków.

Commit per kandydat albo grupami pokrewnymi (np. cała rodzina `ollama.integration.test.ts` jednym
commitem, jeśli wszystkie trzy zostają `NOT_PROVEN` z tą samą przyczyną).

Prawo zatrzymania po tej pozycji.

## R4 — RAPORT I REGENERACJA REJESTRU GENEROWANEGO

Tabela: kandydat · plik:linia · klasa · dowód (komenda + wynik obu kierunków) · commit. Tabela
triage 64 plików z klasą i uzasadnieniem. Stan naprawy `MessageBubble.test.tsx` i innych realnych
defektów. Na końcu uruchom `node scripts/dev/testy-puste-skan.mjs` jeszcze raz, żeby
`REJESTR_TESTY_PUSTE_20260903.md` odzwierciedlał finalny stan (plik jest generowany — nie
edytujesz go ręcznie, tylko regenerujesz). TWIERDZENIA NIEZWERYFIKOWANE — w szczególności
wszystko, czego triage R1 nie zdążył w pełni pokryć.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobiony (triage kompletny), R2 częściowo (3 z N
defektów naprawione), R3 rozpoczęty (2 z 8 rozstrzygnięte)" jest pełnowartościowym wynikiem.
Przepisanie już istniejącej pracy 318 jako „nowej" jest podstawą odrzucenia raportu.
