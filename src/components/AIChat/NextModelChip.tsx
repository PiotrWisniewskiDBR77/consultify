/**
 * Chat V9 / INPUT C-IN1 — Next-message model hint chip.
 *
 * Why this exists
 * ---------------
 * The Trust Badge (T-TR1) tells the user which model handled the reply
 * they just received. That signal is retrospective — by the time it
 * appears, the send has already happened. Users that switch models in
 * the `ModelSelector` dropdown had no symmetric pre-send signal: the
 * dropdown closes, the input bar returns to its default state, and the
 * only way to know what is about to run is to re-open the selector.
 *
 * This chip closes the loop: a compact read-only pill in
 * `EnhancedChatInput`'s action bar that displays `"→ <model>"` so the
 * user always sees, at send time, which model is active.
 *
 * Design contract
 * ---------------
 *   - **Read-only.** Never mutates `aiConfig`. The `ModelSelector`
 *     dropdown remains the single place to change the active model.
 *   - **Zero network.** Renders from the in-memory `currentUser.aiConfig`
 *     only. If the resolved model id is unknown / empty, the chip
 *     returns `null` rather than guessing.
 *   - **No telemetry.** Emission-on-render would be noisy for a
 *     passive informational chip; the existing `ai_model_changed`
 *     event already covers user-initiated model switches.
 *   - **Flag gated.** `isNextModelChipEnabled()` defaults to ON. When
 *     off, the component returns `null` with zero side effects.
 *   - **SSR safe.** All browser globals are behind typeof guards via
 *     the store / flag helpers.
 */

import { Cpu } from 'lucide-react';
import React from 'react';

import { useAppStore } from '../../store/useAppStore';
import { isNextModelChipEnabled } from '../../utils/nextModelChipFlag';

interface NextModelChipProps {
  /**
   * Test seam so unit tests can force enabled / disabled paths without
   * touching URL / localStorage / env. Production callers never pass this.
   */
  isEnabled?: () => boolean;
  /**
   * Test seam for injecting a concrete model label, bypassing the
   * `useAppStore` lookup. Lets the unit tests cover truncation and the
   * hidden-when-empty path without hydrating a full store.
   */
  overrideLabel?: string | null;
}

/**
 * Heuristic: `currentUser.aiConfig.modelId` on system providers is often
 * a UUID (36 chars, four dashes). That is hostile to an 11-pixel chip.
 * When the id looks like a UUID, swap to the generic label so the chip
 * stays useful instead of truncated gibberish. The canonical name is
 * one click away in the `ModelSelector` dropdown anyway.
 */
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LABEL_LEN = 22;

// eslint-disable-next-line react-refresh/only-export-components
export function resolveNextModelLabel(aiConfig: unknown): string | null {
  if (!aiConfig || typeof aiConfig !== 'object') return null;
  const cfg = aiConfig as {
    modelId?: unknown;
    selectedModelId?: unknown;
    privateModels?: Array<{ id?: unknown; modelId?: unknown; name?: unknown }>;
  };

  const selected = typeof cfg.selectedModelId === 'string' ? cfg.selectedModelId.trim() : '';
  const modelId = typeof cfg.modelId === 'string' ? cfg.modelId.trim() : '';

  const privateMatch = Array.isArray(cfg.privateModels)
    ? cfg.privateModels.find(
        (pm) =>
          (selected && pm?.id === selected) ||
          (modelId && pm?.modelId === modelId)
      )
    : undefined;

  if (privateMatch && typeof privateMatch.name === 'string' && privateMatch.name.trim()) {
    const name = privateMatch.name.trim();
    return name.length > MAX_LABEL_LEN ? `${name.slice(0, MAX_LABEL_LEN - 1)}…` : name;
  }

  const raw = selected || modelId;
  if (!raw) return null;
  if (UUID_LIKE.test(raw)) return 'Default model';
  return raw.length > MAX_LABEL_LEN ? `${raw.slice(0, MAX_LABEL_LEN - 1)}…` : raw;
}

export const NextModelChip: React.FC<NextModelChipProps> = ({
  isEnabled = isNextModelChipEnabled,
  overrideLabel,
}) => {
  const storeLabel = useAppStore((state) => resolveNextModelLabel(state.currentUser?.aiConfig));
  const label = typeof overrideLabel === 'string' ? overrideLabel : storeLabel;

  if (!isEnabled()) return null;
  if (!label) return null;

  const ariaLabel = `Next send will use model ${label}`;

  return (
    <span
      data-testid="next-model-chip"
      role="status"
      aria-label={ariaLabel}
      title={ariaLabel}
      className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-300 select-none"
    >
      <Cpu size={11} strokeWidth={2} aria-hidden />
      <span className="tracking-tight">→&nbsp;{label}</span>
    </span>
  );
};

export default NextModelChip;
