## Po co ten dyżur istnieje

Dyżur 309 zbudował `scripts/dev/testy-puste-skan.mjs` i uczciwie odmówił zgadywania: skaner
**nigdy** nadaje klasę `PUSTY` z samego tekstu, tylko z dowodu mutacyjnego, którego sam wykonać
nie może. Postawił też bezpiecznik podłogowy (`tests/unit/config/noEmptyAssertions.test.ts`),
który dziś trzyma: pliki testowe ≥ 5399, kandydaci ≤ 21, pominięte = 0.

Odbiorca adwersaryjny (04.09) wykonał 5 mutacji funkcji produkcyjnych i rozstrzygnął **2 z 21**
jako `PUSTY` (`scimService.test.ts` — 12/12 PASS nawet po `SCIMService.ts → export default {}`;
`contentService.test.ts` „should return dashboard data" — PASS nawet gdy funkcja zwraca
`{-999,-999}`). Trzy pozostałe zmutowane kandydaci (rodziny `billingCron`, `siemService`,
`chatPolicyGateway`) **zaczerwieniły się** po mutacji — NIE są puste, choć `chatPolicyGateway`
broni wyłącznie literału (produkcja bezwarunkowo dopisuje dwa napisy do listy, nie ma tam
egzekucji do zmutowania — słaby, ale nie pusty). **Ekstrapolacja odbiorcy: rzędu 8 pustych
z 21 — to jest SZACUNEK, nie wynik.** Twoim zadaniem jest zmierzyć resztę, nie potwierdzić tę
liczbę.

★ **Główna pozycja tego dyżuru jest inna: ślepa plama skanera.** Skaner wymaga sygnału
sieci/bazy w treści bloku `it` (regex `fetch|axios|request|supertest|db...|query|execute`), więc
**nie widzi w ogóle** testów, które z produktem nie rozmawiają. Zmierzone: **267 plików / 1766
bloków** bez żadnego wiązania z produktem, w tym **13 plików definiujących PODMIOT TESTU
wewnątrz pliku testu**. Sprawdzony na tym markerze przykład:
`tests/components/AIChat/MessageBubble.test.tsx` deklaruje
`const MessageBubble = () => <div data-testid="message-bubble">Message Bubble</div>;` i renderuje
TĘ atrapę — plik nigdy nie importuje prawdziwego
`src/components/AIChat/Messages/MessageBubble.tsx`. Test przechodzi niezależnie od tego, co robi
produkt: to jest kształt „biblioteka bez wywołania" przeniesiony do samych testów.

Osobno: `tests/unit/services/api-extensions.test.ts` testuje moduł, którego w repo **nie ma**
(`grep -rli 'apiExtensions\|api.extensions' src server` zwraca pustkę) — trzy bloki `it` mockują
`global.fetch` i asertują wyłącznie `expect(fetch).toBeDefined()`, z komentarzem w kodzie „This
would be tested with actual API extension implementation. For now, we verify the pattern
exists." Nie ma tu nic do naprawienia mutacją — nie ma produktu pod tym testem.

## ★ Zmierz moje liczby sam

Twierdzę: dziś skaner liczy 5404 pliki (podłoga bezpiecznika: 5399), 42477 bloków, 21
kandydatów, 0 pominiętych. 5 z 21 już rozstrzygniętych (2 PUSTE, 3 NIE). Ślepa plama: 267/1766,
w tym 13 plików z podmiotem zdefiniowanym lokalnie. **Jeśli Twój pomiar przeczy liczbie podanej
w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**,
> a Twoim produktem jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `scripts/dev/testy-puste-skan.mjs` | **★ PEŁNA LICENCJA** — rozbudowa o detekcję podmiotu zdefiniowanego w pliku testu. Zachowujesz istniejące pola wyjścia JSON (`files`,`blocks`,`candidates`,`classes`,`skipped`,`gatedFiles`) i dodajesz nowe, nie usuwasz starych | — |
| `tests/unit/config/noEmptyAssertions.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie stała `BASELINE` — wolno obniżyć `candidates`/podnieść `files`, **ZAKAZ** obniżania `files` albo podnoszenia `candidates`/`skipped` | Czerwony kontrakt + brief w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md` | **PEŁNA LICENCJA, ale WYŁĄCZNIE jako wyjście generatora** — regenerujesz uruchamiając skaner, nie edytujesz ręcznie (i tak zniknie przy następnym przebiegu) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | **★ PEŁNA LICENCJA na DOPISYWANIE** pod istniejącą tabelą pięciu rozstrzygnięć. **ZAKAZ kasowania cudzych wierszy** | — |
| `tests/components/AIChat/MessageBubble.test.tsx`, `tests/unit/services/scimService.test.ts`, `tests/backend/contentService.test.ts`, `server/src/routes/__tests__/table-platform.routes.test.ts`, `server/src/routes/v8/__tests__/help.routes.test.ts`, `server/src/services/ai/__tests__/chatPolicyGateway.retrieval.test.ts`, `server/src/services/v8/__tests__/governedRetrievalService.test.ts`, `tests/components/Initiatives/CandidatesTable.t28.test.tsx`, `tests/integration/ai/ollama.integration.test.ts`, `tests/integration/mywork/my-work.convert.contract.test.ts`, `tests/integration/pmo-project-members.integration.test.ts`, `tests/integration/services/workbook.p23ext.test.ts`, `tests/unit/backend/aiContextBuilder.test.ts`, `tests/unit/backend/cron/billingCron.test.ts`, `tests/unit/backend/siemService.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie wzmocnienie/naprawa bloku `it` wymienionego w tabeli `B.2` per plik, z dowodem mutacyjnym. **ZAKAZ przepisywania innych bloków w tym samym pliku** | — |
| `tests/unit/services/api-extensions.test.ts` | **★ PEŁNA LICENCJA — WŁĄCZNIE Z USUNIĘCIEM CAŁEGO PLIKU** (R3), bo nie testuje żadnego istniejącego modułu | — |
| `server/src/cron/BillingCron.ts`, `server/src/services/siemService.ts`, `server/src/services/ai/chatPolicyGateway.ts` i inne pliki produkcyjne pod kandydatami z `B.2` | **★ WYŁĄCZNIE JAKO CEL MUTACJI DOWODOWEJ, ZAWSZE COFNIĘTEJ** (`Z32`, `Z27` — kopia przez `cp`, nigdy `git stash`). **ZAKAZ pozostawienia mutacji w kodzie po zakończeniu dowodu** | Jeśli produkt wymaga NAPRAWY (nie tylko dowodu), wpisz `DO DECYZJI WŁAŚCICIELA` z opisem i promieniem, nie zmieniaj bez jawnej zgody |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, co blokuje pomiar i jak obszedłeś to zmiennymi w linii komendy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY318_TESTY_PUSTE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt obu rejestrów | TAK | NIE | bazowe | Przeczytane, mianowniki zmierzone | `node scripts/dev/testy-puste-skan.mjs` | brak |
| R1 | Detekcja podmiotu-w-pliku-testu | TAK | NIE — dowód: `git grep -n 'function visit' scripts/dev/testy-puste-skan.mjs` | 1 nowy test skryptu | Skaner ma nową funkcję/pole wykrywające deklarację `const/function/class <Pascal>` w pliku testu, użytą jako JSX/wywołanie, bez importu tego identyfikatora z `src`/`server`. `MessageBubble.test.tsx` trafia na tę listę | `node scripts/dev/testy-puste-skan.mjs` → nowe pole np. `selfDefinedSubjects` zawiera ten plik | `feat(testy-puste): detekcja podmiotu zdefiniowanego w pliku testu (318 R1)` |
| R2 | Mutacja pozostałych 14 kandydatów sieć/baza | TAK | NIE, poza wyjątkiem wiersza `Z12` na pliki produkcyjne (mutacja dowodowa, zawsze cofnięta) | 14 dowodów mutacyjnych | Każdy kandydat E0001-E0021 poza już rozstrzygniętymi (E0021,E0007,E0005,E0018 i jedną z dwóch pozycji billingCron) ma wpis w `REJESTR_..._DOWODY` z klasą `PUSTY`/`NIE PUSTY` i komendami obu kierunków | per plik: `npx vitest run <plik> --retry=0` przed/po mutacji | commit per kandydat albo per plik, np. `test(day318): rozstrzyga E0003 table-platform.routes (NIE PUSTY)` |
| R3 | `api-extensions.test.ts` | NIE | NIE | n/d | Plik usunięty (preferowane, bo brak modułu) ALBO przepisany na test realnego modułu, jeśli taki się znajdzie w R0-R2 | `ls tests/unit/services/api-extensions.test.ts` → brak (po usunięciu) | `chore(day318): usuwa test bez produktu — api-extensions.test.ts (318 R3)` |
| R4 | Aktualizacja progu bezpiecznika | NIE | NIE — dowód: wiersz `B.1` | n/d | `BASELINE.candidates` w `noEmptyAssertions.test.ts` odzwierciedla nową, NIŻSZĄ liczbę kandydatów (po R3 spadnie co najmniej o 2) | `npx vitest run tests/unit/config/noEmptyAssertions.test.ts --retry=0` | `chore(day318): obniża podłogę candidates po usunięciu api-extensions (318 R4)` |
| R5 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `docs(day318): raport` |

> Żadna pozycja nie wymaga zmiany pliku przekrojowego poza mutacją dowodową (zawsze cofniętą)
> produkcyjnych plików wskazanych w `B.1` — co jest jawnie dozwolone tym samym wierszem.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pliki testowe | 5404 (mój pomiar 04.09) | `node scripts/dev/testy-puste-skan.mjs` → `files` | TAK |
| 2 | Bloki `it/test` | 42477 | jw. → `blocks` | TAK |
| 3 | Kandydaci sieć/baza | 21 | jw. → `candidates` | TAK |
| 4 | Już rozstrzygnięci (PUSTY) | 2 (`scimService`, `contentService`) | `cat REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | TAK — ręcznie potwierdzone mutacją |
| 5 | Już rozstrzygnięci (NIE PUSTY) | 3 (`billingCron`\*, `siemService`, `chatPolicyGateway`) — \*jedna z dwóch pozycji billingCron | jw. | TAK, z zastrzeżeniem — sprawdź KTÓRA pozycja billingCron |
| 6 | Pozostali do rozstrzygnięcia | 16 (14 mutacją + 2 przez usunięcie `api-extensions`) | 21 − 5 | TAK |
| 7 | Pliki bez sygnału produktu (ślepa plama) | 267 / 1766 bloków | do zbudowania w R1 — dziś brak komendy, bo detekcja nie istnieje | NIE jeszcze — to jest właśnie luka, którą R1 zamyka |
| 8 | Pliki z podmiotem zdefiniowanym lokalnie | 13 | do zbudowania w R1; przykład potwierdzony ręcznie: `tests/components/AIChat/MessageBubble.test.tsx` | Częściowo — jeden przykład potwierdzony, reszta wymaga R1 |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `scripts/dev/testy-puste-skan.mjs` | istniejący | R1 | ZEROWE — plik własny 309 |
| 2 | `tests/unit/config/noEmptyAssertions.test.ts` | istniejący | R4 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | istniejący | R2 | ŚREDNIE — plik ręczny, mógł go dotknąć inny dyżur równolegle; dopisujesz, nie nadpisujesz |
| 4 | 14 plików testowych z tabeli `B.2` | istniejące | R2 | NISKIE |
| 5 | `tests/unit/services/api-extensions.test.ts` | istniejący (usuwany) | R3 | ZEROWE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY318_TESTY_PUSTE_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/cron/BillingCron.ts`, `server/src/services/siemService.ts`, itd. | R2 | WYŁĄCZNIE tymczasowo, w trakcie mutacji dowodowej; `git diff` po cofnięciu MUSI być pusty przed commitem |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
public/locales/*/translation.json — dyżur 317
scripts/dev/reachability-from-root.mjs, worktree cx-day292/293/297 — dyżur 322
src/components/Interview/**, src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx — dyżur 323
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6334 | `lsof -nP -iTCP:6334 -sTCP:LISTEN` → puste (nieużywany w praktyce) |
| Port harnessu | 5474 | `lsof -nP -iTCP:5474 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day318-pg` | `docker ps` → brak |
| Nazwa bazy | `cx318` | n/d |
| Gałąź | `codex/day318-testy-puste-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day318-testy-puste` | nie istnieje |
| Flagi | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day318-testy-puste
git diff --name-only --cached | tee /private/tmp/cx-day318-testy-puste-artefakty/staged.txt
grep -iE 'public/locales/|reachability-from-root|InsightCreatorModal' /private/tmp/cx-day318-testy-puste-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- server/src/cron/BillingCron.ts server/src/services/siemService.ts server/src/services/ai/chatPolicyGateway.ts \
  && echo "★★ SPRAWDZ: czy to mutacja niecofnieta? Jesli TAK — cofnij przed commitem" \
  || echo "produkcja nietknieta OK"
```

---

## R0 — ODCZYT

Przeczytaj `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` i `REJESTR_TESTY_PUSTE_20260903.md`
w całości. Uruchom skaner na swoim markerze i zapisz JSON do artefaktów jako `przed.json`.

Prawo zatrzymania po tej pozycji.

## R1 — DETEKCJA PODMIOTU ZDEFINIOWANEGO W PLIKU TESTU

Rozbuduj `scripts/dev/testy-puste-skan.mjs`: dla każdego pliku testowego znajdź identyfikatory
zaczynające się wielką literą zadeklarowane na najwyższym poziomie modułu (`const X = (...) =>`,
`function X(...)`, `class X`) i sprawdź dwa warunki: (a) identyfikator jest użyty jako JSX
(`<X` lub `<X />`) albo wywołany bezpośrednio gdzieś dalej w pliku, (b) identyfikator o tej samej
nazwie NIE jest importowany z `@/` ani ze ścieżki względnej wskazującej na `src/` lub
`server/src/`. Plik spełniający oba warunki trafia na nową listę (np. pole `selfDefinedSubjects`
w JSON-ie wyjściowym, osobna sekcja w wygenerowanym rejestrze). Zweryfikuj na
`tests/components/AIChat/MessageBubble.test.tsx` — musi się pojawić na liście. Napisz test
jednostkowy skryptu z tym przykładem jako fixture.

★ To jest NOWA lista do przeglądu, nie automatyczny wyrok `PUSTY` — 13 (albo ile realnie wyjdzie)
plików wymaga ręcznego przejrzenia w kolejnym dyżurze (poza zakresem R2-R4 tego dyżuru, chyba że
starczy czasu po rdzeniu).

Prawo zatrzymania po tej pozycji.

## R2 — MUTACJA POZOSTAŁYCH KANDYDATÓW

Dla każdego z 14 kandydatów spoza już rozstrzygniętych pięciu (patrz `B.3` wiersz 6, lista
plików w `B.1`): znajdź funkcję produkcyjną, którą blok `it` rzekomo sprawdza, zmutuj ją tak,
żeby zwracała ewidentnie złą wartość, uruchom test — jeśli **czerwienieje**, kandydat NIE jest
pusty (dopisz do rejestru z komendami obu kierunków); jeśli **zostaje zielony**, kandydat jest
`PUSTY` (napraw asercję albo usuń blok, z dowodem). Zawsze cofnij mutację przez `cp` (`Z27`)
i potwierdź `git diff --check` pusty na pliku produkcyjnym przed commitem. Ustal też, którą
z dwóch pozycji `billingCron` (linia 111 czy 119) zmutował odbiorca — druga zostaje w całości
Twoim zadaniem niezależnie od wyniku pierwszej.

Commit per kandydat albo grupami max 3-4 pokrewnych (np. cała rodzina `ollama.integration.test.ts`
jednym commitem).

Prawo zatrzymania po tej pozycji.

## R3 — `api-extensions.test.ts`

Potwierdź brak modułu produkcyjnego (komenda weryfikacyjna (5) w `§0.1`). Usuń plik. Jeśli
w trakcie R0-R2 znajdziesz realny moduł, do którego te trzy bloki powinny się odnosić — napraw
zamiast usuwać, z realnymi importami i asercjami efektu. Domyślnie: usunięcie.

Prawo zatrzymania po tej pozycji.

## R4 — AKTUALIZACJA PROGU

Po R2-R3 policz nową liczbę kandydatów. Jeśli spadła (powinna spaść co najmniej o 2 z powodu
R3), obniż `BASELINE.candidates` w `tests/unit/config/noEmptyAssertions.test.ts` do nowej
wartości. **Nigdy nie podnosisz** tego progu.

Prawo zatrzymania po tej pozycji.

## R5 — RAPORT

Tabela: kandydat · plik:linia · klasa (PUSTY/NIE PUSTY) · dowód (komenda + wynik obu kierunków)
· commit. Stan detekcji podmiotu-w-pliku (ile plików realnie wyszło, nie tylko przykład).
Stan `api-extensions.test.ts`. Nowa wartość progu. TWIERDZENIA NIEZWERYFIKOWANE — w szczególności
267/1766 ślepej plamy, jeśli R1 nie doprowadzi do pełnego pomiaru tej liczby.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna.
