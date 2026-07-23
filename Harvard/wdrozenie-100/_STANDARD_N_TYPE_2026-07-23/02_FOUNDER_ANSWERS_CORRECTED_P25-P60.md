# ODPOWIEDZI FOUNDERA — CZĘŚĆ 2
## P25–P60: Fundamenty firmy, organizacja, governance, wiedza, badania, playbooki, customer insights i product management

> Dokument roboczy dla Claude’a.  
> Źródło pytań: `PYTANIA_DO_ZALOZYCIELA.md`.
>
> **Zasada wykonawcza dla Claude’a**
>
> Każdą odpowiedź należy stosować zgodnie z oznaczonym statusem:
>
> - `ZATWIERDZONE` — decyzja wiążąca.
> - `ZATWIERDZONE WARUNKOWO` — decyzja obowiązuje przy wskazanych ograniczeniach.
> - `HIPOTEZA MVP` — obowiązuje tymczasowo do checkpointu.
> - `ODŁOŻONE` — nie realizować teraz; utworzyć jawny trigger powrotu.
> - `WYMAGA WERYFIKACJI` — nie przedstawiać jako fakt.
> - `DO UPROSZCZENIA` — zachować cel, ale zmniejszyć poziom procesu.
>
> Claude nie może samodzielnie promować hipotez do decyzji stałych ani rozszerzać procesu poza wskazany zakres.

---

## P25 — Poziom formalizmu pięciu dokumentów fundamentów firmy

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Cel pięciu dokumentów jest prawidłowy, ale obecny poziom formalizmu jest zbyt wysoki dla etapu przedprzychodowego i jednoosobowego modelu działania.

Nie usuwamy fundamentów firmy, ale konsolidujemy je do maksymalnie dwóch operacyjnych dokumentów:

1. `FOUNDATION_PRINCIPLES.md` — kultura, wartości, zasady działania i prawa decyzyjne;
2. `DEFINITION_OF_DONE_AND_OPERATING_RULES.md` — standard wykonania, dowody ukończenia i podstawowe zasady operacyjne.

Pozostałe pliki mogą pozostać jako materiały źródłowe lub zostać oznaczone jako rozwinięcia, ale nie powinny wymagać osobnego rytuału zarządzania.

### Uzasadnienie

Na tym etapie dokumentacja ma przyspieszać decyzje i egzekucję. Jeżeli pięć dokumentów wymaga więcej pracy niż realnie pomaga w działaniu, staje się nadbudową procesową.

### Instrukcja dla Claude’a

1. Przygotuj plan konsolidacji pięciu dokumentów.
2. Zachowaj wszystkie istotne zasady, ale usuń duplikaty.
3. Ogranicz obowiązkowe pola i rytuały do minimum.
4. Nie kasuj historii — archiwizuj dokumenty zastąpione.
5. Wskaż, które treści mają być wiążące, a które tylko referencyjne.

---

## P26 — Promocja pięciu plików z draft do accepted

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Nie promujemy automatycznie wszystkich pięciu plików w obecnym brzmieniu. Najpierw należy wykonać konsolidację i usunięcie nadmiarowego formalizmu.

Po konsolidacji:

- dokument fundamentów firmy może otrzymać status `accepted`,
- Definition of Done i podstawowe operating rules mogą otrzymać status `accepted`,
- szczegółowe rozwinięcia pozostają `reference` lub `draft`, dopóki nie zostaną sprawdzone w praktyce.

### Instrukcja dla Claude’a

1. Nie zmieniaj statusu wszystkich pięciu plików naraz.
2. Przygotuj wersję skonsolidowaną.
3. Utwórz mapę: stary dokument → nowe miejsce treści.
4. Oznacz nieprzetestowane procedury jako `hypothesis` lub `draft`.
5. Dopiero po konsolidacji zaproponuj zmianę statusu.

---

## P27 — Nazwa robocza „AI Startup Team”

**Status:** ZATWIERDZONE JAKO NAZWA ROBOCZA

### Odpowiedź foundera

„AI Startup Team” zostaje zatwierdzone jako nazwa robocza projektu i repozytorium dokumentacyjnego. Nie jest to jeszcze finalna marka handlowa produktu.

W dokumentacji należy rozdzielić:

- `project name`: AI Startup Team,
- `product/brand name`: do późniejszej decyzji,
- `reference venture`: FizzUp / Startup Zero.

### Instrukcja dla Claude’a

1. Usuń adnotację `pending founder confirmation`.
2. Oznacz nazwę jako `working project name`.
3. Nie używaj jej automatycznie jako finalnej marki publicznej.
4. Dodaj jednoznaczną definicję nazwy w głównym README.

---

## P28 — Incydent Replit/SaaStr i standard źródłowy

**Status:** WYMAGA WERYFIKACJI

### Odpowiedź foundera

Incydent Replit/SaaStr może być używany jako przykład ryzyka tylko po wskazaniu źródła, daty i poziomu pewności.

Nie może być przedstawiany jako bezsporny fakt, jeśli dokumentacja opiera się wyłącznie na wtórnym briefie albo niesprawdzonym streszczeniu.

### Instrukcja dla Claude’a

1. Znajdź pierwotne lub wiarygodne źródło.
2. Oznacz stan faktyczny i interpretację osobno.
3. Usuń liczby lub wnioski, których nie można potwierdzić.
4. Jeżeli źródło jest słabe, pozostaw incydent jako ilustrację, nie dowód.
5. Zastosuj ten sam standard do wszystkich podobnych przykładów.

---

## P29 — Status dokumentów organizacyjnych

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Nie promujemy całego pakietu organizacyjnego do `accepted` bez korekty. Obowiązuje ten sam model jak w fundamentach firmy:

- zasady komunikacji i role operacyjne mogą zostać zaakceptowane po uproszczeniu,
- meeting rules, knowledge management i przyszła struktura organizacyjna pozostają częściowo hipotetyczne,
- dokumenty dotyczące późniejszych faz nie powinny udawać bieżącej organizacji.

### Instrukcja dla Claude’a

1. Rozdziel „stan obecny” od „modelu docelowego”.
2. Oznacz przyszłe role i zespoły jako `future state`.
3. Usuń sprzeczności z modelem founder + AI agents.
4. Zaproponuj status każdego pliku osobno.
5. Nie traktuj draftów jako źródła wiążących uprawnień.

---

## P30 — SLA komunikacyjne i obciążenie foundera

**Status:** HIPOTEZA MVP DO UPROSZCZENIA

### Odpowiedź foundera

SLA mogą pozostać jako cele operacyjne, ale nie jako twarde gwarancje.

Przyjmujemy:

- decyzje blokujące: odpowiedź w ciągu 1 dnia roboczego, jeśli founder jest dostępny,
- tygodniowy przegląd: maksymalnie 60 minut,
- higiena pamięci i dokumentacji: maksymalnie 20–30 minut miesięcznie,
- sprawy nieblokujące: grupowane do jednego przeglądu, bez ciągłych powiadomień.

### Uzasadnienie

System ma chronić czas foundera, a nie tworzyć obowiązek ciągłego odpowiadania agentom. Najważniejsze jest grupowanie decyzji i ograniczenie liczby przerwań.

### Instrukcja dla Claude’a

1. Zmień SLA na `target SLA`.
2. Dodaj mechanizm batchowania pytań.
3. Ogranicz liczbę kategorii wymagających natychmiastowego kontaktu.
4. Dodaj tryb `founder unavailable`.
5. Mierz faktyczny czas poświęcony na governance.

---

## P31 — Niedostępność foundera i tryb awaryjny

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Jeżeli founder jest niedostępny, działania wysokiego ryzyka zatrzymują się. Nie ma automatycznego zatwierdzenia przez upływ czasu.

Dopuszczalne jest kontynuowanie:

- analiz,
- szkiców,
- testów w sandboxie,
- dokumentacji,
- prac odwracalnych bez danych produkcyjnych.

Zabronione pozostają:

- publikacje,
- płatności,
- zmiany produkcyjne,
- zmiany uprawnień,
- działania na kontach klienta,
- komunikacja zewnętrzna w imieniu klienta.

Docelowo należy ustanowić osobę zastępczą, ale nie jest to wymagane przed rozpoczęciem walidacji rynku.

### Instrukcja dla Claude’a

1. Zdefiniuj tryb `FOUNDER_UNAVAILABLE`.
2. Dodaj listę działań dozwolonych i zablokowanych.
3. Nie stosuj time-based auto-approval.
4. Dodaj trigger utworzenia zastępstwa przed pierwszymi operacjami produkcyjnymi klientów.

---

## P32 — Triggery zatrudnienia w Org Structure

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Tabela triggerów zatrudnienia jest użyteczna jako narzędzie myślenia, ale nie może działać automatycznie.

Każdy trigger powinien opierać się na mierzalnym bottlenecku, np.:

- founder poświęca ponad 5 godzin tygodniowo przez 6–8 tygodni na dany obszar,
- opóźnienia wpływają na klientów lub przychód,
- ryzyko operacyjne przekracza tolerancję,
- koszt braku zatrudnienia jest wyższy niż koszt roli,
- zadanie nie może być bezpiecznie zautomatyzowane.

Metryki takie jak CAC czy change-failure rate stosujemy tylko wtedy, gdy są faktycznie mierzone.

### Instrukcja dla Claude’a

1. Zmień sztywne progi w hipotezy.
2. Dodaj wymóg dowodu bottlenecku.
3. Usuń metryki, których firma jeszcze nie mierzy.
4. Każde zatrudnienie wymaga osobnej decyzji founderskiej.

---

## P33 — Ręczne wykonywanie ról klienckich do Fazy 6

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Akceptuję, że do Fazy 6 role AI Product Owner, AI CTO i AI Launch Manager są w dużej mierze symulowane lub wykonywane przez sesje agentowe oraz proces ręczny.

Nie wolno jednak przedstawiać tego klientowi jako w pełni autonomicznego zespołu.

### Zasada komunikacji

Do czasu realnego runtime’u produkt może być opisywany jako:

> usługa wspierana przez wyspecjalizowane agenty AI i kontrolę człowieka,

a nie jako autonomiczny zespół działający bez nadzoru.

### Instrukcja dla Claude’a

1. Rozdziel `service delivery model` od `target product model`.
2. Usuń przesadzone deklaracje autonomii.
3. Dodaj jawne oznaczenie procesów ręcznych.
4. Mierz, które zadania są wykonywane automatycznie, półautomatycznie i ręcznie.

---

## P34 — Pełny cykl kart decyzyjnych i pakietów bramkowych

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Nie stosujemy pełnego cyklu kart decyzyjnych dla każdej decyzji w Fazie 1.

Pełna karta jest wymagana wyłącznie dla decyzji:

- nieodwracalnych,
- prawnych,
- bezpieczeństwa,
- kosztowych powyżej ustalonego progu,
- zmieniających architekturę lub ofertę,
- wpływających na klienta produkcyjnego.

Pozostałe decyzje mogą być zapisane w uproszczonym logu.

### Instrukcja dla Claude’a

1. Wprowadź format `Decision Lite`.
2. Zachowaj pełne ADR tylko dla decyzji wysokiego znaczenia.
3. Ogranicz liczbę obowiązkowych pól.
4. Nie twórz pakietu bramkowego bez realnego odbiorcy.

---

## P35 — Chronione powierzchnie dokumentacyjne

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Chronione przed cichą zmianą mają być:

- zaakceptowane ADR-y,
- prawa decyzyjne,
- zakres MVP,
- model bezpieczeństwa i autonomii,
- publiczne obietnice produktu,
- pricing assumptions używane w sprzedaży,
- phase gates,
- lista ryzyk krytycznych,
- polityki danych i dostępu.

Nie wszystkie pliki repozytorium wymagają tej samej ochrony.

### Instrukcja dla Claude’a

1. Utwórz centralną listę protected surfaces.
2. Dodaj ownera i wymagany tryb zmiany.
3. Usuń z listy pliki robocze i generowane.
4. Zablokuj cichą zmianę treści chronionych bez decision logu.

---

## P36 — Czy drafty są już traktowane jako wiążące

**Status:** WYMAGA AUDYTU

### Odpowiedź foundera

Claude ma sprawdzić, czy obecne agenty i instrukcje odwołują się do dokumentów `draft` tak, jakby były one obowiązujące.

Zasada jest jednoznaczna:

> dokument draft może informować i proponować, ale nie może samodzielnie nadawać uprawnień, tworzyć obowiązku ani blokować działania wysokiego ryzyka.

### Instrukcja dla Claude’a

1. Przeszukaj repozytorium pod kątem użycia draftów jako normy.
2. Przygotuj listę naruszeń.
3. Zmień odwołania na `advisory`, jeśli dokument nie jest accepted.
4. Dodaj walidację statusu dokumentu w głównych instrukcjach agentów.

---

## P37 — Kiedy promować pliki governance do accepted

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Dokumenty governance promujemy pojedynczo, nie pakietowo.

Warunki promocji:

- brak sprzeczności z aktywnymi ADR,
- wskazany owner,
- jasny zakres obowiązywania,
- przynajmniej jeden realny use case,
- brak nadmiernej ceremonii,
- jawne rozdzielenie stanu obecnego i przyszłego.

### Instrukcja dla Claude’a

1. Przygotuj checklistę promocji.
2. Przejdź przez każdy plik osobno.
3. Nie zmieniaj statusu bez raportu konfliktów.
4. Dokumenty niewykorzystywane pozostają draft lub reference.

---

## P38 — Cel poniżej 5 godzin tygodniowo dla foundera

**Status:** ZATWIERDZONE JAKO CEL PROJEKTOWY

### Odpowiedź foundera

Cel poniżej 5 godzin tygodniowo na rutynowe zarządzanie systemem agentów pozostaje obowiązującym constraintem projektowym.

Nie obejmuje to:

- kluczowych wywiadów z klientami,
- strategicznych decyzji,
- rozmów sprzedażowych,
- sytuacji kryzysowych,
- okresu pierwszego wdrożenia.

Jeżeli regularny governance przekracza 5 godzin tygodniowo przez dwa miesiące, należy uprościć system albo oddelegować część odpowiedzialności.

### Instrukcja dla Claude’a

1. Mierz czas foundera.
2. Dodaj alert operacyjny przy przekroczeniu limitu.
3. Każdy nowy rytuał musi wskazywać koszt czasowy.
4. Usuń rytuały bez mierzalnej wartości.

---

## P39 — Ciężar systemu zarządzania wiedzą

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Zachowujemy zasady:

- jedno źródło prawdy,
- status dokumentu,
- owner,
- data ostatniego przeglądu,
- linki do decyzji i źródeł.

Nie wymagamy natomiast rozbudowanej gramatyki cytowań, wielopoziomowych rytuałów i pełnego front-matteru w każdym pliku na obecnym etapie.

### Minimalny front-matter

Każdy ważny dokument powinien zawierać:

- `status`,
- `owner`,
- `last_updated`,
- `decision_links`,
- `consuming_phase`.

### Instrukcja dla Claude’a

1. Zredukuj obowiązkowy front-matter.
2. Zachowaj rozszerzone pola tylko dla dokumentów krytycznych.
3. Usuń procedury, których nikt realnie nie wykonuje.
4. Nie rozszerzaj systemu bez wykazanego problemu.

---

## P40 — Rozbudowa Lessons_Learned.md

**Status:** ODŁOŻONE DO PIERWSZYCH REALNYCH EKSPERYMENTÓW

### Odpowiedź foundera

Nie rozbudowujemy dokumentu spekulatywnymi „lekcjami”. `Lessons_Learned.md` ma zawierać wyłącznie wnioski z rzeczywistych eksperymentów, wdrożeń, błędów i rozmów z klientami.

### Trigger

Pierwsza aktualizacja powinna nastąpić po:

- pierwszych 10 wywiadach,
- pierwszym teście ceny,
- pierwszym pilocie,
- pierwszym incydencie lub istotnej zmianie założenia.

### Instrukcja dla Claude’a

1. Pozostaw prosty szablon.
2. Nie generuj treści bez dowodu.
3. Łącz każdą lekcję z eksperymentem lub decyzją.
4. Dodaj pole `evidence`.

---

## P41 — Aktualizacja tabeli kategorii w docs/README.md

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Tak, należy zaktualizować nieaktualną tabelę kategorii teraz, ponieważ jest to prosty błąd nawigacyjny wpływający na pracę agentów.

### Instrukcja dla Claude’a

1. Zaktualizuj tabelę na podstawie faktycznej struktury katalogów.
2. Usuń nieistniejące kategorie.
3. Dodaj status i przeznaczenie każdej kategorii.
4. Zweryfikuj linki automatycznie.

---

## P42 — Delegowanie akceptacji dokumentów

**Status:** ODŁOŻONE, Z TRIGGEREM

### Odpowiedź foundera

Na obecnym etapie founder zachowuje prawo do akceptowania dokumentów strategicznych i wysokiego ryzyka.

Można jednak już teraz delegować akceptację dokumentów niskiego ryzyka, takich jak:

- aktualizacje nawigacji,
- poprawki językowe,
- uzupełnienie metadanych,
- dokumentacja istniejącego zachowania,
- raporty i notatki operacyjne.

Delegowanie szersze następuje, gdy liczba dokumentów staje się realnym bottleneckiem.

### Instrukcja dla Claude’a

1. Utwórz klasy dokumentów według ryzyka.
2. Founder zatwierdza strategiczne, prawne, security i public promises.
3. Dokumenty administracyjne mogą mieć delegowanego approvera.
4. Nie zmieniaj ownera bez jawnego wpisu.

---

## P43 — Autocorrection Review dla TS-001

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Należy otworzyć Autocorrection Review dla TS-001, ale w uproszczonym formacie.

Celem jest sprawdzenie:

- czy ustalenia o Replit Mobile Apps są nadal aktualne,
- czy wpływają na ADR-001/005,
- czy wcześniejsze wnioski nie zostały nadmiernie uogólnione,
- czy potrzebna jest korekta dokumentacji.

### Instrukcja dla Claude’a

1. Utwórz krótki review record.
2. Wskaż źródła pierwotne.
3. Zaktualizuj tylko te ADR-y, które rzeczywiście są dotknięte.
4. Nie twórz dodatkowego procesu wokół jednego review.

---

## P44 — Akceptacja pięciu dokumentów Research & Innovation

**Status:** NIE AKCEPTOWAĆ W CAŁOŚCI TERAZ

### Odpowiedź foundera

Nie promujemy pięciu dokumentów do `accepted`, zanim proces nie zostanie użyty w praktyce.

Akceptujemy kierunkowo:

- evidence before confidence,
- rejestr eksperymentów,
- jawne hipotezy,
- przegląd wyników.

Pozostałe elementy pozostają draft do czasu wykonania pierwszych realnych eksperymentów.

### Instrukcja dla Claude’a

1. Zachowaj minimalny Experiment Register jako aktywny.
2. Pozostałe dokumenty oznacz jako `draft/reference`.
3. Po pierwszych trzech eksperymentach wykonaj przegląd użyteczności procesu.
4. Usuń pola, które nie zostały wykorzystane.

---

## P45 — Formalizm badań i innowacji

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Zachowujemy jeden identyfikator eksperymentu i prostą strukturę:

- hipoteza,
- metoda,
- koszt,
- wynik,
- decyzja,
- dowód.

Nie potrzebujemy teraz wielopoziomowych identyfikatorów i złożonych routing tables.

### Instrukcja dla Claude’a

1. Uprość ID do np. `EXP-001`.
2. Zredukuj szablon.
3. Zachowaj możliwość rozszerzenia później.
4. Nie generuj oddzielnych rejestrów dla każdej podkategorii.

---

## P46 — Dwa dzienniki decyzji

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Utrzymujemy dwa poziomy decyzji:

1. `Strategic ADR / Founder Decision Log` — architektura, polityki, ryzyko, model biznesowy, publiczne obietnice;
2. `Venture Decision Log` — decyzje konkretnego klienta lub konkretnego wdrożenia.

Nie każda mikrodecyzja klienta trafia do foundera. Founder zatwierdza tylko sprawy przekraczające prawa klienta, wpływające na platformę albo niosące ryzyko prawne, finansowe lub reputacyjne.

### Instrukcja dla Claude’a

1. Rozdziel oba rejestry.
2. Dodaj reguły eskalacji.
3. Nie kopiuj wszystkich decyzji venture do strategicznego ADR.
4. Utrzymuj linki między nimi tylko tam, gdzie istnieje zależność.

---

## P47 — Zakres Launch Playbook

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Na MVP Launch Playbook skupia się na:

- React Native / Expo,
- domyślnej ścieżce USA,
- standardowych aplikacjach konsumenckich i biznesowych,
- ograniczonej liczbie integracji.

EU jest możliwe po dodatkowej checkliście. Aplikacje dziecięce i regulowane nie są automatycznie wykluczone na zawsze, ale nie wchodzą do standardowej ścieżki MVP bez osobnego programu compliance.

### Instrukcja dla Claude’a

1. Zmień „wykluczone na zawsze” na „poza standardową ścieżką MVP”.
2. Dodaj osobne ścieżki exception review.
3. Nie obiecuj pełnego wsparcia kategorii regulowanych.
4. Zachowaj RN/Expo jako początkowy zakres techniczny.

---

## P48 — Brakujący playbook GTM/growth

**Status:** ZATWIERDZONE JAKO PRIORYTET FAZY 1

### Odpowiedź foundera

Tak, GTM/growth playbook jest ważniejszy teraz niż dalsza rozbudowa dokumentacji technicznej odległych faz.

Ma być jednak krótki i eksperymentalny, nie rozbudowany podręcznik.

Powinien obejmować:

- ICP,
- kanały dotarcia,
- hipotezy komunikatów,
- plan 20 wywiadów,
- test ceny,
- design partner outreach,
- metryki evidence,
- tygodniowy rytm uczenia się.

### Instrukcja dla Claude’a

1. Utwórz minimalny GTM Validation Playbook.
2. Oprzyj go na eksperymentach, nie deklaracjach.
3. Nie generuj rozbudowanej strategii contentowej bez danych.
4. Połącz go z Experiment Register i Customer Insights.

---

## P49 — Próg automatyzacji procesu

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Warunki:

- co najmniej trzy powtórzenia,
- ryzyko Low/Medium,
- pokrycie ewaluacyjne,
- ścieżka wycofania,

są dobrym minimum do rozważenia automatyzacji, ale same nie wystarczają do automatycznego uruchomienia.

Dodatkowo wymagane są:

- stabilny input i output,
- brak danych lub działań klasy Restricted,
- mierzalna korzyść,
- owner,
- możliwość obserwacji błędu,
- ręczne zatwierdzenie pierwszego wdrożenia automatyzacji.

### Instrukcja dla Claude’a

1. Zachowaj próg jako eligibility gate.
2. Nie uruchamiaj automatyzacji automatycznie po spełnieniu warunków.
3. Dodaj rollback i monitoring jako warunek.
4. Działania High Risk pozostają poza tym uproszczonym trybem.

---

## P50 — Weryfikacja reguł sklepów

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Odpowiedzialność operacyjna przypada AI Launch Managerowi, ale weryfikacja musi być oparta na aktualnych źródłach pierwotnych Apple i Google.

Founder zatwierdza jedynie reguły mające istotny wpływ na ofertę lub ryzyko.

Pierwszy pełny przegląd ma nastąpić przed użyciem Launch Playbook na pierwszym zewnętrznym kliencie.

### Instrukcja dla Claude’a

1. Utwórz ownera: AI Launch Manager.
2. Dodaj `last_verified` i źródło do każdej reguły sklepowej.
3. Oznacz niepotwierdzone fakty jako `UNVERIFIED`.
4. Ustal kwartalny refresh dopiero po uruchomieniu operacji.

---

## P51 — Dokumentacja procesu czy realne wywiady

**Status:** ZATWIERDZONE: PRZEJŚĆ DO WYWIADÓW

### Odpowiedź foundera

Dalsze inwestowanie w dokumentację customer research bez danych ma zostać zatrzymane. Priorytetem są realne wywiady i walkthroughy.

Cel Fazy 1:

- 20 wywiadów problemowych i płatniczych,
- 5 walkthroughów istniejącego procesu budowania lub uruchamiania aplikacji,
- co najmniej 5 rozmów zakończonych testem ceny,
- rekrutacja pierwszych kandydatów na design partnerów.

### Instrukcja dla Claude’a

1. Zamroź rozwój dokumentacji customer-insights poza niezbędnymi szablonami.
2. Przygotuj listę respondentów, scenariusz i system notatek.
3. Każdy wywiad musi kończyć się dowodem lub zmianą hipotezy.
4. Raportuj wzorce, nie pojedyncze opinie.

---

## P52 — Czas foundera na wywiady

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Founder osobiście przeprowadza najważniejsze wywiady w Fazie 1, ponieważ na tym etapie nie powinien delegować uczenia się o rynku.

Nie musi jednak osobiście realizować całej administracji.

Claude i agenci mogą przygotować:

- research,
- listę respondentów,
- scenariusz,
- notatki,
- transkrypcję,
- syntezę,
- follow-up.

Founder prowadzi rozmowę i podejmuje decyzje.

### Ograniczenie czasu

Cel to maksymalnie 45 minut na wywiad oraz maksymalnie 3–4 rozmowy tygodniowo.

### Instrukcja dla Claude’a

1. Automatyzuj przygotowanie i podsumowanie.
2. Nie zastępuj foundera botem w pierwszych rozmowach.
3. Grupuj rozmowy tematycznie.
4. Mierz czas i wartość uzyskanych dowodów.

---

## P53 — Research kanałów TikTok/YouTube i build-in-public

**Status:** ZATWIERDZONE JAKO KRÓTKI BRIEF

### Odpowiedź foundera

Należy przygotować krótki brief dotyczący twórców i odbiorców publikujących treści typu „zbudowałem aplikację z AI”.

Brief ma odpowiedzieć:

- czy to realny segment klientów,
- jakie problemy mają po zbudowaniu prototypu,
- jakie kanały są skuteczne,
- jak wygląda ich gotowość do zapłaty,
- czy są potencjalnymi design partnerami.

Nie należy od razu budować strategii TikTok/YouTube bez potwierdzenia segmentu.

### Instrukcja dla Claude’a

1. Ogranicz brief do decyzji go/no-go.
2. Zbierz przykłady z kilku rynków.
3. Oddziel twórców contentu od realnych founderów produktów.
4. Po briefie zaproponuj maksymalnie 2 eksperymenty kanałowe.

---

## P54 — Publiczny quarterly pain-code ranking

**Status:** NIE ZATWIERDZAĆ JAKO STAŁEGO ZOBOWIĄZANIA

### Odpowiedź foundera

Nie zobowiązuję się teraz do cyklicznej, kwartalnej publikacji pain-code ranking.

Możemy opublikować jednorazowy lub okazjonalny raport, jeżeli dane są wartościowe, anonimowe i wspierają budowę rynku.

Regularna publikacja ma zostać podjęta dopiero wtedy, gdy:

- istnieje wystarczający wolumen danych,
- raport ma wartość marketingową,
- nie narusza poufności,
- koszt przygotowania jest uzasadniony.

### Instrukcja dla Claude’a

1. Usuń cykliczne zobowiązanie.
2. Zachowaj opcję publikacji insight report.
3. Nie wpisuj częstotliwości do kalendarza.
4. Dodaj wymagania anonimowości i jakości danych.

---

## P55 — Polityka zgody na cytaty marketingowe

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Akceptuję trzy poziomy zgody:

- `none` — nie używamy cytatu,
- `granted-anonymous` — cytat bez danych identyfikujących,
- `granted-attributed` — cytat z uzgodnionym imieniem, rolą i firmą.

Każda zgoda musi określać:

- konkretną treść,
- kanały użycia,
- możliwość wycofania,
- okres obowiązywania,
- zakres anonimowości.

### Instrukcja dla Claude’a

1. Zmień nazwę `granted` na `granted-attributed`.
2. Przygotuj prosty consent record.
3. Nie używaj domniemanej zgody.
4. Dla case study stosuj osobną zgodę kontraktową.

---

## P56 — Jedna persona bez podziału geograficznego

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Na początek używamy jednej głównej persony produktowej, aby nie rozpraszać walidacji.

Persona MVP:

> nietechniczny lub częściowo techniczny founder, który zbudował albo próbuje zbudować aplikację mobilną z pomocą AI i potrzebuje doprowadzić ją do poziomu bezpiecznego, płatnego i gotowego do publikacji.

Geografia nie tworzy osobnych person na tym etapie. Różnice regionalne mają być obsłużone jako warianty compliance, kanałów i pricingu.

### Instrukcja dla Claude’a

1. Utrzymaj jedną personę bazową.
2. Dodaj pola wariantowe dla USA, UE i innych rynków.
3. Nie twórz wielu pełnych person bez dowodu.
4. Zweryfikuj personę po 20 wywiadach.

---

## P57 — Wagi formuły priorytetyzacji produktu

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Akceptuję model:

- impact: 1–4,
- evidence: 1–3,
- effort: 1/2/4,

jako prosty mechanizm startowy.

Nie może on jednak zastąpić decyzji strategicznej. Funkcje bezpieczeństwa, legal blockers i wymagania konieczne do sprzedaży mogą mieć pierwszeństwo niezależnie od wyniku.

### Instrukcja dla Claude’a

1. Zachowaj wzór jako narzędzie pomocnicze.
2. Dodaj klasę `mandatory/blocker`.
3. Nie generuj pozornej precyzji przez ułamkowe wyniki.
4. Kalibruj model na podstawie realnych decyzji.

---

## P58 — Uprawnienia AI Product Ownera do Feature Catalog

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

AI Product Owner może samodzielnie:

- dodawać nowe kandydatury funkcji,
- łączyć duplikaty,
- aktualizować dowody,
- zmieniać status pomysłu na `rejected`, jeżeli nie ma dowodów i decyzja jest odwracalna.

Nie może samodzielnie:

- usuwać historii,
- zatwierdzać funkcji do implementacji o wysokim koszcie,
- zmieniać zakresu MVP,
- usuwać funkcji wymaganych przez umowę,
- zmieniać strategicznych priorytetów.

### Instrukcja dla Claude’a

1. Rozdziel `catalog maintenance` od `roadmap authority`.
2. Zachowaj audit trail.
3. Founder zatwierdza MVP scope i kosztowne commitment.
4. Nie usuwaj wpisów — oznaczaj jako rejected/superseded.

---

## P59 — Wcześniejszy test hipotezy self-service

**Status:** ZATWIERDZONE JAKO PRIORYTET

### Odpowiedź foundera

Nie czekamy do Fazy 10 z testem self-service.

Wcześniejszy test ma sprawdzić, czy nietechniczny founder potrafi samodzielnie:

- zrozumieć wynik audytu,
- wykonać wymagane połączenia kont,
- przejść przez zadania,
- zaakceptować ryzyka,
- doprowadzić projekt do kolejnego kroku bez stałego wsparcia.

### Proponowany test

W Fazie 2 lub 3 należy przeprowadzić 5 moderowanych prób na klikalnym prototypie lub concierge MVP i zmierzyć:

- liczbę pytań,
- czas ukończenia,
- miejsca porzucenia,
- potrzebę pomocy człowieka,
- zrozumienie odpowiedzialności.

### Instrukcja dla Claude’a

1. Dodaj wcześniejszy experiment do roadmapy.
2. Nie oceniaj self-service tylko na podstawie deklaracji.
3. Zdefiniuj kryterium sukcesu.
4. Wynik ma wpływać na wybór self-service vs managed service.

---

## P60 — Specyfikowanie odległych faz jako scope creep

**Status:** ZATWIERDZONE: WSTRZYMAĆ SZCZEGÓŁOWĄ SPECYFIKACJĘ

### Odpowiedź foundera

Nie rozwijamy dalej szczegółowej dokumentacji funkcji z Faz 5–11, jeżeli nie wpływają one na decyzje podejmowane teraz.

Można zachować:

- krótki opis kierunku,
- zależności,
- krytyczne ryzyka,
- decyzje trudne do odwrócenia.

Nie należy tworzyć:

- pełnych workflow,
- szczegółowych SLA,
- kompletnych ekranów,
- rozbudowanych procesów operacyjnych,
- sztucznych progów liczbowych.

### Instrukcja dla Claude’a

1. Oznacz odległe dokumenty jako `future concept`.
2. Wstrzymaj ich rozbudowę.
3. Przenieś szczegółowe zadania do backlogu właściwej fazy.
4. Skieruj pracę agentów na walidację rynku, GTM, pierwsze testy produktu i krytyczne ryzyka.
5. Przy każdym nowym dokumencie wymagaj wskazania decyzji, którą ma wesprzeć teraz.

---

# Instrukcja końcowa dla Claude’a

Po zastosowaniu P25–P60:

1. Przygotuj plan konsolidacji fundamentów firmy i organizacji.
2. Wskaż dokumenty, które:
   - mogą zostać `accepted`,
   - pozostają `draft`,
   - powinny zostać oznaczone jako `reference`,
   - powinny zostać zarchiwizowane po konsolidacji.
3. Utwórz raport wykrytych przypadków, w których draft jest traktowany jako wiążący.
4. Przygotuj uproszczony:
   - Decision Lite,
   - Experiment Register,
   - GTM Validation Playbook,
   - interview workflow.
5. Wstrzymaj dalszą szczegółową dokumentację odległych faz.
6. Nie publikuj zobowiązań marketingowych, terminów cyklicznych ani obietnic autonomii bez osobnej decyzji.
7. Na końcu przedstaw:
   - listę zmienionych plików,
   - listę nowych ADR/decyzji,
   - listę punktów odłożonych,
   - listę działań wymagających foundera.
