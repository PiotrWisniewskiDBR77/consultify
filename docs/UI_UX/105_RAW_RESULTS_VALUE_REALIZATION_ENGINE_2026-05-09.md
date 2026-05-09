---
uiux_doc_id: UIUX_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Results & Value Realization Engine (2026-05-09)

Poniżej: surowe założenia autora (produkt + architektura) wklejone **verbatim**.

---

## VERBATIM

Teraz wymagania co do modułu resultes czyli do KPI i zarzdzania wynikami Consultify Results & Value Realization Engine
Dokumentacja produktowo-architektoniczna modułu KPI, ROI i dowodzenia wartością transformacji
1. Executive summary
Consultify Results & Value Realization Engine powinien być centralnym systemem dowodzenia rezultatami transformacji. To nie jest „ładny dashboard KPI”. To jest mechanizm odpowiedzialności za efekt biznesowy.
Moduł ma zamykać pętlę:
initiative → KPI → baseline → target → execution → actual → deviation → explanation → corrective action → realized ROI → reconciliation → verified result → report
Problem, który ten moduł rozwiązuje, jest bardzo poważny: większość organizacji umie uruchamiać inicjatywy, taski, warsztaty, prezentacje i projekty, ale dużo gorzej potrafi później odpowiedzieć na pytanie:
Czy to naprawdę przyniosło wartość biznesową?
W Digital Pathfinder transformacja jest opisana jako proces, który musi prowadzić do konkretnych działań, inicjatyw i efektów ekonomicznych, a nie tylko do deklaracji lub jednorazowego projektu. Szczególnie ważne jest tam podejście: analiza stanu, lista inicjatyw, plan wdrożenia i estymacja efektów ekonomicznych transformacji.
Dlatego Consultify Results powinien łączyć:
inicjatywy,
KPI,
ROI,
baseline,
target,
actual,
odchylenia,
business case,
planned / forecast / realized / verified benefit,
evidence,
reconciliation z finansami,
approvale,
taski naprawcze,
decyzje,
raporty KPI i ROI,
AI insight,
audit trail,
source traceability,
executive cockpit dla CEO/CFO/PMO.
Najważniejsza decyzja produktowa: nie budujemy kolejnego BI dashboardu. Budujemy AI-native value realization system.
2. Benchmark rynku — wnioski z researchu
Rynek jest podzielony na kilka klas narzędzi. Każda klasa rozwiązuje fragment problemu, ale prawie żadna nie zamyka całej pętli wartości transformacji.
2.1. BI / dashboard tools
Power BI Goals / Scorecards
Microsoft opisuje Power BI scorecards jako narzędzie do śledzenia celów biznesowych, poprawy widoczności, odpowiedzialności i alignmentu zespołów. System pozwala tworzyć scorecardy, cele, subcele, tracking cycle, check-iny, notatki i statusy. Power BI pozwala też automatyzować status goal na podstawie reguł zależnych od wartości, procentu realizacji celu lub dat.
Wniosek dla Consultify:
Power BI dobrze pokazuje metryki i cele, ale nie jest naturalnie systemem zarządzania transformacją. Brakuje mu natywnego modelu: inicjatywa → KPI → ROI → evidence → corrective action → verified value.
Tableau Pulse
Tableau Pulse dostarcza spersonalizowane insighty dotyczące metryk, wysyłane między innymi przez Slack i email. Potrafi wykrywać drivers, trends, contributors i outliers, a następnie opisywać je językiem naturalnym.
Wniosek dla Consultify:
Tableau Pulse jest dobrym wzorcem dla AI insightów. Consultify powinien jednak iść dalej: insight nie kończy się komentarzem, tylko tworzy task, decyzję, escalation albo zmianę business case’u.
Looker
Looker ma mocny wzorzec semantic layer: metryki mogą być definiowane raz i wykorzystywane w wielu miejscach, co wzmacnia governance, bezpieczeństwo i zaufanie do danych. Looker ma też alerty na dashboardach, które sprawdzają warunki i informują użytkowników.
Wniosek dla Consultify:
Consultify potrzebuje własnego KPI Definition Engine i lekkiej warstwy semantycznej KPI. Bez tego różne raporty będą liczyć ten sam KPI inaczej.
Klipfolio / PowerMetrics
Klipfolio komunikuje się jako narzędzie KPI i dashboardów, z metrykami, celami, powiadomieniami, dashboardami i konektorami danych. PowerMetrics rozróżnia cele recurring i threshold.
Wniosek dla Consultify:
Dobre KPI tools pokazują target i trend. Consultify musi dodać element, którego zwykle brakuje: czy KPI jest powiązany z inicjatywą i czy efekt został finansowo potwierdzony.
2.2. OKR / strategy execution tools
Cascade
Cascade pozycjonuje się jako strategy execution platform, która łączy plany, metryki, alignment, dashboardy i automatyczne śledzenie postępu inicjatyw.
Wniosek dla Consultify:
Cascade jest blisko logiki strategia → execution → metrics. Consultify powinien przejąć logikę alignmentu, ale dodać consultingowe evidence, reconciliation, ROI i audyt wartości.
Quantive
Quantive Results wspiera OKR management, alignment, goal tracking, check-iny i performance analysis. Check-iny są używane jako mechanizm rozmowy o postępie i odpowiedzialności.
Wniosek dla Consultify:
KPI review w Consultify powinien działać podobnie jak check-in, ale bardziej rygorystycznie: wartość actual, komentarz ownera, source, evidence, approval status.
Profit.co
Profit.co łączy OKR authoring, alignment, dashboards, real-time progress tracking i AI agents automating reporting. Ma też wzorzec alignmentu KPI i inicjatyw.
Wniosek dla Consultify:
Profit.co pokazuje, że rynek idzie w kierunku AI-assisted execution. Consultify powinien jednak odróżnić „progress” od „business value”. Postęp tasków nie jest jeszcze efektem finansowym.
WorkBoard
WorkBoard opisuje się jako system of record dla strategy and goals z AI agents przyspieszającymi execution.
Wniosek dla Consultify:
Dla Consultify ważny jest koncept „system of record”, ale dla rezultatów transformacji. Results ma być systemem prawdy o wartości, nie tylko miejscem raportowania celów.
2.3. PMO / portfolio / strategic portfolio management
ServiceNow Strategic Portfolio Management
ServiceNow SPM ma pomagać organizacjom alignować pracę ze strategią, optymalizować business outcomes i „deliver more value, not just more output”. Investment Funding pozwala planować i zarządzać inwestycjami oraz alokować środki do business units, produktów i zespołów.
Wniosek dla Consultify:
To ważny benchmark, bo mówi językiem outcome/value. Consultify musi być lżejsze, bardziej consultingowe i AI-native, ale powinno przejąć logikę: portfolio, funding, outcomes, value, status, governance.
Planview
Planview pozycjonuje się jako strategic portfolio management i product delivery platform. Wskazuje na roadmaps, dependencies, financials, funding, capacity i portfolio governance.
Wniosek dla Consultify:
Planview jest ciężką platformą enterprise. Consultify powinien oferować lżejszy, szybszy Results Engine dla transformacji, konsultingu i programów zmian.
Smartsheet Control Center
Smartsheet Control Center pozwala standaryzować rollout projektów, portfolio reporting, dashboardy i global updates dla wielu projektów.
Wniosek dla Consultify:
Warto skopiować wzorzec „blueprint + portfolio roll-up”. Results powinien pozwalać zdefiniować szablon KPI/ROI dla typu inicjatywy, a potem automatycznie stosować go do wielu podobnych inicjatyw.
Asana Goals / Portfolios
Asana Goals pozwala śledzić cele, łączyć je z projektami, portfelami i taskami, a postęp może aktualizować się automatycznie na podstawie połączonej pracy.
Wniosek dla Consultify:
Consultify powinien łączyć KPI z taskami i projektami, ale musi bardzo jasno odróżniać: task completion ≠ KPI improvement ≠ realized ROI.
2.4. Financial planning / ROI / business case tools
Anaplan
Anaplan łączy strategic, financial i operational planning, scenario planning, analysis, reporting oraz AI-driven finance analyst, który ocenia wariancje, forecasty, cost drivers i rekomenduje savings opportunities.
Wniosek dla Consultify:
Anaplan jest świetnym wzorcem dla ROI Scenario Engine. Consultify nie powinien konkurować z Anaplanem jako pełny FP&A, ale powinien mieć prosty, mocny ROI model dla inicjatyw transformacyjnych.
Pigment
Pigment pozycjonuje się jako integrated business planning platform powered by agentic AI. Scenarios służą do szybkich porównań what-if, takich jak optimistic, realistic i pessimistic.
Wniosek dla Consultify:
Consultify ROI Analysis powinien mieć minimum trzy scenariusze: conservative, expected, aggressive. Każdy scenariusz musi mieć assumptions i confidence.
Workday Adaptive Planning
Workday Adaptive Planning oferuje raportowanie, dashboardy, what-if scenarios, ad hoc analysis, Microsoft 365 / Google Workspace integrations i variance analysis.
Wniosek dla Consultify:
Warto przejąć wzorzec variance analysis, ale w Consultify wariancja musi być powiązana z historią execution: taskami, decyzjami, opóźnieniami i zmianami zakresu.
Planful
Planful jest FP&A / financial performance management platformą do planning, budgeting, forecasting, reporting, close i consolidation. W 2026 komunikował Planner Assistant do projekcji, anomaly detection i variance analysis w języku naturalnym.
Wniosek dla Consultify:
AI Results Analyst powinien mieć język CFO: „co jest źródłem odchylenia?”, „czy savings są jednorazowe czy recurring?”, „czy efekt jest finance-approved?”.
3. Kluczowy insight strategiczny
Rynek składa się z osobnych klas systemów:
Klasa	Co robi dobrze	Czego nie domyka
BI tools	pokazują dane, dashboardy, trendy	nie prowadzą procesu dowożenia korzyści
KPI tools	definiują KPI, targety, alerty	często nie łączą KPI z inicjatywami i ROI
OKR tools	pokazują alignment i progress	słabo dowodzą finansowego efektu
PMO / PPM tools	śledzą projekty, portfele, capacity	często mierzą output, nie verified value
FP&A tools	liczą pieniądze, scenariusze, forecasty	nie rozumieją workflow transformacji
Consulting frameworks	dają metodologię zmiany	zwykle nie są operacyjnym systemem danych
Consultify Results powinien połączyć te światy w jeden mechanizm:
initiative → KPI → execution → benefit → ROI → governance
Najważniejsze zdanie projektowe:
Results nie jest dashboardem. Results jest systemem odpowiedzialności za wartość transformacji.
4. Rekomendowana nazwa
Rekomenduję nazwę:
Consultify Results & Value Realization Engine
Uzasadnienie:
„Results” jest przyjazne dla użytkownika i pasuje do modułu „Rezultaty”.
„Value Realization” mówi językiem enterprise, PMO, CFO i transformation office.
„Engine” pokazuje, że to nie jest widok, ale mechanizm operacyjny.
Nazwa obejmuje KPI, ROI, benefit tracking, reconciliation, evidence, approval i reporting.
W UI może zostać nazwa krótka: Rezultaty.
W architekturze i dokumentacji: Results & Value Realization Engine.
5. Główne obiekty systemu i przykładowe JSON
5.1. KPI
{
  "kpi_id": "kpi_001",
  "name": "Lead Time Reduction",
  "description": "Reduction of order-to-delivery lead time",
  "category": "operational",
  "formula": "(baseline_lead_time - current_lead_time) / baseline_lead_time",
  "unit": "%",
  "baseline_value": 21,
  "target_value": 15,
  "current_value": 18,
  "previous_value": 19,
  "measurement_frequency": "monthly",
  "owner_id": "user_123",
  "organization_id": "org_001",
  "project_id": "project_011",
  "initiative_id": "init_101",
  "data_source_id": "source_erp_01",
  "source_confidence": 0.88,
  "health_status": "Watch",
  "trend": "improving",
  "threshold_green": 15,
  "threshold_yellow": 18,
  "threshold_red": 21,
  "created_at": "2026-05-09T10:00:00Z",
  "updated_at": "2026-05-09T10:00:00Z"
}
5.2. KPIResult
{
  "kpi_result_id": "kpir_001",
  "kpi_id": "kpi_001",
  "period": "2026-04",
  "actual_value": 18,
  "target_value": 15,
  "deviation_value": 3,
  "deviation_percent": 20,
  "status": "Deviation",
  "trend": "improving",
  "source_reference": "ERP:delivery_report_april",
  "evidence_id": "ev_101",
  "calculated_at": "2026-05-01T08:00:00Z",
  "approved_by": "user_finance_01",
  "approval_status": "Under Review",
  "comment": "Improvement visible, but target not yet reached."
}
5.3. InitiativeResult
{
  "initiative_result_id": "ir_001",
  "initiative_id": "init_101",
  "project_id": "project_011",
  "name": "Warehouse Process Optimization",
  "stage": "Measurement Active",
  "health": "Watch",
  "planned_benefit": 250000,
  "expected_benefit": 220000,
  "realized_benefit": 140000,
  "verified_benefit": 90000,
  "benefit_confidence": "Finance-approved",
  "linked_kpis": ["kpi_001", "kpi_002"],
  "linked_tasks": ["task_301", "task_302"],
  "linked_decisions": ["dec_090"],
  "owner_id": "user_123",
  "status": "In realization",
  "last_reviewed_at": "2026-05-05T12:00:00Z"
}
5.4. ROIModel
{
  "roi_model_id": "roi_001",
  "initiative_id": "init_101",
  "project_id": "project_011",
  "investment_cost": 80000,
  "operating_cost": 12000,
  "expected_savings": 250000,
  "expected_revenue": 0,
  "expected_margin_effect": 0,
  "planned_roi": 2.84,
  "forecast_roi": 2.15,
  "realized_roi": 1.52,
  "payback_period": "8 months",
  "npv": 137000,
  "irr": 0.31,
  "assumptions": [
    "10% labor productivity improvement",
    "15% lead time reduction",
    "No additional headcount required"
  ],
  "sensitivity_scenarios": ["conservative", "expected", "aggressive"],
  "currency": "EUR",
  "model_version": 3,
  "approval_status": "Approved"
}
5.5. Deviation
{
  "deviation_id": "dev_001",
  "object_type": "KPI",
  "object_id": "kpi_001",
  "period": "2026-04",
  "planned_value": 15,
  "actual_value": 18,
  "deviation_value": 3,
  "deviation_percent": 20,
  "severity": "Medium",
  "root_cause": "Delayed implementation of new picking process",
  "ai_explanation": "Lead time improved but missed target due to late training completion and unresolved WMS integration issue.",
  "proposed_actions": [
    "Create corrective task for WMS integration",
    "Schedule operator retraining",
    "Review target realism"
  ],
  "owner_id": "user_123",
  "status": "Open",
  "created_at": "2026-05-01T08:00:00Z",
  "resolved_at": null
}
5.6. Reconciliation
{
  "reconciliation_id": "rec_001",
  "period": "2026-04",
  "project_id": "project_011",
  "initiative_id": "init_101",
  "finance_source": "ERP_finance_april",
  "operations_source": "WMS_operational_report",
  "reported_value": 140000,
  "verified_value": 90000,
  "difference": 50000,
  "status": "Difference Requires Explanation",
  "explanation": "Operational savings include productivity gain not yet visible in finance P&L.",
  "approved_by_finance": null,
  "approved_by_owner": "user_123",
  "audit_log_id": "audit_991"
}
5.7. Evidence
{
  "evidence_id": "ev_101",
  "object_type": "KPIResult",
  "object_id": "kpir_001",
  "evidence_type": "ERP report",
  "file_id": "file_567",
  "source_url": "https://erp.company.local/report/leadtime-april",
  "source_system": "ERP",
  "description": "April lead time export from ERP",
  "uploaded_by": "user_123",
  "verified_by": "user_finance_01",
  "confidence_score": 0.91,
  "created_at": "2026-05-01T08:00:00Z"
}
6. Kluczowe moduły funkcjonalne
A. Results Home / Empty State
Główny ekran powinien pokazywać nie tylko kafelki, ale stan odpowiedzialności za wyniki.
Elementy:
Governed KPIs,
Deviations,
Realized ROI,
Reconciliation,
Initiatives without KPI,
Initiatives with KPI deviation,
Initiatives awaiting review,
Pending approvals,
AI recommended interventions,
„No tracked initiatives” jako aktywny empty state z rekomendacją: „Dodaj KPI / Poproś AI o KPI / Połącz inicjatywę z ROI”.
B. Initiative Results Tracking
Każda inicjatywa musi mieć:
stage,
health,
ownera,
linked KPI,
planned benefit,
expected benefit,
realized benefit,
verified benefit,
evidence,
review cadence,
decision history,
corrective actions.
Najważniejsze: inicjatywa bez KPI nie powinna znikać. Powinna być widoczna jako governance risk.
C. KPI Management Engine
Obsługuje:
definicję KPI,
formułę,
jednostkę,
kategorię,
baseline,
target,
actual,
ownera,
source,
frequency,
thresholds,
status,
comments,
history,
approval.
KPI bez baseline, targetu, ownera i source nie powinien być oznaczony jako governed KPI.
D. KPI Link Engine
KPI powinien linkować się z:
inicjatywą,
projektem,
taskiem,
decyzją,
dokumentem,
tabelą,
raportem,
ownerem,
source systemem,
evidence.
To jest przewaga Consultify nad prostym BI.
E. ROI Engine
Obsługuje:
investment cost,
operating cost,
expected savings,
expected revenue,
margin effect,
planned ROI,
forecast ROI,
realized ROI,
verified ROI,
payback,
NPV,
IRR,
assumptions,
scenarios,
sensitivity,
business case update.
F. ROI Analysis Engine
Powinien odpowiadać na pytania CFO:
co planowaliśmy,
co forecastujemy,
co faktycznie osiągnęliśmy,
co jest potwierdzone przez finance,
co jest tylko deklaracją ownera,
skąd bierze się odchylenie,
czy business case nadal ma sens.
G. Deviation Engine
Obsługuje:
odchylenia KPI,
odchylenia ROI,
severity,
trend,
threshold,
root cause,
AI explanation,
corrective task,
decision request,
escalation.
H. Reconciliation Engine
To powinien być bardzo mocny element.
System porównuje:
wartość operacyjną,
wartość finansową,
declared benefit,
calculated benefit,
finance-approved benefit,
verified benefit.
Bez reconciliation mamy „opowieść o wartości”. Z reconciliation mamy dowód wartości.
I. KPI Reports Engine
Raporty:
KPI report,
PMO report,
CFO ROI report,
executive brief,
client-ready report,
board report,
monthly value realization report.
Eksport:
PDF,
Word,
PowerPoint,
Excel.
J. AI Results Analyst
AI nie jest dekoracją dashboardu. AI jest analitykiem skuteczności transformacji.
AI powinno:
proponować KPI,
oceniać jakość KPI,
wykrywać brakujące KPI,
wyjaśniać odchylenia,
proponować taski naprawcze,
aktualizować business case,
analizować ROI,
wykrywać nierealne assumptions,
generować raporty,
tworzyć CFO-ready explanation,
tworzyć client-ready report,
wskazywać brakujące dane,
oznaczać poziom pewności.
7. Docelowe widoki systemu
7.1. Results Overview
Cel: szybka odpowiedź dla zarządu: czy transformacja dowozi wartość?
Widoczne od razu:
total planned benefit,
total realized benefit,
verified benefit,
planned ROI,
realized ROI,
governed KPIs,
deviations,
pending approvals,
reconciliation issues,
top initiatives by ROI,
worst deviations,
initiatives without KPI,
AI recommended interventions.
AI actions:
„Explain portfolio deviation”
„Generate CEO brief”
„Find initiatives without evidence”
„Create corrective action plan”
7.2. Initiatives Results View
Kolumny:
initiative,
stage,
health,
owner,
linked KPI,
planned benefit,
realized benefit,
verified benefit,
ROI,
last review,
next action.
Filtry:
stage,
health,
KPI link,
owner,
project,
period,
client.
7.3. KPI Registry View
Centralny rejestr KPI.
Kolumny:
KPI name,
category,
formula,
unit,
owner,
baseline,
target,
actual,
trend,
source,
governed status,
last update,
approval.
7.4. KPI Detail View
Zawiera:
definicję,
formułę,
baseline,
target,
actual,
trend chart,
linked initiatives,
linked tasks,
linked decisions,
evidence,
deviations,
comments,
AI explanation,
recommended actions.
7.5. ROI Overview View
Zawiera:
total planned ROI,
total forecast ROI,
total realized ROI,
verified ROI,
ROI by initiative,
ROI by category,
ROI by project,
payback,
variance,
confidence.
7.6. ROI Analysis View
Zawiera:
business case,
assumptions,
scenario analysis,
planned vs actual,
sensitivity,
source data,
AI narrative,
CFO-ready explanation.
7.7. Reconciliation View
Zawiera:
operations value,
finance value,
difference,
explanation,
status,
evidence,
approval,
audit trail.
7.8. Deviation Center
Zawiera:
all deviations,
object type,
severity,
owner,
root cause,
AI explanation,
proposed action,
linked task,
status,
escalation.
7.9. Result Review / Approval View
Zawiera:
pending KPI approvals,
pending ROI approvals,
pending reconciliation,
pending reports,
bulk approve,
reject,
request evidence,
audit log.
8. Workflow użytkownika — 25 kluczowych workflow
1. Dodanie KPI
Trigger: użytkownik chce mierzyć inicjatywę.
Role: Initiative Owner / PMO.
Input: nazwa, formuła, baseline, target, owner, source.
AI role: sugeruje definicję i formułę.
Output: KPI Draft albo KPI Approved.
Acceptance: KPI ma ownera, source, baseline, target i frequency.
2. AI sugeruje KPI dla inicjatywy
Trigger: inicjatywa bez KPI.
AI analizuje opis, cel, proces, expected benefit.
Output: lista KPI finansowych, operacyjnych, jakościowych, czasowych, adoption.
Acceptance: użytkownik może zaakceptować, edytować lub odrzucić KPI.
3. Powiązanie KPI z inicjatywą
KPI zostaje powiązany z initiative_id, project_id, owner_id.
Acceptance: KPI widoczny w Initiative Results View.
4. Ustawienie baseline
System pobiera wartość ze źródła albo użytkownik wpisuje manualnie.
Acceptance: baseline ma source lub manual justification.
5. Ustawienie targetu
AI proponuje target, user zatwierdza.
Acceptance: target ma uzasadnienie i approval.
6. Aktualizacja actual value
Dane przychodzą automatycznie lub ręcznie.
Acceptance: KPIResult zapisany z okresem, source i timestamp.
7. Wykrycie odchylenia KPI
System porównuje actual z targetem i thresholdami.
AI wyjaśnia możliwe przyczyny.
Acceptance: powstaje Deviation object.
8. Task naprawczy z odchylenia
AI proponuje corrective action.
User zatwierdza.
Acceptance: task pojawia się w Execution Hub.
9. KPI Review
Owner robi check-in, dodaje komentarz i status.
Acceptance: review zapisany w historii KPI.
10. Miesięczny raport KPI
AI generuje raport.
Acceptance: raport ma executive summary, deviations, recommendations i source list.
11. Dodanie ROI modelu
System zbiera koszty, savings, revenue impact, assumptions.
Acceptance: planned ROI policzony i zapisany.
12. Aktualizacja forecast ROI
Forecast zmienia się na podstawie postępu execution, kosztów i KPI.
Acceptance: forecast ROI ma wersję i datę.
13. Obliczenie realized ROI
System liczy realized ROI z actual values.
Acceptance: ROI oznaczony jako calculated, ale nie verified.
14. ROI reconciliation
Finance porównuje wartość operacyjną z finansową.
Acceptance: benefit ma status finance-approved albo disputed.
15. AI wyjaśnia planned vs realized ROI
AI analizuje assumptions, task history, KPI, decyzje.
Acceptance: explanation zawiera source references i confidence.
16. Business case update
AI aktualizuje business case.
Acceptance: powstaje nowa wersja business case’u.
17. Initiative health update
System aktualizuje health na podstawie KPI, stage, deviation i task progress.
Acceptance: health ma explainability.
18. Portfolio results review
Manager filtruje portfel po stage, health, KPI link, ROI.
Acceptance: może wygenerować executive brief.
19. Inicjatywy bez KPI
System pokazuje inicjatywy bez KPI.
Acceptance: AI sugeruje KPI albo uzasadnienie „not measurable yet”.
20. Inicjatywy bez evidence
System wykrywa realized benefits bez dowodów.
Acceptance: status nie może być Verified.
21. KPI source conflict
System wykrywa konflikt między ERP, spreadsheet i manual input.
Acceptance: deviation/source conflict trafia do review.
22. Manual adjustment KPI result
User koryguje wynik z uzasadnieniem.
Acceptance: before/after zapisane w audit log.
23. Client-ready results report
AI generuje raport dla klienta bez internal-only notes.
Acceptance: raport ma tryb client-safe.
24. Executive ROI brief
AI przygotowuje krótką notę CEO/CFO.
Acceptance: 1 strona: value delivered, risks, actions.
25. Closed-loop corrective action
Deviation → task → execution → KPI update → verified improvement.
Acceptance: system pokazuje, że działanie naprawcze poprawiło KPI.
9. AI Results Analyst — rola AI
AI w Results powinno działać na czterech poziomach.
Poziom 1: Definicja i jakość KPI
AI:
proponuje KPI,
ocenia KPI,
sprawdza brak baseline,
sprawdza brak target,
sprawdza brak ownera,
sprawdza brak source,
sugeruje frequency,
sugeruje thresholds.
Poziom 2: Analiza odchyleń
AI:
wykrywa trend,
szuka root cause,
analizuje taski,
analizuje decyzje,
analizuje komentarze,
porównuje source,
tworzy explanation,
proponuje corrective action.
Poziom 3: Analiza ROI
AI:
sprawdza planned vs forecast vs realized,
ocenia assumptions,
ostrzega przed agresywnym ROI,
liczy scenariusze,
tłumaczy wynik CFO,
aktualizuje business case.
Poziom 4: Governance i reporting
AI:
generuje raporty,
rozróżnia declared / calculated / approved / verified,
oznacza missing data,
nie halucynuje,
pokazuje confidence,
przygotowuje client-ready mode.
Najważniejsza zasada:
AI może wyjaśniać i rekomendować, ale nie może udawać pewności tam, gdzie brakuje danych.
10. Wymagania funkcjonalne — macierz 120 wymagań
Poniżej skondensowana macierz. Priorytety: P0 — konieczne, P1 — ważne, P2 — rozwój.
#	Wymaganie	Priorytet	Acceptance criterion
1	Create KPI	P0	User tworzy KPI z nazwą i kategorią
2	Edit KPI	P0	Zmiana zapisuje historię
3	Archive KPI	P0	KPI znika z aktywnych widoków
4	Restore KPI	P1	KPI wraca z historią
5	Delete KPI	P1	Tylko z uprawnieniem admin
6	Define formula	P0	KPI ma wersjonowaną formułę
7	Define unit	P0	Unit widoczny w chartach
8	Define category	P0	Można filtrować po kategorii
9	Define owner	P0	KPI bez ownera nie jest governed
10	Define baseline	P0	Baseline ma source albo justification
11	Define target	P0	Target ma datę i approval
12	Measurement frequency	P0	KPI ma daily/weekly/monthly/quarterly
13	Define data source	P0	KPI ma source type
14	Link KPI to initiative	P0	KPI widoczny w inicjatywie
15	Link KPI to project	P0	KPI widoczny w projekcie
16	Link KPI to task	P1	Task wpływa na KPI context
17	Link KPI to decision	P1	Decyzja widoczna w KPI detail
18	Link KPI to document	P1	Dokument jest evidence/context
19	Link KPI to report	P1	Raport pokazuje KPI
20	Update actual value	P0	Powstaje KPIResult
21	Import actual value	P1	Import z pliku/tabeli
22	Manual actual value	P0	Wymaga komentarza
23	Calculate deviation	P0	System liczy value i percent
24	Calculate trend	P0	Trend widoczny w KPI detail
25	Set thresholds	P0	Green/yellow/red działają
26	Health status	P0	Health liczony z reguł
27	KPI comments	P0	Owner dodaje komentarz
28	KPI check-in	P0	Okresowy review zapisany
29	KPI approval	P0	Approval status widoczny
30	KPI evidence	P0	Evidence można podpiąć
31	KPI history	P0	Historia wartości dostępna
32	KPI audit log	P0	Zmiany audytowalne
33	KPI dashboard	P0	KPI widoczne w overview
34	KPI registry	P0	Lista wszystkich KPI
35	KPI detail view	P0	Pełny widok KPI
36	KPI report	P0	Raport KPI generowany
37	Export KPI report PDF	P1	PDF poprawny
38	Export KPI report Word	P1	DOCX poprawny
39	Export KPI report PPT	P1	Slajdy poprawne
40	Schedule KPI report	P1	Raport cykliczny
41	Share KPI report	P1	Link/permissions działają
42	Client-ready KPI report	P1	Internal notes usunięte
43	Create ROI model	P0	ROI model dla inicjatywy
44	Edit ROI model	P0	Wersjonowanie modelu
45	Investment cost	P0	Koszt inwestycji w modelu
46	Operating cost	P0	Koszt operacyjny w modelu
47	Expected savings	P0	Savings jako assumption
48	Expected revenue	P1	Revenue impact
49	Margin impact	P1	Margin effect
50	Assumptions	P0	Lista assumptions
51	Planned ROI	P0	System liczy planned ROI
52	Forecast ROI	P1	System liczy forecast
53	Realized ROI	P0	System liczy realized
54	Verified ROI	P0	Wymaga approval/evidence
55	Payback	P1	Payback period liczony
56	NPV	P2	NPV dostępne
57	IRR	P2	IRR dostępne
58	Scenario analysis	P1	Conservative/expected/aggressive
59	Sensitivity analysis	P2	Wpływ assumptions widoczny
60	Planned vs actual	P0	Porównanie widoczne
61	Forecast vs actual	P1	Porównanie widoczne
62	ROI deviation	P0	Odchylenie liczone
63	ROI approval	P0	Approval status
64	ROI evidence	P0	Evidence wymagane
65	ROI reconciliation	P0	Reconciliation object
66	Finance approval	P0	Finance może approve/reject
67	Owner approval	P0	Owner potwierdza
68	Audit ROI changes	P0	Audit log
69	Initiative results view	P0	Widok inicjatyw
70	Initiative health	P0	Health liczony
71	Initiative stage	P0	Stage lifecycle
72	Benefit tracking	P0	Benefit object
73	Planned benefit	P0	Wartość planowana
74	Expected benefit	P0	Wartość forecast
75	Realized benefit	P0	Wartość realized
76	Verified benefit	P0	Wartość verified
77	Confidence score	P0	Confidence widoczny
78	Source confidence	P0	Source confidence
79	Evidence upload	P0	Plik/link/source
80	Evidence verification	P0	Verified by
81	Source traceability	P0	Source widoczny
82	Source conflict detection	P1	Konflikt wykryty
83	Deviation detection	P0	KPI/ROI deviation
84	Deviation severity	P0	Low/medium/high/critical
85	Root cause field	P0	Root cause zapisany
86	AI deviation explanation	P1	AI explanation z confidence
87	Corrective action suggestion	P1	AI sugeruje action
88	Create task from deviation	P0	Task w Execution Hub
89	Create decision from deviation	P1	Decision request
90	Escalation	P1	Escalation owner
91	Review cadence	P0	Review schedule
92	Review reminders	P1	Notification
93	Pending approvals	P0	Approval queue
94	Governed KPIs counter	P0	Counter działa
95	Deviations counter	P0	Counter działa
96	Realized ROI counter	P0	Counter działa
97	Reconciliation counter	P0	Counter działa
98	Filter by stage	P0	Filtr działa
99	Filter by health	P0	Filtr działa
100	Filter by KPI link	P0	Filtr działa
101	Filter by owner	P1	Filtr działa
102	Filter by project	P1	Filtr działa
103	Filter by client	P1	Filtr działa
104	Filter by period	P0	Filtr działa
105	Portfolio view	P1	Portfel inicjatyw
106	Executive dashboard	P1	CEO view
107	CFO dashboard	P1	CFO view
108	PMO dashboard	P1	PMO view
109	Governance dashboard	P1	Data/KPI quality
110	AI insight panel	P1	Insighty widoczne
111	AI recommended actions	P1	Lista rekomendacji
112	AI missing data warnings	P1	Braki danych
113	AI KPI suggestion	P1	Propozycje KPI
114	AI target suggestion	P2	Propozycje targetów
115	AI business case update	P1	Update business case
116	AI executive summary	P1	Summary generowane
117	Client-ready report	P1	Tryb client-safe
118	Role-based access	P0	Permissions działają
119	Versioning	P0	KPI/ROI versions
120	Multilingual/currency/unit handling	P1	PL/EN, waluty, jednostki
11. Wymagania niefunkcjonalne
Obszar	Wymaganie	Dlaczego ważne
Performance	Dashboard ładuje się < 2 s dla standardowego portfela	Zarząd nie będzie czekał na raport
Filtering	Filtrowanie < 500 ms	Widok PMO musi działać operacyjnie
Calculation accuracy	Kalkulacje KPI/ROI deterministyczne	CFO musi ufać liczbom
Formula versioning	Każda zmiana formuły zapisana	Inaczej historia KPI traci sens
Data stability	Brak nadpisywania historycznych wyników	Audyt i porównania okresowe
Portfolio scale	Obsługa setek inicjatyw i tysięcy KPI	Enterprise readiness
Source traceability	Każda wartość ma source	Bez tego KPI nie jest governed
Auditability	Wszystkie zmiany w audit log	Compliance i zaufanie
Tenant isolation	Dane klientów oddzielone	SaaS enterprise requirement
Permissions	Role-based access	CFO widzi inne dane niż konsultant
Internal/client split	Client-ready mode	Nie można ujawniać internal notes
Evidence integrity	Evidence nie może znikać bez śladu	Verified benefit wymaga dowodu
Reconciliation reliability	Finance approval zapisany	Realized value musi być potwierdzony
AI grounding	AI odpowiada na podstawie danych	Redukcja halucynacji
AI confidence	Każdy AI insight ma confidence	Użytkownik zna poziom pewności
Alert fatigue	Limity alertów i severity	Inaczej użytkownicy ignorują system
Export reliability	PDF/Word/PPT bez błędów	Raporty idą do zarządu i klientów
Multilingual	PL/EN minimum	Consultify działa globalnie
Currency conversion	Waluta i kurs jawne	ROI musi być finansowo poprawny
Time zones	Okresy i daty spójne	Międzynarodowe organizacje
Observability	Logi błędów kalkulacji i AI	QA i support
Testability	Reguły KPI/ROI testowalne	Automatyzacja QA
Security	Access control + encryption	Dane finansowe są wrażliwe
Data lineage	Widoczna ścieżka danych	CFO/PMO muszą widzieć pochodzenie wartości
Compliance readiness	Eksport audytu	Enterprise procurement
12. Model stage, status i health
12.1. Initiative result stages
Stage	Znaczenie	Trigger wejścia	Trigger wyjścia
Not Measured	Inicjatywa bez pomiaru	Utworzenie inicjatywy	KPI Proposed
KPI Proposed	AI/user zaproponował KPI	Propozycja KPI	KPI Defined
KPI Defined	KPI opisany	Definicja KPI	Baseline Set
Baseline Set	Jest wartość startowa	Baseline approved	Target Approved
Target Approved	Jest cel	Target approved	In Realization
In Realization	Inicjatywa trwa	Start execution	Measurement Active
Measurement Active	Pomiar działa	Pierwszy actual	Deviation / Benefit
Deviation Detected	Jest odchylenie	Threshold breached	Corrective action
Corrective Action Active	Działania naprawcze	Task created	KPI update
Benefit Realized	Efekt policzony	Actual benefit	Verification
Benefit Verified	Efekt potwierdzony	Evidence + approval	Reconciled
Reconciled	Finance/ops uzgodnione	Reconciliation done	Closed
Closed	Zamknięte	Final report	—
12.2. Health statuses
Health	Reguła	Akcja
Healthy	KPI zgodnie z targetem	Kontynuuj
Watch	Małe odchylenie lub słaby trend	Review
At Risk	Istotne odchylenie	Corrective action
Off Track	Cel prawdopodobnie niedowieziemy	Escalation
Blocked	Brak danych / zależność blokuje	Decision required
Completed	Efekt osiągnięty	Verification
Unverified	Deklarowany efekt bez dowodu	Evidence required
12.3. KPI statuses
Draft,
Proposed,
Approved,
Active,
Data Missing,
Deviation,
Under Review,
Verified,
Archived.
12.4. ROI statuses
No ROI Model,
Draft ROI,
Planned ROI Approved,
Forecast Active,
Realized ROI Calculated,
Realized ROI Under Review,
Reconciled,
Verified,
Rejected.
13. Model KPI, ROI i benefits
KPI types
financial KPI,
operational KPI,
process KPI,
quality KPI,
time KPI,
productivity KPI,
adoption KPI,
risk KPI,
customer KPI,
people KPI,
strategic KPI.
Benefit types
cost reduction,
revenue increase,
margin improvement,
productivity improvement,
lead time reduction,
quality improvement,
risk reduction,
compliance improvement,
customer satisfaction,
employee productivity,
automation benefit,
decision speed benefit.
ROI dimensions
planned ROI,
forecast ROI,
realized ROI,
verified ROI,
gross benefit,
net benefit,
one-time cost,
recurring cost,
one-time saving,
recurring saving,
payback,
sensitivity,
confidence.
Benefit confidence levels
Level	Znaczenie
Declared	Ktoś zadeklarował efekt
Estimated	Efekt oszacowany
Calculated	Efekt policzony z danych
Evidence-backed	Efekt ma dowód
Finance-approved	Finance potwierdził
Verified	Efekt uzgodniony i zamknięty
Najważniejsze rozróżnienie:
„Ktoś powiedział, że oszczędziliśmy” to nie to samo co „Finance potwierdził oszczędność”.
14. Source governance
Source types
manual input,
uploaded file,
Consultify table,
project artifact,
task completion data,
decision log,
finance system,
ERP,
CRM,
BI system,
spreadsheet,
survey,
interview,
IoT / operational system,
external benchmark,
public source.
Source trust levels
Trust level	Znaczenie
Verified financial source	Dane finansowe zatwierdzone
Verified operational source	Dane operacyjne z systemu
Approved project source	Dane zatwierdzone przez PMO
User-declared source	Deklaracja użytkownika
Uploaded evidence	Plik jako dowód
AI inference	Wniosek AI
External benchmark	Dane zewnętrzne
Unverified	Brak potwierdzenia
AI musi zawsze rozróżniać:
measured,
calculated,
estimated,
inferred,
declared,
approved,
verified.
15. Dashboardy Results
A. Executive Results Dashboard
Pokazuje:
total planned benefit,
total realized benefit,
verified benefit,
planned ROI,
realized ROI,
top value initiatives,
initiatives off track,
deviations,
pending approvals,
AI executive summary.
B. PMO Results Dashboard
Pokazuje:
initiatives by stage,
initiatives by health,
KPI coverage,
overdue reviews,
deviations by owner,
corrective actions,
blocked benefits,
unverified benefits.
C. CFO ROI Dashboard
Pokazuje:
planned vs realized ROI,
benefit reconciliation,
finance approval status,
cost variance,
payback,
confidence score,
disputed values,
audit trail.
D. KPI Governance Dashboard
Pokazuje:
governed KPIs,
KPIs without owner,
KPIs without source,
KPIs without baseline,
KPIs without target,
KPIs with deviations,
stale KPIs,
formula changes.
E. AI Quality Dashboard
Pokazuje:
AI suggestions accepted/rejected,
false deviation alerts,
missing data warnings,
AI explanation ratings,
report generation quality,
hallucination reports.
16. Relacje z innymi modułami Consultify
Moduł	Relacja z Results
Initiatives	Każda inicjatywa ma KPI/benefit/ROI albo świadome „not measurable yet”
Execution Hub	Odchylenia tworzą taski, decyzje i escalation
Tables	KPI/ROI mogą być analizowane jako rejestry i matryce
Documents	Wyniki generują raporty Word/PDF, business case update
Presentations	Wyniki generują slajdy dla zarządu i klienta
Chat / Teresa	Teresa odpowiada na pytania o wyniki i wyjaśnia odchylenia
Workbench	Po lewej rozmowa, po prawej raport KPI/ROI
Finance	Finance zatwierdza realized/verified value
Data	Source traceability i data lineage
Reports	Raporty KPI/ROI cykliczne i client-ready
17. MVP i roadmapa
MVP 1 — Results Foundation
Zakres:
Results Overview,
KPI Registry basic,
create KPI,
link KPI to initiative,
baseline,
target,
manual actual,
status chips,
stage/health filters,
empty states.
Nie wchodzi:
automatyczna integracja ERP,
pełne reconciliation,
NPV/IRR,
advanced AI.
Definition of Done:
użytkownik może dodać KPI do inicjatywy,
ustawić baseline i target,
wpisać actual,
zobaczyć odchylenie,
zobaczyć inicjatywy bez KPI.
MVP 2 — KPI Governance
Zakres:
KPI owner,
source,
formula,
thresholds,
trend,
comments,
KPI detail,
KPI history,
approval.
MVP 3 — Deviation Engine
Zakres:
deviation detection,
severity,
AI explanation,
corrective action suggestion,
create task from deviation,
alerts.
MVP 4 — ROI Engine
Zakres:
ROI model,
planned ROI,
forecast ROI,
realized ROI,
assumptions,
planned vs actual,
ROI detail.
MVP 5 — Reconciliation & Evidence
Zakres:
evidence upload,
source trust,
finance approval,
owner approval,
verified benefit,
reconciliation view,
audit trail.
MVP 6 — Reports
Zakres:
KPI reports,
ROI reports,
executive summary,
PDF/Word/PPT export,
recurring reports,
client-ready mode.
MVP 7 — AI Results Analyst
Zakres:
AI KPI suggestions,
AI target suggestions,
AI deviation explanation,
AI ROI commentary,
missing data detection,
business case update.
MVP 8 — Enterprise Governance
Zakres:
permissions,
audit trail,
role-based dashboards,
source governance,
formula versioning,
compliance dashboard.
18. Ryzyka produktowe i decyzje architektoniczne
Ryzyko	Wpływ	Prawdopodobieństwo	Ograniczenie	Decyzja
Zbudowanie zwykłego dashboardu	Wysoki	Wysokie	Results jako workflow, nie widok	Core: Value Realization Engine
KPI bez ownera	Wysoki	Wysokie	Owner wymagany	KPI bez ownera ≠ governed
KPI bez baseline	Wysoki	Wysokie	Baseline required	Stage Baseline Set
KPI bez targetu	Wysoki	Średnie	Target approval	Target Approved stage
ROI jako deklaracja	Bardzo wysoki	Wysokie	Confidence levels	Declared ≠ Verified
Brak finance approval	Bardzo wysoki	Średnie	Reconciliation	Verified ROI wymaga finance
Brak evidence	Wysoki	Wysokie	Evidence required	Realized bez evidence ≠ verified
AI halucynuje	Wysoki	Średnie	Grounded AI + confidence	AI musi pokazywać missing data
Dashboard nie prowadzi do działań	Wysoki	Wysokie	Deviation → task	Corrective action builder
Alert fatigue	Średni	Wysokie	Severity i digest	Nie każdy sygnał to alert
Brak wersjonowania formuł	Wysoki	Średnie	Formula versioning	KPI formula immutable per period
Brak client/internal mode	Wysoki	Średnie	Report mode	Client-ready sanitizer
Zbyt skomplikowany UX	Wysoki	Wysokie	Progressive disclosure	Overview prosty, detail głęboki
Słabe eksporty	Średni	Średnie	Integracja z Document/Presentation Studio	Eksport jako artifact
Brak integracji z Execution Hub	Wysoki	Średnie	ResultAction → Task	Native integration
19. Decyzja architektoniczna: BI, OKR, PMO czy własny engine?
Consultify nie powinien kopiować Power BI, OKR tools, PMO tools ani FP&A tools 1:1.
Najlepsza decyzja:
Budujemy własny Results & Value Realization Engine, a zewnętrzne BI/ERP/Finance traktujemy jako źródła danych.
Dlaczego:
Power BI pokazuje dane, ale nie prowadzi procesu realizacji korzyści.
OKR tools pokazują cele, ale słabo dowodzą finansowego ROI.
PMO tools pokazują projekty, ale często mierzą output, nie value.
Finance tools liczą pieniądze, ale nie rozumieją workflow transformacji.
Consultify musi połączyć initiative, KPI, ROI, evidence, deviation, corrective action i report.
Własny model:
initiative → KPI → target → execution → actual → deviation → explanation → corrective action → realized ROI → verified result → report
20. Rekomendowana architektura logiczna
Initiative / Project / Task / Decision / Data Source
  ↓
KPI Definition Engine
  ↓
Baseline & Target Engine
  ↓
Data Source Resolver
  ↓
Measurement Engine
  ↓
KPI Result Calculator
  ↓
Deviation Detector
  ↓
AI Explanation Engine
  ↓
Corrective Action Builder
  ↓
ROI Model Engine
  ↓
Realized Benefit Calculator
  ↓
Evidence & Source Governance
  ↓
Reconciliation Engine
  ↓
Approval Engine
  ↓
Reports Engine
  ↓
Audit Trail
  ↓
Executive / PMO / CFO Dashboard
Core Consultify
Powinno być własne:
KPI Definition Engine,
Initiative-KPI Link Engine,
ROI Model Engine,
Deviation Engine,
Benefit Tracking,
Evidence Governance,
Reconciliation Engine,
Results Approval Engine,
AI Results Analyst,
Result Audit Log,
Client/Internal Reporting Mode.
Integracje zewnętrzne
Mogą być integrowane:
BI systems,
finance systems,
ERP,
CRM,
spreadsheets,
data warehouses,
IoT systems,
project management tools,
file storage,
document repositories,
LLM providers.
21. Finalna definicja produktu
Consultify Results & Value Realization Engine to centralny system śledzenia, wyjaśniania, uzgadniania i raportowania rezultatów transformacji. Moduł łączy inicjatywy, KPI, ROI, odchylenia, evidence, reconciliation, approvale i raporty w jedną pętlę zarządzania wartością. Każda inicjatywa może mieć KPI, baseline, target, actual, ownera i źródło danych. System rozróżnia planned, forecast, realized i verified benefits, dzięki czemu organizacja widzi nie tylko to, co planowała osiągnąć, ale również to, co faktycznie zostało dowiezione i potwierdzone.
AI pomaga definiować KPI, oceniać ich jakość, wykrywać brakujące dane, wyjaśniać odchylenia, proponować działania naprawcze, aktualizować business case i generować raporty KPI/ROI dla PMO, CFO, CEO oraz klienta. Realized ROI wymaga dowodów i może wymagać approval finansów. KPI i ROI są powiązane z taskami, decyzjami, dokumentami, raportami i projektami. Dashboard nie jest tylko wizualizacją, ale punktem wejścia do działań naprawczych. Moduł posiada source traceability, audit trail, role-based permissions i client/internal mode. Consultify Results zamyka pętlę consulting execution: od inicjatywy do potwierdzonego efektu biznesowego.
22. Najważniejsze zasady projektowe
Rezultaty nie są dashboardem — rezultaty są dowodem wartości.
Każda inicjatywa powinna mieć KPI albo świadome uzasadnienie braku KPI.
KPI bez ownera jest słabym KPI.
KPI bez baseline nie mierzy zmiany.
KPI bez targetu nie mierzy sukcesu.
KPI bez źródła danych nie powinien być governed.
ROI musi rozróżniać planned, forecast, realized i verified.
Realized ROI bez evidence nie jest verified ROI.
Finance approval powinien być wymagany dla potwierdzonych korzyści finansowych.
Dashboard musi prowadzić do działania, nie tylko pokazywać liczby.
Odchylenie powinno tworzyć task, decyzję albo escalation.
AI powinno wyjaśniać odchylenia, ale nie udawać pewności bez danych.
Źródła KPI muszą być widoczne.
Formuły KPI muszą być wersjonowane.
Zmiany wartości KPI muszą być audytowalne.
Benefity muszą mieć confidence level.
Inicjatywy bez mierników powinny być widoczne jako ryzyko zarządcze.
Raport KPI powinien powstawać automatycznie z danych, komentarzy i AI narrative.
Client-ready report musi usuwać internal-only notes.
Results musi być połączony z Execution Hub.
Results musi zasilać decyzje zarządcze.
AI ma być analitykiem rezultatów, nie dekoracją dashboardu.
Nie kopiujemy Power BI — budujemy value realization engine.
Nie chodzi o liczenie aktywności, tylko o potwierdzanie efektów.
Consultify ma zamykać pętlę: initiative → KPI → ROI → action → verified result.
Najkrótsza rekomendacja produktowa
Piotr, ten moduł może być jednym z najmocniejszych elementów Consultify, bo bardzo dobrze trafia w lukę rynku.
BI pokazuje dane.
OKR pokazuje cele.
PMO pokazuje projekty.
Finance pokazuje pieniądze.
Consultify Results ma pokazać, czy transformacja naprawdę dowiozła wartość — i co zrobić, jeśli nie dowozi.
