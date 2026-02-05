/**
 * AI Suggestion Service
 *
 * Provides AI-powered suggestions for:
 * - Maturity level recommendations based on organization context
 * - Technology stack suggestions for improvement
 * - Gap analysis and prioritization
 * - Best practices and benchmarks
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export type SupportedFramework = 'DRD' | 'SIRI' | 'ADMA';

export interface OrganizationContext {
  industry: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  region?: string;
  currentMaturity?: number;
  budget?: 'low' | 'medium' | 'high';
  priorities?: string[];
  existingTechnologies?: string[];
}

export interface LevelSuggestion {
  id: string;
  dimensionId: string;
  dimensionName: string;
  currentLevel: number;
  suggestedLevel: number;
  confidence: number; // 0-100
  reasoning: string;
  benchmarkComparison?: {
    industryAverage: number;
    topPerformers: number;
  };
  timeToAchieve?: string;
  requiredInvestment?: 'low' | 'medium' | 'high';
}

export interface TechnologySuggestion {
  id: string;
  category: string;
  name: string;
  description: string;
  relevantDimensions: string[];
  maturityImpact: number; // Expected improvement in maturity
  implementationComplexity: 'low' | 'medium' | 'high';
  estimatedCost: 'low' | 'medium' | 'high';
  timeToValue: string;
  alternatives?: string[];
  prerequisites?: string[];
  vendors?: string[];
}

export interface GapAnalysis {
  dimension: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
  quickWins: string[];
  longTermActions: string[];
}

export interface SuggestionRequest {
  framework: SupportedFramework;
  organizationContext: OrganizationContext;
  currentScores: Record<string, number>;
  targetScores?: Record<string, number>;
  focusAreas?: string[];
}

export interface SuggestionResponse {
  id: string;
  timestamp: string;
  framework: SupportedFramework;
  levelSuggestions: LevelSuggestion[];
  technologySuggestions: TechnologySuggestion[];
  gapAnalysis: GapAnalysis[];
  overallRecommendation: string;
  prioritizedRoadmap: RoadmapPhase[];
}

export interface RoadmapPhase {
  phase: number;
  name: string;
  duration: string;
  focus: string[];
  technologies: string[];
  expectedOutcome: string;
  kpis: string[];
}

// ============================================
// INDUSTRY BENCHMARKS (Simulated data)
// ============================================

const INDUSTRY_BENCHMARKS: Record<string, Record<string, { average: number; top: number }>> = {
  manufacturing: {
    DRD: { average: 2.3, top: 4.2 },
    SIRI: { average: 2.5, top: 4.5 },
    ADMA: { average: 2.4, top: 4.3 },
  },
  retail: {
    DRD: { average: 2.8, top: 4.5 },
    SIRI: { average: 2.2, top: 3.8 },
    ADMA: { average: 2.6, top: 4.1 },
  },
  healthcare: {
    DRD: { average: 2.5, top: 4.0 },
    SIRI: { average: 2.0, top: 3.5 },
    ADMA: { average: 2.3, top: 3.8 },
  },
  finance: {
    DRD: { average: 3.2, top: 4.8 },
    SIRI: { average: 2.8, top: 4.2 },
    ADMA: { average: 3.0, top: 4.5 },
  },
  logistics: {
    DRD: { average: 2.6, top: 4.3 },
    SIRI: { average: 2.7, top: 4.4 },
    ADMA: { average: 2.8, top: 4.5 },
  },
  default: {
    DRD: { average: 2.5, top: 4.0 },
    SIRI: { average: 2.4, top: 4.0 },
    ADMA: { average: 2.5, top: 4.0 },
  },
};

// ============================================
// TECHNOLOGY CATALOG
// ============================================

const TECHNOLOGY_CATALOG: Record<string, TechnologySuggestion[]> = {
  dataManagement: [
    {
      id: 'tech-001',
      category: 'Data Platform',
      name: 'Azure Data Lake / Databricks',
      description: 'Unified analytics platform for big data and AI',
      relevantDimensions: ['dataManagement', 'data_collection', 'data_analytics'],
      maturityImpact: 1.5,
      implementationComplexity: 'high',
      estimatedCost: 'high',
      timeToValue: '6-12 months',
      alternatives: ['Snowflake', 'Google BigQuery', 'AWS Redshift'],
      prerequisites: ['Cloud infrastructure', 'Data governance policy'],
      vendors: ['Microsoft', 'Databricks'],
    },
    {
      id: 'tech-002',
      category: 'Data Integration',
      name: 'Apache Kafka / Confluent',
      description: 'Real-time data streaming and event processing',
      relevantDimensions: ['dataManagement', 'data_collection', 'processes'],
      maturityImpact: 1.2,
      implementationComplexity: 'medium',
      estimatedCost: 'medium',
      timeToValue: '3-6 months',
      alternatives: ['AWS Kinesis', 'Azure Event Hubs', 'RabbitMQ'],
      prerequisites: ['Microservices architecture'],
      vendors: ['Confluent', 'Apache'],
    },
  ],
  aiMaturity: [
    {
      id: 'tech-003',
      category: 'ML Platform',
      name: 'MLflow / Kubeflow',
      description: 'Machine learning lifecycle management platform',
      relevantDimensions: ['aiMaturity', 'data_analytics', 'processes'],
      maturityImpact: 1.3,
      implementationComplexity: 'high',
      estimatedCost: 'medium',
      timeToValue: '4-8 months',
      alternatives: ['AWS SageMaker', 'Azure ML', 'Google Vertex AI'],
      prerequisites: ['Data lake', 'ML team'],
      vendors: ['Databricks', 'Google'],
    },
    {
      id: 'tech-004',
      category: 'AI Services',
      name: 'Azure OpenAI / GPT-4',
      description: 'Enterprise-grade generative AI services',
      relevantDimensions: ['aiMaturity', 'digitalProducts', 'processes'],
      maturityImpact: 1.0,
      implementationComplexity: 'low',
      estimatedCost: 'medium',
      timeToValue: '1-3 months',
      alternatives: ['AWS Bedrock', 'Google PaLM', 'Anthropic Claude'],
      prerequisites: ['API integration capability'],
      vendors: ['Microsoft', 'OpenAI'],
    },
  ],
  processes: [
    {
      id: 'tech-005',
      category: 'Process Automation',
      name: 'UiPath / Power Automate',
      description: 'Robotic Process Automation (RPA) platform',
      relevantDimensions: ['processes', 'production_tech', 'smart_operations'],
      maturityImpact: 1.2,
      implementationComplexity: 'medium',
      estimatedCost: 'medium',
      timeToValue: '2-4 months',
      alternatives: ['Automation Anywhere', 'Blue Prism', 'WorkFusion'],
      prerequisites: ['Process documentation'],
      vendors: ['UiPath', 'Microsoft'],
    },
    {
      id: 'tech-006',
      category: 'BPM',
      name: 'Camunda / ProcessMaker',
      description: 'Business Process Management and workflow automation',
      relevantDimensions: ['processes', 'production_it', 'supply_integration'],
      maturityImpact: 1.0,
      implementationComplexity: 'medium',
      estimatedCost: 'medium',
      timeToValue: '3-6 months',
      alternatives: ['Appian', 'Pega', 'IBM BPM'],
      prerequisites: ['Process mapping'],
      vendors: ['Camunda', 'ProcessMaker'],
    },
  ],
  digitalProducts: [
    {
      id: 'tech-007',
      category: 'IoT Platform',
      name: 'Azure IoT Hub / AWS IoT Core',
      description: 'Industrial IoT platform for connected products',
      relevantDimensions: ['digitalProducts', 'product_features', 'product_data'],
      maturityImpact: 1.5,
      implementationComplexity: 'high',
      estimatedCost: 'high',
      timeToValue: '6-12 months',
      alternatives: ['Google Cloud IoT', 'PTC ThingWorx', 'Siemens MindSphere'],
      prerequisites: ['Sensor infrastructure', 'Connectivity'],
      vendors: ['Microsoft', 'Amazon'],
    },
    {
      id: 'tech-008',
      category: 'Digital Twin',
      name: 'Azure Digital Twins / NVIDIA Omniverse',
      description: 'Digital twin platform for simulation and optimization',
      relevantDimensions: ['digitalProducts', 'production_tech', 'smart_operations'],
      maturityImpact: 1.8,
      implementationComplexity: 'high',
      estimatedCost: 'high',
      timeToValue: '9-18 months',
      alternatives: ['Siemens Xcelerator', 'Dassault 3DEXPERIENCE'],
      prerequisites: ['IoT infrastructure', '3D models'],
      vendors: ['Microsoft', 'NVIDIA'],
    },
  ],
  culture: [
    {
      id: 'tech-009',
      category: 'Learning Platform',
      name: 'LinkedIn Learning / Coursera for Business',
      description: 'Digital skills development platform',
      relevantDimensions: ['culture', 'digital_culture'],
      maturityImpact: 0.5,
      implementationComplexity: 'low',
      estimatedCost: 'low',
      timeToValue: '1-2 months',
      alternatives: ['Udemy Business', 'Pluralsight', 'Skillsoft'],
      prerequisites: [],
      vendors: ['LinkedIn', 'Coursera'],
    },
    {
      id: 'tech-010',
      category: 'Collaboration',
      name: 'Microsoft Teams / Slack',
      description: 'Digital workplace and collaboration platform',
      relevantDimensions: ['culture', 'digital_culture', 'processes'],
      maturityImpact: 0.7,
      implementationComplexity: 'low',
      estimatedCost: 'low',
      timeToValue: '1-2 months',
      alternatives: ['Google Workspace', 'Zoom', 'Webex'],
      prerequisites: [],
      vendors: ['Microsoft', 'Salesforce'],
    },
  ],
};

// ============================================
// SERVICE CLASS
// ============================================

class AISuggestionService {
  private aiService: any;

  constructor() {
    // AI service will be injected
  }

  setAIService(aiService: any) {
    this.aiService = aiService;
  }

  /**
   * Generate comprehensive suggestions based on assessment data
   */
  async generateSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
    const { framework, organizationContext, currentScores, targetScores, focusAreas } = request;

    // Generate level suggestions
    const levelSuggestions = this.generateLevelSuggestions(
      framework,
      currentScores,
      targetScores,
      organizationContext
    );

    // Generate technology suggestions
    const technologySuggestions = this.generateTechnologySuggestions(
      framework,
      currentScores,
      organizationContext,
      focusAreas
    );

    // Generate gap analysis
    const gapAnalysis = this.generateGapAnalysis(
      framework,
      currentScores,
      targetScores || this.generateDefaultTargets(currentScores, organizationContext)
    );

    // Generate roadmap
    const prioritizedRoadmap = this.generateRoadmap(
      gapAnalysis,
      technologySuggestions,
      organizationContext
    );

    // Generate overall recommendation
    const overallRecommendation = this.generateOverallRecommendation(
      framework,
      currentScores,
      gapAnalysis,
      organizationContext
    );

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      framework,
      levelSuggestions,
      technologySuggestions,
      gapAnalysis,
      overallRecommendation,
      prioritizedRoadmap,
    };
  }

  /**
   * Generate AI-powered level suggestions with benchmarks
   */
  private generateLevelSuggestions(
    framework: SupportedFramework,
    currentScores: Record<string, number>,
    targetScores: Record<string, number> | undefined,
    context: OrganizationContext
  ): LevelSuggestion[] {
    const suggestions: LevelSuggestion[] = [];
    const benchmark = INDUSTRY_BENCHMARKS[context.industry] || INDUSTRY_BENCHMARKS.default;
    const frameworkBenchmark = benchmark[framework];

    for (const [dimensionId, currentLevel] of Object.entries(currentScores)) {
      const targetLevel = targetScores?.[dimensionId];
      const suggestedLevel = this.calculateSuggestedLevel(
        currentLevel,
        frameworkBenchmark,
        context
      );

      if (suggestedLevel > currentLevel) {
        suggestions.push({
          id: uuidv4(),
          dimensionId,
          dimensionName: this.getDimensionName(dimensionId, framework),
          currentLevel,
          suggestedLevel,
          confidence: this.calculateConfidence(currentLevel, suggestedLevel, context),
          reasoning: this.generateLevelReasoning(
            dimensionId,
            currentLevel,
            suggestedLevel,
            context
          ),
          benchmarkComparison: {
            industryAverage: frameworkBenchmark.average,
            topPerformers: frameworkBenchmark.top,
          },
          timeToAchieve: this.estimateTimeToAchieve(currentLevel, suggestedLevel),
          requiredInvestment: this.estimateInvestment(currentLevel, suggestedLevel),
        });
      }
    }

    // Sort by priority (gap size and strategic importance)
    return suggestions.sort((a, b) => {
      const gapA = a.suggestedLevel - a.currentLevel;
      const gapB = b.suggestedLevel - b.currentLevel;
      return gapB - gapA;
    });
  }

  /**
   * Generate technology suggestions based on gaps
   */
  private generateTechnologySuggestions(
    framework: SupportedFramework,
    currentScores: Record<string, number>,
    context: OrganizationContext,
    focusAreas?: string[]
  ): TechnologySuggestion[] {
    const suggestions: TechnologySuggestion[] = [];
    const existingTech = new Set(context.existingTechnologies || []);

    // Find dimensions with low scores
    const lowScoreDimensions = Object.entries(currentScores)
      .filter(([_, score]) => score < 3)
      .map(([dim]) => dim);

    // Get relevant technology categories
    const relevantCategories = this.mapDimensionsToTechCategories(lowScoreDimensions, framework);

    for (const category of relevantCategories) {
      const techOptions = TECHNOLOGY_CATALOG[category] || [];

      for (const tech of techOptions) {
        // Skip if already implemented
        if (existingTech.has(tech.name)) continue;

        // Filter by budget if specified
        if (context.budget === 'low' && tech.estimatedCost === 'high') continue;

        // Check if matches focus areas
        if (focusAreas && focusAreas.length > 0) {
          const hasRelevantDimension = tech.relevantDimensions.some(
            (dim) => focusAreas.includes(dim) || lowScoreDimensions.includes(dim)
          );
          if (!hasRelevantDimension) continue;
        }

        suggestions.push({
          ...tech,
          id: uuidv4(),
        });
      }
    }

    // Sort by impact and complexity
    return suggestions
      .sort((a, b) => {
        const scoreA =
          a.maturityImpact /
          (a.implementationComplexity === 'high'
            ? 3
            : a.implementationComplexity === 'medium'
              ? 2
              : 1);
        const scoreB =
          b.maturityImpact /
          (b.implementationComplexity === 'high'
            ? 3
            : b.implementationComplexity === 'medium'
              ? 2
              : 1);
        return scoreB - scoreA;
      })
      .slice(0, 10); // Top 10 suggestions
  }

  /**
   * Generate gap analysis with recommendations
   */
  private generateGapAnalysis(
    framework: SupportedFramework,
    currentScores: Record<string, number>,
    targetScores: Record<string, number>
  ): GapAnalysis[] {
    const analysis: GapAnalysis[] = [];

    for (const [dimensionId, currentLevel] of Object.entries(currentScores)) {
      const targetLevel = targetScores[dimensionId] || currentLevel + 1;
      const gap = targetLevel - currentLevel;

      if (gap > 0) {
        analysis.push({
          dimension: this.getDimensionName(dimensionId, framework),
          currentLevel,
          targetLevel,
          gap,
          priority: this.calculatePriority(gap, dimensionId, framework),
          recommendations: this.generateRecommendations(
            dimensionId,
            currentLevel,
            targetLevel,
            framework
          ),
          quickWins: this.generateQuickWins(dimensionId, currentLevel, framework),
          longTermActions: this.generateLongTermActions(dimensionId, targetLevel, framework),
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return analysis.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Generate implementation roadmap
   */
  private generateRoadmap(
    gapAnalysis: GapAnalysis[],
    technologies: TechnologySuggestion[],
    context: OrganizationContext
  ): RoadmapPhase[] {
    const phases: RoadmapPhase[] = [];

    // Phase 1: Quick Wins (0-3 months)
    const quickWinDimensions = gapAnalysis
      .filter((g) => g.priority === 'critical' || g.priority === 'high')
      .slice(0, 3);

    const quickWinTech = technologies
      .filter((t) => t.implementationComplexity === 'low')
      .slice(0, 2);

    phases.push({
      phase: 1,
      name: 'Quick Wins',
      duration: '0-3 months',
      focus: quickWinDimensions.map((d) => d.dimension),
      technologies: quickWinTech.map((t) => t.name),
      expectedOutcome: 'Establish digital foundation and demonstrate early value',
      kpis: ['Process automation rate', 'Employee digital adoption', 'Data quality improvement'],
    });

    // Phase 2: Foundation Building (3-9 months)
    const foundationDimensions = gapAnalysis
      .filter((g) => g.priority === 'high' || g.priority === 'medium')
      .slice(0, 4);

    const foundationTech = technologies
      .filter((t) => t.implementationComplexity === 'medium')
      .slice(0, 3);

    phases.push({
      phase: 2,
      name: 'Foundation Building',
      duration: '3-9 months',
      focus: foundationDimensions.map((d) => d.dimension),
      technologies: foundationTech.map((t) => t.name),
      expectedOutcome: 'Build core digital capabilities and data infrastructure',
      kpis: ['Data integration coverage', 'System connectivity', 'Process digitization rate'],
    });

    // Phase 3: Advanced Capabilities (9-18 months)
    const advancedTech = technologies
      .filter((t) => t.implementationComplexity === 'high')
      .slice(0, 3);

    phases.push({
      phase: 3,
      name: 'Advanced Capabilities',
      duration: '9-18 months',
      focus: ['AI/ML Integration', 'Predictive Analytics', 'Digital Products'],
      technologies: advancedTech.map((t) => t.name),
      expectedOutcome: 'Deploy advanced analytics and AI-driven automation',
      kpis: ['AI model deployment count', 'Prediction accuracy', 'Automation coverage'],
    });

    // Phase 4: Digital Excellence (18+ months)
    phases.push({
      phase: 4,
      name: 'Digital Excellence',
      duration: '18+ months',
      focus: ['Innovation', 'Ecosystem Integration', 'New Business Models'],
      technologies: ['Custom AI Solutions', 'Digital Twin', 'Blockchain'],
      expectedOutcome: 'Achieve digital leadership and continuous innovation',
      kpis: ['Digital revenue share', 'Innovation pipeline', 'Customer digital engagement'],
    });

    return phases;
  }

  /**
   * Generate overall recommendation summary
   */
  private generateOverallRecommendation(
    framework: SupportedFramework,
    currentScores: Record<string, number>,
    gapAnalysis: GapAnalysis[],
    context: OrganizationContext
  ): string {
    const avgScore =
      Object.values(currentScores).reduce((a, b) => a + b, 0) / Object.values(currentScores).length;
    const criticalGaps = gapAnalysis.filter((g) => g.priority === 'critical').length;
    const highGaps = gapAnalysis.filter((g) => g.priority === 'high').length;

    let recommendation = '';

    if (avgScore < 2) {
      recommendation = `Your organization is at an early stage of digital maturity (${avgScore.toFixed(1)}/5). `;
      recommendation += `Focus on establishing fundamental digital capabilities, starting with data management and process digitization. `;
    } else if (avgScore < 3) {
      recommendation = `Your organization has begun its digital transformation journey (${avgScore.toFixed(1)}/5). `;
      recommendation += `Prioritize building integrated data infrastructure and expanding automation. `;
    } else if (avgScore < 4) {
      recommendation = `Your organization demonstrates solid digital maturity (${avgScore.toFixed(1)}/5). `;
      recommendation += `Focus on advanced analytics, AI integration, and digital product development. `;
    } else {
      recommendation = `Your organization is a digital leader (${avgScore.toFixed(1)}/5). `;
      recommendation += `Continue innovating with emerging technologies and explore new digital business models. `;
    }

    if (criticalGaps > 0) {
      recommendation += `There are ${criticalGaps} critical gaps requiring immediate attention. `;
    }

    if (highGaps > 0) {
      recommendation += `Address ${highGaps} high-priority areas to accelerate transformation. `;
    }

    recommendation += `Based on ${context.industry} industry benchmarks, your organization has significant opportunity for improvement.`;

    return recommendation;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private calculateSuggestedLevel(
    currentLevel: number,
    benchmark: { average: number; top: number },
    context: OrganizationContext
  ): number {
    // Suggest level based on industry benchmark and organization ambition
    let targetMultiplier = 1.2; // Default: 20% above current

    if (context.size === 'enterprise') targetMultiplier = 1.3;
    if (context.budget === 'high') targetMultiplier = 1.4;

    const suggestedFromCurrent = Math.min(currentLevel * targetMultiplier, 5);
    const suggestedFromBenchmark = Math.min(benchmark.average + 0.5, benchmark.top);

    return Math.round(Math.max(suggestedFromCurrent, suggestedFromBenchmark) * 10) / 10;
  }

  private calculateConfidence(
    currentLevel: number,
    suggestedLevel: number,
    context: OrganizationContext
  ): number {
    let confidence = 80;

    // Lower confidence for larger jumps
    const gap = suggestedLevel - currentLevel;
    if (gap > 2) confidence -= 20;
    else if (gap > 1) confidence -= 10;

    // Adjust based on organization size
    if (context.size === 'small') confidence -= 10;
    if (context.size === 'enterprise') confidence += 5;

    return Math.max(50, Math.min(95, confidence));
  }

  private generateLevelReasoning(
    dimensionId: string,
    currentLevel: number,
    suggestedLevel: number,
    context: OrganizationContext
  ): string {
    const gap = suggestedLevel - currentLevel;
    let reasoning = `Based on ${context.industry} industry benchmarks and your organization's profile, `;

    if (gap <= 1) {
      reasoning += `an incremental improvement to level ${suggestedLevel} is achievable within 6-12 months. `;
    } else {
      reasoning += `a significant transformation to level ${suggestedLevel} is recommended over 12-18 months. `;
    }

    reasoning += `This aligns with best practices for ${context.size}-sized organizations.`;

    return reasoning;
  }

  private estimateTimeToAchieve(currentLevel: number, targetLevel: number): string {
    const gap = targetLevel - currentLevel;
    if (gap <= 0.5) return '3-6 months';
    if (gap <= 1) return '6-12 months';
    if (gap <= 1.5) return '12-18 months';
    return '18-24 months';
  }

  private estimateInvestment(currentLevel: number, targetLevel: number): 'low' | 'medium' | 'high' {
    const gap = targetLevel - currentLevel;
    if (gap <= 0.5) return 'low';
    if (gap <= 1) return 'medium';
    return 'high';
  }

  private getDimensionName(dimensionId: string, framework: SupportedFramework): string {
    // Simplified mapping - in production, this would use actual framework structures
    const nameMap: Record<string, string> = {
      // DRD
      businessModels: 'Business Models',
      digitalProducts: 'Digital Products',
      dataManagement: 'Data Management',
      aiMaturity: 'AI Maturity',
      processes: 'Processes',
      culture: 'Culture',
      // SIRI
      operations: 'Operations',
      supplyChain: 'Supply Chain',
      lifecycle: 'Product Lifecycle',
      // ADMA
      digital_strategy: 'Digital Strategy',
      digital_investments: 'Digital Investments',
      digital_culture: 'Digital Culture',
      product_features: 'Smart Product Features',
      product_data: 'Product Data Usage',
      production_tech: 'Production Technologies',
      production_it: 'Production IT',
      supply_integration: 'Supply Chain Integration',
      supply_visibility: 'Supply Chain Visibility',
      data_collection: 'Data Collection',
      data_analytics: 'Data Analytics',
      data_services: 'Data-Based Services',
    };

    return nameMap[dimensionId] || dimensionId;
  }

  private mapDimensionsToTechCategories(
    dimensions: string[],
    framework: SupportedFramework
  ): string[] {
    const categoryMap: Record<string, string[]> = {
      dataManagement: ['dataManagement'],
      data_collection: ['dataManagement'],
      data_analytics: ['dataManagement', 'aiMaturity'],
      aiMaturity: ['aiMaturity'],
      processes: ['processes'],
      production_tech: ['processes', 'digitalProducts'],
      production_it: ['processes'],
      digitalProducts: ['digitalProducts'],
      product_features: ['digitalProducts'],
      product_data: ['digitalProducts', 'dataManagement'],
      culture: ['culture'],
      digital_culture: ['culture'],
      supply_integration: ['processes'],
      supply_visibility: ['dataManagement'],
    };

    const categories = new Set<string>();
    for (const dim of dimensions) {
      const cats = categoryMap[dim] || ['processes'];
      cats.forEach((c) => categories.add(c));
    }

    return Array.from(categories);
  }

  private calculatePriority(
    gap: number,
    dimensionId: string,
    framework: SupportedFramework
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Critical dimensions
    const criticalDimensions = [
      'dataManagement',
      'data_collection',
      'processes',
      'digital_strategy',
    ];

    if (gap >= 2 && criticalDimensions.includes(dimensionId)) return 'critical';
    if (gap >= 2) return 'high';
    if (gap >= 1) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    dimensionId: string,
    currentLevel: number,
    targetLevel: number,
    framework: SupportedFramework
  ): string[] {
    const recommendations: string[] = [];

    if (currentLevel < 2) {
      recommendations.push('Establish baseline digital capabilities');
      recommendations.push('Implement basic data collection and storage');
      recommendations.push('Train staff on digital tools');
    } else if (currentLevel < 3) {
      recommendations.push('Integrate systems and data sources');
      recommendations.push('Implement analytics dashboards');
      recommendations.push('Automate key processes');
    } else if (currentLevel < 4) {
      recommendations.push('Deploy predictive analytics');
      recommendations.push('Implement AI-assisted decision making');
      recommendations.push('Develop digital products/services');
    } else {
      recommendations.push('Explore emerging technologies');
      recommendations.push('Build innovation capabilities');
      recommendations.push('Create digital ecosystem partnerships');
    }

    return recommendations;
  }

  private generateQuickWins(
    dimensionId: string,
    currentLevel: number,
    framework: SupportedFramework
  ): string[] {
    return [
      'Implement automated reporting',
      'Deploy collaboration tools',
      'Digitize paper-based processes',
      'Enable mobile access to key systems',
    ];
  }

  private generateLongTermActions(
    dimensionId: string,
    targetLevel: number,
    framework: SupportedFramework
  ): string[] {
    return [
      'Build enterprise data platform',
      'Implement AI/ML capabilities',
      'Develop digital twin technology',
      'Create data-driven business models',
    ];
  }

  private generateDefaultTargets(
    currentScores: Record<string, number>,
    context: OrganizationContext
  ): Record<string, number> {
    const targets: Record<string, number> = {};
    const increment = context.budget === 'high' ? 1.5 : context.budget === 'medium' ? 1.0 : 0.5;

    for (const [dim, score] of Object.entries(currentScores)) {
      targets[dim] = Math.min(5, score + increment);
    }

    return targets;
  }

  /**
   * Get AI-enhanced suggestions using LLM
   */
  async getAISuggestions(
    request: SuggestionRequest,
    additionalContext?: string
  ): Promise<SuggestionResponse> {
    // First get rule-based suggestions
    const baseSuggestions = await this.generateSuggestions(request);

    // If AI service is available, enhance with LLM
    if (this.aiService) {
      try {
        const prompt = this.buildAIPrompt(request, baseSuggestions, additionalContext);
        const aiResponse = await this.aiService.generateCompletion(prompt);

        // Parse and merge AI suggestions
        const enhancedSuggestions = this.mergeAISuggestions(baseSuggestions, aiResponse);
        return enhancedSuggestions;
      } catch (error) {
        console.error('AI enhancement failed, returning base suggestions:', error);
        return baseSuggestions;
      }
    }

    return baseSuggestions;
  }

  private buildAIPrompt(
    request: SuggestionRequest,
    baseSuggestions: SuggestionResponse,
    additionalContext?: string
  ): string {
    return `
You are a digital transformation expert. Analyze the following assessment data and provide enhanced recommendations.

Framework: ${request.framework}
Industry: ${request.organizationContext.industry}
Organization Size: ${request.organizationContext.size}
Current Scores: ${JSON.stringify(request.currentScores)}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Based on the gap analysis:
${baseSuggestions.gapAnalysis.map((g) => `- ${g.dimension}: ${g.currentLevel} → ${g.targetLevel} (${g.priority})`).join('\n')}

Please provide:
1. Specific technology recommendations for this industry
2. Implementation priorities considering the organization size
3. Risk factors to consider
4. Success metrics to track

Respond in JSON format with keys: enhancedTechnologies, priorities, risks, metrics
`;
  }

  private mergeAISuggestions(
    baseSuggestions: SuggestionResponse,
    aiResponse: string
  ): SuggestionResponse {
    try {
      const aiData = JSON.parse(aiResponse);

      // Enhance overall recommendation with AI insights
      let enhancedRecommendation = baseSuggestions.overallRecommendation;
      if (aiData.priorities) {
        enhancedRecommendation += ` Key priorities: ${aiData.priorities.join(', ')}.`;
      }
      if (aiData.risks) {
        enhancedRecommendation += ` Watch for risks: ${aiData.risks.slice(0, 2).join(', ')}.`;
      }

      return {
        ...baseSuggestions,
        overallRecommendation: enhancedRecommendation,
      };
    } catch {
      return baseSuggestions;
    }
  }
}

export const aiSuggestionService = new AISuggestionService();
export default AISuggestionService;
