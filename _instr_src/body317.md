## Po co ten dyżur istnieje

Dyżur 308 zbudował mianownik uczciwie: 631 kluczy, gdzie wartość polska jest znak w znak
angielska (powyżej 3 znaków), i skrypt `scripts/dev/i18n-pl-audyt.mjs`, który to liczy. Zamiast
zgadywać, które z nich są błędem, dyżur zatrzymał się na heurystyce listy stop-słów — decyzja
uczciwa, bo kontrprzykład „Tempo" (poprawny polski termin identyczny z angielskim) pokazuje, że
prosta reguła „różne znaczy defekt" by się myliła.

Klasyfikacja wykonana przy odbiorze 04.09 poszła dalej: z 631 identycznych **tylko ok. 119
(19%)** to realne defekty wymagające tłumaczenia. Rozkład:

- **512 UZASADNIONYCH** — identyczność poprawna z przyczyny: „Status" (114 kluczy — sama ta
  jedna rodzina to prawie jedna piąta całego mianownika), Format, System, Plan, Problem, Menu,
  Folder, marki (Slack, Excel, Jira), nazwy fontów, skróty branżowe (WACC, EBITDA, MoSCoW),
  placeholdery, strefy czasu, jednostki;
- **106 DEFEKT-PL** — ok. 62 różne napisy do przetłumaczenia: Owner, Workflow, Assessment,
  Insight, Dashboard, Baseline, Framework, Governance, Inbox, Attachments, Reminders, Interview,
  Initiative i dalsze z tej samej rodziny (rzeczowniki interfejsu, które ktoś zostawił po
  angielsku zamiast przetłumaczyć);
- ★ **13 DEFEKT-EN** — rodzina, której instrukcja 308 NIE PRZEWIDZIAŁA i której obecny skrypt
  w ogóle nie liczy: polskie napisy wewnątrz pliku ANGIELSKIEGO. Przykłady zweryfikowane osobiście
  na dzisiejszym markerze: `"scope": "Zakres"`, `"moduleLabel": "Prezentacje"`,
  `"templateNameRequired": "Nazwa szablonu jest wymagana"`, `"askAI": "Zapytaj AI"` — wszystkie
  cztery istnieją dziś w `public/locales/en/translation.json` pod wskazanymi kluczami.

10 z 12 próbkowanych kluczy-defektów ma realnego wołacza w `src/` — to jest dług widoczny
użytkownikowi na ekranie, nie martwy klucz.

**Skrypt dzisiaj policzyłby 578 defektów** (wszystko, co nie trafia w wąską listę 17 stop-słów
`exact` plus kilka wzorców regex) — to jest **zawyżenie ~5×** względem realnych 106. Twoim
zadaniem NIE jest przepisanie 578 wartości. Jest nim dokończenie klasyfikacji semantycznej,
plik po pliku, z odczytem kontekstu wołacza — i osobno, zmierzenie oraz naprawienie rodziny
DEFEKT-EN, która dotąd nie miała żadnego pomiaru.

## ★ Zmierz moje liczby sam

Twierdzę: liście `pl` ok. 34-35 tysięcy, `en` ok. 32-33 tysięcy (mój pomiar 04.09: PL=34310,
EN=32321 — zlecenie z innego pomiaru tego samego dnia podaje 35183/33050; **plik zmienia się
z każdym commitem równoległych dyżurów, licz na SWOIM markerze**); identycznych >3 znaki: 631;
„Status" wśród nich: 114; DEFEKT-PL: rzędu 106 (62 różne napisy); DEFEKT-EN: rzędu 13.
**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**,
> a Twoim produktem jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `public/locales/pl/translation.json` | **★ PEŁNA LICENCJA na WARTOŚCI istniejących kluczy zaklasyfikowanych DEFEKT-PL** + dopisywanie brakujących kluczy. **ZAKAZ kasowania kluczy i ZAKAZ zmiany kluczy zaklasyfikowanych UZASADNIONE** | — |
| `public/locales/en/translation.json` | **★ PEŁNA LICENCJA na WARTOŚCI kluczy zaklasyfikowanych DEFEKT-EN** + dopisywanie brakujących kluczy (parytet z PL w tym samym commicie). **ZAKAZ kasowania kluczy** | — |
| `scripts/dev/i18n-pl-audyt.mjs` | **★ PEŁNA LICENCJA** — rozbudowa o klasyfikację semantyczną i detekcję DEFEKT-EN. Zachowujesz istniejący eksport `flatten`/`justification`/`audit`/`render`/`run` (kompatybilność wsteczna dla ewentualnych importów) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` | **PEŁNA LICENCJA, ale WYŁĄCZNIE jako wyjście generatora** — nie edytujesz ręcznie, tylko regenerujesz uruchamiając rozbudowany skrypt | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| `src/**` (odczyt kontekstu wołacza) | **TYLKO ODCZYT** — czytasz komponent, w którym klucz żyje, żeby ocenić długość napisu i miejsce. **ZAKAZ zmian w `src/**` poza ewentualnym testem regresji z pozycji R4** | Jeśli naprawa wymagałaby zmiany komponentu (np. przycisk za wąski na dłuższy polski napis), wpisujesz to jako `DO DECYZJI WŁAŚCICIELA` z kadrem PRZED/PO i NIE zmieniasz layoutu w tym dyżurze |
| `tests/**` (NOWE pliki), `src/**/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` — dla bezpiecznika regresji z R4 | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: atrapa `react-i18next` w `tests/setup.ts` podmienia `t()` na wartości domyślne z kodu — to jest znana pułapka (patrz `§0.2d`), nie coś do naprawienia tutaj |
| `server/src/**` | **TYLKO ODCZYT — poza zakresem** | Jeśli klucz jest zasilany z odpowiedzi serwera, wypisujesz plik:linia na liście w raporcie i idziesz dalej |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY317_JEZYK_PL_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt rejestru 308 i evidence 03.09 w całości | TAK | NIE — czysty odczyt | bazowe | Przeczytane oba pliki, zanotowane w raporcie | `wc -l docs/…/REJESTR_JEZYK_PL_20260903.md evidence/grafika/i18n-pl-en-20260903.md` | brak (bez zmian) |
| R1 | Klasyfikacja semantyczna 631 (UZASADNIONE/DEFEKT-PL) w skrypcie | TAK | NIE — dowód: `git grep -n 'justification' scripts/dev/i18n-pl-audyt.mjs` | 1 nowy test jednostkowy skryptu | Skrypt klasyfikuje wszystkie 631 wierszy bez ręcznej listy „na twardo" per klucz — reguła generalna (rzeczownik interfejsu z zamkniętej listy ról/pojęć) | `node scripts/dev/i18n-pl-audyt.mjs` → policz DEFEKT w JSON-ie, porównaj z ręczną próbką 20 wierszy | `feat(i18n): klasyfikacja semantyczna 631 identycznych PL/EN (317 R1)` |
| R2 | Naprawa wszystkich DEFEKT-PL z kontekstem | NIE | NIE | n/d (dane, nie kod produkcyjny) | Każdy klucz zaklasyfikowany DEFEKT-PL ma nową wartość PL, przeczytany wołacz w `src/`, liczba liści PL nie spadła | `diff <(jq -S . public/locales/pl/translation.json) …` PRZED/PO — liczba kluczy identyczna lub większa | commit per rodzina tematyczna (np. `fix(i18n): tłumaczy rodzinę Owner/Workflow/Governance (317 R2)`) |
| R3 | Detekcja i naprawa DEFEKT-EN | TAK | NIE | 1 nowy test | Skrypt wykrywa polskie napisy w pliku EN (heurystyka słownikowa, nie tylko diakrytyki — patrz `§0.4` pułapka), wszystkie znalezione mają teraz angielską wartość | `node scripts/dev/i18n-pl-audyt.mjs` → nowe pole `defektEn` w JSON, lista pusta po naprawie | `fix(i18n): 13 polskich napisów w pliku EN (317 R3)` |
| R4 | Bezpiecznik regresji | NIE | NIE | 1 nowy test z podłogą/sufitem | Test czerwienieje, gdy liczba liści PL lub EN **maleje**, albo liczba DEFEKT-PL/DEFEKT-EN **rośnie** ponad nową linię bazową po R2/R3 | `npx vitest run tests/unit/config/i18nParity.test.ts --retry=0` (nowy plik) | `test(i18n): bezpiecznik parytetu liści i klasy DEFEKT (317 R4)` |
| R5 | Raport | NIE | NIE | n/d | Struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `docs(day317): raport jezyk PL` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi „NIE".** Żadna pozycja tego dyżuru nie odpowiada „TAK" — cały zakres mieści się
> w plikach z pełną licencją powyżej.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Liście `pl/translation.json` | 34310 (mój pomiar 04.09; zlecenie: 35183) | `node -e "…pl.size…"` z `§0.1` weryfikacji (1) | TAK — czyta cały plik rekurencyjnie |
| 2 | Liście `en/translation.json` | 32321 (mój pomiar 04.09; zlecenie: 33050) | jak wyżej, `en.size` | TAK |
| 3 | Identyczne PL=EN, >3 znaki | 631 | `node scripts/dev/i18n-pl-audyt.mjs` → pole `identical` | TAK — porównuje każdy klucz obecny w obu plikach |
| 4 | Z tego: rodzina „Status" | 114 | weryfikacja (3) w `§0.1` | TAK — filtruje dokładnie po wartości `Status` |
| 5 | DEFEKT-PL (realne) | ~106 (62 różne napisy) | ręczna klasyfikacja R1, potwierdzona próbką z weryfikacji (4) | TAK, po rozbudowie skryptu w R1 |
| 6 | DEFEKT-EN | ~13 | R3, potwierdzone czterema greppami z weryfikacji (5) | TAK dla próbki; pełna lista wymaga R3 |
| 7 | PL bez EN (osierocone w drugą stronę) | 2005 | `node scripts/dev/i18n-pl-audyt.mjs` → pole `plOnly` | TAK — poza zakresem naprawy tego dyżuru, tylko odnotuj |

**Reguła kontrolna:** każdy wiersz masz obowiązek uruchomić na swoim markerze przed wydaniem
raportu. Rozbieżność z liczbą w tej tabeli nie jest błędem — jest wynikiem; zapisujesz go.

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `public/locales/pl/translation.json` | istniejący | R2 | ★★ WYSOKIE — plik dzielony ze WSZYSTKIMI dyżurami tej paczki i wcześniejszych (293, 296 itd. też mogą dopisywać klucze); commituj często, małymi krokami, `git pull --rebase` jest zakazany (`Z3`) — zamiast tego rozwiązujesz konflikt merge ręcznie przy scaleniu przez nadzorcę |
| 2 | `public/locales/en/translation.json` | istniejący | R3 | ★★ WYSOKIE, jak wyżej |
| 3 | `scripts/dev/i18n-pl-audyt.mjs` | istniejący | R1, R3 | ŚREDNIE — plik własny dyżuru 308, mało prawdopodobne żeby ktoś inny go dziś dotykał |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` | istniejący (generowany) | R1, R3 | ZEROWE — regenerujesz z własnego skryptu |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md` | NOWY | R3 | ZEROWE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY317_JEZYK_PL_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `tests/unit/config/i18nParity.test.ts` (NOWY) | R4 | Tylko jeśli R1-R3 zakończone i masz nową linię bazową do zaszycia |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/** — cała rodzina backendu, poza zakresem
src/** poza tests/__tests__ nowych plików — żadnego komponentu nie przepisujesz
scripts/dev/testy-puste-skan.mjs, scripts/dev/reachability-from-root.mjs — dyżury 318/322
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6333 | `lsof -nP -iTCP:6333 -sTCP:LISTEN` → puste (nie jest używany — dyżur i tak nie odpala bazy) |
| Port harnessu | 5473 | `lsof -nP -iTCP:5473 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day317-pg` | `docker ps --format '{{.Names}}'` → brak (nieużywany w praktyce) |
| Nazwa bazy | `cx317` | n/d — dyżur nie tworzy bazy |
| Gałąź | `codex/day317-jezyk-pl-20260904` | nie istnieje na `github-backup` (sprawdź `git ls-remote`) |
| Worktree | `/private/tmp/cx-day317-jezyk-pl` | nie istnieje |
| Flagi funkcyjne | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day317-jezyk-pl
git diff --name-only --cached | tee /private/tmp/cx-day317-jezyk-pl-artefakty/staged.txt
grep -iE 'server/src/|scripts/dev/testy-puste-skan|scripts/dev/reachability-from-root' /private/tmp/cx-day317-jezyk-pl-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## §0.4 — pułapka DEFEKT-EN: diakrytyki NIE WYSTARCZĄ

Pierwszy odruch — szukać polskich znaków (ą,ć,ę,ł,ń,ó,ś,ź,ż) w pliku EN — łapie tylko 2 fałszywe
trafienia (nazwiska własne: „Dr. Piotr Wiśniewski", „Paweł Bochniarz") i **przepuszcza wszystkie
cztery przykłady z tytułu tej instrukcji** — „Zakres", „Prezentacje", „Nazwa szablonu jest
wymagana", „Zapytaj AI" nie mają ani jednej litery z ogonkiem. Heurystyka musi być **słownikowa**:
lista częstych polskich słów/końcówek („jest", „nie", „wymagana", "wymagane", "zakres", "zapytaj",
"proszę", "błąd", "ustawienia", odmiany przez przypadki charakterystyczne dla polskiego) plus
**ręczne potwierdzenie każdego trafienia** — heurystyka słownikowa też da fałszywe alarmy
(np. angielskie słowo przypadkiem zawierające polski rdzeń). Nie automatyzuj naprawy: każde
trafienie czytasz i albo tłumaczysz na EN, albo odrzucasz jako fałszywy alarm z uzasadnieniem
w rejestrze.

---

## R0 — ODCZYT

Przeczytaj `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` i
`evidence/grafika/i18n-pl-en-20260903.md` w całości. Zmierz mianowniki z tabeli `B.3` na swoim
markerze.

Prawo zatrzymania po tej pozycji.

## R1 — KLASYFIKACJA SEMANTYCZNA 631

Rozbuduj `justification()` w `scripts/dev/i18n-pl-audyt.mjs` tak, żeby rozstrzygała **regułą
generalną**, nie listą 631 pojedynczych kluczy na twardo: rozpoznaj kategorie UZASADNIONE
(rzeczowniki-etykiety statusu/formatu/systemu, marki, skróty branżowe, jednostki, placeholdery,
strefy czasu — rozszerz istniejącą mapę `exact` i wzorce regex) i zostaw wszystko inne jako
kandydata DEFEKT-PL do ręcznego przeglądu. Wynik: nowe pole w JSON-ie wyjściowym rozróżniające
`UZASADNIONE`/`DEFEKT-PL`, z liczbami bliskimi 512/106 — **Twój pomiar rozstrzyga, nie te
liczby**. Dodaj test jednostkowy sprawdzający, że znane przykłady (Status→UZASADNIONE,
Owner→DEFEKT-PL, Tempo→UZASADNIONE) klasyfikują się poprawnie.

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA DEFEKT-PL

Dla każdego klucza zaklasyfikowanego DEFEKT-PL: `grep -rn "t('<klucz>'" src/` (albo
`t("<klucz>"`, zależnie od cudzysłowu), przeczytaj komponent, oceń długość dostępnego miejsca,
wpisz polskie tłumaczenie, które NIE jest kalką z angielskiego. Commit per rodzina tematyczna
(np. rodzina „Owner/Workflow/Governance" jednym commitem, rodzina „Insight/Dashboard/Baseline"
kolejnym) — nie jeden gigantyczny commit na 106 kluczy. Zmierz liczbę liści PL przed i po każdym
commicie — nie może spaść.

Jeśli klucz nie ma żadnego wołacza w `src/` (osierocony), wpisz go do raportu jako „defekt bez
wołacza" i przetłumacz mimo to (dane słownika mają być poprawne niezależnie od tego, czy dziś są
używane) — ale NIE licz go do „widocznego dla użytkownika długu".

Prawo zatrzymania po tej pozycji.

## R3 — DETEKCJA I NAPRAWA DEFEKT-EN

Dodaj do skryptu wykrywanie polskich napisów w `en/translation.json` metodą słownikową opisaną
w `§0.4` powyżej. Uruchom, przejrzyj KAŻDE trafienie ręcznie, przetłumacz prawdziwe defekty na
angielski, odrzuć fałszywe alarmy z uzasadnieniem. Zapisz kompletną listę (nawet jeśli finalnie
mniejszą lub większą niż 13) do nowego `REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md`.

Prawo zatrzymania po tej pozycji.

## R4 — BEZPIECZNIK REGRESJI

Nowy test w `tests/unit/config/i18nParity.test.ts`: uruchamia rozbudowany
`scripts/dev/i18n-pl-audyt.mjs`, zapisuje linię bazową (liście PL, liście EN, liczba DEFEKT-PL,
liczba DEFEKT-EN) **po Twoich naprawach z R2/R3**, i czerwienieje, gdy w przyszłości liście PL
lub EN **zmaleją** poniżej tej linii, albo liczba DEFEKT-PL/DEFEKT-EN **wzrośnie** powyżej niej.
Wzoruj podłogę/sufit na `tests/unit/config/noEmptyAssertions.test.ts` (`toBeGreaterThanOrEqual`
dla liści, `toBeLessThanOrEqual` dla defektów) — to jest już sprawdzony wzorzec w tym repo, nie
projektujesz go od nowa.

Prawo zatrzymania po tej pozycji.

## R5 — RAPORT

Co domknięte, co nie, finalne liczby (liście PL/EN, DEFEKT-PL naprawione, DEFEKT-EN naprawione),
lista kluczy odrzuconych jako fałszywe alarmy z uzasadnieniem, TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 i R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte" jest
pełnowartościowym wynikiem, o ile liczba liści nie spadła i żaden commit nie jest niekompletny.
