/**
 * BrandVoicePanel
 *
 * Settings panel for managing the organization's brand voice profile.
 * Controls report tone, vocabulary, hedging rules, and compliance constraints.
 */

import { AlertTriangle, Loader2, MessageSquare, Save, Shield } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '../../../services/api';

// ==========================================
// TYPES
// ==========================================

interface BrandVoiceProfile {
  id: string;
  organizationId: string;
  registerPreferences: {
    default: 'executive' | 'professional' | 'technical' | 'narrative';
    overrides: Record<string, string>;
  };
  vocabularyPreferences: {
    preferred: string[];
    forbidden: string[];
  };
  hedgingRules: {
    requireEvidenceForRecommendations: boolean;
    allowSpeculativeLanguage: boolean;
    maxHedgingPhrases: number;
  };
  complianceMode: boolean;
  complianceRules: {
    noMarketingLanguage: boolean;
    requireSourceForClaims: boolean;
    requireNextStepForRecommendations: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface BrandVoicePanelProps {
  organizationId: string;
  isPl: boolean;
}

// ==========================================
// LABELS
// ==========================================

const LABELS = {
  en: {
    title: 'Brand Voice Profile',
    subtitle: 'Control how reports sound for your organization',
    register: 'Default Communication Register',
    registerDesc: 'Sets the overall tone for generated report content',
    registers: {
      executive: 'Executive — High-level, strategic, board-ready',
      professional: 'Professional — Balanced, clear, business-appropriate',
      technical: 'Technical — Detailed, precise, data-driven',
      narrative: 'Narrative — Storytelling, engaging, accessible',
    },
    preferredWords: 'Preferred Words & Phrases',
    preferredDesc: 'Comma-separated list of terms to favor in reports',
    forbiddenWords: 'Forbidden Words & Phrases',
    forbiddenDesc: 'Comma-separated list of terms to never use',
    hedgingTitle: 'Hedging & Evidence Rules',
    requireEvidence: 'Require evidence for recommendations',
    requireEvidenceDesc: 'Recommendations must cite supporting data',
    allowSpeculative: 'Allow speculative language',
    allowSpeculativeDesc: 'Permit "might", "possibly", "it seems" phrasing',
    maxHedging: 'Max hedging phrases per section',
    complianceTitle: 'Compliance Mode',
    complianceDesc: 'Enable stricter content governance rules',
    noMarketing: 'No marketing language',
    noMarketingDesc: 'Block superlatives and promotional phrasing',
    requireSource: 'Require source for claims',
    requireSourceDesc: 'Every factual claim must reference a data source',
    requireNextStep: 'Require next step for recommendations',
    requireNextStepDesc: 'Each recommendation must include an actionable follow-up',
    save: 'Save Changes',
    saving: 'Saving...',
    saved: 'Brand voice profile saved',
    error: 'Failed to load brand voice profile',
    saveError: 'Failed to save brand voice profile',
  },
  pl: {
    title: 'Profil Głosu Marki',
    subtitle: 'Kontroluj jak brzmią raporty Twojej organizacji',
    register: 'Domyślny rejestr komunikacji',
    registerDesc: 'Ustawia ogólny ton generowanej treści raportów',
    registers: {
      executive: 'Kierowniczy — Wysoki poziom, strategiczny, gotowy dla zarządu',
      professional: 'Profesjonalny — Wyważony, klarowny, biznesowy',
      technical: 'Techniczny — Szczegółowy, precyzyjny, oparty na danych',
      narrative: 'Narracyjny — Storytelling, angażujący, przystępny',
    },
    preferredWords: 'Preferowane słowa i frazy',
    preferredDesc: 'Lista rozdzielona przecinkami — terminy preferowane w raportach',
    forbiddenWords: 'Zakazane słowa i frazy',
    forbiddenDesc: 'Lista rozdzielona przecinkami — terminy do wykluczenia',
    hedgingTitle: 'Reguły ostrożności i dowodów',
    requireEvidence: 'Wymagaj dowodów dla rekomendacji',
    requireEvidenceDesc: 'Rekomendacje muszą cytować dane źródłowe',
    allowSpeculative: 'Zezwalaj na język spekulatywny',
    allowSpeculativeDesc: 'Pozwól na sformułowania typu „być może", „wydaje się"',
    maxHedging: 'Maks. fraz ostrożnościowych na sekcję',
    complianceTitle: 'Tryb zgodności',
    complianceDesc: 'Włącz bardziej rygorystyczne zasady treści',
    noMarketing: 'Bez języka marketingowego',
    noMarketingDesc: 'Blokuj superlatywy i frazy promocyjne',
    requireSource: 'Wymagaj źródła dla twierdzeń',
    requireSourceDesc: 'Każde twierdzenie musi zawierać odniesienie do danych',
    requireNextStep: 'Wymagaj następnego kroku dla rekomendacji',
    requireNextStepDesc: 'Każda rekomendacja musi zawierać konkretne działanie',
    save: 'Zapisz zmiany',
    saving: 'Zapisywanie...',
    saved: 'Profil głosu marki zapisany',
    error: 'Nie udało się wczytać profilu głosu marki',
    saveError: 'Nie udało się zapisać profilu głosu marki',
  },
} as const;

const REGISTER_OPTIONS = ['executive', 'professional', 'technical', 'narrative'] as const;

// ==========================================
// COMPONENT
// ==========================================

export const BrandVoicePanel: React.FC<BrandVoicePanelProps> = ({ organizationId, isPl }) => {
  const t = isPl ? LABELS.pl : LABELS.en;

  const [profile, setProfile] = useState<BrandVoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [register, setRegister] =
    useState<BrandVoiceProfile['registerPreferences']['default']>('professional');
  const [preferredWords, setPreferredWords] = useState('');
  const [forbiddenWords, setForbiddenWords] = useState('');
  const [requireEvidence, setRequireEvidence] = useState(true);
  const [allowSpeculative, setAllowSpeculative] = useState(false);
  const [maxHedging, setMaxHedging] = useState(3);
  const [complianceMode, setComplianceMode] = useState(false);
  const [noMarketing, setNoMarketing] = useState(false);
  const [requireSource, setRequireSource] = useState(false);
  const [requireNextStep, setRequireNextStep] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await Api.get('/report-builder/brand-voice');
      const p: BrandVoiceProfile = (res as any).profile;
      setProfile(p);
      setRegister(p.registerPreferences.default);
      setPreferredWords(p.vocabularyPreferences.preferred.join(', '));
      setForbiddenWords(p.vocabularyPreferences.forbidden.join(', '));
      setRequireEvidence(p.hedgingRules.requireEvidenceForRecommendations);
      setAllowSpeculative(p.hedgingRules.allowSpeculativeLanguage);
      setMaxHedging(p.hedgingRules.maxHedgingPhrases);
      setComplianceMode(p.complianceMode);
      setNoMarketing(p.complianceRules.noMarketingLanguage);
      setRequireSource(p.complianceRules.requireSourceForClaims);
      setRequireNextStep(p.complianceRules.requireNextStepForRecommendations);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      setError(null);

      const splitWords = (s: string) =>
        s
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);

      const updates: Partial<BrandVoiceProfile> = {
        registerPreferences: {
          default: register,
          overrides: profile?.registerPreferences.overrides ?? {},
        },
        vocabularyPreferences: {
          preferred: splitWords(preferredWords),
          forbidden: splitWords(forbiddenWords),
        },
        hedgingRules: {
          requireEvidenceForRecommendations: requireEvidence,
          allowSpeculativeLanguage: allowSpeculative,
          maxHedgingPhrases: maxHedging,
        },
        complianceMode,
        complianceRules: {
          noMarketingLanguage: noMarketing,
          requireSourceForClaims: requireSource,
          requireNextStepForRecommendations: requireNextStep,
        },
      };

      const res = await Api.put('/report-builder/brand-voice', updates);
      setProfile((res as any).profile);
      setSaveMessage(t.saved);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-c-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-c-accent-soft0 p-2.5">
          <MessageSquare className="h-5 w-5 text-c-accent" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-c-text">{t.title}</h3>
          <p className="mt-0.5 text-sm text-c-text-secondary">{t.subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          <Shield className="h-4 w-4 flex-shrink-0" />
          {saveMessage}
        </div>
      )}

      {/* Register Selector */}
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <label className="mb-1 block text-sm font-medium text-c-text">
          {t.register}
        </label>
        <p className="mb-3 text-xs text-c-text-secondary">{t.registerDesc}</p>
        <div className="space-y-2">
          {REGISTER_OPTIONS.map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                register === opt
                  ? 'border-c-accent bg-c-accent-soft'
                  : 'border-c-border-subtle hover:border-c-border'
              }`}
            >
              <input
                type="radio"
                name="register"
                value={opt}
                checked={register === opt}
                onChange={() => setRegister(opt)}
                className="accent-c-accent"
              />
              <span className="text-sm text-c-text">{t.registers[opt]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vocabulary */}
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-c-text">
              {t.preferredWords}
            </label>
            <p className="mb-2 text-xs text-c-text-secondary">{t.preferredDesc}</p>
            <textarea
              value={preferredWords}
              onChange={(e) => setPreferredWords(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus:border-c-accent focus:outline-none focus:ring-1 focus:ring-c-focus"
              placeholder={
                isPl
                  ? 'np. transformacja, optymalizacja, strategia'
                  : 'e.g. transformation, optimization, strategy'
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-c-text">
              {t.forbiddenWords}
            </label>
            <p className="mb-2 text-xs text-c-text-secondary">{t.forbiddenDesc}</p>
            <textarea
              value={forbiddenWords}
              onChange={(e) => setForbiddenWords(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus:border-c-accent focus:outline-none focus:ring-1 focus:ring-c-focus"
              placeholder={
                isPl
                  ? 'np. synergia, holistyczny, game-changer'
                  : 'e.g. synergy, holistic, game-changer'
              }
            />
          </div>
        </div>
      </div>

      {/* Hedging Rules */}
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <h4 className="mb-3 text-sm font-medium text-c-text">{t.hedgingTitle}</h4>
        <div className="space-y-3">
          <ToggleRow
            label={t.requireEvidence}
            description={t.requireEvidenceDesc}
            checked={requireEvidence}
            onChange={setRequireEvidence}
          />
          <ToggleRow
            label={t.allowSpeculative}
            description={t.allowSpeculativeDesc}
            checked={allowSpeculative}
            onChange={setAllowSpeculative}
          />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-c-text">{t.maxHedging}</span>
            </div>
            <input
              type="number"
              min={0}
              max={20}
              value={maxHedging}
              onChange={(e) => setMaxHedging(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 rounded-lg border border-c-border bg-c-surface px-3 py-1.5 text-center text-sm text-c-text focus:border-c-accent focus:outline-none focus:ring-1 focus:ring-c-focus"
            />
          </div>
        </div>
      </div>

      {/* Compliance Mode */}
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-medium text-c-text">{t.complianceTitle}</h4>
        </div>
        <div className="space-y-3">
          <ToggleRow
            label={t.complianceTitle}
            description={t.complianceDesc}
            checked={complianceMode}
            onChange={setComplianceMode}
          />
          {complianceMode && (
            <div className="ml-2 space-y-3 border-l-2 border-amber-300 pl-4 dark:border-amber-600">
              <ToggleRow
                label={t.noMarketing}
                description={t.noMarketingDesc}
                checked={noMarketing}
                onChange={setNoMarketing}
              />
              <ToggleRow
                label={t.requireSource}
                description={t.requireSourceDesc}
                checked={requireSource}
                onChange={setRequireSource}
              />
              <ToggleRow
                label={t.requireNextStep}
                description={t.requireNextStepDesc}
                checked={requireNextStep}
                onChange={setRequireNextStep}
              />
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-c-accent-soft px-4 py-2.5 text-sm font-medium text-c-text transition-colors hover:bg-c-accent-soft disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.saving}
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            {t.save}
          </>
        )}
      </button>
    </div>
  );
};

// ==========================================
// TOGGLE ROW SUB-COMPONENT
// ==========================================

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <span className="block text-sm text-c-text">{label}</span>
      <span className="block text-xs text-c-text-secondary">{description}</span>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
        checked ? 'bg-c-surface' : 'bg-c-border'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 transform rounded-full bg-c-surface shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export default BrandVoicePanel;
