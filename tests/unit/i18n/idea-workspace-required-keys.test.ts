/**
 * idea-workspace-required-keys.test.ts
 *
 * Locale-sweep gate for the four Idea Workspace tools (Mind Map / Table /
 * Process Flow / Whiteboard) and their subtrees. Rather than a hand-maintained
 * list of "required keys" (which silently drifts as the tools change), this
 * test walks the real source tree at run time, extracts every `t('some.key',
 * ...)` call via a real TS/JSX-aware AST (not a leaf-name grep — leaf segment
 * names repeat constantly across these files, so a grep would report a key as
 * present when only a sibling with the same last segment exists), and asserts
 * the dotted key path resolves inside BOTH `public/locales/pl/translation.json`
 * and `public/locales/en/translation.json` (or `tabele-provenance.json` for the
 * one file that opts into that namespace).
 *
 * Plural-aware: i18next resolves `t(key, { count })` via `${key}_one` /
 * `${key}_few` / `${key}_many` / `${key}_other` (pl) or `${key}_one` /
 * `${key}_other` (en), never the bare key. If the bare key is absent but
 * `${key}_other` is present in both locales, that counts as resolved.
 *
 * This will go RED the moment a t() call is added to these tools with a key
 * that isn't backed by a real translation entry in both pl and en — the exact
 * "silent English fallback" defect class this suite exists to catch.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';
// eslint-disable-next-line import/no-named-as-default
import traverseMod from '@babel/traverse';
import { describe, expect, it } from 'vitest';

const traverse = (traverseMod as unknown as { default: typeof traverseMod }).default ?? traverseMod;

const ROOT = process.cwd();

// Mirrors the STREAM LOCALE-SWEEP scope: the four Idea tool entry points plus
// the subtrees they're built from. Deliberately excludes mindmap/ (not named
// in the sweep's scope) and dev-render/ (harness UI, never a locale finding).
const SCOPE_ROOTS = [
  'src/components/MyWork/IdeaMapWorkspace.tsx',
  'src/components/MyWork/IdeaTableTool.tsx',
  'src/components/MyWork/IdeaProcessFlowTool.tsx',
  'src/components/MyWork/IdeaWhiteboardTool.tsx',
  'src/components/MyWork/mindmap/MindMap3DView.tsx',
  'src/components/MyWork/whiteboard',
  'src/components/MyWork/processflow',
  'src/components/MyWork/table',
  'src/components/MyWork/knowledge',
];

// Files that call `useTranslation('someNamespace')` instead of the default
// namespace. Add here if a new file in-scope opts into a non-default ns.
const NS_OVERRIDES: Record<string, string> = {
  'src/components/MyWork/table/provenance/ConfidenceBar.tsx': 'tabele-provenance',
};

function collectFiles(relPath: string, out: string[]): void {
  const abs = path.join(ROOT, relPath);
  const st = statSync(abs);
  if (st.isFile()) {
    if (/\.(tsx|ts)$/.test(relPath) && !/__tests__|\.test\.|\.spec\./.test(relPath)) {
      out.push(relPath);
    }
    return;
  }
  for (const entry of readdirSync(abs)) {
    collectFiles(path.join(relPath, entry), out);
  }
}

function extractTCalls(relPath: string): Array<{ key: string; line: number }> {
  const abs = path.join(ROOT, relPath);
  const code = readFileSync(abs, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return [];
  }
  const calls: Array<{ key: string; line: number }> = [];
  traverse(ast, {
    CallExpression(p: any) {
      const callee = p.node.callee;
      const isTCall =
        (callee.type === 'Identifier' && callee.name === 't') ||
        (callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 't');
      if (!isTCall) return;
      const args = p.node.arguments;
      if (args.length > 0 && args[0].type === 'StringLiteral') {
        calls.push({ key: args[0].value, line: p.node.loc?.start.line ?? 0 });
      }
    },
  });
  return calls;
}

const localeCache = new Map<string, unknown>();
function readLocale(locale: 'en' | 'pl', ns: string): unknown {
  const cacheKey = `${locale}:${ns}`;
  if (!localeCache.has(cacheKey)) {
    const p = path.join(ROOT, 'public', 'locales', locale, `${ns}.json`);
    localeCache.set(cacheKey, JSON.parse(readFileSync(p, 'utf8')));
  }
  return localeCache.get(cacheKey);
}

function getPath(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce((cur: any, part) => (cur == null ? undefined : cur[part]), obj);
}

// Resolves the way i18next actually resolves: exact key, or (for keys used
// with a `count` option) the `_other` plural fallback.
function resolves(locale: 'en' | 'pl', ns: string, key: string): boolean {
  const data = readLocale(locale, ns);
  if (getPath(data, key) !== undefined) return true;
  if (getPath(data, `${key}_other`) !== undefined) return true;
  return false;
}

describe('Idea Workspace tools — every t() key resolves in pl and en', () => {
  const files: string[] = [];
  for (const root of SCOPE_ROOTS) collectFiles(root, files);

  it('discovered a non-trivial number of in-scope source files', () => {
    // Sanity guard: if this drops to ~0 the glob broke, not the locales.
    expect(files.length).toBeGreaterThan(100);
  });

  // Build the full (ns, key, file, line) inventory once.
  const usages: Array<{ ns: string; key: string; file: string; line: number }> = [];
  for (const file of files) {
    const ns = NS_OVERRIDES[file] ?? 'translation';
    for (const call of extractTCalls(file)) {
      usages.push({ ns, key: call.key, file, line: call.line });
    }
  }

  it('extracted a non-trivial number of t() call sites', () => {
    expect(usages.length).toBeGreaterThan(500);
  });

  it.each(['pl', 'en'] as const)(
    'every key used by the Idea tools resolves in %s',
    (locale) => {
      const missing = usages.filter((u) => !resolves(locale, u.ns, u.key));
      const summary = missing
        .slice(0, 40)
        .map((m) => `  ${m.ns}:${m.key}  (${m.file}:${m.line})`)
        .join('\n');
      expect(
        missing.length,
        `${missing.length} key(s) used by the Idea Workspace tools are missing from ${locale} ` +
          `translation.json (showing up to 40):\n${summary}`
      ).toBe(0);
    },
    30000
  );
});
