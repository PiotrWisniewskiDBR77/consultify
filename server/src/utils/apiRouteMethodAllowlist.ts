import type { Application, Request } from 'express';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

function normalizePath(path: string): string {
  if (!path) return '/';
  const withoutQuery = path.split('?')[0] || '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function getRouterStack(app: Application): any[] {
  const maybeApp = app as Application & {
    _router?: { stack?: any[] };
    router?: { stack?: any[] };
  };

  if (Array.isArray(maybeApp._router?.stack)) {
    return maybeApp._router.stack;
  }
  if (Array.isArray(maybeApp.router?.stack)) {
    return maybeApp.router.stack;
  }
  return [];
}

function toExpressPathRegex(pathExpression: string): RegExp {
  const escaped = pathExpression.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const withParams = escaped.replace(/\\:([A-Za-z0-9_]+)/g, '[^/]+');
  return new RegExp(`^${withParams}/?$`);
}

export function resolveAllowedApiMethods(app: Application, req: Request): string[] {
  const apiPath = normalizePath(req.path);
  const stack = getRouterStack(app);
  const allowed = new Set<string>();

  for (const layer of stack) {
    const route = layer?.route;
    if (!route || !route.path || !route.methods) {
      continue;
    }

    const routePaths = Array.isArray(route.path) ? route.path : [route.path];
    for (const routePathRaw of routePaths) {
      const routePath = normalizePath(String(routePathRaw));
      const matched = routePath.includes(':')
        ? toExpressPathRegex(routePath).test(apiPath)
        : routePath === apiPath;

      if (!matched) continue;

      for (const method of HTTP_METHODS) {
        if (route.methods[method.toLowerCase()]) {
          allowed.add(method);
        }
      }
    }
  }

  if (allowed.has('GET')) {
    allowed.add('HEAD');
  }

  return Array.from(allowed).sort();
}
