import { AnimatePresence, motion } from 'framer-motion';
import { Play, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface HeroSectionProps {
  onDemoClick: () => void;
  onTrialClick: () => void;
  onLoginClick: () => void;
  onExpertClick: () => void;
}

// Array of slogan variant keys (1-5)
const SLOGAN_VARIANTS = [1, 2, 3, 4, 5];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onDemoClick,
  onTrialClick,
  onLoginClick,
  onExpertClick,
}) => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Randomly select a slogan variant based on current second (changes every second)
  // This ensures variety on each page load in production
  const [sloganVariant] = useState(() => {
    const second = new Date().getSeconds();
    return SLOGAN_VARIANTS[second % SLOGAN_VARIANTS.length];
  });

  const cards = [
    {
      id: 'demo',
      title: t('landing.hero.cards.demo.title', 'Interactive Demo'),
      description: t(
        'landing.hero.cards.demo.description',
        'Explore Consultify with AI-guided walkthrough. No signup required.'
      ),
      meta: t('landing.hero.cards.demo.meta', 'GUIDED EXPERIENCE'),
      cta: t('landing.hero.cards.demo.cta', 'Start Demo'),
      image: '/assets/landing/cinematic/demo_digital_twin.png',
      color: 'crimson',
      onClick: onDemoClick,
      className: 'lg:col-span-1 lg:row-span-1',
    },
    {
      id: 'trial',
      title: t('landing.hero.cards.trial.title', 'Free Trial'),
      description: t(
        'landing.hero.cards.trial.description',
        '7-day full access to all features. Start your transformation today.'
      ),
      meta: t('landing.hero.cards.trial.meta', '7 DAYS FREE'),
      cta: t('landing.hero.cards.trial.cta', 'Start Free Trial'),
      image: '/assets/landing/cinematic/trial_command_cockpit.png',
      color: 'indigo',
      onClick: onTrialClick,
      primary: true,
      className: 'lg:col-span-1 lg:row-span-2',
    },
    {
      id: 'video',
      title: t('landing.hero.cards.video.title', 'Watch How It Works'),
      description: t(
        'landing.hero.cards.video.description',
        'See Consultify in action with real enterprise transformation examples.'
      ),
      meta: t('landing.hero.cards.video.meta', '3 MIN VIDEO'),
      cta: t('landing.hero.cards.video.cta', 'Play Video'),
      image: '/assets/landing/video_presentation.jpg',
      color: 'black',
      onClick: () => setIsVideoOpen(true),
      isVideo: true,
      className: 'lg:col-span-2 lg:row-span-1',
    },
    {
      id: 'tools',
      title: t('landing.hero.cards.tools.title', 'Learn Our Tools'),
      description: t(
        'landing.hero.cards.tools.description',
        'Watch demos and masterclasses for 40+ consulting frameworks.'
      ),
      meta: t('landing.hero.cards.tools.meta', 'EDUCATION HUB'),
      cta: t('landing.hero.cards.tools.cta', 'Explore Tools'),
      image: '/assets/landing/cinematic/tools_education.png',
      color: 'cyan',
      onClick: () => navigate('/tools'),
      className: 'lg:col-span-1 lg:row-span-1',
      icon: Sparkles,
    },
    {
      id: 'audits',
      title: t('landing.hero.cards.audits.title', 'Global Audits'),
      description: t(
        'landing.hero.cards.audits.description',
        'DRD, SIRI, ADMA & Lean 4.0 assessment frameworks.'
      ),
      meta: t('landing.hero.cards.audits.meta', 'INDUSTRIAL EXCELLENCE'),
      cta: t('landing.hero.cards.audits.cta', 'Explore Audits'),
      image: '/assets/landing/cinematic/industrial_audits.png',
      color: 'navy',
      onClick: () => navigate('/audits'),
      className: 'lg:col-span-1 lg:row-span-1',
    },
  ];

  return (
    <section className="pt-32 pb-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Text */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl lg:text-7xl font-black text-c-text leading-[1.05] tracking-tight mb-8"
          >
            {t('landing.hero.title', 'Think bigger.Do smarter').split('.')[0]}.<br />
            {t('landing.hero.title', 'Think bigger.Do smarter').split('.')[1]}.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl lg:text-2xl text-white/90 leading-relaxed font-medium"
          >
            {t('landing.hero.subtitleLine1', 'Your')}{' '}
            <span className="text-c-accent font-bold">
              {t('landing.hero.coThinker', 'AI Co-Thinker')}
            </span>{' '}
            {t('landing.hero.subtitleLine1End', 'for Enterprise Strategy.')}
            <br />
            {t(
              `landing.hero.slogans.${sloganVariant}`,
              'Months of consulting. Minutes of AI. Better results.'
            )}
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[240px]">
          {cards.map((card, idx) => {
            // Define border and glow colors for each card type
            const colorMap: Record<string, { border: string; glow: string; hoverBorder: string }> =
              {
                crimson: {
                  border: 'ring-c-accent/40',
                  glow: 'shadow-c-accent/20',
                  hoverBorder: 'group-hover:ring-c-accent/60',
                },
                indigo: {
                  border: 'ring-indigo-500/40',
                  glow: 'shadow-indigo-500/20',
                  hoverBorder: 'group-hover:ring-indigo-400/60',
                },
                black: {
                  border: 'ring-slate-400/40',
                  glow: 'shadow-slate-400/20',
                  hoverBorder: 'group-hover:ring-slate-300/60',
                },
                emerald: {
                  border: 'ring-emerald-500/40',
                  glow: 'shadow-emerald-500/20',
                  hoverBorder: 'group-hover:ring-emerald-400/60',
                },
                navy: {
                  border: 'ring-blue-500/40',
                  glow: 'shadow-blue-500/20',
                  hoverBorder: 'group-hover:ring-blue-400/60',
                },
                cyan: {
                  border: 'ring-blue-500/40',
                  glow: 'shadow-blue-500/20',
                  hoverBorder: 'group-hover:ring-blue-400/60',
                },
              };
            const colors = colorMap[card.color] || colorMap['crimson'];

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (card.onClick) {
                    card.onClick();
                  }
                }}
                className={`
                                    group relative rounded-xl overflow-hidden
                                    shadow-lg hover:shadow-2xl ${colors.glow} hover:shadow-xl
                                    transition-all duration-500 cursor-pointer select-none
                                    ${card.className}
                                    ${card.primary ? 'ring-2 ring-c-accent ring-offset-4 ring-offset-c-bg' : ''}
                                `}
              >
                {/* Background Image */}
                <div
                  className={`absolute inset-0 rounded-xl ring-2 ${colors.border} ${colors.hoverBorder} ring-inset transition-all duration-500 pointer-events-none`}
                >
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent group-hover:from-black/95 transition-colors" />
                </div>

                {/* Content Overlay */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end pointer-events-none">
                  {card.isVideo && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/40 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl"
                      >
                        <Play size={32} fill="white" className="text-white ml-1" />
                      </motion.div>
                    </div>
                  )}

                  <div className="space-y-2 relative z-10 transition-transform duration-300 group-hover:-translate-y-2">
                    <span className="text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">
                      {card.meta}
                    </span>
                    <h3 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
                      {card.title}
                    </h3>
                    <p className="text-sm text-white/70 line-clamp-2 font-medium">
                      {card.description}
                    </p>

                    <div className="pt-4 flex items-center gap-2 text-white font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 duration-300">
                      {card.cta}
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        →
                      </motion.span>
                    </div>
                  </div>
                </div>

                {/* Glowing accent for primary */}
                {card.primary && (
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none animate-breathing-glow bg-c-accent/20"
                  />
                )}
              </motion.div>
            );
          })}

          {/* Tagline Badge - As a grid item */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="hidden lg:block lg:col-span-1 lg:row-span-1 relative group cursor-pointer shadow-lg hover:shadow-2xl shadow-c-accent/20 hover:shadow-xl transition-all duration-500"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-c-accent/30 rounded-xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-500"></div>

            {/* Content */}
            <div className="relative h-full px-8 py-8 rounded-xl border border-white/20 backdrop-blur-xl bg-black/60 shadow-2xl flex flex-col justify-center ring-2 ring-c-accent/40 group-hover:ring-c-accent/60 ring-inset transition-all duration-500 overflow-hidden">
              {/* Background Image */}
              <img
                src="/assets/landing/cinematic/decisions_manifest.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-25 transition-opacity duration-500 group-hover:opacity-35"
              />

              {/* Text Content */}
              <div className="relative z-10 text-right space-y-1">
                <p className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                  {t('landing.hero.tagline.line1', 'AI consulting.')}
                </p>
                <p className="text-2xl lg:text-3xl font-black text-c-accent tracking-tight leading-tight">
                  {t('landing.hero.tagline.line2', 'No slides.')}
                </p>
                <p className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                  {t('landing.hero.tagline.line3', 'Just decisions.')}
                </p>
              </div>

              {/* Accent line */}
              <div className="relative z-10 mt-4 h-1.5 w-20 ml-auto bg-c-accent rounded-full"></div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-c-bg/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors p-2"
            >
              <X size={32} />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative"
            >
              <video className="w-full h-full object-cover" controls autoPlay>
                <source src="/videos/en.mp4" type="video/mp4" />
                {t('common.videoUnsupported', 'Your browser does not support the video tag.')}
              </video>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
