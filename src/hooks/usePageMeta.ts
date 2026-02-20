import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BRAND = 'Consultinity';

interface PageMeta {
  title: string;
  description: string;
}

const ROUTE_META: Record<string, PageMeta> = {
  '/': {
    title: `${BRAND} — Transformation AI Consulting Platform`,
    description:
      'Consultinity combines human governance with AI acceleration to transform enterprise strategy, PMO, and decision-making.',
  },
  '/docs': {
    title: `Documentation — ${BRAND}`,
    description:
      'Guides, tutorials, and best practices for the Consultinity Transformation AI Platform.',
  },
  '/docs/security': {
    title: `Security & Compliance — ${BRAND}`,
    description:
      'Enterprise-grade security architecture, certifications, and data protection policies.',
  },
  '/docs/api': {
    title: `API Reference — ${BRAND}`,
    description:
      'RESTful API documentation for integrations, webhooks, and programmatic platform access.',
  },
  '/docs/changelog': {
    title: `Changelog — ${BRAND}`,
    description: 'Release notes, feature updates, and platform improvements.',
  },
  '/pricing': {
    title: `Pricing — ${BRAND}`,
    description:
      'Growth, Scale, and Enterprise plans for teams of every size. AI credits, BYOK, and managed AI options.',
  },
  '/become-partner': {
    title: `Partner Program — ${BRAND}`,
    description:
      'Join the Consultinity partner ecosystem. Earn recurring revenue, access premium tools, and grow your practice.',
  },
  '/legal': {
    title: `Legal Center — ${BRAND}`,
    description:
      'Terms of service, privacy policy, data processing agreements, and regulatory compliance.',
  },
  '/changelog': {
    title: `Changelog — ${BRAND}`,
    description: 'Track all updates and improvements to Consultinity.',
  },
  '/login': {
    title: `Sign In — ${BRAND}`,
    description: 'Sign in to your Consultinity workspace.',
  },
  '/demo': {
    title: `Demo — ${BRAND}`,
    description: 'Experience Consultinity with realistic demo data. No signup required.',
  },
};

function getMetaForPath(path: string): PageMeta {
  if (ROUTE_META[path]) return ROUTE_META[path];

  if (path.startsWith('/docs/')) {
    return {
      title: `Documentation — ${BRAND}`,
      description: 'Consultinity platform documentation.',
    };
  }
  if (path.startsWith('/legal/')) {
    return {
      title: `Legal — ${BRAND}`,
      description: 'Consultinity legal documents and policies.',
    };
  }

  return { title: BRAND, description: '' };
}

function setMetaTag(name: string, content: string, property = false) {
  const attr = property ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

export const usePageMeta = () => {
  const location = useLocation();

  useEffect(() => {
    const meta = getMetaForPath(location.pathname);
    document.title = meta.title;
    setMetaTag('description', meta.description);
    setMetaTag('og:title', meta.title, true);
    setMetaTag('og:description', meta.description, true);
  }, [location.pathname]);
};
