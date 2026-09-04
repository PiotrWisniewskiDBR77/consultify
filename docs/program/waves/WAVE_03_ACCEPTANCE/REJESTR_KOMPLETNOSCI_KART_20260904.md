# Rejestr kompletności kart — 2026-09-04

Pomiar dyżuru 324. Liczby sekcji pochodzą wyłącznie z uchwytów DOM w `NModeLeftNav`; kadry są dowodem stanu ekranu, nie źródłem liczby.

| Typ karty / wariant | Pozycji w katalogu | Pozycji renderowanych OFF | Pozycji renderowanych ON | Uchwyt DOM | Kadr | Commit |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Initiative — niepusty szablon `quick_win`, rekord `init-smed-linia-pakowania` | 24 | 6 | 6 | `[data-nmode-section-item]`, grupy: `[data-nmode-section-group]` = 3/3 | `evidence/kompletnosc-kart-20260904/r1-{off,on}-niepusty.png` | uzupełniony w commicie R1 |
| Initiative — pusty/brak szablonu, rekord `init-smed-linia-pakowania` | 24 | 24 | 24 | `[data-nmode-section-item]`, grupy: `[data-nmode-section-group]` = 5/5 | `evidence/kompletnosc-kart-20260904/r1-{off,on}-pusty.png` | uzupełniony w commicie R1 |
| Task | 10 | 8 | 8 | deklaracja `taskNSections` + kontrakt; pomiar DOM z dyżuru 314 niepowtórzony w R4 | — | uzupełniony w commicie R4 |
| Insight | 30 w deskryptorze; 32 w `INSIGHT_SECTIONS` | 32 | 32 | deklaracja `INSIGHT_SECTIONS` + kontrakt; pomiar DOM z dyżuru 314 niepowtórzony w R4 | — | uzupełniony w commicie R4 |

Stan przeglądarki: każdy przebieg uruchomiono w nowym kontekście Playwrighta. Przed wejściem nie istniał `ff.cardContract` ani klucz układu `initiative:*:v2-contract:*`; OFF nie przekazywał parametru, ON przekazywał wyłącznie `?cardContract=1` i ustawiał wspólny klucz w świeżym kontekście.

Granica dowodu R1: `dev-render/screens/karta-initiative.tsx` montuje produkcyjny `InitiativeDocumentView` na identyfikatorze bez prefiksu showcase, ale podstawia transport HTTP. Wynik dowodzi kolejności filtrów i sufitu DOM komponentu; nie dowodzi ścieżki ApiGateway/JWT/PostgreSQL.

## R4 — rozliczenie Task i Insight

- Task: katalog ma 10 nazw. Render `taskNSections` ma 8: `description-scope`, `implementation`, `risk-alternatives`, `checklist`, `dependencies`, `evidence`, `governance`, `attachments-links`. Brakujące imiennie: `comments` i `activity-log`. Nie znaleziono decyzji właściciela sankcjonującej brak, więc werdykt: dług. Gotowy, nienałożony kierunek diffu: dołożyć oba wpisy do `taskNSections` i ich komponenty treści, po osobnym ustaleniu źródeł danych oraz dowodzie mutacyjnym.
- Insight: teza „30 w katalogu, 22 renderowane” jest nieaktualna na markerze. `INSIGHT_CARDS` ma 30, `INSIGHT_SECTIONS` ma 32. Komentarze kontraktu wskazują dwa świadome extras po deduplikacji Fazy 0: `recommendations` i `executive-memo`; nadal są renderowane, ale celowo nie należą do 30-pozycyjnego katalogu. Nie ma więc ośmiu nazw do rozliczenia jako brak renderu.

## R5 — archetyp REKORD z §13.1

Pomiar: 11 wierszy, 4 typy z kontraktem, 7 bez kontraktu.

| Artefakt | Kontrakt | Ekran w `src/` |
| --- | --- | --- |
| Initiative | tak — `initiativeCardContract.ts` | tak — `InitiativeDocumentView.tsx` |
| Task | tak — `taskCardContract.ts` | tak — `TaskDetailView.tsx` |
| Decision | tak — `decisionCardContract.ts` | tak — `DecisionDetailView.tsx` |
| KPI | nie | tak — `ResultsVNext/kpiTool/KpiToolPage.tsx` |
| Insight | tak — `insightCardContract.ts` | tak — `InsightViewer.tsx` |
| Idea | nie | tak — `MyWork/IdeaMapWorkspace.tsx` i powiązane widoki |
| RAID | nie | brak samodzielnego ekranu rekordu znalezionego po pełnym skanie nazw; istnieją API i powierzchnie osadzone |
| Milestone | nie | brak samodzielnego ekranu rekordu; istnieją powierzchnie osadzone i runtime execution |
| Change Request | nie | brak samodzielnego ekranu rekordu; istnieją typy i sekcje osadzone |
| Stage Gate | nie | brak samodzielnego ekranu rekordu; istnieją API, typy i sekcje osadzone |
| Action Proposal | nie | tak — `views/ActionProposalView.tsx` i `components/ai/ActionProposalDetail.tsx` |

## DO DECYZJI WŁAŚCICIELA — nazwy Menu 3 Initiative

| §13.1 | Produkt dzisiaj |
| --- | --- |
| Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy |

Kadr obecnego stanu: `evidence/kompletnosc-kart-20260904/r3-pl-light-PARTIAL.png` (w lewym menu na wariancie `quick_win` widoczne są tylko trzy z pięciu grup: Zakres i plan, Rezultaty, Zapisy).

Czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie: brak decyzji właściciela, czy sześć nazw §13.1 jest docelową taksonomią, czy opisem semantycznym, który wolno mapować na pięć zaakceptowanych grup produktu.

## Dyżur 338 — R1: własny pomiar wejściowy

Rekord we wszystkich czterech przebiegach: `init-smed-linia-pakowania`. Każdy przebieg dostał świeży kontekst Playwrighta. Liczby pochodzą wyłącznie z uchwytów DOM, a stan `localStorage` zapisano w tym samym JSON-ie i w tej samej chwili co zliczenie.

| Szablon | Flaga zastanego kontraktu | Pozycji | Grup | `ff.cardContract` | Klucz kolejności sekcji | Dowód |
| --- | --- | ---: | ---: | --- | --- | --- |
| `quick_win` | OFF | 6 | 3 | `"0"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-off-niepusty.json` |
| `quick_win` | ON | 6 | 3 | `"1"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-on-niepusty.json` |
| brak | OFF | 24 | 5 | `"0"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-off-pusty.json` |
| brak | ON | 24 | 5 | `"1"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-on-pusty.json` |

Własna różnica zbiorów dla `quick_win` (po usunięciu dynamicznych liczników z tekstów DOM): Harmonogram; Zależności; Produkty i kamienie milowe; Decyzje; Ryzyko i RAID; Bramy; Sugerowane zmiany; Dziennik zmian; Zespół; RACI; Właściciele strumieni; Analiza finansowa; Wpływ finansowy; OKR; Hipoteza; Zasoby; Użyte w (powiązania); Wnioski i lekcje.

Rozbieżność wobec listy osiemnastu z instrukcji: **brak** — skład zbioru jest identyczny. Zrzuty `off-niepusty.png` i `on-niepusty.png` są bajtowo identyczne (`38781015…`), co potwierdza, że zastana flaga kontraktu nie usuwa sufitu narzuconego wcześniej przez szablon.

Granica dowodu: harness montuje produkcyjny `InitiativeDocumentView`, ale podstawia transport HTTP. Pomiar dowodzi zachowania DOM komponentu, nie ścieżki ApiGateway/JWT/PostgreSQL ani wdrożenia.

## Dyżur 338 — R2: DEC-388 za flagą domyślnie OFF

Nowa flaga `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` jest odczytywana wyłącznie z `import.meta.env`; brak wartości oznacza OFF. Nie dodano jej do `.env*`, `docker-compose*` ani `railway*`.

| Szablon | Nowa flaga | Pozycji | Grup | Stan `localStorage` | Dowód |
| --- | --- | ---: | ---: | --- | --- |
| `quick_win` | OFF (zmienna nieobecna) | 6 | 3 | `ff.cardContract="1"`; klucz kolejności `null` | `evidence/kompletnosc-24-sekcji-20260904/r2/r2-off-niepusty.json` |
| `quick_win` | ON (`VITE_VF1_INITIATIVE_SECTIONS_COMPLETE=1`) | 24 | 5 | `ff.cardContract="1"`; klucz kolejności `null` | `evidence/kompletnosc-24-sekcji-20260904/r2/r2-on-niepusty.json` |
| brak | OFF | 24 | 5 | `ff.cardContract="1"`; klucz kolejności `null` | `evidence/kompletnosc-24-sekcji-20260904/r2/r2-off-pusty.json` |
| brak | ON | 24 | 5 | `ff.cardContract="1"`; klucz kolejności `null` | `evidence/kompletnosc-24-sekcji-20260904/r2/r2-on-pusty.json` |

Przebieg ON z `quick_win` zawiera wszystkie osiemnaście nazw brakujących w R1. `visibleSections` i zawartość szablonu nie zostały usunięte ani zmienione; nowa funkcja wyboru zwraca pełną listę wyłącznie przy fladze ON, a przy OFF zachowuje zastany filtr.

## Dyżur 338 — R3: dowody mutacyjne zabezpieczenia

1. Usunięcie `lessons-learned` z `INITIATIVE_BOARD_CANONICAL_ORDER` dało RED: nowy test zgłosił `expected ... to have a length of 24 but got 23`, a zastany test kompletności wskazał brak imiennie: `expected [ 'lessons-learned' ] to deeply equal []`. Po cofnięciu przez `cp`: 10/10 GREEN i `GIT DIFF PUSTY PO COFNIĘCIU MUTACJI 1`.
2. Pozostawienie 24 pozycji w kanonie, ale przywrócenie bezpośredniego `allSections.filter(...)` w widoku dało RED: trzy przypadki zachowania funkcji przeszły, a przypadek przewodu do realnej nawigacji upadł. Po cofnięciu przez `cp`: 4/4 GREEN i `GIT DIFF PUSTY PO COFNIĘCIU MUTACJI 2`.

Pełne komendy i wyniki: `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/r3-mutacja-kanon-{red,green}.log` oraz `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/r3-mutacja-filtr-{red,green}.log`.

## Dyżur 338 — R4: inwentarz deskryptorów 24 sekcji boardu

`INITIATIVE_CANONICAL_CARDS` jest obecnie katalogiem 27 kluczy registry, a board ma osobną przestrzeń 24 identyfikatorów. Za istniejący deskryptor uznaję jawny deskryptor o tej samej semantyce, także gdy zastany adapter `nModeMap` mapuje camelCase/registry-id na board-id.

| Sekcja boardu | Deskryptor | Plik:linia | Dopisany w 338? |
| --- | --- | --- | --- |
| `initiative-definition` | tak — `OVERVIEW` + `PROBLEM_DEFINITION` | `initiativeCardContract.ts:62,80` | nie |
| `tasks` | tak — `TASKS` | `:141` | nie |
| `timeline` | tak — `TIMELINE` | `:456` | nie |
| `deliverables-milestones` | **nie** | — | nie |
| `dependencies` | tak — `DEPENDENCIES` | `:503` | nie |
| `decisions` | tak — `DECISIONS` | `:159` | nie |
| `risk-raid` | tak — `RAID` | `:176` | nie |
| `gates` | tak — `GATES` | `:199` | nie |
| `suggested-changes` | **nie** | — | nie |
| `change-log` | **nie** | — | nie |
| `target-state-scope` | tak — `TARGET_STATE` + `SCOPE` | `:102,120` | nie |
| `kpi` | tak — `KPIS` | `:258` | nie |
| `okr` | **nie** | — | nie |
| `hypothesis` | **nie** | — | nie |
| `financial-analysis` | tak — `FINANCIAL_ANALYSIS` | `:219` | nie |
| `financial-impact` | tak — `FINANCIAL_IMPACT` | `:240` | nie |
| `team` | tak — `TEAM` | `:407` | nie |
| `workstream-owners` | **nie** | — | nie |
| `raci` | tak semantycznie — `GOVERNANCE` + `STAKEHOLDERS` | `:425,487` | nie |
| `resources` | tak — `RESOURCES` | `:470` | nie |
| `attachments-links` | tak — `ATTACHMENTS` | `:521` | nie |
| `used-in` | **nie** | — | nie |
| `artifacts` | **nie** | — | nie |
| `lessons-learned` | **nie** | — | nie |

### STOP — R4
Rodzaj: MERYTORYCZNY  
Powód: dziewięć sekcji boardu nie ma deskryptora, ale dopisanie ich jako nowych kart do katalogu registry tworzyłoby równoległy kanon bez decyzji, czy board-id ma być nową kartą, czy dodatkową przynależnością istniejącego deskryptora.  
Licencja, którą sprawdziłem: `initiativeCardContract.ts` — pełna licencja wyłącznie na dopisywanie deskryptorów i funkcji pomocniczych; niczego nie usunąłem ani nie przestawiłem.  
Dowód: tabela wyżej oraz `INITIATIVE_CANONICAL_CARDS` w `initiativeCardContract.ts:604`.  
Co dostarczyłem ZAMIAST zmiany: pełny inwentarz 24/24 i imienna lista dziewięciu braków.  
Co zrobiłbym, gdyby zapadła decyzja X: po decyzji „osobne deskryptory boardu” dopisałbym dziewięć wpisów addytywnie. Po decyzji „alias/przynależność” rozszerzyłbym istniejące deskryptory, ale to nie jest dozwolone przez dzisiejszą licencję.  
Rekomendacja dla nadzorcy: najpierw rozstrzygnąć SSOT registry-id vs board-id; promień rażenia obejmuje adapter DB→kanon, zestawy kart i walidatory kompletności.  
Stan: zacommitowano wyłącznie pomiar.  
Czy kontynuowałem pozostałe pozycje: TAK — zgodnie z prawem zatrzymania per pozycja.

## Dyżur 338 — R5: własny inwentarz archetypu REKORD

Własny mianownik: **11** wierszy §13.1. Własny licznik kontraktów: **4** (Initiative, Task, Decision, Insight). Wynik: **7 typów bez własnego kontraktu**, nie 8.

| Artefakt bez kontraktu | Ekran / powierzchnia w `src/` | Szacunek osobnego dyżuru | Kolejność |
| --- | --- | --- | ---: |
| KPI | tak — `ResultsVNext/kpiTool/KpiToolPage.tsx`, `ResultsKpiRegistryPage.tsx` | 1 dyżur: kontrakt S + drawer + pomiar realnego rekordu | 1 |
| Idea | tak — `MyWork/IdeaMapWorkspace.tsx`, `IdeaNodeDetailDrawer.tsx` | 1–2 dyżury: wiele równoległych powierzchni, najpierw wskazanie kanonicznej | 2 |
| RAID | nie znaleziono samodzielnego ekranu rekordu; są sekcje osadzone (`RaidSection`, `RaidCanvas`) | 1 dyżur po decyzji o ekranie kanonicznym | 5 |
| Milestone | nie znaleziono samodzielnego ekranu rekordu; są sekcje zadań/kamieni | 1 dyżur po wskazaniu drawera/SSOT | 6 |
| Change Request | brak jednoznacznego samodzielnego ekranu po pełnym skanie nazw | 1–2 dyżury: najpierw osiągalność i źródło danych | 7 |
| Stage Gate | brak jednoznacznego samodzielnego ekranu; są bramki osadzone w Initiative | 1 dyżur po decyzji, czy to rekord, czy sekcja Initiative | 4 |
| Action Proposal | tak — `views/ActionProposalView.tsx`, `components/ai/ActionProposalDetail.tsx` | 1 dyżur: kontrakt S i ujednolicenie dwóch powierzchni | 3 |

Pełne, nieobcięte listy trafień: `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/r5-*.txt`.

### STOP — R5
Rodzaj: MERYTORYCZNY  
Powód: zakres i licencja dyżuru nie obejmują powłok siedmiu innych typów, a dla czterech nie ma jednoznacznego samodzielnego ekranu rekordu.  
Licencja, którą sprawdziłem: sześć zastanych kontraktów jest tylko do odczytu; wszystko inne poza tabelą licencji również tylko do odczytu.  
Dowód: tabela wyżej, 11 wierszy §13.1 i 9 trafień wzorca plików kontraktowych (7 realnych + typ + false positive).  
Co dostarczyłem ZAMIAST zmiany: imienny inwentarz siedmiu luk, osiągalnych powierzchni, estymat i kolejności.  
Co zrobiłbym, gdyby zapadła decyzja X: w jednym dyżurze wykonałbym KPI albo Action Proposal; Idea wymaga najpierw wskazania kanonicznej powierzchni, a RAID/Milestone/Change Request/Stage Gate — decyzji o ekranie rekordu.  
Rekomendacja dla nadzorcy: osobne dyżury w kolejności KPI, Idea, Action Proposal, Stage Gate, RAID, Milestone, Change Request.  
Stan: zacommitowano wyłącznie pomiar.  
Czy kontynuowałem pozostałe pozycje: TAK.

## Dyżur 338 — R6: dwie pułapki wdrożeniowe

### (a) Flaga Decyzji

Teza „Decyzja czyta tylko env + URL” jest obalona na markerze: `DecisionDetailView.tsx:509` zapisuje parametr do `ff.cardContract`, a `:519` odczytuje wspólny klucz. Nowy test wykonuje realne ciało resolvera z widoku: `'1'` → ON, `'0'` → OFF, brak klucza → OFF; 3/3 GREEN. Mutacja gałęzi `'1'` z `return true` na `return false` dała RED imiennie: `ff.cardContract='1' włącza kontrakt`; po cofnięciu przez `cp` 3/3 GREEN i diff widoku pusty. Logi: `/private/tmp/cx-day338-kontrakty-24-sekcji-artefakty/r6-decision-mutacja-{red,green}.log`.

### (b) Zastany `localStorage` — gotowy diff NIENAŁOŻONY

Rekomendowany mechanizm jest niedestrukcyjny: podnieść wersję namespace do `v3-contract` bez kasowania `v2-contract`. Użytkownik dostaje nowy domyślny układ; stary wpis zostaje w przeglądarce i można do niego wrócić przez rollback.

```diff
--- a/src/components/MyWork/TaskDetailView.tsx
+++ b/src/components/MyWork/TaskDetailView.tsx
@@
-    taskCardContractEnabled ? 'v2-contract' : 'v1'
+    taskCardContractEnabled ? 'v3-contract' : 'v1'
--- a/src/components/MyWork/DecisionDetailView.tsx
+++ b/src/components/MyWork/DecisionDetailView.tsx
@@
-    decisionCardContractEnabled ? 'v2-contract' : 'v1'
+    decisionCardContractEnabled ? 'v3-contract' : 'v1'
--- a/src/components/MyWork/NotificationDetailView.tsx
+++ b/src/components/MyWork/NotificationDetailView.tsx
@@
-  const notificationCardLayoutStorageKey = `notification:nmode:card-layout:v2-contract:${notificationId ?? 'new'}`;
+  const notificationCardLayoutStorageKey = `notification:nmode:card-layout:v3-contract:${notificationId ?? 'new'}`;
```

Promień rażenia: wyłącznie zapisane układy kart Task/Decision/Notification przy fladze kontraktu ON; brak zmian backendu i brak kasowania danych. Diffu nie nałożono, bo trzy pliki kontraktów/powłok są w tym dyżurze tylko do odczytu, a zmiana dotyka danych przeglądarkowych ludzi.

## Dyżur 338 — R7: DO DECYZJI WŁAŚCICIELA — nazwy Menu 3 Initiative

| Standard §13.1 (6 nazw) | Produkt dzisiaj (5 grup) |
| --- | --- |
| Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy |

Kadr obecnego, kompletnego stanu za flagą ON: `evidence/kompletnosc-24-sekcji-20260904/r2/on-niepusty.png`.

Czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie: brak decyzji właściciela, czy sześć nazw standardu jest docelową taksonomią Menu 3 wymagającą przegrupowania 24 sekcji, czy warstwą semantyczną, którą wolno mapować na pięć obecnych grup produktu.

## Dyżur 343 — R1: pomiar wejściowy i odtworzenie luki zabezpieczenia

Rekord harnessu: `init-smed-linia-pakowania`; wariant niepusty: `initiativeTemplateId=tpl-quick-win`; każdy przelot odbył się w świeżym kontekście przeglądarki.

| Szablon | Flaga build-time harnessu | Pozycje DOM | Grupy DOM | `localStorage["ff.initiative.sections_complete"]` | Błędy konsoli |
| --- | --- | ---: | ---: | --- | ---: |
| `quick_win` | OFF | 6 | 3 | `null` | 0 |
| `quick_win` | ON | 24 | 5 | `null` | 0 |
| pusty | OFF | 24 | 5 | `null` | 0 |
| pusty | ON | 24 | 5 | `null` | 0 |

Artefakty maszynowe: `/private/tmp/cx-day343-dec388-domkniecie-artefakty/r1-{off,on}-{niepusty,pusty}.json`.

Mutacja A — ponowne filtrowanie wyniku selektora innym wyrażeniem — zostawiła zastany pakiet **GREEN 4/4**, a realny DOM dla `quick_win` + ON spadł do **6 pozycji / 3 grup**. Wyniki: `r1-mutacja-a-test.json`, `r1-mutacja-a-on.json`.

Mutacja B — resolver flagi `void raw; return false` — zostawiła zastany pakiet **GREEN 4/4**, a realny DOM dla build-time ON spadł do **6 pozycji / 3 grup**. Wyniki: `r1-mutacja-b-test.json`, `r1-mutacja-b-on.json`.

Obie mutacje cofnięto przez `cp` z kopii w katalogu scratch; `git diff -- src/components/Initiatives/InitiativeDocumentView.tsx` po każdym cofnięciu był pusty. Werdykt R1: **ZROBIONE — zastane zabezpieczenie nie broni zachowania**.

## Dyżur 343 — R3: deskryptory wszystkich 24 sekcji boardu

Reguła prostego przecięcia id przed zmianą dała **17** braków, ponieważ board i registry używają dwóch przestrzeni nazw. Reguła semantyczna z rejestru 338 dała **9** board-id bez własnego deskryptora; zgodnie z rozstrzygnięciem DEC-388 właśnie te dziewięć dostało osobne, addytywne karty. Katalog wzrósł z 27 do **36** kart; komentarz `buildInitiativeCanonicalCards` został zaktualizowany, a zastanej asercji liczby 27 nie znaleziono.

| Sekcja boardu | Ma deskryptor po R3 | Deskryptor `plik:linia` | Dopisany w dyżurze 343 |
| --- | --- | --- | --- |
| `initiative-definition` | tak | `initiativeCardContract.ts:63` (`OVERVIEW`) | nie |
| `tasks` | tak | `initiativeCardContract.ts:142` | nie |
| `timeline` | tak | `initiativeCardContract.ts:457` | nie |
| `deliverables-milestones` | tak | `initiativeCardContract.ts:603` | **tak** |
| `dependencies` | tak | `initiativeCardContract.ts:504` | nie |
| `decisions` | tak | `initiativeCardContract.ts:160` | nie |
| `risk-raid` | tak | `initiativeCardContract.ts:177` (`RAID`) | nie |
| `gates` | tak | `initiativeCardContract.ts:200` | nie |
| `suggested-changes` | tak | `initiativeCardContract.ts:617` | **tak** |
| `change-log` | tak | `initiativeCardContract.ts:631` | **tak** |
| `target-state-scope` | tak | `initiativeCardContract.ts:103` (`TARGET_STATE`) | nie |
| `kpi` | tak | `initiativeCardContract.ts:259` (`KPIS`) | nie |
| `okr` | tak | `initiativeCardContract.ts:645` | **tak** |
| `hypothesis` | tak | `initiativeCardContract.ts:659` | **tak** |
| `financial-analysis` | tak | `initiativeCardContract.ts:220` | nie |
| `financial-impact` | tak | `initiativeCardContract.ts:241` | nie |
| `team` | tak | `initiativeCardContract.ts:408` | nie |
| `workstream-owners` | tak | `initiativeCardContract.ts:676` | **tak** |
| `raci` | tak | `initiativeCardContract.ts:426` (`GOVERNANCE`) | nie |
| `resources` | tak | `initiativeCardContract.ts:471` | nie |
| `attachments-links` | tak | `initiativeCardContract.ts:522` (`ATTACHMENTS`) | nie |
| `used-in` | tak | `initiativeCardContract.ts:690` | **tak** |
| `artifacts` | tak | `initiativeCardContract.ts:704` | **tak** |
| `lessons-learned` | tak | `initiativeCardContract.ts:718` | **tak** |

Jawna mapa 24/24: `initiativeCardContract.ts:779`; pomiar po zmianie: `board=24`, `mapped=24`, `cards=36`, `missing=[]`. Osiem par kluczy etykiet było już obecnych pod `initiatives.*`; brakujący klucz `initiatives.okr` dopisano równolegle w PL i EN. Liście i18n po zmianie: PL **35199**, EN **33066** — żaden mianownik nie zmalał.

Test `initiativeBoardDescriptors.day343.test.ts` jest GREEN 3/3. Kontrolne usunięcie `LESSONS_LEARNED` z katalogu dało RED z komunikatem `brak nowej karty kanonicznej: lessons-learned`; po cofnięciu przez `cp` wróciło GREEN 3/3.
