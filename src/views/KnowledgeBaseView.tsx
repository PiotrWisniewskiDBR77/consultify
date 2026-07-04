/**
 * Knowledge Base View
 *
 * Full-page documentation portal with navigation, search, and content rendering.
 * Route: /docs or /help
 */

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Book,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Home,
  Printer,
  Search,
  Video,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import DocumentationRenderer from '../components/Help/DocumentationRenderer';
import DynamicIcon from '../components/shared/DynamicIcon';
import { CARD_DOCS } from '../config/cardDocumentation';
import { FAQ_CONTENT, searchFAQs } from '../config/faqContent';
import { HelpModuleId, MODULE_HELP_CONTENT } from '../config/moduleHelpContent';
import { VIDEO_TUTORIALS } from '../config/videoTutorialsContent';

interface KnowledgeBaseViewProps {
  initialModule?: HelpModuleId;
  initialSection?: string;
  onBack?: () => void;
}

type ContentType = 'overview' | 'card' | 'faq' | 'video';

interface NavigationItem {
  id: string;
  type: ContentType;
  title: string;
  icon?: string;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  initialModule,
  initialSection,
  onBack,
}) => {
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  // State
  const [selectedModule, setSelectedModule] = useState<HelpModuleId | null>(initialModule || null);
  const [selectedContent, setSelectedContent] = useState<{ type: ContentType; id: string } | null>(
    initialSection ? { type: 'overview', id: initialSection } : null
  );
  const [expandedModules, setExpandedModules] = useState<Set<HelpModuleId>>(
    initialModule ? new Set([initialModule]) : new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Get content for selected module
  const moduleContent = useMemo(() => {
    if (!selectedModule) return null;

    const module = MODULE_HELP_CONTENT[selectedModule];
    if (!module) return null;

    // Get related cards
    const cards = Object.entries(CARD_DOCS)
      .filter(([_, card]: [string, any]) => card.moduleId === selectedModule)
      .map(([id, card]: [string, any]) => ({
        id,
        type: 'card' as ContentType,
        title: card.title,
        icon: 'FileText',
      }));

    // Get related FAQs
    const faqs = FAQ_CONTENT.filter((faq: any) => faq.moduleId === selectedModule).map(
      (faq: any) => ({
        id: faq.id,
        type: 'faq' as ContentType,
        title: lang === 'pl' ? faq.questionPl : faq.question,
        icon: 'HelpCircle',
      })
    );

    // Get related videos
    const videos = VIDEO_TUTORIALS.filter((video) => video.moduleId === selectedModule).map(
      (video) => ({
        id: video.id,
        type: 'video' as ContentType,
        title: lang === 'pl' ? video.titlePl : video.title,
        icon: 'Video',
      })
    );

    return {
      module,
      cards,
      faqs,
      videos,
    };
  }, [selectedModule, lang]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return null;

    const results: Array<{
      type: string;
      id: string;
      title: string;
      moduleId: HelpModuleId;
      excerpt: string;
    }> = [];

    const searchLower = searchQuery.toLowerCase();

    // Search modules
    Object.entries(MODULE_HELP_CONTENT).forEach(([id, module]) => {
      const name = t(`${module.translationKey}.name`);
      const desc = t(`${module.translationKey}.description`);

      if (
        name.toLowerCase().includes(searchLower) ||
        desc.toLowerCase().includes(searchLower) ||
        id.toLowerCase().includes(searchLower)
      ) {
        results.push({
          type: 'module',
          id,
          title: name,
          moduleId: id as HelpModuleId,
          excerpt: desc.slice(0, 100) + '...',
        });
      }
    });

    // Search cards
    Object.entries(CARD_DOCS).forEach(([id, card]: [string, any]) => {
      if (
        card.title.toLowerCase().includes(searchLower) ||
        card.description.toLowerCase().includes(searchLower)
      ) {
        results.push({
          type: 'card',
          id,
          title: card.title,
          moduleId: card.moduleId || 'dashboard',
          excerpt: card.description.slice(0, 100) + '...',
        });
      }
    });

    // Search FAQs
    const matchingFaqs = searchFAQs(searchQuery, lang);
    matchingFaqs.slice(0, 10).forEach((faq: any) => {
      results.push({
        type: 'faq',
        id: faq.id,
        title: lang === 'pl' ? faq.questionPl : faq.question,
        moduleId: faq.moduleId,
        excerpt: (lang === 'pl' ? faq.answerPl : faq.answer).slice(0, 100) + '...',
      });
    });

    return results;
  }, [searchQuery, lang, t]);

  // Toggle module expansion
  const toggleModule = (moduleId: HelpModuleId) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  // Select content
  const selectContent = (moduleId: HelpModuleId, type: ContentType, id: string) => {
    setSelectedModule(moduleId);
    setSelectedContent({ type, id });
    if (!expandedModules.has(moduleId)) {
      setExpandedModules(new Set([...expandedModules, moduleId]));
    }
  };

  // Text
  const text = {
    title: { en: 'Knowledge Base', pl: 'Baza Wiedzy' },
    search: { en: 'Search documentation...', pl: 'Szukaj w dokumentacji...' },
    overview: { en: 'Overview', pl: 'Przegląd' },
    documentation: { en: 'Documentation', pl: 'Dokumentacja' },
    faqs: { en: 'FAQs', pl: 'FAQ' },
    videos: { en: 'Videos', pl: 'Wideo' },
    noResults: { en: 'No results found', pl: 'Nie znaleziono wyników' },
    selectTopic: { en: 'Select a topic from the sidebar', pl: 'Wybierz temat z paska bocznego' },
    print: { en: 'Print', pl: 'Drukuj' },
    download: { en: 'Download PDF', pl: 'Pobierz PDF' },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left */}
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div className="flex items-center gap-2">
                <Book size={24} className="text-primary-600" />
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {text.title[lang]}
                </h1>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-xl mx-8">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={text.search[lang]}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-transparent focus:border-c-focus-solid rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                title={text.print[lang]}
              >
                <Printer size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-72 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {/* Home */}
              <button
                onClick={() => {
                  setSelectedModule(null);
                  setSelectedContent(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  !selectedModule
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Home size={18} />
                <span className="font-medium">{text.overview[lang]}</span>
              </button>

              {/* Modules */}
              {Object.entries(MODULE_HELP_CONTENT).map(([id, module]) => {
                const isExpanded = expandedModules.has(id as HelpModuleId);
                const isSelected = selectedModule === id;

                return (
                  <div key={id}>
                    <button
                      onClick={() => {
                        setSelectedModule(id as HelpModuleId);
                        setSelectedContent({ type: 'overview', id: id });
                        toggleModule(id as HelpModuleId);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <DynamicIcon name={module.icon || 'HelpCircle'} size={18} />
                      <span className="font-medium truncate">
                        {typeof module.name === 'object'
                          ? lang === 'pl'
                            ? module.name?.pl
                            : module.name?.en
                          : module.name}
                      </span>
                    </button>

                    {/* Submenu */}
                    {isExpanded && moduleContent && selectedModule === id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-6 mt-1 space-y-1"
                      >
                        {moduleContent.cards.map((card) => (
                          <button
                            key={card.id}
                            onClick={() => selectContent(id as HelpModuleId, 'card', card.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${
                              selectedContent?.type === 'card' && selectedContent?.id === card.id
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <FileText size={14} />
                            <span className="truncate">{card.title}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Search Results */}
            {searchResults && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {lang === 'pl' ? 'Wyniki wyszukiwania' : 'Search Results'} ({searchResults.length}
                  )
                </h2>
                {searchResults.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400">{text.noResults[lang]}</p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((result, i: number) => (
                      <button
                        key={`${result.type}-${result.id}-${i}`}
                        onClick={() =>
                          selectContent(result.moduleId, result.type as ContentType, result.id)
                        }
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          {result.type === 'module' && (
                            <Book size={16} className="text-primary-600" />
                          )}
                          {result.type === 'card' && (
                            <FileText size={16} className="text-primary-600" />
                          )}
                          {result.type === 'faq' && (
                            <HelpCircle size={16} className="text-primary-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white truncate">
                            {result.title}
                          </h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                            {result.excerpt}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            {!searchResults && (
              <>
                {!selectedContent ? (
                  // Welcome / Overview
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-sm text-center">
                    <Book size={48} className="mx-auto text-primary-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      {text.title[lang]}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">{text.selectTopic[lang]}</p>

                    {/* Module Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
                      {Object.entries(MODULE_HELP_CONTENT)
                        .slice(0, 9)
                        .map(([id, module]) => (
                          <button
                            key={id}
                            onClick={() => selectContent(id as HelpModuleId, 'overview', id)}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                              <DynamicIcon
                                name={module.icon || 'HelpCircle'}
                                size={24}
                                className="text-primary-600 dark:text-primary-400"
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {typeof module.name === 'object'
                                ? lang === 'pl'
                                  ? module.name?.pl
                                  : module.name?.en
                                : module.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <DocumentationRenderer
                    moduleId={selectedModule!}
                    contentType={selectedContent.type}
                    contentId={selectedContent.id}
                    language={lang}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseView;
