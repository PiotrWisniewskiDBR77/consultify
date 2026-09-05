---
doc_id: finanse-zalozenia-cto-20260905
status: draft-for-owner
truth_type: product-target
established: 2026-09-05
author: CTO (Fable) — odczyt kontraktu `docs/modules/08_finanse/CURRENT_CONTRACT.md`, programu `PROGRAM_NAPRAWCZY_20260905/F_FINANSE_PELNA_TABELA.md` i słów właściciela 05.09 („pracujemy na całej tabeli”, „to nie jest nawet cień rozwiązania dla finansistów”)
---

# Finanse — założenia CTO (do korekty właściciela, potem SSOT)

## 0. Po co ten moduł
Finanse dają **finansowy obraz decyzji**: z realnych sprawozdań klienta budujemy jego model, liczymy scenariusze i wycenę, a po decyzji rozliczamy, czy obiecana wartość przyszła. Finanse nie zastępują księgowości i nie liczą KPI operacyjnych (to Wyniki). Podmiotem jest **CFO / dyrektor finansowy klienta** i konsultant, który z nim pracuje. Wszystko musi być **odtwarzalne**: każdy wynik wskazuje dane, wersję, okres, walutę i założenia, z których powstał.

## 1. Funkcje (Menu 2) i co się w nich dzieje

| # | Funkcja | Poziom 1 (tabela) | Poziom 2 (karta N) | Co się dzieje |
| --- | --- | --- | --- | --- |
| 1 | **Sprawozdania** | tabela pakietów sprawozdań: firma · rok/okres · zakres (RZiS·Bilans·CF) · okres porównawczy · stan (szkic / do przeglądu / zatwierdzony) · gotowość (gotowy / do poprawy) · źródło (import / ręcznie) | pakiet: nagłówek (firma, rok, waluta, jednostka), trzy sekcje RZiS · Bilans · CF jako **pełne tabele** (pozycja × okresy), walidacja spójności (bilansuje się, CF domyka), historia wersji, komentarze | import pliku (xlsx/pdf/csv) → rozpoznanie sekcji i okresów → korekta mapowania → pakiet „gotowy” → skierowanie do przeglądu → **zatwierdzenie** (wersja zamrożona, od tej chwili źródło dla analiz i modeli) |
| 2 | **Analiza historyczna** | tabela analiz: pakiet źródłowy · lata · stan | analiza: wskaźniki 3 lat (rentowność, płynność, zadłużenie, efektywność, wzrosty) jako tabela + trend; interpretacja Teresy oznaczona jako interpretacja; braki nazwane z nazwy | „+ Nowa analiza” z zatwierdzonego pakietu → wyliczenia deterministyczne → zatwierdzenie → powiązanie z pakietem (rodowód) |
| 3 | **Model bazowy (Baseline)** | tabela modeli: firma · horyzont · rok bazowy · stan · źródło (pakiet + analiza) | **pełna tabela RZiS · Bilans · CF: lata historii + horyzont prognozy w jednej tabeli**, założenia (wzrost, marże, capex, kapitał obrotowy, finansowanie) w prawym panelu, przelicz → tabela odświeżona | „Utwórz model → oprzyj na sprawozdaniu” → model otwiera się **od razu na tabeli** (kontekst konfigurowany automatycznie z pakietu i analizy) → edycja założeń → przelicz → zatwierdź wersję |
| 4 | **Scenariusze i predykcja** | tabela scenariuszy: model bazowy · wariant (konserwatywny / bazowy / optymistyczny / własny) · stan | scenariusz: te same tabele co model z różnicą do bazy (kolumna Δ), założenia różnicowe, porównanie 2–3 scenariuszy obok siebie | „+ Scenariusz z modelu” → zmiana założeń → przelicz → porównaj → zatwierdź |
| 5 | **Wycena** | tabela wycen: firma · metoda (DCF/FCFF, mnożniki) · źródło (model/scenariusz · wersja) · wartość · stan | wycena krokami: **Źródło** (zatwierdzony model/scenariusz, klikalne) → Założenia (WACC, g, horyzont) → Metody i wagi → Wyniki (wartość, most wartości, football field) → Wrażliwość → Doradca wyceny (Teresa) → Eksport | wycena zawsze wskazuje **dokładną zatwierdzoną wersję źródła**, nigdy „najnowszą” |
| 6 | **Business case inwestycji** | (współdzielone z Wynikami › ROI) | karta ROI w trzech częściach (założenia → wyliczenia → realizacja) — metodyka właściciela | Finanse dostarczają przepływy i wskaźniki (NPV/IRR/PP/PI/BCR), Wyniki rozliczają korzyści post factum |
| 7 | **Przegląd, eksport, raport** | w każdej karcie: akcje Skieruj do przeglądu · Zatwierdź · Eksportuj (XLSX z pełnymi tabelami, PDF/DOCX raport do Materiałów) | — | autor ≠ recenzent; publikacja tworzy niezmienną wersję; raport zarządczy z wyceny = artefakt w Materiałach |
| 8 | **Rozliczenie korzyści (Benefits Realization)** | tabela: inicjatywa/inwestycja · obiecane · dostarczone · wariancja | karta: ledger korzyści per okres, przegląd po 3/6/12 mies. | domyka pętlę: decyzja → wdrożenie → pomiar (Wyniki) → wycena efektu (Finanse) |

## 2. Jak to ma wyglądać (kanon)
Menu 1 z okruszkiem `Finanse › Sprawozdania › DBR77 2025`; Menu 2 = Sprawozdania · Analiza · Model bazowy · Scenariusze · Wycena (+ Rozliczenie korzyści po MVP); Menu 3 chipy stanu i jedna akcja „Importuj / Nowy”. Poziom 1 = StandardTable + StandardPreview (podgląd: metadane, stan, rodowód, „Otwórz”). Poziom 2 = karta N z lewą nawigacją sekcji; **serce modułu to tabela finansowa**: pozycje w wierszach (z hierarchią: przychody › koszty › EBITDA … aktywa › pasywa … CF operacyjny › inwestycyjny › finansowy), okresy w kolumnach (historia szarawa, prognoza jaśniejsza, kolumny stałe przypięte, poziomy scroll), liczby wyrównane do prawej z jednostką i walutą w nagłówku, sumy pogrubione, Δ i % w kolumnach pomocniczych, komórki edytowalne tylko tam, gdzie założenie (podświetlone), reszta liczona. Jeden prawy panel (Założenia · Właściwości · Powiązania/Rodowód · Źródła · Komentarze · Historia) z Teresą jako zakładką. Czerwień tylko dla błędu spójności (bilans się nie domyka) lub odrzucenia; brak danych = „—”. Zero angielskich etykiet (dziś 22 nazwy narzędzi wyceny). Nazwy własne metod (DCF, FCFF, WACC, EBITDA) zostają.

## 3. Zasady działania
1. **Jedna prawda danych**: pakiet → analiza → model → scenariusz → wycena tworzą łańcuch powiązań (rodowód); każdy krok odwołuje się do zatwierdzonej wersji poprzedniego; zmiana źródła = nowa wersja, nie edycja historii.
2. **Zatwierdzanie**: szkic → do przeglądu → zatwierdzony (autor nie zatwierdza sam); zatwierdzone jest niezmienne.
3. **Deterministyczne liczenie**: ten sam zestaw danych i założeń zawsze daje ten sam wynik; Teresa objaśnia, proponuje mapowanie i scenariusze, **nie fabrykuje liczb**.
4. **Pełna tabela zawsze, nie skrót**: żadnych „uproszczonych liczb” w miejsce sprawozdania — słowo właściciela.
5. **Uczciwe stany**: gdy czegoś brakuje (kontekst, zatwierdzone źródło), ekran mówi czego i co odblokuje, nie pokazuje pustych zer ani martwego „spróbuj ponownie”.
6. **Izolacja organizacji** i pełna audytowalność (kto, kiedy, jaką wersję).

## 4. Stan dzisiejszy (uczciwie) i droga
Działa: import pakietu (po dzisiejszej naprawie okresu porównawczego bilansu), analiza, komentarze, wycena z krokiem Źródło (chooser dodany 05.09), predykcja (rzadki biały ekran ~6 %). Nie działa: **pełna tabela modelu bazowego** — łańcuch zatwierdzania pakietu i analizy, rejestr modelu, okresy prognozy i konfiguracja kontekstu nie są spięte (6 ogniw, program `F_FINANSE_PELNA_TABELA.md`, ~6–7 dni Opus, testy tylko na realnym Postgresie). Decyzja właściciela 05.09: Finanse poza MVP; program F gotowy do startu na słowo.

## 5. Kryterium „gotowe” dla właściciela
CFO importuje sprawozdanie 2025 z porównawczym 2024, zatwierdza, tworzy analizę i model, i **widzi jedną tabelę RZiS · Bilans · CF z trzema latami historii i horyzontem prognozy**, zmienia założenie, przelicza, tworzy scenariusz, wycenia firmę ze wskazanym źródłem i eksportuje raport do Materiałów — bez jednego zapytania SQL i bez pustego ekranu.
