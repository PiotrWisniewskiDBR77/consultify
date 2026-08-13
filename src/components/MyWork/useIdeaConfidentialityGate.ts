/**
 * E12 (RISK-22) — Idea confidentiality gate: the SET side of
 * `server/src/services/ideaConfidentiality.ts` (which only ever READS the
 * column). Extracted out of IdeaMapWorkspace.tsx so the confirm/save/revert
 * logic is one importable, directly-testable unit instead of inline JSX-file
 * state — the same logic IdeaMapWorkspace mounts in production is what the
 * component tests below exercise, not a re-implementation of it.
 *
 * Contract (mission rules, see CLAUDE.md + the RISK-22 brief):
 *   - Downgrade (restricted -> confidential -> standard) requires an
 *     explicit confirm naming what protection is being given up. Upgrade
 *     applies immediately.
 *   - No false success: `confidentiality` state only changes AFTER
 *     `PUT /my-ideas/:id` resolves. A rejected/thrown request leaves state
 *     untouched and surfaces a toast error — never an optimistic guess.
 *   - `confidentialitySupported` is the explicit GET capability flag; the
 *     caller (IdeaWorkspaceTools) hides the control entirely when it's
 *     false rather than offering a control that can't persist.
 */
import type { TFunction } from 'i18next';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { useConfirmDialog } from './shared/ConfirmDialog';

export type IdeaConfidentialityLevel = 'standard' | 'confidential' | 'restricted';

const CONFIDENTIALITY_LEVELS: readonly IdeaConfidentialityLevel[] = [
  'standard',
  'confidential',
  'restricted',
];

// Downgrade = moving to a LOWER rank (restricted -> confidential -> standard).
const CONFIDENTIALITY_RANK: Record<IdeaConfidentialityLevel, number> = {
  standard: 0,
  confidential: 1,
  restricted: 2,
};

const CONFIDENTIALITY_LABEL_KEYS: Record<IdeaConfidentialityLevel, string> = {
  standard: 'myWorkIdeas.workspaceTools.confidentialityStandard',
  confidential: 'myWorkIdeas.workspaceTools.confidentialityConfidential',
  restricted: 'myWorkIdeas.workspaceTools.confidentialityRestricted',
};

function normalizeLevel(value: unknown): IdeaConfidentialityLevel {
  return (CONFIDENTIALITY_LEVELS as readonly string[]).includes(value as string)
    ? (value as IdeaConfidentialityLevel)
    : 'standard';
}

// Integration fix (2026-08-12): this hook originally declared its own narrow
// `type TFn = (key: string, ...) => string` — the ONLY such alias in the
// codebase. i18next's real `TFunction` is a richer overloaded signature and is
// not assignable to it, so the client type-check failed at the single real
// caller (`IdeaMapWorkspace.tsx:377`, which passes `useTranslation()`'s `t`).
// The rest of the repo already types an injected `t` as `TFunction`
// (`ConvertToConfirmation.tsx:44`, `DecisionsPanelContent.tsx:304/362/510/641`),
// so this follows the existing convention instead of widening a bespoke alias.
//
// Caught only by the full `tsc` on the integrated tree: targeted vitest passes
// regardless (types are erased at runtime) and esbuild does not type-check, and
// the stream that wrote this hook was barred from running a full type-check.

export interface UseIdeaConfidentialityGateArgs {
  /** react-i18next's `t` — used for pill/dialog copy (locale keys in both
   * public/locales/pl and public/locales/en; PL/EN fallback literals are
   * passed alongside every key so a missing key never surfaces to a user
   * as a raw dotted path). */
  t: TFunction;
  isPolish: boolean;
  /** Idea title — named in the downgrade-confirmation description. */
  title: string;
}

export interface UseIdeaConfidentialityGate {
  confidentiality: IdeaConfidentialityLevel;
  confidentialitySupported: boolean;
  confidentialitySaving: boolean;
  /** Call once per fresh GET/POST idea payload to hydrate state from it. */
  hydrateFromIdea: (
    idea: { confidentiality?: unknown; confidentialitySupported?: unknown } | null | undefined
  ) => void;
  /** Wire straight into `IdeaWorkspaceTools`' `onConfidentialityChange`. */
  handleConfidentialityChange: (ideaId: string, next: IdeaConfidentialityLevel) => Promise<void>;
  /** Render once, anywhere in the tree (same convention as `deleteIdeaDialog`). */
  confidentialityDowngradeDialog: React.ReactNode;
}

export function useIdeaConfidentialityGate({
  t,
  isPolish,
  title,
}: UseIdeaConfidentialityGateArgs): UseIdeaConfidentialityGate {
  const [confidentiality, setConfidentiality] = useState<IdeaConfidentialityLevel>('standard');
  const [confidentialitySupported, setConfidentialitySupported] = useState(false);
  const [confidentialitySaving, setConfidentialitySaving] = useState(false);
  const { dialog: confidentialityDowngradeDialog, confirm: confirmDowngrade } =
    useConfirmDialog();

  const hydrateFromIdea = useCallback(
    (idea: { confidentiality?: unknown; confidentialitySupported?: unknown } | null | undefined) => {
      setConfidentiality(normalizeLevel(idea?.confidentiality));
      setConfidentialitySupported(Boolean(idea?.confidentialitySupported));
    },
    []
  );

  const handleConfidentialityChange = useCallback(
    async (ideaId: string, next: IdeaConfidentialityLevel) => {
      if (!ideaId || next === confidentiality) return;
      const isDowngrade = CONFIDENTIALITY_RANK[next] < CONFIDENTIALITY_RANK[confidentiality];
      if (isDowngrade) {
        const fromLabel = t(CONFIDENTIALITY_LABEL_KEYS[confidentiality]);
        const toLabel = t(CONFIDENTIALITY_LABEL_KEYS[next]);
        const descriptionParts = [
          t('myWorkIdeas.workspaceTools.confidentialityDowngradeDescription', {
            title: title || (isPolish ? 'Bez tytułu' : 'Untitled'),
            from: fromLabel,
            to: toLabel,
          }),
        ];
        if (confidentiality === 'restricted') {
          descriptionParts.push(
            t('myWorkIdeas.workspaceTools.confidentialityDowngradeRestrictedWarning')
          );
        }
        const ok = await confirmDowngrade({
          title: t(
            'myWorkIdeas.workspaceTools.confidentialityDowngradeTitle',
            isPolish ? 'Obniżyć poufność?' : 'Lower confidentiality?'
          ),
          description: descriptionParts.join(' '),
          confirmLabel: t(
            'myWorkIdeas.workspaceTools.confidentialityDowngradeConfirm',
            isPolish ? 'Obniż ochronę' : 'Lower protection'
          ),
          cancelLabel: t(
            'myWorkIdeas.workspaceTools.confidentialityDowngradeCancel',
            isPolish ? 'Anuluj' : 'Cancel'
          ),
          variant: 'warning',
        });
        if (!ok) return;
      }
      setConfidentialitySaving(true);
      try {
        const updated = await Api.updateMyIdea(ideaId, { confidentiality: next });
        const persisted = (CONFIDENTIALITY_LEVELS as readonly string[]).includes(
          (updated as { confidentiality?: unknown })?.confidentiality as string
        )
          ? ((updated as { confidentiality?: unknown }).confidentiality as IdeaConfidentialityLevel)
          : next;
        setConfidentiality(persisted);
        toast.success(
          t(
            'myWorkIdeas.workspaceTools.confidentialityChanged',
            isPolish ? 'Poufność zaktualizowana' : 'Confidentiality updated'
          ),
          { duration: 900 }
        );
      } catch (err: unknown) {
        // No false success — `confidentiality` state is left exactly as it
        // was, so the pill keeps showing the last-confirmed server value.
        const message = err instanceof Error ? err.message : undefined;
        toast.error(
          message ||
            t(
              'myWorkIdeas.workspaceTools.confidentialityChangeFailed',
              isPolish
                ? 'Nie udało się zaktualizować poufności'
                : 'Failed to update confidentiality'
            )
        );
      } finally {
        setConfidentialitySaving(false);
      }
    },
    [confidentiality, confirmDowngrade, t, title, isPolish]
  );

  return {
    confidentiality,
    confidentialitySupported,
    confidentialitySaving,
    hydrateFromIdea,
    handleConfidentialityChange,
    confidentialityDowngradeDialog,
  };
}
