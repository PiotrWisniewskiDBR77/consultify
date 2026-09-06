# P10 — inwentarz kart N (DEC-411)

Punkt kodu rundy 2: `c163c90a29` po wymaganym scaleniu `codex/m03-admin-20260824` (pomiar 06.09.2026). „Z listy” oznacza nawigację z realnej listy stanowiska lokalnego. Jeżeli rekordu nie ma, runda 2 dopuszcza utworzenie przez kontrakt produktu z zapisaniem ID i obowiązkowym sprzątnięciem.

| karta | karta N | rejestr | komponent | trasa / wejście z listy | realny rekord użyty do pomiaru | kontrakt |
|---|---|---|---|---|---|---|
| action | tak | `action` | `src/components/standard/ActionCard.tsx` | Wyniki → KPI → karta wyniku → Karty działania | brak osiągalnego rekordu na stanowisku | `src/components/standard/ActionCard.types.ts` (model, brak kontraktu sekcji) |
| tool | tak | `tool` | `src/components/DiscoveryTools/KnownToolDetailView.tsx` | `/tools` → biblioteka → metoda | lista publiczna otworzyła się bez sesji; rekord szczegółowy nieosiągalny | `src/components/DiscoveryTools/toolCards.contract.ts` |
| notification | tak | `notification` | `src/components/MyWork/NotificationDetailView.tsx` | `/my-work` → Skrzynka → rekord → Otwórz | „Audyt: gotowość do deploymentu · System · DBR77” | `src/components/MyWork/notificationCardContract.ts` |
| interview | tak | `interview` | `src/components/Interview/InterviewWorkspace.tsx` | `/interview` → Sesje → rekord | lista zwróciła 0 rekordów | `src/components/Interview/interviewCardContract.ts` |
| decision | tak | `decision` | `src/components/MyWork/DecisionDetailView.tsx` | `/my-work` → Decyzje → rekord → Otwórz | „DBR77: Czy włączamy publiczne linki do raportów?”; szczegół utknął na „Ładowanie…” | `src/components/MyWork/decisionCardContract.ts` |
| insight | tak | `insight` | `src/components/Interview/InsightViewer.tsx` | `/interview` → Wnioski → rekord | lista sesji/wniosków nie załadowała rekordu | `src/components/Interview/insightCardContract.ts` |
| task | tak | `task` | `src/components/MyWork/TaskDetailView.tsx` | `/my-work` → Zadania → rekord → Otwórz | „DBR77: Ustawić monitoring i alerting dla backendu”; szczegół utknął na „Ładowanie…” | `src/components/MyWork/taskCardContract.ts` |
| initiative | tak | `initiative` | `src/components/Initiatives/InitiativeDocumentView.tsx` | `/initiatives` → lista/board → rekord | hub utknął na „Ładowanie narzędzi…” | `src/components/Initiatives/sections/initiativeCardContract.ts` + katalog DB |
| note | tak | wyjątek: poza rejestrem | `src/components/MyWork/NotebookContent.tsx` | `/my-work` → Notatnik → „Moje notatki” | lista: „Moje notatki”; nie otwarto strony dokumentu | brak kontraktu |
| idea | tak | wyjątek: poza rejestrem | `src/components/MyWork/IdeaMapWorkspace.tsx` + `panel/IdeaElementInspector.tsx` | `/my-work` → Pomysły → rekord | lista zawiera „AI monitoring jakości” i inne; nie otwarto warsztatu | brak kontraktu |
| metric | tak | wyjątek: poza rejestrem | `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx` | `/results/kpi` → rejestr → miernik | ekran modułu bez załadowanej listy | brak kontraktu karty N |
| objective | tak | wyjątek: poza rejestrem | `src/components/ResultsVNext/okr/OkrObjectiveCardPage.tsx` | `/results/okr` → zestaw OKR → cel | brak osiągalnego rekordu | brak kontraktu karty N |
| roi_case | tak | `roi_case` | `src/components/ResultsVNext/roi/card/RoiCaseCardPage.tsx` | `/results/roi` → rejestr analiz → rekord | do powtórnego pomiaru rundy 2 | sekcje `RoiCaseCardPage.tsx`: Założenia → Wyliczenia → Realizacja |
| plan | tak | `plan` | `src/components/Initiatives/cards/PlanCard.tsx` | `/initiatives` → Plan → zapisany scenariusz | do powtórnego pomiaru rundy 2 | `StandardSekcjaDef[]` w `PlanCard.tsx` (6 sekcji) |
| capacity_analysis | tak | `capacity_analysis` | `src/components/Initiatives/cards/CapacityAnalysisCard.tsx` | `/initiatives` → Obciążenie → zapisana analiza | do powtórnego pomiaru rundy 2 | `StandardSekcjaDef[]` w `CapacityAnalysisCard.tsx` (5 sekcji) |
| audit-criterion | tak | wyjątek: poza rejestrem | `src/components/Audit/method/workspace/v2/CriterionWorkspaceV2.tsx` | `/audit-programs` → program → kryterium | lista utknęła na „Ładowanie audytów…” | brak kontraktu karty N |
| audit-report | tak | wyjątek: poza rejestrem | `src/components/Audit/method/AuditReportDocumentView.tsx` | `/audit-programs` → Raporty → rekord | brak osiągalnego rekordu | brak kontraktu karty N |
| assessment-report | tak | wyjątek: poza rejestrem | `src/components/assessment/AssessmentReportContractView.tsx` | `/assessment` → ocena → output → raport | hub utknął na „Ładowanie narzędzi…” | kontrakt raportu w komponencie, nie `KanonicznaKarta` |
| tool-document | tak | wyjątek: poza rejestrem | `src/components/DiscoveryTools/ToolDocumentView.tsx` | moduł Narzędzia → sesja → output | lista `/tools` była publicznym showcase, nie listą rekordów | brak kontraktu karty N |
| presentation | tak | wyjątek: poza rejestrem | `src/components/Presentations/DeckBuilder.tsx` | `/presentations` → prezentacja | hub utknął na „Ładowanie narzędzi…” | brak kontraktu karty N |
| meeting | tak | wyjątek: poza rejestrem | `src/components/Meeting/MeetingObjectPage.tsx` | `/meetings` → spotkanie | brak danych seeda; hub utknął na „Ładowanie narzędzi…” | brak kontraktu karty N |
| vault-document | tak | wyjątek: poza rejestrem | `src/views/vault/VaultDocumentPanel.tsx` | `/my-work` → Sejf klienta → sejf → dokument | wejście ponowne utknęło na „Ładowanie narzędzi…” | brak kontraktu karty N |

Licznik rundy 2: **22 pozycje inwentarza** (13 rejestr + 9 poza). Rachunek wynika z testu `registry.kompletnosc.test.ts`: 19 pozycji rundy 1 + nowa karta `roi_case` + `plan` + `capacity_analysis`. Pomiar treści i zrzut szczegółu nie jest równoznaczny z samym odnalezieniem komponentu; braki pozostają jawne w `98_RAPORT.md`.
