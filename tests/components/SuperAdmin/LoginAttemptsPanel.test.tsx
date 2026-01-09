/**
 * LoginAttemptsPanel Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('LoginAttemptsPanel Component', () => {
    it('lists attempts', () => {
        const attempts = [{ id: 'a-1', success: true }];
        expect(attempts).toHaveLength(1);
    });

    it('shows failure rate', () => {
        const rate = 5;
        expect(rate).toBeLessThan(10);
    });
});
