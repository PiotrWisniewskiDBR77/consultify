# Odbiór na żywo 05.09 — pakiet 11 „Audyty” (4 ekrany)

## Liczby
- ZGODNY: 0
- ROZNI_SIE: 2
- NIE_DOTARLEM: 2

## Różnice
1. **audyty-piec-powierzchni** — kompozycja zgadza się co do elementu (6 zakładek, 5 chipów, 8 kolumn, pstryczek, „Nowy audyt”), ale tabela jest pusta: „Brak pakietów audytowych”, wszystkie liczniki 0.
2. **audyty-drd-report** — ekranu z obrazu (Menu 2 „Programy audytu | Raporty DRD” + tabela PROGRAM|OCENA|STATUS|AKTUALIZACJA) w aplikacji nie ma; trasa pojedynczego raportu jest za flagą domyślnie wyłączoną, a po jej włączeniu (`?ff_drd_report=1`) raport jest pusty („Raport jest pusty” + gradientowy przycisk „Wygeneruj pełny raport”, którego nie kliknąłem).

## Nie dotarłem
- **audyty-warsztat-kryterium** — zakładka „Sesje” pusta (wszystkie chipy etapów 0), Biblioteka bez pakietów; nie ma audytu do otwarcia, a nowego nie zakładałem.
- **audyty-raport-dokument** — zakładka „Raporty” pusta; jej własny komunikat mówi wprost: „Raport powstaje z Outputu programu audytowego. W tej wersji interfejsu ścieżka wystawienia raportu nie jest dostępna z ekranu.”

## Wniosek dla właściciela
Cały moduł Audyty jest w danych właściciela **pusty**: zero pakietów audytowych, zero sesji, zero raportów, zero ustaleń, zero Proposal Draftów. Trzy z czterech ekranów tego pakietu to ekrany, które da się zobaczyć dopiero po założeniu audytu. Skorupa (paski, chipy, kolumny, stany puste) jest zgodna z kanonem i wygląda dobrze — ale nic w niej nie stoi.

## Czas i trudności
Ok. 20 min. Trudność jedna: `/audit-programs/drd-report/:id` bez parametru flagi po cichu przekierowuje na Bibliotekę, więc łatwo uznać, że trasa nie istnieje; identyfikator raportu trzeba było wyciągnąć z `/api/assessment-reports`.
