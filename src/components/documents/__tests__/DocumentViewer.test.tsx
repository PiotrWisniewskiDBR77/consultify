/**
 * @vitest-environment jsdom
 *
 * DOC-0 (DEC-593) — the read-only document viewer on the shared SPEC-A shell.
 *
 * Under test is the DECISION, not the pixels:
 *   · the viewer renders the projected markdown of whichever registry served it
 *     (through the single `documentContentResolver` adapter — no per-registry branch
 *     in the component);
 *   · it is READ-ONLY: the title is not editable and there is no primary CTA unless
 *     the caller explicitly supplies an Edit path (Report Builder stays behind Edit);
 *   · the three non-ready states are HONEST and distinct — a row with no stored
 *     content says so instead of showing a blank page that looks fine.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const translate = (k: string, opts?: string | { defaultValue?: string }) =>
    (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k;
  return {
    useTranslation: () => ({
      t: translate,
      // `NModeToolbar` (inside StandardArtifactShell) reads a fixed-language `t`.
      i18n: { language: 'en', getFixedT: () => translate, changeLanguage: async () => undefined },
    }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    Translation: ({ children }: any) => children({ t: translate, i18n: {} }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
  };
});

import { DocumentViewer } from '../DocumentViewer';

const ARTIFACT_URL = '/api/artifacts/art-doc0-1/content';
const CANVAS_URL = '/api/work-canvas/drafts/wc-doc0-1';

interface StubRoute {
  status?: number;
  body?: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(contentMd: string) {
  return {
    artifactId: 'art-doc0-1',
    origin: { originRuntime: 'native_artifact', originRecordId: 'wc-doc0-1' },
    envelope: {
      envelopeVersion: 'artifact-content/v1',
      canonicalFormat: 'markdown',
      canonicalKind: 'document',
      contentSchemaVersion: '1',
      contentMd,
      artifactType: 'report',
      markdownProjectionStatus: 'synced',
      projection: { status: 'synced', completeness: 'full' },
      provenance: {},
    },
  };
}

let routes: Record<string, StubRoute> = {};
const fetchMock = vi.fn();

beforeEach(() => {
  routes = {};
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes[url];
    if (!route) return jsonResponse(404, { error: 'not stubbed' });
    return jsonResponse(route.status ?? 200, route.body ?? {});
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DocumentViewer — ready state', () => {
  it('renders the projected markdown and the row title', async () => {
    routes[ARTIFACT_URL] = {
      status: 200,
      body: envelope('# Q3 operating plan\n\nMargin holds at 42 percent.\n'),
    };

    render(
      <DocumentViewer
        artifactId="art-doc0-1"
        title="Q3 operating plan"
        statusLabel="Ready"
        ownerName="Piotr"
        onClose={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByText('Margin holds at 42 percent.')).toBeTruthy());
    expect(screen.getAllByText('Q3 operating plan').length).toBeGreaterThan(0);
  });

  it('names the serving registry in Properties (canvas fallback included)', async () => {
    routes[ARTIFACT_URL] = {
      status: 404,
      body: { error: { code: 'ARTIFACT_CONTENT_ORIGIN_NOT_FOUND' } },
    };
    routes[CANVAS_URL] = {
      status: 200,
      body: { data: { draft: { contentMd: '# Canvas body', title: 'Canvas doc' } } },
    };

    render(
      <DocumentViewer artifactId="art-doc0-1" originRecordId="wc-doc0-1" onClose={() => {}} />
    );

    await waitFor(() => expect(screen.getByText('Work Canvas draft')).toBeTruthy());
    expect(screen.getByText('Content registry')).toBeTruthy();
  });
});

describe('DocumentViewer — read-only contract (DEC-593)', () => {
  it('has no primary action and a non-editable title when the caller gives no edit path', async () => {
    routes[ARTIFACT_URL] = { status: 200, body: envelope('# Doc\n\nBody.') };

    render(<DocumentViewer artifactId="art-doc0-1" title="Doc" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText('Body.')).toBeTruthy());
    expect(screen.queryByText('Edit')).toBeNull();
    // Read-only surface: the shell renders no writable control at all.
    expect(
      document.querySelectorAll(
        'input:not([readonly]), textarea:not([readonly]), [contenteditable="true"]'
      ).length
    ).toBe(0);
  });

  it('exposes editing only through the explicit Edit action', async () => {
    routes[ARTIFACT_URL] = { status: 200, body: envelope('# Doc\n\nBody.') };
    const onEdit = vi.fn();

    render(<DocumentViewer artifactId="art-doc0-1" title="Doc" onClose={() => {}} onEdit={onEdit} />);

    await waitFor(() => expect(screen.getByText('Body.')).toBeTruthy());
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentViewer — honest non-ready states', () => {
  it('says the row has no stored content (the DEC-595 orphans) instead of showing a blank page', async () => {
    routes[ARTIFACT_URL] = { status: 404, body: { error: { code: 'ARTIFACT_CONTENT_ORIGIN_NOT_FOUND' } } };
    routes[CANVAS_URL] = { status: 404, body: { error: 'Draft not found' } };

    render(
      <DocumentViewer artifactId="art-doc0-1" originRecordId="wc-doc0-1" onClose={() => {}} />
    );

    await waitFor(() =>
      expect(screen.getByText('No content is stored for this document.')).toBeTruthy()
    );
  });

  it('distinguishes a retryable transport fault from missing content', async () => {
    routes[ARTIFACT_URL] = { status: 503, body: { error: 'upstream down' } };

    render(<DocumentViewer artifactId="art-doc0-1" onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText('The document could not be loaded. Try again.')).toBeTruthy()
    );
  });

  it('reports an empty body as empty, not as an error', async () => {
    routes[ARTIFACT_URL] = { status: 200, body: envelope('   ') };

    render(<DocumentViewer artifactId="art-doc0-1" title="Doc" onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText('This document has no content yet.')).toBeTruthy()
    );
  });
});
