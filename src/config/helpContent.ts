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

  // Base URL for documentation
  docsBaseUrl: 'https://docs.consultinity.app',

  // Quick guides - links to documentation pages
  guides: [
    { id: 'gettingStarted', path: '/getting-started', icon: 'Rocket' },
    { id: 'assessment', path: '/assessment-guide', icon: 'ClipboardCheck' },
    { id: 'initiatives', path: '/initiatives', icon: 'Target' },
    { id: 'reports', path: '/reports', icon: 'FileText' },
    { id: 'aiFeatures', path: '/ai-features', icon: 'Bot' },
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
