/**
 * Help Content Configuration
 *
 * Centralized configuration for Help Panel content.
 * Easy to update - just modify HELP_CONFIG values.
 *
 * When you need to update help content, change values here.
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
  videoUrl: string;
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
  // Introduction video URL (YouTube, Vimeo, etc.)
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // TODO: Replace with actual intro video

  // Base URL for documentation - internal route
  docsBaseUrl: '/docs',

  // Quick guides - links to KB articles
  guides: [
    {
      id: 'gettingStarted',
      path: '/getting-started',
      icon: 'Rocket',
      articleSlug: 'getting-started-consultinity',
    },
    {
      id: 'assessment',
      path: '/assessment-guide',
      icon: 'ClipboardCheck',
      articleSlug: 'assessment-guide',
    },
    { id: 'initiatives', path: '/initiatives', icon: 'Target', articleSlug: 'initiatives-guide' },
    { id: 'reports', path: '/reports', icon: 'FileText', articleSlug: 'reports-guide' },
    { id: 'aiFeatures', path: '/ai-features', icon: 'Bot', articleSlug: 'ai-features-guide' },
  ],

  // Knowledge Base categories (Coming Soon)
  knowledgeBaseCategories: [
    { id: 'tools', icon: 'Wrench', enabled: false },
    { id: 'methodologies', icon: 'BookOpen', enabled: false },
    { id: 'caseStudies', icon: 'FolderOpen', enabled: false },
    { id: 'bestPractices', icon: 'Sparkles', enabled: false },
  ],

  // Endpoint for "Notify Me" feature
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
 * Get video URL
 */
export function getVideoUrl(): string {
  return HELP_CONFIG.videoUrl;
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
