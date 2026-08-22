const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL is required');

interface Question {
  text: string;
  desc: string;
  evidence: string;
  shape: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  questions: Question[];
}

const templates: Template[] = [
  {
    id: 'lib-tpl-ops-001__en',
    name: 'Operational Excellence Audit',
    description: 'Structured diagnostic for evaluating process maturity, productivity, quality systems, and continuous improvement capability. Based on frameworks used by leading management consultancies to identify operational improvement opportunities worth 15-30% of operating cost.',
    category: 'OPERATIONAL',
    questions: [
      {
        text: 'Walk me through your end-to-end value stream — from customer order to delivery. Where does value get created, and where does it get stuck?',
        desc: 'This question maps the core value chain. Strong operators can articulate not just the steps, but where value is created vs. where time and resources are consumed without adding value. Listen for awareness of cycle time vs. lead time gaps.',
        evidence: 'Ask to see a Value Stream Map (VSM) if one exists, or request the production/service flow diagram. Note takt time, cycle times per station, and WIP inventory levels between stages.',
        shape: 'A clear narrative of 5-10 process steps with honest identification of at least 2-3 waste points. Weak answers give a generic list of departments. Strong answers quantify delays ("parts wait 3 days in buffer") and know the takt time.'
      },
      {
        text: 'What are the top 3 constraints limiting your throughput right now? How did you identify them, and what have you tried to address them?',
        desc: 'Theory of Constraints thinking. You are assessing whether the organization systematically identifies and manages its bottlenecks, or simply fights fires. The quality of the identification method matters as much as the answer.',
        evidence: 'Request bottleneck analysis data, capacity utilization reports by station/line, or any constraint log. Ask about the method used — was it data-driven (time studies, capacity analysis) or opinion-based?',
        shape: 'Specific constraints with data backing (e.g., "CNC cell runs at 94% utilization while rest of line averages 72%"). Weak answers are vague ("we need more people"). Strong answers show a systematic approach to constraint identification and exploitation before investing.'
      },
      {
        text: 'Give me your OEE breakdown — Availability, Performance, Quality — for your top 3 production lines. How has it trended over the last 12 months, and what drove the changes?',
        desc: 'OEE is the gold standard metric for manufacturing effectiveness. The breakdown matters more than the aggregate number. Organizations that track all three components separately typically operate at higher maturity. World-class OEE is 85%+; most plants run 55-65%.',
        evidence: 'Request OEE dashboard or monthly OEE reports. Ask specifically for the breakdown by component. If they only have aggregate OEE, that itself is a finding. Also ask about measurement method — manual vs. automated data collection.',
        shape: 'Three-component OEE with trend data and root cause analysis for movements. Excellent: "Line A: 78% (Avail 92%, Perf 89%, Quality 95%), up from 71% after we addressed changeover times with SMED." Concerning: "Our OEE is around 60%" with no breakdown or trend awareness.'
      },
      {
        text: 'Describe your quality management system. How do you prevent defects vs. detect them, and what is your current cost of poor quality (COPQ)?',
        desc: 'The prevention-to-detection ratio reveals quality maturity. Mature organizations spend 70%+ of quality effort on prevention (design reviews, FMEA, mistake-proofing) vs. detection (inspection, testing). COPQ typically runs 15-25% of revenue in immature organizations.',
        evidence: 'Ask for: COPQ reports (internal failure + external failure + appraisal + prevention costs), defect Pareto charts, customer complaint trends, warranty costs. Also ask about specific prevention tools: FMEA, poka-yoke, SPC.',
        shape: 'Detailed quality system description with specific COPQ figure. Strong: "COPQ is 4.2% of revenue, down from 6.8% — we invested in poka-yoke at 12 stations and run SPC on 8 critical parameters." Weak: "We have ISO 9001" without knowing COPQ or defect rates.'
      },
      {
        text: 'How do you manage unplanned downtime? What is your current ratio of planned vs. reactive maintenance, and what does your maintenance backlog look like?',
        desc: 'Maintenance strategy is a major operational lever. World-class is 80%+ planned maintenance. Most organizations are 50-60% reactive, which costs 3-5x more per repair event. The backlog size and trend indicate whether the organization is gaining or losing ground.',
        evidence: 'Request: Planned vs. unplanned maintenance ratio, MTBF and MTTR for critical equipment, maintenance backlog in hours/weeks, PM compliance rate. Ask about CMMS system usage.',
        shape: 'Specific ratio with trend and backlog quantification. Strong: "72% planned, up from 55% last year. Backlog is 340 hours, stable. PM compliance at 91%." Weak: "We do preventive maintenance" without metrics or backlog awareness.'
      },
      {
        text: 'What does your production planning and scheduling process look like? How far out is your frozen schedule, and how often does it change?',
        desc: 'Planning stability directly impacts efficiency. Frequent schedule changes cascade into overtime, expediting costs, and inventory waste. The frozen window length and change frequency are key indicators of planning maturity and demand visibility.',
        evidence: 'Ask for: Schedule adherence rate, number of schedule changes per week, frozen schedule horizon, on-time delivery to schedule. Also ask about planning tools — ERP-based, APS, or spreadsheet.',
        shape: 'Clear planning process with frozen horizon and adherence metrics. Strong: "2-week frozen schedule, 93% adherence, plan changes average 4/week and trending down." Weak: "We plan weekly but things change constantly" without quantification.'
      },
      {
        text: 'Map your inventory for me — raw materials, WIP, and finished goods. What are your inventory turns, and where is capital getting trapped?',
        desc: 'Inventory is the physical manifestation of process problems. Excess inventory hides quality issues, planning failures, and supply chain unreliability. Industry benchmarks vary widely, but most organizations have 20-40% more inventory than needed.',
        evidence: 'Request: Inventory turns by category, days of supply, dead/slow-moving stock percentage, carrying cost estimate. Ask specifically about WIP between process steps — this is where hidden waste accumulates.',
        shape: 'Inventory metrics by category with awareness of root causes. Strong: "Raw material turns 12x, WIP 24x, FG 8x. FG is low because of demand variability — we carry 2.5 weeks safety stock for A-items. We have $1.2M in slow-movers we are working down." Weak: "I would have to check with finance."'
      },
      {
        text: 'Tell me about your continuous improvement program. How many improvement events or projects ran in the last 12 months? What was the total financial impact, and how was it verified?',
        desc: 'The litmus test for CI maturity is whether improvement is embedded in daily work or a periodic management initiative. Sustainable CI programs deliver 3-5% annual productivity improvement. Financial impact verification shows rigor.',
        evidence: 'Request: CI project register, Kaizen event log with tracked savings, suggestion system participation rates. Ask about methodology (Lean, Six Sigma, TPM) and whether there are dedicated CI resources or it is part-time.',
        shape: 'Specific program metrics with verified savings. Strong: "43 Kaizen events, 180 small improvements via suggestion system. Verified savings of $1.8M. We have 2 full-time CI engineers and 12 certified Green Belts." Weak: "We did a Lean workshop last year" or "everyone does improvement."'
      },
      {
        text: 'How are your operational teams structured? What is the span of control for frontline supervisors, and how much of their time is spent on direct leadership vs. administrative work?',
        desc: 'Organizational design directly impacts operational performance. Span of control (optimal: 8-15 direct reports for production) and leader standard work reveal whether supervisors are coaching teams or firefighting. Admin burden over 30% signals system design problems.',
        evidence: 'Request: Org chart with headcount by level, supervisor-to-operator ratio, leader standard work documentation if it exists. Ask about daily management routines (tier meetings, gemba walks).',
        shape: 'Clear structure with span of control and time allocation. Strong: "Supervisors have 10-12 direct reports, spend 60% on floor, 15% on coaching, 25% on admin. We do daily tier 1 huddles and weekly tier 2." Weak: "Supervisors manage their teams" without specifics.'
      },
      {
        text: 'What is your current labor productivity trend? How do you measure it, and what are the main drivers of variability?',
        desc: 'Labor productivity (units per labor hour, revenue per FTE, or equivalent) is the integrating metric for operational performance. The trend matters more than the absolute number. Understanding variability drivers shows analytical maturity.',
        evidence: 'Request: Productivity metric definition and 12-month trend, absenteeism rate, overtime percentage, training hours per employee. Ask what drives good weeks vs. bad weeks.',
        shape: 'Defined metric with trend and variability analysis. Strong: "Units per labor hour improved 8% YoY. Main variability drivers: product mix (40%), absenteeism (25%), material availability (20%). We track weekly by line." Weak: "Productivity is OK" or only revenue-based metrics.'
      },
      {
        text: 'How mature is your supply chain collaboration? What percentage of deliveries are on-time-in-full (OTIF) from your top 10 suppliers, and how do you manage supplier performance?',
        desc: 'Supply chain reliability directly impacts internal operations. OTIF below 95% from key suppliers typically causes significant internal waste through expediting, schedule changes, and buffer inventory.',
        evidence: 'Request: Supplier OTIF scorecard, incoming quality rejection rates, supplier development program details. Ask about dual-sourcing strategy for critical components.',
        shape: 'OTIF data with management process. Strong: "Top 10 suppliers average 96.2% OTIF. We run quarterly business reviews, have a formal supplier development program for bottom quartile, and dual-source all A-category components." Weak: "Suppliers are generally OK, sometimes we have issues."'
      },
      {
        text: 'If I gave you a blank check for one operational improvement, what would you invest in and why? What ROI would you expect?',
        desc: 'This reveals what the operator truly believes is the constraint, unconstrained by budget politics. It also tests their ability to build a business case and think in terms of ROI rather than just spending.',
        evidence: 'No documents needed — this is a judgment and vision question. Listen for the quality of the business case logic and whether the investment addresses root causes or symptoms.',
        shape: 'Specific investment with clear ROI logic. Strong: "Automated packaging line — $2.4M investment, 18-month payback. It is our constraint, running at 97% utilization." Weak: "More people" or "a new ERP" without ROI thinking.'
      }
    ]
  },
  {
    id: 'lib-tpl-digital-001__en',
    name: 'Digital Maturity Assessment',
    description: 'Structured evaluation of digital transformation maturity across five dimensions: strategy alignment, technology landscape, process digitization, data & analytics capability, and people readiness. Calibrated against industry benchmarks to identify the highest-impact transformation levers.',
    category: 'DIGITAL',
    questions: [
      {
        text: 'Where does digital transformation sit in your corporate strategy? Is it an enabler of business strategy, a separate IT initiative, or something in between? Who sponsors it at the board level?',
        desc: 'Strategic alignment is the single strongest predictor of digital transformation success. Organizations where digital is an IT-led initiative fail 3x more often than those where business leadership owns the agenda.',
        evidence: 'Ask for: Digital strategy document or roadmap, board presentation on digital priorities, digital steering committee charter and membership. Check if the CDO/CTO reports to the CEO or CFO.',
        shape: 'Clear articulation of digital-business linkage with named sponsor. Strong: "Digital is embedded in our 5-year business strategy, sponsored by the CEO, with a dedicated transformation office." Weak: "IT is running some digitization projects."'
      },
      {
        text: 'What does your core technology landscape look like? List your main systems, their age, how they talk to each other, and where you are carrying significant technical debt.',
        desc: 'Technology landscape complexity and technical debt are the hidden taxes on digital transformation. Most organizations underestimate their technical debt by 40-60%. Integration architecture determines how fast new capabilities can be deployed.',
        evidence: 'Request: Enterprise architecture diagram, application inventory with age, integration architecture map. Ask about total IT spend as percentage of revenue (benchmark: 3-6% for manufacturing, 5-10% for services).',
        shape: 'Honest inventory with age and integration assessment. Strong: system names with ages, known debt areas, integration method. Weak: Vague system listing without debt or integration awareness.'
      },
      {
        text: 'What percentage of your business processes are digitized end-to-end vs. partially vs. still paper/manual? Give me specific examples of each.',
        desc: 'Process digitization maturity shows real vs. aspirational state. "End-to-end" means data flows without manual re-entry from initiation to completion. Partial digitization often creates more problems than full manual.',
        evidence: 'Request: Process inventory with digitization status. Ask for 3 specific examples: one fully digitized, one partial, one still manual. For each, ask about data re-entry points.',
        shape: 'Honest percentage breakdown with concrete examples. Strong: percentages with named processes and known gaps. Weak: "Most things are digital" without specifics.'
      },
      {
        text: 'How does data flow from where it is generated to where decisions are made? Walk me through a specific decision that depends on data — who collects it, how it moves, how long it takes, and how much you trust it.',
        desc: 'The data-to-decision pipeline is where digital maturity is revealed in practice. Long latency, manual transformation steps, and trust issues indicate fundamental data architecture problems.',
        evidence: 'Map the specific example end-to-end. Note: number of manual handoffs, time delays, format changes (PDF to Excel to email to dashboard), stated confidence level. Ask how many people touch the data.',
        shape: 'Concrete example with timeline and trust assessment. Strong: named data pipeline with timing and confidence level. Weak: "We have dashboards" without knowing the pipeline.'
      },
      {
        text: 'Rate your organization 1-5 for each: self-service analytics capability, data literacy across functions, and willingness to act on data that contradicts gut feeling. Explain your reasoning.',
        desc: 'Three dimensions of data culture maturity. Self-service (can business users get answers without IT?), data literacy (can they interpret correctly?), and data-driven decision making (do they use data when uncomfortable?).',
        evidence: 'For self-service: how many people can build own reports vs. submitting IT requests. For literacy: last time a data insight changed a decision. For action: example where data contradicted leadership intuition — what happened?',
        shape: 'Three separate ratings with honest reasoning and examples. Strong: differentiated ratings with specific supporting examples. Weak: "We are about a 4" without evidence.'
      },
      {
        text: 'What digital skills does your workforce need in 3 years that they do not have today? How are you closing that gap, and is it working?',
        desc: 'People capability is the constraint organizations invest in last but should invest in first. Most training programs have less than 20% behavior change rate. The gap identification method reveals maturity.',
        evidence: 'Request: Digital skills matrix or competency framework, training program catalog and participation rates, hiring plan for digital roles.',
        shape: 'Specific skills gap with quantified closing strategy: enrolled count, completion rate, hiring pipeline. Weak: "We need more digital skills" without a plan.'
      },
      {
        text: 'How do you manage cybersecurity risk in the context of digital transformation? Has security ever slowed down or blocked a digital initiative?',
        desc: 'Security-by-design vs. security-as-blocker is a key maturity indicator. Immature organizations either ignore security or let it block progress. Mature ones embed security early with clear risk acceptance frameworks.',
        evidence: 'Ask for: Last penetration test, incident history. Ask for an example where security requirements impacted a digital project timeline.',
        shape: 'Balanced security posture with governance. Strong: embedded security review process with known trade-offs. Weak: "IT handles security" or no awareness of speed impact.'
      },
      {
        text: 'What is your approach to innovation and experimentation? How many digital pilots ran in the last 12 months, and what happened to them?',
        desc: 'Innovation pipeline throughput and scale-up rate reveal whether the organization executes on ideas or gets stuck in pilot purgatory. Healthy: 60-70% pilot-to-decision rate.',
        evidence: 'Request: Innovation portfolio, pilot results log. Ask: how many started, how many scaled, how many stopped, how many are still in pilot after 12+ months.',
        shape: 'Quantified pipeline with outcomes: started/scaled/killed/stuck. Weak: "We have an innovation lab" without throughput data.'
      },
      {
        text: 'What AI or machine learning capabilities are deployed in production today — not pilots, but systems that make or support real business decisions every day?',
        desc: 'The distinction between AI-in-production vs. AI-as-pilot is critical. Production AI requires MLOps, monitoring, retraining — all signs of advanced digital maturity.',
        evidence: 'For each production AI: what decision it supports, how long running, monitoring approach, last retraining, fallback when wrong.',
        shape: 'Specific production AI with operational details and business impact. Weak: "We are exploring AI" or listing pilots as production.'
      },
      {
        text: 'What is the single biggest barrier to moving faster on digital transformation? If you could change one thing overnight, what would it be?',
        desc: 'The unconstrained wish question reveals the perceived primary constraint. Compare with evidence from other answers to validate. Common real barriers: legacy systems (40%), culture (25%), talent (20%), budget (15%).',
        evidence: 'Listen for alignment between this answer and evidence from previous questions. If they say "budget" but described under-staffed approved programs, the real barrier is talent.',
        shape: 'Specific barrier with reasoning that connects to evidence. Weak: "We need more budget" or generic "management buy-in" without specifics.'
      }
    ]
  },
  {
    id: 'lib-tpl-data-001__en',
    name: 'Data & Analytics Readiness Assessment',
    description: 'Diagnostic for evaluating organizational data maturity across governance, architecture, quality, analytics capability, and AI readiness. Maps current state against a 5-level maturity model to identify the critical path from data collection to data-driven decision-making.',
    category: 'DATA',
    questions: [
      {
        text: 'Draw me a map of your data landscape. What are your primary data sources, where do they live, and who owns them? Be specific about the grey areas where data lives in spreadsheets or in people\'s heads.',
        desc: 'Data landscape mapping reveals reality vs. official architecture. The most critical finding is usually "shadow IT" — spreadsheets and personal databases running critical processes. In most organizations, 30-40% of business-critical data lives outside governed systems.',
        evidence: 'Request: Data architecture diagram, system inventory, data catalog if exists. Then ask: "What critical data lives in spreadsheets that should be in a system?" — this consistently surfaces the most important gaps.',
        shape: 'Honest landscape including shadow data. Strong: named systems plus acknowledged shadow data with specific examples. Weak: Clean system list without acknowledging unmanaged data.'
      },
      {
        text: 'Tell me about your data governance. Who decides what data means, who is accountable for quality, and what happens when two systems disagree on the same metric?',
        desc: 'Governance maturity is the single best predictor of analytics success. The "two systems disagree" question is revealing — most organizations discover conflicting definitions during reporting, not governance.',
        evidence: 'Request: Data governance charter, data dictionary/glossary, steward roster. Ask for a specific recent example of a data definition conflict — how discovered and resolved?',
        shape: 'Governance framework with conflict resolution example. Strong: named stewards, published glossary, documented conflict resolution. Weak: "IT manages data quality."'
      },
      {
        text: 'Rate your data quality 1-5 for each: completeness, accuracy, timeliness, and consistency across systems. Give me a specific business-impact example of each issue.',
        desc: 'Four-dimensional quality assessment. Most organizations rate themselves 3-4 initially but drop to 2-3 when asked for examples. The examples reveal which dimensions actually impact business decisions.',
        evidence: 'For each dimension, ask for recent business impact. Completeness: "How many records have missing critical fields?" Accuracy: "When was the last time a report had wrong numbers?" Timeliness: "How stale is your key data?" Consistency: "Same entity, different numbers in different systems?"',
        shape: 'Four separate ratings with impact examples and cost estimates. Strong answers include business impact quantification.'
      },
      {
        text: 'What is your analytics stack? Walk me from raw data to insight — ETL/ELT, warehouse, BI tools — and how many people can use it without help from IT.',
        desc: 'Analytics technology stack determines the ceiling of what is possible. Key indicator: self-service adoption rate (business users who can independently create analyses).',
        evidence: 'Request: Analytics architecture diagram, tool inventory with license counts and active users. Ask: "How many people can answer a new business question from data without filing a ticket?"',
        shape: 'Full pipeline description with self-service metric. Strong: named tools in sequence with user counts and bottleneck awareness. Weak: "We use Power BI" without pipeline knowledge.'
      },
      {
        text: 'What analytics talent do you have — be honest about the gap. How many people can do exploratory analysis, build statistical models, and deploy ML in production?',
        desc: 'Differentiate three levels: analysts (explore data, create reports), data scientists (build models), ML engineers (deploy to production). Most mid-size organizations have adequate analysts but zero or 1-2 data scientists.',
        evidence: 'Request: Analytics team structure, job descriptions, open requisitions. Ask: "If I gave you a prediction problem today, who would work on it and how long would it take?"',
        shape: 'Honest gap assessment by skill level with quantified need. Strong: breakdown by analyst/DS/MLE with current vs. needed count. Weak: "We have a data team" without skill differentiation.'
      },
      {
        text: 'Give me 3 decisions that are made with data today, and 3 that should be but are not. For the data-driven ones, how confident are you in the underlying data?',
        desc: 'Surfaces actual data-driven decision-making maturity vs. aspiration. The "should be but is not" category reveals either data gaps or cultural barriers.',
        evidence: 'For data-driven decisions: how often, who decides, what data feeds it. For non-data-driven: what data would be needed, what blocks it (no data, no trust, no tools, or cultural preference for intuition).',
        shape: 'Six concrete examples. Strong: named decisions with frequency, confidence level, and specific blockers for the non-data ones. Weak: vague generalities.'
      },
      {
        text: 'What is the most valuable analytics project or insight from the last 12 months? Quantify the business impact and tell me how it was verified.',
        desc: 'Demonstrated ROI from analytics is the strongest indicator of data-driven culture. The quantification rigor matters — was impact measured or estimated? Validated by finance or self-reported?',
        evidence: 'Request: project documentation, impact methodology, before/after metrics. Was impact validated by finance or self-reported by analytics team?',
        shape: 'Specific project with verified impact. Strong: named project with dollar impact, measurement method, and finance validation. Weak: "We created better dashboards" without measurable impact.'
      },
      {
        text: 'What AI/ML use cases are in your pipeline? For each, tell me: the business problem, the data it needs, whether that data exists today, and your realistic timeline.',
        desc: 'AI pipeline assessment. The gap between ambition and data readiness is the key finding. Most organizations have AI aspirations 12-24 months ahead of their data infrastructure.',
        evidence: 'For each use case, create readiness scorecard: data availability (%), data quality (1-5), talent readiness, infrastructure readiness, business sponsorship.',
        shape: 'Pipeline with honest readiness assessment per use case. Strong: named use cases with data readiness rating and realistic timeline. Weak: generic AI wish list.'
      },
      {
        text: 'If you had to pick one data quality problem to fix before anything else, what would it be and how would you fix it?',
        desc: 'Prioritization of data quality reveals what truly blocks progress. The proposed fix shows whether the organization thinks about quality as one-time cleanup (immature) or systemic process change (mature).',
        evidence: 'Listen for: root cause analysis, systemic vs. one-time fix, estimated effort and impact. One-time cleanse without process change = maturity gap.',
        shape: 'Specific problem with root-cause fix. Strong: named problem, root cause, systemic solution, estimated effort. Weak: "We need to clean up our data" without specifics.'
      },
      {
        text: 'What is your total investment in data and analytics — people, tools, infrastructure? How does it compare to peers, and how do you measure ROI?',
        desc: 'Investment benchmarking reveals ambition vs. reality. Analytics leaders invest 0.5-1.5% of revenue; average is 0.2-0.5%. ROI measurement shows whether analytics is strategic investment or cost center.',
        evidence: 'Request: Analytics budget breakdown (headcount, tools, infrastructure, consulting). Ask for peer benchmarking and ROI reporting to leadership.',
        shape: 'Quantified investment with ROI framework. Strong: dollar figures, peer comparison, documented ROI. Weak: "I do not know the total budget" or no ROI measurement.'
      }
    ]
  },
  {
    id: 'lib-tpl-cost-001__en',
    name: 'Cost Optimization Review',
    description: 'Systematic diagnostic for identifying cost reduction and efficiency improvement opportunities across direct costs, overhead, procurement, and process waste. Targets typical savings of 8-15% of addressable spend within 12-18 months through a combination of quick wins and structural changes.',
    category: 'COST',
    questions: [
      {
        text: 'Break down your total cost structure for me. Top 5 categories, percentage of total, and 3-year trend for each. Where is cost growing faster than revenue?',
        desc: 'Cost structure mapping with trend analysis identifies where cost is growing fastest — usually the biggest opportunities. Any category growing faster than revenue is consuming margin.',
        evidence: 'Request: P&L with 3-year trend by cost category, cost-to-revenue ratios. Break each category further if possible (e.g., labor = direct + indirect + temp + overtime).',
        shape: 'Detailed breakdown with trend. Strong: named categories with percentages, growth rates, and revenue comparison. Weak: "Materials and labor are our biggest costs" without data.'
      },
      {
        text: 'Walk me through your procurement process for your top 3 spend categories. How do you negotiate, how often do you rebid, and what is your contract coverage rate?',
        desc: 'Procurement maturity drives 3-7% savings in most organizations. Key indicators: contract coverage (best-in-class >85%), rebid frequency, supplier count per category, total cost of ownership vs. unit price negotiation.',
        evidence: 'Request: Spend analysis by category, supplier count per category, contract expiration calendar. Ask about maverick spend (buying outside contracts) — typical leakage 10-25%.',
        shape: 'Process detail with metrics per category. Strong: named categories with spend, supplier count, contract coverage, maverick rate. Weak: "Purchasing handles that."'
      },
      {
        text: 'Where is labor cost consumed unproductively? What is your overtime percentage, absenteeism rate, and how much time do people spend on non-value-added activities?',
        desc: 'Three main labor levers: overtime (planning/capacity symptom), absenteeism (engagement/workload symptom), non-value-added time (meetings, rework, waiting, searching). In most organizations, 20-30% of labor time is non-value-added.',
        evidence: 'Request: Overtime hours and cost by department, absenteeism trend, time study results. Ask: "If you followed a worker for a full shift, what percentage of time is directly productive?"',
        shape: 'Quantified labor waste with root causes. Strong: overtime rate with root cause, NVA time breakdown by activity type. Weak: "Overtime is a bit high" without data.'
      },
      {
        text: 'What does waste look like across your operation? Walk me through material waste, energy waste, process waste (rework, scrap, returns), and information waste (duplicate data entry, reporting nobody reads).',
        desc: 'Lean waste categories applied to the full business. Information waste (reports nobody reads, duplicate data entry, manual reconciliation) often represents 5-10% of overhead cost but is rarely measured.',
        evidence: 'Request: Scrap/waste reports, rework cost, energy per unit, list of regular reports produced. For information waste: "How many regular reports does your team produce, and who reads each one?"',
        shape: 'Waste quantified across categories with specific examples. Strong: percentages and dollar amounts per waste type. Weak: "We have some waste" without quantification.'
      },
      {
        text: 'Which overhead costs have grown the most in 3 years? For each, can you justify the growth relative to business growth?',
        desc: 'Overhead creep is the most common hidden cost problem. Common culprits: IT costs, compliance/legal, middle management layers, software subscriptions with under 30% utilization.',
        evidence: 'Request: Overhead breakdown with 3-year trend, headcount growth in support vs. operations. Ask about software subscriptions/licenses — most organizations pay for tools barely used.',
        shape: 'Overhead categories with justified vs. unjustified growth. Strong: named categories with growth rates and honest justification assessment. Weak: "Overheads are under control."'
      },
      {
        text: 'How do you track and manage energy costs? What is your cost per unit of output and how does it compare to your own best performance and industry benchmarks?',
        desc: 'Energy is 5-15% of manufacturing cost and increasingly important with carbon pricing and ESG. Quick wins (compressed air leaks, lighting, HVAC) typically deliver 10-15% savings with under 18-month payback.',
        evidence: 'Request: Energy bills (12 months), production volumes (same period). Ask about sub-metering and best-ever efficiency month. Ask about known waste sources.',
        shape: 'Cost per unit with benchmark comparison. Strong: per-unit metric vs. benchmark and best-ever, with known waste sources and payback estimates. Weak: "Energy costs are going up."'
      },
      {
        text: 'What savings initiatives were attempted in the last 2 years? For each: what was promised, what was delivered, and did the savings actually hit the P&L or disappear?',
        desc: 'Savings sustainability diagnostic. Most organizations claim significant savings that never materialize in P&L. Common failures: savings consumed by volume growth, budgets not actually reduced, savings offset elsewhere.',
        evidence: 'Request: Savings tracker with promised vs. delivered. Ask: "Can you trace these savings to a specific P&L line?" and "Were budgets actually reduced?"',
        shape: 'Honest past assessment. Strong: named initiatives with promised vs. delivered vs. P&L verified amounts. Weak: "We saved $2M last year" without verification.'
      },
      {
        text: 'Which processes could be automated to reduce cost, and what is stopping you? Give me the top 3 candidates with a rough business case.',
        desc: 'Automation ROI analysis. The barrier is often more interesting than the opportunity — technical, financial, or organizational resistance? Each requires different approach.',
        evidence: 'Per candidate: current labor hours, error/rework rate, solution identified?, estimated investment, annual savings, payback period. What blocked it?',
        shape: 'Three specific opportunities with business case. Strong: named processes with hours, cost, solution, payback, and specific blocker. Weak: "Lots of things could be automated."'
      },
      {
        text: 'How does your make-vs-buy decision process work? When was the last time you seriously evaluated outsourcing a function or insourcing something you buy?',
        desc: 'Make-vs-buy decisions are infrequently revisited, usually based on outdated assumptions. Most organizations find 10-20% of activities are in the wrong column when rigorously analyzed.',
        evidence: 'Ask for: last make-vs-buy analysis, outsourcing scope and cost, insourced activities that could be outsourced. Check if total cost of ownership is used vs. unit cost comparison.',
        shape: 'Recent analysis with outcome. Strong: specific recent analysis with quantified decision. Weak: "We have always done it this way."'
      },
      {
        text: 'If you had to cut costs by 15% in 12 months without materially impacting quality or capacity, where would the money come from? Be specific and add it up.',
        desc: 'The "forced constraint" question reveals real savings potential. People inside the cost structure know where waste is — they need permission to say it. If total is well below 15%, structural changes may be needed.',
        evidence: 'Map each source to P&L. Challenge "people reduction" with: "Where would the work go?" Challenge procurement savings with: "Have you already tried?" This separates new ideas from recycled ones.',
        shape: 'Specific savings plan that adds up to a total. Strong: named sources with dollar amounts that total near 15% of addressable cost. Weak: "We would have to look at everything."'
      }
    ]
  },
  {
    id: 'lib-tpl-quick-001__en',
    name: 'Rapid Stakeholder Diagnostic',
    description: 'Structured 20-minute interview for rapidly capturing stakeholder perspective, uncovering hidden dynamics, and identifying critical risks and decisions. Designed for early-stage project diagnostics where you need to map the political and strategic landscape quickly.',
    category: 'QUICK',
    questions: [
      {
        text: 'Help me understand your role here. What are you accountable for, what decisions can you make unilaterally, and where do you need alignment from others?',
        desc: 'Goes beyond title to real authority and influence. The gap between formal accountability and actual decision power reveals organizational dynamics.',
        evidence: 'Note formal role vs. described authority. Probe: "What was the last significant decision you made without asking anyone?" If they cannot name one, they may have less authority than their title suggests.',
        shape: 'Clear accountability with honest authority assessment. Strong: named scope, specific decision limits, known dependencies. Weak: "I manage the plant" without authority clarity.'
      },
      {
        text: 'In one sentence, what is this initiative trying to achieve? Now tell me what you personally think the real outcome will be, and rate your confidence 1-10.',
        desc: 'The gap between official objective and personal prediction is extremely revealing. Confidence below 6 with diplomatic official statement signals hidden concerns.',
        evidence: 'Note the gap between official and personal views. If significantly different, explore why. Ask: "What would need to change for your confidence to go from X to 8?"',
        shape: 'Official + honest personal view with confidence. Strong: differentiated answers with specific gap reasoning. Weak: same answer for both, or high confidence without evidence.'
      },
      {
        text: 'Name the 3 people whose support is critical for success. And who is the one person most likely to resist or slow things down — and why?',
        desc: 'Stakeholder power mapping through insider eyes. The "resistor" question surfaces political dynamics no document will show. The "why" reveals whether resistance is political, rational, or emotional.',
        evidence: 'Build mental stakeholder map: supporters, blockers, undecided. For the resistor: is resistance political (turf), rational (genuine concerns), or emotional (fear of change)?',
        shape: 'Named people with reasoning. Strong: specific names with behavioral predictions and reasoning. Weak: "Everyone supports this" or refusal to name resistors.'
      },
      {
        text: 'What has been tried before that is similar to this? What happened, and what should we learn from it?',
        desc: 'Organizational scar tissue from past failures impacts current success dramatically. If a similar initiative failed recently, many people expect this one to fail too.',
        evidence: 'Probe deeply: what went wrong, who was involved, what narrative formed. Ask: "Are any of the same people involved this time?" and "Does this initiative have a reputation already?"',
        shape: 'Honest history with lessons. Strong: specific past initiative with failure analysis and implications for current effort. Weak: "Nothing like this has been tried" (unlikely in any organization).'
      },
      {
        text: 'Top 3 risks that could derail this. For each: how likely (1-10), when it would hit, and what would you do about it.',
        desc: 'Risk quality assessment. Mature operators identify specific, actionable risks with timing. Immature ones give generic risks. Mitigation quality shows execution depth.',
        evidence: 'Push for specificity: "Which specific resources? When would the constraint bite?" Map risks to timeline to find when the initiative is most vulnerable.',
        shape: 'Specific risks with timing and mitigation. Strong: named risks with probability, timeline, and actionable mitigation. Weak: "Not enough budget, not enough time, not enough people."'
      },
      {
        text: 'What information do you have access to that the project team probably does not? What context would change how they approach this?',
        desc: 'The highest-value question. Stakeholders have context — political dynamics, upcoming changes, personal agendas — that never makes it into project documentation. Works best late in interview when rapport is established.',
        evidence: 'Create space for candor. Listen for: upcoming org changes, budget pressures, interpersonal conflicts, competing initiatives, customer situations that change urgency.',
        shape: 'Insider context that changes the picture. Strong: specific undocumented factors (pending decisions, political dynamics, resource conflicts). Weak: "I think you have everything you need."'
      },
      {
        text: 'If this succeeds, what changes for you personally? If it fails, what are the consequences for you?',
        desc: 'Personal stakes reveal motivation and alignment. Misalignment between personal incentives and initiative goals is a critical risk factor.',
        evidence: 'Listen for alignment between incentives and goals. Misalignment (e.g., "my bonus is tied to volume but this will temporarily reduce output") needs to be addressed.',
        shape: 'Honest self-interest assessment. Strong: specific personal stakes with honest consequences assessment. Weak: "I just want it to succeed for the company" (too diplomatic).'
      },
      {
        text: 'We have 30 seconds left. What is the one thing you wanted to tell me today but I did not create the opening for?',
        desc: 'Time pressure plus permission creates candor. This question consistently surfaces the most important insight. The artificial time constraint gives permission to skip diplomatic framing.',
        evidence: 'Whatever they say here is almost always the most important thing in the interview. Write it down verbatim.',
        shape: 'Unfiltered insight. Could be anything — the key is it comes unprompted. Even "No, we covered everything" tells you about their engagement level or trust.'
      }
    ]
  }
];

(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('=== Rewriting English system templates ===\n');

  for (const t of templates) {
    await client.query(
      `UPDATE interview_library_templates SET name = $1, description = $2, updated_at = NOW() WHERE id = $3`,
      [t.name, t.description, t.id]
    );

    await client.query(`DELETE FROM interview_library_template_questions WHERE template_id = $1`, [t.id]);

    for (let i = 0; i < t.questions.length; i++) {
      const q = t.questions[i];
      const qId = `${t.id}__q${String(i + 1).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO interview_library_template_questions
          (id, template_id, question_text, description, evidence_prompt, expected_answer_shape, sort_order, is_required, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW())`,
        [qId, t.id, q.text, q.desc, q.evidence, q.shape, i + 1]
      );
    }
    console.log(`✓ ${t.name}: ${t.questions.length} questions`);
  }

  const stats = await client.query(`
    SELECT t.id, t.name, t.language, COUNT(q.id) as qc
    FROM interview_library_templates t
    LEFT JOIN interview_library_template_questions q ON q.template_id = t.id
    WHERE t.template_scope = 'system'
    GROUP BY t.id, t.name, t.language
    ORDER BY t.language, t.name
  `);
  console.log('\n=== System templates summary ===');
  stats.rows.forEach((r: any) => console.log(`  [${r.language}] ${r.name}: ${r.qc} questions`));

  await client.end();
  console.log('\n✓ Done!');
})();
