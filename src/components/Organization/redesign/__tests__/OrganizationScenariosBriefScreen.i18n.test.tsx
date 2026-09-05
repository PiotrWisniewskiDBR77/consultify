/**
 * Plan napraw MVP 05.09.2026, pozycja (6) `org-scenarios`: karty scenariuszy
 * transformacji renderowały nazwy/opisy PO ANGIELSKU niezależnie od języka
 * konta (`scenario.name`/`scenario.description` czytane wprost z surowego
 * katalogu `src/data/transformationScenarios.ts`), mimo że kompletne polskie
 * tłumaczenia już istnieją pod `transformationScenarios.scenarios.<id>.
 * {name,description}` w obu plikach translation.json — używał ich od dawna
 * tylko stary, dziś WYŁĄCZONY ekran (`ScenarioCard.tsx`). Ten ekran (redesign
 * v1) jest DOMYŚLNIE WŁĄCZONY (DEC-2026-08-26-78), więc to jest to, co
 * realnie widzi użytkownik.
 *
 * Ten test mockuje `useTranslation` realnymi danymi z `public/locales/pl/
 * translation.json` (nie kluczem-agnostycznym mockiem globalnym z
 * tests/setup.ts, który dla `returnObjects:true` zwraca Proxy — stąd osobny
 * plik zamiast dopisywania do OrganizationScenariosBriefScreen.test.tsx,
 * które celowo asercjonuje angielskie stringi pod globalnym mockiem).
 */
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const plResource = JSON.parse(
  fs.readFileSync(path.join(root, 'public/locales/pl/translation.json'), 'utf8')
);

function resolvePath(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[seg];
    }
    return undefined;
  }, obj);
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const resolved = resolvePath(plResource, key);
      if (opts?.returnObjects) return resolved ?? {};
      return typeof resolved === 'string' ? resolved : (opts?.defaultValue ?? key);
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationScenariosBriefScreen from '../OrganizationScenariosBriefScreen';

vi.mock('../../../../store/useContextBuilderStore');

function renderScreen() {
  return render(
    <OrganizationScenariosBriefScreen>{(args) => <div>{args.content}</div>}</OrganizationScenariosBriefScreen>
  );
}

describe('OrganizationScenariosBriefScreen — nazwy scenariuszy po polsku (plan 05.09 poz. 6)', () => {
  beforeEach(() => {
    vi.mocked(useContextBuilderStore).mockReturnValue({
      synthesis: { risks: [], strengths: [], selectedScenarioId: 'ai-powered' },
      setSynthesis: vi.fn(),
      challenges: { declaredChallenges: [] },
      goals: { strategicGoals: [], successMetrics: [] },
      companyProfile: {
        companyName: 'Northstar',
        industry: 'Manufacturing',
        employees: '500',
        revenue: '50M',
        currentMaturityLevel: 'Level 2',
        targetMaturityLevel: 'Level 4',
        activeConstraints: [],
        constraintDetails: {},
      },
    } as never);
  });

  it('karta scenariusza pokazuje polską nazwę i opis, nie angielski oryginał', () => {
    renderScreen();

    // Polskie tłumaczenie istniejące w pl.json (transformationScenarios.scenarios.digital-foundation.name)
    expect(screen.getByText('Fundament cyfrowy')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Zbuduj podstawowe zdolności cyfrowe i infrastrukturę, zanim przyspieszysz transformację.'
      )
    ).toBeInTheDocument();

    // Angielski oryginał NIE powinien się nigdzie pojawić.
    expect(screen.queryByText('Digital Foundation')).not.toBeInTheDocument();
    expect(screen.queryByText('AI-Powered Transformation')).not.toBeInTheDocument();
  });

  it('rekomendowany kierunek w nagłówku sekcji też jest po polsku', () => {
    renderScreen();
    expect(screen.getByText(/rekomendowany kierunek to/)).toHaveTextContent(
      /Fundament cyfrowy|Rewolucja doświadczenia klienta|Doskonałość operacyjna|Transformacja napędzana AI|Innowacja modelu biznesowego|Organizacja oparta na danych/
    );
  });

  it('"Wybrany scenariusz" w Executive brief jest po polsku (selectedScenarioId=ai-powered)', () => {
    renderScreen();
    // Nazwa pojawia się dwa razy: karta scenariusza + pole "Wybrany scenariusz".
    expect(screen.getAllByText('Transformacja napędzana AI').length).toBeGreaterThanOrEqual(2);
  });
});
