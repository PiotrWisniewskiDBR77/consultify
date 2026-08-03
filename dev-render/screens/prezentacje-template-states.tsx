/**
 * Dev-render host for the REAL `<PrezentacjeView>` (R11 deck slice,
 * 2026-07-26) — the "Użyj wzorca" entry `?templateArtifactId=` from the
 * Template Library.
 *
 * Real network call: `POST /presentations/decks/from-template`
 * (`{ templateArtifactId }` only) — see
 * `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` effect around
 * L351-380. There is NO `/presentations/templates/resolve` endpoint for
 * decks (unlike Document Studio / Report Builder) — resolution happens
 * server-side inside `from-template` itself
 * (`resolvePresentationTemplateForCreation`).
 *
 * ★ Patched at MODULE level, not inside a React effect. `PrezentacjeView`
 * fires its `from-template` POST from an effect that commits in the SAME
 * pass as this screen's own wrapper effects — and React commits child
 * effects BEFORE parent effects, so a `useEffect` here would install the
 * mock too late and let the real (unmocked) call reach `fetch` against the
 * absent dev-render backend. This is safe specifically because
 * `dev-render/main.tsx` lazy-loads every screen (`React.lazy`), so only THIS
 * module's top-level code runs when `?screen=prezentacje-template-states` is
 * selected — same pattern as `dev-render/screens/karta-task.tsx` and
 * `dev-render/screens/document-studio-template-resolve-error.tsx`.
 *
 * URL: ?screen=prezentacje-template-states&templateArtifactId=fake-1
 *        [&variant=loading|orphaned|forbidden][&theme=light|dark]
 *
 * variant=loading (default) — POST never resolves: view is frozen on the PL
 *   loading copy "Tworzenie prezentacji z szablonu…" (PrezentacjeView L638-647).
 * variant=orphaned  — POST rejects `TEMPLATE_ORPHANED` (404) → PL blocking state.
 * variant=forbidden — POST rejects `TEMPLATE_FORBIDDEN` (403) → PL blocking state.
 *
 * NOT covered: variant=success. A successful `from-template` call triggers
 * `navigate('/presentations/builder/:deckId')`, but this harness never mounts
 * a `<Routes>` tree — nothing renders at that path, so the view falls back to
 * its own `showHome` branch instead of the real Deck Builder. Per task scope
 * ("jeśli za głęboki, pokryj loading+2 blokujące i odnotuj"), the success
 * transition is left uncovered.
 */
import React from 'react';

import { PrezentacjeView } from '../../src/components/AIChat/KimiWorkspace/PrezentacjeView';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'loading';

function resolveRejection(status: number, code: string): Error {
  const err: any = new Error(code);
  err.status = status;
  err.data = { error: code };
  return err;
}

const g = window as unknown as { __PREZ_TPL_STATES_FETCH__?: boolean };
const tenEkran = params.get('screen') === 'prezentacje-template-states';
if (tenEkran && !g.__PREZ_TPL_STATES_FETCH__) {
  g.__PREZ_TPL_STATES_FETCH__ = true;

  const realPost = Api.post.bind(Api);
  Api.post = (async (url: string, data?: any) => {
    if (String(url).includes('/presentations/decks/from-template')) {
      if (variant === 'orphaned') throw resolveRejection(404, 'TEMPLATE_ORPHANED');
      if (variant === 'forbidden') throw resolveRejection(403, 'TEMPLATE_FORBIDDEN');
      // 'loading' (default): a promise that never settles.
      return new Promise(() => {});
    }
    return realPost(url, data);
  }) as typeof Api.post;

  // Safety net: anything else this heavy view + AppProviders' V8/Org/
  // AccessPolicy/AI providers fire on mount gets a neutral empty payload
  // instead of hitting the absent dev-render backend. i18n keeps hitting the
  // real static /locales/** files served from repo `public/`.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function PrezentacjeTemplateStatesScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
        <PrezentacjeView />
      </div>
    </AppProviders>
  );
}
