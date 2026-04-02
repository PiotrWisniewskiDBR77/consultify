/**
 * Help shell configuration.
 *
 * Canonical short-form help content now lives in `helpExperience.ts`.
 * This file stays intentionally small and only keeps shell-level routes
 * plus legacy helpers for still-unmigrated components.
 */

export interface HelpGuide {
  id: string;
  path: string;
  icon: string;
  articleSlug?: string; // KB article slug for in-app navigation
}

export interface KnowledgeBaseCategory {
  id: string;
  icon: string;
  enabled: boolean;
}

export interface HelpConfig {
  docsBaseUrl: string;
  guides: HelpGuide[];
  knowledgeBaseCategories: KnowledgeBaseCategory[];
  notifyEndpoint: string;
}

/**
 * Main Help Configuration
 * Update these values to change help content across the app
 */
export const HELP_CONFIG: HelpConfig = {
  docsBaseUrl: '/knowledge-base',
  guides: [],
  knowledgeBaseCategories: [],
  notifyEndpoint: '/api/help/knowledge-base/notify',
};

/**
 * Get the current help configuration
 */
export function getHelpConfig(): HelpConfig {
  return HELP_CONFIG;
}

/**
 * Get full URL for a guide
 */
export function getGuideUrl(guideId: string): string {
  const guide = HELP_CONFIG.guides.find((g) => g.id === guideId);
  if (!guide) return HELP_CONFIG.docsBaseUrl;
  return `${HELP_CONFIG.docsBaseUrl}${guide.path}`;
}

/**
 * Get all guides
 */
export function getGuides(): HelpGuide[] {
  return HELP_CONFIG.guides;
}

/**
 * Get knowledge base categories
 */
export function getKnowledgeBaseCategories(): KnowledgeBaseCategory[] {
  return HELP_CONFIG.knowledgeBaseCategories;
}

/**
 * Check if knowledge base has any enabled categories
 */
export function isKnowledgeBaseReady(): boolean {
  return HELP_CONFIG.knowledgeBaseCategories.some((cat) => cat.enabled);
}

/**
 * Help Item interface for contextual help
 */
export interface HelpItem {
  title: string;
  content: string;
  type?: 'article' | 'video' | 'guide';
  onClick?: () => void;
}

/**
 * View to help mapping for contextual help
 */
const VIEW_HELP_MAP: Record<string, HelpItem[]> = {
  '/dashboard': [
    {
      title: 'help.dashboard.overview',
      content: 'help.dashboard.overviewContent',
      type: 'article',
    },
    {
      title: 'help.dashboard.navigation',
      content: 'help.dashboard.navigationContent',
      type: 'guide',
    },
  ],
  '/initiatives': [
    { title: 'help.initiatives.create', content: 'help.initiatives.createContent', type: 'guide' },
    {
      title: 'help.initiatives.manage',
      content: 'help.initiatives.manageContent',
      type: 'article',
    },
  ],
  '/assessment': [
    { title: 'help.assessment.start', content: 'help.assessment.startContent', type: 'guide' },
    {
      title: 'help.assessment.methodology',
      content: 'help.assessment.methodologyContent',
      type: 'article',
    },
  ],
  default: [
    {
      title: 'help.general.gettingStarted',
      content: 'help.general.gettingStartedContent',
      type: 'guide',
    },
    { title: 'help.general.support', content: 'help.general.supportContent', type: 'article' },
  ],
};

/**
 * Get contextual help items for a specific view/path
 */
export function getHelpForView(path: string): HelpItem[] {
  // Find matching help items for the path
  const normalizedPath = path.split('?')[0]; // Remove query params

  // Try exact match first
  if (VIEW_HELP_MAP[normalizedPath]) {
    return VIEW_HELP_MAP[normalizedPath];
  }

  // Try prefix match for nested routes
  for (const [key, items] of Object.entries(VIEW_HELP_MAP)) {
    if (key !== 'default' && normalizedPath.startsWith(key)) {
      return items;
    }
  }

  // Return default help items
  return VIEW_HELP_MAP.default;
}
