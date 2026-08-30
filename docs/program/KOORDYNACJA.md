---
doc_id: koordynacja-dwoch-torow
status: canonical
truth_type: process
established: 2026-08-30
---

# Koordynacja dwóch torów — grafika i funkcje

Dwa czaty pracują równolegle nad tym samym repozytorium. **Ten plik jest ich
jedynym punktem styku.** Rozmowa nie jest nośnikiem — jeśli czegoś tu nie ma,
drugi tor o tym nie wie.

## Podział — nienaruszalny

| | Tor GRAFIKA | Tor FUNKCJE |
| --- | --- | --- |
| Co robi | wygląd ekranów, zgodność z kanonem, zrzuty, odbiory wizualne | mechanika, dane, trasy, bezpieczeństwo, dyżury Codexa |
| Kto wykonuje | nadzorca sam + wewnętrzni robotnicy | Codex (duże klocki) + wewnętrzni robotnicy (dokończenia) |
| Rejestr | `grafika/REJESTR_EKRANOW.md` | `funkcje/REJESTR_WDROZENIA.md` |

**Grafika nie zleca Codexowi. Funkcje nie przemalowują ekranów.**

## Zasady styku

1. **Jedna linia integracyjna** — `codex/m03-admin-20260824`. Oba tory scalają tam,
   przez `merge`, nigdy `force`.
2. **Kolizja plikowa** — tor, który dotyka pliku spoza swojego zakresu, **wpisuje to
   tutaj przed dotknięciem**. Bez wpisu = naruszenie rozłączności.
3. **Ekran zależny od funkcji** — grafika nie maluje ekranu, pod którym funkcja nie
   działa; zgłasza go tutaj jako blokadę i idzie dalej.
4. **Funkcja zmieniająca wygląd** — tor funkcji nie zmienia wyglądu przy okazji;
   zgłasza tutaj i zostawia grafice.

## Tablica bieżąca

### Blokady zgłoszone przez grafikę do toru funkcji

| Data | Co | Dlaczego to nie jest sprawa wyglądu |
| --- | --- | --- |
| 2026-08-30 | **Karta inicjatywy nie ma przycisku głównego.** Przyczyna: `statusActions` twardo `[]` (`InitiativeDocumentView.tsx`, `DEC-104`) — ścieżka zapisu statusu rzuca wyjątkiem dla każdego statusu docelowego. | Wyłączenie było słuszne, ale znaczy, że **inicjatywy nie da się popchnąć do przodu z jej własnego ekranu**. To dziura funkcjonalna. |
| 2026-08-30 | **Trzy ekrany Finansów pokazują duże kwoty bez waluty.** Kontrakt danych (`ValuationResultsDto`, propsy paneli wartości) nie niesie pola waluty. | Zmyślenie waluty byłoby gorsze niż jej brak. Wymaga uzupełnienia kontraktu danych. |
| 2026-08-30 | **Wartości wskaźników w Analizie bez jednostki** (0,12 / 0,35 zamiast procentów). Brak metadanych jednostki w danych. | Jak wyżej — brak w kontrakcie, nie w wyglądzie. |
| 2026-08-30 | **Harness nie ma atrapy jednego wywołania Bazy porównania** — ekran zawsze wpada w błąd, więc jego treści nie da się odebrać wizualnie. | Uzupełnienie atrapy to praca po stronie danych. |

### Blokady zgłoszone przez funkcje do toru grafiki

**2026-08-30 · dyżur 135 — panele wyceny finansowej.** Tor funkcji podpina 19 gotowych
paneli z `src/components/Economics/panels/` do trasy Finansów **za flagą domyślnie
wyłączoną** i buduje harness w `dev-render/screens/`. Instrukcja zawiera **twardy zakaz
projektowania wyglądu** — panele mają wyglądać dokładnie tak, jak dziś w harnessie.

**Co z tego wynika dla grafiki:** po zamknięciu dyżuru 135 powstanie komplet ekranów
gotowych do zrzutu bez logowania i bez żywej bazy. To jest krok (b) reguły 7 — materiał
do odbioru wizualnego. **Odbiór i ewentualna zmiana wyglądu tych paneli należy do
toru grafiki, nie do funkcji.**

**2026-08-30 · dyżur 134 — most inicjatyw. BLOKADA WŁĄCZENIA.** Tor funkcji podpiął
most za flagą `VITE_INITIATIVE_BRIDGE` (domyślnie OFF). Operacja pyta użytkownika
o dwa identyfikatory przez **surowe `window.prompt`** i potwierdza przez
`window.confirm`. Przycisk używa klas standardu, ale sama interakcja nie jest
powierzchnią produktu.

**Czego potrzebuje tor funkcji od grafiki:** zastąpienia dwóch okien przeglądarki
powierzchnią produktu — wybór rekordu z listy zamiast wpisywania identyfikatora
z pamięci. **Do tego czasu flagi nie wolno włączyć nigdzie** (reguła 7: właściciel
nigdy nie jest pierwszym testerem wizualnym).

**Uwaga o zakresie:** most adoptuje wyłącznie inicjatywy mające zaakceptowanego
kandydata SWOT z zatwierdzonym wynikiem narzędzia. Ekran nie może obiecywać,
że przeniesie dowolny rekord.

### Pliki zajęte w tej chwili
| Plik / katalog | Tor | Od kiedy |
| --- | --- | --- |
| `docs/program/grafika/**` | grafika | 2026-08-30 |
| `docs/program/funkcje/**` | funkcje | 2026-08-30 |
| `src/components/Economics/**` · `dev-render/screens/**` | funkcje (dyżur 135, do zamknięcia) | 2026-08-30 |
| `src/components/MyWork/shared/**` · `TaskDetailView` · `DecisionDetailView` | funkcje (dyżur 133) | 2026-08-30 |
| `src/components/Initiatives/InitiativesHub.tsx` | funkcje (dyżur 134) | 2026-08-30 |

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: kanon dat napisany i nieużyty

**Pomiar, nie hipoteza.** `src/utils/listDateFormat.ts` powstał 27.07 po przeglądzie
128 zrzutów. Jego własny nagłówek nazywa przyczynę: *270 wywołań
`toLocaleDateString()` bez argumentu* — taki zapis bierze format daty z przeglądarki,
a nie z języka konta.

**Stan na dziś (zmierzony `grep`, 30.08):**

| | |
| --- | --- |
| Plików, które używają kanonu | **21** |
| Plików, które go omijają | **198** |
| Wywołań bez jawnego locale | **254** (było 270) |

W miesiąc od napisania kanonu przeszło na niego **16 wywołań z 270**. Kanon istnieje,
narzędzie działa, nikt go nie wpiął.

**Czego to dotyczy w praktyce:** użytkownika, którego przeglądarka mówi innym językiem
niż jego konto — polski konsultant na angielskim systemie zobaczy `8/13/2026` w polskim
interfejsie. Największe skupiska: panel nadzorcy (17 plików), Ustawienia (14),
Moja praca (11+7), Wyniki (9), Wywiad (6).

**Czego NIE zrobiłem i dlaczego:** nie robię masowej podmiany 254 miejsc. `CLAUDE.md`
ostrzega wprost, że masowa operacja tego typu raz już zniszczyła wydane instrukcje.
To zadanie na osobny dyżur z listą plików i odbiorem, nie poprawka przy okazji.

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: „Zadanie ukończone 0/8"

**Co widać.** Przy **każdym ponownym otwarciu** zapisanego arkusza, tabeli albo
prezentacji nagłówek pokazuje zielony ptaszek i napis „Zadanie ukończone" —
a obok licznik **0/8 kroków**. Zielone „gotowe" stoi obok zera.

**Gdzie.** `src/components/AIChat/KimiWorkspace/ExceleView.tsx:312`
`effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun)`
— otwarcie istniejącego pliku ustawia „ukończone", ale `completedSteps/totalSteps`
dalej czytają z **pustego** przebiegu, którego nigdy nie było.

**Dlaczego to zgłaszam, a nie naprawiam.** To nie jest kolor ani tłumaczenie —
to stan komponentu. Naprawa w torze grafiki byłaby zgadywaniem, który licznik
jest prawdziwy.

**Dlaczego to pilne.** To jedyna rzecz na sześciu ekranach arkusza, która na
prawdziwym pokazie każe klientowi zapytać „to jest gotowe czy nie?".

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: procent czytany jako piksel

**Mechanizm — potwierdzony czytaniem kodu, nie domysłem.**
`src/components/shared/ModuleHub/FilterableTable.tsx:643` — `parsePx('26%')`
usuwa wszystko poza cyframi i zwraca **26**. Kolumna dostaje `width: 26px`.
Ratuje ją dopiero `minWidth` (200 px dla kolumny tytułu), więc kolumna renderuje
się na **200 px zamiast zamierzonych 26% szerokości tabeli** (~360 px przy 1400 px).

**Co widziałem na własne oczy:** jedna kolumna, na ekranie `fab-rail-kebab` —
`width: '40%'` dawało ucięte „Ocena g...". Naprawione zmianą na `'360px'`.

**Czego NIE widziałem:** sześciu plików `src/components/MyWork/*Queue.tsx`
(`ScheduleDecisionQueue`, `DefinitionDecisionQueue`, `GateSignoffQueue`,
`AnalysisDecisionQueue`, `PortfolioDecisionQueue`, `DefinitionRemediationQueue`).
Mają **identyczny wzorzec** (`width: '26%'`…`'30%'` na kolumnie `title`), ale
**żadnego z nich nie wyrenderowałem** — nie są zarejestrowane w harnessie.
Twierdzenie „sześć plików ma widoczny defekt" jest **wnioskiem z kodu**, nie pomiarem.

**Do zrobienia w torze funkcji:** albo naprawić `parsePx`, żeby procent liczył
względem szerokości tabeli, albo zamienić procenty na piksele w tych sześciu
plikach — po uprzednim **wyrenderowaniu co najmniej jednego z nich**.

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: cztery sekcje karty zadania nie mają skąd się wczytać

**Zweryfikowane w źródle przeze mnie, nie przepisane z raportu robotnika.**

`src/components/MyWork/TaskDetailView.tsx`: `setRisks`, `setAlternatives`,
`setImplementationIdeas`, `setEvidenceItems`, `setStakeholders` są wołane **wyłącznie**
z akcji użytkownika i z odpowiedzi AI (linie 1994, 2096, 2163, 2189, 2244, 2264,
2315, 3102). **Ani razu przy wczytaniu rekordu.** `setStakeholders([])` w linii 1136
to reset do pustej listy. Typ rekordu zadania nie niesie tych pól w ogóle.

**Co to znaczy dla użytkownika:** cztery z ośmiu sekcji karty zadania — Pomysły
realizacji, Ryzyka i alternatywy, Dowody, RACI i eskalacja — istnieją **tylko
w tej sesji przeglądarki**. Wypełniasz je, zamykasz kartę, wracasz — pusto.

**Czego NIE zweryfikowałem:** czy cokolwiek te dane **zapisuje**. Sprawdziłem
wyłącznie ścieżkę odczytu. Możliwe, że zapis działa i brakuje tylko wczytania —
i to jest pierwsza rzecz do zmierzenia, bo rozstrzyga, czy dane są tracone,
czy tylko niewidoczne.

**Drugie, mniejsze:** sekcja nazywa się „Ryzyka i alternatywy", ale w tym trybie
renderuje wyłącznie ryzyka — `alternatives` nie ma żadnego odbiorcy w UI. Połowa
nazwy sekcji jest martwa niezależnie od danych.

---

### 2026-08-30 · SPROSTOWANIE własnego zgłoszenia: hipoteza inicjatywy DZIAŁA

Robotnik zgłosił „potwierdzony błąd w `InitiativeDocumentView`: `hypothesisDraft`
i `lessonsDraft` nigdy się nie hydratują z rekordu". **To jest nieprawda i nie
weszło do żadnego dyżuru.**

Efekt hydratujący **istnieje** — `InitiativeDocumentView.tsx:1573-1578`,
`useEffect(() => setHypothesisDraft(savedHypothesis), [savedHypothesis])`. Robotnik
przeczytał linie 1569-1570 i 1596-1609, i **przeoczył efekt leżący dokładnie między
nimi**. Sprawdziłem na żywym renderze: pole zawiera wstrzykniętą treść (tylko jest
w trybie tylko-do-odczytu, bo karta stoi w Podglądzie — dlatego nie widać jej
w tekście strony).

**Wniosek metodyczny:** fragment kodu wycięty z dwóch stron to nie jest dowód.
Sąsiednie linie potrafią obalić tezę. Każde „potwierdzony błąd w src/" z raportu
robotnika sprawdzam sam, zanim wejdzie do rejestru.

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: wskaźniki nie mają nazw, tylko kody

**Uwaga właściciela:** na tabeli zestawu nazwy wskaźników są ucięte do kodów —
„kpi-oee-…", „kpi-defe-…", „kpi-czas-…".

**To NIE jest wąska kolumna ani dane testowe. To brak pola w kontrakcie danych.**

`KpiScorecardItemDto` (`src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts:109-119`)
**nie niesie nazwy wskaźnika** — wyłącznie `kpiId`. Kolumna renderuje
`shortKpiScorecardId(row.kpiId)` (`kpiScorecardPresenters.tsx:387-398`), a ta funkcja
(`kpiScorecardMappers.ts:184-187`) **zawsze** tnie do ośmiu znaków plus wielokropek,
niezależnie od szerokości kolumny. Ten sam mechanizm tnie właściciela (`user-pio…`)
i cel zakresu (`bu-jakosc`), a na poziomie 3 — właściciela i proces w panelu
właściwości.

**Co trzeba zrobić:** wzbogacić odpowiedź o nazwę wskaźnika (i nazwy osób), a potem
przestać skracać identyfikator w miejscu, gdzie ma stać nazwa. Poprawka po stronie
UI bez zmiany kontraktu **nie jest możliwa** — nie ma czego wyświetlić.

**Dlaczego to jest pilne:** to jest tabela, w którą właściciel wchodzi za każdym
razem, gdy patrzy na okres rozliczeniowy. Kod zamiast nazwy czyni ją nieczytelną
dla człowieka, który nie zna identyfikatorów na pamięć.

### 2026-08-30 · ZGŁOSZENIE TORU GRAFIKI → TOR FUNKCJI: prawy panel dokumentów — połowa funkcjonalna

**Pełna analiza:** `docs/program/grafika/ANALIZA_PRAWY_PANEL.md` (§1-7 + uzupełnienie
o dokumentach). Tu tylko to, co należy do toru funkcji.

**Zgłoszenie właściciela:** prawy panel w Wordzie, Excelu i PowerPoincie — *„to
kiedyś było zgłaszane, ale ewidentnie gdzieś nam to przeleciało"*.

**Dlaczego przeleciało — przyczyna, nie wymówka:** jedno pojęcie ma dwie–trzy nazwy.
„Na czym oparto" to `evidence` (kanon, Deck) **albo** `sources` (Word, Excel).
„Co się działo" to `history` (kanon, Excel) **albo** `activity` (Word, Prezentacje,
Deck). Nie da się zauważyć, że dwie powierzchnie robią to samo, jeśli nazywają to
inaczej — ani greppem, ani okiem.

**Czego brakuje po stronie DANYCH (to jest praca toru funkcji, nie panelu):**

1. **Pochodzenie dokumentu.** Dokument nie wie, z czego powstał: która ocena, które
   wywiady, który model finansowy, jakie założenia przyjęła Teresa. Dopóki serwer
   tego nie zwraca, sekcja „Źródła i założenia" **nie ma czego pokazać** — a to jest
   sekcja odpowiadająca na pytanie „czy mogę to wysłać klientowi".
2. **Rezultaty dokumentu.** Dokument nie wie, co z niego wyszło — zadania, decyzje,
   kolejne materiały. Bez tego łańcuch „burza mózgów → zadania → czynności" nie ma
   się gdzie pokazać.
3. **Kontrola jakości poza Wordem.** Narzędzie `qa` (fabrykacje, liczby bez pokrycia,
   puste sekcje) istnieje **wyłącznie** w Studiu Dokumentów. Excel i PowerPoint nie
   mają odpowiednika — a wychodzą do klienta tak samo.

**To ta sama klasa problemu co wskaźniki bez nazw:** poprawka po stronie wyglądu
jest niemożliwa, bo nie ma czego wyświetlić. Kontrakt danych idzie pierwszy.

**Kolejność uzgodniona z właścicielem:** najpierw jedno źródło kolejności sekcji
(tor grafiki, zmiana mechaniczna), potem rozstrzygnięcie o miejscu Teresy, potem
treść sekcji, na końcu siedem szyn poza kanonem — po jednej, każda z odbiorem.
