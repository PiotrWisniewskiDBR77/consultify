const PUBLIC_PRODUCTION_HOSTS = new Set(['consultify.ai', 'www.consultify.ai']);
// VTS pilot scope: surface Chat + Interview plus My Work, Initiatives, Execution
// and Settings on public production. Everything else stays locked at the sidebar.
const PUBLIC_PRODUCTION_CORE_MENU_IDS = new Set([
  'AI_CHAT',
  'INTERVIEW',
  'MY_WORK',
  'MODULE_INITIATIVES',
  'MODULE_EXECUTION',
  'SETTINGS',
]);

type LockableMenuItem<T> = T & {
  id: string;
  subItems?: LockableMenuItem<T>[];
  isLocked?: boolean;
  lockedMessage?: string;
  lockedCtaHref?: string;
};

export function isPublicProductionHost(hostname: string): boolean {
  return PUBLIC_PRODUCTION_HOSTS.has(hostname.toLowerCase());
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
