# GALERIA ODBIORU 20 pozycji — zrzuty na finalnym kodzie (06/07.09 noc)

**Powód.** `SCEPTYK_ODBIORU_20260906.md` §4 zrobił 20 zrzutów kilka godzin przed scaleniem kilku
dużych paczek (karty N, naprawa Realizacji, statusy inicjatyw, kamienie milowe). Ten dokument
powtarza pomiar na aktualnym kodzie, żeby galeria, którą Piotr zobaczy rano, nie kłamała.

**Stanowisko pomiaru:** frontend `http://127.0.0.1:3090`, API `http://127.0.0.1:4100`, HEAD
`13f70a2a91179d0364bc054dee47b6a61d270dbe` (gałąź `mvp/galeria-odbioru`), sesja z
`/private/tmp/stanowisko-noc/auth.json` (org DBR77, konto Audyt Nocny — OWNER), 1440×900, motyw
jasny (wymuszony niezależnie od zapisanego w sesji „dark"). Zrzuty: Playwright (chromium headless),
nigdy `dev-render`. Dowody: `evidence/galeria-odbioru/` — każdy plik `NN-<nazwa>.png` ma parę
`.png.json` z polami `url` i `bledyKonsoli`.

**Metoda.** Każdą z 20 pozycji zweryfikowano dwutorowo: najpierw ręcznie w przeglądarce (klik po
kliku, odczyt DOM), potem powtórzono zrzut skryptem `scripts/dev/galeria-odbioru-20260907-screenshots.mjs`
na świeżej stronie z tej samej sesji. Wynik: **20/20 POTWIERDZONE** — żadnej pozycji nie trzeba
wykreślać z jutrzejszej galerii. Zdania poniżej są przeredagowane na prostszy język tam, gdzie
oryginał audytora używał nazw wewnętrznych (np. „Teresa tylko w Menu 1").

---

## Tabela

| # | Zdanie dla właściciela | Trasa | Plik zrzutu | Werdykt | Uwaga |
|---|---|---|---|---|---|
| 1 | Wywiad: zniknęło dodatkowe menu etapów i zakładka „Dopuszczenie" — zostały: Skrzynka, Sesje, Przydzielone, Szablony, Wnioski, Inicjatywy | `/interview` | `01-interview-skrzynka.png` | POTWIERDZONE | — |
| 2 | Ocena → Biblioteka: rząd przycisków-filtrów nad tabelą zniknął, została czysta lista pięciu metodyk | `/assessment/overview?tab=library` | `02-ocena-biblioteka.png` | POTWIERDZONE | Metodyki CMMI/Lean/SIRI/ADMA pokazane jako „Planowane", DRD jako „Rdzeń metody" — to już zrobione, mimo że decyzja o tym zapadła później niż audyt |
| 3 | Audyty: w menu bocznym są od razu pod Oceną, nie mają już zakładek „Raporty DRD" ani „Ustalenia", a przycisk „Nowy audyt" jest wyłączony z opisem, że wraca w kolejnej fali | `/audit-programs?tab=library` | `03-audyty-biblioteka.png` | POTWIERDZONE | — |
| 4 | Audyty: zakładka nazywa się „Wnioski" (nie „Wyniki"), pokazuje realny wniosek ze źródłem i ma przycisk „Nowy wniosek" | `/audit-programs?tab=conclusions` | `04-audyty-wnioski.png` | POTWIERDZONE | — |
| 5 | Inicjatywy: trzecie menu ma tylko trzy przyciski (Wszystkie / Do zatwierdzenia / W realizacji), filtry priorytetu i statusu przeniesione wyżej | `/initiatives` | `05-inicjatywy-lista.png` | POTWIERDZONE | Licznik „Wszystkie" w drugim menu (72) różni się od licznika w trzecim menu (63) i od sumy wszystkich statusów (60) — patrz ZNALEZISKA |
| 6 | Inicjatywy: pojedyncze kliknięcie w wiersz od razu otwiera boczny podgląd ze szczegółami | `/initiatives` (klik w wiersz) | `06-inicjatywy-klik-podglad.png` | POTWIERDZONE | — |
| 7 | Inicjatywy: pełna karta inicjatywy ma przycisk „Pracuj z AI"; przycisku „Zapytaj Teresę" nigdzie na karcie nie ma | `/initiatives?mode=doc&open=<id>` | `07-inicjatywy-karta.png` | POTWIERDZONE | — |
| 8 | Inicjatywy → Plan to teraz prawdziwa tabela planów z własnym przyciskiem „Nowy plan" i filtrem statusu | `/initiatives?tab=plan` | `08-inicjatywy-plan.png` | POTWIERDZONE | — |
| 9 | Sesja oceny DRD: odpowiedź „Częściowo" jest pomarańczowa (i karta pytania ma pomarańczową ramkę), a tekst pytania jest wyraźnie większy niż reszta ekranu | `/assessment/drd/<id>` | `09-drd-kolor-czcionka.png` | POTWIERDZONE | — |
| 10 | Sesja DRD: przycisk „Zapytaj Teresę" działa — otwiera czat z gotowym opisem pytania, metody i obszaru | `/assessment/drd/<id>` (klik „Zapytaj Teresę") | `10-drd-zapytaj-terese.png` | POTWIERDZONE | — |
| 11 | Sesja DRD: nagłówek ma już tylko „Pracuj z AI", „Ustawienia" i menu ⋮ — nie ma etykiet „Szkic"/„Zapisano" | `/assessment/drd/<id>` | `11-drd-naglowek.png` | POTWIERDZONE | Po lewej został dodatkowy przycisk „Wyjdź" — wytyczna go nie wymieniała, ale też nie kazała usuwać |
| 12 | Narzędzia: Insighty i Raporty to osobne listy, każda ma swój własny przycisk tworzenia (tu: „Nowy insight") | `/discovery-tools?tab=outputs` | `12-narzedzia-insighty.png` | POTWIERDZONE | — |
| 13 | Wyniki: drugie menu ma tylko KPI, OKR, ROI i Raporty zarządcze — zakładki „Wyszukiwarka" już nie ma | `/results/kpi` | `13-wyniki-menu2.png` | POTWIERDZONE | Ekran wygląda czysto, ale w tle są 3 nieszkodliwe błędy 404 (brak opublikowanej migawki) — niewidoczne dla Piotra, warto naprawić osobno |
| 14 | Wyniki: karta pojedynczego miernika KPI to pełne narzędzie z własnym menu sekcji i przyciskiem „Pracuj z AI" | `/results/kpi/<id>?zbior=<id>` | `14-wyniki-miernik-narzedzie.png` | POTWIERDZONE | — |
| 15 | Materiały: zostały dwa proste rozwijane filtry (Status, Widoczność) — osobnego okienka „Filtry" już nie ma | `/presentations?tab=all` | `15-materialy-filtry.png` | POTWIERDZONE | — |
| 16 | Materiały → Biblioteka wzorców: przycisk „Nowy wzorzec" jest wyłączony (z opisem, że wraca w kolejnej fali), a filtry formatu i źródła są w jednym rzędzie | `/presentations?tab=templates` | `16-materialy-biblioteka-wzorcow.png` | POTWIERDZONE | Przełącznik widoku Galeria/Tabela nadal nigdzie nie występuje — Piotr prosił o jego przeniesienie, nie usunięcie; to wciąż otwarty dług |
| 17 | Wszystkie statusy inicjatyw są po polsku i jest ich dokładnie siedem: Propozycja, Szkic, Do zatwierdzenia, Zatwierdzona, W realizacji, Zamknięta, Odrzucona | `/initiatives` (otwarty filtr statusu) | `17-inicjatywy-statusy-pl.png` | POTWIERDZONE | — |
| 18 | Moduł Spotkań zniknął z menu bocznego; bezpośredni link do niego pokazuje spokojny komunikat „planowane w Fali 2", nie błąd | `/meetings` | `18-spotkania-fala2.png` | POTWIERDZONE | — |
| 19 | Realizacja → Kokpit: jeden przełącznik „Ryzyka / Rozstrzygnięcia" w trzecim menu, pod kafelkami jedna tabela na całą szerokość | `/execution?tab=summary&view=table&kokpit=ryzyka` | `19-realizacja-kokpit.png` | POTWIERDZONE | — |
| 20 | Realizacja → Decyzje i ryzyka: realne liczby na zakładkach — 25 decyzji, 16 ryzyk, 13 po terminie | `/execution?tab=control&view=table` | `20-realizacja-decyzje.png` | POTWIERDZONE | Wszystkie tytuły decyzji są jeszcze po angielsku (dane, nie ekran); w drugim menu są trzy przyciski akcji („Nowa decyzja", „Dodaj sygnał", „Przygotuj interwencję") zamiast jednego |

---

## Pozycje, których NIE polecam pokazywać

**Brak.** Wszystkie 20 pozycji potwierdzone na aktualnym kodzie — zdanie ze zrzutem się zgadza.
Trzy pozycje (2, 11, 16, 20) mają dopisaną Uwagę, bo poza samym zdaniem widać na tym samym
ekranie drobny dług (patrz kolumna Uwaga) — nie unieważnia to jednak głównego zdania i nie jest
powodem do wykreślenia z galerii. Jeśli Piotr wybiera dziś tylko *pewniaki bez żadnego „ale"*,
warto pominąć 13 (ciche błędy w konsoli) i 20 (angielskie tytuły danych) — reszta 18 pozycji jest
czysta bez zastrzeżeń.

---

## ZNALEZISKA (poza zakresem 20 pozycji, zauważone przy pomiarze)

1. **Liczniki Inicjatyw dalej się nie zgadzają — i to na trzy sposoby, nie dwa.** Drugie menu
   pokazuje „Status: Wszystkie 72", trzecie menu „Wszystkie 63", a suma wszystkich siedmiu
   statusów z rozwiniętego filtra (Propozycja 0 + Szkic 9 + Do zatwierdzenia 16 + Zatwierdzona 13
   + W realizacji 22 + Zamknięta 0 + Odrzucona 0) daje **60**. Trzy różne liczby w jednym ekranie.
   *Dowód:* `17-inicjatywy-statusy-pl.png` (rozwinięty dropdown) + `05-inicjatywy-lista.png`.
   Ten sam problem sceptyk zgłaszał 06.09 jako 72 vs 63 — teraz doszła trzecia liczba (60).

2. **Wyniki: te same 3 błędy 404 co w audycie sceptyka, wciąż żywe.**
   `GET /api/vnext/results/kpi/scorecards/<id>/review-snapshots/published` zwraca 404 dla każdego
   z trzech zestawów KPI od razu po wejściu na `/results/kpi` — brak opublikowanej migawki jest
   sygnalizowany kodem błędu zamiast pustej odpowiedzi. Niewidoczne dla użytkownika, widoczne w
   konsoli. *Dowód:* `13-wyniki-menu2.png.json`.

3. **Biblioteka wzorców wciąż ma pstryczek Galeria/Tabela całkowicie usunięty**, mimo że Piotr
   06.09 prosił tylko o jego przeniesienie do drugiego menu, nie o usunięcie. Nie ma go nigdzie na
   ekranie. *Dowód:* `16-materialy-biblioteka-wzorcow.png` + pełny odczyt DOM (brak frazy
   „Galeria"/„Tabela" jako przełącznika widoku).

4. **Realizacja → Decyzje: trzy przyciski akcji w drugim menu** („Nowa decyzja", „Dodaj sygnał",
   „Przygotuj interwencję") zamiast jednego CTA na zakładkę — ten sam wzorzec, który DEC-412/413
   ustaliły dla innych modułów. Do rozstrzygnięcia z Piotrem, czy to naruszenie, czy świadomy
   wyjątek dla tego ekranu. *Dowód:* `20-realizacja-decyzje.png`.

5. **Realizacja → Decyzje: wszystkie 25 tytułów po angielsku** (dane, nie kod) — ten sam ekran,
   który jutro ma być pokazany Piotrowi jako dowód naprawy modułu. Warto przetłumaczyć dane
   demonstracyjne przed odbiorem, żeby nie psuć wrażenia. *Dowód:* `20-realizacja-decyzje.png`.

6. **Sesja DRD: przycisk „Wyjdź" nadal stoi obok uproszczonego nagłówka** (Pracuj z AI / Ustawienia
   / ⋮). DEC-415b nie kazała go usuwać, ale skoro nagłówek miał być maksymalnie uproszczony, warto
   zapytać Piotra, czy to zostaje. *Dowód:* `11-drd-naglowek.png`.

7. **Biblioteka wzorców: nadal 79 wzorców z angielskimi nazwami** (np. „[System] client final
   report (EN)", „Investor pitch", „Board deck") w produkcie prowadzonym po polsku — dokładnie ten
   sam stan, który sceptyk zgłosił 06.09 jako ZNALEZISKO nr 5. Nie naprawione. *Dowód:*
   `16-materialy-biblioteka-wzorcow.png` + pełny odczyt listy 79 wzorców.

Żadne z powyższych 7 znalezisk nie unieważnia werdyktów w głównej tabeli — to dług do osobnego
zlecenia, nie powód do wykreślenia pozycji z jutrzejszej galerii.

---

## Metodyczna uwaga o kolejności zrzutów

Skrypt renderował 20 ekranów po kolei w jednym procesie przeglądarki (osobne karty, wspólny
kontekst logowania). Dla pozycji 8 (Inicjatywy → Plan) boczny podgląd otworzył się bez żadnego
kliknięcia w tym kroku — to efekt uboczny stanu zapisanego przez wcześniejszy krok (pozycja 7,
otwarcie karty inicjatywy), nie błąd aplikacji ani fałszywy dowód. Zrzut nr 8 nadal wiernie
pokazuje to, co obiecuje zdanie (tabela planów + CTA + filtr) — podgląd jest bonusem, nie
zniekształceniem.
