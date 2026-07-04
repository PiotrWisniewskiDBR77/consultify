import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  GitBranch,
  GraduationCap,
  HelpCircle,
  Map,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LANDING_FILMS } from '@/config/landingFilms';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

// App Feature Carousel Slides
const AppFeatureSlide: React.FC<{
  type: 'notifications' | 'tasks' | 'initiatives' | 'decisions';
}> = ({ type }) => {
  const { t } = useTranslation();
  if (type === 'notifications') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-c-accent-soft flex items-center justify-center">
              <Bell size={20} className="text-c-accent" />
            </div>
            <span className="text-white font-bold text-lg">
              {t('landing.carousel.labels.notifications', 'Notifications')}
            </span>
          </div>
          <span className="px-3 py-1 bg-danger-500/20 text-danger-400 rounded-full text-xs font-bold">
            {t('landing.carousel.slides.notifications.badge', {
              count: 3,
              defaultValue: '{{count}} New',
            })}
          </span>
        </div>
        <div className="space-y-3 flex-1">
          {[
            {
              icon: AlertTriangle,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10',
              title: t(
                'landing.carousel.slides.notifications.items.0.title',
                'Initiative Deadline'
              ),
              desc: t(
                'landing.carousel.slides.notifications.items.0.desc',
                'Industry 4.0 Roadmap due in 2 days'
              ),
              time: t('landing.carousel.slides.notifications.items.0.time', '2h ago'),
            },
            {
              icon: CheckSquare,
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
              title: t('landing.carousel.slides.notifications.items.1.title', 'Task Completed'),
              desc: t(
                'landing.carousel.slides.notifications.items.1.desc',
                'Assessment phase finished by team'
              ),
              time: t('landing.carousel.slides.notifications.items.1.time', '4h ago'),
            },
            {
              icon: Users,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10',
              title: t('landing.carousel.slides.notifications.items.2.title', 'New Comment'),
              desc: t(
                'landing.carousel.slides.notifications.items.2.desc',
                'Dr. Kowalski commented on ROI analysis'
              ),
              time: t('landing.carousel.slides.notifications.items.2.time', '6h ago'),
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-4 rounded-xl ${item.bg} border border-c-border-subtle flex items-start gap-3`}
            >
              <div
                className={`w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0`}
              >
                <item.icon size={16} className={item.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs truncate">{item.desc}</p>
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] flex-shrink-0">
                {item.time}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'tasks') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <CheckSquare size={20} className="text-blue-400" />
            </div>
            <span className="text-white font-bold text-lg">
              {t('landing.carousel.slides.tasks.title', 'My Tasks')}
            </span>
          </div>
          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold">
            {t('landing.carousel.slides.tasks.badge', {
              count: 12,
              defaultValue: '{{count}} Active',
            })}
          </span>
        </div>
        <div className="space-y-3 flex-1">
          {[
            {
              status: 'in_progress',
              title: t('landing.carousel.slides.tasks.items.0.title', 'Complete DRD Assessment'),
              priority: 'high',
              priorityLabel: t('landing.carousel.priority.high', 'High'),
              progress: 75,
            },
            {
              status: 'pending',
              title: t('landing.carousel.slides.tasks.items.1.title', 'Review ROI Projections'),
              priority: 'medium',
              priorityLabel: t('landing.carousel.priority.medium', 'Medium'),
              progress: 0,
            },
            {
              status: 'in_progress',
              title: t('landing.carousel.slides.tasks.items.2.title', 'Prepare Stage-Gate Report'),
              priority: 'high',
              priorityLabel: t('landing.carousel.priority.high', 'High'),
              progress: 40,
            },
          ].map((task, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl bg-white/5 border border-c-border-subtle"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${task.status === 'in_progress' ? 'bg-blue-400' : 'bg-white/20'}`}
                  />
                  <span className="text-white font-semibold text-sm">{task.title}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${task.priority === 'high' ? 'bg-danger-500/20 text-danger-400' : 'bg-amber-500/20 text-amber-400'}`}
                >
                  {task.priorityLabel}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-c-accent rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'initiatives') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Rocket size={20} className="text-emerald-400" />
            </div>
            <span className="text-white font-bold text-lg">
              {t('landing.carousel.labels.initiatives', 'Initiatives')}
            </span>
          </div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">
            {t('landing.carousel.slides.initiatives.badge', {
              count: 4,
              defaultValue: '{{count}} Active',
            })}
          </span>
        </div>
        <div className="space-y-3 flex-1">
          {[
            {
              name: t('landing.carousel.slides.initiatives.items.0.name', 'Industry 4.0 Roadmap'),
              status: 'onTrack',
              statusLabel: t('landing.carousel.status.onTrack', 'On Track'),
              roi: '+240%',
              phase: t('landing.carousel.phase.execution', 'Execution'),
            },
            {
              name: t(
                'landing.carousel.slides.initiatives.items.1.name',
                'Digital Twin Implementation'
              ),
              status: 'atRisk',
              statusLabel: t('landing.carousel.status.atRisk', 'At Risk'),
              roi: '+180%',
              phase: t('landing.carousel.phase.planning', 'Planning'),
            },
            {
              name: t(
                'landing.carousel.slides.initiatives.items.2.name',
                'Supply Chain Optimization'
              ),
              status: 'onTrack',
              statusLabel: t('landing.carousel.status.onTrack', 'On Track'),
              roi: '+95%',
              phase: t('landing.carousel.phase.assessment', 'Assessment'),
            },
          ].map((init, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl bg-white/5 border border-c-border-subtle"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-semibold text-sm">{init.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${init.status === 'onTrack' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}
                >
                  {init.statusLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                  <GitBranch size={12} />
                  <span>{init.phase}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <TrendingUp size={12} />
                  <span>
                    {t('landing.carousel.roi', 'ROI')} {init.roi}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // decisions
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Target size={20} className="text-amber-400" />
          </div>
          <span className="text-white font-bold text-lg">
            {t('landing.carousel.labels.decisions', 'Decisions')}
          </span>
        </div>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold">
          {t('landing.carousel.slides.decisions.badge', {
            count: 2,
            defaultValue: '{{count}} Pending',
          })}
        </span>
      </div>
      <div className="space-y-3 flex-1">
        {[
          {
            title: t(
              'landing.carousel.slides.decisions.items.0.title',
              'Approve Q2 Budget Allocation'
            ),
            type: t('landing.carousel.decisionType.financial', 'Financial'),
            votes: '4/5',
            deadline: t('landing.carousel.slides.decisions.items.0.deadline', '2 days'),
          },
          {
            title: t(
              'landing.carousel.slides.decisions.items.1.title',
              'Select Technology Partner'
            ),
            type: t('landing.carousel.decisionType.strategic', 'Strategic'),
            votes: '2/5',
            deadline: t('landing.carousel.slides.decisions.items.1.deadline', '5 days'),
          },
          {
            title: t('landing.carousel.slides.decisions.items.2.title', 'Phase 2 Go/No-Go'),
            type: t('landing.carousel.decisionType.stageGate', 'Stage-Gate'),
            votes: '5/5',
            deadline: t('landing.carousel.deadline.completed', 'Completed'),
          },
        ].map((dec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl bg-white/5 border border-c-border-subtle"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-white font-semibold text-sm">{dec.title}</span>
              <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-medium text-slate-300">
                {dec.type}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                  <Users size={12} />
                  <span>
                    {dec.votes} {t('landing.carousel.votes', 'votes')}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                  <Clock size={12} />
                  <span>{dec.deadline}</span>
                </div>
              </div>
              {dec.deadline === t('landing.carousel.deadline.completed', 'Completed') && (
                <CheckCircle size={16} className="text-emerald-400" />
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Feature Carousel Component
const FeatureCarousel: React.FC = () => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides: Array<'notifications' | 'tasks' | 'initiatives' | 'decisions'> = [
    'notifications',
    'tasks',
    'initiatives',
    'decisions',
  ];
  const slideLabels = [
    t('landing.carousel.labels.notifications', 'Notifications'),
    t('landing.carousel.labels.tasks', 'Tasks'),
    t('landing.carousel.labels.initiatives', 'Initiatives'),
    t('landing.carousel.labels.decisions', 'Decisions'),
  ];

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      {/* Human Control Badge */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="px-4 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full backdrop-blur-xl">
          <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Users size={12} />
            {t('landing.trust.carouselTagline', 'AI analyzes. You command.')}
          </span>
        </div>
      </div>

      {/* Main Card */}
      <div className="aspect-[4/5] bg-white/5 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-c-border-subtle p-8 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            <AppFeatureSlide type={slides[currentSlide]} />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Dots */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-c-border-subtle">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`transition-all duration-300 ${
                idx === currentSlide
                  ? 'w-8 h-2 bg-navy-900 rounded-full dark:bg-white'
                  : 'w-2 h-2 bg-white/20 rounded-full hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-c-border-subtle"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-10 h-10 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-c-border-subtle"
      >
        <ChevronRight size={20} />
      </button>

      {/* Slide Label */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
        <span className="text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider">
          {slideLabels[currentSlide]}
        </span>
      </div>
    </div>
  );
};

// FAQ Accordion Item
const FAQItem: React.FC<{
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}> = ({ question, answer, isOpen, onClick }) => (
  <div className="border-b border-c-border last:border-0">
    <button
      onClick={onClick}
      className="w-full p-4 flex items-center justify-between text-left group"
    >
      <span className="font-bold text-c-text pr-8 group-hover:text-c-accent transition-colors">
        {question}
      </span>
      <ChevronDown
        size={20}
        className={`text-c-text-muted transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <p className="pb-5 text-c-text-secondary leading-relaxed">{answer}</p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export const InfoSections: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  const faqs = [
    {
      q: t('landing.faq.items.0.q', 'What is Consultify?'),
      a: t(
        'landing.faq.items.0.a',
        'Consultify is an AI-powered strategic consulting platform that helps industrial organizations navigate digital transformation. It combines artificial intelligence with human governance to deliver actionable roadmaps, not just reports.'
      ),
    },
    {
      q: t('landing.faq.items.1.q', 'How is this different from traditional consulting?'),
      a: t(
        'landing.faq.items.1.a',
        'Traditional consulting delivers PowerPoint decks. Consultify delivers a living system. Our AI continuously analyzes your context, generates initiatives, and tracks execution. You get real-time strategic guidance, not a one-time report that sits on a shelf.'
      ),
    },
    {
      q: t('landing.faq.items.2.q', 'Is my data secure?'),
      a: t(
        'landing.faq.items.2.a',
        'Absolutely. We are GDPR compliant with EU data residency. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We never train AI models on your proprietary data. Enterprise customers can use their own API keys (BYOK).'
      ),
    },
    {
      q: t('landing.faq.items.3.q', 'Do I need technical expertise to use it?'),
      a: t(
        'landing.faq.items.3.a',
        'No. Consultify is designed for business leaders, not IT specialists. The interface is intuitive, and our AI guides you through every step. We also offer onboarding support and training for your team.'
      ),
    },
    {
      q: t('landing.faq.items.4.q', 'Can I try before I buy?'),
      a: t(
        'landing.faq.items.4.a',
        'Yes! We offer a 7-day free trial with full access to all features. No credit card required. You can also request a personalized demo with our team to see the platform in action with your specific use case.'
      ),
    },
    {
      q: t('landing.faq.items.5.q', 'What industries do you serve?'),
      a: t(
        'landing.faq.items.5.a',
        'We specialize in manufacturing and industrial sectors, including automotive, aerospace, electronics, food & beverage, and heavy industry. Our assessment frameworks are tailored to Industry 4.0 transformation challenges.'
      ),
    },
  ];

  const steps = [
    {
      icon: GraduationCap,
      title: t('landing.steps.diagnostic.title'),
      desc: t('landing.steps.diagnostic.desc'),
    },
    {
      icon: Map,
      title: t('landing.steps.roadmap.title'),
      desc: t('landing.steps.roadmap.desc'),
    },
    {
      icon: Rocket,
      title: t('landing.steps.approval.title'),
      desc: t('landing.steps.approval.desc'),
    },
  ];

  return (
    <div className="space-y-32 py-20">
      {/* How It Works */}
      <section className="px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="text-xs font-black text-c-accent uppercase tracking-[0.3em] mb-6"
            >
              {t('landing.methodology.badge')}
            </motion.h2>
            <h3 className="text-4xl lg:text-5xl font-black text-c-text tracking-tight">
              {t('landing.methodology.heading')}
            </h3>
          </div>

          {/* Methodology teaser hidden temporarily; keep implementation history in git for restore */}

          <div className="grid md:grid-cols-3 gap-16 lg:gap-24">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="space-y-6 group"
                >
                  <div className="w-20 h-20 bg-c-surface rounded-xl flex items-center justify-center border border-c-border shadow-premium group-hover:shadow-glow transition-all duration-500 text-c-text">
                    <Icon size={36} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-2xl font-black text-c-text tracking-tight">
                      {step.title}
                    </h4>
                    <p className="text-c-text-muted text-base leading-relaxed font-medium">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Governance */}
      <section className="px-6 relative z-10">
        <div className="max-w-6xl mx-auto bg-navy-950 rounded-[4rem] p-12 lg:p-24 relative overflow-hidden border border-navy-800 dark:border-c-border-subtle shadow-3xl">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-c-accent/10 rounded-full blur-[120px] -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[100px] -ml-20 -mb-20" />

          <div className="relative z-10 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-c-border-subtle text-[10px] font-black text-white uppercase tracking-[0.2em]">
                <ShieldCheck size={16} className="text-emerald-400" />
                {t('landing.trust.badge', 'Enterprise Integrity')}
              </div>
              <h3 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                {t('landing.trust.heading', 'Intelligence Guided by Human Approval.')}
              </h3>
              <p className="text-lg text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                {t(
                  'landing.trust.description',
                  'AI is a partner, not an authority. Consultify implements a strict governance layer where every strategic move requires high-level human validation.'
                )}
              </p>

              <ul className="space-y-4">
                {(Array.isArray(t('landing.trust.points', { returnObjects: true }))
                  ? (t('landing.trust.points', { returnObjects: true }) as string[])
                  : [
                      'Full accountability for every roadmap item',
                      'Multi-tenant data isolation & military-grade security',
                      'SOC2 compliant infrastructure logic',
                    ]
                ).map((item: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-center gap-4 text-base font-bold text-slate-200"
                  >
                    <div className="w-6 h-6 rounded-full bg-c-accent-soft flex items-center justify-center">
                      <CheckCircle size={16} className="text-c-accent" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <a
                  href="/legal/security"
                  className="inline-block px-8 py-4 bg-white text-navy-950 rounded-full text-sm font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl shadow-white/5 active:scale-95"
                >
                  {t('landing.trust.cta', 'View Security Overview')}
                </a>
              </div>
            </div>

            <div className="relative">
              {/* Feature Carousel */}
              <FeatureCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-c-accent-soft rounded-full text-c-accent text-xs font-black uppercase tracking-widest mb-6"
            >
              <HelpCircle size={14} />
              {t('landing.faq.badge', 'FAQ')}
            </motion.div>
            <h3 className="text-4xl lg:text-5xl font-black text-c-text tracking-tight">
              {t('landing.faq.heading', 'Questions? Answers.')}
            </h3>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-c-surface rounded-xl p-8 border border-c-border shadow-xl"
          >
            {faqs.map((faq, idx) => (
              <FAQItem
                key={idx}
                question={faq.q}
                answer={faq.a}
                isOpen={openFAQ === idx}
                onClick={() => setOpenFAQ(openFAQ === idx ? null : idx)}
              />
            ))}
          </motion.div>

          <div className="text-center mt-8 space-y-6">
            <p className="text-c-text-muted">
              {t('landing.faq.more', 'Have more questions?')}{' '}
              <a
                href="/contact"
                className="text-c-accent font-semibold hover:underline"
              >
                {t('landing.faq.contact', 'Contact us')}
              </a>
            </p>

            <div className="pt-6 flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold shadow-lg shadow-c-accent/20 transition-colors"
              >
                {t('landing.faq.ctaPrimary', 'Launch Free Trial')}
              </button>
              <button
                onClick={() => navigate('/resources')}
                className="px-6 py-3 rounded-xl border border-c-border hover:bg-c-surface-raised text-c-text-secondary font-semibold transition-colors"
              >
                {t('landing.faq.ctaSecondary', 'Browse resources')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
