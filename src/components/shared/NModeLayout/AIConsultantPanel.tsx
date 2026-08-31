/**
 * AIConsultantPanel
 *
 * Canonical artifact-level "AI Consultant" (POZIOM 3 — ARTEFAKT).
 *
 * Per docs/ui-standards/03-modules/BLOCK_TYPES_CANON.md BLOK C and
 * docs/ui-standards/03-modules/INSIGHT_CANON.md "Architektura AI (3 poziomy)":
 *
 *   - Right-side panel (~360px), NOT a modal and NOT a canvas overlay.
 *     It sits as a right column / slide-over and does NOT dim the canvas.
 *   - Header: ⚡/Sparkles (teal) + title + close (X).
 *   - Fixed action menu (5 canon items):
 *       Uzupełnij puste · Synteza · Kontrola jakości · Odśwież · Kontynuuj
 *       (Fill empty · Synthesize · Quality check · Refresh · Continue)
 *   - Chat body with whole-artifact context where the AI proactively greets
 *     ("AI zagaja"). Reuses the canonical UnifiedChatPanel — never reinvented.
 *   - Color: TEAL ONLY (no crimson, no gradients). Dark mode via dark:navy-*.
 *
 * Artifact-agnostic: both Insight and Initiative detail views reuse it by
 * supplying `artifactType` + `actions` + `contextText`/`workspaceContext`.
 *
 * @see src/components/AIChat/UnifiedChatPanel.tsx
 * @see src/components/Reports/Premium/Editor/Toolbar/AIAssistantPanel.tsx
 * @see src/components/shared/NModeLayout/NModeToolbar.tsx
 */

import { CheckCircle2, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { UnifiedChatPanel } from '@/components/AIChat/UnifiedChatPanel';
import i18n from '@/i18n';
import type { WorkspaceContext } from '@/types/workspace';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

// ============================================================================
// Types
// ============================================================================

export interface AIConsultantAction {
  id: string;
  label: string;
  /** Optional Polish label override (rendered when isPolish=true). */
  labelPl?: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  busy?: boolean;
}

export interface AIConsultantPanelProps {
  /** Whether the panel is visible. When false, renders nothing. */
  open: boolean;
  /** Close handler (X button + Escape). */
  onClose: () => void;
  /** Panel title. Default: "AI Consultant". */
  title?: string;
  /** Artifact kind — drives the seeded role/context, never the visuals. */
  artifactType: 'insight' | 'initiative';
  /** Stable artifact id (used to seed conversation context). */
  artifactId: string;
  /** Human-readable artifact title (shown to the AI for greeting context). */
  artifactTitle?: string;
  /** Whole-artifact context summary fed to the chat (all sections + metadata). */
  contextText?: string;
  /** Optional structured workspace context forwarded to UnifiedChatPanel. */
  workspaceContext?: WorkspaceContext | null;
  /** The canon action rows (5 items), wired by the host view. */
  actions: AIConsultantAction[];
  /** Whether the whole panel is busy (disables the action menu). */
  isBusy?: boolean;
  /** PL/EN labels. */
  isPolish?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const PANEL_TOP_OFFSET = 'top-[56px]';

function buildSystemPrompt(
  artifactType: AIConsultantPanelProps['artifactType'],
  artifactTitle: string | undefined,
  contextText: string | undefined,
  t: TFunc
): string {
  const noun = t(`sharedComponents.aiConsultantPanel.systemPromptNoun.${artifactType}`);
  const titlePart = artifactTitle ? ` "${artifactTitle}"` : '';
  const ctx =
    contextText && contextText.trim()
      ? `\n\n${t('sharedComponents.aiConsultantPanel.artifactContextLabel')}:\n${contextText.trim()}`
      : '';

  return t('sharedComponents.aiConsultantPanel.systemPromptTemplate', {
    noun,
    titlePart,
    ctx,
  });
}

function buildKickoff(
  artifactType: AIConsultantPanelProps['artifactType'],
  artifactTitle: string | undefined,
  t: TFunc
): string {
  const titlePart = artifactTitle ? ` „${artifactTitle}”` : '';
  const titlePartEn = artifactTitle ? ` "${artifactTitle}"` : '';
  const noun = t(`sharedComponents.aiConsultantPanel.kickoffNoun.${artifactType}`);
  return t('sharedComponents.aiConsultantPanel.kickoffTemplate', {
    noun,
    titlePart,
    titlePartEn,
  });
}

/**
 * Canonical per-action prompts (keyed by action id). These are the *visible*
 * messages submitted into the embedded chat so every action produces a real AI
 * turn instead of silently no-op-ing. `refresh` is intentionally absent — it
 * keeps the host-supplied onClick (real regenerate) and is never seeded.
 *
 * The artifact-wide context is NOT inlined here: it already rides on the chat's
 * `systemPrompt` (see buildSystemPrompt → contextText), so the AI answers these
 * prompts grounded in the full artifact without us duplicating the payload.
 */
function buildActionPrompt(
  actionId: string,
  artifactType: AIConsultantPanelProps['artifactType'],
  t: TFunc
): string | null {
  const nounEn = artifactType === 'initiative' ? 'initiative' : 'insight';
  const nounPl = artifactType === 'initiative' ? 'inicjatywę' : 'insight';
  const nounPlLoc = artifactType === 'initiative' ? 'tej inicjatywy' : 'tego insightu';

  switch (actionId) {
    case 'fill-empty':
      return t('sharedComponents.aiConsultantPanel.actionPrompt.fillEmpty', {
        nounEn,
        nounPlLoc,
      });
    case 'synthesize':
      return t('sharedComponents.aiConsultantPanel.actionPrompt.synthesize', { nounEn, nounPl });
    case 'quality-check':
      return t('sharedComponents.aiConsultantPanel.actionPrompt.qualityCheck', {
        nounEn,
        nounPl,
      });
    case 'continue':
      return t('sharedComponents.aiConsultantPanel.actionPrompt.continue', { nounEn, nounPl });
    case 'refresh':
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

export const AIConsultantPanel: React.FC<AIConsultantPanelProps> = ({
  open,
  onClose,
  title,
  artifactType,
  artifactId,
  artifactTitle,
  contextText,
  workspaceContext,
  actions,
  isBusy = false,
  isPolish = false,
}) => {
  const t = useMemo<TFunc>(() => i18n.getFixedT(isPolish ? 'pl' : 'en'), [isPolish]);
  const resolvedTitle =
    title || t('sharedComponents.aiConsultantPanel.title', { defaultValue: 'AI Consultant' });

  const systemPrompt = useMemo(
    () => buildSystemPrompt(artifactType, artifactTitle, contextText, t),
    [artifactType, artifactTitle, contextText, t]
  );

  const greetingMessage = useMemo(
    () => buildKickoff(artifactType, artifactTitle, t),
    [artifactType, artifactTitle, t]
  );

  // Controlled kickoff: starts as the AI greeting (auto-sent on first open via
  // UnifiedChatPanel's one-shot kickoff effect). When an action is clicked we
  // swap it to that action's prompt so the FIRST action click auto-submits a
  // real AI turn. UnifiedChatPanel only auto-sends a kickoff while the chat has
  // no messages yet, so for *subsequent* clicks we ALSO seed the input via the
  // canonical Teresa pending-prompt channel (sessionStorage + window event,
  // consumed by EnhancedChatInput) — the prompt lands in the input and the user
  // presses Enter. Either way the buttons are never dead.
  const [kickoffMessage, setKickoffMessage] = useState<string>(greetingMessage);

  // Drive the embedded chat for a clicked action.
  const seedChatWithPrompt = useCallback((prompt: string) => {
    // (1) Bump the controlled kickoff (unique each time to defeat the
    //     same-string guard inside UnifiedChatPanel) — auto-submits when the
    //     chat is still empty (e.g. action clicked before any reply).
    setKickoffMessage(prompt);

    // (2) Seed the chat input via the supported cross-module pending-prompt
    //     channel so the prompt is prefilled even after the greeting turn,
    //     where the one-shot kickoff effect no longer fires.
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'consultify.teresa.pendingPrompt',
          JSON.stringify({ prompt, ts: Date.now() })
        );
        window.dispatchEvent(new CustomEvent('consultify:teresa-pending-prompt'));
      }
    } catch {
      // Non-critical: kickoff path (1) still applies on first open.
    }
  }, []);

  const handleActionClick = useCallback(
    (action: AIConsultantAction) => {
      const prompt = buildActionPrompt(action.id, artifactType, t);
      if (prompt) {
        seedChatWithPrompt(prompt);
      }
      // Always preserve the host wiring/telemetry (and the real regenerate for
      // `refresh`, which has no prompt of its own).
      void action.onClick();
    },
    [artifactType, t, seedChatWithPrompt]
  );

  const roleName = artifactType === 'initiative' ? 'Initiative Consultant' : 'Insight Consultant';

  const quickPrompts = useMemo(
    () =>
      t('sharedComponents.aiConsultantPanel.quickPrompts', {
        returnObjects: true,
      }) as unknown as string[],
    [t]
  );

  // The chat is "unavailable" only if we genuinely cannot embed it. The
  // UnifiedChatPanel needs no required props (all are optional / defaulted),
  // so it is always safe to mount. We still guard with a degradation flag so
  // the panel never crashes if the component fails to resolve at runtime.
  const chatAvailable = typeof UnifiedChatPanel === 'function';

  // Esc closes the panel (kanon TRIADA_KANON.md część B pkt 42; promised by the
  // `onClose` doc comment above but was never actually wired up — a keyboard
  // user had no way to dismiss this slide-over other than clicking the X).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label={resolvedTitle}
      // NON-dimming right slide-over. NOT a modal / NOT an overlay over the
      // canvas — it occupies a 360px column pinned to the right edge.
      className={`fixed right-0 ${PANEL_TOP_OFFSET} bottom-0 z-30 flex w-[360px] flex-col border-l border-slate-200 bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)] dark:border-navy-700 dark:bg-navy-900 dark:shadow-[-8px_0_24px_rgba(0,0,0,0.4)]`}
      data-artifact-type={artifactType}
      data-artifact-id={artifactId}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-navy-700">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{resolvedTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('sharedComponents.aiConsultantPanel.closeLabel')}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Fixed action menu (5 canon items) ───────────────────── */}
      {actions.length > 0 && (
        <div className="border-b border-slate-200 px-3 py-3 dark:border-navy-700">
          <div className="flex flex-col gap-1.5">
            {actions.map((action) => {
              const label = isPolish && action.labelPl ? action.labelPl : action.label;
              const disabled = isBusy || action.busy;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    handleActionClick(action);
                  }}
                  disabled={disabled}
                  className="inline-flex items-center gap-2.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-left text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:border-teal-700/40 dark:bg-teal-900/20 dark:text-teal-300 dark:hover:bg-teal-900/40"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-teal-600 dark:text-teal-300">
                    {action.busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      (action.icon ?? <Wand2 className="h-3.5 w-3.5" />)
                    )}
                  </span>
                  <span className="flex-1">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chat body (whole-artifact context, AI greets) ───────── */}
      <div className="min-h-0 flex-1">
        {chatAvailable ? (
          <UnifiedChatPanel
            mode="split"
            className="h-full"
            showModeToggle={false}
            showHistoryTrigger={false}
            showFocusMode={false}
            roleName={roleName}
            systemPrompt={systemPrompt}
            kickoffMessage={kickoffMessage}
            quickPrompts={quickPrompts}
            workspaceContext={workspaceContext ?? null}
            maxHeight="100%"
          />
        ) : (
          // Graceful degradation — never crash if chat can't be embedded.
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-teal-600 dark:text-teal-300" />
              {t('sharedComponents.aiConsultantPanel.chatUnavailableMessage')}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AIConsultantPanel;
