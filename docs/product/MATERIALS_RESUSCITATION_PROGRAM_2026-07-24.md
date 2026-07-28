# Program resuscytacji Materialow

Status: PLAN WYKONAWCZY DO AKCEPTACJI  
Data: 2026-07-24  
Rola architekta: Codex  
Rola wykonawcy: Claude  
Kanon produktu: MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md

## 1. Cel

Przeksztalcic obecny, rozproszony zestaw dokumentow, prezentacji, arkuszy, bibliotek i generatorow w jeden rzeczywisty system Materialow:

    Materialy
      -> Dokument | Prezentacja | Arkusz
      -> Czysto | Z AI | Z szablonu
      -> generacja z kontekstu
      -> edycja, review i eksport

Plan nie zaklada przepisywania dzialajacych silnikow. Priorytetem jest ponowne wykorzystanie, podlaczenie i uporzadkowanie istniejących elementow.

## 2. Zasady wykonawcze

1. Najpierw potwierdzamy rzeczywiste polaczenia danych i kodu, potem zmieniamy UX.
2. Jeden task Claude'a ma jeden cel, mierzalny DoD i udokumentowany wynik.
3. Nie budujemy nowego generatora szablonow, gdy istnieje generator lub architekt do rozszerzenia.
4. Nie usuwamy legacy przed migracja wywolan, danych i deep linkow.
5. Pierwszy ekran uzytkownika jest prosty; konfiguracja blueprintu jest drugim poziomem.
6. Kazda zmiana interfejsu wymaga testu przejscia, zrzutu ekranu i wskazania, jaki rejestr danych zostal uzyty.

## 3. Stan rozpoznany

| Obszar | Co istnieje | Ocena |
|---|---|---|
| Materialy | Hub z formatami, filtrami i Template Library | Zachowac shell, uproscic menu i CTA. |
| Dokument | Document Studio, rejestr document_studio_templates, edytor blueprintu, persystencja, statusy | Najlepsza baza dla wspolnego systemu szablonow. |
| Raport Builder | Blokowy edytor tresci, ustawienia blokow, preview i generacja | Zachowac jako wzorzec konfiguracji blokow; ustalic relacje do Document Studio. |
| Prezentacje | Osobny builder i presentation_templates | Polaczyc adapterem z biblioteka i launcherem. |
| Arkusze | Generator workbookow, formuly i eksport XLSX, odrebne template flow | Polaczyc z Materialami; nie mylic z Table Studio. |
| Template Library | Widok i kreator, ale dane wygladaja na zduplikowane i raportowe | Najpierw audyt zrodel i deduplikacji. |
| Table Studio | Dane relacyjne i wlasne base templates | Zostaje zrodlem danych; nie jest katalogiem szablonow Excel. |

## 4. Faza R0 - mapa rzeczywistosci

Cel: doprowadzic do stanu, w ktorym kazdy ekran ma znane zrodlo, route, API, rejestr i docelowa decyzje.

### Zadanie R0.1 - audyt szesciu przeplywow

Claude przygotowuje jedna tabele dla:

1. material dokument;
2. material prezentacja;
3. material arkusz;
4. szablon dokument;
5. szablon prezentacja;
6. szablon arkusz.

Kolumny obowiazkowe:

- wejscie i route;
- komponenty frontend;
- CTA i ich handlery;
- endpointy/API;
- tabela lub rejestr;
- generator;
- edytor;
- eksport;
- aktualne dane demonstracyjne;
- klasyfikacja KEEP, CONNECT, HIDE albo LEGACY;
- ryzyko i brak.

DoD: zadna pozycja nie jest opisana jako prawdopodobnie. Kazda ma link do pliku/kodu albo jawny brak.

### Zadanie R0.2 - prawda Template Library

Claude ustala:

- skad pochodza rekordy widoczne w Template Library;
- dlaczego widoczne sa duplikaty;
- ktore typy sa prawdziwie obslugiwane;
- czy stan, scope, licznik i data sa prawda czy seedem;
- czy klikniecie szablonu prowadzi do kanonicznego blueprintu.

DoD: krotki raport z query/adapterami oraz lista bledow danych bez ich naprawiania.

Brama R0: architekt zatwierdza klasyfikacje i wskazuje jedyny rejestr kanoniczny dla kazdego formatu.

## 5. Faza R1 - kontrakty i adaptery

Cel: biblioteka i launchery maja wspolny jezyk, ale formaty zachowuja wlasne silniki.

> Aktualne rozstrzygniecia po audycie R0 sa w MATERIALS_R0_ARCHITECT_DECISIONS_2026-07-24.md. W szczegolnosci v8_artifact_origin_links jest indeksem biblioteki, nie zrodlem prawdy, a tp_base_templates nie wolno przedstawic jako szablonow Excel.

### R1.1 Wspolny kontrakt szablonu

Wprowadzic jeden model odczytu OutputTemplate oraz adaptery:

| Format | Zrodlo kanoniczne |
|---|---|
| Dokument | document_studio_templates |
| Prezentacja | presentation_templates |
| Arkusz | workbook template registry |

Legacy report_builder_templates i tp_base_templates nie sa zwracane jako nowy katalog bez jawnego adaptera migracyjnego.

DoD:

- wspolny katalog zwraca format, scope, status, blueprint, wersje i lineage;
- kazdy wynik wskazuje zrodlo/rejestr;
- rekordy nie dubluja sie przy jednym canonicalId;
- test obejmuje po jednym rekordzie trzech formatow.

### R1.2 Wspolny kontrakt startu

Wprowadzic wspolny CreationIntent dla artefaktu i szablonu. Format oraz sposob startu nie sa kodowane w rozproszonych stringach poszczegolnych launcherow.

DoD:

- launcher zwraca format i start;
- wybor Z szablonu niesie prawdziwy templateId i blueprint;
- kontekst z projektu, narzedzia lub rozmowy jest przekazywany jako sourceContext;
- bledny lub niedostepny template ma uczciwy stan bledu.

Brama R1: architekt zatwierdza model na trzech prawdziwych rekordach i jednym scenariuszu legacy.

## 6. Faza R2 - wspolne wejscia i biblioteka

Cel: uzytkownik widzi jeden prosty punkt startu, a nie techniczny chaos.

### R2.1 Launcher materialu

Z Materialow i z CTA kontekstowych:

1. Dokument / Prezentacja / Arkusz.
2. Czysto / Z AI / Z szablonu.
3. Dopiero potem szczegoly niezbedne do wykonania.

DoD:

- pierwszy ekran nie ma duzego formularza;
- wszystkie trzy formaty sa dostepne;
- Czysto nie udaje AI ani wyboru szablonu;
- Z AI otwiera Terese z celem i kontekstem;
- Z szablonu tworzy realny draft z blueprintu.

### R2.2 Launcher szablonu

Z zakladki Szablony:

1. Dokument / Prezentacja / Arkusz.
2. Czysto / Z AI / Na bazie istniejacego.
3. Edytor blueprintu.

Istniejacy modal New template nalezy rozszerzyc, a nie zastapic. Nazwa i scope nie powinny blokowac pierwszego wyboru; domyslnie tworzony jest prywatny draft.

### R2.3 Porzadek menu

Menu Materialow zawiera: Wszystkie, Dokumenty, Prezentacje, Arkusze, Szablony. Osobny Excel w sidebarze i osobne zakladki architektow nie sa czescia glownej nawigacji po R2.

DoD: stare wejscia pozostaja dostepne przez kontrolowane redirecty, ale nowy uzytkownik nie dostaje dwoch konkurencyjnych drog.

Brama R2: test manualny dziewieciu kombinacji format x start oraz screenshoty desktop/mobile.

## 7. Faza R3 - pionowe przeplywy

Cel: kazdy format dziala od wyboru do eksportu, nie tylko do wizualnego ekranu.

### R3.1 Dokument

Korzysta z Document Studio i jego rejestru. Blueprint sekcji jest faktycznie stosowany w generacji i eksporcie.

### R3.2 Prezentacja

Korzysta z presentation_templates i buildera deckow. Blueprint slajdow oraz zasady narracji sa stosowane w generacji i eksporcie PPTX/PDF.

### R3.3 Arkusz

Korzysta z workbook template registry. Blueprint workbooka tworzy sheets, formuly, formatowanie i wykresy, a wynik eksportuje sie do XLSX.

DoD kazdego przeplywu:

- utworzenie Czysto, Z AI i Z szablonu;
- widoczny kontekst i zrodla;
- edycja lub review draftu;
- poprawny eksport;
- test z prawdziwym szablonem i z brakiem szablonu;
- screenshot bez placeholderow lub surowych danych technicznych.

Brama R3: akceptacja Piotra po testach na jednym realnym scenariuszu konsultingowym dla kazdego formatu.

## 8. Faza R4 - wygaszanie legacy

Cel: usunac chaos uzytkownika bez nieodwracalnego kasowania.

1. Przekierowac stare wejscia do Materialow lub odpowiedniego edytora.
2. Oznaczyc komponenty i rejestry jako legacy.
3. Przeniesc lub zmapowac dane, ktore maja aktywne uzycie.
4. Dopiero po okresie obserwacji usuwac martwy kod.

DoD: brak podstawowej sciezki prowadzacej do legacy, telemetrycznie potwierdzone brak wywolan, zachowane deep linki o ile sa potrzebne.

## 9. Sposob pracy Claude'a

Claude nie wykonuje wiecej niz jednej fazy bez odbioru. Kazde przekazanie zawiera:

1. liste zmienionych plikow;
2. opis, co zostalo polaczone;
3. screeny przed/po;
4. testy oraz wynik;
5. znane ograniczenia;
6. pytania decyzyjne, jezeli wymaga ich nastepna faza.

Nie przyjmujemy sformulowan typu gotowe bez dowodu przeplywu od klikniecia do rejestru i eksportu.

## 10. Pierwsze polecenie dla Claude'a

Wykonaj tylko R0.1 i R0.2 w trybie read-only. Nie zmieniaj kodu, migracji ani danych. Dostarcz tabelaryczny audyt szesciu przeplywow oraz raport o Template Library z linkami do route, komponentu, handlera, endpointu i rejestru. Oznacz kazdy element KEEP, CONNECT, HIDE albo LEGACY. Zatrzymaj sie po raporcie.
