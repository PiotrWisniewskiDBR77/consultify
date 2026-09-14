# Sygnalizacja ryzyka Realizacji — kontrakt E0

Status: **PROTOTYP DO AKCEPTU WŁAŚCICIELA; bez kodu produkcyjnego**  
Zakres: F2-2 E0, R1.4–R1.5, DEC-487 i DEC-493  
Flaga docelowa: `VITE_EXECUTION_FOUR_BUTTONS`, domyślnie OFF

## Granica dowodowa

CTO wskazał artefakt `8c073b0a` jako wzorzec wizualny. Artefakt nie występuje w bazie gałęzi ani w plikowym kanale CTO. Zgodność z nim ma status **EVIDENCE_MISSING**. Poniższy prototyp realizuje zapisany kontrakt DEC-487/493, ale nie twierdzi, że odtwarza niedostępny artefakt.

## Co mierzymy

Każda realizacja ma trzy niezależne osie. Oś bez dowodu nie dziedziczy wyniku z innej osi.

| Oś                  | Pytanie                                                                               | Źródło                                                                 | Wynik                             |
| ------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Poślizg wobec planu | O ile aktualny lub zakończony przebieg odchyla się od zatwierdzonej bazy odniesienia? | baseline + actual/current observation, każde z `asOf`                  | poziom 0–3 albo `UNKNOWN(reason)` |
| Zagrożenie terminu  | Czy prognoza końca przekracza tolerancję projektu?                                    | baseline finish + forecast finish + czas trwania + parametr tolerancji | poziom 0–3 albo `UNKNOWN(reason)` |
| Ekspozycja RAID     | Jak wysoka jest zmierzona ekspozycja otwartych pozycji RAID?                          | prawdopodobieństwo × wpływ liczone w kodzie                            | poziom 0–3 albo `UNKNOWN(reason)` |

Tolerancja prognozy to większa wartość z: **5 dni roboczych** albo **5% czasu trwania projektu**. Jest jawnie parametryzowana per projekt. Brak parametru, czasu trwania, baseline albo prognozy daje `UNKNOWN` z konkretnym powodem; nie daje poziomu 0.

## Skala i semantyka

| Poziom | Znaczenie                                                       | Tokeny                                                    | Ikona i tekst                       |
| -----: | --------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
|      0 | w tolerancji, brak zmierzonego przekroczenia                    | `c-success-*`                                             | `CheckCircle2` + „W tolerancji”     |
|      1 | obserwacja, która wymaga uwagi właściciela                      | `c-warning-*` w lekkim tonie                              | `Clock3` + „Obserwuj”               |
|      2 | wysokie odchylenie lub ekspozycja, potrzebne działanie          | `c-warning-*` w mocnym tonie                              | `TriangleAlert` + „Działanie”       |
|      3 | krytyczne naruszenie bazy odniesienia albo krytyczna ekspozycja | `c-danger-*` / crimson wyłącznie jako semantyka krytyczna | `ShieldAlert` + „Komitet”           |
|      — | brak wystarczających danych                                     | `c-surface-muted`, `c-text-muted`, `c-border-subtle`      | `CircleHelp` + „Brak danych: powód” |

Kolor nigdy nie jest jedynym nośnikiem. Każdy sygnał ma ikonę, nazwę osi, poziom, krótki werdykt i `asOf`. Fokus interaktywny używa `c-focus`.

## Reguła agregacji

1. Pastylka zbiorcza przyjmuje najwyższy **zmierzony** poziom spośród trzech osi.
2. Oś `UNKNOWN` nie podnosi ani nie obniża wyniku.
3. Pastylka jest szara wyłącznie wtedy, gdy wszystkie trzy osie mają `UNKNOWN`.
4. Podgląd zawsze pokazuje mianownik, np. `2/3 osie zmierzone`, i nazwy brakujących dowodów.
5. Poziom 0 nie oznacza „bez ryzyka”; oznacza wyłącznie brak przekroczenia w danych dostępnych na wskazane `asOf`.

## Decyzja poziomu 3

Poziom 3 kieruje sprawę do komitetu. Quorum wynosi 2 z 3. Sponsor jest obowiązkowy, jeśli decyzja dotyczy budżetu. Po pięciu dniach roboczych bez quorum rozstrzyga sponsor. Każde wezwanie, głos, brak quorum, przekazanie sponsorowi i wynik muszą mieć ślad. Ten dokument definiuje prezentację sygnału; silnik zatwierdzeń i role pochodzą z F2-3.

## Warianty wizualne

### Wariant A — trzy osie w wierszu, rekomendowany

W tabeli: pastylka zbiorcza i trzy małe ikony osi. W podglądzie: trzy równorzędne, poziome karty z werdyktem, wartością, `asOf` i wejściem do dowodu. Pozwala szybko skanować Bank, a po otwarciu nie ukrywa żadnej osi.

### Wariant B — pionowy ślad dowodowy

W tabeli: ta sama pastylka zbiorcza. W podglądzie: pionowa lista osi z linią od pomiaru do reguły i działania. Jest najlepsza do audytu, ale zajmuje więcej wysokości i wolniej porównuje trzy osie.

### Wariant C — macierz 3 × 4

W tabeli i podglądzie: trzy wiersze osi i cztery kolumny poziomów, z zaznaczonym polem. Dobrze objaśnia skalę podczas wdrożenia, ale jest zbyt ciężka do codziennego skanowania. Może pozostać jako legenda pomocy, nie jako domyślny Bank.

Rekomendacja do akceptu: **A jako widok codzienny, C jako legenda pomocy**. B pozostaje wariantem dla widoku audytowego.

## Jasny i ciemny motyw

Oba motywy używają tych samych tokenów `c-*`; nie mają osobnych wartości RGB w komponencie. Tło, obramowanie i tekst zmieniają się z motywem aplikacji. Semantyczny poziom sygnału pozostaje czytelny bez polegania na samym kolorze. Oba warianty zostały sprawdzone w przeglądarce przy 1440×900. Trwałe, różne pliki PNG oraz ich sumy SHA-256 znajdują się w `evidence/f2-2-realizacja/e0/`; szczegóły są w receipcie E0.

## Bramka przed kodem produkcyjnym

Kod produkcyjnej sygnalizacji może powstać dopiero po literze właściciela akceptującej wariant. Do tego czasu wolno rozwijać niezależne elementy Banku: filtry, jedną tożsamość użytkową, linię czasu, wspólny zbiór czterech widoków i horyzonty.
