/**
 * StandardArtifactShell — nowy prop `breadcrumb` (tor PLATFORMY, punkt
 * zakresu 1, 2026-08-11). Rules being locked in:
 *   - pominięty prop -> zero zmiany wobec dzisiejszych 7 kart (brak
 *     `nav[aria-label="Breadcrumb"]` w drzewie)
 *   - podany prop -> `ArtifactBreadcrumb` renderuje się NAD powłoką
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

// Global react-i18next mock lives in tests/setup.ts — do NOT override it
// locally here: `NModeShell` pulls in `SectionErrorBoundary.tsx`, which
// imports the real `src/i18n.ts` (needs `initReactI18next`); a local
// override that omits that export breaks the whole tree.
import { StandardArtifactShell } from '../../../src/components/standard/StandardArtifactShell';

const pominieta = { pominieta: true as const, reason: 'Test fixture — sekcja nieużywana.' };
const brakAI = { none: true as const, reason: 'Test fixture — sekcja statyczna.' };

const baseProps = {
  karta: 'tool' as const,
  klasa: 'S' as const,
  header: {
    title: 'Test Tool',
    onTitleChange: () => {},
    artifactType: 'tool' as const,
    onSave: () => {},
    onClose: () => {},
  },
  primaryAction: { intentionallyNone: true as const, reason: 'Test fixture — read-only karta.' },
  sections: [
    { id: 'overview', label: { en: 'Overview', pl: 'Przegląd' }, icon: () => null, component: <div />, aiContract: brakAI },
  ] as const,
  rightPanel: {
    actions: pominieta,
    properties: pominieta,
    relations: pominieta,
    comments: pominieta,
    history: pominieta,
  },
  activeSection: 'overview',
  onSectionChange: () => {},
  densityMode: 'n' as const,
  onDensityModeChange: () => {},
};

describe('StandardArtifactShell · breadcrumb (element ㉛)', () => {
  it('pominięty prop -> brak nav breadcrumb (wsteczna zgodność 7 kart)', () => {
    render(<StandardArtifactShell {...baseProps} />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('podany prop -> breadcrumb renderuje się nad powłoką', () => {
    render(
      <StandardArtifactShell
        {...baseProps}
        breadcrumb={[{ label: 'Rejestr KPI' }, { label: 'OEE-LINIA-PAKOWANIA' }]}
      />
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Rejestr KPI')).toBeInTheDocument();
    expect(screen.getByText('OEE-LINIA-PAKOWANIA')).toBeInTheDocument();
  });
});
