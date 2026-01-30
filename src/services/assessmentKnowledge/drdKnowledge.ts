/**
 * DRD Knowledge Base (MVP)
 *
 * Source of truth for:
 * - 3 yes/no questions per level
 * - Example per level
 * - Suggested technologies per level
 *
 * Notes:
 * - We generate sensible defaults for ALL areas/levels so the editor always has content.
 * - You can override specific area+level entries in DRD_KNOWLEDGE_OVERRIDES over time.
 */
import { DRD_STRUCTURE, DRDArea, DRDLevel } from '@/services/drdStructure';

export type DRDLevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
};

export type DRDAreaLevelKey = `${string}#${number}`; // e.g. "1A#3"

const DEFAULT_TECH_BY_KEYWORD: Array<{ keyword: RegExp; tech: string[] }> = [
  { keyword: /\bERP\b/i, tech: ['ERP', 'Master Data Management (MDM)', 'API Integration'] },
  { keyword: /\bMES\b/i, tech: ['MES', 'OEE Dashboard', 'SCADA'] },
  { keyword: /\bWMS\b/i, tech: ['WMS', 'Barcode/RFID', 'Warehouse Analytics'] },
  { keyword: /\bCMMS\b/i, tech: ['CMMS', 'Predictive Maintenance', 'Asset Registry'] },
  {
    keyword: /\bBI\b|\bDashboard\b|\bReporting\b/i,
    tech: ['BI Dashboard', 'Data Warehouse', 'ETL/ELT'],
  },
  {
    keyword: /\bAI\b|\bMachine Learning\b|\bNLP\b|\bChatbot\b/i,
    tech: ['GenAI Assistant', 'ML Models', 'MLOps'],
  },
  {
    keyword: /\bAutomation\b|\bRPA\b/i,
    tech: ['Workflow Automation', 'RPA', 'Integration Platform (iPaaS)'],
  },
  { keyword: /\bCRM\b/i, tech: ['CRM', 'Marketing Automation', 'Customer Data Platform'] },
];

const DRD_KNOWLEDGE_OVERRIDES: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  // Example override:
  // '1A#1': { questions: ['...', '...', '...'], example: '...', suggestedTechnologies: ['...'] },
};

function normalizeWhitespace(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickSuggestedTechnologies(level: DRDLevel): string[] {
  const text = `${level.title} ${level.description}`;
  for (const rule of DEFAULT_TECH_BY_KEYWORD) {
    if (rule.keyword.test(text)) return rule.tech;
  }
  // fallback: generic evidence stack
  return ['Process Documentation', 'KPI Dashboard', 'Standard Operating Procedures (SOP)'];
}

function defaultQuestions(area: DRDArea, level: DRDLevel): [string, string, string] {
  const areaName = area.name || 'this area';
  const lvl = level.level;
  const title = normalizeWhitespace(level.title);
  return [
    `In "${areaName}", is level ${lvl} ("${title}") implemented as described?`,
    `Can we show evidence for level ${lvl} (e.g. system, report, procedure, record in the system)?`,
    `Does it work in practice and is it used regularly (not just a pilot or a one-off case)?`,
  ];
}

function defaultExample(area: DRDArea, level: DRDLevel): string {
  const areaName = area.name || 'this area';
  const lvl = level.level;
  // Keep it simple and universal; can be overridden per level.
  return `Example: in "${areaName}", we provide a concrete artifact confirming level ${lvl} (e.g. screenshot, report, system log, procedure, instruction, KPI).`;
}

export function getDRDKnowledge(areaId: string, levelNumber: number): DRDLevelKnowledge {
  const area = DRD_STRUCTURE.flatMap((a) => a.areas).find((ar) => ar.id === areaId);
  const lvl = area?.levels?.find((l) => l.level === levelNumber);

  // Very defensive fallbacks (should not happen)
  const fallback: DRDLevelKnowledge = {
    questions: [
      'Is this level met?',
      'Do we have evidence that this level is met?',
      'Does it work in practice?',
    ],
    example: 'Example: provide evidence (system/report/procedure).',
    suggestedTechnologies: ['KPI Dashboard', 'Process Documentation'],
  };

  if (!area || !lvl) return fallback;

  const base: DRDLevelKnowledge = {
    questions: defaultQuestions(area, lvl),
    example: defaultExample(area, lvl),
    suggestedTechnologies: pickSuggestedTechnologies(lvl),
  };

  const key: DRDAreaLevelKey = `${areaId}#${levelNumber}`;
  const override = DRD_KNOWLEDGE_OVERRIDES[key];
  if (!override) return base;

  return {
    questions: (override.questions as any) || base.questions,
    example: override.example || base.example,
    suggestedTechnologies: override.suggestedTechnologies || base.suggestedTechnologies,
  };
}
