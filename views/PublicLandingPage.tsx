import React from 'react';
import { ArrowRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * PublicLandingPage — Phase A: Pre-Entry
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-A1: Category Clarity Before Any Product Claim
 * - EPIC-A2: Trust Built Through Restraint
 * - EPIC-A3: Absence of AI as a Signal of Seriousness
 * 
 * RULES:
 * - Single CTA only
 * - No forms, no feature lists
 * - No AI language, no efficiency promises
 * - Problem framing, not product framing
 * 
 * EXIT: Demo (Phase B) via single CTA
 */

export const PublicLandingPage: React.FC = () => {
    const navigate = useNavigate();

    const handleDemoClick = () => {
        navigate('/demo');
    };

    return (
        <div className="min-h-screen bg-white dark:bg-navy-950 text-navy-900 dark:text-white">

            {/* HERO SECTION — North Star Statement */}
            <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">

                {/* Logo — Minimal */}
                <div className="mb-16">
                    <div className="inline-flex items-center gap-3">
                        <div className="h-10 px-3 rounded bg-purple-600 flex items-center justify-center">
                            <span className="text-white font-bold text-sm tracking-tight">DBR77</span>
                        </div>
                        <span className="text-2xl font-bold tracking-widest text-navy-900 dark:text-white">CONSULTIFY</span>
                    </div>
                </div>

                {/* North Star Sentence — Category Definition */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold max-w-3xl leading-tight mb-6">
                    Decyzje strategiczne są zbyt złożone na intuicję <br className="hidden md:block" />
                    i zbyt ważne na przypadek.
                </h1>

                {/* Problem Narrative — Max 50 words */}
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mb-12 leading-relaxed">
                    W organizacjach wiedza o decyzjach jest rozproszona, kontekst ginie między spotkaniami,
                    a uzasadnienia ważnych wyborów znikają wraz z ludźmi.
                    To nie problem narzędzi — to problem myślenia.
                </p>

                {/* Single CTA — Invitation, not funnel */}
                <button
                    onClick={handleDemoClick}
                    className="
                        group inline-flex items-center gap-3 
                        bg-purple-600 hover:bg-purple-500 
                        text-white font-semibold text-lg 
                        px-8 py-4 rounded-lg 
                        shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30
                        transition-all duration-300
                    "
                >
                    <span>Zobacz, jak to działa</span>
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>

            </section>

            {/* FOOTER — Minimal, Trust-focused */}
            <footer className="py-8 px-6 border-t border-slate-100 dark:border-white/5">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                        {/* Logo — Subtle */}
                        <div className="flex items-center gap-2 opacity-50">
                            <div className="h-5 px-2 rounded bg-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-xs">DBR77</span>
                            </div>
                            <span className="text-xs font-bold tracking-wider">CONSULTIFY</span>
                        </div>

                        {/* Trust message — No sales promise */}
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Shield size={14} />
                            <span>Bez formularzy. Bez cold call. Bez sztuczek.</span>
                        </div>

                        {/* Legal links */}
                        <div className="flex items-center gap-6 text-xs text-slate-400 dark:text-slate-500">
                            <a href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Prywatność</a>
                            <a href="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Regulamin</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLandingPage;
