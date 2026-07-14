/**
 * UnifiedCreateLauncher — I1-I3 Faza 0 "bezpieczny pierwszy krok".
 *
 * One "+ Nowy" entry point that shows a Krok 0 chooser (Insight / Initiative /
 * Decision) and delegates to the EXISTING, UNCHANGED generators:
 *   - Insight    → InsightCreatorModal   (src/components/Interview/InsightCreatorModal.tsx)
 *   - Initiative → InitiativeCharterWizard (src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx)
 *                   — charter-lite, NOT the portfolio wizard (InitiativeWizardModal
 *                   stays untouched — ADR #68b / plan §5).
 *   - Decision   → NewDecisionModal      (src/components/MyWork/DecisionsPanel.tsx)
 *
 * Zero changes to any of the three generators' own logic — this component only
 * owns the "which type" step and renders the picked generator with the props it
 * already accepts standalone (isOpen/onClose + its own success callback).
 *
 * See Harvard/wdrozenie-100/_PLAN_I1-I3_UNIFIKACJA_KREATOROW.md §6 Faza 0.
 * Gated by unifiedCreateLauncherFlag.ts (default OFF) — wire the caller behind
 * `isUnifiedCreateLauncherEnabled()` before rendering this component.
 */
import { Lightbulb, Scale, Target, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InitiativeCharterWizard } from '@/components/Initiatives/Wizard/InitiativeCharterWizard';
import { InsightCreatorModal } from '@/components/Interview/InsightCreatorModal';
import { NewDecisionModal } from '@/components/MyWork/DecisionsPanel';
import { Api } from '@/services/api';

type CreatorType = 'insight' | 'initiative' | 'decision';

/** Matches exactly what NewDecisionModal's handleSubmit sends today. */
type NewDecisionPayload = Parameters<React.ComponentProps<typeof NewDecisionModal>['onSubmit']>[0];

export interface UnifiedCreateLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired after a generator reports success (fire-and-forget refresh hook for the host). */
  onCreated?: (type: CreatorType) => void;
  /** Passed through to InitiativeCharterWizard / decision POST. */
  projectId?: string;
  isPolish?: boolean;
}

const CHOICES: Array<{
  type: CreatorType;
  icon: React.ElementType;
  title: { pl: string; en: string };
  hint: { pl: string; en: string };
}> = [
  {
    type: 'insight',
    icon: Lightbulb,
    title: { pl: 'Insight', en: 'Insight' },
    hint: {
      pl: 'Wniosek AI z wywiadów i sesji',
      en: 'AI-generated finding from interviews & sessions',
    },
  },
  {
    type: 'initiative',
    icon: Target,
    title: { pl: 'Inicjatywa', en: 'Initiative' },
    hint: { pl: 'Karta charter — problem, zakres, KPI', en: 'Charter card — problem, scope, KPI' },
  },
  {
    type: 'decision',
    icon: Scale,
    title: { pl: 'Decyzja', en: 'Decision' },
    hint: { pl: 'Ręczny wniosek decyzyjny', en: 'Manual decision request' },
  },
];

export const UnifiedCreateLauncher: React.FC<UnifiedCreateLauncherProps> = ({
  isOpen,
  onClose,
  onCreated,
  projectId,
  isPolish: isPolishProp,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const [selected, setSelected] = useState<CreatorType | null>(null);

  const handleFullClose = () => {
    setSelected(null);
    onClose();
  };

  const handleDecisionSubmit = async (data: NewDecisionPayload) => {
    try {
      await Api.post('/decisions', {
        ...data,
        projectId,
        relatedObjectType: 'PROJECT',
        relatedObjectId: projectId,
      });
      toast.success(isPolish ? 'Utworzono wniosek decyzyjny' : 'Decision request created');
      onCreated?.('decision');
    } catch (error) {
      console.error('Failed to create decision:', error);
      toast.error(isPolish ? 'Nie udało się utworzyć decyzji' : 'Failed to create decision');
    }
  };

  if (!isOpen) return null;

  // Krok 0 — chooser. Delegation happens by simply rendering the picked
  // generator below with `isOpen` — each one owns its own full-screen modal
  // chrome, so this wrapper renders nothing extra once a type is picked.
  if (!selected) {
    return (
      <div
        className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) handleFullClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unified-create-launcher-title"
          className="mx-4 w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/[0.08] dark:bg-navy-900"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.08]">
            <h2
              id="unified-create-launcher-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {isPolish ? 'Nowy' : 'New'}
            </h2>
            <button
              type="button"
              onClick={handleFullClose}
              aria-label={isPolish ? 'Zamknij' : 'Close'}
              className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-3">
            {CHOICES.map(({ type, icon: Icon, title, hint }) => (
              <button
                key={type}
                type="button"
                data-testid={`unified-create-launcher-${type}`}
                onClick={() => setSelected(type)}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:border-white/[0.08] dark:bg-navy-950/30 dark:hover:bg-white/[0.06]"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-white dark:bg-white/[0.08] dark:text-slate-100">
                  <Icon size={18} />
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isPolish ? title.pl : title.en}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish ? hint.pl : hint.en}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selected === 'insight') {
    return (
      <InsightCreatorModal
        isOpen
        onClose={handleFullClose}
        onSuccess={() => onCreated?.('insight')}
      />
    );
  }

  if (selected === 'initiative') {
    return (
      <InitiativeCharterWizard
        isOpen
        onClose={handleFullClose}
        onCreated={() => {
          onCreated?.('initiative');
          handleFullClose();
        }}
        projectId={projectId}
        isPolish={isPolish}
      />
    );
  }

  // selected === 'decision'
  return <NewDecisionModal isOpen onClose={handleFullClose} onSubmit={handleDecisionSubmit} />;
};

export default UnifiedCreateLauncher;
