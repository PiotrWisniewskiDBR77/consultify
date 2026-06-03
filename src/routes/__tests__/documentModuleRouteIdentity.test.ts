/**
 * Document module — route identity (Module 10 hardening).
 *
 * Pins the resolution of the route-identity split between the legacy
 * `/wordy` (KimiWorkspace report-builder) surface and the canonical
 * `/document-studio` (Document Studio) surface:
 *
 *   - The canonical Document module is `/document-studio`.
 *   - The legacy WORDY view resolves to the canonical Document Studio
 *     route (mirrors the `/excele` -> `/tabele` consolidation), so the
 *     "Documents" sidebar entry navigates straight to Document Studio.
 *   - Both `/document-studio` and `/document-studio/:artifactId` map back
 *     to the WORDY view so the sidebar entry highlights on the canonical
 *     route.
 *
 * Keeping this as a unit test means any regression in the consolidation
 * (e.g. someone repointing WORDY back at the deprecated `/wordy`
 * blocking page) surfaces here instead of silently breaking navigation.
 */

import { describe, expect, it } from 'vitest';

import { AppView } from '../../types';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

describe('Document module route identity', () => {
  it('exposes the canonical Document Studio route constant', () => {
    expect(ROUTES.DOCUMENT_STUDIO).toBe('/document-studio');
  });

  it('resolves the WORDY view to the canonical Document Studio route', () => {
    expect(getRouteFromAppView(AppView.WORDY)).toBe(ROUTES.DOCUMENT_STUDIO);
  });

  it('maps /document-studio back to the WORDY (Documents) view', () => {
    expect(getAppViewFromPath('/document-studio')).toBe(AppView.WORDY);
  });

  it('maps a deep-linked /document-studio/:artifactId back to the WORDY view', () => {
    expect(getAppViewFromPath('/document-studio/art-123')).toBe(AppView.WORDY);
  });

  it('still resolves the legacy /wordy alias to the WORDY view', () => {
    expect(getAppViewFromPath('/wordy')).toBe(AppView.WORDY);
  });
});
