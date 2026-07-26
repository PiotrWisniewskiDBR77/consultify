/**
 * Krok A (domknięcie Teresy — potwierdzenie akcji w czacie) — unit test logiki
 * `runIdeaAction` dla akcji z `teresa.confirmBeforeRun` (`idea.workspace.convert`,
 * `idea.workspace.duplicate`).
 *
 * Kontrakt pod testem (src/actions/ideaActionRegistry.ts runIdeaAction ~:808):
 *   - source: 'teresa' + confirmed: false/undefined → odmowa z
 *     `data: { needsConfirmation: true, actionId }` (pole ADDYTYWNE, `message`
 *     bez zmian) — to na nim UnifiedChatPanel opiera decyzję "pokaż przyciski".
 *   - source: 'teresa' + confirmed: true → handler wykonuje się normalnie
 *     (ta sama ścieżka co klik człowieka — Z4, brak drugiego mechanizmu).
 *   - source: 'ui' nigdy nie przechodzi przez tę bramkę (klik człowieka w Menu 1
 *     ma własne potwierdzenie w UI, poza zakresem tego kroku).
 */
import { describe, expect, it, vi } from 'vitest';

const convertMyIdeaMock = vi.fn();
const duplicateMyIdeaMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    convertMyIdea: (...args: unknown[]) => convertMyIdeaMock(...args),
    duplicateMyIdea: (...args: unknown[]) => duplicateMyIdeaMock(...args),
  },
}));

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

describe('runIdeaAction — confirmBeforeRun (Krok A)', () => {
  it('idea.workspace.convert: Teresa bez confirmed → odmowa z data.needsConfirmation, message bez zmian', async () => {
    const result = await runIdeaAction(
      'idea.workspace.convert',
      baseCtx({ params: { target: 'initiative' } })
    );

    expect(result.ok).toBe(false);
    expect(result.actionId).toBe('idea.workspace.convert');
    expect(result.message).toBe(
      '„Konwertuj" zmienia dane na trwałe — potwierdź, zanim to zrobię.'
    );
    expect(result.data).toEqual({
      needsConfirmation: true,
      actionId: 'idea.workspace.convert',
    });
    expect(convertMyIdeaMock).not.toHaveBeenCalled();
  });

  it('idea.workspace.convert: Teresa z confirmed:true → wykonuje handler (ta sama ścieżka co UI)', async () => {
    convertMyIdeaMock.mockResolvedValueOnce({ id: 'initiative-1' });

    const result = await runIdeaAction(
      'idea.workspace.convert',
      baseCtx({ params: { target: 'initiative' }, confirmed: true })
    );

    expect(result.ok).toBe(true);
    expect(convertMyIdeaMock).toHaveBeenCalledWith('idea-1', { target: 'initiative' });
    expect(result.data).toEqual({ id: 'initiative-1' });
  });

  it('idea.workspace.duplicate: Teresa bez confirmed → odmowa z data.needsConfirmation', async () => {
    const result = await runIdeaAction('idea.workspace.duplicate', baseCtx());

    expect(result.ok).toBe(false);
    expect(result.data).toEqual({
      needsConfirmation: true,
      actionId: 'idea.workspace.duplicate',
    });
    expect(duplicateMyIdeaMock).not.toHaveBeenCalled();
  });

  it('idea.workspace.duplicate: Teresa z confirmed:true → wykonuje handler', async () => {
    duplicateMyIdeaMock.mockResolvedValueOnce({ id: 'idea-2' });

    const result = await runIdeaAction(
      'idea.workspace.duplicate',
      baseCtx({ confirmed: true })
    );

    expect(result.ok).toBe(true);
    expect(duplicateMyIdeaMock).toHaveBeenCalledWith('idea-1', { language: 'pl' });
  });

  it('source "ui" + confirmed:false: bramka Teresy nie łapie, ale handler ma WŁASNE (inne) potwierdzenie i wciąż odmawia — bez znacznika needsConfirmation', async () => {
    const result = await runIdeaAction(
      'idea.workspace.convert',
      baseCtx({ source: 'ui', params: { target: 'initiative' }, confirmed: false })
    );

    // Gate `ctx.source === 'teresa' && !ctx.confirmed` (runIdeaAction) nie
    // dotyczy 'ui' — ale handler `idea.workspace.convert` ma swój WŁASNY,
    // niezależny check `!ctx.confirmed` (UI ma własne potwierdzenie w
    // IdeaConvertMenu, poza zakresem Kroku A). Odmowa jest inna: bez
    // `data.needsConfirmation` — to pole jest specyficzne dla ścieżki Teresy.
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(convertMyIdeaMock).not.toHaveBeenCalled();
  });

  it('source "ui" + confirmed:true: bramka Teresy nie dotyczy UI, handler wykonuje się normalnie', async () => {
    convertMyIdeaMock.mockResolvedValueOnce({ id: 'initiative-3' });

    const result = await runIdeaAction(
      'idea.workspace.convert',
      baseCtx({ source: 'ui', params: { target: 'initiative' }, confirmed: true })
    );

    expect(result.ok).toBe(true);
    expect(convertMyIdeaMock).toHaveBeenCalledWith('idea-1', { target: 'initiative' });
  });
});
