import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STATIC CANARY — v8 mutation regression guard.
 *
 * Regression history (re-introduced TWICE, latest via commit 46a1674000):
 * the v8Auth middleware once gated its connection-closed check on `req.destroyed`.
 * The JSON body-parser marks the IncomingMessage (`req`) as destroyed after it
 * consumes the body of a POST/PATCH/DELETE, while the underlying socket stays
 * open. Gating on `req.destroyed` therefore short-circuited EVERY v8 mutation:
 * the middleware returned without calling next() and without sending a response,
 * so every v8 POST/PATCH/DELETE hung until the Cloudflare 524 timeout on demo.
 *
 * The correct signal is `socket.destroyed` (actual network state).
 *
 * The behavioural tests in v8Auth.middleware.test.ts pin runtime behaviour, but a
 * future "make the test pass" edit could re-add code-level `req.destroyed` gating
 * in a path those tests don't exercise. This canary reads the middleware SOURCE
 * (comments stripped) and FAILS if any auth middleware references `req.destroyed`
 * or `request.destroyed` in executable code. Comments mentioning it (to explain
 * why it is excluded) are allowed.
 */

// Strip line + block comments so we only inspect executable code, then look for
// property access on the request object named `destroyed`.
function stripComments(src: string): string {
  return src
    // block comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // line comments // ...
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Matches `req.destroyed` / `request.destroyed` (including `(req as any).destroyed`
// and bracket access `req['destroyed']`) where `destroyed` is read DIRECTLY off
// the request object. It deliberately does NOT match `req.socket.destroyed`,
// which is the correct network-state signal — the bridge between the identifier
// and `.destroyed` must not contain another property hop (a `.` word).
const REQ_DESTROYED_RE =
  /\b(req|request)\b\s*(?:as\s+[\w<>[\]| ]+)?\s*\)?\s*(?:\.\s*destroyed\b|\[\s*['"]destroyed['"]\s*\])/;

const MIDDLEWARE_UNDER_GUARD = [
  '../../../../server/src/middleware/v8Auth.middleware.ts',
];

describe('v8Auth req.destroyed regression guard (static)', () => {
  for (const rel of MIDDLEWARE_UNDER_GUARD) {
    it(`does not gate on req.destroyed in ${rel}`, () => {
      const path = fileURLToPath(new URL(rel, import.meta.url));
      const raw = readFileSync(path, 'utf8');
      const codeOnly = stripComments(raw);

      // Sanity: the file must still be non-trivial after stripping comments,
      // otherwise a broken stripper would make this test vacuously pass.
      expect(codeOnly.length).toBeGreaterThan(200);

      // Sanity: the middleware MUST still gate on socket.destroyed (the correct
      // signal). If this disappears the guard is meaningless.
      expect(codeOnly).toMatch(/socket\s*(?:as\s+\w+\s*)?\)?[\s\S]{0,20}?\.\s*destroyed\b/);

      const match = REQ_DESTROYED_RE.exec(codeOnly);
      expect(
        match,
        match
          ? `Forbidden req.destroyed gating re-introduced in ${rel}: "${match[0]}". ` +
              'This hangs every v8 POST/PATCH/DELETE (Cloudflare 524). ' +
              'Use socket.destroyed instead — see isConnectionClosed() in v8Auth.middleware.ts.'
          : undefined
      ).toBeNull();
    });
  }
});
