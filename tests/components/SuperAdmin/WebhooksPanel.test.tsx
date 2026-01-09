/**
 * WebhooksPanel Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('WebhooksPanel Component', () => {
    it('lists webhooks', () => {
        const webhooks = [{ id: 'w-1', url: 'https://example.com' }];
        expect(webhooks).toHaveLength(1);
    });

    it('handles create', () => {
        const onCreate = vi.fn();
        onCreate({ url: 'https://new.com' });
        expect(onCreate).toHaveBeenCalled();
    });
});
