/**
 * DEC-91 / TRI-MUST-12 — the three raw-`ws` collab gateways refuse an UPGRADE
 * from a suspended tenant.
 *
 * ===========================================================================
 * WHAT THIS CLOSES, AND WHY THE SWEEP WAS NOT ENOUGH
 * ===========================================================================
 * These gateways authenticate at `server.on('upgrade')` with their own
 * `jwt.verify` — they never touch `attachUser` and they are not Socket.IO, so
 * neither the HTTP enforcement nor the `socketAuth` handshake gate reaches
 * them. Enrolling the connection in `trackRealtimeConnection` (done earlier in
 * DEC-91) only closes an ALREADY-OPEN socket at the next sweep, which left a
 * window of up to one sweep interval in which a suspended tenant could still
 * open a fresh channel. This suite pins the gate that closes that window.
 *
 * ===========================================================================
 * ONE HARNESS, THREE GATEWAYS
 * ===========================================================================
 * The three upgrade paths are the same shape (verify JWT → demo gate →
 * `resolveWsOrgContext` → resource gate → `handleUpgrade`), so they share a
 * harness and get their own `describe` each. Every case drives the REAL
 * exported `attach*` function and the REAL upgrade listener it registers; only
 * the database, the clock-free collaborators (`ws`, jwt, demo gate, org-context
 * resolver) are doubles.
 *
 * The negative control in each block is the identical request for an ACTIVE
 * tenant reaching `handleUpgrade`. That is what makes the refusal attributable
 * to the suspension rather than to a harness that never got that far.
 */

import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Everything the hoisted `vi.mock` factories touch must itself be hoisted —
 * the factories run before ordinary module initialisation.
 */
const H = vi.hoisted(() => {
  const ORG_STATUS: Record<string, string> = {
    'org-suspended': 'suspended',
    'org-active': 'active',
  };
  /** Resolved org for the next upgrade; set per case. */
  const state = { resolvedOrg: 'org-active' };

  /** Every resource the gateways gate on exists, for BOTH tenants. */
  const dbGet = vi.fn(async (sql: string, params?: unknown[]) => {
    const text = String(sql);
    const first = String((params || [])[0] ?? '');
    if (text.includes('FROM organizations')) {
      const status = ORG_STATUS[first];
      return status ? { status } : null;
    }
    // my_ideas / presentation_decks / notebook_pages — always found, so a
    // refusal can never be mistaken for "the resource was not there".
    return { id: first };
  });

  return {
    ORG_STATUS,
    state,
    dbGet,
    fakeDb: { get: dbGet, run: vi.fn(), all: vi.fn(async () => []) },
    handleUpgrade: vi.fn(),
  };
});

const { dbGet, state } = H;

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => H.fakeDb,
}));

vi.mock('../../config/Config.js', () => ({
  config: { JWT_SECRET: 'x'.repeat(48) },
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  // OFF → the idea gate takes its `my_ideas` org-scope branch, answered above.
  featureFlags: { ENABLE_SHARED_IDEA_MAPS: false },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: () => ({ id: 'user-1', organizationId: H.state.resolvedOrg, name: 'Member' }),
  },
}));

vi.mock('../../realtime/wsOrgContext.js', () => ({
  resolveWsOrgContext: vi.fn(async () => ({
    organizationId: H.state.resolvedOrg,
    demoMode: false,
  })),
  isWsOrgContextFresh: () => true,
}));

vi.mock('../../realtime/demoRealtimeGuard.js', () => ({
  // Always allows, so a refusal here is attributable to DEC-91 alone.
  evaluateRealtimeAccess: vi.fn(async () => ({ allowed: true })),
  trackRealtimeConnection: vi.fn(() => () => undefined),
  assertRealtimeEventAllowed: vi.fn(async () => true),
}));

vi.mock('ws', async () => {
  const { EventEmitter: EE } = await import('node:events');
  class FakeWebSocketServer extends EE {
    handleUpgrade(...args: unknown[]) {
      return H.handleUpgrade(...args);
    }
  }
  return { WebSocketServer: FakeWebSocketServer, WebSocket: class {} };
});

const handleUpgrade = H.handleUpgrade;

const { attachIdeaCollabWs } = await import('../ideaCollabWs.gateway.js');
const { attachPresentationCollabWs } = await import('../presentationCollabWs.gateway.js');
const { attachNotebookCollabWs } = await import('../notebookCollabWs.gateway.js');
const { __testing__, buildOrgSuspendedResponseBody } = await import(
  '../../services/organizationSuspensionGuard.js'
);

interface UpgradeOutcome {
  written: string;
  destroyed: boolean;
  upgraded: boolean;
}

/**
 * Register the gateway on a fake http server, fire one upgrade, and report
 * what the gateway did with the raw socket.
 */
const upgrade = async (
  attach: (server: never) => void,
  path: string,
  organizationId: string
): Promise<UpgradeOutcome> => {
  state.resolvedOrg = organizationId;
  handleUpgrade.mockClear();

  const server = new EventEmitter();
  attach(server as never);

  const outcome: UpgradeOutcome = { written: '', destroyed: false, upgraded: false };
  const socket = {
    write(chunk: string) {
      outcome.written += String(chunk);
      return true;
    },
    destroy() {
      outcome.destroyed = true;
    },
  };

  const request = {
    url: `${path}?token=a.b.c`,
    headers: { host: 'localhost' },
  };

  server.emit('upgrade', request, socket, Buffer.alloc(0));

  // The handler chains through several promises; wait for a verdict.
  for (let i = 0; i < 60 && !outcome.destroyed && handleUpgrade.mock.calls.length === 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  outcome.upgraded = handleUpgrade.mock.calls.length > 0;
  return outcome;
};

const GATEWAYS = [
  ['ideaCollabWs', attachIdeaCollabWs, '/ws/collab/idea-1'],
  ['presentationCollabWs', attachPresentationCollabWs, '/ws/presentations/deck-1'],
  ['notebookCollabWs', attachNotebookCollabWs, '/ws/notebook/note-1'],
] as const;

describe('DEC-91 organization suspension at collab WS upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __testing__.reset();
  });

  afterEach(() => {
    __testing__.reset();
  });

  for (const [name, attach, path] of GATEWAYS) {
    describe(name, () => {
      it('refuses the upgrade for a SUSPENDED tenant', async () => {
        const outcome = await upgrade(attach as never, path, 'org-suspended');

        expect(outcome.upgraded).toBe(false);
        expect(outcome.destroyed).toBe(true);
        expect(outcome.written).toContain('HTTP/1.1 403 Forbidden');
        expect(outcome.written).toContain('ORG_SUSPENDED');
      });

      it('NEGATIVE CONTROL: the identical upgrade for an ACTIVE tenant completes', async () => {
        const outcome = await upgrade(attach as never, path, 'org-active');

        expect(outcome.upgraded).toBe(true);
        expect(outcome.destroyed).toBe(false);
      });

      it('sends the same machine-readable body as every other DEC-91 path', async () => {
        const outcome = await upgrade(attach as never, path, 'org-suspended');

        const body = outcome.written.slice(outcome.written.indexOf('\r\n\r\n') + 4);
        expect(JSON.parse(body)).toEqual(buildOrgSuspendedResponseBody());
      });

      it('declares a well-formed HTTP response, not a bare status line', async () => {
        // The pre-existing convention wrote `HTTP/1.1 403 Forbidden\r\n\r\n`
        // with no body at all. A body without Content-Length would leave the
        // peer waiting on a connection we are about to destroy.
        const outcome = await upgrade(attach as never, path, 'org-suspended');

        const body = outcome.written.slice(outcome.written.indexOf('\r\n\r\n') + 4);
        expect(outcome.written).toContain('Content-Type: application/json');
        expect(outcome.written).toContain(
          `Content-Length: ${Buffer.byteLength(body, 'utf8')}`
        );
      });
    });
  }

  it('shares one cache across all three gateways — not one lookup per gateway', async () => {
    // The tenant is read once; the other two upgrades are answered from memory.
    // This is what keeps the gate free at the connection rate.
    await upgrade(attachIdeaCollabWs as never, '/ws/collab/idea-1', 'org-suspended');
    await upgrade(attachPresentationCollabWs as never, '/ws/presentations/deck-1', 'org-suspended');
    await upgrade(attachNotebookCollabWs as never, '/ws/notebook/note-1', 'org-suspended');

    const statusLookups = dbGet.mock.calls.filter((call) =>
      String(call[0]).includes('FROM organizations')
    ).length;
    expect(statusLookups).toBe(1);
  });
});
