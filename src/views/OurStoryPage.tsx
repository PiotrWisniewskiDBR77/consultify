import { motion } from 'framer-motion';
import { ArrowRight, Brain, Globe, Rocket, Star, Users } from 'lucide-react';
import React from 'react';

import { MarketingLayout } from '../components/Landing/MarketingLayout';

const timeline = [
  {
    year: '2018',
    icon: Rocket,
    color: '#7c3aed',
    title: 'The idea sparks in Toruń, Poland.',
    description:
      'Piotr Wiśniewski, a serial entrepreneur with deep roots in industrial AI, starts asking: why does world-class strategic consulting cost €500K and take 6 months? There had to be a better way.',
  },
  {
    year: '2020',
    icon: Brain,
    color: '#a855f7',
    title: 'DBR77 is born.',
    description:
      'DBR77 Robotics launches as an industrial intelligence company. First consulting engagements begin, training what would later become the LLMind dataset — 1,000+ real transformation projects.',
  },
  {
    year: '2022',
    icon: Globe,
    color: '#06b6d4',
    title: 'Harvard. Digital Pathfinder.',
    description:
      "Partnership with Harvard frameworks and the Digital Pathfinder program. The team begins formalizing the methodology that would power Consultify's AI engine.",
  },
  {
    year: '2023',
    icon: Star,
    color: '#f59e0b',
    title: 'Saudi Arabia & global expansion.',
    description:
      "DBR77 becomes a Saudi Arabia Future Factory Partner and AMPC Partner. Consultify's methodology is battle-tested across 3 continents and 20+ industries.",
  },
  {
    year: '2024',
    icon: Users,
    color: '#10b981',
    title: 'The platform comes alive.',
    description:
      'Consultify 1.0 launches with a full AI consulting workspace: strategy, financial modeling, execution management, and reporting — all in one product.',
  },
  {
    year: '2025',
    icon: ArrowRight,
    color: '#c026d3',
    title: 'Consultify.ai',
    description:
      'The domain is secured. The vision is clear: what Spotify did for music, Consultify will do for consulting. Intelligence, democratized.',
  },
];

export const OurStoryPage: React.FC = () => (
  <MarketingLayout>
    {/* Hero */}
    <section className="relative px-6 pt-20 pb-24 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828,#0A0A1F,#12082E)]" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[50%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 65%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 mb-6"
        >
          <Star size={12} className="text-amber-400" />
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Our story
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="font-black tracking-tight text-white mb-6"
          style={{ fontSize: 'clamp(36px, 5vw, 72px)', lineHeight: 1.05 }}
        >
          Where Silicon Valley meets
          <span
            className="block"
            style={{
              background: 'linear-gradient(90deg, #fbbf24, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            the real world.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
          className="text-lg text-white/50 max-w-2xl mx-auto"
        >
          Consultify wasn't built in a garage by people who'd never run a real transformation. It
          was built by people who had — and were frustrated with how broken the system was.
        </motion.p>
      </div>
    </section>

    {/* Timeline */}
    <section className="px-6 pb-24">
      <div className="max-w-3xl mx-auto relative">
        {/* Vertical line */}
        <div
          className="absolute left-[28px] top-0 bottom-0 w-px"
          style={{
            background: 'linear-gradient(to bottom, rgba(124,58,237,0.40), rgba(124,58,237,0.05))',
          }}
        />

        <div className="space-y-8">
          {timeline.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="flex gap-6"
              >
                {/* Icon */}
                <div
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center z-10"
                  style={{ background: `${item.color}18`, border: `1px solid ${item.color}35` }}
                >
                  <Icon size={20} style={{ color: item.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ background: `${item.color}18`, color: item.color }}
                    >
                      {item.year}
                    </span>
                    <h3 className="text-base font-black text-white">{item.title}</h3>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Closing statement */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 p-8 rounded-2xl text-center"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}
        >
          <p className="text-xl font-black text-white mb-3">
            "We did for consulting what Spotify did for music."
          </p>
          <p className="text-white/50 text-sm max-w-lg mx-auto">
            The world's best consulting methodology, on demand, at a fraction of the cost. For
            everyone who has a real transformation to deliver.
          </p>
          <button
            className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 0 30px -10px rgba(124,58,237,0.55)',
            }}
          >
            Join us <ArrowRight size={14} />
          </button>
        </motion.div>
      </div>
    </section>
  </MarketingLayout>
);
