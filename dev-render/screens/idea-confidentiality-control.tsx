/**
 * Dev-render host for the Idea CONFIDENTIALITY control (RISK-22, S8-CONFID).
 *
 * Mounts the REAL production components — `IdeaRightPanel` (SPEC-A shell,
 * "properties" tab) wrapping the REAL `IdeaWorkspaceTools` (§ Metadata sub-
 * group, right next to Branch/Area/Priority) — driven by the REAL
 * `useIdeaConfidentialityGate` hook (src/components/MyWork/
 * useIdeaConfidentialityGate.ts), the exact same hook `IdeaMapWorkspace.tsx`
 * uses in production. This is NOT a hand-drawn mock of the control or a
 * re-implementation of its logic — only `Api.updateMyIdea` is monkey-patched
 * (dev-render convention: patch `Api.<method>`, never `window.fetch` — see
 * dev-render/screens/idea-table-timeline-stuck.tsx for the same pattern),
 * because there is no backend in this harness.
 *
 * STATEFUL mock — clicking a confidentiality option really runs the
 * downgrade-confirm + "no false success" flow end to end (useConfirmDialog,
 * revert-on-simulated-failure). A `?fail=1` query param makes the patched
 * `Api.updateMyIdea` reject, to prove the control does NOT show a new state
 * when the save fails.
 *
 * Theme/lang from harness chrome (`?theme`, `?lang`), same convention as
 * every other dev-render screen.
 */
import React, { useEffect, useState } from 'react';

import { IdeaWorkspaceTools } from '../../src/components/MyWork/IdeaWorkspaceTools';
import type { IdeaWorkspaceSelection } from '../../src/components/MyWork/ideaSelectionTypes';
import { useIdeaConfidentialityGate } from '../../src/components/MyWork/useIdeaConfidentialityGate';
import { IdeaRightPanel } from '../../src/components/standard/IdeaRightPanel';
import { Api } from '../../src/services/api';

type ConfidentialityLevel = 'standard' | 'confidential' | 'restricted';

const EMPTY_SELECTION: IdeaWorkspaceSelection = { type: 'none', count: 0, ids: [] };

const params = new URLSearchParams(window.location.search);
const simulateFailure = params.get('fail') === '1';
// ?level=confidential|restricted lets a screenshot script land directly on a
// given state without clicking through the dropdown first.
const initialLevel = (params.get('level') as ConfidentialityLevel) || 'confidential';

// Dev-render convention (see dev-render/screens/idea-table-timeline-stuck.tsx):
// patch the Api METHOD, never window.fetch. Mirrors the real
// `PUT /my-ideas/:id` response shape (echoes back the requested level) and,
// with ?fail=1, its real rejection path.
Api.updateMyIdea = (async (_id: string, updates: any) => {
  await new Promise((r) => setTimeout(r, 350));
  if (simulateFailure) {
    throw new Error(
      (document.documentElement.lang || 'pl').startsWith('pl')
        ? 'Nie udało się zaktualizować poufności'
        : 'Failed to update confidentiality'
    );
  }
  return { confidentiality: updates?.confidentiality };
}) as typeof Api.updateMyIdea;

export default function IdeaConfidentialityControlScreen(): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') || params.get('lang') !== 'en';
  const title = isPl ? 'Ekspansja DE — mapa hipotez' : 'DE expansion — hypothesis map';

  // Fake i18next `t` resolving from the real translation JSON — same
  // approach as tests/components/MyWork/IdeaWorkspaceTools.inspector.test.tsx
  // — so the confirm-dialog copy shown here is the REAL locale string, not a
  // hand-typed stand-in that could drift from public/locales/*.
  const [translations, setTranslations] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    import(`../../public/locales/${isPl ? 'pl' : 'en'}/translation.json`).then((mod) =>
      setTranslations(mod.default || mod)
    );
  }, [isPl]);
  const t = (key: string, fallbackOrOptions?: any, maybeOptions?: any): string => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (acc, seg) => (acc && typeof acc === 'object' ? (acc as any)[seg] : undefined),
        translations
      );
    let str =
      typeof value === 'string'
        ? value
        : typeof fallbackOrOptions === 'string'
          ? fallbackOrOptions
          : key;
    const options =
      typeof fallbackOrOptions === 'object' && fallbackOrOptions ? fallbackOrOptions : maybeOptions;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }
    return str;
  };

  const gate = useIdeaConfidentialityGate({ t, isPolish: isPl, title });
  const gateRef = React.useRef(gate);
  gateRef.current = gate;

  // Land directly on the requested level (?level=) without a real fetch —
  // hydrateFromIdea is the same entry point IdeaMapWorkspace uses after
  // GET /my-ideas/:id resolves.
  useEffect(() => {
    gateRef.current.hydrateFromIdea({
      confidentiality: initialLevel,
      confidentialitySupported: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noop = () => {};

  if (!translations) return <div className="p-6 text-c-text-muted">Loading…</div>;

  return (
    <div className="flex h-screen w-full flex-col bg-c-surface">
      <div className="flex h-12 items-center gap-3 border-b border-c-border-subtle px-4">
        <span className="text-sm font-semibold text-c-text">
          {isPl ? 'Mapa myśli' : 'Mind map'}
        </span>
        <span className="text-c-text-muted">·</span>
        <span className="text-xs text-c-text-muted">{title}</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1 overflow-hidden bg-c-surface-raised">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, color-mix(in srgb, var(--c-border) 60%, transparent) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="relative flex h-full items-center justify-center">
            <div className="rounded-xl border border-c-border bg-c-surface px-5 py-3 text-sm font-medium text-c-text shadow-sm">
              {isPl ? 'Ekspansja DE' : 'DE expansion'}
            </div>
          </div>
        </div>
        <IdeaRightPanel
          isPolish={isPl}
          activeSection="properties"
          propertiesContent={
            <IdeaWorkspaceTools
              open
              embedded
              onClose={noop}
              ideaId="dev-render-idea-1"
              title={title}
              seedText={
                isPl ? 'Mapa hipotez wejścia na rynek DE.' : 'DE go-to-market hypothesis map.'
              }
              stage="shaping"
              branch="Growth"
              area="DE"
              priority={75}
              confidentiality={gate.confidentiality}
              confidentialitySupported={gate.confidentialitySupported}
              confidentialitySaving={gate.confidentialitySaving}
              onConfidentialityChange={(next) =>
                gate.handleConfidentialityChange('dev-render-idea-1', next)
              }
              isDraft={false}
              isAccepted
              saving={false}
              draftSavedLabel={isPl ? 'Zapisano' : 'Saved'}
              activeTool="mindmap"
              selection={EMPTY_SELECTION}
              onTitleChange={noop}
              onSeedTextChange={noop}
              onBranchChange={noop}
              onAreaChange={noop}
              onPriorityChange={noop}
              onSave={noop}
              onAcceptChallenge={noop}
              onConvert={noop}
              onOpenChat={noop}
            />
          }
        />
      </div>
      {gate.confidentialityDowngradeDialog}
    </div>
  );
}
