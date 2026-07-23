# ODPOWIEDZI FOUNDERA — CZĘŚĆ 5
## P141–P173: AI governance, obserwowalność, skalowalność, agenci, release management, HR i customer success

> Dokument roboczy dla Claude’a.  
> Źródło pytań: `PYTANIA_DO_ZALOZYCIELA.md`.
>
> **Zasada wykonawcza dla Claude’a**
>
> Każdą odpowiedź należy stosować zgodnie z oznaczonym statusem:
>
> - `ZATWIERDZONE` — decyzja wiążąca.
> - `ZATWIERDZONE WARUNKOWO` — obowiązuje w podanym zakresie.
> - `HIPOTEZA MVP` — obowiązuje tymczasowo do checkpointu.
> - `ODŁOŻONE` — nie realizować teraz; zachować trigger powrotu.
> - `WYMAGA WERYFIKACJI` — nie przedstawiać jako fakt.
> - `WYMAGA DECYZJI FOUNDERA` — Claude nie może samodzielnie rozstrzygnąć.
> - `DO UPROSZCZENIA` — zachować cel, ograniczyć proces.
>
> Claude nie może zamieniać rekomendacji, hipotez ani przyszłych koncepcji w trwałe zobowiązania produktowe, architektoniczne lub handlowe bez właściwego wpisu w decision logu.

---

## P141 — Zobowiązanie „nie trenujemy na Twoich danych”

**Status:** ZATWIERDZONE OGRANICZENIE MARKETINGOWE

### Odpowiedź foundera

Nie publikujemy absolutnej deklaracji „nie trenujemy na Twoich danych” do czasu zakończenia przeglądu DPA i warunków wszystkich dostawców modeli oraz narzędzi AI.

Możemy komunikować wyłącznie to, co kontrolujemy bezpośrednio:

> Platforma nie wykorzystuje danych klientów do trenowania własnych modeli bez wyraźnej zgody klienta.

Polityki zewnętrznych dostawców muszą być opisane osobno i zgodnie z aktualnymi warunkami.

### Instrukcja dla Claude’a

1. Połącz tę decyzję z P12.
2. Usuń wszystkie absolutne deklaracje z marketingu i dokumentacji.
3. Utwórz rejestr DPA i status weryfikacji per dostawca.
4. Dodaj blocker przed publikacją szerszego zobowiązania.
5. Nie interpretuj ustawień API dostawcy jako pełnej gwarancji prawnej bez przeglądu warunków.

---

## P142 — ADR wyboru dostawców modeli LLM

**Status:** ZATWIERDZONE: ADR WYMAGANY PRZED PRODUKCJĄ

### Odpowiedź foundera

Należy utworzyć formalny ADR dotyczący strategii dostawców modeli LLM przed pierwszym produkcyjnym użyciem danych klienta.

ADR nie musi wskazywać jednego dostawcy na zawsze. Powinien opisywać:

- dostawcę domyślnego,
- modele dopuszczone do określonych klas zadań,
- kryteria fallbacku,
- zasady przetwarzania danych,
- wymagania DPA,
- politykę kosztową,
- wymagania dotyczące logów i retencji,
- mechanizm zmiany modelu.

### Instrukcja dla Claude’a

1. Utwórz ADR „LLM Provider and Routing Strategy”.
2. Nie wpisuj konkretnego modelu jako trwałego standardu bez benchmarku.
3. Rozdziel model choice od provider choice.
4. Uwzględnij możliwość multi-provider.
5. Dodaj kryteria bezpieczeństwa, jakości, kosztu i dostępności.

---

## P143 — Formalizm pakietu AI governance

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Zachowujemy kluczowe zabezpieczenia AI governance, ale nie budujemy od razu pełnego systemu rejestrów YAML, rainbow deployments, rozbudowanych sędziów LLM i wielowarstwowych bramek.

Minimum na MVP:

- rejestr używanych modeli,
- wersjonowanie promptów,
- podstawowy zestaw ewaluacji,
- approval boundary,
- koszt i logowanie,
- rejestr incydentów,
- możliwość rollbacku promptu/modelu.

### Instrukcja dla Claude’a

1. Podziel dokumentację na `MVP controls` i `future controls`.
2. Wdróż tylko zabezpieczenia potrzebne do najbliższej fazy.
3. Nie twórz infrastruktury dla skali, której nie ma.
4. Zachowaj G1–G8 jako zasady, niekoniecznie jako pełne mechanizmy.
5. Dodaj triggery rozszerzenia governance.

---

## P144 — Szczegółowość obserwowalności przed walidacją rynku

**Status:** ZATWIERDZONE: WSTRZYMAĆ DALSZĄ ROZBUDOWĘ

### Odpowiedź foundera

Nie rozwijamy dalej szczegółowej dokumentacji obserwowalności Faz 4–9 przed potwierdzeniem rynku i pierwszym działającym produktem.

Zachowujemy tylko minimalne wymagania:

- logi błędów,
- koszt per zadanie,
- status agent run,
- approval events,
- czas wykonania,
- podstawowe metryki niezawodności,
- alerty bezpieczeństwa,
- audyt działań na zasobach klienta.

### Instrukcja dla Claude’a

1. Oznacz pełny pakiet jako `target observability`.
2. Zdefiniuj minimalny MVP telemetry set.
3. Usuń lub odłóż dashboardy niepowiązane z bieżącą decyzją.
4. Nie zbieraj danych bez celu.
5. Powiąż eventy z operacyjnym ownerem i retencją.

---

## P145 — Budżet alertów i reguła 15 minut

**Status:** HIPOTEZA MVP DO KALIBRACJI

### Odpowiedź foundera

Limit maksymalnie pięciu rzeczywistych alertów wymagających reakcji tygodniowo jest rozsądnym celem dla solo-foundera.

Reguła reakcji w 15 minut nie może być ogólnym zobowiązaniem ani publicznym SLA.

Dla MVP:

- alerty bezpieczeństwa krytycznego: natychmiast po zauważeniu,
- pozostałe: obsługa w dostępnym oknie operacyjnym,
- brak gwarancji 24/7,
- alerty muszą być agregowane i deduplikowane.

### Instrukcja dla Claude’a

1. Oznacz pięć alertów jako alert budget.
2. Usuń 15 minut jako publiczne SLA.
3. Dodaj severity-based response targets.
4. Mierz false positives.
5. Każdy alert bez działania powinien zostać usunięty lub obniżony.

---

## P146 — Zamknięty stack Sentry, PostHog, RevenueCat, Stripe

**Status:** HIPOTEZA MVP, NIE STANDARD STAŁY

### Odpowiedź foundera

Sentry, PostHog, RevenueCat i Stripe mogą być domyślnym stackiem MVP, ale nie są jedynym dopuszczalnym zestawem na zawsze.

Każdy dostawca musi przejść:

- ocenę funkcjonalną,
- kosztową,
- bezpieczeństwa,
- DPA,
- rezydencji danych,
- lock-in,
- zgodności z potrzebami klientów.

### Instrukcja dla Claude’a

1. Oznacz dostawców jako `default candidates`.
2. Nie wpisuj „jedyny toolkit”.
3. Projektuj warstwę domenową możliwie vendor-neutral.
4. Finalny wybór zamknij ADR-em.
5. Powiąż z Vendor Register.

---

## P147 — Publiczne dashboardy FizzUp

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

FizzUp może publikować wybrane metryki jako transparentne case study, ale tylko po spełnieniu warunków prywatności i jakości.

Dopuszczalne:

- crash rate,
- uptime,
- wysokopoziomowy funnel,
- ogólny przychód lub przedziały,
- tempo wydań,
- wybrane wyniki eksperymentów.

Niedopuszczalne:

- dane użytkowników,
- dane pozwalające na reidentyfikację,
- pełne dane finansowe bez decyzji,
- metryki niezweryfikowane,
- dane tenantów lub dostawców.

### Instrukcja dla Claude’a

1. Utwórz public metrics whitelist.
2. Dodaj privacy review.
3. Każdy dashboard musi mieć ownera.
4. Nie pokazuj danych live bez opóźnienia, jeśli zwiększa to ryzyko.
5. Powiąż publikację z polityką Startup Zero.

---

## P148 — Brakujące ADR dla logów i retencji

**Status:** ODŁOŻONE DO STARTU IMPLEMENTACJI

### Odpowiedź foundera

Nie piszemy teraz szczegółowych ADR-ów wyboru narzędzia logów i dokładnej retencji, jeżeli nie ma jeszcze działającej architektury.

Przed implementacją produkcyjną należy jednak zamknąć:

- dostawcę logów,
- region,
- klasy danych,
- dostęp,
- okresy retencji,
- koszt,
- redakcję sekretów i danych osobowych.

### Instrukcja dla Claude’a

1. Dodaj decision deadline na start Fazy 4.
2. Zachowaj kryteria wyboru.
3. Nie koduj zależności od konkretnego dostawcy wcześniej.
4. Połącz z P123.
5. Oznacz brak decyzji jako kontrolowany punkt otwarty.

---

## P149 — Dokumentowanie Faz 4–14

**Status:** ZATWIERDZONE: WSTRZYMAĆ SZCZEGÓŁOWE DOKUMENTOWANIE

### Odpowiedź foundera

Nie rozwijamy dalej szczegółów Faz 4–14 przed zakończeniem walidacji rynku.

Dopuszczalne są:

- kierunek,
- najważniejsze zależności,
- ryzyka,
- decyzje trudne do odwrócenia,
- triggery skalowania.

Niedopuszczalne są:

- pełne implementacje papierowe,
- sztuczne progi,
- rozbudowane checklisty,
- szczegółowe procesy dla nieistniejących zespołów.

### Instrukcja dla Claude’a

1. Oznacz dokumenty jako `future architecture`.
2. Usuń spekulatywne szczegóły z aktywnego backlogu.
3. Nie angażuj agentów w dalsze rozwijanie tych faz.
4. Zachowaj jedynie elementy wpływające na bieżące decyzje.
5. Wznów po osiągnięciu właściwej bramki.

---

## P150 — Progi 25/100/1 000/10 000 aktywnych ventures

**Status:** HIPOTEZA PLANISTYCZNA

### Odpowiedź foundera

Progi mogą pozostać jako orientacyjne poziomy myślenia o skali, ale nie są zobowiązaniem biznesowym ani technicznym.

Skalowanie powinno być wyzwalane przez:

- realne obciążenie,
- koszt,
- niezawodność,
- wymagania klientów,
- bottleneck operacyjny,
- przychód i marżę.

### Instrukcja dla Claude’a

1. Oznacz progi jako illustrative tiers.
2. Nie buduj infrastruktury dla 10 000 ventures teraz.
3. Dla każdego tieru dodaj metryki rzeczywiste.
4. Aktualizuj po danych.
5. Nie używaj progów jako forecastu inwestorskiego bez osobnego modelu.

---

## P151 — Brak kosztu venture/miesiąc

**Status:** ZATWIERDZONE JAKO TYMCZASOWA NIEWIADOMA

### Odpowiedź foundera

Akceptuję brak dokładnej prognozy kosztu na obecnym etapie, ale od pierwszych realnych zadań telemetria kosztowa jest obowiązkowa.

Nie akceptuję sytuacji, w której firma sprzedaje usługę bez zdolności policzenia:

- kosztu per venture,
- kosztu per workflow,
- kosztu błędów,
- kosztu supportu,
- marży brutto.

### Instrukcja dla Claude’a

1. Połącz z P5, P9 i P127.
2. Wprowadź cost telemetry jako requirement MVP.
3. Przygotuj scenariusze low/base/high.
4. Dodaj kill-switch kosztowy.
5. Finalny cennik musi uwzględniać dane produkcyjne.

---

## P152 — Rozbudowany system bram skalowania

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Nie stosujemy pełnej ceremonii bram i ADR-ów dla każdej decyzji skalowania na etapie jednoosobowej firmy.

Pełny gate jest wymagany dla:

- zmian bezpieczeństwa,
- zmian architektury wielotenantowej,
- dużych wydatków,
- migracji danych,
- zmian publicznego SLA,
- decyzji trudnych do odwrócenia.

Pozostałe decyzje mogą korzystać z uproszczonego review.

### Instrukcja dla Claude’a

1. Utwórz `Scale Decision Lite`.
2. Zachowaj pełny gate dla wysokiego ryzyka.
3. Usuń checklisty bez realnego odbiorcy.
4. Nie wymagaj ADR dla rutynowej optymalizacji.
5. Mierz koszt procesu.

---

## P153 — Aktualność trzech ról agentów

**Status:** ZATWIERDZONE

### Odpowiedź foundera

ADR-004 pozostaje aktualny dla MVP.

Role:

- AI Product Owner,
- AI CTO,
- AI Launch Manager

są zatwierdzone jako trzy widoczne role klienckie.

### Instrukcja dla Claude’a

1. Połącz z P6 i P120.
2. Usuń oznaczenie `provisional` w kontekście MVP.
3. Dodatkowe role oznacz jako post-MVP.
4. Ujednolić nazwy we wszystkich dokumentach.
5. Nie zmieniaj ich bez danych z testów.

---

## P154 — Szczegółowy framework governance agentów

**Status:** ODŁOŻONE CZĘŚCIOWO

### Odpowiedź foundera

Nie budujemy teraz pełnych role packs, rejestru promptów z rozbudowanym semver, rainbow rolloutów i co najmniej 20 testów dla każdej roli.

Na MVP wymagane są:

- jasna definicja roli,
- zakres uprawnień,
- podstawowy prompt versioning,
- minimalny zestaw testów krytycznych,
- log kosztów,
- approval boundaries,
- możliwość rollbacku.

### Instrukcja dla Claude’a

1. Podziel framework na MVP i advanced.
2. Zachowaj minimum bezpieczeństwa.
3. Nie implementuj advanced rollout przed realnym runtime.
4. Dodaj trigger rozszerzenia po powtarzalnym użyciu.
5. Nie twórz testów dla hipotetycznych funkcji.

---

## P155 — Weryfikacja liczb z briefu R5

**Status:** WYMAGA WERYFIKACJI

### Odpowiedź foundera

Wszystkie liczby z R5 muszą zostać porównane z pierwotnym źródłem przed użyciem jako uzasadnienie architektury, marketingu, sprzedaży lub materiałów inwestorskich.

### Instrukcja dla Claude’a

1. Utwórz tabelę wszystkich cytowanych liczb.
2. Dodaj źródło, datę, metodę i kontekst.
3. Usuń lub oznacz liczby bez potwierdzenia.
4. Nie przenoś statystyk między kontekstami.
5. Połącz z zasadą P24.

---

## P156 — Progi budżetu, TTL zgód i promocji autonomii

**Status:** HIPOTEZA MVP DO KALIBRACJI

### Odpowiedź foundera

Wartości 70/100%, 7 dni/72h, trzy porażki i inne progi mają pozostać konfigurowalne i jawnie oznaczone jako hipotezy.

Nie mogą zostać zakodowane na stałe bez:

- celu,
- ownera,
- mierzonego efektu,
- możliwości zmiany,
- review po realnym użyciu.

### Instrukcja dla Claude’a

1. Przenieś progi do konfiguracji.
2. Dodaj opis i source of rationale.
3. Nie twórz automatycznych awansów autonomii.
4. Kalibruj po danych.
5. Zapisuj zmianę progu w decision logu, jeśli wpływa na ryzyko.

---

## P157 — Relacja agentów produktowych i platformowych

**Status:** ZATWIERDZONE TYMCZASOWO

### Odpowiedź foundera

W MVP utrzymujemy logiczny rozdział:

- agenci produktowi obsługują ventures i klientów,
- agenci platformowi budują i utrzymują samą platformę.

Nie migrujemy obu populacji automatycznie na jeden runtime przed udowodnieniem, że jest to bezpieczne i ekonomicznie uzasadnione.

### Instrukcja dla Claude’a

1. Zachowaj odrębne uprawnienia i dane.
2. Nie współdziel kontekstu klientów z agentami platformowymi bez potrzeby.
3. Opisz wspólne komponenty, ale nie wymuszaj wspólnego runtime.
4. Dodaj review po działaniu obu modeli.
5. Refaktoryzacja wymaga ADR.

---

## P158 — Definicja Startup Zero

**Status:** ZATWIERDZONE

### Odpowiedź foundera

Startup Zero oznacza FizzUp — własny, kontrolowany przez foundera produkt referencyjny używany do walidacji procesu, agentów, architektury, launchu i modelu komercyjnego platformy.

### Instrukcja dla Claude’a

1. Dodaj definicję do głównego glossary.
2. Usuń niejasne odwołania.
3. Rozdziel nazwę FizzUp od pojęcia roli Startup Zero.
4. Nie ujawniaj automatycznie prywatnych danych FizzUp.
5. Powiąż z polityką publicznego case study.

---

## P159 — Brak klasycznego rollbacku binarki natywnej

**Status:** ZATWIERDZONE KIERUNKOWO + WYMAGA WERYFIKACJI SZCZEGÓŁÓW

### Odpowiedź foundera

Akceptuję, że natywnej binarki nie można traktować jak web deploymentu z natychmiastowym rollbackiem.

Model recovery powinien opierać się na:

- staged rollout,
- feature flags,
- kill-switchach,
- ograniczeniu zasięgu,
- corrective release,
- ewentualnych mechanizmach dostępnych w sklepach.

Dokładne możliwości Apple i Google muszą być zweryfikowane przed zapisaniem ich jako reguły produktu.

### Instrukcja dla Claude’a

1. Nie obiecuj pełnego rollbacku.
2. Rozdziel binarkę, konfigurację i backend.
3. Dodaj staged rollout i kill-switch.
4. Oznacz funkcje sklepowe jako `to verify`.
5. W kartach zatwierdzenia komunikuj ryzyko nieodwracalności.

---

## P160 — Dwa ręczne kroki przy pierwszym starcie venture

**Status:** HIPOTEZA OPERACYJNA DO WERYFIKACJI

### Odpowiedź foundera

Akceptuję, że pierwsze wdrożenie może wymagać ręcznej inicjalizacji EAS i pierwszego uploadu AAB przez Google Play.

Nie należy jednak przedstawiać tego jako niezmiennego ograniczenia bez aktualnej weryfikacji.

### Instrukcja dla Claude’a

1. Zweryfikuj procedury z aktualnymi źródłami Expo i Google.
2. Opisz ręczne kroki w onboardingu.
3. Jasno wskaż, kto je wykonuje.
4. Nie ukrywaj pracy ręcznej.
5. Aktualizuj procedurę po zmianach dostawców.

---

## P161 — Zarządzana pula testerów Play

**Status:** ODŁOŻONE DO ROADMAPY

### Odpowiedź foundera

Funkcja pozostaje na roadmapie jako możliwość post-MVP.

Nie budujemy jej, dopóki:

- co najmniej trzech klientów nie zgłosi realnego problemu,
- nie zostanie potwierdzona zgodność z zasadami Google,
- nie będzie znany model kosztowy,
- ręczny proces nie stanie się bottleneckiem.

### Instrukcja dla Claude’a

1. Zachowaj roadmap item.
2. Nie obiecuj w sprzedaży.
3. Zbieraj dane z pierwszych launch-y.
4. Przy triggerze rozpocznij osobne discovery.
5. Połącz z P19.

---

## P162 — Hipotezy dotyczące rolloutów Apple i rollbacku Play

**Status:** ZATWIERDZONE: WERYFIKACJA PRZED FAZĄ 8

### Odpowiedź foundera

Obie hipotezy muszą zostać zweryfikowane na podstawie aktualnych źródeł pierwotnych przed zakodowaniem ich jako twarde reguły.

### Instrukcja dla Claude’a

1. Utwórz dwa zadania research.
2. Dodaj source, date verified i ownera.
3. Nie cytuj nieaktualnych blogów jako źródła prawdy.
4. Zaktualizuj Launch Playbook po weryfikacji.
5. Powiąż z P159.

---

## P163 — Model founder + roster agentów, zero ludzi domyślnie

**Status:** ZATWIERDZONE JAKO MODEL STARTOWY

### Odpowiedź foundera

Model jednego foundera i rosteru agentów AI pozostaje przyjętym modelem początkowym.

Nie jest to dogmat „nigdy nie zatrudniamy ludzi”. Ludzie są zatrudniani, gdy pojawia się:

- bottleneck,
- ryzyko,
- wymóg kompetencyjny,
- odpowiedzialność prawna,
- potrzeba relacji z klientem,
- ekonomiczne uzasadnienie.

### Instrukcja dla Claude’a

1. Utrzymaj ADR-010.
2. Usuń język sugerujący trwały zakaz zatrudniania.
3. Powiąż zatrudnienia z triggerami.
4. Nie projektuj fikcyjnej organizacji.
5. Mierz, gdzie agentowy model nie działa.

---

## P164 — Kolejność pierwszych trzech zatrudnień

**Status:** HIPOTEZA MVP, NIE SZTYWNA KOLEJNOŚĆ

### Odpowiedź foundera

Preferowany porządek wsparcia jest następujący:

1. fractional księgowość / podatki / administracja prawna,
2. specjalista bezpieczeństwa i infrastruktury,
3. contractor customer support / operations.

Kolejność może się zmienić, jeśli realny bottleneck pojawi się gdzie indziej, np. w sprzedaży, delivery lub product engineering.

### Instrukcja dla Claude’a

1. Oznacz kolejność jako default sequence.
2. Każda rola wymaga business case.
3. Rozważ contractor/fractional przed etatem.
4. Nie zatrudniaj na podstawie kalendarza.
5. Zaktualizuj trigger table.

---

## P165 — Aparat „rekrutacji” i oceny agentów

**Status:** DO UPROSZCZENIA

### Odpowiedź foundera

Pełna 12-polowa karta roli, 20 testów, rozbudowana drabina autonomii i metering dla każdej hipotetycznej roli są zbyt ciężkie na Fazę 1.

Minimum:

- nazwa i cel roli,
- zakres odpowiedzialności,
- zakazane działania,
- podstawowy prompt,
- 5–10 krytycznych testów dla aktywnej roli,
- koszt,
- approval boundary,
- owner.

### Instrukcja dla Claude’a

1. Uprość role card.
2. Nie twórz testów dla nieaktywnych ról.
3. Rozwijaj evals wraz z realnymi błędami.
4. Zachowaj metering kosztów.
5. Rozbuduj framework dopiero przy większym rosterze.

---

## P166 — Brak widełek wynagrodzeń

**Status:** ODŁOŻONE WARUNKOWO

### Odpowiedź foundera

Nie potrzebujemy teraz pełnej siatki wynagrodzeń.

Przed uruchomieniem konkretnej rekrutacji należy przygotować:

- benchmark rynkowy,
- model contractor/fractional/etat,
- koszt całkowity,
- zakres odpowiedzialności,
- lokalizację,
- budżet.

### Instrukcja dla Claude’a

1. Nie generuj stałych widełek bez roli.
2. Dodaj salary benchmark task do hiring trigger.
3. Oznacz brak widełek jako świadome odłożenie.
4. Nie publikuj oferty bez zatwierdzonego budżetu.
5. Utrzymuj spójność z runway.

---

## P167 — Spójność cytowań HR z dokumentami źródłowymi

**Status:** ZATWIERDZONE: WYKONAĆ AUDYT

### Odpowiedź foundera

Przed zaakceptowaniem pakietu HR należy sprawdzić, czy cytowane role, pamięć firmy, struktura i założenia rzeczywiście są zgodne z dokumentami źródłowymi.

### Instrukcja dla Claude’a

1. Wykonaj cross-document consistency review.
2. Przygotuj tabelę sprzeczności.
3. Nie kopiuj nieaktualnych nazw ról.
4. Ustal jedno źródło prawdy.
5. Dopiero po korekcie zaproponuj status accepted.

---

## P168 — Zero ludzkiego Customer Success do triggera

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Nie zatrudniamy dedykowanego Customer Success domyślnie przed pojawieniem się powtarzalnego obciążenia.

Nie oznacza to braku ludzkiej odpowiedzialności. Founder odpowiada za kluczowych klientów i eskalacje, a standardowe procesy powinny być produktowe i wspierane przez agentów.

### Trigger zatrudnienia

- founder poświęca ponad 4–5 godzin tygodniowo przez 6–8 tygodni,
- klienci czekają na odpowiedzi,
- churn wynika z braku opieki,
- rośnie liczba aktywnych klientów,
- support wymaga stałego pokrycia.

### Instrukcja dla Claude’a

1. Oznacz model jako `agent-first, human accountable`.
2. Nie komunikuj „zero human support”.
3. Dodaj trigger zatrudnienia.
4. Mierz czas i przyczyny eskalacji.
5. Projektuj self-service, ale nie ukrywaj supportu ręcznego.

---

## P169 — Finalna decyzja cenowa dla O1–O4

**Status:** WYMAGA DANYCH I DECYZJI FOUNDERA

### Odpowiedź foundera

Nie podejmujemy finalnej decyzji cenowej wyłącznie na podstawie estymacji R7.

Ceny końcowe powstaną po:

- wywiadach,
- testach landing page,
- co najmniej kilku rozmowach cenowych,
- pierwszych płatnych pilotach,
- pomiarze kosztów,
- ocenie zakresu odpowiedzialności.

### Instrukcja dla Claude’a

1. Oznacz wszystkie ceny jako hypotheses.
2. Przygotuj pricing evidence pack.
3. Rozdziel:
   - readiness report,
   - launch package,
   - operate subscription,
   - grow tier.
4. Nie publikuj finalnego ADR przed dowodami.
5. Finalną decyzję pozostaw founderowi.

---

## P170 — Disclosure dla health scoringu

**Status:** ZATWIERDZONE WARUNKOWO + WYMAGA LEGAL REVIEW

### Odpowiedź foundera

Dane z płatności, analityki i monitoringu mogą być używane do health scoringu tylko wtedy, gdy:

- cel jest jasno opisany,
- zakres danych jest minimalny,
- dostęp jest kontrolowany,
- klient wie, jakie dane są używane,
- wynik nie jest wykorzystywany w sposób zaskakujący lub dyskryminujący,
- istnieje zgodna z prawem podstawa przetwarzania.

### Instrukcja dla Claude’a

1. Przygotuj disclosure w prostym języku.
2. Utwórz data-flow map.
3. Nie zbieraj danych bez celu.
4. Dodaj mechanizm wyłączenia, jeśli jest prawnie lub biznesowo potrzebny.
5. Przed produkcją zleć legal review.

---

## P171 — Budżet czasu foundera na support

**Status:** ZATWIERDZONE JAKO LIMIT PROJEKTOWY

### Odpowiedź foundera

Maksymalnie cztery godziny tygodniowo na rutynowe eskalacje supportowe pozostają limitem projektowym.

Limit trzech kont tygodniowo w rollupie nie powinien być sztywny. Raport powinien pokazywać:

- wszystkie konta krytyczne,
- konta z ryzykiem churn,
- sprawy blokujące przychód,
- najważniejsze wzorce.

### Instrukcja dla Claude’a

1. Usuń sztywny limit trzech kont jako jedyny mechanizm.
2. Stosuj exception-based rollup.
3. Mierz czas foundera.
4. Po przekroczeniu limitu uruchom trigger wsparcia.
5. Nie buduj modelu wymagającego stałego manualnego review wszystkich klientów.

---

## P172 — Warunki komercyjne design partnerów Fazy 10

**Status:** ZATWIERDZONE WARUNKOWO

### Odpowiedź foundera

Design partnerzy muszą mieć:

- płatny zakres,
- zdefiniowany termin pilota,
- kryteria sukcesu,
- termin decyzji o konwersji,
- ustalone prawa do case study i referencji,
- jasne ograniczenia odpowiedzialności.

Nie przyjmujemy reguły, że rabat nigdy nie może przekroczyć 10%. Rabat zależy od wartości wkładu partnera, ale nie może prowadzić do pozornego willingness-to-pay.

### Instrukcja dla Claude’a

1. Ujednolić z P69 i P77.
2. Przygotuj design partner term sheet.
3. Każdy rabat musi mieć uzasadnienie.
4. Konwersja ma mieć konkretną datę.
5. Bezpłatny wyjątek wymaga wpisu founderskiego.

---

## P173 — Polityka danych po churnie

**Status:** ZATWIERDZONE: UTWORZYĆ PRZED PRODUKCJĄ

### Odpowiedź foundera

Należy utworzyć formalną politykę cyklu życia danych klienta obejmującą:

- retencję po churnie,
- eksport danych,
- usunięcie,
- backupy,
- okres technicznego wygaszania,
- pamięć agentów,
- dane dostawców zewnętrznych,
- cofnięcie zgody,
- obowiązki prawne i księgowe,
- potwierdzenie wykonania usunięcia.

### Zasada nadrzędna

Dane nie mogą pozostawać bezterminowo tylko dlatego, że system pamięci lub backupów technicznie je zachowuje.

### Instrukcja dla Claude’a

1. Utwórz `Customer Data Lifecycle Policy`.
2. Powiąż z retention matrix, DPA i onboardingiem.
3. Dodaj workflow offboardingu.
4. Rozdziel dane operacyjne, finansowe, audytowe i osobowe.
5. Wymagaj legal review przed pierwszym klientem produkcyjnym.
6. Dodaj dowód wykonania eksportu i usunięcia.

---

# Instrukcja końcowa dla Claude’a

Po zastosowaniu P141–P173:

1. Utwórz lub zaktualizuj ADR-y dotyczące:
   - strategii dostawców LLM,
   - trzech ról agentów na MVP,
   - rozdziału agentów produktowych i platformowych,
   - zasad release recovery,
   - minimalnego AI governance.
2. Skonsoliduj duplikaty:
   - P12/P141,
   - P19/P161,
   - P24/P155,
   - P82/P140,
   - P5/P9/P127/P151,
   - P6/P120/P153,
   - P69/P77/P172,
   - P110/P136,
   - P123/P148/P173.
3. Przygotuj minimalne artefakty:
   - LLM Provider and Routing ADR,
   - model registry MVP,
   - prompt versioning MVP,
   - public metrics whitelist,
   - release recovery matrix,
   - design partner term sheet,
   - customer health scoring disclosure,
   - Customer Data Lifecycle Policy.
4. Wstrzymaj:
   - rozbudowany AI governance,
   - pełne rainbow deployments,
   - publiczne API/SDK,
   - skalowanie pod 10 000 ventures,
   - zarządzaną pulę testerów,
   - szczegółowy system HR dla agentów.
5. Nie publikuj:
   - deklaracji o nietrenowaniu bez DPA review,
   - publicznych SLA bez pokrycia,
   - niezweryfikowanych statystyk,
   - obietnicy rollbacku natywnej binarki,
   - finalnego pricingu bez dowodów.
6. Przygotuj listę otwartych decyzji founderskich:
   - finalny dostawca LLM,
   - finalne limity kosztowe,
   - finalny pricing,
   - konkretne budżety,
   - finalne warunki ubezpieczenia,
   - finalny model supportu po pierwszej kohorcie.
7. Na końcu przedstaw:
   - listę zmienionych plików,
   - listę nowych ADR-ów,
   - otwarte decyzje,
   - blokery przed produkcją,
   - zadania prawne,
   - elementy odłożone,
   - elementy gotowe do oznaczenia `accepted`.
