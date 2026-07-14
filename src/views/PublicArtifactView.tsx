/**
 * PublicArtifactView
 *
 * Public, read-only viewer for a shared work-canvas artifact
 * (route /public/artifacts/:token). No auth required — fetches the
 * backend's public GET /api/public/artifacts/:token with a plain
 * unauthenticated fetch (no Bearer header, no cookies needed).
 *
 * v1 renders markdown-backed kinds only; deck / sheet / table kinds get a
 * graceful "not yet available publicly" fallback (PL/EN follows the
 * `isPl` pattern used by PublicReportBuilderView).
 */
import { FileText, Presentation } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { API_URL } from '../services/api';

interface PublicArtifactData {
  title: string;
  kind: string;
  contentMd: string;
  updatedAt: string;
  orgBranding?: { name: string };
}

/** Kinds whose contentMd is a faithful full rendering of the artifact. */
const MARKDOWN_KINDS = new Set([
  'markdown',
  'document',
  'report',
  'research',
  'decision',
  'checklist',
]);

type ViewStatus = 'loading' | 'ok' | 'notfound' | 'expired' | 'error';

export const PublicArtifactView: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [data, setData] = useState<PublicArtifactData | null>(null);
  const [status, setStatus] = useState<ViewStatus>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      // Deliberately a plain fetch: this endpoint is public and must work
      // without any auth header or stored token.
      const res = await fetch(`${API_URL}/public/artifacts/${encodeURIComponent(token)}`);
      if (res.status === 404) {
        setStatus('notfound');
        return;
      }
      if (res.status === 410) {
        setStatus('expired');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const payload = (await res.json()) as PublicArtifactData;
      setData(payload);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const formattedUpdatedAt = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const isMarkdownKind = data ? MARKDOWN_KINDS.has(data.kind) : false;

  return (
    <div className="min-h-screen bg-c-bg">
      <header className="border-b border-c-border bg-c-surface/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
          <FileText size={18} className="text-c-accent" />
          <span className="text-sm font-semibold text-c-text">Consultify</span>
          <span className="text-xs text-c-text-muted">
            {isPl ? '· udostępniony dokument' : '· shared document'}
          </span>
          {data?.orgBranding?.name && (
            <span className="ml-auto text-xs text-c-text-muted">{data.orgBranding.name}</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {status === 'loading' && (
          <div className="py-20 text-center text-sm text-c-text-muted">
            {isPl ? 'Ładowanie…' : 'Loading…'}
          </div>
        )}

        {status === 'notfound' && (
          <div className="py-20 text-center">
            <div className="text-lg font-semibold text-c-text">
              {isPl ? 'Ten link nie jest już dostępny' : 'This link is no longer available'}
            </div>
            <p className="mt-2 text-sm text-c-text-muted">
              {isPl
                ? 'Udostępniony dokument mógł zostać usunięty lub link został cofnięty.'
                : 'The shared document may have been removed or the link was revoked.'}
            </p>
          </div>
        )}

        {status === 'expired' && (
          <div className="py-20 text-center">
            <div className="text-lg font-semibold text-c-text">
              {isPl ? 'Link wygasł' : 'This link has expired'}
            </div>
            <p className="mt-2 text-sm text-c-text-muted">
              {isPl
                ? 'Poproś autora o wygenerowanie nowego linku do udostępniania.'
                : 'Ask the author to generate a new share link.'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-20 text-center text-sm text-c-danger">
            {isPl
              ? 'Coś poszło nie tak podczas ładowania dokumentu.'
              : 'Something went wrong loading this document.'}
          </div>
        )}

        {status === 'ok' && data && !isMarkdownKind && (
          <div className="py-20 text-center">
            <Presentation size={28} className="mx-auto text-c-text-muted" />
            <div className="mt-3 text-lg font-semibold text-c-text">{data.title}</div>
            <p className="mt-2 text-sm text-c-text-muted">
              {isPl
                ? 'Ten artefakt nie jest jeszcze dostępny publicznie.'
                : 'This artifact is not publicly available yet.'}
            </p>
          </div>
        )}

        {status === 'ok' && data && isMarkdownKind && (
          <>
            <h1 className="text-2xl font-semibold text-c-text">{data.title}</h1>
            {formattedUpdatedAt && (
              <p className="mt-1 text-sm text-c-text-muted">
                {isPl ? 'Ostatnia aktualizacja: ' : 'Last updated: '}
                {formattedUpdatedAt}
              </p>
            )}
            <div className="mt-8 prose prose-sm dark:prose-invert max-w-none text-c-text-secondary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.contentMd || ''}</ReactMarkdown>
            </div>
            <footer className="mt-16 border-t border-c-border pt-6 text-center text-xs text-c-text-muted">
              {isPl
                ? 'Udostępnione przez Consultify — widok tylko do odczytu.'
                : 'Shared with Consultify — read-only view.'}
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default PublicArtifactView;
