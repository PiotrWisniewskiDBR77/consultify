---
doc_id: weekend-decision-register
truth_type: product-target
status: canonical
owner: piotr
last_reviewed: 2026-07-31
---

# Rejestr decyzji weekendu

| ID | Temat | Decyzja | Właściciel | Data | Skutek |
| --- | --- | --- | --- | --- | --- |
| `WK-D-001` | struktura dokumentacji | menu 16 pozycji jest szkieletem funkcjonalnym | Piotr | 2026-07-29 | obowiązuje |
| `WK-D-002` | role wykonawcze | Codex zarządza procesem, Claude implementuje, Piotr odbiera produkt | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-003` | historia repo | brak masowego kasowania bez backupu i manifestu | Piotr/Codex | 2026-07-30 | obowiązuje |
| `WK-D-004` | Canvas | pozostaje NO_GO do pełnego E2E i read-back | Codex | 2026-07-29 | blokuje deklarację gotowości Chat |
| `WK-D-005` | model zespołu | Codex zarządza wyspecjalizowanymi agentami Claude i jest jedynym integratorem | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-006` | strategia wykonania | najpierw scalamy istniejące fragmenty w pionowe flow, dopiero potem budujemy nowe | Piotr/Codex | 2026-07-30 | obowiązuje |
| `WK-D-007` | cel odbioru | stabilny staging z pełnymi golden flows; bez presji deployu produkcyjnego | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-008` | zakres Materials | wszystkie formaty są w zakresie; Excel jest największym strumieniem, generatory szablonów wymagają domknięcia | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-009` | Finance vs Results | Finance posiada modele, założenia i wartości finansowe; Results posiada KPI, pomiary i efekty | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-010` | Initiative golden thread | inicjatywa może być powiązana z Finance i KPI w celu śledzenia realizacji i efektów | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-011` | wzorcowe Tools | pierwszym pełnym golden flow będzie SWOT | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-012` | Canvas | elastyczna przestrzeń współpracy podobna do Canvas Anthropic; duże zaakceptowane wyniki przechodzą do modułów właścicielskich | Piotr | 2026-07-30 | obowiązuje |
| `WK-D-013` | kanał partnerski | powstają dwie oddzielne formuły: Program Poleceń dla osób fizycznych oraz Program Partnerski dla firm, konsultantów i wdrożeniowców; współdzielą mechanikę wiedzy, kodów i rozliczeń, ale mają osobne wejście, warunki i zakres | Piotr | 2026-07-31 | obowiązuje |
| `WK-D-014` | Organization | Organization jest kanoniczną pamięcią i kontekstem biznesowym firmy; administracja należy do Admin/Settings; merytoryka zaakceptowana, a obecny stary shell wymaga proporcjonalnego reskinu i przeglądu nawigacji według kanonu sekcji 2026 | Piotr | 2026-07-31 | obowiązuje; UI polish przed finalnym odbiorem stagingu |
| `WK-D-015` | Meeting — wizja | Teresa docelowo jest aktywnym konsultantem i facilitatorem spotkania wieloosobowego: zadaje pytania, proponuje metody i uruchamia na żywo mapy myśli, whiteboard, flow, Canvas i Notebook; działa na wspólnym ekranie w sali oraz przez integracje z Teams/Zoom/Google Meet, bez budowy własnego audio-video | Piotr | 2026-07-31 | kierunek obowiązuje; rozwój etapowy po podstawowym golden flow |
| `WK-D-016` | Tools vs Assessment vs Audits | Tools to elastyczne metody konsultingowe; Assessment to zamknięte, płatne postępowania rozwoju cyfrowego DRD/SIRI; Audits to odrębny silnik audytów branżowych i organizacyjnych generujący blueprint z normy/instrukcji oraz prowadzący od dowodu do raportu, planu naprawczego, inicjatyw i raportów realizacji | Piotr | 2026-07-31 | obowiązuje; DRD/SIRI i ich raporty należy usunąć z własności Audits |
| `WK-D-017` | Faza Audits | Audits nie wchodzi do MVP; obecnie porządkujemy kontrakt i granice, a pełny silnik audytowy powstanie w drugiej fali rozwoju produktu | Piotr | 2026-07-31 | nie blokuje odbioru MVP; nie uruchamiać pełnej implementacji w bieżącej fali |
| `WK-D-018` | UI/UX Audits | Audits ma wykorzystywać istniejące standardy i komponenty Consultinity dla tabel, preview, Menu 3, wizardów, insightów, arkuszy pytań, dokumentów, raportów i działań; nie budujemy równoległego języka UI | Piotr | 2026-07-31 | każda przyszła funkcja Audits wymaga mapy do kanonicznego wzorca; odstępstwo wymaga jawnej decyzji |
| `WK-D-019` | Materials — produkcja i delivery | Przed produkcją materiału/template Teresa lub okno przedstawia Generation Brief do review; trzy formaty mają wspólny shell/menu i wyspecjalizowane edytory; prezentacje wymagają grafik/layoutów Gamma+; każdy materiał ma viewer, download, share link i kontrolowaną wysyłkę linku/załącznika | Piotr | 2026-07-31 | obowiązuje w golden flows Materials i kanonie generatorów |
| `WK-D-020` | Finance — rozliczenie inwestycji | Samodzielny Investment Case liczy NPV/IRR/ROI/payback bez pełnego modelu przedsiębiorstwa; decyzja zamraża baseline, a po realizacji Finance porównuje go z actual costs i KPI, przelicza opłacalność i tworzy post-investment review | Piotr | 2026-07-31 | obowiązuje; Benefits Realization Ledger spina Finance z Initiative, Execution i Results |
| `WK-D-021` | Finance — wynik analizy | Finance nie ma osobnej zakładki Overview; analiza ma prowadzić do jawnego rozstrzygnięcia, a zatwierdzone wnioski mogą być grupowane i przekazywane jako Initiative Candidate Pack z pełnym lineage, numerical anchors i read-backiem | Piotr | 2026-07-31 | obowiązuje; scalić historyczne ścieżki tworzenia inicjatyw w jeden generator kandydatów |
| `WK-D-022` | Finance — nazwa | Finance jest jedyną nazwą produktową modułu i domeny; nie używamy „Economics” ani „ekonomika” w UI, nowych kontraktach i dokumentacji docelowej, a stare trasy, pliki i identyfikatory pozostają wyłącznie długiem do bezpiecznej migracji | Piotr | 2026-07-31 | obowiązuje; najpierw mapa zależności i kompatybilne przekierowania, potem zmiana nazw w kodzie |
| `WK-D-023` | Results — własność i sens | Results jest warstwą wiarygodnego pomiaru efektów: posiada KPI/OKR, baseline, target, actual, jakość danych, korzyści, odchylenia i corrective loop; ukończenie Initiative lub Execution nie potwierdza automatycznie rezultatu | Piotr | 2026-07-31 | zaakceptowane bez uwag; obowiązuje w scaleniach Results/Benefits/KPI |
| `WK-D-024` | Results — granice | Results dostarcza rzeczywiste KPI i dowody; Finance posiada modele oraz obliczenia finansowe, Execution wykonanie pracy, Initiatives lifecycle zmiany, a Materials publikację | Piotr | 2026-07-31 | obowiązuje; rozdzielić historyczne ROI i Benefits według własności domen |
| `WK-D-025` | Results — KPI i karty wyników | Docelowe KPI można definiować w Initiative, po czym trafiają do rejestru Results; Results wymaga tabeli wielu KPI i wielu kart dla organizacji, działów, procesów, inicjatyw i innych zakresów, a Balanced Scorecard jest tylko opcjonalnym szablonem | Piotr | 2026-07-31 | obowiązuje; pojedyncza karta nie spełnia kontraktu |
| `WK-D-026` | Results — reakcja i eskalacja | Przekroczenie przedziału KPI automatycznie tworzy alert i Deviation Case, powiadamia odpowiedzialną osobę, wymaga KPI Recovery Card oraz eskaluje brak reakcji lub nieskuteczne działania zgodnie z polityką organizacji | Piotr | 2026-07-31 | obowiązuje; notification i My Work są minimalnym kanałem, zamknięcie wymaga effectiveness review |
| `WK-D-027` | Zakres MVP | Do MVP wchodzą Materials, Finance, Results, Execution, Initiatives, Assessment, Tools, Interview, My Work i Chat | Piotr | 2026-07-31 | każdy wymaga stabilnego golden flow na stagingu; Audits i Meeting pozostają poza MVP, a Settings/Admin/SuperAdmin są domykane na końcu jako warstwa platformowa |
| `WK-D-028` | Results — metoda OKR | Teresa prowadzi użytkownika od kontekstu i Objective do mierzalnych Key Results, sprawdza baseline, target, źródło, ownera, rytm, jakość metryki i różnicę między rezultatem a zadaniem; nie zatwierdza OKR samodzielnie | Piotr | 2026-07-31 | obowiązuje; powstaje OKR Definition Brief i metric quality gate |
| `WK-D-029` | Results — widoczność OKR | Cele organizacyjne i zespołowe są domyślnie transparentne, lecz widoczność Objective, KR, wartości i komentarzy jest kontrolowana osobno poziomami Organization/Unit/Participants/Restricted/Executive; cele indywidualne i dane wrażliwe mają węższy dostęp | Piotr | 2026-07-31 | obowiązuje; roll-up nie może ujawnić chronionych danych |
| `WK-D-030` | Execution — wejście do modułu | Pierwszą i domyślną zakładką Execution jest `List`, czyli tabela realizowanych inicjatyw; dashboard, Portfolio i Control Tower są dodatkowymi widokami zarządczymi i nie zastępują listy | Piotr | 2026-07-31 | obowiązuje w architekturze informacji i odbiorze UI |
| `WK-D-031` | Initiatives — wejście do modułu | Pierwszą funkcją i domyślną zakładką Initiatives jest jedna tabela Initiative we wszystkich statusach; statusy są filtrami i zapisanymi widokami tego samego rejestru, nie osobnymi źródłami | Piotr | 2026-07-31 | obowiązuje w architekturze informacji i odbiorze UI |
| `WK-D-032` | Teresa — Initiatives i Execution | AI w Initiatives i Execution tworzy jeden ciągły system: ocenia sens i wykonalność Initiative, przygotowuje decyzję i AI Handoff Snapshot, a następnie w Execution prognozuje, proponuje interwencje i sprawdza ich skuteczność na wspólnym AI Management Case | Piotr | 2026-07-31 | obowiązuje; nie budować dwóch niezależnych copilotów ani zaczynać Execution od pustego kontekstu |
| `WK-D-033` | UI/UX Gate 0 | ujednolicenie UI odbywa się w ramach każdego golden flow, bez osobnego big-bang refaktoru; każda paczka wskazuje component ID, nie tworzy lokalnego forka, nie zwiększa baseline i przechodzi visual/behavioral DoD | Piotr/Codex | 2026-07-31 | obowiązuje we wszystkich siedmiu etapach; Results, Materials i Tools mają pierwszy priorytet migracji |
| `WK-D-034` | Zbiorcze decyzje produktowe | zatwierdzone rekomendacje `A1–A24` i defaulty `D1–D20` z `MASTER_PRODUCT_DECISIONS_FOR_APPROVAL.md`; zakres odłożony nie blokuje MVP, a Excel/Calendar/Deck/Canvas Host wymagają wskazanych POC | Piotr | 2026-07-31 | zamyka etap 1 programu; sprzeczne pytania są rozstrzygnięte przez ten pakiet |

## Otwarte decyzje

| ID | Pytanie | Potrzebne przed |
| --- | --- | --- |
| `WK-OD-001` | jaki wspólny model artefaktu i trybów przyjmujemy dla elastycznego Canvas? | `WK-P0-005` |
| `WK-OD-002` | jaki dokładny zakres SWOT uznajemy za pierwszy kompletny flow? | `TLS-001` |
| `WK-OD-003` | jaka jest kolejność odbioru formatów Materials przy obowiązkowym zakresie all? | `MAT-001` |
| `WK-OD-004` | jak Codex technicznie przydziela i odbiera pracę agentów Claude? | uruchomienie zespołu |

Nowa decyzja musi opisywać alternatywy, powód, skutek i dokumenty zmienione
przez decyzję.
