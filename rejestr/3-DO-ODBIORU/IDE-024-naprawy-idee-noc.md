---
id: IDE-024
tytul: NAPRAWY IDEE — Process Flow ożył, szablony działają, menu się zamyka, komentarze widać
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Odbiór przeklikany Piotra 2026-07-27 — blokery i bugi z 51 uwag"
utworzone: 2026-07-28
ekran: processflow-canvas
wysokosc: 900
klik: "Zwiń pierwszy tor jego pstryczkiem, potem kliknij „Akcja”. Krok MUSI być widoczny (tor sam się rozwija). Wciśnij Tab — też dodaje krok. Potem: prawy klik na obiekcie → menu → kliknij poza nim → menu znika."
---

## 1. PO CO TO ISTNIEJE

Właściciel przeklikał cztery narzędzia Idei i zgłosił 51 uwag. Ta karta zbiera **naprawy zepsutych funkcji**
— rzeczy, które nie działały, a miały. Zmiany wyglądu są w karcie IDE-023.

Wspólny mianownik tych napraw: **objaw kłamał o przyczynie**. W żadnym z pięciu poważnych przypadków
przyczyna nie była tam, gdzie wskazywało zgłoszenie.

## 2. CO DZIAŁA PO ODEBRANIU

**Process Flow — rdzeń wrócił.** Zgłoszenie brzmiało „wszystkie przyciski budowania martwe". Przyciski
działały. Każdy nowy krok lądował zawsze w pierwszym torze — a jeśli ten był zwinięty, znikał na zawsze.
Licznik rósł, płótno stało. Regresja z 4 lipca: logika pozycjonowania z marca × zwijanie torów dodane
w lipcu, nikt nie sprawdził kolizji. Teraz krok trafia w środek kadru, w tor zaznaczenia, zwinięty tor
rozwija się sam, jeden Ctrl+Z cofa i krok, i rozwinięcie. **Klawisz Tab był martwy** — też naprawiony.

**Galeria szablonów działa we wszystkich czterech narzędziach.** Trzy różne przyczyny pod jednym objawem:
odświeżał się licznik, a nie silnik grafu; w Procesie **autozapis nadpisywał świeżo założony szablon starą
treścią**; a na produkcji po każdym autozapisie serwer odrzucał szablon jako konflikt wersji — ostrzeżenie
migało, okno się zamykało.

**Menu prawego kliku zamyka się — w sześciu miejscach w aplikacji.** Przyczyna leżała dwie warstwy niżej:
biblioteka obsługująca przesuwanie płótna zabija kliknięcie, zanim dotrze do kodu zamykającego menu.
Cztery kategorie (AI · Konwersja · Konwertuj gałąź · Wygląd) były martwe na **obu** drogach — i pod
kliknięciem, i pod najechaniem, bo podmenu było przycinane do niewidoczności.

**Komentarze.** Pole pojawiało się tylko przy zaznaczonym elemencie, a domyślny widok to „Cała Idea".
Drugi błąd, niezgłoszony: komentarze przypięte do węzłów **w ogóle nie były widoczne** w tym widoku,
a licznik przy zakładce kłamał.

**Mind Map.** Zoom nie skacze już do 200% — przyczyną był wyścig: kadrowanie odpalało się, zanim
przeglądarka zmierzyła nowy węzeł. Węzły nie nachodzą (odstęp był stały, a świeży pusty węzeł jest wyższy
niż cały odstęp). Da się zmieniać rozmiar węzłów i ramek — a przy okazji wyszło, że **typ „ramka" nie był
w ogóle zarejestrowany** i po przeładowaniu degradował się do zwykłego węzła.

**Tabela.** Timeline nie jest ślepą uliczką — rozróżnia cztery powody pustki i do każdego daje wyjście.
Widoki „Scoring" i „Log decyzji" były **cichymi atrapami** (sortowały po nieistniejących kolumnach).
Widok „Galeria" pokazywał „Brak elementów" przy pełnej tabeli — dane były, komponent je ignorował.

**Eksport.** PDF gubił polskie znaki i zajmował ćwiartkę strony. „SVG (wektor)" nie był wektorem. A przy
błędzie PNG i SVG **po cichu pobierały JSON**, PDF pobierał PNG — bez słowa wyjaśnienia.

**Lewy pasek.** Menu nie są już przycinane. Wyjaśniła się zagadka „SEL" — to wskaźnik trybu kursora,
renderowany trzy piksele za widoczną krawędzią, niewidoczny w stu procentach. Cofnij/Ponów **ożyły
na Tablicy i w Procesie** — pasek dostawał stan tylko z dwóch narzędzi z czterech. Pełny ekran nie gubi
już paska.

**Siedem akcji AI — sprawdzone pojedynczo.** Żadna nie jest atrapą, żadna nie jest martwa.

## 3. JAK ODEBRAĆ

1. **Process Flow:** zwiń pierwszy tor → „Akcja" → krok musi być widoczny. Tab → też dodaje.
2. **Szablony:** w każdym narzędziu „Użyj szablonu" → treść ląduje na płótnie i **przeżywa przeładowanie**.
3. **Menu kontekstowe:** prawy klik → klik poza → znika. Kliknij każdą z czterech kategorii → podmenu zostaje.
4. **Komentarze:** bez zaznaczenia → da się dodać komentarz do całej Idei; komentarze węzłów też widać.
5. **Mind Map:** dodaj węzeł → widok nie skacze, węzły nie nachodzą. Pociągnij róg → rozmiar się zmienia i przeżywa przeładowanie.
6. **Tabela:** Timeline → wyjście działa. Scoring i Log decyzji → pusty stan z akcją, nie ciche nic.
7. **Eksport:** PDF → polskie znaki poprawne, mapa wypełnia stronę.

## 4. CZEGO ŚWIADOMIE NIE MA

- **Stara ścieżka eksportu** (z lewego paska i z palety poleceń) nadal używa poprzedniej implementacji —
  naprawa objęła okno eksportu, nie obie drogi.
- **`computeBranchHealth`** — te same odrzucone „wagi z sufitu" nadal liczą kropki zdrowia przy gałęziach.
  Widget przebudowany, kropki nie.
- **Dwa martwe kliknięcia w Tabeli** — „Dashboard" (komponent bez miejsca renderu) i galeria szablonów
  w ścieżce platformowej (dispatch do reducera, którego nikt nie czyta).
- **Opisy siedmiu akcji AI** — sprawdzone, że działają, ale bez podpowiedzi tłumaczących co robią.

## 5. DROGA ODWROTU

Naprawy błędów weszły **bez flag** — to przywrócenie działania, nie zmiana wyglądu.
Cofnięcie: tag `demo-rollback-pre-idee-noc-2026-07-27` (przed całością) lub
`demo-safe-2026-07-28-decyzje` (po naprawach, przed przebudową powłoki).
