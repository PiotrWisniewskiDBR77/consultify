/**
 * Harness-only fetch stub for screens that mount the REAL `<AppRoutes/>`.
 *
 * Without a backend every `/api/*` read 404s, and OrgContext/ExecutionHub retry on a timer —
 * the shot drowns in `SIEC-4XX5XX` and console noise (measured on W1: 16k+ 404 lines).
 * This answers every API call with a permissive empty payload so the routing proof renders
 * the real shell with `bledyKonsoli=0`. Same pattern as `interview-candidate-card.tsx`.
 *
 * `/organizations/current` must NOT be empty: OrgContext (src/contexts/OrgContext.tsx:126-146)
 * resolves `currentOrg` from that list and a null org leaves the module content area blank —
 * measured on W1, where the shell rendered but the hub did not. The flags endpoint is typed
 * `Record<string, boolean>` (src/services/api/v8/admin.ts:9), so it gets its own empty shape.
 */
const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const EMPTY_PAYLOAD = {
  organizations: [],
  assignments: [],
  insights: [],
  sessions: [],
  documents: [],
  items: [],
  initiatives: [],
  tasks: [],
  projects: [],
  rows: [],
  data: [],
  total: 0,
};

const DEMO_ORG = {
  id: 'org-harness-demo',
  name: 'Demo workspace',
  role: 'OWNER',
  access_type: 'CONSULTANT',
  billing_status: 'active',
  is_current: true,
  industry: null,
};

export function stubApiFetch(): void {
  const realFetch = globalThis.fetch?.bind(globalThis);
  (globalThis as unknown as { fetch: typeof fetch }).fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/preferences')) {
      return jsonResponse({ onboarding_completed: true, onboarding_role: 'owner' });
    }
    if (url.includes('/demo/status')) {
      // useDemo.fetchDemoStatus (src/hooks/useDemo.ts:170-200) clears ALL demo state on a
      // non-success answer: isDemoMode flips off mid-render (ExecutionHub then loses its demo
      // rows) and demoExperienceType goes null, which reads as sales_demo (trial button).
      return jsonResponse({
        success: true,
        isDemoMode: true,
        demoExperienceType: 'workspace_demo',
        demoOrganization: { id: 'org-harness-demo', name: 'Demo workspace' },
        demoSession: { organizationId: 'org-harness-demo', locale: 'en' },
        stats: null,
        coverage: [],
      });
    }
    if (url.includes('/organizations/current')) {
      return jsonResponse({ organizations: [DEMO_ORG] });
    }
    if (url.includes('/admin/flags')) {
      return jsonResponse({});
    }
    if (url.includes('/api/') || url.includes('/organizations/')) {
      return jsonResponse(EMPTY_PAYLOAD);
    }
    return realFetch ? realFetch(input, init) : jsonResponse(EMPTY_PAYLOAD);
  };
}
