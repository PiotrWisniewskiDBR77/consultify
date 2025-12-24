import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    Link as LinkIcon,
    Copy,
    Plus,
    Users,
    Target,
    Zap,
    Shield,
    ExternalLink,
    CheckCircle2,
    Clock as ClockIcon,
    Share2,
    LayoutGrid
} from 'lucide-react';
import { Api } from '../services/api';
import { toast } from 'react-hot-toast';

/**
 * AffiliateDashboardView — Phase G: Ecosystem Participation
 * 
 * Strategic Intent:
 * - Empower "Ecosystem Nodes" to spread the method.
 * - Value-driven growth tracking.
 * - Social proof of method adoption.
 */

export const AffiliateDashboardView: React.FC = () => {
    const [referrals, setReferrals] = useState<{ id: string; code: string; use_count: number; conversions?: number; expires_at?: string; }[]>([]);
    const [stats, setStats] = useState<{ totalReferrals: number; totalConversions: number; } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [referralsRes, statsRes] = await Promise.all([
                Api.getUserReferrals(),
                Api.getEcosystemStats() // This might be limited to user's own impact if backend allows
            ]);

            if (referralsRes.success) setReferrals(referralsRes.referrals);
            // statsRes might be restricted if not admin, but we'll try to show what's available
            if (statsRes.success) setStats(statsRes.stats);
        } catch (error) {
            console.error('Failed to fetch affiliate data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateCode = async () => {
        setIsGenerating(true);
        try {
            const res = await Api.generateReferralCode();
            if (res.success) {
                toast.success('Nowy kod polecający został wygenerowany');
                fetchData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Błąd generowania kodu');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Skopiowano do schowka');
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-navy-950">
                <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-navy-950 overflow-auto">

            {/* Header Section */}
            <div className="px-6 py-8 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 text-brand-500 font-bold text-xs uppercase tracking-widest mb-2">
                            <Shield size={14} />
                            Status: Ecosystem Node
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Ecosystem Impact</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Gospodarz metody w swojej sieci kontaktów.</p>
                    </div>

                    <button
                        onClick={handleGenerateCode}
                        disabled={isGenerating}
                        className="
                            bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl 
                            shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all active:scale-95
                            disabled:opacity-50 disabled:cursor-not-allowed
                        "
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Plus size={20} />
                        )}
                        Generuj Kod Polecający
                    </button>
                </div>
            </div>

            <div className="px-6 py-8">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Metrics Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Share2 size={20} /></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aktywne Kody</span>
                            </div>
                            <div>
                                <div className="text-3xl font-bold">{referrals.length}</div>
                                <div className="text-xs text-slate-500 mt-1">Dostępnych zaproszeń</div>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500"><Users size={20} /></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Użycia</span>
                            </div>
                            <div>
                                <div className="text-3xl font-bold">
                                    {referrals.reduce((acc, curr) => acc + curr.use_count, 0)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Wejścia do systemu</div>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><CheckCircle2 size={20} /></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konwersje</span>
                            </div>
                            <div>
                                <div className="text-3xl font-bold">
                                    {referrals.reduce((acc, curr) => acc + (curr.conversions || 0), 0)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Projekty Trial / Org</div>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={80} /></div>
                            <div className="flex items-center justify-between mb-4 relative">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><TrendingUp size={20} /></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wskaźnik Wpływu</span>
                            </div>
                            <div className="relative">
                                <div className="text-3xl font-bold">
                                    {referrals.length > 0 ? (referrals.reduce((acc, curr) => acc + (curr.conversions || 0), 0) / referrals.length).toFixed(1) : 0}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Wpływ na wzrost metody</div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Referral List */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <LinkIcon size={18} className="text-brand-500" />
                                    Twoje kody polecające
                                </h2>
                            </div>

                            <div className="space-y-3">
                                {referrals.map((ref) => (
                                    <div key={ref.id} className="glass-card p-5 rounded-2xl flex items-center justify-between group hover:border-brand-500/30 transition-all border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 font-mono font-bold text-lg tracking-widest text-brand-600 dark:text-brand-400">
                                                {ref.code}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold flex items-center gap-2">
                                                    Wygasa: {ref.expires_at ? new Date(ref.expires_at).toLocaleDateString() : 'Nigdy'}
                                                    {ref.expires_at && new Date(ref.expires_at) < new Date() && <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">Wygasł</span>}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1"><Users size={12} /> {ref.use_count} użyć</span>
                                                    <span className="flex items-center gap-1"><Target size={12} /> {ref.conversions || 0} konwersji</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => copyToClipboard(ref.code)}
                                                className="p-2 rounded-lg hover:bg-brand-500/10 text-slate-400 hover:text-brand-500 transition-all"
                                                title="Kopiuj kod"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button className="p-2 rounded-lg hover:bg-brand-500/10 text-slate-400 hover:text-brand-500 transition-all" title="Udostępnij">
                                                <Share2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {referrals.length === 0 && (
                                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                        <div className="p-4 rounded-full bg-slate-100 dark:bg-white/5 inline-block mb-4">
                                            <TrendingUp size={32} className="text-slate-400" />
                                        </div>
                                        <h3 className="font-bold">Brak wygenerowanych kodów</h3>
                                        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Zacznij zapraszać liderów strategicznych, aby budować ekosystem.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stats & Growth Wall */}
                        <div className="space-y-6">
                            <div className="glass-panel p-6 rounded-3xl space-y-6 border-white/5 shadow-xl">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <TrendingUp size={18} className="text-brand-500" />
                                    Twoja Rola w Ekosystemie
                                </h3>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/10">
                                        <div className="text-xs font-bold text-brand-500 uppercase tracking-widest mb-1">Strategia Wzrostu</div>
                                        <p className="text-sm leading-relaxed opacity-80">
                                            Jesteś certyfikowanym Node'em ekosystemu. Twoje polecenia są traktowane jako filtr jakościowy rynku.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                                            <span>Moc Polecenia</span>
                                            <span>{referrals.length > 0 ? (referrals.reduce((acc, curr) => acc + (curr.conversions || 0), 0) / referrals.length * 10).toFixed(0) : 0}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${referrals.length > 0 ? (referrals.reduce((acc, curr) => acc + (curr.conversions || 0), 0) / referrals.length * 100) : 0}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-tight">
                                            Ten wskaźnik pokazuje jak trafnie wybierasz osoby do ekosystemu.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5">
                                    <button className="w-full flex items-center justify-between text-sm font-bold hover:text-brand-500 transition-colors group">
                                        <span>Zasoby dla Polecających</span>
                                        <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>

                            {/* Global Snapshot Briefing */}
                            <div className="p-6 rounded-3xl bg-brand-600 text-white space-y-4 shadow-xl shadow-brand-600/20">
                                <div className="flex items-center gap-2 opacity-60 text-xs font-bold uppercase tracking-widest">
                                    <LayoutGrid size={14} />
                                    Global Network Context
                                </div>
                                <p className="text-sm font-light leading-relaxed">
                                    Metoda DBR77 rośnie w tempie 12% MoM. Największy wzrost odnotowano w sektorze technologicznym i produkcyjnym.
                                </p>
                                <div className="flex gap-4 pt-2">
                                    <div className="text-xs">
                                        <div className="font-bold">4.2k</div>
                                        <div className="opacity-50">Decyzji/Dzień</div>
                                    </div>
                                    <div className="text-xs">
                                        <div className="font-bold">128</div>
                                        <div className="opacity-50">Node'ów</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AffiliateDashboardView;
