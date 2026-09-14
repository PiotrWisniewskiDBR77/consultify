import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealUseTranslation } from '@/test-utils/realTranslations';

const locale = vi.hoisted(() => ({ value: 'en' as 'en' | 'pl' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => createRealUseTranslation(locale.value)(),
}));

vi.mock('@/components/shared/NModeLayout/NModeMenu2', () => ({
  NModeMenu2: ({ sectionsMenu }: { sectionsMenu: React.ReactNode }) => <>{sectionsMenu}</>,
}));

vi.mock('../PracujZAI', () => ({ PracujZAI: () => null }));

import { DocumentCardMenu5 } from '../DocumentCardMenu5';

const sections = [{ id: 'summary', label: { en: 'Summary', pl: 'Podsumowanie' } }] as const;

function renderMenu(): void {
  render(
    <DocumentCardMenu5
      sections={sections}
      activeSection="summary"
      onSectionChange={() => undefined}
      readMode
      ai={{ onAnalizuj: () => undefined, kontekstArtefaktu: {} }}
    />
  );
}

describe('DocumentCardMenu5 locale', () => {
  beforeEach(() => {
    locale.value = 'en';
  });

  it('uses the current i18n locale for the shell and section labels', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Sections' }));
    expect(screen.getByRole('menuitem', { name: 'Summary' })).toBeInTheDocument();

    locale.value = 'pl';
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Sekcje' }));
    expect(screen.getByRole('menuitem', { name: 'Podsumowanie' })).toBeInTheDocument();
  });
});
