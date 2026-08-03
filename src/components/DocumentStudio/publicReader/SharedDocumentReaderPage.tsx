/**
 * F1/F3 — Client Reader page (`ff_client_reader`, robota 2026-07-22).
 *
 * Public, UNAUTHENTICATED route (`/shared/doc/:token`) rendering a
 * Document Studio artifact read-only through a share-link token — the
 * "tryb czytania klienta": zero editor chrome (no Menu 1, no right
 * panel, no toolbar), just title + document typography capped at
 * ~72ch, matching the reading experience of the doc itself rather
 * than the internal editor canvas.
 *
 * Loads the whitelisted projection from `POST /share-links/document`
 * (never the internal `getDocumentArtifact` route — that is behind
 * `verifyToken` and would 401 for an anonymous visitor). When the
 * resolved `accessScope` is `'comment'` or `'edit'`, also mounts
 * `ReaderCommentsPanel` beneath the document body.
 *
 * States: loading skeleton → 404/expired notice → rendered document.
 * Dark + light via `c-*` tokens only, zero crimson.
 */

import { FileWarning } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  ClientReaderApiError,
  getSharedDocument,
  type GetSharedDocumentResult,
} from './clientReaderApi';
import { ReaderBlockRenderer } from './ReaderBlockRenderer';
import { ReaderCommentsPanel } from './ReaderCommentsPanel';

function PageShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="min-h-screen bg-c-surface-raised">
      <div className="mx-auto w-full max-w-[72ch] px-6 py-12">{children}</div>
    </div>
  );
}

function LoadingState(): React.ReactElement {
  return (
    <PageShell>
      <div className="space-y-4" data-testid="reader-loading">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-c-border-subtle" />
        <div className="h-4 w-full animate-pulse rounded bg-c-border-subtle" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-c-border-subtle" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-c-border-subtle" />
      </div>
    </PageShell>
  );
}

function ErrorState({ code }: { code: string }): React.ReactElement {
  const message =
    code === 'share_link_invalid_or_expired'
      ? 'Ten link do dokumentu wygasł, został unieważniony albo nigdy nie istniał.'
      : 'Nie udało się załadować dokumentu.';
  return (
    <PageShell>
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-c-border-subtle bg-c-surface px-6 py-12 text-center"
        data-testid="reader-error"
      >
        <FileWarning size={28} className="text-c-text-secondary" aria-hidden="true" />
        <p className="text-sm text-c-text">{message}</p>
      </div>
    </PageShell>
  );
}

export function SharedDocumentReaderPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<GetSharedDocumentResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorCode('token_required');
      return;
    }
    let cancelled = false;
    setResult(null);
    setErrorCode(null);
    getSharedDocument(token)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((e) => {
        if (cancelled) return;
        setErrorCode(e instanceof ClientReaderApiError ? e.code : 'load_failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (errorCode) return <ErrorState code={errorCode} />;
  if (!result) return <LoadingState />;

  const { document, accessScope } = result;
  const sortedSections = [...document.sections];
  const canComment = accessScope === 'comment' || accessScope === 'edit';

  return (
    <PageShell>
      <header className="mb-8 border-b border-c-border-subtle pb-6">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-c-text-secondary">
          Tryb czytania klienta
        </div>
        <h1 className="text-2xl font-semibold leading-snug text-c-text" data-testid="reader-title">
          {document.title}
        </h1>
      </header>

      <article data-testid="reader-body">
        {sortedSections.map((section) => (
          <section
            key={section.sectionId}
            className="mb-8"
            data-testid={`reader-section-${section.sectionId}`}
          >
            <h2 className="mb-3 text-lg font-semibold text-c-text">{section.title}</h2>
            {section.blocks.map((block) => (
              <ReaderBlockRenderer key={block.blockId} block={block} />
            ))}
          </section>
        ))}
      </article>

      {canComment && token ? <ReaderCommentsPanel token={token} /> : null}
    </PageShell>
  );
}

export default SharedDocumentReaderPage;
