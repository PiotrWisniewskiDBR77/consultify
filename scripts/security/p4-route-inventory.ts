/**
 * P4 BEZPIECZENSTWO — inwentaryzacja tras z ZYWEGO routera Express.
 *
 * Nie zgaduje z grepa. Express 5 nie wystawia prefiksu sub-routera
 * (`layer.path` = undefined, `layer.regexp` = undefined, `layer.matchers`
 * to domkniete funkcje), wiec skrypt PRZECHWYTUJE `Router.prototype.use`
 * ZANIM zaimportuje `server/src/index.ts` i buduje mape handle -> prefiks.
 * Potem przechodzi stack rekurencyjnie i sklada pelne sciezki.
 *
 * PULAPKA, ktora to zlapalo: pierwsza wersja czytala `layer.regexp` (Express 4)
 * i wyprodukowala 5201 "tras" z czego 5126 bez zadnego prefiksu — czyli
 * przyrzad pokazywal nie produkt. Bezpiecznik ponizej: jesli udzial tras
 * pod /api/ jest mniejszy niz P4_MIN_API_SHARE (domyslnie 0.5), skrypt
 * konczy sie bledem zamiast zapisac falszywy inwentarz.
 *
 * Uruchomienie:
 *   DOTENV_IGNORE_LOCAL=1 ENV_FILE=.env.staging.local PORT=3117 \
 *     P4_ROUTE_OUT=evidence/p4-bezpieczenstwo-20260910/routes-inventory.json \
 *     npx tsx scripts/security/p4-route-inventory.ts
 */
import express from 'express';

const OUT = process.env.P4_ROUTE_OUT || '';
const MIN_API_SHARE = Number(process.env.P4_MIN_API_SHARE || 0.5);

// handle (funkcja routera / middleware) -> sciezka montazu podana w use()
const mountPaths = new WeakMap<object, string>();

function recordMount(pathArg: unknown, handles: unknown[]) {
  if (typeof pathArg !== 'string') return;
  for (const h of handles) {
    if ((typeof h === 'function' || (h && typeof h === 'object')) && !mountPaths.has(h as object)) {
      mountPaths.set(h as object, pathArg);
    }
  }
}

function patchUse(target: any) {
  const original = target.use;
  if (typeof original !== 'function' || original.__p4Patched) return;
  const patched = function patchedUse(this: unknown, ...args: unknown[]) {
    if (args.length >= 2) recordMount(args[0], args.slice(1));
    return original.apply(this, args as never);
  };
  (patched as any).__p4Patched = true;
  target.use = patched;
}

patchUse((express as any).Router ? (express as any).Router : {});
patchUse((express as any).application);
// Router() zwraca funkcje z prototypem Router.prototype (Express 5).
const routerProto: any = Object.getPrototypeOf(express.Router());
patchUse(routerProto);

async function main() {
  const mod = await import('../../server/src/index.js');
  const app: any = (mod as any).default;
  // Trasy montowane sa asynchronicznie w trakcie warm-upu serwera.
  await new Promise((r) => setTimeout(r, Number(process.env.P4_WARMUP_MS || 60000)));

  const routes: Array<{ method: string; path: string }> = [];
  const seen = new Set<string>();

  function prefixOf(layer: any): string {
    const h = layer?.handle;
    if (h && mountPaths.has(h)) {
      const p = mountPaths.get(h)!;
      return p === '/' ? '' : p.replace(/\/$/, '');
    }
    return '';
  }

  function walk(stack: any[], prefix: string, depth: number) {
    if (!Array.isArray(stack) || depth > 15) return;
    for (const layer of stack) {
      if (layer?.route?.path !== undefined) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const p of paths) {
          const methods = layer.route.methods || {};
          for (const m of Object.keys(methods)) {
            if (!methods[m]) continue;
            const full = (prefix + String(p)).replace(/\/{2,}/g, '/') || '/';
            const key = m.toUpperCase() + ' ' + full;
            if (seen.has(key)) continue;
            seen.add(key);
            routes.push({ method: m.toUpperCase(), path: full });
          }
        }
        continue;
      }
      const child = layer?.handle?.stack;
      if (Array.isArray(child)) walk(child, prefix + prefixOf(layer), depth + 1);
    }
  }

  const stack = app?.router?.stack || app?._router?.stack || [];
  walk(stack, '', 0);
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));

  const apiCount = routes.filter((r) => r.path.startsWith('/api/')).length;
  const share = routes.length ? apiCount / routes.length : 0;
  console.error(`[p4] tras=${routes.length} pod /api/=${apiCount} (${(share * 100).toFixed(1)}%)`);
  if (share < MIN_API_SHARE) {
    console.error(
      `[p4] BEZPIECZNIK: tylko ${(share * 100).toFixed(1)}% tras ma prefiks /api/ — ` +
        'inwentarz jest niewiarygodny (prefiksy sub-routerow sie nie skleily). Nie zapisuje.'
    );
    process.exit(2);
  }

  const payload = JSON.stringify(
    { generatedAt: new Date().toISOString(), count: routes.length, apiCount, routes },
    null,
    2
  );
  if (OUT) {
    const fs = await import('node:fs');
    fs.writeFileSync(OUT, payload);
    console.error('[p4] zapisano ' + routes.length + ' tras do ' + OUT);
  } else {
    console.log(payload);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[p4] blad inwentaryzacji:', e);
  process.exit(1);
});
