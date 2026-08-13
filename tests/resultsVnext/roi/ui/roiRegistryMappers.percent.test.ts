import { describe, expect, it } from 'vitest';
import {
  formatRoiPercent,
  formatRoiRatioPercent,
} from '../../../../src/components/ResultsVNext/roi/roiRegistryMappers';

describe('ROI percentage formatting', () => {
  it('formats percentage-point fields without rescaling', () => {
    expect(formatRoiPercent(31.4, false)).toBe('31.4%');
  });

  it('formats decimal ROI ratios as business percentages', () => {
    expect(formatRoiRatioPercent(0.9535, false)).toBe('95.4%');
    expect(formatRoiRatioPercent(-0.25, false)).toBe('-25%');
  });
});
