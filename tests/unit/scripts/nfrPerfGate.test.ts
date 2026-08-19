import { describe, expect, it } from 'vitest';

import { evaluateWorkloadGate, jsonPointer, renderTemplate, validateProfile, validateWebVitals } from '../../../scripts/performance/nfrPerfGate.js';

const sha = 'a'.repeat(40);

describe('NFR-PERF-001 authority and positive controls', () => {
  it('accepts only the exact five-module manifest and resolves response identities', () => {
    const operation = (name: any) => ({ name, read: { method: 'GET', path: '/r', expectedStatus: 200 }, write: { method: 'POST', path: '/w', expectedStatus: 201, idJsonPointer: '/data/id', expectedReplayStatuses: [200, 201], reconcile: { method: 'GET', path: '/w/{{ID}}', expectedStatus: 200, idJsonPointer: '/data/id' } }, crossTenantRead: { method: 'GET', path: '/r', expectedStatus: 200 } });
    expect(() => validateProfile({ schemaVersion: 1, productSha: sha, baseUrl: 'http://127.0.0.1:3001', shaProbe: { method: 'GET', path: '/health', expectedStatus: 200, shaHeader: 'x-product-sha' }, modules: ['case', 'my-work', 'settings', 'initiative', 'finance'].map(operation) })).not.toThrow();
    expect(jsonPointer({ data: { id: 'w-1' } }, '/data/id')).toBe('w-1');
    expect(renderTemplate({ path: '/w/{{ID}}' }, { ID: 'w-1' })).toEqual({ path: '/w/w-1' });
  });

  it('fails readiness before load when a profile template variable is missing', () => {
    const operation = (name: any) => ({ name, read: { method: 'GET', path: '/r/{{MISSING_TARGET}}', expectedStatus: 200 }, write: { method: 'POST', path: '/w', expectedStatus: 201, idJsonPointer: '/data/id', reconcile: { method: 'GET', path: '/w/{{ID}}', expectedStatus: 200, idJsonPointer: '/data/id' } }, crossTenantRead: { method: 'GET', path: '/r', expectedStatus: 200 } });
    expect(() => validateProfile({ schemaVersion: 1, productSha: sha, baseUrl: 'http://127.0.0.1:3001', shaProbe: { method: 'GET', path: '/health', expectedStatus: 200, shaHeader: 'x-product-sha' }, modules: ['case', 'my-work', 'settings', 'initiative', 'finance'].map(operation) })).toThrow('profile template variables missing: MISSING_TARGET');
  });

  it('detects every workload breach and the exact 1 percent boundary', () => {
    const breach = evaluateWorkloadGate({ readsMs: [1600], writesMs: [2600], requests: 100, errors: 1, writeLoss: 1, writeDuplicate: 1, tenantFalseSuccess: 1 });
    expect(breach.pass).toBe(false);
    expect(breach.failures).toEqual(['read_p95', 'write_p95', 'error_rate', 'write_loss', 'write_duplicate', 'tenant_false_success']);
    expect(evaluateWorkloadGate({ readsMs: [1500], writesMs: [2500], requests: 101, errors: 1, writeLoss: 0, writeDuplicate: 0, tenantFalseSuccess: 0 }).pass).toBe(true);
  });

  it('evaluates cold desktop/mobile p75 and rejects mixed SHA', () => {
    const sample = (device: 'desktop' | 'mobile', LCP: number) => ({ productSha: sha, device, cold: true as const, LCP, CLS: 0.05, INP: 100 });
    expect(validateWebVitals([sample('desktop', 2400), sample('mobile', 3900)], sha).pass).toBe(true);
    expect(validateWebVitals([{ ...sample('desktop', 2400), productSha: 'b'.repeat(40) }, sample('mobile', 3900)], sha).failures).toContain('mixed_product_sha');
  });
});
