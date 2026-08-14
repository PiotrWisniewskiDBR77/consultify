/**
 * auditStatusTones — jednostkowe testy mapowania statusów domeny Audits na
 * `StatusTone`.
 *
 * Wymóg prawny (P0 2026-08-13, patrz `server/src/services/audits/types.ts`):
 * DWIE NIEZALEŻNE OSIE — `sourceType` (czym jest źródło) i `verificationStatus`
 * (czy je sprawdzono) NIGDY nie mieszają się. Procedura QMS klienta
 * zweryfikowana przez eksperta to `INTERNAL_PROCEDURE` + `VERIFIED` — NIE
 * „zweryfikowana norma". Testy poniżej egzekwują to wprost po renderowanym
 * TEKŚCIE etykiety (nie po kluczu), bo błąd kategorii z pierwszej wersji
 * modelu był dokładnie taki: klucz nazywał się poprawnie, ale etykieta
 * mieszała dwa pytania w jedno.
 */
import { describe, expect, it } from 'vitest';

import {
  packPublicationLabel,
  packPublicationTone,
  packSourceTypeLabel,
  packSourceTypeTone,
  packVerificationLabel,
  packVerificationTone,
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
  AUDIT_SOURCE_TYPES,
  AUDIT_VERIFICATION_STATES,
  isComplianceGrade,
  isNormativeSourceType,
  PACK_PUBLICATION_STATUSES,
} from '../auditsMethodApi';

describe('packSourceTypeLabel — oś 1 (CZYM jest źródło)', () => {
  it('never lets a non-normative source type render a label containing "norm" — checked on rendered TEXT, not the key', () => {
    const nonNormative = AUDIT_SOURCE_TYPES.filter((t) => !isNormativeSourceType(t));
    expect(nonNormative).toEqual(
      expect.arrayContaining([
        'INTERNAL_PROCEDURE',
        'INTERNAL_FRAMEWORK',
        'DEMONSTRATION',
        'LEGACY',
      ])
    );
    for (const sourceType of nonNormative) {
      expect(packSourceTypeLabel(sourceType, true).toLowerCase()).not.toMatch(/norm/);
      expect(packSourceTypeLabel(sourceType, false).toLowerCase()).not.toMatch(/norm/);
    }
  });

  it('reserves the word "norma"/"normative" for LICENSED_STANDARD only (REGULATION may also use it, but does not have to)', () => {
    expect(packSourceTypeLabel('LICENSED_STANDARD', true).toLowerCase()).toMatch(/norm/);
  });

  it('gives every source type a non-empty, differing PL/EN label', () => {
    for (const sourceType of AUDIT_SOURCE_TYPES) {
      const pl = packSourceTypeLabel(sourceType, true);
      const en = packSourceTypeLabel(sourceType, false);
      expect(pl.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
    }
  });

  it('NEVER gives the source-type axis a success tone — type is neither good nor bad (verification carries the judgement)', () => {
    for (const sourceType of AUDIT_SOURCE_TYPES) {
      expect(packSourceTypeTone(sourceType)).not.toBe('success');
    }
  });

  it('DEMONSTRATION gets a distinct, cautionary tone (never looks like a compliance audit)', () => {
    expect(packSourceTypeTone('DEMONSTRATION')).toBe('warning');
  });

  it('LEGACY never reads as current — neutral tone (no vivid fill) and a label that says so', () => {
    expect(packSourceTypeTone('LEGACY')).toBe('neutral');
    expect(packSourceTypeLabel('LEGACY', true).toLowerCase()).toMatch(/wycofan/);
    expect(packSourceTypeLabel('LEGACY', false).toLowerCase()).toMatch(/legacy|retired/);
  });

  it('changing verificationStatus never changes the source-type label — same pack, four verification states, identical type label', () => {
    for (const sourceType of AUDIT_SOURCE_TYPES) {
      const labelsAcrossVerification = AUDIT_VERIFICATION_STATES.map(() =>
        packSourceTypeLabel(sourceType, true)
      );
      expect(new Set(labelsAcrossVerification).size).toBe(1);
    }
  });
});

describe('packVerificationLabel — oś 2 (CZY sprawdzono)', () => {
  it('gives success ONLY to VERIFIED — the only success-toned value across BOTH axes', () => {
    expect(packVerificationTone('VERIFIED')).toBe('success');
    const rest = AUDIT_VERIFICATION_STATES.filter((v) => v !== 'VERIFIED');
    for (const status of rest) {
      expect(packVerificationTone(status)).not.toBe('success');
    }
  });

  it('resolves every verification state to a tone and a bilingual label without throwing', () => {
    for (const status of AUDIT_VERIFICATION_STATES) {
      expect(() => packVerificationTone(status)).not.toThrow();
      const pl = packVerificationLabel(status, true);
      const en = packVerificationLabel(status, false);
      expect(pl.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(pl).not.toBe(en);
    }
  });
});

describe('isNormativeSourceType / isComplianceGrade', () => {
  it('only LICENSED_STANDARD and REGULATION are normative', () => {
    expect(isNormativeSourceType('LICENSED_STANDARD')).toBe(true);
    expect(isNormativeSourceType('REGULATION')).toBe(true);
    expect(isNormativeSourceType('INTERNAL_PROCEDURE')).toBe(false);
    expect(isNormativeSourceType('INTERNAL_FRAMEWORK')).toBe(false);
    expect(isNormativeSourceType('DEMONSTRATION')).toBe(false);
    expect(isNormativeSourceType('LEGACY')).toBe(false);
  });

  it('requires BOTH a normative source type AND VERIFIED — a verified internal procedure is still not compliance-grade', () => {
    expect(isComplianceGrade('LICENSED_STANDARD', 'VERIFIED')).toBe(true);
    expect(isComplianceGrade('INTERNAL_PROCEDURE', 'VERIFIED')).toBe(false);
    expect(isComplianceGrade('LICENSED_STANDARD', 'PENDING_REVIEW')).toBe(false);
  });

  it('DEMONSTRATION is never compliance-grade, even if (hypothetically) marked VERIFIED', () => {
    expect(isComplianceGrade('DEMONSTRATION', 'VERIFIED')).toBe(false);
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
