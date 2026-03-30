import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useHelpSidePanel } from '@/contexts/HelpContext';

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const v of values) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
}

/**
 * Deep-links into the runtime Help side panel using URL params.
 *
 * Supported params (all optional except `help_article`):
 * - `help_article`: knowledge-base article slug (canonical id for deep-linking)
 * - `help_module`: knowledge module id override (drives contextual recommendations)
 * - `help_tab`: force help tab (default: knowledge)
 */
export const HelpDeepLinkListener: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isOpen,
    setOpen,
    setActiveTab,
    setKnowledgeModuleIdOverride,
    setKnowledgeArticleSlugOverride,
  } = useHelpSidePanel();

  React.useLayoutEffect(() => {
    const params = new URLSearchParams(location.search || '');

    const article = firstNonEmpty(params.get('help_article'), params.get('helpArticle'));
    if (!article) return;

    const moduleId = firstNonEmpty(
      params.get('help_module'),
      params.get('helpModule'),
      params.get('help_surface'),
      params.get('helpSurface')
    );

    const tab = firstNonEmpty(params.get('help_tab'), params.get('helpTab')) || 'knowledge';

    if (moduleId) setKnowledgeModuleIdOverride(moduleId);
    setKnowledgeArticleSlugOverride(article);
    setActiveTab(tab as any);
    if (!isOpen) {
      setOpen(true);
      // Keep params until the panel is actually open (prevents race during initial hydration).
      return;
    }

    // Remove deep-link params so refreshing doesn't reopen the panel.
    ['help_article', 'helpArticle', 'help_module', 'helpModule', 'help_surface', 'helpSurface', 'help_tab', 'helpTab'].forEach(
      (k) => params.delete(k)
    );

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  }, [
    location.pathname,
    location.search,
    isOpen,
    navigate,
    setActiveTab,
    setKnowledgeArticleSlugOverride,
    setKnowledgeModuleIdOverride,
    setOpen,
  ]);

  return null;
};

export default HelpDeepLinkListener;

