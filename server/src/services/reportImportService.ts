import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import DbPromise from '../utils/DbPromise.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import { baseStorageDir } from '../utils/storagePaths.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from './initiativeProjectPolicyService.js';
import PDFParserService from './pdfParserService.js';

/**
 * Report Import Service
 *
 * AI-powered service for importing external assessment reports (DRD, SIRI, ADMA).
 * Handles file parsing, framework detection, score extraction, and mapping to system structures.
 */

// ============================================
// TYPES
// ============================================

export type SupportedFramework = 'DRD' | 'SIRI' | 'ADMA';
export type SupportedFormat = 'pdf' | 'xlsx' | 'docx' | 'json' | 'csv';
export type ImportStatus =
  | 'pending'
  | 'detecting'
  | 'extracting'
  | 'ready_for_review'
  | 'assessment_created'
  | 'initiatives_created'
  | 'completed'
  | 'failed';
export type TargetType = 'assessment' | 'report';

export interface ExtractedInitiative {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  effort?: 'low' | 'medium' | 'high';
  impact?: 'low' | 'medium' | 'high';
  timeline?: string;
  category?: string;
  sourceSection?: string;
}

export interface ExtractedMetadata {
  sourceFileName: string;
  assessmentDate?: string;
  organizationName?: string;
  assessorName?: string;
  frameworkVersion?: string;
}

export interface DRDExtractedScores {
  axes: Record<
    string,
    {
      actual: number;
      target?: number;
    }
  >;
  areas: Record<
    string,
    {
      actual: number;
      target?: number;
      notes?: string;
    }
  >;
  overallScore?: number;
}

export interface SIRIExtractedScores {
  blocks: Record<
    string,
    {
      current: number;
      target?: number;
    }
  >;
  dimensions: Record<
    string,
    {
      current: number;
      target?: number;
    }
  >;
  prioritisation?: Record<string, number>;
  overallScore?: number;
}

export interface ADMAExtractedScores {
  pillars: Record<
    string,
    {
      current: number;
      target?: number;
    }
  >;
  dimensions: Record<
    string,
    {
      current: number;
      target?: number;
    }
  >;
  overallMaturity?: number;
}

export type ExtractedScores = DRDExtractedScores | SIRIExtractedScores | ADMAExtractedScores;

export interface ExtractionDetails {
  fieldsFound: string[];
  fieldsMissing: string[];
  warnings: string[];
  rawTextLength?: number;
  extractionMethod?: string;
}

export interface ExtractedReportData {
  framework: SupportedFramework;
  confidence: number; // 0-100
  metadata: ExtractedMetadata;
  scores: ExtractedScores;
  rawText: string;
  canonicalMarkdown?: string;
  autoSummary?: string;
  initiatives?: ExtractedInitiative[];
  extractionDetails: ExtractionDetails;
  coveragePercent?: number;
}

export interface ImportedReport {
  id: string;
  organizationId: string;
  projectId?: string;
  sourceFileName: string;
  sourceFilePath?: string;
  sourceFileSize?: number;
  sourceFormat: SupportedFormat;
  detectedFramework: SupportedFramework;
  detectionConfidence: number;
  extractedData: ExtractedReportData | null;
  mappedData: any;
  extractionDetails: ExtractionDetails;
  documentMetadata: ExtractedMetadata;
  canonicalMarkdown?: string;
  autoSummary?: string;
  coveragePercent?: number;
  targetType?: TargetType;
  targetId?: string;
  initiativesCreated?: number;
  initiativesTargetIds?: string[];
  status: ImportStatus;
  processingError?: string;
  processingLog?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface DetectionResult {
  framework: SupportedFramework;
  confidence: number;
  indicators: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0-100
}

// ============================================
// FRAMEWORK DETECTION PATTERNS
// ============================================

const FRAMEWORK_PATTERNS: Record<SupportedFramework, { keywords: string[]; patterns: RegExp[] }> = {
  DRD: {
    keywords: [
      'Digital Readiness Diagnosis',
      'DRD',
      'Digital Pathfinder',
      'Cyfrowa Gotowość',
      'Diagnoza Cyfrowej Gotowości',
      'Digital Processes',
      'Digital Products',
      'Digital Business Models',
      'Data Management',
      'Culture of Transformation',
      'Cybersecurity',
      'AI Maturity',
      'Procesy Cyfrowe',
      'Produkty Cyfrowe',
      'Cyfrowe Modele Biznesowe',
      'Zarządzanie Danymi',
      'Kultura Transformacji',
      'Cyberbezpieczeństwo',
      'Dojrzałość AI',
    ],
    patterns: [
      /axis\s*[1-7]/gi,
      /area\s*[1-7][A-I]/gi,
      /level\s*[1-7]/gi,
      /oś\s*[1-7]/gi,
      /obszar\s*[1-7][A-I]/gi,
      /poziom\s*[1-7]/gi,
    ],
  },
  SIRI: {
    keywords: [
      'Smart Industry Readiness Index',
      'SIRI',
      'Singapore EDB',
      'TÜV SÜD',
      'Building Block',
      'Process Block',
      'Technology Block',
      'Organization Block',
      'Prioritisation Area',
      'Vertical Integration',
      'Horizontal Integration',
      'Shop Floor',
      'Enterprise',
      'Facility',
      'Talent Readiness',
      'Structure Management',
    ],
    patterns: [
      /band\s*[0-5]/gi,
      /level\s*[0-5]/gi,
      /maturity\s*(level|band)/gi,
      /prioritisation\s*matrix/gi,
      /building\s*block/gi,
    ],
  },
  ADMA: {
    keywords: [
      'Advanced Digital Maturity Assessment',
      'ADMA',
      'Digital Innovation Hub',
      'European Commission',
      'Smart Products',
      'Smart Operations',
      'Smart Supply Chain',
      'Data-Driven Services',
      'Digital Strategy',
      'Digital Investments',
      'Digital Culture',
      'Production Technologies',
      'Production IT',
      'Supply Chain Integration',
      'Supply Chain Visibility',
      'Data Collection',
      'Data Analytics',
      'Data-Based Services',
      'Inteligentne Produkty',
      'Inteligentne Operacje',
      'Inteligentny Łańcuch Dostaw',
    ],
    patterns: [
      /pillar/gi,
      /newcomer|beginner|intermediate|experienced|expert/gi,
      /maturity\s*level\s*[1-5]/gi,
      /filar/gi,
    ],
  },
};

// ============================================
// DRD STRUCTURE REFERENCE
// ============================================

const DRD_AXES = [
  { id: 1, name: 'Digital Processes', namePL: 'Procesy Cyfrowe', levelCount: 7 },
  { id: 2, name: 'Digital Products', namePL: 'Produkty Cyfrowe', levelCount: 5 },
  { id: 3, name: 'Digital Business Models', namePL: 'Cyfrowe Modele Biznesowe', levelCount: 5 },
  { id: 4, name: 'Data Management', namePL: 'Zarządzanie Danymi', levelCount: 7 },
  { id: 5, name: 'Culture of Transformation', namePL: 'Kultura Transformacji', levelCount: 5 },
  { id: 6, name: 'Cybersecurity', namePL: 'Cyberbezpieczeństwo', levelCount: 5 },
  { id: 7, name: 'AI Maturity', namePL: 'Dojrzałość AI', levelCount: 5 },
];

const DRD_AREAS: Record<number, string[]> = {
  1: ['1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H', '1I'],
  2: ['2A', '2B', '2C', '2D', '2E'],
  3: ['3A', '3B', '3C', '3D', '3E'],
  4: ['4A', '4B', '4C', '4D', '4E'],
  5: ['5A', '5B', '5C', '5D', '5E'],
  6: ['6A', '6B', '6C', '6D', '6E'],
  7: ['7A', '7B', '7C', '7D', '7E'],
};

// ============================================
// SIRI STRUCTURE REFERENCE
// ============================================

const SIRI_DIMENSIONS = [
  'operations',
  'supply_chain',
  'product_lifecycle',
  'automation',
  'connectivity',
  'intelligence',
  'talent_readiness',
  'structure_management',
];

const SIRI_BLOCKS = ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'];

// ============================================
// ADMA STRUCTURE REFERENCE
// ============================================

const ADMA_PILLARS = [
  'strategy',
  'smart_products',
  'smart_operations',
  'smart_supply',
  'data_driven',
];

const ADMA_DIMENSIONS = [
  'digital_strategy',
  'digital_investments',
  'digital_culture',
  'product_features',
  'product_data',
  'production_tech',
  'production_it',
  'supply_integration',
  'supply_visibility',
  'data_collection',
  'data_analytics',
  'data_services',
];

// ============================================
// SERVICE CLASS
// ============================================

class ReportImportService {
  private db: any;
  private aiService: any;
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(baseStorageDir(), 'uploads', 'imports');
  }

  setDependencies(deps: { db: any; aiService?: any }) {
    this.db = deps.db;
    this.aiService = deps.aiService;
  }

  // ============================================
  // FILE UPLOAD & STORAGE
  // ============================================

  /**
   * Upload and store file for processing
   */
  async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    organizationId: string,
    userId: string,
    projectId?: string
  ): Promise<ImportedReport> {
    const importId = uuidv4();
    const format = this.detectFormat(file.originalname, file.mimetype);

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    // Save file
    const fileName = `${importId}_${file.originalname}`;
    const filePath = path.join(this.uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    // Create import record
    const sql = `
      INSERT INTO imported_reports (
        id, organization_id, project_id,
        source_file_name, source_file_path, source_file_size, source_format,
        detected_framework, detection_confidence,
        status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRD', 0, 'pending', ?, CURRENT_TIMESTAMP)
    `;

    await DbPromise.run(sql, [
      importId,
      organizationId,
      projectId || null,
      file.originalname,
      filePath,
      file.size,
      format,
      userId,
    ]);

    logger.info(`[ReportImport] File uploaded: ${importId}`);

    return this.getImport(importId, organizationId);
  }

  /**
   * Detect file format from extension and mimetype
   */
  private detectFormat(filename: string, mimetype: string): SupportedFormat {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.pdf' || mimetype === 'application/pdf') return 'pdf';
    if (ext === '.xlsx' || mimetype.includes('spreadsheet')) return 'xlsx';
    if (ext === '.docx' || mimetype.includes('word')) return 'docx';
    if (ext === '.json' || mimetype === 'application/json') return 'json';
    if (ext === '.csv' || mimetype === 'text/csv') return 'csv';

    // Default to pdf for unknown
    return 'pdf';
  }

  // ============================================
  // FRAMEWORK DETECTION
  // ============================================

  /**
   * Detect framework from document text
   */
  detectFramework(text: string): DetectionResult {
    const results: { framework: SupportedFramework; score: number; indicators: string[] }[] = [];

    for (const [framework, config] of Object.entries(FRAMEWORK_PATTERNS)) {
      let score = 0;
      const indicators: string[] = [];
      const textLower = text.toLowerCase();

      // Check keywords
      for (const keyword of config.keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          score += 10;
          indicators.push(`Keyword: "${keyword}"`);
        }
      }

      // Check patterns
      for (const pattern of config.patterns) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          score += 5 * Math.min(matches.length, 5);
          indicators.push(`Pattern match: ${matches.slice(0, 3).join(', ')}`);
        }
      }

      results.push({
        framework: framework as SupportedFramework,
        score,
        indicators,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const best = results[0];
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);

    // Calculate confidence as percentage of total
    const confidence =
      totalScore > 0 ? Math.min(100, Math.round((best.score / totalScore) * 100)) : 0;

    return {
      framework: best.framework,
      confidence,
      indicators: best.indicators,
    };
  }

  /**
   * Detect framework using AI for more accurate results
   */
  async detectFrameworkWithAI(text: string): Promise<DetectionResult> {
    // First try pattern-based detection
    const patternResult = this.detectFramework(text);

    // If confidence is high enough, use pattern result
    if (patternResult.confidence >= 80) {
      return patternResult;
    }

    // Use AI for better detection
    if (this.aiService) {
      try {
        const prompt = `Analyze the following document text and determine which digital maturity assessment framework it belongs to.

Possible frameworks:
1. DRD (Digital Readiness Diagnosis) - 7 axes: Digital Processes, Digital Products, Digital Business Models, Data Management, Culture of Transformation, Cybersecurity, AI Maturity. Scale 1-7 or 1-5 depending on axis.
2. SIRI (Smart Industry Readiness Index) - 3 building blocks: Process, Technology, Organization. 8 dimensions. Scale 0-5.
3. ADMA (Advanced Digital Maturity Assessment) - 5 pillars: Strategy, Smart Products, Smart Operations, Smart Supply Chain, Data-Driven. 12 dimensions. Scale 1-5.

Document text (first 3000 characters):
${text.substring(0, 3000)}

Respond in JSON format:
{
  "framework": "DRD" | "SIRI" | "ADMA",
  "confidence": 0-100,
  "reasoning": "explanation"
}`;

        const response = await this.aiService.generateText(prompt, {
          maxTokens: 500,
          temperature: 0.1,
        });

        const parsed = JSON.parse(response);
        return {
          framework: parsed.framework,
          confidence: parsed.confidence,
          indicators: [parsed.reasoning],
        };
      } catch (error) {
        logger.warn('[ReportImport] AI detection failed, using pattern-based result');
      }
    }

    return patternResult;
  }

  // ============================================
  // SCORE EXTRACTION
  // ============================================

  /**
   * Extract scores from document text based on detected framework
   */
  async extractScores(text: string, framework: SupportedFramework): Promise<ExtractedScores> {
    switch (framework) {
      case 'DRD':
        return this.extractDRDScores(text);
      case 'SIRI':
        return this.extractSIRIScores(text);
      case 'ADMA':
        return this.extractADMAScores(text);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Extract DRD scores from text
   */
  private extractDRDScores(text: string): DRDExtractedScores {
    const scores: DRDExtractedScores = {
      axes: {},
      areas: {},
    };

    // Extract axis scores
    for (const axis of DRD_AXES) {
      // Try various patterns for axis scores
      const patterns = [
        new RegExp(`${axis.name}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
        new RegExp(`${axis.namePL}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
        new RegExp(`Axis\\s*${axis.id}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
        new RegExp(`Oś\\s*${axis.id}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          const actual = parseFloat(match[1]);
          const target = match[2] ? parseFloat(match[2]) : undefined;

          if (actual >= 1 && actual <= axis.levelCount) {
            scores.axes[axis.id.toString()] = { actual, target };
            break;
          }
        }
      }
    }

    // Extract area scores
    for (const [axisId, areas] of Object.entries(DRD_AREAS)) {
      for (const areaId of areas) {
        const patterns = [
          new RegExp(`${areaId}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
          new RegExp(`Area\\s*${areaId}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
          new RegExp(
            `Obszar\\s*${areaId}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`,
            'gi'
          ),
        ];

        for (const pattern of patterns) {
          const match = pattern.exec(text);
          if (match) {
            const actual = parseFloat(match[1]);
            const target = match[2] ? parseFloat(match[2]) : undefined;
            const axis = DRD_AXES.find((a) => a.id === parseInt(axisId));

            if (axis && actual >= 1 && actual <= axis.levelCount) {
              scores.areas[areaId] = { actual, target };
              break;
            }
          }
        }
      }
    }

    // Calculate overall score
    const axisScores = Object.values(scores.axes).map((s) => s.actual);
    if (axisScores.length > 0) {
      scores.overallScore =
        Math.round((axisScores.reduce((a, b) => a + b, 0) / axisScores.length) * 10) / 10;
    }

    return scores;
  }

  /**
   * Extract SIRI scores from text
   */
  private extractSIRIScores(text: string): SIRIExtractedScores {
    const scores: SIRIExtractedScores = {
      blocks: {},
      dimensions: {},
      prioritisation: {},
    };

    // Extract block scores
    for (const block of SIRI_BLOCKS) {
      const patterns = [
        new RegExp(`${block}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
        new RegExp(`${block}\\s*Block[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          const current = parseFloat(match[1]);
          const target = match[2] ? parseFloat(match[2]) : undefined;

          if (current >= 0 && current <= 5) {
            scores.blocks[block] = { current, target };
            break;
          }
        }
      }
    }

    // Extract dimension scores
    for (const dim of SIRI_DIMENSIONS) {
      const dimName = dim.replace(/_/g, ' ');
      const patterns = [
        new RegExp(`${dimName}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          const current = parseFloat(match[1]);
          const target = match[2] ? parseFloat(match[2]) : undefined;

          if (current >= 0 && current <= 5) {
            scores.dimensions[dim] = { current, target };
            break;
          }
        }
      }
    }

    // Calculate overall score
    const dimScores = Object.values(scores.dimensions).map((s) => s.current);
    if (dimScores.length > 0) {
      scores.overallScore =
        Math.round((dimScores.reduce((a, b) => a + b, 0) / dimScores.length) * 10) / 10;
    }

    return scores;
  }

  /**
   * Extract ADMA scores from text
   */
  private extractADMAScores(text: string): ADMAExtractedScores {
    const scores: ADMAExtractedScores = {
      pillars: {},
      dimensions: {},
    };

    // Extract pillar scores
    const pillarNames: Record<string, string[]> = {
      strategy: ['Strategy', 'Strategy & Organization', 'Strategia'],
      smart_products: ['Smart Products', 'Inteligentne Produkty'],
      smart_operations: ['Smart Operations', 'Inteligentne Operacje'],
      smart_supply: ['Smart Supply Chain', 'Supply Chain', 'Łańcuch Dostaw'],
      data_driven: ['Data-Driven', 'Data Driven', 'Dane'],
    };

    for (const [pillarId, names] of Object.entries(pillarNames)) {
      for (const name of names) {
        const pattern = new RegExp(
          `${name}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`,
          'gi'
        );
        const match = pattern.exec(text);
        if (match) {
          const current = parseFloat(match[1]);
          const target = match[2] ? parseFloat(match[2]) : undefined;

          if (current >= 1 && current <= 5) {
            scores.pillars[pillarId] = { current, target };
            break;
          }
        }
      }
    }

    // Extract dimension scores
    for (const dim of ADMA_DIMENSIONS) {
      const dimName = dim.replace(/_/g, ' ');
      const patterns = [
        new RegExp(`${dimName}[:\\s]*(\\d+(?:\\.\\d+)?)[\\s/]*(\\d+(?:\\.\\d+)?)?`, 'gi'),
      ];

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          const current = parseFloat(match[1]);
          const target = match[2] ? parseFloat(match[2]) : undefined;

          if (current >= 1 && current <= 5) {
            scores.dimensions[dim] = { current, target };
            break;
          }
        }
      }
    }

    // Calculate overall maturity
    const dimScores = Object.values(scores.dimensions).map((s) => s.current);
    if (dimScores.length > 0) {
      scores.overallMaturity =
        Math.round((dimScores.reduce((a, b) => a + b, 0) / dimScores.length) * 10) / 10;
    }

    return scores;
  }

  /**
   * Extract scores using AI for more accurate results
   */
  async extractScoresWithAI(text: string, framework: SupportedFramework): Promise<ExtractedScores> {
    // First try pattern-based extraction
    const patternScores = await this.extractScores(text, framework);

    // If we got enough scores, use them
    const scoreCount = this.countExtractedScores(patternScores, framework);
    if (scoreCount >= 5) {
      return patternScores;
    }

    // Use AI for better extraction
    if (this.aiService) {
      try {
        let prompt = '';

        if (framework === 'DRD') {
          prompt = `Extract DRD (Digital Readiness Diagnosis) scores from the following document.

DRD has 7 axes:
1. Digital Processes (9 areas: 1A-1I, scale 1-7)
2. Digital Products (5 areas: 2A-2E, scale 1-5)
3. Digital Business Models (5 areas: 3A-3E, scale 1-5)
4. Data Management (5 areas: 4A-4E, scale 1-7)
5. Culture of Transformation (5 areas: 5A-5E, scale 1-5)
6. Cybersecurity (5 areas: 6A-6E, scale 1-5)
7. AI Maturity (5 areas: 7A-7E, scale 1-5)

Document text:
${text.substring(0, 8000)}

Extract and return JSON:
{
  "axes": { "1": { "actual": number, "target": number }, ... },
  "areas": { "1A": { "actual": number, "target": number }, ... },
  "overallScore": number
}`;
        } else if (framework === 'SIRI') {
          prompt = `Extract SIRI (Smart Industry Readiness Index) scores from the following document.

SIRI has 3 building blocks and 8 dimensions (scale 0-5):
- PROCESS: operations, supply_chain, product_lifecycle
- TECHNOLOGY: automation, connectivity, intelligence
- ORGANIZATION: talent_readiness, structure_management

Document text:
${text.substring(0, 8000)}

Extract and return JSON:
{
  "blocks": { "PROCESS": { "current": number, "target": number }, ... },
  "dimensions": { "operations": { "current": number, "target": number }, ... },
  "overallScore": number
}`;
        } else {
          prompt = `Extract ADMA (Advanced Digital Maturity Assessment) scores from the following document.

ADMA has 5 pillars and 12 dimensions (scale 1-5):
- strategy: digital_strategy, digital_investments, digital_culture
- smart_products: product_features, product_data
- smart_operations: production_tech, production_it
- smart_supply: supply_integration, supply_visibility
- data_driven: data_collection, data_analytics, data_services

Document text:
${text.substring(0, 8000)}

Extract and return JSON:
{
  "pillars": { "strategy": { "current": number, "target": number }, ... },
  "dimensions": { "digital_strategy": { "current": number, "target": number }, ... },
  "overallMaturity": number
}`;
        }

        const response = await this.aiService.generateText(prompt, {
          maxTokens: 2000,
          temperature: 0.1,
        });

        return JSON.parse(response);
      } catch (error) {
        logger.warn('[ReportImport] AI extraction failed, using pattern-based result');
      }
    }

    return patternScores;
  }

  /**
   * Count extracted scores
   */
  private countExtractedScores(scores: ExtractedScores, framework: SupportedFramework): number {
    if (framework === 'DRD') {
      const drd = scores as DRDExtractedScores;
      return Object.keys(drd.axes).length + Object.keys(drd.areas).length;
    } else if (framework === 'SIRI') {
      const siri = scores as SIRIExtractedScores;
      return Object.keys(siri.blocks).length + Object.keys(siri.dimensions).length;
    } else {
      const adma = scores as ADMAExtractedScores;
      return Object.keys(adma.pillars).length + Object.keys(adma.dimensions).length;
    }
  }

  // ============================================
  // MAPPING TO SYSTEM STRUCTURES
  // ============================================

  /**
   * Map extracted scores to Assessment structure
   */
  mapToAssessment(
    scores: ExtractedScores,
    framework: SupportedFramework,
    metadata: ExtractedMetadata
  ): any {
    const assessmentData: any = {
      assessment_type: framework,
      name: `Imported ${framework} Assessment`,
      status: 'DRAFT',
      answers_json: {},
      score_summary: {},
      context_snapshot: {
        importedFrom: metadata.sourceFileName,
        importDate: new Date().toISOString(),
        originalAssessmentDate: metadata.assessmentDate,
      },
    };

    if (framework === 'DRD') {
      const drd = scores as DRDExtractedScores;
      assessmentData.answers_json = {
        drd: {
          areas: {},
        },
      };

      // Map areas
      for (const [areaId, score] of Object.entries(drd.areas)) {
        assessmentData.answers_json.drd.areas[areaId] = {
          achievedLevel: score.actual,
          targetLevel: score.target || score.actual,
          levelNotes: {},
        };
      }

      // If we only have axis scores, distribute to areas
      if (Object.keys(drd.areas).length === 0 && Object.keys(drd.axes).length > 0) {
        for (const [axisId, axisScore] of Object.entries(drd.axes)) {
          const areas = DRD_AREAS[parseInt(axisId)] || [];
          for (const areaId of areas) {
            assessmentData.answers_json.drd.areas[areaId] = {
              achievedLevel: axisScore.actual,
              targetLevel: axisScore.target || axisScore.actual,
              levelNotes: {},
            };
          }
        }
      }

      assessmentData.score_summary = {
        overall: drd.overallScore || 0,
        axes: drd.axes,
      };
    } else if (framework === 'SIRI') {
      const siri = scores as SIRIExtractedScores;
      assessmentData.answers_json = {
        siri: {
          buildingBlocks: siri.blocks,
          dimensions: siri.dimensions,
          prioritisationMatrix: siri.prioritisation || {},
        },
      };
      assessmentData.score_summary = {
        overall: siri.overallScore || 0,
        blocks: siri.blocks,
        dimensions: siri.dimensions,
      };
    } else {
      const adma = scores as ADMAExtractedScores;
      assessmentData.answers_json = {
        adma: {
          pillars: adma.pillars,
          dimensions: adma.dimensions,
        },
      };
      assessmentData.score_summary = {
        overall: adma.overallMaturity || 0,
        pillars: adma.pillars,
        dimensions: adma.dimensions,
      };
    }

    return assessmentData;
  }

  /**
   * Map extracted scores to Report structure
   */
  mapToReport(
    scores: ExtractedScores,
    framework: SupportedFramework,
    metadata: ExtractedMetadata
  ): any {
    const reportData: any = {
      source_type: 'ASSESSMENT',
      source_framework: framework,
      name: `Imported ${framework} Report`,
      status: 'GENERATED',
      intent_config: {
        audience: 'management',
        goal: 'review',
        language: 'pl',
        tone: 'professional',
        scope: 'full',
      },
      sections_config: [],
      generated_content: {
        importedFrom: metadata.sourceFileName,
        importDate: new Date().toISOString(),
        scores: scores,
      },
    };

    return reportData;
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate extracted data
   */
  validateExtraction(scores: ExtractedScores, framework: SupportedFramework): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let completeness = 0;

    if (framework === 'DRD') {
      const drd = scores as DRDExtractedScores;
      const totalAreas = 34;
      const foundAreas = Object.keys(drd.areas).length;
      const foundAxes = Object.keys(drd.axes).length;

      completeness = Math.round(((foundAreas + foundAxes * 5) / totalAreas) * 100);

      if (foundAreas === 0 && foundAxes === 0) {
        errors.push('No DRD scores found in document');
      }

      if (foundAreas < 10 && foundAxes < 3) {
        warnings.push(
          `Only ${foundAreas} areas and ${foundAxes} axes found. Consider manual review.`
        );
      }

      // Validate score ranges
      for (const [areaId, score] of Object.entries(drd.areas)) {
        const axisId = parseInt(areaId.charAt(0));
        const axis = DRD_AXES.find((a) => a.id === axisId);
        if (axis && (score.actual < 1 || score.actual > axis.levelCount)) {
          errors.push(
            `Invalid score for ${areaId}: ${score.actual} (should be 1-${axis.levelCount})`
          );
        }
      }
    } else if (framework === 'SIRI') {
      const siri = scores as SIRIExtractedScores;
      const totalDimensions = 8;
      const foundDimensions = Object.keys(siri.dimensions).length;

      completeness = Math.round((foundDimensions / totalDimensions) * 100);

      if (foundDimensions === 0) {
        errors.push('No SIRI dimension scores found in document');
      }

      // Validate score ranges (0-5)
      for (const [dimId, score] of Object.entries(siri.dimensions)) {
        if (score.current < 0 || score.current > 5) {
          errors.push(`Invalid score for ${dimId}: ${score.current} (should be 0-5)`);
        }
      }
    } else {
      const adma = scores as ADMAExtractedScores;
      const totalDimensions = 12;
      const foundDimensions = Object.keys(adma.dimensions).length;

      completeness = Math.round((foundDimensions / totalDimensions) * 100);

      if (foundDimensions === 0) {
        errors.push('No ADMA dimension scores found in document');
      }

      // Validate score ranges (1-5)
      for (const [dimId, score] of Object.entries(adma.dimensions)) {
        if (score.current < 1 || score.current > 5) {
          errors.push(`Invalid score for ${dimId}: ${score.current} (should be 1-5)`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness,
    };
  }

  // ============================================
  // FULL PROCESSING PIPELINE
  // ============================================

  /**
   * Process uploaded file - detect framework and extract scores
   */
  async processImport(importId: string, organizationId: string): Promise<ExtractedReportData> {
    const importRecord = await this.getImport(importId, organizationId);

    if (!importRecord.sourceFilePath || !fs.existsSync(importRecord.sourceFilePath)) {
      throw new Error('Source file not found');
    }

    // Update status to detecting
    await this.updateStatus(importId, 'detecting');

    // Extract text from file
    const rawText = await this.extractText(importRecord.sourceFilePath, importRecord.sourceFormat);

    // Detect framework
    const detection = await this.detectFrameworkWithAI(rawText);

    // Update status to extracting
    await this.updateStatus(importId, 'extracting');

    // Extract scores
    const scores = await this.extractScoresWithAI(rawText, detection.framework);

    // Extract metadata
    const metadata = this.extractMetadata(rawText, importRecord.sourceFileName);

    // Validate extraction
    const validation = this.validateExtraction(scores, detection.framework);

    const extractionDetails: ExtractionDetails = {
      fieldsFound: this.getFoundFields(scores, detection.framework),
      fieldsMissing: this.getMissingFields(scores, detection.framework),
      warnings: validation.warnings,
      rawTextLength: rawText.length,
      extractionMethod: this.aiService ? 'ai_assisted' : 'pattern_based',
    };

    // Extract initiatives
    const initiatives = await this.extractInitiatives(rawText, detection.framework);

    const extractedData: ExtractedReportData = {
      framework: detection.framework,
      confidence: detection.confidence,
      metadata,
      scores,
      rawText: rawText.substring(0, 10000),
      canonicalMarkdown: rawText.substring(0, 50000),
      initiatives,
      extractionDetails,
      coveragePercent: validation.completeness,
    };

    // Generate auto-summary
    extractedData.autoSummary = this.generateAutoSummary(extractedData);

    // Update database
    await this.updateExtractedData(
      importId,
      extractedData,
      detection.framework,
      detection.confidence
    );

    logger.info(
      `[ReportImport] Processing complete: ${importId}, framework: ${detection.framework}, initiatives: ${initiatives.length}`
    );

    return extractedData;
  }

  /**
   * Extract text from file based on format
   */
  private async extractText(filePath: string, format: SupportedFormat): Promise<string> {
    if (format === 'json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.stringify(JSON.parse(content), null, 2);
    }

    if (format === 'csv') {
      return fs.readFileSync(filePath, 'utf-8');
    }

    if (format === 'pdf') {
      try {
        const buffer = fs.readFileSync(filePath);
        const text = await PDFParserService.extractTextFromBuffer(buffer);
        logger.info(`[ReportImport] PDF parsed: ${text.length} chars`);
        return text;
      } catch (err: any) {
        logger.warn(`[ReportImport] pdf-parse failed: ${err.message}, falling back to raw read`);
        // Fallback: try to read as text
        try {
          return fs.readFileSync(filePath, 'utf-8');
        } catch {
          return `[PDF parsing failed: ${err.message}]`;
        }
      }
    }

    // For DOCX/XLSX, try to read as text (basic fallback)
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content;
    } catch {
      return `[Binary file - requires specialized parser for ${format}]`;
    }
  }

  /**
   * Extract metadata from document text
   */
  private extractMetadata(text: string, fileName: string): ExtractedMetadata {
    const metadata: ExtractedMetadata = {
      sourceFileName: fileName,
    };

    // Try to extract date
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{2}[./-]\d{2}[./-]\d{4})/,
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.assessmentDate = match[1];
        break;
      }
    }

    // Try to extract organization name
    const orgPatterns = [
      /(?:Company|Organization|Firma|Organizacja)[:\s]+([A-Z][A-Za-z\s]+(?:Ltd|Inc|GmbH|S\.A\.|Sp\. z o\.o\.)?)/i,
    ];

    for (const pattern of orgPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.organizationName = match[1].trim();
        break;
      }
    }

    return metadata;
  }

  /**
   * Get list of found fields
   */
  private getFoundFields(scores: ExtractedScores, framework: SupportedFramework): string[] {
    const fields: string[] = [];

    if (framework === 'DRD') {
      const drd = scores as DRDExtractedScores;
      fields.push(...Object.keys(drd.axes).map((k) => `Axis ${k}`));
      fields.push(...Object.keys(drd.areas).map((k) => `Area ${k}`));
    } else if (framework === 'SIRI') {
      const siri = scores as SIRIExtractedScores;
      fields.push(...Object.keys(siri.blocks).map((k) => `Block ${k}`));
      fields.push(...Object.keys(siri.dimensions).map((k) => `Dimension ${k}`));
    } else {
      const adma = scores as ADMAExtractedScores;
      fields.push(...Object.keys(adma.pillars).map((k) => `Pillar ${k}`));
      fields.push(...Object.keys(adma.dimensions).map((k) => `Dimension ${k}`));
    }

    return fields;
  }

  /**
   * Get list of missing fields
   */
  private getMissingFields(scores: ExtractedScores, framework: SupportedFramework): string[] {
    const missing: string[] = [];

    if (framework === 'DRD') {
      const drd = scores as DRDExtractedScores;
      for (const axis of DRD_AXES) {
        if (!drd.axes[axis.id.toString()]) {
          missing.push(`Axis ${axis.id}`);
        }
      }
      for (const [axisId, areas] of Object.entries(DRD_AREAS)) {
        for (const areaId of areas) {
          if (!drd.areas[areaId]) {
            missing.push(`Area ${areaId}`);
          }
        }
      }
    } else if (framework === 'SIRI') {
      const siri = scores as SIRIExtractedScores;
      for (const dim of SIRI_DIMENSIONS) {
        if (!siri.dimensions[dim]) {
          missing.push(`Dimension ${dim}`);
        }
      }
    } else {
      const adma = scores as ADMAExtractedScores;
      for (const dim of ADMA_DIMENSIONS) {
        if (!adma.dimensions[dim]) {
          missing.push(`Dimension ${dim}`);
        }
      }
    }

    return missing;
  }

  // ============================================
  // INITIATIVE EXTRACTION
  // ============================================

  /**
   * Extract initiatives from document text using pattern matching + AI
   */
  async extractInitiatives(
    text: string,
    framework: SupportedFramework
  ): Promise<ExtractedInitiative[]> {
    const initiatives: ExtractedInitiative[] = [];

    // Pattern-based extraction: look for numbered initiative lists
    const initiativePatterns = [
      // "Initiative N:" or "Inicjatywa N:"
      /(?:Initiative|Inicjatywa|Recommendation|Rekomendacja)\s*[\d#]+[:.]\s*(.+?)(?:\n|$)/gi,
      // Bullet points with action verbs
      /[-•]\s*((?:Implement|Deploy|Develop|Create|Build|Migrate|Upgrade|Automate|Optimize|Establish|Design|Launch|Integrate|Wdrożyć|Opracować|Stworzyć|Zbudować|Zmigrować|Zautomatyzować|Zoptymalizować)\s+.+?)(?:\n|$)/gi,
      // Numbered lists (1. / 1) style)
      /(?:^|\n)\s*\d+[.)]\s*((?:Implement|Deploy|Develop|Create|Build|Migrate|Upgrade|Automate|Optimize|Establish|Design|Launch|Integrate|Wdrożyć|Opracować|Stworzyć|Zbudować|Zmigrować|Zautomatyzować|Zoptymalizować)\s+.+?)(?:\n|$)/gi,
    ];

    for (const pattern of initiativePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const title = match[1]?.trim();
        if (title && title.length > 10 && title.length < 500) {
          // Avoid duplicates
          if (!initiatives.find((i) => i.title.toLowerCase() === title.toLowerCase())) {
            initiatives.push({
              title,
              priority: 'medium',
              sourceSection: 'pattern_extraction',
            });
          }
        }
      }
    }

    // If AI service is available, use it for better extraction
    if (this.aiService && text.length > 500) {
      try {
        const prompt = `Extract all initiatives, recommendations, and action items from the following assessment report.
For each initiative, provide:
- title: concise name (max 100 chars)
- description: brief description (max 300 chars)
- priority: low/medium/high/critical
- effort: low/medium/high
- impact: low/medium/high
- timeline: when should be implemented (e.g. "Q1 2026", "3-6 months")
- category: area/axis this initiative relates to

Document text (first 10000 characters):
${text.substring(0, 10000)}

Respond in JSON format:
{
  "initiatives": [
    { "title": "...", "description": "...", "priority": "...", "effort": "...", "impact": "...", "timeline": "...", "category": "..." }
  ]
}`;

        const response = await this.aiService.generateText(prompt, {
          maxTokens: 4000,
          temperature: 0.2,
        });

        const parsed = JSON.parse(response);
        if (Array.isArray(parsed.initiatives) && parsed.initiatives.length > 0) {
          return parsed.initiatives.map((init: any) => ({
            title: String(init.title || '').substring(0, 200),
            description: String(init.description || '').substring(0, 500),
            priority: ['low', 'medium', 'high', 'critical'].includes(init.priority)
              ? init.priority
              : 'medium',
            effort: ['low', 'medium', 'high'].includes(init.effort) ? init.effort : 'medium',
            impact: ['low', 'medium', 'high'].includes(init.impact) ? init.impact : 'medium',
            timeline: String(init.timeline || ''),
            category: String(init.category || ''),
            sourceSection: 'ai_extraction',
          }));
        }
      } catch (error) {
        logger.warn('[ReportImport] AI initiative extraction failed, using pattern-based results');
      }
    }

    return initiatives;
  }

  // ============================================
  // AUTO-SUMMARY GENERATION
  // ============================================

  /**
   * Generate auto-summary from extracted data
   */
  generateAutoSummary(data: ExtractedReportData): string {
    const { framework, metadata, scores, initiatives, extractionDetails } = data;
    const parts: string[] = [];

    parts.push(`## Imported ${framework} Assessment Report`);
    parts.push('');

    if (metadata.organizationName) {
      parts.push(`**Organization:** ${metadata.organizationName}`);
    }
    if (metadata.assessmentDate) {
      parts.push(`**Assessment Date:** ${metadata.assessmentDate}`);
    }
    parts.push(`**Source File:** ${metadata.sourceFileName}`);
    parts.push(`**Detection Confidence:** ${data.confidence}%`);
    parts.push('');

    // Scores summary
    if (framework === 'DRD') {
      const drd = scores as DRDExtractedScores;
      if (drd.overallScore) {
        parts.push(`### Overall Score: ${drd.overallScore}`);
      }
      const axisCount = Object.keys(drd.axes).length;
      const areaCount = Object.keys(drd.areas).length;
      parts.push(`**Axes recognized:** ${axisCount}/7`);
      parts.push(`**Areas recognized:** ${areaCount}/34`);

      if (axisCount > 0) {
        parts.push('');
        parts.push('### Axis Scores');
        for (const axis of DRD_AXES) {
          const axisScore = drd.axes[axis.id.toString()];
          if (axisScore) {
            parts.push(
              `- **${axis.name}**: ${axisScore.actual}${axisScore.target ? ` → ${axisScore.target}` : ''}`
            );
          } else {
            parts.push(`- **${axis.name}**: _not recognized_`);
          }
        }
      }
    }

    // Initiatives summary
    if (initiatives && initiatives.length > 0) {
      parts.push('');
      parts.push(`### Initiatives Extracted: ${initiatives.length}`);
      for (const init of initiatives.slice(0, 10)) {
        parts.push(`- ${init.title}`);
      }
      if (initiatives.length > 10) {
        parts.push(`- _...and ${initiatives.length - 10} more_`);
      }
    }

    // Coverage
    parts.push('');
    parts.push('### Extraction Quality');
    parts.push(`- **Fields found:** ${extractionDetails.fieldsFound.length}`);
    parts.push(`- **Fields missing:** ${extractionDetails.fieldsMissing.length}`);
    if (extractionDetails.warnings.length > 0) {
      parts.push(`- **Warnings:** ${extractionDetails.warnings.join('; ')}`);
    }

    return parts.join('\n');
  }

  // ============================================
  // CREATE ASSESSMENT FROM IMPORT
  // ============================================

  /**
   * Create Assessment from an imported report (separate action from confirm)
   */
  async createAssessmentFromImport(
    importId: string,
    organizationId: string,
    userId: string,
    projectId?: string
  ): Promise<{ assessmentId: string }> {
    const importRecord = await this.getImport(importId, organizationId);

    if (!importRecord.extractedData) {
      throw new Error('Import has not been processed yet. Call /detect first.');
    }

    if (importRecord.targetId) {
      throw new Error(`Assessment already created: ${importRecord.targetId}`);
    }

    const { scores, framework, metadata } = importRecord.extractedData;
    const assessmentId = await this.createAssessment(
      scores,
      framework,
      metadata,
      organizationId,
      userId,
      projectId || importRecord.projectId
    );

    // Update import record with assessment reference
    await this.updateTarget(importId, 'assessment', assessmentId);

    logger.info(`[ReportImport] Assessment created from import ${importId}: ${assessmentId}`);
    return { assessmentId };
  }

  // ============================================
  // CREATE INITIATIVES FROM IMPORT
  // ============================================

  /**
   * Create Initiatives from an imported report (separate action)
   */
  async createInitiativesFromImport(
    importId: string,
    organizationId: string,
    userId: string,
    projectId?: string
  ): Promise<{ initiativeIds: string[]; count: number }> {
    const importRecord = await this.getImport(importId, organizationId);

    if (!importRecord.extractedData) {
      throw new Error('Import has not been processed yet. Call /detect first.');
    }

    const initiatives = importRecord.extractedData.initiatives || [];
    if (initiatives.length === 0) {
      throw new Error('No initiatives found in the imported report.');
    }

    const initiativeIds: string[] = [];

    for (const init of initiatives) {
      try {
        // F15 (data-integrity, continuation of Z139): decode HTML entities the
        // global sanitizer escaped on the imported title before it feeds
        // initiatives.title/name — funnel branch AND raw-insert fallback
        // (INITIATIVE_FUNNEL_ENABLED is default OFF).
        const decodedTitle =
          typeof init.title === 'string' ? decodeHtmlEntities(init.title) : init.title;
        // Uspójnienie F1.6 — przez kanoniczny lejek. PENDING_REVIEW jest świadomym
        // statusem importu (ważny w cyklu) → przekazany jawnie; extra kolumny
        // (source_report_id/tags/created_from) ustawiane post-create.
        if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
          const __r = await funnelCreateInitiative(
            organizationId,
            {
              title: decodedTitle,
              projectId: projectId || importRecord.projectId || null,
              summary: init.description || '',
              description: init.description || '',
              priority: init.priority || 'medium',
              status: 'PENDING_REVIEW',
              sourceType: 'pdf_import',
              sourceId: importId,
            },
            { validate: false, actor: { id: userId } }
          );
          try {
            await DbPromise.run(
              `UPDATE initiatives SET source_report_id = ?, created_from = 'assessment', tags = ?, created_by = ?
               WHERE id = ? AND organization_id = ?`,
              [
                importId,
                JSON.stringify([init.category || 'imported', 'pdf-import']),
                userId,
                __r.id,
                organizationId,
              ]
            );
          } catch {
            /* extra columns best-effort */
          }
          initiativeIds.push(__r.id);
        } else {
          const initiativeId = uuidv4();
          const anchoredProjectId = await resolveInitiativeProjectId(
            organizationId,
            projectId || importRecord.projectId,
            { createdBy: userId ?? null }
          );
          const sql = `
        INSERT INTO initiatives (
          id, organization_id, project_id,
          title, name, summary, hypothesis, description,
          priority, status,
          source_type, source_id, source_report_id, created_from,
          tags,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', 'pdf_import', ?, ?, 'assessment', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
          await DbPromise.run(sql, [
            initiativeId,
            organizationId,
            anchoredProjectId,
            decodedTitle,
            decodedTitle,
            init.description || '',
            init.description || '',
            init.description || '',
            init.priority || 'medium',
            importId,
            importId,
            JSON.stringify([init.category || 'imported', 'pdf-import']),
            userId,
          ]);
          initiativeIds.push(initiativeId);
        }
      } catch (error: any) {
        logger.warn(`[ReportImport] Failed to create initiative "${init.title}":`, error.message);
      }
    }

    // Update import record with initiative references
    const updateSql = `
      UPDATE imported_reports
      SET initiatives_created = ?,
          initiatives_target_ids = ?,
          status = CASE WHEN target_id IS NOT NULL THEN 'completed' ELSE 'initiatives_created' END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await DbPromise.run(updateSql, [initiativeIds.length, JSON.stringify(initiativeIds), importId]);

    logger.info(
      `[ReportImport] ${initiativeIds.length} initiatives created from import ${importId}`
    );
    return { initiativeIds, count: initiativeIds.length };
  }

  // ============================================
  // CONFIRM & CREATE TARGET
  // ============================================

  /**
   * Confirm import and create target entity (Assessment or Report)
   */
  async confirmImport(
    importId: string,
    organizationId: string,
    targetType: TargetType,
    userId: string,
    projectId?: string,
    overrides?: Partial<ExtractedScores>
  ): Promise<{ targetId: string; targetType: TargetType }> {
    const importRecord = await this.getImport(importId, organizationId);

    if (importRecord.status !== 'ready_for_review') {
      throw new Error(`Import is not ready for confirmation. Status: ${importRecord.status}`);
    }

    const extractedData = importRecord.extractedData;
    if (!extractedData) {
      throw new Error('No extracted data available');
    }

    // Apply overrides if provided
    const finalScores = overrides
      ? { ...extractedData.scores, ...overrides }
      : extractedData.scores;

    let targetId: string;

    if (targetType === 'assessment') {
      targetId = await this.createAssessment(
        finalScores,
        extractedData.framework,
        extractedData.metadata,
        organizationId,
        userId,
        projectId
      );
    } else {
      targetId = await this.createReport(
        finalScores,
        extractedData.framework,
        extractedData.metadata,
        organizationId,
        userId,
        projectId
      );
    }

    // Update import record
    await this.updateTarget(importId, targetType, targetId);

    logger.info(`[ReportImport] Import confirmed: ${importId} -> ${targetType}:${targetId}`);

    return { targetId, targetType };
  }

  /**
   * Create Assessment from extracted data
   */
  private async createAssessment(
    scores: ExtractedScores,
    framework: SupportedFramework,
    metadata: ExtractedMetadata,
    organizationId: string,
    userId: string,
    projectId?: string
  ): Promise<string> {
    const assessmentId = uuidv4();
    const assessmentData = this.mapToAssessment(scores, framework, metadata);

    const sql = `
      INSERT INTO assessments (
        id, organization_id, project_id,
        assessment_type, name, status,
        answers_json, score_summary, context_snapshot,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await DbPromise.run(sql, [
      assessmentId,
      organizationId,
      projectId || null,
      assessmentData.assessment_type,
      assessmentData.name,
      assessmentData.status,
      JSON.stringify(assessmentData.answers_json),
      JSON.stringify(assessmentData.score_summary),
      JSON.stringify(assessmentData.context_snapshot),
      userId,
    ]);

    return assessmentId;
  }

  /**
   * Create Report from extracted data
   */
  private async createReport(
    scores: ExtractedScores,
    framework: SupportedFramework,
    metadata: ExtractedMetadata,
    organizationId: string,
    userId: string,
    projectId?: string
  ): Promise<string> {
    const reportId = uuidv4();
    const reportData = this.mapToReport(scores, framework, metadata);

    // Schema drift fix (Fala 4): the previous INSERT targeted non-existent
    // columns (name / intent_config / sections_config / generated_content) and
    // omitted NOT-NULL columns (source_id, title, report_type), so every import
    // "confirm as report" failed. Map the legacy import shape onto the canonical
    // report_builder_reports columns: name -> title, intent_config +
    // sections_config -> config_json, generated_content -> generation_metadata.
    const sql = `
      INSERT INTO report_builder_reports (
        id, organization_id, project_id,
        source_type, source_id, source_name, source_framework,
        title, report_type, config_json, generation_metadata, status,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await DbPromise.run(sql, [
      reportId,
      organizationId,
      projectId || null,
      reportData.source_type,
      reportId,
      reportData.name,
      reportData.source_framework || null,
      reportData.name,
      'assessment_import',
      JSON.stringify({
        intent: reportData.intent_config,
        sections: reportData.sections_config,
      }),
      JSON.stringify(reportData.generated_content),
      reportData.status,
      userId,
    ]);

    return reportId;
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  /**
   * Get import record by ID
   */
  async getImport(importId: string, organizationId: string): Promise<ImportedReport> {
    const sql = `SELECT * FROM imported_reports WHERE id = ? AND organization_id = ?`;
    const row: any = await DbPromise.get(sql, [importId, organizationId]);

    if (!row) {
      throw new Error('Import not found');
    }

    return this.mapRowToImport(row);
  }

  /**
   * List imports for organization
   */
  async listImports(
    organizationId: string,
    options?: {
      status?: ImportStatus;
      framework?: SupportedFramework;
      limit?: number;
      offset?: number;
    }
  ): Promise<ImportedReport[]> {
    let sql = `SELECT * FROM imported_reports WHERE organization_id = ?`;
    const params: any[] = [organizationId];

    if (options?.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }

    if (options?.framework) {
      sql += ` AND detected_framework = ?`;
      params.push(options.framework);
    }

    sql += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    const rows = await DbPromise.all(sql, params);
    return (rows || []).map((row: any) => this.mapRowToImport(row));
  }

  /**
   * Update import status
   */
  async updateStatus(importId: string, status: ImportStatus, error?: string): Promise<void> {
    const sql = `
      UPDATE imported_reports
      SET status = ?, processing_error = ?
      WHERE id = ?
    `;
    await DbPromise.run(sql, [status, error || null, importId]);
  }

  /**
   * Update extracted data
   */
  private async updateExtractedData(
    importId: string,
    data: ExtractedReportData,
    framework: SupportedFramework,
    confidence: number
  ): Promise<void> {
    const sql = `
      UPDATE imported_reports
      SET 
        detected_framework = ?,
        detection_confidence = ?,
        extracted_data_json = ?,
        extraction_details_json = ?,
        document_metadata_json = ?,
        canonical_markdown = ?,
        auto_summary = ?,
        coverage_percent = ?,
        status = 'ready_for_review',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await DbPromise.run(sql, [
      framework,
      confidence,
      JSON.stringify(data),
      JSON.stringify(data.extractionDetails),
      JSON.stringify(data.metadata),
      data.canonicalMarkdown || '',
      data.autoSummary || '',
      data.coveragePercent || 0,
      importId,
    ]);
  }

  /**
   * Update target entity
   */
  private async updateTarget(
    importId: string,
    targetType: TargetType,
    targetId: string
  ): Promise<void> {
    const sql = `
      UPDATE imported_reports
      SET 
        target_type = ?,
        target_id = ?,
        status = CASE
          WHEN initiatives_created > 0 THEN 'completed'
          ELSE 'assessment_created'
        END,
        updated_at = CURRENT_TIMESTAMP,
        processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await DbPromise.run(sql, [targetType, targetId, importId]);
  }

  /**
   * Delete import
   */
  async deleteImport(importId: string, organizationId: string): Promise<void> {
    const importRecord = await this.getImport(importId, organizationId);

    // Delete file if exists
    if (importRecord.sourceFilePath && fs.existsSync(importRecord.sourceFilePath)) {
      fs.unlinkSync(importRecord.sourceFilePath);
    }

    const sql = `DELETE FROM imported_reports WHERE id = ? AND organization_id = ?`;
    await DbPromise.run(sql, [importId, organizationId]);
  }

  /**
   * Map database row to ImportedReport
   */
  private mapRowToImport(row: any): ImportedReport {
    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      sourceFileName: row.source_file_name,
      sourceFilePath: row.source_file_path,
      sourceFileSize: row.source_file_size,
      sourceFormat: row.source_format,
      detectedFramework: row.detected_framework,
      detectionConfidence: row.detection_confidence,
      extractedData: row.extracted_data_json ? JSON.parse(row.extracted_data_json) : null,
      mappedData: row.mapped_data_json ? JSON.parse(row.mapped_data_json) : null,
      extractionDetails: row.extraction_details_json
        ? JSON.parse(row.extraction_details_json)
        : { fieldsFound: [], fieldsMissing: [], warnings: [] },
      documentMetadata: row.document_metadata_json
        ? JSON.parse(row.document_metadata_json)
        : { sourceFileName: row.source_file_name },
      canonicalMarkdown: row.canonical_markdown,
      autoSummary: row.auto_summary,
      coveragePercent: row.coverage_percent,
      targetType: row.target_type,
      targetId: row.target_id,
      initiativesCreated: row.initiatives_created || 0,
      initiativesTargetIds: row.initiatives_target_ids
        ? JSON.parse(row.initiatives_target_ids)
        : [],
      status: row.status,
      processingError: row.processing_error,
      processingLog: row.processing_log,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      processedAt: row.processed_at,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get supported file formats
   */
  getSupportedFormats(): { format: SupportedFormat; mimeTypes: string[]; extensions: string[] }[] {
    return [
      {
        format: 'pdf',
        mimeTypes: ['application/pdf'],
        extensions: ['.pdf'],
      },
      {
        format: 'xlsx',
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        extensions: ['.xlsx', '.xls'],
      },
      {
        format: 'docx',
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        extensions: ['.docx', '.doc'],
      },
      {
        format: 'json',
        mimeTypes: ['application/json'],
        extensions: ['.json'],
      },
      {
        format: 'csv',
        mimeTypes: ['text/csv'],
        extensions: ['.csv'],
      },
    ];
  }

  /**
   * Get supported frameworks
   */
  getSupportedFrameworks(): { id: SupportedFramework; name: string; description: string }[] {
    return [
      {
        id: 'DRD',
        name: 'Digital Readiness Diagnosis',
        description: '7 axes, 34 areas, scale 1-7 or 1-5',
      },
      {
        id: 'SIRI',
        name: 'Smart Industry Readiness Index',
        description: '3 building blocks, 8 dimensions, scale 0-5',
      },
      {
        id: 'ADMA',
        name: 'Advanced Digital Maturity Assessment',
        description: '5 pillars, 12 dimensions, scale 1-5',
      },
    ];
  }
}

export default ReportImportService;
