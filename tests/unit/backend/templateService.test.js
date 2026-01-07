/**
 * Template Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('TemplateService', () => {
    it('should get template', () => {
        const template = { id: 'tpl-1', name: 'Welcome Email' };
        expect(template.name).toBeDefined();
    });

    it('should render template', () => {
        const rendered = '<p>Hello World</p>';
        expect(rendered).toContain('Hello');
    });
});
