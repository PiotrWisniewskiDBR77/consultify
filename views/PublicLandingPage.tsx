import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, XCircle, Play, Shield, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * PublicLandingPage — Phase A: Pre-Entry
 * 
 * Strategic cognitive gateway. NOT marketing. NOT feature list.
 * 
 * Purpose:
 * - Build understanding of problem category
 * - NOT sell functions
 * - NOT promise "AI miracles"
 * 
 * Only exit: Demo (Phase B)
 */

interface CodeValidationState {
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message?: string;
}

export const PublicLandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Anonymous session tracking
    const [sessionId] = useState(() => {
        const existing = sessionStorage.getItem('anon_session_id');
        if (existing) return existing;
        const newId = `anon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('anon_session_id', newId);
        return newId;
    });

    // Capture URL params for attribution
    useEffect(() => {
        const ref = searchParams.get('ref');
        const invite = searchParams.get('invite');
        const code = searchParams.get('code');
        const campaign = searchParams.get('utm_campaign');

        if (ref) sessionStorage.setItem('attribution_ref', ref);
        if (invite) sessionStorage.setItem('attribution_invite', invite);
        if (code) sessionStorage.setItem('attribution_code', code);
        if (campaign) sessionStorage.setItem('attribution_campaign', campaign);
    }, [searchParams]);

    // Code validation (if ?code= present)
    const [codeValidation, setCodeValidation] = useState<CodeValidationState>({ status: 'idle' });
    const inviteCode = searchParams.get('code');

    useEffect(() => {
        if (inviteCode) {
            setCodeValidation({ status: 'validating' });

            // Validate code without revealing details
            fetch(`/api/access-codes/validate/${inviteCode}`)
                .then(res => res.json())
                .then(data => {
                    if (data.valid) {
                        setCodeValidation({
                            status: 'valid',
                            message: 'Kod poprawny — po DEMO możesz go użyć'
                        });
                    } else {
                        setCodeValidation({
                            status: 'invalid',
                            message: 'Kod niepoprawny lub wygasł'
                        });
                    }
                })
                .catch(() => {
                    setCodeValidation({
                        status: 'invalid',
                        message: 'Nie można zweryfikować kodu'
                    });
                });
        }
    }, [inviteCode]);

    const handleDemoClick = () => {
        // Track conversion intent
        sessionStorage.setItem('demo_intent_ts', Date.now().toString());
        navigate('/demo');
    };

    return (
        <div className="min-h-screen bg-white dark:bg-navy-950 text-navy-900 dark:text-white">

            {/* Code Validation Banner */}
            {inviteCode && codeValidation.status !== 'idle' && (
                <div className={`
          fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium
          ${codeValidation.status === 'valid'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-b border-green-100 dark:border-green-500/20'
                        : codeValidation.status === 'invalid'
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-b border-red-100 dark:border-red-500/20'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }
        `}>
                    <div className="flex items-center justify-center gap-2">
                        {codeValidation.status === 'validating' && (
                            <span className="animate-pulse">Weryfikacja kodu...</span>
                        )}
                        {codeValidation.status === 'valid' && (
                            <>
                                <CheckCircle size={16} />
                                <span>{codeValidation.message}</span>
                            </>
                        )}
                        {codeValidation.status === 'invalid' && (
                            <>
                                <XCircle size={16} />
                                <span>{codeValidation.message}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* HERO SECTION — North Star */}
            <section className={`
        min-h-screen flex flex-col items-center justify-center px-6 text-center
        ${inviteCode && codeValidation.status !== 'idle' ? 'pt-12' : ''}
      `}>
                {/* Logo */}
                <div className="mb-12">
                    <div className="inline-flex items-center gap-3">
                        <div className="h-10 px-3 rounded bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <span className="text-white font-bold text-sm tracking-tight">DBR77</span>
                        </div>
                        <span className="text-2xl font-bold tracking-widest text-navy-900 dark:text-white">CONSULTIFY</span>
                    </div>
                </div>

                {/* North Star Sentence */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold max-w-4xl leading-tight mb-8">
                    <span className="text-navy-900 dark:text-white">Consultify uczy liderów myśleć strategicznie </span>
                    <span className="text-navy-900 dark:text-white">i działać zdecydowanie — </span>
                    <span className="text-purple-600 dark:text-purple-400">z AI jako partnerem, nie wyrocznią.</span>
                </h1>

                {/* Primary CTA */}
                <button
                    onClick={handleDemoClick}
                    className="
            group inline-flex items-center gap-3 
            bg-purple-600 hover:bg-purple-500 
            text-white font-semibold text-lg 
            px-8 py-4 rounded-lg 
            shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30
            transition-all duration-300
          "
                >
                    <span>Zobacz, jak to działa</span>
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>

                {/* Scroll indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
                    <div className="w-6 h-10 border-2 border-slate-400 rounded-full flex items-start justify-center p-2">
                        <div className="w-1 h-2 bg-slate-400 rounded-full animate-pulse" />
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS — 3 Steps */}
            <section className="py-24 px-6 bg-slate-50 dark:bg-navy-900/50">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-16 text-navy-900 dark:text-white">
                        Jak to działa
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">1</span>
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-navy-900 dark:text-white">Zrozum rzeczywistość</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">Zmierz, gdzie jesteś naprawdę</p>
                        </div>

                        {/* Step 2 */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">2</span>
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-navy-900 dark:text-white">Zdecyduj, co ważne</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">Ustal priorytety zmian</p>
                        </div>

                        {/* Step 3 */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">3</span>
                            </div>
                            <h3 className="text-lg font-semibold mb-2 text-navy-900 dark:text-white">Realizuj z dyscypliną</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm">Śledź, co zostaje zrobione</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ANTI-HYPE SECTION */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-navy-900 dark:text-white">
                        Czego NIE robimy
                    </h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 mb-12">
                        Przejrzystość buduje zaufanie
                    </p>

                    <div className="space-y-4">
                        {[
                            'To nie jest magiczna AI, która rozwiąże wszystkie problemy',
                            'System nie zarządzi Twoją firmą za Ciebie',
                            'Nie zastępujemy menedżerów ani konsultantów',
                            'Nie sprzedajemy vendorów ani rozwiązań technologicznych'
                        ].map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-navy-900/50 border border-slate-100 dark:border-white/5"
                            >
                                <X className="text-red-500 shrink-0 mt-0.5" size={20} />
                                <span className="text-slate-700 dark:text-slate-300">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* VIDEO SECTION */}
            <section className="py-24 px-6 bg-slate-50 dark:bg-navy-900/50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4 text-navy-900 dark:text-white">
                        90 sekund na zrozumienie
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-12">
                        Zobacz system jako całość, nie jako listę funkcji
                    </p>

                    {/* Video placeholder */}
                    <div className="relative aspect-video max-w-2xl mx-auto rounded-2xl bg-navy-900 dark:bg-navy-800 overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <button className="w-20 h-20 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center shadow-xl shadow-purple-500/30 transition-all hover:scale-105">
                                <Play className="text-white ml-1" size={32} />
                            </button>
                        </div>
                        <div className="absolute bottom-4 left-4 text-left">
                            <div className="text-white font-medium text-sm">Dr. Piotr Wiśniewski</div>
                            <div className="text-white/60 text-xs">Wprowadzenie do systemu</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="py-24 px-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 text-navy-900 dark:text-white">
                    Gotowy zobaczyć?
                </h2>
                <button
                    onClick={handleDemoClick}
                    className="
            group inline-flex items-center gap-3 
            bg-purple-600 hover:bg-purple-500 
            text-white font-semibold text-lg 
            px-8 py-4 rounded-lg 
            shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30
            transition-all duration-300
          "
                >
                    <span>Zobacz, jak to działa</span>
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
            </section>

            {/* FOOTER */}
            <footer className="py-12 px-6 border-t border-slate-100 dark:border-white/5">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Logo */}
                        <div className="flex items-center gap-2 opacity-60">
                            <div className="h-6 px-2 rounded bg-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-xs">DBR77</span>
                            </div>
                            <span className="text-sm font-bold tracking-wider">CONSULTIFY</span>
                        </div>

                        {/* Trust message */}
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Shield size={16} />
                            <span>No sales calls. No spam. Ever.</span>
                        </div>

                        {/* Links */}
                        <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                            <a href="/privacy" className="hover:text-slate-700 dark:hover:text-white transition-colors">Privacy</a>
                            <a href="/terms" className="hover:text-slate-700 dark:hover:text-white transition-colors">Terms</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLandingPage;
