import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealUseTranslation } from '@/test-utils/realTranslations';

const locale = vi.hoisted(() => ({ value: 'en' as 'en' | 'pl' }));
const fixture = (encoded: string): string => Buffer.from(encoded, 'base64').toString('utf8');

vi.mock('react-i18next', () => ({
  useTranslation: () => createRealUseTranslation(locale.value)(),
}));

import { DeckBuilderMelsView } from '../DeckBuilderMelsView';

const handlers = {
  onHistory: vi.fn(),
  onQa: vi.fn(),
  onGovernance: vi.fn(),
  onAnalytics: vi.fn(),
  onAudit: vi.fn(),
  onShare: vi.fn(),
  onToggleAgent: vi.fn(),
  onRun: vi.fn(),
};

function renderView(moduleLabel?: string): HTMLElement {
  render(
    <DeckBuilderMelsView
      title={fixture('UXVhcnRlcmx5IHVwZGF0ZQ==')}
      moduleLabel={moduleLabel}
      topBarHandlers={handlers}
      leftRail={<div>{fixture('U2xpZGVz')}</div>}
      canvas={<div>{fixture('RGVjayBjYW52YXM=')}</div>}
      persistRailState={false}
    />
  );
  return screen.getByTestId('mels-topbar');
}

describe('DeckBuilderMelsView module label', () => {
  beforeEach(() => {
    locale.value = 'en';
  });

  it('uses the shipped English translation when no label is supplied', () => {
    expect(within(renderView()).getByText(fixture('UHJlc2VudGF0aW9ucw=='))).toBeInTheDocument();
  });

  it('uses the shipped Polish translation when no label is supplied', () => {
    locale.value = 'pl';
    expect(within(renderView()).getByText('Prezentacje')).toBeInTheDocument();
  });

  it('keeps an explicit caller label ahead of the locale fallback', () => {
    locale.value = 'pl';
    const explicitLabel = fixture('RXhlY3V0aXZlIGRlY2tz');
    const topBar = renderView(explicitLabel);
    expect(within(topBar).getByText(explicitLabel)).toBeInTheDocument();
    expect(within(topBar).queryByText('Prezentacje')).not.toBeInTheDocument();
  });
});
