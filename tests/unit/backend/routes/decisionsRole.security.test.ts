/**
 * decisionsRole.security — static contract test
 *
 * Reads the decisions route file and statically verifies that every sensitive
 * mutation endpoint has `verifyAdmin` in its middleware chain.
 *
 * This test is intentionally simple: it uses string search rather than
 * importing the router so it doesn't depend on Express/DB being available
 * and runs in < 10 ms.  It acts as a regression guard — if someone removes
 * verifyAdmin from a guarded route this test will catch it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTE_FILE = path.resolve(
  __dirname,
  '../../../../server/src/routes/pmo/decisions.routes.ts'
);

function loadRouteSource(): string {
  return fs.readFileSync(ROUTE_FILE, 'utf8');
}

/**
 * Extract the line(s) around a route definition so we can assert guard presence.
 * Returns the content from the route method definition up to (but not past) the
 * next router.* call, giving us the middleware list.
 */
function routeBlock(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  if (!match) return '';
  const start = source.indexOf(match[0]);
  // Grab enough context: up to 400 chars should include entire middleware chain
  return source.slice(start, start + 400);
}

describe('decisions.routes.ts — verifyAdmin guard contract', () => {
  let source: string;

  // Load once
  source = loadRouteSource();

  it('source file can be read and contains expected imports', () => {
    expect(source).toContain("import { verifyAdmin }");
    expect(source).toContain("from '../../middleware/admin.middleware.js'");
  });

  it('POST /escalate has verifyAdmin before the controller', () => {
    const block = routeBlock(source, /router\.post\s*\(\s*['"].*escalate['"]/);
    expect(block).toContain('verifyAdmin');
    // verifyAdmin must appear before DecisionController
    const viIdx = block.indexOf('verifyAdmin');
    const ctrlIdx = block.indexOf('DecisionController');
    expect(viIdx).toBeLessThan(ctrlIdx);
  });

  it('PATCH /workflow has verifyAdmin before the controller', () => {
    const block = routeBlock(source, /router\.patch\s*\(\s*['"].*workflow['"]/);
    expect(block).toContain('verifyAdmin');
    const viIdx = block.indexOf('verifyAdmin');
    const ctrlIdx = block.indexOf('DecisionController');
    expect(viIdx).toBeLessThan(ctrlIdx);
  });

  it('POST /playbooks has verifyAdmin before the controller', () => {
    // Match the create-playbook line (not GET /playbooks)
    const block = routeBlock(source, /router\.post\s*\(\s*['"]\/playbooks['"]/);
    expect(block).toContain('verifyAdmin');
    const viIdx = block.indexOf('verifyAdmin');
    const ctrlIdx = block.indexOf('DecisionPlaybookController');
    expect(viIdx).toBeLessThan(ctrlIdx);
  });

  it('PUT /playbooks/:playbookId has verifyAdmin', () => {
    const block = routeBlock(source, /router\.put\s*\(\s*['"]\/playbooks\/:playbookId['"]/);
    expect(block).toContain('verifyAdmin');
  });

  it('DELETE /playbooks/:playbookId has verifyAdmin', () => {
    const block = routeBlock(source, /router\.delete\s*\(\s*['"]\/playbooks\/:playbookId['"]/);
    expect(block).toContain('verifyAdmin');
  });

  it('GET /decisions (list) does NOT require verifyAdmin (read-only is open to all auth users)', () => {
    // GET / should be auth-only (verifyToken), not verifyAdmin-protected
    const block = routeBlock(source, /router\.get\s*\(\s*['"]\/['"]/);
    // verifyAdmin should not appear in a short block around the list GET
    // We check that the block doesn't have verifyAdmin immediately after GET /
    const shortBlock = block.slice(0, 120);
    expect(shortBlock).not.toContain('verifyAdmin');
  });

  it('verifyAdmin appears at least 5 times (escalate + workflow + playbook create/update/delete)', () => {
    const matches = source.match(/verifyAdmin/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });
});
