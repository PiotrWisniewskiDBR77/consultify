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
import { DRD_OVERRIDES_AXIS_1_2 } from './drdKnowledgeOverridesAxis1And2';
import { DRD_OVERRIDES_AXIS_3_4 } from './drdKnowledgeOverridesAxis3And4';

export type DRDLevelKnowledge = {
  questions: [string, string, string];
  example: string;
  suggestedTechnologies: string[];
};

export type DRDAreaLevelKey = `${string}#${number}`; // e.g. "1A#3"

/**
 * NOTE (important): Technologies MUST be per-process + per-level.
 * The book describes different tools for each process area at each maturity level.
 * We therefore derive suggested technologies primarily from the LEVEL DESCRIPTION
 * (which is sourced from the book and differs across areas), not only from the level title.
 */
const TECH_RULES: Array<{ keyword: RegExp; tech: string[] }> = [
  // Core enterprise systems
  { keyword: /\bERP\b/i, tech: ['ERP', 'Master Data Management (MDM)', 'API Integration'] },
  { keyword: /\bMES\b/i, tech: ['MES', 'OEE Dashboard', 'SCADA'] },
  { keyword: /\bWMS\b/i, tech: ['WMS', 'Barcode/RFID', 'Warehouse Analytics'] },
  { keyword: /\bQMS\b/i, tech: ['QMS', 'Quality Planning', 'Inspection Reporting'] },
  { keyword: /\bCMMS\b/i, tech: ['CMMS', 'Predictive Maintenance', 'Asset Registry'] },
  { keyword: /\bMRP\b/i, tech: ['MRP', 'Inventory Planning', 'Reorder Point Optimization'] },
  { keyword: /\bPLC\b|\bPLCs\b/i, tech: ['PLC', 'Sensors', 'Industrial Detectors'] },

  // Data / analytics
  { keyword: /\bBI\b|\bBusiness Intelligence\b/i, tech: ['BI', 'Data Warehouse', 'ETL/ELT'] },
  {
    keyword: /\bGoogle Analytics\b/i,
    tech: ['Google Analytics', 'Web Analytics', 'Conversion Tracking'],
  },
  { keyword: /\bSEO\b/i, tech: ['SEO Toolkit', 'Search Console', 'Content Analytics'] },

  // Automation / integration
  { keyword: /\bRPA\b/i, tech: ['RPA', 'Invoice Automation', 'Report Automation'] },
  {
    keyword: /\bWorkflow\b/i,
    tech: ['Workflow Management', 'Approval Flows', 'Process Orchestration'],
  },
  {
    keyword: /\biPaaS\b|\bIntegration Platform\b/i,
    tech: ['iPaaS', 'API Gateway', 'Event Integration'],
  },
  { keyword: /\bEDI\b/i, tech: ['EDI', 'B2B Integration', 'Partner Connectivity'] },

  // Process-specific tools
  { keyword: /\bCRM\b/i, tech: ['CRM', 'Marketing Automation', 'Customer Data Platform (CDP)'] },
  { keyword: /\bCAD\b/i, tech: ['CAD', 'PLM/PDM', 'Design Data Management'] },
  { keyword: /\bFMEA\b/i, tech: ['FMEA', 'Risk Register', 'Corrective Action Tracking (CAPA)'] },
  { keyword: /\bDigital Twin\b/i, tech: ['Digital Twin', 'Simulation Models', 'IoT Data Feeds'] },
  {
    keyword: /\b3D\b|\b3D printing\b|\b3D printer\b/i,
    tech: ['3D Printing', 'Rapid Prototyping', 'Design Verification'],
  },
  {
    keyword: /\bVR\b|\bVirtual Reality\b/i,
    tech: ['Virtual Reality (VR)', 'Training Simulations', 'Process Visualization'],
  },
  {
    keyword: /\bAR\b|\bAugmented Reality\b/i,
    tech: ['Augmented Reality (AR)', 'Guided Work Instructions', 'Remote Support'],
  },
  { keyword: /\bRFID\b/i, tech: ['RFID', 'Barcode Scanners', 'Labeling System'] },
  { keyword: /\bbarcode\b/i, tech: ['Barcode Scanners', 'Label Printers', 'Inventory Scanning'] },
  {
    keyword: /\bmobile terminal\b|\bmobile terminals\b/i,
    tech: ['Mobile Terminals', 'Real-time Location', 'Inventory Updates'],
  },
  {
    keyword: /\bauction\b|\be-auction\b|\bB2B procurement\b/i,
    tech: ['B2B Procurement Platform', 'e-Auctions', 'Supplier Portal'],
  },
  {
    keyword: /\bmarketplace\b|\bonline shop\b|\be-commerce\b|\bDIY\b/i,
    tech: ['E-commerce Platform', 'Marketplace Integration', 'Self-service Ordering'],
  },
  {
    keyword: /\bnewsletter\b|\bemail campaign\b/i,
    tech: ['Email Marketing', 'Campaign Automation', 'Personalization Engine'],
  },
  { keyword: /\bOCR\b/i, tech: ['OCR', 'Document Management', 'Invoice Capture'] },
  { keyword: /\binvoice\b/i, tech: ['Invoice Processing', 'AP Automation', 'Financial Posting'] },
  { keyword: /\bbudget\b|\bforecast\b/i, tech: ['Budgeting', 'Forecasting', 'Financial Planning'] },
  {
    keyword: /\bcontract\b|\bagreement\b|\border\b/i,
    tech: ['Contract & Order Registry', 'Order Management', 'Customer Records'],
  },
  {
    keyword: /\breporting\b|\breport\b|\bmonitoring\b|\bKPI\b/i,
    tech: ['Reporting', 'KPI Dashboards', 'Performance Monitoring'],
  },
  { keyword: /\bAGV\b|\bAGVs\b/i, tech: ['AGV', 'Warehouse Robotics', 'Route Optimization'] },
  {
    keyword: /\bcobot\b|\bcobots\b/i,
    tech: ['Cobots', 'Robot Safety Systems', 'Automation Cells'],
  },
  {
    keyword: /\bvision\b|\bcamera\b/i,
    tech: ['Machine Vision', 'Cameras', 'Automated Inspection'],
  },

  // HR / finance
  { keyword: /\bOCR\b/i, tech: ['OCR', 'Document Management', 'Invoice Capture'] },
  { keyword: /\bHRM\b/i, tech: ['HRM', 'Training Planning', 'Performance Reviews'] },
  { keyword: /\bpayroll\b/i, tech: ['Payroll System', 'Tax Declarations', 'Salary Management'] },
  { keyword: /\bbiometric\b/i, tech: ['Biometric Readers', 'Time & Attendance', 'Access Control'] },
  {
    keyword: /\be-kiosk\b|\bkiosk\b/i,
    tech: ['Employee Kiosk', 'Self-Service HR Portal', 'Digital Forms'],
  },

  // AI
  {
    keyword: /\bNLP\b|\bNatural language processing\b/i,
    tech: ['NLP', 'Chatbots', 'Content Generation'],
  },
  { keyword: /\bchatbot\b/i, tech: ['Chatbots', 'Customer Service Automation', 'Knowledge Base'] },
  { keyword: /\bMachine Learning\b|\bML\b/i, tech: ['ML Models', 'MLOps', 'Model Monitoring'] },
];

// Oxford O1 — kuratorowane pytania behawioralne, dokładane partiami po osiach.
// partia 1: osie 1 i 2 · partia 2: osie 3 i 4 · partia 3: osie 5-7.
const DRD_KNOWLEDGE_OVERRIDES: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  ...DRD_OVERRIDES_AXIS_1_2,
  ...DRD_OVERRIDES_AXIS_3_4,
};

function normalizeWhitespace(s: string): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqPreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = normalizeWhitespace(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function pickSuggestedTechnologies(area: DRDArea, level: DRDLevel): string[] {
  const text = `${area.name} ${level.title} ${level.description}`;

  const hits: string[] = [];
  for (const rule of TECH_RULES) {
    if (rule.keyword.test(text)) hits.push(...rule.tech);
  }

  // Lightweight extraction of common acronyms present in the book text.
  const acronymToCanon: Record<string, string> = {
    ERP: 'ERP',
    MES: 'MES',
    WMS: 'WMS',
    QMS: 'QMS',
    CMMS: 'CMMS',
    MRP: 'MRP',
    CRM: 'CRM',
    CAD: 'CAD',
    FMEA: 'FMEA',
    SEO: 'SEO',
    EDI: 'EDI',
    RFID: 'RFID',
    OCR: 'OCR',
    RPA: 'RPA',
    PLC: 'PLC',
    VSM: 'Value Stream Mapping (VSM)',
    OEE: 'OEE Analysis',
    VR: 'Virtual Reality (VR)',
    AR: 'Augmented Reality (AR)',
    AGV: 'AGV',
    NLP: 'NLP',
    BI: 'BI',
    HRM: 'HRM',
    SOP: 'Standard Operating Procedures (SOP)',
  };

  const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
  for (const a of acronyms) {
    const canon = acronymToCanon[a];
    if (canon) hits.push(canon);
  }

  // Additional intent-based helpers (non-acronym phrases)
  if (/\bonline shop\b|\bmarketplace\b/i.test(text)) {
    hits.push('E-commerce Platform', 'Marketplace Integration');
  }
  if (/\bnewsletter\b|\bemail campaign\b/i.test(text)) {
    hits.push('Email Marketing', 'Campaign Automation');
  }
  if (/\bbarcode\b|\bscanner\b/i.test(text)) {
    hits.push('Barcode Scanners', 'Mobile Terminals');
  }

  const unique = uniqPreserveOrder(hits);
  if (unique.length > 0) return unique;

  // Area-aware fallback (ensures every cell can show meaningful, different examples)
  const areaFallback: Record<string, string[]> = {
    '1A': ['Contract & Order Registry', 'Order Management', 'CRM'],
    '1B': ['CRM', 'Campaign Tracking', 'Web Analytics'],
    '1C': ['CAD', 'Design Documentation', 'Simulation Tools'],
    '1D': ['Supplier Registry', 'Purchase Orders', 'MRP'],
    '1E': ['Barcode/RFID', 'Location Tracking', 'WMS'],
    '1F': ['Machine Data Logging', 'PLC & Sensors', 'MES'],
    '1G': ['Compliance Sheets', 'Inspection Records', 'QMS'],
    '1H': ['OCR', 'Document Management', 'Financial Reporting'],
    '1I': ['Time & Attendance', 'Payroll', 'HRM'],
  };

  if (areaFallback[area.id]) return areaFallback[area.id];

  // generic evidence stack
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
    suggestedTechnologies: pickSuggestedTechnologies(area, lvl),
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
