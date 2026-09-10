# Trzy decyzje wizualne właściciela — 10.09.2026

Zrzuty wysłane 09.09, decyzje podjęte 10.09 rano. Do wykonania osobną paczką,
po scaleniu P2A/P2B (dotykają tych samych plików).

| # | Pytanie | Decyzja właściciela | Skutek dla kodu |
|---|---|---|---|
| DEC-454 | Przycisk tworzenia inicjatywy: menu z wyborem czy wprost kreator | **Wprost w kreator — zostaje jak dziś** | Zero zmian. Pozycja zamknięta. |
| DEC-455 | Plakietka „Attention Required" czerwona przy statusie gotowym | **Bursztynowa** | Czerwień zostaje wyłącznie dla semantyki krytycznej (CLAUDE.md §3). Zmienić token koloru plakietki. |
| DEC-456 | Zapis daty rzymską cyfrą („IX 2026") | **Zamienić na „wrz 2026"** | Skrót miesiąca zamiast rzymskiej cyfry. Szukać po funkcji formatującej, nie per wywołanie. |

## Uwaga wykonawcza do DEC-456
Naprawa per wywołanie w tym projekcie odrasta — defekt zalatany w jednym module wrócił po ośmiu
tygodniach w dwunastu plikach. Wykonawca ma najpierw znaleźć wspólną funkcję formatującą datę
i wypisać WSZYSTKIE jej wywołania, a dopiero potem naprawiać. Jeśli funkcji nie ma i format jest
sklejany w wielu miejscach — to jest STOP do zameldowania, nie do załatania w jednym ekranie.

## Uwaga wykonawcza do DEC-455
Plakietka ma być bursztynowa tylko tam, gdzie status NIE jest krytyczny. Sprawdzić, czy dziś
kolor jest w ogóle zależny od statusu, czy przybity na stałe — to zmienia zakres naprawy.
