/**
 * imageRouter (F9.1 + F9.3) — router obrazów: typ treści × pakiet × tier + fallback.
 *
 * Dobiera właściwy model do typu treści, z łańcuchem fallback i rozliczeniem
 * kredytów. NIE generuje obrazów — to warstwa DECYZJI (który provider, jaki tier,
 * ile kredytów, co gdy padnie). Realna generacja = osobny adapter (per provider).
 *
 * Tiery (DELIVERABLE_STANDARDS): T0 stock (Unsplash/Pexels) · T1 budget gen
 * (FLUX Schnell/Qwen) · T2 premium (FLUX.2/Imagen4/GPT-Image/nano-banana) ·
 * T3 wyspecjalizowane (Ideogram=tekst-na-obrazie, Recraft=wektor/brand).
 *
 * Pakiety: Lite = T0-T1 (w cenie) · Pro = T0-T3 (kredyty). Request o tier ponad
 * pakiet → DOWNGRADE do najwyższego dozwolonego (z flagą `downgraded`).
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają.
 */

export type ImageTier = 'T0' | 'T1' | 'T2' | 'T3';
export type ImagePackage = 'lite' | 'pro';

export type ImageContentType =
  | 'photo'
  | 'illustration'
  | 'icon'
  | 'text_in_image'
  | 'vector_logo'
  | 'background'
  | 'data_viz';

/** Koszt kredytowy per tier (T0 darmowy stock). */
export const TIER_CREDIT_COST: Record<ImageTier, number> = {
  T0: 0,
  T1: 1,
  T2: 5,
  T3: 8,
};

/** Najwyższy tier dozwolony w pakiecie. */
const PACKAGE_MAX_TIER: Record<ImagePackage, ImageTier> = {
  lite: 'T1',
  pro: 'T3',
};

const TIER_ORDER: ImageTier[] = ['T0', 'T1', 'T2', 'T3'];

// Domyślny provider per (tier).
const TIER_PROVIDER: Record<ImageTier, string> = {
  T0: 'unsplash',
  T1: 'flux-schnell',
  T2: 'flux2-pro',
  T3: 'recraft',
};

// Preferowany tier per typ treści (zanim nałożymy limit pakietu).
const CONTENT_PREFERRED_TIER: Record<ImageContentType, ImageTier> = {
  photo: 'T0', // stock-first dla zdjęć
  illustration: 'T1',
  icon: 'T0',
  text_in_image: 'T3', // Ideogram — tekst na obrazie
  vector_logo: 'T3', // Recraft — wektor/brand
  background: 'T1',
  data_viz: 'T0', // nie image-gen → chart engine (F11)
};

// Provider wyspecjalizowany dla T3 wg typu (nadpisuje domyślny TIER_PROVIDER.T3).
const T3_PROVIDER_BY_CONTENT: Partial<Record<ImageContentType, string>> = {
  text_in_image: 'ideogram',
  vector_logo: 'recraft',
};

function tierIndex(t: ImageTier): number {
  return TIER_ORDER.indexOf(t);
}

function clampTierToPackage(tier: ImageTier, pkg: ImagePackage): ImageTier {
  const max = PACKAGE_MAX_TIER[pkg];
  return tierIndex(tier) > tierIndex(max) ? max : tier;
}

function providerFor(tier: ImageTier, contentType: ImageContentType): string {
  if (tier === 'T3') return T3_PROVIDER_BY_CONTENT[contentType] ?? TIER_PROVIDER.T3;
  return TIER_PROVIDER[tier];
}

export interface RouteImageInput {
  contentType: ImageContentType;
  package: ImagePackage;
  /** Wymuszony tier (np. user chce premium) — i tak limitowany pakietem. */
  preferTier?: ImageTier;
}

export interface ImageRoute {
  contentType: ImageContentType;
  /** Wybrany tier po nałożeniu limitu pakietu. */
  tier: ImageTier;
  provider: string;
  /** Koszt kredytów (0 dla Lite/T0). */
  creditCost: number;
  /** Łańcuch fallback (providerzy do spróbowania w kolejności, malejący tier). */
  fallbackChain: string[];
  /** Czy żądany tier został obniżony przez limit pakietu? */
  downgraded: boolean;
  /** data_viz nie jest image-gen → renderowane przez silnik wykresów (F11). */
  isChartRoute: boolean;
}

/**
 * Wyznacz trasę dla obrazu: tier (z limitem pakietu), provider, koszt, fallback.
 */
export function routeImage(input: RouteImageInput): ImageRoute {
  const { contentType, package: pkg } = input;

  // data_viz → silnik wykresów, nie generator obrazów.
  if (contentType === 'data_viz') {
    return {
      contentType,
      tier: 'T0',
      provider: 'chart-engine',
      creditCost: 0,
      fallbackChain: [],
      downgraded: false,
      isChartRoute: true,
    };
  }

  const requested = input.preferTier ?? CONTENT_PREFERRED_TIER[contentType];
  const tier = clampTierToPackage(requested, pkg);
  const downgraded = tierIndex(tier) < tierIndex(requested);

  const provider = providerFor(tier, contentType);

  // Fallback: od wybranego tieru w dół do T0 (stock zawsze ostatni ratunek).
  const fallbackChain: string[] = [];
  for (let i = tierIndex(tier) - 1; i >= 0; i--) {
    fallbackChain.push(providerFor(TIER_ORDER[i], contentType));
  }

  return {
    contentType,
    tier,
    provider,
    creditCost: TIER_CREDIT_COST[tier],
    fallbackChain,
    downgraded,
    isChartRoute: false,
  };
}

/** Zsumuj koszt kredytów dla zestawu tras (np. cały deck). */
export function totalCreditCost(routes: ImageRoute[]): number {
  return routes.reduce((sum, r) => sum + r.creditCost, 0);
}
