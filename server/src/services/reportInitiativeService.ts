/**
 * Report Initiative Service
 *
 * Integrates reports with automatic initiative generation.
 * Analyzes assessment data and generates actionable initiatives
 * based on gaps, priorities, and organizational context.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';

// ============================================
// TYPES
// ============================================

export type SupportedFramework = 'DRD' | 'SIRI' | 'ADMA';
export type InitiativePriority = 'critical' | 'high' | 'medium' | 'low';
export type InitiativeType = 'quick_win' | 'strategic' | 'foundational' | 'transformational';
export type InitiativeStatus = 'draft' | 'proposed' | 'approved' | 'in_progress' | 'completed';

export interface DimensionScore {
  dimensionId: string;
  dimensionName: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  category?: string;
}

export interface GeneratedInitiative {
  id: string;
  title: string;
  titlePL: string;
  description: string;
  descriptionPL: string;
  type: InitiativeType;
  priority: InitiativePriority;
  status: InitiativeStatus;
  sourceDimensions: string[];
  framework: SupportedFramework;
  expectedMaturityImpact: number;
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedCost: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  prerequisites: string[];
  technologies: string[];
  kpis: string[];
  risks: string[];
  quickWins: string[];
  createdAt: string;
  metadata: Record<string, any>;
}

export interface InitiativeGenerationRequest {
  reportId?: string;
  assessmentId?: string;
  framework: SupportedFramework;
  dimensionScores: DimensionScore[];
  organizationContext?: {
    industry: string;
    size: string;
    budget?: string;
    priorities?: string[];
  };
  options?: {
    maxInitiatives?: number;
    minGap?: number;
    includeQuickWins?: boolean;
    focusAreas?: string[];
  };
}

export interface InitiativeGenerationResponse {
  id: string;
  timestamp: string;
  framework: SupportedFramework;
  initiatives: GeneratedInitiative[];
  summary: {
    totalInitiatives: number;
    byPriority: Record<InitiativePriority, number>;
    byType: Record<InitiativeType, number>;
    totalExpectedImpact: number;
    recommendedSequence: string[];
  };
}

// ============================================
// INITIATIVE TEMPLATES
// ============================================

interface InitiativeTemplate {
  id: string;
  titleEN: string;
  titlePL: string;
  descriptionEN: string;
  descriptionPL: string;
  type: InitiativeType;
  applicableDimensions: string[];
  applicableFrameworks: SupportedFramework[];
  minGapTrigger: number;
  technologies: string[];
  kpis: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedCost: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  prerequisites: string[];
  risks: string[];
  quickWins: string[];
}

const INITIATIVE_TEMPLATES: InitiativeTemplate[] = [
  // Data Management Initiatives
  {
    id: 'data-platform',
    titleEN: 'Enterprise Data Platform Implementation',
    titlePL: 'Wdrożenie Platformy Danych Przedsiębiorstwa',
    descriptionEN:
      'Implement a centralized data platform to unify data sources, enable analytics, and support AI initiatives.',
    descriptionPL:
      'Wdrożenie scentralizowanej platformy danych w celu ujednolicenia źródeł danych, umożliwienia analityki i wsparcia inicjatyw AI.',
    type: 'foundational',
    applicableDimensions: ['dataManagement', 'data_collection', 'data_analytics'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.5,
    technologies: ['Azure Data Lake', 'Databricks', 'Apache Kafka'],
    kpis: ['Data integration coverage', 'Query performance', 'Data quality score'],
    estimatedEffort: 'high',
    estimatedCost: 'high',
    estimatedDuration: '6-12 months',
    prerequisites: ['Cloud infrastructure', 'Data governance policy'],
    risks: ['Data migration complexity', 'Integration challenges', 'Skills gap'],
    quickWins: [
      'Implement data catalog',
      'Set up basic ETL pipelines',
      'Create data quality dashboards',
    ],
  },
  {
    id: 'data-governance',
    titleEN: 'Data Governance Framework',
    titlePL: 'Framework Zarządzania Danymi',
    descriptionEN:
      'Establish comprehensive data governance including policies, roles, and quality management.',
    descriptionPL:
      'Ustanowienie kompleksowego zarządzania danymi obejmującego polityki, role i zarządzanie jakością.',
    type: 'foundational',
    applicableDimensions: ['dataManagement', 'data_collection'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.0,
    technologies: ['Collibra', 'Alation', 'Azure Purview'],
    kpis: ['Data quality metrics', 'Policy compliance rate', 'Data lineage coverage'],
    estimatedEffort: 'medium',
    estimatedCost: 'medium',
    estimatedDuration: '3-6 months',
    prerequisites: ['Executive sponsorship', 'Data inventory'],
    risks: ['Organizational resistance', 'Unclear ownership'],
    quickWins: [
      'Define data ownership',
      'Create data dictionary',
      'Implement basic quality checks',
    ],
  },

  // AI/ML Initiatives
  {
    id: 'ai-platform',
    titleEN: 'AI/ML Platform Deployment',
    titlePL: 'Wdrożenie Platformy AI/ML',
    descriptionEN:
      'Deploy enterprise AI/ML platform for model development, training, and deployment.',
    descriptionPL:
      'Wdrożenie platformy AI/ML dla przedsiębiorstwa do rozwoju, trenowania i wdrażania modeli.',
    type: 'strategic',
    applicableDimensions: ['aiMaturity', 'data_analytics'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.5,
    technologies: ['Azure ML', 'MLflow', 'Kubeflow'],
    kpis: ['Model deployment count', 'Prediction accuracy', 'Time to production'],
    estimatedEffort: 'high',
    estimatedCost: 'high',
    estimatedDuration: '6-9 months',
    prerequisites: ['Data platform', 'ML team', 'Use case identification'],
    risks: ['Model bias', 'Data quality issues', 'Skills shortage'],
    quickWins: [
      'Implement AutoML for quick wins',
      'Deploy pre-trained models',
      'Create ML sandbox',
    ],
  },
  {
    id: 'generative-ai',
    titleEN: 'Generative AI Integration',
    titlePL: 'Integracja Generatywnego AI',
    descriptionEN:
      'Integrate generative AI capabilities for content creation, automation, and decision support.',
    descriptionPL:
      'Integracja możliwości generatywnego AI do tworzenia treści, automatyzacji i wsparcia decyzji.',
    type: 'strategic',
    applicableDimensions: ['aiMaturity', 'processes', 'digitalProducts'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.0,
    technologies: ['Azure OpenAI', 'GPT-4', 'LangChain'],
    kpis: ['Automation rate', 'User adoption', 'Cost savings'],
    estimatedEffort: 'medium',
    estimatedCost: 'medium',
    estimatedDuration: '3-6 months',
    prerequisites: ['API integration capability', 'Use case definition'],
    risks: ['Hallucination issues', 'Data privacy concerns', 'Dependency on vendor'],
    quickWins: ['Deploy chatbot', 'Automate document generation', 'Implement code assistance'],
  },

  // Process Automation
  {
    id: 'rpa-implementation',
    titleEN: 'RPA Implementation Program',
    titlePL: 'Program Wdrożenia RPA',
    descriptionEN: 'Implement Robotic Process Automation for high-volume, repetitive tasks.',
    descriptionPL:
      'Wdrożenie automatyzacji procesów robotycznych dla zadań o dużym wolumenie i powtarzalności.',
    type: 'quick_win',
    applicableDimensions: ['processes', 'production_tech', 'smart_operations'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.0,
    technologies: ['UiPath', 'Power Automate', 'Automation Anywhere'],
    kpis: ['Process automation rate', 'Error reduction', 'Time savings'],
    estimatedEffort: 'medium',
    estimatedCost: 'medium',
    estimatedDuration: '2-4 months',
    prerequisites: ['Process documentation', 'Automation candidates identified'],
    risks: ['Process changes', 'Maintenance overhead', 'Employee resistance'],
    quickWins: ['Automate data entry', 'Automate report generation', 'Automate email processing'],
  },
  {
    id: 'bpm-platform',
    titleEN: 'Business Process Management Platform',
    titlePL: 'Platforma Zarządzania Procesami Biznesowymi',
    descriptionEN: 'Implement BPM platform for workflow automation and process optimization.',
    descriptionPL:
      'Wdrożenie platformy BPM do automatyzacji przepływów pracy i optymalizacji procesów.',
    type: 'foundational',
    applicableDimensions: ['processes', 'production_it', 'supply_integration'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.5,
    technologies: ['Camunda', 'ProcessMaker', 'Appian'],
    kpis: ['Process cycle time', 'Automation coverage', 'Exception rate'],
    estimatedEffort: 'high',
    estimatedCost: 'medium',
    estimatedDuration: '4-8 months',
    prerequisites: ['Process mapping', 'Stakeholder buy-in'],
    risks: ['Integration complexity', 'Change management'],
    quickWins: [
      'Digitize approval workflows',
      'Implement process monitoring',
      'Create process dashboards',
    ],
  },

  // Digital Products
  {
    id: 'iot-platform',
    titleEN: 'IoT Platform Implementation',
    titlePL: 'Wdrożenie Platformy IoT',
    descriptionEN: 'Deploy IoT platform for connected products and real-time monitoring.',
    descriptionPL:
      'Wdrożenie platformy IoT dla połączonych produktów i monitoringu w czasie rzeczywistym.',
    type: 'transformational',
    applicableDimensions: ['digitalProducts', 'product_features', 'product_data'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 2.0,
    technologies: ['Azure IoT Hub', 'AWS IoT Core', 'PTC ThingWorx'],
    kpis: ['Connected device count', 'Data collection rate', 'Uptime'],
    estimatedEffort: 'high',
    estimatedCost: 'high',
    estimatedDuration: '9-18 months',
    prerequisites: ['Sensor infrastructure', 'Connectivity', 'Security framework'],
    risks: ['Security vulnerabilities', 'Scalability issues', 'Integration challenges'],
    quickWins: [
      'Pilot with single product line',
      'Implement basic monitoring',
      'Create device dashboard',
    ],
  },
  {
    id: 'digital-twin',
    titleEN: 'Digital Twin Development',
    titlePL: 'Rozwój Cyfrowego Bliźniaka',
    descriptionEN:
      'Create digital twins for products and processes to enable simulation and optimization.',
    descriptionPL:
      'Tworzenie cyfrowych bliźniaków produktów i procesów w celu umożliwienia symulacji i optymalizacji.',
    type: 'transformational',
    applicableDimensions: ['digitalProducts', 'production_tech', 'smart_operations'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 2.0,
    technologies: ['Azure Digital Twins', 'NVIDIA Omniverse', 'Siemens Xcelerator'],
    kpis: ['Simulation accuracy', 'Prediction accuracy', 'Optimization savings'],
    estimatedEffort: 'high',
    estimatedCost: 'high',
    estimatedDuration: '12-24 months',
    prerequisites: ['IoT infrastructure', '3D models', 'Data platform'],
    risks: ['Model complexity', 'Data requirements', 'Skills gap'],
    quickWins: [
      'Start with single asset',
      'Implement basic visualization',
      'Create monitoring dashboard',
    ],
  },

  // Culture & Organization
  {
    id: 'digital-skills',
    titleEN: 'Digital Skills Development Program',
    titlePL: 'Program Rozwoju Kompetencji Cyfrowych',
    descriptionEN:
      'Comprehensive training program to build digital capabilities across the organization.',
    descriptionPL:
      'Kompleksowy program szkoleniowy budujący kompetencje cyfrowe w całej organizacji.',
    type: 'foundational',
    applicableDimensions: ['culture', 'digital_culture'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.0,
    technologies: ['LinkedIn Learning', 'Coursera', 'Udemy Business'],
    kpis: ['Training completion rate', 'Skill assessment scores', 'Digital adoption rate'],
    estimatedEffort: 'medium',
    estimatedCost: 'low',
    estimatedDuration: '3-6 months',
    prerequisites: ['Skills assessment', 'Learning platform'],
    risks: ['Low engagement', 'Time constraints'],
    quickWins: [
      'Launch e-learning platform',
      'Create digital champions program',
      'Implement skill badges',
    ],
  },
  {
    id: 'digital-workplace',
    titleEN: 'Digital Workplace Transformation',
    titlePL: 'Transformacja Cyfrowego Miejsca Pracy',
    descriptionEN:
      'Modernize workplace with collaboration tools, mobile access, and digital workflows.',
    descriptionPL:
      'Modernizacja miejsca pracy z narzędziami współpracy, dostępem mobilnym i cyfrowymi przepływami pracy.',
    type: 'quick_win',
    applicableDimensions: ['culture', 'digital_culture', 'processes'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.0,
    technologies: ['Microsoft Teams', 'Slack', 'Google Workspace'],
    kpis: ['Collaboration tool adoption', 'Mobile usage', 'Employee satisfaction'],
    estimatedEffort: 'low',
    estimatedCost: 'low',
    estimatedDuration: '1-3 months',
    prerequisites: ['Cloud infrastructure'],
    risks: ['Change resistance', 'Security concerns'],
    quickWins: [
      'Deploy collaboration platform',
      'Enable mobile access',
      'Implement digital signatures',
    ],
  },

  // Supply Chain
  {
    id: 'supply-chain-visibility',
    titleEN: 'Supply Chain Visibility Platform',
    titlePL: 'Platforma Widoczności Łańcucha Dostaw',
    descriptionEN:
      'Implement end-to-end supply chain visibility with real-time tracking and analytics.',
    descriptionPL:
      'Wdrożenie widoczności łańcucha dostaw od końca do końca z śledzeniem i analityką w czasie rzeczywistym.',
    type: 'strategic',
    applicableDimensions: ['supply_integration', 'supply_visibility', 'smart_supply'],
    applicableFrameworks: ['DRD', 'SIRI', 'ADMA'],
    minGapTrigger: 1.5,
    technologies: ['SAP IBP', 'Blue Yonder', 'Kinaxis'],
    kpis: ['Visibility coverage', 'Forecast accuracy', 'Lead time reduction'],
    estimatedEffort: 'high',
    estimatedCost: 'high',
    estimatedDuration: '6-12 months',
    prerequisites: ['ERP integration', 'Supplier onboarding'],
    risks: ['Data quality', 'Supplier adoption', 'Integration complexity'],
    quickWins: [
      'Implement tracking dashboard',
      'Enable supplier portal',
      'Create exception alerts',
    ],
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class ReportInitiativeService {
  private db: any;
  private aiService: any;

  constructor() {
    // Dependencies will be injected
  }

  setDependencies(deps: { db: any; aiService?: any }) {
    this.db = deps.db;
    this.aiService = deps.aiService;
  }

  /**
   * Generate initiatives from assessment/report data
   */
  async generateInitiatives(
    request: InitiativeGenerationRequest
  ): Promise<InitiativeGenerationResponse> {
    const { framework, dimensionScores, organizationContext, options = {} } = request;

    const { maxInitiatives = 10, minGap = 1.0, includeQuickWins = true, focusAreas = [] } = options;

    // Filter dimensions with significant gaps
    const significantGaps = dimensionScores.filter((d) => d.gap >= minGap);

    // Sort by gap size (priority)
    significantGaps.sort((a, b) => b.gap - a.gap);

    // Generate initiatives from templates
    const initiatives: GeneratedInitiative[] = [];

    for (const dimension of significantGaps) {
      // Find applicable templates
      const applicableTemplates = INITIATIVE_TEMPLATES.filter((template) => {
        // Check framework compatibility
        if (!template.applicableFrameworks.includes(framework)) return false;

        // Check dimension applicability
        if (!template.applicableDimensions.includes(dimension.dimensionId)) return false;

        // Check gap threshold
        if (dimension.gap < template.minGapTrigger) return false;

        // Check focus areas if specified
        if (focusAreas.length > 0) {
          const hasMatchingDimension = template.applicableDimensions.some((d) =>
            focusAreas.includes(d)
          );
          if (!hasMatchingDimension) return false;
        }

        return true;
      });

      // Generate initiatives from templates
      for (const template of applicableTemplates) {
        // Skip if we already have enough initiatives
        if (initiatives.length >= maxInitiatives) break;

        // Skip if we already generated this initiative
        if (initiatives.some((i) => i.metadata.templateId === template.id)) continue;

        // Skip quick wins if not requested
        if (!includeQuickWins && template.type === 'quick_win') continue;

        const initiative = this.createInitiativeFromTemplate(
          template,
          dimension,
          framework,
          organizationContext
        );

        initiatives.push(initiative);
      }

      if (initiatives.length >= maxInitiatives) break;
    }

    // Calculate summary
    const summary = this.calculateSummary(initiatives);

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      framework,
      initiatives,
      summary,
    };
  }

  /**
   * Create initiative from template
   */
  private createInitiativeFromTemplate(
    template: InitiativeTemplate,
    dimension: DimensionScore,
    framework: SupportedFramework,
    context?: InitiativeGenerationRequest['organizationContext']
  ): GeneratedInitiative {
    const priority = this.calculatePriority(dimension.gap, template.type);
    const expectedImpact = this.calculateExpectedImpact(dimension.gap, template.type);

    return {
      id: uuidv4(),
      title: template.titleEN,
      titlePL: template.titlePL,
      description: template.descriptionEN,
      descriptionPL: template.descriptionPL,
      type: template.type,
      priority,
      status: 'draft',
      sourceDimensions: [dimension.dimensionId],
      framework,
      expectedMaturityImpact: expectedImpact,
      estimatedEffort: this.adjustEffortForContext(template.estimatedEffort, context),
      estimatedCost: this.adjustCostForContext(template.estimatedCost, context),
      estimatedDuration: template.estimatedDuration,
      prerequisites: template.prerequisites,
      technologies: template.technologies,
      kpis: template.kpis,
      risks: template.risks,
      quickWins: template.quickWins,
      createdAt: new Date().toISOString(),
      metadata: {
        templateId: template.id,
        sourceGap: dimension.gap,
        sourceDimension: dimension.dimensionName,
        organizationContext: context,
      },
    };
  }

  /**
   * Calculate initiative priority based on gap and type
   */
  private calculatePriority(gap: number, type: InitiativeType): InitiativePriority {
    if (gap >= 3) return 'critical';
    if (gap >= 2) return 'high';
    if (gap >= 1.5 || type === 'foundational') return 'medium';
    return 'low';
  }

  /**
   * Calculate expected maturity impact
   */
  private calculateExpectedImpact(gap: number, type: InitiativeType): number {
    const baseImpact = Math.min(gap, 2); // Cap at 2 levels improvement

    const typeMultiplier: Record<InitiativeType, number> = {
      quick_win: 0.5,
      foundational: 0.8,
      strategic: 1.0,
      transformational: 1.2,
    };

    return Math.round(baseImpact * typeMultiplier[type] * 10) / 10;
  }

  /**
   * Adjust effort estimate based on organization context
   */
  private adjustEffortForContext(
    baseEffort: 'low' | 'medium' | 'high',
    context?: InitiativeGenerationRequest['organizationContext']
  ): 'low' | 'medium' | 'high' {
    if (!context) return baseEffort;

    // Larger organizations might have more resources but also more complexity
    if (context.size === 'enterprise' && baseEffort === 'medium') return 'high';
    if (context.size === 'small' && baseEffort === 'high') return 'medium';

    return baseEffort;
  }

  /**
   * Adjust cost estimate based on organization context
   */
  private adjustCostForContext(
    baseCost: 'low' | 'medium' | 'high',
    context?: InitiativeGenerationRequest['organizationContext']
  ): 'low' | 'medium' | 'high' {
    if (!context?.budget) return baseCost;

    // Adjust based on budget constraints
    if (context.budget === 'low' && baseCost === 'high') return 'high'; // Still high, but flagged
    if (context.budget === 'high' && baseCost === 'medium') return 'medium'; // Can afford it

    return baseCost;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    initiatives: GeneratedInitiative[]
  ): InitiativeGenerationResponse['summary'] {
    const byPriority: Record<InitiativePriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byType: Record<InitiativeType, number> = {
      quick_win: 0,
      strategic: 0,
      foundational: 0,
      transformational: 0,
    };

    let totalExpectedImpact = 0;

    for (const initiative of initiatives) {
      byPriority[initiative.priority]++;
      byType[initiative.type]++;
      totalExpectedImpact += initiative.expectedMaturityImpact;
    }

    // Generate recommended sequence
    const recommendedSequence = this.generateRecommendedSequence(initiatives);

    return {
      totalInitiatives: initiatives.length,
      byPriority,
      byType,
      totalExpectedImpact: Math.round(totalExpectedImpact * 10) / 10,
      recommendedSequence,
    };
  }

  /**
   * Generate recommended implementation sequence
   */
  private generateRecommendedSequence(initiatives: GeneratedInitiative[]): string[] {
    // Sort by: priority (critical first), then type (foundational before strategic)
    const sorted = [...initiatives].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const typeOrder = { quick_win: 0, foundational: 1, strategic: 2, transformational: 3 };

      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return typeOrder[a.type] - typeOrder[b.type];
    });

    return sorted.map((i) => i.id);
  }

  /**
   * Save generated initiatives to database
   */
  async saveInitiatives(
    initiatives: GeneratedInitiative[],
    projectId: string,
    organizationId: string,
    userId: string
  ): Promise<string[]> {
    const savedIds: string[] = [];

    for (const initiative of initiatives) {
      try {
        // Uspójnienie F1.9 — przez kanoniczny lejek (DRAFT + name/title + lineage).
        if (process.env.INITIATIVE_FUNNEL_ENABLED !== 'false') {
          const __r = await funnelCreateInitiative(
            organizationId,
            {
              title: initiative.title,
              projectId,
              description: initiative.description,
              priority: initiative.priority,
              sourceType: 'report',
              sourceId: projectId,
            },
            { validate: false, actor: { id: userId } }
          );
          // Funnel nie zna report-specyficznych kolumn — dośpiewujemy.
          await this.db.run(
            `UPDATE initiatives SET
              type = ?, estimated_effort = ?, estimated_cost = ?, estimated_duration = ?,
              technologies = ?, kpis = ?, metadata = ?, created_by = ?
             WHERE id = ? AND organization_id = ?`,
            [
              initiative.type,
              initiative.estimatedEffort,
              initiative.estimatedCost,
              initiative.estimatedDuration,
              JSON.stringify(initiative.technologies),
              JSON.stringify(initiative.kpis),
              JSON.stringify(initiative.metadata),
              userId,
              __r.id,
              organizationId,
            ]
          );
          savedIds.push(__r.id);
        } else {
          await this.db.run(
            `INSERT INTO initiatives (
              id, project_id, organization_id, title, description,
              priority, status, type, estimated_effort, estimated_cost,
              estimated_duration, technologies, kpis, metadata,
              created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              initiative.id,
              projectId,
              organizationId,
              initiative.title,
              initiative.description,
              initiative.priority,
              initiative.status,
              initiative.type,
              initiative.estimatedEffort,
              initiative.estimatedCost,
              initiative.estimatedDuration,
              JSON.stringify(initiative.technologies),
              JSON.stringify(initiative.kpis),
              JSON.stringify(initiative.metadata),
              userId,
              initiative.createdAt,
            ]
          );
          savedIds.push(initiative.id);
        }
      } catch (error) {
        logger.error(`Failed to save initiative ${initiative.id}:`, error);
      }
    }

    return savedIds;
  }

  /**
   * Link initiatives to report
   */
  async linkInitiativesToReport(
    reportId: string,
    initiativeIds: string[],
    organizationId: string
  ): Promise<void> {
    for (const initiativeId of initiativeIds) {
      try {
        await this.db.run(
          `INSERT INTO report_initiatives (
            id, report_id, initiative_id, organization_id, created_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), reportId, initiativeId, organizationId, new Date().toISOString()]
        );
      } catch (error) {
        logger.error(`Failed to link initiative ${initiativeId} to report ${reportId}:`, error);
      }
    }
  }

  /**
   * Get initiatives for a report
   */
  async getInitiativesForReport(
    reportId: string,
    organizationId: string
  ): Promise<GeneratedInitiative[]> {
    const rows = await this.db.all(
      `SELECT i.* FROM initiatives i
       JOIN report_initiatives ri ON i.id = ri.initiative_id
       WHERE ri.report_id = ? AND ri.organization_id = ?
       ORDER BY i.priority, i.created_at`,
      [reportId, organizationId]
    );

    return rows.map((row: any) => this.mapRowToInitiative(row));
  }

  /**
   * Map database row to initiative object
   */
  private mapRowToInitiative(row: any): GeneratedInitiative {
    return {
      id: row.id,
      title: row.title,
      titlePL: row.title_pl || row.title,
      description: row.description,
      descriptionPL: row.description_pl || row.description,
      type: row.type,
      priority: row.priority,
      status: row.status,
      sourceDimensions: JSON.parse(row.source_dimensions || '[]'),
      framework: row.framework || 'DRD',
      expectedMaturityImpact: row.expected_maturity_impact || 0,
      estimatedEffort: row.estimated_effort,
      estimatedCost: row.estimated_cost,
      estimatedDuration: row.estimated_duration,
      prerequisites: JSON.parse(row.prerequisites || '[]'),
      technologies: JSON.parse(row.technologies || '[]'),
      kpis: JSON.parse(row.kpis || '[]'),
      risks: JSON.parse(row.risks || '[]'),
      quickWins: JSON.parse(row.quick_wins || '[]'),
      createdAt: row.created_at,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }

  /**
   * Get available initiative templates
   */
  getTemplates(framework?: SupportedFramework): InitiativeTemplate[] {
    if (!framework) return INITIATIVE_TEMPLATES;
    return INITIATIVE_TEMPLATES.filter((t) => t.applicableFrameworks.includes(framework));
  }
}

export const reportInitiativeService = new ReportInitiativeService();
export default ReportInitiativeService;
