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
    mission:
      'What industry, geographic scope, competitive position, and decision question should this Porter session support?',
    input:
      'What interview notes, benchmarks, market observations, or organization context should become evidence for the force assessment?',
    forces:
      'Let me turn the accepted market signals into a Five Forces scorecard with drivers, evidence, and confidence.',
    insights:
      'I will synthesize the scored forces into margin pressure, defensibility implications, and strategic moves.',
    outputs:
      'Let me prepare the final source summary, output candidates, and initiative drafts from the approved diagnosis.',
  },
  'growth-paths': {
    mission:
      'What growth ambition, scope, success signal, and constraints should this Ansoff session support?',
    input:
      'What interview notes, market observations, customer signals, or organization context should shape the growth options?',
    options:
      'Let me turn the accepted growth signals into Ansoff options across market penetration, market development, product development, and diversification.',
    insights:
      'I will compare the growth options, expose trade-offs, and recommend a sequenced set of growth moves.',
    outputs:
      'Let me prepare the final source summary, output candidates, and initiative drafts from the approved growth direction.',
  },
  'portfolio-priority': {
    mission:
      'What portfolio decision, scope, success signal, and constraints should this prioritization support?',
    input:
      'What interview notes, performance signals, market evidence, or resource constraints should shape the portfolio?',
    items:
      'Let me turn the accepted signals into BCG-style portfolio cards with growth, share, investment, and confidence.',
    insights:
      'I will synthesize the portfolio into resource trade-offs and recommended allocation moves.',
    outputs:
      'Let me prepare the final source summary, output candidates, and initiative drafts from the approved portfolio direction.',
  },
  'risk-uncertainty': {
    mission:
      'What decision, risk scope, success signal, and uncertainty constraints should this session support?',
    input:
      'What interview notes, weak signals, market changes, or assumptions should shape the risk map?',
    assumptions:
      'Let me turn the accepted signals into assumptions, strategic risks, and plausible scenarios.',
    insights:
      'I will synthesize the risk map into validation, mitigation, monitoring, and escalation moves.',
    outputs:
      'Let me prepare the final source summary, output candidates, and initiative drafts from the approved risk posture.',
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
