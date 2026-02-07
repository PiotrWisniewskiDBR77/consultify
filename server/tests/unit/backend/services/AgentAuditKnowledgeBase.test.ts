/**
 * Agent Audit Knowledge Base Tests
 *
 * Tests for the static KB entries used by audit agents.
 */

import { describe, expect, it } from 'vitest';

import {
  getAgentKB,
  getAgentLimits,
  getAgentSeverityHints,
  getAgentTriggerQuestions,
  getAllKBEntries,
  getKBByType,
  searchKB,
} from '../../../../src/services/ai/agentAudit/agentKnowledgeBase.js';

describe('AgentAuditKnowledgeBase', () => {
  describe('getAgentKB', () => {
    it('should return KB entries for CFO agent', () => {
      const kb = getAgentKB('function.cfo_finance');
      expect(kb.length).toBeGreaterThan(0);
      expect(kb.every((e) => e.domain.startsWith('finance'))).toBe(true);
    });

    it('should return KB entries for IT Security agent', () => {
      const kb = getAgentKB('function.it_security');
      expect(kb.length).toBeGreaterThan(0);
      expect(kb.every((e) => e.domain.startsWith('it'))).toBe(true);
    });

    it('should return KB entries for Manufacturing agent', () => {
      const kb = getAgentKB('industry.manufacturing');
      expect(kb.length).toBeGreaterThan(0);
      expect(kb.every((e) => e.domain.startsWith('manufacturing'))).toBe(true);
    });

    it('should return KB entries for HR agent', () => {
      const kb = getAgentKB('function.hr');
      expect(kb.length).toBeGreaterThan(0);
      expect(kb.every((e) => e.domain.startsWith('hr'))).toBe(true);
    });

    it('should return KB entries for PM agent', () => {
      const kb = getAgentKB('function.pm_project_management');
      expect(kb.length).toBeGreaterThan(0);
      expect(kb.every((e) => e.domain.startsWith('pm'))).toBe(true);
    });

    it('should return KB entries for Adversarial agent', () => {
      const kb = getAgentKB('function.adversarial');
      expect(kb.length).toBeGreaterThan(0);
      expect(kb.every((e) => e.domain.startsWith('adversarial'))).toBe(true);
    });

    it('should return empty array for unknown agent', () => {
      const kb = getAgentKB('unknown.agent');
      expect(kb).toEqual([]);
    });
  });

  describe('getAllKBEntries', () => {
    it('should return all KB entries from all agents', () => {
      const all = getAllKBEntries();
      expect(all.length).toBeGreaterThan(10);
    });

    it('should include entries from multiple domains', () => {
      const all = getAllKBEntries();
      const domains = new Set(all.map((e) => e.domain.split('.')[0]));
      expect(domains.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('searchKB', () => {
    it('should find CAPEX-related entries', () => {
      const results = searchKB('CAPEX investment ROI');
      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((e) => e.domain.includes('capex') || e.content.toLowerCase().includes('capex'))
      ).toBe(true);
    });

    it('should find integration security entries', () => {
      const results = searchKB('API security authentication');
      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some(
          (e) => e.domain.includes('integration') || e.content.toLowerCase().includes('api')
        )
      ).toBe(true);
    });

    it('should find OEE-related entries', () => {
      const results = searchKB('OEE changeover manufacturing');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by agent ID', () => {
      const results = searchKB('risk', { agentId: 'function.cfo_finance' });
      expect(results.every((e) => e.domain.startsWith('finance'))).toBe(true);
    });

    it('should filter by entry type', () => {
      const results = searchKB('checklist', { types: ['checklist'] });
      expect(results.every((e) => e.type === 'checklist')).toBe(true);
    });

    it('should respect limit parameter', () => {
      const results = searchKB('risk management', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for non-matching query', () => {
      const results = searchKB('xyznonexistentterm123');
      expect(results.length).toBe(0);
    });
  });

  describe('getKBByType', () => {
    it('should return only checklists', () => {
      const checklists = getKBByType('checklist');
      expect(checklists.length).toBeGreaterThan(0);
      expect(checklists.every((e) => e.type === 'checklist')).toBe(true);
    });

    it('should return only failure patterns', () => {
      const failures = getKBByType('failure');
      expect(failures.length).toBeGreaterThan(0);
      expect(failures.every((e) => e.type === 'failure')).toBe(true);
    });

    it('should return only metrics', () => {
      const metrics = getKBByType('metric');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.every((e) => e.type === 'metric')).toBe(true);
    });

    it('should filter by agent when provided', () => {
      const cfoChecklists = getKBByType('checklist', 'function.cfo_finance');
      expect(cfoChecklists.every((e) => e.domain.startsWith('finance'))).toBe(true);
    });
  });

  describe('getAgentTriggerQuestions', () => {
    it('should return trigger questions for CFO agent', () => {
      const questions = getAgentTriggerQuestions('function.cfo_finance');
      expect(questions.length).toBeGreaterThan(0);
      expect(
        questions.some(
          (q) => q.toLowerCase().includes('roi') || q.toLowerCase().includes('cashflow')
        )
      ).toBe(true);
    });

    it('should return empty for unknown agent', () => {
      const questions = getAgentTriggerQuestions('unknown.agent');
      expect(questions).toEqual([]);
    });
  });

  describe('getAgentSeverityHints', () => {
    it('should return severity hints for CFO agent', () => {
      const hints = getAgentSeverityHints('function.cfo_finance');
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some((h) => h.includes('HIGH') || h.includes('MEDIUM'))).toBe(true);
    });
  });

  describe('getAgentLimits', () => {
    it('should return limits for CFO agent', () => {
      const limits = getAgentLimits('function.cfo_finance');
      expect(limits.length).toBeGreaterThan(0);
    });

    it('should return limits for IT Security agent', () => {
      const limits = getAgentLimits('function.it_security');
      expect(limits.length).toBeGreaterThan(0);
    });
  });

  describe('KB Entry Structure', () => {
    it('all entries should have required fields', () => {
      const all = getAllKBEntries();
      for (const entry of all) {
        expect(entry.id).toBeTruthy();
        expect(entry.type).toBeTruthy();
        expect(entry.domain).toBeTruthy();
        expect(entry.purpose).toBeTruthy();
        expect(entry.content).toBeTruthy();
        expect(Array.isArray(entry.triggerQuestions)).toBe(true);
        expect(Array.isArray(entry.limits)).toBe(true);
        expect(Array.isArray(entry.severityHints)).toBe(true);
      }
    });

    it('all entries should have valid types', () => {
      const all = getAllKBEntries();
      const validTypes = ['checklist', 'failure', 'metric', 'constraint', 'case', 'definition'];
      for (const entry of all) {
        expect(validTypes).toContain(entry.type);
      }
    });

    it('content should not exceed 6000 characters', () => {
      const all = getAllKBEntries();
      for (const entry of all) {
        expect(entry.content.length).toBeLessThanOrEqual(6000);
      }
    });

    it('trigger questions should not exceed 10 items', () => {
      const all = getAllKBEntries();
      for (const entry of all) {
        expect(entry.triggerQuestions.length).toBeLessThanOrEqual(10);
      }
    });
  });
});
