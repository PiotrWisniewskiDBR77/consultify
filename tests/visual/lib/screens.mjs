/**
 * REJESTR V7-8 — screen registry loader.
 *
 * Parses dev-render/main.tsx's SCREENS map so the visual smoke-suite always
 * tests exactly the set of screens actually reachable via ?screen=<key> —
 * no separately-maintained list to drift out of sync. If a worker adds a
 * screen to dev-render/screens/*.tsx AND registers it in main.tsx, it is
 * automatically picked up on the next run (baseline will show it as NEW).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '../../..');
export const mainTsxPath = path.join(repoRoot, 'dev-render/main.tsx');

/**
 * Returns a de-duplicated, sorted list of screen keys registered in
 * dev-render/main.tsx's SCREENS object, e.g. ['agent-plan-view', ...].
 */
export function loadScreenKeys() {
  const src = readFileSync(mainTsxPath, 'utf8');
  // Matches top-level `  'screen-key': {` lines inside the SCREENS registry.
  const re = /^\s{2}'([a-z0-9-]+)':\s*\{/gm;
  const keys = new Set();
  let m;
  while ((m = re.exec(src))) {
    keys.add(m[1]);
  }
  return [...keys].sort();
}
