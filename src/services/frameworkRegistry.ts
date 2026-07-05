/**
 * Framework Registry
 *
 * Centralny rejestr wszystkich frameworków oceny dojrzałości cyfrowej.
 * Każdy framework ma unikalne wymiary, skalę i konfigurację UI.
 */

export type FrameworkId = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

export interface FrameworkLevel {
  level: number;
  title: string;
  description: string;
  characteristics?: string[];
}

export interface FrameworkDimension {
  id: string;
  name: string;
  category?: string;
  description?: string;
  levels: FrameworkLevel[];
}

/**
 * Availability of a framework in the assessment picker.
 *  - 'available'   : fully wired; a session can be started.
 *  - 'coming_soon' : shown honestly as "wkrótce"/"coming soon"; the picker MUST
 *                    block starting a session (decision D-B: CMMI/LEAN are beta
 *                    placeholders in v1, not buildable). See isFrameworkAvailable.
 */
export type FrameworkStatus = 'available' | 'coming_soon';

export interface FrameworkConfig {
  id: FrameworkId;
  name: string;
  fullName: string;
  description: string;
  icon: string; // lucide icon name
  color: string;
  colorDark?: string;
  scaleMin: number;
  scaleMax: number;
  supportsImport: boolean;
  supportsManualEntry: boolean;
  /**
   * Picker availability. Defaults to 'available' when omitted. When
   * 'coming_soon' the framework is rendered as a disabled "wkrótce"/"coming soon"
   * card and MUST NOT start an assessment session.
   */
  status?: FrameworkStatus;
  legalNotice?: string;
  legalNoticeType?: 'educational' | 'proprietary' | 'open';
  dimensions: FrameworkDimension[];
  categories?: FrameworkCategory[];
}

export interface FrameworkCategory {
  id: string;
  name: string;
  description?: string;
  dimensionIds: string[];
}

// ============================================
// FRAMEWORK CONFIGURATIONS
// ============================================

export const FRAMEWORK_CONFIGS: Record<FrameworkId, FrameworkConfig> = {
  DRD: {
    id: 'DRD',
    name: 'DRD',
    fullName: 'Digital Readiness Diagnosis',
    description: '7-osiowa ocena dojrzałości cyfrowej oparta na metodologii Digital Pathfinder',
    icon: 'Activity',
    color: 'purple',
    colorDark: 'primary-400',
    scaleMin: 1,
    scaleMax: 7,
    supportsImport: false,
    supportsManualEntry: true,
    legalNoticeType: 'proprietary',
    dimensions: [], // Loaded from drdStructure.ts
  },

  SIRI: {
    id: 'SIRI',
    name: 'SIRI',
    fullName: 'Smart Industry Readiness Index',
    description: 'Industry 4.0 readiness assessment - 3 Building Blocks × 8 Dimensions',
    icon: 'Cpu',
    color: 'blue',
    colorDark: 'blue-400',
    scaleMin: 0,
    scaleMax: 5,
    supportsImport: true,
    supportsManualEntry: true,
    legalNotice:
      'SIRI (Smart Industry Readiness Index) jest narzędziem opracowanym przez Singapore Economic Development Board (EDB) we współpracy z TÜV SÜD. Wykorzystanie struktury SIRI w Consultify ma wyłącznie cel edukacyjny i służy do nauki metodologii Industry 4.0. Oficjalna certyfikacja SIRI wymaga akredytowanego audytora.',
    legalNoticeType: 'educational',
    dimensions: [], // Loaded from siriStructure.ts
    categories: [
      {
        id: 'PROCESS',
        name: 'Process',
        description: 'How operations are designed, managed and optimized',
        dimensionIds: [],
      },
      {
        id: 'TECHNOLOGY',
        name: 'Technology',
        description: 'How technology enables smart manufacturing',
        dimensionIds: [],
      },
      {
        id: 'ORGANIZATION',
        name: 'Organization',
        description: 'How people and structure support transformation',
        dimensionIds: [],
      },
    ],
  },

  ADMA: {
    id: 'ADMA',
    name: 'ADMA',
    fullName: 'Advanced Digital Maturity Assessment',
    description: 'European Digital Innovation Hubs framework - 5 Pillars × 12 Dimensions',
    icon: 'Database',
    color: 'green',
    colorDark: 'green-400',
    scaleMin: 1,
    scaleMax: 5,
    supportsImport: true,
    supportsManualEntry: true,
    legalNotice:
      'ADMA (Advanced Digital Maturity Assessment) jest narzędziem opracowanym przez European Commission w ramach programu Digital Innovation Hubs. Wykorzystanie w Consultify służy celom edukacyjnym.',
    legalNoticeType: 'educational',
    dimensions: [], // Loaded from admaStructure.ts
    categories: [
      { id: 'strategy', name: 'Strategy & Organization', dimensionIds: [] },
      { id: 'smart_products', name: 'Smart Products', dimensionIds: [] },
      { id: 'smart_operations', name: 'Smart Operations', dimensionIds: [] },
      { id: 'smart_supply', name: 'Smart Supply Chain', dimensionIds: [] },
      { id: 'data_driven', name: 'Data-Driven Services', dimensionIds: [] },
    ],
  },

  CMMI: {
    id: 'CMMI',
    name: 'CMMI',
    fullName: 'Capability Maturity Model Integration',
    description: 'Process improvement framework - 5 Maturity Levels × 20 Practice Areas',
    icon: 'Layers',
    color: 'orange',
    colorDark: 'amber-400',
    scaleMin: 1,
    scaleMax: 5,
    // Decision D-B: CMMI is a beta placeholder in v1 — shown honestly as "coming
    // soon" and NOT startable. Corroborated by getFrameworkIntegrationStatus,
    // which already flags CMMI knowledgeBase:false (never fully wired).
    status: 'coming_soon',
    supportsImport: true,
    supportsManualEntry: true,
    legalNotice:
      'CMMI jest znakiem towarowym ISACA (dawniej CMMI Institute). Oficjalna certyfikacja CMMI wymaga akredytowanego Lead Appraiser. Implementacja w Consultify służy celom edukacyjnym.',
    legalNoticeType: 'educational',
    dimensions: [], // Loaded from cmmiStructure.ts
    categories: [
      {
        id: 'DOING',
        name: 'Doing',
        description: 'Deliver value through development practices',
        dimensionIds: [],
      },
      {
        id: 'MANAGING',
        name: 'Managing',
        description: 'Manage work and resources effectively',
        dimensionIds: [],
      },
      {
        id: 'ENABLING',
        name: 'Enabling',
        description: 'Enable capability and infrastructure',
        dimensionIds: [],
      },
    ],
  },

  LEAN: {
    id: 'LEAN',
    name: 'Lean 4.0',
    fullName: 'DBR77 Lean 4.0 Assessment',
    description: 'Autorska metoda DBR77: Pomierz → Zoptymalizuj → Automatyzuj',
    icon: 'Workflow',
    color: 'cyan',
    colorDark: 'blue-400',
    scaleMin: 1,
    scaleMax: 5,
    // Decision D-B: DBR77 Lean 4.0 is a beta placeholder in v1 — shown honestly
    // as "coming soon" and NOT startable until the structure/report are wired.
    status: 'coming_soon',
    supportsImport: false,
    supportsManualEntry: true,
    legalNotice:
      'Metoda DBR77 Lean 4.0 (Pomierz-Zoptymalizuj-Automatyzuj) jest autorską metodą Consultify, łączącą klasyczne narzędzia Lean z oceną potencjału automatyzacji i AI.',
    legalNoticeType: 'proprietary',
    dimensions: [], // Loaded from dbr77LeanStructure.ts
    categories: [
      {
        id: 'MEASURE',
        name: 'Pomierz',
        description: 'Analiza stanu obecnego - procesy i stanowiska',
        dimensionIds: [],
      },
      {
        id: 'OPTIMIZE',
        name: 'Zoptymalizuj',
        description: 'Klasyczne metody Lean - eliminacja marnotrawstwa',
        dimensionIds: [],
      },
      {
        id: 'AUTOMATE',
        name: 'Automatyzuj',
        description: 'Audyt możliwości automatyzacji i AI',
        dimensionIds: [],
      },
    ],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get framework configuration by ID
 */
export function getFrameworkConfig(id: FrameworkId): FrameworkConfig {
  return FRAMEWORK_CONFIGS[id];
}

/**
 * Get all available frameworks
 */
export function getAllFrameworks(): FrameworkConfig[] {
  return Object.values(FRAMEWORK_CONFIGS);
}

/**
 * Whether a framework may currently start an assessment session. Frameworks
 * flagged `status: 'coming_soon'` (decision D-B: CMMI/LEAN beta placeholders)
 * return false — the picker MUST NOT start a session for them.
 *
 * This is the single source of truth for the picker gate: any surface that can
 * start a session should call this rather than re-listing framework ids, so the
 * picker can never lie about what is buildable.
 */
export function isFrameworkAvailable(id: FrameworkId): boolean {
  return (FRAMEWORK_CONFIGS[id]?.status ?? 'available') === 'available';
}

/** Inverse of isFrameworkAvailable — convenience for badge rendering. */
export function isFrameworkComingSoon(id: FrameworkId): boolean {
  return !isFrameworkAvailable(id);
}

/**
 * Get frameworks that support PDF import
 */
export function getImportableFrameworks(): FrameworkConfig[] {
  return Object.values(FRAMEWORK_CONFIGS).filter((f) => f.supportsImport);
}

/**
 * Check if framework requires legal notice display
 */
export function requiresLegalNotice(id: FrameworkId): boolean {
  const config = FRAMEWORK_CONFIGS[id];
  return config.legalNoticeType === 'educational';
}

/**
 * Get color classes for framework
 */
export function getFrameworkColorClasses(id: FrameworkId): {
  bg: string;
  bgLight: string;
  text: string;
  border: string;
} {
  const config = FRAMEWORK_CONFIGS[id];
  return {
    bg: `bg-${config.color}-500`,
    bgLight: `bg-${config.color}-100 dark:bg-${config.color}-900/30`,
    text: `text-${config.color}-600 dark:text-${config.color}-400`,
    border: `border-${config.color}-500`,
  };
}

/**
 * Normalize score from one scale to another
 */
export function normalizeScore(
  score: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number {
  if (fromMax === fromMin) return toMin;
  const normalized = ((score - fromMin) / (fromMax - fromMin)) * (toMax - toMin) + toMin;
  return Math.round(normalized * 10) / 10; // Round to 1 decimal
}

/**
 * Map framework score to DRD scale (1-7) for initiative generation
 */
export function mapToDRDScale(frameworkId: FrameworkId, score: number): number {
  const config = FRAMEWORK_CONFIGS[frameworkId];
  return normalizeScore(score, config.scaleMin, config.scaleMax, 1, 7);
}

/**
 * Get gap between current and target scores
 */
export function calculateGap(current: number, target: number): number {
  return Math.max(0, target - current);
}

/**
 * Calculate overall maturity from dimension scores
 */
export function calculateOverallMaturity(
  scores: Record<string, number>,
  weights?: Record<string, number>
): number {
  const entries = Object.entries(scores);
  if (entries.length === 0) return 0;

  if (weights) {
    let weightedSum = 0;
    let totalWeight = 0;
    entries.forEach(([key, score]) => {
      const weight = weights[key] || 1;
      weightedSum += score * weight;
      totalWeight += weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
  }

  const sum = entries.reduce((acc, [, score]) => acc + score, 0);
  return Math.round((sum / entries.length) * 10) / 10;
}

// ============================================
// INTEGRATION FORMAT (T031)
// ============================================

export interface FrameworkIntegrationChecklist {
  frameworkId: FrameworkId;
  registryConfig: boolean;
  structureDefinition: boolean;
  editorComponent: boolean;
  mapComponent: boolean;
  reportTemplate: boolean;
  initiativeMapping: boolean;
  i18nStrings: boolean;
  legalNotice: boolean;
  knowledgeBase: boolean;
  analyticsHooks: boolean;
  entitlementConfig: boolean;
  smokeTest: boolean;
}

export function validateFrameworkIntegration(checklist: Partial<FrameworkIntegrationChecklist>): {
  valid: boolean;
  missing: string[];
} {
  const REQUIRED: (keyof FrameworkIntegrationChecklist)[] = [
    'registryConfig',
    'structureDefinition',
    'editorComponent',
    'mapComponent',
    'reportTemplate',
    'initiativeMapping',
    'i18nStrings',
    'legalNotice',
    'knowledgeBase',
    'analyticsHooks',
    'entitlementConfig',
  ];
  const missing = REQUIRED.filter((f) => !checklist[f]);
  return { valid: missing.length === 0, missing };
}

export function getFrameworkIntegrationStatus(): Record<
  FrameworkId,
  FrameworkIntegrationChecklist
> {
  const full = (id: FrameworkId, kb = true): FrameworkIntegrationChecklist => ({
    frameworkId: id,
    registryConfig: true,
    structureDefinition: true,
    editorComponent: true,
    mapComponent: true,
    reportTemplate: true,
    initiativeMapping: true,
    i18nStrings: true,
    legalNotice: true,
    knowledgeBase: kb,
    analyticsHooks: true,
    entitlementConfig: true,
    smokeTest: false,
  });
  return {
    DRD: full('DRD'),
    SIRI: full('SIRI'),
    ADMA: full('ADMA'),
    CMMI: full('CMMI', false),
    LEAN: full('LEAN'),
  };
}

export default FRAMEWORK_CONFIGS;
