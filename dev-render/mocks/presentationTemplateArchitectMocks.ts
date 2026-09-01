/**
 * Api-method mock for the dev-render screen `gen-deck-content-hints`.
 *
 * IMPORTANT — why this patches `Api.get/post/put` and NOT `window.fetch`:
 * main.tsx statically imports EVERY screen, and several of them reassign
 * `Api.get = …` at module-load time (karta-task, decision-record, …). The
 * last such assignment wins, so on any screen `Api.get` is already a foreign
 * mock that short-circuits before reaching `fetch` — a `window.fetch` mock
 * would never be consulted. Patching the shared `Api` singleton's methods at
 * MOUNT time (from the screen's useEffect) overrides those load-time
 * assignments for the duration this screen is shown. Mirrors the
 * `Api.get = …` pattern already used across dev-render/screens/*.
 *
 * Covers exactly the endpoints `PresentationTemplateArchitectView` calls (see
 * `src/services/presentationTemplateArchitect.ts`). Response shape matches the
 * `Api` helpers' `toAxiosLikeResponse({ success, data })` envelope so the
 * view's `unwrap()` behaves identically to production. No backend, no DB.
 */
import { Api } from '@/services/api';

interface MockOutlineItem {
  intent: string;
  title: string;
  contentHints?: string[];
}

interface MockTemplate {
  id: string;
  name: string;
  description: string;
  deck_type: string;
  audience: string;
  goal: string;
  theme: string;
  language_default: string;
  confidentiality_default: string;
  outline_json: MockOutlineItem[];
  must_have_intents: string[];
  recommended_visuals: string[];
  max_slides: number;
  min_slides: number;
  is_system: boolean;
  is_active: boolean;
  cloned_from: string | null;
  lifecycle_state: 'draft' | 'approved' | 'deprecated';
  // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31).
  color_template_id?: string | null;
  // Day 228 (2026-09) — "styl obrazu", dopisywany do promptu generacji obrazu AI.
  layout_policy_json?: { imageStylePrompt?: string | null } | null;
}

const DRAFT_WITH_HINTS: MockTemplate = {
  id: 'tpl-dev-render-draft-1',
  name: 'Steering Committee Deck Template',
  description: 'Standard monthly steering committee update.',
  deck_type: 'steering_committee',
  audience: 'executive',
  goal: 'inform',
  theme: 'corporate',
  language_default: 'en',
  confidentiality_default: 'internal',
  outline_json: [
    {
      intent: 'title',
      title: 'Steering Committee Update — {{month}}',
      contentHints: ['State the reporting period and program name up front'],
    },
    { intent: 'agenda', title: 'Agenda', contentHints: ['List 3-5 topics covered this session'] },
    {
      intent: 'status_summary',
      title: 'Overall Program Status',
      contentHints: [
        'Frame current-state pain points before the ask',
        'Contrast current status vs. target milestone',
        'Call out any newly escalated risks',
      ],
      // W5 gendeck-briefing — richer per-slide briefing (read-only display).
      keyMessage: 'Program jest na ścieżce, ale jedno ryzyko wymaga decyzji komitetu',
      dataNeeded: ['status kamieni milowych vs. plan', 'lista otwartych ryzyk z oceną wpływu'],
      suggestedVisual: 'tabela RAG + oś czasu kamieni',
    },
    { intent: 'risks_issues', title: 'Key Risks & Issues' },
    {
      intent: 'next_steps',
      title: 'Next Steps & Decisions Needed',
      contentHints: ['End with an explicit decision ask, not just an update'],
    },
  ],
  must_have_intents: ['title', 'next_steps'],
  recommended_visuals: ['RAG status table', 'Milestone timeline'],
  max_slides: 8,
  min_slides: 4,
  is_system: false,
  is_active: true,
  cloned_from: null,
  lifecycle_state: 'draft',
  color_template_id: 'harvard',
  layout_policy_json: {
    imageStylePrompt: 'Gradient fuksji, różu i królewskiego błękitu, subtelne światło studyjne',
  },
};

const APPROVED_LOCKED: MockTemplate = {
  id: 'tpl-dev-render-approved-1',
  name: 'Board Decision Deck Template',
  description: 'Approved board-ready decision template (locked, clone to edit).',
  deck_type: 'board_decision_deck',
  audience: 'board',
  goal: 'decide',
  theme: 'minimal',
  language_default: 'en',
  confidentiality_default: 'confidential',
  outline_json: [
    { intent: 'title', title: 'Board Decision: {{topic}}' },
    { intent: 'recommendation', title: 'Recommendation' },
  ],
  must_have_intents: ['title', 'recommendation'],
  recommended_visuals: [],
  max_slides: 6,
  min_slides: 3,
  is_system: false,
  is_active: true,
  cloned_from: null,
  lifecycle_state: 'approved',
  color_template_id: null,
};

let templates: MockTemplate[] = [DRAFT_WITH_HINTS, APPROVED_LOCKED];
let nextId = 1;

// Mirror of `toAxiosLikeResponse` — a proxy where `.data` returns the payload.
function axiosLike<T>(payload: T): { data: T } {
  return { data: payload };
}

function envelope<T>(data: T) {
  return axiosLike({ success: true, data });
}

/**
 * Installs the mocks on the shared `Api` singleton. Idempotent; call from the
 * screen's mount effect. Returns a disposer that restores the originals.
 */
export function installPresentationTemplateArchitectApiMock(): () => void {
  const realGet = Api.get;
  const realPost = Api.post;
  const realPut = Api.put;

  Api.get = (async (url: string) => {
    // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31): the shared
    // `ColorPatternPicker`'s `useBrandKitColors` hook fetches this so the
    // "Brand Kit" tile renders in the gallery alongside CURATED_COLOR_SETS.
    if (url.includes('/presentations/brand-kit')) {
      return envelope({
        primary_color: 'A51C30',
        secondary_color: '3B2883',
        accent_color: '6578B4',
      });
    }
    if (url.includes('/presentations/templates/') && !url.includes('/clone')) {
      const id = url.split('/presentations/templates/')[1].split('?')[0];
      const found = templates.find((t) => t.id === id);
      return envelope(found ?? null);
    }
    if (url.includes('/presentations/templates')) {
      return envelope(templates);
    }
    return (realGet as (u: string) => Promise<unknown>)(url);
  }) as typeof Api.get;

  Api.post = (async (url: string, data: unknown) => {
    const body = (data ?? {}) as Record<string, unknown>;
    if (url.includes('/presentations/templates/plan')) {
      const useLlm = body.useLlm === true;
      const input = (body.input ?? {}) as Record<string, unknown>;
      const purpose = String(input.purpose || 'New template');
      const id = `tpl-dev-render-new-${nextId++}`;
      const template: MockTemplate = {
        id,
        name: String(input.name || `${purpose.slice(0, 40)} Template`),
        description: String(input.description || purpose),
        deck_type: String(input.deckType || 'custom_deck'),
        audience: String(input.audience || 'executive'),
        goal: String(input.goal || 'inform'),
        theme: String(input.theme || 'corporate'),
        language_default: String(input.language || 'en'),
        confidentiality_default: 'internal',
        outline_json: [
          {
            intent: 'title',
            title: useLlm ? `${purpose.slice(0, 40)} — Overview` : 'Title Slide',
            contentHints: useLlm ? ['Open with the one-sentence purpose of this deck'] : undefined,
          },
          {
            intent: 'agenda',
            title: 'Agenda',
            contentHints: useLlm ? ['List the sections that follow'] : undefined,
          },
          {
            intent: 'next_steps',
            title: 'Next Steps',
            contentHints: useLlm ? ['Close with a clear, single ask'] : undefined,
          },
        ],
        must_have_intents: ['title', 'next_steps'],
        recommended_visuals: [],
        max_slides: 6,
        min_slides: 3,
        is_system: false,
        is_active: true,
        cloned_from: null,
        lifecycle_state: 'draft',
      };
      templates = [template, ...templates];
      return envelope({ template, llmRefined: useLlm });
    }
    if (url.includes('/presentations/templates/') && url.includes('/clone')) {
      const sourceId = url.split('/presentations/templates/')[1].split('/clone')[0];
      const source = templates.find((t) => t.id === sourceId) ?? DRAFT_WITH_HINTS;
      const id = `tpl-dev-render-clone-${nextId++}`;
      const clone: MockTemplate = {
        ...source,
        id,
        name: `${source.name} (copy)`,
        lifecycle_state: 'draft',
        cloned_from: sourceId,
      };
      templates = [clone, ...templates];
      return envelope({ id });
    }
    return (realPost as (u: string, d: unknown) => Promise<unknown>)(url, data);
  }) as typeof Api.post;

  Api.put = (async (url: string, data: unknown) => {
    const body = (data ?? {}) as Record<string, unknown>;
    if (url.includes('/presentations/templates/')) {
      const id = url.split('/presentations/templates/')[1].split('?')[0];
      templates = templates.map((t) =>
        t.id === id
          ? {
              ...t,
              name: (body.name as string) ?? t.name,
              description: (body.description as string) ?? t.description,
              audience: (body.audience as string) ?? t.audience,
              goal: (body.goal as string) ?? t.goal,
              theme: (body.theme as string) ?? t.theme,
              outline_json: (body.outlineJson as MockOutlineItem[]) ?? t.outline_json,
              max_slides: (body.maxSlides as number) ?? t.max_slides,
              // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31).
              color_template_id:
                'colorTemplateId' in body
                  ? ((body.colorTemplateId as string | null) ?? null)
                  : t.color_template_id,
              layout_policy_json:
                'imageStylePrompt' in body
                  ? { imageStylePrompt: (body.imageStylePrompt as string | null) ?? null }
                  : t.layout_policy_json,
            }
          : t
      );
      return envelope({});
    }
    return (realPut as (u: string, d: unknown) => Promise<unknown>)(url, data);
  }) as typeof Api.put;

  return () => {
    Api.get = realGet;
    Api.post = realPost;
    Api.put = realPut;
  };
}
