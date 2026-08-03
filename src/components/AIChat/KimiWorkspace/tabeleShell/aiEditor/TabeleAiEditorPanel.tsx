/**
 * TabeleAiEditorPanel — orchestrator panel rendered in the right rail
 * when the user clicks the AI Editor icon in `<TabeleRightRail>`.
 *
 * Composes:
 *   - 8 `<LevelCard>` tiles (level switcher).
 *   - Prompt textarea bound to the active level.
 *   - "Propose" button → `proposeAiEdit()`.
 *   - `<ProposalDiffCard>` after a proposal is created.
 *   - Soft-warn banner when the budget gate trips 70 %.
 *
 * Cross-tenant safety is enforced by the backend; the panel only sends
 * `tableId` (the workspace and org are resolved server-side from
 * `tp_bases`).
 *
 * The panel exposes an imperative seam (`presetForSuggestion`) so the
 * QA panel can hand off a `QaSuggestion` and we land on the right level
 * with a prefilled context payload.
 *
 * Block C · EPIC-T10 · Sprint C-S5.
 */

import { Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type AiBudgetSnapshot,
  type AiEditorLevel,
  type AiEditorProposeResponse,
  applyAiProposal,
  getAiBudget,
  proposeAiEdit,
  type QaSuggestion,
  rejectAiProposal,
} from '@/services/api/tablePlatform.api';

import { AI_EDITOR_LEVELS_META, getLevelMeta, translateLevelMeta } from './levelMeta';
import { ProposalDiffCard } from './ProposalDiffCard';

export interface TabeleAiEditorPanelProps {
  tableId: string;
  workspaceId: string;
  /** Optional initial level (e.g. when QA panel hands off a suggestion). */
  initialLevel?: AiEditorLevel;
  /** Optional initial prompt (e.g. prefilled from a QA suggestion). */
  initialPrompt?: string;
  /** Optional initial context payload (forwarded to the backend handler). */
  initialContext?: Record<string, unknown>;
  /** Indicates whether the actor has super-admin privileges (required for
   *  levels 7 and 8). The backend enforces; we use this only to disable
   *  the levels in the UI. */
  isSuperAdmin?: boolean;
  /** Test seam: skip network calls. */
  testInitialBudget?: AiBudgetSnapshot | null;
  /**
   * Called after a proposal is successfully applied so the parent view
   * can re-fetch the table preview. Without this, the canvas keeps
   * showing the pre-apply state until the user reopens the table.
   */
  onAfterApply?: () => void;
}

interface ActiveProposal extends AiEditorProposeResponse {
  prompt: string;
}

export const TabeleAiEditorPanel: React.FC<TabeleAiEditorPanelProps> = ({
  tableId,
  workspaceId,
  initialLevel = 'cell',
  initialPrompt = '',
  initialContext,
  isSuperAdmin = false,
  testInitialBudget,
  onAfterApply,
}) => {
  const { t } = useTranslation();
  const [level, setLevel] = useState<AiEditorLevel>(initialLevel);
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [proposing, setProposing] = useState(false);
  const [active, setActive] = useState<ActiveProposal | null>(null);
  const [busyApply, setBusyApply] = useState(false);
  const [busyReject, setBusyReject] = useState(false);
  const [budget, setBudget] = useState<AiBudgetSnapshot | null>(testInitialBudget ?? null);

  // Keep state synced with imperative parent updates (QA → AI Editor).
  useEffect(() => {
    setLevel(initialLevel);
  }, [initialLevel]);
  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  // Best-effort: load budget snapshot once when workspace is known.
  useEffect(() => {
    if (testInitialBudget !== undefined) return;
    if (!workspaceId) return;
    getAiBudget(workspaceId)
      .then(setBudget)
      .catch(() => undefined);
  }, [workspaceId, testInitialBudget]);

  const activeMeta = useMemo(() => {
    const meta = getLevelMeta(level);
    return { ...meta, ...translateLevelMeta(meta, t) };
  }, [level, t]);

  const propose = useCallback(async () => {
    if (!tableId || !prompt.trim()) {
      toast.error(t('kimi.tabeleShell.aiEditor.promptRequired', 'Prompt is required'));
      return;
    }
    setProposing(true);
    try {
      const result = await proposeAiEdit(tableId, {
        level,
        prompt: prompt.trim(),
        context: initialContext,
      });
      setActive({ ...result, prompt: prompt.trim() });
      if (result.softWarn) {
        toast(t('kimi.tabeleShell.aiEditor.softWarnBudget', 'Soft warning: AI budget at 70 %.'), {
          icon: '⚠️',
        });
      }
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.aiEditor.proposeFailed', {
          defaultValue: 'Failed to propose: {{reason}}',
          reason:
            (e as Error)?.message ?? t('kimi.tabeleShell.aiEditor.unknownError', 'unknown error'),
        })
      );
    } finally {
      setProposing(false);
    }
  }, [tableId, level, prompt, initialContext, t]);

  const apply = useCallback(async () => {
    if (!active || !workspaceId) return;
    setBusyApply(true);
    try {
      const result = await applyAiProposal(active.proposalId, workspaceId, {
        idempotent: true,
      });
      toast.success(
        t('kimi.tabeleShell.aiEditor.applied', {
          defaultValue: 'Applied: {{reason}}',
          reason: result.reason ?? t('kimi.tabeleShell.aiEditor.ok', 'ok'),
        })
      );
      setActive(null);
      setPrompt('');
      // Refresh budget so the badge reflects the just-spent tokens.
      if (workspaceId) {
        getAiBudget(workspaceId)
          .then(setBudget)
          .catch(() => undefined);
      }
      // Tell the parent view to re-fetch the table preview so the canvas
      // does not lag behind the just-applied diff.
      try {
        onAfterApply?.();
      } catch {
        // never let a parent callback throw out of the apply path
      }
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.aiEditor.applyFailed', {
          defaultValue: 'Apply failed: {{reason}}',
          reason:
            (e as Error)?.message ?? t('kimi.tabeleShell.aiEditor.unknownError', 'unknown error'),
        })
      );
    } finally {
      setBusyApply(false);
    }
  }, [active, workspaceId, onAfterApply, t]);

  const reject = useCallback(async () => {
    if (!active || !workspaceId) return;
    setBusyReject(true);
    try {
      await rejectAiProposal(active.proposalId, workspaceId);
      toast.success(t('kimi.tabeleShell.aiEditor.rejected', 'Proposal rejected'));
      setActive(null);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.aiEditor.rejectFailed', {
          defaultValue: 'Reject failed: {{reason}}',
          reason:
            (e as Error)?.message ?? t('kimi.tabeleShell.aiEditor.unknownError', 'unknown error'),
        })
      );
    } finally {
      setBusyReject(false);
    }
  }, [active, workspaceId, t]);

  return (
    <section
      className="flex h-full flex-col gap-3 p-3"
      data-testid="tabele-ai-editor-panel"
      aria-label={t('kimi.tabeleShell.aiEditor.ariaLabel', 'Tabele AI Editor')}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">
          {t('kimi.tabeleShell.aiEditor.title', 'AI Editor')}
        </h3>
        {budget && (
          <span className="text-[11px] text-c-text-secondary" data-testid="ai-editor-budget">
            {t('kimi.tabeleShell.aiEditor.budgetLabel', {
              defaultValue: '{{used}} / {{total}} tokens',
              used: budget.tokensUsedToday.toLocaleString(),
              total: budget.budget.toLocaleString(),
            })}
          </span>
        )}
      </header>

      <div
        className="grid grid-cols-2 gap-1.5"
        role="radiogroup"
        aria-label={t('kimi.tabeleShell.aiEditor.levelRadioGroup', 'AI Editor level')}
      >
        {AI_EDITOR_LEVELS_META.map((meta) => {
          const Icon = meta.icon;
          const disabled = meta.superAdminOnly === true && !isSuperAdmin;
          const selected = level === meta.id;
          const { label, description } = translateLevelMeta(meta, t);
          return (
            <button
              key={meta.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => setLevel(meta.id)}
              data-testid={`ai-editor-level-${meta.id}`}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                selected
                  ? 'border-c-border-subtle bg-c-surface-raised'
                  : 'border-c-border-subtle bg-c-surface hover:bg-c-surface-raised'
              } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
              title={
                disabled
                  ? t('kimi.tabeleShell.aiEditor.requiresSuperAdmin', {
                      defaultValue: '{{label}} requires super-admin role',
                      label,
                    })
                  : t('kimi.tabeleShell.aiEditor.levelTitle', {
                      defaultValue: '{{label}} — {{description}}',
                      label,
                      description,
                    })
              }
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-c-surface-raised text-[10px] text-c-text-secondary">
                {meta.numeral}
              </span>
              <Icon className="h-3.5 w-3.5 text-c-text-secondary" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <div>
        <label
          htmlFor="ai-editor-prompt"
          className="mb-1 block text-[11px] uppercase tracking-wide text-c-text-secondary"
        >
          {t('kimi.tabeleShell.aiEditor.promptLabel', {
            defaultValue: '{{label}} prompt',
            label: activeMeta.label,
          })}
        </label>
        <textarea
          id="ai-editor-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={activeMeta.description}
          rows={4}
          data-testid="ai-editor-prompt"
          className="w-full rounded-md border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-sm text-c-text placeholder:text-c-text-muted focus:border-c-border-strong focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-c-text-secondary">
          {t(
            'kimi.tabeleShell.aiEditor.disclaimer',
            'AI never executes. You always review the diff and approve.'
          )}
        </p>
        <button
          type="button"
          onClick={propose}
          disabled={proposing || !prompt.trim() || !tableId}
          className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface px-2.5 py-1 text-xs text-c-text hover:bg-c-bg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          data-testid="ai-editor-propose"
        >
          {proposing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {t('kimi.tabeleShell.aiEditor.propose', 'Propose')}
        </button>
      </div>

      {active && (
        <ProposalDiffCard
          proposalId={active.proposalId}
          level={active.level}
          handlerStatus={active.handlerStatus}
          softWarn={active.softWarn}
          prompt={active.prompt}
          busyApply={busyApply}
          busyReject={busyReject}
          onApply={apply}
          onReject={reject}
        />
      )}
    </section>
  );
};

export default TabeleAiEditorPanel;
