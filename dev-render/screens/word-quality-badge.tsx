/**
 * Dev-render: Word W4 — badge jakości/fabrykacji w panelu QA Document Studio.
 *
 * Mounts the REAL `DocumentStudioQaPanel` with the QA endpoint
 * (/api/document-studio/:id/qa) mocked (window.fetch — DocumentStudio api
 * uses fetchWithRetry→global fetch), so the new FabricationBadge
 * ("Zweryfikowane" / "Zdegradowane (N)") from W4 word-quality-surface can be
 * screenshotted BEFORE the owner sees it (rule #7). No backend/DB.
 *
 * URL: ?screen=word-quality-badge[&lang=pl|en][&theme=light|dark][&clean=1]
 *   &clean=1 → fabrication.count 0 (verified); default → degraded (3 numbers).
 */
import React, { useEffect, useState } from 'react';

const BASE = '/api/document-studio';
const ARTIFACT_ID = 'doc-dev-render-1';

function installQaMock(clean: boolean): () => void {
  const realFetch = window.fetch.bind(window);
  const report = {
    artifactId: ARTIFACT_ID,
    organizationId: 'org-dev',
    generatedAt: '2026-07-23T00:00:00.000Z',
    anyBlocking: false,
    categories: [],
    fabrication: clean
      ? { count: 0, sample: [] }
      : { count: 3, sample: ['183 450 PLN', '27,4%', '2,3 mln EUR'] },
  };
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(`${BASE}/`) && url.includes('/qa')) {
      return new Response(JSON.stringify({ report }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
  return () => {
    window.fetch = realFetch;
  };
}

export default function WordQualityBadgeScreen(): React.ReactElement {
  const clean = new URLSearchParams(window.location.search).get('clean') === '1';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dispose = installQaMock(clean);
    setReady(true);
    return dispose;
  }, [clean]);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  const DocumentStudioQaPanel = React.lazy(() =>
    import('@/components/DocumentStudio/DocumentStudioQaPanel').then((m) => ({
      default: m.DocumentStudioQaPanel,
    }))
  );

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <div className="mx-auto max-w-md">
        <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
          <DocumentStudioQaPanel artifactId={ARTIFACT_ID} />
        </React.Suspense>
      </div>
    </div>
  );
}
