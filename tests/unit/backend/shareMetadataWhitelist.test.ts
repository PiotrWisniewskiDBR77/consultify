import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * M01 / L-02 (F-3) — public conversation-share viewer must NOT leak message or
 * conversation `metadata` verbatim.
 *
 * The public, unauthenticated read-only endpoints `GET /share/:token` and
 * `POST /share/:token/unlock` shape their JSON by hand from an explicit field
 * whitelist (id / role / content / message_type / created_at for messages;
 * title / description / author.id for the conversation). The historical risk
 * (F-3) was returning raw rows — which carry an internal `metadata` JSON column
 * (reasoning, tool traces, intent flags) — straight to an anonymous viewer.
 *
 * This is a SOURCE-LEVEL regression lock (the handlers are inline in the route
 * file and not separately exported), pinned to two invariants that, if broken,
 * re-open the leak:
 *   1. The share route file references no `metadata` field at all.
 *   2. The response is never built by spreading a raw `conversation` / message /
 *      `share` row object.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const shareRoutesPath = path.resolve(
  here,
  '../../../server/src/routes/share.routes.ts'
);
const source = readFileSync(shareRoutesPath, 'utf8');

describe('share.routes — public viewer metadata whitelist (M01/L-02 · F-3)', () => {
  it('never references a `metadata` field anywhere in the share routes', () => {
    // The conversation_messages / conversations rows carry an internal metadata
    // column; the public viewer must select & emit explicit fields only.
    expect(source).not.toMatch(/metadata/i);
  });

  it('builds responses from explicit fields, never by spreading a raw row', () => {
    expect(source).not.toMatch(/\.\.\.\s*conversation\b/);
    expect(source).not.toMatch(/\.\.\.\s*message\b/);
    expect(source).not.toMatch(/\.\.\.\s*share\b/);
  });

  it('selects only whitelisted message columns for the public transcript', () => {
    // Lock the SELECT used by GET /share/:token so a future edit that adds
    // `metadata` (or `SELECT *`) to the public message query fails here.
    expect(source).toMatch(
      /SELECT\s+id,\s*role,\s*content,\s*message_type,\s*created_at\s+FROM conversation_messages/i
    );
  });
});
