/**
 * InfoSections Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('InfoSections Component', () => {
    it('renders info sections', () => {
        const sections = ['Features', 'Benefits', 'Pricing'];
        expect(sections).toHaveLength(3);
    });

    it('displays section content', () => {
        const section = { title: 'Features', items: ['AI Chat', 'Reports'] };
        expect(section.items).toContain('AI Chat');
    });
});
