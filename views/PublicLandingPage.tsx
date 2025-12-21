import React from 'react';
import { ArrowRight, Shield, Zap, Target, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * PublicLandingPage — Phase A: Pre-Entry
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-A1: Category Clarity Before Any Product Claim
 * - EPIC-A2: Trust Built Through Restraint
 * - EPIC-A3: Absence of AI as a Signal of Seriousness
 */

export const PublicLandingPage: React.FC = () => {
    const navigate = useNavigate();

    const handleDemoClick = () => {
        navigate('/demo');
    };

    return (
        <div className="min-h-screen bg-navy-950 text-white selection:bg-brand-500/30 overflow-x-hidden relative">

            {/* Background Atmosphere */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('/Users/piotrwisniewski/.gemini/antigravity/brain/a7e21c72-ca2e-4e53-b2d1-783518e52c69/strategic_decisions_hero_1766348521850.png')] bg-cover bg-center opacity-[0.03] mix-blend-overlay" />
            </div>

            {/* HEADER — Minimalist */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 py-8">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3 group cursor-default">
                        <div className="h-10 px-3 rounded bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20 group-hover:shadow-brand-600/40 transition-all duration-500">
                            <span className="text-white font-bold text-sm tracking-tight">DBR77</span>
                        </div>
                        <span className="text-xl font-bold tracking-[0.2em] text-white/90 group-hover:text-white transition-colors duration-500">CONSULTIFY</span>
                    </div>
                    {/* Minimal trust indicator */}
                    <div className="hidden md:flex items-center gap-2 text-xs font-medium text-white/40 uppercase tracking-widest">
                        <Shield size={12} className="text-brand-400" />
                        Inteligentne Wsparcie Decyzji
                    </div>
                </div>
            </header>

            <main className="relative z-10 pt-32 pb-20 px-6">

                {/* HERO SECTION */}
                <section className="max-w-5xl mx-auto text-center mb-24 animate-fade-in">

                    {/* North Star Sentence */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                        Decyzje strategiczne są zbyt złożone na intuicję <br className="hidden md:block" />
                        i zbyt ważne na przypadek.
                    </h1>

                    {/* Problem Narrative — Bento Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left">

                        <div className="glass-card p-8 rounded-2xl group hover:bg-brand-600/5 transition-all duration-500 border-white/5">
                            <Layers className="text-brand-400 mb-6 group-hover:scale-110 transition-transform duration-500" size={32} />
                            <h3 className="text-xl font-semibold mb-3">Wiedza Rozproszona</h3>
                            <p className="text-white/50 leading-relaxed font-light">
                                Kluczowe informacje giną między spotkaniami, a kontekst decyzji rozpływa się w szumie codzienności.
                            </p>
                        </div>

                        <div className="glass-card p-8 rounded-2xl group hover:bg-blue-600/5 transition-all duration-500 border-white/5">
                            <Target className="text-blue-400 mb-6 group-hover:scale-110 transition-transform duration-500" size={32} />
                            <h3 className="text-xl font-semibold mb-3">Znikający Kontekst</h3>
                            <p className="text-white/50 leading-relaxed font-light">
                                Uzasadnienia ważnych wyborów znikają wraz z ludźmi, zostawiając organizację bez pamięci instytucjonalnej.
                            </p>
                        </div>

                        <div className="glass-card p-8 rounded-2xl group hover:bg-purple-600/5 transition-all duration-500 border-white/5">
                            <Zap className="text-purple-400 mb-6 group-hover:scale-110 transition-transform duration-500" size={32} />
                            <h3 className="text-xl font-semibold mb-3">Błąd Metody</h3>
                            <p className="text-white/50 leading-relaxed font-light">
                                To nie jest problem narzędzi — to problem braku struktury w procesie myślenia strategicznego.
                            </p>
                        </div>

                    </div>
                </section>

                {/* CALL TO ACTION — Invitation */}
                <section className="max-w-3xl mx-auto text-center py-20 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                    <div className="inline-block glass-panel p-2 rounded-2xl mb-12">
                        <div className="px-6 py-3 rounded-xl bg-white/5 flex items-center gap-4 text-sm font-medium text-white/60">
                            <span>Brak pośpiechu. Brak presji sprzedaży.</span>
                            <div className="w-1 h-1 rounded-full bg-brand-500" />
                            <span>Tylko merytoryka.</span>
                        </div>
                    </div>

                    <p className="text-xl md:text-2xl text-white/70 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
                        Jeśli czujesz, że Twoja organizacja potrzebuje nowej dyscypliny w podejmowaniu decyzji, zapraszamy do zapoznania się z naszą metodą.
                    </p>

                    <button
                        onClick={handleDemoClick}
                        className="
                            group relative inline-flex items-center gap-4 
                            bg-brand-600 hover:bg-brand-500 
                            text-white font-semibold text-xl 
                            px-10 py-5 rounded-2xl 
                            shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] 
                            hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)]
                            active:scale-[0.98]
                            transition-all duration-500 overflow-hidden
                        "
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <span>Poznaj Metodę DBR77</span>
                        <ArrowRight className="group-hover:translate-x-2 transition-transform duration-500" size={24} />
                    </button>

                    <div className="mt-8 text-white/30 text-xs font-medium uppercase tracking-[0.3em]">
                        Bez Formularzy • Bez Zobowiązań
                    </div>
                </section>

            </main>

            {/* FOOTER */}
            <footer className="relative z-10 py-12 px-6 border-t border-white/5 bg-navy-950/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">

                    <div className="flex items-center gap-3 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                        <div className="h-6 px-2 rounded bg-brand-600 flex items-center justify-center">
                            <span className="text-white font-bold text-[10px] tracking-tight">DBR77</span>
                        </div>
                        <span className="text-sm font-bold tracking-[0.2em] text-white">CONSULTIFY</span>
                    </div>

                    <div className="flex items-center gap-8 text-xs font-semibold text-white/30 tracking-widest uppercase">
                        <a href="/privacy" className="hover:text-brand-400 transition-colors">Prywatność</a>
                        <a href="/terms" className="hover:text-brand-400 transition-colors">Regulamin</a>
                        <a href="/ethics" className="hover:text-brand-400 transition-colors">Kodeks Etyczny</a>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">
                        <Shield size={12} className="mb-0.5" />
                        Zabezpieczone przez DBR77 Governance
                    </div>

                </div>
            </footer>

            {/* Custom Mouse Glow Effect (Decorative) */}
            <div className="fixed inset-0 pointer-events-none z-50 mix-blend-soft-light opacity-50"
                style={{
                    background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(124, 58, 237, 0.08), transparent 40%)'
                }}
            />
        </div>
    );
};

export default PublicLandingPage;
