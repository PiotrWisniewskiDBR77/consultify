import { render } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';
import { getCanvasActionAvailability } from '../../../utils/canvas/canvasActionAvailability';
import { CanvasArtifactBlockRenderer } from '../CanvasArtifactBlockRenderer';

vi.unmock('react-i18next');

const productKeys = [
  'canvas.actions.copyMarkdown',
  'canvas.actions.shareDocument',
  'canvas.actions.saveDocument',
  'canvas.actions.close',
  'canvas.actions.documentView',
  'canvas.actions.markdownView',
  'canvas.actions.createPresentation',
  'canvas.actions.createSheet',
  'canvas.actions.createReport',
  'canvas.actions.sendToIdea',
  'canvas.actions.saveAsNote',
  'canvas.actions.createInitiative',
  'canvas.actions.captureDecision',
  'canvas.actions.createTask',
  'canvas.panel.dataset.table',
  'canvas.panel.dataset.chart',
  'canvas.panel.dataset.dashboard',
  'canvas.panel.dataset.findingsReport',
  'canvas.panel.dataset.profileSummary',
  'canvas.panel.dataset.aggregateChart',
  'canvas.panel.dataset.filteredTable',
  'canvas.panel.pendingOperation.removed',
  'canvas.panel.pendingOperation.added',
  'canvas.panel.pendingOperation.reviseEdit',
  'common.reset',
] as const;

describe('day374 Canvas literal Polish translations', () => {
  let testI18n: i18n;

  beforeAll(async () => {
    testI18n = i18next.createInstance();
    await testI18n.use(initReactI18next).init({
      lng: 'pl',
      fallbackLng: false,
      resources: {
        pl: { translation: plTranslation },
        en: { translation: enTranslation },
      },
      interpolation: { escapeValue: false },
    });
  });

  it('resolves every action, dataset, pending-operation and reset label in Polish', () => {
    for (const key of productKeys) {
      expect(testI18n.t(key)).not.toBe(key);
      expect(testI18n.t(key)).not.toBe(enTranslation.canvas?.actions?.createPresentation);
    }
    expect(testI18n.t('aiChat.confirmDeleteBulk', { count: 2 })).toBe('Usunąć 2 rozmowy?');
  });

  it('returns a Polish label from the real Canvas action resolver', () => {
    const availability = getCanvasActionAvailability(
      'create-presentation',
      null,
      {},
      testI18n.t.bind(testI18n)
    );
    expect(availability.label).toBe('Utwórz prezentację');
    expect(availability.label).not.toBe('Create presentation');
  });

  it('renders Polish research evidence headings in the real artifact component', () => {
    const block = {
      id: 'research-1',
      kind: 'research',
      title: 'Analiza rynku',
      status: 'ready',
      markdownProjection: '## Analiza',
      markdownProjectionStatus: 'ready',
      data: {
        question: 'Jak rośnie rynek?',
        findings: ['Wzrost'],
        sources: ['Źródło A'],
        contradictions: ['Brak'],
        gaps: ['Dane regionalne'],
        recommendations: ['Zweryfikuj segment'],
      },
    } as never;

    const { container } = render(
      <I18nextProvider i18n={testI18n}>
        <CanvasArtifactBlockRenderer block={block} />
      </I18nextProvider>
    );

    expect(container.textContent).toContain('Ustalenia');
    expect(container.textContent).toContain('Źródła');
    expect(container.textContent).toContain('Ograniczenia i sprzeczności');
    expect(container.textContent).not.toContain('Limitations / contradictions');
  });
});
