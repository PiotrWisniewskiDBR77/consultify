#!/usr/bin/env tsx
/**
 * Seed: APLIX North America organization + access code + interview packs
 *
 * Creates or updates:
 * 1. APLIX Inc. - North America organization
 * 2. Piotr as temporary OWNER/admin sponsor for setup
 * 3. Paid/manual billing posture with explicit 30-user limit
 * 4. Access code + registration link for self-registration
 * 5. Organization-scoped interview templates in English for APLIX
 *
 * Usage:
 *   SEED_MODE=production \
 *   SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION \
 *   DATABASE_PUBLIC_URL=... \
 *   npx tsx server/scripts/seed-aplix-organization.ts
 */

import crypto from 'crypto';

import dotenv from 'dotenv';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE, override: true });
}

const ORG_ID = process.env.SEED_ORG_ID || 'aplix-na';
const ORG_NAME = process.env.SEED_ORG_NAME || 'APLIX Inc. - North America';
const ORG_PLAN = 'enterprise';
const ORG_DOMAIN = 'aplix.com';
const ORG_INDUSTRY = 'manufacturing';
const PROFILE_ID = `${ORG_ID}-profile`;
const BASE_URL = (process.env.SEED_BASE_URL || process.env.APP_URL || 'https://consultify.ai').replace(
  /\/+$/,
  ''
);

const ADMIN_EMAIL = process.env.APLIX_ADMIN_EMAIL || 'piotr.wisniewski@dbr77.com';

const ACCESS_CODE = process.env.APLIX_ACCESS_CODE || 'APLIX-2026';
const ACCESS_CODE_MAX_USES = parseInt(process.env.APLIX_ACCESS_CODE_MAX_USES || '30', 10);
const ACCESS_CODE_EXPIRES =
  process.env.APLIX_ACCESS_CODE_EXPIRES || '2026-06-30T23:59:59.000Z';

const PUBLIC_SOURCE = 'https://aplix.com/en/group/about-us';
const PUBLIC_FACTS = {
  website: 'https://aplix.com',
  source: PUBLIC_SOURCE,
  foundedYear: 1958,
  headquartersCountry: 'France',
  headquartersRole: 'Group headquarters',
  northAmericaSite: 'Charlotte, North Carolina, USA',
  northAmericaRole: 'North America HQ + production site',
  revenueApprox: '193M EUR',
  associatesWorldwide: '957',
  productionSites: 5,
  marketPosition: 'Global hook-and-loop fastener specialist',
  products: [
    'Industrial hook-and-loop fastening systems',
    'Closure systems',
    'Technical tapes',
    'Plastic hooks',
    'Nonwoven and lightweight loops',
    'Converted fastening solutions',
  ],
  markets: [
    'Personal care / hygiene',
    'Automotive',
    'Aircraft / aerospace',
    'Healthcare / medical',
    'Construction',
    'Packaging',
  ],
  capabilities: [
    'Extrusion',
    'Weaving',
    'Knitting',
    'Texturing',
    'Coating',
    'Lamination',
    'Converting',
    'Plastic injection',
  ],
};

const BRANDING_SETTINGS = {
  description:
    'APLIX North America combines regional commercial leadership with a production site serving industrial fastening and closure applications.',
  industry: 'Industrial manufacturing',
  companySize: '900+ global associates',
  website: 'https://aplix.com',
  defaultLanguage: 'en',
  currency: 'USD',
};

const PROFILE = {
  industry: 'Manufacturing',
  industrySubsector: 'Industrial fastening systems',
  companySize: 'ENTERPRISE',
  employeeCount: 957,
  foundingYear: 1958,
  headquartersCountry: 'France',
  strategicPriorities: [
    'Protect quality and delivery performance for regulated and high-spec industrial customers',
    'Improve plant visibility, responsiveness, and throughput in North America',
    'Accelerate data-driven decision making across production, quality, planning, and customer-facing teams',
    'Scale innovation in sustainable fastening materials and customer-specific solutions',
  ],
  competitivePosition: 'LEADER',
  growthStage: 'MATURE',
  missionStatement:
    'Deliver high-value fastening and closure solutions through industrial know-how, quality discipline, and customer-specific innovation.',
  visionStatement:
    'Run a globally coordinated and regionally responsive fastening platform with strong manufacturing execution, engineering depth, and data-supported decisions.',
  primaryMarkets: ['North America', 'Europe', 'China', 'Brazil'],
  customerSegments: ['B2B', 'OEMs', 'Converters', 'Industrial manufacturers', 'Personal care producers'],
  regulatoryEnvironment: [
    'Industrial product quality requirements',
    'Automotive quality expectations',
    'Material compliance requirements',
    'Environmental and sustainability requirements',
  ],
  riskAppetite: 'MODERATE',
  preferredLanguage: 'en',
  communicationStyle: 'PROFESSIONAL',
  industryJargonLevel: 'HIGH',
  profileCompleteness: 92,
};

type TemplateQuestion = {
  id: string;
  category: 'strategy' | 'operations' | 'digital' | 'people' | 'finance';
  questionText: string;
  description?: string;
  evidencePrompt?: string;
  answerType?: string;
  expectedAnswerShape?: string;
};

type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  audience: string;
  estimatedTimeMinutes: number;
  areaTags: string[];
  questions: TemplateQuestion[];
};

type QuestionSeed = {
  category: TemplateQuestion['category'];
  questionText: string;
  description?: string;
  evidencePrompt?: string;
};

const DEFAULT_EXPECTED_ANSWER_SHAPE =
  'Answer with observable facts. Include examples, KPIs, systems, ownership, frequency, and current constraints whenever possible.';

const defaultEvidencePrompt =
  'Reference the metric, report, system, board, standard, meeting ritual, or recent example that best supports your answer.';

function q(
  category: TemplateQuestion['category'],
  questionText: string,
  description?: string,
  evidencePrompt?: string
): QuestionSeed {
  return { category, questionText, description, evidencePrompt };
}

function buildQuestions(items: QuestionSeed[]): TemplateQuestion[] {
  return items.map((item, index) => ({
    id: `q${String(index + 1).padStart(2, '0')}`,
    category: item.category,
    questionText: item.questionText,
    description: item.description,
    evidencePrompt: item.evidencePrompt || defaultEvidencePrompt,
    answerType: 'long_text',
    expectedAnswerShape: DEFAULT_EXPECTED_ANSWER_SHAPE,
  }));
}

const TEMPLATES: Template[] = [
  {
    id: 'aplix_global_all_v1',
    name: 'APLIX Global - All Respondents',
    description:
      'Common baseline pack for all APLIX interview participants. It aligns language, pain points, and improvement hypotheses before deeper process interviews.',
    category: 'GLOBAL',
    audience: 'All interview participants across HQ, plant, and support functions',
    estimatedTimeMinutes: 18,
    areaTags: ['strategy', 'operations', 'digital', 'people', 'finance'],
    questions: buildQuestions([
      q(
        'operations',
        'What are the three biggest operational problems you face today, and how do they affect delivery, quality, cost, or customer response?',
        'Focus on the issues that most often create firefighting or management escalation.'
      ),
      q(
        'operations',
        'Where do you lose the most time during a normal week, and what usually causes that loss?',
        'Think about waiting, rework, handoffs, searching for information, approvals, or unplanned disruptions.'
      ),
      q(
        'strategy',
        'Which decisions are hardest to make quickly and confidently, and what information is missing when those decisions are needed?'
      ),
      q(
        'digital',
        'What important data do you wish you had in real time, but today it is delayed, incomplete, or manually assembled?'
      ),
      q(
        'people',
        'What frustrates your team most in day-to-day work, and why has it been hard to remove that friction?'
      ),
      q(
        'operations',
        'Where do mistakes, rework, or repeated clarifications happen most often across teams or shifts?'
      ),
      q(
        'strategy',
        'If you could improve only one process in the next quarter, which process would you choose and what business result should improve first?'
      ),
      q(
        'people',
        'What slows your team down the most: unclear priorities, weak systems, handoffs, lack of skills, or resistance to change?',
        'Explain which factor matters most and why.'
      ),
      q(
        'finance',
        'How do you currently know whether your work was successful: which measures, signals, or outcomes are actually used?'
      ),
      q(
        'strategy',
        'What would a near-perfect day at work look like for your function, with fewer delays and better decisions?',
        'Describe the operating conditions, information flow, and behaviors that would need to exist.'
      ),
    ]),
  },
  {
    id: 'aplix_plant_charlotte_v1',
    name: 'APLIX Plant - Charlotte Leadership',
    description:
      'Plant-level pack for the Charlotte site. It focuses on manufacturing execution, reliability, quality responsiveness, and visibility across the operating floor.',
    category: 'PLANT',
    audience: 'Plant leadership, operations leadership, plant management',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'digital', 'finance', 'people', 'data'],
    questions: buildQuestions([
      q(
        'finance',
        'Which KPIs matter most for the Charlotte site today, and which of them are stable versus frequently off target?',
        'Include metrics such as throughput, scrap, downtime, service, OEE, or customer-facing performance if relevant.'
      ),
      q(
        'operations',
        'Where is the current biggest plant bottleneck, and how does that bottleneck cascade into schedule, quality, or customer impact?'
      ),
      q(
        'digital',
        'How is plant performance tracked today: which signals come directly from systems or machines, and which still rely on manual reporting or spreadsheets?'
      ),
      q(
        'operations',
        'How often do you face unplanned downtime, and which asset, process step, or support function causes the most disruption?'
      ),
      q(
        'operations',
        'What is the main source of quality issues at the plant today, and how visible is that problem during the shift rather than after the fact?'
      ),
      q(
        'people',
        'How quickly can the plant react when a problem appears on the floor, and where does escalation or decision latency slow that response down?'
      ),
      q(
        'strategy',
        'How do you prioritize improvement initiatives when several problems compete for the same engineering, quality, or maintenance capacity?'
      ),
      q(
        'digital',
        'What percentage of important plant decisions is based on trusted data versus local experience, and where is that balance still too subjective?'
      ),
      q(
        'digital',
        'How visible is real-time production status by line, shift, order, and quality condition for plant leadership today?'
      ),
      q(
        'finance',
        'What is the single biggest operational risk for the Charlotte site in the next 6-12 months if nothing changes?'
      ),
    ]),
  },
  {
    id: 'aplix_hq_na_v1',
    name: 'APLIX HQ - North America Leadership',
    description:
      'North America HQ pack for leaders who manage plant performance, commercial priorities, customer responsiveness, and transformation decisions.',
    category: 'HQ',
    audience: 'North America leadership, regional management, business unit leadership',
    estimatedTimeMinutes: 20,
    areaTags: ['strategy', 'operations', 'digital', 'people', 'finance'],
    questions: buildQuestions([
      q(
        'strategy',
        'What are the top three priorities for APLIX North America over the next 12 months, and why are those priorities most urgent now?'
      ),
      q(
        'finance',
        'How do you currently define success for transformation or operational-improvement efforts in North America?',
        'Include the outcomes management actually reviews, not only the ones formally declared.'
      ),
      q(
        'people',
        'Where is alignment strongest and weakest between regional leadership, the Charlotte plant, and global group expectations?'
      ),
      q(
        'digital',
        'What is your working definition of digital transformation for this business, and which outcomes should it improve first?'
      ),
      q(
        'operations',
        'Where do you see the biggest inefficiencies across plant, sales, engineering, customer support, and supply chain handoffs?'
      ),
      q(
        'finance',
        'How do you prioritize investments between capacity, quality, systems, people development, and customer-facing responsiveness?'
      ),
      q(
        'people',
        'What is your approach to culture and change management when a process or system needs to work differently across teams?'
      ),
      q(
        'finance',
        'How do you evaluate ROI for operational or digital initiatives today, and where is that logic still too weak or too slow?'
      ),
      q(
        'digital',
        'Which data sets are most important for leadership decisions, and where are trust, timeliness, or comparability still a problem?'
      ),
      q(
        'strategy',
        'If the North America business were clearly winning 12 months from now, what would be visibly different in plant performance, customer service, and decision quality?'
      ),
    ]),
  },
  {
    id: 'aplix_process_extrusion_v1',
    name: 'APLIX Process - Extrusion and Polymer Preparation',
    description:
      'Detailed pack for extrusion and upstream material preparation, focused on stability, yield, downtime, and process control.',
    category: 'PROCESS_EXTRUSION',
    audience: 'Production managers, line leaders, process engineers, supervisors',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'data', 'compliance'],
    questions: buildQuestions([
      q(
        'operations',
        'How stable is the extrusion process today across product families, shifts, and material conditions, and where does instability show up first?'
      ),
      q(
        'operations',
        'What are the main causes of reduced throughput, speed loss, or short stops in extrusion?'
      ),
      q(
        'digital',
        'Which key process parameters are captured automatically, and which critical signals still depend on operator notes or local files?'
      ),
      q(
        'operations',
        'Where do start-up losses, scrap, or material waste occur most often during changeovers or restarts?'
      ),
      q(
        'finance',
        'Which process losses in extrusion have the biggest cost impact today: material waste, energy, downtime, labor, or missed schedule?'
      ),
      q(
        'people',
        'How consistently do operators react to process deviations, and where do standards, training, or escalation rules remain unclear?'
      ),
      q(
        'digital',
        'How visible is root-cause information after an extrusion issue, and can the team connect quality loss to the exact process conditions that produced it?'
      ),
      q(
        'operations',
        'How are recipes, settings, and best-known conditions managed today, and where does the process still rely too much on tribal knowledge?'
      ),
      q(
        'strategy',
        'What would have the biggest impact on extrusion performance first: better process control, stronger maintenance, faster analysis, or more disciplined standards?'
      ),
      q(
        'digital',
        'If you could add one digital capability to the extrusion process, what should it be and what problem would it solve first?'
      ),
    ]),
  },
  {
    id: 'aplix_process_forming_v1',
    name: 'APLIX Process - Weaving and Hook/Loop Forming',
    description:
      'Detailed pack for hook/loop structure creation, weaving, and forming operations, focused on repeatability, product integrity, and process variation.',
    category: 'PROCESS_FORMING',
    audience: 'Manufacturing, process engineering, operations excellence',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'data', 'compliance'],
    questions: buildQuestions([
      q(
        'operations',
        'Which steps in weaving or hook/loop forming create the most variability in product performance today?'
      ),
      q(
        'operations',
        'What defects or deviations are most common in this process, and when are they usually detected?'
      ),
      q(
        'digital',
        'Which machine, recipe, or quality parameters are tracked in a structured way, and which ones remain hard to compare over time?'
      ),
      q(
        'people',
        'Where do teams rely on operator judgment instead of clear standards to decide whether the process is under control?'
      ),
      q(
        'finance',
        'What are the biggest cost drivers in this process when performance slips: scrap, speed loss, changeovers, complaints, or rework?'
      ),
      q(
        'operations',
        'How do product mix and customer-specific requirements complicate process stability in forming operations?'
      ),
      q(
        'digital',
        'How easy is it today to link a customer issue back to the exact batch, run, machine state, or process window that produced it?'
      ),
      q(
        'operations',
        'What are the main setup or transition losses between runs, and how are they reduced today?'
      ),
      q(
        'strategy',
        'Which improvements would create the biggest gain first: standard work, automation, inline sensing, better traceability, or stronger engineering support?'
      ),
      q(
        'digital',
        'What data or analytics would make this process significantly easier to stabilize and improve?'
      ),
    ]),
  },
  {
    id: 'aplix_process_converting_v1',
    name: 'APLIX Process - Lamination, Cutting, and Converting',
    description:
      'Detailed pack for downstream converting activities, including lamination, cutting, customization, and order-specific finishing.',
    category: 'PROCESS_CONVERTING',
    audience: 'Operations, converting teams, planners, industrial engineering',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'delivery', 'data'],
    questions: buildQuestions([
      q(
        'operations',
        'Which converting steps create the most delay or variation today: lamination, cutting, slitting, packaging, or special finishing?'
      ),
      q(
        'operations',
        'Where do product customization requirements create the greatest complexity for planning, setups, or execution?'
      ),
      q(
        'digital',
        'How do teams currently know which job, specification, tooling, and quality requirement is correct for each order?'
      ),
      q(
        'operations',
        'What are the most common causes of rework or scrap in converting, and how quickly are they contained?'
      ),
      q(
        'finance',
        'Where does converting inefficiency hit cost or margin most strongly: changeovers, labor intensity, material loss, or missed delivery?'
      ),
      q(
        'people',
        'How well do planning, production, quality, and warehouse teams coordinate when priorities change during the day?'
      ),
      q(
        'digital',
        'How visible is WIP, queue length, and order status for converting operations in real time?'
      ),
      q(
        'operations',
        'Which constraints most often prevent smooth flow in converting: tooling, staffing, material availability, paperwork, or schedule changes?'
      ),
      q(
        'strategy',
        'If you redesigned this process first, what part would you simplify or standardize to improve speed and predictability?'
      ),
      q(
        'digital',
        'What digital workflow, automation, or alerting capability would eliminate the most avoidable noise in converting?'
      ),
    ]),
  },
  {
    id: 'aplix_process_quality_v1',
    name: 'APLIX Process - Quality and Testing',
    description:
      'Detailed pack for quality management, laboratory testing, product release, and root-cause discipline in high-spec markets.',
    category: 'PROCESS_QUALITY',
    audience: 'Quality leadership, lab teams, quality engineers, customer quality',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'compliance', 'data'],
    questions: buildQuestions([
      q(
        'operations',
        'What are the main defect modes or quality escapes today, and where in the end-to-end process do they originate most often?'
      ),
      q(
        'operations',
        'Which tests or inspections are truly critical for customer risk, and where do they become a throughput bottleneck?'
      ),
      q(
        'digital',
        'How is quality data collected, stored, and reviewed today, and where does manual handling still create delay or loss of traceability?'
      ),
      q(
        'finance',
        'How much rework, scrap, premium effort, or customer risk is created by quality issues, and which category hurts most?'
      ),
      q(
        'people',
        'How quickly do production, engineering, and quality teams align on containment and root cause when a serious issue appears?'
      ),
      q(
        'operations',
        'Where does release timing slow production or shipping, and what conditions create that delay?'
      ),
      q(
        'digital',
        'How easy is it to trace a complaint or failed result back to material, machine, run conditions, operator actions, and prior signals?'
      ),
      q(
        'operations',
        'How systematically are recurring quality issues prevented from returning, and where does the loop still fail?'
      ),
      q(
        'strategy',
        'Which quality problem should be attacked first because it would release the most capacity, confidence, or customer value?'
      ),
      q(
        'digital',
        'What analytical, workflow, or AI support would help the quality function move faster without reducing control?'
      ),
    ]),
  },
  {
    id: 'aplix_process_maintenance_v1',
    name: 'APLIX Process - Maintenance and Reliability',
    description:
      'Detailed pack for asset reliability, work management, spare parts, and breakdown response.',
    category: 'PROCESS_MAINTENANCE',
    audience: 'Maintenance leadership, reliability engineers, supervisors, technicians',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'data', 'it'],
    questions: buildQuestions([
      q(
        'operations',
        'What share of maintenance work is planned versus reactive today, and what prevents you from shifting that balance further toward planned work?'
      ),
      q(
        'operations',
        'Which machines or subsystems fail most often, and what operational impact do those failures create?'
      ),
      q(
        'digital',
        'How are breakdowns, interventions, causes, and spare-part consumption tracked today, and where is the data incomplete or inconsistent?'
      ),
      q(
        'finance',
        'What reliability losses cost the business most today: downtime, overtime, parts, scrap, service disruption, or quality instability?'
      ),
      q(
        'people',
        'How well do operators and maintenance teams communicate early warning signs before failures become urgent events?'
      ),
      q(
        'operations',
        'How do you prioritize maintenance work when preventive tasks, breakdowns, and improvement jobs compete at the same time?'
      ),
      q(
        'digital',
        'Which reliability metrics do you trust today, such as MTBF, MTTR, or recurring failure patterns, and which ones are weak?'
      ),
      q(
        'operations',
        'Where do spare parts, technical documentation, or specialist skills most often delay recovery from a breakdown?'
      ),
      q(
        'strategy',
        'What reliability improvement would create the biggest operational gain first for the Charlotte plant?'
      ),
      q(
        'digital',
        'What predictive, analytical, or workflow capability would most improve maintenance effectiveness without adding administrative burden?'
      ),
    ]),
  },
  {
    id: 'aplix_process_planning_v1',
    name: 'APLIX Process - Planning and Scheduling',
    description:
      'Detailed pack for demand translation, finite scheduling, change management, and rescheduling pressure.',
    category: 'PROCESS_PLANNING',
    audience: 'Planning, scheduling, operations management, customer coordination',
    estimatedTimeMinutes: 20,
    areaTags: ['operations', 'delivery', 'data'],
    questions: buildQuestions([
      q(
        'operations',
        'How is the production schedule built today, and which inputs are most unstable or hardest to trust?'
      ),
      q(
        'operations',
        'How often do plans change after release, and what are the most common triggers for replanning?'
      ),
      q(
        'digital',
        'Which systems support planning today, and where do planners still rely on spreadsheets, emails, or manual adjustments?'
      ),
      q(
        'finance',
        'What is the biggest business cost of planning instability today: inventory, missed service, expediting, overtime, or low asset utilization?'
      ),
      q(
        'people',
        'Where do planning priorities conflict most with production, sales, quality, or customer service expectations?'
      ),
      q(
        'operations',
        'How do you balance product mix, setup loss, customer urgency, and capacity constraints when trade-offs are needed?'
      ),
      q(
        'digital',
        'How visible is the impact of a schedule change across material, quality, labor, and customer commitments?'
      ),
      q(
        'operations',
        'Which part of the current planning process consumes the most manual effort without adding much decision value?'
      ),
      q(
        'strategy',
        'If you could redesign one planning rule, meeting, or workflow, which one would improve predictability fastest?'
      ),
      q(
        'digital',
        'What decision-support capability would make planners more proactive instead of reactive?'
      ),
    ]),
  },
  {
    id: 'aplix_process_supply_chain_v1',
    name: 'APLIX Process - Supply Chain and Logistics',
    description:
      'Detailed pack for sourcing, inventory, warehouse flow, shipping, and customer delivery reliability.',
    category: 'PROCESS_SUPPLY_CHAIN',
    audience: 'Supply chain, procurement, warehousing, logistics, customer service',
    estimatedTimeMinutes: 20,
    areaTags: ['delivery', 'operations', 'data'],
    questions: buildQuestions([
      q(
        'operations',
        'Where are the biggest delays or surprises in the material-to-customer flow today, from inbound supply through shipping?'
      ),
      q(
        'operations',
        'Which shortages, late materials, or internal availability issues disrupt the plant most often?'
      ),
      q(
        'digital',
        'How accurate and timely is inventory visibility across raw material, WIP, finished goods, and customer allocations?'
      ),
      q(
        'finance',
        'Where do logistics or inventory decisions create the highest avoidable cost today: premium freight, excess stock, obsolescence, or service recovery?'
      ),
      q(
        'people',
        'Which handoffs between procurement, planning, warehouse, production, and customer-facing teams create the most misunderstanding or rework?'
      ),
      q(
        'operations',
        'How are urgent orders or exceptions handled, and what makes those cases harder than they should be?'
      ),
      q(
        'digital',
        'How integrated are supplier, ERP, warehouse, and shipment signals today, and where are the biggest blind spots?'
      ),
      q(
        'operations',
        'What physical-flow or information-flow bottlenecks occur most often inside the site or between the site and customers?'
      ),
      q(
        'strategy',
        'Which supply-chain change would improve delivery reliability the fastest without creating a large cost penalty?'
      ),
      q(
        'digital',
        'What digital alerting, visibility, or exception-management capability would reduce firefighting the most?'
      ),
    ]),
  },
  {
    id: 'aplix_process_sales_cs_v1',
    name: 'APLIX Process - Sales and B2B Customer Support',
    description:
      'Detailed pack for project-based selling, customer requests, order quality, and commercial-to-operational handoffs.',
    category: 'PROCESS_SALES_CS',
    audience: 'Sales, customer support, account management, commercial operations',
    estimatedTimeMinutes: 20,
    areaTags: ['sales', 'customer-service', 'operations'],
    questions: buildQuestions([
      q(
        'operations',
        'What are the main stages from customer request to confirmed order today, and where do deals or service requests slow down most?'
      ),
      q(
        'finance',
        'Which parts of quoting, pricing, sample requests, or special-offer preparation consume the most effort today?'
      ),
      q(
        'digital',
        'How well do CRM, ERP, product data, availability, and customer-history information work together for the commercial team?'
      ),
      q(
        'people',
        'Where do sales and customer-support teams struggle most in handoffs with planning, quality, engineering, or production?'
      ),
      q(
        'operations',
        'What customer questions or internal requests are highly repetitive and should be standardized or automated?'
      ),
      q(
        'finance',
        'Where is margin or service performance lost because order details arrive incomplete, late, or unclear?'
      ),
      q(
        'digital',
        'How quickly can the commercial team answer a customer with reliable information on technical fit, lead time, quality status, or order progress?'
      ),
      q(
        'strategy',
        'Which commercial process change would create the biggest improvement in win rate, response speed, or customer confidence?'
      ),
      q(
        'people',
        'How well do teams capture and reuse lessons from complaints, urgent requests, and difficult customer cases?'
      ),
      q(
        'digital',
        'What AI or workflow support would make commercial and support work noticeably faster without increasing customer risk?'
      ),
    ]),
  },
  {
    id: 'aplix_process_rnd_v1',
    name: 'APLIX Process - R&D and Engineering',
    description:
      'Detailed pack for product development, customization, technical support, and industrialization handoffs.',
    category: 'PROCESS_RND',
    audience: 'R&D, application engineering, product management, technical support',
    estimatedTimeMinutes: 20,
    areaTags: ['strategy', 'operations', 'data'],
    questions: buildQuestions([
      q(
        'strategy',
        'What are the most important innovation or engineering priorities for North America today, and how do they connect to business growth?'
      ),
      q(
        'operations',
        'Where does the path from customer need or product idea to tested industrial solution slow down most?'
      ),
      q(
        'people',
        'Which handoffs between engineering, sales, quality, and production create the most misunderstanding or rework?'
      ),
      q(
        'digital',
        'How easy is it for engineers to find prior designs, test results, customer context, material constraints, and lessons learned?'
      ),
      q(
        'operations',
        'What types of rework happen most often in development or industrialization: incomplete requirements, redesign, retesting, or change requests?'
      ),
      q(
        'finance',
        'Which engineering delays create the greatest cost or revenue impact for the business today?'
      ),
      q(
        'digital',
        'How connected are product data, test data, customer specifications, and manufacturing constraints in the current toolchain?'
      ),
      q(
        'operations',
        'What part of validation, approval, or documentation is the biggest bottleneck for engineering throughput today?'
      ),
      q(
        'strategy',
        'What engineering capability would most increase speed and reuse without reducing technical rigor?'
      ),
      q(
        'digital',
        'What digital assistant, search, or knowledge-reuse capability would create the biggest benefit for engineering teams first?'
      ),
    ]),
  },
  {
    id: 'aplix_process_data_v1',
    name: 'APLIX Process - Data, Systems, and Reporting',
    description:
      'Detailed pack for core systems, reporting architecture, data ownership, and trust in decision-support information.',
    category: 'PROCESS_DATA',
    audience: 'IT, digital, analytics, business systems owners, operations leaders',
    estimatedTimeMinutes: 20,
    areaTags: ['digital', 'data', 'it'],
    questions: buildQuestions([
      q(
        'digital',
        'Which systems are most important for running the North America business today, and where are their boundaries still unclear or overlapping?'
      ),
      q(
        'digital',
        'What critical data is collected automatically, and what still depends on spreadsheets, emails, or local manual inputs?'
      ),
      q(
        'digital',
        'Which data sets are least trusted today, and why: accuracy, timeliness, definitions, ownership, or access?'
      ),
      q(
        'people',
        'Who owns the quality and meaning of the most important operational data, and where is that ownership still ambiguous?'
      ),
      q(
        'finance',
        'What is the business cost of poor data visibility today: slow decisions, duplicate work, weak prioritization, missed service, or hidden losses?'
      ),
      q(
        'digital',
        'Where do teams spend the most time manually preparing reports or reconciling different versions of the truth?'
      ),
      q(
        'digital',
        'How integrated are shop-floor signals, ERP, quality records, and customer-facing information in the current setup?'
      ),
      q(
        'strategy',
        'What reporting or analytical view would most improve executive and plant-level decisions if it became consistently trusted?'
      ),
      q(
        'people',
        'What skills, governance, or routines are missing today to turn data into better operational decisions?'
      ),
      q(
        'digital',
        'If you could automate one reporting or data workflow first, which one would return the biggest practical benefit?'
      ),
    ]),
  },
  {
    id: 'aplix_process_people_v1',
    name: 'APLIX Process - People, Training, and Change',
    description:
      'Detailed pack for organization design, skills, training discipline, and readiness for process change.',
    category: 'PROCESS_PEOPLE',
    audience: 'HR, plant leadership, line managers, transformation leaders',
    estimatedTimeMinutes: 20,
    areaTags: ['people', 'hr', 'operations'],
    questions: buildQuestions([
      q(
        'people',
        'How clearly are responsibilities defined across plant operations, support functions, and regional leadership today?'
      ),
      q(
        'people',
        'Where do communication gaps appear most often during escalation, shift handover, or cross-functional coordination?'
      ),
      q(
        'people',
        'What skills are most difficult to build or retain in this site and business, and what impact does that gap create?'
      ),
      q(
        'people',
        'How effective is current training for operators, supervisors, and specialists when a standard, system, or process changes?'
      ),
      q(
        'operations',
        'Where do recurring process issues reflect behavior or capability problems rather than purely technical ones?'
      ),
      q(
        'people',
        'How open are teams to digital or process change today, and what kind of resistance appears most often?'
      ),
      q(
        'finance',
        'What is the cost of weak role clarity, training gaps, or poor change adoption in terms of productivity, quality, or retention?'
      ),
      q(
        'people',
        'How do managers reinforce continuous improvement today, and where does the message break down between intent and daily behavior?'
      ),
      q(
        'strategy',
        'What organizational change would most improve execution speed or decision quality at APLIX North America?'
      ),
      q(
        'digital',
        'What digital support would best help teams adopt new standards, solve problems faster, or capture know-how more reliably?'
      ),
    ]),
  },
  {
    id: 'aplix_process_ci_v1',
    name: 'APLIX Process - Continuous Improvement and Transformation',
    description:
      'Detailed pack for improvement pipeline, prioritization discipline, benefits tracking, and change execution.',
    category: 'PROCESS_CI',
    audience: 'Continuous improvement, operations excellence, leadership sponsors',
    estimatedTimeMinutes: 20,
    areaTags: ['strategy', 'operations', 'pmo'],
    questions: buildQuestions([
      q(
        'operations',
        'How are improvement opportunities identified today, and which problems consistently fail to enter a structured improvement pipeline?'
      ),
      q(
        'strategy',
        'How are improvement initiatives prioritized when quality, productivity, customer, and digital topics all compete for the same attention?'
      ),
      q(
        'people',
        'Who owns improvement outcomes in practice, and where does accountability weaken after initial kickoff?'
      ),
      q(
        'finance',
        'How are benefits defined and tracked today, and which types of gains are hardest to prove or sustain?'
      ),
      q(
        'operations',
        'What slows implementation most: lack of capacity, weak problem definition, local resistance, unclear sponsorship, or competing priorities?'
      ),
      q(
        'digital',
        'How visible is the current portfolio of active improvements, decisions, blockers, and realized results?'
      ),
      q(
        'people',
        'How effectively are lessons from completed projects reused elsewhere in the plant or region?'
      ),
      q(
        'finance',
        'Which category of improvement would pay back fastest right now: quality, throughput, planning, customer responsiveness, or data visibility?'
      ),
      q(
        'strategy',
        'What would a stronger transformation operating model look like for APLIX North America over the next 12 months?'
      ),
      q(
        'digital',
        'What workflow, decision-support, or AI capability would most strengthen improvement execution and follow-through?'
      ),
    ]),
  },
];

function nowIso() {
  return new Date().toISOString();
}

function requireProductionConfirmation() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (mode !== 'production') {
    throw new Error(`Refusing to run: set SEED_MODE=production (current: "${mode || '(empty)'}")`);
  }
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error(
      'Refusing to run without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION'
    );
  }
}

async function upsertInterviewTemplates(
  db: {
    run: (sql: string, params?: unknown[]) => Promise<unknown>;
  },
  targetOrganizationId: string,
  createdByUserId: string
) {
  for (const template of TEMPLATES) {
    const templateRecordId = `${targetOrganizationId}__${template.id}`;

    await db.run(
      `INSERT INTO interview_library_templates
       (id, organization_id, name, description, category, status, visibility, template_scope, audience, estimated_time_minutes, runtime_mode_default, answer_design_guide, area_tags, is_default, version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', 'org', 'organization', $6, $7, 'one_question_per_screen', $8, $9, 0, 1, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         status = 'approved',
         visibility = 'org',
         template_scope = 'organization',
         audience = EXCLUDED.audience,
         estimated_time_minutes = EXCLUDED.estimated_time_minutes,
         runtime_mode_default = EXCLUDED.runtime_mode_default,
         answer_design_guide = EXCLUDED.answer_design_guide,
         area_tags = EXCLUDED.area_tags,
         is_default = 0,
         version = 1,
         created_by = EXCLUDED.created_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        templateRecordId,
        targetOrganizationId,
        template.name,
        template.description,
        template.category,
        template.audience,
        template.estimatedTimeMinutes,
        'Focus on operating facts, constraints, handoffs, process losses, and concrete opportunities to improve visibility, quality, flow, and decision making.',
        JSON.stringify(template.areaTags),
        createdByUserId,
      ]
    );

    for (const [index, question] of template.questions.entries()) {
      const questionRecordId = `${templateRecordId}_${question.id}`;

      await db.run(
        `INSERT INTO interview_library_template_questions
         (id, template_id, category, question_text, description, evidence_prompt, answer_type, answer_options, expected_answer_shape, is_required, allow_voice, allow_file_upload, allow_url, allow_context_note, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '[]', $8, 1, 1, 1, 1, 1, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           template_id = EXCLUDED.template_id,
           category = EXCLUDED.category,
           question_text = EXCLUDED.question_text,
           description = EXCLUDED.description,
           evidence_prompt = EXCLUDED.evidence_prompt,
           answer_type = EXCLUDED.answer_type,
           answer_options = EXCLUDED.answer_options,
           expected_answer_shape = EXCLUDED.expected_answer_shape,
           is_required = EXCLUDED.is_required,
           allow_voice = EXCLUDED.allow_voice,
           allow_file_upload = EXCLUDED.allow_file_upload,
           allow_url = EXCLUDED.allow_url,
           allow_context_note = EXCLUDED.allow_context_note,
           sort_order = EXCLUDED.sort_order`,
        [
          questionRecordId,
          templateRecordId,
          question.category,
          question.questionText,
          question.description || null,
          question.evidencePrompt || null,
          question.answerType || 'long_text',
          question.expectedAnswerShape || DEFAULT_EXPECTED_ANSWER_SHAPE,
          (index + 1) * 10,
        ]
      );
    }
  }
}

async function upsertOrganizationLimits(db: {
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
}) {
  const schema = await db.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organization_limits'`
  );
  const columns = new Set((schema.rows || []).map((row) => String(row.column_name || '').trim()));

  if (columns.has('max_users')) {
    await db.run(
      `INSERT INTO organization_limits
         (id, organization_id, max_projects, max_users, max_ai_calls_per_day, max_initiatives, max_storage_mb, max_total_tokens, ai_roles_enabled_json)
       VALUES
         ($1, $2, 100, $3, 100000, 1000, 102400, 100000000, $4)
       ON CONFLICT (organization_id) DO UPDATE SET
         max_projects = EXCLUDED.max_projects,
         max_users = EXCLUDED.max_users,
         max_ai_calls_per_day = EXCLUDED.max_ai_calls_per_day,
         max_initiatives = EXCLUDED.max_initiatives,
         max_storage_mb = EXCLUDED.max_storage_mb,
         max_total_tokens = EXCLUDED.max_total_tokens,
         ai_roles_enabled_json = EXCLUDED.ai_roles_enabled_json`,
      [crypto.randomUUID(), ORG_ID, ACCESS_CODE_MAX_USES, '["ADVISOR","EXECUTOR","RESEARCHER"]']
    );
    return;
  }

  if (columns.has('limit_type') && columns.has('limit_value')) {
    await db.run(
      `INSERT INTO organization_limits
         (id, organization_id, limit_type, limit_value, current_usage, created_at, updated_at)
       VALUES
         ($1, $2, 'max_users', $3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id) DO UPDATE SET
         limit_type = 'max_users',
         limit_value = EXCLUDED.limit_value,
         updated_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), ORG_ID, ACCESS_CODE_MAX_USES]
    );
    return;
  }

  throw new Error('Unsupported organization_limits schema');
}

async function getTableColumns(
  db: {
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
  },
  tableName: string
): Promise<Set<string>> {
  const schema = await db.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set((schema.rows || []).map((row) => String(row.column_name || '').trim()));
}

async function upsertOrganizationRecord(
  db: {
    run: (sql: string, params?: unknown[]) => Promise<unknown>;
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
  },
  adminId: string
) {
  const columns = await getTableColumns(db, 'organizations');
  const attrs = JSON.stringify({
    source: 'public_company_profile',
    publicProfile: PUBLIC_FACTS,
    orgProfileType: 'OPERATING',
    country: 'US',
    siteRole: 'North America HQ + production',
  });

  const entries: Array<[string, unknown]> = [
    ['id', ORG_ID],
    ['name', ORG_NAME],
    ['status', 'active'],
    ['plan', ORG_PLAN],
    ['billing_status', 'ACTIVE'],
    ['organization_type', 'PAID'],
    ['is_active', 1],
    ['industry', ORG_INDUSTRY],
    ['domain', ORG_DOMAIN],
    ['default_language', 'en'],
    ['attribution_data', attrs],
    ['onboarding_status', 'ORG_SETUP_COMPLETED'],
    ['created_by_user_id', adminId],
    ['updated_at', nowIso()],
    ['default_locale', 'en'],
    ['enabled_locales', JSON.stringify(['en'])],
    ['billing_currency', 'USD'],
    ['billing_country', 'US'],
    ['owner_id', adminId],
  ].filter(([column]) => columns.has(column));

  const insertColumns = entries.map(([column]) => column);
  const params = entries.map(([, value]) => value);
  const updateColumns = insertColumns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`);

  await db.run(
    `INSERT INTO organizations (${insertColumns.join(', ')})
     VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(', ')})
     ON CONFLICT (id) DO UPDATE SET
       ${updateColumns.join(', ')}`,
    params
  );
}

async function upsertOrganizationBillingRecord(
  db: {
    run: (sql: string, params?: unknown[]) => Promise<unknown>;
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
  }
) {
  const columns = await getTableColumns(db, 'organization_billing');
  if (columns.size === 0) return;

  const now = nowIso();
  const entries: Array<[string, unknown]> = [
    ['id', crypto.randomUUID()],
    ['organization_id', ORG_ID],
    ['status', 'active'],
    ['created_at', now],
    ['updated_at', now],
  ].filter(([column]) => columns.has(column));

  const insertColumns = entries.map(([column]) => column);
  const params = entries.map(([, value]) => value);
  const updateColumns = insertColumns
    .filter((column) => !['id', 'organization_id', 'created_at'].includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`);

  if (updateColumns.length === 0) {
    return;
  }

  await db.run(
    `INSERT INTO organization_billing (${insertColumns.join(', ')})
     VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(', ')})
     ON CONFLICT (organization_id) DO UPDATE SET
       ${updateColumns.join(', ')}`,
    params
  );
}

async function main() {
  requireProductionConfirmation();

  const target = resolveScriptDatabaseTarget({
    label: 'seed-aplix-organization',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('seed-aplix-organization', target);
  process.env.DATABASE_URL = target.connectionString;

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const adminRow = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
    [ADMIN_EMAIL.toLowerCase()]
  );
  const adminId = adminRow.rows?.[0]?.id;

  if (!adminId) {
    throw new Error(`Admin user not found for ${ADMIN_EMAIL}`);
  }

  await upsertOrganizationRecord(db, adminId);

  await db.run(
    `INSERT INTO organization_profiles (
       id,
       organization_id,
       industry,
       industry_subsector,
       company_size,
       employee_count,
       founding_year,
       headquarters_country,
       strategic_priorities,
       competitive_position,
       growth_stage,
       mission_statement,
       vision_statement,
       primary_markets,
       customer_segments,
       regulatory_environment,
       risk_appetite,
       preferred_language,
       communication_style,
       industry_jargon_level,
       profile_completeness,
       created_by,
       updated_by
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
       $21, $22, $23
     )
     ON CONFLICT (organization_id) DO UPDATE SET
       industry = EXCLUDED.industry,
       industry_subsector = EXCLUDED.industry_subsector,
       company_size = EXCLUDED.company_size,
       employee_count = EXCLUDED.employee_count,
       founding_year = EXCLUDED.founding_year,
       headquarters_country = EXCLUDED.headquarters_country,
       strategic_priorities = EXCLUDED.strategic_priorities,
       competitive_position = EXCLUDED.competitive_position,
       growth_stage = EXCLUDED.growth_stage,
       mission_statement = EXCLUDED.mission_statement,
       vision_statement = EXCLUDED.vision_statement,
       primary_markets = EXCLUDED.primary_markets,
       customer_segments = EXCLUDED.customer_segments,
       regulatory_environment = EXCLUDED.regulatory_environment,
       risk_appetite = EXCLUDED.risk_appetite,
       preferred_language = EXCLUDED.preferred_language,
       communication_style = EXCLUDED.communication_style,
       industry_jargon_level = EXCLUDED.industry_jargon_level,
       profile_completeness = EXCLUDED.profile_completeness,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [
      PROFILE_ID,
      ORG_ID,
      PROFILE.industry,
      PROFILE.industrySubsector,
      PROFILE.companySize,
      PROFILE.employeeCount,
      PROFILE.foundingYear,
      PROFILE.headquartersCountry,
      JSON.stringify(PROFILE.strategicPriorities),
      PROFILE.competitivePosition,
      PROFILE.growthStage,
      PROFILE.missionStatement,
      PROFILE.visionStatement,
      JSON.stringify(PROFILE.primaryMarkets),
      JSON.stringify(PROFILE.customerSegments),
      JSON.stringify(PROFILE.regulatoryEnvironment),
      PROFILE.riskAppetite,
      PROFILE.preferredLanguage,
      PROFILE.communicationStyle,
      PROFILE.industryJargonLevel,
      PROFILE.profileCompleteness,
      ADMIN_EMAIL,
      ADMIN_EMAIL,
    ]
  );

  await db.run(
    `INSERT INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
     VALUES ($1, 'branding', $2, CURRENT_TIMESTAMP)
     ON CONFLICT (organization_id, setting_key) DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       updated_at = CURRENT_TIMESTAMP`,
    [ORG_ID, JSON.stringify(BRANDING_SETTINGS)]
  );

  await db.run(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
    [crypto.randomUUID(), ORG_ID, adminId, nowIso()]
  );

  await upsertOrganizationBillingRecord(db);

  await upsertOrganizationLimits(db);

  const existingCode = await db.query<{ id: string }>(
    `SELECT id FROM access_codes WHERE code = $1 LIMIT 1`,
    [ACCESS_CODE]
  );

  if (existingCode.rows?.[0]?.id) {
    await db.run(
      `UPDATE access_codes
       SET organization_id = $1,
           created_by = $2,
           role = 'PROJECT_MANAGER',
           max_uses = $3,
           current_uses = 0,
           expires_at = $4,
           is_active = 1
       WHERE id = $5`,
      [ORG_ID, adminId, ACCESS_CODE_MAX_USES, ACCESS_CODE_EXPIRES, existingCode.rows[0].id]
    );
  } else {
    await db.run(
      `INSERT INTO access_codes
       (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'PROJECT_MANAGER', $5, 0, $6, 1, $7)`,
      [`aplix_code_${crypto.randomUUID()}`, ORG_ID, ACCESS_CODE, adminId, ACCESS_CODE_MAX_USES, ACCESS_CODE_EXPIRES, nowIso()]
    );
  }

  await upsertInterviewTemplates(db, ORG_ID, adminId);

  const registrationLink = `${BASE_URL}/register?invite=${encodeURIComponent(ACCESS_CODE)}`;
  const totalQuestions = TEMPLATES.reduce((sum, template) => sum + template.questions.length, 0);

  logger.info('[seed-aplix] ✅ APLIX setup complete', {
    organization: {
      id: ORG_ID,
      name: ORG_NAME,
      plan: ORG_PLAN,
      domain: ORG_DOMAIN,
      type: 'PAID',
    },
    accessCode: {
      code: ACCESS_CODE,
      maxUses: ACCESS_CODE_MAX_USES,
      expires: ACCESS_CODE_EXPIRES,
      registrationLink,
    },
    interviewTemplates: {
      count: TEMPLATES.length,
      totalQuestions,
      names: TEMPLATES.map((template) => template.name),
    },
  });

  // eslint-disable-next-line no-console
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  // eslint-disable-next-line no-console
  console.log('║                  APLIX North America – Setup Complete               ║');
  // eslint-disable-next-line no-console
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  // eslint-disable-next-line no-console
  console.log(`║  Organization: ${ORG_NAME} (${ORG_ID})`);
  // eslint-disable-next-line no-console
  console.log(`║  Sponsor/Admin: ${ADMIN_EMAIL}`);
  // eslint-disable-next-line no-console
  console.log(`║  Access Code: ${ACCESS_CODE} (${ACCESS_CODE_MAX_USES} uses)`);
  // eslint-disable-next-line no-console
  console.log(`║  Register: ${registrationLink}`);
  // eslint-disable-next-line no-console
  console.log(`║  Templates: ${TEMPLATES.length} packs / ${totalQuestions} questions`);
  // eslint-disable-next-line no-console
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[seed-aplix] Failed:', error);
  process.exit(1);
});
