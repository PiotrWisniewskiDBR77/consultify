import React from 'react';
import { ExternalLink, Link2, MessageSquare, RotateCcw, Share2, Sparkles } from 'lucide-react';

import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { isIdeaNotebookRightPanelPrototypeEnabled } from '@/utils/ideaNotebookRightPanelPrototypeFlag';

export type IdeaNotebookPanelContext = 'idea' | 'notebook';
export type IdeaNotebookPanelState = 'ready' | 'loading' | 'empty' | 'error';

interface PrototypeProps {
  context: IdeaNotebookPanelContext;
  state?: IdeaNotebookPanelState;
  language?: 'pl' | 'en';
  onClose?: () => void;
}

const copy = {
  pl: {
    idea: 'Szczegóły idei', notebook: 'Szczegóły notatki', loading: 'Ładowanie panelu…',
    error: 'Nie udało się pobrać danych panelu.', retry: 'Spróbuj ponownie', share: 'Udostępnij',
    link: 'Kopiuj link', owner: 'Właściciel', status: 'Status', draft: 'Szkic', relations: 'Brak powiązań.',
    evidence: 'Brak zapisanych źródeł i założeń.', comments: 'Brak komentarzy.', history: 'Brak zapisanej historii.',
  },
  en: {
    idea: 'Idea details', notebook: 'Note details', loading: 'Loading panel…',
    error: 'Panel data could not be loaded.', retry: 'Try again', share: 'Share', link: 'Copy link',
    owner: 'Owner', status: 'Status', draft: 'Draft', relations: 'No relations.',
    evidence: 'No sources or assumptions recorded.', comments: 'No comments.', history: 'No history recorded.',
  },
} as const;

const EmptyLine = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-c-text-muted">{children}</p>
);

export const IdeaNotebookRightPanelPrototype: React.FC<PrototypeProps> = ({
  context,
  state = 'ready',
  language = 'pl',
  onClose,
}) => {
  const t = copy[language];
  const title = context === 'idea' ? t.idea : t.notebook;

  const sections: ArtifactRightPanelSection[] = [
    {
      id: 'actions', label: '', defaultOpen: true,
      children: (
        <div className="grid gap-2">
          <button className="flex h-9 items-center gap-2 rounded-lg bg-c-text px-3 text-xs font-semibold text-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"><Share2 size={16} />{t.share}</button>
          <button className="flex h-9 items-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"><Link2 size={16} />{t.link}</button>
        </div>
      ),
    },
    {
      id: 'properties', label: '', defaultOpen: true,
      children: state === 'loading' ? <EmptyLine>{t.loading}</EmptyLine> : state === 'error' ? (
        <div className="rounded-lg border border-c-danger/30 bg-c-danger/10 p-3 text-xs text-c-danger"><p>{t.error}</p><button className="mt-2 flex items-center gap-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"><RotateCcw size={14} />{t.retry}</button></div>
      ) : (
        <dl className="grid gap-3 text-xs"><div><dt className="text-c-text-muted">{t.owner}</dt><dd className="mt-1 font-medium text-c-text">Anna Kowalska</dd></div><div><dt className="text-c-text-muted">{t.status}</dt><dd className="mt-1 font-medium text-c-text">{t.draft}</dd></div></dl>
      ),
    },
    { id: 'relations', label: '', badge: 0, showZeroBadge: true, children: <EmptyLine>{t.relations}</EmptyLine> },
    { id: 'evidence', label: '', badge: 0, showZeroBadge: true, children: <EmptyLine>{t.evidence}</EmptyLine> },
    { id: 'comments', label: '', badge: 0, showZeroBadge: true, icon: MessageSquare, children: <EmptyLine>{t.comments}</EmptyLine> },
    { id: 'history', label: '', badge: 0, showZeroBadge: true, icon: Sparkles, children: <EmptyLine>{t.history}</EmptyLine> },
  ];

  return (
    <aside className="flex max-h-[calc(100vh-2rem)] w-[min(360px,100vw)] flex-col overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface shadow-hig-lg max-[1279px]:w-[min(420px,100vw)]" aria-label={title}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-c-border-subtle px-4"><div><p className="text-[11px] font-medium uppercase tracking-wide text-c-text-muted">{context === 'idea' ? 'Idea' : 'Notebook'}</p><h2 className="text-sm font-semibold text-c-text">{title}</h2></div>{onClose ? <button aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"><ExternalLink size={16} /></button> : null}</header>
      <ArtifactRightPanel sections={sections} width="100%" className="min-h-0 flex-1 border-0" />
    </aside>
  );
};

export function IdeaNotebookRightPanelPrototypeGate({
  legacy,
  ...props
}: PrototypeProps & { legacy: React.ReactNode }) {
  if (!isIdeaNotebookRightPanelPrototypeEnabled()) return <>{legacy}</>;
  return <IdeaNotebookRightPanelPrototype {...props} />;
}
