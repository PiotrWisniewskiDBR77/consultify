import { describe, expect, it, vi } from 'vitest';

import type { ArtifactCommandContext } from '@/components/shared/ArtifactStudio';

import { createPresentationArtifactCommandRegistry } from '../presentationArtifactCommands';

const handlers = {
  undo: vi.fn(),
  redo: vi.fn(),
  addSlide: vi.fn(),
  duplicateSlide: vi.fn(),
  toggleSlideLock: vi.fn(),
  deleteSlide: vi.fn(),
  insertText: vi.fn(),
  insertImage: vi.fn(),
  openTheme: vi.fn(),
  duplicateBlock: vi.fn(),
  deleteBlock: vi.fn(),
};

const availability = {
  canUndo: true,
  canRedo: true,
  canDeleteSlide: true,
  hasActiveSlide: true,
  hasSelectedBlock: true,
};

function context(
  kind: ArtifactCommandContext['selection']['kind'],
  options: { canEdit?: boolean; conflict?: boolean } = {}
): ArtifactCommandContext {
  return {
    selection: { artifactType: 'presentation', kind },
    permissions: {
      grants: new Set(
        options.canEdit === false ? ['artifact.read'] : ['artifact.read', 'artifact.edit']
      ),
    },
    lifecycle: { status: 'draft', conflict: options.conflict },
  };
}

function visibleCommandIds(
  registry: ReturnType<typeof createPresentationArtifactCommandRegistry>,
  commandContext: ArtifactCommandContext
): string[] {
  return registry
    .query({ placement: 'menu3' })
    .filter(
      (command) => registry.resolveState(command.commandId, commandContext).visibility !== 'hidden'
    )
    .map((command) => command.commandId);
}

describe('presentation Artifact Studio commands', () => {
  /** Narzędzia dostępne zawsze, gdy jest aktywny slajd — niezależnie od zaznaczenia. */
  const NARZEDZIA_SLAJDU = [
    'ppt.edit.undo',
    'ppt.edit.redo',
    'ppt.slide.addAfter',
    'ppt.insert.text',
    'ppt.insert.image',
    'ppt.design.theme.open',
    'ppt.slide.duplicate',
    'ppt.slide.lock.toggle',
    'ppt.slide.delete',
  ];

  it('exposes every slide-level tool with no selection', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    expect(visibleCommandIds(registry, context('none'))).toEqual(NARZEDZIA_SLAJDU);
  });

  it('★ pasek narzędzi NIE KURCZY SIĘ po zaznaczeniu — dokłada polecenia obiektu', () => {
    /*
     * BEZPIECZNIK REGRESJI (2026-08-30, zmierzone w przeglądarce).
     * Stan zastany: pasek startował z „Nowy slajd · Pole tekstowe · Obraz ·
     * Motyw", a po JEDNYM kliknięciu w blok slajdu zostawało „Duplikuj
     * obiekt · Usuń obiekt". Pierwszy naturalny ruch użytkownika — kliknięcie
     * w to, co chce zmienić — kasował z ekranu wszystkie narzędzia dodawania.
     * To jest mechanika stojąca za uwagą właściciela „nie widzę nigdzie,
     * gdzie mogę edytować".
     *
     * Kontrakt: zaznaczenie może pasek WYDŁUŻYĆ, nigdy skrócić — bo wszystkie
     * polecenia poziomu slajdu i tak działają na AKTYWNYM slajdzie, a nie na
     * zaznaczeniu (patrz handlery w `DeckBuilder.tsx`: `duplicateCard(
     * activeCardIndex)` itd.).
     */
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    expect(visibleCommandIds(registry, context('slide'))).toEqual(NARZEDZIA_SLAJDU);
    expect(visibleCommandIds(registry, context('block'))).toEqual([
      ...NARZEDZIA_SLAJDU,
      'ppt.block.duplicate',
      'ppt.block.delete',
    ]);

    for (const kind of ['none', 'slide', 'block'] as const) {
      expect(visibleCommandIds(registry, context(kind))).toEqual(
        expect.arrayContaining(NARZEDZIA_SLAJDU)
      );
    }
  });

  it('hides slide tools when there is no active slide', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, {
      ...availability,
      hasActiveSlide: false,
    });

    // Warunkiem jest realny stan („czy jest slajd"), nie rodzaj zaznaczenia.
    const visible = visibleCommandIds(registry, context('none'));
    expect(visible).not.toContain('ppt.insert.text');
    expect(visible).not.toContain('ppt.slide.duplicate');
    expect(visible).not.toContain('ppt.slide.delete');
    // Motyw dotyczy CAŁEJ prezentacji, więc zostaje.
    expect(visible).toContain('ppt.design.theme.open');
  });

  it('hides delete slide when deleting would leave no slide', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, {
      ...availability,
      canDeleteSlide: false,
    });

    expect(visibleCommandIds(registry, context('slide'))).not.toContain('ppt.slide.delete');
  });

  it('disables mutations without edit permission or during a conflict', () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    expect(
      registry.resolveState('ppt.slide.duplicate', context('slide', { canEdit: false }))
    ).toEqual({
      visibility: 'disabled',
      reason: 'permission',
    });
    expect(
      registry.resolveState('ppt.slide.duplicate', context('slide', { conflict: true }))
    ).toEqual({
      visibility: 'disabled',
      reason: 'lifecycle',
    });
  });

  it('uses the registered handler and never registers a fixed Teresa command', async () => {
    const registry = createPresentationArtifactCommandRegistry(handlers, availability);

    await registry.execute('ppt.block.duplicate', context('block'));

    expect(handlers.duplicateBlock).toHaveBeenCalledTimes(1);
    expect(registry.list().some((command) => command.category === 'teresa')).toBe(false);
  });
});
