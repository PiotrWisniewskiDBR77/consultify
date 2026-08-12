/**
 * @vitest-environment jsdom
 *
 * `StatementReportActionsSection` (brief pkt 8) — dowodzi:
 *   - trzy JAWNE kroki, każdy z tekstowym statusem (a11y, nie tylko kolor);
 *   - sekwencja wymuszona STANEM: krok 2 zablokowany, dopóki szkic nie jest
 *     gotowy; krok 3 zablokowany, dopóki wynik nie został OTWARTY (nie tylko
 *     wygenerowany);
 *   - powód blokady jest WIDOCZNY tekstem, nie tylko `disabled` bez wyjaśnienia;
 *   - kliknięcie wywołuje właściwy callback;
 *   - kontrola negatywna.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StatementReportActionsSection } from '../StatementReportActionsSection';

describe('StatementReportActionsSection — sequential gating', () => {
  it('step 1 (draft) is always clickable from not_started; steps 2/3 are blocked WITH a visible reason', () => {
    render(
      <StatementReportActionsSection
        draftStatus="not_started"
        draftError={null}
        openStatus="blocked"
        publishStatus="blocked"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-button-draft')).not.toBeDisabled();
    expect(screen.getByTestId('statement-report-step-button-open')).toBeDisabled();
    expect(screen.getByTestId('statement-report-step-reason-open')).toHaveTextContent('Najpierw wygeneruj szkic');
    expect(screen.getByTestId('statement-report-step-button-publish')).toBeDisabled();
    expect(screen.getByTestId('statement-report-step-reason-publish')).toHaveTextContent('Najpierw otwórz wynik');
  });

  it('step 2 (open) unlocks once draftStatus is ready; step 3 remains blocked until opened', () => {
    render(
      <StatementReportActionsSection
        draftStatus="ready"
        draftError={null}
        openStatus="available"
        publishStatus="blocked"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-button-open')).not.toBeDisabled();
    expect(screen.queryByTestId('statement-report-step-reason-open')).not.toBeInTheDocument();
    expect(screen.getByTestId('statement-report-step-button-publish')).toBeDisabled();
    expect(screen.getByTestId('statement-report-step-reason-publish')).toHaveTextContent('Najpierw otwórz wynik');
  });

  it('step 3 (publish) unlocks ONLY after the result has actually been opened (openStatus=opened), not merely available', () => {
    render(
      <StatementReportActionsSection
        draftStatus="ready"
        draftError={null}
        openStatus="opened"
        publishStatus="available"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-button-publish')).not.toBeDisabled();
    expect(screen.queryByTestId('statement-report-step-reason-publish')).not.toBeInTheDocument();
  });

  it('every step exposes its status as legible TEXT (a11y — never color alone)', () => {
    render(
      <StatementReportActionsSection
        draftStatus="failed"
        draftError="Serwer nie odpowiedział"
        openStatus="blocked"
        publishStatus="blocked"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-status-draft')).toHaveTextContent('Serwer nie odpowiedział');
  });

  it('clicking each enabled step calls its own callback, not a shared handler', () => {
    const onGenerateDraft = vi.fn();
    const onOpenResult = vi.fn();
    const onPublish = vi.fn();
    render(
      <StatementReportActionsSection
        draftStatus="ready"
        draftError={null}
        openStatus="opened"
        publishStatus="available"
        publishError={null}
        onGenerateDraft={onGenerateDraft}
        onOpenResult={onOpenResult}
        onPublish={onPublish}
      />
    );
    fireEvent.click(screen.getByTestId('statement-report-step-button-draft'));
    fireEvent.click(screen.getByTestId('statement-report-step-button-open'));
    fireEvent.click(screen.getByTestId('statement-report-step-button-publish'));
    expect(onGenerateDraft).toHaveBeenCalledTimes(1);
    expect(onOpenResult).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('once published, the publish button is disabled again with an explicit "already published" reason (no double-publish)', () => {
    render(
      <StatementReportActionsSection
        draftStatus="ready"
        draftError={null}
        openStatus="opened"
        publishStatus="published"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-button-publish')).toBeDisabled();
    expect(screen.getByTestId('statement-report-step-reason-publish')).toHaveTextContent('Już opublikowano');
    expect(screen.getByTestId('statement-report-step-status-publish')).toHaveTextContent('Opublikowano');
  });

  // KONTROLA NEGATYWNA: rerender z innym stanem musi zmienić i status, i disabled.
  it('NEGATIVE CONTROL — rerendering from not_started to ready flips the draft status text and unlocks step 2', () => {
    const { rerender } = render(
      <StatementReportActionsSection
        draftStatus="not_started"
        draftError={null}
        openStatus="blocked"
        publishStatus="blocked"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-status-draft')).toHaveTextContent('Nie rozpoczęto');
    expect(screen.getByTestId('statement-report-step-button-open')).toBeDisabled();

    rerender(
      <StatementReportActionsSection
        draftStatus="ready"
        draftError={null}
        openStatus="available"
        publishStatus="blocked"
        publishError={null}
        onGenerateDraft={() => {}}
        onOpenResult={() => {}}
        onPublish={() => {}}
      />
    );
    expect(screen.getByTestId('statement-report-step-status-draft')).toHaveTextContent('Szkic gotowy');
    expect(screen.getByTestId('statement-report-step-status-draft')).not.toHaveTextContent('Nie rozpoczęto');
    expect(screen.getByTestId('statement-report-step-button-open')).not.toBeDisabled();
  });
});
