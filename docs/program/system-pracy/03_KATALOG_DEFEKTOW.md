# KATALOG DEFEKTÓW — czego szukać, żeby nie uwierzyć w fałszywe „gotowe"

Narzędzie diagnostyczne. Każda pozycja to wzorzec **wykryty realnie w tym projekcie**, nie teoria.
Przy każdym: jak wygląda · po czym poznać · czym udowodnić · realny przypadek.

**Jak używać:** przy odbiorze każdego dyżuru przejdź kategorie A–D i zaznacz, których szukałeś.
Kategoria, której nikt nie sprawdził, jest kategorią, w której defekt przetrwa.

---

## A. FAŁSZYWE „GOTOWE" — funkcja nie działa, choć wygląda na zrobioną

### A1. Backend ma, front nie woła
Trasy działają, żaden komponent ich nie wywołuje.
**Poznasz po:** `grep` nazwy trasy w `src/` daje zero trafień produkcyjnych (same testy).
**Dowód:** wskaż plik:linia wołacza w `src/`. Brak wołacza = funkcji nie ma.
**Przypadek:** eksport `.docx` w Narzędziach — trasa zamontowana, odpowiada poprawnym plikiem, a jedynym konsumentem był test montujący kontroler na własnym serwerze z atrapą uwierzytelnienia.

### A2. Zapis bez czytelnika
Komenda zapisuje do bazy, żaden odczyt tego nie czyta. Użytkownik zapisze i nigdzie nie zobaczy.
**Poznasz po:** nazwa kolumny/agregatu występuje w repozytorium dokładnie raz.
**Dowód:** zapis przez HTTP → **pełny reload** → odczyt przez HTTP. Nie sam INSERT.

### A3. Ekran działa, baza pusta
Mechanika poprawna, brak danych demo, wszystko wygląda na zepsute.
**Dowód:** `SELECT COUNT(*)` na tabelach, które ekran czyta, po seedzie.

### A4. Nigdy nie zadziałało end-to-end
Front woła ścieżki, których serwer nie ma. Zawsze błąd, także lokalnie.
**Dowód:** realne żądanie HTTP przez prawdziwy Gateway, kod 2xx, readback z bazy.

### A5. Metryka zepsuta z konstrukcji
Panel liczy stan, którego żaden kod nie zapisuje.
**Dowód:** znajdź miejsce, które zapisuje mierzoną wartość. Jeśli nie istnieje — metryka zawsze pokaże zero.

### A6. Cichy połyk — zapis zwraca sukces bez zapisu
Funkcja liczy wynik, nie zapisuje go, i zwraca `200` z policzonym obiektem.
**Poznasz po:** `catch { /* tabela może nie istnieć */ }`, `return built` zamiast `return saved`, brak sprawdzenia `result.changes`.
**Dowód:** wywołaj przez HTTP → niezależny `SELECT`. Zero wierszy przy kodzie sukcesu = połyk.
**Przypadek:** promocja wyniku narzędzia zwracała policzony, ale niezapisany snapshot i raportowała sukces.

### A7. Cicha utrata danych przy parsowaniu
Parser przy nieoczekiwanym wejściu zwraca pustą kolekcję zamiast błędu.
**Poznasz po:** `function parseX(value: string)` wołane z `unknown`; `catch { return [] }`.
**Dowód:** podaj wejście innego typu, sprawdź, czy zwraca `[]` bez ostrzeżenia.
**Przypadek:** punkty, decyzje i działania z notatki ze spotkania mogły zniknąć bez śladu i bez błędu.

---

## B. FAŁSZYWE DOWODY — test lub pomiar nie znaczy tego, co się wydaje

### B1. Test leczy się skutkiem własnego ataku
Przy `retry` atak niszczy zasób; ponowienie dostaje 404 i „nie wykazuje zmian" → PASS.
**Warunek:** skutek trwały i idempotentny (DELETE, destrukcyjny PUT). Sam odczyt nie jest maskowany.
**Dowód:** przebieg z `--retry=0`. Bez tego każde „izolacja X/X PASS" jest podejrzane.

### B2. Test istnieje, przechodzi i nikt go nie uruchamia
Podpięty do niczego: bramkowany nazwą bazy, poza jobem CI, albo w katalogu bez runnera.
**Dowód:** wskaż job CI, który go uruchamia, i warunek `if` tego joba.
**Przypadek:** 49 plików testowych bramkowanych nazwą bazy + cały katalog akceptacyjny bez joba.

### B3. Test pinujący buga
Test asertuje, że wadliwe zachowanie jest zamierzone. Naprawa produktu zapala go na czerwono, więc ktoś „naprawia" przez cofnięcie naprawy.
**Poznasz po:** nazwa testu opisuje ustępstwo („fails open when…", „allows when unknown…").
**Dowód:** przeczytaj asercję i zapytaj: czy tego naprawdę chcemy?
**Przypadek:** cztery testy kanonizowały przepuszczanie żądania przy awarii bazy jako zamierzone.

### B4. Test-tautologia
Przechodzi identycznie z naprawą i bez niej.
**Dowód mutacyjny w obie strony — obowiązkowy:** cofnij naprawę na **kopii** pliku → test musi być czerwony; przywróć → zielony. Nigdy `git stash` (jest współdzielony między worktree).

### B5. Mock bramki i goły serwer zamiast produktu
Test montuje router na własnym `express()` z atrapą tożsamości. Dowodzi, że kod się uruchamia — nie że jest osiągalny.
**Dowód osiągalności:** `ApiGateway.getInstance().initializeRoutes(app)`, podpisany token, realna baza.

### B6. Bramka wcześniejsza maskuje test
Strażnik odpowiada odmową **przed** logiką, którą test bada — wszystkie przypadki wyglądają na „zabezpieczone".
**Poznasz po:** wszystkie odmowy mają ten sam kod i to nie ten, którego badasz.
**Przypadek:** bramka bety zwracała 403 przed autoryzacją, maskując każdy test izolacji dla roli członka.

### B7. Strażnik wyłączony w trybie testowym
Middleware przepuszcza wszystko przy `NODE_ENV=test`, chyba że ustawiono zmienną, której nikt nie ustawia.
**Dowód:** przebieg z jawnym kompletem zmiennych wymuszających egzekucję.
**Przypadek:** 416 twierdzeń o uprawnieniach jednego modułu zmierzono przy wyłączonej ochronie.

### B8. Fałszywy mianownik
Liczba policzona zawężonym wzorcem, która wycina z pomiaru to, co najważniejsze.
**Poznasz po:** liczba podana bez komendy.
**Zasada:** każdy mianownik z komendą; jeśli da się policzyć dwoma sposobami — podaj oba i wskaż wiążący.
**Przypadek:** „336 montaży" liczyło tylko zapisy jednoliniowe i pomijało główną trasę badanego modułu.

### B9. Porównanie po liczbach zamiast po nazwach
Odejmowanie sum ukrywa, że jedne testy zgasły, a inne zapaliły się.
**Zasada:** porównuj zbiory nazw. Zawsze.
**Przypadek:** „regresja" i „naprawy" okazały się artefaktem kolejności plików — izolowany ponowny przebieg dał wynik identyczny.

### B10. Baza podmieniona pod testem
Konfiguracja przybija typ bazy do lekkiej lokalnej, więc „testy bazodanowe" idą na atrapie.
**Skutek:** defekty specyficzne dla PostgreSQL są niewidoczne.

---

## C. DEFEKTY ŚRODOWISKOWE — działa lokalnie, pada na produkcji

### C1. Parsowanie kolumny JSON
Sterownik PostgreSQL zwraca kolumnę `json` jako **obiekt**; `JSON.parse` na niej rzuca wyjątek → 500. Na lekkiej bazie ta sama kolumna jest tekstem i wszystko działa.
**Dowód:** przebieg na realnym PostgreSQL.
**Przypadek:** udostępnianie rozmów linkiem było martwe na każdym PostgreSQL — czyli na demo, stagingu i **produkcji** — a żaden test tego nie widział.

### C2. Flaga wyłączająca połowę produktu
Brak zmiennej → bramka zwraca 404 **przed** uwierzytelnieniem. Pomiar bez niej mierzy nieistnienie.
**Zasada:** komplet zmiennych jawnie w każdej komendzie.

### C3. Zmienna zadeklarowana tylko w jednym obrazie
Flagi klienckie działają w jednym obrazie kontenera, w drugim nie są zadeklarowane — wartości nie docierają do zbudowanej aplikacji.

### C4. Zależność od czcionek, których nie ma poza jednym pakietem biurowym
Dokument wygląda inaczej u odbiorcy; znaki podstawiają się na przypadkowe.
**Zasada:** stos zapasowy czcionek; oceniaj wygląd na czystym systemie.

---

## D. DEFEKTY PROCESU — raport mówi co innego niż kod

### D1. Hipoteza zleceniodawcy wraca jako „zweryfikowany fakt"
Wykonawcy nie testują tez zleceniodawcy — przyjmują je na wiarę i wpisują do rejestru jako potwierdzone.
**Zapobieganie:** teza w instrukcji ZAWSZE jako **rozkaz pomiarowy** („ZMIERZ, czy X — podaj wynik"), nigdy „jest X, napraw". **Obalenie tezy zlecenia jest sukcesem, nie porażką** — napisz to w instrukcji wprost.
**Przypadek:** nieistniejąca podatność weszła do rejestru jako „naprawiona i zweryfikowana".

### D2. Fałszywe twierdzenie w dokumencie dowodowym
Raport ogłasza mechanizm, którego w kodzie nie ma — a w innym miejscu tego samego dokumentu przyznaje, że tego nie sprawdził.
**Poznasz po:** twierdzenie w podsumowaniu, którego nie ma w sekcji dowodów.
**Zasada:** sprawdzaj wyrywkowo twierdzenia nośne w kodzie, zanim podpiszesz.
**Przypadek:** raport twierdził, że bramka ma zabezpieczenie `always()`. Nie miała. Bramka nie potrafiła zaświecić na czerwono.

### D3. Wyciszenie zamiast naprawy
Błąd typów „naprawiony" przez rozluźnienie kontraktu produkcyjnego, rzutowanie zamiast zawężenia, `@ts-ignore`, poszerzenie wykluczeń, obniżenie progu.
**Najgorszy wariant:** kod produkcyjny osłabiony, żeby skompilowała się **fikstura testowa**. Kod produkcyjny nigdy nie ustępuje testowi.
**Poznasz po:** diff zmienia sygnaturę w `src/`, a przyczyną był błąd w pliku testowym.

### D4. Zmiana zachowania przemycona w dyżurze technicznym
Dyżur o typach albo o CI zmienia przy okazji wygląd lub logikę widoczną dla użytkownika.
**Poznasz po:** w diffie dyżuru technicznego pliki widoku/komponentu.
**Zasada:** każda zmiana widoczna wzrokiem wymaga zrzutu i akceptu, niezależnie od tego, w jakim dyżurze powstała.

### D5. Commit obiecujący zmianę, której nie ma
Nagłówek `fix(...)` / `test(...)`, a w commicie wyłącznie dokument.
**Skutek:** historia projektu kłamie; ktoś później uzna temat za załatwiony.

### D6. Kolizja zasobów między równoległymi dyżurami
Dwa dyżury biorą ten sam przedział numerów migracji, port albo plik.
**Przypadek:** trzy z czterech instrukcji przydzieliły sobie identyczny przedział migracji, bo każdy autor liczył wolne numery niezależnie.
**Zapobieganie:** mechaniczny rejestr zasobów sprawdzany **przed** wydaniem fali.

### D7. Bramka, która nie umie zaświecić na czerwono
Job zbiorczy bez zabezpieczenia „wykonaj zawsze" jest **pomijany**, gdy zależność padnie — więc nigdy nie raportuje porażki.
**Dowód:** wstrzyknij celowo czerwony test i pokaż, że bramka jest czerwona. Bramka bez tego dowodu jest dekoracją.

### D8. Permanentnie czerwony CI = zmęczenie alarmem
Gdy bramka jest czerwona od miesięcy, przestaje cokolwiek znaczyć — a pod jej parasolem można ukryć puste joby.
**Przypadek:** 8 z 15 wymaganych jobów wypisywało „odłożone" i kończyło się zielono, pod stale czerwoną bramką stylu.
**Zasada:** czerwona bramka bez terminu spłaty jest gorsza niż jej brak.

### D9. Regresja z nadgorliwości bezpieczeństwa
Utwardzenie zabezpieczenia odcina uprawniony przypadek użycia.
**Poznasz po:** kod odmowy pojawia się tam, gdzie wcześniej była treść.
**Zasada:** przy każdym utwardzeniu zmierz **wszystkie** miejsca montażu, nie próbkę.
**Przypadek:** utwardzenie kontekstu organizacji odcięło czat osobisty użytkownikowi bez organizacji — wbrew intencji zapisanej w komentarzu obok.

### D10. Sierota z fałszywego pomiaru
Komponent uznany za martwy, bo `grep` był zawężony, obcięty potokiem albo pominął ładowanie dynamiczne i rejestry stringów.
**Dowód przed usunięciem:** przejście grafu importów od punktu wejścia; sprawdzenie wzorca ładowania leniwego i map nazw.

### D11. Rejestr kłamiący w obie strony
Status w dokumentacji bywa zawyżony i zaniżony.
**Przypadki:** pozycja „naprawione i zweryfikowane" przy 28 żywych instrukcjach tworzenia tabel w kodzie · dokumentacja mówiła „14 z 55 slotów żywych", pomiar dał 61 z 62 · rejestr pokazywał jedną uwagę właściciela, było ich dziesięć.
**Hierarchia zaufania:** sonda HTTP z odczytem z bazy > test uruchomiony przez odbierającego > `grep` w kodzie > raport wykonawcy > dokumentacja > rejestr.

---

## E. LISTA KONTROLNA ODBIORU — minimum, bez którego nie podpisujesz

1. **Rodowód**: marker jest przodkiem? gałąź jest potomkiem tego, co myślisz? (`git merge-base`)
2. **Kopia zapasowa** wykonana natychmiast po pierwszym commicie.
3. **Dowód mutacyjny w obie strony** dla każdej naprawy bezpieczeństwa.
4. **Osiągalność** udowodniona realnym żądaniem HTTP przez prawdziwy Gateway.
5. **Porównanie po nazwach testów**, nigdy po liczbach.
6. **Każdy mianownik z komendą.**
7. **Zmiany istniejących testów** — sprawdzone jedna po drugiej: naprawa testu pinującego buga czy osłabienie asercji?
8. **Rozłączność**: żaden plik spoza licencji nie został zapisany.
9. **Twierdzenia nośne** — dwa wybrane losowo, sprawdzone osobiście w kodzie.
10. **Sekcja „twierdzenia niezweryfikowane"** w raporcie jest niepusta.

---

## F. ZASADY, KTÓRE WYNIKAJĄ Z TEGO KATALOGU

- **„Testy przeszły" nigdy nie znaczyło „działa".** Zielona suita jest dowodem dopiero wtedy, gdy wiesz, którą pułapkę z sekcji B omija.
- **Grep dowodzi, że łańcuch istnieje — nie że działa.**
- **Raport wykonawcy to deklaracja.** Status nadaje odbiór z dowodem plik:linia albo pomiarem.
- **Uczciwe „nie wiem" jest warte więcej niż ładna liczba.** Wykonawcy zaniżają równie często, jak zawyżają — sprawdzaj w obie strony.
- **Zasadny STOP to najcenniejszy produkt dyżuru**, nie jego porażka.
