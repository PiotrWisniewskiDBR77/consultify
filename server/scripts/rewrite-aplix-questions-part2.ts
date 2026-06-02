/**
 * APLIX NA Questions Rewrite — Part 2
 *
 * Covers 5 process-specific interview templates (50 questions total):
 *   1. Converting (Lamination, Cutting, Converting)
 *   2. Maintenance and Reliability
 *   3. Quality and Testing
 *   4. Planning and Scheduling
 *   5. Supply Chain and Logistics
 *
 * Run: DOTENV_CONFIG_PATH=.env.local npx tsx server/scripts/rewrite-aplix-questions-part2.ts
 */

export interface QuestionUpdate {
  id: string;
  question_text: string;
  description: string;
  evidence_prompt: string;
  expected_answer_shape: string;
}

// ─── APLIX Process — Lamination, Cutting, and Converting (aplix-na__aplix_process_converting_v1) ───

export const convertingQuestions: QuestionUpdate[] = [
  {
    id: 'aplix-na__aplix_process_converting_v1_q01',
    question_text:
      'Which converting steps create the most delay or variation today — lamination, cutting, slitting, packaging, or special finishing? Walk us through a recent example where one of these steps slowed things down. What was the root cause, and how did the team work around it?',
    description:
      'We want to identify which specific converting operations are the biggest sources of lost time or inconsistency. This helps us focus improvement efforts where the payoff is highest.',
    evidence_prompt:
      'Name the top 1–2 bottleneck steps and estimate how much time they add (minutes per changeover, hours per shift of downtime, percentage of orders delayed). Reference specific product families or machine lines if possible. Include any data from shift logs, OEE tracking, or scheduling boards.',
    expected_answer_shape:
      'A ranked list of converting steps by impact, with a concrete recent example including the product, the delay duration, the root cause, and any workaround used.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q02',
    question_text:
      'Where do product customization requirements create the greatest complexity for planning, setups, or execution? Think about customer-specific widths, adhesive types, packaging configs, or labeling — which of these variations cause the most headaches on the floor?',
    description:
      'APLIX serves diverse industries with highly customized products. We need to understand which dimensions of customization actually create operational pain versus those that are handled smoothly.',
    evidence_prompt:
      'Describe 2–3 specific customization dimensions that drive complexity (e.g., slit width tolerances, lamination adhesive types, special packaging requirements). For each, explain how it affects setup time, error rate, or scheduling difficulty. Estimate how many SKU variants run through converting monthly.',
    expected_answer_shape:
      'A list of customization drivers ranked by operational impact, with estimated setup-time penalties and error rates for the most problematic ones.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q03',
    question_text:
      'How do teams currently know which job, specification, tooling, and quality requirement is correct for each order? Is this information pulled from a system, handed over on paper, or carried in someone\'s head? What happens when someone gets it wrong?',
    description:
      'We\'re mapping how job information flows to operators. Gaps here typically cause wrong setups, scrap, and rework — and they\'re often fixable with better digital workflows.',
    evidence_prompt:
      'Describe the information journey for a typical converting order: where does the operator find the spec (ERP screen, printed traveler, whiteboard, verbal instruction)? How often do spec errors occur — estimate incidents per week or month. Give an example of a recent mix-up and its consequences (scrap cost, rework time, customer impact).',
    expected_answer_shape:
      'A step-by-step description of how job info reaches the operator, the most common failure points, and a concrete example of what happens when the information is wrong.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q04',
    question_text:
      'What are the most common causes of rework or scrap in converting, and how quickly are they contained once someone spots the problem? Are there patterns — certain products, machines, shifts, or conditions that keep showing up?',
    description:
      'Understanding the scrap and rework drivers in converting helps us prioritize quality improvements that save real money. Fast containment is just as important as prevention.',
    evidence_prompt:
      'List the top 3–5 rework/scrap causes (e.g., adhesive bond failure, slitting tolerance, contamination, wrong material loaded). For each, estimate the frequency (times per week) and average cost or quantity lost. Describe the containment process: who decides to stop, how long does it take from detection to containment, and what documentation is created.',
    expected_answer_shape:
      'A Pareto-style list of scrap/rework causes with frequency, estimated cost impact, and a description of the current containment speed and process for each.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q05',
    question_text:
      'Where does converting inefficiency hit cost or margin most strongly — changeovers, labor intensity, material loss, or missed delivery commitments? If you had to put a rough dollar figure or percentage on the biggest one, what would it be?',
    description:
      'This helps us build the business case for improvement. We need to understand which type of waste has the largest financial footprint so recommendations are grounded in real impact.',
    evidence_prompt:
      'Rank these cost drivers for converting: changeover/setup time loss, direct labor cost per unit, material waste/yield loss, premium freight or penalties from missed delivery. Provide rough estimates where possible — annual scrap cost, average changeover duration × frequency, overtime hours related to converting. Reference any financial reports, yield reports, or OEE summaries you have access to.',
    expected_answer_shape:
      'A ranked list of cost drivers with rough financial estimates (dollars, percentages of revenue or cost, or hours lost per month), plus identification of which single driver is the largest opportunity.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q06',
    question_text:
      'How well do planning, production, quality, and warehouse teams coordinate when priorities change during the day? For example, if a hot order comes in or a quality hold stops a line — how does the information flow, and how quickly does everyone adjust?',
    description:
      'Real-time coordination across functions is where many plants lose hours every day. We want to see how smoothly APLIX Charlotte handles the inevitable disruptions.',
    evidence_prompt:
      'Describe a recent example of an intra-day priority change: what triggered it, who was involved, how was the new priority communicated (radio, phone, walk to the floor, system update), and how long did it take for all affected teams to realign. Estimate how often these mid-day changes happen (times per day or week).',
    expected_answer_shape:
      'A narrative of a real coordination event, the communication channels used, the response time, and an estimate of how frequently this type of disruption occurs.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q07',
    question_text:
      'How visible is WIP, queue length, and order status for converting operations in real time? If a customer called right now asking where their order is, how quickly and confidently could you answer? What systems or tools would you check?',
    description:
      'Real-time visibility into converting status is essential for both internal scheduling and customer communication. We want to understand the current state and the gaps.',
    evidence_prompt:
      'Describe how WIP and order status are currently tracked: is it a live dashboard, ERP query, whiteboard, spreadsheet, or verbal check with a supervisor? How current is the information (real-time, hourly, daily)? Estimate the time it would take to answer a specific customer order-status inquiry. Identify the biggest blind spot in converting visibility today.',
    expected_answer_shape:
      'A description of current tracking tools and their refresh frequency, the estimated response time for an order-status inquiry, and identification of the main visibility gap.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q08',
    question_text:
      'Which constraints most often prevent smooth flow in converting — tooling availability, staffing levels, material readiness, paperwork or approvals, or last-minute schedule changes? When two or more of these collide, what does the fallout typically look like?',
    description:
      'Converting flow depends on many inputs arriving at the right time. We need to know which input failures are most frequent and most damaging when they happen.',
    evidence_prompt:
      'Rank the top 3 flow constraints by frequency and severity. For each, give a specific example: what happened, how long the line waited, and what the downstream effect was (delayed shipment, overtime, partial order). If you track downtime reasons or delay codes, share the top categories.',
    expected_answer_shape:
      'A ranked list of flow constraints with specific examples and estimated frequency, plus a description of what happens when multiple constraints hit simultaneously.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q09',
    question_text:
      'If you could redesign one part of the converting process from scratch — to make it simpler, faster, and more predictable — which part would you pick and what would you change? Don\'t worry about budget or politics for a moment — just tell us where the biggest design-level improvement opportunity sits.',
    description:
      'This is your chance to think big. We want to hear from the people closest to the work about what they would fix if they had a blank sheet of paper.',
    evidence_prompt:
      'Identify the specific process step or workflow you would redesign. Explain what\'s wrong with the current design (not just execution). Describe your ideal-state vision: what would it look like, how would it perform, and what would be different for the people doing the work. Estimate the potential impact in terms of throughput, quality, or lead time.',
    expected_answer_shape:
      'A focused description of one process area to redesign, the current design flaw, the ideal-state vision, and a rough estimate of the performance improvement potential.',
  },
  {
    id: 'aplix-na__aplix_process_converting_v1_q10',
    question_text:
      'What digital workflow, automation, or alerting capability would eliminate the most avoidable noise in converting? Think about the things that pull supervisors off the floor, force manual data entry, or require someone to chase information that should just be available.',
    description:
      'We\'re looking for the digital quick wins — the tools or automations that would give the converting team back the most time and focus.',
    evidence_prompt:
      'Describe 1–3 specific digital capabilities you wish you had (e.g., automatic job-spec push to operator screens, real-time scrap alerts, digital changeover checklists, automated production reporting). For each, estimate how much time it would save per shift or how many errors it would prevent. Explain what you currently do instead.',
    expected_answer_shape:
      'A prioritized list of 1–3 digital capabilities with a description of the current manual workaround and the estimated time or error savings for each.',
  },
];

// ─── APLIX Process — Maintenance and Reliability (aplix-na__aplix_process_maintenance_v1) ────

export const maintenanceQuestions: QuestionUpdate[] = [
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q01',
    question_text:
      'What share of maintenance work is planned versus reactive today — roughly, what percentage of your team\'s time goes to scheduled PM versus emergency breakdowns? What\'s preventing you from shifting that balance further toward planned work?',
    description:
      'The planned-to-reactive ratio is one of the clearest indicators of maintenance maturity. We want to understand both the current state and the specific barriers to improvement.',
    evidence_prompt:
      'Estimate the planned vs. reactive split as a percentage (e.g., 40/60). Describe the top 2–3 barriers to increasing planned work: is it insufficient PM schedules, chronic understaffing, unreliable spare parts, too many breakdowns consuming all available hours, or lack of condition data? If you track work-order types, share the recent breakdown.',
    expected_answer_shape:
      'A percentage split (planned vs. reactive) with the top 2–3 barriers explained and, if available, work-order category data to support the estimate.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q02',
    question_text:
      'Which machines or subsystems fail most often, and what operational impact do those failures create? We\'re talking about the "usual suspects" — the equipment that keeps your team busy and keeps production managers nervous.',
    description:
      'Identifying the chronic offenders is the starting point for any reliability improvement program. We need to connect machine failures to business consequences.',
    evidence_prompt:
      'Name the top 3–5 machines or subsystems by failure frequency (e.g., specific extruder components, laminator heating systems, slitter blades, packaging line actuators). For each, estimate failure frequency (times per month), average downtime per event, and the production or delivery impact. Reference any CMMS data, downtime logs, or maintenance meeting notes.',
    expected_answer_shape:
      'A list of the top 3–5 failure-prone assets with failure frequency, average downtime, and a description of the business impact for each.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q03',
    question_text:
      'How are breakdowns, interventions, root causes, and spare-part consumption tracked today? Walk us through what happens from the moment a machine goes down to the moment the work order is closed. Where is the data incomplete, inconsistent, or just not captured?',
    description:
      'Good maintenance data is the foundation for reliability improvement. We need to understand what\'s being captured, what\'s missing, and where the process breaks down.',
    evidence_prompt:
      'Describe the current tracking system (CMMS name, spreadsheets, paper logs, or a combination). Walk through a typical breakdown event: who logs what, when, and in which system. Identify specific data gaps — for example, is root cause consistently recorded? Are spare parts linked to work orders? Is labor time accurate? Estimate what percentage of interventions are fully documented versus partially or not at all.',
    expected_answer_shape:
      'A description of the current tracking workflow, the systems used, specific data gaps identified, and an estimate of documentation completeness (percentage of work orders with full data).',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q04',
    question_text:
      'What reliability losses cost the business the most today? Think across all the ways unreliable equipment hurts you — production downtime, overtime to recover, spare parts spend, scrap from unstable processes, disrupted customer deliveries, or quality instability. Which of these is the biggest dollar item?',
    description:
      'We need to connect reliability to money. This helps build the case for investment and ensures we attack the highest-value problems first.',
    evidence_prompt:
      'Rank the following cost categories for maintenance-related losses: unplanned downtime (lost production hours × value), overtime and contractor costs, spare parts and materials, scrap attributable to equipment issues, premium freight from delayed shipments, customer penalties or claims. Provide rough annual estimates where possible. Reference any cost reports, downtime summaries, or budget data.',
    expected_answer_shape:
      'A ranked list of reliability cost categories with rough annual dollar estimates, identifying the single largest cost driver and the data source used for the estimate.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q05',
    question_text:
      'How well do operators and maintenance technicians communicate early warning signs before failures become urgent events? Are there established channels — like operator-reported anomalies, vibration checks, or temperature monitoring — or does most communication happen when something actually breaks?',
    description:
      'Early detection is the cheapest form of reliability. We want to understand whether operators are empowered and equipped to flag emerging problems before they become breakdowns.',
    evidence_prompt:
      'Describe how operators currently report equipment concerns: is there a formal system (tags, digital reports, CMMS requests), an informal process (verbal to supervisor, notes on whiteboard), or does it mostly not happen until failure? Estimate what percentage of breakdowns had observable warning signs that were either missed or not acted on. Give a specific example of a failure that could have been caught earlier.',
    expected_answer_shape:
      'A description of the current operator-to-maintenance communication process, an estimate of preventable breakdowns, and a concrete example of a failure with missed early signals.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q06',
    question_text:
      'How do you prioritize maintenance work when preventive tasks, active breakdowns, and improvement projects all compete for the same people at the same time? Is there a clear prioritization framework, or does it come down to whoever shouts loudest?',
    description:
      'Work prioritization is where maintenance strategy meets daily reality. A clear framework prevents PM deferrals and ensures reliability investments don\'t get crowded out by firefighting.',
    evidence_prompt:
      'Describe the current prioritization approach: is there a formal priority matrix (safety > production-critical > PM > improvement), or is it informal? How often are scheduled PMs deferred due to breakdowns — estimate the deferral rate as a percentage. Who makes the priority call when conflicts arise? Describe a recent week where everything competed at once and explain how it was resolved.',
    expected_answer_shape:
      'A description of the prioritization framework (formal or informal), the estimated PM deferral rate, and a specific example of how competing demands were resolved in practice.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q07',
    question_text:
      'Which reliability metrics do you trust today — MTBF, MTTR, PM compliance, recurring failure rates, or others — and which ones are you less confident in? If a senior leader asked you "how reliable is the Charlotte plant?" right now, what data would you show them?',
    description:
      'Metrics only drive improvement when people trust them. We want to know which numbers are solid and which need better data quality or collection.',
    evidence_prompt:
      'List the reliability KPIs currently tracked (e.g., MTBF, MTTR, PM completion rate, breakdown frequency, spare parts cost). For each, rate your confidence level (high, medium, low) and explain why. Describe how these metrics are calculated — automatically from CMMS, manually compiled, or estimated. Identify which metric you wish you had but don\'t.',
    expected_answer_shape:
      'A list of current reliability metrics with confidence ratings and explanations, plus identification of the most important missing metric.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q08',
    question_text:
      'Where do spare parts availability, technical documentation, or specialist skills most often delay recovery from a breakdown? When a critical machine goes down at 2 AM, what\'s the typical bottleneck — finding the part, finding the person, or finding the information?',
    description:
      'Recovery speed depends on having the right parts, people, and knowledge available when needed. We need to identify which of these resources is the weakest link.',
    evidence_prompt:
      'For the last 3–5 significant breakdowns, describe what delayed recovery: was it waiting for a spare part (and how long), locating the right technical documentation (manuals, drawings, procedures), or getting a qualified technician on site? Estimate the average additional downtime caused by each type of delay. Describe how spare parts are managed today (min/max, kanban, ad hoc ordering) and how technical docs are stored (paper, shared drive, CMMS).',
    expected_answer_shape:
      'An analysis of recovery delays across parts, documentation, and skills, with specific examples and estimated additional downtime for each, plus a description of current parts and docs management.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q09',
    question_text:
      'What single reliability improvement would create the biggest operational gain first for the Charlotte plant? Think about something achievable in the next 6–12 months that would make a noticeable difference to uptime, cost, or team workload.',
    description:
      'We want your expert judgment on where to start. The best reliability roadmaps begin with a visible early win that builds momentum and credibility.',
    evidence_prompt:
      'Identify one specific reliability improvement (e.g., a targeted PM program for the top-3 failure machines, a vibration monitoring pilot, a spare parts optimization for critical assets, a lubrication standardization program). Explain why this one comes first: what\'s the expected impact on downtime or cost, how feasible is it with current resources, and what would success look like in 6–12 months.',
    expected_answer_shape:
      'A focused recommendation for one reliability improvement with rationale, expected impact (quantified if possible), feasibility assessment, and a clear definition of success.',
  },
  {
    id: 'aplix-na__aplix_process_maintenance_v1_q10',
    question_text:
      'What predictive, analytical, or workflow capability would most improve maintenance effectiveness without adding administrative burden? We\'re interested in tools that make technicians\' lives easier, not ones that create more paperwork.',
    description:
      'Technology should reduce friction, not add it. We want to find the digital capabilities that maintenance teams would actually use and value.',
    evidence_prompt:
      'Describe 1–3 specific capabilities you\'d find most valuable (e.g., vibration/temperature trending with automatic alerts, mobile work-order completion with photo capture, predictive spare-parts reordering, AI-assisted root cause analysis, digital PM checklists with compliance tracking). For each, explain what you currently do instead and estimate how much time or effort it would save. Be honest about what your team would actually adopt versus what would sit unused.',
    expected_answer_shape:
      'A prioritized list of 1–3 digital capabilities with a description of the current alternative, estimated time savings, and an honest assessment of team adoption likelihood.',
  },
];

// ─── APLIX Process — Quality and Testing (aplix-na__aplix_process_quality_v1) ────────────

export const qualityQuestions: QuestionUpdate[] = [
  {
    id: 'aplix-na__aplix_process_quality_v1_q01',
    question_text:
      'What are the main defect modes or quality escapes today, and where in the end-to-end process — from raw material through extrusion, converting, and final packaging — do they originate most often? Are these defects caught in-process, at final inspection, or sometimes by the customer?',
    description:
      'We need a clear picture of the defect landscape. Understanding where defects originate versus where they\'re detected reveals both process weaknesses and inspection effectiveness.',
    evidence_prompt:
      'List the top 3–5 defect types (e.g., hook density out of spec, adhesive bond failure, dimensional variance, contamination, visual defects). For each, identify the most likely process origin and where it\'s typically detected. Provide defect frequency data if available — PPM, percentage of lots affected, or number of incidents per month. Include any customer complaint data for the past 6–12 months.',
    expected_answer_shape:
      'A table or list of top defect types, each with the likely process origin, typical detection point, frequency estimate, and whether it has resulted in customer complaints.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q02',
    question_text:
      'Which tests or inspections are truly critical for managing customer risk — the ones that must be right every time — and where do those same tests become a throughput bottleneck? Are there tests you suspect add more delay than value?',
    description:
      'Not all inspections carry the same risk weight. We want to separate the must-haves from the nice-to-haves and identify where testing creates unnecessary flow constraints.',
    evidence_prompt:
      'List the key quality tests and inspections in the converting process (e.g., peel-strength testing, dimensional checks, visual inspection, hook/loop engagement tests). For each, indicate: is it customer-required, regulatory, or internal standard? How long does it take? Does it block production flow? Estimate the time lost per shift to testing queues or delayed results. Identify any tests you believe could be reduced in frequency or replaced with process controls.',
    expected_answer_shape:
      'A list of key tests/inspections categorized by criticality (customer, regulatory, internal), with estimated cycle time, flow impact, and recommendations for any that could be streamlined.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q03',
    question_text:
      'How is quality data collected, stored, and reviewed today? Walk us through the journey of a test result — from the moment it\'s measured to when it\'s used to make a decision. Where does manual handling still create delay, transcription errors, or loss of traceability?',
    description:
      'Quality data is only as good as the system that captures and delivers it. Manual steps in the data chain are where errors and delays creep in.',
    evidence_prompt:
      'Describe the quality data flow: what measurement tools are used (manual gauges, automated sensors, lab instruments), how results are recorded (paper forms, spreadsheets, QMS software, ERP), and who reviews them. Estimate how much quality data is still entered manually versus captured digitally. Identify the longest delay in the data chain (e.g., lab turnaround time, data entry backlog, approval queue). Name the systems involved and whether they are integrated.',
    expected_answer_shape:
      'A step-by-step quality data flow map identifying the tools, recording methods, review process, manual vs. digital split, longest delay point, and integration status of systems.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q04',
    question_text:
      'How much rework, scrap, premium freight, or customer risk is created by quality issues right now — and which category hurts the most? If you could wave a magic wand and eliminate one type of quality cost, which one would move the needle the most?',
    description:
      'Quantifying the cost of poor quality is essential for prioritizing improvements. We need to understand the financial weight of each quality-related cost category.',
    evidence_prompt:
      'Estimate the annual or monthly cost of quality across these categories: scrap (material value lost), rework (labor and machine time), premium freight (expedited shipments to recover from quality delays), customer claims or credits, and internal overhead for investigation and containment. Rank them by dollar impact. Reference any COPQ (cost of poor quality) reports, scrap tracking, or customer complaint cost data.',
    expected_answer_shape:
      'A ranked breakdown of quality cost categories with rough dollar or percentage estimates, identification of the largest single category, and the data sources used.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q05',
    question_text:
      'How quickly do production, engineering, and quality teams align on containment and root cause when a serious quality issue appears? Walk us through a recent example — from first detection to containment decision to root cause identification. Where did the process work well, and where did it slow down?',
    description:
      'Speed and coordination in quality response directly affect how much product is at risk and how much recovery costs. We want to see the real response process in action.',
    evidence_prompt:
      'Describe a specific recent quality event (within the past 6 months if possible). Include: what was detected, how long until containment was initiated, who was involved, how root cause was determined, and the total elapsed time from detection to resolution. Estimate the cost of the event (scrap, rework, overtime, customer impact). Identify the specific step that took the longest and why.',
    expected_answer_shape:
      'A timeline narrative of a real quality event with elapsed time at each stage, people involved, cost impact, and identification of the slowest step with root cause for the delay.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q06',
    question_text:
      'Where does release timing — the decision that a batch is okay to ship — slow down production or shipping? What conditions create that delay: waiting for lab results, pending approvals, incomplete documentation, or something else? How often does this happen?',
    description:
      'Release bottlenecks can turn a quality system into a production constraint. We need to separate legitimate quality holds from process inefficiencies in the release workflow.',
    evidence_prompt:
      'Describe the current release process: who approves release, what data must be complete before release, and what is the typical release cycle time from last production step to ship-ready. Estimate how often release is delayed (percentage of batches or times per week) and the average delay duration. Identify the top 2–3 causes of release delays (e.g., pending lab results, missing CoA, supervisor unavailability, system downtime).',
    expected_answer_shape:
      'A description of the release workflow, typical cycle time, delay frequency and duration, and the top 2–3 delay causes with estimated impact on shipping timelines.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q07',
    question_text:
      'How easy is it to trace a customer complaint or failed test result back to the specific material lot, machine, run conditions, operator actions, and any prior quality signals? Could you do this in minutes, hours, or would it take days of detective work?',
    description:
      'Traceability is both a regulatory expectation and a diagnostic capability. The speed and completeness of trace-back reveals how well your data systems support root cause analysis.',
    evidence_prompt:
      'Describe a recent traceability exercise — either triggered by a customer complaint or an internal audit. How long did it take to connect the finished product back to: raw material lot, machine and line used, process parameters during the run, operator on shift, and any upstream quality data? Identify where the trace broke down or required manual searching. Rate overall traceability capability on a 1–10 scale and explain your rating.',
    expected_answer_shape:
      'A narrative of a real traceability exercise with elapsed time, the data points that were easy to find vs. hard to find, where the trace broke, and a self-assessed traceability score with explanation.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q08',
    question_text:
      'How systematically are recurring quality issues prevented from coming back? When a root cause is identified and a corrective action is implemented, how do you verify it worked — and how often do you find the same problem returning despite previous fixes?',
    description:
      'The corrective-action loop is where continuous improvement lives or dies. We need to understand whether the loop actually closes or whether the same issues keep cycling back.',
    evidence_prompt:
      'Describe the current corrective action process: how are actions assigned, tracked, and verified (CAPA system, spreadsheet, meeting follow-up)? Estimate the percentage of corrective actions that are completed on time vs. overdue. Identify 1–2 quality issues that have recurred despite previous corrective actions, and explain why the fix didn\'t stick. Share data on repeat nonconformances if available.',
    expected_answer_shape:
      'A description of the corrective action workflow, on-time completion rate, 1–2 examples of recurring issues with analysis of why previous fixes failed, and any repeat-NC data.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q09',
    question_text:
      'Which single quality problem should be attacked first because solving it would release the most capacity, build the most confidence, or create the most value for customers? What makes this one the right starting point?',
    description:
      'We want your expert judgment on the highest-leverage quality improvement. The best starting point balances impact, feasibility, and visibility.',
    evidence_prompt:
      'Identify one specific quality problem (e.g., a particular defect type, a testing bottleneck, a traceability gap, a recurring customer complaint category). Explain why this is the #1 priority: quantify the current impact (scrap cost, throughput loss, customer risk), describe what solving it would unlock, and assess how feasible the fix is with current resources and knowledge. Describe what "solved" looks like.',
    expected_answer_shape:
      'A focused recommendation for one quality problem to tackle first, with quantified current impact, description of what solving it would unlock, feasibility assessment, and a clear definition of success.',
  },
  {
    id: 'aplix-na__aplix_process_quality_v1_q10',
    question_text:
      'What analytical, workflow, or AI-assisted capability would help the quality function move faster and see more without reducing the level of control? Think about what would help you catch problems earlier, close investigations faster, or eliminate manual data work.',
    description:
      'We\'re looking for digital capabilities that strengthen quality without slowing it down — tools that give the quality team better eyes and faster hands.',
    evidence_prompt:
      'Describe 1–3 specific capabilities you\'d want (e.g., real-time SPC dashboards with automatic alerts, AI-assisted defect image classification, digital CAPA workflow with automatic escalation, automated CoA generation, predictive quality models that flag risk conditions before defects occur). For each, explain what you currently do instead, how much time or risk it would reduce, and how it would fit into the existing quality process.',
    expected_answer_shape:
      'A prioritized list of 1–3 digital quality capabilities with descriptions of the current alternative, estimated impact on speed and control, and practical fit with existing workflows.',
  },
];

// ─── APLIX Process — Planning and Scheduling (aplix-na__aplix_process_planning_v1) ───────

export const planningQuestions: QuestionUpdate[] = [
  {
    id: 'aplix-na__aplix_process_planning_v1_q01',
    question_text:
      'How is the production schedule built today — what inputs go into it, and which of those inputs are the most unstable or hardest to trust? Walk us through a typical planning cycle: who does it, what tools are used, and how long does it take to produce a workable schedule?',
    description:
      'Understanding the scheduling process end-to-end reveals where planners spend their time and where the inputs let them down. Unstable inputs are usually the root cause of rescheduling pain.',
    evidence_prompt:
      'Describe the planning cycle: frequency (daily, weekly), who builds the schedule, what systems are used (ERP module, spreadsheet, manual board), and how long it takes. List the key inputs (demand forecast, inventory levels, machine availability, staffing, material availability) and rate each for reliability (high, medium, low). Identify which input causes the most plan changes after release.',
    expected_answer_shape:
      'A step-by-step description of the scheduling process, the tools used, cycle time, a rated list of inputs by reliability, and identification of the most problematic input.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q02',
    question_text:
      'How often do plans change after they\'re released to the floor — daily, multiple times a day? What are the most common triggers for replanning: rush orders, material shortages, machine breakdowns, quality holds, or something else? Roughly what share of the original schedule actually runs as planned?',
    description:
      'Plan stability is a leading indicator of operational predictability. Frequent changes ripple through production, quality, warehouse, and customer service.',
    evidence_prompt:
      'Estimate the schedule adherence rate (percentage of jobs that run on the day and in the sequence originally planned). List the top 3–5 triggers for replanning and estimate how often each occurs per week. Describe the replanning process: who initiates it, how is it communicated, and how long does it take to restabilize. Provide a recent example of a particularly disruptive schedule change.',
    expected_answer_shape:
      'Schedule adherence percentage, a ranked list of replanning triggers with frequency estimates, a description of the replanning process, and a specific disruptive example.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q03',
    question_text:
      'Which systems support planning today — ERP, APS, spreadsheets, email, whiteboards — and where do planners still rely on manual workarounds to get the job done? What system capability is most obviously missing?',
    description:
      'The gap between what the system provides and what planners actually need is where manual effort and risk live. We want to map the tool landscape honestly.',
    evidence_prompt:
      'List every system and tool planners use in their daily work (e.g., SAP/Oracle planning module, Excel workbooks, email for priority changes, shared drives for capacity tables, physical boards for sequencing). For each, describe what it\'s used for and what it does well vs. poorly. Identify the top 2–3 tasks that should be system-supported but are currently manual. Estimate the hours per week spent on these manual workarounds.',
    expected_answer_shape:
      'A complete inventory of planning tools with strengths and weaknesses, identification of the top manual workarounds, and estimated hours per week spent on them.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q04',
    question_text:
      'What is the biggest business cost of planning instability today — excess inventory as a buffer, missed customer service targets, expediting and premium freight, overtime costs, or poor asset utilization? If you could put a rough number on the single largest cost, what would it be?',
    description:
      'Planning instability creates hidden costs across the entire operation. We need to understand which cost category dominates so improvement efforts target the right lever.',
    evidence_prompt:
      'Rank these cost categories related to planning instability: inventory carrying cost (safety stock excess), missed OTIF (on-time in-full) and its commercial consequences, expediting costs (premium freight, overtime, contractor labor), lost capacity from poor sequencing or excessive changeovers. Provide rough annual estimates where possible. Reference any financial or operational reports that track these costs.',
    expected_answer_shape:
      'A ranked list of planning-instability cost categories with rough annual estimates, identification of the single largest cost, and the data sources or assumptions used.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q05',
    question_text:
      'Where do planning priorities conflict most with the expectations of production, sales, quality, or customer service? For example, when sales promises a delivery date that production can\'t hit, or when quality holds blow up a carefully built sequence — how is that tension resolved?',
    description:
      'Cross-functional conflict around the plan is normal, but how it\'s managed determines whether planning adds value or just absorbs blame. We want to understand the friction points.',
    evidence_prompt:
      'Describe the top 2–3 recurring priority conflicts between planning and other functions. For each, explain: what triggers the conflict, how it\'s typically resolved (escalation, negotiation, planner absorbs it), and who "wins" most often. Estimate how much time per week is spent managing these conflicts. Describe the most recent significant conflict and its outcome.',
    expected_answer_shape:
      'A description of 2–3 recurring cross-functional conflicts, the resolution pattern for each, estimated time spent on conflict management, and a specific recent example.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q06',
    question_text:
      'How do you balance product mix, setup loss, customer urgency, and capacity constraints when trade-offs are required? Is there a decision framework — written rules, optimization logic, or even rules of thumb — or does it depend on the planner\'s experience and judgment?',
    description:
      'Scheduling trade-offs happen every day. We want to understand whether these decisions are systematic and repeatable, or dependent on individual knowledge.',
    evidence_prompt:
      'Describe how trade-off decisions are made: are there formal rules (e.g., minimum campaign lengths, customer priority tiers, setup-sequence matrices), informal guidelines, or purely planner discretion? Give a specific example of a recent complex trade-off: what was at stake, what options were considered, and how was the final decision made. Estimate how long such decisions take and how confident you are that two planners would make the same call.',
    expected_answer_shape:
      'A description of the current decision-making approach (formal vs. informal), a specific trade-off example with the decision process, and an assessment of consistency across planners.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q07',
    question_text:
      'How visible is the ripple effect of a schedule change across material requirements, quality testing needs, labor allocation, and customer commitments? When you move a job, can you immediately see everything that\'s affected — or do surprises pop up later?',
    description:
      'Schedule changes rarely affect just one thing. We want to understand how well the plant can see and manage the cascading effects of plan changes.',
    evidence_prompt:
      'Describe what happens when a significant schedule change is made: which downstream impacts are visible immediately (e.g., material shortages flagged by ERP), which emerge later (e.g., customer commit date at risk, lab capacity overloaded), and which are typically discovered too late (e.g., labor imbalance on a shift, tooling conflict). Estimate how often a schedule change creates an unintended downstream problem. Describe a recent example of a cascading impact that wasn\'t caught in time.',
    expected_answer_shape:
      'A map of schedule-change impacts categorized as immediately visible, delayed, and typically missed, with a frequency estimate of unintended consequences and a specific example.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q08',
    question_text:
      'Which part of the current planning process consumes the most manual effort without adding proportional decision value? Think about the reports you build, the meetings you attend, the data you reconcile — what feels like busywork versus real planning?',
    description:
      'Planners often spend more time gathering and formatting data than actually making decisions. We want to find the low-value time sinks that could be automated or eliminated.',
    evidence_prompt:
      'List the top 3–5 time-consuming planning activities and estimate hours per week for each. For each activity, rate its decision value (high, medium, low) — meaning, does it actually improve the quality of the schedule or is it mostly administrative? Identify the single activity with the worst ratio of effort to value. Describe what an ideal replacement would look like.',
    expected_answer_shape:
      'A list of planning activities ranked by time investment, each rated for decision value, with the worst effort-to-value activity highlighted and an ideal-state alternative described.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q09',
    question_text:
      'If you could redesign one planning rule, meeting, or workflow from scratch to improve predictability the fastest, which one would it be? What\'s wrong with the current version, and what would the new version look like?',
    description:
      'Sometimes the biggest gains come from fixing one broken process rather than adding new technology. We want your practical insight into what needs redesigning.',
    evidence_prompt:
      'Identify one specific rule, meeting, or workflow to redesign (e.g., the frozen-period policy, the daily scheduling meeting, the demand-handoff process from sales, the changeover-sequencing logic). Explain what\'s wrong with the current version: is it too rigid, too informal, poorly attended, based on outdated assumptions? Describe your redesigned version and estimate the impact on schedule stability or planner workload.',
    expected_answer_shape:
      'A focused recommendation for one process to redesign, a clear description of the current problem, the proposed new design, and an estimated impact on predictability or workload.',
  },
  {
    id: 'aplix-na__aplix_process_planning_v1_q10',
    question_text:
      'What decision-support capability would make planners more proactive instead of reactive? Think about what would help you see problems before they hit, simulate alternatives faster, or communicate plan changes more effectively across the organization.',
    description:
      'We\'re looking for the digital leverage point that shifts planning from firefighting mode to anticipation mode.',
    evidence_prompt:
      'Describe 1–3 specific decision-support capabilities you\'d find most valuable (e.g., what-if scenario simulation, demand-sensing integration, automatic constraint-violation alerts, visual schedule boards with drag-and-drop rescheduling, AI-suggested optimal sequences). For each, explain what situation it would help with, what you currently do instead, and how it would change your daily work. Be realistic about what would actually get used.',
    expected_answer_shape:
      'A prioritized list of 1–3 decision-support capabilities with the use case, current workaround, expected impact on proactive planning, and an honest adoption-readiness assessment.',
  },
];

// ─── APLIX Process — Supply Chain and Logistics (aplix-na__aplix_process_supply_chain_v1) ──

export const supplyChainQuestions: QuestionUpdate[] = [
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q01',
    question_text:
      'Where are the biggest delays or surprises in the material-to-customer flow today — from inbound raw materials arriving at the Charlotte plant through production, warehousing, and outbound shipping? Walk us through a recent example of a delivery that didn\'t go as planned.',
    description:
      'We\'re mapping the end-to-end supply chain to find the most impactful friction points. A real example helps us understand not just where delays occur, but why and how they cascade.',
    evidence_prompt:
      'Identify the top 2–3 points in the supply chain where delays or surprises most commonly occur (e.g., inbound material late from France, WIP stuck in quality hold, finished goods not staged for pickup, carrier issues). For each, estimate the frequency (times per week or month) and typical delay duration. Describe a specific recent example: what order was affected, what caused the delay, how was it discovered, and what was the customer impact.',
    expected_answer_shape:
      'A list of top delay points with frequency and duration estimates, plus a detailed narrative of a recent delivery failure including root cause and customer impact.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q02',
    question_text:
      'Which shortages, late materials, or internal availability issues disrupt the plant most often? Are these primarily inbound supplier issues — especially materials coming from the APLIX France facility — or internal problems like WIP not being ready when needed or finished goods misallocated?',
    description:
      'Material availability is the lifeblood of production. We need to distinguish between external supply problems and internal flow problems because they require different solutions.',
    evidence_prompt:
      'Categorize recent shortage events: inbound from external suppliers, inbound from APLIX France (inter-company transfers), internal WIP availability, or finished goods allocation errors. Estimate how often each category causes a disruption (times per month) and the typical impact (hours of production lost, orders delayed). Identify the top 3 most disruptive material items and their supply source. Describe the early-warning system (or lack thereof) for detecting shortages.',
    expected_answer_shape:
      'A categorized breakdown of shortage sources with frequency and impact estimates, the top 3 problem materials, and a description of the current shortage detection capability.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q03',
    question_text:
      'How accurate and timely is your inventory visibility across raw material, WIP, finished goods, and customer allocations? If you looked at the system right now, how confident would you be that the numbers match what\'s actually on the shelf or on the floor?',
    description:
      'Inventory accuracy is foundational — every planning, promising, and allocation decision depends on it. We need an honest assessment of where the numbers are trustworthy and where they\'re not.',
    evidence_prompt:
      'Estimate inventory accuracy for each category: raw materials, WIP, finished goods, and allocated/reserved stock. Use percentage accuracy if you do cycle counts, or rate confidence as high/medium/low with explanation. Describe how inventory is updated: real-time scanning, periodic manual counts, backflushing, or a combination. Identify the category with the worst accuracy and explain why. Reference any recent cycle-count results or inventory adjustment data.',
    expected_answer_shape:
      'Inventory accuracy estimates by category (RM, WIP, FG, allocated), description of how inventory is maintained, identification of the weakest category with root cause, and any supporting cycle-count data.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q04',
    question_text:
      'Where do logistics or inventory decisions create the highest avoidable cost today — premium freight, excess stock tying up cash, obsolescence and write-offs, or service-recovery costs like expediting and overtime? Which one of these is keeping you up at night?',
    description:
      'Supply chain costs are often hidden in different budgets. We need to surface the total cost picture to prioritize the biggest savings opportunities.',
    evidence_prompt:
      'Rank these supply-chain cost categories by estimated annual impact: premium/expedited freight, excess inventory carrying cost, obsolete inventory write-offs, service-recovery costs (overtime, special production runs, air freight to customers). Provide rough dollar estimates or percentages where possible. Identify the single largest avoidable cost and describe what drives it. Reference any freight spend reports, inventory aging reports, or customer penalty data.',
    expected_answer_shape:
      'A ranked list of supply-chain cost categories with rough annual estimates, identification of the single largest avoidable cost, the drivers behind it, and data sources referenced.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q05',
    question_text:
      'Which handoffs between procurement, planning, warehouse, production, and customer-facing teams create the most misunderstanding, rework, or dropped information? Think about the moments where responsibility passes from one group to another — where does the baton get dropped?',
    description:
      'Cross-functional handoffs are where supply chain execution often fails. Each dropped handoff means wasted time, frustrated people, and potentially a missed customer commitment.',
    evidence_prompt:
      'Identify the top 2–3 handoff points that cause the most problems (e.g., procurement → planning for material availability dates, planning → warehouse for pick/staging priorities, production → shipping for ready-to-ship status, customer service → planning for rush-order insertion). For each, describe what information is supposed to transfer, how it actually transfers (system, email, phone, verbal), and what typically goes wrong. Estimate how often each handoff fails per week.',
    expected_answer_shape:
      'A description of 2–3 problematic handoff points with the intended information transfer, actual communication method, typical failure mode, and failure frequency per week.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q06',
    question_text:
      'How are urgent orders or exceptions handled today — and what makes those situations harder than they should be? When a customer calls with an emergency need or sales pushes a hot order, what does the scramble look like from a supply chain perspective?',
    description:
      'Exception handling reveals the flexibility and stress tolerance of the supply chain. We want to understand both the process and the pain points that make urgent orders disproportionately expensive.',
    evidence_prompt:
      'Describe the urgent-order process: who initiates it, what approvals are needed, how is it inserted into the production schedule, and how does it affect other orders in the pipeline? Estimate how many urgent or exception orders you handle per week and the typical additional cost per event (overtime, changeover waste, displaced orders). Identify what makes exceptions harder than necessary: lack of visibility, no standard process, too many approvals, or inadequate inventory buffers. Describe a recent exception and what it cost.',
    expected_answer_shape:
      'A description of the urgent-order process, frequency and cost estimates, identification of the factors that make exceptions unnecessarily difficult, and a specific recent example with cost impact.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q07',
    question_text:
      'How integrated are your supplier signals, ERP data, warehouse management, and shipment tracking today? Can you see a complete picture of an order — from supplier promise through production to customer delivery — in one place, or do you have to stitch it together from multiple systems?',
    description:
      'System integration determines how quickly the supply chain can sense and respond to changes. Fragmented visibility creates delays, errors, and excessive manual work.',
    evidence_prompt:
      'Map the key information systems in the supply chain: supplier portal or EDI, ERP (name and modules used), WMS (or warehouse tracking method), TMS or carrier tracking, and customer-facing order status. For each pair of adjacent systems, describe the integration level: real-time API, batch file transfer, manual re-entry, or no integration. Identify the biggest blind spot — the place where you\'re missing visibility that matters. Estimate how much time per week is spent manually connecting information across systems.',
    expected_answer_shape:
      'A system-integration map showing each major system, the integration method between them, the biggest visibility blind spot, and estimated weekly hours spent on manual data stitching.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q08',
    question_text:
      'What physical-flow or information-flow bottlenecks occur most often inside the Charlotte site or between the site and customers? Think about things like dock congestion, staging-area limitations, label or paperwork delays, or communication gaps with carriers and freight forwarders.',
    description:
      'Even when planning and procurement work perfectly, physical and informational bottlenecks at the site level can undermine delivery performance. We want to identify the local constraints.',
    evidence_prompt:
      'Identify the top 2–3 physical or information bottlenecks at the Charlotte facility (e.g., limited dock doors creating truck-scheduling conflicts, staging space constraints for large orders, manual BOL or label generation, lack of carrier visibility for pickup scheduling). For each, describe how often it causes a problem, the typical impact on shipment timing, and any workarounds currently used. Estimate the average daily shipping delay attributable to site-level bottlenecks.',
    expected_answer_shape:
      'A list of top site-level bottlenecks (physical and informational) with frequency, shipping-time impact, current workarounds, and an estimate of average daily shipping delay.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q09',
    question_text:
      'Which supply-chain change would improve delivery reliability the fastest without creating a large cost penalty? Think about something achievable in the next 3–6 months that would make a real difference to OTIF performance and customer confidence.',
    description:
      'We want your practical judgment on the best first move. The ideal starting point is high-impact, achievable with current resources, and visible enough to build momentum.',
    evidence_prompt:
      'Identify one specific supply-chain improvement (e.g., better inbound material visibility from France, a finished-goods buffer strategy for top-volume SKUs, standardized urgent-order handling, improved dock-scheduling process, supplier lead-time monitoring dashboard). Explain why this change comes first: what\'s the expected OTIF improvement, what resources are needed, and what would success look like in 3–6 months. Estimate the cost and the payback.',
    expected_answer_shape:
      'A focused recommendation for one supply-chain improvement with rationale, expected OTIF impact, resource requirements, cost-benefit estimate, and a clear definition of success.',
  },
  {
    id: 'aplix-na__aplix_process_supply_chain_v1_q10',
    question_text:
      'What digital alerting, visibility, or exception-management capability would reduce firefighting the most across the supply chain? Think about the tool that would give your team the earliest warning when something is going off-track — so you can act before it becomes a crisis.',
    description:
      'We\'re looking for the digital capability that shifts supply chain management from reactive to anticipatory — the one tool that would give back the most time and reduce the most stress.',
    evidence_prompt:
      'Describe 1–3 specific digital capabilities that would reduce firefighting (e.g., inbound-shipment ETA alerts with automatic reschedule triggers, inventory-level alerts when safety stock is breached, customer order at-risk dashboards, automated exception escalation workflows, carrier performance scorecards with trend alerts). For each, describe the firefighting scenario it would prevent, what you currently do instead, and estimate how many hours per week it would save. Be honest about what your team would actually adopt.',
    expected_answer_shape:
      'A prioritized list of 1–3 digital capabilities with the specific firefighting scenario each addresses, the current manual alternative, estimated time savings, and an honest adoption-readiness assessment.',
  },
];
