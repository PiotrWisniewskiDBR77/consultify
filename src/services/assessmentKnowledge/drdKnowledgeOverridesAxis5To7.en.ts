/**
 * DRD Knowledge Overrides — Axes 5, 6 and 7 (EN mirror)
 *
 * Batch 3 of the DRD question bank: behavioral questions with evidence artifacts.
 *
 * Methodology (per DRD_CANON.md §9.2):
 * - 3 questions per area × level, behavioral (artifact-based, not self-assessment)
 * - example: concrete evidence-artifact expected when answering "yes"
 * - suggestedTechnologies: per key, contextual
 *
 * Structural note (canonical SSOT = src/services/drdStructure.ts Map A / London):
 * - Axis 5 (Culture of Transformation): 5 areas × 6 levels (behavioral ladders per the DRD book)
 * - Axis 6 (Cybersecurity): 5 areas × 6 levels (cumulative technical scale)
 * - Axis 7 (AI Maturity): 5 areas × 5 levels
 *
 * Key: `{area}#{level}`, e.g. "5A#3"
 *
 * This is the English mirror of drdKnowledgeOverridesAxis5To7.ts (PL source of truth).
 * Keep in sync 1:1 with the Polish file. Do not modify the PL file or the orchestrator
 * (getDRDKnowledge) from here — this file is self-contained data only.
 */

import type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';

// ============================================================
// AXIS 5: CULTURE OF TRANSFORMATION (5A–5E, 6 levels)
// ============================================================

// 5A — Leadership Attitudes
// Note: 5A describes leadership TYPES (not increasing maturity).
// Questions focus on observable decisions and behaviors of the leader.

const axis5A: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5A#1': {
    questions: [
      'Does executive/senior management openly communicate a lack of engagement in digital initiatives — or simply neither block nor support them?',
      'In the last 12 months, did management decline budget or resources for at least 2 transformation initiatives without a substantive justification?',
      'Does the topic of digitalization come up less often than once a quarter at board/management meetings?',
    ],
    example:
      'Evidence: agenda list from the last 4 quarters of board meetings — no item on "digital transformation / innovation". Or a list of rejected project proposals without strategic justification.',
    suggestedTechnologies: ['Board meeting minutes', 'Budget decision register'],
  },
  '5A#2': {
    questions: [
      'Are technology adoption decisions made solely by one person without consultation with other departments or specialists?',
      'Do project teams receive detailed "how to do it" instructions rather than goals to achieve?',
      'Did at least one manager leave or report frustration about lack of decision-making authority in the past year?',
    ],
    example:
      'Evidence: an org chart with a single decision-making center plus project documentation showing detailed directives instead of goals. Alternatively, exit interview results.',
    suggestedTechnologies: [
      'HRIS (exit interviews)',
      'Project management systems',
      'Project documentation',
    ],
  },
  '5A#3': {
    questions: [
      'Does management set measurable digital goals with deadlines and delegate authority to team leaders to achieve them?',
      'Is there documentation showing resources (budget, time, tools) assigned to specific transformation projects?',
      'Does the manager personally use digital tools (CRM, BI, project platform) and require the same of their teams?',
    ],
    example:
      'Evidence: a project charter or OKR/KPI with an assigned owner, deadline and budget. Screenshot of a BI dashboard used daily by the manager.',
    suggestedTechnologies: ['OKR/KPI Tool', 'BI Dashboard', 'Project Management (Jira/Asana)'],
  },
  '5A#4': {
    questions: [
      'Does the leader actively build psychological safety in the team — e.g. publicly acknowledging their own mistakes or rewarding attempts at innovation regardless of outcome?',
      'In the last 6 months, did the leader attend a training or conference on digital transformation and implement a concrete change based on that knowledge?',
      'Do teams report that they can experiment without fear of punishment for failure (confirmed e.g. in an organizational pulse survey)?',
    ],
    example:
      'Evidence: engagement/psychological safety survey results (e.g. Gallup Q12) with a score ≥ 4/5 on experimentation questions. Or a documented retrospective session where the leader discusses their own mistakes.',
    suggestedTechnologies: [
      'Pulse Survey Tool (Officevibe, Leapsome)',
      'HR Analytics',
      'Learning Management System (LMS)',
    ],
  },
  '5A#5': {
    questions: [
      'Does the leader actively test new technologies (e.g. AI tools, new working methods) and encourage the team to experiment with a right to fail?',
      'Does the leader participate in external innovation ecosystems (hackathons, startups, universities) and bring the results back into the organization?',
      'Do leader-driven initiatives go beyond optimization — i.e. create new business models or categories of value?',
    ],
    example:
      'Evidence: a list of innovation initiatives from the last 2 years with confirmed business impact (ROI, new customers, new product). Or documentation of participation in an incubation program / startup partnership.',
    suggestedTechnologies: [
      'Innovation Pipeline Tool',
      'Venture Builder Platform',
      'R&D Portfolio Management',
    ],
  },
  '5A#6': {
    questions: [
      'Does the board build and publicly articulate a 3–5 year digital vision, tied to business strategy and measured quarterly?',
      'Does the leader spend at least 20% of their time on transformation activities (training, mentoring, external ecosystem) — measurable via calendar or OKR?',
      'Does the organization have a formal leadership succession program that accounts for digital competencies and a change-oriented management style?',
    ],
    example:
      'Evidence: a "Digital Vision 2026–2030" document approved by the board with KPIs and owners. A succession program with an explicit "AI/digital competency" criterion. A quarterly progress report on the transformation presented to shareholders.',
    suggestedTechnologies: [
      'Strategic Planning Tool (Cascade, Monday)',
      'Succession Planning (SAP SuccessFactors)',
      'Executive Reporting Dashboard',
    ],
  },
};

// 5B — Readiness for Change (Kotter's model)
const axis5B: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5B#1': {
    questions: [
      'Has the organization formally identified specific problems or threats that force change (e.g. loss of market share, rising costs, regulatory pressure)?',
      'Is management aware that without change the company will be in a difficult position — has this been documented (report, analysis, presentation)?',
      "Is there at least one person or committee formally responsible for monitoring change signals in the company's environment?",
    ],
    example:
      'Evidence: a 2024/2025 diagnostic report or SWOT analysis pointing to specific reasons for urgency of change. Or board minutes discussing competitive threats.',
    suggestedTechnologies: [
      'Business Intelligence',
      'Market Monitoring Tool',
      'SWOT/Diagnostic Framework',
    ],
  },
  '5B#2': {
    questions: [
      'Is there an identifiable "change sponsor" with authority and budget, rather than just an informal enthusiast?',
      'Is the composition of the "change coalition" documented by name and does it span at least 3 functional areas of the company?',
      'Have leaders from different departments observed or publicly confirmed the urgency of change?',
    ],
    example:
      'Evidence: an internal order establishing a "digital transformation committee" with a named list and mandate. Or documentation of a kick-off meeting attended by representatives from sales, IT, operations and HR.',
    suggestedTechnologies: [
      'HRIS / Org Chart Tool',
      'Collaboration Platform (Teams/Slack)',
      'Governance Framework',
    ],
  },
  '5B#3': {
    questions: [
      'Does the organization have a documented vision of the target ("To Be") state with a horizon of at least 2–3 years, approved by the board?',
      'Is there a strategy for communicating the vision — an action plan, channels, timeline — rather than just a one-off presentation?',
      'Is the change vision tied to concrete business metrics (e.g. cost reduction of 15%, NPS increase of 10 points)?',
    ],
    example:
      'Evidence: a "Transformation Vision 2025–2027" document approved by the board with KPIs and a timeline. Or a communication plan with a schedule of townhalls and messages tailored to specific groups.',
    suggestedTechnologies: [
      'Strategic Planning Tool',
      'Internal Communication Platform (Intranet)',
      'OKR Software',
    ],
  },
  '5B#4': {
    questions: [
      'Is the change vision regularly communicated to employees by supervisors — at least once a quarter, in different formats (townhall, video, newsletter)?',
      'Can employees actively raise questions, concerns or ideas about the change (e.g. via a forum, Q&A, survey)?',
      'Is the vision-understanding survey score among employees ≥ 70% (question: "Do you know where the company is heading")?',
    ],
    example:
      'Evidence: a recording of a townhall or newsletter from the last 3 months confirming two-way communication. Employee survey results with a question about understanding the direction of transformation.',
    suggestedTechnologies: [
      'Internal Communication Platform',
      'Employee Survey Tool',
      'Intranet / Digital Workplace',
    ],
  },
  '5B#5': {
    questions: [
      'Does the organization implement planned change initiatives with documented steps, owners and completion dates?',
      'Are implementation progress indicators measured quarterly and reported to the board?',
      'Is there a mechanism for removing implementation obstacles (escalation path, blocker backlog)?',
    ],
    example:
      'Evidence: a transformation roadmap with a "green/yellow/red" status per initiative, updated monthly. Steering committee minutes discussing removed barriers.',
    suggestedTechnologies: [
      'Project Portfolio Management (PPM)',
      'OKR/KPI Platform',
      'Risk & Issue Register',
    ],
  },
  '5B#6': {
    questions: [
      'Is change embedded in permanent elements of the company culture — e.g. in performance review criteria, onboarding programs, organizational values?',
      'Do change mechanisms work without a "hero sponsor" — i.e. do institutions (processes, roles, KPIs) drive change independently?',
      'Has the organization completed at least two full successful change cycles, from which lessons were drawn and implemented in subsequent initiatives?',
    ],
    example:
      'Evidence: an organizational values charter with an explicit "continuous transformation" element. An annual review form asking about the employee\'s contribution to change. Lessons learned from 2 completed transformation projects implemented in subsequent ones.',
    suggestedTechnologies: [
      'Performance Management System',
      'Knowledge Management (Confluence)',
      'HR Onboarding Platform',
    ],
  },
};

// 5C — Continuous Competency Development
const axis5C: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5C#1': {
    questions: [
      'Do employees attend external industry events (trade fairs, conferences, webinars) at least once a year, with takeaways formally shared with the organization?',
      'Is there a list of people who attended such events in the last 12 months, confirming the topic and the form of reporting back results?',
      'Does the organization cover participation costs and treat it as an investment, not a reward?',
    ],
    example:
      'Evidence: a list of employee participation in conferences 2024–2025 with topics and knowledge-transfer format (internal presentation, report, workshop). Proof of cost reimbursement.',
    suggestedTechnologies: [
      'Learning Management System (LMS)',
      'HR Training Register',
      'Event Management Tool',
    ],
  },
  '5C#2': {
    questions: [
      'Does the organization run regular (at least quarterly) internal training on digital tools or soft transformation competencies?',
      'Is there an internal training register with a list of participants, topics and dates from the last 12 months?',
      'Do internal trainers have dedicated time allocated for preparing and delivering training (not "after hours")?',
    ],
    example:
      'Evidence: a 2025 internal training plan with a calendar, participant list and attendance confirmation (signed sheets or LMS printouts). An "internal trainer" role included in job descriptions.',
    suggestedTechnologies: [
      'LMS (Moodle, Docebo)',
      'HR Training Register',
      'Calendar / Scheduling Tool',
    ],
  },
  '5C#3': {
    questions: [
      'Do employees attend certified external training at least once a year, with the organization covering the costs?',
      'Is the external training budget included in the financial plan as a separate line item, not "whatever is left"?',
      'Is there a training policy defining who, how often and for which trainings can enroll?',
    ],
    example:
      'Evidence: a budget excerpt with a "external training 2025" line item and amount. A list of certificates obtained by employees in the last 2 years. A training policy approved by HR.',
    suggestedTechnologies: ['LMS', 'HR Policy Management', 'Finance/ERP (budget tracking)'],
  },
  '5C#4': {
    questions: [
      'Does the organization provide employees access to e-learning platforms (Udemy, Coursera, LinkedIn Learning) with an assigned budget or group license?',
      'Do employees have formal "learning hours" built into their weekly schedule (e.g. "learning Friday" or 2h/week)?',
      'Is use of self-learning platforms measured and reported (e.g. completion rate per department)?',
    ],
    example:
      'Evidence: a contract with an e-learning platform (Udemy Business, Coursera for Business) with a date and number of licenses. A completion-rate report for the last quarter. A "learning time" policy confirmed by supervisors.',
    suggestedTechnologies: [
      'Udemy Business / Coursera for Teams',
      'LinkedIn Learning',
      'LMS Analytics',
    ],
  },
  '5C#5': {
    questions: [
      'Do employees gain competencies by working in cross-functional project teams, not only through training?',
      'Is rotation between projects and departments an official development practice with a plan and a mentor?',
      'Do at least 20% of transformation initiatives include employees from outside the "default" department (e.g. operations staff on an IT project)?',
    ],
    example:
      'Evidence: project charters showing cross-functional composition, confirming participation of employees from different departments. A project rotation plan approved by HR.',
    suggestedTechnologies: [
      'Project Management Tool (Jira/Asana)',
      'HRIS (rotation tracking)',
      'Skills Matrix',
    ],
  },
  '5C#6': {
    questions: [
      'Is there a formal mentoring program in place — with documented mentor/mentee pairs, goals and meeting cadence?',
      'Does the organization measure mentoring outcomes (e.g. promotions, completion rate, mentee competency review results)?',
      'Do mentors have dedicated time in their work plans (not "after hours") and are they rewarded for this role?',
    ],
    example:
      'Evidence: a list of mentor/mentee pairs from the last 12 months, a meeting plan and check-in confirmations. A results report: X promotions among mentees, Y% completion rate. An annual mentor review that accounts for their mentoring contribution.',
    suggestedTechnologies: [
      'Mentoring Platform (Together, MentorcliQ)',
      'HRIS',
      'Performance Management System',
    ],
  },
};

// 5D — Innovation Culture
const axis5D: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5D#1': {
    questions: [
      'Does the organization have a channel or mechanism for collecting ideas from employees (platform, suggestion box, hackathon) — not just an "open door policy"?',
      'Has at least one employee idea moved to implementation or pilot stage in the last 12 months?',
      'Is the number of submitted ideas and their statuses regularly reported (e.g. quarterly)?',
    ],
    example:
      'Evidence: an idea platform with the number of submissions, statuses and dates from the last 12 months. Or hackathon minutes with a participant list and outcome.',
    suggestedTechnologies: [
      'Idea Management Platform (Brightidea, IdeaScale)',
      'Collaboration Tool (Teams/Slack)',
      'Innovation Tracker',
    ],
  },
  '5D#2': {
    questions: [
      'Does the organization regularly (at least once a year) run concept tests or prototypes — with documented results, not just "conversations about ideas"?',
      'Is there a dedicated budget for prototypes/pilots (even small, but formal)?',
      'Are prototype results (even failed ones) documented and shared with stakeholders?',
    ],
    example:
      'Evidence: a list of pilots from the last 2 years with a description of the hypothesis, result and decision (continue/close). An "innovation budget" line item in the financial plan with an amount.',
    suggestedTechnologies: [
      'Prototype/MVP Tools (Figma, Notion)',
      'Project Tracking',
      'Budget Management (ERP)',
    ],
  },
  '5D#3': {
    questions: [
      'Does the organization formally monitor market and technology trends — e.g. through report subscriptions, a dedicated analyst, or monthly trend reviews?',
      'Do trend analysis results reach the agenda of board or senior management meetings at least once a quarter?',
      'Are trends linked to concrete decisions or initiatives (not just "interesting, too bad we don\'t do it")?',
    ],
    example:
      'Evidence: a trend report with a date and owner\'s signature. A board meeting agenda with a "trends/innovation" item. A list of initiatives launched based on trend analysis.',
    suggestedTechnologies: [
      'Market Intelligence (Crayon, Klue)',
      'Research Platform (Gartner, Forrester)',
      'BI Dashboard',
    ],
  },
  '5D#4': {
    questions: [
      'Does the organization have a documented "right to fail" policy — i.e. it clearly states that failure in an experiment does not lead to punishment?',
      'In the past year, did at least one project fail, with a retrospective conducted to draw lessons instead of punishment?',
      'Are retrospective results from failed projects shared with the wider organization (knowledge sharing)?',
    ],
    example:
      'Evidence: a "fail fast, learn fast" policy or analogous document approved by the board. Retrospective minutes from a closed project with a list of lessons and follow-up actions.',
    suggestedTechnologies: [
      'Knowledge Management (Confluence)',
      'Retrospective Tools (Miro, EasyRetro)',
      'HR Policy Platform',
    ],
  },
  '5D#5': {
    questions: [
      'Does the organization have a dedicated R&D role or team with its own budget and annual goals, independent of current projects?',
      'Is R&D included in the company strategy as a permanent element (not "project of the year"), with a multi-year plan and metrics (e.g. % of revenue from new products)?',
      'Have R&D results over the last 3 years translated into at least one new product, service, or patent?',
    ],
    example:
      'Evidence: an org structure with an R&D department. R&D budget as % of revenue over the last 3 years. A list of patents or new products linked to the R&D department.',
    suggestedTechnologies: [
      'R&D Management Platform',
      'Patent & IP Management',
      'Project Portfolio (PPM)',
    ],
  },
  '5D#6': {
    questions: [
      'Does the organization have formal external collaboration programs with universities, startups or technology partners — with contracts, budgets and timelines?',
      'Has the company launched at least one product or service resulting from such external collaboration in the last 2 years?',
      'Is the external ecosystem (partners, startups, universities) managed by a dedicated role or department?',
    ],
    example:
      'Evidence: partnership agreements with universities/startups signed in the last 2 years. A product/service with documented ties to this collaboration. An "Innovation Partnership Manager" role or equivalent in the org structure.',
    suggestedTechnologies: [
      'CRM (partner management)',
      'Partnership Platform',
      'Innovation Ecosystem Tool (Plug and Play)',
    ],
  },
};

// 5E — Resource Availability
const axis5E: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5E#1': {
    questions: [
      'Does the organization have an approved funding plan for transformation initiatives for at least 12 months ahead?',
      'Is the digitalization budget a separate line item in the financial plan (not "hidden in IT" or "whatever sales allows")?',
      'Are the budget owner and the decision-maker for its spending named individually?',
    ],
    example:
      'Evidence: a financial plan excerpt with a "digital transformation / innovation" line item for 2025, with an amount and owner. Or board minutes with an approved allocation.',
    suggestedTechnologies: [
      'ERP (Finance module)',
      'Budget Planning Tool',
      'Project Portfolio Management',
    ],
  },
  '5E#2': {
    questions: [
      'Does the organization have defined digital competency development paths per role, with a per-employee training budget?',
      'Was more than 80% of the training budget actually spent (not just "planned") in the last 12 months?',
      'Do employees have access to information about available training and can they request it themselves (even with approval)?',
    ],
    example:
      'Evidence: a catalog of training paths per role plus a Q1–Q4 2024 training expense report broken down by department. A screenshot from the training portal or LMS.',
    suggestedTechnologies: ['LMS', 'HR Training Budget Module', 'Employee Self-Service Portal'],
  },
  '5E#3': {
    questions: [
      'Has the organization identified internal or external experts ready to support digital projects, with a procedure for engaging them?',
      'In the last 12 months, was at least one external expert/consultant used in a transformation project — with a documented result?',
      'Is the list of experts (internal and external partners) kept up to date and available to project managers?',
    ],
    example:
      "Evidence: a register of internal experts and preferred external vendors with the date of the last update. An invoice or contract with a consultant from 2024/2025 plus a description of the engagement's outcome.",
    suggestedTechnologies: [
      'CRM (vendor/expert management)',
      'Procurement System',
      'Skills Directory (intranet)',
    ],
  },
  '5E#4': {
    questions: [
      'Do employees have defined rules for access to company data needed to perform their work — with specified roles and restrictions?',
      'In the last 6 months, were there no reports of "no data access" blockers delaying a digital project?',
      'Is the data access policy reviewed at least once a year and adapted to new roles?',
    ],
    example:
      'Evidence: a data access matrix broken down by role, approved and published on the intranet. An IAM/AD system report showing zero unjustified blockers in the last 6 months.',
    suggestedTechnologies: [
      'IAM (Identity & Access Management)',
      'Data Governance Platform',
      'Active Directory / Azure AD',
    ],
  },
  '5E#5': {
    questions: [
      'Do employees have access to up-to-date digital technologies necessary for their role — with a support contract and update procedure?',
      'Is the waiting time for granting a new employee access to technology/licenses ≤ 5 business days?',
      'Does the organization have a catalog of digital technologies and tools (software asset management) with license counts and owners?',
    ],
    example:
      'Evidence: a software catalog/SAM Tool with a list of tools, license counts and owners. IT onboarding metric: average time to grant access = X days (from helpdesk data).',
    suggestedTechnologies: [
      'SAM Tool (Snow Software, Flexera)',
      'ITSM Helpdesk (ServiceNow, Jira)',
      'MDM (Mobile Device Management)',
    ],
  },
  '5E#6': {
    questions: [
      'Does the organization have active business partnerships (technological, research or market) managed by a dedicated role with KPIs?',
      'Was at least one transformation project in the last 2 years carried out jointly with an external partner (startup, vendor, university) — with a contract and benefit-sharing arrangement?',
      'Is the partner ecosystem evaluated for effectiveness at least once a year?',
    ],
    example:
      'Evidence: a list of active partnership agreements with validity dates and result KPIs. Minutes of the annual partner-ecosystem review by the board. A project delivered jointly with an external partner, describing the split of investment and benefits.',
    suggestedTechnologies: [
      'CRM (partner management)',
      'Contract Management System',
      'Partnership Portal',
    ],
  },
};

// ============================================================
// AXIS 6: CYBERSECURITY (6A–6E, 6 cumulative levels)
// ============================================================

// 6A — Strategy and Risk Management
const axis6A: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6A#1': {
    questions: [
      'Does the organization NOT have any formal cybersecurity strategy or policy — i.e. incident response is purely improvised?',
      'Are IT security decisions made ad hoc, without any annual plan or approved framework?',
      'Was the cybersecurity budget spent "reactively" (only after an incident) rather than proactively in the last 12 months?',
    ],
    example:
      'Negative evidence (confirmation of absence): no security strategy document in the company\'s policy register. Or an IT audit report flagging "no security policy" as a finding.',
    suggestedTechnologies: [
      '(None — baseline level)',
      'Basic antivirus',
      'Out-of-the-box firewall',
    ],
  },
  '6A#2': {
    questions: [
      'Has the organization conducted a formal cybersecurity risk analysis in the last 12 months, with a documented risk register?',
      'Does the risk register include a threat description, likelihood, impact and risk owner — not just a "just in case" list?',
      'Were the risk analysis results discussed by the board or a security committee?',
    ],
    example:
      'Evidence: a cybersecurity risk register with a completion date, risk owners and mitigation status. Minutes of a meeting discussing the risk analysis results.',
    suggestedTechnologies: [
      'Risk Management Platform (RSA Archer)',
      'GRC Tool (ServiceNow GRC)',
      'Spreadsheet + formal framework (ISO 27005)',
    ],
  },
  '6A#3': {
    questions: [
      'Does the organization have a documented cybersecurity action plan for at least 12 months, derived from the risk analysis?',
      'Does the plan contain concrete initiatives, owners, deadlines and budgets — not just "improve security"?',
      'Is progress on the plan reported quarterly?',
    ],
    example:
      'Evidence: a "Cyber Security Action Plan 2025" approved by the board with a task list, timeline and owners. A quarterly status report.',
    suggestedTechnologies: ['Project Portfolio Management', 'GRC Platform', 'ITSM (task tracking)'],
  },
  '6A#4': {
    questions: [
      'Does the organization have implemented and approved security policies (at minimum: password policy, access policy, BYOD policy, backup policy)?',
      'Are the policies available to employees, and do employees confirm they have read them (e.g. signature or click-through in a system)?',
      'Are the policies reviewed and updated at least once a year?',
    ],
    example:
      'Evidence: a set of security policies with an approval date, last-review date, and a list of employees who accepted them (system report). Evidence of policy updates in 2024 or 2025.',
    suggestedTechnologies: ['Policy Management Platform (ConvergePoint)', 'ITSM', 'GRC Tool'],
  },
  '6A#5': {
    questions: [
      'Is HR formally involved in the cybersecurity strategy — i.e. do onboarding/offboarding processes include a security checklist, and is cyber training mandatory?',
      'Is there a procedure for immediately revoking access for a departing employee (max 24h from the termination decision)?',
      'Are per-employee security training results reported by HR to IT/Security?',
    ],
    example:
      'Evidence: an offboarding procedure with a checklist and IT sign-off confirming access revocation. A per-employee cybersecurity training report (% completion). Offboarding SLA: X hours to account deactivation.',
    suggestedTechnologies: [
      'HRIS (offboarding module)',
      'IAM (automated deprovisioning)',
      'LMS (training completion tracking)',
    ],
  },
  '6A#6': {
    questions: [
      'Does the organization conduct regular cybersecurity audits (internal or external) at least once a year, with documented findings and a remediation plan?',
      'Are audit and test results (pentests, phishing) reported to the board as a security metric?',
      'Is log and security-event analysis performed systematically, not just "after an incident"?',
    ],
    example:
      'Evidence: a pentest report with a date, scope and remediation plan signed off by the CISO/CTO. A quarterly board report with cybersecurity metrics (incident count, MTTR, training coverage).',
    suggestedTechnologies: [
      'SIEM (Splunk, QRadar, Microsoft Sentinel)',
      'Pentest Tools / External Audit',
      'Security Dashboard (GRC)',
    ],
  },
};

// 6B — Network and System Protection
const axis6B: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6B#1': {
    questions: [
      'Are managed firewalls running at the company network perimeter — not just the ones "built into the ISP router"?',
      'Are firewall rules documented and reviewed at least once a year?',
      'Does the firewall generate logs that are stored and available for analysis?',
    ],
    example:
      'Evidence: a firewall rule configuration dump with the date of the last review. Confirmation of active logging with retention ≥ 90 days.',
    suggestedTechnologies: [
      'Next-Gen Firewall (Palo Alto, Fortinet, Cisco)',
      'Firewall Log Management',
      'Network Monitoring',
    ],
  },
  '6B#2': {
    questions: [
      'Is a centrally managed antivirus/EDR solution installed on all workstations and servers, managed from one console?',
      'Are antivirus signature/database updates automatic and verified at least daily?',
      'Does the management console show real-time protection status (how many devices protected, how many alerts)?',
    ],
    example:
      'Evidence: a report from the antivirus/EDR console showing % coverage (target: 100% of devices), the last signature update date, and the number of active alerts.',
    suggestedTechnologies: [
      'EDR/Antivirus (CrowdStrike, Microsoft Defender, SentinelOne)',
      'Central Management Console',
      'Endpoint Inventory',
    ],
  },
  '6B#3': {
    questions: [
      'Is there an IDS (Intrusion Detection System) or IPS running on the network that detects traffic anomalies and threats within the network?',
      'Are IDS/IPS alerts reviewed by a human (not just ignored) at least once a day?',
      'In the last 12 months, did the IDS/IPS detect at least one event that was documented and handled?',
    ],
    example:
      'Evidence: an IDS system report from the last 30 days: number of alerts, categories, handling status. A sample incident ticket from IDS → handling → closure.',
    suggestedTechnologies: [
      'IDS/IPS (Snort, Suricata, Cisco IPS)',
      'Network Detection & Response (NDR)',
      'SIEM (alert aggregation)',
    ],
  },
  '6B#4': {
    questions: [
      'Has the organization deployed a SIEM correlating events from at least 5 different sources (firewall, AD, endpoint, servers, applications)?',
      'Does the SIEM have defined correlation rules and alerts for key attack scenarios (e.g. brute force, lateral movement, data exfiltration)?',
      'Does the SIEM generate weekly/monthly reports that are reviewed by a Security Analyst?',
    ],
    example:
      'Evidence: a list of sources feeding the SIEM (connector list) plus a sample weekly SIEM report with alerts and their status. A correlation rule for the brute-force scenario in the SIEM configuration.',
    suggestedTechnologies: [
      'SIEM (Splunk, QRadar, Microsoft Sentinel, Elastic SIEM)',
      'SOAR',
      'Threat Intelligence Platform',
    ],
  },
  '6B#5': {
    questions: [
      'Does the organization apply MFA (multi-factor authentication) for at least: VPN access, email, critical applications and admin consoles?',
      'Is access management centralized (e.g. Azure AD, Okta) with automatic provisioning/deprovisioning?',
      'Do privileged (admin) accounts follow a "least privilege" rule confirmed by a quarterly access review?',
    ],
    example:
      'Evidence: an MFA policy with a list of systems covered by the requirement, plus an IdP (Azure AD/Okta) report confirming 100% MFA coverage for privileged roles. Minutes of a quarterly admin privilege review.',
    suggestedTechnologies: [
      'MFA (Microsoft Authenticator, Duo)',
      'IAM (Azure AD, Okta, CyberArk)',
      'PAM (Privileged Access Management)',
    ],
  },
  '6B#6': {
    questions: [
      'Is the network segmented (at minimum: DMZ zone, production/OT network separated from office network, isolated guest network)?',
      'Do remote connections (remote employees, partners) go through a VPN with enforced MFA and session logging?',
      'Was a network segmentation test (e.g. a pentest) conducted in the last 12 months, confirming no unauthorized traffic between segments?',
    ],
    example:
      'Evidence: a network diagram marking zones/segments and traffic-flow rules. A pentest report on segmentation testing with a date and result. VPN logs from the last 30 days confirming MFA was required for every session.',
    suggestedTechnologies: [
      'Next-Gen Firewall (segmentation)',
      'VPN (Cisco AnyConnect, Palo Alto GlobalProtect)',
      'Network Access Control (NAC)',
      'Pentest Tools',
    ],
  },
};

// 6C — Data Security
const axis6C: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6C#1': {
    questions: [
      'Does the organization apply "at rest" data encryption for at least: laptop/workstation disks and databases containing sensitive data?',
      'Do the encryption algorithms used comply with a current standard (min. AES-256 or equivalent)?',
      'Is the encryption deployment documented (which devices, which algorithm, who manages the keys)?',
    ],
    example:
      'Evidence: an encryption policy listing covered systems and algorithms used. A report from an MDM/BitLocker tool confirming 100% disk encryption coverage for laptops.',
    suggestedTechnologies: [
      'Disk Encryption (BitLocker, FileVault)',
      'Database Encryption (TDE)',
      'Key Management Service (AWS KMS, HashiCorp Vault)',
    ],
  },
  '6C#2': {
    questions: [
      'Does the organization have a formal password policy with minimum length, complexity and rotation requirements — and is it technically enforced?',
      'Are passwords to company systems stored exclusively in hashed form (not plaintext) — confirmed by a technical audit?',
      'Does the organization use a password manager or vault for shared passwords (servers, service accounts)?',
    ],
    example:
      'Evidence: a password policy embedded in Active Directory (screenshot of settings: min 12 characters, complexity ON, 90-day expiry). A documented password vault for service accounts (e.g. CyberArk, 1Password Teams).',
    suggestedTechnologies: [
      'Active Directory / Azure AD (password policy)',
      'Password Manager (CyberArk, 1Password Teams, Bitwarden)',
      'PAM Tool',
    ],
  },
  '6C#3': {
    questions: [
      'Is data access managed through roles (RBAC) with a least-privilege principle, and is every role documented?',
      'Is an access review conducted quarterly with a documented outcome and a list of revoked permissions?',
      'Are access logs for sensitive data collected and retained for at least 90 days?',
    ],
    example:
      'Evidence: a role and permissions matrix (RBAC matrix) with the date of the last review. Q1 2025 access review minutes with a list of permission changes. Confirmation of access log retention = 90 days (configuration or SIEM report).',
    suggestedTechnologies: [
      'IAM (Role-Based Access Control)',
      'Data Access Governance (Varonis, Netwrix)',
      'SIEM (audit logging)',
    ],
  },
  '6C#4': {
    questions: [
      'Has the organization implemented regular backups of key systems with an automatic schedule and restoration tests (at least quarterly)?',
      'Is the last backup restoration test documented (date, duration, result)?',
      'Does the disaster recovery (DR) plan define RTO (Recovery Time Objective) and RPO (Recovery Point Objective) per system, and have they been verified by testing?',
    ],
    example:
      'Evidence: a backup policy with a schedule and list of covered systems. Minutes from the last DR test: date, RTO achieved X hours (target Y), RPO achieved. A screenshot from the backup system confirming the last run and verification result.',
    suggestedTechnologies: [
      'Backup Solution (Veeam, Commvault, Azure Backup)',
      'DR Platform',
      'Backup Monitoring Dashboard',
    ],
  },
  '6C#5': {
    questions: [
      'Has the organization implemented continuous monitoring of data-access anomalies (e.g. DLP, UEBA) with real-time alerts?',
      'In the last 6 months, did the detection system flag at least one suspicious event that was handled and documented?',
      'Do alerts from the data monitoring system feed into a single operations center (SOC or Security Analyst) with an SLA for response time?',
    ],
    example:
      'Evidence: a DLP/UEBA configuration with rules detecting exfiltration and anomalies. A sample incident ticket with detection and handling. Security alert SLA: P1 = 30 min, P2 = 4h.',
    suggestedTechnologies: [
      'DLP (Data Loss Prevention — Microsoft Purview, Symantec)',
      'UEBA (Splunk, Securonix)',
      'SOC Platform',
    ],
  },
  '6C#6': {
    questions: [
      'Does the organization use multi-factor identity verification for access to critical data — e.g. client certificates, hardware tokens or biometrics?',
      'Are identity verification processes (e.g. for privileged accounts or PII access) documented and audited quarterly?',
      'Has the organization implemented "Zero Trust" for data access — i.e. every access request is verified regardless of network location?',
    ],
    example:
      'Evidence: client certificate or FIDO2/YubiKey configuration for admin roles. A Zero Trust policy with a list of covered systems. A PAM Tool report showing 100% of privileged sessions recorded and identity-verified.',
    suggestedTechnologies: [
      'PKI / Certificate Management',
      'FIDO2 / YubiKey',
      'Zero Trust Network Access (Zscaler, Cloudflare Access)',
      'PAM (CyberArk)',
    ],
  },
};

// 6D — Security Education and System Quality
const axis6D: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6D#1': {
    questions: [
      'Does the organization have a documented description of its security training system — i.e. who trains, how often, from what material and in what format?',
      'Is security training mandatory for new employees as part of onboarding?',
      'Is there a security training register — a list of employees and completion dates?',
    ],
    example:
      'Evidence: an information security training policy describing scope, format and frequency. An LMS report: list of employees and completion status for onboarding training (target: 100% of new hires).',
    suggestedTechnologies: ['LMS (security training)', 'Onboarding Platform', 'HR Policy System'],
  },
  '6D#2': {
    questions: [
      'Is the training rollout plan varied in format (e-learning, in-person training, phishing simulations) and tailored to different employee groups?',
      'Is the current-year security training schedule approved and available to managers?',
      'Does the organization measure training effectiveness (e.g. a post-training knowledge test with a min. 80% score)?',
    ],
    example:
      'Evidence: a 2025 cybersecurity training plan with a schedule, formats and target groups. A report of post-training knowledge test results (% of employees scoring ≥ 80%).',
    suggestedTechnologies: [
      'Security Awareness Platform (KnowBe4, Proofpoint Security Awareness)',
      'LMS',
      'Phishing Simulation Tool',
    ],
  },
  '6D#3': {
    questions: [
      'Does the organization conduct regular security tests — e.g. phishing simulations at least 4× a year with a measured click-through rate?',
      'Are security test results (phishing click rate, knowledge test) reported to management quarterly?',
      'Must employees who "fail" a phishing test undergo additional remedial training?',
    ],
    example:
      'Evidence: a phishing campaign report (KnowBe4 or Proofpoint): date, number of recipients, % click-through (quarterly trend). A "failed phishing → mandatory retraining" policy with evidence of its application.',
    suggestedTechnologies: [
      'Phishing Simulation (KnowBe4, Proofpoint SA)',
      'Security Awareness Analytics',
      'LMS (remedial training)',
    ],
  },
  '6D#4': {
    questions: [
      'Does the organization have designated internal cybersecurity auditors (not just IT admins) with a documented scope of responsibility?',
      'Have internal auditors conducted at least one audit in the last 12 months with a written report and remediation plan?',
      'Are internal auditors independent of the units they audit (no conflict of interest)?',
    ],
    example:
      'Evidence: job descriptions or a scope of responsibilities for the internal cybersecurity auditor. A 2024/2025 internal audit report listing findings and a remediation plan. An org chart confirming reporting independence.',
    suggestedTechnologies: [
      'GRC / Audit Management Tool',
      'Internal Audit Platform (TeamMate, Auditboard)',
      'Risk Register',
    ],
  },
  '6D#5': {
    questions: [
      'Does the organization have an approved annual cybersecurity audit plan (internal and external) with dates and scopes?',
      'Is the cyber audit plan linked to the risk register (high-risk areas audited as a priority)?',
      'Are previous audit results tracked in a system, with the status of remediation plans reported to the board?',
    ],
    example:
      'Evidence: a "Cyber Audit Plan 2025" with a schedule, scope and the name of the person responsible for each audit. A recommendations-implementation tracker from previous audits — % closed on time.',
    suggestedTechnologies: ['Audit Management Tool', 'GRC Platform', 'Risk-Based Audit Scheduling'],
  },
  '6D#6': {
    questions: [
      'Does the organization hold ISO 27001 certification or is it in the process of obtaining it with a documented plan to achieve certification?',
      'Is the ISMS (Information Security Management System) maintained and continuously improved (PDCA cycle) with evidence of a management review every 12 months?',
      'Has an external auditor confirmed compliance with ISO 27001 or an equivalent standard in the last 3 years?',
    ],
    example:
      'Evidence: an ISO 27001 certificate with issue date and scope. Or an ISO 27001 implementation schedule with stages and dates. Minutes of an ISMS management review from the last 12 months.',
    suggestedTechnologies: [
      'ISMS Platform (Vanta, Drata, Tugboat Logic)',
      'ISO 27001 Gap Assessment Tool',
      'GRC (continuous compliance monitoring)',
    ],
  },
};

// 6E — Contingency Plans (Incident Response)
const axis6E: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6E#1': {
    questions: [
      'Has the organization identified threats and incident scenarios (e.g. ransomware, DDoS, data leak, critical system failure)?',
      'Is the threat list documented and linked to specific systems/processes of the organization?',
      'Was the threat identification updated in the last 12 months?',
    ],
    example:
      'Evidence: a "Threat Landscape" document or a BIA (Business Impact Analysis) chapter with a threat list, review date and owner\'s signature. A threat register in a GRC tool.',
    suggestedTechnologies: [
      'Threat Modeling Tool (STRIDE, MITRE ATT&CK)',
      'GRC / Risk Register',
      'BIA Tool',
    ],
  },
  '6E#2': {
    questions: [
      'Does the organization have defined incident-response priorities — i.e. is it clearly specified which systems/data must be restored first?',
      'Are priorities linked to system criticality for the business (BIA) and assigned RTO and RPO values?',
      'Do the owners of critical systems know their RTO/RPO and confirmed this in writing?',
    ],
    example:
      'Evidence: a BIA (Business Impact Analysis) document with a system-criticality matrix and RTO/RPO per system, approved by business owners. Example: "ERP — RTO 4h, RPO 1h; email — RTO 8h, RPO 24h". Approval date.',
    suggestedTechnologies: [
      'BIA Tool',
      'DR Planning Platform (Fusion Risk Management)',
      'CMDB (ServiceNow)',
    ],
  },
  '6E#3': {
    questions: [
      'Does the organization have documented incident-handling procedures — at least for the following scenarios: ransomware, successful phishing, critical system outage?',
      'Do the procedures define: who notifies (escalation), who decides (RACI), within what timeframe, through which channel?',
      'Are the procedures available offline (printed or on a local medium) — in case of an attack that paralyzes the network?',
    ],
    example:
      'Evidence: an "Incident Response Playbook" document with per-scenario procedures (ransomware, phishing, system outage), an approval date and confirmation of offline availability (printout or USB). A RACI for at least the ransomware scenario.',
    suggestedTechnologies: [
      'SOAR (playbooks — Palo Alto XSOAR, Splunk SOAR)',
      'Incident Management (PagerDuty, Jira)',
      'Offline documentation (PDF/USB)',
    ],
  },
  '6E#4': {
    questions: [
      'Does the organization conduct regular incident-response training — at least a tabletop exercise once a year?',
      'Do the exercises involve not only IT, but also representatives from business, legal and communications/PR?',
      'Are the exercises documented (participant list, scenario, results, lessons learned)?',
    ],
    example:
      'Evidence: minutes of a 2024/2025 tabletop exercise: scenario (e.g. "ransomware on the ERP"), participant list (IT + CEO + Legal + PR), conclusions and action items. Evidence that at least one lesson was implemented after the exercise.',
    suggestedTechnologies: [
      'Tabletop Exercise Platform (Cybereason, AttackIQ)',
      'SOAR (simulation)',
      'Learning Management System',
    ],
  },
  '6E#5': {
    questions: [
      'Has the organization conducted at least one full contingency-plan test (a full DR drill or red team exercise) in the last 12 months — with a documented result?',
      'Did the test include an actual restoration of systems from backup (not just a tabletop exercise) with a measurement of restoration time vs. RTO?',
      'Did the test results show that RTO/RPO were achieved — and if not, is there a remediation plan?',
    ],
    example:
      'Evidence: a 2024/2025 DR drill report with: scenario, date, restoration time for system X = Y hours (target: Z hours), participant list and a remediation plan for any unmet RTOs.',
    suggestedTechnologies: [
      'DR Testing Platform (Zerto, Veeam DR Orchestrator)',
      'Red Team / Pentest Tools',
      'Backup & Recovery Monitoring',
    ],
  },
  '6E#6': {
    questions: [
      'Is a formal retrospective (post-mortem) conducted after every incident (or test) with documented lessons and time-bound action items?',
      'Are incident-response procedures updated based on lessons from real incidents and tests — at least once a year?',
      'Are response-quality metrics (MTTR, MTTD, closure rate) reported to the board as a standing security KPI?',
    ],
    example:
      'Evidence: an incident post-mortem register from the last 12 months (at least 3 entries) listing lessons and the status of action-item implementation. A quarterly board report with MTTR/MTTD metrics per incident category.',
    suggestedTechnologies: [
      'Incident Management Platform (PagerDuty, Jira)',
      'Post-Mortem Tool (Blameless, Rootly)',
      'Security Metrics Dashboard (SIEM/GRC)',
    ],
  },
};

// ============================================================
// AXIS 7: AI MATURITY (7A–7E, 5 levels)
// ============================================================

// 7A — Data and AI Foundations
const axis7A: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7A#1': {
    questions: [
      'Does the data needed for the planned AI use case exist only in employee Excel spreadsheets or local files, without a single source of truth?',
      'Does preparing data for analysis require manual collection from at least 3 different systems/people and take > 1 day of work?',
      'Is the organization aware that the lack of unified data is the main barrier to AI adoption — and has this been documented (e.g. in a diagnosis, IT report)?',
    ],
    example:
      'Negative evidence (confirming level 1): results of an internal survey or interview with the data department indicating that a lack of unified data blocks AI projects. Or an IT report listing scattered data sources.',
    suggestedTechnologies: [
      '(Starting point)',
      'Data Inventory / Data Map',
      'Master Data Management (MDM) — implementation plan',
    ],
  },
  '7A#2': {
    questions: [
      'Is data in key systems (ERP, CRM, MES or equivalent) internally structured and consistent — i.e. the same codes, taxonomy, date formats?',
      'Does data transfer between systems happen through a defined export/import (even manual), rather than solely by phone or email?',
      'Has the organization identified which systems contain the data of highest value for potential AI projects?',
    ],
    example:
      'Evidence: a list of key systems with a description of data structure (table schemas or ERD). Confirmation that ERP data uses consistent customer and product codes. A system map with data flows marked (even manual ones).',
    suggestedTechnologies: [
      'ERP / CRM / MES (with a data export module)',
      'Data Dictionary',
      'ETL Tool (even basic — Talend Open Studio)',
    ],
  },
  '7A#3': {
    questions: [
      'Does the organization have a central data repository (data warehouse, data lake or cloud platform) fed automatically from at least 3 source systems?',
      'Do the first ML models or predictive projects run on data from this repository (even as a pilot)?',
      'Is data in the repository updated at least once a day without manual intervention?',
    ],
    example:
      'Evidence: a description of the data warehouse/lake architecture with a list of sources, refresh frequency, and launch date. A report from the first ML project/pilot describing input data and results.',
    suggestedTechnologies: [
      'Data Warehouse (Snowflake, BigQuery, Azure Synapse)',
      'ETL/ELT (dbt, Airbyte, Azure Data Factory)',
      'ML Platform (Azure ML, Databricks)',
    ],
  },
  '7A#4': {
    questions: [
      'Has the organization implemented data-quality management processes (data quality checks) with automatic alerting on deviations?',
      'Is data available to AI models in near real time (latency < 1 hour for key streams)?',
      'Does a data catalog document available datasets, owners and definitions — and is it actively used by data scientists?',
    ],
    example:
      'Evidence: DQ check configuration in a tool (Great Expectations, dbt tests) with a report from the last 30 days — number of checks, % passed, alerts. A data catalog (Alation, DataHub) with the number of entries and last update date.',
    suggestedTechnologies: [
      'Data Quality Tool (Great Expectations, Monte Carlo)',
      'Data Catalog (Alation, DataHub, Apache Atlas)',
      'Real-time Streaming (Kafka, Kinesis)',
    ],
  },
  '7A#5': {
    questions: [
      'Is preparing data for a new AI model (from raw data to a ready training dataset) fully automated and does it take < 1 day?',
      'Does the organization follow a "data as a product" approach — i.e. datasets have owners, availability SLAs, documentation and versioning?',
      'Do data systems autonomously detect anomalies, fill gaps and optimize flows without manual intervention?',
    ],
    example:
      'Evidence: an ML pipeline with automatic feature engineering, documented in MLflow or an equivalent tool, with metrics: time from data to a ready model = X hours. An example "data product" with an SLA and owner in the data catalog.',
    suggestedTechnologies: [
      'MLOps Platform (MLflow, Kubeflow, SageMaker)',
      'Feature Store (Feast, Tecton)',
      'DataOps Automation (Monte Carlo, Atlan)',
      'Data Product Framework',
    ],
  },
};

// 7B — AI-Supported Processes
const axis7B: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7B#1': {
    questions: [
      'Are AI use cases in the organization isolated and experimental — i.e. not embedded in any key business process?',
      "Do employees use AI tools (e.g. ChatGPT, Copilot, OCR tools) privately or without the organization's knowledge?",
      'Does the organization have no register of AI projects or AI use cases whatsoever?',
    ],
    example:
      'Negative evidence or an employee survey with the question "Do you use AI tools at work?" — a "yes, but not officially" answer from > 30% indicates level 1. No AI project register in the project management system.',
    suggestedTechnologies: [
      '(Starting point — no formal deployments)',
      'Shadow IT Discovery Tool',
      'AI Use Case Registry (plan)',
    ],
  },
  '7B#2': {
    questions: [
      'Is AI officially deployed in at least one supporting process (e.g. automatic document summarization, meeting scheduling, report generation)?',
      'Have employees using AI-assisted tools been trained and given access to licensed company tools?',
      'Is the effectiveness of AI-assisted processes measured (e.g. time saved per week per employee)?',
    ],
    example:
      'Evidence: a deployment of Microsoft Copilot or an equivalent tool with the number of users, launch date and a measured effect (e.g. "X minutes/week saved on meeting notes" — analytics report).',
    suggestedTechnologies: [
      'Microsoft Copilot / Google Duet AI',
      'Document AI (AWS Textract)',
      'Meeting Summary AI (Otter.ai, Fireflies)',
      'No-code Automation (Zapier + AI)',
    ],
  },
  '7B#3': {
    questions: [
      'Does AI provide operational recommendations (e.g. demand forecasting, credit risk scoring, maintenance action recommendation) embedded in at least one key process?',
      'Do employees make decisions based on AI recommendations, and is this documented (not just "they know the model exists")?',
      'Are the AI models providing recommendations validated and monitored (is the accuracy they operate at known)?',
    ],
    example:
      'Evidence: a screenshot from a business tool showing an AI recommendation (e.g. "Demand forecasting model: recommended order quantity X units") plus a report of decision history based on that recommendation. A model accuracy metric (accuracy/MAE).',
    suggestedTechnologies: [
      'ML Models in Production (Azure ML, SageMaker)',
      'Decision Intelligence Platform',
      'Demand Forecasting (Anaplan, O9)',
      'Predictive Maintenance (Uptake, SparkCognition)',
    ],
  },
  '7B#4': {
    questions: [
      'Does AI autonomously execute at least one element of a business process without human involvement — with a human only approving the outcome or overseeing exceptions?',
      'Is "human in the loop" defined: is it known when a human must intervene and what the response time for an exception is?',
      'Is the level of automation measured (% of cases handled automatically vs. passed to a human)?',
    ],
    example:
      'Evidence: a process description with the AI-autonomous step marked and the escalation point to a human. A report: 85% of purchase orders generated automatically, 15% passed for approval (reasons: X, Y, Z). RPA/AI workflow configuration.',
    suggestedTechnologies: [
      'RPA + AI (UiPath, Blue Prism, Automation Anywhere)',
      'Process Orchestration Platform',
      'Human-in-the-Loop Platform (Scale AI, Labelbox)',
      'BPM with AI Decision Nodes',
    ],
  },
  '7B#5': {
    questions: [
      'Do business-critical processes run in a fully autonomous mode — AI manages, optimizes and escalates exceptions without routine human involvement?',
      'Does the organization measure the effectiveness of autonomous AI processes in business terms (cost/unit, cycle time, error rate)?',
      'Is the system architecture designed so that AI can autonomously react to environmental changes (e.g. demand change → automatic plan update)?',
    ],
    example:
      'Evidence: an end-to-end process architecture description with AI orchestration (e.g. fully AI-driven production planning). A business report: "cost of running process X before AI: Y PLN/unit; after AI: Z PLN/unit" with a date. A system diagram showing a closed-loop feedback.',
    suggestedTechnologies: [
      'Autonomous Process Orchestration (Celonis)',
      'Agentic AI Frameworks (LangGraph, AutoGen)',
      'MLOps + Real-time Decision Engine',
      'Digital Twin (Siemens, ANSYS)',
    ],
  },
};

// 7C — AI in Products and Services
const axis7C: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7C#1': {
    questions: [
      "Do the organization's products or services contain no AI or predictive components at all — value comes solely from traditional features?",
      'Does the product roadmap for the next 12 months not include the rollout of any AI feature?',
      'Do customers not raise expectations regarding AI in the products (or is the organization not monitoring such signals)?',
    ],
    example:
      'Negative evidence: a 2025 product roadmap without an "AI feature" item. Customer needs survey results without a question about AI. Confirmation of no AI component in the product\'s technical architecture.',
    suggestedTechnologies: [
      '(Starting point)',
      'Product Roadmap Tool (Productboard)',
      'Customer Feedback Platform',
    ],
  },
  '7C#2': {
    questions: [
      'Does the product/service contain at least one AI component (recommendation, semantic search, sentiment analysis, chatbot) deployed in production for customers?',
      'Is the AI feature used by > 20% of active customers at least once a month?',
      'Is the business impact of the AI feature measured (e.g. increase in conversion, increase in NPS, reduction in support tickets)?',
    ],
    example:
      'Evidence: a product interface screenshot showing an AI feature (e.g. "Recommended for you"). Analytics: 35% of users use the recommendations, impact on conversion +8%. An A/B test with a date and results.',
    suggestedTechnologies: [
      'Recommendation Engine (Recombee, AWS Personalize)',
      'Semantic Search (Elastic, Pinecone)',
      'Chatbot Platform (Dialogflow, Microsoft Bot Framework)',
      'Product Analytics (Mixpanel, Amplitude)',
    ],
  },
  '7C#3': {
    questions: [
      'Is AI a key element of the product architecture — i.e. removing AI would make the main features non-functional?',
      'Does the product personalize itself for each user based on real-time data?',
      'Is AI a source of differentiation from competitors — i.e. do customers choose the product partly because of AI?',
    ],
    example:
      'Evidence: a technical architecture document with the AI component marked as central. Customer research: "Why did you choose our product?" with AI listed among the top 3 reasons. A personalization map: which UI/UX elements change per user.',
    suggestedTechnologies: [
      'Real-time ML Inference (Redis AI, TensorFlow Serving)',
      'Personalization Engine (Dynamic Yield, Braze)',
      'Feature Flags + ML (LaunchDarkly)',
      'Vector Database (Pinecone, Weaviate)',
    ],
  },
  '7C#4': {
    questions: [
      "Does AI drive the core product logic and dynamically adapt the product's behavior based on user and market data?",
      'Does the product continuously learn and improve without manual model updates by humans (continuous learning)?',
      'Do individual customers feel the product "understands" their needs and behaves differently than for other users?',
    ],
    example:
      'Evidence: a description of the continuous-learning pipeline architecture with model retraining dates and metrics (e.g. "model retrained every 7 days, accuracy rose from 78% to 84% over 6 months"). A customer case study describing personalization in action.',
    suggestedTechnologies: [
      'Online Learning / Continuous ML (River, Vowpal Wabbit)',
      'MLOps (Kubeflow, MLflow)',
      'Real-time Feature Store (Tecton)',
      'A/B Testing for ML (Optimizely)',
    ],
  },
  '7C#5': {
    questions: [
      'Does the organization offer a product or service that could not exist without AI — i.e. AI defines the entire value model?',
      "Does the company's portfolio include at least one AI-native product with revenue or savings measured on an annual scale?",
      'Does the company have a 3–5 year AI-native product roadmap, linked to strategy and resources?',
    ],
    example:
      'Evidence: a description of an AI-native product (e.g. an autonomous analytics agent, a predictive platform) with 2024/2025 revenue and a description of the business value for customers. A 2025–2028 roadmap approved by the board with AI milestones.',
    suggestedTechnologies: [
      'Agentic AI Products (LLM-based Agents)',
      'Digital Twin Platform',
      'Autonomous Analytics (ThoughtSpot, Tableau Pulse)',
      'AI Platform as a Product (custom LLM fine-tuning)',
    ],
  },
};

// 7D — Governance, Security and Ethics
const axis7D: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7D#1': {
    questions: [
      'Do employees use AI tools (ChatGPT, Copilot, Midjourney, etc.) without any company policy defining what is allowed, on what data, and with what restrictions?',
      'Is the organization unaware of which AI tools employees use and what data flows into them?',
      'Was the lack of an AI policy flagged as a risk by the legal or IT department in the last 12 months?',
    ],
    example:
      'Negative evidence: no "AI Usage Policy" document in the policy register. Or Shadow IT Discovery results pointing to unauthorized AI tools. A legal note flagging "no AI policy = GDPR/trade-secret risk".',
    suggestedTechnologies: [
      'Shadow IT Discovery (Netskope, Zscaler CASB)',
      'AI Policy Template',
      'Legal Risk Assessment Tool',
    ],
  },
  '7D#2': {
    questions: [
      'Does the organization have a documented AI usage policy — what is allowed, on what data, which tools are approved?',
      'Is the AI policy available to employees and were they informed about it (evidence of communication)?',
      'Does the policy distinguish between data categories and risk levels — i.e. customer data must not flow into external LLMs without controls?',
    ],
    example:
      'Evidence: an "AI Usage Policy" document with an approval date, a list of approved tools, and a ban on processing sensitive data in unauthorized tools. Confirmation of communication to employees (email, LMS).',
    suggestedTechnologies: [
      'Policy Management Platform',
      'LMS (AI policy training)',
      'CASB (Cloud Access Security Broker — AI tool control)',
      'AI Governance Framework (NIST AI RMF)',
    ],
  },
  '7D#3': {
    questions: [
      'Does the organization have formal AI project approval processes — with a use-case register, risk assessment and required approval before deployment?',
      'Is there a dedicated role or committee (AI Officer, AI Committee) responsible for AI governance in the company?',
      'Are AI models versioned and audited — i.e. is it known which model version is running in production and when it was last checked?',
    ],
    example:
      'Evidence: an AI project register with columns: description, risk assessment, decision-maker, approval date, status. An AI Committee charter or a description of the AI Officer role. A model repository (MLflow) with version history for production models.',
    suggestedTechnologies: [
      'AI Governance Platform (IBM OpenScale, Fiddler AI)',
      'MLflow Model Registry',
      'GRC Tool (AI risk)',
      'AI Committee Charter Template',
    ],
  },
  '7D#4': {
    questions: [
      'Are AI models in production monitored for drift (data drift, concept drift) with automatic alerts when a threshold is exceeded?',
      'Does the organization conduct regular AI model security tests (adversarial testing, prompt injection for LLMs)?',
      'Are AI models treated as critical systems — i.e. do they have availability SLAs, rollback plans and 24/7 monitoring?',
    ],
    example:
      'Evidence: model monitoring configuration in a tool (Evidently AI, Fiddler) with a sample drift alert and the action taken by the team. An LLM security test report (prompt injection test) with a date. An SLA for a predictive model in production.',
    suggestedTechnologies: [
      'ML Monitoring (Evidently AI, Whylogs, Fiddler AI)',
      'LLM Security Testing (Garak, Promptfoo)',
      'MLOps with Auto-Retrain Pipelines',
      'Model SLA & On-call Setup',
    ],
  },
  '7D#5': {
    questions: [
      'Is AI governance automated and built into the systems — i.e. it does not require manual checklists, because tools enforce policies automatically?',
      'Can the organization demonstrate AI model transparency to external auditors (decision explainability, bias documentation, AI incident register)?',
      'Does the company have a formal AI ethics board or documented responsible-AI principles with measurable commitments and an annual report?',
    ],
    example:
      'Evidence: an AI Transparency Report for 2024/2025 with sections on: explainability, bias, incidents, governance. Automatic guardrails in modeling pipelines (e.g. automatic fairness checks before deployment). Composition and mandate of an AI Ethics Board.',
    suggestedTechnologies: [
      'Responsible AI Platform (Azure AI Fairness, IBM AI Fairness 360)',
      'LLM Guardrails (Guardrails.ai, NVIDIA NeMo Guardrails)',
      'Explainability Tool (SHAP, LIME)',
      'AI Ethics Board Governance Framework',
    ],
  },
};

// 7E — AI Competencies and Culture
const axis7E: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7E#1': {
    questions: [
      'Have most employees (> 70%) never used AI tools at work and are unaware of AI possibilities in their area?',
      'Does the organization run no AI training and have no plan to build AI competencies?',
      'Does the word "AI" at meetings mostly provoke skepticism or concern — not curiosity?',
    ],
    example:
      'Evidence: employee survey results with the question "Do you use AI at work?" — < 20% answering "yes". No "AI training" item in the 2025 HR plan. Sentiment survey results: AI associated with "job threat" by > 50% of respondents.',
    suggestedTechnologies: [
      'Employee Survey Tool',
      'Skills Assessment Platform',
      '(competency-building plan)',
    ],
  },
  '7E#2': {
    questions: [
      'Do at least 10–20% of employees use AI tools on their own (not necessarily officially) and experiment with them?',
      'Is there at least one person in the company (an informal "AI enthusiast") known as the go-to person for AI questions — even without an official role?',
      'Has the organization started documenting AI use cases found by employees, even informally?',
    ],
    example:
      'Evidence: a list of "AI champions" or AI enthusiasts identified by HR in the last 6 months. Or survey results: 15% of employees report regular AI use without company training. An internal post/presentation about an employee\'s AI application.',
    suggestedTechnologies: [
      'Microsoft Copilot (pilot)',
      'ChatGPT / Claude (personal use)',
      'AI Community Platform (Slack channel, Teams)',
    ],
  },
  '7E#3': {
    questions: [
      'Does the organization run a structured AI training program for employees — with a curriculum, schedule and a designated "AI Champion" role per department?',
      'Are the first successful AI projects documented and communicated internally as proof of real benefits?',
      'Have at least 40% of employees completed basic AI training in the last 12 months (confirmed by an LMS report)?',
    ],
    example:
      'Evidence: a 2025 AI training program (curriculum: AI Basics → Prompt Engineering → AI in My Role) with a schedule and a completion rate = 45% after 6 months (LMS report). Case study: "How the sales department saved 3h/week using AI".',
    suggestedTechnologies: [
      'AI Training Platform (Coursera for Business, DataCamp)',
      'LMS (training tracking)',
      'AI Champions Program Framework',
      'Microsoft Copilot Adoption Kit',
    ],
  },
  '7E#4': {
    questions: [
      'Do employees build simple automations and AI workflows on their own (e.g. in Microsoft Power Automate + Copilot, Zapier + GPT) without IT support?',
      'Is upskilling in AI built into the work routine (e.g. a "learning sprint" once a month, internal AI webinars)?',
      'Do at least 60% of employees report that AI helps them work faster or better (pulse survey)?',
    ],
    example:
      'Evidence: a gallery of internal AI automations created by employees (number, types of processes). An "AI Adoption Survey" report: 65% of employees use AI daily, 60% report a positive impact on efficiency. An "AI Day" agenda or a monthly AI webinar with attendance figures.',
    suggestedTechnologies: [
      'Microsoft Power Automate + Copilot',
      'Zapier + AI Actions',
      'Low-code AI Tools (Bubble AI, Glide)',
      'AI Adoption Analytics (Microsoft Viva Insights)',
    ],
  },
  '7E#5': {
    questions: [
      'Do employees manage AI agents that carry out operational tasks — i.e. tasks are delegated to AI, with the employee overseeing results and handling exceptions?',
      'Does the organization measure "AI ROI" per role or department (time saved, errors eliminated, revenue generated by AI)?',
      'Are new employees immediately onboarded to working with AI as a standard — not as an option?',
    ],
    example:
      'Evidence: an example of an AI agent managing a process (e.g. an order-handling agent) describing the employee\'s role as supervisor, not executor. An "AI ROI 2025" report: department X saved Y PLN thanks to AI. A new-employee onboarding checklist with an "AI agent configuration" item.',
    suggestedTechnologies: [
      'Agentic AI Platforms (Microsoft Copilot Studio, Salesforce Agentforce)',
      'AI ROI Measurement (Viva Insights, custom analytics)',
      'AI-first Onboarding Program',
      'Multi-agent Orchestration (LangGraph, AutoGen)',
    ],
  },
};

// ============================================================
// EXPORT — FULL OVERRIDES FOR AXES 5–7 (EN)
// ============================================================

export const DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7_EN: Partial<
  Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>
> = {
  ...axis5A,
  ...axis5B,
  ...axis5C,
  ...axis5D,
  ...axis5E,
  ...axis6A,
  ...axis6B,
  ...axis6C,
  ...axis6D,
  ...axis6E,
  ...axis7A,
  ...axis7B,
  ...axis7C,
  ...axis7D,
  ...axis7E,
};
