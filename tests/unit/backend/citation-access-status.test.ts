import { describe, expect, it } from 'vitest';

import {
  buildCitationStatusPayload,
  mapVerificationStatusToAccessStatus,
} from '../../../server/src/services/ai/citationAccessStatus.js';

/**
 * M01-P04B — GF-CHAT-08 source failure honesty, server half.
 *
 * `buildCitationStatusPayload` is the ONLY sanctioned way to turn a
 * `citationVerifier` report into what the client sees for a `failed`/`stale`
 * source. Its output type structurally cannot carry a title/excerpt/url —
 * this test locks that down at both the mapping-value level and the
 * output-shape level (NEGATIVE CONTROL b, server half).
 */
describe('citationAccessStatus (M01-P04B / GF-CHAT-08)', () => {
  it('maps the verifier four-value taxonomy to the three-value UI taxonomy', () => {
    expect(mapVerificationStatusToAccessStatus('verified')).toBe('ready');
    expect(mapVerificationStatusToAccessStatus('partial')).toBe('stale');
    expect(mapVerificationStatusToAccessStatus('unverified')).toBe('stale');
    expect(mapVerificationStatusToAccessStatus('broken')).toBe('failed');
  });

  it('builds a status-only payload — {id, status} and NOTHING else', () => {
    const report = {
      results: [
        { citationId: 'cit_1', status: 'broken' },
        { citationId: 'cit_2', status: 'verified' },
      ],
    };
    const payload = buildCitationStatusPayload(report);
    expect(payload).toEqual([
      { id: 'cit_1', status: 'failed' },
      { id: 'cit_2', status: 'ready' },
    ]);
    // Structural guarantee: exactly two keys, always.
    for (const entry of payload) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'status']);
    }
  });

  it('returns [] for a null/empty report without throwing', () => {
    expect(buildCitationStatusPayload(null)).toEqual([]);
    expect(buildCitationStatusPayload({ results: [] })).toEqual([]);
    expect(buildCitationStatusPayload({} as any)).toEqual([]);
  });

  /**
   * NEGATIVE CONTROL (b), server half — required by the packet: "test ACL
   * źródła MUSI padać, gdy tytuł niedostępnego dokumentu trafi do
   * odpowiedzi". Simulates a hand-rolled (broken) status payload builder
   * that — unlike `buildCitationStatusPayload` — spreads the raw
   * verification result and therefore leaks whatever extra fields it
   * happens to carry (here, a `title` a verifier might legitimately resolve
   * internally while checking existence). Asserts the SAME "no title
   * leaked" check the real function satisfies fails against the broken one.
   */
  it('[negative control] a hand-rolled builder that spreads the raw result leaks the title', () => {
    const brokenReportEntry = {
      citationId: 'cit_3',
      status: 'broken',
      // A verifier could plausibly resolve this internally (e.g. to log
      // "Secret Internal Roadmap.docx not found") — the real
      // buildCitationStatusPayload NEVER reads or forwards this field.
      title: 'Secret Internal Roadmap.docx',
    };
    // Broken builder: naive spread instead of an explicit {id, status} pick.
    const brokenPayload = [{ id: brokenReportEntry.citationId, ...brokenReportEntry }];
    expect(() => {
      expect(brokenPayload[0]).not.toHaveProperty('title');
    }).toThrow();

    // The real function, given the same input shape (status + a stray
    // title field the report might carry), does NOT leak it.
    const safePayload = buildCitationStatusPayload({
      results: [brokenReportEntry as any],
    });
    expect(safePayload[0]).not.toHaveProperty('title');
    expect(safePayload[0]).toEqual({ id: 'cit_3', status: 'failed' });
  });
});
