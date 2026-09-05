---
doc_id: ssot-kregoslup-wartosci
truth_type: product-target
status: canonical
established: 2026-09-05
author: CTO (Fable)
supersedes: docs/program/CROSS_MODULE_FLOWS.md (opis docelowy bez pomiaru kodu)
---

# Kręgosłup wartości — jak obiekt przechodzi przez system

Jedna strona, do której wracamy zamiast tłumaczyć po raz piętnasty, **co powstaje z czego, kto to zatwierdza i czy wynik pamięta źródło**. Powstała jako krok 1 z `docs/program/AUDYT_FORMULY_PRACY_20260905.md` („luki przekrojowe" 1–3). Kolumna **stan w kodzie** pochodzi z pomiaru na `origin/staging` (m03, `888e8a52b9`, 05.09.2026), nie z dokumentacji.

**Łańcuch:** sygnał (Czat · Wywiad · Ocena · Narzędzia · Radar) → **pomysł / notatka** (Moja Praca) → **decyzja** → **inicjatywa** → **działanie / zadanie** (Realizacja) → **wynik** (KPI · OKR · ROI) → **sprawozdanie** (Finanse) → **materiał** (dokument · prezentacja) → **audyt** → **spotkanie** → z powrotem sygnał.

Klasyfikacja: **DZIAŁA** = endpoint zamontowany + wołacz + przycisk na żywym ekranie · **ZA FLAGĄ** = komplet, ale domyślna wartość flagi w kodzie to OFF · **WOŁACZ BEZ EKRANU** = front woła, nic tego nie renderuje · **EKRAN BEZ WOŁACZA** = ekran jest, brakuje wołacza (endpoint-sierota) · **BRAK** = ogniwa nie ma.

## 1. Konwersje (32 przejścia)

| # | z → do | wyzwalacz (kto/co) | co się przenosi | rodowód | zatwierdzenie | Skrzynka? | stan w kodzie |
| :-: | --- | --- | --- | --- | --- | :-: | --- |
| 1 | Czat → pomysł / notatka | człowiek, „Zapisz jako pomysł" `MessageRenderer.tsx:2205` | tytuł, treść wiadomości, tagi | `my_ideas.source_conversation_id`, `source_message_id` (`20260220_my_work_my_ideas.sql:15`) | brak (od razu zapis) | nie | **DZIAŁA** |
| 2 | Czat → dokument / prezentacja (governed) | człowiek, „Propose governed document" `MessageRenderer.tsx:2213` | propozycja + hash treści | `artifact_handoff_proposals/_receipts` (`20260912_claude_c_handoff_spine.sql:51`) | approve/reject `chat.routes.ts:772` | nie | **ZA FLAGĄ** (`ENABLE_V8_GLOBAL` default false) |
| 3 | Sygnał Radaru → moduł | człowiek, karta triażu | payload sygnału | brak tabeli | brak | nie | **WOŁACZ BEZ EKRANU** (`RadarTriageCard.tsx` bez importera) |
| 4 | Wywiad: wniosek → inicjatywa / decyzja / zadanie | człowiek, `InsightViewer.tsx:5580` | wniosek, dowody, cel | `interview_insight_handoffs` (`753_p10…sql:85`) + `initiatives.source_type/source_id` | modal handoffu | nie | **ZA FLAGĄ** (v8) |
| 5 | Wywiad v4: finding → inicjatywa | — | — | — | — | — | **EKRAN BEZ WOŁACZA** (`interview-enterprise.routes.ts:503`) |
| 6 | Ocena: warsztat → promocja | człowiek, po włączeniu „Governance" | ślad promocji (JSON) | `assessments.p28_workbench_v1` (kolumna JSON, nie tabela) | brak | nie | **ZA FLAGĄ** (przełącznik default OFF; cel ≠ inicjatywa) |
| 7 | Raport importowany → inicjatywy | człowiek, `ImportedReportDetailView.tsx:412` | pozycje raportu → inicjatywy | `initiatives.source_type/source_id` (`20260802_asm008…sql:26`) | brak | nie | **DZIAŁA** |
| 8 | Sekcja raportu → inicjatywa | — | — | j.w. | — | — | **WOŁACZ BEZ EKRANU** (`CreateInitiativeModal.tsx` bez importera) |
| 9 | Narzędzie: sesja → Output (artefakt) | człowiek, `SummaryStep.tsx:271` | wersja sesji, konkluzje, hash | `tool_outputs`, `tool_initiative_links` (`946_/948_…sql`) | `status: draft→approved`, `frozen_at` | nie | **DZIAŁA** |
| 10 | Discovery: sesja → projekt + inicjatywy | człowiek, `ProjectConversionModal.tsx:53` | zakres sesji | brak tabeli rodowodu | brak | nie | **DZIAŁA** (trasa `/discovery/canvas` bez wejścia w menu) |
| 11 | Artefakt → artefakt (`/convert`) | — | — | `artifact_conversions` (pełne kolumny źródła) | — | — | **EKRAN BEZ WOŁACZA** (zapisuje się tylko `/record`) |
| 12 | Pomysł → inicjatywa / zadania / decyzja / czat | człowiek, kebab `IdeasTableContent.tsx:1074` | tytuł, treść, wybrane węzły mapy | `my_idea_conversions` (`20260723…sql:17`) + `link_graph_edges` | modal wyboru celu | nie | **DZIAŁA** |
| 13 | Notatka → inicjatywa / zadanie / decyzja / raport / prezentacja / ocena | człowiek, kebab `NotebookHamburgerMenu.tsx:209` | treść strony | `tasks/decisions.source_type/source_id` (`20260311_origin_tracking.sql`) + `notebook_pages.converted_to_json` | bramka treści ≥80 słów | nie | **DZIAŁA** |
| 14 | Notatka → handoff (inicjatywy / radar / Teresa) | — | — | **żaden INSERT** w `notebookHandoffService.ts` | — | — | **BRAK** (4 trasy zamontowane, zero zapisu, zero wołacza) |
| 15 | Pomysł → dokument / prezentacja / arkusz (business case) | człowiek, kafle `MyIdeasListContent.tsx:1618` | brief pomysłu | propozycja → materializacja | decyzja na propozycji `…/decision` | nie | **DZIAŁA** |
| 16 | Pomysł → model finansowy / budżet | — | — | — | — | — | **BRAK** (pozycje „wkrótce", `ideaConvertTargets.ts:178`) |
| 17 | Inicjatywa → przekazanie do Realizacji (handoff) | — | pakiet handoffu | `ie_aggregate_state/_relations` (`932…sql:33`) | `handoff/decisions` | miało być | **WOŁACZ BEZ EKRANU** (kolejki wycofane z `MyWorkHub`) |
| 18 | Sprawa realizacji → zadanie | człowiek, `ExecutionWorkSurface.tsx:602` | tytuł, właściciel, termin | `tasks.initiative_id`, `source_type/source_id` | brak | tak (przydział) | **WOŁACZ BEZ EKRANU** (sprawa powstaje TYLKO z zaakceptowanego handoffu → #17) |
| 19 | Inicjatywa → KPI inicjatywy | człowiek, sekcja KPI karty | nazwa, cel, jednostka | `initiative_kpis`, `initiative_kpi_mappings` | brak | nie | **DZIAŁA** (świat rozłączny z ekranami Wyników `rvn_kpi_*`) |
| 20 | Zamknięcie inicjatywy → korzyść → KPI | serwer (`closureDeliveryReceiptService.ts:515`) | korzyść, wartość | `initiative_benefits` | `benefits/:id/promote` | nie | **WOŁACZ BEZ EKRANU** (`promoteClosureBenefit` bez przycisku) |
| 21 | Pomiar KPI → odchylenie → karta działania → osoba | serwer, w tej samej transakcji co pomiar (`kpiMeasurementCommands.ts:266`) | okres, wartość, próg, RCA | `rvn_kpi_deviation_cases` + `rvn_kpi_corrective_actions` (`20260811…sql:87,151`) | `acknowledge`, zamknięcie sprawy | **TAK** (zdarzenie → `notifications` → materializacja) | **DZIAŁA** |
| 22 | Karta działania → zadanie właściciela | — | — | `kpi_deviation_cases.linked_task_id` | — | — | **WOŁACZ BEZ EKRANU** (`link-task` bez przycisku; pole to surowe „ID właściciela") |
| 23 | Opóźnienie / przeciążenie w Realizacji → działanie | serwer przy odczycie listy sygnałów | sygnał opóźnienia | `delay_signals`, `delay_alert_log` | brak | **nie** (zero `notifications`) | **EKRAN BEZ WOŁACZA** (`create-mitigation-task` bez przycisku) |
| 24 | Sprawozdanie / wycena / business case → kandydat inicjatywy | człowiek, kebab i przyciski Finansów | pozycje, wartości, uzasadnienie | `finance_candidate_handoffs` (`20260802_fin006…sql:32`) z idempotencją | modal handoffu | nie | **DZIAŁA** |
| 25 | Analiza ROI / wycena → inicjatywa (stara trasa) | — | — | — | — | — | **EKRAN BEZ WOŁACZA** (`economics.routes.ts:1899, 2928`; moduł `closed`) |
| 26 | Dane → materiał (Deliverables light) | — | brief | `deliverable_bundles` — **bez kolumny źródła** | — | nie | **ZA FLAGĄ** (`ENABLE_DELIVERABLES_LIGHT` default false, router zwraca 404) |
| 27 | Inicjatywa → raport / prezentacja | człowiek, Materiały | treść z inicjatywy | `v8_output_artifacts.source_initiative_id` (`20260323…sql:14`) | `delivery_state: draft→ready→shared` | nie | **DZIAŁA** (jedyny typ przodka: inicjatywa) |
| 28 | Audyt: niezgodność → działanie naprawcze | człowiek, `RemediationPanel.tsx:94` | tytuł, opis, właściciel, termin, typ | `audit_corrective_actions.finding_id` (`20260813…sql:506`) | `approve` / `reject` | **nie** (zero powiadomień w całym module) | **DZIAŁA** |
| 29 | Działanie audytowe → zadanie / inicjatywa | — | — | `audit_corrective_actions.task_id/initiative_id` | — | — | **EKRAN BEZ WOŁACZA** (`link-task`, `link-initiative` bez wołaczy) |
| 30 | Spotkanie → zadanie w Mojej Pracy | — | punkt działania z notatki | `tasks.source_type='meeting_note_action_item'` (serwis gotowy, z idempotencją) | brak | tak (gdyby powstało) | **EKRAN BEZ WOŁACZA** (`MeetingObjectPage.tsx:754` renderuje `<li>` bez przycisku) |
| 31 | Spotkanie → decyzja w Mojej Pracy | — | — | `meeting_decisions` (własna tabela, rozłączna z `decisions`) | — | nie | **BRAK** (przejścia nie ma) |
| 32 | Powrót do źródła (klikalny rodowód) | człowiek, link w karcie | — | `InitiativeSourceLink.tsx` | — | — | **WOŁACZ BEZ EKRANU** (9 miejsc importuje samą etykietę, komponent nierenderowany) |

**Sumy: DZIAŁA 12 · ZA FLAGĄ 4 · WOŁACZ BEZ EKRANU 7 · EKRAN BEZ WOŁACZA 6 · BRAK 3 (razem 32).** Czyli **20 z 32 konwersji nie jest dziś klikalnych** przez konsultanta, choć 17 z nich ma gotowy backend. Trzy największe luki: (a) **inicjatywa nie przechodzi do Realizacji** (#17→#18 — sprawa powstaje wyłącznie z handoffu, którego nikt nie może wysłać); (b) **karta działania nigdzie nie staje się zadaniem osoby** (#22, #29, #30 — trzy moduły, ten sam brak); (c) **materiał nie pamięta, z czego powstał** (#26, #27 — `deliverable_bundles` bez kolumny źródła, `artifact_lineage_events` bez kolumny przodka).

**Skrzynka dziś przyjmuje wyłącznie trzy rzeczy** (`inboxService.ts:194` — `tasks` przypisane, `decisions` do rozstrzygnięcia, nieprzeczytane `notifications`). Jedyną otwartą bramą jest tabela `notifications`. Wyniki, Inicjatywy, Realizacja, Ocena, Wywiad i Finanse do niej piszą; **Audyty nie piszą wcale**. Finanse i konektory piszą dodatkowo wprost do `canonical_inbox_items` — te wpisy widać tylko przy `ENABLE_V8_GLOBAL=true`.

## 2. Elementy obiektu

Wzorzec: `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §2 (elementy miernika). „Stan w schemacie" = czy kolumna istnieje i w którym pliku migracji.

### 2.1 Pomysł (Moja Praca)
| element | typ | obow. | skąd | gdzie widoczny | stan w schemacie |
| --- | --- | :-: | --- | --- | --- |
| tytuł · treść · tagi | tekst / tekst / lista | tak / nie / nie | użytkownik | lista, podgląd, karta | `my_ideas.title/body/tags` — `755_my_ideas_00base.sql` |
| etap dojrzałości | słownik (`seed`…) | tak | użytkownik | lista (kolumna), karta | `my_ideas.stage`, `maturity_gates_json` — `20260308_/20260810_` |
| obszar · priorytet · potencjał · złożoność | słownik / 0–100 / tekst | nie | użytkownik lub Teresa | podgląd, karta | `my_ideas.area/priority/potential/complexity` — `20260308_` |
| źródło (rozmowa, wiadomość) | referencja | nie | system (z Czatu) | **nigdzie** — brak linku w UI | `source_type`, `source_conversation_id`, `source_message_id` — `20260220_` |
| ślad konwersji (na co zamieniony) | referencja | nie | system | licznik konwersji (nie renderowany) | `promoted_to`, `promoted_entity_id` + `my_idea_conversions` — `20260723_` |
| poufność · folder · ulubione | flaga | nie | użytkownik | lista | `confidentiality`, `folder_id`, `is_favorite` — `20260810_/20260602_` |

### 2.2 Decyzja
| element | typ | obow. | skąd | gdzie widoczny | stan w schemacie |
| --- | --- | :-: | --- | --- | --- |
| tytuł · opis · typ | tekst / tekst / słownik | tak / nie / tak | użytkownik | lista Decyzji, karta N `DecisionDetailView` | `decisions.title/description/type` — `20260311_origin_tracking.sql:11` |
| decydent · termin · termin eskalacji | osoba / data / data | tak / nie / nie | użytkownik | lista, Skrzynka (sekcja „Do rozstrzygnięcia") | `decision_maker_id`, `deadline`, `escalation_deadline` |
| warianty · kryteria | lista / tekst | nie | użytkownik lub Teresa | karta | `options`, `criteria` |
| rozstrzygnięcie · uzasadnienie · data | wybór / tekst / data | przy zamknięciu | użytkownik | karta, historia | `selected_option`, `decision_rationale`, `decided_at` |
| **skutek decyzji** (co się stało dalej) | referencja | — | — | **brak** | **BRAK KOLUMNY** — luka formuły „cyklu decyzji" |
| źródło · powiązania | referencja | nie | system | brak linku w UI | `source_type/source_id`, `initiative_id`, `task_id` |

### 2.3 Inicjatywa
| element | typ | obow. | skąd | gdzie widoczny | stan w schemacie |
| --- | --- | :-: | --- | --- | --- |
| nazwa · streszczenie · hipoteza · problem | tekst | nazwa tak | użytkownik / Teresa | lista, podgląd, karta (24 sekcje) | `initiatives.name/summary/hypothesis/problem_statement` — `000_z_core_baseline.sql:217` |
| oś · obszar · etap · status | słownik | tak | użytkownik | lista (kolumny), kanban | `axis`, `area`, `current_stage`, `status` |
| właściciel biznesowy · wykonawczy · sponsor | osoba | tak | użytkownik | lista, karta | `owner_business_id`, `owner_execution_id`, `sponsor_id` |
| CAPEX · OPEX · oczekiwany ROI | liczba | nie | użytkownik / Finanse | karta, Wyniki | `cost_capex`, `cost_opex`, `expected_roi` |
| zakres w/poza · ryzyka · kryteria sukcesu · produkty | listy | nie | użytkownik | karta | `scope_in/out`, `key_risks`, `success_criteria`, `deliverables` |
| rodowód (skąd powstała) | referencja | nie | system | etykieta bez linku (#32) | `source_type/source_id`, `source_assessment_id`, `created_from`, `evidence_refs_json` |
| KPI inicjatywy | lista referencji | nie | użytkownik | sekcja KPI karty | `initiative_kpis`, `initiative_kpi_mappings` — **rozłączne z `rvn_kpi_*`** |

### 2.4 Działanie — KARTA DZIAŁANIA (wzorzec z arkusza właściciela)
| element (słowa właściciela) | typ | obow. | skąd | gdzie widoczny | stan w schemacie |
| --- | --- | :-: | --- | --- | --- |
| miesiąc / okres | okres | tak | system (z pomiaru) | wiersz raportu, karta | `rvn_kpi_deviation_cases.period_start/end` — `20260811…sql:87` |
| cel osiągnięty? | tak/nie | tak | system | kolor wiersza | pośrednio `severity` (`AMBER`/`RED`) — brak jawnego pola |
| działania wymagane? | tak/nie | tak | system | ikona przy wierszu | **BRAK KOLUMNY** |
| opis problemu | tekst | tak | Teresa proponuje, człowiek zatwierdza | karta działania | `deviation_summary` |
| główna przyczyna | tekst | tak | człowiek (Teresa podpowiada) | karta działania | `rca_text` |
| opis działania | tekst | tak | człowiek | karta działania | `rvn_kpi_corrective_actions.title/description` |
| odpowiedzialność | osoba | tak | człowiek | karta, Skrzynka właściciela | `owner_user_id` — **dziś surowe ID w polu tekstowym** (`KpiDeviationCaseSubview.tsx:844`) |
| termin | data | tak | człowiek | karta, SLA Skrzynki | `due_date` |
| komentarz | tekst | nie | człowiek | karta, historia | `resolution_notes` (tylko na sprawie, nie na działaniu) |
| status OTWARTY / ZAMKNIĘTY | słownik | tak | człowiek | karta, raport | `status` (case: 6 wartości; action: `OPEN/DONE/CANCELLED`) |

### 2.5 Spotkanie
| element | typ | obow. | skąd | gdzie widoczny | stan w schemacie |
| --- | --- | :-: | --- | --- | --- |
| tytuł · termin · miejsce | tekst / daty / tekst | tak | użytkownik | lista, podgląd | `meetings.title/start_at/end_at/location` — `20260623_meetings_baseline.sql:25` |
| uczestnicy · agenda · materiały przed | listy JSON | nie | użytkownik | karta spotkania | `attendees_json`, `agenda_json`, `pre_read_json` |
| decyzje | lista obiektów | nie | człowiek lub Teresa z notatki | karta spotkania | `meeting_decisions` (`statement`, `rationale`, `decided_by`, `source_note_id`) — `20260826_` |
| punkty działania | lista | nie | Teresa z notatki | karta — **jako tekst, bez przycisku** | `meeting_follow_ups` + gotowy funnel do `tasks` (#30) |
| źródło (transkrypcja / nagranie) | referencja | nie | — | — | **niezdecydowane** (luka z audytu formuły) |

### 2.6 Dokument / prezentacja (Materiały)
| element | typ | obow. | skąd | gdzie widoczny | stan w schemacie |
| --- | --- | :-: | --- | --- | --- |
| typ wyjścia (raport / prezentacja) | słownik | tak | użytkownik | biblioteka | `v8_output_artifacts.output_type` — `20260323…sql:6` |
| stan dostarczenia | słownik 7 wartości | tak | system | biblioteka, karta | `delivery_state` (`draft`…`archived`) |
| szablon | referencja | nie | użytkownik | kreator | `template_family_ref` |
| **źródło (z czego powstał)** | referencja | powinno | system | brak linku w UI | `source_initiative_id` — **tylko inicjatywa**; `deliverable_bundles` bez kolumny; `artifact_lineage_events` bez kolumny przodka |
| wersje · eksport · udostępnienia | zdarzenia | — | system | historia (nierenderowana) | `artifact_lineage_receipts/_events` — **zero wołaczy w `src/`** |
| publikacja (kto, kiedy, komu) | zdarzenie | powinno | — | — | **BRAK FORMUŁY** (luka 4 audytu formuły) |

## 3. Zasada: jedna karta działania, jedna Skrzynka

**Zasada CTO (obowiązuje od 05.09.2026, bez pytania do właściciela — mandat CTO):**
1. **Karta działania jest JEDNYM komponentem wspólnym** `src/components/standard/ActionCard*`, z polami z §2.4, używanym przez Wyniki, Realizację, Audyty i Finanse. Żaden moduł nie buduje własnej karty działania — tak samo, jak żaden nie buduje własnej tabeli (`StandardTable`).
2. **Serwer ma jedną tabelę działań** (migracja addytywna; istniejące tabele zostają i są do niej rzutowane), z jednym kluczem źródła: `source_kind` (`kpi_deviation` · `execution_delay` · `audit_finding` · `finance_variance` · `meeting_action`) + `source_id`.
3. **Skrzynka Mojej Pracy jest JEDYNYM odbiornikiem zgłoszeń.** Każde „coś jest źle → ktoś ma działać" kończy się wpisem w Skrzynce właściciela działania. Zapis wprost do `canonical_inbox_items` z pominięciem `notifications` jest zakazany (dziś robią to Finanse i konektory — do sprowadzenia na jedną drogę).
4. Karta działania dołącza jako **ósma karta N** do `src/components/standard/registry.ts` (dziś 7: tool · initiative · insight · interview · decision · notification · task) — spójnie z `DEC-2026-09-03-381`.

**Pomiar dzisiejszego rozproszenia (05.09):** 163 pliki w `src/` i `server/src/` mówią o „karcie działania" (`actionCard|action_item|ActionItem|karta działania|corrective`). W tym: **8 osobnych komponentów** karty/panelu działania (`AIChat/AIActionCard`, `AIChat/Actions/AIActionCard`, `Chat/ChatActionCard`, `Audit/…/RemediationPanel`, `MyWork/DefinitionRemediationQueue`, `MyWork/Executive/ActionRequiredStrip`, `MyWork/notebook/ActionItemsPanel`, `ResultsVNext/kpiTool/KpiDeviationCaseSubview`) — z czego **3 nie mają ani jednego importera** (`ChatActionCard` tylko re-eksport w barrelu, `DefinitionRemediationQueue`, `ActionItemsPanel`). Po stronie bazy: **14 rodzin tabel** o tej samej roli (`kpi_deviation_cases/_actions`, `rvn_kpi_deviation_cases/_corrective_actions`, `rvn_kpi_recovery_actions`, `kpi_recovery_actions`, `v8_deviation_records`, `audit_corrective_actions`, `assessment_capa_actions` — bez wołacza we froncie, `multi_framework_audit_actions`, `execution_action_registry`, `radar_actions`, `case_workspace_action_proposals`, `change_coaching_actions`, `customer_playbook_actions`, `meeting_follow_ups`).

Paczka wykonawcza: `docs/program/PROGRAM_NAPRAWCZY_20260905/P9_KREGOSLUP_I_KARTA_DZIALANIA.md`.

## 4. Jedyne pytanie do właściciela

**Po zdjęciu Projektów (sekcja I `MVP_BACKLOG_20260905.md`) — czy inicjatywy grupujemy w cokolwiek (program / portfel), czy MVP działa na płaskiej liście?**

**Rekomendacja CTO: płaska lista na MVP, grupowanie przez etykietę „obszar", program/portfel dopiero po MVP.** Uzasadnienie z pomiaru: (a) `initiatives.area` i `axis` już istnieją i są wypełniane, więc grupowanie w tabeli można dać dziś bez migracji i bez nowego obiektu; (b) każdy nowy poziom hierarchii mnoży ekrany (rejestr programu, karta programu, agregacja KPI) — a 20 z 32 konwersji kręgosłupa jest dziś nieklikalnych, więc poziom wyżej nie ma czego agregować; (c) `project_id` zostaje w schemacie jako pole opcjonalne, więc powrót do grupowania w fali 2 nie wymaga cofania. Do czasu odpowiedzi obowiązuje rekomendacja.
