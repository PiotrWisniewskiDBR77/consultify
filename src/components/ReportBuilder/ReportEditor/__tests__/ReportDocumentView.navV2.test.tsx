/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type BlockConfig, ReportDocumentView, type ReportStyling } from '../ReportEditor';
import source from '../ReportEditor.tsx?raw';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback: string | { defaultValue?: string }) =>
        typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('../../blocks/SmartBlockRenderer', () => ({
  SmartBlockRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

const styling: ReportStyling = {
  theme: 'professional',
  primaryColor: 'currentColor',
  accentColor: 'currentColor',
  fontFamily: 'inter',
  showLogo: false,
  showBranding: false,
};

const block = (id: string, orderIndex: number): BlockConfig => {
  const value = {
    id,
    type: 'summary',
    length: 'medium',
    includeVisuals: false,
    enabled: true,
    orderIndex,
  } as BlockConfig;
  value.title = String(orderIndex + 1);
  value.content = String(orderIndex + 101);
  return value;
};

describe('RB-3 D-95 whole-document Publish contract', () => {
  it('renders every enabled report block in document order', () => {
    render(
      <ReportDocumentView
        blocks={[block('third', 2), block('first', 0), block('second', 1)]}
        reportTitle={String(0)}
        styling={styling}
      />
    );

    const sections = screen.getByTestId('report-builder-document-view').querySelectorAll('section');
    expect(sections).toHaveLength(3);
    expect(Array.from(sections).map((section) => section.textContent)).toEqual([
      '1101',
      '2102',
      '3103',
    ]);
  });

  it('passes the complete block collection from Review/Publish canvas to the document view', () => {
    expect(source).toContain('<ReportDocumentView blocks={blocks}');
    expect(source).not.toContain('<ReportDocumentView blocks={blocks.slice(');
  });
});
