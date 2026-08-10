/**
 * CONTRACT — docs/product/case-workspace/api/openapi.yaml describes EXACTLY the
 * routes that are mounted, no more and no less.
 *
 * This is the test that stops the spec from rotting. It walks the real Express
 * router stack of `server/src/routes/caseWorkspace/index.ts` (the same object
 * `routes/v8/index.ts:100` mounts) and compares it, in both directions, with
 * the operations declared in the YAML:
 *
 *   - a handler with no spec entry  → the spec is INCOMPLETE
 *   - a spec entry with no handler  → the spec is FICTION
 *
 * Both are failures. A spec that only claims a superset of reality is exactly
 * the "documentation says it works" trap this repo has been bitten by; the
 * assertion below is symmetric on purpose.
 *
 * No database is required — this suite is pure structure, so it runs in every
 * environment (unlike its siblings in this directory, which gate on real PG).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';
import { describe, expect, it } from 'vitest';

import caseWorkspaceRoutes from '../../index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = path.resolve(
  HERE,
  '../../../../../../docs/product/case-workspace/api/openapi.yaml'
);

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

interface ExpressLayer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
  handle?: { stack?: ExpressLayer[] };
  name?: string;
}

/**
 * Flattens `router.use(subRouter)` nesting into `METHOD /path` strings, with
 * Express `:param` rewritten to OpenAPI `{param}`. Every sub-router in this
 * directory declares fully-qualified paths and is mounted at root, so no
 * prefix accumulation is needed (see index.ts's own header comment).
 */
function collectRoutes(layers: ExpressLayer[]): string[] {
  const out: string[] = [];
  for (const layer of layers) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const p of paths) {
        const openApiPath = p.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
        for (const method of HTTP_METHODS) {
          if (layer.route.methods[method]) out.push(`${method.toUpperCase()} ${openApiPath}`);
        }
      }
      continue;
    }
    if (layer.handle?.stack) out.push(...collectRoutes(layer.handle.stack));
  }
  return out;
}

function collectSpecOperations(doc: any): string[] {
  const out: string[] = [];
  for (const [p, item] of Object.entries(doc.paths as Record<string, any>)) {
    for (const method of HTTP_METHODS) {
      if (item[method]) out.push(`${method.toUpperCase()} ${p}`);
    }
  }
  return out;
}

const specText = fs.readFileSync(OPENAPI_PATH, 'utf8');
const spec = YAML.parse(specText);

const mounted = collectRoutes((caseWorkspaceRoutes as unknown as { stack: ExpressLayer[] }).stack).sort();
const declared = collectSpecOperations(spec).sort();

describe('CONTRACT — OpenAPI ↔ mounted router parity', () => {
  it('the spec parses as OpenAPI 3.0 with a server pinned to the real mount path', () => {
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.servers?.[0]?.url).toBe('/api/v8/case-workspace');
  });

  it('every mounted handler has an OpenAPI operation (spec is not incomplete)', () => {
    const missingFromSpec = mounted.filter((r) => !declared.includes(r));
    expect(missingFromSpec).toEqual([]);
  });

  it('every OpenAPI operation has a mounted handler (spec is not fiction)', () => {
    const missingFromRouter = declared.filter((r) => !mounted.includes(r));
    expect(missingFromRouter).toEqual([]);
  });

  it('the router mounts 109 operations and the spec declares the same count', () => {
    // Pinned deliberately: a new route added without a spec entry (or the
    // reverse) must fail loudly here, not drift silently. This pin has already
    // earned its keep once — it caught `intake.routes.ts` (3 operations, added
    // by a parallel stream after the first 106 were transcribed) before those
    // endpoints reached the spec.
    expect(mounted.length).toBe(109);
    expect(declared.length).toBe(109);
  });

  it('every $ref in the spec resolves to a component that exists', () => {
    const refs = new Set<string>();
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === '$ref' && typeof v === 'string') refs.add(v);
        else walk(v);
      }
    };
    walk(spec);

    const unresolved = [...refs].filter((ref) => {
      const segments = ref.replace(/^#\//, '').split('/');
      let cursor: any = spec;
      for (const segment of segments) {
        cursor = cursor?.[segment];
        if (cursor === undefined) return true;
      }
      return false;
    });
    expect(unresolved).toEqual([]);
    expect(refs.size).toBeGreaterThan(50);
  });

  it('every operation declares a 500 response and at least one success response', () => {
    const offenders: string[] = [];
    for (const [p, item] of Object.entries(spec.paths as Record<string, any>)) {
      for (const method of HTTP_METHODS) {
        const op = item[method];
        if (!op) continue;
        const codes = Object.keys(op.responses ?? {});
        const hasSuccess = codes.some((c) => c.startsWith('2'));
        if (!hasSuccess || !codes.includes('500')) offenders.push(`${method.toUpperCase()} ${p}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every operation has a unique operationId', () => {
    const ids: string[] = [];
    for (const item of Object.values(spec.paths as Record<string, any>)) {
      for (const method of HTTP_METHODS) {
        if (item[method]?.operationId) ids.push(item[method].operationId);
      }
    }
    expect(ids.length).toBe(109);
    expect(new Set(ids).size).toBe(109);
  });
});
