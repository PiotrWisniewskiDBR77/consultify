/**
 * Audits Showcase Page
 *
 * Public page showcasing the 4 major industrial audit methodologies supported by Consultify.
 * DRD, SIRI, ADMA, and Lean 4.0.
 *
 * Route: /audits
 */

import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  Factory,
  Globe,
  Info,
  Map,
  Play,
  Sparkles,
  Zap,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AssessmentV8CanonPanel } from '@/components/assessment/AssessmentV8CanonPanel';
import { AnnaAssistantWidget } from '@/components/Landing/AnnaAssistantWidget';
import { DemoModeModal } from '@/components/Landing/DemoModeModal';
import { EntryFooter } from '@/components/Landing/EntryFooter';
import { EntryTopBar } from '@/components/Landing/EntryTopBar';
import { AUDIT_METHODOLOGIES, AuditMethodology } from '@/data/auditShowcaseData';
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
  if (!IconComponent) return <Info size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};

// ============================================
// AUDIT SECTION (Vertical List)
// ============================================

interface AuditSectionProps {
  audit: AuditMethodology;
  index: number;
  onStartAssessment: () => void;
}

const AuditSection: React.FC<AuditSectionProps> = ({ audit, index, onStartAssessment }) => {
  const { t } = useTranslation();
  const isEven = index % 2 === 0;

  const colorClasses: Record<string, { text: string; accent: string; muted: string }> = {
    blue: {
      text: 'text-blue-600 dark:text-blue-400',
      accent: 'bg-blue-600',
      muted: 'bg-blue-50 dark:bg-blue-900/10',
    },
    emerald: {
      text: 'text-emerald-600 dark:text-emerald-400',
      accent: 'bg-emerald-600',
      muted: 'bg-emerald-50 dark:bg-emerald-900/10',
    },
    violet: {
      text: 'text-primary-600 dark:text-primary-400',
      accent: 'bg-navy-900',
      muted: 'bg-primary-50 dark:bg-primary-900/10',
    },
    amber: {
      text: 'text-amber-600 dark:text-amber-400',
      accent: 'bg-amber-600',
      muted: 'bg-amber-50 dark:bg-amber-900/10',
    },
  };

  const colors = colorClasses[audit.color] || colorClasses.blue;

  return (
    <section
      className={`py-24 border-b border-slate-200 dark:border-navy-800 ${isEven ? 'bg-white dark:bg-navy-950' : 'bg-slate-50/50 dark:bg-navy-900/30'}`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div
          className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-16 lg:gap-24`}
        >
          {/* Video / Visual Side */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full lg:w-1/2 aspect-video relative group"
          >
            {/* Decorative Background Glow */}
            <div
              className={`absolute -inset-4 rounded-[2rem] blur-2xl opacity-20 pointer-events-none ${colors.accent}`}
            />

            <div className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-navy-700 shadow-2xl bg-slate-900">
              {/* Placeholder for Video - Real video would use <video> or iframe */}
              <img
                src={audit.image}
                alt={t(`showcase.audits.items.${audit.id}.fullName`)}
                className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
              />

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full border-2 border-c-border flex items-center justify-center cursor-pointer shadow-2xl transition-all hover:bg-white/30"
                >
                  <Play size={32} className="text-white fill-white ml-1" />
                </motion.div>
              </div>

              {/* Label Overlay */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-lg border border-c-border-subtle">
                <Globe size={14} className="text-white" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                  {t('showcase.common.methodologyIntro')}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Text / Content Side */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full lg:w-1/2"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-xl ${colors.muted}`}>
                <DynamicIcon name={audit.icon} size={24} className={colors.text} />
              </div>
              <span className={`text-sm font-black uppercase tracking-[0.2em] ${colors.text}`}>
                {t(`showcase.audits.items.${audit.id}.name` as any) || audit.id.toUpperCase()}{' '}
                {t('showcase.common.framework')}
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-black text-navy-950 dark:text-white mb-6 uppercase tracking-tight leading-tight">
              {t(`showcase.audits.items.${audit.id}.fullName`)}
            </h2>

            <p className="text-lg lg:text-xl text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              {t(`showcase.audits.items.${audit.id}.longDescription`)}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="flex items-center gap-3 group">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={14} className={colors.text} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t(`showcase.audits.items.${audit.id}.dimensions.${idx}` as any)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onStartAssessment}
                className={`inline-flex items-center justify-center gap-2 px-8 py-4 ${colors.accent} text-white font-black rounded-xl hover:opacity-90 transition-all shadow-lg text-sm uppercase tracking-wider`}
              >
                {t('showcase.common.execute')}
                <ArrowRight size={18} />
              </button>
              <a
                href={audit.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-all text-sm uppercase tracking-wider"
              >
                {t(`showcase.audits.items.${audit.id}.externalLinkLabel`)}
                <ExternalLink size={18} />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const AuditsShowcasePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } =
    useAppStore();
  const [isDemoModalOpen, setIsDemoModalOpen] = React.useState(false);
  const [demoModalMode, setDemoModalMode] = React.useState<'demo' | 'trial'>('trial');

  const handleModalSuccess = (user: any, mode: 'demo' | 'trial') => {
    setCurrentUser({ ...user, hasWorkspace: true, isAuthenticated: true } as any);
    setIsDemoModalOpen(false);
    setSessionMode(mode === 'demo' ? SessionMode.DEMO : SessionMode.FULL);
    if (mode === 'demo') setDemoMode(true);
    else setDemoMode(false);
    setCurrentView(AppView.DASHBOARD);
    navigate(ROUTES.AI_CHAT);
  };

  const handleStartAssessment = () => {
    navigate(ROUTES.LOGIN);
  };

  // Authenticated users land directly in the real Audit Orchestrator hub
  // (/audit-programs); everyone else is routed to login first.
  const handleOpenAuditHub = () => {
    if (currentUser?.isAuthenticated) {
      navigate('/audit-programs');
    } else {
      navigate(ROUTES.LOGIN);
    }
  };

  const handleToolsHubClick = () => {
    navigate('/tools');
  };

  const handleContactClick = () => {
    navigate(ROUTES.LEGAL.CONTACT);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 relative selection:bg-navy-900 selection:text-white">
      <EntryTopBar
        onTrialClick={() => {
          setDemoModalMode('trial');
          setIsDemoModalOpen(true);
        }}
        onDemoClick={() => {
          setDemoModalMode('demo');
          setIsDemoModalOpen(true);
        }}
        onLoginClick={() => navigate(ROUTES.LOGIN)}
        onRegisterClick={() => navigate(ROUTES.REGISTER)}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
      />

      {/* Advanced Background Effects for Hero */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-[90vh]">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-600/5 dark:bg-primary-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[35%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] left-[20%] w-[50%] h-[30%] bg-emerald-600/5 dark:bg-emerald-600/15 rounded-full blur-[80px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(255,255,255,0.4)_100%)] dark:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-40 pb-24 px-6 text-center border-b border-slate-200 dark:border-navy-900">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-black uppercase tracking-[0.2em] mb-8">
            <Map size={14} className="text-primary-400" />
            {t('showcase.audits.hero.badge')}
          </div>

          <h1 className="text-5xl lg:text-8xl font-black tracking-tight text-navy-950 dark:text-white mb-8 uppercase leading-[1] text-center">
            {t('showcase.audits.hero.title1')}
            <br />
            <span className="bg-gradient-to-r from-primary-600 via-crimson-600 to-crimson-600 bg-clip-text text-transparent">
              {t('showcase.audits.hero.title2')}
            </span>
          </h1>

          <p className="text-xl lg:text-3xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
            {t('showcase.audits.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleOpenAuditHub}
              className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-navy-950 dark:bg-white text-white dark:text-navy-950 font-black rounded-2xl hover:scale-[1.02] transition-all shadow-2xl text-xl uppercase tracking-wider"
            >
              {t('showcase.common.execute')}
              <ArrowRight size={24} />
            </button>
          </div>
        </motion.div>
      </section>

      <div className="relative z-10 max-w-7xl mx-auto px-6 -mt-8">
        <AssessmentV8CanonPanel mode="catalog" />
      </div>

      {/* Vertical Multi-Audit Sections */}
      <div className="relative z-10">
        {AUDIT_METHODOLOGIES.map((audit, idx) => (
          <AuditSection
            key={audit.id}
            audit={audit}
            index={idx}
            onStartAssessment={handleStartAssessment}
          />
        ))}
      </div>

      {/* Unified Bottom CTA */}
      <section className="relative z-10 py-32 px-4 bg-slate-900 dark:bg-black overflow-hidden">
        {/* Visual Background Elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 via-crimson-600 to-crimson-600" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary-600/10 rounded-full blur-[120px]" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-black text-white mb-8 uppercase tracking-tight">
            {t('showcase.audits.cta.header')}
            <br />
            <span className="text-primary-400">{t('showcase.audits.cta.headerAccent')}</span>
          </h2>

          <p className="text-xl text-white/60 mb-16 max-w-2xl mx-auto leading-relaxed">
            {t('showcase.audits.cta.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={handleOpenAuditHub}
              className="px-12 py-6 bg-white text-navy-950 font-black rounded-2xl hover:bg-slate-100 transition-all text-xl uppercase tracking-widest shadow-xl"
            >
              {t('showcase.common.execute')}
            </button>
            <button
              onClick={handleToolsHubClick}
              className="px-12 py-6 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-black rounded-2xl hover:bg-navy-800 transition-all text-xl uppercase tracking-widest shadow-xl shadow-primary-600/30 flex items-center justify-center gap-3"
            >
              {t('showcase.common.moreTools')}
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </section>

      {/* Discovery Integration Hint */}
      <div className="py-12 bg-slate-50 dark:bg-navy-950 text-center border-t border-slate-200 dark:border-navy-900">
        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-3">
          <Sparkles size={20} className="text-primary-500" />
          {t('showcase.common.integratedHint')}
        </p>
      </div>

      <EntryFooter />
      <AnnaAssistantWidget
        onDemoClick={() => {
          setDemoModalMode('demo');
          setIsDemoModalOpen(true);
        }}
        onTrialClick={() => {
          setDemoModalMode('trial');
          setIsDemoModalOpen(true);
        }}
        onContactClick={handleContactClick}
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

export default AuditsShowcasePage;
