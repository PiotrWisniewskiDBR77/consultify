/**
 * NotebookRightRail — consolidated right side panel for Notebook.
 * L-03: Combines 4 separate panels (AIChatInlinePanel, AITopicsPanel,
 * ActionItemsPanel, NotebookContextPanel) into a single tabbed rail.
 *
 * Tab A "Praca"   — AI tools: AI chat panel + topics + action items
 * Tab B "Kontekst" — Context panel (Ideas, Initiatives, Tasks, etc.)
 *
 * State (open/tab) is owned by the caller (uiSlice in L-02).
 */
import type { Editor } from '@tiptap/react';
import { Layers, Wrench, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { NotebookPage } from '@/types/myWork';

import { type ConvertTarget, AIChatInlinePanel } from './AIChatInlinePanel';
import { NotebookContextPanel } from './NotebookContextPanel';

interface NotebookRailPage {
  id: string;
  maturity: 'seed' | 'growing' | 'mature' | 'actionable';
  summary?: string | null;
  updatedAt?: string | null;
  visibility?: 'private' | 'project' | null;
  projectId?: string | null;
  wordCount: number;
}

interface NotebookRightRailProps {
  open: boolean;
  activeTab: 'work' | 'context';
  onTabChange: (tab: 'work' | 'context') => void;
  onClose: () => void;

  // Active page data
  activePage: NotebookPage | null;
  allPages: NotebookPage[];
  editor: Editor | null;

  // Props forwarded to AIChatInlinePanel
  noteTitle: string;
  noteContent: string;
  noteTags: string[];
  notePage: NotebookRailPage | undefined;
  onAskAI?: () => void;
  onDeletePage?: () => void;
  onSetVisibility?: (next: 'private' | 'project') => void;
  getRelativeTime?: (iso: string) => string;
  onFocusAICommand?: () => void;
  onOpenAIChat?: () => void;
  onConvert?: (target: ConvertTarget) => void;
  canConvertDeliverable?: boolean;
  convertBlockedReason?: string;
}

export const NotebookRightRail: React.FC<NotebookRightRailProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  activePage,
  allPages,
  editor,
  noteTitle,
  noteContent,
  noteTags,
  notePage,
  onAskAI,
  onDeletePage,
  onSetVisibility,
  getRelativeTime,
  onFocusAICommand,
  onOpenAIChat,
  onConvert,
  canConvertDeliverable,
  convertBlockedReason,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  if (!open || !activePage) return null;

  const tabBtn = (tab: 'work' | 'context', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => onTabChange(tab)}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        activeTab === tab
          ? 'bg-slate-800 text-white dark:bg-white/[0.12]'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.06]'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.06] dark:bg-navy-950">
      {/* Rail header with tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/60 px-2 py-1.5 dark:border-white/[0.06]">
        {tabBtn('work', <Wrench size={11} />, isPolish ? 'Praca' : 'Work')}
        {tabBtn('context', <Layers size={11} />, isPolish ? 'Kontekst' : 'Context')}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
          title={isPolish ? 'Zamknij panel' : 'Close panel'}
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab A: Work — AI tools */}
      <div className={`flex flex-1 flex-col overflow-hidden ${activeTab === 'work' ? '' : 'hidden'}`}>
        <AIChatInlinePanel
          open={true}
          onClose={onClose}
          editor={editor}
          noteTitle={noteTitle}
          noteContent={noteContent}
          noteTags={noteTags}
          page={notePage}
          onAskAI={onAskAI}
          onDeletePage={onDeletePage}
          onSetVisibility={onSetVisibility}
          getRelativeTime={getRelativeTime}
          onFocusAICommand={onFocusAICommand}
          onOpenAIChat={onOpenAIChat}
          onConvert={onConvert}
          canConvertDeliverable={canConvertDeliverable}
          convertBlockedReason={convertBlockedReason}
        />
      </div>

      {/* Tab B: Context — linked workspace items */}
      <div className={`flex flex-1 flex-col overflow-hidden ${activeTab === 'context' ? '' : 'hidden'}`}>
        <NotebookContextPanel
          open={true}
          onClose={onClose}
          editor={editor}
          noteId={activePage.id}
          noteTitle={activePage.title}
          noteTags={noteTags}
          allNotes={allPages}
          noteConvertedTo={activePage.convertedTo || []}
        />
      </div>
    </div>
  );
};
