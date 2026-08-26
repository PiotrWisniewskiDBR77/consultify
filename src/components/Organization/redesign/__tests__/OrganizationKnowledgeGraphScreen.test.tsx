/**
 * „Graf wiedzy" — jedenasty ekran redesignu (etap B), ostatni z dziesięciu
 * przełożonych w tym kroku. Ekran samodzielny bez zmian treści — sprawdzamy,
 * że montuje REALNY `KnowledgeGraphExplorer` (`Api.kg*`), i że naprawiony
 * przy okazji focus-ring pola wyszukiwania nie jest już crimson.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import OrganizationKnowledgeGraphScreen from '../OrganizationKnowledgeGraphScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  Api: {
    kgGetStats: vi.fn(),
    kgSearchEntities: vi.fn(),
  },
}));

describe('OrganizationKnowledgeGraphScreen', () => {
  beforeEach(() => {
    vi.mocked(Api.kgGetStats).mockResolvedValue({
      entityCount: 12,
      relationCount: 30,
      byType: {},
      lastUpdated: new Date().toISOString(),
    });
  });

  it('montuje REALNY KnowledgeGraphExplorer (Api.kgGetStats) bez crimson focus-ring', async () => {
    const { container } = render(<OrganizationKnowledgeGraphScreen />);

    await waitFor(() => expect(Api.kgGetStats).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Search knowledge graph entities...')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/focus:ring-primary-/);
  });
});
