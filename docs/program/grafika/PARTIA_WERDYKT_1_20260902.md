---
doc_id: partia-werdykt-1-20260902
status: canonical
truth_type: acceptance-batch
established: 2026-09-02
dla: właściciel (Piotr)
---

# Pierwsza partia do werdyktu — Finanse · Wyniki · Materiały

To jest pierwszy **odbiór modułami**, nie pojedynczymi ekranami. Do tej pory oglądałeś karty
po jednej. Teraz dostajesz trzy moduły w całości: wszystko, co w nich jest, z rzędu, żebyś
mógł powiedzieć „ten moduł jest gotowy" albo „ten jeszcze nie".

---

## Jak to czytać — trzy rzeczy i nic więcej

**1. Każdy ekran ma dwa obrazy: jasny i ciemny.** Jeśli któryś wygląda inaczej niż powinien
w jednym z motywów — to jest defekt i chcę o nim wiedzieć.

**2. Przy każdym ekranie stoi jedno zdanie o tym, co na nim widać.** Napisałem je, patrząc
na ten sam obraz, który dostajesz. Jeśli zdanie nie zgadza się z obrazem — powiedz, to znaczy,
że coś przeoczyłem.

**3. Przy ekranach, które nie są w pełni gotowe, wypisuję CO JEST NIE TAK, ZANIM spojrzysz.**
Nie chcę, żebyś odkrywał zepsucie — chcę, żebyś ocenił, czy to, co zostaje, przeszkadza.

**Ekrany listowe pokazuję po kliknięciu w wiersz** — czyli z otwartym panelem po prawej.
To trzecia część naszego standardu list i do wczoraj **nie została sfotografowana ani razu**
przez cały czas trwania odbioru. Oglądałeś tabele bez podglądu i oceniałeś dwie części z trzech.

---

## Co zrobiliśmy z tymi modułami dzisiaj, zanim je zobaczyłeś

Zanim ta partia powstała, znaleźliśmy i naprawiliśmy rzecz, która podważała wcześniejsze oceny:
**część ekranów pokazywała przerysowany obrazek zamiast prawdziwej aplikacji.** Narzędzie, którym
robimy zdjęcia, miało prawo pokazywać cokolwiek — i czasem pokazywało układ, którego w produkcie
nie ma. Zbudowaliśmy mechaniczną kontrolę, która to wyłapuje, i przepuściliśmy przez nią wszystkie
ekrany tej partii.

**Wynik dla Finansów: zero zastrzeżeń — wszystkie 13 ekranów pokazuje prawdziwy produkt.**
**Wynik dla Materiałów: jedno ostrzeżenie** (ekran „Excel — arkusze w Materiałach" zestawia w jednym
kadrze dwa widoki, które w aplikacji są osobno; ocenione jako świadome, bo odtwarza przejście
„kliknij Otwórz").

Ta sama kontrola wyłapała, że wcześniejsza liczba zagrożonych kart była **zawyżona** — z 29
zgłoszonych okazało się 19 realnych, bo sześć oskarżeń było błędem samego narzędzia. Poprawiliśmy
narzędzie, nie karty.

---

## FINANSE — 13 ekranów

Zdjęcia: `evidence/grafika/206-przeglad-09-10/` — każdy ekran jako `<nazwa>__PRZED__light.png`
i `<nazwa>__PRZED__dark.png`. Wszystkie zrobione dziś. Ekrany listowe — po kliknięciu w wiersz,
czyli z otwartym panelem po prawej.

**Skrót wyniku: 9 ekranów bez zastrzeżeń · 3 z defektem do naprawy · 1 do rozstrzygnięcia.**
(26 obejrzanych obrazów: 18 bez zastrzeżeń · 6 do poprawy · 2 do rozstrzygnięcia. Liczba poprawiona po tym, jak robotnik wykrył grepem własny błąd w ręcznym liczeniu — pierwsza wersja mówiła 16/6/4.)

**★ Ważne o tym module:** kontrola prawdziwości obrazu daje dla Finansów **zero zastrzeżeń** —
wszystkie 13 ekranów pokazuje prawdziwą aplikację. Wcześniejszy audyt twierdził, że cztery panele
Finansów są tu pokazane jako osobne kartki, choć w produkcie to jedna szuflada z zakładkami.
To okazało się **błędem narzędzia kontrolnego**, nie ekranów — poprawiliśmy narzędzie.

### Gotowe — pokazuję bez zastrzeżeń (8 ekranów, ocena A)

| Ekran | Co na nim widać |
| --- | --- |
| Komentarze — `finance-comments-panel` | Baner „Są nierozwiązane komentarze blokujące" (czerwony zasadnie — zatwierdzenie jest realnie wstrzymane), dwa komentarze z autorami i pigułką „Blokujący". |
| Nawigator pochodzenia — `finance-lineage-navigator` | Łańcuch pięciu kroków od „Pakiet sprawozdań FY2025 v3" do „Wycena DBR77 v1"; sekcja „Dzieci 0" ma wyjaśnienie „Brak bezpośrednich dzieci" — uczciwe zero, nie gołe zero. |
| Pasek tożsamości — `finance-workspace-bar` | „DBR77 — Model bazowy FY2026" z czterema zakładkami (Założenia GOTOWE / Zdarzenia / Wyliczenia GOTOWE / Walidacja). Treść pod paskiem jest jawnie oznaczona jako poza zakresem — pustka jest tu zamierzona i nazwana. |
| Zapisane widoki — `finance-saved-views-panel` | Sekcje „Zespołowe (1)" i „Osobiste (1)" z realnymi nazwami; „Usuń" na czerwono (usuwanie jest nieodwracalne — zasadnie). |
| Eksport i import — `finance-export-import-panel` | Po wgraniu pliku i kliknięciu „Podgląd różnic" widać **policzony wynik**, nie sam formularz: dodane 0, zmienione 2, wyczyszczone 0, bez zmian 370. |
| Modele — `finance-model-workspace` | „Źródło i wartości bazowe" z realnymi liczbami (przychody 12 400 000, koszt własny 7 100 000, nakłady 560 000) i paskiem „OPARTE NA FY2025 · Zatwierdzony". |
| Pakiet sprawozdań — `finance-statement-pack-workspace-v2` | Sześć linii z kwotami (przychody 8 200 000 → 9 400 000) i pigułką „KOREKTA"; prawy panel z powiązanymi artefaktami. |
| Porównanie okresów — `finance-compare-panel` | Siedem wierszy w pełni policzonych (przychody 420 000 → 431 000, +2,6%; wynik netto 58 563 → 60 426, +3,2%); czerwień tylko przy ujemnych zmianach kosztów. |
| Wycena przedsiębiorstw — `finance-valuation-workspace` | Łańcuch pochodzenia w czterech krokach z datami i uczciwym wymogiem: wersja musi wskazywać zatwierdzoną, a nie „najnowszą". |

### Z defektem, który nazywam PRZED Twoim spojrzeniem (3 ekrany, ocena B)

| Ekran | Co jest nie tak | Stan |
| --- | --- | --- |
| **Analiza** — `finance-analysis-workspace` | **Najgorszy w tym module.** W kolumnie KOMENTARZ, w wierszu „Marża brutto", tekst tnie się w środku słowa w każdej z sześciu linii: „Marż / rośni / dzięk / niższ / koszt / mate" zamiast „Marża rośnie dzięki niższym kosztom materiałów". Nie ma nawet wielokropka. | ZNANY BRAK — luka we wspólnym mechanizmie skracania tekstu; naprawa dotyka dziesiątek już odebranych ekranów, więc idzie osobną rundą (`ODLOZONE.md`) |
| **Wejście do Finansów** — `finance-hub` | Ten sam status w dwóch językach na jednym ekranie: wiersz tabeli mówi „Szkic", a panel obok „DRAFT". | DO NAPRAWY — to samo, co naprawiliśmy dziś w Projektach; tu wychodzi kolejne wystąpienie |
| **Prognoza** — `finance-prediction-workspace` | Kolumna LINIA pokazuje kody zamiast nazw: `CASH`, `EBITDA`, `LONG_TERM_DEBT`, `REVENUE`. Kolumna OKRES pokazuje `latest`. Poza tym ekran jest policzony: EBITDA 312 000 wobec 298 000 w scenariuszu bazowym, +4,7%. | NAPRAWIANE DZIŚ |

### Do rozstrzygnięcia (1 ekran)

**Model bazowy — `finance-baseline-workspace`.** Dziewięć założeń wypełnionych i czytelnych
(wzrost przychodów 8% → 12%, stawka podatku 19%), ale kolumna OKRES BAZOWY pokazuje `per-2025-12`
zamiast „grudzień 2025" — w każdym z dziewięciu wierszy. Naprawiane dziś razem z Prognozą.

**Ten sam ekran ma Twoją otwartą uwagę:** *„dalej nie mam przycisku dodawania założeń
i możliwości usuwania linii"*. Tego przycisku po prostu nie ma w programie — przekazane do budowy
jako sprawa #36. Karta zostaje otwarta, żeby nie zniknęła.


---

## WYNIKI — 19 ekranów

Zdjęcia: `evidence/grafika/209-partia1-wyniki/` — każdy ekran jako `<nazwa>__PO__light.png`
i `<nazwa>__PO__dark.png`. Wszystkie zrobione dziś, po kliknięciu w wiersz tam, gdzie ekran
jest listą.

**Skrót wyniku: 10 ekranów bez zastrzeżeń · 5 z defektem do naprawy · 4 z brakiem w danych.**

### Gotowe — pokazuję bez zastrzeżeń (10 ekranów, ocena A)

| Ekran | Co na nim widać |
| --- | --- |
| Cel (karta jednego celu) — `cel-jedna-karta` | „Cel — Zwiększyć przepustowość linii pakowania L3", status „Zamknięty — 2/3 KR osiągnięte", średni postęp 75%. Ciemny motyw pokazuje ten sam stan. |
| Wskaźnik (karta jednego KPI) — `wskaznik-jedna-karta` | „Czas przezbrojenia, linia pakowania L3" z czterema progami: cel 26 min (zielony), ostrzeżenie od 32 min (bursztyn), krytyczny od 38 min (czerwony — zasadnie), punkt wyjścia 47 min. |
| ROI (karta jednej analizy) — `roi-jedna-karta` | „Skrócenie przezbrojeń (SMED)" z tabelą „Na co idzie 480 000 zł" — cztery pozycje (140/165/120/55 tys.) sumujące się do kwoty inwestycji. |
| Rejestr wskaźników — `results-vnext-kpi-registry` | 5 wskaźników; w podglądzie „OEE linii pakowania": ostatni pomiar 70, okres 1–8 sierpnia 2026. |
| Karty wyników — `results-vnext-kpi-scorecards` | 3 pozycje; „Usuń pozycję" na czerwono (usuwanie jest nieodwracalne — kolor zasadny). |
| Archiwum — `results-vnext-legacy-archive` | Cztery tabele historyczne z realnymi licznikami (34/12/7/0) i jawnym „Zapis: Zablokowany". |
| Programy OKR — `results-vnext-okr-admin` | Uczciwy pusty stan: „Programy OKR — jeszcze nie włączone", z wyjaśnieniem dlaczego. Pustka JEST treścią tego ekranu. |
| Warsztat zestawu OKR — `results-vnext-okr-workspace` | „Wdrożyć MES na 3 liniach produkcyjnych", postęp 62,5%, pewność „Średnia"; „Anuluj zestaw" na czerwono (zasadnie). |
| Wyszukiwarka — `results-vnext-search-registry` | Uczciwy stan przed wyszukaniem: „Wpisz co najmniej 2 znaki". Pustka jest treścią. |
| Refleksja po cyklu — `results-vnext-teresa-okr-reflection` | Formularz refleksji dla celu „Uruchomić linię MES-1 w pełnej automatyzacji"; „Zamknij zestaw" na czerwono (zasadnie). |

### Z defektem, który widzę i nazywam PRZED Twoim spojrzeniem (5 ekranów, ocena B)

| Ekran | Co jest nie tak | Stan |
| --- | --- | --- |
| **Rejestr zestawów OKR** — `results-vnext-okr-registry` | **Najgorszy w tym module.** Kolumna „Pewność" jest zasłonięta przez przypiętą kolumnę z trzema kropkami — z nagłówka zostaje „PEW", a z wartości pojedyncze litery „W…"/„Ś…". Do tego ostatni wiersz w panelu po prawej („Następny check-in") jest przycięty w połowie wysokości. | ZNANY BRAK — naprawa wymaga decyzji, którą kolumnę chować przy zwężeniu; opisane w `ODLOZONE.md` |
| **Lista celów OKR** — `results-vnext-okr-objectives` | Nagłówek „Kluczowe rezultaty" ucina się w środku słów na „KLUCZ"/„REZUL", bez wielokropka. Ten sam przycięty wiersz w panelu po prawej co wyżej. | ZNANY BRAK — jak wyżej |
| **Model ROI** — `results-vnext-roi-model` | Pole „Ziarno analizy" pokazuje angielskie słowo techniczne „monthly" zamiast polskiego. | NAPRAWIANE DZIŚ |
| **Panel uwagi** — `results-vnext-attention` | Tabela ma jedną kolumnę (sam kod wskaźnika), a panel po prawej jedno pole. Z samym `DPMO-002` nie da się nic zrobić — brakuje nazwy i powodu. | ZGŁOSZONE DO BUDOWY (#41) |
| **Rejestr zestawień okresowych** — `results-zestawienia` | Słowo „wskaźniki" łamie się w środku na „wskaźnik" + osobne „i". | **WYŁĄCZONE Z TEJ PARTII** — patrz niżej |

### Cztery ekrany pokazują kod zamiast nazwy (ocena B, przyczyna w danych)

`results-vnext-roi-full-tool`, `results-vnext-roi-pir-outcomes`, `results-vnext-roi-registry`,
`results-vnext-teresa-kpi-deviation` — w polu „Inicjatywa" albo „KPI" widnieje surowy kod
(`init-mes-1`, `init-104`, `init-101`, `kpi-1`) zamiast nazwy. Reszta tych ekranów jest w porządku:
`roi-full-tool` pokazuje policzone NPV 41 250 zł i IRR 24,1%, `roi-pir-outcomes` uczciwy rozkład
wyników (104,2% / 61% / 8% — także porażki, nie tylko sukcesy), `roi-registry` siedem spraw
z pełnymi statusami.

**To nie jest wygląd** — nazwa powiązanego obiektu po prostu nie dojeżdża do panelu.
Zgłoszone do budowy jako sprawa #40, priorytet wysoki: pole POWIĄZANIA jest całym sensem
tych ekranów.

### Dlaczego `results-zestawienia` wypada z tej partii

Ten ekran **istnieje wyłącznie w naszym narzędziu podglądowym — w samej aplikacji go nie ma**
(sprawdzone: żaden plik produktu go nie buduje). Defekt łamanego słowa jest prawdziwy, ale
naprawienie go byłoby poprawieniem rysunku, nie produktu. Nie chcę, żebyś oceniał ekran, do
którego klient nie może dojść. Do rozstrzygnięcia osobno: albo rejestr zestawień okresowych
powstaje naprawdę, albo karta schodzi z odbioru.


---

## MATERIAŁY — 36 ekranów

Zdjęcia: `evidence/grafika/206-przeglad-09-10/`. Najliczniejszy moduł w tej partii i pierwszy raz
oglądany w całości.

**Skrót wyniku: 72 obejrzane obrazy — 45 bez zastrzeżeń · 23 do poprawy · 4 do rozstrzygnięcia.**

To jest moduł z **największą liczbą defektów w całej partii** i nie chcę tego zmiękczać. Poniżej
pięć rzeczy, które musisz zobaczyć, zanim spojrzysz na cokolwiek innego.

### ★ Pięć rzeczy, o których musisz wiedzieć

**1. Jedno kliknięcie wywala aplikację.** W Architekcie szablonów Word (`gen-word-content-hints`)
lista renderuje się poprawnie, ale **kliknięcie w wiersz „Raport zarządczy (miesięczny)" daje pusty
biały ekran zamiast edytora**. To nie jest brzydki wygląd — to zatrzymanie użytkownika na ścieżce,
którą pokazujesz klientom. Zgłoszone do budowy z najwyższym priorytetem (sprawa #42). Sprawdziliśmy
kontrolnie: bez kliknięcia lista jest czysta, a błąd pochodzi z pliku produktu, nie z naszego
narzędzia podglądowego.

**2. Cała sekcja edytora szablonu prezentacji jest po angielsku.** W `gen-deck-content-hints`, po
otwarciu istniejącego szablonu, blok „WŁASNY MOTYW I WZORCE SLAJDÓW POWERPOINT" oraz cała sekcja
„TEMPLATE VARIABLES" mają angielskie etykiety pól (`titleFont`, `bodyFont`, `primaryColor`,
`logoDataUri (optional)`), angielski przycisk „Add variable" i angielskie „0 version(s)". To
największy nieprzetłumaczony blok w całym dzisiejszym przeglądzie — i widać go dopiero po kliknięciu,
więc wcześniejsze przeglądy go nie łapały.

**3. Nazwa modułu w ścieżce nawigacji mówi „Document Studio" po angielsku — na sześciu ekranach.**
Jedna wartość tłumaczenia, sześć ekranów. **To najtańsza naprawa w całym przeglądzie**, ale wymaga
Twojej decyzji: jak ten moduł ma się nazywać po polsku. Nie wymyślam nazwy produktu za Ciebie.

**4. W ciemnym motywie cztery kafle zostają białe.** Na ekranie `document-artifact` kafle
„BUDŻET WYKORZYSTANY", „KAMIENIE MILOWE", „RYZYKA WYSOKIE", „POZIOM PEWNOŚCI" pozostają białymi
kartami na ciemnym tle — jedyny blok ekranu, który nie przełączył się na ciemny motyw.

**5. Na dwóch ekranach Excela w ciemnym motywie widać szew.** Tło treści i tło strony to dwa różne
odcienie granatu sklejone bez przejścia, mniej więcej w połowie wysokości ekranu. W jasnym motywie
niewidoczne, bo oba odcienie są prawie białe.

### Co jest w porządku (45 z 72 obrazów)

Artefakty (Dokument, Arkusz, Deck, Raport) renderują się z pełną treścią i policzonymi kaflami;
rejestr Materiałów pokazuje trzy rodzaje plików ze statusem „Gotowy"; galeria wzorców, kreator
szablonów i menu „Plik" działają po polsku; stany błędu mówią uczciwym językiem („Nie udało się
otworzyć dokumentu" z przyciskiem powrotu, zamiast wiszącego kółka).

### Drobniejsze, ale widoczne

| Ekran | Co jest nie tak |
| --- | --- |
| `materials-registry` | Pigułka „STAN ZAUFANIA" mówi „Organization" po angielsku, choć ta sama wartość w kolumnie obok brzmi „Organizacja". |
| `report-builder-library-template` | Etykieta pola i podpowiedź mówią „Assessment", choć moduł nazywa się u nas „Ocena". |
| `excele-jeden-widok-recent` | Status wiersza to zwykły tekst „draft" po angielsku, nie pigułka „Szkic". |
| `document-studio-streaming-honesty-n3` | Plan dokumentu pokazuje surowe angielskie opisy: „Rejestr: executive", „Styl: formal", „SHORT"/„LONG". |

### Do rozstrzygnięcia — tekst dla programisty w polu opisu

Na dwóch ekranach (`materialy-template-library-slice`, `materialy-draft-template-visibledraft-fix`)
pole SZCZEGÓŁY zawiera **dosłowną notatkę dewelopera** zamiast opisu obiektu — np. „PO NAPRAWIE:
świeżo utworzony przez właściciela szablon… wcześniej ten wiersz nie pojawiał się WCALE…".
To dane demonstracyjne, nie etykieta programu, więc nie ruszam ich w torze wyglądu. Ale **na pokazie
klient to przeczyta** — do wyczyszczenia razem z resztą danych demo (sprawa #44).

### Czego nie obejrzeliśmy i mówię o tym wprost

- `excele-jeden-widok-pusty` — kliknięcie w kartę „Czysto" wywala nasze narzędzie podglądowe (brak
  jednego elementu konfiguracji), więc pusta siatka **nie została obejrzana**. To awaria pomiaru,
  nie produktu — ale nie udaję, że widziałem.
- `prezentacje-template-states` — obejrzany tylko w stanie domyślnym; nazwa sugeruje więcej stanów,
  do których nie mieliśmy adresu.


---

## Czego w tej partii NIE MA i dlaczego

**Baza porównania (Finanse).** Powiedziałeś: *„dalej nie mam przycisku dodawania założeń
i możliwości usuwania linii"*. To nie jest wygląd — tego przycisku po prostu nie ma w programie,
więc nie mam czego pokazać. Przekazane do budowy; karta zostaje otwarta, żeby sprawa nie zniknęła.

**Model finansowy i Prognoza.** Oba ekrany są zbudowane i wyglądają dobrze, ale Prognoza jest
dostępna tylko po włączeniu przełącznika — czyli nie każdy użytkownik ją zobaczy. Mówię o tym
wprost, żeby ocena dotyczyła tego, co realnie dostaje klient.

---

## Bramki mechaniczne — stan w chwili oddania partii

| Kontrola | Co sprawdza | Wynik |
| --- | --- | --- |
| Kontrola kompletu zdjęć | czy każda karta ma świeże zdjęcie w obu motywach | CZYSTO — 253 karty, 506 zdjęć, zero zastrzeżeń |
| Kontrola prawdziwości obrazu | czy ekran pokazuje produkt, a nie własną kompozycję | CZYSTO — bez nowych rozbieżności; zero w Finansach |
| Kontrola standardu tabel | czy ktoś nie skleił własnej tabeli poza standardem | CZYSTO — dług nie rośnie |

Kontrole są **mechaniczne celowo** — oko przyzwyczaja się do stałego elementu kadru i przestaje
go widzieć. Sprawdziliśmy to na sobie: przez cały dzień patrzyłem na zdjęcia z kontrolkami
narzędzia w rogu i ich nie zauważałem.
