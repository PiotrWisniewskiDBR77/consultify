/**
 * Krok C (rozdział flagi-długu ENABLE_TERESA_MINDMAP) — dowód dla
 * `isTeresaMindmapSearchEnabled()` (server/src/services/ai/tools/orgRetrievalShared.ts).
 *
 * Przed Krokiem C jedna nazwa ENV (`ENABLE_TERESA_MINDMAP`) gasiła DWIE
 * niepowiązane funkcje: Funkcję A (deliverable bridge — generate_deliverable
 * type:'mindmap', default ON, NIETKNIĘTA tutaj) i Funkcję B (retrieval
 * search_org_mindmaps, default OFF). Ten test pokrywa 4 kombinacje NOWEJ
 * (`ENABLE_TERESA_MINDMAP_SEARCH`) i STAREJ (`ENABLE_TERESA_MINDMAP`) flagi —
 * kluczowe kryterium: żadne środowisko, które dotąd włączało retrieval
 * WYŁĄCZNIE starą flagą, nie traci tego zachowania (OR, nie zamiana).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const NEW_KEY = 'ENABLE_TERESA_MINDMAP_SEARCH';
const OLD_KEY = 'ENABLE_TERESA_MINDMAP';

describe('isTeresaMindmapSearchEnabled — Krok C (2 flagi, kompatybilność wsteczna)', () => {
  const prevNew = process.env[NEW_KEY];
  const prevOld = process.env[OLD_KEY];

  afterEach(() => {
    if (prevNew === undefined) delete process.env[NEW_KEY];
    else process.env[NEW_KEY] = prevNew;
    if (prevOld === undefined) delete process.env[OLD_KEY];
    else process.env[OLD_KEY] = prevOld;
    vi.resetModules();
  });

  it('obie flagi nieustawione → OFF (default bezpieczny)', async () => {
    delete process.env[NEW_KEY];
    delete process.env[OLD_KEY];
    vi.resetModules();
    const { isTeresaMindmapSearchEnabled } = await import(
      '../../../server/src/services/ai/tools/orgRetrievalShared.js'
    );
    expect(isTeresaMindmapSearchEnabled()).toBe(false);
  });

  it('NOWA=true, STARA nieustawiona → ON (nowy, samodzielny włącznik)', async () => {
    process.env[NEW_KEY] = 'true';
    delete process.env[OLD_KEY];
    vi.resetModules();
    const { isTeresaMindmapSearchEnabled } = await import(
      '../../../server/src/services/ai/tools/orgRetrievalShared.js'
    );
    expect(isTeresaMindmapSearchEnabled()).toBe(true);
  });

  it('NOWA nieustawiona, STARA=true → ON (kompatybilność wsteczna — środowisko sprzed Kroku C)', async () => {
    delete process.env[NEW_KEY];
    process.env[OLD_KEY] = 'true';
    vi.resetModules();
    const { isTeresaMindmapSearchEnabled } = await import(
      '../../../server/src/services/ai/tools/orgRetrievalShared.js'
    );
    expect(isTeresaMindmapSearchEnabled()).toBe(true);
  });

  it('obie flagi=true → ON', async () => {
    process.env[NEW_KEY] = 'true';
    process.env[OLD_KEY] = 'true';
    vi.resetModules();
    const { isTeresaMindmapSearchEnabled } = await import(
      '../../../server/src/services/ai/tools/orgRetrievalShared.js'
    );
    expect(isTeresaMindmapSearchEnabled()).toBe(true);
  });
});
