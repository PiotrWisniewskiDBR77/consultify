import { describe, expect, it } from 'vitest';

import {
  formatNextGateLabel,
  getNextGateForStatus,
  resolveNextGate,
} from '@/components/Initiatives/sections/types';

const t = (_key: string, fallback: string) => fallback;

describe('ST-3 next gate display', () => {
  it('maps the live backend gate code through the UI formatter', () => {
    const label = formatNextGateLabel(resolveNextGate('DRAFT', [{ gate: 'SUBMIT_FOR_REVIEW' }]), t);
    expect(label).toBe(formatNextGateLabel('SUBMIT_FOR_REVIEW', t));
    expect(label).not.toBe('SUBMIT_FOR_REVIEW');
  });

  it('derives the draft next gate from the canonical transition instead of hiding it', () => {
    expect(getNextGateForStatus('DRAFT')).toBe('SUBMIT_FOR_REVIEW');
  });
});
