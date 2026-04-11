export const PARTNER_DOCS = {
  overview: {
    categorySlug: 'consultify-partner-program',
    articleSlug: 'partner-program-overview',
    href: '/docs/consultify-partner-program/partner-program-overview',
  },
  application: {
    categorySlug: 'consultify-partner-program',
    articleSlug: 'partner-application-flow',
    href: '/docs/consultify-partner-program/partner-application-flow',
  },
  payouts: {
    categorySlug: 'consultify-partner-operations',
    articleSlug: 'partner-payout-and-activation',
    href: '/docs/consultify-partner-operations/partner-payout-and-activation',
  },
  certification: {
    categorySlug: 'consultify-partner-operations',
    articleSlug: 'partner-certification-explainer',
    href: '/docs/consultify-partner-operations/partner-certification-explainer',
  },
  faq: {
    categorySlug: 'consultify-partner-operations',
    articleSlug: 'partner-faq',
    href: '/docs/consultify-partner-operations/partner-faq',
  },
  caseStudyOperations: {
    categorySlug: 'consultify-partner-case-studies',
    articleSlug: 'partner-case-study-operations-rollout',
    href: '/docs/consultify-partner-case-studies/partner-case-study-operations-rollout',
  },
  caseStudyFinance: {
    categorySlug: 'consultify-partner-case-studies',
    articleSlug: 'partner-case-study-cfo-governance',
    href: '/docs/consultify-partner-case-studies/partner-case-study-cfo-governance',
  },
} as const;

export const PARTNER_DOC_LIST = [
  PARTNER_DOCS.overview,
  PARTNER_DOCS.application,
  PARTNER_DOCS.payouts,
  PARTNER_DOCS.certification,
  PARTNER_DOCS.faq,
  PARTNER_DOCS.caseStudyOperations,
  PARTNER_DOCS.caseStudyFinance,
] as const;

export const PARTNER_CERTIFICATION_DOC_BY_TYPE: Record<string, string> = {
  sales_foundation: PARTNER_DOCS.certification.href,
  sales_practitioner: PARTNER_DOCS.caseStudyOperations.href,
  sales_advanced: PARTNER_DOCS.caseStudyFinance.href,
  delivery_foundation: PARTNER_DOCS.payouts.href,
  delivery_practitioner: PARTNER_DOCS.caseStudyOperations.href,
  delivery_advanced: PARTNER_DOCS.caseStudyFinance.href,
  strategic_foundation: PARTNER_DOCS.overview.href,
  strategic_practitioner: PARTNER_DOCS.application.href,
  strategic_advanced: PARTNER_DOCS.caseStudyFinance.href,
};

export const PARTNER_DOC_HREF_BY_SLUG: Record<string, string> = {
  'partner-program-overview': PARTNER_DOCS.overview.href,
  'partner-application-flow': PARTNER_DOCS.application.href,
  'partner-payout-and-activation': PARTNER_DOCS.payouts.href,
  'partner-certification-explainer': PARTNER_DOCS.certification.href,
  'partner-faq': PARTNER_DOCS.faq.href,
  'partner-case-study-operations-rollout': PARTNER_DOCS.caseStudyOperations.href,
  'partner-case-study-cfo-governance': PARTNER_DOCS.caseStudyFinance.href,
};

export const PARTNER_KNOWLEDGE_CATEGORY_SLUGS = [
  'consultify-partner-program',
  'consultify-partner-operations',
  'consultify-partner-case-studies',
] as const;
