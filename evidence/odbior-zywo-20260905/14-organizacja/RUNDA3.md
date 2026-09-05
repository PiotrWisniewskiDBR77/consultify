# RUNDA 3 — 14-organizacja (05.09.2026)

Decyzja właściciela 05.09 (DEC-2026-09-05-395): redesign (11 skonsolidowanych ekranów, flaga `orgRedesignV1` domyślnie ON od 03.09) jest WZORCEM. Wszystkie 21 starych obrazów referencyjnych są nieaktualne — nie porównuję już do nich kompozycji, tylko potwierdzam, że 4 zgłoszone dziś defekty redesignu są naprawione.

## Cztery zgłoszone defekty — status po weryfikacji na żywo (świeże zrzuty)
1. **Martwa zakładka 'Model dostawy'** (org-operating-model) — NAPRAWIONE: pigułka teraz znika dynamicznie, gdy typ organizacji nie ma modelu dostawy (SHA `0fa43c4b72`), zamiast pokazywać się i nie renderować treści.
2. **Podpisy grup wyboru niewidoczne** (org-stakeholder-expectations, dziś zakładka 'Tryb współpracy') — NAPRAWIONE: `OrgChoiceSegment` renderuje widoczny podpis nad każdą grupą pigułek (Archetyp transformacji/Rola AI/Rytm nadzoru), SHA `c628c7e403`.
3. **Surowy JSON w podsumowaniu** (org-summary) — NAPRAWIONE: `summarizeClaimValue()`/`claimValueKey()` pokazują czytelne opisy konfliktów zamiast `JSON.stringify()`, SHA `97cd77a4e6`/`68fb43dcd8`.
4. **Chipy typów encji i nazwy scenariuszy po angielsku** (org-knowledge-graph chip 'risk', org-scenarios nazwy scenariuszy) — NAPRAWIONE: chip 'risk' → 'Ryzyko', wszystkie 6 nazw scenariuszy po polsku (Fundament cyfrowy, Rewolucja doświadczenia klienta, itd.).

Dodatkowo: zgłoszenie 'uboższa treść' na org-technology-culture-constraints było fałszywym alarmem (porównanie z niewłaściwym ekranem) — obronione testem regresyjnym, treść bez zmian kodu.

| id | werdykt rano (R2) | werdykt teraz (R3) | co pokazać |
|---|---|---|---|
| org-identity-operating | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać skonsolidowaną powłokę 'Tożsamość i model działania' (pigułki zakładek Tożsamość/Skala/Rynki i systemy, chipy Wszystkie/Uzupełnione/Do uzupełnienia/Konflikty, prawy panel 'Stan danych') zamiast starego pojedynczego ekranu z pierścieniem Kompletność. |
| org-operating-model | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC, defekt naprawiony: zakładka 'Model dostawy' już nie jest martwa — pigułka poprawnie ZNIKA, gdy typ organizacji (tu: Technologie) nie ma zdefiniowanego modelu dostawy, więc widoczne są tylko Tożsamość/Skala/Rynki i systemy; pokazać ten dynamiczny zestaw zakładek. |
| org-position-direction | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Kierunek i ograniczenia', zakładkę 'Pozycja i priorytety' (Pozycja konkurencyjna/Etap wzrostu/Priorytety strategiczne/Misja/Wizja) w nowej powłoce z prawym panelem 'Stan danych'. |
| org-technology-culture-constraints | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC (wcześniejsze zgłoszenie 'uboższa treść' było fałszywym alarmem — audytor porównał z innym ekranem, kod broniony testem regresyjnym): pokazać zakładkę 'Technologia' w 'Kierunek i ograniczenia' z 4 polami (Dojrzałość cyfrowa/Stos technologiczny/Poziom adopcji chmury/Budżet cyfrowy). |
| org-strategic-intent | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Cele i mierniki', zakładkę 'Intencja strategiczna' (Cel nadrzędny/Cele drugorzędne/Priorytety jako pigułki wielokrotnego wyboru) z prawym panelem 'Stan danych' zamiast starego nagłówka 'Save Changes'. |
| org-success-metrics | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ten sam ekran 'Cele i mierniki', zakładkę 'Mierniki sukcesu' z kartą KPI i uczciwym stanem pustym 'Brak pozycji' + 'Dodaj miernik'. |
| org-scope-boundaries | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Zakres i tryb współpracy', zakładkę 'Zakres' (pola 'W zakresie'/'Poza zakresem' z uczciwym stanem pustym). |
| org-stakeholder-expectations | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC, defekt naprawiony: treść nie zginęła przy konsolidacji — to zakładka 'Tryb współpracy' tego samego ekranu, a grupy pigułek (Archetyp transformacji/Rola AI/Rytm nadzoru) mają teraz WIDOCZNE podpisy nad sobą (wcześniej podpis był tylko w aria-label); pokazać tę zakładkę z widocznymi nagłówkami grup. |
| org-declared-challenges | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Wyzwania i dowody', zakładkę 'Zadeklarowane wyzwania' z uczciwym stanem pustym 'Brak pozycji' + 'Dodaj wyzwanie'. |
| org-root-causes | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Przyczyny i blokery', zakładkę 'Przyczyny źródłowe' z 4 pytaniami-podpowiedziami i polami tekstowymi. |
| org-goal-blockers | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ten sam ekran 'Przyczyny i blokery', sekcję/zakładkę 'Blokery' poniżej 'Przyczyn źródłowych'. |
| org-evidence | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Wyzwania i dowody', zakładkę 'Dowody' (karta 'Dokumenty pomocnicze' z przyciskiem 'Wgraj dokument' i uczciwym stanem pustym). |
| org-risks-opportunities | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Ryzyka i szanse' z obiema zakładkami 'Ryzyka'/'Szanse' i uczciwymi stanami pustymi 'Dodaj ryzyko'/'Dodaj szansę'. |
| org-scenarios | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC, defekt naprawiony: nazwy 6 scenariuszy transformacji są już w całości po polsku (Fundament cyfrowy/Rewolucja doświadczenia klienta/Doskonałość operacyjna/Transformacja napędzana AI/Innowacja modelu biznesowego/Organizacja oparta na danych); pokazać ekran 'Scenariusze i brief', zakładkę 'Scenariusze transformacji' z banerem rekomendacji. |
| org-recommendation | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: osobny ekran 'Rekomendacja' nie istnieje — to realna konsolidacja: rekomendacja jest banerem u góry zakładki 'Scenariusze transformacji' (patrz org-scenarios); pokazać ten baner. |
| org-executive-brief | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ekran 'Scenariusze i brief', zakładkę 'Executive brief' (karty Profil organizacji/Dojrzałość/Wybrany scenariusz). |
| org-files | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać wspólny ekran 'Źródła i twierdzenia' (bez zakładek), sekcję 'Pliki' z uczciwym, uzasadnionym stanem 'NIEZWERYFIKOWANE' (wyjaśnienie, czemu nie ma listy/uploadu) zamiast fikcyjnej listy plików. |
| org-claims-sources | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: pokazać ten sam ekran 'Źródła i twierdzenia', sekcję 'Źródła (192)' z listą źródeł (Organization Context Store, Pomysł z Moja Praca, Sesja narzędzia...). |
| org-source-conflicts | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC: 'Konflikty źródeł' to ta sama strona co 'Źródła i twierdzenia' — pokazać sekcję 'Konflikty (4)' obok 'Źródła (192)' na jednej stronie, bez osobnej trasy. |
| org-knowledge-graph | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC, defekt naprawiony: wszystkie 4 chipy typów encji są już po polsku (Miernik/Ryzyko/Technologia/Osoba — 'risk' zmienione na 'Ryzyko'); pokazać pasek statystyk (Encje/Relacje/Śr. pewność/Nieaktualne/Zredagowane) + chipy + szukajkę. |
| org-summary | ROZNI_SIE | **NOWY_WZORZEC** | NOWY_WZORZEC, poważny defekt naprawiony: sekcja 'Co blokuje i kogo zatrzymuje' pokazuje już czytelne podsumowania konfliktów zamiast surowego JSON-a (np. 'Złożona wartość (13 pól)' zamiast '{"section":"goals"...}'); pokazać ekran 'Gotowość organizacji' z 5 kaflami 'Pięć wymiarów gotowości' i listą konfliktów. |

## Liczby
- NOWY_WZORZEC: 21 (wszystkie 21 — kompozycja = redesign zaakceptowany jako wzorzec; 4 realne defekty potwierdzone jako naprawione na świeżych zrzutach)
- ROZNI_SIE: 0

## ROZNI_SIE ze specyfikacją naprawy
Brak.