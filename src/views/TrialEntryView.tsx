import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Lock,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { readAnnaLpCtaContext, updateAnnaLpCtaContext } from '@/services/annaLpCtaContext';
import { Api } from '@/services/api';
import { postPublicAnnaFunnelEvent } from '@/services/publicAnnaAnalytics';

/**
 * TrialEntryView — Phase C: Trial Entry
 *
 * Strategic Intent:
 * - High friction = High quality.
 * - Test organizational readiness.
 * - AI as regulator (Decision Partner).
 */

interface TrialEntryViewProps {
  onStartTrial: () => void;
}

export const TrialEntryView: React.FC<TrialEntryViewProps> = ({ onStartTrial }) => {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctx = readAnnaLpCtaContext();
    if (!ctx || ctx.cta_type !== 'trial') return;
    if (ctx.start_recorded_at_ms) return;

    void postPublicAnnaFunnelEvent('anna_lp.cta.start', {
      session_id: ctx.session_id,
      cta_type: ctx.cta_type,
      language: ctx.language,
      channel: ctx.channel,
      turn_id: ctx.turn_id,
      source_intent: ctx.source_intent,
    });
    updateAnnaLpCtaContext({ start_recorded_at_ms: Date.now() });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) return;

    setIsChecking(true);
    setError(null);

    const ctx = readAnnaLpCtaContext();
    if (ctx && ctx.cta_type === 'trial') {
      const nextAttempts = (ctx.submit_attempts || 0) + 1;
      void postPublicAnnaFunnelEvent('anna_lp.cta.submit_attempt', {
        session_id: ctx.session_id,
        cta_type: ctx.cta_type,
        language: ctx.language,
        channel: ctx.channel,
        turn_id: ctx.turn_id,
        source_intent: ctx.source_intent,
      });
      updateAnnaLpCtaContext({ submit_attempts: nextAttempts });
    }

    try {
      // Step 1: Validate Publicly (Privacy-preserving)
      const validation = await Api.validateAccessCode(accessCode);

      if (!validation.valid) {
        setError('Niepoprawny lub wygasły kod dostępu.');
        setIsChecking(false);

        if (ctx && ctx.cta_type === 'trial') {
          void postPublicAnnaFunnelEvent('anna_lp.cta.submit_error', {
            session_id: ctx.session_id,
            cta_type: ctx.cta_type,
            language: ctx.language,
            channel: ctx.channel,
            turn_id: ctx.turn_id,
            source_intent: ctx.source_intent,
          });
          updateAnnaLpCtaContext({ last_submit_error_at_ms: Date.now() });
        }
        return;
      }

      sessionStorage.setItem('attribution_invite', accessCode.trim().toUpperCase());
      toast.success('Dostęp zweryfikowany. Przechodzimy do rejestracji triala.');

      if (ctx && ctx.cta_type === 'trial') {
        void postPublicAnnaFunnelEvent('anna_lp.cta.submit_success', {
          session_id: ctx.session_id,
          cta_type: ctx.cta_type,
          language: ctx.language,
          channel: ctx.channel,
          turn_id: ctx.turn_id,
          source_intent: ctx.source_intent,
        });
        updateAnnaLpCtaContext({ submit_success_at_ms: Date.now() });
      }
      onStartTrial();
    } catch (err: any) {
      console.error('Access code validation failed:', err);
      setError('System weryfikacji jest chwilowo niedostępny. Spróbuj później.');
      setIsChecking(false);

      if (ctx && ctx.cta_type === 'trial') {
        void postPublicAnnaFunnelEvent('anna_lp.cta.submit_error', {
          session_id: ctx.session_id,
          cta_type: ctx.cta_type,
          language: ctx.language,
          channel: ctx.channel,
          turn_id: ctx.turn_id,
          source_intent: ctx.source_intent,
        });
        updateAnnaLpCtaContext({ last_submit_error_at_ms: Date.now() });
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 text-navy-900 dark:text-white flex flex-col md:flex-row">
      {/* Sidebar — The AI Regulator Narrative */}
      <div className="w-full md:w-1/3 bg-slate-50 dark:bg-navy-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-navy-700 p-8 md:p-12 flex flex-col">
        <div className="space-y-4 mb-12">
          <button
            type="button"
            onClick={() => navigate(ROUTES.WELCOME)}
            className="flex items-center gap-3 group"
          >
            <img
              src="/assets/logos/logo-light.svg?v=20260319"
              alt="Consultify"
              className="h-7 w-auto dark:hidden"
            />
            <img
              src="/assets/logos/logo-dark.svg?v=20260319"
              alt="Consultify"
              className="hidden h-7 w-auto dark:block"
            />
            <span className="text-sm font-bold tracking-widest text-navy-900 dark:text-white opacity-40 uppercase">
              Partner Decyzyjny
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.WELCOME)}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Wróć na stronę główną
          </button>
        </div>

        <div className="flex-1 space-y-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-brand-500 font-bold text-xs uppercase tracking-widest">
              <MessageSquare size={14} />
              Status: Selektywny Dostęp
            </div>
            <h2 className="text-2xl font-bold leading-tight">
              To nie jest kolejny program "Free Trial".
            </h2>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-light">
              Metoda DBR77 wymaga dyscypliny i zaangażowania. Wchodząc w etap Trial, zaczynasz pracę
              nad realną strukturą swojej organizacji.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-brand-500 mt-1 shrink-0" size={18} />
              <div>
                <h4 className="font-semibold text-sm">Weryfikacja Gotowości</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  AI pomoże Ci ocenić, czy Twoja organizacja jest gotowa na zmianę strategiczną.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-brand-500 mt-1 shrink-0" size={18} />
              <div>
                <h4 className="font-semibold text-sm">Praca na Kontekście</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Dostęp do modułów pozwalających na zdefiniowanie osi strategicznych firmy.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-brand-500 mt-1 shrink-0" size={18} />
              <div>
                <h4 className="font-semibold text-sm">Brak Zobowiązań Finansowych</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Liczymy na Twój czas i intelekt, a nie na kartę kredytową na tym etapie.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-12 border-t border-slate-200 dark:border-navy-700 opacity-40">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
            <ShieldCheck size={14} />
            DBR77 Trust Layer Enforced
          </div>
        </div>
      </div>

      {/* Main Content — Access Code Entry */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 bg-white dark:bg-navy-950">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center md:text-left space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">Aktywuj dostęp</h1>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Wprowadź kod otrzymany od konsultanta lub z systemu poleceń, aby rozpocząć proces
              walidacji.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600 dark:text-slate-500 group-focus-within:text-brand-500 transition-colors">
                <Lock size={20} />
              </div>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="WPROWADŹ KOD (np. REF-1234)"
                className="
                                    w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700
                                    rounded-xl py-4 pl-12 pr-4 text-center font-mono tracking-[0.3em] font-bold
                                    focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none
                                    transition-all duration-300 placeholder:text-slate-400 dark:text-slate-500 dark:placeholder:text-white/10
                                    placeholder:tracking-normal placeholder:font-sans placeholder:font-normal
                                "
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-danger-500 text-sm font-medium bg-danger-50 dark:bg-danger-500/10 p-3 rounded-lg border border-danger-100 dark:border-danger-500/20">
                <Info size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!accessCode || isChecking}
              className="
                                w-full group relative inline-flex items-center justify-center gap-3
                                bg-navy-900 dark:bg-white text-white dark:text-navy-900 font-bold text-lg
                                py-4 rounded-xl transition-all duration-300
                                hover:bg-brand-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed
                            "
            >
              {isChecking ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Weryfikacja...
                </span>
              ) : (
                <>
                  <span>Kontynuuj do walidacji</span>
                  <ArrowRight
                    className="group-hover:translate-x-1 transition-transform"
                    size={20}
                  />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TrialEntryView;
