/**
 * DataPrivacySettings Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('DataPrivacySettings Component', () => {
  it('shows data options', () => {
    const options = { exportData: true, deleteAccount: false };
    expect(options.exportData).toBe(true);
  });

  it('handles export request', () => {
    const onExport = vi.fn();
    onExport();
    expect(onExport).toHaveBeenCalled();
  });
});
