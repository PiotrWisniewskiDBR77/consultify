// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Uwaga Tomka XX (pilotaż 13.09): klik „Zapytaj Teresę" na ekranie DRD
 * wyrzucał testera pod adres `/chat` (zrzut image21: pasek adresu pokazuje
 * `staging.consultify.ai/chat`, choć pracował w `/assessment/drd/<id>`).
 *
 * PRZYCZYNA: `quarantineMissingConversationPointer` → `replaceChatRoute()`
 * przepisywał adres na `/chat` BEZWARUNKOWO — także gdy adres w ogóle nie
 * dotyczył rozmowy. Adres ekranu roboczego nie należy do czatu.
 *
 * Uwaga o przyrządzie: `tests/setup.ts` podmienia `window.location` na zamrożony
 * obiekt, więc `history.replaceState` NIE zmienia tu `location.pathname`.
 * Dlatego mierzymy samą DECYZJĘ — czy adres w ogóle zostaje przepisany.
 */

const GHOST = '99999999-9999-4999-8999-999999999999';
const DRD_PATH = '/assessment/drd/4e03f2b8-c51c-4a07-aeb9-11d3706a5855';

const setPath = (path: string) => {
  (window as any).location.pathname = path;
};

describe('useConversationStore — martwa rozmowa nie rusza adresu ekranu (uwaga Tomka XX)', () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    replaceSpy = vi.spyOn(window.history, 'replaceState');
  });

  it('nie przepisuje adresu, gdy tester jest na ekranie DRD', async () => {
    setPath(DRD_PATH);
    const mod = await import('../useConversationStore');
    mod.markConversationAsMissing(GHOST);
    replaceSpy.mockClear();
    mod.useConversationStore.getState().setActiveConversation(GHOST);
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(mod.useConversationStore.getState()._activeConversationState).toBe('not_found');
  });

  it('sprząta adres, gdy to właśnie ta rozmowa jest w adresie', async () => {
    setPath(`/chat/${GHOST}`);
    const mod = await import('../useConversationStore');
    mod.markConversationAsMissing(GHOST);
    replaceSpy.mockClear();
    mod.useConversationStore.getState().setActiveConversation(GHOST);
    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/chat');
  });

  it('na gołym /chat nie przepisuje adresu w kółko', async () => {
    setPath('/chat');
    const mod = await import('../useConversationStore');
    mod.markConversationAsMissing(GHOST);
    replaceSpy.mockClear();
    mod.useConversationStore.getState().setActiveConversation(GHOST);
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
