export type AnnaSiteKey = 'consultify' | 'iot' | 'iris' | 'dt' | 'marketplace' | 'vector';

type AnnaProductSlug =
  | 'consultify'
  | 'vector'
  | 'dbr77'
  | 'iris'
  | 'digital-twin'
  | 'iiot'
  | 'marketplace';

export interface AnnaSiteConfig {
  key: AnnaSiteKey;
  brandName: string;
  landingPageLabel: string;
  primaryProductSlug: AnnaProductSlug;
  primaryProductName: string;
  defaultPreferredProducts: AnnaProductSlug[];
  landingTopics: string[];
  positioning: string;
  crossSellRule: string;
}

const ANNA_SITE_CONFIGS: Record<AnnaSiteKey, AnnaSiteConfig> = {
  consultify: {
    key: 'consultify',
    brandName: 'Consultify',
    landingPageLabel: 'public Consultify landing page',
    primaryProductSlug: 'consultify',
    primaryProductName: 'Consultify',
    defaultPreferredProducts: [
      'consultify',
      'vector',
      'dbr77',
      'iris',
      'digital-twin',
      'iiot',
      'marketplace',
    ],
    landingTopics: ['product value', 'demo', 'trial', 'ROI', 'adoption', 'DBR77 ecosystem fit'],
    positioning:
      'Consultify is the structured decision and transformation execution layer for organizations that need more rigor than ad hoc consulting and more continuity than one-off decks.',
    crossSellRule:
      'Promote other DBR77 products only when they help explain or extend the Consultify value path.',
  },
  iot: {
    key: 'iot',
    brandName: 'DBR77 IoT',
    landingPageLabel: 'public DBR77 IoT landing page',
    primaryProductSlug: 'iiot',
    primaryProductName: 'DBR77 IoT',
    defaultPreferredProducts: [
      'iiot',
      'consultify',
      'iris',
      'digital-twin',
      'vector',
      'marketplace',
      'dbr77',
    ],
    landingTopics: [
      'machine visibility',
      'downtime',
      'pilot rollout',
      'edge logic',
      'ROI',
      'scale-up',
    ],
    positioning:
      'DBR77 IoT is the machine and signal visibility layer that helps factories turn raw operational data into usable actions on the shop floor.',
    crossSellRule:
      'Cross-sell IRIS, Digital Twin, Vector, Marketplace, and Consultify when they naturally extend the IoT value path from visibility into decisions, rollout, or investment logic.',
  },
  iris: {
    key: 'iris',
    brandName: 'DBR77 IRIS',
    landingPageLabel: 'public DBR77 IRIS landing page',
    primaryProductSlug: 'iris',
    primaryProductName: 'DBR77 IRIS',
    defaultPreferredProducts: [
      'iris',
      'consultify',
      'iiot',
      'digital-twin',
      'vector',
      'marketplace',
      'dbr77',
    ],
    landingTopics: [
      'plant operating system',
      'AI-assisted operations',
      'execution closure',
      'governance',
      'ROI',
    ],
    positioning:
      'DBR77 IRIS is the plant operating system layer that connects operational visibility, AI-assisted recommendations, ownership, and execution closure.',
    crossSellRule:
      'Cross-sell IoT, Digital Twin, Vector, Marketplace, and Consultify when they help explain how IRIS connects signals, decisions, and broader transformation programs.',
  },
  dt: {
    key: 'dt',
    brandName: 'DBR77 Digital Twin',
    landingPageLabel: 'public DBR77 Digital Twin landing page',
    primaryProductSlug: 'digital-twin',
    primaryProductName: 'DBR77 Digital Twin',
    defaultPreferredProducts: [
      'digital-twin',
      'consultify',
      'iiot',
      'iris',
      'vector',
      'marketplace',
      'dbr77',
    ],
    landingTopics: [
      'layout decisions',
      'scenario planning',
      'flow simulation',
      'CAPEX',
      'governance',
    ],
    positioning:
      'DBR77 Digital Twin is the simulation and scenario layer that helps factories test layout, flow, automation, and CAPEX decisions before live change is committed.',
    crossSellRule:
      'Cross-sell IoT, IRIS, Vector, Marketplace, and Consultify when they help explain how simulation connects with live data, execution, or investment decisions.',
  },
  marketplace: {
    key: 'marketplace',
    brandName: 'DBR77 Marketplace',
    landingPageLabel: 'public DBR77 Marketplace landing page',
    primaryProductSlug: 'marketplace',
    primaryProductName: 'DBR77 Marketplace',
    defaultPreferredProducts: [
      'marketplace',
      'consultify',
      'vector',
      'iiot',
      'digital-twin',
      'iris',
      'dbr77',
    ],
    landingTopics: [
      'supplier matching',
      'automation sourcing',
      'offers',
      'CAPEX defense',
      'rollout governance',
    ],
    positioning:
      'DBR77 Marketplace is the sourcing and buying coordination layer for industrial automation, integration, and technology selection.',
    crossSellRule:
      'Cross-sell Consultify, Vector, IoT, Digital Twin, and IRIS when they help the buyer understand requirements, decision criteria, or downstream rollout execution.',
  },
  vector: {
    key: 'vector',
    brandName: 'DBR77 Vector',
    landingPageLabel: 'public DBR77 Vector landing page',
    primaryProductSlug: 'vector',
    primaryProductName: 'DBR77 Vector',
    defaultPreferredProducts: [
      'vector',
      'consultify',
      'iris',
      'digital-twin',
      'iiot',
      'marketplace',
      'dbr77',
    ],
    landingTopics: [
      'industrial AI',
      'reasoning layer',
      'governance',
      'deployment control',
      'decision quality',
    ],
    positioning:
      'DBR77 Vector is the industrial reasoning and AI layer that supports decision quality, controlled deployment, and explainable product intelligence across the DBR77 ecosystem.',
    crossSellRule:
      'Cross-sell Consultify, IRIS, Digital Twin, IoT, and Marketplace when they help explain where Vector creates visible operational or business value.',
  },
};

export function isAnnaSiteKey(value: string | null | undefined): value is AnnaSiteKey {
  return typeof value === 'string' && value in ANNA_SITE_CONFIGS;
}

export function resolveAnnaSiteConfig(siteKey?: string | null): AnnaSiteConfig {
  if (isAnnaSiteKey(siteKey)) {
    return ANNA_SITE_CONFIGS[siteKey];
  }
  return ANNA_SITE_CONFIGS.consultify;
}

export function resolveAnnaPreferredProducts(siteKey?: string | null): AnnaProductSlug[] {
  return resolveAnnaSiteConfig(siteKey).defaultPreferredProducts;
}

export function resolveAnnaPrimaryProductName(siteKey?: string | null): string {
  return resolveAnnaSiteConfig(siteKey).primaryProductName;
}
