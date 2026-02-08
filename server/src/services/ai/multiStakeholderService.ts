/**
 * Multi-Stakeholder Service (Enterprise)
 *
 * Generates decision analysis from multiple stakeholder perspectives.
 * Enables:
 * - CFO, CTO, COO, CMO, CHRO view on same problem
 * - Conflict detection between stakeholder priorities
 * - Board-ready multi-perspective summary
 */

import logger from '../../utils/Logger.js';

// ==========================================
// STAKEHOLDER PERSONAS
// ==========================================

export interface StakeholderPersona {
  role: string;
  title: string;
  shortTitle: string;
  priorities: string[];
  concerns: string[];
  metrics: string[];
  biases: string[];
  promptContext: string;
}

export const STAKEHOLDER_PERSONAS: Record<string, StakeholderPersona> = {
  cfo: {
    role: 'cfo',
    title: 'Chief Financial Officer',
    shortTitle: 'CFO',
    priorities: ['ROI', 'Cash flow', 'Cost optimization', 'Financial risk'],
    concerns: ['Budget overruns', 'Margin erosion', 'Financial compliance', 'Capital allocation'],
    metrics: ['NPV', 'IRR', 'Payback period', 'TCO', 'EBITDA impact'],
    biases: [
      'May undervalue strategic investments with long payback',
      'Risk-averse to revenue uncertainty',
    ],
    promptContext: `You are analyzing this decision as a CFO. Your primary lens is financial impact, ROI, cash flow implications, and risk-adjusted returns. You care deeply about:
- Total Cost of Ownership (TCO) and hidden costs
- Revenue impact and margin effects
- Financial risk exposure and mitigation
- Capital efficiency and opportunity cost
Provide concrete financial analysis with numbers where possible.`,
  },

  cto: {
    role: 'cto',
    title: 'Chief Technology Officer',
    shortTitle: 'CTO',
    priorities: ['Technical excellence', 'Scalability', 'Innovation', 'Technical debt'],
    concerns: [
      'Security vulnerabilities',
      'Integration complexity',
      'Vendor lock-in',
      'Skill gaps',
    ],
    metrics: [
      'System uptime',
      'Performance benchmarks',
      'Development velocity',
      'Technical debt ratio',
    ],
    biases: ['May over-engineer solutions', 'Preference for newer technologies over stable ones'],
    promptContext: `You are analyzing this decision as a CTO. Your primary lens is technical feasibility, scalability, and long-term technical health. You care deeply about:
- Architecture implications and scalability
- Security and compliance requirements
- Integration with existing systems
- Impact on technical debt and development velocity
Highlight technical risks and opportunities.`,
  },

  coo: {
    role: 'coo',
    title: 'Chief Operating Officer',
    shortTitle: 'COO',
    priorities: ['Operational efficiency', 'Process optimization', 'Execution', 'Supply chain'],
    concerns: [
      'Disruption risk',
      'Resource constraints',
      'Operational complexity',
      'Quality assurance',
    ],
    metrics: ['Cycle time', 'Throughput', 'Capacity utilization', 'Quality metrics'],
    biases: [
      'May prioritize short-term efficiency over strategic change',
      'Focus on execution over strategy',
    ],
    promptContext: `You are analyzing this decision as a COO. Your primary lens is operational impact, execution feasibility, and process efficiency. You care deeply about:
- Implementation complexity and timelines
- Resource requirements and constraints
- Impact on existing operations and processes
- Quality and reliability implications
Focus on practical execution challenges and operational trade-offs.`,
  },

  cmo: {
    role: 'cmo',
    title: 'Chief Marketing Officer',
    shortTitle: 'CMO',
    priorities: ['Brand value', 'Customer experience', 'Market positioning', 'Growth'],
    concerns: ['Brand damage', 'Customer churn', 'Competitive response', 'Market timing'],
    metrics: ['NPS', 'Brand awareness', 'CAC', 'LTV', 'Market share'],
    biases: ['May overweight customer perception', 'Focus on growth over profitability'],
    promptContext: `You are analyzing this decision as a CMO. Your primary lens is market impact, customer experience, and brand implications. You care deeply about:
- Customer impact and perception
- Competitive positioning
- Brand and reputation effects
- Growth opportunities and market timing
Consider how this affects customer relationships and market position.`,
  },

  chro: {
    role: 'chro',
    title: 'Chief Human Resources Officer',
    shortTitle: 'CHRO',
    priorities: ['Talent', 'Culture', 'Employee engagement', 'Organizational capability'],
    concerns: ['Talent retention', 'Skills gaps', 'Cultural fit', 'Change resistance'],
    metrics: ['Employee satisfaction', 'Turnover rate', 'Training completion', 'Culture scores'],
    biases: [
      'May prioritize employee comfort over necessary change',
      'Focus on consensus building',
    ],
    promptContext: `You are analyzing this decision as a CHRO. Your primary lens is people impact, organizational capability, and cultural fit. You care deeply about:
- Impact on employees and their work
- Skills and capability requirements
- Cultural alignment and change management
- Talent attraction and retention implications
Focus on the human element and organizational readiness.`,
  },

  ceo: {
    role: 'ceo',
    title: 'Chief Executive Officer',
    shortTitle: 'CEO',
    priorities: ['Strategy', 'Stakeholder value', 'Vision alignment', 'Competitive advantage'],
    concerns: [
      'Strategic fit',
      'Board expectations',
      'Competitive dynamics',
      'Long-term sustainability',
    ],
    metrics: [
      'Strategic alignment',
      'Competitive position',
      'Shareholder value',
      'Vision progress',
    ],
    biases: ['May underestimate execution challenges', 'Focus on strategy over operations'],
    promptContext: `You are analyzing this decision as a CEO. Your primary lens is strategic alignment, long-term value creation, and stakeholder impact. You care deeply about:
- Alignment with company vision and strategy
- Competitive implications
- Board and investor expectations
- Long-term sustainability and growth
Synthesize across all functional areas with a strategic view.`,
  },
};

// ==========================================
// TYPES
// ==========================================

export interface StakeholderPerspective {
  stakeholder: StakeholderPersona;
  analysis: string;
  supportLevel: 'strongly_support' | 'support' | 'neutral' | 'oppose' | 'strongly_oppose';
  keyPoints: string[];
  risks: string[];
  conditions: string[]; // What would need to be true for them to support
}

export interface ConflictAnalysis {
  stakeholder1: string;
  stakeholder2: string;
  conflictArea: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolutionSuggestion?: string;
}

export interface MultiStakeholderAnalysis {
  problem: string;
  perspectives: StakeholderPerspective[];
  conflicts: ConflictAnalysis[];
  consensus: {
    areas: string[];
    overallAlignment: 'aligned' | 'mostly_aligned' | 'divided' | 'strongly_divided';
  };
  recommendation: string;
}

// ==========================================
// SERVICE
// ==========================================

/**
 * Get available stakeholder personas
 */
export function getAvailableStakeholders(): StakeholderPersona[] {
  return Object.values(STAKEHOLDER_PERSONAS);
}

/**
 * Build prompt for a specific stakeholder perspective
 */
export function buildStakeholderPrompt(args: {
  problem: string;
  stakeholder: StakeholderPersona;
  language?: string;
}): string {
  const { problem, stakeholder, language } = args;
  const isPolish = (language || 'en').startsWith('pl');

  const header = isPolish
    ? `Analizujesz następujący problem z perspektywy ${stakeholder.title}:`
    : `You are analyzing the following problem from the perspective of a ${stakeholder.title}:`;

  const outputFormat = isPolish
    ? `
## Format odpowiedzi
1. **Kluczowe punkty** - 3-5 najważniejszych obserwacji
2. **Poziom wsparcia** - czy wspierasz tę decyzję (mocno_za/za/neutralny/przeciw/mocno_przeciw)
3. **Ryzyka** - 2-3 ryzyka z Twojej perspektywy
4. **Warunki** - co musiałoby być prawdą, abyś w pełni wspierał(a)`
    : `
## Response Format
1. **Key Points** - 3-5 most important observations
2. **Support Level** - whether you support this decision (strongly_support/support/neutral/oppose/strongly_oppose)
3. **Risks** - 2-3 risks from your perspective
4. **Conditions** - what would need to be true for your full support`;

  return `${stakeholder.promptContext}

${header}

---
${problem}
---

${outputFormat}`;
}

/**
 * Parse stakeholder response into structured format
 */
export function parseStakeholderResponse(args: {
  stakeholder: StakeholderPersona;
  response: string;
}): StakeholderPerspective {
  const { stakeholder, response } = args;
  const t = response.toLowerCase();

  // Detect support level - look for explicit patterns
  let supportLevel: StakeholderPerspective['supportLevel'] = 'neutral';
  if (/\bstrongly_support\b/.test(t) || t.includes('mocno_za')) supportLevel = 'strongly_support';
  else if (/\bstrongly_oppose\b/.test(t) || t.includes('mocno_przeciw'))
    supportLevel = 'strongly_oppose';
  else if (
    /\bsupport_level[:\s]+support\b/.test(t) ||
    /\b(i\s+)?support\s+this\s+decision\b/.test(t) ||
    /\/za\b/.test(t)
  )
    supportLevel = 'support';
  else if (/\boppose\b/.test(t) || t.includes('przeciw')) supportLevel = 'oppose';

  // Extract key points (simplified - in production would use LLM)
  const keyPoints = extractBulletPoints(response, ['key points', 'kluczowe punkty']);
  const risks = extractBulletPoints(response, ['risks', 'ryzyka']);
  const conditions = extractBulletPoints(response, ['conditions', 'warunki']);

  return {
    stakeholder,
    analysis: response,
    supportLevel,
    keyPoints,
    risks,
    conditions,
  };
}

/**
 * Detect conflicts between stakeholder perspectives
 */
export function detectConflicts(perspectives: StakeholderPerspective[]): ConflictAnalysis[] {
  const conflicts: ConflictAnalysis[] = [];

  // Known conflict areas between stakeholders
  const conflictPatterns: Array<{
    roles: [string, string];
    area: string;
    check: (p1: StakeholderPerspective, p2: StakeholderPerspective) => boolean;
  }> = [
    {
      roles: ['cfo', 'cto'],
      area: 'Investment vs Technical Excellence',
      check: (p1, p2) => {
        const cfoOpposed = ['oppose', 'strongly_oppose'].includes(p1.supportLevel);
        const ctoSupports = ['support', 'strongly_support'].includes(p2.supportLevel);
        return cfoOpposed && ctoSupports;
      },
    },
    {
      roles: ['coo', 'cto'],
      area: 'Operational Stability vs Innovation',
      check: (p1, p2) => {
        const cooWantsStability = p1.risks.some((r) => r.toLowerCase().includes('disrupt'));
        const ctoWantsChange = p2.keyPoints.some((k) => k.toLowerCase().includes('innov'));
        return cooWantsStability && ctoWantsChange;
      },
    },
    {
      roles: ['cfo', 'cmo'],
      area: 'Cost Control vs Growth Investment',
      check: (p1, p2) => {
        const cfoFocusedOnCost = p1.keyPoints.some((k) => k.toLowerCase().includes('cost'));
        const cmoWantsGrowth = p2.keyPoints.some((k) => k.toLowerCase().includes('growth'));
        return cfoFocusedOnCost && cmoWantsGrowth;
      },
    },
  ];

  for (const pattern of conflictPatterns) {
    const p1 = perspectives.find((p) => p.stakeholder.role === pattern.roles[0]);
    const p2 = perspectives.find((p) => p.stakeholder.role === pattern.roles[1]);

    if (p1 && p2 && pattern.check(p1, p2)) {
      conflicts.push({
        stakeholder1: p1.stakeholder.shortTitle,
        stakeholder2: p2.stakeholder.shortTitle,
        conflictArea: pattern.area,
        description: `${p1.stakeholder.shortTitle} and ${p2.stakeholder.shortTitle} have differing views on ${pattern.area}`,
        severity: determineSeverity(p1.supportLevel, p2.supportLevel),
      });
    }
  }

  return conflicts;
}

/**
 * Calculate consensus level
 */
export function calculateConsensus(perspectives: StakeholderPerspective[]): {
  areas: string[];
  overallAlignment: 'aligned' | 'mostly_aligned' | 'divided' | 'strongly_divided';
} {
  const supportScores = perspectives.map((p) => {
    const scores: Record<StakeholderPerspective['supportLevel'], number> = {
      strongly_support: 2,
      support: 1,
      neutral: 0,
      oppose: -1,
      strongly_oppose: -2,
    };
    return scores[p.supportLevel];
  });

  const avg = supportScores.reduce((a, b) => a + b, 0) / supportScores.length;
  const variance =
    supportScores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / supportScores.length;

  let alignment: 'aligned' | 'mostly_aligned' | 'divided' | 'strongly_divided';
  if (variance < 0.5 && avg > 0.5) alignment = 'aligned';
  else if (variance < 1 && avg > 0) alignment = 'mostly_aligned';
  else if (variance < 2) alignment = 'divided';
  else alignment = 'strongly_divided';

  // Find common themes in key points
  const allKeyPoints = perspectives.flatMap((p) => p.keyPoints);
  const wordCounts = new Map<string, number>();
  for (const point of allKeyPoints) {
    const words = point
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  const commonAreas = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([word]) => word)
    .slice(0, 3);

  return { areas: commonAreas, overallAlignment: alignment };
}

// ==========================================
// HELPERS
// ==========================================

function extractBulletPoints(text: string, headers: string[]): string[] {
  const lines = text.split('\n');
  const points: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (headers.some((h) => lower.includes(h))) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.match(/^#+\s/)) break; // Another header
      const bullet = line.match(/^[-*•]\s*(.+)/);
      if (bullet) points.push(bullet[1].trim());
      const numbered = line.match(/^\d+\.\s*(.+)/);
      if (numbered) points.push(numbered[1].trim());
    }
  }

  return points.slice(0, 5);
}

function determineSeverity(
  s1: StakeholderPerspective['supportLevel'],
  s2: StakeholderPerspective['supportLevel']
): 'low' | 'medium' | 'high' {
  const scores: Record<StakeholderPerspective['supportLevel'], number> = {
    strongly_support: 2,
    support: 1,
    neutral: 0,
    oppose: -1,
    strongly_oppose: -2,
  };

  const diff = Math.abs(scores[s1] - scores[s2]);
  if (diff <= 1) return 'low';
  if (diff <= 2) return 'medium';
  return 'high';
}
