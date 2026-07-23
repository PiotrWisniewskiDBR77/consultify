# ODPOWIEDZI FOUNDERA — CZĘŚĆ 4
## P101–P140: Architektura techniczna, QA, UX, dane, API, operacje platformy i AI governance

> Dokument roboczy dla Claude’a.  
> Źródło pytań: `PYTANIA_DO_ZALOZYCIELA.md`.
>
> **Zasada wykonawcza dla Claude’a**
>
> Każdą odpowiedź należy stosować zgodnie z oznaczonym statusem:
>
> - `ZATWIERDZONE` — decyzja wiążąca.
> - `ZATWIERDZONE WARUNKOWO` — obowiązuje w podanym zakresie.
> - `HIPOTEZA MVP` — obowiązuje tymczasowo do wskazanego checkpointu.
> - `ODŁOŻONE` — nie realizować teraz; zachować trigger powrotu.
> - `WYMAGA WERYFIKACJI` — nie przedstawiać jako fakt.
> - `WYMAGA DECYZJI FOUNDERA` — Claude nie może samodzielnie rozstrzygnąć.
> - `DO UPROSZCZENIA` — zachować cel, ograniczyć proces.
>
> Claude nie może przedstawiać decyzji technicznych jako zatwierdzonych tylko dlatego, że są opisane w dokumentacji docelowej. Każda decyzja wpływająca na koszt, bezpieczeństwo, klienta lub architekturę produkcyjną musi mieć właściwy status i ownera.

---

## P101 — Otwarte wybory technologiczne do Fazy 4/6/7

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Otwarte wybory technologiczne mogą pozostać nierozstrzygnięte do fazy, w której stają się potrzebne, pod warunkiem że:

- nie blokują walidacji rynku,
- nie wpływają na bezpieczeństwo obecnego rozwiązania,
- nie zmieniają publicznej obietnicy produktu,
- mają wskazany deadline decyzyjny,
- istnieje kryterium wyboru.

Dotyczy to między innymi:

- dostawcy sandboxa,
- implementacji pamięci firmowej,
- narzędzia do ewaluacji promptów,
- dostawcy logów,
- części stacku analitycznego.

### Instrukcja dla Claude’a

1. Oznacz każdą otwartą decyzję jako `DEFERRED DECISION`.
2. Dodaj:
   - ownera,
   - consuming phase,
   - decision deadline,
   - kryteria wyboru,
   - konsekwencje opóźnienia.
3. Nie wpisuj preferowanego narzędzia jako faktu.
4. Nie twórz implementacji blokującej zmianę dostawcy bez uzasadnienia.

---

## P102 — Pierwsze rozluźnienie autonomii do L4

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Autonomia L4 nie może zostać aktywowana na podstawie kalendarza ani liczby miesięcy działania.

Może nastąpić wyłącznie po spełnieniu mierzalnych warunków zaufania:

- stabilna skuteczność,
- brak incydentów wysokiego ryzyka,
- pokrycie ewaluacyjne,
- pełna obserwowalność,
- działający rollback,
- jasne prawa decyzyjne,
- ręczne zatwierdzenie przez foundera lub delegowanego approvera.

### Instrukcja dla Claude’a

1. Usuń wszelkie calendar-based promotion.
2. Zdefiniuj trust metrics per typ działania.
3. Utrzymuj autonomię osobno dla:
   - roli,
   - typu zadania,
   - klienta,
   - środowiska.
4. Dodaj możliwość natychmiastowej degradacji poziomu autonomii.
5. Nie stosuj L4 do działań nieodwracalnych bez osobnej decyzji.

---

## P103 — Zasada „nigdy nie usuwaj, zawsze zastępuj”

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Zasada zachowania historii jest właściwa dla decyzji, polityk i ważnych dokumentów, ale nie może oznaczać bezterminowego przechowywania każdego pliku roboczego.

Zachowujemy i archiwizujemy:

- zaakceptowane ADR-y,
- dokumenty strategiczne,
- wersje polityk,
- publiczne obietnice,
- decyzje zmieniające kierunek,
- istotne raporty i dowody.

Możemy usuwać:

- pliki tymczasowe,
- duplikaty techniczne,
- artefakty generowane,
- błędne lub nieużywane szkice bez wartości historycznej,
- sekrety i dane, które zgodnie z polityką muszą zostać usunięte.

### Instrukcja dla Claude’a

1. Zmień absolutną zasadę na `preserve decision history`.
2. Wprowadź klasy retencji dokumentów.
3. Archiwizuj tylko treści mające wartość audytową lub strategiczną.
4. Nie zachowuj danych osobowych ani sekretów tylko dlatego, że istnieje zasada archiwizacji.
5. Dodaj cleanup policy dla plików roboczych.

---

## P104 — Głęboka dokumentacja inżynierska przed walidacją rynku

**Status:** ZATWIERDZONE: WSTRZYMAĆ DALSZE ROZBUDOWYWANIE

### Odpowiedź foundera

Nie rozwijamy dalej szczegółowej dokumentacji inżynierskiej Faz 4–7, jeżeli nie wspiera ona decyzji podejmowanej teraz.

Zachowujemy jedynie:

- zasady architektoniczne,
- granice bezpieczeństwa,
- wymagania nieodwracalne,
- interfejsy krytyczne,
- listę otwartych decyzji.

### Instrukcja dla Claude’a

1. Oznacz odległe dokumenty jako `TARGET ARCHITECTURE`.
2. Wstrzymaj dodawanie szczegółowych workflow i konfiguracji.
3. Skieruj pracę na walidację rynku i minimalny prototyp.
4. Każdy nowy dokument techniczny musi wskazać decyzję, którą wspiera teraz.
5. Usuń spekulatywne liczby i narzędzia niewymagane w najbliższej fazie.

---

## P105 — TypeScript jako roboczy stos technologiczny

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

TypeScript jest preferowanym stosem aplikacyjnym dla MVP, ponieważ:

- wspiera web i backend,
- pasuje do React Native/Expo,
- zmniejsza liczbę języków,
- ułatwia pracę agentów kodujących,
- ma dojrzały ekosystem.

Nie oznacza to zakazu Pythona. Python może być używany tam, gdzie ma wyraźną przewagę, np. w analizie danych, eksperymentach ML lub narzędziach badawczych.

### Instrukcja dla Claude’a

1. Zapisz TypeScript jako `default MVP stack`.
2. Utwórz ADR na początku Fazy 4.
3. Każdy wyjątek językowy musi mieć uzasadnienie.
4. Nie twórz polyglot architecture bez potrzeby.
5. Nie koduj teraz samego ADR-u jako niezmiennej decyzji docelowej.

---

## P106 — Brak ścieżki z sandboxa do produkcji bez zatwierdzenia

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Żaden sandbox wykonawczy nie może mieć bezpośredniej, stałej ścieżki do produkcji klienta.

Wymagany przepływ:

1. wykonanie w izolacji,
2. walidacja wyniku,
3. wygenerowanie diffa lub artefaktu,
4. review,
5. jawna zgoda,
6. dopiero potem kontrolowane wdrożenie.

### Instrukcja dla Claude’a

1. Wprowadź architektoniczny approval boundary.
2. Oddziel credentials sandboxa od credentials produkcyjnych.
3. Nie zezwalaj na bezpośrednie deploye z sesji agentowej.
4. Loguj każde przejście przez bramkę.
5. Dodaj testy bezpieczeństwa dla tej granicy.

---

## P107 — Standard P / Standard C i minimalny diff

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Podział na Standard P i Standard C zostaje przyjęty jako polityka produktowa:

- `Standard P` — kod i produkty rozwijane we własnym repozytorium platformy,
- `Standard C` — zmiany w repozytoriach klientów.

Dla Standard C obowiązuje zasada minimalnego diffa:

- zmieniamy tylko to, co konieczne,
- zachowujemy styl klienta,
- nie refaktoryzujemy „przy okazji”,
- nie zmieniamy zależności bez uzasadnienia,
- zapewniamy możliwość review i rollback.

### Instrukcja dla Claude’a

1. Ujednolić definicje Standard P/C.
2. Dodaj minimal diff do promptów agentów.
3. Każda większa przebudowa repo klienta wymaga osobnej zgody.
4. Mierz rozmiar i zakres zmian.
5. Nie ukrywaj refaktoryzacji w zadaniu funkcjonalnym.

---

## P108 — Przyspieszenie TD-002 dotyczącego Expo

**Status:** ZATWIERDZONE — PRIORYTET PRZED CONNECTOREM

### Odpowiedź foundera

TD-002 należy zamknąć przed implementacją produkcyjnego connectora Expo.

Nie musi blokować:

- researchu,
- makiet,
- lokalnego prototypu,
- testów bez kont klienta.

Musi blokować:

- przechowywanie tokenu klienta,
- wykonywanie buildów komercyjnych,
- użycie Expo w modelu agentowym na rzecz klienta.

### Instrukcja dla Claude’a

1. Podnieś priorytet TD-002.
2. Połącz z P4 i P130.
3. Przygotuj brief prawno-techniczny.
4. Nie implementuj obejścia regulaminu.
5. Po weryfikacji utwórz ADR.

---

## P109 — Weryfikacja incydentu Replit/SaaStr

**Status:** WYMAGA WERYFIKACJI

### Odpowiedź foundera

Incydent może pozostać jako kontekst, ale nie może być filarem polityki bezpieczeństwa bez wiarygodnych źródeł.

Model bezpieczeństwa powinien być uzasadniony również niezależnie:

- zasadą least privilege,
- izolacją,
- odwracalnością,
- kontrolą człowieka,
- historią znanych klas błędów agentów.

### Instrukcja dla Claude’a

1. Zweryfikuj źródło.
2. Ogranicz znaczenie incydentu do ilustracji.
3. Nie opieraj decyzji tylko na jednym case study.
4. Usuń niepotwierdzone liczby.
5. Powiąż politykę bezpieczeństwa z ogólnym threat modelem.

---

## P110 — Founder jako jedyny incident commander

**Status:** ZATWIERDZONE TYMCZASOWO

### Odpowiedź foundera

Founder może być jedynym incident commanderem na etapie przedprodukcyjnym i przy pierwszych wdrożeniach.

Nie jest to akceptowalny model docelowy.

Trigger ustanowienia backupu:

- pierwszy klient produkcyjny z krytycznymi danymi,
- więcej niż 3 aktywne ventures,
- obsługa poza godzinami dostępności foundera,
- SLA wymagające reakcji,
- powtarzające się incydenty.

### Instrukcja dla Claude’a

1. Oznacz model jako `temporary bus factor 1`.
2. Dodaj trigger backup incident commander.
3. Przygotuj prostą procedurę eskalacji.
4. Nie obiecuj 24/7 supportu bez realnego pokrycia.
5. Rozważ zewnętrzny on-call dopiero po wystąpieniu triggera.

---

## P111 — Błędy odziedziczone z prototypu klienta

**Status:** DO KOREKTY

### Odpowiedź foundera

Nie używamy komunikatu „to płatne zadanie klienta, nie nasz dług” jako automatycznej odpowiedzi.

Zasada odpowiedzialności:

- błędy istniejące przed rozpoczęciem współpracy są dokumentowane jako baseline,
- naprawa nie jest automatycznie zawarta w zakresie,
- platforma musi wskazać, czy błąd blokuje launch,
- koszt i zakres naprawy są uzgadniane,
- jeżeli platforma pogorszyła problem, odpowiada za własną zmianę.

### Instrukcja dla Claude’a

1. Zmień język z konfrontacyjnego na kontraktowy i dowodowy.
2. Wprowadź baseline audit.
3. Rozdziel inherited issue od regression caused by platform.
4. Dodaj zasady change acceptance.
5. Nie obciążaj klienta kosztami bez udokumentowanego zakresu.

---

## P112 — Procedura naruszenia RODO 72h

**Status:** ZATWIERDZONE: PRZYGOTOWAĆ WCZEŚNIEJ

### Odpowiedź foundera

Procedura naruszenia danych nie może czekać do Fazy 9.

Musi istnieć przed pierwszym przetwarzaniem danych osobowych klienta w środowisku produkcyjnym.

Powinna obejmować:

- wykrycie,
- klasyfikację,
- zabezpieczenie dowodów,
- eskalację,
- ocenę obowiązku zgłoszenia,
- kontakt z prawnikiem/DPO,
- komunikację z klientem,
- dokumentowanie czasu.

### Instrukcja dla Claude’a

1. Przygotuj minimalny GDPR breach playbook.
2. Oznacz go jako draft wymagający legal review.
3. Ustaw blocker przed pierwszym klientem z UE.
4. Nie deklaruj samodzielnie, czy incydent wymaga zgłoszenia.
5. Dodaj zegar i log działań.

---

## P113 — Ujawnianie granic testowania klientowi

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Granice testowania muszą być ujawniane uczciwie, ale nie w sposób, który sugeruje brak jakości.

Komunikujemy:

- co zostało przetestowane,
- czego nie testowano,
- jakie ryzyko pozostaje,
- jakie testy są opcjonalne,
- które testy wymagają osobnego budżetu lub dostawcy.

### Instrukcja dla Claude’a

1. Zastąp negatywną listę `brak testów` macierzą coverage.
2. Dodaj test scope do oferty i release report.
3. Nie sugeruj pentestu, jeśli go nie było.
4. Wprowadź opcjonalne pakiety testowe.
5. Przed publikacją sprawdź język prawny.

---

## P114 — Wymyślone progi liczbowe w QA

**Status:** HIPOTEZA MVP DO KALIBRACJI

### Odpowiedź foundera

Nie akceptujemy wszystkich progów liczbowych jako trwałych.

Progi mogą służyć jako wartości startowe, jeśli są:

- oznaczone jako hipotezy,
- konfigurowalne,
- powiązane z ryzykiem,
- przeglądane po danych.

Czas reakcji typu „triage <1h” nie może być publicznym SLA, dopóki nie istnieje realny on-call.

### Instrukcja dla Claude’a

1. Oznacz liczby `[H]`.
2. Oddziel internal target od customer commitment.
3. Usuń progi bez ownera i celu.
4. Kalibruj po pierwszych incydentach i release’ach.
5. Nie koduj progów na stałe.

---

## P115 — Warstwa wizualnej marki przed Fazą 11

**Status:** DO KOREKTY

### Odpowiedź foundera

Nie wysyłamy produktu do design partnerów z całkowicie placeholderowym wyglądem.

Nie potrzebujemy pełnego brand systemu, ale potrzebujemy minimalnej wiarygodności:

- spójna typografia,
- jeden kolor akcentu,
- neutralna paleta,
- podstawowe logo lub wordmark,
- jednolite komponenty,
- poprawny dark/light mode, jeżeli występuje.

### Instrukcja dla Claude’a

1. Zdefiniuj `Minimum Trust UI`.
2. Nie buduj pełnego brand booka.
3. Usuń losowe placeholdery przed testami z klientami.
4. Powiąż z decyzją P61.
5. Testuj wiarygodność, nie estetykę samą w sobie.

---

## P116 — Osobiste moderowanie testów użyteczności

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Founder powinien osobiście obserwować pierwsze 5 sesji, ponieważ na tym etapie musi zobaczyć realne problemy użytkowników.

Nie musi moderować wszystkich kolejnych rund.

Podział:

- founder obserwuje lub moderuje pierwszą rundę,
- agent przygotowuje scenariusz, rejestruje i syntetyzuje,
- kolejne rundy mogą być delegowane po ustaleniu standardu.

### Instrukcja dla Claude’a

1. Zaplanuj pierwszą rundę 5 sesji.
2. Maksymalizuj naukę, nie liczbę uczestników.
3. Nie zadawaj prowadzących pytań.
4. Rejestruj błędy i cytaty za zgodą.
5. Po rundzie przygotuj decyzje produktowe.

---

## P117 — Budżet na rekrutację użytkowników

**Status:** WYMAGA DECYZJI FOUNDERA

### Odpowiedź foundera

Nie zatwierdzam automatycznie stawki 50–75 USD dla każdej sesji.

Claude ma przygotować budżet wariantowy:

- 25–50 USD dla ogólnych founderów,
- 50–100 USD dla specjalistycznych respondentów,
- alternatywnie early access lub bezpłatny audyt,
- koszt rekrutacji osobno od incentive.

### Instrukcja dla Claude’a

1. Przygotuj koszt jednej rundy 5 osób.
2. Rozdziel participant incentive i recruitment fee.
3. Zostaw finalny budżet do zatwierdzenia.
4. Nie płacić w sposób zaburzający test willingness-to-pay.
5. Powiąż wydatek z budżetem research.

---

## P118 — Desktop-first przy użytkownikach mobilnych

**Status:** DO KOREKTY

### Odpowiedź foundera

Produkt nie może być projektowany wyłącznie desktop-first, jeżeli główny użytkownik pracuje z telefonu.

Przyjmujemy:

- mobile-first dla kluczowych decyzji, briefów, powiadomień, zatwierdzeń i statusu,
- desktop-first dla złożonych konfiguracji, pracy na repozytorium, analizy i administracji.

### Instrukcja dla Claude’a

1. Zdefiniuj mapę funkcji mobile vs desktop.
2. Nie próbuj przenosić całej konsoli technicznej na telefon.
3. Kluczowy approval flow musi działać mobilnie.
4. Testuj oba konteksty.
5. Zaktualizuj UX principles.

---

## P119 — EAA dla własnego serwisu

**Status:** WYMAGA WERYFIKACJI PRAWNEJ

### Odpowiedź foundera

Ryzyko EAA nie powinno być ignorowane do Fazy 11, jeśli produkt jest dostępny użytkownikom z UE.

Należy wcześniej ustalić:

- czy produkt podlega obowiązkom,
- które kanały i funkcje są objęte,
- jaki minimalny standard dostępności obowiązuje,
- jak wpływa to na MVP.

### Instrukcja dla Claude’a

1. Przygotuj krótki legal/accessibility brief.
2. Nie deklaruj pełnej zgodności bez audytu.
3. Wprowadź bazowe praktyki WCAG niezależnie od obowiązku prawnego.
4. Ustaw checkpoint przed publicznym launch-em w UE.

---

## P120 — Ryzyko zmiany nazw trzech ról AI

**Status:** ZATWIERDZONE: ZAMROZIĆ NA MVP

### Odpowiedź foundera

Nazwy:

- AI Product Owner,
- AI CTO,
- AI Launch Manager

zostają zamrożone na czas MVP.

Mogą zostać zmienione dopiero po danych z testów użytkowników i decyzji brandingowej.

### Instrukcja dla Claude’a

1. Zaktualizuj ADR-004.
2. Usuń oznaczenie `provisional` dla MVP.
3. Ujednolić nazwy w UX, promptach i dokumentacji.
4. Nie buduj zależności na niekontrolowanych wariantach nazewnictwa.
5. Dodaj checkpoint po pierwszych testach.

---

## P121 — Sekcja test z pytaniem „d”

**Status:** ZATWIERDZONE: USUNĄĆ JAKO BŁĄD

### Odpowiedź foundera

P121 nie jest realnym pytaniem decyzyjnym. To artefakt lub błąd dokumentacji.

### Instrukcja dla Claude’a

1. Usuń sekcję `test`.
2. Nie twórz odpowiedzi merytorycznej.
3. Oznacz zmianę w changelogu jako cleanup.
4. Sprawdź, czy podobne artefakty występują w repozytorium.

---

## P122 — Wybór PostHog do Fazy 4

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

Odroczenie finalnej decyzji do Fazy 4 jest akceptowalne.

PostHog może być preferowanym kandydatem, ale katalog zdarzeń powinien być niezależny od konkretnego narzędzia.

### Instrukcja dla Claude’a

1. Projektuj event taxonomy vendor-neutral.
2. Oznacz PostHog jako candidate.
3. Nie używaj vendor-specific naming w domenie.
4. Wybór narzędzia zamknij ADR-em przed implementacją telemetryki produkcyjnej.
5. Uwzględnij prywatność i rezydencję danych.

---

## P123 — Progi retencji danych

**Status:** HIPOTEZA MVP + WYMAGA LEGAL REVIEW

### Odpowiedź foundera

Wartości 90 dni, 24 miesiące, 35 dni i 12 miesięcy nie są zatwierdzone jako trwałe.

Retencja musi wynikać z:

- celu danych,
- wymagań klienta,
- prawa,
- kosztu,
- potrzeby audytu,
- minimalizacji danych.

### Instrukcja dla Claude’a

1. Dla każdej klasy danych określ cel i podstawę retencji.
2. Oznacz wszystkie obecne wartości jako proposal.
3. Przygotuj retention matrix.
4. Wymagaj legal review dla danych osobowych.
5. Dodaj mechanizm usunięcia i wyjątki backupowe.

---

## P124 — Rezydencja danych UE

**Status:** ZATWIERDZONE: ROZWIĄZAĆ PRZED KLIENTEM UE

### Odpowiedź foundera

Jednoregionowy control plane poza UE jest akceptowalny dla wczesnego prototypu i klientów spoza UE, ale może być blockerem dla części klientów europejskich.

Przed pierwszym klientem UE należy ustalić:

- miejsce przetwarzania,
- mechanizm transferu,
- DPA,
- wymagania enterprise,
- możliwość regionu UE,
- koszt wieloregionowości.

### Instrukcja dla Claude’a

1. Utwórz EU data residency decision.
2. Nie obiecuj EU residency przed implementacją.
3. Dodaj tę kwestię do qualification klientów.
4. Przygotuj architekturę, która nie zamyka drogi do regionu UE.
5. Połącz z P81 i P125.

---

## P125 — DPA i lista subprocesorów

**Status:** ZATWIERDZONE: OWNER PRAWNY, NIE AI CTO

### Odpowiedź foundera

AI CTO może dostarczyć dane techniczne, ale nie jest właścicielem prawnym DPA ani listy subprocesorów.

Owner:

- founder/business owner,
- zewnętrzny prawnik jako reviewer,
- AI CTO jako contributor techniczny.

### Instrukcja dla Claude’a

1. Zmień ownership.
2. Przygotuj vendor data flow.
3. Utwórz publiczną listę subprocesorów dopiero po weryfikacji.
4. Nie publikuj szablonu DPA bez legal review.
5. Ustaw blocker przed pierwszym klientem UE.

---

## P126 — Próg k=10 dla anonimowych benchmarków

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

k=10 może być minimalnym progiem startowym, ale nie gwarantuje anonimowości.

Dodatkowo należy uwzględnić:

- wielkość segmentu,
- możliwość połączenia z innymi danymi,
- rzadkie cechy,
- wrażliwość metryki,
- czas i geografię.

### Instrukcja dla Claude’a

1. Zachowaj k=10 jako minimum, nie gwarancję.
2. Wprowadź privacy review dla benchmarku.
3. Nie publikuj benchmarku dla małej lub łatwo identyfikowalnej grupy.
4. Rozważ wyższy próg dla danych wrażliwych.
5. Dodaj suppression rules.

---

## P127 — Hipoteza kosztu 5 USD za zadanie

**Status:** HIPOTEZA MVP

### Odpowiedź foundera

5 USD za zadanie może pozostać jako roboczy scenariusz bazowy, ale nie jako założenie cennikowe bez telemetrii.

Należy mierzyć:

- koszt modeli,
- narzędzi,
- sandboxa,
- storage,
- retries,
- błędów,
- pracy człowieka.

### Instrukcja dla Claude’a

1. Oznacz 5 USD jako `BASE COST HYPOTHESIS`.
2. Dodaj scenariusz low/base/high.
3. Nie finalizuj pricingu przed realnymi danymi.
4. Mierz koszt sukcesu, nie tylko pojedynczego runu.
5. Zaktualizuj po pierwszych 100–300 zadaniach.

---

## P128 — Szczegółowość specyfikacji analitycznej

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Katalog 50 zdarzeń, 30 metryk i 5 klas danych jest zbyt szczegółowy na obecny etap.

Na MVP potrzebujemy minimalnego zestawu:

- aktywacja,
- completion kluczowych flow,
- błędy,
- koszt,
- czas zadania,
- approval,
- wynik launch readiness,
- konwersja do płatności,
- retencja podstawowa.

### Instrukcja dla Claude’a

1. Zredukuj event catalog do minimum.
2. Zachowaj pełny katalog jako future reference.
3. Każde zdarzenie musi mieć decyzję biznesową, którą wspiera.
4. Nie zbieraj danych „na wszelki wypadek”.
5. Dodaj privacy review dla eventów.

---

## P129 — Marketingowa obietnica dotycząca kluczy

**Status:** ZATWIERDZONE — SKONSOLIDOWAĆ Z P1 I P96

### Odpowiedź foundera

Obowiązuje jeden spójny komunikat limited custody. Nie tworzymy oddzielnych wersji obietnicy dla API i marketingu.

### Instrukcja dla Claude’a

1. Połącz P129 z P1 i P96.
2. Użyj jednego źródła prawdy dla security claims.
3. Opisz wyjątki per connector.
4. Nie używaj liczby dostawców jako stałej obietnicy.
5. Dodaj ekran zgody integracji.

---

## P130 — Weryfikacja Expo przed budową connectora

**Status:** ZATWIERDZONE — SKONSOLIDOWAĆ Z P4 I P108

### Odpowiedź foundera

Connector Expo nie może wejść do produkcji przed sprawdzeniem regulaminu i modelu tokenów.

### Instrukcja dla Claude’a

1. Połącz trzy duplikujące się decyzje.
2. Utwórz jedno zadanie legal/technical.
3. Nie rozpoczynaj produkcyjnej integracji bez wyniku.
4. W razie negatywnego wyniku przygotuj alternatywy.
5. Usuń sprzeczne deklaracje automatyzacji.

---

## P131 — Publiczne API, SDK i webhooki Fazy 13

**Status:** ODŁOŻONE

### Odpowiedź foundera

Nie inwestujemy teraz w szczegółową specyfikację publicznego API, SDK i webhooków dla partnerów.

Zachowujemy tylko zasady:

- bezpieczeństwo,
- wersjonowanie,
- idempotency,
- audyt,
- podpisy webhooków,
- ograniczenia.

### Trigger

Powrót do tematu następuje, gdy:

- istnieją co najmniej 3 konkretne potrzeby integracyjne,
- partnerzy proszą o API,
- manualne integracje blokują sprzedaż,
- platforma ma stabilny model domenowy.

### Instrukcja dla Claude’a

1. Oznacz dokumenty jako `future concept`.
2. Nie projektuj endpointów i SDK teraz.
3. Zachowaj tylko strategiczne standardy.
4. Dodaj trigger ponownego otwarcia.
5. Nie obiecuj publicznego API klientom.

---

## P132 — Standardy API jako obietnica marki

**Status:** ZATWIERDZONE KIERUNKOWO

### Odpowiedź foundera

Akceptuję kierunek: platforma powinna stosować wobec własnego API standardy, których wymaga od dostawców.

Dotyczy to:

- jawnych limitów,
- wersjonowania,
- okresów wygaszania,
- podpisanych webhooków,
- status page,
- dokumentacji błędów,
- bezpiecznych defaultów.

Nie publikujemy jednak tej obietnicy przed realnym wdrożeniem.

### Instrukcja dla Claude’a

1. Zachowaj zasadę jako target principle.
2. Nie przedstawiaj jej jako aktualnej cechy.
3. Dodaj checklistę przed publicznym API.
4. Publiczne claims muszą być zgodne z produktem.
5. Nie wdrażaj teraz całej infrastruktury.

---

## P133 — Decyzje techniczne pozostawione agentom

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Agenci mogą samodzielnie podejmować odwracalne decyzje techniczne niskiego ryzyka, jeśli:

- mieszczą się w zaakceptowanych zasadach,
- nie zmieniają publicznego API,
- nie zwiększają istotnie kosztu,
- nie wpływają na bezpieczeństwo,
- nie tworzą lock-in,
- są udokumentowane w uproszczonym logu.

Founder zatwierdza:

- język główny,
- główne dostawcy,
- architekturę bezpieczeństwa,
- kontrakty API,
- decyzje kosztowe i nieodwracalne.

### Instrukcja dla Claude’a

1. Utwórz matrix decision rights.
2. Rozdziel reversible vs irreversible.
3. Nie eskaluj drobnych decyzji.
4. Nie ukrywaj decyzji wysokiego wpływu jako implementacyjnych.
5. Zachowaj audit trail.

---

## P134 — Szczegółowy projekt operacyjny Fazy 9

**Status:** ZATWIERDZONE: WSTRZYMAĆ ROZBUDOWĘ

### Odpowiedź foundera

Nie rozwijamy dalej szczegółowej dokumentacji operacji platformy Fazy 9 przed działającym produktem.

Zachowujemy tylko:

- katalog krytycznych usług,
- podstawowe SLO jako hipotezy,
- wymagania incident response,
- kontrolę kosztów,
- kill-switch,
- najważniejsze runbooki bezpieczeństwa.

### Instrukcja dla Claude’a

1. Oznacz dokumenty jako `target operating model`.
2. Usuń spekulatywne szczegóły.
3. Zachowaj minimalny production readiness core.
4. Wstrzymaj pozostałe runbooki do triggera.
5. Nie planuj operacji dla nieistniejącej skali.

---

## P135 — Miesięczny limit wydatków AI na venture

**Status:** WYMAGA DECYZJI FOUNDERA

### Odpowiedź foundera

Konkretna kwota nie może zostać ustalona bez danych o:

- cenie produktu,
- oczekiwanej marży,
- typie klientów,
- kosztach modeli,
- intensywności użycia,
- modelu pakietów.

### Działanie teraz

Przygotować propozycję limitów w trzech scenariuszach:

- trial/design partner,
- standard paid,
- high-usage/enterprise.

Limit powinien mieć:

- warning threshold,
- hard cap,
- procedurę zwiększenia,
- widoczność dla klienta,
- osobne limity na run i miesiąc.

### Instrukcja dla Claude’a

1. Nie wpisuj przypadkowej kwoty.
2. Przygotuj model limitów powiązany z pricingiem.
3. Domyślny hard cap musi istnieć przed produkcją.
4. Founder zatwierdza wartości finalne.
5. Dodaj alert kosztowy i kill-switch.

---

## P136 — Bus factor 1 w operacjach platformy

**Status:** ZATWIERDZONE TYMCZASOWO

### Odpowiedź foundera

Bus factor 1 jest tolerowany tylko do momentu pojawienia się realnego ryzyka klienta produkcyjnego.

Trigger zmiany:

- pierwszy płacący klient produkcyjny,
- dostęp do wrażliwych danych,
- SLA,
- więcej niż 3 aktywne ventures,
- niedostępność foundera wpływająca na usługę.

### Instrukcja dla Claude’a

1. Oznacz ryzyko jako aktywne.
2. Dodaj plan przejścia do backup ownership.
3. Nie ukrywaj ryzyka w dokumentacji.
4. Powiąż z P87, P88 i P110.
5. Nie obiecuj ciągłości 24/7 bez pokrycia.

---

## P137 — Trzy brakujące runbooki

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Dwa runbooki bezpieczeństwa powinny powstać przed produkcją:

- zamrożenie venture przy podejrzeniu przejęcia danych,
- globalne zamrożenie z powodów bezpieczeństwa.

Runbook „zabicie pojedynczego joba z innego powodu niż awaria” może powstać bliżej implementacji runtime.

### Instrukcja dla Claude’a

1. Priorytet daj security freeze.
2. Przygotuj wersję minimalną.
3. Nie twórz szczegółów bez realnej architektury.
4. Każdy runbook musi mieć ownera, trigger i recovery.
5. Przetestuj przed pierwszym klientem produkcyjnym.

---

## P138 — Cykliczne zobowiązania foundera

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Nie akceptuję osobnych cotygodniowych, comiesięcznych i kwartalnych rytuałów dla każdej kategorii operacyjnej.

Konsolidujemy:

- tygodniowo: tylko alerty i wyjątki,
- miesięcznie: koszty, ryzyka, capacity, incidents,
- kwartalnie: SLO, architektura i strategiczny review,
- drill: maksymalnie 1–2 razy w roku lub po dużej zmianie.

### Instrukcja dla Claude’a

1. Połącz review.
2. Usuń powtarzające się spotkania.
3. Każdy rytuał ma limit czasu.
4. Founder otrzymuje exception-based summary.
5. Mierz całkowite obciążenie.

---

## P139 — Founder jako jedyny punkt eskalacji AI governance

**Status:** ZATWIERDZONE TYMCZASOWO

### Odpowiedź foundera

Founder może być jedynym punktem eskalacji w fazie początkowej, ale review musi być skonsolidowane i oparte na wyjątkach.

Nie akceptuję ręcznego przeglądu 10% wszystkich ocen sędziego jako stałego obowiązku bez dowodu, że taki poziom jest potrzebny.

### Model startowy

- automatyczne raportowanie anomalii,
- losowy spot-check małej próby,
- pełny review po incydencie,
- miesięczny skonsolidowany raport modeli, ryzyk i jakości.

### Instrukcja dla Claude’a

1. Zmniejsz stały spot-check do adaptacyjnej próby.
2. Zwiększaj próbę przy spadku jakości.
3. Połącz rejestr modeli i ryzyk w jeden review.
4. Dodaj trigger delegowania AI governance.
5. Mierz czas foundera.

---

## P140 — Ubezpieczenie tech E&O/cyber

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Nie kupujemy ubezpieczenia automatycznie przed walidacją rynku, ale musimy rozpoznać rynek i koszt przed wejściem do płatnych wdrożeń o istotnym ryzyku.

Trigger zakupu:

- klient enterprise wymaga polisy,
- platforma wykonuje działania na produkcji klienta,
- przetwarzamy wrażliwe dane,
- zawieramy umowy z istotną odpowiedzialnością,
- przychód lub ryzyko uzasadnia koszt.

### Instrukcja dla Claude’a

1. Połącz z P82.
2. Przygotuj brief i orientacyjne oferty.
3. Sprawdź wyłączenia dotyczące AI i cyber.
4. Nie deklaruj klientom ochrony przed zakupem polisy.
5. Powiąż limity odpowiedzialności w umowie z realnym ubezpieczeniem.

---

# Instrukcja końcowa dla Claude’a

Po zastosowaniu P101–P140:

1. Przygotuj listę decyzji, które nadal wymagają bezpośredniego wyboru foundera:
   - budżet testów UX,
   - limity AI per venture,
   - finalne narzędzia telemetryczne,
   - finalne okresy retencji,
   - finalny model regionu UE.
2. Utwórz lub zaktualizuj ADR-y dotyczące:
   - TypeScript jako default MVP stack,
   - approval boundary sandbox → production,
   - Standard P / Standard C,
   - role AI zamrożone na MVP,
   - model limited custody,
   - otwarte decyzje technologiczne.
3. Skonsoliduj duplikaty:
   - P4/P108/P130,
   - P1/P96/P129,
   - P82/P140,
   - P110/P136.
4. Przygotuj minimalne artefakty:
   - GDPR breach playbook,
   - test coverage disclosure,
   - Minimum Trust UI,
   - EU data residency decision brief,
   - retention matrix,
   - AI cost telemetry requirements,
   - security freeze runbooks.
5. Wstrzymaj:
   - szczegółowe public API/SDK,
   - rozbudowane observability,
   - pełne platform operations,
   - spekulatywny analytics catalog,
   - autonomię L4.
6. Nie publikuj:
   - niezweryfikowanych security claims,
   - publicznych SLA bez pokrycia,
   - obietnic EU residency,
   - deklaracji o testach, których nie wykonano.
7. Na końcu przedstaw:
   - listę zmienionych plików,
   - listę nowych ADR-ów,
   - otwarte decyzje founderskie,
   - blokery prawne,
   - zadania przed pierwszym klientem produkcyjnym,
   - elementy odłożone.
