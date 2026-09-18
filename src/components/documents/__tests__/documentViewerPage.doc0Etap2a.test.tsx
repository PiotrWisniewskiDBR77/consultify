// @vitest-environment jsdom

/**
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q1) — the screen behind
 * `/documents/:artifactId`.
 *
 * A deep link (chat message, e-mail, browser history) carries ONLY the artifact
 * id — no row object, no title, no status. Etap 1 mounted `DocumentViewer` as an
 * overlay inside the Materials list, so the header came from the clicked row;
 * this screen must fill the same header from the EXISTING registry read model
 * (`GET /api/artifacts/:id` + `.../action-target`), with no new endpoint and no
 * `server/**` change. That is what is asserted here, on the real component:
 *
 *   1. exactly those two reads fire, with the id from the prop;
 *   2. title/status/owner/updated come from the response, not from the caller;
 *   3. the status label goes through the `documents.viewer.statusLabel.*`
 *      dictionary key (i18next cannot resolve `a.b.c` when `a.b` is already a
 *      string — `documents.viewer.status` is "Status");
 *   4. Edit = the server's own open path (so "Edit" here lands where "Edit" in
 *      the list lands), falling back to `resolveArtifactOpenPath`, and omitted
 *      entirely when neither is known (never an invented target);
 *   5. Close = back to the Materials list with the row selected.
 *
 * MUTACJE: (a) drop `.../action-target` from `loadDocumentMeta` → test 1 and the
 * server-openPath test RED; (b) `tr(\`statusLabel.${key}\`)` → `tr(\`status.${key}\`)`
 * → test 3 RED (unresolvable key); (c) `navigate(buildDocumentViewerListPath(...))`
 * → `navigate('/presentations')` → test 5 RED.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const navigateSpy = vi.hoisted(() => vi.fn());
const viewerProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('@/services/api', () => ({ Api: { get: apiGet } }));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateSpy }));

// `t` returns the KEY: the assertion below is on the dictionary path, which is
// the whole point (a key that cannot resolve renders as the key itself).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('@/components/MyWork/Decision/workspaceHelpers', () => ({
  formatDateTime: (value: string) => value,
}));

vi.mock('../DocumentViewer', () => ({
  // Label-less stub buttons on purpose: the J0 language gate counts EN/PL
  // literals in JSX, and these are test-only handles clicked by testid.
  DocumentViewer: (props: any) => {
    viewerProps.current = props;
    return (
      <div
        data-testid="doc0-viewer-stub"
        data-artifact-id={props.artifactId}
        data-title={props.title ?? ''}
        data-status-label={props.statusLabel ?? ''}
        data-owner={props.ownerName ?? ''}
        data-updated-at={props.updatedAt ?? ''}
        data-origin-record-id={props.originRecordId ?? ''}
      >
        <button type="button" data-testid="doc0-viewer-edit" onClick={props.onEdit} />
        <button type="button" data-testid="doc0-viewer-close" onClick={props.onClose} />
      </div>
    );
  },
}));

import { getArtifactPath } from '@/utils/artifactLinks';

import { DocumentViewerPage } from '../DocumentViewerPage';

const ARTIFACT_ID = 'art-doc0-7';
const ORIGIN_RECORD_ID = 'rpt-doc0-7';

function registryBody(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      resolvedTitle: 'Annual operations review',
      // Real captured shape (staging row 4d6600e3…, dump copy 2026-09-18):
      // `deliveryState` is the registry vocabulary, `originStatus` the Report
      // Builder one — the header must not depend on which of them arrives.
      deliveryState: 'ready',
      originStatus: 'APPROVED',
      ownerName: 'Owner Name',
      lastTransitionAt: '2026-09-15T10:00:00.000Z',
      originRecordId: ORIGIN_RECORD_ID,
      ...overrides,
    },
  };
}

function actionTargetBody(overrides: Record<string, unknown> = {}) {
  return { data: { openPath: '/reports/builder/rpt-doc0-7', ...overrides } };
}

beforeEach(() => {
  vi.clearAllMocks();
  viewerProps.current = null;
  apiGet.mockImplementation((url: string) => {
    if (url.endsWith('/action-target')) return Promise.resolve(actionTargetBody());
    if (url.startsWith('/artifacts/')) return Promise.resolve(registryBody());
    return Promise.resolve({ data: {} });
  });
});

async function renderPage(artifactId: string = ARTIFACT_ID) {
  const utils = render(<DocumentViewerPage artifactId={artifactId} />);
  await screen.findByTestId('doc0-viewer-stub');
  return utils;
}

describe('DocumentViewerPage — deep link fills the header from the registry', () => {
  it('reads EXACTLY the two existing registry endpoints, with the id from the URL', async () => {
    await renderPage();
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(apiGet).toHaveBeenCalledWith(`/artifacts/${ARTIFACT_ID}`);
    expect(apiGet).toHaveBeenCalledWith(`/artifacts/${ARTIFACT_ID}/action-target`);
  });

  it('shows the loading state until the registry answers', async () => {
    // `loadDocumentMeta` fires BOTH reads in `Promise.all`, so every pending
    // resolver must be settled — releasing only one would hang forever.
    const pending: Array<(value: unknown) => void> = [];
    apiGet.mockImplementation(
      (url: string) =>
        new Promise((resolvePromise) => {
          pending.push(resolvePromise);
          void url;
        })
    );
    render(<DocumentViewerPage artifactId={ARTIFACT_ID} />);
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
    expect(screen.getByText('documents.viewer.loading')).toBeInTheDocument();
    await waitFor(() => expect(pending.length).toBe(2));
    pending.forEach((resolvePromise) => resolvePromise(registryBody()));
    await waitFor(() => expect(screen.getByTestId('doc0-viewer-stub')).toBeInTheDocument());
  });

  it('name · status · owner · updated come from the response, not from the caller', async () => {
    await renderPage();
    const stub = screen.getByTestId('doc0-viewer-stub');
    expect(stub.getAttribute('data-artifact-id')).toBe(ARTIFACT_ID);
    expect(stub.getAttribute('data-title')).toBe('Annual operations review');
    expect(stub.getAttribute('data-owner')).toBe('Owner Name');
    expect(stub.getAttribute('data-updated-at')).toBe('2026-09-15T10:00:00.000Z');
    expect(stub.getAttribute('data-origin-record-id')).toBe(ORIGIN_RECORD_ID);
  });

  it('resolves the status through the documents.viewer.statusLabel.* key', async () => {
    await renderPage();
    expect(screen.getByTestId('doc0-viewer-stub').getAttribute('data-status-label')).toBe(
      'documents.viewer.statusLabel.ready'
    );
  });

  it('a null ownerName (as on the real captured row) omits the owner, never renders "null"', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/action-target')) return Promise.resolve(actionTargetBody());
      return Promise.resolve(registryBody({ ownerName: null }));
    });
    await renderPage();
    expect(screen.getByTestId('doc0-viewer-stub').getAttribute('data-owner')).toBe('');
  });

  it('an unknown status key renders nothing rather than a made-up label', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/action-target')) {
        return Promise.resolve(actionTargetBody({ originStatus: 'cos-dziwnego' }));
      }
      return Promise.resolve(
        registryBody({ deliveryState: 'cos-dziwnego', originStatus: 'cos-dziwnego' })
      );
    });
    await renderPage();
    expect(screen.getByTestId('doc0-viewer-stub').getAttribute('data-status-label')).toBe('');
  });

  it('an unreachable registry still renders the viewer (honest empty header, no white screen)', async () => {
    apiGet.mockRejectedValue(new Error('503'));
    await renderPage();
    const stub = screen.getByTestId('doc0-viewer-stub');
    expect(stub.getAttribute('data-title')).toBe('');
    expect(stub.getAttribute('data-status-label')).toBe('');
    // No openPath and no originRecordId → no Edit action at all.
    expect(viewerProps.current.onEdit).toBeUndefined();
  });
});

describe('DocumentViewerPage — Edit and Close targets', () => {
  it('Edit goes to the server open path (same target as Edit in the list)', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('doc0-viewer-edit'));
    expect(navigateSpy).toHaveBeenCalledWith('/reports/builder/rpt-doc0-7');
  });

  it('Edit falls back to the canonical artifact path when the server gives no open path', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/action-target')) return Promise.resolve({ data: {} });
      return Promise.resolve(registryBody());
    });
    await renderPage();
    fireEvent.click(screen.getByTestId('doc0-viewer-edit'));
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', ORIGIN_RECORD_ID));
  });

  it('Close returns to the Materials list with the same row selected', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('doc0-viewer-close'));
    expect(navigateSpy).toHaveBeenCalledWith(
      `/presentations?tab=documents&artifactId=${ARTIFACT_ID}`
    );
  });
});
