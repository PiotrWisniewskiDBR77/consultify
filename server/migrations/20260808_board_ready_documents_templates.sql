-- Board-ready qualification pack for the canonical Documents template set.
--
-- This migration upgrades the exact reusable templates exercised by the
-- Documents acceptance matrix. It changes authoring blueprints only; existing
-- artifacts remain immutable and keep their original lineage.

UPDATE document_studio_templates
SET required_inputs = $$[
  "period KPI baseline and current result",
  "decision register with deadline and accountable owner",
  "portfolio milestone and dependency status",
  "financial plan, actual and forecast",
  "risk register with mitigation and residual exposure"
]$$::jsonb,
section_blueprint = $$[
  {"title":"Executive Summary","level":1,"purpose":"Give the Board a one-page synthesis of performance, value, risk and the decisions required.","required":true,"expectedLengthHint":"short","contentHints":["Lead with decision implications","Reconcile headline numbers","Name the reporting period"],"keyMessage":"The Board can understand performance, exposure and required action from one reconciled page.","dataNeeded":["Reporting period","KPI plan and actual","Value delivered","Top residual risk"],"suggestedEvidence":"Reconciled executive scorecard and signed decision register"},
  {"title":"Decisions Required","level":1,"purpose":"Present each decision with options, recommendation, deadline, owner and consequence of delay.","required":true,"expectedLengthHint":"medium","contentHints":["Use one decision card per ask","Compare options consistently","State approval conditions"],"keyMessage":"Every Board ask is explicit, time-bound and supported by comparable options.","dataNeeded":["Decision statement","Options and trade-offs","Recommendation","Deadline","Accountable owner"],"suggestedEvidence":"Decision paper, option matrix and sponsor recommendation"},
  {"title":"Portfolio Status","level":1,"purpose":"Show workstream health, milestone confidence, dependencies and exceptions requiring intervention.","required":true,"expectedLengthHint":"medium","contentHints":["Use consistent RAG rules","Explain every red or amber","Separate fact from forecast"],"keyMessage":"Portfolio status highlights only material variance and intervention needs.","dataNeeded":["Milestone baseline","Current forecast","RAG criteria","Dependency status","Recovery action"],"suggestedEvidence":"Integrated plan and approved workstream status returns"},
  {"title":"Financial Snapshot","level":1,"purpose":"Reconcile budget, actual, forecast, benefits and variance with clear period and currency definitions.","required":true,"expectedLengthHint":"medium","contentHints":["Reconcile totals to Finance","Separate spend and value","Explain material variance"],"keyMessage":"Financial performance is traceable from plan through forecast and realized value.","dataNeeded":["Approved budget","Actual spend","Estimate at completion","Benefit plan and actual","Currency and period"],"suggestedEvidence":"Finance ledger extract and benefit register"},
  {"title":"Risks and Dependencies","level":1,"purpose":"Prioritize exposure by probability and impact, with mitigation owner, trigger, contingency and residual risk.","required":true,"expectedLengthHint":"medium","contentHints":["Lead with residual exposure","Show trend and trigger","Escalate ownership gaps"],"keyMessage":"Material exposure is owned, mitigated and linked to an explicit governance response.","dataNeeded":["Probability and impact","Exposure trend","Mitigation owner","Trigger and contingency","Residual risk"],"suggestedEvidence":"Current risk register and dependency map"},
  {"title":"Outlook and Scenarios","level":1,"purpose":"Explain the base outlook and credible upside/downside scenarios with leading indicators.","required":true,"expectedLengthHint":"medium","contentHints":["Keep assumptions explicit","Quantify range not false precision","Name trigger indicators"],"keyMessage":"The Board can see how the outlook changes when critical assumptions move.","dataNeeded":["Base forecast","Upside assumptions","Downside assumptions","Leading indicators"],"suggestedEvidence":"Scenario model and assumption log"},
  {"title":"Next Steps and Commitments","level":1,"purpose":"Record actions, accountable owners, dates, decision gates and measurable acceptance criteria.","required":true,"expectedLengthHint":"medium","contentHints":["Use owner-date-outcome format","Link actions to decisions","State next governance gate"],"keyMessage":"Every agreed intervention becomes a dated, owned and testable commitment.","dataNeeded":["Action","Owner","Due date","Acceptance criterion","Governance gate"],"suggestedEvidence":"Approved action and decision log"}
]$$::jsonb,
formatting_schema = formatting_schema || $${"colorTemplateId":"graphite","headers":{"enabled":true,"content":"BOARD CONFIDENTIAL · PERIOD PERFORMANCE"},"footers":{"enabled":true,"content":"Consultify · Board decision record","pageNumbering":true,"confidentialityLabel":true}}$$::jsonb,
updated_at = NOW()
WHERE template_id = 'doc-template-system-en-board_report';

UPDATE document_studio_templates
SET required_inputs = $$[
  "baseline performance and unit cost",
  "CAPEX, OPEX and contingency",
  "benefit assumptions and KPI owners",
  "risk register and implementation plan",
  "decision deadline and accountable sponsor"
]$$::jsonb,
section_blueprint = $$[
  {"title":"Executive Summary","level":1,"purpose":"State the investment ask, risk-adjusted value, delivery confidence and decision deadline.","required":true,"expectedLengthHint":"short","contentHints":["Lead with the approval requested","Reconcile value and cost","Name the top residual risk"],"keyMessage":"The Board can make the investment decision from one page with explicit conditions.","dataNeeded":["Decision statement","Decision deadline","Value at stake","Sponsor and recommendation"],"suggestedEvidence":"Signed decision paper and reconciled executive scorecard"},
  {"title":"Problem Statement","level":1,"purpose":"Quantify the current performance or cost gap, root causes, affected stakeholders and cost of inaction.","required":true,"expectedLengthHint":"medium","contentHints":["Separate symptoms from causes","Use an agreed baseline","Quantify the status quo"],"keyMessage":"The evidenced current-state gap is material enough to require action.","dataNeeded":["Baseline KPI trend","Unit-cost evidence","Root-cause analysis","Stakeholder impact"],"suggestedEvidence":"Finance baseline, process evidence and stakeholder interviews"},
  {"title":"Proposed Initiative","level":1,"purpose":"Define scope, exclusions, target operating model, workstreams and the delivery approach.","required":true,"expectedLengthHint":"medium","contentHints":["Connect workstreams to causes","State exclusions","Show operating-model change"],"keyMessage":"The proposed scope is the minimum coherent intervention that closes the evidenced gap.","dataNeeded":["Scope and exclusions","Workstream design","Target operating model","Dependency map"],"suggestedEvidence":"Approved scope map and target operating model"},
  {"title":"Economic Analysis","level":1,"purpose":"Compare base, upside and downside scenarios across CAPEX, OPEX, cash flow, NPV, IRR and payback.","required":true,"expectedLengthHint":"long","contentHints":["Keep assumptions explicit","Show sensitivity","Separate recurring run cost"],"keyMessage":"The recommendation remains attractive under transparent scenario and sensitivity tests.","dataNeeded":["CAPEX and OPEX","Cash-flow profile","Discount rate","Scenario assumptions","Sensitivity drivers"],"suggestedEvidence":"Finance model with scenario and sensitivity workbook"},
  {"title":"Benefits and KPIs","level":1,"purpose":"Define each benefit with baseline, target, timing, owner, measurement method and evidence source.","required":true,"expectedLengthHint":"medium","contentHints":["Prevent double counting","Separate committed and optional value","Name measurement owners"],"keyMessage":"Every claimed benefit has a measurable baseline, target, owner and evidence source.","dataNeeded":["KPI baseline and target","Benefit timing","Measurement method","Benefit owner"],"suggestedEvidence":"Benefit register and KPI measurement specification"},
  {"title":"Risks","level":1,"purpose":"Prioritize probability, impact and exposure with mitigation, trigger, contingency and residual risk.","required":true,"expectedLengthHint":"medium","contentHints":["Use residual exposure","Name mitigation owners","Highlight Board acceptance"],"keyMessage":"Residual exposure is visible, owned and compatible with the proposed risk appetite.","dataNeeded":["Risk probability and impact","Mitigation plan","Trigger and contingency","Residual exposure"],"suggestedEvidence":"Current risk register with named mitigation owners"},
  {"title":"Implementation Outline","level":1,"purpose":"Sequence milestones, dependencies, resources, decision gates, adoption and benefit realization.","required":true,"expectedLengthHint":"medium","contentHints":["Use measurable exit criteria","Show critical dependencies","Name workstream owners"],"keyMessage":"Value can be delivered through gated milestones with accountable owners and exit criteria.","dataNeeded":["Milestones and dependencies","Resource plan","Decision gates","Exit criteria"],"suggestedEvidence":"Integrated delivery plan and governance calendar"},
  {"title":"Recommendation","level":1,"purpose":"Compare invest, stage, defer and do-nothing options and record approval conditions.","required":true,"expectedLengthHint":"medium","contentHints":["Use a weighted option matrix","Explain why alternatives lose","State decision conditions"],"keyMessage":"The recommended option creates the best risk-adjusted value within the decision constraints.","dataNeeded":["Option scoring criteria","Constraint set","Risk-adjusted value","Approval conditions"],"suggestedEvidence":"Weighted option matrix and sponsor recommendation"},
  {"title":"Appendix","level":1,"purpose":"Provide traceable assumptions, calculations, sources, reconciliations and unresolved evidence gaps.","required":true,"expectedLengthHint":"long","contentHints":["Reconcile headline totals","Version every source","Label evidence gaps"],"keyMessage":"Every headline claim and number is traceable to a controlled source or calculation.","dataNeeded":["Source register","Calculation model","Assumption log","Reconciliation checks"],"suggestedEvidence":"Versioned source register and calculation appendix"}
]$$::jsonb,
formatting_schema = formatting_schema || $${"colorTemplateId":"indigo","headers":{"enabled":true,"content":"BOARD CONFIDENTIAL · INVESTMENT CASE"},"footers":{"enabled":true,"content":"Consultify · Investment decision record","pageNumbering":true,"confidentialityLabel":true}}$$::jsonb,
updated_at = NOW()
WHERE template_id = 'doc-template-system-en-business_case';

UPDATE document_studio_templates
SET required_inputs = $$[
  "decision statement and deadline",
  "constraints and non-negotiables",
  "option evidence and financial impact",
  "risk assessment and implementation dependencies",
  "accountable decision owner"
]$$::jsonb,
section_blueprint = $$[
  {"title":"Decision in One Sentence","level":1,"purpose":"State exactly what must be decided, by whom and by when.","required":true,"expectedLengthHint":"short","contentHints":["Use one executable sentence","Name the deadline","Avoid background narrative"],"keyMessage":"The decision request is unambiguous before the reader sees supporting analysis.","dataNeeded":["Decision statement","Decision owner","Decision deadline"],"suggestedEvidence":"Agenda-approved decision wording"},
  {"title":"Context and Constraints","level":1,"purpose":"Explain the trigger, objective, boundaries, non-negotiables and consequence of delay.","required":true,"expectedLengthHint":"medium","contentHints":["Separate fact from assumption","Quantify urgency","State constraints"],"keyMessage":"The decision is necessary now because the trigger and constraints are evidenced.","dataNeeded":["Trigger event","Objective","Constraints","Cost of delay"],"suggestedEvidence":"Baseline evidence and governing policy"},
  {"title":"Options and Trade-offs","level":1,"purpose":"Compare viable options, including do nothing, against common decision criteria.","required":true,"expectedLengthHint":"medium","contentHints":["Use identical criteria","Show value, cost and risk","Include do nothing"],"keyMessage":"The alternatives are complete, comparable and free of hidden criteria changes.","dataNeeded":["Option definitions","Decision criteria","Financial impact","Delivery impact","Risk exposure"],"suggestedEvidence":"Weighted option matrix and supporting calculations"},
  {"title":"Recommended Option","level":1,"purpose":"State the recommendation, evidence, conditions, assumptions and reasons alternatives lose.","required":true,"expectedLengthHint":"medium","contentHints":["Link evidence to criteria","State conditions","Expose assumptions"],"keyMessage":"The recommendation wins on the agreed criteria and remains conditional on explicit assumptions.","dataNeeded":["Recommendation","Evidence by criterion","Approval conditions","Critical assumptions"],"suggestedEvidence":"Sponsor recommendation and reconciled decision matrix"},
  {"title":"Risks and Mitigations","level":1,"purpose":"Show material probability, impact, mitigation owner, trigger, contingency and residual exposure.","required":true,"expectedLengthHint":"medium","contentHints":["Lead with residual risk","Name owners","Link triggers to contingency"],"keyMessage":"Decision-makers understand the residual exposure they are accepting.","dataNeeded":["Probability and impact","Mitigation","Owner","Trigger","Residual exposure"],"suggestedEvidence":"Current risk register and owner confirmations"},
  {"title":"Decision Record and Next Steps","level":1,"purpose":"Capture the outcome, dissent, conditions, actions, owners, dates and acceptance criteria.","required":true,"expectedLengthHint":"medium","contentHints":["Record the final outcome","Use owner-date-outcome","Preserve dissent and conditions"],"keyMessage":"The decision becomes an auditable set of owned commitments.","dataNeeded":["Decision outcome","Conditions","Action owner","Due date","Acceptance criterion"],"suggestedEvidence":"Signed minutes and controlled decision log"}
]$$::jsonb,
formatting_schema = formatting_schema || $${"colorTemplateId":"graphite","headers":{"enabled":true,"content":"CONFIDENTIAL · DECISION MEMO"},"footers":{"enabled":true,"content":"Consultify · Controlled decision record","pageNumbering":true,"confidentialityLabel":true}}$$::jsonb,
updated_at = NOW()
WHERE template_id = 'doc-template-system-en-decision_memo';

UPDATE tp_base_templates
SET description = 'Executive KPI control workbook with accountable targets, actuals, formula-driven variance, trend, owner and evidence date.',
    schema_snapshot = $${"title":"Executive KPI Control","description":"Decision-ready KPI control with formula-driven variance and ownership.","sheets":[{"name":"KPI Control","purpose":"Compare target and actual performance and identify intervention needs.","columns":[{"key":"A","header":"Metric","width":30,"type":"text"},{"key":"B","header":"Target","width":14,"type":"number","numberFormat":"#,##0.00"},{"key":"C","header":"Actual","width":14,"type":"number","numberFormat":"#,##0.00"},{"key":"D","header":"Variance","width":14,"type":"number","numberFormat":"#,##0.00"},{"key":"E","header":"Variance %","width":14,"type":"percent","numberFormat":"0.0%"},{"key":"F","header":"Trend","width":16,"type":"text","validation":{"type":"list","values":["Improving","Stable","Deteriorating"],"allowBlank":true}},{"key":"G","header":"Owner","width":22,"type":"text"},{"key":"H","header":"Evidence date","width":16,"type":"date"}],"rows":[{"cells":{"D":{"formula":"C2-B2"},"E":{"formula":"IF(B2=0,0,D2/B2)"}}}],"freezeRow":1,"autoFilter":true,"showGridLines":false,"tabColor":"1F4E78","headerStyle":{"bold":true,"fontColor":"FFFFFF","bgColor":"1F4E78","alignment":"center","wrapText":true},"alternateRowColor":"EAF0F6","conditionalFormatting":[{"ref":"E2:E500","rules":[{"type":"colorScale","colors":["F8696B","FFEB84","63BE7B"]}]}]}]}$$::jsonb
WHERE id = 'f5da6891-de3e-431d-8bc8-10e97b01609a';

UPDATE tp_base_templates
SET description = 'Board risk register with numeric exposure, trigger, mitigation, contingency, owner, due date and lifecycle status.',
    schema_snapshot = $${"title":"Board Risk Register","description":"Risk decisions driven by formula-based exposure and named response ownership.","sheets":[{"name":"Risk Register","purpose":"Prioritize residual exposure and governance action.","columns":[{"key":"A","header":"Risk statement","width":38,"type":"text"},{"key":"B","header":"Probability %","width":14,"type":"percent","numberFormat":"0%","validation":{"type":"decimal","operator":"between","min":0,"max":1,"allowBlank":true}},{"key":"C","header":"Impact score","width":13,"type":"number","validation":{"type":"whole","operator":"between","min":1,"max":5,"allowBlank":true}},{"key":"D","header":"Exposure","width":13,"type":"number","numberFormat":"0.0"},{"key":"E","header":"Trigger","width":24,"type":"text"},{"key":"F","header":"Mitigation / contingency","width":34,"type":"text"},{"key":"G","header":"Owner","width":20,"type":"text"},{"key":"H","header":"Due date","width":14,"type":"date"},{"key":"I","header":"Status","width":16,"type":"text","validation":{"type":"list","values":["Open","Mitigating","Accepted","Closed"],"allowBlank":false}}],"rows":[{"cells":{"D":{"formula":"B2*C2"}}}],"freezeRow":1,"autoFilter":true,"showGridLines":false,"tabColor":"8B1E3F","headerStyle":{"bold":true,"fontColor":"FFFFFF","bgColor":"5B1A2B","alignment":"center","wrapText":true},"alternateRowColor":"F7EEF1","conditionalFormatting":[{"ref":"D2:D500","rules":[{"type":"colorScale","colors":["63BE7B","FFEB84","F8696B"]}]}]}]}$$::jsonb
WHERE id = '3f36a34d-51d2-455e-a952-c984cc91853c';

UPDATE tp_base_templates
SET description = 'Value-led product roadmap with outcome, quarter, owner, status, benefits, cost, formula-driven net value, dependencies and decision gate.',
    schema_snapshot = $${"title":"Value-led Product Roadmap","description":"Portfolio roadmap linking delivery sequencing to accountable outcomes and net value.","sheets":[{"name":"Roadmap","purpose":"Prioritize product outcomes by value, cost, dependency and governance gate.","columns":[{"key":"A","header":"Outcome / initiative","width":34,"type":"text"},{"key":"B","header":"Strategic objective","width":28,"type":"text"},{"key":"C","header":"Quarter","width":13,"type":"text","validation":{"type":"list","values":["Q1","Q2","Q3","Q4","Backlog"],"allowBlank":false}},{"key":"D","header":"Owner","width":20,"type":"text"},{"key":"E","header":"Status","width":16,"type":"text","validation":{"type":"list","values":["Proposed","Approved","In delivery","At risk","Done"],"allowBlank":false}},{"key":"F","header":"Benefit EUR","width":16,"type":"currency","numberFormat":"€#,##0"},{"key":"G","header":"Cost EUR","width":16,"type":"currency","numberFormat":"€#,##0"},{"key":"H","header":"Net value EUR","width":18,"type":"currency","numberFormat":"€#,##0"},{"key":"I","header":"Dependencies","width":28,"type":"text"},{"key":"J","header":"Decision gate","width":20,"type":"text"}],"rows":[{"cells":{"H":{"formula":"F2-G2"}}}],"freezeRow":1,"autoFilter":true,"showGridLines":false,"tabColor":"274C77","headerStyle":{"bold":true,"fontColor":"FFFFFF","bgColor":"274C77","alignment":"center","wrapText":true},"alternateRowColor":"E7EEF5","conditionalFormatting":[{"ref":"H2:H500","rules":[{"type":"cellIs","operator":"lessThan","formulae":["0"],"style":{"fontColor":"9C0006","bgColor":"FFC7CE"}}]}]}]}$$::jsonb
WHERE id = '510a84dd-c9c9-4294-ac4a-20616792c785';

UPDATE presentation_templates
SET description = 'Decision-led steering deck with reconciled performance, value, milestones, dependencies, residual risk and explicit committee asks.',
    theme = 'corporate', min_slides = 8, max_slides = 12,
    must_have_intents = $$["cover","executive_summary","performance_overview","initiative_portfolio","risk_management","roadmap","next_steps"]$$::jsonb::text,
    recommended_visuals = $$["executive_decision_strip","kpi_variance_chart","portfolio_rag_table","milestone_roadmap","risk_heatmap","source_notes"]$$::jsonb::text,
    outline_json = $$[
      {"intent":"cover","title":"Steering Committee Update","keyMessage":"State the reporting period, sponsor and governance objective.","dataNeeded":["Reporting period","Sponsor","Committee date"],"suggestedVisual":"Executive cover with confidentiality and period"},
      {"intent":"executive_summary","title":"Executive Summary and Decisions","keyMessage":"Lead with value, delivery confidence, residual exposure and decisions required.","dataNeeded":["Value plan and actual","Delivery RAG","Top residual risk","Decision asks"],"suggestedVisual":"Four-card decision strip"},
      {"intent":"performance_overview","title":"Performance and Value","keyMessage":"Reconcile KPI plan, actual, variance and forecast to named sources.","dataNeeded":["KPI baseline","Target","Actual","Forecast","Evidence date"],"suggestedVisual":"Plan-actual-forecast variance chart"},
      {"intent":"initiative_portfolio","title":"Workstream Health","keyMessage":"Show only material exception, recovery action and accountable owner.","dataNeeded":["Workstream RAG","Milestone variance","Recovery action","Owner"],"suggestedVisual":"Portfolio RAG table"},
      {"intent":"roadmap","title":"Milestones and Dependencies","keyMessage":"Expose the critical path, next gates and dependency owners.","dataNeeded":["Milestones","Baseline and forecast dates","Dependencies","Decision gates"],"suggestedVisual":"Gated milestone roadmap"},
      {"intent":"risk_management","title":"Risks, Triggers and Contingencies","keyMessage":"Committee attention goes to residual exposure and trigger-based action.","dataNeeded":["Probability","Impact","Mitigation","Trigger","Contingency","Owner"],"suggestedVisual":"Risk heatmap with action rail"},
      {"intent":"comparison","title":"Options and Trade-offs","keyMessage":"Compare viable interventions against common value, cost, timing and risk criteria.","dataNeeded":["Options","Decision criteria","Value","Cost","Delivery risk"],"suggestedVisual":"Weighted option matrix"},
      {"intent":"next_steps","title":"Decisions and Commitments","keyMessage":"Record each decision and action with owner, date and acceptance criterion.","dataNeeded":["Decision","Action","Owner","Due date","Acceptance criterion"],"suggestedVisual":"Decision and commitment table"}
    ]$$::jsonb::text,
    source_requirements_json = $$[
      {"type":"initiative_portfolio","required":true,"readiness":"partial_ready"},
      {"type":"kpi_scorecard","required":true,"readiness":"partial_ready"},
      {"type":"financial_snapshot","required":true,"readiness":"partial_ready"},
      {"type":"risk_register","required":true,"readiness":"partial_ready"},
      {"type":"decision_register","required":true,"readiness":"partial_ready"}
    ]$$::jsonb::text,
    template_recipe_json = $${"headerFooter":{"enabled":true,"hideOnCover":true,"showPageNumbers":true,"showConfidentiality":true}}$$::jsonb::text,
    updated_at = NOW()
WHERE id = 'pt-steering';

UPDATE presentation_templates
SET description = 'Evidence-governed assessment readout linking maturity scores and confidence to gaps, root causes, recommendations and a sequenced transformation roadmap.',
    theme = 'minimal', min_slides = 9, max_slides = 14,
    must_have_intents = $$["cover","executive_summary","assessment","comparison","recommendation_portfolio","roadmap","next_steps"]$$::jsonb::text,
    recommended_visuals = $$["maturity_radar","confidence_badges","gap_heatmap","evidence_table","prioritization_matrix","transformation_roadmap","source_notes"]$$::jsonb::text,
    outline_json = $$[
      {"intent":"cover","title":"Assessment Results","keyMessage":"Name the assessed scope, date, methodology and decision audience.","dataNeeded":["Assessment scope","Assessment date","Methodology version","Audience"],"suggestedVisual":"Minimal assessment cover"},
      {"intent":"executive_summary","title":"Diagnostic Summary","keyMessage":"Separate evidenced strengths, critical gaps, confidence and the decision implication.","dataNeeded":["Overall score","Top strengths","Critical gaps","Evidence confidence"],"suggestedVisual":"Executive diagnostic scorecard"},
      {"intent":"assessment","title":"Maturity Profile","keyMessage":"Show domain scores against a defined scale with confidence and sample size.","dataNeeded":["Domain scores","Scale definition","Evidence confidence","Sample size"],"suggestedVisual":"Maturity radar with confidence legend"},
      {"intent":"comparison","title":"Gap to Target","keyMessage":"Prioritize the gaps that constrain strategy rather than every low score.","dataNeeded":["Current score","Target score","Strategic criticality","Gap size"],"suggestedVisual":"Criticality-weighted gap heatmap"},
      {"intent":"root_cause","title":"Root Causes and Evidence","keyMessage":"Trace each priority gap to observable causes and controlled evidence.","dataNeeded":["Priority gap","Root cause","Evidence source","Confidence"],"suggestedVisual":"Cause-evidence chain"},
      {"intent":"recommendation_portfolio","title":"Recommendation Portfolio","keyMessage":"Connect each recommendation to a gap, value outcome, owner and decision gate.","dataNeeded":["Recommendation","Addressed gap","Expected outcome","Owner","Decision gate"],"suggestedVisual":"Value-feasibility prioritization matrix"},
      {"intent":"roadmap","title":"Transformation Roadmap","keyMessage":"Sequence capability building by dependencies, milestones and measurable exits.","dataNeeded":["Workstreams","Dependencies","Milestones","Exit criteria"],"suggestedVisual":"Three-horizon transformation roadmap"},
      {"intent":"risk_management","title":"Delivery Risks","keyMessage":"Make adoption, capacity and dependency exposure explicit and owned.","dataNeeded":["Risk","Probability","Impact","Mitigation","Owner"],"suggestedVisual":"Risk heatmap"},
      {"intent":"next_steps","title":"Decisions and Next Steps","keyMessage":"Translate findings into dated decisions and accountable commitments.","dataNeeded":["Decision ask","Action","Owner","Due date","Acceptance criterion"],"suggestedVisual":"Decision and action table"}
    ]$$::jsonb::text,
    source_requirements_json = $$[
      {"type":"assessment","required":true,"readiness":"partial_ready"},
      {"type":"evidence_register","required":true,"readiness":"partial_ready"},
      {"type":"interview_summary","required":true,"readiness":"partial_ready"},
      {"type":"initiative_portfolio","required":false,"readiness":"partial_ready"}
    ]$$::jsonb::text,
    template_recipe_json = $${"headerFooter":{"enabled":true,"hideOnCover":true,"showPageNumbers":true,"showConfidentiality":true}}$$::jsonb::text,
    updated_at = NOW()
WHERE id = 'pt-assessment';

UPDATE presentation_templates
SET description = 'Investor-grade valuation decision pack with reconciled financials, methodology, scenario sensitivity, comparable evidence, risk and explicit transaction next steps.',
    theme = 'corporate', min_slides = 9, max_slides = 14,
    must_have_intents = $$["cover","executive_summary","performance_overview","single_insight","comparison","risk_management","next_steps","appendix"]$$::jsonb::text,
    recommended_visuals = $$["valuation_bridge","financial_trend_chart","scenario_matrix","comparable_table","risk_heatmap","methodology_notes","source_notes"]$$::jsonb::text,
    outline_json = $$[
      {"intent":"cover","title":"Valuation Decision Pack","keyMessage":"State valuation date, currency, perimeter and decision purpose.","dataNeeded":["Valuation date","Currency","Perimeter","Decision purpose"],"suggestedVisual":"Investor-grade valuation cover"},
      {"intent":"executive_summary","title":"Investment Thesis and Valuation Range","keyMessage":"Lead with the evidence-backed range, central case, value drivers and decision implication.","dataNeeded":["Valuation range","Central case","Value drivers","Decision ask"],"suggestedVisual":"Valuation range and thesis cards"},
      {"intent":"performance_overview","title":"Historical and Forecast Financials","keyMessage":"Reconcile historical actuals and forecast assumptions across revenue, margin and cash flow.","dataNeeded":["Historical financials","Forecast financials","Accounting adjustments","Forecast assumptions"],"suggestedVisual":"Historical-to-forecast trend chart"},
      {"intent":"single_insight","title":"Valuation Methodology","keyMessage":"Explain method selection, calculation bridge and cross-checks without hiding adjustments.","dataNeeded":["DCF inputs","Discount rate","Terminal value","Net debt","Adjustments"],"suggestedVisual":"Enterprise-to-equity valuation bridge"},
      {"intent":"comparison","title":"Scenario and Sensitivity Analysis","keyMessage":"Show how valuation changes under credible operating and discount-rate assumptions.","dataNeeded":["Base, upside and downside assumptions","WACC range","Terminal growth range","Valuation outputs"],"suggestedVisual":"Two-dimensional sensitivity matrix"},
      {"intent":"comparison","title":"Comparable Companies and Transactions","keyMessage":"Use a controlled peer set and reconcile metric and period differences.","dataNeeded":["Peer set rationale","Trading multiples","Transaction multiples","Normalization adjustments"],"suggestedVisual":"Comparable valuation table"},
      {"intent":"risk_management","title":"Key Risks and Downside Protection","keyMessage":"Connect each material risk to valuation impact, trigger and mitigation.","dataNeeded":["Risk","Valuation impact","Trigger","Mitigation","Owner"],"suggestedVisual":"Risk-impact heatmap"},
      {"intent":"next_steps","title":"Decision and Transaction Next Steps","keyMessage":"Record the decision, diligence conditions, owner and transaction timeline.","dataNeeded":["Decision ask","Conditions","Diligence item","Owner","Due date"],"suggestedVisual":"Decision and transaction checklist"},
      {"intent":"appendix","title":"Methodology, Sources and Disclaimers","keyMessage":"Make every number traceable and every limitation explicit.","dataNeeded":["Source register","Model version","Methodology notes","Disclaimers"],"suggestedVisual":"Controlled source and methodology notes"}
    ]$$::jsonb::text,
    source_requirements_json = $$[
      {"type":"financial_statements","required":true,"readiness":"partial_ready"},
      {"type":"forecast_model","required":true,"readiness":"partial_ready"},
      {"type":"market_comparables","required":true,"readiness":"partial_ready"},
      {"type":"transaction_adjustments","required":true,"readiness":"partial_ready"},
      {"type":"source_register","required":true,"readiness":"partial_ready"}
    ]$$::jsonb::text,
    template_recipe_json = $${"headerFooter":{"enabled":true,"hideOnCover":true,"showPageNumbers":true,"showConfidentiality":true}}$$::jsonb::text,
    updated_at = NOW()
WHERE id = 'pt-valuation';
