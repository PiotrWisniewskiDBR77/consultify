---
uiux_doc_id: UIUX_RAW_FINANCE_INTELLIGENCE_ENGINE_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Finance & Intelligence Engine (2026-05-09)

Poniżej: surowe założenia autora (produkt + architektura) wklejone **verbatim**.

---

## VERBATIM

Consultify Finance & Intelligence Engine
AI Financial Analysis & Modeling Engine dla Consultify
1. Executive summary
Consultify Finance & Intelligence Engine nie powinien być modułem do przechowywania PDF-ów ze sprawozdaniami. To ma być finansowy mózg Consultify: system, który zamienia dokumenty, tabele i dane finansowe w audytowalny model finansowy, analizę, predykcję, wycenę, decyzję inwestycyjną, raport zarządczy i dowód realizacji efektów.
Docelowa pętla modułu:
statement → ingestion → normalization → model → analysis → forecast → valuation → investment decision → report → audit trail → Results / ROI
To jest logicznie spójne z filozofią Digital Roadmap: transformacja nie jest jednorazowym projektem, tylko powtarzalnym procesem obejmującym analizę stanu, inicjatywy, plan, efekty ekonomiczne i ciągłą korektę działań . Dla modułu Finance oznacza to jedno: liczby finansowe muszą być połączone z inicjatywami, decyzjami, KPI, ROI i rezultatami, a nie istnieć jako oderwany Excel.
Najważniejszy problem rynkowy: w większości firm finanse są rozproszone między ERP, Excelami, BI, PDF-ami, raportami zarządczymi i prezentacjami. CFO, CEO, konsultanci i inwestorzy często pracują na różnych wersjach danych. Consultify Finance ma stworzyć jedną ścieżkę zaufania: od źródła liczby do decyzji i raportu.
2. Benchmark rynku — najważniejsze wnioski
Rynek nie ma jednego narzędzia, które robi dokładnie to, co powinien robić Consultify Finance. Istnieje kilka klas produktów:
ERP / accounting / close — NetSuite, Dynamics 365 Finance, SAP S/4HANA Finance, Oracle Fusion, Sage Intacct, BlackLine, FloQast, Workiva.
Przechowują księgowość, pomagają w zamknięciu miesiąca, konsolidacji, reconciliation, compliance i raportowaniu.
FP&A / planning / forecasting — Anaplan, Pigment, Workday Adaptive Planning, Planful, Datarails, Vena, Oracle EPM, SAP Analytics Cloud, Cube, Mosaic, Jedox, Board.
Pomagają planować, forecastować, budżetować, robić scenariusze i variance analysis.
BI / dashboards — Power BI, Tableau, Looker, Qlik, ThoughtSpot, Sigma.
Pokazują dane, KPI, dashboardy, drill-down i insighty.
Financial data / investment research — S&P Capital IQ, Bloomberg, FactSet, LSEG, PitchBook, AlphaSense, BamSEC, Koyfin, TIKR.
Dostarczają dane publiczne, filing analysis, comps, multiples, screening, financials.
Excel / modele doradcze — nadal dominuje w corporate finance, PE, VC, investment banking i consultingu.
Daje elastyczność, ale często bez governance, audit trail, wersjonowania assumptions i połączenia z execution.
Wniosek: Consultify nie powinien kopiować ERP, FP&A, BI ani Bloomberga. Powinien zbudować własny AI-native financial intelligence and corporate finance execution system, który łączy najlepsze wzorce z tych klas, ale służy pracy konsultingowej i decyzyjnej.
3. Benchmark systemów — tabela porównawcza
System / klasa	Co robi dobrze	Co jest ważne dla Consultify	Luka do wykorzystania
Anaplan	AI-driven scenario planning, planning, analysis, forecasting, role-based AI agents, skalowalne modele i scenariusze. Anaplan pozycjonuje się jako platforma do scenario planning i analysis z AI w centrum	Silnik scenariuszy, planning, driver-based models, real-time impact analysis	Nie jest consulting execution systemem; nie łączy naturalnie statement → initiative → ROI → board report
Pigment	Real-time business planning, governed data, live models, AI agents: Modeler, Analyst, Planner. Pigment podkreśla agentów analizujących performance, wyjaśniających drivers i symulujących scenariusze na governed data	Agent finansowy działający bezpośrednio na modelu, nie obok modelu	Consultify może pójść dalej: statement ingestion + valuation + investment memo + Results
Workday Adaptive Planning	Rolling forecast, integracje z ERP, planning i forecasting	Aktualizacja forecastu z actuals, proces rolling forecast	Słabsze dopasowanie do doradztwa, wyceny i due diligence
Planful	AI-powered close, consolidation, planning, reporting; integracje z GL/ERP, obsługa multi-currency i wielu struktur GL	Consolidation, multiple charts of accounts, multi-currency, close/reporting	Consultify nie powinien robić pełnej konsolidacji księgowej, tylko importować i normalizować statementy do analiz
Datarails	Excel-native FP&A, automatyczna konsolidacja, dashboards, AI insights, 600+ integracji ERP/CRM/HRIS, P&L/BS/CF reporting	Excel-native thinking, zachowanie modeli, automatyzacja danych, AI insights	Consultify może wykorzystać podobny szacunek dla Excela, ale dodać artifact governance i linkage do inicjatyw
Vena	Excel-native planning, budgeting, workflow, reporting	Excel jako interfejs modelowania	Ryzyko: zbyt duże przywiązanie do Excela bez pełnej AI-native warstwy
Oracle EPM	Planning, consolidation, close, profitability, narrative reporting, AI, report packages, approvals, audit trail. Oracle Narrative Reporting łączy dane, narrative, Word/PPT/PDF/Excel, review cycles i full audit trail	Narrative reporting, report packages, approval workflow, audit trail	Consultify powinien połączyć narrative reporting z AI analyst, models, valuation i execution
SAP Analytics Cloud / SAP EPM	Planning, BI, predictive, integracja z SAP	Enterprise source integration	Ciężkie wdrożenia, mniej consulting-native
Microsoft Dynamics 365 Finance	Core finance ERP, budgeting, cash flow forecasting, financial close, Copilot/agentic AI, budget planning z integracją Excel i scenarios	ERP jako źródło actuals, cash flow, budget, chart of accounts	Consultify nie powinien kopiować ERP, tylko integrować ERP jako źródło
BlackLine	Financial close, reconciliation, transaction matching, journal entry, account validations, threshold approvals, end-to-end audit trails	Data quality, reconciliation, audit trail, exception-based workflow	Consultify może przejąć logikę quality gates i recovery queue, ale nie pełny close accounting
FloQast	Close management, AI variance explanations, transaction matching, close checklist automation	AI variance explanation, close workflow, checklist	W Consultify: variance explanation powinno działać dla forecast, ROI, initiatives, Results
Workiva	SEC reporting, internal controls, SOX, collaboration, data-to-output, role-based access, audit readiness, AI report preparation	Source-to-report traceability, controls, audit readiness	Consultify powinien mieć podobną dyscyplinę, ale dla consultingu, board packs i client-ready outputs
Power BI	BI, visualization, AI-assisted report creation, OneLake/source of truth, Copilot for data questions. Microsoft wskazuje jednak ograniczenia Copilota przy deeper insights, anomaly detection i forecasting w części chat-with-data	Dashboards, semantic model, visuals	Consultify musi iść głębiej niż dashboard: wyjaśnienie, decyzja, task, raport
Tableau Pulse	Personalized AI insights, metric summaries, trends, outliers, “what and why” behind data	CFO/CEO insight feed, metric monitoring	Consultify powinien połączyć insight z action: escalation, task, initiative
Looker	Semantic layer, governed metrics, single source of truth, AI-grounded queries, business definitions	Finance semantic layer, standard account model, KPI definitions	Consultify potrzebuje własnego finance semantic layer dla statements/models/ROI
ThoughtSpot	Natural language search over cloud data, self-service analytics, scalable query generation	Natural language finance questions	Consultify musi dodać source confidence, assumptions, approvals
BamSEC	Search SEC filings/transcripts, table tools, collaboration, document search, exhibits	Filing reader, source references, table extraction	Consultify może wykorzystać wzorzec: źródło + linia + tabela + komentarz
AlphaSense	SEC filings, market intelligence, filings as źródło danych finansowych i business context	Research layer i external market context	Consultify nie buduje pełnego AlphaSense, ale może importować public filings
Koyfin	Company financials, income statement, balance sheet, cash flow, valuation metrics, custom templates, history	Financial statement review, ratios, valuation quick view	Consultify musi obsłużyć private company statements, nie tylko public markets
S&P Capital IQ	Standardized financials, 5,000+ data items, income statement, balance sheet, cash flow, ratios, point-in-time data do benchmarking/valuation	Standardization, benchmarking, comps, valuation data	Consultify powinien integrować takie źródła, nie próbować od razu budować pełnej bazy rynkowej
PitchBook / FactSet / Bloomberg / LSEG	Market data, transactions, comps, ownership, capital markets	Valuation, comps, precedent transactions	Integracja jako data provider; nie kopiować terminala
4. Kluczowy insight strategiczny
Rynek jest poszatkowany:
ERP trzyma księgowość.
FP&A planuje i forecastuje.
BI pokazuje dashboardy.
Excel buduje modele.
Capital IQ / Bloomberg / PitchBook dają dane rynkowe.
Workiva / Oracle robią narrative reporting i kontrolę raportowania.
BlackLine / FloQast robią close, reconciliation i variance explanations.
BamSEC / AlphaSense pomagają analizować filings.
Ale mało który system zamyka pętlę:
statement → model → analysis → forecast → valuation → decision → report → execution → ROI
To jest właśnie miejsce dla Consultify Finance.
Najważniejsza decyzja: Consultify Finance ma być systemem finansowego rozumowania i dowodzenia decyzjami, nie repozytorium statementów.
5. Rekomendowana nazwa
Rekomendacja UI:
Finance
Krótka, zrozumiała, mieści się w sidebarze.
Rekomendacja architektoniczna:
Consultify Finance & Intelligence Engine
Alternatywa techniczna:
Consultify AI Financial Analysis & Modeling Engine
Najlepsza pełna definicja:
Consultify Finance & Intelligence Engine to moduł Consultify odpowiedzialny za import, normalizację, analizę, modelowanie, predykcję, wycenę, analizę inwestycyjną, raportowanie i audytowalne powiązanie danych finansowych z inicjatywami, KPI, ROI i rezultatami transformacji.
6. Architektura logiczna
Source Document / ERP / Spreadsheet / Manual Input
  ↓
Statement Import Engine
  ↓
Ingestion Pipeline / OCR / Parser
  ↓
Statement Normalization Engine
  ↓
Financial Data Quality Gate
  ↓
Statement Approval Engine
  ↓
Financial Model Engine
  ↓
Assumptions Governance
  ↓
Financial Analysis Engine
  ↓
Prediction / Forecast Engine
  ↓
Valuation Engine
  ↓
Investment Analysis Engine
  ↓
Finance Linkage Engine
  ↓
Reports Engine
  ↓
Audit Trail
  ↓
CFO / CEO / Board / Investor Dashboards
  ↓
Results / ROI / Initiatives / Execution Hub
Core Consultify — budować samodzielnie
Statement Import Engine
Ingestion Monitor
Statement Normalization Engine
Financial Data Quality Gate
Statement Approval Engine
Financial Model Engine
Assumptions Governance
Financial Analysis Engine
Prediction Engine
Valuation Engine
Investment Analysis Engine
Finance Linkage Engine
AI Finance Analyst
Finance Reports Engine
Finance Audit Log
Client/Internal Reporting Mode
Integracje zewnętrzne
ERP: SAP, Oracle, Dynamics, NetSuite
Accounting: QuickBooks, Xero, Sage Intacct
BI: Power BI, Tableau, Looker
Spreadsheets: Excel, Google Sheets
OCR: Azure AI Document Intelligence, Google Document AI, AWS Textract
Market data: Capital IQ, PitchBook, FactSet, Bloomberg, LSEG
Public filings: SEC EDGAR API, ESPI/KRS, local registries
LLM providers
Document repositories
7. Główne obiekty systemu
Poniżej model pojęciowy w wersji implementacyjnej.
A. FinancialStatement
{
  "statement_id": "stm_001",
  "organization_id": "org_dbr77",
  "entity_name": "DBR77 Manufacturing",
  "statement_type": "FULL_STATEMENT",
  "period_type": "FY",
  "fiscal_year": 2025,
  "fiscal_period": "FY2025",
  "currency": "PLN",
  "completeness": {
    "pl": true,
    "balance_sheet": true,
    "cash_flow": true,
    "notes": false
  },
  "status": "APPROVED",
  "docs_count": 2,
  "source_documents": ["doc_001", "doc_002"],
  "ingestion_status": "GATE_PASSED",
  "approval_status": "APPROVED",
  "created_at": "2026-04-20T10:00:00Z",
  "updated_at": "2026-04-20T12:00:00Z",
  "last_analyzed_at": "2026-04-21T09:00:00Z"
}
B. StatementDocument
{
  "document_id": "doc_001",
  "statement_id": "stm_001",
  "file_id": "file_abc",
  "file_name": "DBR77_FY2025_financial_statement.pdf",
  "file_type": "PDF",
  "source_type": "uploaded_pdf",
  "uploaded_by": "user_cfo",
  "uploaded_at": "2026-04-20T10:00:00Z",
  "parser_status": "PARSED",
  "extraction_confidence": 0.94,
  "detected_language": "pl",
  "detected_currency": "PLN",
  "detected_period": "FY2025",
  "pages_count": 48,
  "errors": [],
  "warnings": ["notes_not_detected"]
}
C. StatementLineItem
{
  "line_item_id": "li_001",
  "statement_id": "stm_001",
  "statement_section": "P&L",
  "standard_account": "revenue",
  "original_label": "Przychody netto ze sprzedaży",
  "normalized_label": "Revenue",
  "value": 12500000,
  "currency": "PLN",
  "period": "FY2025",
  "confidence_score": 0.97,
  "source_reference": {
    "document_id": "doc_001",
    "page": 12,
    "table": 2,
    "cell": "B14"
  },
  "mapping_status": "LINKED",
  "created_at": "2026-04-20T10:30:00Z"
}
D. FinancialModel
{
  "model_id": "fm_001",
  "organization_id": "org_dbr77",
  "statement_id": "stm_001",
  "model_name": "DBR77 FY2025 Base Three Statement Model",
  "model_type": "three_statement_model",
  "base_period": "FY2025",
  "forecast_periods": ["FY2026", "FY2027", "FY2028"],
  "currency": "PLN",
  "version": "v1.0",
  "status": "ASSUMPTIONS_REQUIRED",
  "owner_id": "user_cfo",
  "assumptions": ["asm_001", "asm_002"],
  "linked_initiatives": ["init_001"],
  "linked_kpis": ["kpi_ebitda_margin"],
  "linked_roi_models": ["roi_001"],
  "created_at": "2026-04-21T08:00:00Z",
  "updated_at": "2026-04-21T09:00:00Z"
}
E. ModelAssumption
{
  "assumption_id": "asm_001",
  "model_id": "fm_001",
  "name": "Revenue growth",
  "description": "Annual revenue growth in base scenario",
  "category": "revenue",
  "value": 0.18,
  "unit": "percent",
  "source": "management_approved",
  "confidence": 0.8,
  "scenario": "base",
  "owner_id": "user_cfo",
  "approval_status": "PENDING",
  "created_at": "2026-04-21T08:20:00Z",
  "updated_at": "2026-04-21T08:20:00Z"
}
F. FinancialAnalysis
{
  "analysis_id": "fa_001",
  "model_id": "fm_001",
  "statement_id": "stm_001",
  "analysis_type": "profitability_liquidity_leverage_cashflow",
  "period": "FY2025",
  "ratios": {
    "gross_margin": 0.42,
    "ebitda_margin": 0.16,
    "current_ratio": 1.7,
    "net_debt_to_ebitda": 2.1
  },
  "trends": ["revenue_growth_positive", "working_capital_pressure"],
  "variances": [],
  "anomalies": ["inventory_days_increased"],
  "ai_summary": "Company improved revenue and EBITDA, but working capital consumed cash.",
  "recommendations": ["review_inventory_policy", "link_working_capital_initiative"],
  "confidence_score": 0.86,
  "created_by": "ai_finance_analyst",
  "created_at": "2026-04-21T09:00:00Z"
}
G. ForecastScenario
{
  "scenario_id": "scn_001",
  "model_id": "fm_001",
  "name": "Base Case",
  "scenario_type": "base",
  "assumptions": ["asm_001", "asm_002"],
  "revenue_forecast": {
    "FY2026": 14750000,
    "FY2027": 17100000
  },
  "cost_forecast": {
    "FY2026": 11100000,
    "FY2027": 12600000
  },
  "ebitda_forecast": {
    "FY2026": 2450000,
    "FY2027": 3100000
  },
  "cash_flow_forecast": {
    "FY2026": 1200000,
    "FY2027": 1900000
  },
  "working_capital_forecast": {
    "FY2026": 2600000
  },
  "capex_forecast": {
    "FY2026": 900000
  },
  "probability": 0.55,
  "created_at": "2026-04-21T10:00:00Z"
}
H. ValuationModel
{
  "valuation_id": "val_001",
  "organization_id": "org_dbr77",
  "model_id": "fm_001",
  "valuation_method": "DCF_AND_MULTIPLES",
  "valuation_date": "2026-04-22",
  "enterprise_value": 42000000,
  "equity_value": 36000000,
  "dcf_value": 44000000,
  "multiple_value": 40000000,
  "assumptions": ["wacc_001", "terminal_growth_001", "multiple_001"],
  "wacc": 0.13,
  "terminal_growth": 0.03,
  "ebitda_multiple": 12.5,
  "revenue_multiple": 3.2,
  "sensitivity_tables": ["sens_001"],
  "status": "UNDER_REVIEW",
  "approved_by": null,
  "created_at": "2026-04-22T08:00:00Z"
}
I. InvestmentAnalysis
{
  "investment_analysis_id": "ia_001",
  "organization_id": "org_dbr77",
  "project_id": "proj_001",
  "initiative_id": "init_automation_001",
  "investment_name": "Robotization of assembly line",
  "investment_type": "capex_automation",
  "investment_cost": 1200000,
  "expected_return": 2100000,
  "npv": 620000,
  "irr": 0.27,
  "payback_period": 2.4,
  "risk_score": 0.35,
  "strategic_fit": 0.82,
  "recommendation": "GO",
  "ai_investment_memo": "Investment is financially attractive under base case.",
  "approval_status": "PENDING_CFO",
  "created_at": "2026-04-22T09:00:00Z"
}
J. FinancialDeviation
{
  "deviation_id": "dev_001",
  "object_type": "forecast_scenario",
  "object_id": "scn_001",
  "period": "Q1_2026",
  "metric": "EBITDA",
  "planned_value": 600000,
  "actual_value": 420000,
  "deviation_value": -180000,
  "deviation_percent": -0.30,
  "severity": "HIGH",
  "root_cause": "higher_material_costs_and_lower_utilization",
  "ai_explanation": "EBITDA variance is mainly caused by gross margin decline and fixed cost absorption.",
  "proposed_actions": ["review_pricing", "launch_cost_reduction_initiative"],
  "owner_id": "user_controller",
  "status": "OPEN",
  "created_at": "2026-04-25T08:00:00Z",
  "resolved_at": null
}
K. FinanceLinkage
{
  "linkage_id": "fl_001",
  "source_object_type": "financial_deviation",
  "source_object_id": "dev_001",
  "target_object_type": "initiative",
  "target_object_id": "init_cost_reduction_001",
  "link_type": "explains_or_requires_action",
  "confidence": 0.78,
  "created_by": "ai_finance_analyst",
  "created_at": "2026-04-25T08:10:00Z"
}
L. IngestionJob
{
  "ingestion_job_id": "ing_001",
  "statement_id": "stm_001",
  "status": "COMPLETED",
  "stage": "GATE_PASSED",
  "parser_version": "v8",
  "started_at": "2026-04-20T10:01:00Z",
  "completed_at": "2026-04-20T10:12:00Z",
  "failed_at": null,
  "errors": [],
  "recovery_required": false,
  "gate_pass": true,
  "linked_items_count": 145,
  "unlinked_items_count": 3,
  "stale_flag": false
}
M. FinanceAuditLog
{
  "audit_log_id": "audit_001",
  "object_type": "model_assumption",
  "object_id": "asm_001",
  "action": "UPDATE_VALUE",
  "before_state": {
    "value": 0.15
  },
  "after_state": {
    "value": 0.18
  },
  "actor_id": "user_cfo",
  "source": "manual_edit",
  "timestamp": "2026-04-21T08:25:00Z",
  "risk_level": "MEDIUM"
}
8. Kluczowe moduły funkcjonalne
A. Finance Home / Statements View
Widok startowy, który już widać w demo: Finance > Statements.
Elementy:
zakładki: Statements, Modele, Analiza, Predykcja, Wycena przedsiębiorstw, Analiza inwestycyjna;
status chips: Wszystkie, Rejected Imports, Recovery Queue, Ready Statements, V8 Ingestion, Escalations, Linkages, Gate pass 100%, Unlinked, Stale;
tabela statementów: Typ, Name, Completeness, Okres, Currency, Docs, Status, Aktualizacja;
akcje: + Importuj statement, Analyze, AI assistant, view switch, filters;
statement health: completeness, source confidence, unlinked items, stale flag, approval status.
To musi być ekran decyzyjny, nie katalog plików.
B. Statement Ingestion Engine
Obsługuje:
upload PDF / Excel / CSV / image;
manual entry;
OCR;
table detection;
parser v8;
language detection;
currency detection;
period detection;
statement type detection;
line item extraction;
source reference;
warnings/errors;
recovery queue.
C. Statement Normalization Engine
Obsługuje:
mapowanie original labels do standard accounts;
P&L / Balance Sheet / Cash Flow mapping;
chart of accounts mapping;
currency normalization;
period normalization;
unit normalization: PLN, kPLN, mPLN, EUR, USD;
duplicate detection;
missing statement detection;
completeness score.
D. Financial Data Quality & Gate Engine
Statusy z UI powinny mieć konkretne znaczenie:
Status	Znaczenie	Akcja
Rejected Imports	import odrzucony przez format, brak danych, uszkodzony plik, brak tabel	popraw plik / ręczna korekta
Recovery Queue	parser ma niską pewność lub brakuje danych	AI/user recovery
Ready Statements	statement przeszedł ingestion i może być analizowany	analyze / model
V8 Ingestion	aktywny pipeline parsera	monitoruj
Escalations	problem jakościowy wymaga człowieka	assign task
Linkages	statement ma powiązania z modelami, KPI, ROI, initiatives	review links
Gate pass 100%	import spełnił kryteria jakości	approve
Unlinked	są line items bez mapowania	resolve
Stale	dane przestarzałe względem okresu lub modelu	update
E. Financial Models Engine
Modele:
three-statement model;
revenue model;
cost model;
EBITDA model;
working capital model;
debt model;
capex model;
business case model;
fundraising model;
valuation model.
Funkcje:
model templates;
model creation from approved statement;
assumptions;
scenario manager;
versioning;
model comparison;
source references;
calculation audit.
F. Financial Analysis Engine
Analizy:
profitability;
liquidity;
leverage;
working capital;
cash conversion;
cash flow;
margin bridge;
cost structure;
trend;
variance;
anomaly;
benchmark.
G. Prediction / Forecast Engine
Obsługuje:
revenue forecast;
COGS forecast;
EBITDA forecast;
cash flow forecast;
working capital forecast;
capex forecast;
debt forecast;
conservative / base / aggressive;
forecast vs actual;
confidence bands;
forecast explanation.
H. Company Valuation Engine
Metody:
DCF;
revenue multiple;
EBITDA multiple;
precedent transactions;
book value;
venture method;
scenario-weighted valuation.
Musi pokazywać:
assumptions;
WACC;
terminal growth;
multiple ranges;
sensitivity tables;
valuation range;
AI valuation memo;
source confidence.
I. Investment Analysis Engine
Obsługuje:
capex case;
automation investment;
AI project business case;
acquisition / M&A;
product investment;
market expansion;
fundraising use of funds.
Metryki:
NPV;
IRR;
payback;
ROI;
risk score;
strategic fit;
go/no-go recommendation.
J. AI Finance Analyst
AI nie jest „copywriterem finansowym”. AI jest analitykiem.
Role AI:
AI Statement Reader — czyta statement, rozpoznaje sekcje, okresy, waluty.
AI Data Quality Controller — wykrywa braki, unlinked items, stale data.
AI Financial Analyst — analizuje rentowność, płynność, zadłużenie, cash flow.
AI Variance Analyst — wyjaśnia actual vs budget / forecast / prior year.
AI Forecast Analyst — proponuje scenariusze i założenia.
AI Valuation Analyst — tworzy DCF, multiples, sensitivity.
AI Investment Analyst — tworzy investment memo.
AI CFO Narrator — pisze komentarz CFO-ready.
AI Governance Assistant — pilnuje źródeł, confidence, assumptions, approvals.
AI musi zawsze rozróżniać:
imported;
extracted;
normalized;
calculated;
forecasted;
estimated;
inferred;
approved;
audited.
9. Docelowe widoki systemu
A. Finance Overview
Pokazuje od razu:
total statements;
approved statements;
incomplete statements;
rejected imports;
recovery queue;
stale statements;
unlinked items;
models created;
analyses generated;
pending approvals;
AI finance insights;
top 5 anomalies;
top 5 financial risks.
B. Statements View
Kolumny:
Typ;
Name;
Completeness;
Period;
Currency;
Docs;
Source confidence;
Ingestion status;
Approval status;
Last update;
Action menu.
Akcje:
import statement;
analyze;
create model;
view source;
resolve unlinked;
approve;
archive.
C. Statement Detail View
Sekcje:
P&L;
Balance Sheet;
Cash Flow;
Notes;
Source documents;
Extracted line items;
Mapping status;
Missing items;
Anomalies;
Comments;
Approval history;
AI explanation.
D. Ingestion Monitor View
Pokazuje:
import jobs;
parser version;
stage;
recovery queue;
rejected imports;
gate pass;
line items count;
unlinked items;
stale warnings;
parser errors.
E. Models View
Pokazuje:
lista modeli;
model type;
linked statement;
owner;
version;
assumptions status;
approval status;
forecast periods;
last update.
F. Model Detail View
Zawiera:
three-statement model;
drivers;
assumptions;
scenarios;
forecast;
linked initiatives;
linked ROI;
version history;
AI commentary;
audit log.
G. Analysis View
Zawiera:
profitability;
liquidity;
leverage;
cash flow;
working capital;
ratios;
trends;
variance;
anomalies;
recommendations.
H. Prediction View
Zawiera:
scenarios;
revenue forecast;
EBITDA forecast;
cash flow forecast;
confidence bands;
assumptions;
AI forecast explanation;
forecast vs actual.
I. Valuation View
Zawiera:
DCF;
multiples;
enterprise value;
equity value;
WACC;
terminal value;
sensitivity tables;
valuation range;
AI valuation memo.
J. Investment Analysis View
Zawiera:
investment cases;
NPV;
IRR;
payback;
risk score;
strategic fit;
recommendation;
approval status;
investment memo.
K. Finance Reports View
Zawiera:
CFO report;
CEO brief;
board report;
investor report;
valuation report;
financial due diligence report;
business case update;
export history;
approvals.
L. Finance Governance View
Zawiera:
source quality;
stale data;
unlinked items;
rejected imports;
missing statements;
model versions;
assumption changes;
audit log;
permission issues.
10. Workflow użytkownika — 30 workflow
Workflow 1: Import financial statement
Trigger: użytkownik klika + Importuj statement.
Role: CFO, controller, consultant.
Input: PDF, Excel, CSV, image, manual.
Kroki: upload → metadata → parser → preview → save.
AI role: rozpoznaje typ, okres, walutę, sekcje.
Output: FinancialStatement + StatementDocument.
Ryzyko: błędny format.
Acceptance criteria: statement ma status Uploaded lub In Ingestion.
Workflow 2: V8 ingestion pipeline
Trigger: nowy dokument.
Kroki: queued → OCR → extraction → mapping → validation → gate.
AI role: klasyfikuje i wyjaśnia błędy.
Output: line items + confidence.
Acceptance criteria: system pokazuje parser version, stage, errors.
Workflow 3: Recovery Queue
Trigger: confidence poniżej progu.
Kroki: system tworzy recovery item → AI proponuje korektę → user akceptuje.
Output: corrected line item.
Acceptance criteria: item wychodzi z recovery po zatwierdzeniu.
Workflow 4: Rejected Import
Trigger: brak danych / uszkodzony plik / nieobsługiwany format.
Output: rejected import z powodem.
Acceptance criteria: user widzi jasny powód i możliwe działania.
Workflow 5: Statement completeness check
Trigger: ingestion completed.
System sprawdza P&L, BS, CF.
Output: completeness chip.
Acceptance criteria: brakujące sekcje są oznaczone.
Workflow 6: Statement approval
Trigger: statement ready.
User zatwierdza.
AI role: pokazuje ryzyka przed approvalem.
Output: Approved statement.
Acceptance criteria: audit log zapisuje approval.
Workflow 7: Mapping line items
Trigger: extracted line items.
AI mapuje original labels do standard accounts.
User zatwierdza wyjątki.
Output: normalized statement.
Acceptance criteria: każdy item ma mapping_status.
Workflow 8: Unlinked items resolution
Trigger: istnieją unlinked items.
AI proponuje mapping.
User akceptuje / tworzy custom account.
Output: linked item.
Acceptance criteria: liczba unlinked spada.
Workflow 9: Stale statement detection
Trigger: nowy okres / stary model / brak update.
Output: stale flag.
Acceptance criteria: system wyjaśnia, dlaczego dane są stale.
Workflow 10: Create financial model from statement
Trigger: approved statement.
User wybiera template.
Output: FinancialModel.
Acceptance criteria: model ma linked statement.
Workflow 11: Build three-statement model
Trigger: create model.
System buduje P&L / BS / CF.
Output: model base.
Acceptance criteria: statement sections są połączone.
Workflow 12: Add model assumptions
Trigger: model wymaga forecast.
User/AI dodaje assumptions.
Output: assumptions list.
Acceptance criteria: każda assumption ma owner, source, status.
Workflow 13: Run financial analysis
Trigger: Analyze.
AI liczy ratios, trends, risks.
Output: FinancialAnalysis.
Acceptance criteria: analiza ma source references.
Workflow 14: Detect financial anomaly
Trigger: analysis run / scheduled monitor.
System wykrywa odchylenie.
Output: anomaly + severity.
Acceptance criteria: anomaly ma explanation i recommended action.
Workflow 15: Variance analysis
Trigger: actual vs forecast / budget / prior year.
Output: variance bridge.
Acceptance criteria: variance ma driver explanation.
Workflow 16: Generate CFO commentary
Trigger: analysis completed.
AI generuje komentarz.
Output: CFO-ready summary.
Acceptance criteria: komentarz zawiera liczby, źródła, ryzyka.
Workflow 17: Create forecast scenario
Trigger: user tworzy conservative/base/aggressive.
Output: scenario.
Acceptance criteria: scenario ma assumptions i probability.
Workflow 18: Prediction run
Trigger: forecast scenario.
System prognozuje revenue, EBITDA, cash flow.
Acceptance criteria: forecast ma confidence bands.
Workflow 19: Valuation DCF
Trigger: valuation view.
User wybiera DCF.
Output: DCF valuation.
Acceptance criteria: valuation ma WACC, terminal value, sensitivity.
Workflow 20: Comparable valuation
Trigger: user wybiera comps.
Output: multiples valuation.
Acceptance criteria: multiples mają źródła i zakres.
Workflow 21: Sensitivity analysis
Trigger: valuation / investment case.
Output: sensitivity table.
Acceptance criteria: zmiana WACC/growth/multiple wpływa na value.
Workflow 22: Investment analysis
Trigger: nowa inicjatywa / capex / automation.
Output: NPV, IRR, payback, risk score.
Acceptance criteria: go/no-go ma uzasadnienie.
Workflow 23: Link finance to initiative / ROI
Trigger: model lub business case.
Output: FinanceLinkage.
Acceptance criteria: initiative pokazuje financial impact.
Workflow 24: Generate board report
Trigger: report request.
Output: board pack.
Acceptance criteria: raport ma executive summary, charts, assumptions.
Workflow 25: Generate investor-ready financial pack
Trigger: fundraising / investor request.
Output: investor financial pack.
Acceptance criteria: client/internal notes są odfiltrowane.
Workflow 26: Client-ready finance report
Trigger: export client mode.
Output: PDF/Word/PPT.
Acceptance criteria: internal-only notes nie są widoczne.
Workflow 27: Model version comparison
Trigger: user wybiera dwie wersje.
Output: diff.
Acceptance criteria: system pokazuje zmiany assumptions i wyników.
Workflow 28: Assumption approval
Trigger: assumption pending.
CFO zatwierdza.
Output: approved assumption.
Acceptance criteria: audit log zapisuje approver/date.
Workflow 29: Audit financial model
Trigger: governance review.
Output: audit trail.
Acceptance criteria: można prześledzić źródła, zmiany, approvals.
Workflow 30: Closed-loop finance to Results
Trigger: realized ROI.
Finance zasila Results.
Output: verified benefits.
Acceptance criteria: ROI ma źródło finansowe i evidence.
11. AI jako Financial Analyst / CFO Copilot
Zasada główna
AI w Finance musi działać jak analityk finansowy z dyscypliną audytową, a nie jak chatbot od opisów.
AI musi umieć odpowiadać na pytania typu:
Czy statement jest kompletny?
Czy mamy P&L, BS i CF?
Jakie line items nie zostały zmapowane?
Co się zmieniło w EBITDA margin?
Dlaczego cash flow jest gorszy niż EBITDA?
Czy wzrost sprzedaży generuje gotówkę?
Czy working capital pogarsza płynność?
Które assumptions najbardziej wpływają na valuation?
Czy business case inicjatywy nadal się broni?
Czy ROI zrealizowane jest potwierdzone financial evidence?
Co CFO powinien powiedzieć zarządowi?
AI guardrails
AI nie może:
wymyślać liczb;
mieszać actuals z forecast;
ukrywać assumptions;
robić valuation bez sensitivity;
robić rekomendacji inwestycyjnej bez ryzyka;
zatwierdzać danych bez approvalu człowieka;
pokazywać clientowi internal-only notes;
ignorować niskiego confidence score.
12. Wymagania funkcjonalne — lista skondensowana 140 wymagań
Poniżej lista wymagań w formacie: nazwa — priorytet — acceptance criterion.
Import, ingestion, OCR, parser
Import PDF — P0 — użytkownik może dodać PDF statementu.
Import Excel — P0 — system importuje arkusz statementu.
Import CSV — P1 — system importuje dane tabelaryczne.
Import image — P2 — system przyjmuje skan/obraz.
Manual entry — P1 — użytkownik może ręcznie dodać statement.
Upload metadata — P0 — user podaje entity, period, currency.
OCR processing — P0 — system odczytuje dane z PDF/skanu.
Table extraction — P0 — system wykrywa tabele finansowe.
Parser status — P0 — user widzi etap parsera.
Ingestion job — P0 — każdy import tworzy job.
Parser version — P1 — job zapisuje wersję parsera.
V8 ingestion support — P0 — UI pokazuje V8 ingestion.
Recovery Queue — P0 — błędne importy trafiają do kolejki.
Rejected Imports — P0 — system odrzuca niepoprawne pliki z powodem.
Ready Statements — P0 — system oznacza statement gotowy do analizy.
Gate pass — P0 — statement przechodzi data quality gate.
Linkages status — P1 — system pokazuje powiązania statementu.
Unlinked status — P0 — system pokazuje line items bez mapowania.
Stale status — P0 — system wykrywa przestarzałe dane.
Ingestion monitor — P1 — user widzi wszystkie joby.
Rozpoznawanie statementu
P&L detection — P0 — system wykrywa rachunek wyników.
Balance Sheet detection — P0 — system wykrywa bilans.
Cash Flow detection — P0 — system wykrywa cash flow.
Notes detection — P2 — system wykrywa noty.
Currency detection — P0 — system rozpoznaje walutę.
Period detection — P0 — system rozpoznaje okres.
Fiscal year support — P0 — obsługa roku fiskalnego.
Language detection — P1 — system rozpoznaje język.
Unit detection — P0 — system rozróżnia PLN/kPLN/mPLN.
Statement type detection — P0 — system klasyfikuje typ dokumentu.
Normalizacja i jakość danych
Source document attachment — P0 — każdy statement ma źródła.
Extraction confidence — P0 — każda ekstrakcja ma confidence.
Source reference — P0 — line item wskazuje stronę/tabelę/komórkę.
Original label preservation — P0 — zachowujemy oryginalną etykietę.
Normalize line item — P0 — system mapuje do standard account.
Chart of accounts mapping — P0 — obsługa mapowania kont.
Custom account mapping — P1 — user może dodać własne konto.
Duplicate detection — P1 — system wykrywa duplikaty.
Missing data detection — P0 — system oznacza braki.
Completeness score — P0 — statement ma scoring kompletności.
Reconciliation check — P1 — system sprawdza sumy.
Currency normalization — P0 — wartości są normalizowane do waluty modelu.
Period normalization — P0 — dane są porównywalne okresowo.
Mapping approval — P1 — user zatwierdza mapowania.
Data validation rules — P0 — system odpala reguły walidacyjne.
Statement lifecycle
Statement draft — P0 — statement może być draft.
Statement uploaded — P0 — status po uploadzie.
Statement parsed — P0 — status po parserze.
Statement normalized — P0 — status po normalizacji.
Statement linked — P0 — status po linkingach.
Statement under review — P0 — status review.
Statement approved — P0 — user zatwierdza statement.
Statement rejected — P0 — user/system odrzuca statement.
Statement archived — P1 — user archiwizuje statement.
Statement versioning — P0 — kolejne wersje są zachowane.
Statement audit log — P0 — zmiany są logowane.
Approval history — P0 — system pokazuje historię approvali.
Statement health card — P1 — health summary w detail view.
Statement compare periods — P1 — porównanie okresów.
Statement export table — P1 — eksport tabeli statementu.
Modele finansowe
Create financial model — P0 — user tworzy model.
Create from statement — P0 — model z approved statement.
Three-statement model — P0 — P&L/BS/CF linked.
Revenue model — P0 — model przychodów.
Cost model — P0 — model kosztów.
Working capital model — P0 — model WC.
Debt model — P1 — model zadłużenia.
Capex model — P1 — model inwestycji.
EBITDA model — P0 — model EBITDA.
Business case model — P0 — model inicjatywy.
Fundraising model — P2 — model rundy finansowania.
Model template library — P1 — user wybiera template.
Model assumptions — P0 — model ma assumptions.
Assumption categories — P0 — assumptions mają kategorie.
Assumption source — P0 — assumption ma źródło.
Assumption confidence — P0 — assumption ma confidence.
Assumption owner — P0 — assumption ma ownera.
Assumption approval — P0 — CFO zatwierdza.
Assumption versioning — P0 — zmiany są wersjonowane.
Model versioning — P0 — model ma wersje.
Model comparison — P1 — porównanie wersji.
Model audit log — P0 — zmiany są logowane.
Model lock after approval — P1 — zatwierdzona wersja może być lock.
Model clone — P1 — user tworzy kopię modelu.
Model scenario manager — P0 — model obsługuje scenariusze.
Analiza finansowa
Ratio analysis — P0 — system liczy ratios.
Profitability analysis — P0 — marże, EBITDA, EBIT.
Liquidity analysis — P0 — current ratio, quick ratio.
Leverage analysis — P0 — debt, net debt/EBITDA.
Working capital analysis — P0 — DSO/DPO/DIO.
Cash flow analysis — P0 — CFO/FCF/cash conversion.
Margin analysis — P0 — margin bridge.
Cost structure analysis — P1 — fixed/variable/cost buckets.
Trend analysis — P0 — YoY/QoQ.
Variance analysis — P0 — actual vs budget/forecast/prior.
Anomaly detection — P0 — system wykrywa anomalie.
AI financial explanation — P0 — AI wyjaśnia wyniki.
AI CFO commentary — P0 — AI pisze komentarz CFO-ready.
Recommendations — P1 — system proponuje działania.
Create task from anomaly — P1 — anomalia tworzy task.
Forecast, prediction, scenario
Create forecast — P0 — user tworzy forecast.
Forecast revenue — P0 — prognoza revenue.
Forecast costs — P0 — prognoza kosztów.
Forecast EBITDA — P0 — prognoza EBITDA.
Forecast cash flow — P0 — prognoza cash flow.
Forecast working capital — P1 — prognoza WC.
Forecast capex — P1 — prognoza capex.
Scenario planning — P0 — conservative/base/aggressive.
Sensitivity analysis — P0 — tabela wrażliwości.
Confidence bands — P1 — forecast ma zakresy.
Forecast vs actual — P0 — porównanie forecast z actual.
Prediction explanation — P0 — AI wyjaśnia forecast.
Driver-based forecast — P1 — forecast oparty o drivers.
Scenario probability — P1 — prawdopodobieństwo scenariusza.
Scenario comparison — P1 — porównanie scenariuszy.
Valuation
Create DCF valuation — P0 — system tworzy DCF.
Calculate WACC — P0 — system liczy / przyjmuje WACC.
Terminal value — P0 — terminal value.
Enterprise value — P0 — EV.
Equity value — P0 — equity value.
Comparable company analysis — P1 — comps.
Precedent transactions — P2 — transakcje porównawcze.
Revenue multiple — P1 — valuation revenue multiple.
EBITDA multiple — P1 — valuation EBITDA multiple.
Valuation sensitivity — P0 — sensitivity.
Valuation range — P0 — min/base/max.
Valuation memo — P0 — AI valuation memo.
Valuation approval — P1 — approval wyceny.
Valuation audit trail — P0 — historia assumptions.
Export valuation report — P1 — raport PDF/Word/PPT.
Investment analysis, reporting, linkages, governance
Create investment analysis — P0 — user tworzy case.
NPV — P0 — system liczy NPV.
IRR — P0 — system liczy IRR.
Payback — P0 — system liczy payback.
Investment risk score — P1 — scoring ryzyka.
Strategic fit score — P1 — scoring strategiczny.
Investment memo — P0 — AI tworzy memo.
Go/no-go recommendation — P0 — rekomendacja z uzasadnieniem.
Link finance to initiative — P0 — dane finansowe łączą się z inicjatywą.
Link finance to KPI/ROI/Results — P0 — financial evidence zasila Results.
Link finance to document — P1 — statement/model jako źródło dokumentu.
Link finance to presentation — P1 — board deck z danych finance.
Link finance to table — P1 — eksport do Tables.
Link finance to task — P1 — task z odchylenia.
Link finance to decision — P1 — decyzja oparta o analysis.
CFO dashboard — P0 — dashboard CFO.
CEO dashboard — P1 — dashboard CEO.
Board dashboard — P1 — dashboard board.
Investor dashboard — P1 — dashboard investor.
Finance governance dashboard — P0 — jakość, źródła, approvale.
Source traceability — P0 — każda liczba ma źródło.
Data lineage — P0 — ścieżka danych.
Role-based access — P0 — uprawnienia.
Internal/client mode — P0 — filtrowanie treści.
Export Word/PDF/PPT/Excel — P0 — eksport artifacts.
Export history — P1 — historia eksportów.
Recurring reports — P1 — cykliczne raporty.
Notifications — P1 — alerty i inbox.
Tenant isolation — P0 — separacja klientów.
AI hallucination guard — P0 — AI nie tworzy liczb bez źródeł.
13. Wymagania niefunkcjonalne
Wymaganie	Dlaczego ważne
Import statementu < 60 sekund dla typowego PDF	CFO nie będzie czekał jak w ciężkim ERP
Stabilny ingestion pipeline	import jest fundamentem zaufania
OCR accuracy > 95% dla czytelnych dokumentów	błędne liczby niszczą wiarygodność
Table extraction confidence	tabele finansowe są krytyczne
Retry mechanism	parsery zawodzą, system musi się podnosić
Recovery queue reliability	błędy mają być obsługiwane procesowo
Brak utraty historii	finance bez historii jest nieaudytowalny
Dokładność kalkulacji	valuation i NPV nie tolerują błędów
Reconciliation checks	suma aktywów/pasywów i cash flow muszą się zgadzać
Multi-currency	realne firmy działają międzynarodowo
Fiscal calendars	rok fiskalny nie zawsze = kalendarzowy
Assumptions versioning	zmiana assumption zmienia cały model
Model versioning	zarząd musi wiedzieć, którą wersję zatwierdził
Source traceability	każda liczba musi mieć źródło
Auditability	warunek enterprise i due diligence
Role-based permissions	finance jest wrażliwy
Tenant isolation	dane klientów muszą być odseparowane
Client/internal separation	konsultanci mają notatki, których klient nie widzi
Data privacy	dane finansowe są strategiczne
AI explanation quality	AI musi wyjaśniać, nie tylko generować tekst
Hallucination prevention	AI nie może wymyślać liczb
Confidence scoring	użytkownik musi widzieć ryzyko danych
Export reliability	raporty są produktem końcowym
Multilingual reporting	PL/EN dla klientów międzynarodowych
Observability	dev/QA muszą widzieć błędy pipeline
Testability	kalkulacje i statusy muszą mieć testy automatyczne
Compliance readiness	system musi być gotowy na audyt i kontrolę
14. Statusy i lifecycle
Statement lifecycle
Status	Znaczenie	Wejście	Wyjście
Draft	metadata bez pełnego dokumentu	manual start	upload
Uploaded	plik dodany	upload	ingestion
In Ingestion	parser działa	job queued	parsed/rejected
Parsed	dane wyciągnięte	OCR/extraction done	normalized
Needs Recovery	problem jakości	low confidence	corrected
Rejected	import niepoprawny	validation fail	reimport
Normalized	dane zmapowane	mapping complete	linked
Linked	dane połączone z modelami/objects	linkage done	ready
Ready	gotowy do analizy	gate pass	review
Under Review	czeka na człowieka	user review	approved/rejected
Approved	zatwierdzony	approval	model/analysis
Stale	przestarzały	new period/model change	update
Archived	zamknięty	archive	restore
Ingestion statuses
Queued → Processing → OCR Running → Extraction Running → Mapping Running → Validation Running → Recovery Required → Failed / Completed → Gate Passed
Model statuses
Draft Model → Data Linked → Assumptions Required → Under Review → Approved → Forecast Active → Archived
Analysis statuses
Not Started → Running → Completed → Needs Review → Approved → Outdated
Valuation statuses
Draft Valuation → Assumptions Missing → Under Review → Approved → Rejected → Investor Ready
Investment analysis statuses
Draft → Data Required → Analysis Running → Under Review → Recommended / Not Recommended → Approved / Rejected
15. Źródła danych i zaufanie
Source types
uploaded PDF;
uploaded Excel;
uploaded CSV;
manual input;
ERP;
accounting system;
finance system;
BI system;
bank statement;
investor report;
board report;
audit report;
public filing;
market database;
external benchmark;
Consultify table;
Consultify document;
AI inference.
Source trust levels
Poziom	Znaczenie
Audited financial statement	najwyższe zaufanie
ERP verified	dane z systemu źródłowego
Finance-approved	zatwierdzone przez finance
Controller-approved	zatwierdzone przez controlling
Board-approved	zatwierdzone przez zarząd
Uploaded source	user upload, jeszcze niezatwierdzony
User-declared	deklaracja użytkownika
AI-inferred	wniosek AI, nie fakt
External benchmark	dane z rynku
Unverified	brak weryfikacji
Zasada: AI-inferred nigdy nie może być traktowane jak audited.
16. Dashboardy
A. CFO Finance Dashboard
Pokazuje:
revenue;
gross margin;
EBITDA;
EBITDA margin;
cash flow;
working capital;
debt;
forecast vs actual;
variance;
anomalies;
AI CFO summary.
Cel: CFO widzi, co wymaga decyzji.
B. CEO Finance Dashboard
Pokazuje:
financial health;
growth;
profitability;
cash runway;
investment capacity;
risks;
valuation range;
strategic finance insights.
Cel: CEO rozumie kondycję firmy i priorytety.
C. Board / Investor Dashboard
Pokazuje:
headline financials;
historical trends;
forecast;
valuation;
key risks;
investment highlights;
use of funds;
AI-generated investor narrative.
Cel: spójność komunikacji z zarządem i inwestorami.
D. Finance Governance Dashboard
Pokazuje:
statements imported;
approved statements;
rejected imports;
recovery queue;
unlinked items;
stale data;
models under review;
assumptions without approval;
audit issues.
Cel: CFO widzi jakość systemu finansowego.
E. Valuation Dashboard
Pokazuje:
DCF range;
multiple valuation;
scenario valuation;
sensitivity;
WACC;
terminal growth;
comparable companies;
AI valuation memo.
F. Investment Analysis Dashboard
Pokazuje:
investment cases;
NPV;
IRR;
payback;
risk score;
strategic fit;
recommendation;
approval status.
17. Relacje z innymi modułami Consultify
Results
Finance dostarcza financial evidence do verified benefits i realized ROI. Bez Finance Results ryzykuje bycie deklaratywnym.
Initiatives
Każda inicjatywa może mieć business case, investment analysis, expected impact, realized impact.
Execution Hub
Odchylenia finansowe tworzą taski, decyzje, escalation, właścicieli i terminy.
KPI / ROI
KPI finansowe i ROI powinny być liczone z zatwierdzonych danych Finance, nie z ręcznych deklaracji.
Documents
Finance generuje:
CFO report;
valuation memo;
investment memo;
financial due diligence report;
business case update.
Presentations
Finance generuje:
board deck;
investor deck;
valuation slides;
monthly performance review.
Tables
Finance może tworzyć tabele modelowe, variance tables, sensitivity tables, investment case tables.
Chat / Teresa
Teresa odpowiada na pytania finansowe, ale musi działać na zatwierdzonych źródłach i confidence score.
Workbench
Po lewej rozmowa, po prawej statement / model / valuation / report.
Outputs
Raporty finansowe, modele, analizy i prezentacje są artifactami z wersjami i source lineage.
18. Roadmapa MVP
MVP 1 — Finance Statements Foundation
Cel: zbudować solidny ekran Statements jako bazę.
Zakres:
Statements View;
Import statement metadata;
manual statement record;
P&L / BS / CF completeness;
period;
currency;
docs count;
status Approved;
filters/status chips;
empty states.
Poza zakresem:
OCR;
pełna normalizacja;
valuation;
forecast.
Ryzyka:
zrobienie tylko tabelki plików.
DoD:
user może dodać statement, oznaczyć kompletność, walutę, okres, status i zobaczyć go w tabeli.
MVP 2 — Ingestion & Normalization
Zakres:
upload PDF/Excel/CSV;
parser status;
extracted line items;
confidence score;
recovery queue;
rejected imports;
unlinked items;
gate pass.
DoD:
statement przechodzi od uploadu do normalized/ready albo recovery/rejected.
MVP 3 — Financial Analysis
Zakres:
ratio analysis;
profitability;
liquidity;
leverage;
cash flow;
trends;
variance;
anomaly;
AI commentary.
DoD:
user klika Analyze i dostaje CFO-grade analysis z liczbami i źródłami.
MVP 4 — Financial Models
Zakres:
three-statement model;
assumptions;
scenarios;
model versioning;
linked initiatives/ROI.
DoD:
approved statement tworzy model z assumptions i wersją.
MVP 5 — Prediction
Zakres:
revenue forecast;
EBITDA forecast;
cash flow forecast;
confidence bands;
scenario comparison;
forecast explanation.
DoD:
system generuje conservative/base/aggressive forecast i wyjaśnia drivers.
MVP 6 — Valuation
Zakres:
DCF;
multiples;
valuation range;
sensitivity;
valuation memo.
DoD:
user generuje valuation memo z assumptions i sensitivity.
MVP 7 — Investment Analysis
Zakres:
NPV;
IRR;
payback;
risk score;
strategic fit;
investment memo;
recommendation.
DoD:
inicjatywa ma business case i go/no-go recommendation.
MVP 8 — Finance Governance & Reporting
Zakres:
approvals;
audit trail;
data lineage;
CFO report;
board report;
investor report;
export Word/PDF/PPT/Excel;
client/internal mode.
DoD:
raport można wygenerować jako artifact z historią, źródłami i approvalami.
19. Ryzyka produktowe i decyzje architektoniczne
Ryzyko	Wpływ	Prawdopodobieństwo	Ograniczenie	Decyzja
Zbudujemy repozytorium plików	wysokie	wysokie	wymusić lifecycle statementu	Finance = engine, nie files
Brak normalization	wysokie	średnie	standard account model	budować Normalization Engine
Słaby OCR	wysokie	średnie	confidence + recovery	nie zatwierdzać bez gate
AI halucynuje liczby	krytyczne	średnie	source binding	AI nie generuje liczb bez source
Brak assumptions governance	wysokie	wysokie	assumptions as objects	każda assumption ma owner/source
Valuation bez sensitivity	wysokie	średnie	mandatory sensitivity	valuation incomplete bez sensitivity
Forecast bez explanation	wysokie	średnie	forecast commentary	forecast musi mieć drivers
Brak linku z Results	wysokie	średnie	FinanceLinkage	ROI musi mieć financial evidence
UX zbyt skomplikowany	wysokie	wysokie	progressive disclosure	Overview prosty, detail głęboki
Próba kopiowania ERP	wysokie	średnie	integracje zamiast ERP clone	ERP jako źródło
Próba kopiowania Bloomberga	wysokie	średnie	market data integrations	nie budować terminala
Brak client/internal mode	wysokie	średnie	content classification	export filtruje internal notes
Brak audit trail	krytyczne	niskie/średnie	audit log core	audit od MVP 2/3
Brak role permissions	krytyczne	średnie	RBAC	finance permission model
Brak obsługi walut	wysokie	średnie	currency layer	currency jako core object
Brak stale detection	średnie	wysokie	stale rules	stale chip w UI
Brak recovery queue	wysokie	średnie	queue jako widok	błędy nie mogą ginąć
Słabe eksporty	wysokie	średnie	integration with Outputs	report jako artifact
Brak wersjonowania modeli	wysokie	średnie	model versioning	każdy model ma wersję
Brak testów kalkulacji	krytyczne	średnie	financial calculation test suite	testy automatyczne dla formulas
20. Decyzja architektoniczna: ERP, FP&A, BI, Excel, Bloomberg czy własny Finance Engine?
Nie kopiować ERP
ERP obsługuje transakcje, księgowość, faktury, GL, AP, AR, tax, close. Consultify nie powinien tego robić. ERP ma być źródłem danych.
Nie kopiować FP&A 1:1
FP&A robi planning i forecasting. Consultify musi korzystać z tych wzorców, ale jego celem jest decyzja konsultingowa, business case, ROI, Results, report.
Nie kopiować BI
BI pokazuje liczby. Consultify ma wyjaśniać, co z nich wynika i jakie działanie należy podjąć.
Nie kopiować Excela
Excel jest elastyczny, ale nie ma naturalnego governance. Consultify powinien dać elastyczność modelowania, ale z audit trail i assumptions governance.
Nie kopiować Bloomberga / Capital IQ
Market data providers są źródłem danych do comps, benchmarków i valuation. Consultify powinien integrować dane rynkowe, a nie budować terminal.
Rekomendacja
Budujemy własny:
AI Financial Analysis & Modeling Engine
inspirowany FP&A, ERP, BI, Excel, financial research i valuation tools, ale podporządkowany consulting execution.
21. Finalna definicja produktu
Consultify Finance & Intelligence Engine to centralny system analizy finansowej Consultify, który łączy statementy, modele finansowe, analizę, predykcję, wycenę, analizę inwestycyjną, raportowanie i powiązanie z realnymi rezultatami transformacji.
Moduł pozwala importować P&L, Balance Sheet i Cash Flow z PDF, Excel, CSV, ERP lub ręcznego inputu. Dane przechodzą przez ingestion pipeline, OCR/parser, normalizację, mapping line items, completeness check, data quality gate i approval. Następnie system tworzy modele finansowe, zarządza assumptions, analizuje rentowność, płynność, zadłużenie, cash flow, working capital, trendy i odchylenia.
AI działa jako Financial Analyst / CFO Copilot: wykrywa braki, wyjaśnia odchylenia, proponuje assumptions, przygotowuje forecast, valuation, investment memo, CFO commentary, board report i investor-ready pack. System łączy dane finansowe z inicjatywami, KPI, ROI, Results, taskami, decyzjami, dokumentami, tabelami i prezentacjami.
Każda liczba ma source traceability, confidence score, lineage, wersję, status i audit trail. Moduł obsługuje role-based permissions, client/internal mode, approvals i export do Word/PDF/PPT/Excel.
Consultify Finance zamyka pętlę finansowego rozumowania: od statementu do decyzji, raportu i potwierdzenia efektów.
22. Najważniejsze zasady projektowe
Finance nie jest repozytorium plików — Finance jest systemem rozumowania finansowego.
Statement bez source nie jest wiarygodny.
Statement bez P&L / BS / CF completeness nie powinien być approved.
Import musi mieć recovery queue.
Dane wyekstrahowane muszą mieć confidence score.
Każdy line item musi mieć original label i normalized account.
Unlinked items są ryzykiem jakości danych.
Stale data musi być widoczne.
Model finansowy bez assumptions nie jest modelem.
Assumptions muszą mieć ownera, źródło, confidence i wersję.
Forecast musi mieć explanation.
Valuation bez sensitivity jest niepełna.
Investment analysis musi pokazywać NPV, IRR, payback i risk score.
AI nie może wymyślać liczb.
AI musi pokazywać źródła i confidence.
CFO-ready report musi być krótki, konkretny i liczbowy.
Investor-ready report musi być spójny, czysty i audytowalny.
Finance musi zasilać Results i ROI.
Dane finansowe muszą być połączone z inicjatywami.
Dashboard ma prowadzić do decyzji, nie tylko pokazywać liczby.
Model musi mieć wersje i historię zmian.
Client-ready mode musi usuwać internal-only notes.
Nie kopiujemy ERP — integrujemy ERP jako źródło.
Nie kopiujemy Bloomberga — tworzymy consulting finance engine.
Consultify Finance ma zamykać pętlę: statement → model → analysis → decision → report → Results.
Najostrzejszy wniosek
Piotr, tutaj trzeba uważać na jedną rzecz: największe ryzyko tego modułu to zrobienie ładnego ekranu “Statements” i uznanie, że mamy Finance. To byłby błąd.
Prawdziwa przewaga Consultify pojawi się dopiero wtedy, gdy statement stanie się żywym, audytowalnym obiektem, z którego system buduje model, analizę, forecast, wycenę, business case, decyzję, raport i potwierdzony ROI. Wtedy Finance nie jest zakładką. Wtedy Finance jest mózgiem ekonomicznym całego Consultify.
