import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

/**
 * Page metadata configuration
 * Maps routes to SEO-friendly titles and descriptions
 */
const PAGE_META: Record<string, { title: string; description: string }> = {
  [ROUTES.AI_CHAT]: {
    title: 'AI Chat | Consultinity',
    description: 'AI-powered strategic consulting chat',
  },
  [ROUTES.PROJECT_INTELLIGENCE]: {
    title: 'Project Intelligence | Consultinity',
    description: 'AI-driven project insights and knowledge management',
  },
  [ROUTES.AI_ACTIONS]: {
    title: 'AI Actions | Consultinity',
    description: 'AI-generated action proposals and recommendations',
  },
  [ROUTES.DASHBOARD]: {
    title: 'Dashboard | Consultinity',
    description: 'Your transformation dashboard - track progress, initiatives, and key metrics',
  },
  [ROUTES.STUDIO]: {
    title: 'AI Studio | Consultinity',
    description: 'AI-powered consulting studio for strategic transformation',
  },
  [ROUTES.MY_WORK]: {
    title: 'My Work | Consultinity',
    description: 'Manage your tasks, initiatives, and workspace',
  },
  [ROUTES.CONTEXT_BUILDER.ROOT]: {
    title: 'Context Builder | Consultinity',
    description: 'Build your organizational context and strategic profile',
  },
  [ROUTES.ASSESSMENT.ROOT]: {
    title: 'Assessment Hub | Consultinity',
    description: 'Comprehensive digital transformation assessments',
  },
  [ROUTES.INITIATIVES]: {
    title: 'Initiatives | Consultinity',
    description: 'Manage and track transformation initiatives',
  },
  [ROUTES.ROADMAP]: {
    title: 'Roadmap | Consultinity',
    description: 'Strategic transformation roadmap and timeline',
  },
  [ROUTES.PORTFOLIO]: {
    title: 'Portfolio | Consultinity',
    description: 'Initiative portfolio management and prioritization',
  },
  [ROUTES.ROI]: {
    title: 'ROI Analysis | Consultinity',
    description: 'Return on investment analysis and business case',
  },
  [ROUTES.ECONOMICS]: {
    title: 'Economics | Consultinity',
    description: 'Financial analysis and economic impact',
  },
  [ROUTES.EXECUTION]: {
    title: 'Execution | Consultinity',
    description: 'Initiative execution and delivery management',
  },
  [ROUTES.IMPLEMENTATION]: {
    title: 'Implementation | Consultinity',
    description: 'Implementation planning and tracking',
  },
  [ROUTES.ROLLOUT]: {
    title: 'Rollout | Consultinity',
    description: 'Change rollout and adoption management',
  },
  [ROUTES.REPORTS]: {
    title: 'Reports | Consultinity',
    description: 'Executive reports and analytics',
  },
  [ROUTES.KPI_OKR]: {
    title: 'KPIs & OKRs | Consultinity',
    description: 'Key performance indicators and objectives tracking',
  },
  [ROUTES.BENEFITS]: {
    title: 'Benefits Realization | Consultinity',
    description: 'Track and measure transformation benefits',
  },
  [ROUTES.SETTINGS.ROOT]: {
    title: 'Settings | Consultinity',
    description: 'Account and workspace settings',
  },
  [ROUTES.ADMIN.ROOT]: {
    title: 'Admin Panel | Consultinity',
    description: 'Administrative controls and configuration',
  },
  '/login': {
    title: 'Log In | Consultinity',
    description: 'Sign in to your Consultinity account',
  },
  '/register': {
    title: 'Sign Up | Consultinity',
    description: 'Create your Consultinity account',
  },
  '/': {
    title: 'Consultinity - AI Strategic Consultant',
    description: 'Professional digital transformation consulting platform powered by AI',
  },
};

/**
 * usePageMeta - SEO meta tags hook
 *
 * Automatically updates document title and meta tags based on current route.
 * Improves SEO and browser tab experience.
 */
export function usePageMeta() {
  const location = useLocation();

  useEffect(() => {
    // Get meta for current route
    const meta = PAGE_META[location.pathname] || {
      title: 'Consultinity',
      description: 'Professional digital transformation consulting platform',
    };

    // Update document title
    document.title = meta.title;

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', meta.description);

    // Update Open Graph tags for social sharing
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', meta.title);

    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', meta.description);

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', window.location.origin + location.pathname);
  }, [location.pathname]);
}
