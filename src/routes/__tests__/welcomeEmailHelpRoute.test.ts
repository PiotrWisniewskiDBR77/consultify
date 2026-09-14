import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROUTES } from '../routeConfig';

/**
 * T-II (uwagi testera Tomka, 2026-09-13): „Link w mailu prowadzi do
 * https://staging.consultify.ai/help — nie ma takiej strony."
 *
 * Mail powitalny (server/src/services/welcomeEmailService.ts) linkuje do
 * `${appUrl}/help` w DWÓCH miejscach (centrum pomocy w treści i stopka), a
 * `src/routes/AppRoutes.tsx` montował wyłącznie `/docs`. Nowy użytkownik
 * dostawał więc 404 z pierwszego maila, jaki w ogóle widzi.
 *
 * Ten test nie sprawdza obecności trasy „na pamięć" — WYCIĄGA ścieżki z
 * realnej treści maila i żąda, żeby każda z nich była zamontowana. Dzięki
 * temu złapie też następny link, który ktoś dopisze do maila bez trasy.
 */
describe('T-II — ścieżki z maila powitalnego są zamontowane w AppRoutes', () => {
  const emailSource = readFileSync(
    resolve(process.cwd(), 'server/src/services/welcomeEmailService.ts'),
    'utf8'
  );
  const routesSource = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

  /** Pierwszy segment każdego `${appUrl}/<segment>` użytego w treści maila. */
  const emailPaths = [
    ...new Set(
      [...emailSource.matchAll(/\$\{appUrl\}\/([A-Za-z0-9-]+)/g)].map((m) => `/${m[1]}`)
    ),
  ];

  it('mail powitalny w ogóle zawiera linki w aplikację (inaczej test byłby pustym przebiegiem)', () => {
    expect(emailPaths.length).toBeGreaterThan(0);
    expect(emailPaths).toContain('/help');
  });

  /**
   * Zamontowane ścieżki zbieramy DWIEMA drogami, bo AppRoutes zapisuje je
   * dwojako: dosłownie (`path="/help"`) i przez stałą z routeConfig
   * (`path={`${ROUTES.SETTINGS.ROOT}/*`}`). Sprawdzanie tylko dosłownych dało
   * fałszywy alarm na `/settings`, które JEST zamontowane — ten test ma mówić
   * prawdę w obie strony, nie tylko łapać brak.
   */
  const mountedPaths = new Set<string>();

  for (const m of routesSource.matchAll(/path="([^"]+)"/g)) {
    mountedPaths.add(m[1].replace(/\/\*$/, ''));
  }

  const flattenRoutes = (node: unknown, prefix: string, out: Map<string, string>) => {
    if (typeof node === 'string') {
      out.set(prefix, node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        flattenRoutes(value, prefix ? `${prefix}.${key}` : key, out);
      }
    }
  };
  const routeConstants = new Map<string, string>();
  flattenRoutes(ROUTES, 'ROUTES', routeConstants);

  for (const m of routesSource.matchAll(/path=\{`?\$?\{?(ROUTES(?:\.[A-Z_0-9]+)+)\}?/g)) {
    const value = routeConstants.get(m[1]);
    if (value) mountedPaths.add(value.replace(/\/\*$/, ''));
  }

  it.each(emailPaths.map((p) => [p]))(
    'trasa %s użyta w mailu powitalnym jest zamontowana',
    (path) => {
      const mounted =
        mountedPaths.has(path) || [...mountedPaths].some((p) => path.startsWith(`${p}/`));
      expect(mounted, `mail powitalny linkuje do ${path}, a AppRoutes tego nie montuje → 404`).toBe(
        true
      );
    }
  );

  it('/help prowadzi do centrum pomocy (/docs), nie montuje drugiej kopii widoku', () => {
    const index = routesSource.indexOf('path="/help"');
    expect(index).toBeGreaterThan(-1);
    const slice = routesSource.slice(index, index + 200);
    expect(slice).toContain('Navigate');
    expect(slice).toContain('to="/docs"');
    expect(slice).toContain('replace');
  });
});
