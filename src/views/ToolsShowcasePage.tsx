/**
 * Tools Showcase Page
 *
 * Public page showcasing 4 thematic education blocks with featured tools.
 * Each tool has a video teaser preview and CTA to start trial.
 *
 * Route: /tools
 */

import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Play,
  Settings,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ToolsV8CanonPanel } from '@/components/Discovery/ToolsV8CanonPanel';
import { ToolVideoModal } from '@/components/Education/ToolVideoModal';
import { AnnaAssistantWidget } from '@/components/Landing/AnnaAssistantWidget';
import { DemoModeModal } from '@/components/Landing/DemoModeModal';
import { EntryFooter } from '@/components/Landing/EntryFooter';
import { EntryTopBar } from '@/components/Landing/EntryTopBar';
import {
  EDUCATION_BLOCKS,
  EducationBlock,
  EducationTool,
  getFeaturedToolsByBlock,
} from '@/data/toolEducationData.ts';
import { ROUTES } from '@/routes/routeConfig';
import { useAppStore } from '@/store/useAppStore';
import { AppView, SessionMode } from '@/types';

// ============================================
// DYNAMIC ICON
// ============================================

const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 24,
  className,
}) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return <BookOpen size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};

// ============================================
// BLOCK ICONS
// ============================================

const BLOCK_ICONS: Record<string, React.ElementType> = {
  Target,
  Settings,
  Zap,
  Users,
};

// ============================================
// TOOL CARD
// ============================================

interface ToolCardProps {
  tool: EducationTool;
  blockColor: string;
  onWatchVideo: (tool: EducationTool) => void;
  onTryTool: () => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, blockColor, onWatchVideo, onTryTool }) => {
  const { t } = useTranslation();
  const colorClasses: Record<string, { bg: string; text: string; border: string; hover: string }> =
    {
      emerald: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        hover: 'hover:border-emerald-400',
      },
      blue: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
        hover: 'hover:border-blue-400',
      },
      violet: {
        bg: 'bg-primary-100 dark:bg-primary-900/30',
        text: 'text-primary-600 dark:text-primary-400',
        border: 'border-primary-200 dark:border-primary-800',
        hover: 'hover:border-primary-400',
      },
      amber: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        hover: 'hover:border-amber-400',
      },
    };

  const colors = colorClasses[blockColor] || colorClasses.violet;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`relative bg-white dark:bg-navy-900 rounded-xl border-2 ${colors.border} ${colors.hover} overflow-hidden shadow-lg hover:shadow-xl transition-all group`}
    >
      {/* Video Preview Area */}
      <div
        onClick={() => onWatchVideo(tool)}
        className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900 cursor-pointer overflow-hidden"
      >
        {tool.thumbnailUrl ? (
          <img
            src={tool.thumbnailUrl}
            alt={t(`showcase.tools.items.${tool.id}.name`)}
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <DynamicIcon name={tool.icon} size={48} className="text-white/30" />
          </div>
        )}

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play size={24} className="text-primary-600 ml-1" />
          </div>
        </div>

        {/* Framework Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded-full">
            {t(`showcase.tools.items.${tool.id}.framework` as any) ||
              t('showcase.common.framework')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}
          >
            <DynamicIcon name={tool.icon} size={20} className={colors.text} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {t(`showcase.tools.items.${tool.id}.name`)}
            </h3>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
          {t(`showcase.tools.items.${tool.id}.description`)}
        </p>

        {/* Outputs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[0, 1, 2].map((idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text}`}
            >
              {t(`showcase.tools.items.${tool.id}.outputs.${idx}` as any)}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onWatchVideo(tool)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            <Play size={14} />
            {t('showcase.common.watchVideo')}
          </button>
          <button
            onClick={onTryTool}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-primary-600 to-crimson-600 text-white text-sm font-semibold rounded-lg hover:from-primary-700 hover:to-crimson-700 transition-all"
          >
            {t('showcase.common.tryFree')}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// EDUCATION BLOCK SECTION
// ============================================

interface BlockSectionProps {
  block: EducationBlock;
  tools: EducationTool[];
  onWatchVideo: (tool: EducationTool) => void;
  onTryTool: () => void;
}

const BlockSection: React.FC<BlockSectionProps> = ({ block, tools, onWatchVideo, onTryTool }) => {
  const { t } = useTranslation();
  const BlockIcon = BLOCK_ICONS[block.icon] || Target;

  return (
    <section className="mb-16">
      {/* Block Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${block.gradientFrom} ${block.gradientTo}`}
        >
          <BlockIcon size={28} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t(`showcase.tools.blocks.${block.id}.name`)}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {t(`showcase.tools.blocks.${block.id}.description`)}
          </p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            blockColor={block.color}
            onWatchVideo={onWatchVideo}
            onTryTool={onTryTool}
          />
        ))}
      </div>
    </section>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ToolsShowcasePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } =
    useAppStore();
  const [selectedTool, setSelectedTool] = useState<EducationTool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModalMode, setDemoModalMode] = useState<'demo' | 'trial'>('trial');

  const handleWatchVideo = (tool: EducationTool) => {
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const handleTryTool = () => {
    setIsModalOpen(false);
    navigate('/trial');
  };

  const handleModalSuccess = (user: any, mode: 'demo' | 'trial') => {
    setCurrentUser({ ...user, hasWorkspace: true, isAuthenticated: true } as any);
    setIsDemoModalOpen(false);
    setSessionMode(mode === 'demo' ? SessionMode.DEMO : SessionMode.FULL);
    if (mode === 'demo') setDemoMode(true);
    else setDemoMode(false);
    setCurrentView(AppView.DASHBOARD);
    navigate(ROUTES.AI_CHAT);
  };

  const handleDemoClick = () => {
    setDemoModalMode('demo');
    setIsDemoModalOpen(true);
  };

  const handleTrialClick = () => {
    setDemoModalMode('trial');
    setIsDemoModalOpen(true);
  };

  const handleLoginClick = () => {
    navigate(ROUTES.LOGIN);
  };

  const handleRegisterClick = () => {
    navigate(ROUTES.REGISTER);
  };

  const handleContactClick = () => {
    navigate(ROUTES.LEGAL.CONTACT);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={handleLoginClick}
        onRegisterClick={handleRegisterClick}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
      />

      {/* Advanced Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-600/5 dark:bg-primary-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[35%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[30%] bg-emerald-600/5 dark:bg-emerald-600/15 rounded-full blur-[80px]" />

        {/* Subtle Grid / Texture for Light Mode */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-0 bg-[url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')]" />

        {/* Subtle Radial Gradient Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(255,255,255,0.4)_100%)] dark:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]" />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 dark:bg-navy-950 text-white pt-36 border-b border-slate-800 dark:border-navy-900">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl opacity-50" />
        </div>

        {/* Hero Content */}
        <div className="relative max-w-5xl mx-auto px-4 py-16 lg:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm font-medium mb-6">
              <Sparkles size={16} className="text-primary-400" />
              {t('showcase.tools.hero.badge')}
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-6">
              {t('showcase.tools.hero.title1')}
              <br />
              <span className="bg-gradient-to-r from-primary-400 to-crimson-400 bg-clip-text text-transparent">
                {t('showcase.tools.hero.title2')}
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-white/70 max-w-3xl mx-auto mb-8">
              {t('showcase.tools.hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/trial')}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-crimson-600 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-crimson-700 transition-all shadow-lg text-lg"
              >
                {t('showcase.common.startTrial')}
                <ArrowRight size={20} />
              </button>
              <a
                href="#tools"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-c-border"
              >
                {t('showcase.common.learnOurMethods')}
                <ChevronRight size={20} />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="relative max-w-7xl mx-auto px-4 -mt-8 z-10">
        <ToolsV8CanonPanel mode="catalog" />
      </div>

      {/* Tools Sections */}
      <div id="tools" className="max-w-7xl mx-auto px-4 py-16">
        {EDUCATION_BLOCKS.map((block) => {
          const featuredTools = getFeaturedToolsByBlock(block.id);
          return (
            <BlockSection
              key={block.id}
              block={block}
              tools={featuredTools}
              onWatchVideo={handleWatchVideo}
              onTryTool={handleTryTool}
            />
          );
        })}
      </div>

      {/* Availability Message */}
      <div className="max-w-7xl mx-auto px-4 pb-16 text-center">
        <div className="inline-block p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 shadow-sm max-w-2xl">
          <p className="text-slate-600 dark:text-slate-400 font-medium italic">
            💡 {t('showcase.common.integratedHint')}
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-r from-primary-600 to-crimson-600 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {t('showcase.common.readyToTry')}
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            {t('showcase.tools.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/trial')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-700 font-semibold rounded-xl hover:bg-slate-100 transition-all shadow-lg text-lg"
            >
              {t('showcase.common.startTrial')}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      <EntryFooter />
      <AnnaAssistantWidget
        onDemoClick={handleDemoClick}
        onTrialClick={handleTrialClick}
        onContactClick={handleContactClick}
      />

      {/* Video Modal */}
      <ToolVideoModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTryTool={handleTryTool}
      />
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode={demoModalMode}
      />
    </div>
  );
};

export default ToolsShowcasePage;
