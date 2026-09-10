# Karta przejścia — Inicjatywy i Realizacja (10.09.2026, wieczór)

Piotrze, dwa moduły, które wycofałeś 7 września, zostały naprawione i **sprawdzone przeze mnie
klikaniem, zanim je zobaczysz**. Poniżej: co działa, czego jeszcze nie zobaczysz, i ścieżka
8 kroków do samodzielnego przejścia na stagingu.

---

## 1. Inicjatywy

**Co działa.** Lista pokazuje prawdziwy status każdej inicjatywy — koniec z „Zatwierdzona" przy
inicjatywie, która czeka na zatwierdzenie. Kartę można edytować: właściciel, priorytet i opisy
zapisują się od razu i są tam po odświeżeniu strony; ryzyka (RAID) dodają się, zmieniają i kasują
za pierwszym razem, bez błędów w tle.

**Czego nie ma.** Nadal nie da się **zatwierdzić** inicjatywy — to nie jest usterka, tylko brakująca
decyzja, którą musisz podjąć (punkt 5 z karty decyzji). Aplikacja mówi Ci to teraz **po polsku**:
„Brakuje aktualnej decyzji GO komitetu." Wcześniej mówiła po angielsku.

---

## 2. Realizacja

**Co działa.** Wszystkie sześć zakładek otwiera się bez błędów. W zakładce „Praca" zadanie da się
w końcu **prowadzić**: menu przy zadaniu ma 6 pozycji zamiast 2 (otwórz, przypisz osobę, ustaw
status, podgląd, usuń), a status przechodzi całą drogę Do zrobienia → W toku → W przeglądzie →
Wykonane i zostaje po odświeżeniu. „Otwórz zadanie" nie wyrzuca już komunikatu „Nie znaleziono
zadania". W zakładce „Realizacje" menu nie ma już zdublowanej pozycji, a wyszarzone „Usuń"
tłumaczy po polsku, dlaczego jest wyłączone.

**Czego nie ma.** Zakładka „Zasoby" nadal pokazuje **obłożenie 0 %** — bo nikt nie wpisał, ile
pracy wymagają inicjatywy (to punkt 2 z karty decyzji, czeka na Ciebie). Historia zmian zadania
jest pusta — brakuje jednej tabeli w bazie, naprawiamy osobno.

---

## 3. Ścieżka do przejścia na stagingu (8 kroków, ~10 minut)

Adres: **https://staging.consultify.ai**, Twoje konto.

| # | Co zrobić | Co powinieneś zobaczyć |
|---|---|---|
| 1 | Wejdź w **Inicjatywy** | Lista inicjatyw. Sprawdź kolumnę STATUS w pierwszych wierszach — inicjatywy „Do zatwierdzenia" mają być opisane jako „Do zatwierdzenia", nie „Zatwierdzona" |
| 2 | Kliknij dwa razy w pierwszą inicjatywę z listy | Otwiera się karta inicjatywy; po prawej panel WŁAŚCIWOŚCI ze statusem, priorytetem i właścicielem |
| 3 | Przełącz u góry karty na **Edycja** i zmień **Priorytet** na „Wysoki" | Zmiana zapisuje się sama. Odśwież stronę (F5) — „Wysoki" ma tam nadal być |
| 4 | W polu **OPIS PROBLEMU** dopisz zdanie i kliknij poza pole | Napis „Zapisano" u góry karty. Odśwież stronę — Twoje zdanie ma tam być |
| 5 | Kliknij duży przycisk **Zatwierdź inicjatywę** i potwierdź | Na dole pojawi się czerwony komunikat **„Brakuje aktualnej decyzji GO komitetu."** — **tak ma być**, to czeka na Twoją decyzję nr 5. Jeśli inicjatywa nie ma właściciela, najpierw zobaczysz komunikat, że brakuje właściciela |
| 6 | Wejdź w **Realizacja → Praca** | Lista zadań (na stagingu ok. 115). Chipy u góry: Wszystkie / Po terminie / Zablokowane |
| 7 | Kliknij w **nazwę** zadania ze statusem „Do zrobienia" (w pierwszą kolumnę, nie w kolumnę OSOBA) | Po prawej otwiera się podgląd zadania. Na jego dole cztery przyciski: **Zmień osobę · Zmień termin · Zmień status · Zamknij zadanie** |
| 8 | Kliknij **Zmień status**, wybierz „W toku", potem odśwież stronę | W tabeli w kolumnie STATUS ma być „W toku". Powtórz: Zmień status → „W przeglądzie", a potem **Zamknij zadanie** → „Wykonane" |

Dodatkowo, jeśli chcesz sprawdzić menu przy zadaniu: najedź na wiersz i kliknij trzy kropki po
prawej. Ma być 6 pozycji, w tym „Ustaw status: …". Wszystkie działają.

---

## 4. Czego NIE zobaczysz jako działającego (świadomie)

1. **Zatwierdzenia inicjatywy.** Silnik działa, ale brakuje decyzji, jak komitet ma tę zgodę
   wystawiać — to Twoja **decyzja nr 5** z karty decyzji. Do tego czasu każda inicjatywa zatrzyma
   się na „Do zatwierdzenia" i powie o tym po polsku.
2. **Obłożenia zespołu.** Zakładka „Zasoby" pokazuje 0 %, bo nikt nie wpisał zapotrzebowania na
   ludzi w inicjatywach — to Twoja **decyzja nr 2**.
3. **Nowej inicjatywy z formularza — tylko częściowo.** Utworzysz ją i zobaczysz na liście, tytuł
   i opis się zapisują. Ale pozostałe pola karty są na razie zablokowane, a karta mówi Ci to wprost:
   „Ta inicjatywa jest w nowym rejestrze — edycja z karty będzie dostępna po scaleniu rejestrów".
   To celowa blokada zamiast dawnego cichego gubienia danych. **Uwaga:** do takiej świeżo utworzonej
   inicjatywy nie wrócisz linkiem ani po odświeżeniu — trzeba ją otworzyć z listy (jest na górze).
4. **Kreatora inicjatywy AI.** Otwiera się i jest po polsku, ale samej generacji nie sprawdziłem —
   na moim stanowisku konta AI nie mają środków. To jedyna rzecz, której **nie potwierdzam**.
5. **Historii zmian zadania.** Będzie pusta — brakuje jednej tabeli w bazie, na liście do naprawy.
6. **Drobiazgów kosmetycznych, które mogą Cię ukłuć:** w komunikacie o brakującym właścicielu widać
   dosłowne `\n` (poprawka na 10 minut); na karcie inicjatywy sekcja zadań nazywa się „Tasks",
   a przycisk „Dodaj task"; tytuł na karcie potrafi być po angielsku, choć na liście jest po polsku
   (dwa źródła nazwy — do złączenia w bloku „jeden magazyn").

---

## 5. Dwa obrazy — po jednym na moduł

Zrobione przeze mnie na realnym ekranie, 1440 px, motyw jasny, bez żadnych ozdób i bez kreatora:

| Moduł | Plik | Co pokazuje |
|---|---|---|
| **Inicjatywy** | `evidence/w2b-odbior/OBRAZ-1-inicjatywa-karta-edycja.png` | Karta inicjatywy w trybie Edycja: zapisany opis problemu, priorytet „Wysoki", właściciel „Ewa Nowicka", status „Do zatwierdzenia", napis „Zapisano" |
| **Realizacja** | `evidence/w2b-odbior/OBRAZ-2-zadanie-podglad-pasek-akcji.png` | Zadanie po pełnej zmianie statusu: w tabeli i w podglądzie „Wykonane", na dole panelu pasek czterech akcji (Zmień osobę · Zmień termin · Zmień status · Zamknij zadanie) |

---

## 6. Jedna rzecz, którą trzeba sprawdzić przed Twoim przejściem

Znalazłem jeden błąd, którego wcześniej nie było na liście: na koncie **zwykłego członka zespołu**
(nie administratora) w Realizacja → Praca pozycja menu „Zaktualizuj zadanie" kończy się ekranem
błędu z połową zdania po angielsku. Nie wiem, czy Twoje konto (administrator) w ogóle może w to
wejść — na moim stanowisku nie miałem na czym tego powtórzyć. **Jeśli w kroku 7–8 zobaczysz
w menu „Zaktualizuj zadanie" zamiast „Ustaw status", zatrzymaj się i daj znać** — to ta ścieżka.
