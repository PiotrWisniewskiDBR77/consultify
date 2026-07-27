/**
 * FAZA B3 (2026-07-27) — Document Studio / Prezentacje / Excel breadcrumb.
 *
 * Pins the contract each of the 3 Materiały studio routes now hands
 * `MainLayout`: 3 segments, starting with the Materiały hub itself, second
 * segment pointing at the matching hub tab (`outputsLibraryTabQuery.ts`),
 * last segment the current (non-clickable) state. Regression guard for the
 * reported bug where the studio breadcrumb duplicated its own label
 * ("Document Studio › Document Studio") with zero path back to Materiały.
 */
import { describe, expect, it } from 'vitest';

import { buildMaterialsStudioBreadcrumb } from '../materialsStudioBreadcrumb';
import { ROUTES } from '../routeConfig';

describe('buildMaterialsStudioBreadcrumb', () => {
  it('produces exactly 3 segments starting with the Materiały hub', () => {
    const result = buildMaterialsStudioBreadcrumb(
      'Materiały',
      'Dokumenty',
      'documents',
      'Nowy dokument'
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ label: 'Materiały', to: ROUTES.PRESENTATIONS });
  });

  it('points segment 2 at the matching hub tab via `?tab=`', () => {
    const documents = buildMaterialsStudioBreadcrumb('Materiały', 'Dokumenty', 'documents', 'x');
    const presentations = buildMaterialsStudioBreadcrumb(
      'Materiały',
      'Prezentacje',
      'presentations',
      'x'
    );
    const sheets = buildMaterialsStudioBreadcrumb('Materiały', 'Arkusze', 'sheets', 'x');

    expect(documents[1]).toEqual({ label: 'Dokumenty', to: '/presentations?tab=documents' });
    expect(presentations[1]).toEqual({
      label: 'Prezentacje',
      to: '/presentations?tab=presentations',
    });
    expect(sheets[1]).toEqual({ label: 'Arkusze', to: '/presentations?tab=sheets' });
  });

  it('keeps the last segment a plain string (never clickable) carrying the current state', () => {
    const result = buildMaterialsStudioBreadcrumb(
      'Materiały',
      'Dokumenty',
      'documents',
      'Nowy dokument'
    );

    expect(result[2]).toBe('Nowy dokument');
  });

  it('never re-uses the Materiały or tab label as the current-state label (the reported dup bug)', () => {
    const result = buildMaterialsStudioBreadcrumb(
      'Materiały',
      'Dokumenty',
      'documents',
      'Nowy dokument'
    );

    const labels = result.map((segment) => (typeof segment === 'string' ? segment : segment.label));
    expect(new Set(labels).size).toBe(labels.length);
  });
});
