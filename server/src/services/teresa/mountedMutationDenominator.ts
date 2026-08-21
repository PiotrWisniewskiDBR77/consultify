import type { FederatedActionEntry } from './federatedActionManifestTypes.js';

export interface MountedMutationRoute {
  module: FederatedActionEntry['module'];
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  source: string;
}

/** Static CI adapter for Express route sources; it never mounts or executes a second router. */
export function extractMountedMutationRoutes(
  sourceText: string,
  module: MountedMutationRoute['module'],
  source: string
): MountedMutationRoute[] {
  const routes: MountedMutationRoute[] = [];
  const matcher = /\brouter\.(post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
  for (const match of sourceText.matchAll(matcher)) {
    routes.push({ module, method: match[1].toUpperCase() as MountedMutationRoute['method'], path: match[2], source });
  }
  return routes;
}

export function mountedMutationId(route: MountedMutationRoute): string {
  return `${route.module}:${route.method}:${route.path}`;
}

/**
 * Every mounted mutation gets a manifest row. Until a registry adapter proves a
 * shared executor, it is explicitly fail-closed for Teresa instead of becoming MISSING.
 */
export function adaptMountedMutationDenominator(
  routes: readonly MountedMutationRoute[],
  supportedByMountedId: ReadonlyMap<string, FederatedActionEntry> = new Map()
): FederatedActionEntry[] {
  return routes.map((route) => {
    const id = mountedMutationId(route);
    const supported = supportedByMountedId.get(id);
    if (supported) return { ...supported, mountedMutationId: id };
    return {
      actionId: `mounted.${id.toLowerCase()}@1`, version: 1, module: route.module,
      surface: route.path, mountedMutationId: id, effect: 'DESTRUCTIVE_MUTATION',
      roles: ['ROUTE_AUTHORIZATION_REQUIRED'], tenantScope: 'ORGANIZATION',
      preview: 'REQUIRED', confirm: 'REQUIRED', idempotency: null, receipt: null, auditEvent: null,
      compensation: 'unsupported-until-shared-command-is-proven',
      uiExecutor: `${route.source}:${route.method}:${route.path}`, teresaExecutor: null,
      mvpDisposition: 'NOT_SUPPORTED_IN_MVP',
    };
  });
}
