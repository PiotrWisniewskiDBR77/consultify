/**
 * Flaga OFF ⇒ nawigacja Organizacji jest DOKŁADNIE taka jak dotąd (21 ekranów,
 * 6 grup). Flaga ON ⇒ 11 ekranów w tych samych 6 grupach.
 *
 * Test celowo woła `OrganizationSidebar` bez propa `modules` (ścieżka OFF)
 * i z propem (ścieżka ON) — to jedyny punkt, w którym redesign wchodzi w IA.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ORGANIZATION_MODULES, OrganizationSidebar } from '../../OrganizationSidebar';
import { ORGANIZATION_REDESIGN_MODULES } from '../organizationRedesignNav';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

function expandAll() {
  for (const group of screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-expanded') === 'false'))
    fireEvent.click(group);
}

describe('OrganizationSidebar — flaga orgRedesignV1', () => {
  it('OFF: pokazuje kanoniczne 21 ekranów w 6 grupach', () => {
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={vi.fn()}
      />
    );

    const groups = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-expanded'));
    expect(groups).toHaveLength(6);
    // OFF: akordeon jak dotąd — rozwinięta wyłącznie grupa aktywna.
    expect(groups.filter((group) => group.getAttribute('aria-expanded') === 'true')).toHaveLength(1);

    expandAll();
    const legacyScreens = ORGANIZATION_MODULES.flatMap((module) => module.children);
    expect(legacyScreens).toHaveLength(21);
    for (const child of legacyScreens)
      expect(screen.getByRole('button', { name: new RegExp(child.label, 'i') })).toBeInTheDocument();
  });

  it('ON: pokazuje 11 skonsolidowanych ekranów w tych samych 6 grupach', () => {
    const onLocationChange = vi.fn();
    render(
      <OrganizationSidebar
        activeLocation={{ module: 'profile', screen: 'identity-scale' }}
        onLocationChange={onLocationChange}
        modules={ORGANIZATION_REDESIGN_MODULES}
      />
    );

    const groups = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-expanded'));
    expect(groups).toHaveLength(6);
    // ON: płaska lista — wszystkie grupy rozwinięte OD RAZU, bez klikania
    // (decyzja nadzorcy 2026-08-24; po konsolidacji 11 ekranów mieści się naraz).
    expect(groups.every((group) => group.getAttribute('aria-expanded') === 'true')).toBe(true);

    const screenButtons = screen
      .getAllByRole('button')
      .filter((button) => !button.hasAttribute('aria-expanded'));
    expect(screenButtons).toHaveLength(11);

    expect(
      screen.getByRole('button', { name: /Tożsamość i model działania/i })
    ).toBeInTheDocument();
    // Ekrany wchłonięte znikają z nawigacji (treść żyje dalej wewnątrz gospodarza).
    expect(screen.queryByRole('button', { name: /^Model działania$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Konflikty źródeł/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Graf wiedzy/i }));
    expect(onLocationChange).toHaveBeenCalledWith({
      module: 'sources',
      screen: 'knowledge-graph',
    });
  });
});
