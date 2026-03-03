/**
 * Report Builder Invocation Profiles
 *
 * Defines configuration presets for different report builder invocation contexts.
 * Each profile controls:
 * - Allowed block types
 * - Default template sections
 * - Minimal required intent fields
 * - Default styling/branding options
 */

import type { SectionLanguage, SectionLength } from '../services/reportBuilderService.js';

// ==========================================
// TYPES
// ==========================================

export interface InvocationProfile {
  id: string;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;

  // Source type restrictions
  sourceTypes: string[];

  // Block type restrictions (null = all allowed)
  allowedBlockTypes: string[] | null;
  disallowedBlockTypes: string[];

  // Default template configuration
  defaultTemplateSections: Array<{
    key: string;
    type: string;
    title: string;
    titlePl: string;
    required: boolean;
    order: number;
    defaultLength?: SectionLength;
    defaultLanguage?: SectionLanguage;
    repeatFor?: string;
    blockTypeId?: string;
    renderKind?: string;
  }>;

  // Intent requirements
  requiredIntentFields: string[];
  defaultIntent: {
    audience?: 'executive' | 'technical' | 'board' | 'operational';
    goal?: 'diagnosis' | 'recommendation' | 'summary' | 'detailed';
    tone?: 'consulting' | 'academic' | 'casual';
    scope?: 'full' | 'focused';
  };

  // Styling defaults
  defaultStyling: {
    showCompanyLogo: boolean;
    showConsultifyBranding: boolean;
    primaryColor?: string;
  };

  // Feature flags
  features: {
    allowCustomSections: boolean;
    allowReordering: boolean;
    allowMatrixVisualization: boolean;
    allowPdfExport: boolean;
    allowPublicSharing: boolean;
  };
}

// ==========================================
// PROFILE DEFINITIONS
// ==========================================

export const INVOCATION_PROFILES: Record<string, InvocationProfile> = {
  /**
   * Assessment Full Profile
   * For comprehensive DRD assessment reports
   */
  assessment_full: {
    id: 'assessment_full',
    name: 'Full Assessment Report',
    namePl: 'Pełny Raport z Oceny',
    description: 'Comprehensive report covering all assessment dimensions',
    descriptionPl: 'Kompleksowy raport obejmujący wszystkie wymiary oceny',

    sourceTypes: ['ASSESSMENT'],

    allowedBlockTypes: null, // All allowed
    disallowedBlockTypes: [],

    defaultTemplateSections: [
      {
        key: 'cover',
        type: 'cover',
        title: 'Cover Page',
        titlePl: 'Strona Tytułowa',
        required: true,
        order: 0,
        defaultLength: 'short',
        defaultLanguage: 'business',
      },
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive Summary',
        titlePl: 'Streszczenie Zarządcze',
        required: true,
        order: 1,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'methodology',
        type: 'methodology',
        title: 'Methodology',
        titlePl: 'Metodologia',
        required: false,
        order: 2,
        defaultLength: 'short',
        defaultLanguage: 'technical',
      },
      {
        key: 'assessment_matrix',
        type: 'matrix',
        title: 'Assessment Matrix',
        titlePl: 'Macierz Oceny',
        required: true,
        order: 3,
        renderKind: 'matrix',
      },
      {
        key: 'axis_analysis',
        type: 'axis_analysis',
        title: 'Axis Analysis',
        titlePl: 'Analiza Osi',
        required: true,
        order: 4,
        defaultLength: 'long',
        defaultLanguage: 'business',
        repeatFor: 'axes',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations',
        titlePl: 'Rekomendacje',
        required: true,
        order: 5,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'action_plan',
        type: 'action_plan',
        title: 'Action Plan',
        titlePl: 'Plan Działań',
        required: false,
        order: 6,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'appendix',
        type: 'appendix',
        title: 'Appendix',
        titlePl: 'Załączniki',
        required: false,
        order: 7,
        defaultLength: 'long',
        defaultLanguage: 'technical',
      },
    ],

    requiredIntentFields: ['audience', 'goal', 'language'],
    defaultIntent: {
      audience: 'executive',
      goal: 'diagnosis',
      tone: 'consulting',
      scope: 'full',
    },

    defaultStyling: {
      showCompanyLogo: true,
      showConsultifyBranding: true,
      primaryColor: '#3B82F6',
    },

    features: {
      allowCustomSections: true,
      allowReordering: true,
      allowMatrixVisualization: true,
      allowPdfExport: true,
      allowPublicSharing: true,
    },
  },

  /**
   * Assessment Summary Profile
   * For quick executive summaries
   */
  assessment_summary: {
    id: 'assessment_summary',
    name: 'Assessment Summary',
    namePl: 'Podsumowanie Oceny',
    description: 'Quick executive summary of assessment results',
    descriptionPl: 'Szybkie podsumowanie wyników oceny dla zarządu',

    sourceTypes: ['ASSESSMENT'],

    allowedBlockTypes: ['summary', 'matrix', 'recommendations'],
    disallowedBlockTypes: ['appendix', 'methodology'],

    defaultTemplateSections: [
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive Summary',
        titlePl: 'Streszczenie Zarządcze',
        required: true,
        order: 0,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'assessment_matrix',
        type: 'matrix',
        title: 'Assessment Matrix',
        titlePl: 'Macierz Oceny',
        required: true,
        order: 1,
        renderKind: 'matrix',
      },
      {
        key: 'key_recommendations',
        type: 'recommendations',
        title: 'Key Recommendations',
        titlePl: 'Kluczowe Rekomendacje',
        required: true,
        order: 2,
        defaultLength: 'short',
        defaultLanguage: 'business',
      },
    ],

    requiredIntentFields: ['audience', 'language'],
    defaultIntent: {
      audience: 'executive',
      goal: 'summary',
      tone: 'consulting',
      scope: 'focused',
    },

    defaultStyling: {
      showCompanyLogo: true,
      showConsultifyBranding: true,
      primaryColor: '#3B82F6',
    },

    features: {
      allowCustomSections: false,
      allowReordering: false,
      allowMatrixVisualization: true,
      allowPdfExport: true,
      allowPublicSharing: true,
    },
  },

  /**
   * Tool Consulting Summary Profile
   * For tool-based consulting reports
   */
  tool_consulting_summary: {
    id: 'tool_consulting_summary',
    name: 'Tool Consulting Report',
    namePl: 'Raport Narzędzia Konsultingowego',
    description: 'Report based on consulting tool analysis',
    descriptionPl: 'Raport na podstawie analizy narzędzia konsultingowego',

    sourceTypes: ['TOOL'],

    allowedBlockTypes: null,
    disallowedBlockTypes: ['matrix'], // Matrix is assessment-specific

    defaultTemplateSections: [
      {
        key: 'summary',
        type: 'summary',
        title: 'Summary',
        titlePl: 'Podsumowanie',
        required: true,
        order: 0,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'analysis',
        type: 'custom',
        title: 'Analysis',
        titlePl: 'Analiza',
        required: true,
        order: 1,
        defaultLength: 'long',
        defaultLanguage: 'business',
      },
      {
        key: 'findings',
        type: 'list',
        title: 'Key Findings',
        titlePl: 'Kluczowe Wnioski',
        required: true,
        order: 2,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations',
        titlePl: 'Rekomendacje',
        required: false,
        order: 3,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
    ],

    requiredIntentFields: ['audience', 'goal', 'language'],
    defaultIntent: {
      audience: 'executive',
      goal: 'recommendation',
      tone: 'consulting',
      scope: 'focused',
    },

    defaultStyling: {
      showCompanyLogo: true,
      showConsultifyBranding: true,
      primaryColor: '#10B981',
    },

    features: {
      allowCustomSections: true,
      allowReordering: true,
      allowMatrixVisualization: false,
      allowPdfExport: true,
      allowPublicSharing: true,
    },
  },

  /**
   * Results KPI Review Profile (R1)
   * For monthly/quarterly KPI review + deviation action plan
   */
  results_kpi_review: {
    id: 'results_kpi_review',
    name: 'KPI Performance Review',
    namePl: 'Przegląd KPI (Raport wyników)',
    description: 'Performance review report for KPIs and deviation action plans',
    descriptionPl: 'Raport przeglądu KPI wraz z odchyleniami i planem działań',

    sourceTypes: ['RESULTS_KPI_REPORT'],

    allowedBlockTypes: null,
    disallowedBlockTypes: ['matrix'], // Not needed here

    defaultTemplateSections: [
      {
        key: 'cover',
        type: 'cover',
        title: 'Cover Page',
        titlePl: 'Strona tytułowa',
        required: false,
        order: 0,
        defaultLength: 'short',
        defaultLanguage: 'business',
      },
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive Summary',
        titlePl: 'Streszczenie zarządcze',
        required: true,
        order: 1,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'kpi_overview',
        type: 'list',
        title: 'KPI Overview',
        titlePl: 'Przegląd KPI',
        required: true,
        order: 2,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'deviation_cases',
        type: 'list',
        title: 'Deviation Cases',
        titlePl: 'Sprawy odchyleń',
        required: false,
        order: 3,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'action_plan',
        type: 'action_plan',
        title: 'Action Plan',
        titlePl: 'Plan działań',
        required: true,
        order: 4,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'appendix',
        type: 'appendix',
        title: 'Appendix',
        titlePl: 'Załączniki',
        required: false,
        order: 5,
        defaultLength: 'long',
        defaultLanguage: 'technical',
      },
    ],

    requiredIntentFields: ['audience', 'goal', 'language'],
    defaultIntent: {
      audience: 'executive',
      goal: 'summary',
      tone: 'consulting',
      scope: 'focused',
    },

    defaultStyling: {
      showCompanyLogo: true,
      showConsultifyBranding: true,
      primaryColor: '#3B82F6',
    },

    features: {
      allowCustomSections: true,
      allowReordering: true,
      allowMatrixVisualization: false,
      allowPdfExport: true,
      allowPublicSharing: true,
    },
  },

  /**
   * Reports Composer Profile
   * For custom reports built in the Reports module
   */
  reports_composer: {
    id: 'reports_composer',
    name: 'Custom Report',
    namePl: 'Raport Niestandardowy',
    description: 'Fully customizable report with all features',
    descriptionPl: 'W pełni konfigurowalny raport ze wszystkimi funkcjami',

    sourceTypes: ['ASSESSMENT', 'TOOL', 'INITIATIVE', 'INTERVIEW', 'UPLOAD_BUNDLE'],

    allowedBlockTypes: null, // All allowed
    disallowedBlockTypes: [],

    defaultTemplateSections: [
      {
        key: 'summary',
        type: 'summary',
        title: 'Summary',
        titlePl: 'Podsumowanie',
        required: false,
        order: 0,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
    ],

    requiredIntentFields: ['language'],
    defaultIntent: {
      audience: 'executive',
      goal: 'summary',
      tone: 'consulting',
      scope: 'full',
    },

    defaultStyling: {
      showCompanyLogo: true,
      showConsultifyBranding: true,
      primaryColor: '#6366F1',
    },

    features: {
      allowCustomSections: true,
      allowReordering: true,
      allowMatrixVisualization: true,
      allowPdfExport: true,
      allowPublicSharing: true,
    },
  },

  /**
   * Default Profile
   * Fallback for unknown contexts
   */
  default: {
    id: 'default',
    name: 'Standard Report',
    namePl: 'Standardowy Raport',
    description: 'Standard report with basic sections',
    descriptionPl: 'Standardowy raport z podstawowymi sekcjami',

    sourceTypes: ['ASSESSMENT', 'TOOL', 'INITIATIVE', 'INTERVIEW', 'UPLOAD_BUNDLE'],

    allowedBlockTypes: null,
    disallowedBlockTypes: [],

    defaultTemplateSections: [
      {
        key: 'summary',
        type: 'summary',
        title: 'Summary',
        titlePl: 'Podsumowanie',
        required: true,
        order: 0,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'content',
        type: 'custom',
        title: 'Content',
        titlePl: 'Treść',
        required: true,
        order: 1,
        defaultLength: 'long',
        defaultLanguage: 'business',
      },
      {
        key: 'conclusions',
        type: 'recommendations',
        title: 'Conclusions',
        titlePl: 'Wnioski',
        required: false,
        order: 2,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
    ],

    requiredIntentFields: ['language'],
    defaultIntent: {
      audience: 'executive',
      goal: 'summary',
      tone: 'consulting',
      scope: 'full',
    },

    defaultStyling: {
      showCompanyLogo: true,
      showConsultifyBranding: true,
      primaryColor: '#3B82F6',
    },

    features: {
      allowCustomSections: true,
      allowReordering: true,
      allowMatrixVisualization: false,
      allowPdfExport: true,
      allowPublicSharing: true,
    },
  },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get profile by ID
 */
export function getInvocationProfile(profileId: string): InvocationProfile {
  return INVOCATION_PROFILES[profileId] || INVOCATION_PROFILES.default;
}

/**
 * Get profiles available for a source type
 */
export function getProfilesForSourceType(sourceType: string): InvocationProfile[] {
  return Object.values(INVOCATION_PROFILES).filter((profile) =>
    profile.sourceTypes.includes(sourceType)
  );
}

/**
 * Check if a block type is allowed in a profile
 */
export function isBlockTypeAllowed(profileId: string, blockTypeId: string): boolean {
  const profile = getInvocationProfile(profileId);

  // Check disallowed list first
  if (profile.disallowedBlockTypes.includes(blockTypeId)) {
    return false;
  }

  // If allowedBlockTypes is null, all are allowed
  if (profile.allowedBlockTypes === null) {
    return true;
  }

  // Check allowed list
  return profile.allowedBlockTypes.includes(blockTypeId);
}

/**
 * Validate intent against profile requirements
 */
export function validateIntent(
  profileId: string,
  intent: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const profile = getInvocationProfile(profileId);
  const missingFields: string[] = [];

  for (const field of profile.requiredIntentFields) {
    if (!intent[field]) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export default INVOCATION_PROFILES;
