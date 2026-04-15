const PUBLIC_PRODUCTION_HOSTS = new Set(['consultify.ai', 'www.consultify.ai']);
const PUBLIC_PRODUCTION_CORE_MENU_IDS = new Set(['AI_CHAT', 'INTERVIEW']);

export function isPublicProductionHost(hostname: string): boolean {
  return PUBLIC_PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export function shouldHideNonCoreModulesInPublicProduction(
  hostname = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return process.env.NODE_ENV === 'production' && isPublicProductionHost(hostname);
}

export function filterMainMenuForPublicProduction<T extends { id: string }>(
  items: T[],
  hideNonCoreModules: boolean
): T[] {
  if (!hideNonCoreModules) return items;
  return items.filter((item) => PUBLIC_PRODUCTION_CORE_MENU_IDS.has(item.id));
}
