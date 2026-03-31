/**
 * P07 notebook canon — contract tests against real canon + handoff + search services.
 */
import { describe, expect, it } from 'vitest';

import {
  P07_ACCEPTANCE_CHECKLIST,
  P07_ANTI_DUPLICATE_RULES,
  P07_ATTACHMENT_ERROR_TAXONOMY,
  P07_ATTACHMENT_LIFECYCLE_STATES,
  P07_CAPTURE_ENTRIES,
  P07_DEGRADED_SCENARIOS,
  P07_HANDOFF_COMMON_FIELDS,
  P07_HANDOFF_TARGETS,
  P07_PROVENANCE_LANGUAGE,
  P07_PROVENANCE_RULES,
  P07_SEARCH_BASELINE,
} from '../../server/src/services/v8/notebookCanon.js';
import { validateHandoffPayload } from '../../server/src/services/v8/notebookHandoffService.js';
import { parseOperatorHints } from '../../server/src/services/v8/notebookSearchService.js';

describe('P07 notebook canon contract', () => {
  describe('Canon structure', () => {
    it('P07_CAPTURE_ENTRIES.create has 11 entries', () => {
      expect(P07_CAPTURE_ENTRIES.create).toHaveLength(11);
    });

    it('P07_CAPTURE_ENTRIES.open has 4 entries', () => {
      expect(P07_CAPTURE_ENTRIES.open).toHaveLength(4);
    });

    it('P07_CAPTURE_ENTRIES.forbidden has 2 entries', () => {
      expect(P07_CAPTURE_ENTRIES.forbidden).toHaveLength(2);
    });

    it('P07_PROVENANCE_LANGUAGE has exactly 3 entries: source, user_edit, ai_transform', () => {
      expect(P07_PROVENANCE_LANGUAGE).toHaveLength(3);
      expect([...P07_PROVENANCE_LANGUAGE].sort()).toEqual(
        ['ai_transform', 'source', 'user_edit'].sort()
      );
    });

    it('P07_PROVENANCE_RULES has no_silent_overwrite=true, no_silent_delete=true', () => {
      expect(P07_PROVENANCE_RULES.no_silent_overwrite).toBe(true);
      expect(P07_PROVENANCE_RULES.no_silent_delete).toBe(true);
    });

    it('P07_ATTACHMENT_LIFECYCLE_STATES has 6 states', () => {
      expect(P07_ATTACHMENT_LIFECYCLE_STATES).toHaveLength(6);
    });

    it('P07_ATTACHMENT_ERROR_TAXONOMY has 9 error types', () => {
      expect(Object.keys(P07_ATTACHMENT_ERROR_TAXONOMY)).toHaveLength(9);
    });

    it('P07_SEARCH_BASELINE has 14 declared filters, 7 operator hints, 10 result fields', () => {
      expect(P07_SEARCH_BASELINE.declaredFilters).toHaveLength(14);
      expect(P07_SEARCH_BASELINE.operatorHints).toHaveLength(7);
      expect(P07_SEARCH_BASELINE.resultContract).toHaveLength(10);
    });

    it('P07_HANDOFF_COMMON_FIELDS has 18 fields', () => {
      expect(P07_HANDOFF_COMMON_FIELDS).toHaveLength(18);
    });

    it('P07_HANDOFF_TARGETS has radar, inicjatywy, teresa', () => {
      expect(P07_HANDOFF_TARGETS).toHaveProperty('radar');
      expect(P07_HANDOFF_TARGETS).toHaveProperty('inicjatywy');
      expect(P07_HANDOFF_TARGETS).toHaveProperty('teresa');
    });

    it('P07_ANTI_DUPLICATE_RULES has 4 rules', () => {
      expect(Object.keys(P07_ANTI_DUPLICATE_RULES)).toHaveLength(4);
    });

    it('P07_DEGRADED_SCENARIOS has 10 scenarios', () => {
      expect(P07_DEGRADED_SCENARIOS).toHaveLength(10);
    });

    it('P07_ACCEPTANCE_CHECKLIST has 11 items', () => {
      expect(P07_ACCEPTANCE_CHECKLIST).toHaveLength(11);
    });
  });

  describe('Handoff validation', () => {
    it("validateHandoffPayload('radar', {}) → valid=false, missingFields includes radar_signal_suggestion", () => {
      const r = validateHandoffPayload('radar', {});
      expect(r.valid).toBe(false);
      expect(r.missingFields).toContain('radar_signal_suggestion');
    });

    it("validateHandoffPayload('inicjatywy', {}) → valid=false", () => {
      const r = validateHandoffPayload('inicjatywy', {});
      expect(r.valid).toBe(false);
      expect(r.missingFields.some((f) => f === 'initiative_seed' || f.startsWith('initiative_seed.'))).toBe(
        true
      );
    });

    it("validateHandoffPayload('teresa', {}) → valid=false", () => {
      const r = validateHandoffPayload('teresa', {});
      expect(r.valid).toBe(false);
      expect(
        r.missingFields.some((f) => f === 'assistant_context' || f.startsWith('assistant_context.'))
      ).toBe(true);
    });
  });

  describe('Search operator hints', () => {
    it("parseOperatorHints('tag:important hello world') → cleanQuery + tags", () => {
      const { cleanQuery, extractedFilters } = parseOperatorHints('tag:important hello world');
      expect(cleanQuery).toBe('hello world');
      expect(extractedFilters.tags).toBeDefined();
      expect(extractedFilters.tags!.includes('important')).toBe(true);
    });

    it("parseOperatorHints('status:active type:meeting') → status + type", () => {
      const { extractedFilters } = parseOperatorHints('status:active type:meeting');
      expect(extractedFilters.status).toBe('active');
      expect(extractedFilters.type).toBe('meeting');
    });

    it("parseOperatorHints('has:attachment query text') → has_attachments + cleanQuery", () => {
      const { cleanQuery, extractedFilters } = parseOperatorHints('has:attachment query text');
      expect(extractedFilters.has_attachments).toBe(true);
      expect(cleanQuery).toBe('query text');
    });
  });

  describe('Error taxonomy', () => {
    it('retryable vs non-retryable classification', () => {
      const retryable = new Set(
        Object.entries(P07_ATTACHMENT_ERROR_TAXONOMY)
          .filter(([, v]) => v.retryable)
          .map(([k]) => k)
      );
      const nonRetryable = new Set(
        Object.entries(P07_ATTACHMENT_ERROR_TAXONOMY)
          .filter(([, v]) => !v.retryable)
          .map(([k]) => k)
      );

      expect(retryable.has('network_timeout')).toBe(true);
      expect(retryable.has('storage_unavailable')).toBe(true);
      expect(retryable.has('processing_failed')).toBe(true);
      expect(retryable.has('unknown')).toBe(true);

      expect(nonRetryable.has('size_limit')).toBe(true);
      expect(nonRetryable.has('quota_exceeded')).toBe(true);
      expect(nonRetryable.has('type_unsupported')).toBe(true);
      expect(nonRetryable.has('permission_denied')).toBe(true);
      expect(nonRetryable.has('virus_detected')).toBe(true);
    });
  });
});
