/**
 * Krok B (domknięcie Teresy — params na szynę) — dowód, że `ctx.params.label`
 * z `idea.element.add` faktycznie dociera na szynę `idea-workspace-quick-action`
 * jako `detail.label`.
 *
 * Przed Krokiem B handler `idea.element.add` wołał
 * `runByTool('idea.element.add', RUNTIME_ADD_ELEMENT, ctx)` BEZ czwartego
 * argumentu — `ctx.params` (etykieta podana przez Teresę albo formularz)
 * była deklarowana w `teresa.parameters`, ale nigdy nie docierała do odbiorników
 * (mm_add_child/wb_add_sticky/pf_add_step/tbl_add_row w use*QuickActions.ts).
 * Ten test łapie regresję na poziomie SZYNY (rejestr → CustomEvent), bez
 * montowania czterech narzędzi canvasu.
 */
import { describe, expect, it, vi } from 'vitest';

import type { ActionContext } from '@/actions/ideaActionRegistry';
import { runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

function baseCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'mindmap',
    selection: EMPTY_SELECTION,
    surface: 'panel',
    source: 'teresa',
    language: 'pl',
    ...overrides,
  };
}

/** Nasłuchuje JEDNEGO zdarzenia na szynie i zwraca jego `detail`. */
function captureNextQuickAction(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const onEvent = (e: Event) => {
      window.removeEventListener('idea-workspace-quick-action', onEvent as EventListener);
      resolve((e as CustomEvent).detail as Record<string, unknown>);
    };
    window.addEventListener('idea-workspace-quick-action', onEvent as EventListener);
  });
}

describe('idea.element.add — Krok B (params → szyna)', () => {
  it('przekazuje ctx.params.label jako detail.label na szynie (Mapa myśli)', async () => {
    const captured = captureNextQuickAction();

    const result = await runIdeaAction(
      'idea.element.add',
      baseCtx({ tool: 'mindmap', params: { label: 'Nowa gałąź od Teresy' } })
    );

    const detail = await captured;
    expect(result.ok).toBe(true);
    expect(detail.action).toBe('mm_add_child');
    expect(detail.ideaId).toBe('idea-1');
    expect(detail.source).toBe('teresa');
    expect(detail.label).toBe('Nowa gałąź od Teresy');
  });

  it('działa też dla Tablicy/Przepływu/Tabeli (runtime string per narzędzie, ta sama etykieta)', async () => {
    const cases: Array<{ tool: ActionContext['tool']; runtime: string }> = [
      { tool: 'whiteboard', runtime: 'wb_add_sticky' },
      { tool: 'process_flow', runtime: 'pf_add_step' },
      { tool: 'table', runtime: 'tbl_add_row' },
    ];

    for (const { tool, runtime } of cases) {
      const captured = captureNextQuickAction();
      const result = await runIdeaAction(
        'idea.element.add',
        baseCtx({ tool, params: { label: `Element (${tool})` } })
      );
      const detail = await captured;
      expect(result.ok).toBe(true);
      expect(detail.action).toBe(runtime);
      expect(detail.label).toBe(`Element (${tool})`);
    }
  });

  it('bez params (klik UI bez treści) — brak label w detail, żaden odbiornik nic nie dostaje', async () => {
    const captured = captureNextQuickAction();

    const result = await runIdeaAction(
      'idea.element.add',
      baseCtx({ tool: 'mindmap', source: 'ui', params: undefined })
    );

    const detail = await captured;
    expect(result.ok).toBe(true);
    expect(detail.action).toBe('mm_add_child');
    expect('label' in detail).toBe(false);
  });
});
