/**
 * Dev-render host for the I18N FALA 1 merge smoke (M03+M10+M08/M06).
 *
 * Mounts REAL production components that were i18n-ized by the three merged
 * branches, so the integrator can screenshot them in ?lang=pl and ?lang=en and
 * verify no raw keys ("interview.x.y") leak to the screen:
 *   - ?screen=i18n-fala1-smoke&part=interview  → real <TemplateBuilder/> (M10, namespace interview.*)
 *   - ?screen=i18n-fala1-smoke&part=ideas      → real <FormulaEditor/> (M08, namespace ideas.table.*)
 * MyWork (M03) is smoked via the existing ?screen=zwornik-projects (real <MyProjects/>).
 *
 * Network: window.fetch is stubbed with empty engine-shaped JSON so the
 * components mount offline. Dev-only; never ships to demo.
 */
import React from 'react';

import { TemplateBuilder } from '../../src/components/Interview/TemplateBuilder';
import FormulaEditor from '../../src/components/MyWork/table/FormulaEditor';

// ── Offline fetch stub (any /api/* call → empty-but-valid JSON) ─────────────
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/')) {
    return new Response(JSON.stringify({ data: [], items: [], results: [], templates: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

const FIELDS = [
  { id: 'f1', name: 'Budget', type: 'number' },
  { id: 'f2', name: 'Owner', type: 'text' },
  { id: 'f3', name: 'Due date', type: 'date' },
];

function IdeasPart(): React.ReactElement {
  const [expr, setExpr] = React.useState('SUM({Budget}, 100)');
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-sm font-semibold mb-3 text-c-text">
        M08 Ideas — FormulaEditor (namespace ideas → table)
      </h2>
      <FormulaEditor
        tableId="tbl-smoke"
        value={expr}
        onChange={setExpr}
        fields={FIELDS as never}
      />
    </div>
  );
}

function InterviewPart(): React.ReactElement {
  return (
    <TemplateBuilder
      isOpen
      onClose={() => undefined}
      onSuccess={() => undefined}
    />
  );
}

export default function I18nFala1SmokeScreen(): React.ReactElement {
  const part = new URLSearchParams(window.location.search).get('part') || 'interview';
  return part === 'ideas' ? <IdeasPart /> : <InterviewPart />;
}
