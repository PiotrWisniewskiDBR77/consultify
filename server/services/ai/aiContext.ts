/**
 * AI Context Builder - Enhanced Version
 *
 * Responsibility: Build comprehensive context for AI-powered report generation
 * Including:
 * - User and organization context
 * - Company profile with industry specifics
 * - Regulatory and compliance context
 * - Assessment data with gap analysis
 * - Industry benchmarks integration
 */

import db from '../../database.js';

export interface IndustryProfile {
  name: string;
  namePl: string;
  regulations: string[];
  keyTransformationAreas: string[];
  typicalChallenges: string[];
  benchmarkSources: string[];
  averageMaturity: { global: number; poland: number; leader: number };
  transformationHorizon: string;
}

export interface CompanySizeProfile {
  range: string;
  characteristics: string[];
  transformationApproach: string;
  budgetIndicator: string;
  teamCapacity: string;
}

export interface RegulatoryContext {
  name: string;
  fullName: string;
  relevance: string[];
  keyRequirements: string[];
  penalties?: string;
  deadline?: string;
  timeline?: string;
  impactOnTransformation: string;
  applicability?: string;
}

export interface DrdAxis {
  name: string;
  namePl: string;
  maxLevel: number;
}

// Database row types
interface OrganizationRow {
  id?: string;
  name?: string;
  transformation_context?: string;
  industry?: string;
  companySize?: string;
  employees?: number;
  location?: string;
  country?: string;
  founded?: number;
  revenue?: number;
  digitalMaturity?: string;
  priorities?: string[];
  strategicPriorities?: string[];
  currentInitiatives?: unknown[];
  budget?: number;
  timeline?: string;
  resources?: string;
}

interface ProjectRow {
  id?: string;
  name?: string;
  status?: string;
  context?: string;
  phase?: string;
  organization_id?: string;
}

interface AssessmentRow {
  id?: string;
  name?: string;
  organization_id?: string;
  project_id?: string;
  axisData?: unknown;
  axis_data?: unknown;
  axis_scores?: unknown;
  overall_as_is?: string;
  overall_to_be?: string;
  overall_gap?: string;
  is_complete?: boolean;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  transformation_context?: string;
  context?: string;
  project_context?: string;
  organization_name?: string;
  org_name?: string;
  org_context?: string;
  org_industry?: string;
}

export interface BuildContextParams {
  userId?: string;
  organizationId?: string;
  projectId?: string;
  screenContext?: Record<string, unknown>;
  capability?: string;
  assessmentId?: string;
}

export interface BuildReportContextParams {
  assessmentId: string;
  organizationId?: string;
  projectId?: string;
  language?: string;
}

export interface CompanyProfile {
  industry: string;
  industryProfile: IndustryProfile;
  size: string;
  sizeProfile: CompanySizeProfile;
  location: string;
  founded?: string;
  revenue?: string;
  employees?: string | number;
  digitalMaturitySelfAssessment?: number;
  strategicPriorities: string[];
  currentInitiatives: string[];
  constraints: {
    budget?: string;
    timeline?: string;
    resources?: string;
  };
  rawContext: Record<string, unknown>;
}

export interface AssessmentAxis {
  id: string;
  name: string;
  namePl: string;
  maxLevel: number;
  actual: number;
  target: number;
  gap: number;
  justification?: string | null;
  areaScores?: Record<string, unknown> | null;
}

export interface AssessmentContext {
  axes: AssessmentAxis[];
  summary: {
    axesAssessed: number;
    totalAxes: number;
    averageMaturity: string;
    averageTarget: string;
    averageGap: string;
    totalGapPoints: number;
  };
  highlights: {
    strongest: { axis: string; score: number } | null;
    weakest: { axis: string; score: number } | null;
    largestGap: { axis: string; gap: number } | null;
  };
  hasJustifications: boolean;
  hasAreaScores: boolean;
}

export interface GapAnalysisResult {
  axis: string;
  axisName: string;
  current: number;
  target: number;
  gap: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  estimatedMonths: number;
  complexity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GapAnalysis {
  totalGaps: number;
  criticalGaps: GapAnalysisResult[];
  highPriorityGaps: GapAnalysisResult[];
  mediumPriorityGaps: GapAnalysisResult[];
  lowPriorityGaps: GapAnalysisResult[];
  allGaps: GapAnalysisResult[];
  estimatedTotalTransformationMonths: number;
}

export interface MaturityAnalysis {
  averageMaturity: string;
  industryBenchmark: string;
  positioning: 'LEADER' | 'ABOVE_AVERAGE' | 'AT_AVERAGE' | 'BELOW_AVERAGE' | 'LAGGARD';
  positioningLabel: string;
  areasAboveIndustry: string[];
  areasBelowIndustry: string[];
}

export interface ContextConfigurations {
  industries: string[];
  companySizes: string[];
  regulations: string[];
  axes: string[];
}

// Industry configurations with regulatory and transformation context
const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  manufacturing: {
    name: 'Manufacturing',
    namePl: 'Produkcja',
    regulations: ['ISO 9001', 'ISO 14001', 'Industry 4.0 Standards', 'GDPR', 'NIS2'],
    keyTransformationAreas: [
      'Smart Factory',
      'Predictive Maintenance',
      'Supply Chain Visibility',
      'Quality 4.0',
    ],
    typicalChallenges: [
      'Legacy OT/IT integration',
      'Workforce upskilling for digital tools',
      'Data silos between production and business systems',
      'Cybersecurity for connected machines',
    ],
    benchmarkSources: ['SIRI', 'Acatech Industry 4.0 Index', 'McKinsey Digital Quotient'],
    averageMaturity: { global: 3.2, poland: 2.8, leader: 5.5 },
    transformationHorizon: '18-36 months',
  },
  retail: {
    name: 'Retail & E-commerce',
    namePl: 'Handel i E-commerce',
    regulations: ['GDPR', 'Consumer Protection', 'PCI-DSS', 'Accessibility Standards'],
    keyTransformationAreas: [
      'Omnichannel',
      'Personalization',
      'Inventory Optimization',
      'Last-mile Delivery',
    ],
    typicalChallenges: [
      'Unified customer view across channels',
      'Real-time inventory management',
      'Competition from digital-native players',
      'Customer data privacy and consent',
    ],
    benchmarkSources: ['NRF Digital Index', 'Retail Systems Research'],
    averageMaturity: { global: 3.8, poland: 3.2, leader: 5.8 },
    transformationHorizon: '12-24 months',
  },
  financial: {
    name: 'Financial Services',
    namePl: 'Usługi Finansowe',
    regulations: ['GDPR', 'PSD2', 'DORA', 'NIS2', 'AML/KYC', 'Basel III/IV'],
    keyTransformationAreas: ['Open Banking', 'Digital Onboarding', 'AI Risk Management', 'RegTech'],
    typicalChallenges: [
      'Regulatory compliance burden',
      'Legacy core banking systems',
      'Fintech competition and partnerships',
      'Fraud and cybersecurity threats',
    ],
    benchmarkSources: ['Capgemini World FinTech Report', 'Deloitte Digital Banking Maturity'],
    averageMaturity: { global: 4.2, poland: 3.5, leader: 6.2 },
    transformationHorizon: '24-48 months',
  },
  healthcare: {
    name: 'Healthcare',
    namePl: 'Ochrona Zdrowia',
    regulations: ['GDPR', 'HIPAA-equivalent', 'Medical Device Regulations', 'NIS2'],
    keyTransformationAreas: [
      'Telemedicine',
      'EHR Integration',
      'Clinical Decision Support',
      'Patient Engagement',
    ],
    typicalChallenges: [
      'Interoperability of health systems',
      'Data privacy and patient consent',
      'Clinical staff technology adoption',
      'Legacy medical equipment integration',
    ],
    benchmarkSources: ['HIMSS Maturity Model', 'Healthcare Information Technology'],
    averageMaturity: { global: 3.0, poland: 2.5, leader: 5.0 },
    transformationHorizon: '24-48 months',
  },
  technology: {
    name: 'Technology & Software',
    namePl: 'Technologia i Software',
    regulations: ['GDPR', 'SOC 2', 'ISO 27001', 'AI Act'],
    keyTransformationAreas: [
      'Cloud-Native',
      'DevOps/MLOps',
      'Product-Led Growth',
      'AI Integration',
    ],
    typicalChallenges: [
      'Talent acquisition and retention',
      'Technical debt management',
      'Scaling infrastructure',
      'Security in fast-moving environment',
    ],
    benchmarkSources: ['DORA Metrics', 'Accelerate State of DevOps'],
    averageMaturity: { global: 5.2, poland: 4.5, leader: 6.8 },
    transformationHorizon: '6-18 months',
  },
  logistics: {
    name: 'Logistics & Transportation',
    namePl: 'Logistyka i Transport',
    regulations: ['GDPR', 'ADR', 'Customs Regulations', 'Environmental Standards'],
    keyTransformationAreas: [
      'Supply Chain Visibility',
      'Route Optimization',
      'Warehouse Automation',
      'Last-Mile Innovation',
    ],
    typicalChallenges: [
      'Real-time tracking and visibility',
      'Fragmented systems across partners',
      'Sustainability requirements',
      'Driver/worker shortage',
    ],
    benchmarkSources: ['Gartner Supply Chain Top 25', 'DHL Logistics Trend Radar'],
    averageMaturity: { global: 3.5, poland: 3.0, leader: 5.5 },
    transformationHorizon: '18-36 months',
  },
  energy: {
    name: 'Energy & Utilities',
    namePl: 'Energetyka',
    regulations: ['Energy Regulations', 'Environmental Standards', 'NIS2', 'GDPR'],
    keyTransformationAreas: [
      'Smart Grid',
      'Renewable Integration',
      'Customer Engagement',
      'Predictive Maintenance',
    ],
    typicalChallenges: [
      'Grid modernization and stability',
      'Distributed energy resources management',
      'Customer expectation changes',
      'Critical infrastructure security',
    ],
    benchmarkSources: ['Utility Digital Maturity Index', 'S&P Global Energy'],
    averageMaturity: { global: 3.3, poland: 2.8, leader: 5.2 },
    transformationHorizon: '24-60 months',
  },
  services: {
    name: 'Professional Services',
    namePl: 'Usługi Profesjonalne',
    regulations: ['GDPR', 'Professional Standards', 'Data Protection'],
    keyTransformationAreas: [
      'Client Experience',
      'Knowledge Management',
      'Automation',
      'Remote Collaboration',
    ],
    typicalChallenges: [
      'Knowledge worker productivity',
      'Client data confidentiality',
      'Billable hours vs. efficiency tension',
      'Partner buy-in for change',
    ],
    benchmarkSources: ['Thomson Reuters Legal Tech Report', 'ALM Intelligence'],
    averageMaturity: { global: 3.5, poland: 3.0, leader: 5.5 },
    transformationHorizon: '12-24 months',
  },
};

// Company size classifications
const COMPANY_SIZE_PROFILES: Record<string, CompanySizeProfile> = {
  startup: {
    range: '1-50',
    characteristics: ['Agile', 'Resource-constrained', 'High growth focus'],
    transformationApproach: 'Lean, cloud-first, buy vs build',
    budgetIndicator: '€10K-100K',
    teamCapacity: '0.5-2 FTE for digital initiatives',
  },
  sme: {
    range: '51-250',
    characteristics: ['Growing pains', 'Process formalization needed', 'Key person dependencies'],
    transformationApproach: 'Phased, prioritized quick wins, build core capabilities',
    budgetIndicator: '€100K-500K',
    teamCapacity: '2-5 FTE for digital initiatives',
  },
  midmarket: {
    range: '251-1000',
    characteristics: ['Complex stakeholder landscape', 'Multiple systems', 'Departmental silos'],
    transformationApproach: 'Program-based, governance focus, change management critical',
    budgetIndicator: '€500K-2M',
    teamCapacity: '5-15 FTE for digital initiatives',
  },
  enterprise: {
    range: '1000+',
    characteristics: ['Legacy systems', 'Global complexity', 'Regulatory scrutiny'],
    transformationApproach: 'Portfolio approach, platform thinking, ecosystem strategy',
    budgetIndicator: '€2M-20M+',
    teamCapacity: '20+ FTE for digital initiatives',
  },
};

// Regulatory context for EU/Poland
const REGULATORY_CONTEXT: Record<string, RegulatoryContext> = {
  gdpr: {
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    relevance: ['All industries', 'Customer data', 'Employee data'],
    keyRequirements: [
      'Data minimization',
      'Consent management',
      'Data subject rights',
      'Privacy by design',
    ],
    penalties: 'Up to €20M or 4% of global revenue',
    impactOnTransformation:
      'Data governance and privacy must be built into all digital initiatives',
  },
  nis2: {
    name: 'NIS2',
    fullName: 'Network and Information Security Directive 2',
    relevance: ['Critical infrastructure', 'Digital services', 'Supply chain'],
    keyRequirements: [
      'Risk management',
      'Incident reporting',
      'Supply chain security',
      'Board accountability',
    ],
    deadline: 'October 2024 transposition',
    impactOnTransformation:
      'Cybersecurity must be elevated to board level, supply chain security mandatory',
  },
  aiAct: {
    name: 'AI Act',
    fullName: 'EU Artificial Intelligence Act',
    relevance: ['All AI deployments', 'High-risk systems', 'HR and credit decisions'],
    keyRequirements: ['Risk classification', 'Transparency', 'Human oversight', 'Documentation'],
    timeline: '2024-2027 phased implementation',
    impactOnTransformation:
      'AI governance framework required, documentation and auditability for AI systems',
  },
  dora: {
    name: 'DORA',
    fullName: 'Digital Operational Resilience Act',
    relevance: ['Financial services', 'ICT service providers'],
    keyRequirements: [
      'ICT risk management',
      'Incident management',
      'Digital resilience testing',
      'Third-party risk',
    ],
    deadline: 'January 2025',
    impactOnTransformation:
      'Financial sector must prioritize operational resilience in all digital projects',
  },
};

// DRD Axes configuration
const DRD_AXES: Record<string, DrdAxis> = {
  processes: { name: 'Digital Processes', namePl: 'Procesy Cyfrowe', maxLevel: 7 },
  digitalProducts: { name: 'Digital Products', namePl: 'Produkty Cyfrowe', maxLevel: 5 },
  businessModels: { name: 'Business Models', namePl: 'Modele Biznesowe', maxLevel: 5 },
  dataManagement: { name: 'Data Management', namePl: 'Zarządzanie Danymi', maxLevel: 7 },
  culture: { name: 'Culture', namePl: 'Kultura Transformacji', maxLevel: 5 },
  cybersecurity: { name: 'Cybersecurity', namePl: 'Cyberbezpieczeństwo', maxLevel: 5 },
  aiMaturity: { name: 'AI Maturity', namePl: 'Dojrzałość AI', maxLevel: 5 },
};

class ContextBuilder {
  private _industryProfiles: Record<string, IndustryProfile>;
  private _sizeProfiles: Record<string, CompanySizeProfile>;
  private _regulations: Record<string, RegulatoryContext>;

  constructor() {
    this._industryProfiles = INDUSTRY_PROFILES;
    this._sizeProfiles = COMPANY_SIZE_PROFILES;
    this._regulations = REGULATORY_CONTEXT;
  }

  /**
   * Build comprehensive context for AI operations
   */
  async build(params: BuildContextParams) {
    const { userId, organizationId, projectId, screenContext, capability, assessmentId } = params;

    // Fetch all relevant data in parallel
    const [userInfo, orgInfo, projectInfo, assessmentInfo] = await Promise.all([
      userId ? this._fetchUser(userId) : null,
      organizationId ? this._fetchOrganization(organizationId) : null,
      projectId ? this._fetchProject(projectId) : null,
      assessmentId ? this._fetchAssessment(assessmentId) : null,
    ]);

    // Build company profile
    const companyProfile = this._buildCompanyProfile(orgInfo, projectInfo);

    // Build industry context
    const industryContext = this._buildIndustryContext(companyProfile.industry);

    // Build regulatory context
    const regulatoryContext = this._buildRegulatoryContext(
      companyProfile.industry,
      companyProfile.location
    );

    // Build assessment context if available
    const assessmentContext = assessmentInfo ? this._buildAssessmentContext(assessmentInfo) : null;

    return {
      // Basic identifiers
      user: {
        id: userId,
        name: (userInfo as { name?: string } | null)?.name,
        role: (userInfo as { role?: string } | null)?.role,
        email: (userInfo as { email?: string } | null)?.email,
      },
      organization: {
        id: organizationId,
        name: (orgInfo as OrganizationRow | null)?.name,
        ...companyProfile,
      },
      project: {
        id: projectId,
        name: (projectInfo as ProjectRow | null)?.name,
        status: (projectInfo as ProjectRow | null)?.status,
        phase: (projectInfo as ProjectRow | null)?.phase,
      },

      // Enhanced context
      industryContext,
      regulatoryContext,
      assessmentContext,

      // Screen and capability context
      screen: screenContext || {},
      capability,

      // Metadata
      timestamp: new Date().toISOString(),
      contextVersion: '2.0',
    };
  }

  /**
   * Build context specifically for comprehensive report generation
   */
  async buildReportContext(params: BuildReportContextParams) {
    const { assessmentId, organizationId, projectId, language = 'pl' } = params;

    // Fetch assessment with all related data
    const assessment = await this._fetchFullAssessment(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    // Fetch organization details
    const assessmentRow = assessment as AssessmentRow;
    const organization = await this._fetchOrganization(
      organizationId || assessmentRow.organization_id || ''
    );

    // Build comprehensive company profile
    const companyProfile = this._buildCompanyProfile(organization, assessment);

    // Industry and regulatory context
    const industryContext = this._buildIndustryContext(companyProfile.industry);
    const regulatoryContext = this._buildRegulatoryContext(
      companyProfile.industry,
      companyProfile.location
    );

    // Assessment analysis
    const assessmentContext = this._buildAssessmentContext(assessment);
    const axisData = assessmentRow.axisData || assessmentRow.axis_data || assessmentRow.axis_scores;
    const gapAnalysis = this._performGapAnalysis(axisData);
    const maturityAnalysis = this._analyzeMaturityProfile(axisData, industryContext);

    return {
      // Core data
      assessment: {
        id: assessmentId,
        name: assessmentRow.name || '',
        completedAt: assessmentRow.completed_at,
        isComplete: assessmentRow.is_complete,
      },

      // Company profile
      company: {
        name: organization?.name || 'Organizacja',
        ...companyProfile,
      },

      // Industry intelligence
      industry: industryContext,

      // Regulatory landscape
      regulations: regulatoryContext,

      // Assessment insights
      maturity: assessmentContext,
      gaps: gapAnalysis,
      positioning: maturityAnalysis,

      // Report configuration
      config: {
        language,
        generatedAt: new Date().toISOString(),
        reportType: 'comprehensive',
      },
    };
  }

  // =========================================================================
  // PRIVATE: Company Profile Building
  // =========================================================================

  private _buildCompanyProfile(
    organization: unknown,
    projectOrAssessment: unknown
  ): CompanyProfile {
    const orgRow = organization as OrganizationRow | null;
    const projOrAssessRow = projectOrAssessment as ProjectRow | AssessmentRow | null;
    const transformationContext = this._parseJSON(orgRow?.transformation_context) || {};
    const projectContext =
      this._parseJSON(
        (projOrAssessRow as ProjectRow)?.context ||
          (projOrAssessRow as AssessmentRow)?.transformation_context
      ) || {};

    // Merge contexts with priority to organization
    const merged = {
      ...(projectContext as Record<string, unknown>),
      ...(transformationContext as Record<string, unknown>),
    };

    // Determine industry
    const industry = (merged.industry as string) || this._inferIndustry(orgRow?.name, merged);

    // Determine company size
    const employees =
      (merged.employees as number | undefined) || (merged.companySize as number | undefined);
    const size = this._determineCompanySize(employees as string | number | undefined);

    return {
      industry,
      industryProfile: INDUSTRY_PROFILES[industry] || INDUSTRY_PROFILES.manufacturing,
      size,
      sizeProfile: COMPANY_SIZE_PROFILES[size] || COMPANY_SIZE_PROFILES.sme,
      location: String(merged.location || merged.country || 'Poland'),
      founded: merged.founded as string | undefined,
      revenue: merged.revenue as string | undefined,
      employees:
        (merged.employees as number | undefined) || (merged.companySize as number | undefined),
      digitalMaturitySelfAssessment: merged.digitalMaturity as number | undefined,
      strategicPriorities:
        (merged.priorities as string[] | undefined) ||
        (merged.strategicPriorities as string[] | undefined) ||
        [],
      currentInitiatives: (merged.currentInitiatives as string[] | undefined) || [],
      constraints: {
        budget: merged.budget as string | undefined,
        timeline: merged.timeline as string | undefined,
        resources: merged.resources as string | undefined,
      },
      rawContext: merged,
    };
  }

  private _inferIndustry(orgName: string | undefined, context: Record<string, unknown>): string {
    // Check explicit industry field
    const industry = context.industry as string | undefined;
    if (industry && INDUSTRY_PROFILES[industry]) {
      return industry;
    }

    // Check sector/vertical fields
    const sector = String(context.sector || context.vertical || '').toLowerCase();
    for (const [key, profile] of Object.entries(INDUSTRY_PROFILES)) {
      if (sector.includes(key) || sector.includes(profile.name.toLowerCase())) {
        return key;
      }
    }

    // Keyword inference from org name
    const name = (orgName || '').toLowerCase();
    if (name.includes('bank') || name.includes('finans') || name.includes('ubezp'))
      return 'financial';
    if (name.includes('tech') || name.includes('soft') || name.includes('it')) return 'technology';
    if (name.includes('szpital') || name.includes('med') || name.includes('health'))
      return 'healthcare';
    if (name.includes('logist') || name.includes('transport')) return 'logistics';
    if (name.includes('energ') || name.includes('power')) return 'energy';
    if (name.includes('handel') || name.includes('retail') || name.includes('sklep'))
      return 'retail';

    // Default to manufacturing (most common for DRD)
    return 'manufacturing';
  }

  private _determineCompanySize(employeeInfo: string | number | undefined): string {
    if (!employeeInfo) return 'sme';

    const count =
      typeof employeeInfo === 'number'
        ? employeeInfo
        : parseInt(employeeInfo.replace(/[^\d]/g, ''), 10);

    if (isNaN(count)) {
      // Try string matching
      const str = String(employeeInfo).toLowerCase();
      if (str.includes('startup') || str.includes('mały')) return 'startup';
      if (str.includes('średni') || str.includes('sme')) return 'sme';
      if (str.includes('duży') || str.includes('enterprise')) return 'enterprise';
      return 'sme';
    }

    if (count <= 50) return 'startup';
    if (count <= 250) return 'sme';
    if (count <= 1000) return 'midmarket';
    return 'enterprise';
  }

  // =========================================================================
  // PRIVATE: Industry Context
  // =========================================================================

  private _buildIndustryContext(industryKey: string): IndustryProfile & {
    key: string;
    isKnownIndustry: boolean;
    maturityBenchmark: {
      description: string;
      global: number;
      poland: number;
      leader: number;
      gap: number;
    };
  } {
    const profile = INDUSTRY_PROFILES[industryKey] || INDUSTRY_PROFILES.manufacturing;

    return {
      key: industryKey,
      ...profile,
      isKnownIndustry: !!INDUSTRY_PROFILES[industryKey],
      maturityBenchmark: {
        description: `Average digital maturity in ${profile.name}`,
        global: profile.averageMaturity.global,
        poland: profile.averageMaturity.poland,
        leader: profile.averageMaturity.leader,
        gap: profile.averageMaturity.leader - profile.averageMaturity.global,
      },
    };
  }

  // =========================================================================
  // PRIVATE: Regulatory Context
  // =========================================================================

  private _buildRegulatoryContext(industryKey: string, location: string | undefined) {
    const industryProfile = INDUSTRY_PROFILES[industryKey] || INDUSTRY_PROFILES.manufacturing;
    const applicableRegulations = [];

    // Always include GDPR for EU
    applicableRegulations.push({
      ...REGULATORY_CONTEXT.gdpr,
      applicability: 'Mandatory for all organizations processing EU personal data',
    });

    // NIS2 for critical sectors
    const nis2Sectors = ['energy', 'healthcare', 'financial', 'logistics', 'manufacturing'];
    if (nis2Sectors.includes(industryKey)) {
      applicableRegulations.push({
        ...REGULATORY_CONTEXT.nis2,
        applicability: `${industryProfile.name} is considered essential/important sector under NIS2`,
      });
    }

    // DORA for financial sector
    if (industryKey === 'financial') {
      applicableRegulations.push({
        ...REGULATORY_CONTEXT.dora,
        applicability: 'Mandatory for all financial entities in EU',
      });
    }

    // AI Act for everyone using AI
    applicableRegulations.push({
      ...REGULATORY_CONTEXT.aiAct,
      applicability:
        'Applicable if deploying AI systems, especially in HR, credit, or safety-critical areas',
    });

    return {
      location: location || 'Poland',
      jurisdiction: 'EU',
      applicableRegulations,
      industrySpecificRegulations: industryProfile.regulations,
      complianceRecommendation: this._generateComplianceRecommendation(
        industryKey,
        applicableRegulations
      ),
    };
  }

  private _generateComplianceRecommendation(
    industryKey: string,
    regulations: (RegulatoryContext & { applicability: string })[]
  ): string {
    const priorityRegulations = regulations.filter(
      (r) => r.name === 'GDPR' || r.name === 'NIS2' || r.name === 'DORA'
    );

    if (priorityRegulations.length === 0) {
      return 'Standard data protection and cybersecurity measures recommended.';
    }

    return (
      `Priority compliance focus: ${priorityRegulations.map((r) => r.name).join(', ')}. ` +
      'Ensure all digital transformation initiatives incorporate compliance requirements from design phase.'
    );
  }

  // =========================================================================
  // PRIVATE: Assessment Context
  // =========================================================================

  private _buildAssessmentContext(assessment: unknown): AssessmentContext {
    const assessmentRow = assessment as AssessmentRow;
    const axisData =
      this._parseJSON(assessmentRow.axis_data) ||
      assessmentRow.axisData ||
      assessmentRow.axis_scores ||
      {};

    const axes = Object.entries(axisData)
      .filter(([key]) => DRD_AXES[key])
      .map(([key, data]) => ({
        id: key,
        name: DRD_AXES[key].name,
        namePl: DRD_AXES[key].namePl,
        maxLevel: DRD_AXES[key].maxLevel,
        actual: data.actual || 0,
        target: data.target || 0,
        gap: (data.target || 0) - (data.actual || 0),
        justification: data.justification || null,
        areaScores: data.areaScores || null,
      }));

    // Calculate aggregates
    const assessed = axes.filter((a) => a.actual > 0);
    const avgActual =
      assessed.length > 0 ? assessed.reduce((sum, a) => sum + a.actual, 0) / assessed.length : 0;
    const avgTarget =
      assessed.length > 0 ? assessed.reduce((sum, a) => sum + a.target, 0) / assessed.length : 0;

    // Find extremes
    const strongest = [...assessed].sort((a, b) => b.actual - a.actual)[0];
    const weakest = [...assessed].sort((a, b) => a.actual - b.actual)[0];
    const largestGap = [...assessed].sort((a, b) => b.gap - a.gap)[0];

    return {
      axes,
      summary: {
        axesAssessed: assessed.length,
        totalAxes: 7,
        averageMaturity: avgActual.toFixed(1),
        averageTarget: avgTarget.toFixed(1),
        averageGap: (avgTarget - avgActual).toFixed(1),
        totalGapPoints: assessed.reduce((sum, a) => sum + Math.max(0, a.gap), 0),
      },
      highlights: {
        strongest: strongest ? { axis: strongest.namePl, score: strongest.actual } : null,
        weakest: weakest ? { axis: weakest.namePl, score: weakest.actual } : null,
        largestGap: largestGap ? { axis: largestGap.namePl, gap: largestGap.gap } : null,
      },
      hasJustifications: axes.some((a) => a.justification),
      hasAreaScores: axes.some((a) => a.areaScores),
    };
  }

  private _performGapAnalysis(axisData: unknown): GapAnalysis {
    const parsed = this._parseJSON(axisData) || axisData || {};

    const gaps = Object.entries(parsed)
      .filter(([key]) => DRD_AXES[key])
      .map(([key, data]) => ({
        axis: key,
        axisName: DRD_AXES[key].namePl,
        current: data.actual || 0,
        target: data.target || 0,
        gap: (data.target || 0) - (data.actual || 0),
        priority: this._calculateGapPriority(data.actual, data.target),
        estimatedMonths: this._estimateTransformationTime(data.actual, data.target),
        complexity: this._assessComplexity(key, data.actual, data.target),
      }))
      .filter((g) => g.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    return {
      totalGaps: gaps.length,
      criticalGaps: gaps.filter((g) => g.priority === 'CRITICAL'),
      highPriorityGaps: gaps.filter((g) => g.priority === 'HIGH'),
      mediumPriorityGaps: gaps.filter((g) => g.priority === 'MEDIUM'),
      lowPriorityGaps: gaps.filter((g) => g.priority === 'LOW'),
      allGaps: gaps,
      estimatedTotalTransformationMonths:
        Math.max(...gaps.map((g) => g.estimatedMonths), 0) + Math.floor(gaps.length * 1.5), // Overlap factor
    };
  }

  private _calculateGapPriority(
    actual: number,
    target: number
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
    const gap = (target || 0) - (actual || 0);
    if (gap >= 4) return 'CRITICAL';
    if (gap >= 3) return 'HIGH';
    if (gap >= 2) return 'MEDIUM';
    if (gap >= 1) return 'LOW';
    return 'NONE';
  }

  private _estimateTransformationTime(actual: number, target: number): number {
    const gap = (target || 0) - (actual || 0);
    if (gap <= 0) return 0;

    // Base: 3-4 months per level, increasing for higher levels
    let months = 0;
    for (let level = actual + 1; level <= target; level++) {
      months += level <= 3 ? 3 : level <= 5 ? 4 : 6;
    }
    return months;
  }

  private _assessComplexity(
    axisId: string,
    actual: number,
    target: number
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    const gap = (target || 0) - (actual || 0);
    const complexAxes = ['culture', 'businessModels', 'aiMaturity'];

    if (complexAxes.includes(axisId) && gap >= 2) return 'HIGH';
    if (gap >= 3) return 'HIGH';
    if (gap >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private _analyzeMaturityProfile(
    axisData: unknown,
    industryContext: IndustryProfile & {
      key: string;
      isKnownIndustry: boolean;
      maturityBenchmark: {
        description: string;
        global: number;
        poland: number;
        leader: number;
        gap: number;
      };
    }
  ): MaturityAnalysis {
    const parsed = this._parseJSON(axisData) || axisData || {};
    const industryBenchmark = industryContext.averageMaturity?.global || 3.0;

    const axes = Object.entries(parsed)
      .filter(([key]) => DRD_AXES[key])
      .map(([key, data]) => ({
        axis: key,
        score: data.actual || 0,
        vsIndustry: (data.actual || 0) - industryBenchmark,
      }));

    const avgScore = axes.length > 0 ? axes.reduce((sum, a) => sum + a.score, 0) / axes.length : 0;

    const aboveIndustry = axes.filter((a) => a.vsIndustry > 0.5);
    const belowIndustry = axes.filter((a) => a.vsIndustry < -0.5);

    let positioning: 'LEADER' | 'ABOVE_AVERAGE' | 'AT_AVERAGE' | 'BELOW_AVERAGE' | 'LAGGARD' =
      'AT_AVERAGE';
    if (avgScore >= industryBenchmark + 1) positioning = 'LEADER';
    else if (avgScore >= industryBenchmark + 0.5) positioning = 'ABOVE_AVERAGE';
    else if (avgScore <= industryBenchmark - 1) positioning = 'LAGGARD';
    else if (avgScore <= industryBenchmark - 0.5) positioning = 'BELOW_AVERAGE';

    return {
      averageMaturity: avgScore.toFixed(1),
      industryBenchmark: industryBenchmark.toFixed(1),
      positioning,
      positioningLabel: {
        LEADER: 'Lider branży',
        ABOVE_AVERAGE: 'Powyżej średniej',
        AT_AVERAGE: 'Średnia branżowa',
        BELOW_AVERAGE: 'Poniżej średniej',
        LAGGARD: 'Wymaga transformacji',
      }[positioning],
      areasAboveIndustry: aboveIndustry.map((a) => DRD_AXES[a.axis]?.namePl || a.axis),
      areasBelowIndustry: belowIndustry.map((a) => DRD_AXES[a.axis]?.namePl || a.axis),
    };
  }

  // =========================================================================
  // PRIVATE: Data Fetching
  // =========================================================================

  private async _fetchUser(userId: string): Promise<unknown> {
    return new Promise((resolve) => {
      db.get('SELECT id, email, name, role FROM users WHERE id = ?', [userId], (err, row) =>
        resolve(err ? null : row)
      );
    });
  }

  private async _fetchOrganization(orgId: string): Promise<OrganizationRow | null> {
    return new Promise((resolve) => {
      db.get(
        'SELECT id, name, transformation_context FROM organizations WHERE id = ?',
        [orgId],
        (err, row) => resolve(err ? null : (row as OrganizationRow | null))
      );
    });
  }

  private async _fetchProject(projectId: string): Promise<ProjectRow | null> {
    return new Promise((resolve) => {
      db.get(
        'SELECT id, name, status, context, phase FROM projects WHERE id = ?',
        [projectId],
        (err, row) => resolve(err ? null : (row as ProjectRow | null))
      );
    });
  }

  private async _fetchAssessment(assessmentId: string): Promise<AssessmentRow | null> {
    return new Promise((resolve) => {
      db.get(
        `SELECT a.*, o.name as org_name, o.transformation_context as org_context
                 FROM assessments a
                 LEFT JOIN organizations o ON a.organization_id = o.id
                 WHERE a.id = ?`,
        [assessmentId],
        (err, row) => resolve(err ? null : (row as AssessmentRow | null))
      );
    });
  }

  private async _fetchFullAssessment(assessmentId: string): Promise<AssessmentRow | null> {
    // Helper to wait for database to be ready and schema initialized
    const waitForDb = (): Promise<void> =>
      new Promise<void>((resolve: () => void) => {
        const check = (attempts = 0) => {
          if (!db || typeof db.get !== 'function') {
            if (attempts < 50) {
              setTimeout(() => check(attempts + 1), 100);
            } else {
              resolve(); // Proceed anyway after 5 seconds
            }
            return;
          }

          // Check if projects table exists (created during init)
          const isPg =
            process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');
          const tableCheckQuery = isPg
            ? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects'"
            : "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'";
          db.get(tableCheckQuery, [], (err, row) => {
            if (row) {
              resolve();
            } else if (attempts < 50) {
              setTimeout(() => check(attempts + 1), 100);
            } else {
              resolve();
            }
          });
        };
        check();
      });

    await waitForDb();

    return new Promise((resolve) => {
      // Prefer canonical assessments runtime. Legacy maturity_assessments stays as fallback only.
      db.get(
        `SELECT 
                    a.*,
                    p.name as project_name,
                    p.context_data as project_context,
                    o.name as organization_name,
                    o.id as organization_id,
                    o.industry as org_industry
                 FROM assessments a
                 LEFT JOIN projects p ON a.project_id = p.id
                 LEFT JOIN organizations o ON p.organization_id = o.id
                 WHERE a.id = ?`,
        [assessmentId],
        (err, row) => {
          if (err || !row) {
            db.get(
              `SELECT 
                                m.id,
                                m.project_id,
                                m.axis_scores as axis_data,
                                m.overall_as_is,
                                m.overall_to_be,
                                m.overall_gap,
                                m.is_complete,
                                m.created_at,
                                m.updated_at,
                                p.name as project_name,
                                p.context_data as project_context,
                                o.name as organization_name,
                                o.id as organization_id,
                                o.industry as org_industry
                             FROM maturity_assessments m
                             LEFT JOIN projects p ON m.project_id = p.id
                             LEFT JOIN organizations o ON p.organization_id = o.id
                             WHERE m.id = ?`,
              [assessmentId],
              (err2, row2) => {
                if (err2 || !row2) {
                  resolve(null);
                } else {
                  row2.axisData = this._parseJSON(row2.axis_data) || {};
                  resolve(row2);
                }
              }
            );
          } else {
            row.axisData = this._parseJSON(row.axis_data) || {};
            resolve(row);
          }
        }
      );
    });
  }

  // =========================================================================
  // PRIVATE: Utilities
  // =========================================================================

  private _parseJSON(str: unknown): Record<string, unknown> | null {
    if (!str) return null;
    if (typeof str === 'object') return str as Record<string, unknown>;
    try {
      const strValue = typeof str === 'string' ? str : String(str);
      return JSON.parse(strValue);
    } catch {
      return null;
    }
  }

  /**
   * Get available configurations
   */
  getConfigurations(): ContextConfigurations {
    return {
      industries: Object.keys(INDUSTRY_PROFILES),
      companySizes: Object.keys(COMPANY_SIZE_PROFILES),
      regulations: Object.keys(REGULATORY_CONTEXT),
      axes: Object.keys(DRD_AXES),
    };
  }
}

// Export singleton and configurations
const contextBuilder = new ContextBuilder();

export {
  COMPANY_SIZE_PROFILES,
  ContextBuilder,
  contextBuilder,
  DRD_AXES,
  INDUSTRY_PROFILES,
  REGULATORY_CONTEXT,
};

export default contextBuilder;
