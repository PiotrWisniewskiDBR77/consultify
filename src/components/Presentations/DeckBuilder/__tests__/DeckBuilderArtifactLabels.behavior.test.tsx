import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactMenu3 } from '@/components/shared/ArtifactStudio';
import { createRealT, type SupportedTestLocale } from '@/test-utils/realTranslations';

import { DeckBuilderMelsView } from '../DeckBuilderMelsView';
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
  hasSelectedBlock: false,
};

const context = {
  selection: { artifactType: 'presentation' as const, kind: 'none' as const },
  permissions: { grants: new Set(['artifact.read', 'artifact.edit']) },
  lifecycle: { status: 'draft' as const },
};

const shellHandlers = {
  onHistory: vi.fn(),
  onQa: vi.fn(),
  onGovernance: vi.fn(),
  onAnalytics: vi.fn(),
  onAudit: vi.fn(),
  onShare: vi.fn(),
  onToggleAgent: vi.fn(),
  onRun: vi.fn(),
};

function renderLabels(locale: SupportedTestLocale) {
  const t = createRealT(locale);
  const registry = createPresentationArtifactCommandRegistry(handlers, availability);

  render(
    <>
      <ArtifactMenu3
        registry={registry}
        context={context}
        resolveLabel={(labelKey) => t(labelKey)}
        maxVisible={9}
        ariaLabel="Deck editing tools"
      />
      <DeckBuilderMelsView
        artifactStudioMode
        title="Board update"
        topBarHandlers={shellHandlers}
        leftRail={<div>Slide list</div>}
        leftRailTitle={t('presentations.builder.structure')}
        canvas={<div>Deck canvas</div>}
        persistRailState={false}
      />
    </>
  );

  return within(screen.getByRole('toolbar', { name: 'Deck editing tools' }));
}

describe('DeckBuilder Artifact Studio localized labels', () => {
  it('renders the complete English slide toolbar and English structure heading', () => {
    const toolbar = renderLabels('en');

    for (const label of [
      'Undo',
      'Redo',
      'New slide',
      'Text box',
      'Image',
      'Theme',
      'Duplicate slide',
      'Lock / unlock',
      'Delete slide',
    ]) {
      expect(toolbar.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.queryByText('Struktura prezentacji')).not.toBeInTheDocument();
  });

  it('preserves the complete Polish slide toolbar and Polish structure heading', () => {
    const toolbar = renderLabels('pl');

    for (const label of [
      'Cofnij',
      'Ponów',
      'Nowy slajd',
      'Pole tekstowe',
      'Obraz',
      'Motyw',
      'Duplikuj slajd',
      'Zablokuj / odblokuj',
      'Usuń slajd',
    ]) {
      expect(toolbar.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('Struktura')).toBeInTheDocument();
  });
});
