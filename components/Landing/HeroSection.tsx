import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface HeroSectionProps {
    onDemoClick: () => void;
    onTrialClick: () => void;
    onLoginClick: () => void;
    onExpertClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
    onDemoClick,
    onTrialClick,
    onLoginClick,
    onExpertClick
}) => {
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const { theme } = useAppStore();
    const isDark = theme === 'dark';

    const cards = [
        {
            id: 'demo',
            title: 'Explore Demo',
            description: 'Experience a live environment with fictional, realistic data.',
            meta: 'INSTANT ACCESS',
            cta: 'Explore Demo',
            image: '/assets/landing/mode_demo_thumb.webp',
            color: 'purple',
            onClick: onDemoClick,
            className: 'lg:col-span-1 lg:row-span-1'
        },
        {
            id: 'trial',
            title: 'Start Free Trial',
            description: 'Use Consultinity on your real organization data and build your roadmap.',
            meta: 'PRIMARY PATH',
            cta: 'Start Trial',
            image: isDark ? '/assets/landing/mode_trial_thumb.webp' : '/assets/landing/mode_strategy_light.png',
            color: 'indigo',
            onClick: onTrialClick,
            primary: true,
            className: 'lg:col-span-1 lg:row-span-2'
        },
        {
            id: 'video',
            title: 'How It Works',
            description: 'Guided by Dr. Piotr Wiśniewski',
            meta: 'PRODUCT TOUR',
            cta: 'Watch Video',
            image: isDark ? '/assets/landing/hero_abstract_ai.webp' : '/assets/landing/mode_ai_light.png',
            color: 'black',
            onClick: () => setIsVideoOpen(true),
            isVideo: true,
            className: 'lg:col-span-2 lg:row-span-1'
        },
        {
            id: 'expert',
            title: 'Talk to Expert',
            description: 'Custom Enterprise transformation approach.',
            meta: 'BESPOKE HUB',
            cta: 'Talk to Expert',
            image: '/assets/landing/mode_expert_thumb.webp',
            color: 'emerald',
            onClick: onExpertClick,
            className: 'lg:col-span-1 lg:row-span-1'
        },
        {
            id: 'login',
            title: 'Log In',
            description: 'Continue your journey.',
            meta: 'RETURNING USERS',
            cta: 'Log In',
            image: '/assets/landing/mode_login_thumb.webp',
            color: 'navy',
            onClick: onLoginClick,
            className: 'lg:col-span-1 lg:row-span-1'
        }
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
                        className="text-5xl lg:text-7xl font-black text-navy-950 dark:text-white leading-[1.05] tracking-tight mb-8"
                    >
                        Think <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">Strategically</span>.<br />
                        Act Decisively.
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-lg lg:text-xl text-slate-500 dark:text-slate-400 leading-relaxed font-light"
                    >
                        The first open consulting ecosystem that teaches leaders to think like Harvard and act in real business — with AI as your cognitive partner.
                    </motion.p>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[240px]">
                    {cards.map((card, idx) => {
                        return (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: idx * 0.05 }}
                                onClick={card.onClick}
                                className={`
                                    group relative rounded-3xl overflow-hidden border border-slate-200/50 dark:border-white/5 
                                    shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer
                                    ${card.className}
                                    ${card.primary ? 'ring-2 ring-purple-600 ring-offset-4 dark:ring-offset-navy-950' : ''}
                                `}
                            >
                                {/* Background Image */}
                                <div className="absolute inset-0">
                                    <img
                                        src={card.image}
                                        alt={card.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 transition-colors" />
                                </div>

                                {/* Content Overlay */}
                                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    {card.isVideo && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
                                            <Play size={24} fill="white" className="text-white ml-1" />
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
                                            <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                                →
                                            </motion.span>
                                        </div>
                                    </div>
                                </div>

                                {/* Glowing accent for primary */}
                                {card.primary && (
                                    <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-600/10'}`} />
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Video Modal */}
            <AnimatePresence>
                {isVideoOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-navy-950/95 backdrop-blur-xl flex items-center justify-center p-6"
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
                            className="w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative"
                        >
                            <video
                                className="w-full h-full object-cover"
                                controls
                                autoPlay
                            >
                                <source src="/videos/en.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};
