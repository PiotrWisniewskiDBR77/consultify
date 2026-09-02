import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const BRAND = 'Consultify';

interface PageMeta {
  title: string;
  description: string;
}

// Pre-login screen family (grafika/logowanie-i18n-20260902): the document
// title/description for these routes come from i18next (`meta.<key>.*`)
// instead of the static English-only ROUTE_META table below, so a Polish
// session sees a Polish browser-tab title on the very first screen instead
// of "Sign In — Consultify". Scoped deliberately to this family only — the
// rest of ROUTE_META (docs, pricing, my-work, ...) is untouched and stays a
// separate, larger effort.
const PRE_LOGIN_META_KEYS: Record<string, string> = {
  '/login': 'login',
  '/register': 'register',
  '/demo': 'demo',
  '/trial/start': 'trialStart',
  '/forgot-password': 'forgotPassword',
  '/reset-password': 'resetPassword',
};

const ROUTE_META: Record<string, PageMeta> = {
  '/': {
    title: `${BRAND} — Transformation AI Consulting Platform`,
    description:
      'Consultify combines human governance with AI acceleration to transform enterprise strategy, PMO, and decision-making.',
  },
  '/docs': {
    title: `Documentation — ${BRAND}`,
    description:
      'Guides, tutorials, and best practices for the Consultify Transformation AI Platform.',
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
      'Join the Consultify partner ecosystem. Earn recurring revenue, access premium tools, and grow your practice.',
  },
  '/legal': {
    title: `Legal Center — ${BRAND}`,
    description:
      'Terms of service, privacy policy, data processing agreements, and regulatory compliance.',
  },
  '/changelog': {
    title: `Changelog — ${BRAND}`,
    description: 'Track all updates and improvements to Consultify.',
  },
  '/chat': {
    title: `AI Chat — ${BRAND}`,
    description: 'Teresa AI workspace for guided execution and decisions.',
  },
  '/my-work': {
    title: `My Work — ${BRAND}`,
    description: 'Your active tasks, inbox, and execution workspace.',
  },
  '/interview': {
    title: `Interview — ${BRAND}`,
    description: 'Interview workflows, assignments, and insights.',
  },
  '/discovery-tools': {
    title: `Discovery Tools — ${BRAND}`,
    description: 'Methods, templates, and discovery accelerators.',
  },
  '/settings': {
    title: `Settings — ${BRAND}`,
    description: 'Manage profile, security, integrations, and preferences.',
  },
};

function getMetaForPath(path: string, t: (key: string, defaultValue?: string) => string): PageMeta {
  const preLoginKey = PRE_LOGIN_META_KEYS[path];
  if (preLoginKey) {
    return {
      title: `${t(`meta.${preLoginKey}.title`)} — ${BRAND}`,
      description: t(`meta.${preLoginKey}.description`),
    };
  }

  if (ROUTE_META[path]) return ROUTE_META[path];

  if (path.startsWith('/docs/')) {
    return {
      title: `Documentation — ${BRAND}`,
      description: 'Consultify platform documentation.',
    };
  }
  if (path.startsWith('/legal/')) {
    return {
      title: `Legal — ${BRAND}`,
      description: 'Consultify legal documents and policies.',
    };
  }
  if (path.startsWith('/knowledge-base')) {
    return {
      title: `Knowledge Base — ${BRAND}`,
      description:
        'Expert guides on transformation management, AI consulting, governance, and execution for enterprise leaders.',
    };
  }
  if (path.startsWith('/chat/')) {
    return {
      title: `AI Chat — ${BRAND}`,
      description: 'Teresa AI workspace for guided execution and decisions.',
    };
  }
  if (path.startsWith('/my-work/')) {
    return {
      title: `My Work — ${BRAND}`,
      description: 'Your active tasks, inbox, and execution workspace.',
    };
  }
  if (path.startsWith('/interview/')) {
    return {
      title: `Interview — ${BRAND}`,
      description: 'Interview workflows, assignments, and insights.',
    };
  }
  if (path.startsWith('/discovery-tools/')) {
    return {
      title: `Discovery Tools — ${BRAND}`,
      description: 'Methods, templates, and discovery accelerators.',
    };
  }
  if (path.startsWith('/settings/')) {
    return {
      title: `Settings — ${BRAND}`,
      description: 'Manage profile, security, integrations, and preferences.',
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
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const meta = getMetaForPath(location.pathname, t);
    document.title = meta.title;
    setMetaTag('description', meta.description);
    setMetaTag('og:title', meta.title, true);
    setMetaTag('og:description', meta.description, true);
    // i18n.language dependency: the pre-login family's title/description are
    // now translated, so a language switch must retitle the tab without
    // needing a navigation.
  }, [location.pathname, t, i18n.language]);
};
