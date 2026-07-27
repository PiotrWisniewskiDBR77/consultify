# Decyzje architektoniczne po audycie R0

Status: OBOWIAZUJACA DECYZJA ARCHITEKTONICZNA  
Data: 2026-07-24  
Podstawa: raport R0 wykonany na demo 876ca16679  
Kanon produktu: MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md  
Program wykonawczy: MATERIALS_RESUSCITATION_PROGRAM_2026-07-24.md

## 1. Wniosek z R0

System ma juz wystarczajaco duzo dzialajacych elementow, aby nie budowac nowego modułu Materialow ani nowego generatora szablonow. Problemem jest split-brain pomiedzy rejestrami, launcherami i generatorami.

Najpierw naprawiamy prawde danych oraz przekazanie blueprintu. Dopiero pozniej upraszczamy menu i wygaszamy stare ekrany.

## 2. Rozstrzygniecia D1-D6

### D1. Zrodlo szablonow dokumentow

Decyzja: document_studio_templates jest kanonicznym zrodlem dla nowych szablonow dokumentow.

report_builder_templates pozostaje zrodlem legacy, poniewaz obecnie zasila widoczna biblioteke i moze zawierac nadal uzywane dane. Nie wolno go nagle usunac ani przedstawic jako rownowaznego z Document Studio.

Wspolna biblioteka ma pokazywac oba zrodla poprzez adapter, z jawnym origin oraz stanem legacy dla rekordow Report Builder. Docelowo rekordy legacy beda migrowane albo wygaszane.

### D2. Jeden read-model biblioteki

Decyzja: v8_artifact_origin_links jest indeksem i read-modelem widocznej Template Library, a nie zrodlem prawdy o szablonie.

Kanoniczna tresc blueprintu nadal nalezy do rejestru konkretnego formatu. Indeks moze przyspieszac wyszukiwanie i filtrowanie, ale musi:

- wskazywac origin runtime i canonical record id;
- odrzucac albo oznaczac osierocone linki;
- byc odswiezany z rejestrow kanonicznych;
- nie maskowac brakow domyslnym statusem albo scope bez oznaczenia.

Stary deliverableTemplateService i OutputsLauncherModal sa legacy. Nie wolno ich kasowac w R1, ale nie stanowia podstawy nowej biblioteki ani launchera.

### D3. Kontrakt Z szablonu

Decyzja: to jest najwazniejszy bug funkcjonalny i priorytet R1.

Przeplyw musi przekazac templateArtifactId lub canonical template id do serwera. Serwer ma sprawdzic dostep, rozwiazac formatowy blueprint z rejestru kanonicznego i zasilić nim odpowiedni run/generator. Sam opis szablonu nie jest substytutem blueprintu.

Implementacja nie moze tworzyc jednego nieustrukturyzowanego promptu dla trzech formatow. Powinna przekazac typowany CreationIntent i zastosowac adapter formatu.

### D4. Semantyka szablonu Excela

Decyzja etapowa:

1. Dzis istniejace siedem modeli w kodzie nazywamy modelami workbookow, nie szablonami uzytkownika.
2. Nie pokazujemy funkcji utworz szablon arkusza ani trybu Na bazie istniejacego dla Excela, dopoki nie istnieje trwaly workbook template registry z blueprintem.
3. Zdolnosc tworzenia szablonow Excel przez uzytkownika pozostaje celem produktu, ale jest oddzielnym pakietem po R1 i przed pelnym R3 arkusza.

Nie udajemy, ze klon gotowego workbooka lub parametryzowany model jest tym samym co szablon.

### D5. Zrodlo arkuszy w bibliotece

Decyzja: tp_base_templates nie sa szablonami Excel i nie wolno ich backfillowac do Template Library jako arkuszy.

W R1 biblioteka moze pokazywac jedynie istniejace modele workbookow jako systemowe, wyraznie oznaczone modele, jezeli adapter potrafi dostarczyc prawdziwy blueprint. W przeciwnym razie zakladka Arkusze ma uczciwy pusty stan do czasu wdrozenia workbook template registry.

### D6. Widocznosc architektow

Decyzja: deckArchitectFlag ma domyslnie odpowiadac deklarowanemu OFF. Architekt deckow i builder workbook models nie sa pozycjami Menu 2.

Zmiana widocznosci jest elementem R2, po zakonczeniu R1. W R1 naprawiamy dane i kontrakt, bez zmiany glownego UX.

## 3. Skorygowana kolejnosc R1

### R1.0 - testy kontraktu i dane referencyjne

Przed zmianami Claude tworzy testy lub harness obejmujacy po jednym rzeczywistym szablonie:

- dokumentu z document_studio_templates;
- prezentacji z presentation_templates;
- legacy raportu z report_builder_templates;
- modelu workbooka, jezeli mozna go poprawnie zmaterializowac.

DoD: test rozroznia canonical id, origin runtime, format i dostep; nie korzysta z seedowych opisow jako substytutu blueprintu.

### R1.1 - solidny indeks Template Library

Zamiast prostego backfillu do v8_artifact_origin_links:

1. dodac adapter dla document_studio_templates;
2. dodac walidacje istnienia zrodla przy odczycie lub okresowym odswiezaniu;
3. oznaczac source i legacy;
4. usunac lub naprawic osierocone linki kontrolowana migracja;
5. nie dodawac tp_base_templates jako sheet template.

DoD: biblioteka pokazuje realny dokument Document Studio, realna prezentacje i legacy raport ze wskazanym pochodzeniem; nie pokazuje osieroconego linku.

### R1.2 - end-to-end Z szablonu

Naprawic przekazanie identyfikatora i blueprintu do artifact run. Implementacja zaczyna od jednego formatu referencyjnego, dokumentu, nastepnie rozszerza deck, a workbook dopiero gdy istnieje prawdziwy template registry.

DoD dla dokumentu: wybranie konkretnego szablonu w bibliotece prowadzi do draftu, ktorego struktura odpowiada sectionBlueprint wybranego rekordu.

### R1.3 - uczciwe ograniczenie arkuszy

Zmienic nazewnictwo i wejscia obecnych siedmiu modeli na Workbook models. Nie prezentowac ich jako tworzone przez uzytkownika szablony.

DoD: uzytkownik nie widzi obietnicy Na bazie istniejacego lub Nowy szablon arkusza, ktorej aplikacja nie realizuje.

## 4. Co nie wchodzi do R1

- przebudowa wygladu launcherow;
- usuwanie lub ukrywanie glownej nawigacji;
- migracja danych Report Builder;
- budowa pelnego webowego edytora komorek;
- nowy generator prezentacji albo dokumentow;
- publikowanie user-created Excel templates.

Te elementy pozostaja odpowiednio w R2, R3 albo osobnym pakiecie workbook template registry.

## 5. Nastepny task Claude'a

Wykonaj R1.0 i przedstaw najpierw propozycje kontraktow, liste plikow oraz plan testow. Nie zmieniaj jeszcze kodu. Zatrzymaj sie do odbioru architekta.

## 6. Odbior propozycji R1.0

Propozycja R1.0 zostaje zaakceptowana kierunkowo, z nastepujacymi ograniczeniami implementacji.

### Zatwierdzone

- osobny MaterialCreationIntent, aby nie kolidowal z istniejacym ChatCreationIntent;
- rozdzielenie identyfikatora wpisu indeksu od canonical template id;
- adapter document_studio_templates do indeksu Template Library;
- jawne oznaczenie report_builder_templates jako legacy;
- resolver blueprintu po stronie serwera, z ponownym wykorzystaniem dzialajacego resolvera Document Studio;
- kierowanie dokumentu Z szablonu do Document Studio Mode 3;
- rozszerzenie constraint origin_runtime o document_template, jezeli potwierdzone przez migracje i test.

### Obowiazkowe korekty

1. Pierwszy pionowy slice R1.1/R1.2 obejmuje tylko dokument. Deck jest adapterem nastepnej iteracji, a workbook pozostaje unsupported do czasu workbook template registry.
2. TemplateRef nie moze byc luźnym obiektem z dwoma opcjonalnymi identyfikatorami. Dla wejscia z biblioteki wymagany jest templateArtifactId. Bezposredni canonicalTemplateId jest osobnym, wewnetrznym wariantem i zawsze wymaga originRuntime oraz serwerowej walidacji dostepu.
3. Indeks nie przechowuje blueprintu jako zrodla generacji. Przechowuje tylko identyfikatory i niewielkie summary do widoku; resolver zawsze odczytuje aktualny blueprint z rejestru.
4. Scope ma uzywac wspolnego slownika system, organization, personal, unknown. Nie wprowadzamy application bez uzgodnienia z istniejacym modelem uprawnien.
5. R1 nie usuwa osieroconych linkow z bazy. Ma je wykrywac, nie pokazywac jako gotowe do uzycia i mierzyc ich liczbe. Osobna decyzja zatwierdzi pozniejsze czyszczenie danych.
6. Testy nie moga zalezec od zywej bazy demo. Stosuja deterministyczne fixtures odpowiadajace rzeczywistemu ksztaltowi rekordow; opcjonalny test integracyjny stagingowy jest dodatkowa bramka.
7. Zmiana endpointu artifact-runs/from-chat nie wchodzi do dokumentowego slice, skoro dokument ma bezpieczniejsza sciezke Mode 3. Zostaje przygotowana jako osobny, nieimplementowany projekt adaptera deckowego.

### Skorygowane DoD pierwszej implementacji

1. W Template Library pojawia sie zatwierdzony dokument z document_studio_templates i ma jawny origin.
2. Wpis osierocony nie jest dostepny do uzycia i nie uruchamia cichego fallbacku.
3. Klikniecie Uzyj wzorca dla tego dokumentu otwiera Document Studio Mode 3 z konkretnym szablonem.
4. Wynikowy draft ma sekcje zgodne z sectionBlueprint tego rekordu.
5. Legacy report pozostaje widoczny tylko z oznaczeniem legacy i bez zmiany jego generacji.
6. Table Studio, workbook generation, sidebar i Menu 2 nie sa zmieniane.
