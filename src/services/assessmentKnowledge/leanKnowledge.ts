/**
 * Lean 4.0 Knowledge Base (DBR77)
 *
 * Coach questions, evidence guidance, micro-lessons, and common mistakes
 * for each phase (MEASURE/OPTIMIZE/AUTOMATE) and dimension (PROCESSES/WORKSTATIONS).
 */
import type { DBR77Dimension, DBR77Phase, WasteType } from '../dbr77LeanStructure';

export type LeanLevelKnowledge = {
  coachQuestions: [string, string, string];
  evidenceGuidance: string;
  microLesson: string;
  commonMistakes: string[];
};

export type LeanWasteKnowledge = {
  whatToLookFor: string[];
  typicalEvidence: string[];
  coachQuestions: string[];
};

export const LEAN_LEVEL_MEANINGS: Record<
  number,
  { title: string; meaning: string; evidencePattern: string }
> = {
  1: {
    title: 'Ad-hoc',
    meaning:
      'No standardized approach. Processes are inconsistent, undocumented, and depend on individual knowledge.',
    evidencePattern:
      'No SOPs, no visual management boards, high variation in cycle times, tribal knowledge only.',
  },
  2: {
    title: 'Defined',
    meaning:
      'Basic standards exist and are documented. Some awareness of Lean principles but execution is inconsistent.',
    evidencePattern:
      'SOPs exist but may not be followed consistently. Basic 5S started. Some KPI tracking (manual).',
  },
  3: {
    title: 'Managed',
    meaning:
      'Lean tools are deployed systematically. Flow and pull concepts are understood and partially implemented.',
    evidencePattern:
      '5S audit scores improving. Kanban in place for key flows. Regular gemba walks. Visual management boards active.',
  },
  4: {
    title: 'Optimized',
    meaning:
      'Lean is embedded in daily operations. Continuous flow is achieved in key value streams. Data-driven decisions.',
    evidencePattern:
      'OEE tracked in real-time. A3 problem-solving routine. Hoshin planning. Cross-functional improvement teams.',
  },
  5: {
    title: 'World-class',
    meaning:
      'Lean excellence with Industry 4.0 integration. Self-optimizing systems. Innovation is systematic.',
    evidencePattern:
      'Digital Lean (IoT+Lean). Predictive maintenance. Autonomous quality. Innovation pipeline documented.',
  },
};

type PhaseKey = `${DBR77Phase}#${DBR77Dimension}`;

const PHASE_KNOWLEDGE: Record<PhaseKey, Record<number, LeanLevelKnowledge>> = {
  'MEASURE#PROCESSES': {
    1: {
      coachQuestions: [
        'Can you describe the end-to-end flow of this process from trigger to completion?',
        'How do you currently track cycle time, lead time, and throughput?',
        'Where does work-in-progress accumulate and why?',
      ],
      evidenceGuidance:
        'Look for process maps, time observation sheets, WIP counts at different stations. If none exist, that confirms Level 1.',
      microLesson:
        'Measuring is the foundation. Without baseline data, any improvement is guesswork. Start with: cycle time, lead time, and WIP count.',
      commonMistakes: [
        'Relying on "average" times from ERP instead of actual gemba observations.',
        'Measuring only the value-adding steps and ignoring wait times and transport.',
        'Not distinguishing between cycle time and lead time.',
      ],
    },
    2: {
      coachQuestions: [
        'Are time studies done at the workstation or estimated from historical data?',
        'How often do you update your process metrics?',
        'What is the ratio of value-added to non-value-added time?',
      ],
      evidenceGuidance:
        'Check for documented time studies, basic value stream maps, standard work combination sheets. Verify they are recent (< 6 months).',
      microLesson:
        'Value-Added Ratio (VAR) is powerful. In most manufacturing, only 5-15% of lead time is value-adding. Knowing your VAR focuses improvement efforts.',
      commonMistakes: [
        'Using theoretical capacity instead of actual measured throughput.',
        'Not including changeover time and rework in cycle time calculations.',
        'Treating one-time measurements as representative of normal operations.',
      ],
    },
    3: {
      coachQuestions: [
        'Do you have a current-state value stream map? When was it last updated?',
        'How is OEE calculated and what are the main losses?',
        'Can you show me the flow of information alongside the material flow?',
      ],
      evidenceGuidance:
        'Look for current-state VSM with data boxes, OEE breakdown (Availability × Performance × Quality), spaghetti diagrams.',
      microLesson:
        'OEE is the single best metric for equipment effectiveness: Availability × Performance × Quality. World-class is 85%+. Most plants start at 40-60%.',
      commonMistakes: [
        'Creating beautiful VSMs that sit on the wall unused.',
        'Calculating OEE without separating the three components.',
        'Not walking the process (gemba) before drawing the VSM.',
      ],
    },
    4: {
      coachQuestions: [
        'How do you detect and respond to abnormalities in real-time?',
        'What is your first-pass yield across the entire value stream?',
        'How does process data feed into your improvement prioritization?',
      ],
      evidenceGuidance:
        'Look for real-time andon systems, statistical process control charts, automated data collection, and future-state VSM.',
      microLesson:
        'At Level 4, measurement shifts from periodic to continuous. Real-time visibility enables proactive management.',
      commonMistakes: [
        'Collecting data without acting on signals.',
        'Over-engineering measurement systems before stabilizing basic processes.',
        'Not validating automated measurements against manual observations.',
      ],
    },
    5: {
      coachQuestions: [
        'How does your measurement system predict failures before they occur?',
        'What percentage of adjustments are made automatically vs. manually?',
        'How do you benchmark against industry best-in-class?',
      ],
      evidenceGuidance:
        'Look for predictive analytics dashboards, digital twins, autonomous adjustment systems, and benchmark comparisons.',
      microLesson:
        'World-class measurement integrates Lean with Industry 4.0: IoT sensors feed AI models that predict and prevent waste.',
      commonMistakes: [
        "Technology for technology's sake — ensure digital tools solve real Lean problems.",
        'Losing the gemba mindset when moving to digital.',
        'Not maintaining human capability to intervene when systems fail.',
      ],
    },
  },
  'MEASURE#WORKSTATIONS': {
    1: {
      coachQuestions: [
        'How many distinct tasks does this role perform in a typical shift?',
        'What tools and systems does this person use throughout the day?',
        'How would you describe a "good day" vs. a "bad day" at this workstation?',
      ],
      evidenceGuidance:
        'Observe the workstation for at least 30 minutes. Note task variety, interruptions, waiting time, and tool switches.',
      microLesson:
        'Workstation analysis starts with observation, not interviews. Watch what people actually do — this is the gemba principle.',
      commonMistakes: [
        'Asking the operator to self-report times instead of observing directly.',
        'Only measuring productive tasks and ignoring setup, cleanup, and admin.',
        'Not accounting for interruptions and context-switching costs.',
      ],
    },
    2: {
      coachQuestions: [
        'Is there a skill matrix for this workstation?',
        'What is the error rate and what are the most common error types?',
        'How much overtime is required and what drives it?',
      ],
      evidenceGuidance:
        'Check for documented task lists, skill matrices, error logs/quality records, and overtime tracking.',
      microLesson:
        "Cross-training coverage is a leading indicator of resilience. If only one person can do a critical task, that's a single point of failure.",
      commonMistakes: [
        'Assuming high utilization means high productivity.',
        'Not distinguishing between operator errors and system-caused errors.',
        'Measuring satisfaction without connecting it to workstation design.',
      ],
    },
    3: {
      coachQuestions: [
        "What percentage of this role's time is spent on value-adding activities?",
        'Are there documented standard work procedures?',
        'How does the operator signal problems and get help?',
      ],
      evidenceGuidance:
        'Look for time-motion study results, standardized work sheets, andon/help signal mechanisms.',
      microLesson:
        'Standard work is the current best-known way to do a task. It is the baseline from which kaizen begins.',
      commonMistakes: [
        'Treating standard work as permanent.',
        'Writing standards without operator input.',
        'Not auditing whether standards are actually followed.',
      ],
    },
    4: {
      coachQuestions: [
        'How are workload imbalances detected and resolved?',
        'What improvement activities involve frontline operators?',
        'How is digital technology augmenting operator capabilities?',
      ],
      evidenceGuidance:
        'Look for balanced workload charts (yamazumi), kaizen event records, and digital tools assisting operators.',
      microLesson: 'At Level 4, the operator becomes a problem-solver, not just a task-executor.',
      commonMistakes: [
        'Optimizing individual workstations without balancing across the value stream.',
        'Implementing technology that deskills operators.',
        'Not measuring human factors: ergonomics, cognitive load, satisfaction.',
      ],
    },
    5: {
      coachQuestions: [
        'How does the workstation adapt autonomously to changing conditions?',
        'What role evolution path exists for operators?',
        'How do you maintain human expertise alongside automated systems?',
      ],
      evidenceGuidance:
        'Look for role evolution plans, retraining programs, human-machine collaboration metrics.',
      microLesson:
        'World-class workstations combine human creativity with machine precision. The goal is not to eliminate people but to eliminate waste.',
      commonMistakes: [
        'Automating without a role evolution plan.',
        'Not measuring the total system performance (human + machine).',
        'Forgetting that the most flexible "automation" is a well-trained human.',
      ],
    },
  },
  'OPTIMIZE#PROCESSES': {
    1: {
      coachQuestions: [
        'Have you identified the top 3 wastes in this process?',
        'Is there a 5S baseline assessment?',
        'What is the biggest bottleneck in the current flow?',
      ],
      evidenceGuidance:
        'Check for waste walk reports, 5S audit scores, and bottleneck identification.',
      microLesson: 'Before optimizing, you must see the waste. TIMWOODS is your checklist.',
      commonMistakes: [
        'Jumping to solutions before understanding the current state.',
        'Trying to optimize everything at once instead of focusing on the constraint.',
        'Confusing activity with progress.',
      ],
    },
    2: {
      coachQuestions: [
        'Which Lean tools have been applied and what results did they achieve?',
        'Is there a pull system or is production still push-based?',
        'How is changeover time being reduced?',
      ],
      evidenceGuidance:
        'Look for SMED records, kanban boards, 5S sustainability audits, and before/after metrics.',
      microLesson:
        'Quick changeover (SMED) often delivers the biggest early wins. Reducing setup time enables smaller batches and better flow.',
      commonMistakes: [
        'Implementing kanban without stabilizing the upstream process first.',
        'Doing 5S as a one-time event instead of sustaining it.',
        'Setting arbitrary targets instead of using takt time to pace production.',
      ],
    },
    3: {
      coachQuestions: [
        'How close is actual flow to theoretical one-piece flow?',
        'What is your total productive maintenance (TPM) maturity?',
        'How do you handle quality at the source vs. end-of-line inspection?',
      ],
      evidenceGuidance:
        'Look for flow analysis, TPM autonomous maintenance records, poka-yoke devices, and quality metrics.',
      microLesson:
        'Continuous flow is the ideal. Each step in flow reduces lead time and exposes problems.',
      commonMistakes: [
        'Implementing flow without leveling demand (heijunka).',
        'Treating TPM as a maintenance program instead of an operator-driven practice.',
        'Relying on inspection instead of building quality into the process (jidoka).',
      ],
    },
    4: {
      coachQuestions: [
        'How is the improvement backlog prioritized?',
        'What is your kaizen event cadence and results?',
        'How do improvements cascade from value stream to workstation level?',
      ],
      evidenceGuidance:
        'Look for hoshin kanri, A3 reports, and trend charts showing sustained gains.',
      microLesson:
        'At Level 4, Lean is how you manage. Hoshin kanri ensures alignment from boardroom to shop floor.',
      commonMistakes: [
        'Kaizen events without follow-through.',
        'Top-down hoshin without catchball alignment.',
        'Celebrating effort instead of results.',
      ],
    },
    5: {
      coachQuestions: [
        'How does your Lean system self-correct when performance degrades?',
        'What innovations have emerged from frontline activities?',
        'How do you share best practices across value streams?',
      ],
      evidenceGuidance:
        'Look for innovation pipeline, cross-site yokoten, and adaptive management systems.',
      microLesson:
        'World-class Lean organizations create a "learning factory" where every problem is a learning opportunity.',
      commonMistakes: [
        'Complacency after achieving good results.',
        'Over-standardizing to the point where innovation is stifled.',
        'Not connecting Lean operational excellence to digital transformation.',
      ],
    },
  },
  'OPTIMIZE#WORKSTATIONS': {
    1: {
      coachQuestions: [
        'Is the workstation organized (5S)?',
        'Are the most common tasks documented as standard work?',
        'What are the top 3 frustrations the operator experiences daily?',
      ],
      evidenceGuidance:
        'Walk to the workstation and observe: is it clean, organized, labeled? Are tools within reach?',
      microLesson:
        '5S at the workstation creates a workplace where problems are visible instantly and waste cannot hide.',
      commonMistakes: [
        'Doing 5S as a cleaning exercise.',
        'Organizing without operator input.',
        'Not connecting 5S to performance metrics.',
      ],
    },
    2: {
      coachQuestions: [
        'How is the operator involved in improving their workstation?',
        'Are there visual work instructions at point-of-use?',
        'How is workload balanced across the shift?',
      ],
      evidenceGuidance:
        'Check for visual work instructions, operator improvement records, and workload charts.',
      microLesson:
        'Respect for people is a Lean pillar. The operator knows their workstation best.',
      commonMistakes: [
        'Writing work instructions without observing actual work.',
        'Overloading high-performers instead of leveling.',
        'Not asking operators what they would change.',
      ],
    },
    3: {
      coachQuestions: [
        'Is cross-training systematically planned?',
        'How are abnormalities handled — clear escalation?',
        'What coaching does the team leader provide daily?',
      ],
      evidenceGuidance:
        'Look for skill matrix with dates, escalation procedures, and leader standard work.',
      microLesson:
        'The team leader is the most important Lean role. Without effective team leaders, Lean fails.',
      commonMistakes: [
        'Treating skill matrix as HR paperwork.',
        'Team leaders spending time on reports instead of the shop floor.',
        'Escalation too slow — problems must surface in minutes.',
      ],
    },
    4: {
      coachQuestions: [
        'How do operators contribute to kaizen?',
        'What is the suggestion system implementation rate?',
        'How is ergonomic risk assessed?',
      ],
      evidenceGuidance: 'Look for kaizen board, implementation rate > 50%, ergonomic assessments.',
      microLesson:
        'Toyota achieves 90%+ implementation rate. The secret: small improvements operators can implement themselves.',
      commonMistakes: [
        'Suggestion systems where ideas go into a black hole.',
        'Ignoring ergonomics until injuries occur.',
        'Measuring suggestions submitted instead of implemented.',
      ],
    },
    5: {
      coachQuestions: [
        'How are operators prepared for evolving roles?',
        'What innovation capabilities exist at workstation level?',
        'How is human-machine collaboration optimized?',
      ],
      evidenceGuidance: 'Look for role evolution plans, reskilling programs, innovation records.',
      microLesson:
        'The future workstation is a human-machine team. Operator focuses on judgment and creativity.',
      commonMistakes: [
        'Automating away jobs without a transition plan.',
        'Not investing in operator digital skills.',
        'Designing automation that removes operator from the information loop.',
      ],
    },
  },
  'AUTOMATE#PROCESSES': {
    1: {
      coachQuestions: [
        'Which process steps are most repetitive and rules-based?',
        'Where do manual handoffs create delays or errors?',
        'What data is collected that could feed automation?',
      ],
      evidenceGuidance:
        'Map each step: manual vs. semi-automated vs. fully automated. Identify data sources. Quantify error rates.',
      microLesson:
        'Automate the boring, repetitive, error-prone AFTER Lean optimization. Never automate a wasteful process — you get faster waste.',
      commonMistakes: [
        'Automating before standardizing with Lean.',
        'Starting with the most complex automation.',
        'Not calculating total cost of ownership.',
      ],
    },
    2: {
      coachQuestions: [
        'What is the feasibility score for each opportunity?',
        'How will automated and manual steps coexist?',
        'What is the expected ROI?',
      ],
      evidenceGuidance:
        'Check for feasibility assessments, ROI calculations, and a prioritized list of candidates.',
      microLesson:
        'Use the Automation Feasibility Matrix: plot on Complexity vs. Impact. Start bottom-right: high impact, low complexity.',
      commonMistakes: [
        'Chasing the latest technology instead of matching to the problem.',
        'Underestimating integration complexity.',
        'Not involving operations in technology selection.',
      ],
    },
    3: {
      coachQuestions: [
        'Is there a clear automation roadmap with dependencies?',
        'How will you maintain the process if automation fails?',
        'What change management is needed?',
      ],
      evidenceGuidance:
        'Look for phased automation roadmap, fallback procedures, change management plan, and pilot results.',
      microLesson:
        'Every automation needs a manual fallback plan. If the robot breaks at 3 AM, can you still ship?',
      commonMistakes: [
        'No rollback plan.',
        'Automating only the happy path.',
        'Ignoring change management.',
      ],
    },
    4: {
      coachQuestions: [
        'How is automation performance monitored?',
        'What AI/ML capabilities add intelligence?',
        'How do you measure human-automation system performance?',
      ],
      evidenceGuidance:
        'Look for automation KPIs (uptime, throughput, quality), AI/ML in production, improvement documentation.',
      microLesson:
        'Automation maturity is about continuous learning. AI models need retraining, robots need optimization.',
      commonMistakes: [
        'Set-and-forget mentality.',
        'Not measuring the total system.',
        'Deploying AI without understanding failure modes.',
      ],
    },
    5: {
      coachQuestions: [
        'How do systems self-optimize based on real-time data?',
        'What is your strategy for emerging technologies?',
        'How do you balance automation with human capability?',
      ],
      evidenceGuidance:
        'Look for self-optimizing systems, digital twins, and a technology roadmap integrated with strategy.',
      microLesson:
        'The ultimate goal is the right balance of human judgment and machine precision.',
      commonMistakes: [
        'Pursuing lights-out without considering flexibility.',
        'Not maintaining human expertise for edge cases.',
        'Technology disconnected from business value.',
      ],
    },
  },
  'AUTOMATE#WORKSTATIONS': {
    1: {
      coachQuestions: [
        'Which tasks are most suitable for automation or AI augmentation?',
        'What percentage of tasks are rules-based vs. judgment-based?',
        'What digital tools could reduce error rates?',
      ],
      evidenceGuidance:
        'Create task-level automation analysis: automatable %, augmentable %, human-only %.',
      microLesson:
        'Not all tasks should be automated. The sweet spot is augmentation: AI handles data while humans decide.',
      commonMistakes: [
        'Assuming all repetitive tasks should be automated.',
        'Not considering operator perspective.',
        'Focusing on task elimination instead of transformation.',
      ],
    },
    2: {
      coachQuestions: [
        'What role evolution is recommended?',
        'What new skills will the operator need?',
        'How will the transition be managed?',
      ],
      evidenceGuidance:
        'Check for role evolution assessment, skills gap analysis, training plan, timeline.',
      microLesson:
        'Role evolution is not binary. Most roles transform: some tasks automate, new tasks emerge.',
      commonMistakes: [
        'Treating all operators the same.',
        'Underestimating retraining cost.',
        'Not communicating the plan transparently.',
      ],
    },
    3: {
      coachQuestions: [
        'What cobots or AI assistants would have highest impact?',
        'How will human-machine handoffs be designed?',
        'What is the change management risk?',
      ],
      evidenceGuidance:
        'Look for technology selection rationale, safety assessments, human-machine interaction design.',
      microLesson:
        'Cobots represent collaboration philosophy. Best implementations start with operator workflow.',
      commonMistakes: [
        'Buying cobots without redesigning workstation layout.',
        'Ignoring safety standards.',
        'Not measuring combined human+cobot throughput.',
      ],
    },
    4: {
      coachQuestions: [
        'How is the augmented workstation performing vs. business case?',
        'What unexpected challenges have emerged?',
        'How is operator feedback driving improvements?',
      ],
      evidenceGuidance:
        'Look for actual vs. planned ROI, operator feedback records, and iteration documentation.',
      microLesson:
        'First deployment is version 0.1. Expect 3-6 months of iteration before target performance.',
      commonMistakes: [
        'Declaring success after deployment.',
        'Not collecting operator feedback.',
        'Over-investing in Phase 1 instead of iterating.',
      ],
    },
    5: {
      coachQuestions: [
        'How does the workstation adapt without full reprogramming?',
        'What career path exists for operators?',
        'How do you maintain skills for exception handling?',
      ],
      evidenceGuidance:
        'Look for flexible automation, career development programs, and documented human interventions.',
      microLesson:
        'Advanced workstations are learning systems: operators teach machines, machines amplify operators.',
      commonMistakes: [
        'Rigidity — automation that cannot adapt is a liability.',
        'Neglecting the human side.',
        'Not planning for the next technology wave.',
      ],
    },
  },
};

const WASTE_KNOWLEDGE: Record<WasteType, LeanWasteKnowledge> = {
  TRANSPORTATION: {
    whatToLookFor: [
      'Material moving between buildings unnecessarily',
      'Documents forwarded through multiple systems',
      'Forklift/AGV travel distance per shift',
    ],
    typicalEvidence: ['Spaghetti diagram', 'Forklift utilization logs', 'Layout showing distances'],
    coachQuestions: [
      'Can process steps be rearranged to eliminate transport?',
      'What would a cellular layout look like?',
      'Is transport caused by batch size?',
    ],
  },
  INVENTORY: {
    whatToLookFor: [
      'WIP piling up between stations',
      'Raw material stored "just in case"',
      'Finished goods aging',
    ],
    typicalEvidence: [
      'Inventory turns ratio',
      'Days of supply metrics',
      'Photos of WIP accumulation',
    ],
    coachQuestions: [
      'What is minimum inventory for flow?',
      'What causes the buffer?',
      'How much capital is tied up?',
    ],
  },
  MOTION: {
    whatToLookFor: [
      'Operator walking, reaching, bending unnecessarily',
      'Searching for tools',
      'Multiple system switches',
    ],
    typicalEvidence: [
      'Spaghetti diagram of movement',
      'Reach zone analysis',
      'Screen recording of system switches',
    ],
    coachQuestions: [
      "Can the workstation bring everything within arm's reach?",
      'Walking distance per shift?',
      'Ergonomic concerns?',
    ],
  },
  WAITING: {
    whatToLookFor: [
      'People waiting for materials, information, approvals',
      'Machines idle between batches',
      'Queues of WIP',
    ],
    typicalEvidence: [
      'Time studies showing wait %',
      'Changeover time logs',
      'Queue length observations',
    ],
    coachQuestions: [
      'Root cause of waiting?',
      'Can wait convert to productive time?',
      'Would reducing batch size help?',
    ],
  },
  OVERPRODUCTION: {
    whatToLookFor: [
      'Making more than demand',
      'Large batches from changeover avoidance',
      'Running machines for utilization',
    ],
    typicalEvidence: [
      'Production vs. demand comparison',
      'Batch size vs. takt analysis',
      'Finished goods aging report',
    ],
    coachQuestions: [
      'What drives batch size?',
      'Would smaller batches improve flow?',
      'Is scheduling push or pull?',
    ],
  },
  OVER_PROCESSING: {
    whatToLookFor: [
      'Tighter tolerances than required',
      'Extra approval steps',
      'Reports nobody reads',
    ],
    typicalEvidence: [
      'Tolerance comparison',
      'Process map with approvals',
      'Report readership analysis',
    ],
    coachQuestions: [
      'Does customer need this quality?',
      'Which approvals can be eliminated?',
      'What reports are unread?',
    ],
  },
  DEFECTS: {
    whatToLookFor: [
      'Rework, scrap, warranty returns',
      'Inspection that should be unnecessary',
      'Customer complaints',
    ],
    typicalEvidence: [
      'Scrap/rework rates',
      'Cost of poor quality (COPQ)',
      'Pareto chart of defects',
    ],
    coachQuestions: [
      'Where are defects created vs. detected?',
      'What poka-yoke can prevent this?',
      'Total cost of this defect?',
    ],
  },
  SKILLS: {
    whatToLookFor: [
      'Underutilized capabilities',
      'No suggestion system',
      'Over-reliance on key individuals',
    ],
    typicalEvidence: [
      'Skill matrix with gaps',
      'Improvement suggestion records',
      'Single-point-of-failure analysis',
    ],
    coachQuestions: [
      'Are operators involved in improvement?',
      'What skills are underutilized?',
      'Cross-training coverage?',
    ],
  },
};

export function getLeanKnowledge(
  phase: DBR77Phase,
  dimension: DBR77Dimension,
  level: number
): LeanLevelKnowledge {
  const key: PhaseKey = `${phase}#${dimension}`;
  const phaseData = PHASE_KNOWLEDGE[key];
  if (phaseData && phaseData[level]) {
    return phaseData[level];
  }
  return {
    coachQuestions: [
      'What is the current state of this area?',
      'What evidence supports the assessment?',
      'What would improvement look like?',
    ],
    evidenceGuidance:
      'Observe the actual work, collect data, and verify with the people doing the work.',
    microLesson: 'Go to gemba, observe the real process, and talk to the real people.',
    commonMistakes: [
      'Assessing from a desk instead of walking the floor.',
      'Relying on opinions instead of data.',
      'Not involving the people who do the work.',
    ],
  };
}

export function getLeanWasteKnowledge(wasteType: WasteType): LeanWasteKnowledge {
  return (
    WASTE_KNOWLEDGE[wasteType] || {
      whatToLookFor: ['Observe the process for signs of this waste type.'],
      typicalEvidence: ['Time studies', 'Process observations', 'Data collection sheets'],
      coachQuestions: ['Where do you see this waste?', 'What is the impact?', 'Root cause?'],
    }
  );
}

export function getLeanLevelMeaning(
  level: number
): { title: string; meaning: string; evidencePattern: string } | null {
  return LEAN_LEVEL_MEANINGS[level] || null;
}
