import { motion } from 'framer-motion';
import {
  Brain,
  Calendar,
  Cpu,
  Globe,
  Handshake,
  Link2,
  Mic,
  Shield,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useLocation } from 'react-router-dom';

type ModuleKey = 'iris' | 'marketplace' | 'meeting';

interface ModuleConfig {
  title: string;
  badge: string;
  headline: string;
  description: string;
  features: { icon: React.ReactNode; title: string; description: string }[];
  highlights: { value: string; label: string }[];
  imageUrl: string;
  imageAlt: string;
  gradient: string;
  accentColor: string;
  ctaText: string;
}

const MEETING_IMAGE =
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80&auto=format&fit=crop';
const IRIS_IMAGE =
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80&auto=format&fit=crop';
const MARKETPLACE_IMAGE =
  'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800&q=80&auto=format&fit=crop';

const copyByModule: Record<ModuleKey, ModuleConfig> = {
  meeting: {
    title: 'Meeting Intelligence',
    badge: 'Coming Soon',
    headline: 'Transform every meeting into measurable outcomes',
    description:
      'Stop losing critical insights in endless meetings. Meeting Intelligence uses AI to prepare context-aware agendas, capture decisions in real time, and automatically turn action items into tracked tasks — so your team spends less time in meetings and more time executing.',
    features: [
      {
        icon: <Calendar size={20} />,
        title: 'Smart Preparation',
        description:
          'AI analyzes project context, past decisions, and open items to generate focused agendas before you even start.',
      },
      {
        icon: <Mic size={20} />,
        title: 'Live Capture & Decisions',
        description:
          'Real-time transcription with automatic detection of decisions, action items, and key insights during meetings.',
      },
      {
        icon: <Target size={20} />,
        title: 'Auto Task Assignment',
        description:
          'Action items are instantly converted to tracked tasks with owners, deadlines, and project linkage.',
      },
      {
        icon: <TrendingUp size={20} />,
        title: 'Meeting Analytics',
        description:
          'Track meeting effectiveness over time — decision velocity, follow-through rates, and time-to-action metrics.',
      },
    ],
    highlights: [
      { value: '40%', label: 'Less meeting time' },
      { value: '95%', label: 'Action item capture' },
      { value: '3x', label: 'Faster follow-through' },
    ],
    imageUrl: MEETING_IMAGE,
    imageAlt: 'Team collaborating in a productive meeting',
    gradient: 'from-blue-600/20 via-indigo-600/10 to-purple-600/5',
    accentColor: 'blue',
    ctaText: 'Get notified when it launches',
  },
  iris: {
    title: 'MCP IRIS',
    badge: 'Coming Soon',
    headline: 'Connect Consultify directly to your plant operating systems',
    description:
      'MCP IRIS bridges the gap between strategic consulting and operational reality. Integrate directly with IRIS — the AI-native Plant Operating System — to pull live production data, OEE metrics, and quality indicators into your transformation workflows. Make decisions grounded in real factory data, not assumptions.',
    features: [
      {
        icon: <Cpu size={20} />,
        title: 'Live Production Data',
        description:
          'Connect to IoT sensors, MES, and SCADA systems through IRIS to surface real-time KPIs in your consulting workspace.',
      },
      {
        icon: <Brain size={20} />,
        title: 'AI-Powered Insights',
        description:
          'Cross-reference operational data with your initiatives to validate impact, identify bottlenecks, and prioritize actions.',
      },
      {
        icon: <Shield size={20} />,
        title: 'Enterprise Governance',
        description:
          'Role-based access, full audit trails, and data residency controls — built for regulated industries.',
      },
      {
        icon: <Link2 size={20} />,
        title: 'Module Orchestration',
        description:
          'Seamlessly flow data between IRIS modules (MES, QMS, CMMS, APS) and Consultify initiatives.',
      },
    ],
    highlights: [
      { value: '17', label: 'IRIS modules supported' },
      { value: 'Real-time', label: 'Data synchronization' },
      { value: 'SOC 2', label: 'Compliance ready' },
    ],
    imageUrl: IRIS_IMAGE,
    imageAlt: 'Industrial automation and manufacturing technology',
    gradient: 'from-purple-600/20 via-violet-600/10 to-fuchsia-600/5',
    accentColor: 'purple',
    ctaText: 'Get notified when it launches',
  },
  marketplace: {
    title: 'MCP Marketplace',
    badge: 'Coming Soon',
    headline: 'Automate machine procurement and implementation delivery',
    description:
      'The MCP Marketplace connects your transformation initiatives directly to a curated ecosystem of industrial automation vendors. From identifying the right machines and integrators to managing procurement workflows — automate the entire path from strategic decision to factory-floor implementation.',
    features: [
      {
        icon: <ShoppingCart size={20} />,
        title: 'Smart Procurement',
        description:
          'AI-matched vendor recommendations based on your specific requirements, budget, and implementation timeline.',
      },
      {
        icon: <Handshake size={20} />,
        title: 'Vendor Ecosystem',
        description:
          'Access a curated network of manufacturers, system integrators, and technology providers — all vetted and rated.',
      },
      {
        icon: <Zap size={20} />,
        title: 'Implementation Automation',
        description:
          'From RFQ to deployment — automated workflows for ordering, scheduling, and tracking equipment delivery.',
      },
      {
        icon: <Globe size={20} />,
        title: 'Transparent Collaboration',
        description:
          'Shared project spaces with vendors, real-time status tracking, and integrated communication channels.',
      },
    ],
    highlights: [
      { value: '200+', label: 'Verified vendors' },
      { value: '60%', label: 'Faster procurement' },
      { value: 'End-to-end', label: 'Implementation tracking' },
    ],
    imageUrl: MARKETPLACE_IMAGE,
    imageAlt: 'Industrial automation robotics and machinery',
    gradient: 'from-emerald-600/20 via-teal-600/10 to-cyan-600/5',
    accentColor: 'emerald',
    ctaText: 'Get notified when it launches',
  },
};

function resolveModuleKey(pathname: string): ModuleKey {
  if (pathname.includes('marketplace')) return 'marketplace';
  if (pathname.includes('mcp') || pathname.includes('iris')) return 'iris';
  if (pathname.includes('meeting')) return 'meeting';
  return 'iris';
}

const accentMap: Record<string, { badge: string; icon: string; highlight: string; button: string }> = {
  blue: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: 'text-blue-400',
    highlight: 'from-blue-500/10 to-blue-600/5 border-blue-500/10',
    button: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: 'text-purple-400',
    highlight: 'from-purple-500/10 to-purple-600/5 border-purple-500/10',
    button: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: 'text-emerald-400',
    highlight: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/10',
    button: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export const V4ComingSoonView: React.FC = () => {
  const location = useLocation();
  const moduleKey = resolveModuleKey(location.pathname);
  const copy = copyByModule[moduleKey];
  const accent = accentMap[copy.accentColor];

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Hero Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${copy.gradient} pointer-events-none`} />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left: Content */}
            <div className="p-8 lg:p-10 flex flex-col justify-center">
              <motion.div variants={fadeUp} custom={0}>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${accent.badge}`}
                >
                  <Sparkles size={12} />
                  {copy.badge}
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="mt-4 text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white leading-tight"
              >
                {copy.title}
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-2 text-lg text-slate-600 dark:text-slate-300 font-medium"
              >
                {copy.headline}
              </motion.p>

              <motion.p
                variants={fadeUp}
                custom={3}
                className="mt-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
              >
                {copy.description}
              </motion.p>

              {/* Highlights */}
              <motion.div variants={fadeUp} custom={4} className="mt-6 flex gap-6">
                {copy.highlights.map((h) => (
                  <div key={h.label}>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{h.value}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{h.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Image */}
            <motion.div
              variants={fadeUp}
              custom={2}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/80 dark:to-navy-900/80 z-10 pointer-events-none" />
              <img
                src={copy.imageUrl}
                alt={copy.imageAlt}
                className="w-full h-full object-cover min-h-[360px]"
                loading="lazy"
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {copy.features.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              custom={i + 5}
              className="group rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6 hover:border-slate-300 dark:hover:border-navy-600 transition-all duration-200 hover:shadow-sm"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${accent.highlight} border`}
              >
                <span className={accent.icon}>{feature.icon}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={10}
          className="mt-6 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              This module is under active development
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your current subscription will include full access when it launches. We'll notify you as soon
              as it's ready.
            </p>
          </div>
          <button
            className={`shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${accent.button}`}
          >
            <Sparkles size={14} />
            {copy.ctaText}
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default V4ComingSoonView;
