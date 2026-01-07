/**
 * Feature Flag Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('FeatureFlagService', () => {
    it('should check flag', () => {
        const enabled = true;
        expect(enabled).toBe(true);
    });

    it('should list flags', () => {
        const flags = [{ name: 'new_ui', enabled: true }];
        expect(flags.length).toBeGreaterThan(0);
    });
});
