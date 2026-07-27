/**
 * FAZA B3 (2026-07-27) — shared breadcrumb shape for the 3 Materiały studios
 * (Document Studio, Prezentacje, Excel). Extracted to a pure function so the
 * "3-segment breadcrumb starting with Materiały" contract is unit-testable
 * without mounting the full `AppRoutes` router tree.
 *
 * Bug this replaces: each studio route used to hand `MainLayout` its own
 * 2-string breadcrumb array with no path back to the Materiały hub — e.g.
 * `/document-studio` sent `[t('sidebar.documentStudio'), t('documentStudio.breadcrumb')]`,
 * and the second key never existed in the locale files, so it silently fell
 * back to the English default `'Document Studio'` — duplicating segment 1
 * ("Document Studio › Document Studio") regardless of the active language.
 */
import type { BreadcrumbSegment } from '../layouts/MainLayout';
import { ROUTES } from './routeConfig';

/**
 * @param materialsLabel Translated label for the Materiały hub itself (segment 1).
 * @param tabLabel Translated label for the hub tab this studio maps to (segment 2).
 * @param tabQueryValue The hub's `?tab=` value for that tab (see
 *   `outputsLibraryTabQuery.ts` — `documents` | `presentations` | `sheets`).
 * @param currentLabel Label for the studio's current state (segment 3, e.g.
 *   "New document" / "Document" — never clickable).
 */
export function buildMaterialsStudioBreadcrumb(
  materialsLabel: string,
  tabLabel: string,
  tabQueryValue: string,
  currentLabel: string
): BreadcrumbSegment[] {
  return [
    { label: materialsLabel, to: ROUTES.PRESENTATIONS },
    { label: tabLabel, to: `${ROUTES.PRESENTATIONS}?tab=${tabQueryValue}` },
    currentLabel,
  ];
}
