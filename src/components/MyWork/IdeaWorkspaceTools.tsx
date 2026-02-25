/**
 * IdeaWorkspaceTools — Workspace tool panel for Idea Map Workspace.
 * Composes shared Workspace sections (AI, Transform, Share) with
 * idea-specific sections (Challenge, AI Map, Metadata, Convert).
 *
 * Standard "Workspace" pattern — sibling of the notebook AIChatInlinePanel.
 */
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  GitBranch,
  MessageSquarePlus,
  Rocket,
  Save,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  AIQuickActions,
  SectionLabel,
  ShareSection,
  ToolsPanelShell,
  TransformTextSection,
  type WorkspaceContext,
} from '@/components/shared/WorkspaceTools';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

type ConvertTarget = 'initiative' | 'task_set' | 'decision' | 'team_chat';

interface IdeaWorkspaceToolsProps {
  open: boolean;
  onClose: () => void;

  ideaId: string;
  title: string;
  seedText: string;
  stage: string;
  branch: string;
  area: string;
  priority: number;
  isDraft: boolean;
  isAccepted: boolean;
  saving: boolean;
  draftSavedLabel: string;

  onTitleChange: (v: string) => void;
  onSeedTextChange: (v: string) => void;
  onBranchChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onPriorityChange: (v: number) => void;
  onSave: () => void;
  onAcceptChallenge: () => void;
  onConvert: (target: ConvertTarget) => void;
  onOpenChat: () => void;
  onFocusAICommand?: () => void;
}

export const IdeaWorkspaceTools: React.FC<IdeaWorkspaceToolsProps> = ({
  open,
  onClose,
  ideaId,
  title,
  seedText,
  stage,
  branch,
  area,
  priority,
  isDraft,
  isAccepted,
  saving,
  draftSavedLabel,
  onTitleChange,
  onSeedTextChange,
  onBranchChange,
  onAreaChange,
  onPriorityChange,
  onSave,
  onAcceptChallenge,
  onConvert,
  onOpenChat,
  onFocusAICommand,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const [activeTab, setActiveTab] = useState<'challenge' | 'ai' | 'metadata' | 'convert'>('challenge');

  const wsContext: WorkspaceContext = useMemo(
    () => ({
      title,
      content: seedText,
      tags: [branch, area].filter(Boolean),
      entityType: 'idea',
      entityId: ideaId,
    }),
    [title, seedText, branch, area, ideaId]
  );

  const sendToChat = useCallback(
    (prompt: string) => {
      setChatKickoffMessage(prompt);
      if (isChatCollapsed) toggleChatCollapse();
    },
    [setChatKickoffMessage, isChatCollapsed, toggleChatCollapse]
  );

  const handleAIExpand = useCallback(() => {
    if (!isAccepted) {
      toast(isPl ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.');
      setActiveTab('challenge');
      return;
    }
    const excerpt = (seedText || '').trim().slice(0, 2000);
    sendToChat(
      isPl
        ? `Na podstawie wyzwania "${title}" rozbuduj mapę rekomendacji. Zaproponuj 5-7 nowych gałęzi z konkretnymi akcjami.\n\nOpis:\n${excerpt}`
        : `Based on challenge "${title}", expand the recommendation map. Propose 5-7 new branches with concrete actions.\n\nDescription:\n${excerpt}`
    );
    trackFunnelEvent('notebook_transform_used', {});
    toast.success(isPl ? 'Wysłano do czata AI' : 'Sent to AI chat');
  }, [isAccepted, isPl, seedText, sendToChat, title]);

  if (!open) return null;

  const tabs = [
    { id: 'challenge' as const, label: isPl ? 'Wyzwanie' : 'Challenge' },
    { id: 'ai' as const, label: 'AI' },
    { id: 'metadata' as const, label: isPl ? 'Metadane' : 'Metadata' },
    { id: 'convert' as const, label: isPl ? 'Konwersja' : 'Convert' },
  ];

  const convertActions: { id: ConvertTarget; icon: React.ComponentType<any>; labelPl: string; labelEn: string; descPl: string; descEn: string; gradient: string; textColor: string }[] = [
    { id: 'initiative', icon: Rocket, labelPl: 'Inicjatywa', labelEn: 'Initiative', descPl: 'Utwórz w PMO', descEn: 'Create in PMO', gradient: 'from-amber-500/15 to-orange-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
    { id: 'task_set', icon: CheckSquare, labelPl: 'Taski', labelEn: 'Tasks', descPl: 'Z next steps', descEn: 'From next steps', gradient: 'from-emerald-500/15 to-green-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { id: 'decision', icon: Star, labelPl: 'Decyzja', labelEn: 'Decision', descPl: 'Artefakt decyzyjny', descEn: 'Decision artifact', gradient: 'from-blue-500/15 to-cyan-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
    { id: 'team_chat', icon: MessageSquarePlus, labelPl: 'Team Chat', labelEn: 'Team Chat', descPl: 'Wątek do omówienia', descEn: 'Discussion thread', gradient: 'from-violet-500/15 to-purple-500/10', textColor: 'text-violet-600 dark:text-violet-400' },
  ];

  const priorityOptions = [
    { value: 25, label: isPl ? 'Niski' : 'Low' },
    { value: 50, label: isPl ? 'Średni' : 'Medium' },
    { value: 75, label: isPl ? 'Wysoki' : 'High' },
    { value: 100, label: isPl ? 'Krytyczny' : 'Critical' },
  ];

  const stageLabel = (() => {
    const s = String(stage || '').toLowerCase();
    if (s === 'incubating') return isPl ? 'Inkubacja' : 'Incubating';
    if (s === 'shaping') return isPl ? 'Kształtuje się' : 'Shaping';
    if (s === 'ready') return isPl ? 'Gotowy' : 'Ready';
    if (s === 'promoted') return isPl ? 'Promowany' : 'Promoted';
    return isPl ? 'Iskra' : 'Spark';
  })();

  return (
    <ToolsPanelShell
      title={isPl ? 'Narzędzia' : 'Tools'}
      subtitle={isPl ? 'Obszar roboczy' : 'Workspace'}
      icon={
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm shadow-amber-500/20">
          <GitBranch size={13} className="text-white" />
        </div>
      }
      onClose={onClose}
    >
      {/* ─── Stage badge ─── */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400/20 to-orange-400/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {stageLabel}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{draftSavedLabel}</span>
        </div>
      </div>

      {/* ─── Tab switcher ─── */}
      <div className="px-3 py-2 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-300 shadow-sm'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Challenge tab (idea-specific) ─── */}
      {activeTab === 'challenge' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Opis wyzwania' : 'Challenge description'}</SectionLabel>
          <textarea
            value={seedText}
            onChange={(e) => onSeedTextChange(e.target.value)}
            rows={6}
            placeholder={isPl ? 'Opisz problem lub pomysł…' : 'Describe the problem or idea…'}
            className="w-full px-3 py-2 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400/40 resize-none transition-all"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onSave}
              disabled={saving || isDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-emerald-500/12 to-teal-500/8 text-emerald-700 dark:text-emerald-300 hover:from-emerald-500/20 hover:to-teal-500/15 border border-emerald-500/10 hover:border-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Save size={11} />
              {isPl ? 'Zapisz' : 'Save'}
            </button>
            <button
              onClick={onAcceptChallenge}
              disabled={saving || isDraft || !seedText.trim() || isAccepted}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-amber-500/12 to-orange-500/8 text-amber-700 dark:text-amber-300 hover:from-amber-500/20 hover:to-orange-500/15 border border-amber-500/10 hover:border-amber-500/20 transition-all disabled:opacity-50"
              title={isAccepted ? (isPl ? 'Zaakceptowane' : 'Accepted') : undefined}
            >
              <CheckCircle2 size={11} />
              {isAccepted ? (isPl ? 'Zaakceptowane' : 'Accepted') : (isPl ? 'Akceptuj' : 'Accept')}
            </button>
          </div>
        </div>
      )}

      {/* ─── AI tab (idea-specific) ─── */}
      {activeTab === 'ai' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'AI: rozbudowa mapy' : 'AI: expand the map'}</SectionLabel>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            {isPl
              ? 'Wybierz gałąź na mapie, potem kliknij AI na mapie. Lub użyj przycisku poniżej.'
              : 'Pick a branch on the map, then click AI on the map. Or use the button below.'}
          </div>
          {!isAccepted && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-xl p-2.5 mb-3">
              {isPl ? 'Zaakceptuj wyzwanie, aby odblokować AI.' : 'Accept the challenge to unlock AI.'}
            </div>
          )}
          <button
            onClick={handleAIExpand}
            disabled={!isAccepted}
            className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md disabled:opacity-40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-indigo-500/8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/15 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="relative flex-1 min-w-0 text-left">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {isPl ? 'Rozbuduj mapę z AI' : 'Expand map with AI'}
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500">
                {isPl ? 'Zaproponuje nowe gałęzie' : 'Will propose new branches'}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ─── Metadata tab (idea-specific) ─── */}
      {activeTab === 'metadata' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Metadane' : 'Metadata'}</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80">{isPl ? 'Gałąź' : 'Branch'}</div>
              <input
                value={branch}
                onChange={(e) => onBranchChange(e.target.value)}
                placeholder={isPl ? 'np. Finanse' : 'e.g. Finance'}
                className="w-full h-8 px-2.5 rounded-lg text-[11px] bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80">{isPl ? 'Obszar' : 'Area'}</div>
              <input
                value={area}
                onChange={(e) => onAreaChange(e.target.value)}
                placeholder={isPl ? 'np. Operacje' : 'e.g. Ops'}
                className="w-full h-8 px-2.5 rounded-lg text-[11px] bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80">{isPl ? 'Priorytet' : 'Priority'}</div>
              <div className="relative">
                <select
                  value={String(Math.round(priority / 25) * 25)}
                  onChange={(e) => onPriorityChange(Number(e.target.value))}
                  className="appearance-none w-full h-8 px-2.5 pr-7 rounded-lg text-[11px] bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                >
                  {priorityOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100/80 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-all disabled:opacity-50"
            >
              <Save size={11} />
              {isPl ? 'Zapisz metadane' : 'Save metadata'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Convert tab (idea-specific) ─── */}
      {activeTab === 'convert' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Konwersja' : 'Convert'}</SectionLabel>
          <div className="grid grid-cols-1 gap-1.5">
            {convertActions.map(({ id, icon: Icon, labelPl, labelEn, descPl, descEn, gradient, textColor }) => (
              <button
                key={id}
                onClick={() => onConvert(id)}
                disabled={isDraft}
                className="group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md disabled:opacity-40"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} group-hover:opacity-150 transition-opacity`} />
                <div className="absolute inset-0 border border-current/[0.06] group-hover:border-current/[0.12] rounded-xl transition-colors" />
                <div className={`relative w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${textColor} shrink-0`}>
                  <Icon size={14} />
                </div>
                <div className="relative flex-1 min-w-0 text-left">
                  <div className={`text-[11px] font-bold ${textColor}`}>{isPl ? labelPl : labelEn}</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">{isPl ? descPl : descEn}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── AI Quick Actions (shared) ─── */}
      <AIQuickActions isPl={isPl} onFocusAICommand={onFocusAICommand} onOpenAIChat={onOpenChat} />

      {/* ─── Transform (shared) ─── */}
      <TransformTextSection isPl={isPl} context={wsContext} />

      {/* ─── Share (shared) ─── */}
      <ShareSection isPl={isPl} context={wsContext} />
    </ToolsPanelShell>
  );
};

export default IdeaWorkspaceTools;
