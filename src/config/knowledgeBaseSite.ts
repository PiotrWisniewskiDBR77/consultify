export type KnowledgeBaseSiteKey = 'consultify' | 'iot' | 'iris' | 'dt' | 'marketplace' | 'vector';

interface KnowledgeBaseSiteConfig {
  key: KnowledgeBaseSiteKey;
  categoryPrefix: string;
  brandName: string;
  brandUrl: string;
  publisherName: string;
  heroBadge: string;
  heroSubtitle: string;
  sectionsEyebrow: string;
  sectionsTitle: string;
  sectionsSubtitle: string;
}

const SITE_CONFIGS: Record<KnowledgeBaseSiteKey, KnowledgeBaseSiteConfig> = {
  consultify: {
    key: 'consultify',
    categoryPrefix: 'consultify-',
    brandName: 'Consultify',
    brandUrl: 'https://consultify.ai',
    publisherName: 'Consultify',
    heroBadge: '50 expert articles in EN, PL, and DE',
    heroSubtitle:
      'Read decision-grade guides before you commit budget, launch rollout, or defend ROI.',
    sectionsEyebrow: 'Choose the category you need now',
    sectionsTitle: 'Start with the decision tension that matters',
    sectionsSubtitle:
      'Each category is designed as an entry lane into the knowledge base, not as generic taxonomy.',
  },
  iot: {
    key: 'iot',
    categoryPrefix: 'iot-',
    brandName: 'DBR77 IoT',
    brandUrl: 'https://dbr77.com/iot',
    publisherName: 'DBR77 IoT',
    heroBadge: '50 industrial IoT articles in EN, PL, and DE',
    heroSubtitle:
      'Use the library to make machine visibility, rollout, and signal-driven decisions easier to defend.',
    sectionsEyebrow: 'Choose your operational tension',
    sectionsTitle: 'Three ways into the IoT library',
    sectionsSubtitle:
      'Enter through downtime, rollout, or decision logic depending on what the plant needs next.',
  },
  iris: {
    key: 'iris',
    categoryPrefix: 'iris-',
    brandName: 'DBR77 IRIS',
    brandUrl: 'https://dbr77.com/iris',
    publisherName: 'DBR77 IRIS',
    heroBadge: '50 plant operating system articles in EN, PL, and DE',
    heroSubtitle:
      'Use the library to clarify how execution, AI assistance, and governance work together in daily operations.',
    sectionsEyebrow: 'Choose the operating question',
    sectionsTitle: 'Three ways into the IRIS library',
    sectionsSubtitle:
      'Start from AI decisions, rollout, or governance depending on where execution is breaking down.',
  },
  dt: {
    key: 'dt',
    categoryPrefix: 'dt-',
    brandName: 'DBR77 Digital Twin',
    brandUrl: 'https://dbr77.com/digital-twin',
    publisherName: 'DBR77 Digital Twin',
    heroBadge: '50 digital twin articles in EN, PL, and DE',
    heroSubtitle:
      'Use the library to compare layout, flow, CAPEX, and governance decisions before live change is committed.',
    sectionsEyebrow: 'Choose the scenario question',
    sectionsTitle: 'Three ways into the Digital Twin library',
    sectionsSubtitle:
      'Start from flow, CAPEX, or governance depending on what decision must become more defensible.',
  },
  marketplace: {
    key: 'marketplace',
    categoryPrefix: 'marketplace-',
    brandName: 'DBR77 Marketplace',
    brandUrl: 'https://dbr77.com/marketplace',
    publisherName: 'DBR77 Marketplace',
    heroBadge: '50 automation buying articles in EN, PL, and DE',
    heroSubtitle:
      'Use the library to compare suppliers, defend CAPEX, and keep execution clean after award.',
    sectionsEyebrow: 'Choose the sourcing problem',
    sectionsTitle: 'Three ways into the Marketplace library',
    sectionsSubtitle:
      'Start from sourcing, investment, or rollout depending on where the buying decision is at risk.',
  },
  vector: {
    key: 'vector',
    categoryPrefix: 'vector-',
    brandName: 'DBR77 Vector',
    brandUrl: 'https://dbr77.com/vector',
    publisherName: 'DBR77 Vector',
    heroBadge: '50 industrial AI governance articles in EN, PL, and DE',
    heroSubtitle:
      'Use the library to evaluate AI decision quality, deployment control, and governance before scale.',
    sectionsEyebrow: 'Choose the AI control question',
    sectionsTitle: 'Three ways into the Vector library',
    sectionsSubtitle:
      'Start from decision quality, governance, or rollout depending on the AI risk you need to resolve.',
  },
};

const envSite = (
  import.meta.env.VITE_KB_SITE_KEY || 'consultify'
).toLowerCase() as KnowledgeBaseSiteKey;

export const KNOWLEDGE_BASE_SITE = SITE_CONFIGS[envSite] || SITE_CONFIGS.consultify;

export function isKbCategoryForCurrentSite(slug: string | null | undefined): boolean {
  return !!slug && slug.startsWith(KNOWLEDGE_BASE_SITE.categoryPrefix);
}
