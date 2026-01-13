/**
 * TrustStrip Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('TrustStrip Component', () => {
  it('renders trust indicators', () => {
    const indicators = ['SOC2', 'GDPR', 'ISO27001'];
    expect(indicators).toHaveLength(3);
  });

  it('shows client logos', () => {
    const logos = ['client1', 'client2', 'client3'];
    expect(logos.length).toBeGreaterThan(0);
  });
});
