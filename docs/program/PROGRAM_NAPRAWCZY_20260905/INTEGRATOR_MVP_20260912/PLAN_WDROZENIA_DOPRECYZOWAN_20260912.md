# Consultify — kompletny plan wdrożenia doprecyzowań właściciela

Data: 12.09.2026. Integrator i odpowiedzialny za wykonanie: Codex.
Status: plan wykonawczy aktualizujący zakres istniejącego programu. Nie jest deklaracją wdrożenia, nowym SSOT produktu ani formularzem pytań do właściciela.

## 1. Cel i zasady

Doprowadzić istniejący program do pełnego procesu doradczego: wiedza o organizacji → diagnoza → wnioski → inicjatywy → plan → realizacja → zmierzone efekty, z Teresą prowadzącą pracę, materiałami dla klienta i spotkaniami. Wymagania poniżej traktujemy jako doprecyzowanie już zamówionego produktu. Nie budujemy aplikacji ponownie i nie zastępujemy programu listą nowych pomysłów.

Podstawa: oba oryginalne teksty właściciela z 12.09, wskazany HTML zachowany jako źródło pomocnicze, dalsze ustalenia PMO, aktualna hierarchia SOURCE_OF_TRUTH, kontrakty 16 modułów, TRZY_POJEMNIKI i rejestr wykonania. Wycofana lista PYTANIA_I_REKOMENDACJE nie jest źródłem decyzji. Najnowsze doprecyzowania właściciela mają pierwszeństwo przed starszymi propozycjami.

Wiążące doprecyzowania:
- Prace diagnostyczne i wnioski mogą powstawać przed projektem. Projekt musi istnieć najpóźniej przy tworzeniu inicjatywy. Inicjatywa zachowuje powiązanie z wnioskami i źródłami.
- Nowy proces nie oznacza automatycznej migracji 105 zastanych inicjatyw bez projektu (DEC-469).
- Pełny odbiór Idei, Notatek i Dokumentów oraz zatwierdź/odeślij odpowiedzi przez managera to MVP według nowszej notatki. Rozbudowana rozmowa i reszta funkcji Fali 2 nie mogą opóźniać tych dwóch odbiorów.
- Inicjatywy i Realizacja: po cztery funkcje Menu 2 według właściciela. Jedna tożsamość inicjatywy na etapach przygotowania i wykonania.
- Finanse pozostają jawnie Coming soon w MVP; cały moduł jest zobowiązaniem Fali 2 (DEC-470).
- EN teraz, PL później; pilot na stagingu, Hostinger pozostaje (DEC-461/471/472). Nie przywracamy starych zapisów PL/demo jako bieżących bramek.
- Ceremonia zatwierdzania ma istniejącą granicę DEC-474: opracowanie i parametryzowany rdzeń można przygotować; finalny wariant przedstawiamy jako konkretny, sprawdzony rezultat do decyzji właściciela. Nie pytamy ponownie o ogólne zasady PMO.

## 2. Co już dostarczono — nie zlecać od nowa

Stan lokalnych dostaw, nie stan produkcji. Przed scaleniem odczytać HEAD, diff i raport źródłowy.

| Dostawa | Stan znany podczas planowania | Pozostałe działanie |
|---|---|---|
| C2b, HEAD 1629b4e9f3bea9b628a73f3dc1c4c9cfb11675e3 | Budżet, milestones, zasoby, role bramek i staffing; niezależny odbiór ograniczonego zakresu na kodzie 2f70a73879 | Przyjąć istniejący packet, scalić i odebrać na wspólnej bazie. MOVE nadal OFF/PENDING; nie uznawać za gotowe przenoszenie dostępu dzieci. |
| C4 E1/E2 | 5544f2f3fe i 934e08de86: daty Inbox, bezpieczna odmowa przypisania bez projektu, reopen Action Card i projekcja Inbox | Regresja na scalonym kandydacie, bez przepisywania napraw. |
| C4 E3 | Raport 3d79d82972: mniejszy JS, ale PARTIAL; brak wykazanego przyspieszenia, zastane autoPUT403 przy otwarciu CLOSED | Osobny fix autosave; dalszy pomiar rzeczywistego zimnego startu i dotrzymania progu programu. |
| C4 E4, HEAD 172d56adeb9578b5b81f0eafb7f204f4f59f35e2 | Autorskie lokalne dowody kont, czyszczenia, rollback, odwołania tokenów; jawne ograniczenia | Niezależny review i przyjęcie; lokalne próby nie dowodzą wykonania na stagingu. |
| C6, HEAD e29dd98236e3f3dfc03b522489429769b2ffb4e8 | Najnowszy meldunek: limiter/admin usage 6117cdbf67, tenant export/delete cb251a2523, lokalne dowody; E1 nadal niepełny klikany create-flow, E2 bez wizualnego rejestru KPI | Niezależnie odebrać raport i diff, domknąć dokładnie te braki, wykonać wspólny scenariusz. Meldunek autora nie jest niezależnym odbiorem. |
| C8 E0, 382d769ed6fe2df3c89457eeaba657dab9919f2c | Coming soon, niezależny lokalny ACCEPT E0 | Scalić do MVP. Nie traktować jako wykonania pełnych finansów. |

Żadna z tych dostaw osobno nie zamyka MVP ani Fali 2. Stan pozostałych rodzin jest DO WERYFIKACJI względem aktualnej bazy; istniejący kontrakt lub plik nie dowodzi funkcji.

## 3. Pakiety wykonawcze

Identyfikatory W00–W22 są identyfikatorami w tej mapie wykonania, nie nowymi numerami kanonicznych programów. Powiązania do źródłowych zadań zapisano przy każdej paczce. Jeden zakres wykonujemy tylko raz, nawet jeśli należy do kilku programów.

### W00 — przyjęcie dostaw i kandydat MVP

Źródło: bloki C2b/C4/C5/C6/C8E0; pojemniki S1/S2. Właściciel wykonania: integrator; niezależny odbiorca: rotacyjny agent, który nie tworzył danej zmiany.

Prace: ustalić jedną bazę integracji i manifest dostaw; przyjąć wyżej wymienione paczki; rozwiązać konflikty na poziomie zachowania; poprawić autozapis CLOSED i pozostałe potwierdzone błędy; domknąć rzeczywisty create-flow świeżej organizacji oraz odczyt KPI. Do planu wejść muszą też flagi, migracje, poczta, limiter, eksport/usunięcie, backup/restore i zimny start.

Odbiór: ta sama wersja aplikacji przechodzi scenariusz właściciela i świeżej organizacji, zapis i reload, odczyt przez właściwego odbiorcę, odmowę dostępu innej organizacji. Nie zamykamy brakujących dowodów poprzez samo powtórzenie testów jednostkowych.

### W01 — kontrakty pracy specjalistów i standard wyników

Źródło: P8, DEC-411/P10/P13/P14, KONTRAKTY_NARZEDZI_AI, CONCLUSION_LAYER_STANDARD, CARD_CONTENT_FORMULA, kontrakty modułów. Etap: część MVP dla dostępnych funkcji, pełne pokrycie w Fali 2. Zespół: jakość i diagnostyka.

Prace: zinwentaryzować wszystkie zadania AI i N-karty: zadania, decyzje, wnioski, inicjatywy, wywiady, analizy, raporty, prezentacje, notatki, Idee, finanse, wyniki i spotkania. Każde zadanie otrzymuje wejścia, kontekst, metodę, obowiązkowe/opcjonalne sekcje, limity treści, reguły liczb i źródeł, kryteria jakości, zachowanie przy brakach oraz dalsze akcje. Uzupełniamy istniejące kontrakty, nie mnożymy ogólnych promptów.

Odbiór: kontrakt → rzeczywiste wywołanie → wynik → walidacja → poprawa → zapis/eksport. Recenzja sprawdza kompletność, merytorykę i grafikę osobno; dwa różne przypadki firmy muszą prowadzić do odpowiednio różnych wniosków. Brak danych daje jawną lukę, nie fikcyjną diagnozę. Zestaw wzorcowy i wymagane progi bierzemy z aktualnej rubryki deliverable, brakujące wzorce przygotowujemy jako pracę W01.

### W02 — wspólna wiedza, źródła i kontekst

Źródło: program 3.7, Organization Context Engine, moduł Organizacja, Canvas. Zespół: dane i agent.

Prace: zatwierdzane informacje o firmie i użytkownikach, dokumenty i multimodalne źródła, ekstrakcja, indeksowanie, cytowania, aktualność, wersje i rozróżnienie faktów/założeń/opinii. Wszystkie generatory pobierają kontekst zgodnie z uprawnieniami, również po zmianie wersji lub usunięciu źródła. Bez prywatnych kopii wiedzy per moduł.

Odbiór: dokument z konkretną stroną/komórką wpływa na odpowiedź i jest cytowany; wersja nowsza zmienia wynik; cofnięty dostęp usuwa źródło z retrieval. Błąd ekstrakcji nie oznacza gotowości dokumentu. Test pustego, sprzecznego i dużego zbioru danych.

### W03 — projekt, zespół i governance PMO

Źródło: 3.2/3.3, Workflow Canon, moduły Organizacja/Admin, C7/DEC-474, doprecyzowania PMO. Zespół: proces i dane.

Prace: pełny proces utworzenia projektu w organizacji, cel/zakres/rezultaty, zespół i role, odpowiedzialność, dostępność oraz zasady komunikacji i ryzyka. Ujednolicić słowniki ról i egzekucję uprawnień. Role projektu wyznaczają proponowanych decydentów; obieg jest konfigurowalny i wersjonowany, inicjatywy dziedziczą reguły z kontrolowanymi wyjątkami. Opisać rolę kierownika, sponsora i komitetu bez wymagania sztucznie rozbudowanego zespołu.

Metoda pracy: zebrać istniejące reguły PMO i odwzorować je na jedną spójną instrukcję użytkownika. Porównać wskazane w dokumentacji metody na poziomie potrzeb produktu; nie deklarować zgodności z normą na podstawie komentarza w kodzie. Zwykłe wybory wykonuje integrator.

Odbiór: utworzenie projektu i zespołu uruchamia prawidłową ścieżkę decyzji; zastępstwo i zmiana roli działają także dla otwartej sprawy; nieuprawniony użytkownik nie zatwierdza; w historii widać kto, dlaczego i według jakiej wersji reguł zdecydował.

### W04 — wnioski, inicjatywy i pełny lifecycle

Źródło: 3.6, KREGOSLUP_WARTOSCI, 1.11/P12/DEC-424, C7/DEC-474. Zależności: W01, minimalny W03; rozwinięcie W02. Zespół: proces i dane.

Prace: z każdego źródła diagnostycznego przejść do wniosku i inicjatywy bez utraty pochodzenia. Przy tworzeniu inicjatywy wybór/utworzenie projektu; zachować zastane wyjątki DEC-469. Dowieźć pełny docelowy lifecycle opisany w INITIATIVES_EXECUTION_FUNCTIONS_CANON i jego pakiecie implementacyjnym (12 etapów biznesowych). P12 §2 wprost ogranicza siedem statusów do MVP i odkłada pełny model do Fali 2. Zmapować każdy etap, warunek i odpowiedzialność na obecny runtime oraz przygotować addytywną migrację i zgodność odczytów; nie uznawać siedmiu statusów za docelowy sufit produktu. Jawnie odróżnić przygotowanie, zatwierdzenie, wykonanie, odbiór, pomiar, odrzucenie, wstrzymanie i archiwizację. Rozdzielić lifecycle, gate, readiness, disposition, health i effectiveness zgodnie z kanonem. Odbiór wymaga pełnej semantyki etapów, nie wyłącznie etykiet.

Odbiór: pełna ścieżka i zwroty do poprawy, brak podwójnych inicjatyw po ponowieniu, zachowana historia; zgoda dla nieaktualnej wersji nie przepuszcza zmienionej treści. MOVE rozwiązać osobno z regułami dostępu dzieci; nie przemycać migracji przez edycję projektu.

### W05 — Interview od rozmowy do zatwierdzonych wniosków

Źródło: moduł Wywiad, kontrakty generatora pytań/odpowiedzi/insightów/inicjatyw, 3.12 z nowszą korektą MVP. Zespół: diagnostyka.

MVP: manager widzi komplet sesji, zatwierdza albo odsyła z konkretnym komentarzem; respondent poprawia i ponownie składa; uprawnienia, historia i status działają po ponownym otwarciu. To nie czeka na całą Falę 2. Istniejący podstawowy przebieg pytania → odpowiedzi → wnioski → handoff inicjatywy oraz onboarding/zaproszenia pozostaje bramką MVP (S2); musi zostać odebrany i naprawiony już tutaj. Akapit Fala 2 dotyczy rozszerzeń rozmowy i jakości, nie odłożenia istniejącej pierwszej wartości klienta.

Fala 2: kontekstowe pytania, naturalny wywiad z Teresą przez tekst i głos, pogłębianie odpowiedzi i dochodzenie do wymaganych informacji bez mechanicznego odczytywania formularza. Zaproszenie i onboarding prowadzą do przydzielonego badania; role wynikają z kontrolowanego zaproszenia. Ocena AI i warianty odbioru korzystają ze wspólnego governance. Wnioski i inicjatywy mają recenzję merytoryczną szczególnie staranną jako pierwszy rezultat dla klienta.

Odbiór: respondent nowy i istniejący, niepełne/sprzeczne odpowiedzi, przerwana rozmowa, manager odsyła/poprawa/akcept, finalny insight ze źródłem → inicjatywa. Test rzeczywistej rozmowy/generacji odróżnić od atrap.

### W06 — pełny katalog Tools

Źródło: 3.4, moduł Narzędzia, _FORMULA_MENU_NARZEDZI_12, rejestr pakietów metod, pełny SWOT DEC-383. Zespół: diagnostyka.

Prace: zamrozić imienny zakres katalogu z aktualnych źródeł; nie pomylić liczby kategorii z liczbą gotowych narzędzi. Dokończyć każdą uzgodnioną metodę: wejścia, kroki, obliczenia, grafika charakterystyczna dla metody, rekomendacje i przekazanie do inicjatyw. Zapewnić sensowne importy/eksporty i wznowienie sesji.

Odbiór każdego narzędzia: od danych do konsultingowej rekomendacji z uzasadnieniem, kompromisami i następnym działaniem; pełny zapis oraz właściwa wizualizacja. Sam katalog lub szablon macierzy nie zamyka metody.

### W07 — DRD, SIRI i ADMA

Źródło: 05_assessment, method cores, 3.4/3.13, DEC-364/365/368/369. Zespół: diagnostyka.

Prace: wykorzystać wspólną pracownię i przebieg DRD, zachować osobne pytania, skale, scoring, interpretację i grafikę SIRI oraz ADMA. Dokończyć zbieranie danych, dowody, warsztat, wyniki, raport, deck i generator inicjatyw. Przyjąć pełny zakres trzech metod, nie odbierać samego DRD jako całego modułu.

Odbiór: ten sam zestaw wejść daje powtarzalny poprawny wynik danej metody; brak dowodu nie podwyższa oceny; raport/deck odzwierciedlają wynik i prowadzą do uzasadnionych inicjatyw. Sprawdzić uprawnienia i warunki wykorzystania źródeł metody zgodnie z istniejącym kontraktem, bez fikcyjnych deklaracji licencji.

### W08 — audyt ze źródła i zamknięcie ustaleń

Źródło: 11_audits, 3.15, wspólne silniki Interview/Tools/Materials. Zespół: diagnostyka.

Prace: instrukcja/norma/plik, rozmowa AI albo template → edytowalny plan i pytania → przypisani respondenci, terminy i zaproszenia → dowody → ustalenia → działania naprawcze/inicjatywy → skuteczność. Każde wymaganie wskazuje fragment źródła. Zachować pokrycie także części nieczytelnych i niejednoznacznych.

Odbiór: audyt z rzeczywistego pliku, brak odpowiedzi i dowodu, odesłanie, ustalenie z rodowodem, działanie i weryfikacja zamknięcia. Nie ogłaszać zgodności z normą na podstawie samego wygenerowania pytań.

### W09 — Inicjatywy: lista i analiza portfela

Źródło: INITIATIVES_EXECUTION_FUNCTIONS_CANON, P10/P13/P14, DEC-466 oraz druga notatka właściciela. Zespół: proces.

Menu 2: Inicjatywy / Plan / Obciążenie / Raport z pracy. Pod Inicjatywy menu 3: Lista inicjatyw / Analiza inicjatyw. Lista obejmuje wszystkie statusy; domyślnie aktualne, z archiwum, projektem i statusami w filtrach; tabela, kanban, kalendarz/Gantt.

Prace: obowiązkowe sekcje N-karty od początku, opcjonalne dostępne do dodania; jakość, długości, spójność i iteracyjne uzupełnianie. Analiza portfela porównuje pokrycie celów/obszarów, nakładanie się prac, priorytety, stare/nowe i historię podobnych działań. Wytwarza obserwacje, rekomendacje, decyzje i uzasadnienie do wyboru. Parking/archiwum zachowuje powód i warunek powrotu, aby nie odtwarzać tej samej nietrafionej rekomendacji.

Odbiór: portfel zawierający duplikat, lukę, inicjatywę biegnącą i historycznie odrzuconą; analiza rozróżnia te przypadki, użytkownik akceptuje część i komentuje resztę, decyzje zapisują się bez utraty historii.

### W10 — plan i obciążenie

Źródło: P11/P15, C2b staffing, druga notatka. Zależności: W03/W04/W09. Zespół: proces i dane.

Prace: analiza kolejności, zależności, ścieżki krytyczne, warunki i założenia. Propozycje można komentować, zmieniać i przyjmować częściowo/zbiorczo; dopiero przyjęcie zmienia plan. Kalendarz 1/3/6/12 miesięcy, 1/3 tygodniowo, 6/12 miesięcznie, z możliwością zejścia do tygodni. To wybór wykonawczy godzący oba opisy skali, bez pytania właściciela.

Obciążenie: godziny przydzielone wobec deklarowanej tygodniowej dostępności projektowej, nie automatycznie 40 h. Heatmapa >100% na czerwono, osoby i stosy inicjatyw na osi, projekt/organizacja/status. AI podpowiada przyszłe przydziały i przesunięcia. Planowanie nie zmienia obsady ani zatwierdzonego harmonogramu już biegnącej pracy. Zbiorcze apply scenariusza przyszłych inicjatyw musi pominąć rozpoczęte; ich daty lub zasoby można zmienić wyłącznie odrębnym uprawnionym procesem zmiany W11, z analizą skutków i wymaganą zgodą. Analiza finansowa planu korzysta z W14; nie blokuje poprawnego liczenia godzin.

Odbiór: dwa projekty współdzielą człowieka, przeciążenie i brak dostępności, zależność cykliczna, częściowa akceptacja, zmiana planu w trakcie analizy, niezmienione przydziały realizacji. Liczby heatmapy zgodne z niezależnym obliczeniem.

### W11 — Realizacja, codzienna praca i ryzyko

Źródło: 1.12/P15, kontrakt Realizacja, DEC-466, druga notatka. Zależności: W03/W04/W10. Zespół: proces.

Menu 2: Bank realizacji / Praca / Zarządzanie ryzykiem / Raporty. Ta sama inicjatywa i historia co przy planowaniu; nie wymaga ręcznego tworzenia kopii. Widoki tabela/kanban/kalendarz/Gantt z czytelnymi opóźnieniami, zagrożeniami i ryzykiem.

Praca: zeszły/następny tydzień i miesiąc, taski, decyzje, priorytety, projekty, rekomendacje uwagi, eskalacje, delegacje i zmiana obsady przez uprawnionego przełożonego. Ryzyko/istotna zmiana: N-karta sytuacji i zagrożeń → działania → skutki → powiadamiani. Oddzielić operacyjną korektę od zmiany zatwierdzonych założeń; zatwierdzenie uruchamia spójne zastosowanie zmiany i powiadomienia.

Odbiór: opóźnienie i brak decyzji widoczne u odpowiedzialnych, zmiana strategiczna nie stosuje się przed zgodą, nieaktualny plan wymaga ponownego sprawdzenia; osoby dostają właściwe zadania i informacje. Wykonanie DONE/CLOSED nie udaje zmierzonego efektu.

### W12 — Rezultaty i operacjonalizacja strategii

Źródło: SSOT_WYNIKI_KPI_OKR_ROI, P7K/P9, moduł Rezultaty. Zespół: finanse i wyniki.

Prace: wielopoziomowe cele organizacji, obszarów, projektów i odpowiedzialnych osób; zachować sens BSC/MBO/KPI/OKR/ROI zamiast pięciu odrębnych kopii danych. Generator ręczny/AI/template wyjaśnia dobór mierników z kontekstu strategii i zatwierdzonych inicjatyw. KPI skutku definiowane podczas opracowywania inicjatywy i zatwierdzane przez właściwą rolę.

Wspólne zbieranie danych: kto, co, za jaki okres, do kiedy; formularze, linki, przypomnienia, e-mail i Inbox, eskalacje braków oraz osobne reguły odchyleń. Obsłużyć KPI, OKR i ROI, źródła aktualizacji, korekty i historię. Odchylenie → karta działania → task → sprawdzenie efektu.

Odbiór: poprawny okres i jednostka, YTD, brak danych różny od zera, spóźniona odpowiedź, przekroczenie, brak podwójnej karty przy retry, uprawniony odbiorca, zamknięta pętla korekty; brak podwójnego liczenia korzyści w ROI. Finance↔ROI używa przypiętych wersji: zatwierdzony baseline pozostaje stały, forecast jest wersjonowany, actuals mają historię korekt; rozbieżność uruchamia uzgodnienie danych zamiast wzajemnego nadpisywania magazynów.

### W13 — raportowanie wspólne

Źródło: 3.14/3.16, Results, Materials, raporty Inicjatyw/Realizacji. Zespół: materiały i wyniki.

Prace: wspólny silnik briefu, szablonów, daty/as-of, odbiorców, cykli i eksportów. Oddzielne treści: przygotowanie inicjatyw (kompletność, zgody, zaległości), portfel i obciążenie, tydzień wykonania, postęp/rezultaty. Startowy zestaw pięciu wzorców przygotować z rzeczywistych zadań raportowych; liczba nie jest limitem produktu. Raport ma lekką czytelną formę, właściwy wykres lub kalendarz i uzasadnione wnioski.

Odbiór: raport na żądanie i cykliczny, projekt i organizacja, poprawny snapshot, plik PDF i wymagane formaty otwierają się; wysyłka respektuje odbiorców/uprawnienia i pokazuje faktyczny status doręczenia. Retry nie wysyła dubli. Stary raport nie stosuje nieaktualnych rekomendacji bez ponownej walidacji.

### W14 — pełne Finanse pojedynczej spółki

Źródło: F1 F-P1…F-P11, C8, moduł Finanse, DEC-470. Zespół: finanse i wyniki. Fala 2.

Prace: przyjąć i zweryfikować istniejące minimum, następnie wykonać brakujące ogniwa F-P1…P6, potem P7…P11 według pełnych kontraktów. Zatwierdzony pakiet sprawozdań RZiS/BS/CF dla wielu okresów jest punktem wyjścia dla analizy wskaźników, trendów, niezgodności, modeli, prognoz, wyceny i budżetów. Założenia wersjonowane, przypisane do okresów i źródeł, możliwe powiązanie z projektami PMO. Wnioski i rekomendacje prowadzą do inicjatyw.

Odbiór: pełna ścieżka jednego sprawozdania/pakietu, przeliczenia deterministyczne z niezależnym punktem odniesienia, zmiana założeń i porównanie wersji, zależność modelu od zatwierdzonej wersji danych, brak bilansu otwarcia daje jawną blokadę zamiast zer. Interpretacja ma jakość pracy analityka/CFO i wskazuje dane/założenia; nie oceniać jakości na podstawie nazwy modelu AI.

### W15 — Teresa jako wykonawca i tutor

Źródło: 3.1/3.9, AGENT_EXECUTION_V8_SSOT, zasady Teresy, Canvas. Zależności: W01/W02, adaptery W04–W14; wdrażane przyrostowo. Zespół: agent i kontekst.

Prace: jeden plan pracy i historia rozmowy; rozpoznanie celu, diagnoza braków, propozycje narzędzi/spotkań, wykonanie kroków, wnioski/inicjatywy, monitoring i mentoring dopasowany do roli użytkownika. Pomoc ma prowadzić wymagającego klienta do konkretnego wyniku. Działania korzystają z rzeczywistych modułów, uprawnień, zatwierdzeń, limitera i źródeł.

Odbiór: całe zlecenie przechodzi kilka modułów; zatwierdzenie propozycji odróżnione od wykonania, częściowy błąd daje uczciwy stan, ponowienie nie dubluje artefaktów; przerwanie/wznowienie i zmiana celu zachowują kontekst. Zero twierdzeń o wykonaniu bez zapisanego rezultatu. Przygotowanie grafu W16 można prowadzić zanim wszystkie adaptery będą gotowe, ale całości nie odbieramy na atrapach.

### W16 — graficzny, wykonywalny proces projektu

Źródło: Agent/Canvas oraz pierwsza notatka właściciela. Zespół: agent i proces. Fala 2, krytyczny element zakresu.

Prace: paleta węzłów odpowiadających realnym czynnościom Consultify; ręczne układanie i plan Teresy; połączenia, zmiana kolejności, równoległość, warunki i akceptacje; czytelne kolory/oznaczenia, czas i odpowiedzialni. Klik węzła otwiera właściwą pracę. Graf i Gantt są widokami jednego wykonywalnego planu, zgodnego z rozmową.

Odbiór obowiązkowego scenariusza: przyjęcie zlecenia i zatwierdzona notatka → propozycja projektu → zatwierdzenie utworzenia projektu → wywiad z terminem 5 dni → diagnoza → wnioski → inicjatywa → plan → realizacja → wynik. Terminy i przypomnienia są aktywne; równoległa gałąź, odmowa zatwierdzenia i przerwanie dają poprawne stany. Statyczny diagram nie spełnia wymogu.

### W17 — Idee, Notatki, Dokumenty i pozostałe materiały

Źródło: punkt 6 właściciela, MyWork/Materials/Canvas, 1.6 i S1.4, 3.10/3.11/3.14/3.17/3.18 oraz pozycje FALA_2_PO_STAGINGU. Zespół: materiały i jakość.

MVP: imienna lista każdej dostępnej akcji i minimum trzy trudne zadania dla każdego narzędzia; inwentarz ma rozbić także reprezentacje Idei (mapa, tablica, proces, tabela), aby nie schować nieprzetestowanej funkcji pod trzema próbami całego modułu. Idee: z nieuporządkowanych źródeł do uzasadnionej koncepcji, iteracja/wersja, przekazanie do pracy. Notatki: długa struktura z powiązaniami, edycja i ponowne otwarcie, wykorzystanie w materiale. Dokumenty: materiał zarządczy z wieloma źródłami, zmiana wybranej części bez utraty reszty, eksport i dalsza praca. Dobór scenariuszy jest zadaniem zespołu; nie upraszczamy ich do create/delete.

Dodatkowa istniejąca bramka MVP 1.6/S1.4: jeden profesjonalny dokument i jedna profesjonalna prezentacja na rzeczywistych danych DBR77, odebrane jako otwieralne pliki przez kompletność, merytorykę i grafikę oraz wymagany odbiór właściciela. Nie odkładamy jakości plików do Fali 2.

Fala 2: pozostałe konwersje, historia/wersje, preferencje/panele, foldery, głos, źródła arkuszy i nowe wzorce; generatory prezentacji/raportów i pliki profesjonalnej jakości. Zachować każdy istniejący wpis programu, nawet jeśli właściciel nie powtórzył go w ostatniej notatce.

Odbiór: pełna macierz przycisków, realny zapis/reload, kontekst i rodowód między modułami; rzeczywisty plik otwarty i obejrzany, kompletność/merytoryka/grafika. Sprawdzić generację AI oddzielnie od fallbacków i szablonów.

### W18 — Spotkania z aktywną Teresą

Źródło: 13_meeting, program Spotkania z indeksu (kolizje numeracji identyfikować nazwą), druga notatka. Zespół: agent i materiały.

Prace: trzy fazy przygotowanie/prowadzenie/podsumowanie i działania; kreator ręczny/AI/template; cel, agenda, oczekiwany wynik, uczestnicy i przygotowanie; zaproszenia/onboarding, N-karta. Ekran prowadzenia pozwala pracować z Teresą i przełączać prawdziwe artefakty bez utraty kontekstu. Protokół, decyzje, zadania i powiązania zapisują się w aplikacji.

Odbiór: przygotować warsztat, zaprosić uczestnika testowego, pracować na inicjatywie i innym narzędziu, wrócić do spotkania, zatwierdzić ustalenia i odnaleźć je w modułach. Obsłużyć przerwanie i brak uprawnień. Wersja lokalna jest pierwszym przyrostem Fali 2; online i integracje konferencyjne pozostają jawnie w W19 — nie uznawać lokalnej wersji za dowód działającego Teams.

### W19 — integracje, poczta i dostarczanie danych

Źródło: katalogi integracji Admin/Settings/Meeting/Materials, DEC-471, C6/S2. Zespół: integracje, w kolejce wykonawczej integratora.

Prace: pełny inwentarz już obiecanych integracji z kierunkiem danych, uprawnieniami, ownerem, retry i stanem dostarczenia. Punkt wejścia: INTEGRATIONS_SYNC_MCP_PLAN_V3; zakres do sprawdzenia obejmuje SMTP/M365/Gmail, Slack/Teams/WhatsApp, Drive/OneDrive/SharePoint/S3/Azure Blob, Jira/Asana/Monday/ClickUp/Azure DevOps, Google/Outlook Calendar, webhook/API/Zapier/Make oraz MCP/IRIS/Marketplace. Odróżnić zatwierdzone zobowiązania od historycznych kandydatur draftu i wykonać cały zatwierdzony zakres; nie traktować samych nazw jako gotowych konektorów. Priorytet techniczny: zaproszenia/reset/zbieranie danych/raporty/spotkania oraz źródła dla analiz. Zweryfikować aktualne możliwości dodatkowych integracji i przedstawić konkretny przyrost wartości, nie listę logo. Jedna wspólna mechanika zamiast oddzielnej poczty każdego modułu.

Odbiór: autoryzacja i cofnięcie, odczyt/zapis zgodny ze wskazanym zakresem, błąd i retry, potwierdzenie dostarczenia; spotkanie online sprawdzone z rzeczywistym połączeniem. Lokalne testy transportu nie dowodzą doręczenia Hostinger ani działania platformy konferencyjnej. Dostęp zewnętrzny zatrzymuje tylko zależny odbiór, nie całą implementację.

### W20 — atrakcyjność dla firm doradczych

Źródło: punkt 12, BUSINESS_POSITIONING_SSOT, Partner Portal. Zespół: integrator po bazowym odbiorze scenariuszy.

Prace: jednorazowa analiza zastosowania platformy przez duże firmy doradcze, rozdzielenie zakupu licencji, partnerstwa i przejęcia firmy. Zbudować scenariusze demonstracyjne i mierzalne dowody jakości, oszczędności czasu, kontroli wiedzy oraz obsługi wielu klientów. Ustalenia powiązać z istniejącym pozycjonowaniem i portalem partnerskim. Żadna hipoteza rynkowa nie staje się automatycznie nowym zakresem kodowym.

Odbiór: raport oparty na aktualnych źródłach i rzeczywistych wynikach aplikacji, konkretne luki oraz rekomendacje. Cykliczność była sugestią — nie zakładamy automatyzacji ani nie kontaktujemy potencjalnych klientów bez odrębnego zlecenia komunikacji.

### W21 — pozostałe zobowiązania 16 modułów i wydania

Źródło: S1/S2/S3, wszystkie pozostałe wpisy TRZY_POJEMNIKI oraz 21 pozycji FALA_2_PO_STAGINGU.

Prace: nie zgubić historii prywatnego/organizacyjnego Czatu, preferencji, wspólnego standardu kart, menu kanw, kolorów, managera opartego na realnych danych, folderów i konwersji Idei, historii i wyszukiwania Notatnika, kreatorów inicjatyw, uprawnień i doradcy Oceny. Pozostałe moduły Organizacja/Admin/Settings/Partner mają zachować pełny zakres własnych kontraktów i aktualnych akceptacji. Każdy wpis dostaje powiązanie do W01–W20 albo osobny podpakiet W21 z wykonawcą; brak wzmianki w nowych notatkach nie oznacza anulowania.

Wydanie: zachować komplet S1.1–S1.13, S2.1–S2.14 oraz S3.1–S3.5 per program, z nowszymi decyzjami EN/staging/Finance. Odbiór wizualny dotyczy rzeczywiście zmienionych powierzchni i istniejących wymogów; nie żądać od właściciela ponownego zatwierdzania niezmienionych kontraktów.

### W22 — konsolidacja i relacje grupy spółek

Źródło: doprecyzowanie finansów właściciela. Status: wyraźnie zarejestrowany pełny zakres; faza 3 to propozycja etapowania właściciela, nie potwierdzona decyzja usunięcia z Fali 2.

Prace przygotowawcze w W14: stabilne podmioty, okresy, wersje i założenia umożliwiające rozszerzenie. Pełna realizacja: około 300 spółek, różne reżimy sprawozdawcze/waluty/okresy, mapowanie i konsolidacja, relacje kapitałowe/osobowe/handlowe/dłużne, kolorowa mapa relacji, eliminacje i uzgodnienia, projekty typu Budżet 2026 v1, tagowane założenia z dokumentów/deklaracji/obserwacji i wyjaśnień.

Odbiór: uzgodnienie wyniku do danych podmiotów i korekt konsolidacyjnych, brak podwójnego liczenia, różne okresy i zestawy założeń, pochodzenie każdej zmiany, wydajność docelowej skali. Kontrakt fachowy i dane wzorcowe przed obliczeniami. Plan nie deklaruje gotowości ani nie zaczyna budowy silnika konsolidacji w ramach E0 finansów. Przed zamknięciem Fali 2 jej granica wobec W22 musi być jawnie zapisana — nie wolno po cichu pominąć tego zobowiązania.

## 4. Kolejność i zależności

### Teraz: domknięcie MVP i przygotowanie zależności
1. Integrator przyjmuje C2b/C4/C6/C8E0 i przygotowuje W00 na jednej bazie. Osobny reviewer sprawdza C4E4 i C6.
2. Tor A: W17 część MVP — komplet działań i trzy trudne zadania na każde narzędzie, naprawy luk.
3. Tor B: W05 część MVP — odbiór odpowiedzi managera z pełnym powrotem do poprawy.
4. W01 obejmuje te powierzchnie w trakcie pracy, a nie jako wielomiesięczny audyt poprzedzający kodowanie. W03/W14 można opracowywać w izolacji w zakresie już zleconym DEC-474/470.
5. Po wspólnym odbiorze realizować pilotaż według S2: cztery osoby, 14 dni realnego użycia, 7 dni obserwacji, poczta/alerty/limiter i prawa do danych. Lokalna próba nie zastępuje tych okresów.

### Fala 2 — przyrosty kończone użytkowo
A. W01/W02/W03/W04: wspólne kontrakty, kontekst, projekt/role i ciągłość obiektów. Startować od jednego pionowego scenariusza, rozszerzać sprawdzone wzorce.
B. Równoległe tory domenowe: W05–W08 diagnoza oraz W09–W11 planowanie/realizacja. W14 finanse wchodzi, gdy zwolni się slot; nie czeka na wszystkie metody Tools.
C. W12/W13: efekty i raportowanie, wraz z integracjami W19 potrzebnymi do zbierania danych. KPI kontrakt dla inicjatywy powstaje już w A/B, nie dopiero po zakończeniu realizacji.
D. W15/W16: adaptery Agenta i wykonywalny graf dokładane do gotowych pionowych ścieżek. Projekt wykonawczego planu powstaje w A, aby moduły nie budowały niezgodnych interfejsów. Cały graf jest obowiązkowym wynikiem Fali 2.
E. W17 pozostałe materiały, W18 spotkania, W19 pozostałe integracje oraz W21 odziedziczony backlog. W20 analiza komercyjna korzysta z dowodów tych scenariuszy.
F. Odbiór każdego programu i całych ścieżek, kontrolowane uruchomienie, rzeczywiste użycie, rejestr i tag. Granicę W22 zapisać jawnie przy planowaniu wydania finansów.

Powyższe A–F to kolejność zależności, nie sześć nowych fal. Nie obowiązuje szeregowe czekanie całej aplikacji na wszystkie kontrakty: kontrakt konkretnej paczki, implementacja i odbiór idą razem.

## 5. Organizacja zespołów

| Odpowiedzialny | Stała odpowiedzialność | Pierwsza kolejka |
|---|---|---|
| Integrator — root | zgodność ze źródłami, jedna kolejka, rozstrzygnięcia wykonawcze, scalenia i wydania | W00, synchronizacja istniejącego rejestru, wydanie dwóch rozłącznych paczek MVP |
| Galileo / canonical_writers | proces, dane, PMO, przejścia i idempotencja | przegląd dostawy C6 jako niezależny od autora; potem W03/W04/W09–W11 |
| Nietzsche / delivery_audit | jakość diagnostyki i materiałów; niezależne odbiory cudzych zmian | W17 MVP lub review W00; potem W01/W05–W08 |
| Turing / scope_audit | finanse, wyniki, agent/spotkania według kolejki | W05 MVP albo W14 według rozłączności; potem W12–W16/W18 |
| Istniejący Codex6 | gotowość pilotażu, własny przekazany zakres | poprawki wynikające z niezależnego odbioru, bez dublowania jego kodu |

To odpowiedzialności w kolejce, nie obietnica kilkunastu równoległych zespołów. Maksymalnie dwa bloki implementacyjne naraz; ciężki odbiór ma zasoby na wyłączność. Autor nigdy nie jest jedynym odbiorcą swojej zmiany. Trzy wkłady do niniejszego planu są read-only i nie zajmują równoległych środowisk produktu.

Każda paczka przed startem ma: pełne źródła/aktualny kontrakt, dokładny base SHA i worktree, zakres własności plików, zarezerwowaną bazę/port, zależności, scenariusze pozytywne/negatywne, kryteria treści/obrazu/pliku oraz miejsce raportu. Parametry środowiskowe ustalamy na aktualnym stanie przy wydaniu, nie kopiujemy nieaktualnych PID czy portów z historii.

## 6. Wspólny odbiór produktu

1. Kontrakt pokryty funkcją i rzeczywistym wywołaniem; błędy mają zrozumiałą dalszą akcję.
2. UI → API → baza → niezależny odczyt → reload; poprawna osoba/projekt/organizacja.
3. Powtórzenie operacji, zmiana wersji, odmowa i częściowe niepowodzenie nie tworzą fikcyjnego sukcesu.
4. Wynik AI na rzeczywistym modelu i kontrolowanych źródłach; testy z atrapą służą mechanice, nie jakości konsultanta.
5. Wynik treści i plik przechodzą kompletność, merytorykę i grafikę; liczby liczy silnik, interpretacja wskazuje dowody i założenia.
6. Jasny/ciemny motyw, klawiatura i wymagane szerokości; semantyczne kolory i czytelność, nie tylko brak błędu renderowania.
7. Niezależny odbiorca wydaje PASS/PARTIAL/FAIL z dokładnym zakresem. Flaga OFF i lokalne PASS nie oznaczają dostępności u klienta.
8. Po uruchomieniu: właściwy SHA/konfiguracja/migracje, dowód użycia, obserwacja, aktualny punkt cofnięcia i przekazanie.

Obowiązkowe scenariusze przekrojowe:
- diagnoza bez projektu → wniosek → utworzenie projektu przy inicjatywie → zgoda → realizacja → pomiar;
- pełne zlecenie przez rozmowę i przez graf, z przerwą i wznowieniem;
- portfel dwóch projektów ze wspólnymi ludźmi → analiza/akceptacja → brak zmian biegnącej pracy;
- zmiana ryzyka/założeń → analiza skutków → zgoda → plan → informacja do zespołu;
- sprawozdanie → zatwierdzony model → rekomendacja → inicjatywa → rzeczywisty wynik;
- KPI/OKR/ROI → formularz → brak/spóźnienie/odchylenie → eskalacja → działanie → sprawdzenie efektu;
- audyt z instrukcji → dowód → ustalenie → naprawa → skuteczność;
- spotkanie na realnych artefaktach → protokół → decyzje i zadania w tych samych projektach;
- trzy trudne scenariusze dla każdego z Idei, Notatek i Dokumentów oraz komplet dostępnych akcji.

## 7. Sterowanie terminem i ryzykiem

Nie podajemy fikcyjnego procentu ani sumy historycznych „sesji” jako daty końca. Termin konkretnej paczki prognozujemy po przyjęciu bazy i różnicy kontrakt–wykonanie, a aktualizujemy po niezależnym odbiorze. Twarda część kalendarza: 14 dni rzeczywistego pilotażu i wymagany okres obserwacji. Pełna data Fali 2 jest na dziś NIEOSZACOWANA; plan ma kompletny zakres i kolejność, nie udaje zakończonego sizingu.

Ryzyka z działaniem:
- rozbieżne dokumenty → hierarchia i dopisanie aktualizacji do istniejącego kontraktu, nie nowe pytania ogólne;
- zapis w innym magazynie niż ekran → W00/W04, readback i test negatywny;
- przeciążenie zespołów/środowisk → dwie rozłączne implementacje i rotacyjny review;
- brak poczty/dostępu zewnętrznego → lokalna implementacja idzie dalej, rzeczywiste doręczenie pozostaje osobną bramką;
- jakość AI ukryta za „generator działa” → W01 i ocena realnych wyników;
- zbyt duży program → kończone pionowe ścieżki, bez usuwania pozostałego zakresu;
- niejasna granica konsolidacji → zachowany W22 i jawne przypisanie do wydania, bez cichego skreślenia.

## 8. Trwały zapis i obowiązywanie

Ten plan i wkłady zespołów są przechowane poza checkoutem właściciela. Przy następnym przyjęciu bazy integrator dopisuje mapowanie i stan do istniejącego docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md oraz właściwych kontraktów. Nie zakłada konkurencyjnego rejestru produktu; identyfikatory W są pomocniczą mapą powiązań.

PLAN_DOMKNIECIA.md zachowuje wcześniejszy audyt i bramki wydania; niniejszy dokument aktualizuje jego zakres doprecyzowaniami właściciela i najnowszym stanem dostaw. HANDOFF_CHICAGO otrzymuje wskazanie kolejki. Materiały źródłowe oraz wycofana lista pytań pozostają w historii; nie zmieniać ich w rzekomo zatwierdzone nowe decyzje.

Załączniki: MACIERZ_POKRYCIA_DOPRECYZOWAN.json (wymagania i pakiety); PLAN_INPUT_PMO_AGENT.md, PLAN_INPUT_FINANCE_RESULTS.md, PLAN_INPUT_DIAGNOSIS_QUALITY.md (dokładne źródła i luki); PLAN_REVIEW.md (niezależna kontrola kompletności planu). Istnienie planu nie oznacza, że wymienione pakiety już uruchomiono lub odebrano.
