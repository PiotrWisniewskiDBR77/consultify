# Consultify — standard interfejsu n-Type

**Wersja:** 1.0  
**Data:** 2026-07-23  
**Zakres:** Decyzja, Zadanie, Powiadomienie, Insight, Narzędzie, Inicjatywa  
**Poza zakresem:** Sesja wywiadu — nie jest artefaktem n-Type i nie podlega temu audytowi.

---

## 1. Cel standardu

Celem standardu jest zbudowanie jednego, przewidywalnego układu dla wszystkich artefaktów n-Type. Użytkownik ma zawsze:

- rozpoznawać strukturę ekranu bez względu na typ artefaktu,
- znajdować te same kategorie informacji w tych samych miejscach,
- rozumieć różnicę między nawigacją, edycją, akcją biznesową i funkcją AI,
- pracować w centralnym obszarze bez utraty dostępu do kart, właściwości i historii,
- mieć spójne zachowanie pól, paneli i przycisków.

Standard nie ujednolica treści biznesowej poszczególnych artefaktów. Ujednolica ich **szkielet, zachowanie i język interfejsu**.

---

## 2. Kanoniczny układ ekranu

Każdy ekran n-Type składa się z pięciu stałych obszarów:

1. **Menu pierwszego poziomu** — identyfikacja artefaktu i najważniejsze działanie.
2. **Menu drugiego poziomu** — zarządzanie kartami, trybem pracy i pomocą kontekstową.
3. **Lewy panel kart** — lista kart dostępnych w danym artefakcie.
4. **Centralny obszar roboczy** — treść aktywnej karty.
5. **Prawy panel systemowy** — akcje, właściwości, relacje, źródła, komentarze i historia.

Opcjonalnie może zostać otwarty dodatkowy **panel rozmowy z AI**. Nie zastępuje on prawego panelu systemowego.

---

# 3. Menu pierwszego poziomu

## 3.1. Kolejność elementów

Od lewej:

1. Strzałka powrotu.
2. Ikona typu artefaktu, jeżeli system jej używa.
3. Edytowalna nazwa konkretnego artefaktu.
4. Status.
5. Informacja o zapisaniu, jeżeli jest potrzebna.

Od prawej:

6. Przycisk **AI**.
7. Jeden główny przycisk działania — tylko gdy istnieje jedna oczywista i jednoznaczna akcja.
8. Menu trzech kropek.

## 3.2. Główna akcja w nagłówku

Główny przycisk może znaleźć się w nagłówku wyłącznie wtedy, gdy:

- istnieje dokładnie jedna rekomendowana akcja wynikająca z bieżącego stanu,
- nie wymaga ona wyboru wariantu,
- użytkownik nie musi analizować kilku równorzędnych działań.

Przykłady właściwe:

- „Oznacz jako ukończone”,
- „Wyślij do przeglądu”,
- „Startuj sesję”,
- „Konwertuj na inicjatywę”.

Jeżeli artefakt ma kilka działań workflow lub kilka możliwych przejść, akcje trafiają do sekcji **Akcje** w prawym panelu. Decyzja jest typowym przykładem artefaktu, w którym zestaw działań powinien znajdować się w panelu bocznym.

Główna akcja nie może być powielona równocześnie w nagłówku i prawym panelu.

## 3.3. Przycisk AI w nagłówku

Przycisk AI:

- otwiera dodatkowy panel rozmowy,
- nie zastępuje prawego panelu systemowego,
- automatycznie przekazuje kontekst całego artefaktu:
  - typ,
  - nazwę,
  - status,
  - właściwości,
  - aktywną kartę,
  - treść kart,
  - powiązania,
  - źródła,
  - historię istotnych zmian,
- pozwala rozmawiać o całym artefakcie, a nie tylko o jednym polu.

Panel rozmowy z AI może zwęzić centralny obszar roboczy, ale nie powinien ukrywać lewego ani prawego panelu.

## 3.4. Usuwane elementy

Z nagłówka wszystkich kart należy usunąć:

- niejasny przełącznik widoku między trybami N/C lub analogicznymi ikonami,
- dodatkowe ikony układu, które dublują tryb Edycja/Podgląd,
- kilka równorzędnych przycisków workflow,
- akcje techniczne, które powinny znaleźć się pod trzema kropkami.

## 3.5. Menu trzech kropek

Menu trzech kropek zawiera działania drugorzędne, techniczne i administracyjne, na przykład:

- Kopiuj link,
- Kopiuj identyfikator,
- Duplikuj,
- Eksportuj dane,
- Zarządzaj uprawnieniami,
- Archiwizuj,
- Usuń.

Zasada podziału:

- **Nagłówek:** jedna rekomendowana akcja.
- **Prawy panel / Akcje:** działania biznesowe i workflow.
- **Prawy panel / Rezultaty:** generowanie lub wysyłanie efektów.
- **Trzy kropki:** działania techniczne i administracyjne.

---

# 4. Menu drugiego poziomu

## 4.1. Wygląd

Drugie menu jest jasnym, zaokrąglonym komponentem systemowym:

- jasne tło spójne z prawym panelem,
- miękkie zaokrąglenie,
- delikatna ramka lub cień,
- stała wysokość,
- symetryczne marginesy,
- brak wrażenia „doklejonego paska narzędzi”.

## 4.2. Układ trzech stref

### Lewa strona

- przycisk **Sekcje**.

Przycisk **Nowa karta** jest usuwany ze wszystkich ekranów.

### Dokładny środek całego paska

- przełącznik **Edycja | Podgląd**.

Przełącznik ma być geometrycznie wyśrodkowany względem całego paska, a nie względem wolnego miejsca pomiędzy grupami przycisków.

### Prawa strona

Opcjonalnie:

- **How to / Baza wiedzy**,
- inne elementy pomocy kontekstowej.

Skrajnie po prawej:

- **Analizuj z AI**.

## 4.3. Przycisk Sekcje

Przycisk Sekcje dotyczy wyłącznie kart danego artefaktu.

Obecna mechanika zarządzania sekcjami jest wystarczająca i zostaje jako standard. Umożliwia:

- pokazanie karty,
- ukrycie karty,
- zmianę kolejności kart,
- wybór gotowego zestawu,
- przywrócenie układu domyślnego.

Każdy typ artefaktu ma zamknięty katalog kart. Użytkownik:

- nie tworzy nowych typów kart,
- nie usuwa kart z modelu danych,
- zarządza tylko ich widocznością i kolejnością.

## 4.4. Edycja i Podgląd

Przełącznik informuje, w jakim trybie znajduje się aktywna karta.

W trybie **Edycja**:

- pola są edytowalne,
- widoczne są przyciski AI przy polach,
- widoczne są uchwyty zmiany wysokości,
- aktywne pole ma wyraźny stan focus.

W trybie **Podgląd**:

- pola nie pokazują ramek edycyjnych,
- uchwyty są ukryte,
- przyciski AI przy polach są ukryte lub nieaktywne,
- treść pozostaje czytelna i zachowuje wysokość dopasowaną do zawartości.

## 4.5. Analizuj z AI

Przycisk „Analizuj z AI” odnosi się do aktywnej karty.

AI otrzymuje:

- opis celu karty,
- standard informacji, które karta powinna zawierać,
- aktualną zawartość,
- kontekst całego artefaktu, jeśli jest potrzebny do oceny.

Funkcja powinna:

1. ocenić kompletność karty,
2. wskazać braki,
3. wykryć niespójności,
4. zaproponować poprawki,
5. pokazać rekomendowane rozwinięcia,
6. umożliwić zastosowanie zmian pojedynczo.

Rekomendowany przepływ:

- kliknięcie otwiera panel wyników,
- wynik jest podzielony na: „Braki”, „Ryzyka”, „Sugestie”, „Proponowane zmiany”,
- każda zmiana ma akcje: **Zastosuj**, **Pokaż różnicę**, **Odrzuć**,
- AI nie nadpisuje treści bez potwierdzenia.

## 4.6. Kolor AI

Kolorem systemowym AI jest **fioletowy**.

Powinien być używany konsekwentnie dla:

- przycisku AI w nagłówku,
- przycisku Analizuj z AI,
- ikon AI przy polach,
- panelu sugestii AI,
- oznaczeń treści wygenerowanych lub zmodyfikowanych przez AI.

Kolory statusów pozostają niezależne od koloru AI.

---

# 5. Lewy panel kart

Lewy panel:

- znajduje się na ciemniejszym tle obszaru roboczego,
- pozostaje nieruchomy podczas przewijania centralnej treści,
- pokazuje wyłącznie karty włączone w menu Sekcje,
- ma jeden spójny styl aktywnej karty,
- nie zawiera mechaniki tworzenia nowych kart,
- zachowuje kolejność ustawioną przez użytkownika.

Nazwy kart są specyficzne dla typu artefaktu. Zachowanie panelu jest wspólne.

---

# 6. Centralny obszar roboczy

## 6.1. Zasada ogólna

Centralny obszar pokazuje treść aktywnej karty. Jest to jedyny główny obszar przewijany na ekranie.

Lewy i prawy panel pozostają nieruchome.

## 6.2. Standard pola tekstowego

Każde opisowe pole tekstowe ma:

- nazwę pola,
- opcjonalny opis pomocniczy,
- przycisk AI w prawym górnym rogu,
- bezpośrednią edycję,
- uchwyt zmiany wysokości w prawym dolnym rogu,
- automatyczne dopasowanie wysokości do zawartości.

## 6.3. Automatyczna wysokość i ręczna zmiana

Domyślnie:

- pole rośnie wraz z treścią,
- pole kurczy się po usunięciu tekstu,
- cała treść jest widoczna bez wewnętrznego scrolla.

Po ręcznym przeciągnięciu uchwytu:

- ustawiona wysokość jest zapamiętywana,
- automatyczne kurczenie zostaje wyłączone,
- pole może nadal rosnąć, jeżeli treść przestaje się mieścić,
- użytkownik może wrócić do trybu automatycznego dopasowania.

Ręcznie zmieniana jest przede wszystkim wysokość. Szerokość wynika z układu centralnej kolumny.

## 6.4. AI przy polu

AI przy konkretnym polu działa tylko na jego treści. Może oferować:

- Wygeneruj,
- Popraw,
- Skróć,
- Rozwiń,
- Uprość,
- Zmień ton,
- Przetłumacz,
- Uzupełnij brakujące elementy.

AI najpierw pokazuje propozycję i różnicę. Dostępne akcje:

- Zastosuj,
- Zastąp zaznaczenie,
- Wstaw poniżej,
- Odrzuć.

## 6.5. Komponenty nietekstowe

Checklisty, tabele, karty wynikowe, wykresy i listy powiązań mogą mieć własne komponenty. Nadal muszą respektować:

- ten sam rytm odstępów,
- te same style nagłówków,
- ten sam tryb Edycja/Podgląd,
- tę samą logikę AI, jeżeli AI jest dostępne.

## 6.6. Bannery

Bannery typu „Created from decision” lub inne bannery pokazujące pochodzenie artefaktu należy usunąć.

Informacja o pochodzeniu trafia do:

- Właściwości,
- Powiązań,
- Źródeł i założeń.

Banner jest dopuszczalny wyłącznie jako krótkotrwałe ostrzeżenie lub komunikat wymagający działania, a nie jako stały element układu.

---

# 7. Prawy panel systemowy

## 7.1. Wzorzec wizualny

Wzorem jest panel z ekranu Inicjatywy.

Panel ma być:

- jasnym, zaokrąglonym komponentem,
- odsuniętym od prawej krawędzi,
- spójnym wizualnie z menu drugiego poziomu,
- wyraźnie odróżnionym od ciemniejszego tła treści i lewego panelu,
- stałej szerokości,
- zbudowanym z rozwijanych sekcji.

Nie może wyglądać jak techniczny sidebar przyklejony do krawędzi ekranu.

## 7.2. Stała architektura

Kolejność sekcji:

1. **Akcje**
2. **Właściwości**
3. **Powiązania**
4. **Źródła i założenia**
5. **Rezultaty** — sekcja warunkowa
6. **Komentarze**
7. **Historia**

Jeżeli dana sekcja nie ma zastosowania, może być ukryta. Sekcje, które występują, zawsze zachowują powyższą kolejność. Dzięki temu panel pozostaje symetryczny i przewidywalny.

## 7.3. Akcje

Sekcja zawiera działania biznesowe i workflow dotyczące całego artefaktu.

Przykłady:

- Zatwierdź,
- Cofnij do draftu,
- Ukończ,
- Zablokuj,
- Przydziel,
- Deleguj,
- Przeczytane,
- Odłóż,
- Forkuj.

Zasady:

- akcje ułożone pionowo,
- przyciski pełnej szerokości,
- główna akcja wyróżniona,
- akcje destrukcyjne mają osobny styl,
- jeżeli jedna akcja jest w nagłówku, nie dublujemy jej w panelu.

## 7.4. Właściwości

Tabela ma stały układ:

| Właściwość | Wartość |

Wspólne pola standaryzujemy tam, gdzie mają to samo znaczenie. Przykładowa kolejność:

1. Status
2. Priorytet / Waga
3. Właściciel / Decydent / Przypisany
4. Termin
5. Faza
6. Źródło
7. Utworzono
8. Ostatnia aktywność

Pola specyficzne dla typu mogą zostać dodane poniżej. Nie należy sztucznie łączyć pojęć, które mają inne znaczenie biznesowe.

Wartości:

- są wyrównane konsekwentnie,
- statusy i kategorie mogą być badge’ami,
- kolor jest używany tylko wtedy, gdy przekazuje znaczenie.

## 7.5. Powiązania

Sekcja pokazuje powiązane artefakty, grupując je według typu:

- Decyzje,
- Zadania,
- Inicjatywy,
- Insighty,
- Ryzyka,
- Dokumenty,
- Załączniki.

Każda grupa ma licznik. Element powinien być klikalny i prowadzić do powiązanego artefaktu.

## 7.6. Źródła i założenia

Sekcja zawiera:

- dokumenty źródłowe,
- dane,
- sesje i notatki,
- źródłowy artefakt,
- cytaty i dowody,
- założenia użytkownika,
- założenia AI,
- opcjonalnie poziom pewności.

To tutaj trafia informacja usunięta z bannerów.

## 7.7. Rezultaty

Sekcja jest wyświetlana tylko wtedy, gdy kontekstowo dostępne są działania wynikowe, na przykład:

- Utwórz prezentację,
- Utwórz raport,
- Wyślij,
- Eksportuj gotowy rezultat,
- Utwórz kolejny artefakt,
- Przygotuj podsumowanie.

Sekcja Rezultaty nie zastępuje Akcji. Akcje zmieniają stan lub sposób pracy z artefaktem. Rezultaty tworzą lub wysyłają jego efekt.

## 7.8. Komentarze

Sekcja zawiera:

- listę komentarzy,
- autora i datę,
- odpowiedzi,
- możliwość rozwiązania wątku,
- wyraźne oznaczenie wpisów AI.

Komentarze nie są mieszane z historią systemową.

## 7.9. Historia

Ostatnia sekcja nazywa się wyłącznie **Historia**.

Zawiera logi:

- użytkowników,
- systemu,
- AI.

Rekomendowane filtry:

- Wszystkie,
- Ludzie,
- System,
- AI.

Każdy wpis pokazuje:

- datę i godzinę,
- autora,
- typ zmiany,
- poprzednią i nową wartość, jeśli ma to znaczenie.

---

# 8. Zachowanie zwijanych sekcji

- Każda sekcja ma ikonę, nazwę, opcjonalny licznik i chevron.
- Sekcje można rozwijać niezależnie.
- Akcje i Właściwości są domyślnie rozwinięte.
- Pozostałe sekcje są domyślnie zwinięte.
- Stan rozwinięcia może być zapamiętywany dla użytkownika.
- Panel zachowuje stałą szerokość.

---

# 9. Przewijanie i zachowanie ekranu

- Przewija się centralny obszar roboczy.
- Menu pierwszego i drugiego poziomu pozostają widoczne.
- Lewy panel nie przewija się razem z treścią centralną.
- Prawy panel nie przewija się razem z treścią centralną.
- Jeżeli zawartość prawego panelu przekracza wysokość ekranu, panel może mieć własny wewnętrzny scroll, ale jego pozycja pozostaje stała.
- Panel rozmowy z AI nie zastępuje prawego panelu i nie zmienia logiki przewijania.

---

# 10. Kryteria akceptacji wspólnego szkieletu

Implementacja spełnia standard, gdy:

1. Wszystkie sześć n-Type używa tego samego komponentu nagłówka.
2. Nie ma przełącznika widoku N/C ani równoważnych ikon.
3. Drugie menu ma jasny, zaokrąglony wygląd.
4. Po lewej stronie drugiego menu znajduje się tylko „Sekcje”.
5. „Edycja | Podgląd” jest dokładnie na środku całego paska.
6. „Analizuj z AI” jest skrajnie po prawej i używa fioletowego stylu AI.
7. Nie ma przycisku „Nowa karta”.
8. Prawy panel ma ten sam wygląd i kolejność sekcji.
9. Ostatnia sekcja nazywa się „Historia”, nie „Historia / AI”.
10. Stałe bannery pochodzenia artefaktu zostały usunięte.
11. Wszystkie pola tekstowe mają AI, auto-fit i uchwyt zmiany wysokości.
12. Po ręcznej zmianie wysokości pole nie kurczy się automatycznie.
13. Przewija się centralna treść, a panele pozostają nieruchome.
14. AI w nagłówku otwiera rozmowę w kontekście całego artefaktu.
15. Akcje są rozmieszczone według jednej taksonomii: nagłówek, panel Akcje, panel Rezultaty, kebab.
