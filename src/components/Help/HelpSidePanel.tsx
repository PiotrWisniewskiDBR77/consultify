import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  HelpCircle,
  Keyboard,
  Library,
  PlayCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { getHelpConfig } from '../../config/helpContent';
import {
  getLocalizedText,
  getOverviewCards,
  getOverviewGuides,
  HELP_SYSTEM_OVERVIEW,
} from '../../config/helpExperience';
import { HelpTab, useHelpSidePanel } from '../../contexts/HelpContext';
import { useDeviceType } from '../../hooks/useDeviceType';
import { getRouteFromAppView, ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { AppView } from '../../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../../types/workspace';
import { KeyboardShortcutsHelp } from '../MyWork/shared/KeyboardShortcutsHelp';
import TeresaMark from '../shared/TeresaMark';
import { FeatureUpdatesPanel } from './FeatureUpdatesPanel';
import { KnowledgeArticleView } from './KnowledgeArticleView';
import { KnowledgeLibrary } from './KnowledgeLibrary';
const HELP_CONFIG = getHelpConfig();

const TABS: { id: Exclude<HelpTab, 'onboarding'>; icon: typeof BookOpen; label: string }[] = [
  { id: 'overview', icon: BookOpen, label: 'Overview' },
  { id: 'this_step', icon: Sparkles, label: 'This Step' },
  { id: 'guides', icon: CircleHelp, label: 'Quick Guides' },
  { id: 'faq', icon: HelpCircle, label: 'FAQ' },
  { id: 'knowledge', icon: Library, label: 'Knowledge Base' },
  { id: 'updates', icon: Bell, label: 'Updates' },
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
            <ChevronDown size={16} className="text-primary-500" />
          ) : (
            <ChevronRight size={16} className="text-slate-500 dark:text-slate-400" />
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
    return (
      <KnowledgeArticleView
        slug={selectedArticleSlug}
        onBack={handleBack}
        onArticleClick={setSelectedArticleSlug}
        moduleId={moduleId}
      />
    );
  }

  // Show library view
  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 px-1">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Library size={20} className="text-primary-500" />
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

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
      {title}
    </h4>
    {children}
  </section>
);

const GuideCard: React.FC<{
  icon?: string;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ icon = 'ChevronRight', title, description, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors"
  >
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
        <DynamicIcon name={icon} size={16} className="text-primary-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {description}
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-600 mt-1" />
    </div>
  </button>
);

type RenderGuide = {
  id: string;
  title: string;
  description: string;
  articleSlug?: string;
  targetModuleId?: string;
};

export const HelpSidePanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const HELP_LANGS = ['en', 'pl', 'de', 'ar', 'ja', 'es'] as const;
  const baseLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const lang = (HELP_LANGS as readonly string[]).includes(baseLang)
    ? (baseLang as (typeof HELP_LANGS)[number])
    : 'en';
  const navigate = useNavigate();
  const { isDesktop, isMobile, isTablet } = useDeviceType();

  const {
    isOpen,
    setOpen,
    activeTab,
    setActiveTab,
    help,
    knowledgeModuleIdOverride,
    knowledgeArticleSlugOverride,
    setKnowledgeArticleSlugOverride,
    setHelpDocumentIdOverride,
  } = useHelpSidePanel();
  const currentView = useAppStore((s) => s.currentView);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const setCurrentViewState = useAppStore((s) => s.setCurrentViewState);
  const navigateFn = useAppStore((s) => s.navigateFn);
  const setChatKickoffMessage = useAppStore((s) => s.setChatKickoffMessage);
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuideArticle, setSelectedGuideArticle] = useState<string | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  const currentDocument = help.document;
  const nextDocument = help.nextDocument;
  const currentStageLabel = currentDocument.stageId
    ? getLocalizedText(currentDocument.shortLabel, lang)
    : null;
  const overviewCards = getOverviewCards(lang);
  const overviewGuides = getOverviewGuides(lang);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'onboarding') return;
    setActiveTab('this_step');
  }, [activeTab, isOpen, setActiveTab]);

  useEffect(() => {
    setSearchQuery('');
    if (activeTab !== 'knowledge') {
      setSelectedGuideArticle(null);
    }
  }, [activeTab]);

  const handleGuideClick = (guide: RenderGuide) => {
    if (guide.articleSlug) {
      setSelectedGuideArticle(guide.articleSlug);
      setActiveTab('knowledge');
      return;
    }

    if (guide.targetModuleId) {
      setActiveTab('knowledge');
    }
  };

  const openAiNow = async () => {
    const prompt = getLocalizedText(help.promptAction.prompt, lang);
    const defaultWorkspaceType = getDefaultWorkspaceType(currentView);
    const workspaceType = defaultWorkspaceType === 'empty' ? 'general' : defaultWorkspaceType;

    setWorkspaceContext(
      createWorkspaceContext(currentView, workspaceType, {
        projectId: currentProjectId || undefined,
        entityName: getLocalizedText(currentDocument.title, lang),
        entityData: {
          helpDocumentId: currentDocument.id,
          helpStage: currentDocument.stageId,
          helpSupportModule: currentDocument.supportModuleId,
          helpModuleId: help.moduleId,
        },
      })
    );
    setChatKickoffMessage(prompt);
    setOpen(false);

    if (!isDesktop || isMobile || isTablet) {
      setCurrentViewState(AppView.AI_CHAT);
      const route = getRouteFromAppView(AppView.AI_CHAT);
      if (navigateFn) {
        navigateFn(route);
      } else {
        navigate(route);
      }
      return;
    }

    if (isChatCollapsed) {
      toggleChatCollapse();
    }
  };

  const openIntroScreen = () => {
    setOpen(false);
    navigate(ROUTES.APP_INTRO);
  };

  if (!isOpen) return null;

  const faqs = help?.faqs || [];
  const guideGroups = [
    {
      title: t('help.sidePanel.guides.global', 'Start here'),
      guides: overviewGuides,
    },
    {
      title: t('help.sidePanel.guides.current', 'For this step'),
      guides: currentDocument.quickGuides.map((guide) => ({
        ...guide,
        title: getLocalizedText(guide.title, lang),
        description: getLocalizedText(guide.description, lang),
      })),
    },
  ];

  const filteredFAQs = searchQuery
    ? faqs.filter((faq) => {
        const question = lang === 'pl' && faq.questionPl ? faq.questionPl : faq.question;
        const answer = lang === 'pl' && faq.answerPl ? faq.answerPl : faq.answer;
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
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-dropdown transition-opacity"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-slate-50 dark:bg-navy-950 shadow-2xl z-overlay flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-navy-700">
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-navy-700 shrink-0 bg-white dark:bg-navy-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle size={18} className="text-primary-500" />
            {t('help.sidePanel.title', 'Help Center')}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-danger-500 dark:text-slate-400 dark:hover:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shrink-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {currentStageLabel || t('help.sidePanel.context.default', 'Current context')}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {getLocalizedText(currentDocument.title, lang)}
          </div>
          <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {getLocalizedText(currentDocument.summary, lang)}
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-navy-700 px-2 shrink-0">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {t(`help.sidePanel.tabs.${id}`, label)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <SectionCard title={t('help.sidePanel.overview.startHere', 'Start here')}>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t(
                    'help.sidePanel.overview.intro',
                    'Start with the system map or jump straight into the work that matters on this screen.'
                  )}
                </p>
                <div className="mt-3 grid gap-2">
                  <button
                    onClick={openIntroScreen}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t('help.sidePanel.overview.openIntro', 'Open app intro')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t(
                          'help.sidePanel.overview.openIntroDesc',
                          'A short map of Consultify work: 5 steps and supporting modules.'
                        )}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-primary-500" />
                  </button>
                  <button
                    onClick={() => setActiveTab('this_step')}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t('help.sidePanel.overview.showThisScreen', 'Show this screen')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t(
                          'help.sidePanel.overview.showThisScreenDesc',
                          'The shortest version: why this screen exists and what to do next.'
                        )}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-primary-500" />
                  </button>
                </div>
              </SectionCard>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {getLocalizedText(HELP_SYSTEM_OVERVIEW.title, lang)}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {getLocalizedText(HELP_SYSTEM_OVERVIEW.summary, lang)}
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-500 to-crimson-600 rounded-xl text-white">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlayCircle size={24} />
                </div>
                <div>
                  <div className="font-semibold">
                    {getLocalizedText(HELP_SYSTEM_OVERVIEW.video.label, lang)}
                  </div>
                  <div className="text-sm text-white/80">
                    {getLocalizedText(HELP_SYSTEM_OVERVIEW.video.durationLabel, lang)}
                  </div>
                </div>
              </div>

              <SectionCard title={t('help.sidePanel.overview.journey', 'Main journey')}>
                <div className="space-y-3">
                  {overviewCards.journey.map((card) => (
                    <div key={card.id} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <DynamicIcon name={card.icon} size={16} className="text-primary-500" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {card.title}
                        </div>
                        <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {card.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title={t('help.sidePanel.overview.support', 'Supporting modules')}>
                <div className="space-y-3">
                  {overviewCards.support.map((card) => (
                    <div key={card.id} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
                        <DynamicIcon name={card.icon} size={16} className="text-primary-500" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {card.title}
                        </div>
                        <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {card.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title={t('help.sidePanel.overview.ai', 'AI is always available')}>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {getLocalizedText(HELP_SYSTEM_OVERVIEW.intro, lang)}
                </p>
                <button
                  onClick={openAiNow}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-semibold transition-colors"
                >
                  <TeresaMark size={16} />
                  {getLocalizedText(help.promptAction.label, lang)}
                </button>
              </SectionCard>

              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="w-full flex items-center gap-3 p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                  <Keyboard
                    size={18}
                    className="text-slate-500 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                    {t('help.sidePanel.overview.keyboardShortcuts', 'Keyboard Shortcuts')}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-500">
                    {t('help.sidePanel.overview.keyboardShortcutsHint', 'Press ? anytime to view')}
                  </p>
                </div>
                <kbd className="px-2 py-1 rounded bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-navy-600 text-[11px] font-mono text-slate-500 dark:text-slate-400 shadow-sm">
                  ?
                </kbd>
              </button>
            </div>
          )}

          {(activeTab === 'this_step' || activeTab === 'onboarding') && (
            <div className="space-y-4">
              <SectionCard title={t('help.sidePanel.thisStep.whatThisIs', 'What this is')}>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {getLocalizedText(currentDocument.whatThisIs, lang)}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {getLocalizedText(currentDocument.whyItMatters, lang)}
                </p>
              </SectionCard>

              <SectionCard title={t('help.sidePanel.thisStep.whatYouDo', 'What you do here')}>
                <div className="space-y-2">
                  {currentDocument.whatYouDoHere.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <CheckCircle2 size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />
                      <span>{getLocalizedText(item, lang)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title={t('help.sidePanel.thisStep.aiHelp', 'How AI helps here')}>
                <div className="space-y-2">
                  {currentDocument.howAiHelpsHere.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <Sparkles size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{getLocalizedText(item, lang)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title={t('help.sidePanel.thisStep.next', 'What comes next')}>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {getLocalizedText(currentDocument.whatComesNext, lang)}
                </p>
                {nextDocument && (
                  <button
                    onClick={() => {
                      setHelpDocumentIdOverride(nextDocument.id);
                      setActiveTab('this_step');
                    }}
                    className="mt-3 w-full flex items-center justify-between px-3 py-3 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 text-left transition-colors"
                  >
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t('help.sidePanel.thisStep.nextStep', 'Next step')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {getLocalizedText(nextDocument.title, lang)}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-primary-500" />
                  </button>
                )}
              </SectionCard>

              <button
                onClick={openAiNow}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-semibold transition-colors"
              >
                <TeresaMark size={16} />
                {getLocalizedText(help.promptAction.label, lang)}
              </button>
            </div>
          )}

          {activeTab === 'guides' && (
            <div className="space-y-4">
              {guideGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.guides.map((guide) => (
                      <GuideCard
                        key={guide.id}
                        icon="BookOpen"
                        title={guide.title}
                        description={guide.description}
                        onClick={() => handleGuideClick(guide)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'updates' && <FeatureUpdatesPanel onClose={() => setOpen(false)} />}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('help.sidePanel.faq.searchPlaceholder', 'Search questions...')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

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
                    className="mx-auto text-slate-600 dark:text-slate-400 mb-3"
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

          {activeTab === 'knowledge' && (
            <KnowledgeTabContent
              moduleId={
                knowledgeModuleIdOverride ||
                currentDocument.relatedKnowledgeModuleId ||
                help.moduleId
              }
              initialArticleSlug={selectedGuideArticle || knowledgeArticleSlugOverride}
              onBack={() => {
                setSelectedGuideArticle(null);
                setKnowledgeArticleSlugOverride(null);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 flex items-center justify-between gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-2 px-4 bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            {t('common.close', 'Close')}
          </button>
          <Link
            to={HELP_CONFIG.docsBaseUrl}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">
              {t('help.sidePanel.fullDocs', 'Full Documentation')}
            </span>
            <ExternalLink size={12} />
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
