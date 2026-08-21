/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { Layers } from 'lucide-react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      layout: _l,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      whileHover: _h,
      whileTap: _p,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const translate = (key: string) =>
    ({
      'sharedComponents.nModeCardManager.sectionsLabel': 'Sekcje',
      'sharedComponents.nModeHeader.savedLabel': 'Zapisano',
      'sharedComponents.nModeHeader.moreActions': 'Więcej',
    })[key] ?? key;
  return {
    ...actual,
    useTranslation: () => ({ t: translate, i18n: { language: 'pl', getFixedT: () => translate } }),
  };
});

import { Menu2AIButton, Menu2HowToButton, NModeShell, SectionsManagerMenu } from '..';
import type { UseCardLayoutResult } from '../useCardLayout';

const noop = () => {};
const catalogEntry = {
  id: 'summary',
  label: { en: 'Summary', pl: 'Podsumowanie' },
  icon: 'Layers',
  core: true,
};
const layout = {
  layout: [{ id: 'summary', visible: true, order: 0 }],
  catalog: [catalogEntry],
  spec: {
    catalog: [catalogEntry],
    sets: [{ id: 'default', label: { en: 'Default', pl: 'Domyślny' }, cards: ['summary'] }],
  },
  availableToAdd: [],
  visibleOrderedIds: ['summary'],
  addCard: noop,
  removeCard: noop,
  hideCard: noop,
  showCard: noop,
  reorderCards: noop,
  reorderByIds: noop,
  applyDefaultSet: noop,
  resetToDefault: noop,
  applyToSections: <T extends { id: string }>(sections: T[]) => sections,
} as UseCardLayoutResult;

function renderShell(hideToolbarWhenEmpty = true) {
  const handlers = { howTo: vi.fn(), ai: vi.fn(), start: vi.fn() };
  const result = render(
    <NModeShell
      hideToolbarWhenEmpty={hideToolbarWhenEmpty}
      presentationMode="n"
      onPresentationModeChange={noop}
      header={{
        title: 'Analiza SWOT',
        onTitleChange: noop,
        titleReadOnly: true,
        artifactId: 'swot',
        artifactType: 'tool',
        onSave: noop,
        onClose: noop,
        statusLabel: 'Aktywne',
        statusTone: 'approved',
        saveState: 'saved',
        secondaryActions: (
          <>
            <SectionsManagerMenu layout={layout} isPolish />
            <Menu2HowToButton
              variant="knowledge"
              isPolish
              label="How to / Baza wiedzy"
              onClick={handlers.howTo}
            />
            <Menu2AIButton
              isPolish
              onClick={handlers.ai}
              className="!border-c-border-subtle !bg-transparent !text-c-text-secondary"
            />
          </>
        ),
        primaryAction: { label: { en: 'Start', pl: 'Start' }, onClick: handlers.start },
      }}
      properties={[
        {
          id: 'owner',
          label: { en: 'Owner', pl: 'Właściciel' },
          type: 'text',
          value: 'Piotr',
          onChange: noop,
          readOnly: true,
        },
      ]}
      sections={[
        {
          id: 'summary',
          icon: Layers,
          label: { en: 'Summary', pl: 'Podsumowanie' },
          component: <div>Treść SWOT</div>,
        },
      ]}
      activeSection="summary"
      onSectionChange={noop}
    />
  );
  return { ...result, handlers };
}

describe('NModeShell owner action hierarchy', () => {
  afterEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 }));
  it.each([1440, 768, 390])(
    'keeps one bounded header action row at %ipx without empty toolbar',
    (width) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      const { container, handlers } = renderShell();
      expect(container.querySelectorAll('[data-nmode-header]')).toHaveLength(1);
      expect(container.querySelector('[data-nmode-toolbar-shell]')).not.toBeInTheDocument();
      const boundedActionRow = container.querySelector('[data-nmode-header-action-row]');
      expect(boundedActionRow).toHaveClass('w-full', 'min-w-0', 'lg:w-auto');
      const actionRow = container.querySelector('[data-nmode-header-secondary-actions]');
      expect(actionRow).toHaveClass('min-w-0', 'flex-1', 'overflow-x-auto', 'lg:max-w-[55vw]');
      const sections = screen.getByRole('button', { name: 'Sekcje' });
      const howTo = screen.getByRole('button', { name: 'How to / Baza wiedzy' });
      const ai = screen.getByRole('button', { name: 'Analizuj z AI' });
      const start = screen.getByRole('button', { name: 'Start' });
      fireEvent.click(sections);
      expect(screen.getByRole('menu')).toBeInTheDocument();
      fireEvent.click(howTo);
      fireEvent.click(ai);
      fireEvent.click(start);
      expect(handlers.howTo).toHaveBeenCalledOnce();
      expect(handlers.ai).toHaveBeenCalledOnce();
      expect(handlers.start).toHaveBeenCalledOnce();
    }
  );
  it('preserves the empty toolbar host for non-opt-in consumers', () => {
    expect(
      renderShell(false).container.querySelector('[data-nmode-toolbar-shell]')
    ).toBeInTheDocument();
  });
});
