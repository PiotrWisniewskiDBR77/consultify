export interface QuestionUpdate {
  id: string;
  question_text: string;
  description: string;
  evidence_prompt: string;
  expected_answer_shape: string;
}

// =============================================================================
// Template 1: APLIX Global - All Respondents
// =============================================================================

export const globalQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_global_all_v1_q01",
    question_text:
      "What are the three biggest operational problems you face today, and how do they affect delivery, quality, cost, or customer response? For each problem, describe how long it has existed, how often it disrupts your work, and what downstream consequences you see — whether that's late shipments, quality holds, cost overruns, or slower responses to customer requests.",
    description:
      "We're trying to understand the pain points that actually shape your daily work, not just the ones on a slide deck. This helps us focus transformation efforts on what hurts most right now.",
    evidence_prompt:
      "For each of the three problems, provide specific examples: Which product lines, customers, or process steps are affected? Approximate frequency (daily, weekly, monthly). Estimated impact in hours lost, dollars, scrap rate, or missed delivery dates. Any workarounds your team currently uses.",
    expected_answer_shape:
      "Three clearly separated problems, each with: (1) a concise name or description, (2) how often it occurs, (3) which business outcomes it affects (delivery/quality/cost/customer response), and (4) a concrete recent example or rough quantification of impact.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q02",
    question_text:
      "Where do you lose the most time during a normal week, and what usually causes that loss? Think about everything from waiting for information, chasing approvals, re-entering data, attending meetings that don't resolve anything, to dealing with problems that should have been prevented. Walk us through the time drains that frustrate you most.",
    description:
      "We want to map where productive time disappears so we can target the right bottlenecks. Even small recurring time losses add up across the organization.",
    evidence_prompt:
      "Estimate hours per week lost to each time drain you mention. Identify the root cause: Is it a system gap, a process gap, a communication gap, or a skills gap? Name specific tools, handoffs, or meetings involved. If possible, describe what you do instead of the productive work you'd prefer to be doing.",
    expected_answer_shape:
      "A ranked list of 3-5 time drains, each with: estimated hours per week, root cause category, the specific trigger or workflow involved, and a brief note on what better would look like.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q03",
    question_text:
      "Which decisions are hardest to make quickly and confidently, and what information is missing when those decisions are needed? Consider production scheduling, quality disposition, customer commitments, maintenance priorities, staffing, or any other recurring decision. What would you need to see — and how fast — to decide with real confidence instead of gut feel?",
    description:
      "Good decisions need good data at the right time. We're looking for the gaps between what you need to know and what you actually have in front of you when it matters.",
    evidence_prompt:
      "Name 2-3 specific recurring decisions. For each, describe: What information you ideally need. What you actually have today (and in what format — verbal, spreadsheet, system report, etc.). How long it takes to gather what's missing. What happens when you decide without full information — the risk or cost of a wrong call.",
    expected_answer_shape:
      "For each decision: (1) the decision itself, (2) ideal information needed, (3) current state of that information (source, format, delay), (4) consequence of deciding without it, and (5) how often this situation occurs.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q04",
    question_text:
      "What important data do you wish you had in real time, but today it is delayed, incomplete, or manually assembled? Think about production output, machine status, quality metrics, inventory levels, order status, energy consumption, or anything else. Where does the lag between reality and your information screen cause problems?",
    description:
      "This helps us understand the data infrastructure gaps that slow down your operations. Real-time visibility is a foundation for most digital improvements.",
    evidence_prompt:
      "List specific data points or dashboards you wish existed. For each: What is the current source and refresh cycle (e.g., end-of-shift report, weekly spreadsheet, SAP query)? How much delay is typical? Who assembles it and how long does that take? What decisions or actions are delayed because this data isn't live?",
    expected_answer_shape:
      "A list of 3-5 data gaps, each with: (1) the data point or metric, (2) current source and update frequency, (3) typical delay, (4) effort to assemble manually, and (5) the operational consequence of not having it in real time.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q05",
    question_text:
      "What frustrates your team most in day-to-day work, and why has it been hard to remove that friction? We're not just asking about annoyances — we want to understand the persistent obstacles that drain morale, slow people down, or cause good employees to disengage. What have you tried before, and why didn't it stick?",
    description:
      "Team frustration often points to systemic issues that management dashboards don't capture. Understanding what's been tried before helps us avoid repeating failed approaches.",
    evidence_prompt:
      "Describe the top 2-3 frustrations your team would raise if asked anonymously. For each: How long has it persisted? What attempts have been made to fix it? Why did those attempts fail or only partially work? How does it affect team retention, engagement, or willingness to go the extra mile?",
    expected_answer_shape:
      "For each frustration: (1) a clear description, (2) how long it's been an issue, (3) what's been tried and why it didn't fully resolve, (4) impact on team morale or performance, and (5) what a real fix would require.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q06",
    question_text:
      "Where do mistakes, rework, or repeated clarifications happen most often across teams or shifts? Think about miscommunication during shift handoffs, unclear specs passed between departments, orders entered incorrectly, quality issues caught too late, or instructions that get interpreted differently by different people. What patterns do you see?",
    description:
      "Rework and miscommunication are hidden factories — they consume capacity without producing value. Spotting the patterns helps us target the right process or communication fixes.",
    evidence_prompt:
      "Identify 2-4 specific rework or clarification hotspots. For each: Which teams or shifts are involved? What triggers the error or miscommunication? How is it typically discovered? What does the rework cost in time, material, or customer impact? Is there a standard that should prevent it but doesn't?",
    expected_answer_shape:
      "A list of rework/clarification hotspots, each with: (1) where it happens (process step, handoff, or department boundary), (2) root cause pattern, (3) how it's detected, (4) approximate frequency and cost, and (5) whether a standard or procedure exists but isn't followed.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q07",
    question_text:
      "If you could improve only one process in the next quarter, which process would you choose and what business result should improve first? Be specific about what's wrong with it today, what 'better' would look like, and how you'd measure whether the improvement actually worked. What's stopping this from happening already?",
    description:
      "This forces a priority call — we want to know what you'd bet on if you had limited bandwidth. It reveals both the biggest opportunity and the barriers to acting on it.",
    evidence_prompt:
      "Name the specific process. Describe: Its current performance level (with numbers if possible). The target state you'd want to reach. The primary metric that should move. What resources, approvals, or changes would be needed. What has prevented improvement so far (budget, bandwidth, technology, alignment, etc.).",
    expected_answer_shape:
      "A focused answer covering: (1) the chosen process and why, (2) current baseline performance, (3) target performance and how you'd measure it, (4) what needs to change to get there, and (5) what's been blocking progress.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q08",
    question_text:
      "What slows your team down the most: unclear priorities, weak systems and tools, messy handoffs between teams, lack of skills or training, or resistance to change? You can pick more than one, but rank them. For whatever you rank highest, give us a concrete example of how it played out recently and what it cost you.",
    description:
      "We're mapping the biggest drag factors so transformation efforts address root causes rather than symptoms. Your ranking helps us understand where organizational energy is being lost.",
    evidence_prompt:
      "Rank the five factors (unclear priorities, weak systems, messy handoffs, skills gaps, resistance to change) from most to least impactful for your team. For your top 1-2 picks: Provide a specific recent example. Estimate the time, cost, or quality impact. Describe what would need to change to eliminate or reduce that drag.",
    expected_answer_shape:
      "A clear ranking of the five factors with brief justification, followed by a detailed example for the top-ranked factor including: what happened, who was involved, what it cost, and what a fix would look like.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q09",
    question_text:
      "How do you currently know whether your work was successful: which measures, signals, or outcomes are actually used? Not the KPIs on a corporate dashboard — the real signals you personally look at to know if today was a good day, this week went well, or a project delivered results. How reliable are those signals, and where do you wish you had better feedback?",
    description:
      "We want to understand how success is really measured at the working level, not just the official metrics. This reveals gaps between what leadership tracks and what actually drives behavior.",
    evidence_prompt:
      "List the 3-5 signals or measures you actually use to judge your own performance. For each: Where does it come from (system, report, observation, customer feedback)? How quickly do you get it after the work is done? How much do you trust it? Where is there a gap between what you're measured on and what you can actually control?",
    expected_answer_shape:
      "A list of real performance signals, each with: (1) the metric or signal, (2) its source and timeliness, (3) your confidence level in its accuracy, (4) whether it aligns with official KPIs, and (5) where feedback is missing or too slow.",
  },
  {
    id: "aplix-na__aplix_global_all_v1_q10",
    question_text:
      "What would a near-perfect day at work look like for your function, with fewer delays and better decisions? Describe the morning-to-evening flow: what information would be waiting for you, how would handoffs work, what would meetings accomplish, how would problems surface and get resolved? Paint the picture of how work should feel when everything clicks.",
    description:
      "This is your chance to describe the ideal state — it helps us understand your vision and ensures transformation goals are grounded in what people actually want, not just what looks good on paper.",
    evidence_prompt:
      "Walk through a realistic ideal day from start to finish. Include: What information you'd see first thing. How production or work status would be communicated. How problems would be flagged and resolved. What meetings would (and wouldn't) be needed. How you'd know at end of day that things went well. Be specific to your role and APLIX's operations.",
    expected_answer_shape:
      "A narrative walkthrough of an ideal workday, structured chronologically (morning, midday, afternoon, end of day), highlighting: (1) information flow, (2) decision-making moments, (3) collaboration touchpoints, (4) problem resolution, and (5) end-of-day confidence in outcomes.",
  },
];

// =============================================================================
// Template 2: APLIX HQ - North America Leadership
// =============================================================================

export const hqQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_hq_na_v1_q01",
    question_text:
      "What are the top three priorities for APLIX North America over the next 12 months, and why are those priorities most urgent now? For each priority, explain the business driver behind it — whether it's customer pressure, competitive threat, operational performance, margin erosion, growth opportunity, or alignment with the global group strategy. How do these priorities connect to each other?",
    description:
      "We need to understand the leadership lens so transformation work stays aligned with what actually matters for the business. Knowing the 'why now' is as important as knowing the 'what.'",
    evidence_prompt:
      "For each of the three priorities: Name the business driver or trigger. Quantify the opportunity or risk if possible (revenue at stake, margin impact, customer retention risk). Describe what success looks like in 12 months. Identify who owns each priority and what resources are allocated. Note any dependencies between the three.",
    expected_answer_shape:
      "Three priorities, each with: (1) a clear statement, (2) the business driver and urgency, (3) quantified opportunity or risk, (4) 12-month success criteria, (5) ownership and resource allocation, and (6) interdependencies with the other priorities.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q02",
    question_text:
      "How do you currently define success for transformation or operational-improvement efforts in North America? What metrics, milestones, or outcomes does leadership actually track to know whether an initiative is working? Where have past improvement efforts fallen short of expectations, and what did you learn from that?",
    description:
      "Understanding how leadership evaluates progress helps us design initiatives with clear, agreed-upon success criteria from the start. Past lessons are especially valuable.",
    evidence_prompt:
      "Describe: The specific KPIs or outcomes currently used to evaluate improvement initiatives. How often they're reviewed and by whom. 1-2 examples of past initiatives that succeeded or underperformed, with an honest assessment of why. How long leadership typically gives an initiative before judging results. Any tension between short-term financial targets and longer-term capability building.",
    expected_answer_shape:
      "A structured response covering: (1) current success metrics for improvement initiatives, (2) review cadence and governance, (3) a past success story with what made it work, (4) a past shortfall with lessons learned, and (5) how time horizon and financial pressure affect initiative evaluation.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q03",
    question_text:
      "Where is alignment strongest and weakest between regional leadership, the Charlotte plant, and global group expectations? Think about strategic direction, performance targets, investment priorities, reporting standards, and cultural norms. Where do things flow smoothly, and where do conflicting priorities, communication gaps, or different operating assumptions create friction?",
    description:
      "Alignment issues between levels and locations are one of the biggest silent killers of transformation efforts. We need to know where the seams are so we can design around them.",
    evidence_prompt:
      "Identify 2-3 areas of strong alignment and 2-3 areas of friction. For each friction point: Describe the specific misalignment (different priorities, different metrics, different timelines, etc.). Who is affected and how. What attempts have been made to resolve it. Whether it's a structural issue, a communication issue, or a cultural issue.",
    expected_answer_shape:
      "Two sections: (1) Areas of strong alignment with brief explanation of why they work, and (2) Areas of weak alignment, each with: the specific misalignment, affected parties, root cause (structural/communication/cultural), past resolution attempts, and suggested path forward.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q04",
    question_text:
      "What is your working definition of digital transformation for this business, and which outcomes should it improve first? We're asking because 'digital transformation' means very different things to different people. For APLIX North America specifically, does it mean better visibility into operations, automation of manual processes, predictive capabilities, customer-facing digital tools, data-driven decision-making, or something else entirely?",
    description:
      "A shared definition prevents misalignment later. We want to understand leadership's mental model of what digital transformation should deliver for APLIX specifically.",
    evidence_prompt:
      "Describe: Your personal definition of digital transformation for APLIX NA. The top 3 outcomes it should deliver in priority order. Which parts of the business should be affected first (plant floor, supply chain, customer interface, engineering, finance). Any digital investments already made and their current status. How this vision compares to what the global group expects.",
    expected_answer_shape:
      "A clear definition followed by: (1) prioritized outcomes (top 3), (2) which business areas to target first and why, (3) current digital investment status, (4) alignment or gaps with global group expectations, and (5) any concerns about scope, timeline, or feasibility.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q05",
    question_text:
      "Where do you see the biggest inefficiencies across plant operations, sales, engineering, customer support, and supply chain handoffs? We're interested in the friction between functions as much as within them — the places where information gets lost, decisions get delayed, or work gets duplicated because departments operate in silos. Which cross-functional handoffs cause the most pain?",
    description:
      "Cross-functional inefficiency is often the largest untapped opportunity. This question helps us identify where integration and communication improvements would have the highest payoff.",
    evidence_prompt:
      "Map out 3-4 specific cross-functional inefficiencies. For each: Which two (or more) functions are involved? What information, decision, or handoff breaks down? What's the business impact (delayed orders, quality issues, excess inventory, customer dissatisfaction)? How is the gap currently bridged (workarounds, escalations, manual checks)? Estimate the frequency and cost.",
    expected_answer_shape:
      "A list of 3-4 cross-functional inefficiencies, each with: (1) the functions involved, (2) the breakdown point, (3) business impact with rough quantification, (4) current workarounds, and (5) what an integrated solution would require.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q06",
    question_text:
      "How do you prioritize investments between capacity expansion, quality improvement, systems and technology, people development, and customer-facing responsiveness? What framework or logic guides those trade-offs today? Where do you feel the current investment balance is right, and where is it creating risk by under-investing in something critical?",
    description:
      "Investment priority reveals what leadership truly values versus what they say they value. Understanding this helps us frame transformation recommendations in terms that resonate.",
    evidence_prompt:
      "Describe: The current investment allocation logic (formal process, annual budget cycle, ad hoc). How competing requests are evaluated — what criteria win. Which of the five areas (capacity, quality, systems, people, customer responsiveness) is currently under-invested relative to need. A recent example of a tough trade-off and how it was resolved. Any structural constraints (capex limits, headcount freezes, global budget approval timelines) that shape decisions.",
    expected_answer_shape:
      "A response covering: (1) current investment decision process, (2) evaluation criteria and who decides, (3) current allocation balance across the five areas, (4) areas of under-investment and the associated risk, (5) a concrete trade-off example, and (6) structural constraints that limit flexibility.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q07",
    question_text:
      "What is your approach to culture and change management when a process or system needs to work differently across teams? How do you bring people along — especially experienced operators, supervisors, and mid-level managers who may have been doing things a certain way for years? Where has change stuck, and where has it reverted back to old habits?",
    description:
      "Technology and process changes fail more often from poor adoption than from poor design. We need to understand APLIX's change muscle and where it needs strengthening.",
    evidence_prompt:
      "Describe: Your current change management approach (formal methodology, informal leadership-driven, project-by-project). A specific example where change was adopted successfully and what made it work. A specific example where change was resisted or reverted and what went wrong. How frontline supervisors and experienced operators are typically engaged. The role of training, communication, and incentives in driving adoption.",
    expected_answer_shape:
      "A structured answer covering: (1) current change management approach, (2) a success story with key enablers, (3) a reversion story with root causes, (4) how frontline engagement typically works, and (5) what leadership would do differently next time.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q08",
    question_text:
      "How do you evaluate ROI for operational or digital initiatives today, and where is that logic still too weak or too slow? Do you use formal business cases, payback period thresholds, or more qualitative judgment? How do you account for benefits that are hard to quantify — like better decision speed, reduced firefighting, or improved employee retention?",
    description:
      "ROI evaluation shapes what gets funded. If the ROI framework is too narrow, valuable initiatives get killed; if it's too loose, bad bets get approved. We want to understand the current state.",
    evidence_prompt:
      "Describe: The current ROI evaluation process (who prepares, who approves, what template or methodology). Typical thresholds (payback period, IRR, NPV targets). How intangible benefits are treated (ignored, qualitatively noted, proxy-quantified). A recent example of an initiative that was approved and one that was rejected, with the logic behind each. Where the current process creates bias toward certain types of investments.",
    expected_answer_shape:
      "A detailed response covering: (1) current ROI methodology and governance, (2) quantitative thresholds, (3) treatment of intangible benefits, (4) approved vs. rejected initiative examples with reasoning, and (5) known biases or gaps in the current approach.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q09",
    question_text:
      "Which data sets are most important for leadership decisions, and where are trust, timeliness, or comparability still a problem? Think about financial data, production performance, quality metrics, customer satisfaction, inventory, and supply chain visibility. Where do you have confidence in the numbers, and where do you find yourself questioning the data or waiting too long for it?",
    description:
      "Data trust is the foundation of data-driven leadership. If leaders don't trust the numbers, they won't use them — and transformation loses its anchor.",
    evidence_prompt:
      "Identify the 5-6 most important data sets for leadership decisions. For each: Rate your trust level (high/medium/low). Describe the timeliness (real-time, daily, weekly, monthly, quarterly). Note comparability issues (different definitions across sites, inconsistent measurement, manual adjustments). Identify who owns the data and who consumes it. Flag any data sets where you suspect the numbers are being gamed or manipulated.",
    expected_answer_shape:
      "A table-like list of critical data sets, each with: (1) the data set name, (2) trust level, (3) timeliness, (4) comparability issues, (5) ownership, and (6) any known integrity concerns. Followed by a summary of the biggest data gaps.",
  },
  {
    id: "aplix-na__aplix_hq_na_v1_q10",
    question_text:
      "If the North America business were clearly winning 12 months from now, what would be visibly different in plant performance, customer service, and decision quality? Don't give us a strategy statement — describe what you'd actually see, hear, and measure on the floor, in customer conversations, and in leadership meetings that would tell you things had truly changed.",
    description:
      "This paints the picture of success in concrete, observable terms. It gives us a shared target that's more vivid and actionable than abstract goals.",
    evidence_prompt:
      "Describe observable differences in three areas: (1) Plant performance — specific metrics that would be better and by how much, visible changes in how the floor operates. (2) Customer service — what customers would say, response time improvements, complaint reduction. (3) Decision quality — what leadership meetings would look like, what data would be available, how quickly issues would be resolved. Include at least one 'you'd never see this anymore' example for each area.",
    expected_answer_shape:
      "Three sections (Plant, Customer, Decisions), each with: (1) specific measurable improvements, (2) observable behavioral changes, (3) at least one 'no longer happens' example, and (4) how you'd verify the change is real and sustainable.",
  },
];

// =============================================================================
// Template 3: APLIX Plant - Charlotte Leadership
// =============================================================================

export const plantQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q01",
    question_text:
      "Which KPIs matter most for the Charlotte site today, and which of them are stable versus frequently off target? Walk us through your key metrics — OEE, scrap rate, on-time delivery, throughput, safety, energy per unit, whatever you track — and be honest about which ones you're consistently hitting, which ones swing, and which ones you've stopped believing in because the data isn't trustworthy.",
    description:
      "We need to understand what's being measured and what's actually driving behavior at the plant level. The gap between 'tracked' and 'trusted' is where the real opportunities hide.",
    evidence_prompt:
      "List your top 8-10 plant KPIs. For each: Current performance level and target. Trend over the past 6 months (improving, stable, declining, volatile). Data source and refresh frequency. Your confidence in the accuracy of the number. Whether it drives daily decisions or is mainly a reporting exercise.",
    expected_answer_shape:
      "A KPI-by-KPI breakdown with: (1) metric name, (2) current value vs. target, (3) recent trend, (4) data source and frequency, (5) trust level, and (6) whether it actively drives decisions or is just reported upward.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q02",
    question_text:
      "Where is the current biggest plant bottleneck, and how does that bottleneck cascade into schedule, quality, or customer impact? Is it a specific machine, a process step like extrusion or forming, a support function like maintenance or quality lab, or a resource constraint like staffing or raw material availability? Trace the ripple effect from the bottleneck through to what the customer eventually experiences.",
    description:
      "Bottlenecks define plant capacity and shape every trade-off downstream. Understanding the cascade effect helps us prioritize where intervention would unlock the most value.",
    evidence_prompt:
      "Identify the primary bottleneck and describe: Its location in the process flow. How much capacity it constrains (as a percentage of theoretical or planned output). How it affects scheduling — do you build schedule around it? The quality implications — does it force compromises elsewhere? The customer impact — late deliveries, partial shipments, expediting costs. What would it take to relieve it (capex, process change, staffing, maintenance).",
    expected_answer_shape:
      "A bottleneck analysis covering: (1) exact location and nature of the constraint, (2) capacity impact with numbers, (3) scheduling consequences, (4) quality and customer ripple effects, (5) current workarounds, and (6) what relief would require.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q03",
    question_text:
      "How is plant performance tracked today: which signals come directly from systems or machines, and which still rely on manual reporting or spreadsheets? Give us the real picture — not the aspirational one. Where does data flow automatically from PLCs, SCADA, or MES into reports, and where does someone still walk around with a clipboard, type numbers into Excel, or send an email summary at end of shift?",
    description:
      "This maps the current data infrastructure reality. Knowing what's automated versus manual tells us where digital investment would have the fastest payoff.",
    evidence_prompt:
      "Create a map of your key data flows: Which machine or process parameters are captured automatically (and into what system — SCADA, historian, MES, ERP). Which metrics require manual entry, and who does it (operators, supervisors, quality techs). Where spreadsheets are the primary working tool. Which reports are assembled manually and how long that takes. Any recent digitization efforts and their current status.",
    expected_answer_shape:
      "A data flow inventory organized by: (1) fully automated signals (source system, data type, refresh rate), (2) semi-automated data (system-captured but manually processed), (3) fully manual data (clipboard/spreadsheet/email), and (4) time spent on manual data assembly per shift or per week.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q04",
    question_text:
      "How often do you face unplanned downtime, and which asset, process step, or support function causes the most disruption? Walk us through the typical unplanned downtime scenario: What fails, how long does diagnosis take, how fast can maintenance respond, what's the production impact while you wait, and what does it cost in lost output or expedited recovery? Is the root cause usually mechanical, electrical, process-related, or organizational?",
    description:
      "Unplanned downtime is often the single largest performance destroyer in manufacturing. We need to understand both the technical and organizational dimensions of the problem.",
    evidence_prompt:
      "Provide: Average unplanned downtime hours per week or month by major area (extrusion, forming, converting, utilities, etc.). The top 3 assets or failure modes causing the most downtime. Mean time to detect, diagnose, and repair for typical failures. Production impact per hour of downtime (units, revenue, or customer orders affected). Current maintenance strategy — reactive, preventive, or condition-based — and how well it's working. Any downtime trending data if available.",
    expected_answer_shape:
      "A downtime profile covering: (1) total unplanned hours per period by area, (2) top 3 failure modes with frequency and duration, (3) detection-to-repair timeline, (4) production and cost impact per hour, (5) current maintenance approach and its effectiveness, and (6) trend direction.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q05",
    question_text:
      "What is the main source of quality issues at the plant today, and how visible is that problem during the shift rather than after the fact? Are defects caught at the machine, at inline inspection, at the quality lab, at final inspection, or — worst case — by the customer? For the most common quality issue, trace the detection timeline: when does the defect actually start, and when does anyone know about it?",
    description:
      "The gap between defect creation and defect detection is where scrap, rework, and customer complaints are born. Shrinking that gap is one of the highest-value improvements in manufacturing.",
    evidence_prompt:
      "Describe: The top 3 quality issues by frequency and cost. For each, the typical detection point in the process (at-line, downstream inspection, lab, customer complaint). The time lag between defect creation and detection. What inline quality monitoring exists today (sensors, vision systems, SPC). How much product is at risk during the detection gap. The scrap and rework cost associated with late detection. Any recent quality escapes that reached customers.",
    expected_answer_shape:
      "For each of the top 3 quality issues: (1) defect type and frequency, (2) where in the process it originates, (3) where it's currently detected, (4) time lag between creation and detection, (5) product at risk during that lag, (6) cost of late detection, and (7) what earlier detection would require.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q06",
    question_text:
      "How quickly can the plant react when a problem appears on the floor, and where does escalation or decision latency slow that response down? Describe the typical response chain: an operator sees something wrong — then what? Who do they call, how fast does help arrive, who has authority to stop the line or adjust the process, and what happens if the right person isn't available? Where does the system break down?",
    description:
      "Response speed to floor problems directly affects scrap, downtime, and team confidence. We're looking for the organizational and systemic barriers to fast, effective reaction.",
    evidence_prompt:
      "Walk through a recent real example of a floor problem and the response timeline. Include: How the problem was first detected (alarm, operator observation, quality check). The escalation path (who was called, in what order). Time from detection to first response, to diagnosis, to resolution. Where delays occurred and why. Whether the right decision authority was available. What information was needed but missing. How the incident was documented and followed up.",
    expected_answer_shape:
      "A timeline-based case study covering: (1) problem detection method and time, (2) escalation chain with timestamps, (3) decision points and who had authority, (4) delay causes, (5) resolution time and method, (6) information gaps during the response, and (7) follow-up and documentation quality.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q07",
    question_text:
      "How do you prioritize improvement initiatives when several problems compete for the same engineering, quality, or maintenance capacity? What's the decision framework — formal scoring, loudest voice, customer urgency, safety first, or executive direction? How transparent is the prioritization to the teams who are waiting for their project to move forward?",
    description:
      "Capacity for improvement is always limited. How it's allocated reveals organizational maturity and whether the right problems get solved first.",
    evidence_prompt:
      "Describe: The current prioritization process (formal/informal, who decides, how often priorities are reviewed). Criteria used to rank competing requests. How many active improvement initiatives exist now vs. how many are waiting. The backlog of requested improvements and its size. A recent example of a priority conflict and how it was resolved. Whether teams understand and accept the prioritization logic. How urgent customer issues interrupt the plan.",
    expected_answer_shape:
      "A response covering: (1) current prioritization process and governance, (2) evaluation criteria, (3) active vs. backlogged initiative counts, (4) a priority conflict example with resolution, (5) team understanding and buy-in, and (6) how fire-fighting disrupts planned improvement work.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q08",
    question_text:
      "What percentage of important plant decisions is based on trusted data versus local experience and gut feel, and where is that balance still too subjective? We're not saying gut feel is wrong — experienced operators and supervisors have invaluable knowledge. But where do you wish decisions were better supported by data, and where is the data either missing, mistrusted, or too slow to be useful?",
    description:
      "The data-vs-judgment balance tells us where digital tools would actually change behavior and where the real barrier is data quality or accessibility, not willingness.",
    evidence_prompt:
      "Estimate the data-vs-judgment split for key decision types: production scheduling, quality disposition, maintenance prioritization, process adjustments, staffing. For areas that are too subjective: What data would help? Does it exist but isn't accessible or trusted? What would make people actually use data instead of experience? For areas where data works well: What makes it effective? Any examples where data contradicted gut feel and the data was right (or wrong)?",
    expected_answer_shape:
      "A decision-by-decision assessment with: (1) the decision type, (2) estimated data-vs-judgment split, (3) whether the gap is a data availability issue, trust issue, or accessibility issue, (4) what would shift the balance, and (5) an example of data and judgment conflicting and the outcome.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q09",
    question_text:
      "How visible is real-time production status by line, shift, order, and quality condition for plant leadership today? Can you walk onto the floor or open a screen and immediately see what's running, what's down, what's ahead or behind schedule, and what quality condition each line is in? Or do you have to ask someone, check a spreadsheet, or wait for a report? What would genuine real-time visibility change for you?",
    description:
      "Real-time visibility is a foundational capability for digital manufacturing. We need to know how far the current state is from that baseline and what the impact of closing the gap would be.",
    evidence_prompt:
      "Describe the current state of visibility for: Production output by line (real-time, hourly, shift-end, daily). Schedule adherence by order. Machine status (running, down, idle, changeover). Quality condition by line or product. Where each of these can be seen (shop floor display, supervisor's PC, office dashboard, nowhere). What it takes to get a full picture today. What decisions would be faster or better with real-time visibility.",
    expected_answer_shape:
      "A visibility assessment covering: (1) each data type (output, schedule, machine status, quality), (2) current visibility level and latency, (3) where and how it's accessed, (4) what's missing entirely, (5) the effort to assemble a complete picture today, and (6) specific decisions that would improve with real-time access.",
  },
  {
    id: "aplix-na__aplix_plant_charlotte_v1_q10",
    question_text:
      "What is the single biggest operational risk for the Charlotte site in the next 6-12 months if nothing changes? This could be equipment reliability, workforce capability, customer loss, regulatory compliance, supply chain fragility, technology obsolescence, or something else entirely. What keeps you up at night, and what would it take to mitigate that risk before it materializes?",
    description:
      "Risk awareness drives urgency. Naming the biggest risk openly helps ensure transformation priorities address what truly matters for the plant's future.",
    evidence_prompt:
      "Name the single biggest risk and describe: The specific threat scenario — what could go wrong and what would trigger it. The likelihood and potential severity (impact on revenue, customers, safety, or operations). Early warning signs that are already visible. What mitigation is currently in place and whether it's sufficient. What additional action, investment, or decision is needed. The cost of inaction versus the cost of prevention.",
    expected_answer_shape:
      "A focused risk assessment covering: (1) the risk stated clearly, (2) trigger scenario, (3) likelihood and severity, (4) early warning signs already present, (5) current mitigation, (6) additional actions needed, and (7) cost of inaction vs. prevention.",
  },
];

// =============================================================================
// Template 4: APLIX Process - Extrusion and Polymer Preparation
// =============================================================================

export const extrusionQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_extrusion_v1_q01",
    question_text:
      "How stable is the extrusion process today across product families, shifts, and material conditions, and where does instability show up first? Walk us through the reality: Which product families run smoothly and which ones fight you? Does performance differ between shifts — and if so, is that about people, procedures, or conditions? When the process starts drifting, what's the first signal: scrap, visual defects, dimensional variation, throughput drop, or something else?",
    description:
      "Process stability is the foundation of everything — quality, cost, and delivery all depend on it. We need to understand where the extrusion process is predictable and where it's not.",
    evidence_prompt:
      "Rate stability by product family (e.g., hygiene hooks, automotive loops, specialty products) on a simple scale. Compare shift-to-shift consistency and identify the root cause of any differences. Describe the early warning signs of instability — what operators see or measure first. Provide approximate Cpk or process capability numbers if available. Name the most troublesome product-material combination and what makes it difficult.",
    expected_answer_shape:
      "A stability map covering: (1) product family stability ratings, (2) shift-to-shift variation assessment with root causes, (3) early warning indicators of process drift, (4) process capability data if available, and (5) the most challenging product-material combination with explanation.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q02",
    question_text:
      "What are the main causes of reduced throughput, speed loss, or short stops in extrusion? Separate them for us: Is the line running below rated speed because of quality concerns, material limitations, or equipment condition? Where do short stops accumulate — die changes, material feed issues, downstream jams, sensor trips? What's the gap between theoretical line speed and actual average speed, and what accounts for that gap?",
    description:
      "Speed loss and short stops are often the largest contributors to OEE loss in extrusion. Understanding the breakdown helps target the right interventions.",
    evidence_prompt:
      "Provide: Theoretical vs. actual average line speed for your main product families. A breakdown of speed loss causes (quality-driven slowdowns, equipment limitations, material issues, operator decisions). Top 5 short stop causes with approximate frequency per shift. How speed losses are currently tracked and reported. Whether speed loss is stable or getting worse. Any known fixes that haven't been implemented and why.",
    expected_answer_shape:
      "A speed loss analysis with: (1) theoretical vs. actual speed gap by product family, (2) categorized causes of chronic speed loss, (3) top 5 short stops ranked by frequency, (4) current tracking method, (5) trend direction, and (6) known but unimplemented improvements.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q03",
    question_text:
      "Which key process parameters are captured automatically from the extruders and auxiliary equipment, and which critical signals still depend on operator notes, logbooks, or local files? Think about melt temperature, pressure, screw speed, die gap, cooling conditions, line speed, tension, material feed rates, and anything else that matters. Where is the data digital and connected, and where does it disappear into a notebook or a standalone PC?",
    description:
      "This maps the extrusion data landscape. Knowing what's captured digitally versus manually tells us where monitoring, analysis, and optimization are possible today and where they're not.",
    evidence_prompt:
      "Create an inventory of critical extrusion parameters. For each: Is it captured automatically (PLC, SCADA, historian)? What system stores it and for how long? Is it logged manually (operator logbook, shift report, Excel)? How often is it recorded (continuous, hourly, once per shift, per event)? Can it be linked to product/batch/order? Name any parameters you know are important but aren't captured at all.",
    expected_answer_shape:
      "A parameter-by-parameter inventory with: (1) parameter name, (2) capture method (automatic/manual/not captured), (3) storage system and retention, (4) recording frequency, (5) traceability linkage (batch/order/time), and (6) identified gaps where important data isn't captured.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q04",
    question_text:
      "Where do start-up losses, scrap, or material waste occur most often during changeovers or restarts? Take us through a typical changeover: How long does it take from last good product on the old run to first good product on the new run? Where does material go during that transition — is it scrapped, recycled, or downgraded? What causes the variation between a clean changeover and a messy one? How much of your total scrap is changeover-related?",
    description:
      "Changeover and start-up losses are often accepted as inevitable, but they're actually one of the best opportunities for waste reduction. We want to understand the full picture.",
    evidence_prompt:
      "Provide: Average changeover time and the range (best case vs. worst case). Material waste per changeover in pounds or as a percentage. The split between planned purge/transition waste and unplanned waste from failed starts. Top causes of extended changeovers (die changes, color changes, material switches, recipe adjustments). What percentage of total scrap is changeover-related. Whether changeover procedures are standardized and followed. Any SMED or changeover reduction efforts and their results.",
    expected_answer_shape:
      "A changeover analysis covering: (1) average and range of changeover times, (2) material waste per changeover and total percentage, (3) planned vs. unplanned waste breakdown, (4) top causes of extended changeovers, (5) share of total plant scrap from changeovers, (6) standardization status, and (7) any past reduction efforts and outcomes.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q05",
    question_text:
      "Which process losses in extrusion have the biggest cost impact today: material waste, energy consumption, downtime, labor inefficiency, or missed schedule? Rank them for us and explain your reasoning. Sometimes the most visible loss isn't the most expensive one. Where do you think the biggest money is being left on the table, and how confident are you in that estimate?",
    description:
      "Ranking losses by cost rather than visibility ensures improvement efforts target the real economic opportunity. This is about building the business case for focused action.",
    evidence_prompt:
      "Rank the five loss categories by estimated annual cost impact for the extrusion area. For each: Provide a rough dollar estimate or percentage of production cost if possible. Describe how the estimate was developed (rigorous analysis, rough calculation, educated guess). Identify the largest single contributor within each category. Note where you're confident in the number vs. where it's a guess. Compare to any benchmarks or historical trends.",
    expected_answer_shape:
      "A ranked list of loss categories with: (1) estimated annual cost impact, (2) confidence level in the estimate, (3) largest single contributor within each category, (4) data source for the estimate, and (5) trend direction (improving, stable, worsening).",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q06",
    question_text:
      "How consistently do operators react to process deviations in extrusion, and where do standards, training, or escalation rules remain unclear? When a temperature drifts out of range, when scrap starts climbing, when a visual defect appears — do all operators on all shifts respond the same way? Where is operator response well-defined and disciplined, and where does it depend on who's running the line that day?",
    description:
      "Consistency of human response to process variation is a major determinant of overall process stability. Gaps here point to training, standardization, or decision-support opportunities.",
    evidence_prompt:
      "Describe: Which process deviations have clear, documented response procedures. Where operator response varies significantly between individuals or shifts. The training process for new and existing operators on deviation response. How escalation rules work — when should an operator adjust, when should they call a supervisor, when should they stop the line. Recent examples where inconsistent response led to excess scrap or quality issues. Any digital tools that guide operator response today.",
    expected_answer_shape:
      "An assessment covering: (1) well-standardized responses and their documentation, (2) areas of inconsistency with specific examples, (3) training program effectiveness, (4) escalation clarity, (5) a case study of inconsistency impact, and (6) current decision-support tools (or lack thereof).",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q07",
    question_text:
      "How visible is root-cause information after an extrusion issue, and can the team connect quality loss to the exact process conditions that produced it? When you find a defect in finished product or get a customer complaint, can you trace it back to the exact time, machine, recipe, material lot, and process window? How long does that investigation take, and how often do you reach a definitive root cause versus a best guess?",
    description:
      "Traceability and root-cause capability determine whether problems get truly fixed or just managed. This tells us how strong the feedback loop between quality and process is.",
    evidence_prompt:
      "Describe: The current traceability level — can you link finished product back to machine, time, recipe, material lot? What systems support traceability (MES, batch records, lab systems, manual logs)? A recent root-cause investigation: how long it took, what data was available, whether a definitive cause was found. What percentage of quality issues reach a confirmed root cause vs. probable cause vs. unknown. Where the traceability chain breaks down. What data would make root-cause analysis faster and more conclusive.",
    expected_answer_shape:
      "A traceability and root-cause assessment with: (1) current traceability capability (what can be linked to what), (2) supporting systems, (3) a recent investigation case study with timeline and outcome, (4) root-cause resolution rate, (5) traceability chain break points, and (6) data gaps that limit investigation.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q08",
    question_text:
      "How are recipes, settings, and best-known conditions managed today for the extrusion process, and where does the process still rely too much on tribal knowledge? Is there a formal recipe management system, or do operators refer to binders, sticky notes, or experienced colleagues? When you find a better process window, how is that knowledge captured, validated, and deployed across all shifts? What happens when a key operator retires or transfers?",
    description:
      "Recipe and knowledge management is a critical vulnerability in many plants. If best practices live in people's heads rather than in systems, every retirement is a risk event.",
    evidence_prompt:
      "Describe: How recipes and settings are currently documented and stored (formal system, Excel, paper binders, memory). The process for updating a recipe when better conditions are found. How many product-specific recipes exist and how many are formally validated. Where tribal knowledge is most critical — which process steps or products depend most on experienced operators. What happens during a knowledge transfer when someone leaves. Any recipe management system or digital twin capabilities in place or planned.",
    expected_answer_shape:
      "A knowledge management assessment covering: (1) current recipe documentation method and system, (2) recipe update and validation process, (3) scope (number of recipes, formal vs. informal), (4) tribal knowledge dependencies and risk areas, (5) knowledge transfer practices, and (6) technology in place or planned for recipe management.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q09",
    question_text:
      "What would have the biggest impact on extrusion performance first: better process control and monitoring, stronger preventive maintenance, faster analysis and problem-solving, or more disciplined adherence to operating standards? Pick one as your top priority and explain why it would move the needle most. What's the second priority, and does the first need to be in place before the second can work?",
    description:
      "This forces a prioritization call specific to extrusion. We want your honest assessment of where the biggest performance gap is and why.",
    evidence_prompt:
      "Rank the four improvement levers and justify your top choice with: Specific performance gap it would address. Estimated impact on OEE, scrap, or throughput. Current maturity level of that lever (1-5 scale). What implementation would look like (timeline, investment, effort). Dependencies — does one lever enable or depend on another? Any past attempts to improve in this area and what happened.",
    expected_answer_shape:
      "A ranked assessment of four improvement levers with: (1) ranking with justification, (2) deep dive on the top priority including performance gap, estimated impact, current maturity, and implementation requirements, (3) dependencies between levers, and (4) relevant past experience.",
  },
  {
    id: "aplix-na__aplix_process_extrusion_v1_q10",
    question_text:
      "If you could add one digital capability to the extrusion process, what should it be and what problem would it solve first? Think about real-time process monitoring dashboards, predictive quality alerts, automated recipe management, digital work instructions, condition-based maintenance triggers, energy optimization, or anything else. What would give your team the most immediate, tangible benefit — and what would make them actually want to use it?",
    description:
      "This is your wish list — but limited to one item, so we get your honest top priority. We also want to understand what would drive adoption, not just what sounds good on paper.",
    evidence_prompt:
      "Name the one capability and describe: The specific problem it would solve. How that problem costs you today (in time, scrap, downtime, or risk). What the capability would need to look like to be useful (speed, accuracy, integration, user interface). Who would use it and how it would fit into their workflow. What would make operators and supervisors actually embrace it vs. ignore it. Any concerns about implementation complexity or reliability.",
    expected_answer_shape:
      "A focused proposal covering: (1) the digital capability, (2) the problem it solves with current cost, (3) functional requirements, (4) target users and workflow integration, (5) adoption factors, and (6) implementation concerns.",
  },
];

// =============================================================================
// Template 5: APLIX Process - Weaving and Hook/Loop Forming
// =============================================================================

export const formingQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_forming_v1_q01",
    question_text:
      "Which steps in weaving or hook/loop forming create the most variability in product performance today? Take us through the critical points: Is it the initial yarn or monofilament preparation, the weaving tension and speed, the hook or loop forming step, heat setting, or post-processing? Where does the process tend to drift, and what product characteristics — peel strength, shear strength, hook profile, loop density, feel — are most sensitive to that drift?",
    description:
      "Variability in forming directly impacts whether the final product meets customer specs. We need to know where the process is most fragile and what product properties are most affected.",
    evidence_prompt:
      "Identify the top 3 process steps that create the most variability. For each: Name the specific mechanism (machine setting, material input, environmental condition). Which product performance characteristics are affected. How much variability exists (range, standard deviation, Cpk if available). Whether the variability is random or systematic (e.g., position-dependent across the web, time-dependent during a run). How the variability is currently detected and managed.",
    expected_answer_shape:
      "A variability map with: (1) top 3 high-variability process steps, (2) the mechanism driving variability, (3) affected product characteristics, (4) quantified variability range, (5) pattern type (random/systematic), and (6) current detection and management approach.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q02",
    question_text:
      "What defects or deviations are most common in the weaving and forming process, and when are they usually detected? Are you catching problems at the machine in real time, during inline inspection, at the quality lab after the run, at converting, or — worst case — after the product ships to the customer? For the most costly defect type, walk us through the full detection story: when it starts, when it's found, and how much product is at risk in between.",
    description:
      "The distance between defect creation and defect detection determines how much waste a quality issue generates. Shortening that distance is one of the fastest paths to improvement.",
    evidence_prompt:
      "List the top 5 defect types by frequency and cost. For each: Where in the process the defect originates. Where it's currently detected (at-line, downstream inspection, lab, customer). Typical time or footage between creation and detection. Volume of product at risk during that lag. Estimated cost per occurrence (scrap, rework, customer credit, complaint). Whether an inline detection method exists but isn't deployed.",
    expected_answer_shape:
      "A defect profile with: (1) top 5 defects ranked by cost/frequency, (2) origin point in the process, (3) detection point, (4) creation-to-detection lag, (5) product at risk, (6) cost per occurrence, and (7) feasibility of earlier detection.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q03",
    question_text:
      "Which machine, recipe, or quality parameters in weaving and forming are tracked in a structured way that allows comparison over time, and which ones remain hard to compare because they're recorded inconsistently, stored in different formats, or buried in individual operator logs? Where can you pull up a trend chart and trust it, and where would building that trend require hours of manual data assembly?",
    description:
      "Structured, comparable data is the prerequisite for trend analysis, SPC, and continuous improvement. We need to know what's analysis-ready and what's locked in silos.",
    evidence_prompt:
      "Categorize key parameters into: (A) Structured and comparable — stored digitally, consistent format, easy to trend. (B) Partially structured — captured but inconsistent or hard to query. (C) Unstructured — in logbooks, local files, or people's heads. For category A: What system stores them and how far back does data go? For categories B and C: What would it take to bring them into a structured format? Are there parameters that different shifts or operators record differently for the same process?",
    expected_answer_shape:
      "A three-tier classification of parameters: (1) structured and analysis-ready (system, data depth, examples), (2) partially structured (format issues, access barriers), and (3) unstructured or uncaptured (risk of data loss, effort to formalize). Include specific parameter names in each tier.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q04",
    question_text:
      "Where do teams in weaving and forming rely on operator judgment instead of clear standards to decide whether the process is under control? Think about visual checks, feel-based assessments, sound-based equipment monitoring, or experience-based adjustments to settings. Which of these judgment calls are genuinely valuable expertise that should be preserved, and which ones are risky gaps that should be replaced with objective measurements?",
    description:
      "Operator expertise is an asset, but over-reliance on subjective judgment creates inconsistency and risk. We want to distinguish valuable craft knowledge from dangerous gaps in measurement.",
    evidence_prompt:
      "List 5-7 key judgment-based decisions or checks in the forming process. For each: What the operator evaluates (visual, tactile, auditory, experience). How consistent the judgment is across operators (high/medium/low agreement). What would an objective measurement look like (sensor, gauge, vision system). Whether experienced operators have tried to teach this to newer team members and how well that worked. Which judgment calls have the highest consequence if wrong.",
    expected_answer_shape:
      "A catalog of judgment-based decisions with: (1) what's being evaluated, (2) the sensory or experience basis, (3) inter-operator consistency, (4) feasibility of objective measurement, (5) knowledge transfer effectiveness, and (6) consequence severity if judgment is wrong.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q05",
    question_text:
      "What are the biggest cost drivers in weaving and forming when performance slips: scrap and material waste, speed loss and reduced throughput, changeover time and transition waste, customer complaints and credits, or downstream rework at converting? Rank these by their actual cost impact, not just their visibility. Where is the biggest money being lost, and how confident are you in that assessment?",
    description:
      "Understanding the true cost hierarchy ensures improvement projects target the highest-value opportunities. Visibility bias often puts the wrong problems at the top of the list.",
    evidence_prompt:
      "Rank the five cost drivers and provide for each: Estimated annual cost or percentage of department production cost. How the estimate was developed. The single biggest contributor within each category (e.g., the specific product or defect that drives the most scrap). Whether the cost is growing, stable, or declining. What it would take to reduce it by 20% or more. Any data gaps that make the estimate uncertain.",
    expected_answer_shape:
      "A ranked cost driver analysis with: (1) estimated annual impact per category, (2) confidence in the estimate, (3) largest single contributor within each, (4) trend direction, (5) reduction potential and what it would take, and (6) data gaps.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q06",
    question_text:
      "How do product mix and customer-specific requirements complicate process stability in forming operations? APLIX serves hygiene, automotive, aerospace, construction, medical, and packaging — each with different specs, tolerances, and quality expectations. How does switching between these product families affect your process? Where do tight customer specs force compromises in efficiency, and where do you wish specifications were better defined?",
    description:
      "Product mix complexity is a reality of APLIX's business. We need to understand how it impacts the forming process and where better planning or standardization could help.",
    evidence_prompt:
      "Describe: How many distinct product families or specification groups run through the forming process. Which customer or industry specifications are hardest to meet consistently. How product mix affects scheduling, changeovers, and process stability. Where tight tolerances from one customer force the process to run suboptimally for other products. Whether some customer specs are ambiguous or not well translated into process targets. The relationship between product mix complexity and scrap, changeovers, and lead time.",
    expected_answer_shape:
      "A product mix impact analysis covering: (1) number of distinct product families/spec groups, (2) most challenging specifications and why, (3) scheduling and changeover complexity, (4) process stability impact of frequent switching, (5) spec translation issues, and (6) quantified impact on scrap, changeovers, and lead time.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q07",
    question_text:
      "How easy is it today to link a customer issue back to the exact batch, run, machine state, or process window that produced it? When a customer calls with a complaint about hook performance, loop engagement, or feel consistency, how fast can your team identify what happened in the process? Walk us through a recent traceability investigation: what you could find, what you couldn't, and how long it took.",
    description:
      "Traceability from customer complaint back to process conditions is essential for both quality improvement and customer confidence. We need to understand how strong that chain is today.",
    evidence_prompt:
      "Describe the current traceability chain from finished product to process: What identifiers travel with the product (lot number, roll ID, timestamps). How product identity links back to machine, time window, recipe, material lot. Which links in the chain are digital and which are manual. A specific recent customer complaint investigation: what data was available, how long the investigation took, whether a definitive root cause was found. Where traceability breaks down — the weakest link. What systems support or hinder traceability (MES, ERP, lab system, manual records).",
    expected_answer_shape:
      "A traceability assessment with: (1) current product identification method, (2) linkage chain from product to process conditions, (3) digital vs. manual links, (4) a recent investigation case study with timeline and findings, (5) the weakest link in traceability, and (6) systems involved and their limitations.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q08",
    question_text:
      "What are the main setup or transition losses between runs in weaving and forming, and how are they reduced today? Walk us through a typical changeover: What has to change (recipe, yarn type, tension settings, forming temperature, speed), how long it takes, how much material is wasted during transition, and what determines whether it goes smoothly or not. Are changeover procedures standardized, or does the outcome depend heavily on who's running the machine?",
    description:
      "Setup and transition losses accumulate rapidly when product mix is high. Understanding the current state reveals whether standardization, training, or technology is the biggest lever.",
    evidence_prompt:
      "Provide: Average changeover time for common transitions (e.g., within the same product family vs. across families). Material waste per changeover (feet, pounds, or percentage). Key variables that determine changeover success or failure. Whether formal changeover procedures exist and are followed. Variation in changeover time between operators. Any changeover reduction initiatives (SMED, quick-change tooling) and their results. The total number of changeovers per week and cumulative lost time.",
    expected_answer_shape:
      "A changeover analysis with: (1) average times for different transition types, (2) material waste quantification, (3) critical success factors, (4) procedure standardization status, (5) operator-to-operator variation, (6) past improvement efforts and results, and (7) weekly changeover frequency and total lost time.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q09",
    question_text:
      "Which improvements would create the biggest gain first in the forming process: standard work procedures and operating discipline, automation of manual adjustments, inline sensing and real-time quality feedback, better traceability from product back to process, or stronger engineering support for process optimization? Pick your top two and explain why they would move the needle most, considering APLIX's current situation and capabilities.",
    description:
      "This is about prioritization with constraints. We want your realistic assessment of what would deliver the most value given where the forming process stands today.",
    evidence_prompt:
      "Rank all five improvement levers. For your top two: Describe the specific performance gap each would address. Estimate the potential impact (scrap reduction, throughput gain, quality improvement, customer satisfaction). Assess current readiness to implement (skills, infrastructure, budget). Identify dependencies — does one need to come first? Describe what success would look like in 6 months. Note any risks or obstacles to implementation.",
    expected_answer_shape:
      "A ranked list of five levers with justification, then a deep dive on the top two covering: (1) the performance gap addressed, (2) estimated impact, (3) implementation readiness, (4) dependencies, (5) 6-month success vision, and (6) risks and obstacles.",
  },
  {
    id: "aplix-na__aplix_process_forming_v1_q10",
    question_text:
      "What data or analytics would make the weaving and forming process significantly easier to stabilize and improve? Think about what you'd want on a screen next to every forming machine, what you'd want in a weekly process review, and what you'd want an engineer to be able to pull up in five minutes when investigating a problem. What's the single most valuable piece of information you don't have today?",
    description:
      "This captures the practical data and analytics wish list from the people closest to the process. It ensures any digital investment targets what operators and engineers actually need.",
    evidence_prompt:
      "Describe three levels of data/analytics needs: (1) At the machine — what operators need to see in real time to keep the process stable (parameters, alarms, quality indicators, targets). (2) In weekly reviews — what trends, comparisons, and summaries would drive better process decisions. (3) For engineering investigations — what historical data, correlations, or drill-down capabilities would accelerate root-cause analysis and process optimization. For each level: What exists today vs. what's missing. What format and update frequency would be most useful. Which decisions or actions would improve with this data.",
    expected_answer_shape:
      "A three-level analytics needs assessment: (1) real-time operator display with specific parameters and indicators, (2) weekly review analytics with trends and comparisons needed, and (3) engineering investigation tools with drill-down capabilities. Each level should include: current state, gap, format requirements, and decisions that would improve.",
  },
];
