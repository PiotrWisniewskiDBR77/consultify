/**
 * Dev-render host for the REAL `<PromptRegistryTab />` (SuperAdmin → AI
 * Platform → Development → Prompt Registry, Oxford O5.5 wiring). No
 * re-implementation: the component fetches through `Api.get()`
 * (services/api.ts, backed by `fetch('/api/...')`), so we stub
 * `window.fetch` with engine-shaped mock JSON keyed by URL path (pattern
 * from dev-render/screens/partner-settlements-view.tsx).
 *
 * Exercises: Menu2 search, Menu3 checksum-status chips (All/OK/Drifted/
 * Unverifiable) with live counts, StandardTable columns (ID/Module/Version/
 * Owner/Last reviewed/Checksum badge), sortable columns, row click → side
 * StandardPreview (module/owner/checksum pills, source path, languages),
 * kebab preview + read-only destructive note, error state (DegradedState)
 * when the endpoint 500s (?err=1).
 *
 * Screen is mounted BEHIND `promptRegistryUi` (default OFF) in the real app
 * (AIPlatformModule.tsx) — this harness renders the tab component directly,
 * bypassing the flag gate, per CLAUDE.md rule #7 (screenshot BEFORE Piotr
 * ever sees a flag flip).
 */
import React from 'react';

import { PromptRegistryTab } from '../../src/views/superadmin/AIPlatformModule/Development/PromptRegistryTab';

// Shape mirrors server/src/ai/promptRegistry.ts PromptRegistrySummaryRow —
// 18 entries as of O5.5, trimmed/paraphrased for the harness (no proprietary
// prompt bodies, only metadata — same as the real read-only route).
const PROMPTS = [
  {
    id: 'persona-core',
    module: 'persona',
    version: '3.2.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'PERSONA_CORE',
    description: "Teresa's core identity, response contract, challenge mode.",
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-20',
    managed: true,
    checksumStatus: 'ok',
  },
  {
    id: 'persona-challenge-mode',
    module: 'persona',
    version: '1.4.0',
    owner: 'content-quality',
    path: 'server/src/ai/persona.ts',
    exportName: 'CHALLENGE_MODE_ADDENDUM',
    description: 'Adversarial pushback tone when a client plan looks under-baked.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-05-02',
    managed: true,
    checksumStatus: 'drifted',
  },
  {
    id: 'initiative-card-formula-a3-full',
    module: 'initiative-generation',
    version: '2.1.0',
    owner: 'initiatives',
    path: 'server/src/services/initiative/cardContentFormulaPrompt.ts',
    exportName: 'CARD_CONTENT_FORMULA_A3_FULL',
    description: 'McKinsey-grade full card formula for generated initiatives.',
    languages: ['pl', 'en', 'de'],
    lastReviewed: '2026-07-10',
    managed: true,
    checksumStatus: 'ok',
  },
  {
    id: 'initiative-card-formula-a3-lite',
    module: 'initiative-generation',
    version: '2.1.0',
    owner: 'initiatives',
    path: 'server/src/services/initiative/cardContentFormulaPrompt.ts',
    exportName: 'CARD_CONTENT_FORMULA_A3_LITE',
    description: 'Lite variant of the card formula for quick-add flows.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-07-10',
    managed: true,
    checksumStatus: 'ok',
  },
  {
    id: 'initiative-mece-check',
    module: 'initiative-generation',
    version: '1.0.0',
    owner: 'initiatives',
    path: 'server/src/services/initiative/meceCheckPrompt.ts',
    description: 'MECE overlap/gap check across a generated initiative set.',
    languages: ['en'],
    lastReviewed: '2026-04-11',
    managed: false,
    checksumStatus: 'unverifiable',
  },
  {
    id: 'deliverables-doc-outline',
    module: 'deliverables-doc',
    version: '1.6.0',
    owner: 'deliverables',
    path: 'server/src/services/deliverables/docOutlinePrompt.ts',
    description: 'Section-outline generator for Word deliverables.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
    managed: true,
    checksumStatus: 'ok',
  },
  {
    id: 'deliverables-doc-section',
    module: 'deliverables-doc',
    version: '1.6.0',
    owner: 'deliverables',
    path: 'server/src/services/deliverables/docSectionPrompt.ts',
    description: 'Per-section body copy generator, consulting voice.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-06-01',
    managed: true,
    checksumStatus: 'ok',
  },
  {
    id: 'deliverables-sheet-formula-notes',
    module: 'deliverables-sheet',
    version: '1.0.0',
    owner: 'deliverables',
    path: 'server/src/services/deliverables/sheetFormulaNotesPrompt.ts',
    description: 'Explains generated Excel formulas in plain language.',
    languages: ['en'],
    lastReviewed: '2026-03-15',
    managed: false,
    checksumStatus: 'unverifiable',
  },
  {
    id: 'discovery-tools-swot',
    module: 'discovery-tools',
    version: '1.2.0',
    owner: 'discovery',
    path: 'server/src/services/discovery/swotPrompt.ts',
    description: 'SWOT framework population from interview transcripts.',
    languages: ['pl', 'en'],
    lastReviewed: '2026-05-20',
    managed: true,
    checksumStatus: 'ok',
  },
  {
    id: 'discovery-tools-porters-five',
    module: 'discovery-tools',
    version: '1.1.0',
    owner: 'discovery',
    path: 'server/src/services/discovery/portersFivePrompt.ts',
    description: "Porter's Five Forces framework population.",
    languages: ['pl', 'en'],
    lastReviewed: '2026-05-20',
    managed: true,
    checksumStatus: 'drifted',
  },
  {
    id: 'v8-prompt-os-router',
    module: 'v8-prompt-os',
    version: '4.0.0',
    owner: 'v8-platform',
    path: 'server/src/services/v8/promptOsRuntimeService.ts',
    description: 'Preset/release-bundle router for the V8 prompt runtime.',
    languages: ['en'],
    lastReviewed: '2026-07-01',
    managed: false,
    checksumStatus: 'unverifiable',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(): Response {
  return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = new URLSearchParams(window.location.search);
const simulateError = params.get('err') === '1';

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __PROMPT_REGISTRY_TAB_FETCH__?: boolean };
if (!g.__PROMPT_REGISTRY_TAB_FETCH__) {
  g.__PROMPT_REGISTRY_TAB_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/admin/prompts/registry')) {
        if (simulateError) return errorResponse();
        const drifted = PROMPTS.filter((p) => p.checksumStatus === 'drifted').map((p) => p.id);
        return jsonResponse({
          count: PROMPTS.length,
          managedCount: PROMPTS.filter((p) => p.managed).length,
          drifted,
          prompts: PROMPTS,
        });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

class DebugBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 16, color: 'red', whiteSpace: 'pre-wrap' }}>
          {this.state.error.stack || this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

export default function PromptRegistryTabScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1400, height: '80vh', margin: '0 auto', padding: '16px' }}>
      <DebugBoundary>
        <PromptRegistryTab />
      </DebugBoundary>
    </div>
  );
}
