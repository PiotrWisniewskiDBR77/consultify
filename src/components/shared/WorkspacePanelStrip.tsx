import { Lightbulb, MessageSquareWarning, SlidersHorizontal } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type WorkspacePanelKey = 'tools' | 'context' | 'ai_suggestions' | null;

export interface WorkspacePanelStripProps {
  value: WorkspacePanelKey;
  onChange: (next: WorkspacePanelKey) => void;
  className?: string;
  size?: number;
  variant?: 'chrome' | 'subtle';
}

export const WorkspacePanelStrip: React.FC<WorkspacePanelStripProps> = ({
  value,
  onChange,
  className,
  size = 16,
  variant = 'chrome',
}) => {
  const { t } = useTranslation();

  const styles = useMemo(() => {
    // 'chrome' matches ModuleHub topbar controls; 'subtle' is for embedding inside a panel header
    const base =
      variant === 'subtle'
        ? 'rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/60'
        : 'rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900';
    const pad = 'p-0.5';
    return `${base} ${pad}`;
  }, [variant]);

  const Btn: React.FC<{
    id: Exclude<WorkspacePanelKey, null>;
    icon: React.ComponentType<{ size?: number }>;
    title: string;
    activeClass: string;
  }> = ({ id, icon: Icon, title, activeClass }) => {
    const active = value === id;
    return (
      <button
        type="button"
        onClick={() => onChange(active ? null : id)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
          active
            ? `bg-white dark:bg-navy-800 shadow-sm border border-slate-200 dark:border-navy-600 ${activeClass}`
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
        title={title}
        aria-label={title}
        aria-pressed={active}
      >
        <Icon size={size} />
      </button>
    );
  };

  return (
    <div
      className={`inline-flex items-center ${styles} ${className || ''}`}
      role="group"
      aria-label={t('sharedComponents.workspacePanelStrip.ariaLabel')}
    >
      <Btn
        id="tools"
        icon={SlidersHorizontal}
        title={t('sharedComponents.workspacePanelStrip.tools')}
        // ★ NAPRAWA (1.1-N, prawy róg warsztatu): stan aktywny był w rodzinie
        // tailwind „primary” (odcienie 600/300 = Harvard Crimson #85182F,
        // tailwind.config.js) — czerwień jest zarezerwowana dla stanu
        // KRYTYCZNEGO, nie dla zwykłego przełącznika widoku. Neutralny
        // akcentowy token c-focus-solid (ten sam, którego używa
        // NModeLeftNav/RightRail dla aktywnej zakładki).
        activeClass="text-c-focus-solid"
      />
      <Btn
        id="context"
        icon={Lightbulb}
        title={t('sharedComponents.workspacePanelStrip.contextLinks')}
        activeClass="text-amber-600 dark:text-amber-300"
      />
      <Btn
        id="ai_suggestions"
        icon={MessageSquareWarning}
        title={t('sharedComponents.workspacePanelStrip.aiSuggestions')}
        // ★ NAPRAWA (1.1-N): jak wyżej — crimson zdjęty, neutralny c-focus-solid.
        activeClass="text-c-focus-solid"
      />
    </div>
  );
};

export default WorkspacePanelStrip;
