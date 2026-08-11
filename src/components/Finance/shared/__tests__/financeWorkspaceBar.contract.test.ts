/**
 * Kontrola negatywna kontraktu `FinanceWorkspaceBar` (Pakiet C).
 *
 * Dowodzi TWARDYCH kryteriów właścicielskich jako czegoś, co CI może
 * zaczerwienić, nie jako prozy w komentarzu:
 *   - 1280px + nazwa 60 znaków → brak nakładania.
 *   - maksymalnie 5 bezpośrednich kontrolek po prawej (config z 6. zostaje ODRZUCONY).
 *   - freshness scalone z CTA („Nieaktualne · Przelicz").
 *   - rename zablokowany dla APPROVED, dozwolony dla DRAFT.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORKSPACE_BAR_METRICS,
  ENABLEMENT_ALWAYS,
  WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS,
  WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
  WORKSPACE_BAR_NAME_MAX_CHARS,
  canRenameArtifact,
  estimateWorkspaceBarLayout,
  mergeFreshnessIntoPrimaryLabel,
  resolveViewNavigationPlacement,
  validateWorkspaceBarConfig,
  validateWorkspaceName,
  type WorkspaceBarConfig,
} from '../financeWorkspaceBar.contract';

function baseConfig(overrides: Partial<WorkspaceBarConfig> = {}): WorkspaceBarConfig {
  return {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: { artifactType: 'BASELINE_MODEL', businessVersionId: 'bv-1', artifactId: 'art-1' },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: 'Model bazowy FY2026',
        editable: true,
        editableBlockedReason: null,
        maxChars: WORKSPACE_BAR_NAME_MAX_CHARS,
        layoutBudgetChars: WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
      },
      version: { label: 'v1', businessVersionId: 'bv-1', hasUncommittedWorkingRevision: false },
      status: 'DRAFT',
      freshness: 'CURRENT',
      contextFields: ['type', 'period'],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [
        { id: 'assumptions', label: { key: 'a', pl: 'Założenia' }, state: null },
        { id: 'outputs', label: { key: 'o', pl: 'Wyliczenia' }, state: null },
      ],
      activeViewId: 'assumptions',
      placement: 'in-bar',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: 'primary.recalculate',
        label: { key: 'recalc', pl: 'Przelicz' },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: true,
        keyboardCommandId: null,
      },
      secondary: null,
      lifecycle: {
        kind: 'lifecycle',
        id: 'lifecycle.status',
        label: { key: 'status', pl: 'Wersja robocza' },
        enablement: ENABLEMENT_ALWAYS,
        transitions: [
          {
            action: 'submit_for_review',
            label: { key: 'submit', pl: 'Przekaż do przeglądu' },
            enablement: ENABLEMENT_ALWAYS,
            destructive: false,
            requiresConfirmation: false,
            requiresReason: false,
          },
        ],
      },
      more: {
        kind: 'more',
        id: 'more.menu',
        label: { key: 'more', pl: 'Więcej' },
        enablement: ENABLEMENT_ALWAYS,
        items: [
          {
            id: 'more.export',
            label: { key: 'export', pl: 'Eksportuj' },
            group: 'document',
            enablement: ENABLEMENT_ALWAYS,
            destructive: false,
            requiresConfirmation: false,
          },
        ],
      },
      fullscreen: {
        kind: 'fullscreen',
        id: 'fullscreen.toggle',
        label: { key: 'fullscreen', pl: 'Pełny ekran' },
        enablement: ENABLEMENT_ALWAYS,
        iconOnly: true,
        ariaLabel: { key: 'fullscreen.aria', pl: 'Tryb pełnego obszaru roboczego' },
      },
      extraDirectControls: [],
    },
    ...overrides,
  };
}

describe('financeWorkspaceBar.contract — kryterium 1280px / 60 znaków (addendum §7)', () => {
  it('DŁUGA NAZWA (60 znaków) przy 1280px: brak nakładania (fits=true)', () => {
    const config = baseConfig();
    const estimate = estimateWorkspaceBarLayout(config, { viewportPx: 1280, nameChars: 60 });
    expect(estimate.viewportPx).toBe(1280);
    expect(estimate.targetNameChars).toBe(60);
    expect(estimate.fits).toBe(true);
    expect(estimate.nameAvailablePx).toBeGreaterThanOrEqual(DEFAULT_WORKSPACE_BAR_METRICS.minNamePx);
  });

  it('KONTROLA NEGATYWNA: dodanie 6. bezpośredniej kontrolki (extraDirectControls) zawęża dostępną przestrzeń na nazwę i configu NIE da się zwalidować', () => {
    const configOk = baseConfig();
    const before = estimateWorkspaceBarLayout(configOk, { viewportPx: 1280, nameChars: 60 });

    // baseConfig ma już 4 bezpośrednie kontrolki (primary+lifecycle+more+fullscreen)
    // — DWIE dodatkowe pchają na 6, żeby realnie przekroczyć limit 5.
    const configOverstuffed = baseConfig({
      actions: {
        ...configOk.actions,
        extraDirectControls: [
          {
            kind: 'extra',
            id: 'extra.rogue-1',
            label: { key: 'rogue1', pl: 'Dodatkowa kontrolka 1' },
            enablement: ENABLEMENT_ALWAYS,
          },
          {
            kind: 'extra',
            id: 'extra.rogue-2',
            label: { key: 'rogue2', pl: 'Dodatkowa kontrolka 2' },
            enablement: ENABLEMENT_ALWAYS,
          },
        ],
      },
    });
    const after = estimateWorkspaceBarLayout(configOverstuffed, { viewportPx: 1280, nameChars: 60 });

    // Zrzut na budżet szerokości MUSI się zmienić po dodaniu kontrolki —
    // dowód, że estymator faktycznie liczy z configu, nie zwraca stałej.
    expect(after.fixedPx).toBeGreaterThan(before.fixedPx);
    expect(after.nameAvailablePx).toBeLessThan(before.nameAvailablePx);

    const validation = validateWorkspaceBarConfig(configOverstuffed);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.some((e) => e.code === 'TOO_MANY_DIRECT_RIGHT_CONTROLS')).toBe(true);
    }
  });

  it('config bazowy (primary + lifecycle + more + fullscreen = 4 kontrolki) przechodzi walidację; policzone bezpośrednie kontrolki ≤ limit', () => {
    const config = baseConfig();
    const validation = validateWorkspaceBarConfig(config);
    expect(validation.ok).toBe(true);
    expect(WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS).toBe(5);
  });
});

describe('financeWorkspaceBar.contract — freshness scalone z CTA (addendum §7)', () => {
  it('CURRENT: bez prefiksu — samo CTA', () => {
    const merged = mergeFreshnessIntoPrimaryLabel({ key: 'recalc', pl: 'Przelicz' }, 'CURRENT');
    expect(merged.prefix).toBeNull();
    expect(merged.pl).toBe('Przelicz');
  });

  it('STALE_SOURCE: „Nieaktualne · Przelicz” — KONTROLA NEGATYWNA zmiany freshness zmienia renderowany label', () => {
    const currentLabel = mergeFreshnessIntoPrimaryLabel({ key: 'recalc', pl: 'Przelicz' }, 'CURRENT').pl;
    const staleLabel = mergeFreshnessIntoPrimaryLabel({ key: 'recalc', pl: 'Przelicz' }, 'STALE_SOURCE').pl;
    expect(staleLabel).toBe('Nieaktualne · Przelicz');
    expect(staleLabel).not.toBe(currentLabel);
  });

  it('COMPUTE_FAILED: „Błąd przeliczenia · Przelicz”', () => {
    const merged = mergeFreshnessIntoPrimaryLabel({ key: 'recalc', pl: 'Przelicz' }, 'COMPUTE_FAILED');
    expect(merged.pl).toBe('Błąd przeliczenia · Przelicz');
  });
});

describe('financeWorkspaceBar.contract — rename kontrolowany (OWN-FIN-011)', () => {
  it('DRAFT + preparer → editable', () => {
    expect(canRenameArtifact('DRAFT', 'preparer')).toEqual({ editable: true });
  });

  it('APPROVED → zablokowany (STATUS_IMMUTABLE) — KONTROLA NEGATYWNA vs DRAFT', () => {
    const approved = canRenameArtifact('APPROVED', 'preparer');
    const draft = canRenameArtifact('DRAFT', 'preparer');
    expect(approved).toEqual({ editable: false, reason: 'STATUS_IMMUTABLE' });
    expect(draft.editable).not.toBe(approved.editable);
  });

  it('viewer rola → zablokowany (INSUFFICIENT_ROLE)', () => {
    expect(canRenameArtifact('DRAFT', 'viewer')).toEqual({ editable: false, reason: 'INSUFFICIENT_ROLE' });
  });

  it('walidacja: pusta nazwa odrzucona, za długa nazwa odrzucona, znaki sterujące odrzucone', () => {
    expect(validateWorkspaceName('   ').ok).toBe(false);
    expect(validateWorkspaceName('a'.repeat(WORKSPACE_BAR_NAME_MAX_CHARS + 1)).ok).toBe(false);
    expect(validateWorkspaceName(`Nazwa${String.fromCharCode(7)}zbell`).ok).toBe(false);
    const ok = validateWorkspaceName('  Model  bazowy  ');
    expect(ok).toEqual({ ok: true, normalized: 'Model bazowy' });
  });
});

describe('financeWorkspaceBar.contract — nawigacja widoków', () => {
  it('≤2 widoki → in-bar; 3 widoki → separate-row', () => {
    expect(resolveViewNavigationPlacement(1)).toBe('in-bar');
    expect(resolveViewNavigationPlacement(2)).toBe('in-bar');
    expect(resolveViewNavigationPlacement(3)).toBe('separate-row');
  });

  it('config z placement niezgodnym z liczbą widoków jest odrzucony', () => {
    const config = baseConfig({
      viewNavigation: {
        kind: 'stepper',
        views: [
          { id: 'source', label: { key: 's', pl: 'Źródło' }, state: null },
          { id: 'assumptions', label: { key: 'a', pl: 'Założenia' }, state: null },
          { id: 'methods', label: { key: 'm', pl: 'Metody i wagi' }, state: null },
        ],
        activeViewId: 'source',
        placement: 'in-bar', // BŁĄD: 3 widoki muszą być 'separate-row'
      },
    });
    const validation = validateWorkspaceBarConfig(config);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.some((e) => e.code === 'VIEW_PLACEMENT_MISMATCH')).toBe(true);
    }
  });
});

describe('financeWorkspaceBar.contract — destrukcyjne operacje wymagają potwierdzenia (CANON.md §4.3)', () => {
  it('destructive=true bez requiresConfirmation jest odrzucony', () => {
    const config = baseConfig({
      actions: {
        ...baseConfig().actions,
        more: {
          kind: 'more',
          id: 'more.menu',
          label: { key: 'more', pl: 'Więcej' },
          enablement: ENABLEMENT_ALWAYS,
          items: [
            {
              id: 'more.delete',
              label: { key: 'delete', pl: 'Usuń' },
              group: 'danger',
              enablement: ENABLEMENT_ALWAYS,
              destructive: true,
              requiresConfirmation: false, // BŁĄD
            },
          ],
        },
      },
    });
    const validation = validateWorkspaceBarConfig(config);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.some((e) => e.code === 'DESTRUCTIVE_WITHOUT_CONFIRMATION')).toBe(true);
    }
  });
});
