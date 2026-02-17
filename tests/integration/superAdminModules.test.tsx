/**
 * L1: SuperAdmin section surface (honest)
 *
 * Ensures the sidebar mapping exposes all supported sections.
 */

import { describe, expect, it } from 'vitest';

import { sectionToAppView } from '../../src/components/layout/SuperAdminSidebar';

describe('SuperAdmin sections', () => {
  it('exposes expected sections', () => {
    const keys = Object.keys(sectionToAppView).sort();
    expect(keys).toEqual(
      [
        'ai-development',
        'ai-infrastructure',
        'ai-operations',
        'ai-platform',
        'analytics',
        'configuration',
        'content',
        'customers',
        'overview',
        'revenue',
        'security',
        'system',
      ].sort()
    );
  });
});
