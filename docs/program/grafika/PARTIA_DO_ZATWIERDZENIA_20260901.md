---
doc_id: grafika-partia-do-zatwierdzenia-20260901
status: canonical
truth_type: worklist
established: 2026-09-01
zrodlo: docs/program/grafika/status.json (po aktualizacji 01.09, fala 174) + docs/program/grafika/odbior.sqlite (tabela `decyzje`) + evidence/grafika/174-domkniecie/ (zrzuty PRZED/PO obejrzane osobiście przed każdą zmianą oceny)
snapshot: 2026-09-01, po dyżurze „174-domkniecie"
---

# Partia do ostatniego zatwierdzenia — 1 września

Pięć ekranów zamkniętych w tym dyżurze. Poniżej spis do przejrzenia: co poprawiliśmy
na Twoją uwagę, co zmieniło się na ekranach, które już raz zaakceptowałeś, co
zostaje otwarte i czego jeszcze nie widziałeś, a już wiemy, że kuleje.

---

## 1. Poprawione na Twoją uwagę

| Ekran | Twoja uwaga | Co zmieniliśmy |
| --- | --- | --- |
| Plan inicjatyw (zakładka „Plan") | „Problem polega na tym, że narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę. W ogóle nie rozumiem, jak to działa." | Menu przy wierszu teraz jako pierwszą pozycję ma „Otwórz kartę inicjatywy" (wcześniej otwierało kolejną tabelę). Ten sam widok przestał też wciskać drugą, pełną tabelę pod pierwszą, gdy otwierasz narzędzia planu. **Domknięte w całości.** |
| Zakładka „Zasoby" (Realizacja) | Wcześniejsza uwaga o pasku nad tabelą już naprawiona; przy okazji domykania znaleźliśmy dwa dodatkowe błędy i naprawiliśmy je razem. | Angielskie skróty stanów (typu „UNKNOWN") zamienione na polskie słowa („Nieznane"); poprawiona literówka w nazwisku „Katarzyna WóJcik" → „Katarzyna Wójcik". **Domknięte w całości.** |
| Kolejka uwagi (Administracja) | „A może lepiej jakąś tabelę, gdzie będzie można filtrować po typach uwag." | Kartki zamieniliśmy na tabelę z filtrami — to było zrobione wcześniej. Ta zmiana zgubiła po drodze link do ekranu źródłowego przy każdym wierszu; dziś go przywróciliśmy (strzałka obok treści i pozycja w menu przy wierszu). Jeden błąd zostaje — patrz sekcja 3. |
| Prezentacje — trzy stany szablonu | „Nie otwiera mi się nic :(" | Ekran, który otwierał się domyślnie, faktycznie teraz coś pokazuje zamiast pustego koła ładowania. Dodatkowo: jeśli ładowanie się zawiesi, po 20 sekundach pokazuje się czytelny komunikat błędu z przyciskiem powrotu, zamiast wisieć bez końca. **Domknięte w całości.** |
| Sprawa odchylenia (KPI) | „Zrobiłeś grafikę jak sprzed 5 lat, to nie jest spójne z naszą formą UI/UX." | Ekran przestał mówić językiem programisty (nazwy plików, techniczne stany) — teraz tłumaczy zwykłymi zdaniami, np. że plan musi zatwierdzić ktoś inny niż osoba, która go złożyła. Poprawiliśmy też checkbox nieczytelny w ciemnym motywie. **Poprawione tylko częściowo — prawdopodobne źródło Twojej skargi zostaje otwarte, patrz sekcja 3.** |

Wszystkie pięć obejrzane osobiście na świeżych zrzutach PRZED/PO (oba motywy,
jasny i ciemny, tam gdzie dotyczyło) przed podniesieniem lub utrzymaniem oceny.

---

## 2. ★ Zmienione po Twoim akcepcie

Dziesięć ekranów, które już raz zaakceptowałeś, a które zmieniły się przy okazji
dwóch porządków zrobionych w tej samej turze co powyższe poprawki. Nie są to
poprawki na Twoją uwagę — to świadome ujednolicenie standardu, o którym powinieneś
wiedzieć, zanim zobaczysz różnicę.

**A. Czat Teresy zniknął z bocznych paneli artefaktów** — zastąpiony przyciskiem
„Zapytaj Teresę o…". Powód: Teresa ma mieć jedno miejsce w aplikacji (własne okno
rozmowy), a nie osobną, skróconą kopię w każdym panelu bocznym. Dotyczy:

- Panel notatnika (Moja praca)
- Karta inicjatywy
- Rekord inicjatywy
- Deck (sześć slajdów)
- Excel — prawy panel

**B. Szerokość prawego panelu ujednolicona do jednego wymiaru** (320 px) na
wszystkich ekranach-artefaktach — wcześniej różniła się między ekranami. Dotyczy:

- Mapa myśli
- Inspektor pomysłu (Moja praca)
- Panel Teresy (Moja praca)
- Arkusz (podgląd)
- Dokument doradczy (pełny widok)
- Excel — prawy panel (dotyczy obu porządków naraz)

Dla wszystkich sześciu ekranów z tej listy mamy tylko świeży zrzut PO, bez
odpowiednika PRZED — nie da się z samych obrazów potwierdzić, jak dokładnie
zmieniła się szerokość względem wersji, którą widziałeś wcześniej. Wymagają
Twojego ponownego rzutu oka, nie tylko naszego słowa.

---

## 3. Zostaje otwarte

| Co | Dlaczego nie zrobione |
| --- | --- |
| Wygląd otwartej, edytowalnej Sprawy odchylenia (płaskie pola formularza, szare przyciski) | Ten dyżur poprawił język ekranu i inny jego stan (sprawę zamkniętą), nie stylowanie samego formularza. To prawdopodobnie właściwe źródło Twojej skargi „jak sprzed 5 lat" — wymaga osobnej rundy poświęconej wyłącznie wyglądowi tego formularza. |
| „Ryzyka wymagające przeglądu" w Kolejce uwagi zawsze pokazuje 0 | To błąd w kodzie (odczyt niewłaściwego pola z odpowiedzi serwera), nie kwestia wyglądu — zgłoszony wcześniej do toru funkcji, czeka na robotę inżynierską, nie graficzną. |

---

## 4. Nowe znane wyjątki

Rzeczy, które sami znaleźliśmy przy okazji tej partii i zgłaszamy zawczasu:

- **Kolejka uwagi (Administracja):** kolumna „Źródło" pokazuje surowe adresy
  techniczne (np. „GET /api/admin/health-panel/summary") zamiast czytelnej nazwy
  sygnału. Wygląda na artefakt programistyczny, który przecieka do interfejsu —
  do naprawy w kolejnej fali.

---

Obejrzysz to na stronie odbioru pod `http://127.0.0.1:3030`.
