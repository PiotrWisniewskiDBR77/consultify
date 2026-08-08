/**
 * @vitest-environment jsdom
 *
 * CB-01 / RV-013 — the shared open-document tab strip (used by every module's
 * StandardModuleBar, including the Interview Insight Viewer) must name its
 * close and back-to-list actions, and keep the close action reachable by
 * keyboard focus, not only pointer hover.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultOrOpts?: any, maybeOpts?: any) => {
      const opts =
        typeof maybeOpts === 'object'
          ? maybeOpts
          : typeof defaultOrOpts === 'object'
            ? defaultOrOpts
            : undefined;
      const fallback =
        typeof defaultOrOpts === 'string' ? defaultOrOpts : (opts?.defaultValue ?? key);
      if (!opts) return fallback;
      return Object.keys(opts).reduce(
        (str, k) => str.replace(`{{${k}}}`, String(opts[k])),
        fallback
      );
    },
  }),
}));

import { DynamicTabs } from '../DynamicTabs';
import type { OpenDocument } from '../types';

const DOC: OpenDocument = {
  id: 'insight-1',
  type: 'interview_insight',
  subType: 'DRD',
  name: 'Digital transformation readiness',
  status: 'DRAFT',
};

describe('DynamicTabs — RV-013 open-document close/back accessible contract', () => {
  it('names the close action with the document name instead of an unnamed icon button', () => {
    render(
      <DynamicTabs
        documents={[DOC]}
        activeDocumentId={DOC.id}
        onSelectDocument={vi.fn()}
        onCloseDocument={vi.fn()}
        onShowList={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /Close Digital transformation readiness/i })
    ).toBeInTheDocument();
  });

  it('names the back-to-list action', () => {
    render(
      <DynamicTabs
        documents={[DOC]}
        activeDocumentId={DOC.id}
        onSelectDocument={vi.fn()}
        onCloseDocument={vi.fn()}
        onShowList={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Back to list/i })).toBeInTheDocument();
  });

  it('invokes onCloseDocument with the document id and stops the row select from firing', () => {
    const onCloseDocument = vi.fn();
    const onSelectDocument = vi.fn();
    render(
      <DynamicTabs
        documents={[DOC]}
        activeDocumentId={DOC.id}
        onSelectDocument={onSelectDocument}
        onCloseDocument={onCloseDocument}
        onShowList={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Close Digital transformation readiness/i })
    );

    expect(onCloseDocument).toHaveBeenCalledWith('insight-1');
    expect(onSelectDocument).not.toHaveBeenCalled();
  });

  it('the close action remains focusable and reveals on keyboard focus (not opacity-0 at rest only)', () => {
    render(
      <DynamicTabs
        documents={[DOC]}
        activeDocumentId={DOC.id}
        onSelectDocument={vi.fn()}
        onCloseDocument={vi.fn()}
        onShowList={vi.fn()}
      />
    );

    const closeButton = screen.getByRole('button', {
      name: /Close Digital transformation readiness/i,
    });
    closeButton.focus();
    expect(closeButton).toHaveFocus();
    expect(closeButton.className).toMatch(/focus(-visible)?:opacity-100/);
  });
});
