# Materialy i szablony - kanon stanu docelowego

Status: CANONICAL DECISION  
Data: 2026-07-24  
Zakres: Materialy, Dokumenty, Prezentacje, Arkusze i szablony

## 1. Cel

Consultify jako konsultant AI zamienia kontekst organizacji, projektu, narzedzia i rozmowy z Teresa w gotowe do decyzji lub przekazania materialy.

Trzy rownorzedne formaty:

1. Dokument: raport, rekomendacja, analiza, memorandum lub dokumentacja.
2. Prezentacja: narracja dla spotkania, decyzji lub komunikacji.
3. Arkusz: model, analiza danych, scenariusze, plan albo kalkulacja Excel.

Material moze powstac od zera, z AI albo z szablonu. Ma byc wiarygodnym efektem pracy konsultingowej, a nie zwyklym plikiem wygenerowanym przez AI.

## 2. Slownik i granice

| Pojecie | Znaczenie |
|---|---|
| Material | Konkretny dokument, prezentacja albo arkusz nalezacy do organizacji lub projektu. |
| Szablon | Wielokrotnego uzytku blueprint struktury, zasad jakosci i domyslnej stylistyki. |
| Theme | Warstwa marki i estetyki: kolory, fonty, logo i zasady wizualne. |
| Formatting | Reguly typografii, tabel, wykresow, marginesow, naglowkow i eksportu. |
| Source pack | Ustalony zestaw danych i zrodel dla generacji. |
| Table Studio | Relacyjny obszar danych. Moze zasilac arkusz, ale nie jest ekranem tworzenia finalnego materialu Excel. |

Szablon, theme i formatting sa niezaleznymi warstwami. Nie tworzymy kopii szablonu tylko po to, aby zmienic marke.

## 3. Nawigacja

Jedynym wejsciem do rezultatow w glownej nawigacji jest **Materialy**. Jest ono biblioteka i punktem startowym dla dokumentow, prezentacji oraz arkuszy.

Wewnetrzne menu Materialow ma dokladnie piec pozycji:

1. Wszystkie
2. Dokumenty
3. Prezentacje
4. Arkusze
5. Szablony

Architekci szablonow dokumentow, prezentacji i arkuszy sa narzedziami drugiego poziomu. Otwieraja sie z zakladki Szablony lub z przeplywu tworzenia, nigdy jako kolejne pozycje glownego menu.

Osobna pozycja Excel w lewym sidebarze jest duplikatem i po migracji scenariuszy ma zniknac z glownej nawigacji. Trasy techniczne i deep linki moga zostac dla zgodnosci wstecznej.

Rozroznienie jest obowiazkowe:

- Table Studio: baza danych relacyjnych i zrodlo pracy.
- Excel/workbook: finalny arkusz analityczny z formulami i eksportem .xlsx.

## 4. Wejscia i prosty start

Material powstaje:

1. Kontekstowo z projektu, narzedzia, wyniku lub rozmowy. Kontekst jest dolaczony automatycznie.
2. Z rozmowy z Teresa: uzytkownik podaje cel jednym zdaniem.
3. Z biblioteki Materialy przez przycisk Dodaj.

Pierwszy ekran nie moze byc tabela parametrow ani technicznym formularzem. Nie pokazuje od razu wielu selektorow, zrodel, gestosci, layoutow ani obowiazkowego wyboru szablonu.

Pierwszy poziom zawsze wybiera format: Dokument, Prezentacja albo Arkusz.

Drugi poziom dla materialu zawsze wybiera sposob startu:

- Czysto: rzeczywisty pusty material w odpowiednim edytorze.
- Z AI: opis celu i rozmowa z Teresa z wykorzystaniem dostepnego kontekstu.
- Z szablonu: wybor lub rekomendacja szablonu danego formatu.

Wspolny kontrakt:

    {
      entity: 'artifact' | 'template',
      format: 'document' | 'presentation' | 'spreadsheet',
      start: 'blank' | 'ai' | 'from_template' | 'clone_template',
      templateId?: string,
      sourceContext?: SourceContext
    }

Z szablonu musi utworzyc material wedlug wybranego blueprintu. Nie wystarczy otworzyc czatu z samym identyfikatorem szablonu.

W zakladce Szablony przycisk Dodaj ma ten sam pierwszy poziom, ale drugi poziom to:

- Czysto: pusty blueprint.
- Z AI: AI proponuje strukture i reguly z opisu.
- Na bazie istniejacego: klonowanie i adaptacja szablonu.

## 5. Filozofia szablonow: blueprint z blokow

Historyczny Report Builder jest wartosciowym wzorcem drugiego poziomu pracy. Szablon nie jest skorka wizualna, lecz uporzadkowanym blueprintem tresci.

Kazdy blueprint okresla:

1. Drzewo blokow lub sekcji w kolejnosci.
2. Semantyczny typ bloku, na przyklad cover, executive summary, metodologia, finding, rekomendacja, tabela, wykres albo next steps.
3. Cel i odbiorce calego rezultatu.
4. Reguly generacji bloku: zakres, glebokosc analizy, dlugosc, format, dane i wizualizacje.
5. Reguly spojnosci: glowna teza, slownik, zrodla, ton i kolejnosc argumentacji.
6. Reguly jakosci i walidacje przed eksportem.

Wzor interfejsu do zachowania: lista blokow po lewej, wybrany blok w centrum, konfiguracja calosci i design po prawej, generacja i preview w kontekscie. Nie jest to ekran pierwszego kontaktu: pojawia sie po wyborze formatu i trybu startu.

| Format | Jednostka blueprintu |
|---|---|
| Dokument | Sekcja, podsekcja, tabela, wykres, rekomendacja, zalacznik. |
| Prezentacja | Slajd, grupa slajdow, narracja, layout, speaker notes. |
| Arkusz | Sheet, obszar wejsc, model obliczeniowy, named range, tabela, wykres, dashboard. |

AI moze proponowac komplet blokow i wypelniac tresc. Czlowiek moze zmieniac kolejnosc, dodawac, usuwac, laczyc w rozdzialy i oznaczac elementy wymagajace danych lub review.

## 6. Jakosc

Dokument ma byc gotowym raportem, z prawidlowa struktura, executive summary gdy potrzebne, czytelnymi tabelami i wykresami, opisanymi zrodlami oraz eksportem Word/PDF.

Prezentacja ma prowadzic przez decyzje lub historie. Tytuly slajdow komunikuja wniosek, a nie temat. Wymaga narracji, zroznicowanych layoutow, dowodow przy tezach oraz eksportu PPTX/PDF.

Arkusz ma byc rzeczywistym modelem Excel z formulami, formatami liczbowymi, walidacjami, wykresami i eksportem .xlsx. MVP nie buduje pelnego klona desktopowego Excela w przegladarce: priorytetem jest dzialajacy workbook, preview i ograniczona edycja w aplikacji.

## 7. Wspolna biblioteka szablonow

Kazdy szablon musi byc dostepny przez jeden katalog i wspolny kontrakt odczytu. Implementacje per-format sa adapterami, a nie trzema niezaleznymi bibliotekami.

### Reuse first: co juz istnieje

Nie budujemy drugiego generatora szablonow. Istniejacy przeplyw New template oraz Document Studio Template Architect sa kanoniczna baza do scalenia:

- biblioteka, filtry, statusy i akcje na wierszu;
- trzyetapowy modal utworzenia szablonu;
- ekran blueprintu z lista sekcji, typem bloku, dlugoscia, instrukcja dla generatora, przelacznikiem AI, motywem i dostepnoscia;
- rejestr dokumentowy z persystencja, wersjonowaniem, audytem oraz statusami draft/approved/deprecated.

Nastepne prace maja rozszerzac ten przeplyw, a nie zastepowac go nowym widokiem:

1. Modal wybiera najpierw format, potem sposob startu. Nazwe i scope doprecyzowuje sie w edytorze lub na koncu; domyslnie szablon jest prywatnym draftem.
2. Edytor blueprintu dostaje wspolny shell i kontrakt, ale adaptuje jednostke pracy do formatu: sekcja, slajd albo sheet.
3. Biblioteka dostaje adaptery dla trzech rejestrow i pokazuje rzeczywisty format, zrodlo i liczbe uzyc.
4. Zapisany szablon jest widoczny w wyborze Z szablonu i faktycznie przekazuje blueprint do silnika generacji.

Obserwacja do naprawy przed uznaniem biblioteki za wiarygodna: aktualny widok pokazuje powtarzajace sie rekordy i niemal wylacznie typ Report. Nalezy sprawdzic deduplikacje oraz zrodlo danych, zanim licznik i statusy zostana wykorzystane jako informacja produktowa.

Wspolny model zawiera co najmniej: identyfikator, format, nazwe, opis, scope, status draft/approved/deprecated, rodzine, oczekiwane zrodla, blueprint struktury, reguly jakosci, wskazowki generacji, wersje i pochodzenie klonu.

Rozszerzenia:

- Dokument: typ raportu, blueprint sekcji, wymagalnosc, wskazowki RAG, eksport i odswiezanie.
- Prezentacja: typ decku, outline, intencje slajdow, wskazowki wizualne, liczba slajdow i speaker notes.
- Arkusz: blueprint workbooka, sheets, named ranges, formuly, wejscia, walidacje, formatowanie, conditional formatting, wykresy, zrodla zalozen i refresh policy.

Kanoniczne rejestry do agregacji:

| Format | Rejestr |
|---|---|
| Dokument | document_studio_templates |
| Prezentacja | presentation_templates |
| Arkusz | workbook template registry |

report_builder_templates jest legacy i nie moze byc zrodlem szablonow nowego Document Studio. tp_base_templates nalezy do Table Studio i nie jest biblioteka szablonow Excelowych.

AI moze zaproponowac lub wyekstrahowac szablon z materialu, ale nie publikuje go automatycznie jako wspolnego szablonu organizacji.

## 8. Migracja i DoD

Kolejnosc:

1. Wspolny kontrakt i adaptery odczytu dla trzech rejestrow.
2. Ujednolicone launchery wedlug wspolnego kontraktu.
3. Architekci pod zakladka Szablony.
4. Usuniecie z glownej nawigacji duplikatu Excel i niekanonicznych zakladek.
5. Przekierowanie starych tras, a pozniej oznaczanie implementacji jako legacy.

Praca jest zakonczona, gdy:

- istnieje jedno oczywiste wejscie do Materialow;
- kazdy format da sie uruchomic jako Czysto, Z AI i Z szablonu;
- kazdy typ szablonu da sie utworzyc jako Czysto, Z AI i Na bazie istniejacego;
- Word, deck i workbook korzystaja z rzeczywistych rejestrow;
- pierwszy ekran nie jest technicznym formularzem;
- arkusz ma formule i eksport .xlsx;
- kontekst projektu, narzedzia lub rozmowy trafia do generacji;
- legacy nie jest podstawowa sciezka uzytkownika.

Nie usuwamy starych tabel, komponentow ani tras tylko dlatego, ze sa niekanoniczne. Najpierw potwierdzamy wywolania, dane i zgodnosc wsteczna.

## 9. Relacja do starszych dokumentow

Ten dokument rozstrzyga nawigacje Materialow, brak osobnego wejscia Excel, tryby startu, wspolny system szablonow obejmujacy Excel oraz granice MVP edycji arkusza.

Starsze specyfikacje zachowuja wartosc jako zrodlo wymagan szczegolowych, ale nie moga nadpisac tych decyzji. W szczegolnosci historyczna doktryna, w ktorej Idea Table byla oficjalnym shellem Excela, nie jest aktualna dla glownego przeplywu tworzenia Materialow.
