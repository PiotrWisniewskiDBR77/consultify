import { ArrowRight } from 'lucide-react';
import React from 'react';

import type { OnboardingPersona, PersonaConfidence } from '@/services/onboarding/personaInference';

const PERSONA_OPTIONS: OnboardingPersona[] = [
  'Partner',
  'CFO',
  'CEO',
  'COO',
  'CISO',
  'Transformation Officer',
];

export function PersonaPicker({
  selectedPersona,
  inferredPersona,
  confidence,
  onSelect,
  onConfirm,
}: {
  selectedPersona: OnboardingPersona | null;
  inferredPersona: OnboardingPersona | null;
  confidence: PersonaConfidence;
  onSelect: (persona: OnboardingPersona) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-navy-700 dark:bg-navy-800">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
        Persona capture
      </div>
      <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
        Choose the onboarding path that matches you best
      </h1>
      <p className="text-slate-600 dark:text-slate-300">
        We use this to tailor the first artifact, connector order, review language, and KPI target
        for your first five minutes.
      </p>
      {inferredPersona ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Suggested path:{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {inferredPersona}
          </span>{' '}
          ({confidence} confidence)
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PERSONA_OPTIONS.map((persona) => {
          const active = selectedPersona === persona;
          return (
            <button
              key={persona}
              onClick={() => onSelect(persona)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-violet-500 bg-violet-50 shadow-sm dark:border-violet-400 dark:bg-violet-900/20'
                  : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-white dark:border-navy-700 dark:bg-navy-900 dark:hover:border-violet-500/40'
              }`}
            >
              <div className="text-base font-semibold text-slate-900 dark:text-white">
                {persona}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {persona === 'Partner' && 'Client-share artifact first.'}
                {persona === 'CFO' && 'Memo and spreadsheet first.'}
                {persona === 'CEO' && 'Decision-ready narrative first.'}
                {persona === 'COO' && 'Execution and ownership clarity first.'}
                {persona === 'CISO' && 'Policy and evidence posture first.'}
                {persona === 'Transformation Officer' && 'Transformation playbook first.'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onConfirm}
          disabled={!selectedPersona}
          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue with this path
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default PersonaPicker;
