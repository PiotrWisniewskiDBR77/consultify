# DECYZJE CTO — Materiały · 2026-07-27

> Mandat Piotra (27.07, dosłownie): „to ty jesteś CTO i PM, ja jestem wizjonerem. Rozumiem, że
> funkcję celu znasz, więc ty najlepiej wybierzesz."
> Poniżej rozstrzygnięcia, które podjąłem sam, żeby nie blokować pracy. Każda z uzasadnieniem.
> Piotr może każdą odwrócić jednym zdaniem — to nie są decyzje nieodwracalne.
>
> **Funkcja celu** (moje rozumienie, na podstawie całości współpracy): Consultify ma zamieniać
> wiedzę organizacji w materiały, które konsultant może bez wstydu położyć na stole klientowi —
> szybko, lekko, bez wyklikiwania, z liczbami, których nie trzeba sprawdzać. Wszystko, co temu
> służy, ma pierwszeństwo. Wszystko, co jest „ładne, ale nie zmienia doświadczenia klienta",
> czeka.

## D1. Excel czyta księgę faktów organizacji — TAK
**Powód:** dziś silnik Excela nie zna ani jednej liczby z organizacji (`grep factBook|spine|financialEngine`
w `server/src/services/workbook/**` = 0). To gwarantuje, że arkusz i prezentacja o tym samym
projekcie pokażą sprzeczne liczby — a to jest dokładnie ten rodzaj wpadki, który kosztuje
konsultanta reputację u klienta. Wchodzi do Fazy C razem z wpięciem Excela w silnik treści.

## D2. Kolejność brakujących modeli arkusza: NPV/IRR → budżet vs wykonanie → porównanie wariantów
**Powód:** doradztwo najczęściej odpowiada na „czy ten projekt się opłaca" (dziś BRAK — mamy DCF,
ale on wycenia spółkę, nie projekt), potem „czy trzymamy budżet", potem „który wariant lepszy".
Pozostałe (capacity, dashboard KPI) później.

## D3. Kolory czcionki w modelu (niebieskie=wejście, czarne=formuła, zielone=z innego arkusza) — TAK
**Powód:** to standard rynkowy modelowania finansowego; bez niego analityk klienta nie wie, co
wolno mu ruszyć. Dziś ustawiamy tylko tło, nie kolor czcionki. Zmiana widoczna na istniejących
arkuszach — akceptuję, bo idzie w stronę standardu, nie od niego.

## D4. Brak arkusza Założeń i cykl w formułach = błąd BLOKUJĄCY — TAK
**Powód:** dziś arkusz bez założeń dostaje 100/100 od bramki jakości. Arkusz bez założeń nie
pozwala nic zasymulować, czyli nie spełnia wymagania Piotra („żeby symulować, przekładać,
kombinować"). Bramka, która tego nie widzi, jest ozdobą.

## D5. Zakładka „Wnioski" w arkuszu — obowiązkowa tylko, gdy arkusz idzie do klienta samodzielnie
**Powód:** arkusz będący załącznikiem do raportu nie musi dublować wniosków; arkusz wysyłany sam
— musi, bo inaczej klient dostaje liczby bez interpretacji.

## D6. Dwa ekrany Excela → jedna tożsamość arkusza
**Powód:** dziś ekran generacji ma poprawny prawy panel, a ekran otwartego arkusza dzieli
komponent z Idea Table i nie ma żadnej tożsamości arkusza. To jest źródło wrażenia „tabele
o niczym". Excel dostaje wspólną powłokę modułową (jak Word i Deck) z lewym railem arkuszy,
reużywając istniejący `ExceleRightPanel`. Wchodzi po Fazie B.

## D7. Kolejność faz bez zmian: A → B → C → D
**Powód:** Faza A (kanon) zrobiona. Faza B (przepływ) daje Piotrowi natychmiast widoczną zmianę
i jest tania, bo to podłączanie istniejących klocków. Faza C (mózg) jest najcięższa i najbardziej
ryzykowna — wchodzi, gdy przepływ jest już stabilny. Faza D (generatory szablonów) na końcu, bo
bazuje na kanonie z A i ramie z B.

## D8. Galeria szablonów z miniaturami — najpierw prototyp, nie od razu wdrożenie
**Powód:** to jedyna NOWA powierzchnia wizualna w planie. Reguła #7 (Piotr nie jest pierwszym
testerem wizualnym) obowiązuje — prototyp w dev-render, zrzut, akcept, dopiero rollout.

## D9. Unifikacja dwóch silników dokumentów (P3.3) — koncept teraz, kod PO urodzinach
**Powód:** to jedyna robota klasy L/XL w całym programie. Wciśnięta w tydzień urodzinowy grozi
rozwałką tego, co właśnie naprawiliśmy. Do urodzin oba silniki żyją obok siebie poprawnie
(shimy P0 z 27.07 to gwarantują).

## D10. Nazwa modułu „Materiały" — zaparkowana
**Powód:** Piotr sam powiedział „powinniśmy go pewnie inaczej nazwać, ale później o tym".
Zmiana nazwy to koszt w wielu miejscach przy zerowym wpływie na doświadczenie — nie w tym tygodniu.

## Co ZOSTAJE decyzją Piotra (nie moją)
- Czy „Consultify is ready" ogłaszamy na urodziny — to jego ocena produktu, nie moja.
- Akcepty wizualne (reguła #7) — każda nowa powierzchnia.
- Priorytet: czy po Fazie D idziemy w unifikację silników, czy w złote ścieżki reszty produktu.
