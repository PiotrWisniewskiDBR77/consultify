/**
 * Knowledge Map Service
 *
 * Builds a structured knowledge map from uploaded files.
 * Extracts key topics, entities, and suggests a report type using heuristic analysis.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ExtractedEntity {
  type: string;
  name: string;
  count: number;
}

export interface KnowledgeMapResult {
  id: string;
  sourceCount: number;
  keyTopics: string[];
  suggestedReportType: string;
  extractedEntities: ExtractedEntity[];
  summary: string;
  uploadedFileIds: string[];
}

interface FileRecord {
  id: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  text_content?: string;
  metadata_json?: string;
}

// ==========================================
// TOPIC / ENTITY DICTIONARIES
// ==========================================

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Digital Transformation': [
    'digital',
    'transformation',
    'digitalization',
    'automation',
    'digitization',
  ],
  Cybersecurity: ['security', 'cyber', 'threat', 'vulnerability', 'firewall', 'encryption'],
  'Data & Analytics': ['data', 'analytics', 'dashboard', 'kpi', 'metrics', 'bi', 'reporting'],
  'AI & Machine Learning': [
    'ai',
    'machine learning',
    'ml',
    'neural',
    'deep learning',
    'nlp',
    'llm',
  ],
  'Cloud Infrastructure': ['cloud', 'aws', 'azure', 'gcp', 'saas', 'iaas', 'paas', 'kubernetes'],
  'Strategy & Planning': ['strategy', 'roadmap', 'planning', 'vision', 'mission', 'objective'],
  'Financial Analysis': ['revenue', 'cost', 'budget', 'roi', 'profit', 'margin', 'financial'],
  Operations: ['process', 'workflow', 'efficiency', 'operational', 'supply chain', 'logistics'],
  Innovation: ['innovation', 'r&d', 'patent', 'prototype', 'experiment', 'disruption'],
  'Governance & Compliance': ['governance', 'compliance', 'regulation', 'audit', 'policy', 'gdpr'],
  'Human Resources': ['talent', 'hiring', 'retention', 'hr', 'training', 'workforce', 'employee'],
  'Customer Experience': ['customer', 'ux', 'experience', 'satisfaction', 'nps', 'journey'],
};

const ENTITY_PATTERNS: { type: string; pattern: RegExp }[] = [
  {
    type: 'organization',
    pattern: /\b(?:Inc|Corp|Ltd|GmbH|S\.A\.|LLC|Sp\.\s?z\s?o\.o|S\.p\.A)\b/gi,
  },
  {
    type: 'currency',
    pattern: /(?:USD|EUR|PLN|GBP|CHF)\s?[\d,.]+|[\d,.]+\s?(?:USD|EUR|PLN|GBP|CHF)/gi,
  },
  { type: 'percentage', pattern: /\d+[.,]?\d*\s?%/g },
  {
    type: 'date',
    pattern:
      /\b(?:Q[1-4]\s?\d{4}|\d{4}[-/]\d{2}(?:[-/]\d{2})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})\b/gi,
  },
  {
    type: 'technology',
    pattern:
      /\b(?:Python|Java|React|TypeScript|SQL|PostgreSQL|Docker|Kubernetes|Terraform|REST|GraphQL|API|SDK)\b/gi,
  },
];

const REPORT_TYPE_SIGNALS: Record<string, { keywords: string[]; weight: number }> = {
  ASSESSMENT_DRD: {
    keywords: ['maturity', 'assessment', 'drd', 'digital readiness', 'axis', 'area'],
    weight: 1,
  },
  STRATEGIC_REVIEW: {
    keywords: ['strategy', 'roadmap', 'vision', 'strategic', 'initiative', 'program'],
    weight: 1,
  },
  FINANCIAL_ANALYSIS: {
    keywords: ['budget', 'revenue', 'cost', 'roi', 'financial', 'valuation', 'p&l'],
    weight: 1,
  },
  OPERATIONAL_AUDIT: {
    keywords: ['process', 'audit', 'compliance', 'operational', 'efficiency', 'sla'],
    weight: 1,
  },
  TECHNICAL_REVIEW: {
    keywords: ['architecture', 'infrastructure', 'code', 'technical', 'stack', 'deployment'],
    weight: 1,
  },
};

// ==========================================
// HEURISTIC ANALYSIS
// ==========================================

function extractTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const found: { topic: string; score: number }[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) score += matches.length;
    }
    if (score > 0) found.push({ topic, score });
  }

  return found
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((f) => f.topic);
}

function extractEntities(text: string): ExtractedEntity[] {
  const entitiesMap = new Map<string, ExtractedEntity>();

  for (const { type, pattern } of ENTITY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = match.trim();
        const key = `${type}::${normalized.toLowerCase()}`;
        const existing = entitiesMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          entitiesMap.set(key, { type, name: normalized, count: 1 });
        }
      }
    }
  }

  return Array.from(entitiesMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

function suggestReportType(text: string): string {
  const lower = text.toLowerCase();
  let bestType = 'STRATEGIC_REVIEW';
  let bestScore = 0;

  for (const [type, { keywords, weight }] of Object.entries(REPORT_TYPE_SIGNALS)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) score += matches.length * weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

function generateSummary(
  fileCount: number,
  topics: string[],
  entities: ExtractedEntity[],
  reportType: string,
  totalChars: number
): string {
  const topicStr = topics.slice(0, 4).join(', ');
  const orgEntities = entities.filter((e) => e.type === 'organization');
  const orgStr =
    orgEntities.length > 0
      ? ` References to ${orgEntities
          .slice(0, 3)
          .map((e) => e.name)
          .join(', ')}.`
      : '';
  const pages = Math.ceil(totalChars / 2000);

  return (
    `Analyzed ${fileCount} file${fileCount !== 1 ? 's' : ''} (~${pages} pages). ` +
    `Key themes: ${topicStr || 'general content'}. ` +
    `Suggested report type: ${reportType.replace(/_/g, ' ').toLowerCase()}.${orgStr}`
  );
}

// ==========================================
// MAIN SERVICE
// ==========================================

export async function buildKnowledgeMap(
  organizationId: string,
  fileIds: string[]
): Promise<KnowledgeMapResult> {
  logger.info('[KnowledgeMap] Building knowledge map', {
    organizationId,
    fileCount: fileIds.length,
  });

  if (!fileIds || fileIds.length === 0) {
    throw new Error('No file IDs provided');
  }

  const placeholders = fileIds.map(() => '?').join(', ');
  const files = await dbAll<FileRecord>(
    `SELECT id, original_name, file_size, mime_type, text_content, metadata_json
     FROM generic_assessment_reports
     WHERE id IN (${placeholders}) AND organization_id = ?`,
    [...fileIds, organizationId]
  );

  if (files.length === 0) {
    throw new Error('No files found for the provided IDs');
  }

  const allText = files
    .map((f) => {
      let text = f.text_content || '';
      if (f.metadata_json) {
        try {
          const meta = JSON.parse(f.metadata_json);
          if (meta.extractedText) text += ' ' + meta.extractedText;
        } catch {
          /* ignore parse errors */
        }
      }
      return text;
    })
    .join('\n\n');

  const combinedText = allText || files.map((f) => f.original_name).join(' ');
  const keyTopics = extractTopics(combinedText);
  const extractedEntities = extractEntities(combinedText);
  const suggestedReportType = suggestReportType(combinedText);
  const summary = generateSummary(
    files.length,
    keyTopics,
    extractedEntities,
    suggestedReportType,
    combinedText.length
  );

  const result: KnowledgeMapResult = {
    id: uuidv4(),
    sourceCount: files.length,
    keyTopics,
    suggestedReportType,
    extractedEntities,
    summary,
    uploadedFileIds: fileIds,
  };

  logger.info('[KnowledgeMap] Knowledge map built', {
    id: result.id,
    sourceCount: result.sourceCount,
    topicCount: result.keyTopics.length,
    entityCount: result.extractedEntities.length,
    suggestedReportType: result.suggestedReportType,
  });

  return result;
}

export default { buildKnowledgeMap };
