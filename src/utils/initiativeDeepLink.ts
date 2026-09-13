import {
  INITIATIVE_CARD_KEYS,
  type InitiativeCardKey,
} from '@/contracts/initiatives-execution/cardRegistry';

/**
 * Uspójnienie F4.6 — jeden kanoniczny wzorzec deep-linkowania do inicjatywy.
 *
 * Audyt 2026-06-24: deep-link do inicjatywy był rozjechany (różne ścieżki/parametry
 * per moduł, hardkodowane `?initiativeId=`). Ten helper to jedyne źródło budowania
 * i odczytu deep-linku — wszystkie moduły (Initiatives/Execution/Finance) używają go,
 * dzięki czemu link z dowolnego miejsca otwiera tę samą inicjatywę spójnie.
 *
 * USPOJNIENIE D1 (2026-06-26): param ujednolicony na `open` — to FAKTYCZNA
 * konwencja produktu (InitiativesHub/ExecutionHub/ResultsHub czytają `?open=`).
 * Wcześniej builder emitował `?initiativeId=`, którego ŻADEN czytnik nie czytał
 * → link zbudowany utilem nie otwierał inicjatywy (martwy mismatch).
 */
export const INITIATIVE_DEEP_LINK_PARAM = 'open';

export type InitiativeLinkModule = 'initiatives' | 'execution' | 'economics';

const MODULE_BASE: Record<InitiativeLinkModule, string> = {
  initiatives: '/initiatives',
  execution: '/execution',
  economics: '/finance',
};

/** Zbuduj kanoniczny deep-link do inicjatywy (domyślnie moduł Initiatives). */
export function buildInitiativeDeepLink(
  initiativeId: string,
  opts?: {
    module?: InitiativeLinkModule;
    tab?: string;
    /**
     * Tryb otwarcia po stronie czytnika (InitiativesHub czyta `?mode=`,
     * default 'doc'). Wcześniej builder nie wspierał `mode` i moduły
     * hardkodowały `&mode=doc` ręcznie.
     */
    mode?: string;
    cardKey?: InitiativeCardKey;
    findingId?: string;
    returnContext?: string;
  }
): string {
  const base = MODULE_BASE[opts?.module ?? 'initiatives'];
  const params = new URLSearchParams();
  if (opts?.tab) params.set('tab', opts.tab);
  if (opts?.mode) params.set('mode', opts.mode);
  params.set(INITIATIVE_DEEP_LINK_PARAM, String(initiativeId));
  if (opts?.cardKey) params.set('card', opts.cardKey);
  if (opts?.findingId) params.set('finding', opts.findingId);
  if (opts?.returnContext) params.set('returnContext', opts.returnContext);
  return `${base}?${params.toString()}`;
}

/** Odczytaj id inicjatywy z deep-linku (z podanego search lub bieżącego URL). */
export function readInitiativeDeepLinkId(search?: string): string | null {
  try {
    const qs = search ?? (typeof window !== 'undefined' ? window.location.search : '');
    const v = new URLSearchParams(qs).get(INITIATIVE_DEEP_LINK_PARAM);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Additional navigation context is data, never a redirect or write instruction. */
export function readInitiativeCardDeepLink(search: string): {
  cardKey: InitiativeCardKey | null;
  findingId: string | null;
  returnContext: string | null;
} {
  const params = new URLSearchParams(search);
  const requested = params.get('card');
  const cardKey = INITIATIVE_CARD_KEYS.find((key) => key === requested) ?? null;
  return {
    cardKey,
    findingId: cardKey ? params.get('finding') : null,
    returnContext: params.get('returnContext'),
  };
}
