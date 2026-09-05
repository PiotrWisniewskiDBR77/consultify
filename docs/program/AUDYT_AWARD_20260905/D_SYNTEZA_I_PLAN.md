# Synteza i plan — audyt „award-winning / CES 2027", 05.09.2026

Ten dokument streszcza trzy części audytu (A, B, C) w jednym miejscu i zamienia je w kolejność pracy.
Bez żargonu. Ścieżki do plików i numery linii zostały w tabelach i w częściach A–C — tutaj piszę tylko,
co widzi człowiek i co się zmieni.

---

## 1. Gdzie jesteśmy

Obejrzeliśmy **125 ekranów i stanów** w 16 modułach, każdy klikany na żywo, każdy ze zrzutem i zapisem
tego, co działo się pod spodem. Dwie oceny w skali 0–3: **A = stabilność** (czy działa, czy nie wisi,
czy nie sypie błędami), **B = grafika** (czy wygląda jak jeden produkt, po polsku, bez ucięć).
3 = można pokazać na scenie.

| Moduł | Ekranów | A | B | Ekran flagowy | Werdykt jednym zdaniem |
| --- | :-: | :-: | :-: | --- | --- |
| Moja Praca | 25 | 2,5 | 2,3 | Skrzynka z otwartym podglądem | Solidna, psuje ją tylko prawy panel zabierający miejsce tabeli. |
| Czat AI | 7 | 2,6 | 2,4 | Otwarta rozmowa na szerokim ekranie | Najbliżej sceny ze wszystkich — brakuje jednego słowa po polsku i sprzątnięcia danych testowych. |
| Wywiad | 13 | 2,5 | 2,2 | Lista „Skrzynka" na szerokim ekranie | Dobry, ale ma dwa rzędy tych samych zakładek, które sobie przeszkadzają. |
| Narzędzia | 6 | 1,8 | 1,2 | Biblioteka narzędzi | Najsłabszy moduł: jeden ekran nie działa w ogóle, czerwień użyta tam, gdzie nic złego się nie dzieje. |
| Ocena | 11 | 2,0 | 2,2 | Macierz DRD na pełnym ekranie | Świetny rdzeń, ale raport oznaczony jako gotowy otwiera się pusty. |
| Inicjatywy | 10 | 2,0 | 1,1 | Podgląd po kliknięciu wiersza | Mechanika dobra, połowa widoków po angielsku — najgorsza grafika w produkcie. |
| Realizacja | 7 | 1,9 | 1,9 | Kokpit menedżera | Kokpit gotowy, ale dwa ekrany obok wiszą kilkanaście sekund bez słowa. |
| Wyniki | 19 | 2,7 | 2,3 | Karta celu OKR | Najstabilniejszy moduł produktu — właściciel odrzucił jednak układ nawigacji KPI. |
| Finanse | 6 | 1,5 | 1,3 | Lista sprawozdań | Wyjęty z MVP decyzją właściciela; najsłabszy wynik w całym audycie. |
| Materiały | 6 | 2,0 | 1,8 | Studio dokumentów — nowy dokument | Dobry kierunek, drobne braki w etykietach. |
| Audyty | 4 | 2,0 | 1,8 | Podgląd programu audytowego | Poprawny, brakuje przycisku „Otwórz" w nagłówku. |
| Spotkania | 2 | 2,0 | 1,0 | Lista i podgląd spotkania | Zmierzony powierzchownie; blok podpowiedzi AI po angielsku. |
| Organizacja | 2 | 2,0 | 2,0 | Profil organizacji › Tożsamość | Treściowo mocny, nagłówek po angielsku. |
| Panel Administratora | 2 | 2,0 | 2,0 | Polityka bezpieczeństwa | Poprawny; nazwa w nagłówku nie zgadza się z zawartością. |
| Ustawienia | 2 | 2,0 | 2,0 | Przegląd bezpieczeństwa | Gotowy do pokazania. |
| Partnerzy | 3 | 2,0 | 2,0 | Pusty stan portalu / ekran logowania | Gotowy; realnych danych partnera nie było czym zmierzyć. |
| **RAZEM** | **125** | **2,25** | **2,00** | — | — |

**Czytanie tych liczb w jednym zdaniu:** produkt jest stabilny (2,25 — rzeczy działają), ale wygląda jak
złożony z kilku różnych aplikacji (2,00 — na co drugim ekranie widać coś, czego nie powinno tam być).
Grafika jest dziś słabszym z dwóch wymiarów i to ona decyduje o wrażeniu na scenie.

---

## 2. Wzorce, nie wyjątki

To jest najważniejsza część tego dokumentu. Znalezisk jest ponad sto, ale **sześć przyczyn tłumaczy
większość z nich**. Naprawa przyczyny naprawia kilkanaście ekranów naraz; naprawa pojedynczego ekranu
odrasta gdzie indziej — mieliśmy to już zmierzone wcześniej.

| # | Przyczyna | Ile ekranów | Jedna naprawa | Nakład | Wpływ |
| :-: | --- | :-: | --- | :-: | :-: |
| 1 | **Prawy panel Teresy jest trzecią kolumną, a nie zakładką.** Na listach zabiera stałe ~380 px i nie da się go schować. Na wąskim ekranie tabela kurczy się do jednej kolumny albo chowa własny przycisk akcji. Ten sam produkt ma już poprawny wzorzec — w warsztacie pomysłu panel ma zakładki Element/Teresa i jest jeden. | ~20 (Moja Praca, Wywiad, Ocena, Finanse, Audyty) | Jeden panel z zakładkami, zamykany krzyżykiem i przywracany pigułką; chowa się sam poniżej pełnej szerokości | L | H |
| 2 | **Wspólny komponent tabeli ucina tekst bez podpowiedzi.** Domyślna szerokość kolumn jest za mała na polskie nagłówki, więc widać „STA…", „PILN…", „5.05.2…" — i nie ma dymka z pełną treścią. Komentarz w samym pliku przyznaje, że dotychczasowe obejście „niczego nie ratuje". | ~25 (wszystkie moduły z tabelą) | Poprawka u źródła: większe domyślne szerokości + dymek zawsze, gdy tekst jest ucięty | M | H |
| 3 | **Angielszczyzna wchodzi całymi archetypami, nie pojedynczymi słowami.** Ekran pełnej karty inicjatywy jest w 100 % po angielsku. Całe rzędy filtrów w dwóch zakładkach Inicjatyw nie mają ani jednego polskiego słowa. Do tego nagłówki modułów („Initiatives", „Organization", „Audits", hybryda „Resultaty"), chipy podpowiedzi Teresy, 22 nazwy narzędzi w Finansach, „Search", „Loading…", „New conversation". | ~30 | Przegląd tłumaczeń archetyp po archetypie (nie słowo po słowie) + brakujące słowniki dla wartości statusów i priorytetów | L | H |
| 4 | **Surowe wartości techniczne pokazywane człowiekowi.** „Źródło: manual", „Stan pakietu" jako kod, identyfikator bazy w nawiasie obok nazwiska, nazwa wewnętrznej funkcji serwera w komunikacie błędu, „MONTH" jako jednostka, „Unknown" jako format, raz „commercial" a raz „COMMERCIAL" w tej samej kolumnie. | ~15 | Warstwa etykiet dla wartości słownikowych + zamiana identyfikatorów na nazwy w tabelach właściwości | M | H |
| 5 | **Ekran ładuje się w ciszy albo kłamie zerem.** Warsztat pomysłu 4–6 s pustego prostokąta, dwie zakładki Realizacji 15–22 s bez spinnera, Narzędzia 5–10 s gołego ekranu, liczniki Notatnika pokazują twarde „0" zanim pokażą „2". Do tego szum: brak danych zwracany jako błąd 404 zaśmieca konsolę na czatach, pomysłach, finansach i pełnej karcie inicjatywy (11 błędów naraz). | ~15 | Wspólny szkielet ładowania od pierwszej sekundy + zamiana „nie ma czego wznowić" z błędu na normalną pustą odpowiedź | M | H |
| 6 | **Czerwień i nakładki tam, gdzie nic złego się nie dzieje.** Kategoria narzędzi i status „Nieaktywny" na czerwono (kolor zarezerwowany dla stanów krytycznych), wycofany fiolet w Ocenie, a przy typowej szerokości laptopa teksty nachodzą na siebie w nagłówku narzędzia i na kafelku wyniku. | ~8 | Przegląd kolorów stanów + jeden przebieg kontrolny przy szerokości laptopa | S | M |

---

## 3. Plan

Kolejność jest ustawiona według „ile ekranów naprawia jedna robota". Najpierw fundamenty — bo one
podnoszą ocenę wszędzie naraz. Dopiero potem polerowanie konkretnych ekranów.

### (I) Tydzień 1: fundamenty

| # | Paczka | Co się zmienia dla użytkownika | Moduły | Nakład | Zależność | Jak poznasz, że gotowe |
| :-: | --- | --- | --- | :-: | --- | --- |
| P1 | **Jeden prawy panel, zwijany** | Panel Teresy da się zamknąć i przywrócić; na listach ma zakładki Element/Teresa zamiast być osobną kolumną; sam się chowa na wąskim ekranie | Moja Praca, Wywiad, Ocena, Audyty | L | — | Na laptopie 1280 px tabela Skrzynki pokazuje wszystkie kolumny, a panel można zamknąć krzyżykiem |
| P2 | **Tabela nie ucina** | Nagłówki i wartości są czytelne w całości; gdy coś się nie mieści, dymek pokazuje pełną treść | wszystkie z tabelą | M | — | Na żadnym ekranie listowym nie ma „STA…" ani „5.05.2…" bez dymka |
| P3 | **Koniec angielskiego** | Pełna karta inicjatywy, filtry Planu i Obciążenia, nagłówki modułów i podpowiedzi Teresy są po polsku | Inicjatywy, Wyniki, Organizacja, Audyty, Moja Praca, Czat | L | — | Przejście przez 16 modułów nie daje ani jednego angielskiego słowa na ekranie |
| P4 | **Żadnych kodów w interfejsie** | Zamiast „manual", identyfikatorów bazy i nazw funkcji serwera widać normalne polskie etykiety | Moja Praca, Wyniki, Finanse, Wywiad, Materiały | M | — | Wyszukanie „manual", „MONTH", „Unknown" i ciągu znaków identyfikatora na zrzutach daje zero trafień |
| P5 | **Nic nie wisi w ciszy** | Każdy ekran od pierwszej sekundy pokazuje szkielet lub komunikat; konsola nie sypie błędami przy zwykłym klikaniu | Moja Praca, Realizacja, Narzędzia, Czat | M | — | Otwarcie warsztatu pomysłu i zakładki Praca pokazuje szkielet natychmiast; zero czerwieni w konsoli na tej ścieżce |
| P6 | **Czerwień tylko dla krytycznych + przegląd 1440 px** | Spokojne stany przestają wyglądać na awarię; teksty przestają na siebie nachodzić | Narzędzia, Ocena, Wyniki | S | — | Na ekranie narzędzi nie ma czerwonych elementów; nagłówek narzędzia czytelny na laptopie |
| P7 (WYKONANE 05.09 17:30 — scalone `dda794943e`, Wyniki odblokowane do zatwierdzenia) | **Nawigacja KPI po myśli właściciela** | Rejestr → lista zestawienia z opisem i pozycjami → karta pojedynczego wskaźnika; analogicznie dla OKR | Wyniki | M | P3 | Otwarcie rejestru i trzy kliknięcia prowadzą do karty wskaźnika, bez skrótów i ślepych uliczek |
| P8 | **Sprzątanie danych demo** | Znikają foldery „QA folder 1778…", „TEST_PROJ_P2" i rozmowa „test Tomek" | Czat (dane, nie kod) | S | — | Panel historii czatu nie zawiera ani jednej pozycji ze słowem „test" lub „QA" |

### (II) Ekrany flagowe do poziomu sceny

Po fundamentach — jeden ekran na moduł doprowadzony do oceny 3/3, ten z kolumny „Ekran flagowy" w tabeli
z rozdziału 1. Każdy odbierany osobno, na zrzucie, tak jak dotąd. Kolejność od najbliższych gotowości:
Wyniki (karta celu) → Realizacja (kokpit) → Ocena (macierz na pełnym ekranie) → Czat → Wywiad → Moja Praca
→ Materiały → Audyty → Organizacja → Administracja → Ustawienia → Partnerzy → Inicjatywy → Spotkania →
Narzędzia. Nakład na ekran: S–M. Kryterium odbioru: zrzut przy trzech szerokościach bez ani jednego
ucięcia, angielskiego słowa i błędu w konsoli.

### (III) Przepływy klikane

Dla każdego modułu jeden realny scenariusz konsultanta przeklikany od początku do końca — nie ekran,
tylko droga. Przykłady: w Ocenie „otwórz metodykę → wypełnij wywiad → zobacz macierz → wygeneruj raport
i przeczytaj go" (dziś urywa się na pustym raporcie); w Mojej Pracy „pomysł → mapa myśli → tabela →
zamień w inicjatywę"; w Wynikach „zestawienie → wskaźnik → pomiar". Nakład: M na moduł. Kryterium odbioru:
przejście bez cofania się, bez pustego wyniku i bez ekranu, który wisi dłużej niż dwie sekundy bez informacji.
To jest test, którego dotąd nie robiliśmy systematycznie — a to on decyduje, czy produkt jest do pracy,
czy do oglądania.

### (IV) Fala 2 (po MVP)

| Pozycja | Dlaczego poza MVP | Nakład |
| --- | --- | :-: |
| Agent (autonomiczne wykonywanie etapów) | decyzja właściciela: „wywal agenta z MVP"; plan istnieje, ale żaden z 15 etapów nie ma wykonawcy | L |
| Podział na projekty | decyzja właściciela: fala 2; zakładka schodzi z menu, kod zostaje | M |
| Menedżer (pozycja w menu Mojej Pracy) | decyzja właściciela: fala 2 | S |
| Finanse — łańcuch Baseline v3 | decyzja właściciela: Finanse poza MVP; wymaga sześciu ogniw w kolejności wymuszonej kontraktem, od importu bilansu po generator okresów prognozy | L |
| Finanse — porównanie wersji | wprost odłożone przez właściciela | M |
| SIRI — warsztat | wprost odłożone przez właściciela | M |
| Ekran Megatrendów | dziś nie działa w ogóle (usługa nie startuje); do naprawy razem z resztą Narzędzi lub w fali 2 | M/L |

---

## 4. Uwagi właściciela ze stagingu

Właściciel przechodził staging równolegle. Piętnaście modułów dostało odpowiedź, w tym pięć z komentarzem.

| Uwaga | Co znaczy | Gdzie trafia |
| --- | --- | --- |
| Wywiad — „zatwierdzam grafikę, ale DRD nie jest w wywiadzie" | odniesienia do DRD trzeba usunąć z modułu Wywiad | nowa drobna paczka w (I), nakład S |
| Moja Praca — „mam nadzieję, że ten prawy panel można zwinąć, żeby mieć cały ekran do pracy" | to jest dokładnie przyczyna nr 1 | **P1** — zrobione dziś dla warsztatu (krzyżyk zamyka, pigułka przywraca), do rozszerzenia na listy |
| Tabela pomysłów — „mam wielki problem z prawym panelem, bo nie mogę go zamknąć" | ta sama sprawa, zgłoszona drugi raz tego samego dnia | **P1** |
| Notatnik — „prawy panel ma przejąć możliwie dużo z ekranu głównego, ma być super lekko" | kierunek dla panelu, nie defekt | **P1**, kryterium jakościowe |
| Wyniki — „omawialiśmy tabelę; z tabeli otwiera się lista z opisem KPI i pozycjami, a każdy KPI ma swoją kartę; tego tu nie ma" | jedyny moduł niezatwierdzony | **P7** |
| Finanse — „wyrzucamy z MVP, to co pokazałeś jest gorsze niż to, co było" | uchyla wcześniejszą decyzję o dwudniowym torze | **fala 2** |
| SIRI — „zapisz to do fali 2 po MVP" | — | **fala 2** |
| Finanse, porównanie wersji — „wpisz to do fali 2" | — | **fala 2** |

Trzynaście modułów zatwierdzonych graficznie i zamrożonych. Dwa otwarte: **Wyniki** (do przebudowy
nawigacji) i **Finanse** (poza MVP).

---

## 5. Czego nie zmierzyliśmy

Uczciwa lista — to nie są rzeczy sprawdzone i uznane za dobre, tylko niesprawdzone.

- **Tryb ciemny — zero ekranów.** Narzędzie pomiarowe wymusza jasny motyw. Dotyczy wszystkich 16 modułów.
  To jest największa dziura w tym audycie: połowa punktów listy odbiorczej mówi o ciemnym motywie.
- **Obsługa klawiaturą** (przejście tabulatorem, zamykanie Esc) — niezmierzona nigdzie.
- **Ekrany superadministratora** — cztery trasy, brak uprawnień na koncie użytej sesji.
- **Kalendarz: widok „Dzień" i przełącznik „Lista"** — dwie próby trafiały w inny, tak samo nazwany element;
  nie rozstrzygam, czy dotyka to człowieka klikającego myszką.
- **Około 25 podekranów w modułach z części C**: Audyty (sesje, wyniki, raporty), Spotkania (protokoły,
  decyzje, notatki), Organizacja (pięć sekcji), Panel Administratora (pięć sekcji, m.in. dziennik audytu
  i sterowanie AI), Ustawienia (pięć sekcji), Partnerzy z realnymi danymi partnera. Budżet czasu, nie brak dostępu.
- **Pozostałe zakładki Megatrendów** — dzielą tę samą, niedziałającą usługę, ale nie zmierzono osobno.
- **Wszystko, co tworzy rekord albo płatne zapytanie do AI** — świadomie pominięte, żeby nie zaśmiecić danych demo.

Zanim ogłosimy którykolwiek moduł „w pełni odebrany", te pozycje wymagają osobnej, krótkiej sesji pomiaru.
Najpilniejsza z nich to tryb ciemny — jeden przebieg narzędziem z przełączonym motywem załatwia całą listę naraz.
