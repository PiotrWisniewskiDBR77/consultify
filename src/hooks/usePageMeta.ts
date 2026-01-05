import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/routes/routeConfig';

/**
 * Page metadata configuration
 * Maps routes to SEO-friendly titles and descriptions
 */
const PAGE_META: Record<string, { title: string; description: string }> = {
    [ROUTES.DASHBOARD]: {
        title: 'Dashboard | Consultify',
        description: 'Your transformation dashboard - track progress, initiatives, and key metrics',
    },
    [ROUTES.STUDIO]: {
        title: 'AI Studio | Consultify',
        description: 'AI-powered consulting studio for strategic transformation',
    },
    [ROUTES.MY_WORK]: {
        title: 'My Work | Consultify',
        description: 'Manage your tasks, initiatives, and workspace',
    },
    [ROUTES.CONTEXT_BUILDER.ROOT]: {
        title: 'Context Builder | Consultify',
        description: 'Build your organizational context and strategic profile',
    },
    [ROUTES.ASSESSMENT.ROOT]: {
        title: 'Assessment Hub | Consultify',
        description: 'Comprehensive digital transformation assessments',
    },
    [ROUTES.INITIATIVES]: {
        title: 'Initiatives | Consultify',
        description: 'Manage and track transformation initiatives',
    },
    [ROUTES.ROADMAP]: {
        title: 'Roadmap | Consultify',
        description: 'Strategic transformation roadmap and timeline',
    },
    [ROUTES.PORTFOLIO]: {
        title: 'Portfolio | Consultify',
        description: 'Initiative portfolio management and prioritization',
    },
    [ROUTES.ROI]: {
        title: 'ROI Analysis | Consultify',
        description: 'Return on investment analysis and business case',
    },
    [ROUTES.ECONOMICS]: {
        title: 'Economics | Consultify',
        description: 'Financial analysis and economic impact',
    },
    [ROUTES.EXECUTION]: {
        title: 'Execution | Consultify',
        description: 'Initiative execution and delivery management',
    },
    [ROUTES.IMPLEMENTATION]: {
        title: 'Implementation | Consultify',
        description: 'Implementation planning and tracking',
    },
    [ROUTES.ROLLOUT]: {
        title: 'Rollout | Consultify',
        description: 'Change rollout and adoption management',
    },
    [ROUTES.REPORTS]: {
        title: 'Reports | Consultify',
        description: 'Executive reports and analytics',
    },
    [ROUTES.KPI_OKR]: {
        title: 'KPIs & OKRs | Consultify',
        description: 'Key performance indicators and objectives tracking',
    },
    [ROUTES.BENEFITS]: {
        title: 'Benefits Realization | Consultify',
        description: 'Track and measure transformation benefits',
    },
    [ROUTES.SETTINGS.ROOT]: {
        title: 'Settings | Consultify',
        description: 'Account and workspace settings',
    },
    [ROUTES.ADMIN.ROOT]: {
        title: 'Admin Panel | Consultify',
        description: 'Administrative controls and configuration',
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
            title: 'Consultify',
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
