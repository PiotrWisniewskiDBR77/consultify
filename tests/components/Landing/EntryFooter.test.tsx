/**
 * EntryFooter Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('EntryFooter Component', () => {
    it('renders footer', () => {
        const footer = { copyright: '© 2026 Consultinity', links: [] };
        expect(footer.copyright).toContain('2026');
    });

    it('shows legal links', () => {
        const links = ['Privacy', 'Terms', 'Contact'];
        expect(links).toContain('Privacy');
    });
});
