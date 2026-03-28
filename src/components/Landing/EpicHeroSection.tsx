import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Play, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface EpicHeroSectionProps {
  onOpenDemoNow: () => void;
  onLaunchTrial: () => void;
  variant: string;
  backgroundLoopUrl?: string;
}

type Tilt = { rx: number; ry: number };

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Browser-chrome frame around the real app screenshot */
const AppScreenshotFrame: React.FC = () => (
  <div
    className="rounded-2xl overflow-hidden"
    style={{
      background: 'rgba(10,8,30,0.85)',
      border: '1px solid rgba(124,58,237,0.30)',
      boxShadow:
        '0 0 0 1px rgba(255,255,255,0.06), 0 0 80px -20px rgba(124,58,237,0.50), 0 40px 80px -20px rgba(0,0,0,0.70)',
    }}
  >
    {/* Chrome top bar */}
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        background: 'rgba(0,0,0,0.45)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Traffic lights */}
      <div className="flex gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/70" />
      </div>

      {/* URL bar */}
      <div
        className="flex-1 h-6 rounded-md flex items-center gap-2 px-3"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-[10px] text-white/30 font-mono">consultify.ai/workspace</span>
      </div>

      {/* Sparkle icon */}
      <Sparkles size={13} className="text-primary-400 shrink-0" />
    </div>

    {/* Screenshot */}
    <div className="relative">
      <img
        src="/assets/landing/app-screenshot-hero.png"
        alt="Consultify AI workspace"
        className="w-full block"
        style={{ maxHeight: '340px', objectFit: 'cover', objectPosition: 'top' }}
      />
      {/* Subtle bottom fade so it blends into dark bg */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(10,8,30,0.90))',
        }}
      />
    </div>
  </div>
);

export const EpicHeroSection: React.FC<EpicHeroSectionProps> = ({
  onOpenDemoNow,
  onLaunchTrial,
  variant,
  backgroundLoopUrl,
}) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const previewRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [tilt, setTilt] = useState<Tilt>({ rx: 0, ry: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduceMotion) return;
      const el = previewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const target: Tilt = {
        rx: clampNum((0.5 - py) * 6, -3, 3),
        ry: clampNum((px - 0.5) * 8, -4, 4),
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setTilt(target));
    },
    [reduceMotion]
  );

  const resetTilt = useCallback(() => {
    if (reduceMotion) return;
    setTilt({ rx: 0, ry: 0 });
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleAnnaPrompt = useCallback(
    (prompt: string, promptKey: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('anna:open', { detail: { prompt } }));
      }
      trackFunnelEvent('landing_anna_guided_prompt_clicked', {
        promptKey,
        variant,
      });
    },
    [variant]
  );

  const handleAnnaOpen = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anna:open'));
    }
    trackFunnelEvent('landing_anna_guided_prompt_clicked', {
      promptKey: 'open_assistant',
      variant,
    });
  }, [variant]);

  const annaPrompts = [
    {
      key: 'fit',
      label: t('landing.epicHero.annaPrompts.fit.label', 'Ask about fit'),
      prompt: t('landing.epicHero.annaPrompts.fit.prompt', 'Is Consultify right for my team?'),
    },
    {
      key: 'pricing',
      label: t('landing.epicHero.annaPrompts.pricing.label', 'Ask about pricing'),
      prompt: t(
        'landing.epicHero.annaPrompts.pricing.prompt',
        'How should I choose between demo, trial, and pricing plans?'
      ),
    },
    {
      key: 'security',
      label: t('landing.epicHero.annaPrompts.security.label', 'Ask about security'),
      prompt: t(
        'landing.epicHero.annaPrompts.security.prompt',
        'How does Consultify handle security and data residency?'
      ),
    },
  ];

  return (
    <section className="relative z-10 px-6 min-h-screen flex flex-col">
      {/* ── Ambient Background Layer ── */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Deep gradient base */}
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />

        {/* Primary violet blob — top-left */}
        <motion.div
          aria-hidden
          className="absolute -top-[15%] -left-[10%] w-[65%] h-[65%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 65%)',
            filter: 'blur(80px)',
          }}
          animate={reduceMotion ? undefined : { x: [0, 40, 0], y: [0, 25, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Cyan blob — bottom-right */}
        <motion.div
          aria-hidden
          className="absolute -bottom-[20%] -right-[15%] w-[65%] h-[65%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,210,255,0.18) 0%, transparent 65%)',
            filter: 'blur(90px)',
          }}
          animate={reduceMotion ? undefined : { x: [0, -35, 0], y: [0, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Fuchsia accent blob — center */}
        <motion.div
          aria-hidden
          className="absolute top-[30%] right-[25%] w-[40%] h-[40%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(192,38,211,0.18) 0%, transparent 65%)',
            filter: 'blur(100px)',
          }}
          animate={reduceMotion ? undefined : { x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Optional video layer */}
        {backgroundLoopUrl && (
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-[0.18] mix-blend-screen"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src={backgroundLoopUrl} />
          </video>
        )}

        {/* Subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at 50% 40%, black 0%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 0%, transparent 72%)',
          }}
        />

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.50)_70%,rgba(0,0,0,0.72)_100%)]" />
      </div>

      {/* ── Content ── */}
      {/* pt-16 clears the fixed topbar (h-14 = 3.5rem) + breathing room */}
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col pt-20 md:pt-24 pb-8">
        {/* Main grid */}
        <div className="flex-1 grid lg:grid-cols-2 gap-12 xl:gap-16 items-center">
          {/* ── Copy ── */}
          <div className="max-w-2xl space-y-6 md:space-y-7">
            {/* Eyebrow badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary-500/35 bg-primary-600/10 backdrop-blur-sm"
            >
              <Sparkles size={12} className="text-primary-300" />
              <span className="text-xs font-bold text-primary-300 tracking-wide">
                {t('landing.epicHero.eyebrow', 'Consulting Intelligence Platform')}
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06 }}
              className="font-black tracking-tight leading-[1.0] text-white"
              style={{ fontSize: 'clamp(40px, 5.5vw, 88px)' }}
            >
              <span className="block">{t('landing.profitHero.h1.line1', 'Consultify gives teams')}</span>
              <span className="block text-white/75 mt-1">
                {t('landing.profitHero.h1.line2', 'consulting intelligence')}
              </span>
              <span
                className="block mt-1"
                style={{
                  background: 'linear-gradient(90deg, #a78bfa, #c084fc, #67e8f9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('landing.profitHero.h1.line3', 'they can actually execute.')}
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14 }}
              className="text-base md:text-lg text-white/60 font-medium leading-relaxed max-w-lg"
            >
              {t(
                'landing.epicHero.sub',
                'For consultants, transformation teams, and operators who need diagnosis, planning, execution, and measurable results in one workflow.'
              )}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-3"
            >
              {/* Primary CTA — filled pill */}
              <button
                onClick={() => {
                  trackFunnelEvent('landing_primary_cta_clicked', {
                    cta: 'launch_free_trial',
                    variant,
                  });
                  onLaunchTrial();
                }}
                className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-white font-semibold text-sm overflow-hidden
                  transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c026d3 100%)',
                  boxShadow: '0 0 50px -14px rgba(124,58,237,0.70), 0 3px 16px rgba(0,0,0,0.35)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 70px -10px rgba(124,58,237,0.85), 0 4px 20px rgba(0,0,0,0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 50px -14px rgba(124,58,237,0.70), 0 3px 16px rgba(0,0,0,0.35)';
                }}
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_60%)]" />
                <span className="relative">
                  {t('landing.profitHero.ctaPrimary', 'Start trial')}
                </span>
                <ArrowRight size={15} className="relative" />
              </button>

              {/* Secondary CTA — ghost pill */}
              <button
                onClick={() => {
                  trackFunnelEvent('landing_demo_clicked', { cta: 'open_demo_now', variant });
                  onOpenDemoNow();
                }}
                className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full font-semibold text-sm text-white
                  transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(255,255,255,0.09)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    'rgba(168,85,247,0.45)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    'rgba(255,255,255,0.18)';
                }}
              >
                <Play size={14} className="text-white/70" fill="currentColor" />
                <span>{t('landing.profitHero.ctaSecondary', 'Watch demo')}</span>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary-300">
                <Sparkles size={12} />
                <span>{t('landing.epicHero.annaBadge', 'Start with Anna')}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {t(
                  'landing.epicHero.annaSub',
                  'Not sure whether to start with a demo or a trial? Anna can explain fit, pricing, and security before you choose your next step.'
                )}
              </p>
              <div className="mt-4">
                <button
                  onClick={handleAnnaOpen}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/12 px-3.5 py-2 text-xs font-semibold text-violet-100 transition-all duration-200 hover:bg-violet-500/20"
                >
                  <Sparkles size={12} />
                  <span>{t('landing.epicHero.annaPrimaryCta', 'Ask Anna first')}</span>
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {annaPrompts.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleAnnaPrompt(item.prompt, item.key)}
                    className="rounded-full border border-white/12 bg-white/[0.035] px-3.5 py-2 text-xs font-semibold text-white/75 transition-all duration-200 hover:bg-white/[0.07] hover:text-white"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Social proof micro-line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex items-center gap-3 text-xs text-white/35"
            >
              <div className="flex -space-x-2">
                {['#7c3aed', '#a855f7', '#06b6d4', '#10b981'].map((color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full border-2 border-[#0A0A1F] flex items-center justify-center text-[7px] font-black text-white"
                    style={{ background: color }}
                  >
                    {['M', 'J', 'K', 'A'][i]}
                  </div>
                ))}
              </div>
              <span>
                {t('landing.epicHero.socialProof', 'Trusted by 200+ consulting teams globally')}
              </span>
            </motion.div>
          </div>

          {/* ── Preview (desktop) ── */}
          <div className="hidden lg:block">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="relative max-w-[560px] ml-auto"
            >
              {/* Glow behind card */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-3xl blur-3xl"
                style={{
                  background: 'radial-gradient(ellipse, rgba(124,58,237,0.35) 0%, transparent 70%)',
                  transform: 'scale(1.15) translateY(5%)',
                }}
              />

              <motion.div
                ref={previewRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={resetTilt}
                animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  transformStyle: 'preserve-3d',
                }}
                className="relative"
              >
                <AppScreenshotFrame />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* ── Billboard ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-auto pt-8 flex flex-wrap items-center justify-between gap-3"
        >
          {/* Left: Spotify tagline + No credit card */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 bg-white/[0.04] border border-white/10 backdrop-blur-sm">
              <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                {t(
                  'landing.profitHero.billboardShort',
                  'One workflow from diagnosis to execution to measurable results.'
                )}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/25">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span>{t('landing.epicHero.noCC', 'No credit card required')}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default EpicHeroSection;
