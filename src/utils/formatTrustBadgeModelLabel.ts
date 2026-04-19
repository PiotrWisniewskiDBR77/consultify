/**
 * Chat V9 / TRUST T-TR1.2 — pure formatter for raw model ids.
 *
 * Dictionary + heuristic transformer that turns backend-facing
 * identifiers into human-friendly labels for the Trust Badge:
 *
 *   `gpt-4o`                        → `GPT-4o`
 *   `gpt-4o-2024-08-06`             → `GPT-4o`
 *   `gpt-4-turbo`                   → `GPT-4 Turbo`
 *   `gpt-3.5-turbo`                 → `GPT-3.5 Turbo`
 *   `o1-preview`                    → `o1-preview`
 *   `claude-3-5-sonnet-20241022`    → `Claude 3.5 Sonnet`
 *   `claude-3-opus-20240229`        → `Claude 3 Opus`
 *   `gemini-1.5-pro`                → `Gemini 1.5 Pro`
 *   `<uuid>`                        → `Private model`
 *   `<empty>` / non-string          → `null` (caller omits pill)
 *
 * Design notes
 * ------------
 * - The helper is **pure and dictionary-first**. It never calls the
 *   backend, never mutates input, never logs. Matching is
 *   case-insensitive against the normalised id, so uppercase / mixed
 *   case backends still resolve correctly.
 * - UUID-looking ids (the shape of private `aiConfig.privateModels[].id`
 *   rows) are masked to `"Private model"` rather than leaked verbatim.
 *   Leaking a uuid into the Trust Badge would both look terrible and
 *   potentially surface an org-specific identifier in screenshots.
 * - When no rule matches we return the raw id clipped to
 *   `MAX_LABEL_LEN` characters. The clipping guarantees the badge's
 *   `.truncate` only has to work on absurdly long strings.
 * - Always exported alongside the component so unit tests can
 *   exercise the table without rendering.
 */

const MAX_LABEL_LEN = 32;

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rules run top-to-bottom against the lowercased id. First match wins.
// Keep rules narrow: an over-broad prefix match can easily mislabel a
// sibling model. When in doubt, add a new row rather than widening an
// existing regex.
type Rule = {
  test: (id: string) => boolean;
  label: (id: string) => string;
};

const RULES: readonly Rule[] = [
  // GPT family — date / version suffixes are noisy, drop them.
  {
    test: (id) => /^gpt-4o(-mini)?(-[0-9\-]+)?$/.test(id),
    label: (id) => (id.includes('mini') ? 'GPT-4o mini' : 'GPT-4o'),
  },
  {
    test: (id) => /^gpt-4-turbo/.test(id),
    label: () => 'GPT-4 Turbo',
  },
  {
    test: (id) => /^gpt-4(?:-|$)/.test(id),
    label: () => 'GPT-4',
  },
  {
    test: (id) => /^gpt-3\.5(?:-turbo)?/.test(id),
    label: () => 'GPT-3.5 Turbo',
  },
  {
    test: (id) => /^gpt-5(?:-|$)/.test(id),
    label: () => 'GPT-5',
  },
  {
    test: (id) => /^o1(?:-|$)/.test(id),
    // Keep the `o1` branding as-is; OpenAI ships multiple siblings
    // (`o1-preview`, `o1-mini`, `o1-pro`) and each deserves its own
    // label rather than collapsing into a parent.
    label: (id) => id,
  },

  // Claude family — match the dated id shape and drop the date.
  {
    test: (id) => /^claude-3-5-sonnet/.test(id),
    label: () => 'Claude 3.5 Sonnet',
  },
  {
    test: (id) => /^claude-3-5-haiku/.test(id),
    label: () => 'Claude 3.5 Haiku',
  },
  {
    test: (id) => /^claude-3-opus/.test(id),
    label: () => 'Claude 3 Opus',
  },
  {
    test: (id) => /^claude-3-sonnet/.test(id),
    label: () => 'Claude 3 Sonnet',
  },
  {
    test: (id) => /^claude-3-haiku/.test(id),
    label: () => 'Claude 3 Haiku',
  },
  {
    test: (id) => /^claude-2/.test(id),
    label: () => 'Claude 2',
  },

  // Gemini family.
  {
    test: (id) => /^gemini-1\.5-pro/.test(id),
    label: () => 'Gemini 1.5 Pro',
  },
  {
    test: (id) => /^gemini-1\.5-flash/.test(id),
    label: () => 'Gemini 1.5 Flash',
  },
  {
    test: (id) => /^gemini-(pro|1\.0)/.test(id),
    label: () => 'Gemini Pro',
  },

  // Mistral / Mixtral — vendor-capitalised family names.
  {
    test: (id) => /^mistral-large/.test(id),
    label: () => 'Mistral Large',
  },
  {
    test: (id) => /^mixtral-8x7b/.test(id),
    label: () => 'Mixtral 8x7B',
  },

  // Llama family.
  {
    test: (id) => /^llama-3\.1-/.test(id),
    label: () => 'Llama 3.1',
  },
  {
    test: (id) => /^llama-3-/.test(id),
    label: () => 'Llama 3',
  },
];

function clip(s: string): string {
  if (s.length <= MAX_LABEL_LEN) return s;
  return `${s.slice(0, MAX_LABEL_LEN - 1)}…`;
}

/**
 * Return a human-friendly label for `raw`, or `null` when there's
 * nothing worth rendering (empty string, non-string, whitespace-only).
 * UUID-like ids mask to the sentinel `"Private model"`.
 */
export function formatTrustBadgeModelLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (UUID_LIKE.test(trimmed)) return 'Private model';

  const normalised = trimmed.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(normalised)) {
      return clip(rule.label(normalised));
    }
  }

  // Unknown vendor — keep as-is but clip length so the badge does not
  // blow up horizontally on a weirdly long custom id.
  return clip(trimmed);
}
