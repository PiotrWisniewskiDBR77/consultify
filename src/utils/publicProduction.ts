const PUBLIC_PRODUCTION_CORE_MENU_IDS = new Set(['AI_CHAT', 'INTERVIEW']);

type LockableMenuItem<T> = T & {
  id: string;
  subItems?: LockableMenuItem<T>[];
  isLocked?: boolean;
  lockedMessage?: string;
  lockedCtaHref?: string;
};

function normalizeHostname(input: string): string {
  const v = (input || '').trim().toLowerCase();
  if (!v) return '';
  // Defensive: window.location.hostname doesn't include ports, but callers might.
  return v.split(':')[0] || '';
}

/**
 * Returns true only for customer-facing public production hosts.
 * Use this to hide internal debug chrome by default.
 */
export function isPublicProductionHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === 'consultify.ai' || host === 'www.consultify.ai';
}

export function shouldLockNonCoreModulesInPublicProduction(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return process.env.NODE_ENV === 'production' && isPublicProductionHost(hostname);
}

export function shouldHideNonCoreModulesInPublicProduction(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return shouldLockNonCoreModulesInPublicProduction(hostname);
}

export function lockMainMenuForPublicProduction<T extends { id: string }>(
  items: LockableMenuItem<T>[],
  lockNonCoreModules: boolean,
  lockedMessage: string,
  lockedCtaHref: string
): LockableMenuItem<T>[] {
  if (!lockNonCoreModules) return items;

  const decorateItem = (item: LockableMenuItem<T>): LockableMenuItem<T> => {
    const subItems = item.subItems?.map((subItem) => decorateItem(subItem));

    if (PUBLIC_PRODUCTION_CORE_MENU_IDS.has(item.id)) {
      return {
        ...item,
        subItems,
      };
    }

    return {
      ...item,
      subItems,
      isLocked: true,
      lockedMessage,
      lockedCtaHref,
    };
  };

  return items.map((item) => decorateItem(item));
}
