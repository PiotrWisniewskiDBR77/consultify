/**
 * Zakres obowiązywania przypiętego kontekstu Teresy (dyżur 172).
 *
 * Reguła nie jest kosmetyczna: to ona decyduje, czy Teresa odpowiada „o tej
 * inicjatywie", czy przenosi kontekst obiektu na obcy ekran. Testy renderowe
 * w tests/components/AIChat/UnifiedChatPanel.test.tsx sprawdzają ładunek do
 * modelu; tutaj sprawdzamy samą regułę, na wszystkich krawędziach.
 */
import { describe, expect, it } from 'vitest';

import {
  isTeresaEntityContextInScope,
  resolveTeresaWorkspaceContext,
  trimPinnedEntityData,
  type TeresaEntityContext,
} from '../../src/store/teresaEntityContext';

const PIN: TeresaEntityContext = {
  type: 'initiative',
  entityId: 'init-42',
  entityName: 'Redukcja kosztów magazynu',
  entityData: { lifecycle: 'draft' },
  conversationId: 'conv-1',
  originPath: '/initiatives/init-42',
  ts: 1_756_000_000_000,
};

// Kontekst, jaki MainLayout wylicza z TRASY i podaje propsem — bez entityId.
const ROUTE_CONTEXT: any = {
  view: 'INITIATIVES',
  type: 'dashboard',
  projectId: 'proj-9',
  timestamp: new Date('2026-09-01T08:00:00Z'),
};

describe('isTeresaEntityContextInScope', () => {
  it('obowiązuje w rozmowie, dla której go założono', () => {
    expect(
      isTeresaEntityContextInScope(PIN, { activeConversationId: 'conv-1', pathname: '/excele' })
    ).toBe(true);
  });

  it('obowiązuje na trasie, z której otwarto Teresę (ratunek po odświeżeniu)', () => {
    expect(
      isTeresaEntityContextInScope(
        { ...PIN, conversationId: null },
        { activeConversationId: null, pathname: '/initiatives/init-42' }
      )
    ).toBe(true);
  });

  it('NIE obowiązuje w obcej rozmowie na obcej trasie', () => {
    expect(
      isTeresaEntityContextInScope(PIN, { activeConversationId: 'conv-9', pathname: '/excele' })
    ).toBe(false);
  });

  it('pusty pin i pin bez entityId nie obowiązują nigdy', () => {
    expect(isTeresaEntityContextInScope(null, { activeConversationId: 'conv-1' })).toBe(false);
    expect(
      isTeresaEntityContextInScope({ ...PIN, entityId: '' }, { activeConversationId: 'conv-1' })
    ).toBe(false);
  });
});

describe('resolveTeresaWorkspaceContext', () => {
  it('nakłada obiekt na kontekst trasy — encja wygrywa, projekt zostaje', () => {
    const out = resolveTeresaWorkspaceContext(ROUTE_CONTEXT, PIN, {
      activeConversationId: 'conv-1',
      pathname: '/initiatives/init-42',
    });
    expect(out).toEqual(
      expect.objectContaining({
        type: 'initiative',
        entityId: 'init-42',
        entityName: 'Redukcja kosztów magazynu',
        projectId: 'proj-9',
      })
    );
    expect((out as any)?.entityData).toEqual(expect.objectContaining({ lifecycle: 'draft' }));
  });

  it('bez propsa (pełne okno /chat) buduje kontekst z samego pinu', () => {
    const out = resolveTeresaWorkspaceContext(null, PIN, {
      activeConversationId: 'conv-1',
      pathname: '/chat/conv-1',
    });
    expect(out?.entityId).toBe('init-42');
    expect(out?.type).toBe('initiative');
  });

  it('pin poza zakresem zwraca bazę BEZ ZMIAN (wsteczna zgodność)', () => {
    const out = resolveTeresaWorkspaceContext(ROUTE_CONTEXT, PIN, {
      activeConversationId: 'conv-9',
      pathname: '/excele',
    });
    expect(out).toBe(ROUTE_CONTEXT);
  });

  it('brak pinu i brak bazy => null, nie pusty obiekt udający kontekst', () => {
    expect(resolveTeresaWorkspaceContext(null, null, {})).toBeNull();
  });
});

describe('trimPinnedEntityData', () => {
  it('wyrzuca teresaPrompt — ma własny kanał, nie miejsce w trwałym przypięciu', () => {
    const out = trimPinnedEntityData({
      teresaPrompt: 'x'.repeat(50_000),
      lifecycle: 'draft',
    });
    expect(out).toEqual({ lifecycle: 'draft' });
  });

  it('przycina wielki ładunek zamiast zapychać localStorage', () => {
    const out = trimPinnedEntityData({
      wielki: 'y'.repeat(40_000),
      slideCount: 12,
      tabela: Array.from({ length: 500 }, (_, i) => ({ i })),
    });
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(2_000);
    expect(out.slideCount).toBe(12);
  });

  it('mały ładunek zostaje nietknięty; brak danych => pusty obiekt', () => {
    expect(trimPinnedEntityData({ a: 1, b: 'dwa' })).toEqual({ a: 1, b: 'dwa' });
    expect(trimPinnedEntityData(null)).toEqual({});
  });
});
