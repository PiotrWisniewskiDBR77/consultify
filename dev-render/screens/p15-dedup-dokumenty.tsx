/**
 * P15 — dowód wizualny: dwa RÓŻNE dokumenty o tej samej nazwie muszą być
 * widoczne jako dwa wpisy na liście Materiałów.
 *
 * Montuje REALNY `<OutputsAggregateTabContent />` (StandardTable + StandardPreview),
 * wzór: dev-render/screens/materials-registry.tsx (CLAUDE.md #7 — zrzut powstaje
 * ZANIM właściciel zobaczy ekran).
 *
 * Wiersze NIE są ręcznym mockiem: generuje je `scripts/dev/p15-dedup-generuj-wiersze.ts`,
 * przepuszczając dwa artefakty przez PRAWDZIWĄ serwerową `dedupeArtifacts`.
 *   ?stan=przed → wynik sprzed naprawy (klucz po tytule)   → JEDEN wiersz
 *   ?stan=po    → wynik po naprawie (klucz po tożsamości)  → DWA wiersze
 */
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { OutputsAggregateTabContent } from '../../src/components/ReportsAndPresentations/OutputsAggregateTabContent';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';
import poNaprawie from '../mocks/p15-dedup-rows.json';
import przedNaprawa from '../mocks/p15-dedup-rows-przed.json';

const actions = {
  exportReportPdf: async () => {},
  exportDeckPptx: async () => {},
  archiveReport: async () => true,
  archiveDeck: async () => true,
  startArtifactReview: async () => true,
} as any;

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.setAttribute('data-theme', theme);
void i18n.changeLanguage(params.get('lang') === 'en' ? 'en' : 'pl');

const stan = params.get('stan') === 'przed' ? 'przed' : 'po';
const zrodlo = stan === 'przed' ? przedNaprawa : poNaprawie;

export default function P15DedupDokumentyScreen(): React.ReactElement {
  return (
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsProvider showDevTools={false}>
        <MemoryRouter initialEntries={['/presentations?tab=all']}>
          <div className="min-h-screen bg-c-bg p-6">
            <div className="w-full">
              <div className="mb-4" data-dev-render-chrome="true">
                <h1 className="text-lg font-semibold text-c-text">
                  Materiały — Wszystkie · dwa dokumenty o tej samej nazwie
                </h1>
                <p className="text-sm text-c-text-secondary">
                  {stan === 'przed'
                    ? 'PRZED naprawą: dedup po tytule — 2 dokumenty na wejściu, 1 wiersz na liście.'
                    : 'PO naprawie: dedup po tożsamości — 2 dokumenty na wejściu, 2 wiersze na liście.'}
                </p>
              </div>
              <div className="h-[640px] rounded-2xl border border-c-border-subtle overflow-hidden">
                <OutputsAggregateTabContent
                  viewMode="table"
                  searchQuery=""
                  activeFilters={[]}
                  onFilterChange={() => {}}
                  rows={(zrodlo as any).wiersze as any}
                  loading={false}
                  error={null}
                  onRefresh={() => {}}
                  actions={actions}
                />
              </div>
            </div>
          </div>
        </MemoryRouter>
      </FeatureFlagsProvider>
    </I18nextProvider>
  );
}
