/**
 * P0 — dwie niezależne osie klasyfikacji źródła.
 *
 * Pierwsza wersja modelu miała jedno pole, które odpowiadało naraz na dwa
 * pytania: czym jest źródło i czy je sprawdzono. Skutek był widoczny na
 * zrzucie odbiorczym — procedura QMS klienta, zweryfikowana przez eksperta,
 * renderowała się jako „Zweryfikowana norma".
 *
 * Te testy pilnują, żeby to się nie wróciło. Każdy z nich odpowiada jednemu
 * punktowi z listy koordynatora.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditRun } from '../auditsDb.js';
import { createSource, updateSource, verifySource } from '../normSourceService.js';
import { validatePack } from '../packValidator.js';
import {
  isComplianceGrade,
  isNormativeSourceType,
  NORMATIVE_SOURCE_TYPES,
  type AuditActor,
  type AuditNormSource,
} from '../types.js';

const ORG = `axes-org-${Date.now()}`;
const actor: AuditActor = { organizationId: ORG, userId: 'axes-user', platformRole: 'admin' };

const taxonomy = [
  { key: 'conforming', label: 'Zgodne', nonConforming: false, requiresCorrectiveAction: false },
  { key: 'nonconforming', label: 'Niezgodne', nonConforming: true, requiresCorrectiveAction: true },
];

const criteria = [
  {
    id: 'c1',
    nodeKind: 'criterion' as const,
    title: 'Kryterium',
    requirementText: 'Wymaganie własnymi słowami',
    auditQuestion: 'Czy wymaganie jest spełnione?',
    auditProcedure: 'Sprawdź próbę 10 rekordów',
    sourceReference: 'Procedura, pkt 2.1',
    expectedEvidence: [{ kind: 'document' as const, description: 'Rejestr' }],
  },
];

function sourceOf(overrides: Partial<AuditNormSource>): AuditNormSource {
  return {
    id: 'src-1',
    organizationId: ORG,
    sourceKey: 'k',
    title: 'Źródło',
    publisher: 'Wydawca',
    sourceVersion: '2026',
    sourceKind: 'internal_procedure',
    sourceType: 'INTERNAL_PROCEDURE',
    verificationStatus: 'VERIFIED',
    rightsStatus: 'owned_internal',
    rightsNote: null,
    licenseReference: null,
    sourceUri: null,
    materialId: null,
    materialVersion: null,
    effectiveFrom: null,
    effectiveTo: null,
    legacyClassification: null,
    verifiedBy: 'ekspert',
    verifiedAt: '2026-08-13T00:00:00Z',
    verificationNote: null,
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  await auditRun(`DELETE FROM audit_norm_sources WHERE organization_id = $1`, [ORG]);
}

beforeAll(cleanup, 30_000);
afterAll(cleanup, 30_000);

describe('P0 — typ źródła jest niezależny od statusu weryfikacji', () => {
  it('zweryfikowana procedura wewnętrzna NIE kwalifikuje się jako norma', () => {
    const source = sourceOf({ sourceType: 'INTERNAL_PROCEDURE', verificationStatus: 'VERIFIED' });

    expect(isNormativeSourceType(source.sourceType)).toBe(false);
    expect(isComplianceGrade(source.sourceType, source.verificationStatus)).toBe(false);

    const result = validatePack({
      pack: {
        packKey: 'p',
        title: 'Audyt procesu',
        version: 1,
        sourceType: 'LICENSED_STANDARD', // pakiet PRÓBUJE udawać normę
        verificationStatus: 'VERIFIED',
        scope: 'z',
        objectives: 'o',
        requiredRoles: ['lead_auditor'],
        findingTaxonomy: taxonomy,
        expertApprovedBy: 'u',
        expertApprovedAt: '2026-08-13T00:00:00Z',
      },
      criteria,
      source,
      targetPublicationStatus: 'published',
    });

    expect(result.valid).toBe(false);
    // Pakiet deklaruje inny typ niż jego źródło — etykieta w Library kłamałaby.
    expect(result.errors.map((e) => e.code)).toContain('PACK_SOURCE_TYPE_MISMATCH');
  });

  it('norma czekająca na przegląd POZOSTAJE normą, ale nie przechodzi bramki zgodności', () => {
    const source = sourceOf({
      sourceType: 'LICENSED_STANDARD',
      verificationStatus: 'PENDING_REVIEW',
      sourceKind: 'normative_standard',
      rightsStatus: 'licensed',
    });

    // Oś typu: nadal norma.
    expect(isNormativeSourceType(source.sourceType)).toBe(true);
    // Oś weryfikacji: jeszcze nie wolno na niej oprzeć audytu zgodności.
    expect(isComplianceGrade(source.sourceType, source.verificationStatus)).toBe(false);

    const result = validatePack({
      pack: {
        packKey: 'p',
        title: 'Audyt zgodności',
        version: 1,
        sourceType: 'LICENSED_STANDARD',
        verificationStatus: 'PENDING_REVIEW',
        scope: 'z',
        objectives: 'o',
        requiredRoles: ['lead_auditor'],
        findingTaxonomy: taxonomy,
        expertApprovedBy: 'u',
        expertApprovedAt: '2026-08-13T00:00:00Z',
      },
      criteria,
      source,
      targetPublicationStatus: 'published',
    });

    expect(result.errors.map((e) => e.code)).toContain('SOURCE_NOT_VERIFIED');
  });

  it('demonstracja nie kwalifikuje się jako audyt zgodności, nawet zweryfikowana', () => {
    expect(isComplianceGrade('DEMONSTRATION', 'VERIFIED')).toBe(false);
    expect(isNormativeSourceType('DEMONSTRATION')).toBe(false);
  });

  it('materiał historyczny nie kwalifikuje się jako aktualna podstawa audytu', () => {
    expect(isComplianceGrade('LEGACY', 'VERIFIED')).toBe(false);
    expect(NORMATIVE_SOURCE_TYPES).not.toContain('LEGACY');
  });

  it('pakiet bez źródła nie może zostać opublikowany jako normatywny', () => {
    const result = validatePack({
      pack: {
        packKey: 'p',
        title: 'Audyt',
        version: 1,
        sourceType: 'LICENSED_STANDARD',
        verificationStatus: 'VERIFIED',
        scope: 'z',
        objectives: 'o',
        requiredRoles: ['lead_auditor'],
        findingTaxonomy: taxonomy,
        expertApprovedBy: 'u',
        expertApprovedAt: '2026-08-13T00:00:00Z',
      },
      criteria,
      source: null,
      targetPublicationStatus: 'published',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('SOURCE_MISSING');
  });

  it('tytuł sugerujący normę jest błędem, gdy typ źródła nie jest normatywny', () => {
    const result = validatePack({
      pack: {
        packKey: 'p',
        title: 'Audyt zgodności ISO 9001',
        version: 1,
        sourceType: 'INTERNAL_PROCEDURE',
        verificationStatus: 'VERIFIED',
        findingTaxonomy: taxonomy,
      },
      criteria,
    });

    expect(result.errors.map((e) => e.code)).toContain('PACK_TITLE_IMPLIES_NORMATIVE');
  });
});

describe('P0 — weryfikacja nie przepisuje typu źródła (żywa baza)', () => {
  it('cztery kolejne zmiany statusu weryfikacji zostawiają typ nietknięty', async () => {
    const created = await createSource(actor, {
      sourceKey: `proc-${Date.now()}`,
      title: 'Procedura QMS klienta',
      publisher: 'Elmax Industries',
      sourceVersion: 'wyd. 4',
      sourceKind: 'internal_procedure',
      sourceType: 'INTERNAL_PROCEDURE',
      rightsStatus: 'owned_internal',
    });

    expect(created.sourceType).toBe('INTERNAL_PROCEDURE');

    for (const state of ['PENDING_REVIEW', 'VERIFIED', 'UNVERIFIED', 'EVIDENCE_MISSING'] as const) {
      const updated = await verifySource(actor, created.id, {
        verificationStatus: state,
        note: `przejście do ${state}`,
      });
      expect(updated.verificationStatus).toBe(state);
      // Sedno testu: typ źródła nie drgnął.
      expect(updated.sourceType).toBe('INTERNAL_PROCEDURE');
      expect(isNormativeSourceType(updated.sourceType)).toBe(false);
    }
  }, 60_000);

  it('zmiana typu źródła jest osobną, jawną decyzją', async () => {
    const created = await createSource(actor, {
      sourceKey: `norm-${Date.now()}`,
      title: 'Norma branżowa',
      publisher: 'Wydawca',
      sourceVersion: '2022',
      sourceKind: 'normative_standard',
      sourceType: 'LICENSED_STANDARD',
      rightsStatus: 'licensed',
    });

    const changed = await updateSource(actor, created.id, { sourceType: 'LEGACY' });
    expect(changed.sourceType).toBe('LEGACY');
    // Zmiana typu nie „zeruje" weryfikacji ani jej nie awansuje.
    expect(changed.verificationStatus).toBe(created.verificationStatus);
  }, 60_000);
});
