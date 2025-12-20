
import { describe, it, expect, beforeEach } from 'vitest';

describe('PMOStandardsMapping', () => {
    let PMOStandardsMapping;
    let PMODomainRegistry;

    beforeEach(async () => {
        vi.resetModules();
        PMOStandardsMapping = (await import('../../../server/services/pmoStandardsMapping.js')).default;
        PMODomainRegistry = (await import('../../../server/services/pmoDomainRegistry.js')).default;
    });

    describe('getMapping', () => {
        it('should return mapping for known concept', () => {
            const mapping = PMOStandardsMapping.getMapping('Decision');
            expect(mapping).toBeDefined();
            expect(mapping.scmsTerm).toBe('Decision');
            expect(mapping.domainId).toBe(PMODomainRegistry.PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING);
        });

        it('should return null for unknown concept', () => {
            expect(PMOStandardsMapping.getMapping('Unknown')).toBeNull();
        });
    });

    describe('getStandardTerm', () => {
        it('should return ISO 21500 term correctly', () => {
            const term = PMOStandardsMapping.getStandardTerm('Initiative', 'iso21500');
            expect(term).toBeDefined();
            expect(term.term).toBe('Work Package');
        });

        it('should return PMBOK 7 term correctly', () => {
            const term = PMOStandardsMapping.getStandardTerm('StageGate', 'pmbok7');
            expect(term).toBeDefined();
            expect(term.term).toContain('Gate');
        });
    });

    describe('isNeutralTerm', () => {
        it('should identify neutral terms', () => {
            expect(PMOStandardsMapping.isNeutralTerm('Project Phase')).toBe(true);
        });

        it('should identify vendor-specific terms as non-neutral', () => {
            expect(PMOStandardsMapping.isNeutralTerm('Sprint Planning')).toBe(false);
        });
    });

    describe('getConceptsByDomain', () => {
        it('should return all concepts for a given domain', () => {
            const concepts = PMOStandardsMapping.getConceptsByDomain(PMODomainRegistry.PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL);
            expect(concepts.length).toBeGreaterThan(0);
        });
    });
});
