import { describe, expect, it } from 'vitest';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';

describe('P11 — nazwy bez kodów technicznych', () => {
  it('agregat bez nazwy dostaje etykietę biznesową zamiast aco/scenario/UUID', () => {
    const label = resolveBusinessDisplayLabel({
      displayName: null,
      rawId: 'aco-plan-scenario-123456789',
      fallback: 'Plan bez nazwy · utworzony 06.09.2026',
    });
    expect(label).toBe('Plan bez nazwy · utworzony 06.09.2026');
    expect(label).not.toMatch(/aco-|scenario-\d|[0-9a-f]{8}-[0-9a-f-]{27}/i);
  });
});
