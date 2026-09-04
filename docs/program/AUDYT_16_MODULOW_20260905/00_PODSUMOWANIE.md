# Audyt 16 modułów — stan na 2026-09-05 rano

Przygotowane w nocy 04/05.09 z istniejących rejestrów i pomiaru stagingu. Nic tu nie jest oceną „z pamięci”: każda pozycja w plikach modułów ma źródło.

## Co się zmieniło dziś wieczorem

1. Staging `b852ade6` (23:33) ma włączone **30 przełączników**, które od 28.08 miały być włączone Twoją decyzją DEC-227, a nie były. Sprawdzone w wbudowanym pakiecie: 30 z 30 = `true`.
2. Czat blokował się na naszym liczniku 30 żądań/min (liczył też odpytywanie w tle). Licznik wyłączony na stagingu.
3. Cztery przełączniki nie wchodziły do budowy, bo Dockerfile nie przekazywał ich do Vite — dopisane (`b852ade6`).
4. Lokalne stanowisko na jutro: `http://localhost:3000` = kod z linii m03 + realny backend i dane stagingu, zmiany widoczne natychmiast. Start: konfiguracja `lokalnie-staging-20260905` w podglądzie albo `bash /private/tmp/m03/scripts/dev/lokalnie-staging-20260905.sh`.
5. Celowo WYŁĄCZONE zostały tylko: prawy panel Notatnika i SWOT 7 etapów (Twoja decyzja: fala 2), tor Word w studio (zabiera prawy pasek), zakładka Archiwum Wyników i kontrakt kart 7 typów (nieodebrane), prawy pas jedna formuła (sam odrzuciłeś 01.09).

## Dlaczego przez tydzień widziałeś „starą wersję”

Twoje 250+ obrazów oglądałeś na przyrządzie, który montuje komponent wprost, z pominięciem przełącznika. Na stagingu przełączniki były wyłączone, więc ten sam kod pokazywał stary ekran. Do tego 41 ekranów przyrządu miało kompozycję inną niż produkt (29 z nich oceniłeś), a jedna naprawa (macierz DRD) poszła po dwóch powierzchniach z czterech. To są trzy różne przyczyny i każda ma inne lekarstwo: przełącznik, poprawa przyrządu, naprawa we wszystkich miejscach naraz.

## Tabela modułów

| # | Moduł | Ekrany zatwierdzone | Z Twoją uwagą | Realne defekty (korpus) | Zapisane rozjazdy układu | Bez Twojej decyzji | „nie”/„poprawka” |
|---|---|---|---|---|---|---|---|
| 01 | [Czat](01_Czat.md) | 15 | 8 | 2 | 7 | 0 | 0 |
| 02 | [Moja Praca](02_Moja_Praca.md) | 37 | 19 | 5 | 10 | 2 | 0 |
| 03 | [Wywiad](03_Wywiad.md) | 6 | 2 | 2 | 0 | 0 | 0 |
| 04 | [Narzędzia](04_Narzędzia.md) | 10 | 4 | 2 | 4 | 1 | 0 |
| 05 | [Ocena](05_Ocena.md) | 19 | 9 | 6 | 6 | 2 | 0 |
| 06 | [Inicjatywy](06_Inicjatywy.md) | 7 | 4 | 3 | 3 | 2 | 0 |
| 07 | [Realizacja](07_Realizacja.md) | 11 | 5 | 1 | 0 | 3 | 1 |
| 08 | [Wyniki](08_Wyniki.md) | 22 | 12 | 9 | 15 | 1 | 1 |
| 09 | [Finanse](09_Finanse.md) | 16 | 4 | 2 | 11 | 3 | 1 |
| 10 | [Materiały](10_Materiały.md) | 42 | 15 | 7 | 5 | 4 | 1 |
| 11 | [Audyty](11_Audyty.md) | 4 | 1 | 0 | 1 | 0 | 0 |
| 12 | [Spotkania](12_Spotkania.md) | 3 | 1 | 1 | 1 | 0 | 0 |
| 13 | [Organizacja](13_Organizacja.md) | 22 | 0 | 0 | 1 | 1 | 0 |
| 14 | [Panel administratora](14_Panel_administratora.md) | 75 | 3 | 1 | 1 | 30 | 0 |
| 15 | [Ustawienia](15_Ustawienia.md) | 11 | 0 | 0 | 0 | 3 | 0 |
| 16 | [Portal partnerski](16_Portal_partnerski.md) | 12 (poza rejestrem status.json, odbiór 02.09) | 1 | 0 | 0 | 0 | 0 |
| | **Razem** | **300** | **87** | **41** | **65** | **52** | **4** |

Do tego aneks 17: elementy wspólne (13 ekranów kanonu) i ekrany przed zalogowaniem (6).

## Pięć spraw, które zabolą najbardziej — proponowana kolejność jutro

1. **Ocena — macierz DRD w Raporcie** nadal stara (piąty raz). Jedna naprawa we wszystkich miejscach naraz. Potrzebna Twoja odpowiedź: pełna siatka 9×7 z treścią czy siatka z zaznaczonym poziomem.
2. **Wyniki — 9 realnych defektów** z Twoich uwag, najwięcej w aplikacji. Moduł do dziś rano był w większości wyłączony.
3. **Materiały — 7 defektów + generatory szablonów** („nie wiem, po co on jest”) + brak edycji arkusza i prezentacji.
4. **Moja Praca — 5 defektów**, w tym karta decyzji trzymająca dane w przeglądarce zamiast na serwerze.
5. **Panel administratora — 8 tras z błędem 500** dla zwykłego użytkownika, 3 z surowym SQL.

## Jak jutro pracujemy

- Ty otwierasz `http://localhost:3000` (lub staging) i idziesz modułami od góry: Czat → Moja Praca → Wywiad → Narzędzia → Ocena → Inicjatywy → Realizacja → Wyniki → Finanse → Materiały → Audyty → Spotkania → Organizacja → Panel administratora → Ustawienia → Partner.
- Przy każdym ekranie ja mam otwarty plik modułu: co zatwierdziłeś (obraz), co wiemy o rozjazdach, Twoje uwagi. Mówisz „inne” albo „nie działa”, ja od razu wskazuję przyczynę: przełącznik, przyrząd, brak naprawy, albo nowy defekt.
- Zmiany robimy lokalnie na żywo. Na staging wchodzą jedną paczką pod koniec dnia, po Twoim „tak” na tym, co widzisz lokalnie.
- Czego nie zgłaszać (żeby nie tracić czasu): sekcja D w każdym pliku modułu, „Znane ograniczenia stagingu”.

## Czego ten audyt NIE zrobił

- Nie porównał obrazów z żywym stagingiem piksel w piksel, bo nie mogę zalogować się za Ciebie. Kolumna „rozjazdy układu” to to, co ZAPISANO w audytach 01–03.09, nie pełny obraz.
- Nie sprawdził klikiem 8 tras 500 po dzisiejszym wdrożeniu (pomiar z 04.09 rano).
- Nie przeliczył bramek G15/G19/G20 — liczby z rejestru, stan 273/336 bez zmian.
