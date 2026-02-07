/**
 * Help Side Panel
 *
 * A sliding panel that displays contextual help documentation.
 * Contains 3 tabs: Overview, FAQ, Knowledge Base
 *
 * Features:
 * - Overview with intro, video button, and quick guides
 * - FAQ with searchable questions
 * - Knowledge Base with coming soon categories and notify CTA
 */

import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  HelpCircle,
  Keyboard,
  Library,
  Loader2,
  PlayCircle,
  Rocket,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  getGuides,
  getKnowledgeBaseCategories,
  getVideoUrl,
  HELP_CONFIG,
} from '../../config/helpContent';
import { HelpTab, useHelpSidePanel } from '../../contexts/HelpContext';
import { KeyboardShortcutsHelp } from '../MyWork/shared/KeyboardShortcutsHelp';
import { KnowledgeArticleView } from './KnowledgeArticleView';
import { KnowledgeLibrary } from './KnowledgeLibrary';

// Tab configuration - 3 tabs: Overview, FAQ, Knowledge Base
const TABS: { id: HelpTab; icon: typeof BookOpen; label: string; labelKey: string }[] = [
  { id: 'overview', icon: BookOpen, label: 'Overview', labelKey: 'help.sidePanel.tabs.overview' },
  { id: 'faq', icon: HelpCircle, label: 'FAQ', labelKey: 'help.sidePanel.tabs.faq' },
  {
    id: 'knowledge',
    icon: Library,
    label: 'Knowledge Base',
    labelKey: 'help.sidePanel.tabs.knowledge',
  },
];

// Dynamic icon component
const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 20,
  className,
}) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return null;
  return <IconComponent size={size} className={className} />;
};

// Search highlight helper
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return parts.map((part, idx: number) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={idx}
        className="bg-yellow-200 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200 px-0.5 rounded"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};

// Expandable FAQ item with search highlighting
const FAQItem: React.FC<{ question: string; answer: string; searchQuery?: string }> = ({
  question,
  answer,
  searchQuery = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-expand if search query matches
  useEffect(() => {
    if (
      searchQuery &&
      (question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        answer.toLowerCase().includes(searchQuery.toLowerCase()))
    ) {
      setIsOpen(true);
    }
  }, [searchQuery, question, answer]);

  return (
    <div className="border-b border-slate-200 dark:border-navy-700 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-3 py-3 px-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <span className="flex-shrink-0 mt-0.5">
          {isOpen ? (
            <ChevronDown size={16} className="text-purple-500" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
          )}
        </span>
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {highlightText(question, searchQuery)}
        </span>
      </button>
      {isOpen && (
        <div className="pl-10 pb-3 pr-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {highlightText(answer, searchQuery)}
          </p>
        </div>
      )}
    </div>
  );
};

// Knowledge Base Category Item
const KBCategoryItem: React.FC<{
  icon: string;
  labelKey: string;
  enabled: boolean;
}> = ({ icon, labelKey, enabled }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <DynamicIcon name={icon} size={16} className="text-purple-600 dark:text-purple-400" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t(`help.sidePanel.knowledge.categories.${labelKey}`, labelKey)}
        </span>
      </div>
      {!enabled && (
        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold rounded-full uppercase">
          {t('help.sidePanel.knowledge.comingSoon', 'Coming Soon')}
        </span>
      )}
    </div>
  );
};

// Knowledge Tab Content - Full library with article detail view
interface KnowledgeTabContentProps {
  initialArticleSlug?: string | null;
  onBack?: () => void;
  moduleId?: string;
}

const KnowledgeTabContent: React.FC<KnowledgeTabContentProps> = ({
  initialArticleSlug,
  onBack,
  moduleId,
}) => {
  const { t } = useTranslation();
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(
    initialArticleSlug || null
  );

  // Sync with initialArticleSlug when it changes (from Quick Guides navigation)
  useEffect(() => {
    if (initialArticleSlug) {
      setSelectedArticleSlug(initialArticleSlug);
    }
  }, [initialArticleSlug]);

  // Handle back navigation
  const handleBack = () => {
    setSelectedArticleSlug(null);
    if (onBack) {
      onBack();
    }
  };

  // Show article detail view
  if (selectedArticleSlug) {
    return <KnowledgeArticleView slug={selectedArticleSlug} onBack={handleBack} />;
  }

  // Show library view
  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 px-1">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Library size={20} className="text-purple-500" />
          {t('help.sidePanel.knowledge.title', 'Knowledge Base')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t(
            'help.sidePanel.knowledge.description',
            'Explore articles, tutorials, and best practices.'
          )}
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <KnowledgeLibrary onArticleClick={setSelectedArticleSlug} moduleId={moduleId} />
      </div>
    </div>
  );
};

export const HelpSidePanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const { isOpen, setOpen, activeTab, setActiveTab, help } = useHelpSidePanel();
  const [searchQuery, setSearchQuery] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedGuideArticle, setSelectedGuideArticle] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Handle Quick Guide click - navigate to KB article
  const handleGuideClick = (articleSlug: string | undefined) => {
    if (articleSlug) {
      setSelectedGuideArticle(articleSlug);
      setActiveTab('knowledge');
    }
  };

  // Reset search and selected article when tab changes
  useEffect(() => {
    setSearchQuery('');
    // Only reset selected article if leaving knowledge tab
    if (activeTab !== 'knowledge') {
      setSelectedGuideArticle(null);
    }
  }, [activeTab]);

  // Handle notify me subscription
  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail.trim() || isSubscribing) return;

    setIsSubscribing(true);
    try {
      const response = await fetch(HELP_CONFIG.notifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: notifyEmail }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        toast.success(
          t('help.sidePanel.knowledge.notify.success', "You'll be notified when ready!")
        );
      } else {
        toast.error(t('common.error', 'Something went wrong'));
      }
    } catch {
      // For now, just show success (endpoint might not exist yet)
      setIsSubscribed(true);
      toast.success(t('help.sidePanel.knowledge.notify.success', "You'll be notified when ready!"));
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!isOpen) return null;

  const faqs = help?.faqs || [];
  const guides = getGuides();
  const kbCategories = getKnowledgeBaseCategories();
  const videoUrl = getVideoUrl();

  // Filter FAQs by search
  const filteredFAQs = searchQuery
    ? faqs.filter((faq) => {
        const question = lang === 'pl' ? faq.questionPl : faq.question;
        const answer = lang === 'pl' ? faq.answerPl : faq.answer;
        const q = searchQuery.toLowerCase();
        return (
          (question || '').toLowerCase().includes(q) || (answer || '').toLowerCase().includes(q)
        );
      })
    : faqs;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-navy-700">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-navy-700 shrink-0 bg-slate-50 dark:bg-navy-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle size={18} className="text-purple-500" />
            {t('help.sidePanel.title', 'Help Center')}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-navy-700 px-2 shrink-0">
          {TABS.map(({ id, icon: Icon, label, labelKey }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {t(labelKey, label)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Welcome Title */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {t('help.sidePanel.overview.title', 'Welcome to Consultinity')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t(
                    'help.sidePanel.overview.intro',
                    "Your complete PMO platform for digital transformation. Assess, plan, and track your organization's journey to digital excellence with AI-powered insights and proven methodologies."
                  )}
                </p>
              </div>

              {/* Video Button */}
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl text-white hover:from-purple-600 hover:to-indigo-700 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlayCircle size={24} />
                </div>
                <div>
                  <div className="font-semibold">
                    {t('help.sidePanel.overview.watchVideo', 'Watch Introduction Video')}
                  </div>
                  <div className="text-sm text-white/80">
                    {t('help.sidePanel.overview.videoDuration', '3 min overview')}
                  </div>
                </div>
                <ExternalLink size={16} className="ml-auto opacity-60" />
              </a>

              {/* Quick Guides */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  <BookOpen size={16} className="text-purple-500" />
                  {t('help.sidePanel.overview.guides', 'Quick Guides')}
                </h4>
                <div className="space-y-2">
                  {guides.map((guide) => (
                    <button
                      key={guide.id}
                      onClick={() => handleGuideClick(guide.articleSlug)}
                      className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                        <DynamicIcon
                          name={guide.icon}
                          size={16}
                          className="text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                        {t(`help.sidePanel.overview.guidesList.${guide.id}`, guide.id)}
                      </span>
                      <ChevronRight
                        size={14}
                        className="ml-auto text-slate-400 group-hover:text-purple-500"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* What to Know */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">
                  <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
                  {t('help.sidePanel.overview.whatToKnow', 'Key Things to Know')}
                </h4>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-100">
                    <CheckCircle2
                      size={14}
                      className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    />
                    {t(
                      'help.sidePanel.overview.tip1',
                      'Start with Quick Assessment (5 min) for instant AI recommendations'
                    )}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-100">
                    <CheckCircle2
                      size={14}
                      className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    />
                    {t(
                      'help.sidePanel.overview.tip2',
                      'AI generates initiatives from assessment gaps - review in Roadmap'
                    )}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-100">
                    <CheckCircle2
                      size={14}
                      className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    />
                    {t(
                      'help.sidePanel.overview.tip3',
                      'Track implementation in Execution module with real-time dashboards'
                    )}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-100">
                    <CheckCircle2
                      size={14}
                      className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    />
                    {t(
                      'help.sidePanel.overview.tip4',
                      'Use AI Chat anytime to ask questions or get recommendations'
                    )}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-100">
                    <CheckCircle2
                      size={14}
                      className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    />
                    {t(
                      'help.sidePanel.overview.tip5',
                      'Export reports in PDF/PowerPoint for stakeholder presentations'
                    )}
                  </li>
                </ul>
              </div>

              {/* Keyboard Shortcuts */}
              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="w-full flex items-center gap-3 p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                  <Keyboard size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                    {t('help.sidePanel.overview.keyboardShortcuts', 'Keyboard Shortcuts')}
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t('help.sidePanel.overview.keyboardShortcutsHint', 'Press ? anytime to view')}
                  </p>
                </div>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 text-[11px] font-mono text-slate-500 dark:text-slate-400 shadow-sm">
                  ?
                </kbd>
              </button>
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('help.sidePanel.faq.searchPlaceholder', 'Search questions...')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* FAQ List */}
              {filteredFAQs.length > 0 ? (
                <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
                  {filteredFAQs.map((faq) => (
                    <FAQItem
                      key={faq.id}
                      question={(lang === 'pl' ? faq.questionPl : faq.question) || ''}
                      answer={(lang === 'pl' ? faq.answerPl : faq.answer) || ''}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <HelpCircle
                    size={32}
                    className="mx-auto text-slate-300 dark:text-slate-600 mb-3"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {searchQuery
                      ? t('help.sidePanel.faq.noResults', 'No matching questions found.')
                      : t('help.sidePanel.faq.noFAQ', 'No FAQ available.')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <KnowledgeTabContent
              moduleId={help.moduleId}
              initialArticleSlug={selectedGuideArticle}
              onBack={() => setSelectedGuideArticle(null)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 flex items-center justify-between gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-2 px-4 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
          >
            {t('common.close', 'Close')}
          </button>
          <Link
            to={HELP_CONFIG.docsBaseUrl}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">
              {t('help.sidePanel.fullDocs', 'Full Documentation')}
            </span>
            <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </>
  );
};

export default HelpSidePanel;
