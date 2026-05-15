import type { ToolType } from '@/store/useToolStore';

const OPENING_QUESTIONS: Record<string, Record<string, string>> = {
  'dynamic-swot': {
    mission: 'What decision are we supporting, what is the scope, and what will success look like?',
    input:
      'What signals do we already have from interviews, materials, and external context that should shape this analysis?',
    swot: 'Let me turn the captured signals into a high-quality SWOT structure.',
    insights: "I'll synthesize the matrix into tensions, applied conclusions, and strategic moves.",
    outputs: 'Let me prepare the final source summary and downstream outputs.',
  },
  'market-forces': {
    context: 'What industry and market are you analyzing? Define your competitive position.',
    rivalry: 'How intense is competition among existing players in your industry?',
    newEntrants: 'How easy is it for new competitors to enter your market?',
    substitutes: 'What substitute products or services threaten your offerings?',
    buyerPower: 'How much bargaining power do your customers have?',
    supplierPower: 'How much bargaining power do your suppliers have?',
    summary: 'Let me summarize the competitive landscape and propose initiatives.',
  },
  'growth-paths': {
    context: 'What growth goal and scope are you analyzing?',
    'market-penetration': 'What initiatives grow in current markets with current products?',
    'market-development': 'What initiatives expand into new markets?',
    'product-development': 'What new products could accelerate growth?',
    diversification: 'What initiatives combine new products and new markets?',
    summary: 'Let me summarize growth paths and propose initiatives.',
  },
  'portfolio-priority': {
    context: 'What portfolio scope and constraints are you analyzing?',
    'portfolio-items': 'List initiatives and assess growth and share.',
    'portfolio-matrix': 'Let me summarize the portfolio matrix.',
    summary: 'Let me summarize portfolio priorities and initiatives.',
  },
  'risk-uncertainty': {
    context: 'What risk scope and time horizon are you analyzing?',
    assumptions: 'What key assumptions underpin the strategy?',
    risks: 'What are the strategic risks and mitigations?',
    scenarios: 'What scenarios could materially impact outcomes?',
    summary: 'Let me summarize risks and propose resilience initiatives.',
  },
  'sop-builder': {
    context: 'What operational scope are you standardizing?',
    standards: 'What standards and quality criteria are required?',
    checklists: 'What checklist items ensure compliance?',
    summary: 'Let me summarize SOP and propose initiatives.',
  },
  'a3-problem-solving': {
    context: 'What problem scope are you analyzing?',
    problem: 'Describe the problem and its impact.',
    'root-cause': 'What are the root causes?',
    countermeasures: 'What countermeasures will address root causes?',
    summary: 'Let me summarize A3 and propose initiatives.',
  },
  'smed-planner': {
    context: 'What changeover process are you improving?',
    'changeover-steps': 'List key changeover steps and durations.',
    improvements: 'What quick wins and investments reduce time?',
    summary: 'Let me summarize SMED and propose initiatives.',
  },
  'dms-builder': {
    context: 'What DMS scope and teams are involved?',
    kpis: 'What KPIs should be tracked daily?',
    escalation: 'What escalation rules should apply?',
    summary: 'Let me summarize DMS and propose initiatives.',
  },
  'inventory-autopilot': {
    context: 'What inventory scope are you optimizing?',
    'sku-classification': 'What SKU classes and criteria apply?',
    replenishment: 'What replenishment policies are needed?',
    summary: 'Let me summarize inventory and propose initiatives.',
  },
};

export function getToolStepOpeningQuestion(toolType: ToolType, stepId?: string): string {
  if (!stepId) return '';
  return OPENING_QUESTIONS[toolType]?.[stepId] || '';
}
