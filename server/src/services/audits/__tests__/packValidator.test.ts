/**
 * packValidator.test — bramka publikacji Audit Packa (jednostkowy, bez bazy).
 *
 * Pokrywa dokładnie przypadki wymagane w zadaniu U2 (patrz komentarze przy
 * poszczególnych `it`), plus kilka dodatkowych krawędzi wymienionych w
 * dokumentacji funkcji (`assertPublishable`, `eligibleClassifications`,
 * struktura kryteriów).
 */

import { describe, expect, it } from 'vitest';

import { assertPublishable, validatePack } from '../packValidator.js';
import type { ValidatePackInput } from '../packValidator.js';
import type { AuditNormSource, AuditPack, AuditPackCriterion, FindingTaxonomyEntry } from '../types.js';

function basePack(overrides: Partial<AuditPack> = {}): Partial<AuditPack> {
  return {
    packKey: 'demo-pack',
    title: 'Audyt procesu — pakiet demonstracyjny',
    version: 1,
    classification: 'DEMONSTRATION',
    scope: 'Zakres testowy',
    objectives: 'Cele testowe',
    requiredRoles: ['lead_auditor'],
    findingTaxonomy: baseTaxonomy(),
    expertApprovedBy: 'user-1',
    expertApprovedAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseTaxonomy(): FindingTaxonomyEntry[] {
  return [
    { key: 'conforming', label: 'Zgodne', nonConforming: false, requiresCorrectiveAction: false },
    { key: 'nonconforming', label: 'Niezgodne', nonConforming: true, requiresCorrectiveAction: true },
  ];
}

function leafCriterion(overrides: Partial<AuditPackCriterion> = {}): Partial<AuditPackCriterion> {
  return {
    id: 'c1',
    title: 'Kryterium testowe',
    nodeKind: 'criterion',
    requirementText: 'Wymaganie testowe',
    auditQuestion: 'Pytanie testowe?',
    auditProcedure: 'Procedura testowa',
    sourceReference: 'Procedura demonstracyjna Consultify, pkt 1',
    expectedEvidence: [{ kind: 'document', description: 'Dokument testowy' }],
    ...overrides,
  };
}

function verifiedSource(overrides: Partial<AuditNormSource> = {}): AuditNormSource {
  return {
    id: 'src-1',
    organizationId: 'org-1',
    sourceKey: 'iso-demo',
    title: 'Źródło testowe',
    publisher: 'Wydawca testowy',
    sourceVersion: '2018',
    sourceKind: 'normative_standard',
    rightsStatus: 'licensed',
    rightsNote: null,
    licenseReference: null,
    sourceUri: null,
    materialId: null,
    materialVersion: null,
    effectiveFrom: null,
    effectiveTo: null,
    sourceType: 'LICENSED_STANDARD',
    verificationStatus: 'VERIFIED',
    verifiedBy: 'expert-1',
    verifiedAt: new Date().toISOString(),
    verificationNote: null,
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('packValidator', () => {
  it('1. pakiet bez źródła nie może być VERIFIED_NORMATIVE', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED' }),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'published',
    };
    const result = validatePack(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SOURCE_MISSING')).toBe(true);
  });

  it('2. źródło z rights_status="not_verified" blokuje publikację normatywną', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED', sourceId: 'src-1' }),
      criteria: [leafCriterion()],
      source: verifiedSource({ rightsStatus: 'not_verified' }),
      targetPublicationStatus: 'published',
    };
    const result = validatePack(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SOURCE_RIGHTS_UNVERIFIED')).toBe(true);
  });

  it('3. brak wersji źródła blokuje publikację normatywną', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED', sourceId: 'src-1' }),
      criteria: [leafCriterion()],
      source: verifiedSource({ sourceVersion: null }),
      targetPublicationStatus: 'published',
    };
    const result = validatePack(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SOURCE_VERSION_MISSING')).toBe(true);
  });

  it('4. brak expert_approved blokuje publikację (nawet dla pakietu niereferencyjnego)', () => {
    const input: ValidatePackInput = {
      pack: basePack({ expertApprovedBy: null, expertApprovedAt: null }),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'published',
    };
    const result = validatePack(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'PACK_EXPERT_APPROVAL_MISSING')).toBe(true);
  });

  it('5. taksonomia bez pozycji nonConforming jest błędem', () => {
    const input: ValidatePackInput = {
      pack: basePack({
        findingTaxonomy: [
          { key: 'conforming', label: 'Zgodne', nonConforming: false, requiresCorrectiveAction: false },
        ],
      }),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'TAXONOMY_NO_NONCONFORMING')).toBe(true);
  });

  it('6. kryterium-liść bez requirement_text jest błędem', () => {
    const input: ValidatePackInput = {
      pack: basePack(),
      criteria: [leafCriterion({ requirementText: null })],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'CRITERION_REQUIREMENT_MISSING')).toBe(true);
  });

  it('7. tytuł "Audyt ISO 27001" przy klasyfikacji DEMONSTRATION jest błędem', () => {
    const input: ValidatePackInput = {
      pack: basePack({ title: 'Audyt ISO 27001', classification: 'DEMONSTRATION' }),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'PACK_TITLE_IMPLIES_NORMATIVE')).toBe(true);
  });

  it('8. tytuł "Audyt ISO 27001 — wersja demonstracyjna" przechodzi (nie zgłasza PACK_TITLE_IMPLIES_NORMATIVE)', () => {
    const input: ValidatePackInput = {
      pack: basePack({ title: 'Audyt ISO 27001 — wersja demonstracyjna', classification: 'DEMONSTRATION' }),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'PACK_TITLE_IMPLIES_NORMATIVE')).toBe(false);
  });

  it('9. eligibleClassifications nie zawiera VERIFIED_NORMATIVE gdy brak źródła', () => {
    const input: ValidatePackInput = {
      pack: basePack(),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.eligibleClassifications).not.toContain('VERIFIED_NORMATIVE');
  });

  it('10. eligibleClassifications zawiera VERIFIED_NORMATIVE gdy źródło i ekspert w komplecie', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED', sourceId: 'src-1' }),
      criteria: [leafCriterion()],
      source: verifiedSource(),
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.eligibleClassifications).toContain('VERIFIED_NORMATIVE');
  });

  it('11. pełny normatywny pakiet z zatwierdzeniem eksperckim jest publikowalny (assertPublishable nie rzuca)', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED', sourceId: 'src-1', sourceVersion: '2018' }),
      criteria: [leafCriterion()],
      source: verifiedSource(),
    };
    expect(() => assertPublishable(input)).not.toThrow();
  });

  it('12. assertPublishable rzuca z listą powodów, gdy pakiet nie jest gotowy', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED' }),
      criteria: [leafCriterion()],
      source: null,
    };
    expect(() => assertPublishable(input)).toThrowError(/SOURCE_MISSING/);
  });

  it('13. pakiet bez żadnego kryterium jest błędem strukturalnym (CRITERIA_EMPTY)', () => {
    const input: ValidatePackInput = {
      pack: basePack(),
      criteria: [],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'CRITERIA_EMPTY')).toBe(true);
  });

  it('14. błąd strukturalny (brak kryteriów) wyklucza INTERNAL_FRAMEWORK z eligibleClassifications', () => {
    const input: ValidatePackInput = {
      pack: basePack(),
      criteria: [],
      source: null,
      targetPublicationStatus: 'draft',
    };
    const result = validatePack(input);
    expect(result.eligibleClassifications).not.toContain('INTERNAL_FRAMEWORK');
    expect(result.eligibleClassifications).toContain('DEMONSTRATION');
  });

  it('15. źródło typu „checklist" nie uzasadnia audytu zgodności — pyta o TYP, nie o zaufanie (SOURCE_TYPE_NOT_NORMATIVE)', () => {
    const input: ValidatePackInput = {
      pack: basePack({ classification: 'VERIFIED_NORMATIVE', sourceType: 'LICENSED_STANDARD', verificationStatus: 'VERIFIED', sourceId: 'src-1' }),
      criteria: [leafCriterion()],
      source: verifiedSource({ sourceKind: 'checklist', sourceType: 'INTERNAL_FRAMEWORK' }),
      targetPublicationStatus: 'published',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'SOURCE_TYPE_NOT_NORMATIVE')).toBe(true);
  });

  it('16. brak zakresu/celów blokuje publikację niezależnie od klasyfikacji', () => {
    const input: ValidatePackInput = {
      pack: basePack({ scope: null, objectives: null }),
      criteria: [leafCriterion()],
      source: null,
      targetPublicationStatus: 'published',
    };
    const result = validatePack(input);
    expect(result.errors.some((e) => e.code === 'PACK_SCOPE_MISSING')).toBe(true);
    expect(result.errors.some((e) => e.code === 'PACK_OBJECTIVES_MISSING')).toBe(true);
  });
});
