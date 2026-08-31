# CODEX DAY 87 — mapa organizacji kart

Data: 2026-08-29  
Baza: `07f87685b0301a01cb81b053125b543950a2555c`  
Gałąź: `codex/day87-mapa-kart-20260829`  
Charakter: statyczna mapa, zero zmian w kodzie, zero testów/DB/zrzutów.

## 0. Wejście i korekty wobec instrukcji

Wynik §0.1 (2), dosłownie:

```text
9dc9f54948 docs(instrukcje): dyzur 87 — mapa organizacji systemu kart przed przebudowa
07f87685b0 docs(instrukcje): dyzur 86 — dlaczego tryb szablonowy wstawia placeholdery zamiast tresci
4516ae944b docs(ledger): DEC-312 — korekta DeckBuildera, naprawa 81 zachowana, C.3 zmierzone
da0360865c merge: dyzur 69 korekta DeckBuildera — 35/35 plikow, naprawa 81 zachowana
c8883f4704 docs: DEC-311 — petla szablon->PPTX domknieta, GEN-4 FAIL -> PARTIAL
1b8040df22 merge: dyzur 83 PASS — petla szablon->PPTX domknieta, eksport 200
9cea4f8c4e docs: DEC-310 sprostowanie — kart jest 61 nie 7; instrukcja 84 poprawiona u zrodla
e251a13207 docs(day83): record first pushed commit
df3756b087 fix(pptx): persist template deck document before export
4546c7ec3e docs(instrukcje): dyzur 84 (karty N odbior graficzny) i 85 (Organizacja pakiet odbioru)
659afb1b90 fix(i18n): domknij polski DeckBuilder
062a26fe4a docs(ledger): DEC-309 — kart N jest 7, nie 40; przeciecie z *Card*.tsx = 0
4df2bb0b89 merge: dyzur 82 — inwentarz kart N: 7 kanonicznych, nie 40
fa3e42f1d1 docs(day82): inventory canonical N cards
65d0f265f7 docs(instrukcje): dyzur 82 (inwentarz kart N) i 83 (eksport PPTX 422)
1e44994196 docs(ledger): DEC-305..308 — Materialy odblokowane, cykl szablonu, grafika 12/18, C.2 domkniete
aa35f13464 merge: dyzur 79 — 6/6 przyczyn, rubryka 7/18 -> 12/18
34b103fc33 merge: dyzur 80 — promocja lifecycle, 403 nadal dla draft
958c09468a merge: dyzur 81 — canvas 487x0 -> 487x584, jedna linia
f3afccb171 merge: dyzur 69 C.2 domkniete — klasa A 1249/1249
2484941144 docs(ledger): DEC-304 — bramki sa wylacznie proceduralne, zadna nie dotyczy tresci
9b49c48ad2 fix(i18n): domknij materialy C2
53ce7de28a docs(materials): record day81 cleanup proof
39e51822d0 docs(day79): report PPT layout repair evidence
241f6c5d45 docs(day80): record lifecycle evidence and residual PPTX stop
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
07f87685b0301a01cb81b053125b543950a2555c
```

Tip uciekł o 1 commit; różnica marker→tip to wyłącznie `INSTRUKCJA_DYZUR_87_MAPA_KART.md`. W1: `cardSets.ts` 609 linii, `useCardLayout.ts` 331 linii. W2: rozkład 14/13/8/6/6/4/3/1 zgodny. W3: 71 `id:` i 61 `group:`. Porty 5959 i 4810 były wolne.

Korekta W4: wskazany `Harvard/wdrozenie-100/_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md` nie istnieje na markerze (`ls: No such file or directory`), a `rg --files Harvard docs | rg '(WZORZEC_N|ARTEFAKTY_MENU|KARTY_DOKUMENTACJA)'` zwraca 0 trafień. Mapę oparto na źródłach kodowych i kontraktach; zgodność z brakującym dokumentem jest `EVIDENCE_MISSING`.

Najważniejsza korekta tezy: `cardSets.ts` nie jest pełnym SSOT działającego systemu 7 artefaktów. Rejestr zawiera 4 z 7 (`insight`, `initiative`, `decision`, `task`); `notification` i `tool` podają własny `spec`, a `interview` podszywa się pod `insight` jako fallback. Kontrakty kanoniczne są dodatkowym, często flagowanym źródłem danych.

## B.1. Katalog `61 z 61`

Poniżej są dokładnie 61 wystąpienia katalogowe z `cardSets.ts`. Pole Render wskazuje komponent/registry, który mapuje identyfikator na UI; dla `comments`/`activity-log` w Insight/Decision/Task render docelowy jest w prawym panelu, mimo że stary katalog nadal je zawiera.

| Artefakt | id | PL | EN | Ikona | Grupa | Render | Builder |
|---|---|---|---|---|---|---|---|
| insight | `artifact-actions` | Dalsze akcje | Next Actions | `Rocket` | `INSIGHT` | `src/components/Interview/InsightViewer.tsx:770-777` | TAK — builder spec |
| insight | `executive-summary` | Podsumowanie | Executive Summary | `Star` | `INSIGHT` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `consulting-readout` | Odczyt konsultingowy | Consulting Readout | `Sparkles` | `INSIGHT` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `themes` | Tematy | Themes | `Layers` | `INSIGHT` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `issues-risks` | Problemy i ryzyka | Issues & Risks | `ShieldAlert` | `INSIGHT` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `opportunities` | Przestrzenie szans | Opportunity Spaces | `TrendingUp` | `INSIGHT` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `people` | Perspektywy | People | `Users` | `BETWEEN THE LINES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `signals` | Sygnały | Signals | `Radio` | `BETWEEN THE LINES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `analysis-matrix` | Macierz Analizy | Analysis Matrix | `BarChart3` | `BETWEEN THE LINES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `consensus-divergence` | Zgoda i rozbieżności | Consensus & Divergence | `GitCompare` | `BETWEEN THE LINES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `implicit-assumptions` | Ukryte założenia | Implicit Assumptions | `Brain` | `BETWEEN THE LINES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `silences` | Przemilczenia | Silences | `EyeOff` | `BETWEEN THE LINES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `evidence-map` | Mapa dowodów | Evidence Map | `MapIcon` | `EVIDENCE` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `candidate-triage` | Wnioski i dowody | Findings & Evidence | `Eye` | `EVIDENCE` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `source-pack` | Źródła | Sources | `Link2` | `EVIDENCE` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `report-pack` | Pakiet raportu | Report Pack | `FileText` | `DELIVERABLES` | `src/components/Interview/InsightViewer.tsx:778-926` | TAK — builder spec |
| insight | `comments` | Komentarze | Comments | `MessageSquare` | `AUDIT` | `src/components/Interview/InsightViewer.tsx:877-882` | TAK — builder spec |
| insight | `activity-log` | Aktywność | Activity Log | `History` | `AUDIT` | `src/components/Interview/InsightViewer.tsx:877-882` | TAK — builder spec |
| initiative | `overview` | Przegląd | Overview | `FileText` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `problemDefinition` | Definicja problemu | Problem Definition | `ShieldAlert` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | TAK — builder karty |
| initiative | `targetState` | Stan docelowy | Target State | `Target` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | TAK — builder karty |
| initiative | `scope` | Zakres | Scope | `Layers` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | TAK — builder karty |
| initiative | `tasks` | Zadania i kamienie milowe | Tasks & Milestones | `CheckSquare` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `decisions` | Decyzje | Decisions | `GitCompare` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `raid` | RAID | RAID | `AlertTriangle` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `gates` | Gotowość bramek | Gate Readiness | `Flag` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `financialAnalysis` | Analiza finansowa | Financial Analysis | `BarChart3` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `financialImpact` | Wpływ finansowy | Financial Impact | `TrendingUp` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | TAK — builder karty |
| initiative | `kpis` | KPI | KPIs | `Gauge` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | TAK — builder karty |
| initiative | `competencyRequirements` | Wymagane kompetencje | Competency Requirements | `GraduationCap` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `skillsGap` | Luki kompetencyjne | Skills Gap | `Users` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `pilot` | Pilotaż | Pilot | `Rocket` | `CONTENT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `comments` | Komentarze | Comments | `MessageSquare` | `AUDIT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `history` | Historia | History | `History` | `AUDIT` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `control` | Kontrola | Control | `Settings` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | TAK — builder karty |
| initiative | `team` | Zespół | Team | `Users` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `timeline` | Oś czasu | Timeline | `Clock` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `resources` | Zasoby | Resources | `Package` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `stakeholders` | Interesariusze | Stakeholders | `Users` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `dependencies` | Zależności | Dependencies | `Link2` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `attachments` | Załączniki | Attachments | `Paperclip` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `tags` | Tagi | Tags | `Tag` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| initiative | `reminders` | Przypomnienia | Reminders | `Bell` | `CONTROL` | `src/components/Initiatives/sections/registry.ts:51-84` | NIE |
| decision | `context-problem` | Zakres decyzji | Decision Scope | `FileText` | `DECISION` | `src/components/MyWork/DecisionDetailView.tsx:1277-1311` | TAK — builder spec |
| decision | `options-tradeoffs` | Opcje i trade-offy | Options & Trade-offs | `GitCompare` | `DECISION` | `src/components/MyWork/DecisionDetailView.tsx:1277-1311` | TAK — builder spec |
| decision | `risk-impact` | Ryzyko i wpływ | Risk & Impact | `ShieldAlert` | `DECISION` | `src/components/MyWork/DecisionDetailView.tsx:1277-1311` | TAK — builder spec |
| decision | `consequences` | Konsekwencje | Consequences | `Clock` | `DECISION` | `src/components/MyWork/DecisionDetailView.tsx:1277-1311` | TAK — builder spec |
| decision | `governance-escalation` | RACI i eskalacja | RACI & Escalation | `Users` | `CONTROL` | `src/components/MyWork/DecisionDetailView.tsx:1277-1311` | TAK — builder spec |
| decision | `comments` | Komentarze | Comments | `MessageSquare` | `AUDIT` | `src/components/MyWork/DecisionDetailView.tsx:1268-1276` | TAK — builder spec |
| decision | `resources-links` | Załączniki i powiązania | Attachments & Links | `Paperclip` | `CONTROL` | `src/components/MyWork/DecisionDetailView.tsx:1277-1311` | TAK — builder spec |
| decision | `activity-log` | Logi aktywności | Activity Log | `History` | `AUDIT` | `src/components/MyWork/DecisionDetailView.tsx:1268-1276` | TAK — builder spec |
| task | `description-scope` | Opis i zakres | Description & Scope | `FileText` | `TASK` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `implementation` | Pomysły realizacji | Implementation Ideas | `Sparkles` | `TASK` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `risk-alternatives` | Ryzyko i alternatywy | Risk & Alternatives | `ShieldAlert` | `TASK` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `checklist` | Lista kontrolna | Checklist | `CheckSquare` | `TASK` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `dependencies` | Zależności | Dependencies | `Link2` | `TASK` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `evidence` | Dowody | Evidence | `Eye` | `TASK` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `governance` | RACI i eskalacja | RACI & Escalation | `Users` | `CONTROL` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `comments` | Komentarze | Comments | `MessageSquare` | `AUDIT` | `src/components/MyWork/TaskDetailView.tsx:2846-2851` | TAK — builder spec |
| task | `attachments-links` | Załączniki i powiązania | Attachments & Links | `Paperclip` | `CONTROL` | `src/components/MyWork/TaskDetailView.tsx:2795-2854` | TAK — builder spec |
| task | `activity-log` | Aktywność | Activity Log | `History` | `AUDIT` | `src/components/MyWork/TaskDetailView.tsx:2846-2851` | TAK — builder spec |

Różnica 71−61: 10 z 71 wystąpień `id:` to identyfikatory zestawów w `sets`, nie karty: Insight `default/full/minimal` (3), Initiative `default/minimal/full` (3), Decision `default/minimal` (2), Task `default/minimal` (2). Mianownik katalogu pozostaje 61 wystąpień.

## B.2–B.3. Artefakty, zestawy i warianty

| Artefakt | Katalog | Źródło aktywne przy fladze OFF / ON | Zestawy | Widoczne domyślnie |
|---|---:|---|---|---:|
| Insight | 18 legacy / 30 kontrakt | `cardSets.ts:88-240` / `insightCardContract.ts:798-824` | OFF: Standard, Deep analysis, Minimal; ON: Core insight, Full | OFF 12 z 18; ON 10 z 30 |
| Initiative | 25 legacy / 27 kontrakt | `cardSets.ts:245-428`; osobna mechanika `InitiativeDocumentView.tsx:8961-8992` | legacy: Standard, Minimal, Full; kontrakt: Rdzeń, Pełny | OFF 24 z 25; ON 7 z 27 kanonicznych, mapowane na board |
| Decision | 8 z 8 | `cardSets.ts:433-506` / `decisionCardContract.ts:271-293` | OFF: Standard, Minimal; ON: Core decision, Full | OFF 8 z 8; ON 4 z 8 |
| Task | 10 z 10 | `cardSets.ts:511-593` / `taskCardContract.ts:357-379` | OFF: Standard, Minimal; ON: Core task, Full | OFF 10 z 10; ON 4 z 10 |
| Interview Session | 8 z 8, tylko kontrakt | `InterviewWorkspace.tsx:1934-1967`; fallback udaje `insight` | Core interview, Full | ON 3 z 8; OFF używa niepoprawnego fallbacku Insight 12 z 18 |
| Notification | 3 z 3, tylko własny spec | `NotificationDetailView.tsx:2479-2492` | Core notification, Full | 2 z 3; layout stosowany tylko gdy flaga ON |
| Tool | 4 z 4, tylko własny spec | `KnownToolDetailView.tsx:1893-1922` | Core method, Full; OFF ma lokalny all-visible | ON 3 z 4; OFF 4 z 4 |

Kolejność kart wszystkich zestawów jest zachowana w artefakcie `/private/tmp/cx-day87-artefakty/sets.tsv` (SHA-256 `649fb4d643f2c820e5eb4b6e60d19d93fad2e065ba41a1ff6bb9488cab092cd5`). To mapa danych, nie wynik dyżuru 84; nie wykonywano zrzutów ani pomiaru wizualnego.

Obejścia typów: Notification usunął cast (`NotificationDetailView.tsx:286-291`). Tool nadal ma `'tool' as unknown as NModeArtifactType` (`KnownToolDetailView.tsx:114-119`) mimo że union zawiera `tool`; komentarz jest nieaktualny. Interview nie używa castu, ale podaje `artifactType: 'insight'` jako inertny fallback (`InterviewWorkspace.tsx:1934-1965`). `NModeArtifactType` ma 6 z 7 typów — brak `interview` (`cardSets.ts:43-49`).

## B.4. Wspólne kontra unikalne

W katalogu legacy jest 61 wystąpień, ale 55 unikalnych identyfikatorów. Wspólne są 3 z 55 unikalnych id i odpowiadają 9 z 61 wystąpień:

- `comments`: 4 z 4 katalogów (`insight`, `initiative`, `decision`, `task`);
- `activity-log`: 3 z 4 (`insight`, `decision`, `task`);
- `dependencies`: 2 z 4 (`initiative`, `task`).

Przyszła przebudowa tego katalogu dotyczy więc 55 bytów identyfikowanych po stringu, nie 61 osobnych nazw. To nadal nie jest globalny mianownik kontraktów: po włączeniu 7 kontraktów występuje 90 pozycji artefaktowych (30+27+8+8+10+3+4), z aliasami i lokalnymi id.

## B.5. Renderowanie, buildery i persystencja

Builder obejmuje 42 z 61 pozycji legacy: wszystkie 18 Insight, 8 Decision i 10 Task przez builder spec artefaktu oraz 6 z 25 Initiative przez `cardSpecBuilders.ts:76-413`. Pozostałe 19 z 61 nie mają jednego z 12 builderów wskazanych w instrukcji. Interview/Notification/Tool mają własne buildery, ale ich 15 pozycji leży poza mianownikiem 61.

| Artefakt | Renderowanie | Persystencja layoutu |
|---|---|---|
| Insight | `InsightViewer.tsx:778-926,3916,7976` | `localStorage`, namespace v1/v2 per insight (`:1405-1448`) |
| Initiative | registry komponentów `sections/registry.ts:51-84`, składanie `InitiativeDocumentView.tsx:6486` | kolejność w `localStorage` (`:2102-2125`); `hiddenSectionIds` tylko stan React (`:730-733,8961-8992`) — widoczność nie jest trwale zapisywana |
| Decision | `DecisionDetailView.tsx:1277-1311` plus prawy panel | `localStorage` per decision (`:1398-1416`) |
| Task | `TaskDetailView.tsx:2795-2854` plus prawy panel | `localStorage` per task (`:4584-4602`) |
| Interview | `InterviewWorkspace.tsx:3217` | `localStorage` per interview (`:1944-1967`) |
| Notification | `NotificationDetailView.tsx:2487-2492` | `localStorage`, ale zapis jest no-op przy fladze OFF (`:2467-2484`) |
| Tool | `KnownToolDetailView.tsx:1918-1922` | `localStorage` per tool (`:1874-1915`) |

`useCardLayout` wywołuje `onLayoutChange` po normalizacji i każdej mutacji (`useCardLayout.ts:171-261`). Żaden z 7 artefaktów nie zapisuje layoutu przez API; 6 z 7 używa `localStorage`, Initiative ma persystencję częściową. W konsekwencji layout nie jest współdzielony między urządzeniami/użytkownikami.

## B.6. Stan i dług

Zgodność wyliczona z jawnego `statusKanonu` kontraktów: 67 z 90 pozycji artefaktowych ma stan `czysta`; 12 z 90 ma `rozjazd`; 11 z 90 ma `do-decyzji-piotra`. Nie jest to zgodność z brakującym plikiem SPEC-N — ta pozostaje `EVIDENCE_MISSING`.

Główne grupy długu:

- Insight: 12 z 30 nieczystych — 3 rozjazdy (merge/etykieta/material-quality) i 9 kandydatów do deduplikacji.
- Initiative: 5 z 27 nieczystych — niespójności registry/seed/klucza RACI oraz placeholder `watchers`.
- Task: 3 z 10 nieczystych. Ostrzeżenie R1 dotyczy `implementation` i `risk-alternatives`: AI generuje ad hoc bez klucza backendu i wpisu w `TASK_SECTION_PROMPTS` (`taskCardContract.ts:120-145`); trzeci rozjazd to globalna rola `dependencies`.
- Interview: 1 z 8 — alias `attachments` renderowany jako `evidence`, kolidujący semantycznie z Task.
- Notification: 2 z 3 — rola AI `executive-summary` i nowe `ai-analysis` do decyzji.
- Decision 8 z 8 i Tool 4 z 4 są `czysta` według własnych deskryptorów.

Katalog bez implementacji: 0 z 61 nie ma żadnego miejsca renderu, ale 6 z 61 (`comments` i `activity-log` w trzech artefaktach) ma przestarzałe położenie w legacy catalog wobec przeniesienia do prawego panelu. Komponenty/sekcje poza katalogiem `cardSets.ts`: co najmniej 29 pozycji kontraktowych netto poza 61-occurrence legacy (90−61), w tym całe Interview/Notification/Tool oraz rozszerzenia Insight/Initiative. To nie są automatycznie sieroty: większość ma własny kontrakt i render.

Martwy/rozszczepiony kod: legacy `INSIGHT_SPEC` jest nazwany martwym mirrorem w `insightCardContract.ts:24-30`; legacy Initiative nie jest konsumowany przez `useCardLayout`; `getCardSpec` ma brak bezpośrednich konsumentów poza hookiem. Karty kontraktowe są za flagami default OFF dla Insight, Initiative, Decision, Task, Interview, Notification i Tool; OFF nie oznacza braku renderu, tylko użycie legacy/all-visible/fallbacku.

Pełna lista 23 nieczystych pozycji wraz z opisami i dowodami: `/private/tmp/cx-day87-artefakty/nonclean.tsv`, SHA-256 `7dd4a4b9e7c28005d9ddd5a36bda19e900a95dee45c788d8d09508750c5d7437`.

## Kryteria i niezweryfikowane

| Kryterium | Stan |
|---|---|
| K1 | ZROBIONE: 61 z 61; 71−61 wyjaśnione |
| K2 | ZROBIONE: 7 z 7 |
| K3 | ZROBIONE: mianowniki OFF/ON i kolejność w artefakcie TSV |
| K4 | ZROBIONE: 61 wystąpień, 55 unikalnych id, 3 wspólne id |
| K5 | ZROBIONE: render/persystencja 7 z 7; builder 42 z 61 |
| K6 | PARTIAL: stan kontraktów 67 z 90; zgodność z brakującym SPEC-N `EVIDENCE_MISSING` |
| K7 | ZROBIONE: `git diff --name-only 07f8768..HEAD` zwraca wyłącznie ten raport; pierwszy commit `08e54f0373` |

Nie uruchamiano pakietów testowych, więc ramka Z33 (a–d) nie ma zastosowania. Pułapkę (e) wyłączono przez budowę mianownika wyłącznie z `cardSets.ts` i eksportowanych kontraktów, nie przez nazwy plików `*Card*.tsx`.

## Artefakty poza repo

- `/private/tmp/cx-day87-artefakty/specs.json` — `02aec38b5a54baef54625920a36ccbd0e3edbc23ebbf87ff15bd1fedc29f3efb`
- `/private/tmp/cx-day87-artefakty/sets.tsv` — `649fb4d643f2c820e5eb4b6e60d19d93fad2e065ba41a1ff6bb9488cab092cd5`
- `/private/tmp/cx-day87-artefakty/nonclean.tsv` — `7dd4a4b9e7c28005d9ddd5a36bda19e900a95dee45c788d8d09508750c5d7437`
- `/private/tmp/cx-day87-artefakty/card-structure-rg.txt` — `e1192e310efb925ee1ad0ff2c6e7b52bc2aa611ffd247aa75eb5b2fdb770cc33`
