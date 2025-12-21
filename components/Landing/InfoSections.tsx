import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ShieldCheck, Cpu, BarChart3, Users, Zap } from 'lucide-react';

export const InfoSections: React.FC = () => {
    const steps = [
        {
            icon: Cpu,
            title: 'Diagnostic AI',
            desc: 'Map your maturity through the DRD model and identify critical gaps instantly.'
        },
        {
            icon: BarChart3,
            title: 'Strategic Roadmap',
            desc: 'AI generates a tailored execution plan with clear ROI and timeframes.'
        },
        {
            icon: Users,
            title: 'Human Approval',
            desc: 'Every AI decision is approved by your leaders to ensure accountability.'
        }
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
                            className="text-xs font-black text-purple-600 uppercase tracking-[0.3em] mb-6"
                        >
                            The Methodology
                        </motion.h2>
                        <h3 className="text-4xl lg:text-5xl font-black text-navy-950 dark:text-white tracking-tight">
                            How AI Becomes Your <span className="italic font-serif">Cognitive Partner</span>.
                        </h3>
                    </div>

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
                                    <div className="w-20 h-20 bg-white dark:bg-navy-900 rounded-3xl flex items-center justify-center border border-slate-200 dark:border-white/5 shadow-premium group-hover:shadow-glow transition-all duration-500 text-navy-950 dark:text-white">
                                        <Icon size={36} strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-2xl font-black text-navy-950 dark:text-white tracking-tight">{step.title}</h4>
                                        <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed font-medium">
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
                <div className="max-w-6xl mx-auto bg-navy-950 rounded-[4rem] p-12 lg:p-24 relative overflow-hidden border border-white/10 shadow-3xl">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[100px] -ml-20 -mb-20" />

                    <div className="relative z-10 grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-white uppercase tracking-[0.2em]">
                                <ShieldCheck size={16} className="text-emerald-400" />
                                Enterprise Integrity
                            </div>
                            <h3 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight">
                                Intelligence Guided by <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Human Approval</span>.
                            </h3>
                            <p className="text-lg text-slate-400 leading-relaxed font-medium">
                                AI is a partner, not an authority. Consultinity implements a strict governance layer where every strategic move requires high-level human validation.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    'Full accountability for every roadmap item',
                                    'Multi-tenant data isolation & military-grade security',
                                    'SOC2 compliant infrastructure logic'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-4 text-base font-bold text-slate-200">
                                        <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center">
                                            <CheckCircle size={16} className="text-purple-400" />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            <div className="pt-4">
                                <button className="px-8 py-4 bg-white text-navy-950 rounded-full text-sm font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl shadow-white/5 active:scale-95">
                                    View Security Whitepaper
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            {/* Glassmorphism Logic Visualization */}
                            <div className="aspect-[4/5] bg-white/5 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/10 p-10 flex flex-col justify-between group overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="space-y-8">
                                    <div className="flex justify-between items-center">
                                        <div className="h-6 w-32 bg-white/20 rounded-full" />
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                            <Zap size={20} className="text-purple-400" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                animate={{ x: ['100%', '-100%'] }}
                                                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                                                className="w-1/2 h-full bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                                            />
                                        </div>
                                        <div className="h-3 w-3/4 bg-white/10 rounded-full" />
                                        <div className="h-3 w-1/2 bg-white/10 rounded-full" />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="w-12 h-12 rounded-full border-4 border-navy-950 bg-slate-800 flex items-center justify-center overflow-hidden">
                                                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Awaiting Validation</span>
                                        <div className="px-6 py-3 bg-emerald-500 text-navy-950 text-[10px] font-black uppercase rounded-2xl shadow-lg shadow-emerald-500/20">Approved</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
