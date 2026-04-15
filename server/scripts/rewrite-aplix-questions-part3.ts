export interface QuestionUpdate {
  id: string;
  question_text: string;
  description: string;
  evidence_prompt: string;
  expected_answer_shape: string;
}

// ---------------------------------------------------------------------------
// Template 1: Continuous Improvement and Transformation
// ---------------------------------------------------------------------------
export const ciQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_ci_v1_q01",
    question_text:
      "How are improvement opportunities identified today across the Charlotte plant and the broader North America operation? Think about the full range — quality incidents, throughput losses, customer complaints, operator suggestions, audit findings, and digital or automation gaps. Which types of problems consistently fail to enter a structured improvement pipeline, and why do they get stuck or ignored?",
    description:
      "We want to understand how improvement ideas surface and where good opportunities fall through the cracks. This helps us see whether the pipeline captures the right problems or just the loudest ones.",
    evidence_prompt:
      "Describe the main channels through which improvement ideas arrive today (e.g., daily production reviews, quality alerts, customer feedback loops, operator suggestion programs, maintenance logs). Give examples of problems that were successfully pulled into a project versus ones that lingered without action. Mention any categories — like cross-functional issues, data-quality gaps, or slow-burn inefficiencies — that tend to be overlooked.",
    expected_answer_shape:
      "A walkthrough of 3–5 identification channels with a candid assessment of each one's effectiveness. At least 2 concrete examples of problems that entered the pipeline and 2 that did not, with reasons why they stalled.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q02",
    question_text:
      "How are improvement initiatives prioritized when quality, productivity, customer responsiveness, and digital transformation topics all compete for the same people, budget, and management attention? What criteria or process determines what gets resourced first, and where does that prioritization feel weakest?",
    description:
      "We're looking at how competing demands are balanced in practice — not just the theory. Understanding prioritization gaps helps us recommend a more resilient framework.",
    evidence_prompt:
      "Explain the current prioritization method — formal scoring, management judgment, urgency-driven, or a mix. Provide examples of trade-offs that were made in the last 12 months (e.g., a quality project delayed for a throughput push, a digital initiative deprioritized for a customer escalation). Note who makes the final call and whether the criteria are documented or informal.",
    expected_answer_shape:
      "A description of the prioritization process (formal or informal), 2–3 real trade-off examples from the past year, identification of which criteria are strongest and which are missing, and a note on who holds decision authority.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q03",
    question_text:
      "Who owns improvement outcomes in practice — from initial scoping through execution to sustained results? Where does accountability weaken after the initial kickoff, and what happens to projects when the original sponsor moves on or attention shifts to the next priority?",
    description:
      "Strong starts don't always mean strong finishes. We want to know where ownership is clear, where it fades, and what that costs in terms of results that don't stick.",
    evidence_prompt:
      "Describe the typical ownership structure for an improvement project: who sponsors, who leads day-to-day, who tracks benefits after closure. Give examples of projects where accountability held strong and others where it eroded — what was different? Mention any formal roles (CI lead, project champion, process owner) and how consistently they are applied.",
    expected_answer_shape:
      "A description of formal and informal ownership roles, 2–3 examples contrasting strong vs. weak accountability, identification of the phase where ownership most often breaks down (e.g., post-pilot, after leader rotation), and any structural gaps.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q04",
    question_text:
      "How are the benefits of improvement initiatives defined and tracked today — financial savings, quality improvements, throughput gains, customer-impact metrics, or otherwise? Which types of gains are hardest to prove after the fact, and which have a tendency to erode over time even when initially successful?",
    description:
      "Benefit tracking is where many CI programs lose credibility. We need to understand what gets measured, what gets believed, and what quietly disappears.",
    evidence_prompt:
      "Walk through how benefits are defined at project start (e.g., business case templates, ROI estimates) and how they are validated post-implementation. Identify which benefit types are straightforward to track (e.g., direct labor savings) versus which are contentious or fuzzy (e.g., avoided cost, quality-of-life improvements, speed gains). Share any examples of benefits that were claimed but later questioned, or gains that eroded within 6–12 months.",
    expected_answer_shape:
      "A breakdown of benefit categories used today with an honest assessment of tracking rigor for each. At least 2 examples of well-tracked gains and 2 of poorly tracked or unsustained ones. Notes on any tools or templates used for benefit tracking.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q05",
    question_text:
      "When improvement projects stall or take longer than expected, what is usually the root cause? Consider capacity constraints, weak problem definition, local resistance to change, unclear executive sponsorship, competing priorities, or technical complexity. Which of these factors is most damaging at APLIX North America right now?",
    description:
      "Every plant has its own pattern of what kills momentum. Pinpointing the dominant blocker helps us design interventions that actually stick.",
    evidence_prompt:
      "Rank or describe the top 3 implementation barriers from your experience. For each, give a specific example of a project that was affected. Note whether the barrier is structural (e.g., not enough CI resources), behavioral (e.g., middle-management resistance), or procedural (e.g., no clear escalation path). Estimate how much calendar time is typically lost when a project stalls.",
    expected_answer_shape:
      "A ranked list of 3–5 barriers with a concrete example for each. An indication of whether each barrier is getting better, worse, or staying the same. A rough estimate of delay impact (weeks or months lost per typical stall).",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q06",
    question_text:
      "How visible is the current portfolio of active improvement projects, pending decisions, unresolved blockers, and realized results — to plant leadership, to the team doing the work, and to regional or corporate stakeholders? Where does visibility break down?",
    description:
      "If people can't see what's happening, they can't help, escalate, or learn. We want to understand what's transparent and what's hidden in the current setup.",
    evidence_prompt:
      "Describe how the improvement portfolio is currently displayed or communicated (e.g., a shared tracker, periodic review meetings, PowerPoint decks, a digital board). Who has access and how often is it updated? Give examples of situations where lack of visibility caused a problem — a duplicated effort, a missed escalation, a surprise to leadership. Note any differences in visibility between the shop floor, plant management, and regional/corporate levels.",
    expected_answer_shape:
      "A description of current visibility tools and cadences, with an honest assessment of freshness and reach. 2–3 examples of visibility failures and their consequences. A note on which stakeholder group has the least insight today.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q07",
    question_text:
      "How effectively are lessons learned from completed improvement projects captured and reused — within the Charlotte plant, across shifts, or across the broader APLIX network? What knowledge tends to stay locked in people's heads or in local files rather than becoming organizational capability?",
    description:
      "Reuse is the multiplier that separates good CI programs from great ones. We want to know how much institutional learning actually travels.",
    evidence_prompt:
      "Describe any formal mechanisms for capturing lessons (e.g., project close-out reports, best-practice libraries, cross-functional review meetings). Give examples of knowledge that was successfully transferred to another area and examples of where the same problem was solved twice because lessons didn't travel. Note any barriers: time pressure, no standard format, no incentive to share, language/cultural gaps between Charlotte and other APLIX sites.",
    expected_answer_shape:
      "A description of current lesson-capture practices (formal and informal), 2 examples of successful reuse and 2 of missed reuse. Identification of the biggest barriers to knowledge transfer, with a note on cross-site dynamics.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q08",
    question_text:
      "If you had to pick one category of improvement that would pay back fastest right now at APLIX North America — quality, throughput, production planning, customer responsiveness, or data visibility — which would it be and why? What specific opportunity within that category is the most actionable?",
    description:
      "This is your chance to flag the single highest-impact area. We're looking for practical judgment, not a theoretical answer.",
    evidence_prompt:
      "Name the category and explain your reasoning with reference to current pain points, financial impact, or customer risk. Identify a specific, actionable opportunity (e.g., 'reducing changeover time on Line 3,' 'automating the weekly quality report,' 'fixing the demand-planning handoff with the hygiene segment'). Estimate the rough scale of benefit — even a ballpark is helpful.",
    expected_answer_shape:
      "A clear choice of one category with a 2–3 sentence rationale. One specific opportunity described concretely enough that someone could scope a project around it. A rough benefit estimate (e.g., hours saved per week, scrap reduction percentage, days of lead-time improvement).",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q09",
    question_text:
      "Looking ahead 12 months, what would a stronger transformation operating model look like for APLIX North America? Think about governance, resourcing, cadence, tools, and the relationship between local plant execution and regional or corporate strategy. What's the single most important structural change needed?",
    description:
      "We're asking you to think beyond individual projects and describe what a well-functioning improvement engine would look like here. Your perspective on the operating model matters.",
    evidence_prompt:
      "Describe what's working in the current model and what's not. Outline what a better model would include — for example, a dedicated CI team, a regular portfolio review, clearer stage-gate governance, better digital tools, or stronger links to corporate transformation. Identify the single most important structural change and explain why it would unlock the most progress.",
    expected_answer_shape:
      "A concise assessment of today's operating model (strengths and gaps), a forward-looking description of 3–4 elements of a stronger model, and a clear recommendation for the #1 structural change with a brief explanation of expected impact.",
  },
  {
    id: "aplix-na__aplix_process_ci_v1_q10",
    question_text:
      "What workflow, decision-support, or AI capability would most strengthen improvement execution and follow-through at APLIX North America? Think about project tracking, benefit validation, root-cause analysis, knowledge reuse, or any other area where digital assistance could make a real difference.",
    description:
      "We're exploring where technology could give your CI efforts a meaningful boost — not technology for its own sake, but tools that solve real friction points.",
    evidence_prompt:
      "Identify 1–2 specific workflow or decision-support capabilities that would help most (e.g., an AI assistant that surfaces relevant past projects when scoping a new one, automated benefit tracking dashboards, a root-cause analysis tool that pulls in machine data). Explain why this capability matters by linking it to a current pain point. Note any past attempts at digital CI tools and what worked or didn't.",
    expected_answer_shape:
      "1–2 specific capability descriptions tied to concrete pain points. A brief explanation of why each would matter in your daily work. Any relevant context on past digital tool experiences (positive or negative).",
  },
];

// ---------------------------------------------------------------------------
// Template 2: Data, Systems, and Reporting
// ---------------------------------------------------------------------------
export const dataQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_data_v1_q01",
    question_text:
      "Which systems are most important for running the APLIX North America business today — ERP, MES, quality management, CRM, planning tools, document management, or others? Where are the boundaries between these systems still unclear, overlapping, or creating gaps that people have to work around manually?",
    description:
      "We need a clear picture of the systems landscape and where it creates friction. Overlaps and gaps are often the source of hidden inefficiency.",
    evidence_prompt:
      "List the 5–7 most critical systems by name and primary function (e.g., SAP for ERP, a specific MES for shop-floor data). For each, note whether it's well-adopted, partially used, or worked around. Identify 2–3 boundary problems — places where two systems overlap (duplicate data entry), where a gap exists (no system covers a key process), or where integration is brittle or manual.",
    expected_answer_shape:
      "A table or list of key systems with name, function, and adoption level. 2–3 specific boundary issues described with enough detail to understand the operational impact (e.g., 'Quality data is entered in both the MES and a separate Excel tracker because the two don't sync').",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q02",
    question_text:
      "What critical operational data is collected automatically through system integrations or machine connections, and what still depends on spreadsheets, email threads, shared drives, or manual input by operators and supervisors? Where is the manual-to-automated boundary creating the most risk or waste?",
    description:
      "The gap between automated and manual data collection is where errors breed and time gets lost. We want to map that boundary clearly.",
    evidence_prompt:
      "Give specific examples of data that flows automatically (e.g., production counts from the MES to the ERP, machine sensor data to a historian) and data that requires manual handling (e.g., downtime reasons entered by operators, quality inspection results logged in Excel, customer complaint details tracked in email). For the manual areas, estimate how much time is spent on data entry or transfer per day or week, and note any accuracy concerns.",
    expected_answer_shape:
      "Two lists — automated data flows and manual data flows — with 3–5 items each. For manual items, a rough time estimate and a note on error frequency or risk. Identification of the 1–2 manual areas that cause the most pain.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q03",
    question_text:
      "Which data sets are least trusted by the people who use them today, and what drives that distrust — accuracy problems, stale information, inconsistent definitions, unclear ownership, or difficulty accessing the data at all? How does low trust change behavior (e.g., people building shadow spreadsheets, ignoring reports, or making gut-feel decisions)?",
    description:
      "Trust is the currency of data. When people don't trust the numbers, they build workarounds — and those workarounds have real costs.",
    evidence_prompt:
      "Name 2–3 specific data sets or reports that are widely distrusted (e.g., inventory accuracy, OEE figures, on-time delivery metrics, scrap rates). For each, explain the root cause of distrust and describe the behavioral workaround — do people maintain their own version, ignore the data, or escalate constantly? If possible, estimate the cost of the workaround in hours per week or decisions delayed.",
    expected_answer_shape:
      "2–3 specific data sets named with a clear explanation of why trust is low. For each, a description of the workaround behavior and a rough impact estimate. A note on whether the trust issue is getting better, worse, or static.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q04",
    question_text:
      "Who owns the quality, accuracy, and meaning of the most important operational data at APLIX North America? Where is data ownership clearly assigned and working, and where is it still ambiguous — meaning no one is accountable for whether the data is correct, timely, and consistently defined?",
    description:
      "Data without an owner drifts. We need to see where stewardship is strong and where gaps exist so we can recommend the right governance.",
    evidence_prompt:
      "For 3–5 key data domains (e.g., production output, quality metrics, inventory levels, customer orders, maintenance records), identify who is currently responsible for data accuracy and definition. Note where ownership is formally assigned versus informally assumed. Give examples of data domains where ambiguous ownership has caused real problems — conflicting numbers in meetings, delayed decisions, or finger-pointing between departments.",
    expected_answer_shape:
      "A list of 3–5 data domains with current owner (or 'no clear owner'). For each, a note on whether ownership is formal or informal. 2–3 examples of problems caused by ambiguous ownership, with enough detail to understand the business impact.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q05",
    question_text:
      "What is the real business cost of poor data visibility today at APLIX North America? Think across the full range: slow decisions that miss windows of opportunity, duplicate work because teams can't see each other's data, weak prioritization because the numbers aren't trusted, missed service commitments, or hidden losses that only surface in hindsight.",
    description:
      "This question is about making the cost of the status quo concrete. Vague concerns don't drive action — specific costs do.",
    evidence_prompt:
      "Provide 3–4 specific examples of business costs driven by poor data visibility. For each, describe the situation, the data gap, and the outcome (e.g., 'We shipped late to Customer X because the planning team couldn't see real-time machine availability,' or 'We discovered $Y in scrap that wasn't visible until the quarterly review'). Where possible, attach a rough dollar figure, time cost, or customer-impact metric.",
    expected_answer_shape:
      "3–4 concrete examples, each with a clear cause-and-effect chain from data gap to business cost. At least 2 should include a quantified or estimated impact. A summary statement on which cost category (speed, waste, service, margin) is most affected overall.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q06",
    question_text:
      "Where do teams spend the most time manually preparing reports, reconciling different versions of the same data, or assembling information from multiple sources just to answer a routine question? Which reports or reconciliation tasks are the biggest time sinks?",
    description:
      "Manual report prep is one of the most common — and most fixable — sources of wasted skilled-labor time. We want to find the worst offenders.",
    evidence_prompt:
      "Identify the 3–5 most time-consuming manual reporting or reconciliation tasks. For each, describe what it involves (e.g., 'pulling data from SAP, combining it with Excel quality logs, and formatting a weekly dashboard for the plant manager'), who does it, how often, and roughly how long it takes. Note any tasks where the output is frequently questioned or has to be redone because of inconsistencies.",
    expected_answer_shape:
      "A list of 3–5 manual reporting tasks with: description of the workflow, frequency (daily/weekly/monthly), estimated time per cycle, and the person or role performing it. A note on which tasks are most often questioned or redone.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q07",
    question_text:
      "How well integrated are shop-floor signals (machine data, sensor readings, production counts), ERP transactions, quality records, and customer-facing information in the current technology setup? Where are the biggest integration gaps, and what manual bridges have people built to compensate?",
    description:
      "Integration determines whether data flows or gets stuck. We want to see the real state of connectivity — not the architecture diagram, but what actually works in daily operations.",
    evidence_prompt:
      "Describe the current state of integration between the shop floor and business systems. Which data flows automatically end-to-end (e.g., production counts feeding ERP inventory)? Where are there manual bridges (e.g., a supervisor entering downtime codes into a separate system)? Where is there no bridge at all (e.g., customer complaint data lives in a completely separate world from production data)? Note any integration projects that are planned or in progress.",
    expected_answer_shape:
      "A description of 3–4 key integration pathways with their current state (automated, manual bridge, or disconnected). For each manual bridge or gap, a note on who fills it and what it costs in time or accuracy. Any planned integration work mentioned briefly.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q08",
    question_text:
      "If one reporting or analytical view could become consistently trusted and always available, which one would most improve executive-level and plant-level decision-making? Think about what leaders ask for most often, what takes too long to assemble, or what simply doesn't exist yet in a reliable form.",
    description:
      "This is about the single most valuable view of the business. We want to know what would change the quality of decisions if it were always at hand.",
    evidence_prompt:
      "Name the specific view or dashboard (e.g., 'a real-time OEE dashboard by line with drill-down to root cause,' 'a unified order-to-delivery tracker that sales and operations both trust,' 'a margin-by-product view that includes true cost of quality'). Explain why this view matters: what decisions would improve, what questions would it answer, and what currently happens in its absence. Note who would use it most and how often.",
    expected_answer_shape:
      "A specific, named analytical view with a clear description of its content and purpose. A 2–3 sentence explanation of the decision-making impact. Identification of the primary users and the current workaround in its absence.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q09",
    question_text:
      "What skills, governance routines, or organizational habits are missing today that would be needed to turn data into consistently better operational decisions? Think about data literacy, analytical capability, regular review cadences, data stewardship roles, or simply the habit of looking at the numbers before acting.",
    description:
      "Technology alone doesn't fix data problems — people and processes do. We want to know what organizational muscle is underdeveloped.",
    evidence_prompt:
      "Identify 2–3 specific gaps in skills, governance, or habits. For each, explain what's missing and what it would look like if it were in place (e.g., 'We don't have a regular data-quality review — if we did, we'd catch definition drift before it causes conflicting reports'). Note any roles that should exist but don't (e.g., a data steward, a reporting analyst) and any routines that have been tried but didn't stick.",
    expected_answer_shape:
      "2–3 specific gaps described with both the current state and the desired state. For each, an example of how the gap affects decisions today. Notes on any past attempts to close these gaps and why they succeeded or failed.",
  },
  {
    id: "aplix-na__aplix_process_data_v1_q10",
    question_text:
      "If you could automate one reporting or data workflow first — eliminating manual data gathering, reconciliation, or formatting — which one would return the biggest practical benefit to the APLIX North America team? What makes it the right starting point?",
    description:
      "This is your pick for the first automation win. We're looking for something that's high-impact, feasible, and would build confidence for the next step.",
    evidence_prompt:
      "Name the specific workflow (e.g., 'the weekly production summary that pulls from three systems,' 'the monthly customer scorecard that takes two days to assemble,' 'the daily scrap report that operators fill out manually'). Describe the current manual process, estimate the time and effort involved, and explain why automating it would matter — not just time saved, but trust improved, decisions accelerated, or errors eliminated. Note any dependencies or prerequisites for automating it.",
    expected_answer_shape:
      "A specific workflow named and described in enough detail to scope an automation project. Current time/effort estimate and the expected benefit of automation. A brief note on feasibility — what would need to be true for this to work (e.g., data sources accessible, process standardized).",
  },
];

// ---------------------------------------------------------------------------
// Template 3: People, Training, and Change
// ---------------------------------------------------------------------------
export const peopleQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_people_v1_q01",
    question_text:
      "How clearly are responsibilities defined across plant operations, support functions (quality, maintenance, planning, engineering), and regional leadership at APLIX North America today? Where do overlaps or gaps in responsibility create confusion, delays, or dropped tasks — especially when something goes wrong and needs fast resolution?",
    description:
      "Clear roles are the foundation of reliable execution. We want to understand where accountability is sharp and where it gets blurry under pressure.",
    evidence_prompt:
      "Describe the current state of role clarity for 3–4 key interfaces (e.g., production vs. quality during a non-conformance, planning vs. sales during a rush order, maintenance vs. production for unplanned downtime). For each, note whether responsibilities are documented, mutually understood, or still debated. Give specific examples of situations where unclear roles caused delays, duplicate effort, or conflict.",
    expected_answer_shape:
      "3–4 key interfaces described with an honest assessment of role clarity at each. For each, a specific example of a situation where ambiguity caused a problem. A note on whether the issue is structural (missing RACI), cultural (people avoid stepping up), or both.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q02",
    question_text:
      "Where do communication gaps appear most often — during escalations, shift handovers, cross-functional coordination, or information flow between Charlotte and other APLIX sites or corporate? What typically falls through the cracks, and what are the consequences when it does?",
    description:
      "Communication breakdowns are one of the biggest silent killers of operational performance. We want to find the specific gaps, not just the general feeling.",
    evidence_prompt:
      "Identify 2–3 communication pain points with specific examples. For each, describe: the handoff or communication moment (e.g., 'shift handover on the extrusion lines,' 'escalation path when a customer complaint involves both quality and engineering'), what information gets lost or delayed, and what the downstream impact looks like (e.g., repeated defects, delayed customer response, rework). Note any tools or processes in place that are supposed to help but don't work well.",
    expected_answer_shape:
      "2–3 specific communication gaps with a concrete example for each. For each, the information that's lost and the operational consequence. A note on any existing tools or processes that should help but fall short, and why.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q03",
    question_text:
      "What skills are most difficult to build or retain at the Charlotte site and in the broader APLIX North America team? Think about technical skills (process engineering, quality, automation), operational skills (machine operation, troubleshooting), and managerial skills (data-driven decision-making, change leadership). What impact do these skill gaps create today?",
    description:
      "Skill shortages shape what's possible. We want to know which gaps hurt the most so we can factor workforce development into any transformation plan.",
    evidence_prompt:
      "Name the 3–5 hardest-to-fill or hardest-to-retain skill areas. For each, explain whether the issue is recruitment (can't find the right people), retention (people leave), development (no training path), or knowledge concentration (one person holds all the expertise). Give examples of business impact — delayed projects, quality issues, overreliance on specific individuals, or inability to adopt new technology. Note any recent turnover or demographic trends that make this worse.",
    expected_answer_shape:
      "A list of 3–5 critical skill gaps with the root cause for each (recruitment, retention, development, or concentration). At least 2 concrete impact examples. A note on trends — is the situation stable, improving, or deteriorating?",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q04",
    question_text:
      "How effective is the current training approach when a standard, system, or process changes — for operators on the shop floor, for supervisors managing those changes, and for specialists who need to update their methods? Where does training work well, and where do people end up figuring it out on their own or reverting to old habits?",
    description:
      "Change only sticks if people are properly trained. We want to see how well training supports real adoption versus just checking a compliance box.",
    evidence_prompt:
      "Describe how training is typically delivered when something changes (e.g., a new SOP, a system update, a process modification). Cover the methods used (classroom, on-the-job, digital, buddy system), how quickly training happens relative to the change, and how effectiveness is verified. Give examples of changes where training worked well and led to smooth adoption, and examples where it didn't — people struggled, reverted to old methods, or the change quietly failed. Note any differences between operator-level and supervisor-level training.",
    expected_answer_shape:
      "A description of current training methods and timelines. 2 examples of successful training-led adoption and 2 of failed or weak adoption. An honest assessment of whether training is seen as a strategic investment or a compliance checkbox. Notes on any tools or platforms used.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q05",
    question_text:
      "Where do recurring process issues at the Charlotte plant reflect behavior or capability problems rather than purely technical or equipment-related ones? Think about situations where the process design is adequate but execution breaks down because of habits, skill gaps, unclear expectations, or inconsistent adherence to standards.",
    description:
      "Not every recurring problem is a technical problem. We want to identify where human factors are the real root cause so we can address them appropriately.",
    evidence_prompt:
      "Give 2–3 specific examples of recurring issues where the root cause is behavioral or capability-related (e.g., 'operators skip a setup verification step when under time pressure,' 'supervisors don't use the standard escalation path for quality deviations,' 'inconsistent adherence to changeover procedures across shifts'). For each, describe what the standard or expectation is, what actually happens, and what the consequence is. Note whether these issues have been addressed before and what happened.",
    expected_answer_shape:
      "2–3 specific examples with a clear distinction between the expected behavior and the actual behavior. For each, the operational consequence and any past attempts to correct it. A reflection on whether the issue is about awareness, skill, motivation, or system design.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q06",
    question_text:
      "How open are teams at APLIX North America to digital or process change today? Where is there genuine enthusiasm, where is there quiet compliance, and where does real resistance appear? What forms does resistance typically take — overt pushback, passive non-adoption, workarounds, or something else?",
    description:
      "Understanding the change climate is essential before launching any transformation. We want the honest picture, not the optimistic one.",
    evidence_prompt:
      "Characterize the overall appetite for change across 3–4 groups (e.g., shop-floor operators, supervisors, plant management, support functions). For each, describe the typical reaction to a new initiative: enthusiastic, cautiously open, skeptical, or resistant. Give specific examples of recent changes and how they were received. Identify the most common forms of resistance and any patterns (e.g., resistance is strongest when changes come from corporate without local input, or when training is inadequate).",
    expected_answer_shape:
      "A group-by-group assessment of change readiness (3–4 groups). 2–3 specific examples of recent changes and their reception. A description of the most common resistance patterns and their triggers. A note on what helps overcome resistance when it appears.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q07",
    question_text:
      "What is the tangible cost of weak role clarity, training gaps, or poor change adoption at APLIX North America — in terms of productivity losses, quality problems, employee turnover, or customer impact? Where is the cost most visible, and where is it hidden?",
    description:
      "Putting a cost on people-related gaps makes them impossible to ignore. We want specific, concrete impacts — not generalities.",
    evidence_prompt:
      "Identify 2–3 areas where people-related gaps have a measurable cost. For each, describe the gap (e.g., 'new operators take 6 months to reach full productivity because training is informal,' 'turnover in quality roles means we lose institutional knowledge of key customer requirements'). Quantify the impact where possible — scrap rates attributable to training gaps, overtime driven by skill shortages, customer complaints linked to inconsistent execution. Note where costs are visible in reporting versus hidden in everyday inefficiency.",
    expected_answer_shape:
      "2–3 specific cost areas with quantification where possible (dollars, percentages, time). For each, a clear link from the people gap to the business cost. A note on which costs are visible in current reporting and which are hidden.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q08",
    question_text:
      "How do managers and supervisors at APLIX North America reinforce continuous improvement in their daily work — through coaching, Gemba walks, performance conversations, visual management, or other methods? Where does the CI message break down between leadership intent and what actually happens on the shop floor day to day?",
    description:
      "CI culture lives or dies in the daily interactions between leaders and their teams. We want to understand what reinforcement looks like in practice.",
    evidence_prompt:
      "Describe the leadership behaviors that currently support CI — regular shop-floor presence, structured coaching, use of visual management boards, inclusion of CI topics in team meetings. Give examples of where this works well (e.g., a supervisor who consistently uses Gemba walks to identify issues) and where it doesn't (e.g., daily meetings that skip CI topics under time pressure). Note any disconnect between what leadership espouses and what the shop floor experiences.",
    expected_answer_shape:
      "A description of 3–4 current reinforcement mechanisms with an honest assessment of consistency. At least 1 positive example and 1 negative example. An observation about where the biggest gap between intent and practice exists.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q09",
    question_text:
      "If you could make one organizational change to improve execution speed or decision quality at APLIX North America — a role, a reporting line, a governance structure, a cross-functional team, or a capability investment — what would it be and why?",
    description:
      "This is your single best recommendation for organizational improvement. We value your judgment on what would make the biggest difference.",
    evidence_prompt:
      "Name the specific organizational change and explain why it would matter. Describe the current state (what's slow, unclear, or broken), the proposed change, and the expected impact. Reference specific situations where the current structure has failed and where the proposed change would have made a difference. Note any prerequisites or risks associated with the change.",
    expected_answer_shape:
      "A specific organizational change described clearly enough to be actionable. A before-and-after comparison (current state vs. proposed state). 1–2 examples of situations where this change would have made a concrete difference. A brief note on prerequisites or implementation considerations.",
  },
  {
    id: "aplix-na__aplix_process_people_v1_q10",
    question_text:
      "What digital support would best help teams at APLIX North America adopt new standards, solve problems faster, or capture and share operational know-how more reliably? Think about training platforms, knowledge bases, guided troubleshooting tools, or AI-assisted coaching — what would make the biggest practical difference?",
    description:
      "We're looking for where digital tools could genuinely accelerate people development and knowledge sharing — not just another system to maintain.",
    evidence_prompt:
      "Identify 1–2 specific digital capabilities that would help most (e.g., 'a mobile-friendly knowledge base operators can search during troubleshooting,' 'an AI-assisted onboarding tool that adapts to each role,' 'a digital standard-work library with video and photos that supervisors can update easily'). For each, explain the current pain point it would address and the practical benefit. Note any past experiences with digital training or knowledge tools — what worked and what didn't.",
    expected_answer_shape:
      "1–2 specific digital capabilities described with enough detail to understand what they would do. For each, a clear link to a current pain point and an expected benefit. Any relevant experience with similar tools in the past.",
  },
];

// ---------------------------------------------------------------------------
// Template 4: R&D and Engineering
// ---------------------------------------------------------------------------
export const rndQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_rnd_v1_q01",
    question_text:
      "What are the most important innovation and engineering priorities for APLIX North America today — new product development, application engineering for existing products, process improvements on the production floor, or material and sustainability innovations? How clearly do these priorities connect to business growth targets in your key markets (hygiene, automotive, construction, medical, packaging)?",
    description:
      "We want to understand what engineering is focused on and whether those priorities are tightly linked to where the business needs to grow.",
    evidence_prompt:
      "List the top 3–5 engineering or innovation priorities and explain how each connects to a market opportunity or business need (e.g., 'developing a lighter-weight hook profile for the automotive segment to meet OEM weight-reduction targets'). Note which priorities are clearly funded and staffed versus which are aspirational. Identify any market opportunities that aren't yet reflected in engineering priorities but should be.",
    expected_answer_shape:
      "A prioritized list of 3–5 engineering focus areas, each linked to a specific market or business driver. An indication of resourcing level for each (well-funded, underfunded, or unfunded). A note on any gaps between market needs and current engineering focus.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q02",
    question_text:
      "Where does the path from a customer need or new product idea to a tested, industrialized solution slow down the most? Think about the full journey: initial scoping, feasibility assessment, prototyping, testing and validation, customer approval, and scale-up to production. Which stages consistently take longer than they should?",
    description:
      "Speed-to-market depends on every handoff working smoothly. We want to find the specific stages where the development pipeline gets congested.",
    evidence_prompt:
      "Walk through the typical development timeline for a new product or application. Identify which stages move at a reasonable pace and which consistently take longer than expected. For each slow stage, describe the root cause: waiting for customer input, internal resource constraints, testing bottlenecks, approval loops, or scale-up challenges. Give a specific example of a recent project that took longer than planned and where the time was lost.",
    expected_answer_shape:
      "A stage-by-stage assessment of the development pipeline (5–7 stages) with typical and actual durations. 2–3 stages identified as consistent bottlenecks with root causes explained. At least 1 specific project example with a timeline showing where delays occurred.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q03",
    question_text:
      "Which handoffs between engineering, sales, quality, and production create the most misunderstanding, rework, or friction? Think about requirements capture, design reviews, specification handoffs, quality validation, and the transition from development to full-scale manufacturing. Where do things get lost in translation?",
    description:
      "Cross-functional handoffs are where information degrades. We want to identify the specific interfaces that cause the most rework or confusion.",
    evidence_prompt:
      "Identify the 2–3 most problematic handoff points. For each, describe: who hands off to whom, what information is supposed to transfer, what actually transfers (and what gets lost), and what the consequence is (rework, redesign, customer escalation, production problems). Give specific examples where a handoff failure led to measurable cost or delay. Note any processes or tools that are supposed to support these handoffs and how well they work.",
    expected_answer_shape:
      "2–3 specific handoff points described with the intended vs. actual information flow. A concrete example for each showing the cost of failure. A note on existing tools or processes at each handoff and their effectiveness.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q04",
    question_text:
      "How easy — or difficult — is it for engineers at APLIX to find what they need when they need it: prior designs and CAD files, test results from past projects, customer technical requirements, material and process constraints, lessons learned from previous development or industrialization efforts? Where does the search for information slow down engineering work the most?",
    description:
      "Engineering productivity depends heavily on access to institutional knowledge. We want to understand how much time engineers lose searching for or recreating information that already exists somewhere.",
    evidence_prompt:
      "Describe how engineering knowledge is currently stored and accessed — formal systems (PDM, PLM, document management), informal repositories (shared drives, personal folders, email), or tribal knowledge (asking colleagues). For each category, note how searchable and reliable it is. Give examples of situations where engineers spent significant time looking for information, couldn't find it, or recreated something that already existed. Estimate how much time per week an average engineer spends searching for or reconstructing existing knowledge.",
    expected_answer_shape:
      "A description of 3–4 knowledge repositories with an assessment of accessibility and reliability. 2–3 examples of information search failures or duplication. A rough estimate of time lost per engineer per week. A note on what types of knowledge are hardest to find.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q05",
    question_text:
      "What types of rework happen most often during product development or industrialization at APLIX? Consider incomplete or misunderstood requirements, redesigns driven by manufacturing constraints discovered late, retesting because test conditions weren't right the first time, and change requests from customers after development is already underway. Which type of rework is the most costly?",
    description:
      "Rework is the clearest signal of process gaps. Understanding the dominant rework patterns tells us where to focus prevention efforts.",
    evidence_prompt:
      "Rank the main types of engineering rework by frequency and cost. For each type, give a specific example from a recent project (e.g., 'redesigned the hook geometry for Product X because the extrusion line couldn't hold tolerance at production speed — discovered during scale-up, not during feasibility'). Estimate the cost of rework for the most common types: extra engineering hours, delayed launches, wasted material, or customer dissatisfaction. Note whether these rework patterns are stable, increasing, or improving.",
    expected_answer_shape:
      "A ranked list of 3–5 rework types with frequency and cost assessment. A specific project example for at least 2 types. An estimate of total rework cost as a percentage of engineering effort or project budget. A trend assessment (improving, stable, or worsening).",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q06",
    question_text:
      "Which engineering delays create the greatest cost or revenue impact for the business today? Think broadly: delayed product launches that miss market windows, slow responses to customer technical requests that weaken the sales position, prolonged validation cycles that tie up production capacity, or late design changes that disrupt manufacturing schedules.",
    description:
      "Not all delays are equal. We want to know which engineering bottlenecks hit the P&L or customer relationships the hardest.",
    evidence_prompt:
      "Identify the 2–3 most impactful engineering delays and explain their business consequence. For each, describe the delay (what takes too long), the business impact (revenue at risk, customer confidence eroded, production capacity tied up), and a specific example. If possible, estimate the financial impact or the revenue at stake. Note any patterns — do the same types of delays keep recurring, or are they different each time?",
    expected_answer_shape:
      "2–3 engineering delay types ranked by business impact. For each, a specific example with estimated financial or customer impact. A note on whether these are systemic (structural) or episodic (project-specific) delays.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q07",
    question_text:
      "How well connected are product data, test data, customer specifications, and manufacturing constraints in the current engineering toolchain? Can an engineer working on a new design easily see what materials are qualified, what test results exist for similar products, what the customer's specific requirements are, and what the production lines can actually do — or are these in separate, disconnected systems?",
    description:
      "Fragmented engineering data leads to slow decisions and avoidable mistakes. We want to understand the real state of data connectivity in the engineering workflow.",
    evidence_prompt:
      "Map the key data types an engineer needs (product designs, material specs, test data, customer requirements, process capabilities, regulatory constraints) to the systems where they live. Note which connections are automated, which require manual lookup, and which don't exist at all. Give examples of engineering decisions that were delayed or wrong because data wasn't connected. Describe any 'single source of truth' that exists for engineering data and how complete it is.",
    expected_answer_shape:
      "A map of 5–6 data types to their current systems with connectivity status (linked, manual lookup, or disconnected). 2 examples of decisions impacted by disconnected data. An assessment of how far the current toolchain is from a connected engineering data environment.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q08",
    question_text:
      "What part of the validation, approval, or documentation process is the biggest bottleneck for engineering throughput today? Think about internal design reviews, customer sample approvals, regulatory or specification compliance checks, test report generation, and engineering change management. Which process step consistently limits how fast engineering can deliver?",
    description:
      "Validation and documentation are necessary but often become bottlenecks when they're not designed for speed. We want to find the constraint.",
    evidence_prompt:
      "Identify the 2–3 most time-consuming validation or documentation steps. For each, describe the process, who is involved, how long it typically takes, and why it takes that long (e.g., waiting for customer feedback, internal reviewer availability, manual document preparation, unclear approval authority). Give a specific example of a project where this step caused a significant delay. Note any recent efforts to streamline these processes and their results.",
    expected_answer_shape:
      "2–3 bottleneck steps described with typical duration and root cause of delay. A specific project example for at least 1. Any improvement efforts described with results. A recommendation on which bottleneck would be most impactful to address first.",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q09",
    question_text:
      "What engineering capability or practice — whether it's a tool, a methodology, a team structure, or a knowledge-management approach — would most increase speed and design reuse without reducing technical rigor? How would it change the way engineering work gets done at APLIX?",
    description:
      "Speed and reuse are the twin levers of engineering productivity. We want your best idea for how to improve both while maintaining quality standards.",
    evidence_prompt:
      "Describe 1–2 capabilities or practices that would have the biggest impact. For each, explain what it is, how it would work in the APLIX context, and what current problem it would solve (e.g., 'a parametric design library for hook profiles that lets engineers start from validated baselines instead of blank sheets,' 'a structured lessons-learned database searchable by product type, material, and failure mode'). Estimate the impact in terms of time saved, rework avoided, or faster time-to-customer. Note any barriers to implementation.",
    expected_answer_shape:
      "1–2 specific capability recommendations with a clear description of how each would work at APLIX. For each, the problem it solves, the estimated impact, and implementation barriers. A sense of priority — which one would you do first?",
  },
  {
    id: "aplix-na__aplix_process_rnd_v1_q10",
    question_text:
      "What digital assistant, intelligent search, or knowledge-reuse capability would create the biggest benefit for engineering teams at APLIX if it were available today? Think about AI-powered search across test data and design history, automated report generation, intelligent specification matching, or assistants that help engineers navigate complex requirements faster.",
    description:
      "We're exploring where AI and digital tools could give engineering the most leverage — not as a buzzword, but as a practical productivity multiplier.",
    evidence_prompt:
      "Describe 1–2 digital capabilities that would help engineering teams most. For each, be specific about what it would do (e.g., 'an AI tool that can search across all past test reports and surface the most relevant results when an engineer is working on a similar product,' 'an automated first draft of validation reports based on test data and templates'). Explain the current pain point it addresses, how much time or effort it would save, and how confident you are that engineers would actually use it. Note any concerns about trust, accuracy, or adoption.",
    expected_answer_shape:
      "1–2 specific digital capabilities described in practical terms. For each, the pain point addressed, estimated time savings, and a realistic assessment of adoption likelihood. Any concerns about implementation or trust noted.",
  },
];

// ---------------------------------------------------------------------------
// Template 5: Sales and B2B Customer Support
// ---------------------------------------------------------------------------
export const salesCsQuestions: QuestionUpdate[] = [
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q01",
    question_text:
      "Walk us through the main stages from when a customer request arrives — whether it's a new inquiry, a reorder, a sample request, or a service issue — to when it's confirmed and moving toward fulfillment. Where in that flow do deals or service requests slow down the most, and what causes those bottlenecks?",
    description:
      "We want to see the full customer journey from the commercial team's perspective. Understanding where things slow down helps us find the highest-value improvements.",
    evidence_prompt:
      "Map out the typical stages (e.g., inquiry receipt, technical feasibility, quoting, pricing approval, sample production, customer approval, order entry, confirmation). For each stage, note the typical time and who is involved. Identify the 2–3 stages where things slow down most often and describe the root causes (e.g., waiting for internal pricing approval, engineering feasibility taking too long, customer specification unclear). Give a specific example of a deal or request that was delayed and what the impact was.",
    expected_answer_shape:
      "A stage-by-stage map of the process (6–8 stages) with approximate timelines. 2–3 bottleneck stages identified with root causes. At least 1 specific example of a delayed deal or request with business impact described.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q02",
    question_text:
      "Which parts of the quoting, pricing, sample request, or special-offer preparation process consume the most time and effort for the commercial team today? Think about gathering technical data, assembling cost information, getting internal approvals, coordinating with engineering or production, and preparing customer-facing documents.",
    description:
      "Quoting and pricing are where deals get won or lost. We want to find the specific steps that eat the most time so we can streamline them.",
    evidence_prompt:
      "Break down the quoting/pricing process into its components and estimate the effort for each (e.g., 'gathering material and process costs takes 2 hours because it requires emailing three departments,' 'pricing approval takes 3 days because it needs sign-off from France'). Identify which steps are manual versus system-supported. Note how many quotes or pricing requests the team handles per week/month and how much of that volume involves custom or non-standard products versus repeats. Give an example of a quote that was particularly painful to prepare.",
    expected_answer_shape:
      "A breakdown of 5–7 quoting/pricing steps with time estimates. Volume context (quotes per period, % custom vs. standard). Identification of the 2–3 most time-consuming steps with root causes. 1 specific painful example described.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q03",
    question_text:
      "How well do CRM, ERP, product data, inventory and availability information, and customer history work together for the APLIX commercial team? When a sales rep or customer-support person needs to answer a customer question, how many systems or people do they need to consult — and how long does it take to assemble a complete, reliable answer?",
    description:
      "System fragmentation directly impacts response speed and customer confidence. We want to understand the real effort behind a 'simple' customer inquiry.",
    evidence_prompt:
      "Describe how the commercial team accesses the information they need day to day. Map a typical customer inquiry (e.g., 'What's the status of my order?' or 'Can you quote this custom product?') and trace the systems and people involved in answering it. Note where information is available in one click versus where it requires manual lookup, phone calls, or emails. Identify which information is most often missing, outdated, or unreliable. Estimate how much time per day the team spends assembling information from multiple sources.",
    expected_answer_shape:
      "A trace of 2–3 typical customer inquiries through the systems landscape, showing the number of systems/people consulted and time to answer. Identification of the biggest information gaps. An estimate of daily time spent on information assembly. A note on which system integration would help most.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q04",
    question_text:
      "Where do the sales and customer-support teams struggle most in their handoffs with planning, quality, engineering, or production? Think about situations like translating customer requirements into production orders, getting delivery date commitments, handling quality issues or complaints that need factory input, or coordinating engineering support for technical inquiries.",
    description:
      "The commercial team sits at the intersection of the customer and the factory. We want to know where those internal handoffs create the most friction.",
    evidence_prompt:
      "Identify the 3–4 most problematic internal handoffs from the commercial team's perspective. For each, describe: what information or decision is needed, who the handoff is with, how it's currently handled (email, system, meeting, informal), and what typically goes wrong (delayed response, incomplete information, conflicting answers). Give specific examples of customer-impacting situations caused by weak internal handoffs. Note any escalation paths that work well and any that don't.",
    expected_answer_shape:
      "3–4 specific handoff points described with current process, typical failure mode, and customer impact. At least 2 specific examples. A note on what makes some handoffs work better than others.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q05",
    question_text:
      "What customer questions, internal information requests, or routine tasks handled by the commercial and support teams are highly repetitive and could be standardized, templated, or automated? Think about frequently asked questions, status update requests, document preparation, data lookups, and recurring coordination tasks.",
    description:
      "Repetitive work is the lowest-hanging fruit for automation. We want to build a concrete list of tasks that should no longer require manual effort.",
    evidence_prompt:
      "List 5–7 repetitive tasks or question types that the commercial or support team handles regularly. For each, estimate the frequency (how many times per day/week), the time per occurrence, and whether it follows a predictable pattern. Examples might include: 'order status inquiries — 15 per day, 5 minutes each, always the same lookup in SAP,' or 'certificate of conformance requests — 8 per week, 20 minutes each, always the same data pulled and formatted.' Note which tasks could be self-service for customers and which need internal automation.",
    expected_answer_shape:
      "A list of 5–7 repetitive tasks with frequency, time-per-task, and a note on whether each could be automated, templated, or made self-service. Total estimated time savings per week if the top 3 were automated.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q06",
    question_text:
      "Where is margin or service performance lost because order details arrive from the customer or from internal teams incomplete, late, ambiguous, or inconsistent? Think about situations like unclear specs on custom orders, missing technical parameters, pricing discrepancies, or late-arriving information that forces last-minute changes to production plans.",
    description:
      "Incomplete order information is a profit leak that touches every downstream process. We want to quantify where it hurts most.",
    evidence_prompt:
      "Describe 3–4 common scenarios where incomplete or late order information creates problems. For each, explain: what information is typically missing or wrong, where it comes from (customer or internal), what the downstream impact is (production disruption, rework, delivery delay, margin erosion), and how often it happens. Estimate the cost or impact where possible (e.g., 'approximately 15% of custom orders require clarification, adding an average of 3 days to lead time'). Note any patterns by customer segment or product type.",
    expected_answer_shape:
      "3–4 specific scenarios described with root cause, frequency, and business impact. At least 2 with a quantified impact estimate. A note on whether the problem is primarily customer-driven or internal-process-driven. Any patterns by segment or product type.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q07",
    question_text:
      "How quickly can the commercial team at APLIX North America answer a customer with reliable information on technical fit, lead time, quality status, or order progress? What's the difference between the best-case response time and the typical reality — and what drives that gap?",
    description:
      "Response speed is a competitive differentiator in B2B. We want to measure the gap between ideal and actual response time and understand what causes it.",
    evidence_prompt:
      "For 3–4 common customer question types (e.g., 'Is this product suitable for my application?', 'When can you deliver?', 'What's the status of my open order?', 'We have a quality concern — what happened?'), estimate the best-case and typical response time. For each, explain what creates the gap: information not readily available, need to consult other departments, system limitations, or approval requirements. Give a specific example of a customer interaction where slow response had a real consequence (lost deal, strained relationship, escalation).",
    expected_answer_shape:
      "A table or list of 3–4 question types with best-case and typical response times. For each, the root cause of delay. At least 1 example of a real customer consequence. A note on which response-time improvement would have the biggest commercial impact.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q08",
    question_text:
      "If you could change one thing about how the commercial process works at APLIX North America — whether it's a process step, a tool, a decision right, an information flow, or a team structure — what single change would create the biggest improvement in win rate, response speed, or customer confidence?",
    description:
      "This is your top pick for the most impactful commercial process improvement. We value your frontline judgment on what would make the biggest difference.",
    evidence_prompt:
      "Name the specific change and explain why it would matter. Describe the current state (what's broken or slow), the proposed change, and the expected impact on win rate, speed, or customer perception. Reference specific situations where the current process failed and where the proposed change would have made a difference. Estimate the scale of impact — even a rough one is valuable (e.g., 'would cut average quote time from 5 days to 2 days,' or 'would eliminate the 20% of orders that require rework due to unclear specs').",
    expected_answer_shape:
      "A specific, actionable change described clearly. A before-and-after comparison with estimated impact. 1–2 examples of situations where this change would have helped. A brief note on what it would take to implement.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q09",
    question_text:
      "How well do the commercial and customer-support teams capture and reuse lessons from complaints, urgent requests, and difficult customer situations? When a problem is resolved, does the knowledge stay with the individual who handled it — or does it become available to the team for next time?",
    description:
      "Every customer issue is a learning opportunity. We want to know whether that learning is captured and shared or lost when the inbox moves on.",
    evidence_prompt:
      "Describe the current process (or lack thereof) for capturing lessons from customer issues — complaints, escalations, difficult technical requests, or near-misses. Note where lessons are stored (CRM notes, email threads, personal memory, formal reports) and how searchable or accessible they are. Give examples of situations where past lessons were successfully reused and others where the same problem was solved from scratch. Identify any patterns — are certain types of lessons captured better than others?",
    expected_answer_shape:
      "A description of current lesson-capture practices with an honest assessment of their effectiveness. 2 examples: 1 of successful reuse and 1 of missed reuse. An identification of which types of lessons are most often lost. A suggestion for what would most improve capture and reuse.",
  },
  {
    id: "aplix-na__aplix_process_sales_cs_v1_q10",
    question_text:
      "What AI or workflow automation support would make commercial and customer-support work at APLIX North America noticeably faster or more reliable — without increasing risk to the customer relationship? Think about intelligent search across customer history, automated quote preparation, AI-assisted responses to technical questions, smart routing of requests, or predictive tools for delivery commitments.",
    description:
      "We're looking for practical AI and automation ideas that would make a real difference for the commercial team — tools that save time and improve accuracy without undermining the human relationships that matter in B2B.",
    evidence_prompt:
      "Identify 1–2 specific AI or automation capabilities that would create the most value. For each, describe: what it would do in practical terms, which current pain point it addresses, how much time or effort it would save, and what safeguards would be needed to maintain customer trust (e.g., human review before sending, confidence thresholds for automated responses). Note any concerns about adoption — would the team embrace it or resist it? Reference any similar tools the team has tried or considered.",
    expected_answer_shape:
      "1–2 specific AI or automation capabilities described in practical terms. For each, the pain point addressed, estimated benefit, required safeguards, and an honest adoption assessment. Any relevant past experience with similar tools noted.",
  },
];
