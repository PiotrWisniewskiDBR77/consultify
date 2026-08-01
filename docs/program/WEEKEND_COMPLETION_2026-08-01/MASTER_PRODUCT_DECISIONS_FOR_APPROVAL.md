---
doc_id: master-product-decisions-for-approval
truth_type: product-target
status: APPROVED
owner: Piotr Wisniewski
prepared_by: Codex
last_reviewed: 2026-07-31
approved_by: Piotr Wisniewski
approved_at: 2026-07-31
---

# Zbiorczy rejestr decyzji do zatwierdzenia

> **APPROVED:** Piotr zatwierdził uruchomienie siedmiu kroków 2026-07-31. Rekomendacje `A1–A24` i defaulty `D1–D20` obowiązują; wyjątek wymaga nowej jawnej decyzji.

## 1. Jak zatwierdzamy

To jest skonsolidowana lista decyzji, które realnie wpływają na MVP albo architekturę. Powtarzające się pytania z dokumentów zostały połączone. Decyzje techniczne, bezpieczeństwa i bezpieczne defaulty otrzymują rekomendację Codexu; Piotr nie musi projektować ich od zera.

Najprostsza odpowiedź właściciela może brzmieć: **„zatwierdzam rekomendacje A1–A24”** oraz wskazać wyłącznie wyjątki.

## 2. Decyzje blokujące MVP — rekomendacje

| ID | Obszar | Rekomendowane rozstrzygnięcie | Uzasadnienie / skutek |
| --- | --- | --- | --- |
| `A1` | nazwa Canvas | pozostaje `Canvas` | rozpoznawalna nazwa i zgodność z benchmarkiem; Workspace oznacza szerszy shell |
| `A2` | model artefaktu | jeden envelope `Artifact` z typem Document/Deck/Workbook/Canvas/Report, wersją, statusem, ownerem, źródłami i approval | wspólne lifecycle bez udawania jednego edytora |
| `A3` | edycja approved artifact | każda zmiana tworzy nowy draft/version; zatwierdzonej wersji nie nadpisujemy | audytowalność i bezpieczny rollback |
| `A4` | approval deliverable | jawny reviewer; autor może zatwierdzić tylko w profilu lightweight bez client-facing/high-risk | prosty default i możliwość governance enterprise |
| `A5` | public sharing | domyślnie OFF dla nowego tenantu; link jawnie tworzony z expiry i możliwością revoke | bezpieczny standard |
| `A6` | Materials kolejność | Workbook/Excel → Document → Deck → PDF/export consistency | Excel jest największą luką; wspólny artifact envelope powstaje przed kolejnymi formatami |
| `A7` | technologia Excel | gotowy do komercyjnego SaaS grid + silnik formuł po osobnym license/POC gate; ExcelJS pozostaje I/O | nie budujemy własnego Excela; wybór produktu dopiero po benchmarku licencji i integracji |
| `A8` | Finance Investment Case | jest funkcją Finance, nie osobną zakładką głównego menu; może działać bez pełnego modelu firmy | zgodne z wcześniejszą decyzją i minimalizuje IA |
| `A9` | Results/KPI visibility | Organization/Unit/Project/Participants/Restricted/Executive; osobno widoczność celu, wartości i komentarzy | przejrzystość bez ujawniania danych chronionych |
| `A10` | KPI recovery | alert → Deviation Case → owner response → Recovery Card → escalation → effectiveness review | wynik musi uruchamiać zarządzanie, nie tylko dashboard |
| `A11` | Initiative minimal gate | problem/outcome, owner, sponsor albo approver, kompletność, wykonalność, zasoby high-level, KPI/benefit hypothesis, risks/dependencies oraz go/no-go | najmniejszy pakiet umożliwiający odpowiedzialne wejście do Execution |
| `A12` | mała inicjatywa | dopuszczamy profil lightweight z mniejszą liczbą kart, ale z ownerem, wynikiem, terminem, ryzykiem i approval | nie przeciążamy małych zmian |
| `A13` | wariant do nothing | obowiązkowy dla dużych/strategicznych Investment Cases; rekomendowany, nie obowiązkowy dla lightweight | właściwa analiza alternatyw bez biurokracji |
| `A14` | initiative go/no-go | domyślnie Project Owner rekomenduje, Sponsor/Approver zatwierdza; lightweight może łączyć role | separation of duties tam, gdzie ma wartość |
| `A15` | rebaseline/closure Execution | Project Manager proponuje, Project Owner zatwierdza; Sponsor zatwierdza zmianę strategiczną/budżetową | prosta hierarchia z eskalacją wpływu |
| `A16` | Assessment MVP | jeden pełny DRD golden flow; SIRI i ADMA zachowują kontrakty/knowledge packs, ale nie blokują stagingu | dowód wspólnego silnika bez pozornej kompletności trzech metod |
| `A17` | Tools MVP | pełny SWOT: Library → Session → Quality Review → immutable Output → Report → Initiative Candidates | wcześniej wybrany wzorzec i pełny wspólny lifecycle |
| `A18` | Interview approval | respondent odpowiada z pomocą Teresy → quality check → manager/reviewer accept albo return; po akceptacji insight/initiative generators | odpowiada uzgodnionemu procesowi |
| `A19` | My Work external sync | MVP: stabilny wewnętrzny Inbox/Calendar plus jeden provider calendar; e-mail/Teams/Slack po stabilnym core | ogranicza ryzyko integracyjne; connector platform pozostaje gotowa na rozszerzenia |
| `A20` | Chat model choice | użytkownik wybiera tryb jakości/czasu/kosztu; konkretny model widoczny opcjonalnie dla advanced/admin | Teresa ma być produktem, nie panelem providerów |
| `A21` | private chat | wyłącza pamięć organizacyjną i zapis nowych learned preferences; nadal podlega minimalnym logom bezpieczeństwa/retencji | oczekiwana prywatność bez utraty compliance |
| `A22` | Canvas materialization MVP | co najmniej Document, Initiative Candidate, Note i Table/Workbook; Deck jako następny, jeśli generator przejdzie gate | pokrywa główne handoffy bez rozpraszania runtime |
| `A23` | UX | Gate 0: migracja przy golden flows, bez big-bang; baseline wyłącznie maleje | już wpisane jako `WK-D-033` |
| `A24` | staging autonomy | Teresa może samodzielnie wykonywać wyłącznie read i reversible low-risk draft operations; writes biznesowe wymagają approval | stabilny staging i jasny trust model |

## 3. Rekomendowane defaulty — nie powinny wymagać czasu właściciela

Jeśli Piotr nie zgłosi wyjątku, przyjmujemy:

| ID | Default Codexu |
| --- | --- |
| `D1` | nazwa UI `Finance`; techniczne `Economics` pozostaje tylko jako dług kompatybilności |
| `D2` | statusy encji pochodzą z jednego enum/state machine właściciela domeny; widoki są projekcjami, nie kopiami danych |
| `D3` | każda downstream Initiative powstaje najpierw jako Candidate Draft z lineage |
| `D4` | AI nie łączy prywatnego Vaultu z wiedzą ogólną bez jawnego wskazania; wynik biznesowy wymaga citations |
| `D5` | nowy dokument jest prywatny, chyba że utworzono go jawnie w aktywnym projekcie |
| `D6` | admin nie czyta prywatnego Vaultu; break-glass tylko Superadmin/support według kontrolowanej procedury |
| `D7` | integracje używają minimalnych scopes; org policy w Admin, osobisty OAuth w Settings |
| `D8` | zakończenie członkostwa natychmiast odbiera tokeny/sesje, a ownership obiektów firmowych jest przenoszony |
| `D9` | `completed_with_errors` wymaga manual review przed business acceptance |
| `D10` | Run Agent na stagingu używa uczciwego linear engine z condition/sub-process; pełny DAG/parallel/foreach później |
| `D11` | Run Agent failure policy: fail-fast dla zależnego ciągu, continue dla jawnie niezależnych gałęzi |
| `D12` | AI/model selection jest centralną policy z możliwością ograniczonego override, nie dowolnością każdego blocka |
| `D13` | high-impact approvals zawsze mają separation of duties; low-risk może być konfigurowalne |
| `D14` | telemetria nie służy do rankingu pracowników ani cross-tenant learning bez osobnej podstawy i anonimizacji |
| `D15` | Settings osobiste nie mogą rozszerzyć limitów Admina; pokazujemy effective setting i źródło dziedziczenia |
| `D16` | `Consultant` jest rolą aplikacyjną oraz może mieć ograniczoną rolę projektową; sama etykieta nie daje dostępu |
| `D17` | Command Center staje się Overview/Trust summary z linkami, bez drugiej edycji tych samych polityk |
| `D18` | Health widzi Technical/Integration Admin oraz Owner; nie każdy delegowany admin |
| `D19` | billing MVP: plan, usage, seats, invoices i budżety; realne zmiany płatności tylko jeśli obecny provider przejdzie E2E |
| `D20` | API keys organizacyjne są w Admin; osobiste developer tokens tylko po jawnej capability i policy |

## 4. Świadomie odłożone — nie blokują MVP

- pełny Audits engine oraz Meeting jako aktywny uczestnik Teams/Zoom/Meet;
- zaawansowany Run Agent: parallel, foreach, custom HTTP/MCP blocks, autonomy level 3 i hotfix procesu w locie;
- publiczne profile poza Partner Portalem;
- zaawansowane ethical walls, legal hold, watermark i enterprise retention packs;
- wielu zewnętrznych providerów Inbox/Calendar naraz;
- realtime współedycja wszystkich typów artefaktów na wielu urządzeniach;
- automatyczne głosowania spotkań i speaker recognition;
- pełne personal templates ustawień;
- autonomiczne działania korygujące po KPI bez approval.

Odłożenie oznacza: kontrakt zachowujemy, nie budujemy atrapy i nie pokazujemy funkcji jako gotowej.

## 5. Decyzje wymagające osobnego krótkiego POC, nie intuicji

1. **Excel stack** — license/cost, bundle, formuły, collaboration, import fidelity i integracja z obecnym schema.
2. **Pierwszy calendar provider** — wybór na podstawie aktualnych connectorów i kont demo.
3. **Deck renderer/layout engine** — dowód jakości Gamma+ na reprezentatywnych slajdach.
4. **Canvas Artifact Host** — minimalny spike Document + Table + Initiative handoff.

Codex przygotowuje rekomendację techniczną po POC; Piotr zatwierdza koszt i kierunek.

## 6. Po zatwierdzeniu

Po akceptacji:

1. decyzje `A1–A24` i defaulty `D1–D20` trafiają do `DECISION_REGISTER.md`;
2. sprzeczne pytania w dokumentach są oznaczane `RESOLVED_BY` zamiast ręcznie przepisywane bez śladu;
3. powstaje audyt spójności modułów oparty już na zamkniętym języku;
4. każde nowe pytanie musi wskazywać, dlaczego istniejące decyzje go nie rozstrzygają.
