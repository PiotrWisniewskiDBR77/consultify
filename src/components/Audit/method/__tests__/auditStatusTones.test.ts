/**
 * auditStatusTones — jednostkowe testy mapowania statusów domeny Audits na
 * `StatusTone`.
 *
 * Wymóg prawny (brief U7 §D): pakiet NIEZWERYFIKOWANY nie może wyglądać jak
 * norma. Test 2 jest tego bezpośrednią egzekucją — pętla po WSZYSTKICH
 * klasyfikacjach innych niż `VERIFIED_NORMATIVE` upewnia się, że żadna nie
 * dostanie tonu `success`, niezależnie od tego, jak w przyszłości zmieni się
 * lista `PACK_CLASSIFICATIONS`.
 */
import { describe, expect, it } from 'vitest';

import {
  packClassificationLabel,
  packClassificationTone,
  packPublicationLabel,
  packPublicationTone,
  programLifecycleLabel,
  programLifecycleTone,
  proposalStatusLabel,
  proposalStatusTone,
  reportStatusLabel,
  reportStatusTone,
} from '../auditStatusTones';
import {
  AUDIT_LIFECYCLE_STATES,
  AUDIT_PROPOSAL_STATUSES,
  AUDIT_REPORT_STATUSES,
  PACK_CLASSIFICATIONS,
  PACK_PUBLICATION_STATUSES,
} from '../auditsMethodApi';

describe('packClassificationTone', () => {
  it('gives VERIFIED_NORMATIVE the only success tone', () => {
    expect(packClassificationTone('VERIFIED_NORMATIVE')).toBe('success');
  });

  it('NEVER gives a non-verified classification the success tone (legal requirement)', () => {
    const nonVerified = PACK_CLASSIFICATIONS.filter((c) => c !== 'VERIFIED_NORMATIVE');
    expect(nonVerified).toEqual(
      expect.arrayContaining(['INTERNAL_FRAMEWORK', 'DEMONSTRATION', 'LEGACY', 'EVIDENCE_MISSING'])
    );
    for (const classification of nonVerified) {
      expect(packClassificationTone(classification)).not.toBe('success');
    }
  });

  it('DEMONSTRATION / LEGACY / EVIDENCE_MISSING resolve to a distinct, non-neutral-looking-as-norm tone', () => {
    // Each of the three "handle with care" classifications must be visually
    // distinguishable from a plain neutral chip AND from success.
    expect(packClassificationTone('DEMONSTRATION')).toBe('warning');
    expect(packClassificationTone('LEGACY')).toBe('neutral');
    expect(packClassificationTone('EVIDENCE_MISSING')).toBe('danger');
  });

  it('every classification has a non-empty PL and EN label, and they differ', () => {
    for (const classification of PACK_CLASSIFICATIONS) {
      const pl = packClassificationLabel(classification, true);
      const en = packClassificationLabel(classification, false);
      expect(pl.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
    }
  });
});

describe('packPublicationTone', () => {
  it('published is success, draft/deprecated are not', () => {
    expect(packPublicationTone('published')).toBe('success');
    expect(packPublicationTone('draft')).not.toBe('success');
    expect(packPublicationTone('deprecated')).not.toBe('success');
  });

  it('resolves every publication status to a tone and a label without throwing', () => {
    for (const status of PACK_PUBLICATION_STATUSES) {
      expect(() => packPublicationTone(status)).not.toThrow();
      expect(packPublicationLabel(status, false).length).toBeGreaterThan(0);
    }
  });
});

describe('programLifecycleTone / programLifecycleLabel', () => {
  it('covers all 11 lifecycle states with a tone and a bilingual label', () => {
    expect(AUDIT_LIFECYCLE_STATES.length).toBe(11);
    for (const state of AUDIT_LIFECYCLE_STATES) {
      expect(programLifecycleTone(state)).toBeTruthy();
      expect(programLifecycleLabel(state, true)).not.toBe(programLifecycleLabel(state, false));
    }
  });

  it('closed is the only success-toned stage; planning is neutral', () => {
    expect(programLifecycleTone('closed')).toBe('success');
    expect(programLifecycleTone('planning')).toBe('neutral');
  });
});

describe('reportStatusTone / reportStatusLabel', () => {
  it('published is success, draft is neutral', () => {
    expect(reportStatusTone('published')).toBe('success');
    expect(reportStatusTone('draft')).toBe('neutral');
  });

  it('resolves every report status without throwing', () => {
    for (const status of AUDIT_REPORT_STATUSES) {
      expect(() => reportStatusTone(status)).not.toThrow();
      expect(reportStatusLabel(status, true).length).toBeGreaterThan(0);
    }
  });
});

describe('proposalStatusTone / proposalStatusLabel', () => {
  it('registered is success, draft is neutral', () => {
    expect(proposalStatusTone('registered')).toBe('success');
    expect(proposalStatusTone('draft')).toBe('neutral');
  });

  it('resolves every proposal status without throwing', () => {
    for (const status of AUDIT_PROPOSAL_STATUSES) {
      expect(() => proposalStatusTone(status)).not.toThrow();
      expect(proposalStatusLabel(status, true).length).toBeGreaterThan(0);
    }
  });
});
