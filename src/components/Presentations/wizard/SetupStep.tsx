import { ArrowLeft, ChevronDown, ChevronUp, Layout, Sparkles, Wand2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ColorSetGallery } from './ColorSetGallery';
import { ImageStyleSelector } from './ImageStyleSelector';
import { PresentationModeSelector } from './PresentationModeSelector';
import {
  CARD_SIZES,
  COMMUNICATION_REGISTERS,
  CONTENT_DEPTHS,
  type DeckTemplate,
  IMAGE_SOURCES,
  type WizardSettings,
} from './types';

interface SetupStepProps {
  settings: WizardSettings;
  onChange: <K extends keyof WizardSettings>(key: K, value: WizardSettings[K]) => void;
  templates: DeckTemplate[];
  brandKitColors?: { primary: string; secondary: string; accent: string } | null;
  onBack: () => void;
  onNext: () => void;
}

const AUDIENCES = ['executive', 'board', 'project_team', 'client', 'investor'] as const;
const GOALS = ['inform', 'decide', 'sell', 'align', 'educate'] as const;
const CONFIDENTIALITIES = ['confidential', 'internal', 'public'] as const;

export const SetupStep: React.FC<SetupStepProps> = ({
  settings,
  onChange,
  templates: templatesProp,
  brandKitColors,
  onBack,
  onNext,
}) => {
  const templates = Array.isArray(templatesProp) ? templatesProp : [];
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smartDefaultsApplied, setSmartDefaultsApplied] = useState(false);
  const [smartDefaultsLoading, setSmartDefaultsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchSmartDefaults = async () => {
      setSmartDefaultsLoading(true);
      try {
        const response = await fetch('/api/presentations/style-profile', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok || cancelled) return;
        const raw = await response.json();
        if (cancelled || !raw) return;
        const profile = raw?.data ?? raw;

        if (profile.preferred_mode) onChange('presentationMode', profile.preferred_mode as any);
        if (profile.preferred_register)
          onChange('communicationRegister', profile.preferred_register as any);
        if (profile.preferred_image_style)
          onChange('imageStylePreset', profile.preferred_image_style as any);
        if (profile.preferred_color_set) onChange('colorSetId', profile.preferred_color_set);
        if (profile.preferred_content_depth)
          onChange('contentDepth', profile.preferred_content_depth as any);
        setSmartDefaultsApplied(true);
      } catch {
        /* silent — defaults remain unchanged */
      } finally {
        if (!cancelled) setSmartDefaultsLoading(false);
      }
    };
    fetchSmartDefaults();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canProceed = settings.title.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('presentations.setup.title', 'Configure Your Deck')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {t('presentations.setup.subtitle', 'Set the mode, audience, visuals, and style.')}
        </p>
        {smartDefaultsApplied && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-c-info/10 dark:bg-c-info/10 text-xs text-c-info dark:text-c-info">
            <Wand2 size={12} />
            {t(
              'presentations.setup.smartDefaults',
              "Suggested based on your organization's preferences"
            )}
          </div>
        )}
        {smartDefaultsLoading && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-navy-800 text-xs text-slate-600">
            <div className="w-3 h-3 border border-c-info border-t-transparent rounded-full animate-spin" />
            {t('presentations.setup.loadingDefaults', 'Loading smart defaults...')}
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('presentations.setup.deckTitle', 'Deck Title')} *
        </label>
        <input
          value={settings.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder={t(
            'presentations.setup.titlePlaceholder',
            'e.g., Steering Committee Update — Q1 2026'
          )}
          className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-lg"
        />
      </div>

      {/* Presentation Mode (MUST) */}
      <PresentationModeSelector
        value={settings.presentationMode}
        onChange={(v) => onChange('presentationMode', v)}
      />

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('presentations.setup.creationPath', 'Creation Path')}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onChange('selectedTemplate', '')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              !settings.selectedTemplate
                ? 'border-c-info bg-c-info/5'
                : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
            }`}
          >
            <Sparkles className="w-5 h-5 text-c-info mb-2" />
            <p className="font-medium text-slate-900 dark:text-white text-sm">
              {t('presentations.setup.aiGenerates', 'AI Generates')}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {t('presentations.setup.aiGeneratesDesc', 'AI proposes structure from your sources')}
            </p>
          </button>
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => onChange('selectedTemplate', tmpl.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                settings.selectedTemplate === tmpl.id
                  ? 'border-c-info bg-c-info/5'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
              }`}
            >
              <Layout className="w-5 h-5 text-blue-400 mb-2" />
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-white text-sm">{tmpl.name}</p>
                {!tmpl.is_system && (
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-300">
                    ORG
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{tmpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Communication Register + Core Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Communication Register */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('presentations.wizard.communicationRegister', 'Communication Register')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {COMMUNICATION_REGISTERS.map((reg) => (
              <button
                key={reg.id}
                onClick={() => onChange('communicationRegister', reg.id)}
                className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                  settings.communicationRegister === reg.id
                    ? 'border-c-info bg-c-info/10 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-medium">{t(reg.labelKey, reg.id)}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{t(reg.descriptionKey, '')}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content Depth */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('presentations.wizard.contentDepth', 'Content Depth')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_DEPTHS.map((depth) => (
              <button
                key={depth.id}
                onClick={() => onChange('contentDepth', depth.id)}
                className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                  settings.contentDepth === depth.id
                    ? 'border-c-info bg-c-info/10 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-medium">{t(depth.labelKey, depth.id)}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{t(depth.descriptionKey, '')}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Basic Settings Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectField
          label={t('presentations.setup.audience', 'Audience')}
          value={settings.audience}
          onChange={(v) => onChange('audience', v)}
          options={AUDIENCES.map((a) => ({
            value: a,
            label: t(`presentations.audiences.${a}`, a.replace(/_/g, ' ')),
          }))}
        />
        <SelectField
          label={t('presentations.setup.goal', 'Goal')}
          value={settings.goal}
          onChange={(v) => onChange('goal', v)}
          options={GOALS.map((g) => ({
            value: g,
            label: t(`presentations.goals.${g}`, g),
          }))}
        />
        <SelectField
          label={t('presentations.setup.language', 'Language')}
          value={settings.language}
          onChange={(v) => onChange('language', v as 'en' | 'pl')}
          options={[
            { value: 'en', label: 'English' },
            { value: 'pl', label: 'Polski' },
          ]}
        />
        <SelectField
          label={t('presentations.setup.confidentiality', 'Confidentiality')}
          value={settings.confidentiality}
          onChange={(v) => onChange('confidentiality', v as 'confidential' | 'internal' | 'public')}
          options={CONFIDENTIALITIES.map((c) => ({
            value: c,
            label: t(`presentations.confidentialities.${c}`, c),
          }))}
        />
      </div>

      {/* Visuals Section */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 dark:text-white text-sm">
              {t('presentations.wizard.visualsSection', 'Visuals & Branding')}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'presentations.wizard.visualsSectionDesc',
                'Control image style, color palette, and card dimensions.'
              )}
            </p>
          </div>
          <button
            onClick={() => onChange('visualsEnabled', !settings.visualsEnabled)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              settings.visualsEnabled
                ? 'bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 border-c-info hover:bg-navy-800'
                : 'bg-slate-50 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-navy-600 hover:border-slate-300'
            }`}
          >
            {settings.visualsEnabled ? t('common.on', 'On') : t('common.off', 'Off')}
          </button>
        </div>

        <div className={!settings.visualsEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <ImageStyleSelector
            value={settings.imageStylePreset}
            onChange={(v) => onChange('imageStylePreset', v)}
          />
        </div>

        <div className={!settings.visualsEnabled ? 'opacity-50 pointer-events-none' : ''}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label={t('presentations.wizard.imageSource', 'Image Source')}
              value={settings.imageSource}
              onChange={(v) => onChange('imageSource', v as any)}
              options={IMAGE_SOURCES.map((s) => ({
                value: s.id,
                label: t(s.labelKey, s.id.replace(/_/g, ' ')),
              }))}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('presentations.wizard.cardSize', 'Card Size')}
              </label>
              <div className="flex gap-2">
                {CARD_SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => onChange('cardSize', size.id)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      settings.cardSize === size.id
                        ? 'border-c-info bg-c-info/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ColorSetGallery
          value={settings.colorSetId}
          onChange={(v) => onChange('colorSetId', v)}
          brandKitColors={brandKitColors}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t('presentations.setup.visuals.priority', 'Visual Priority')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['quality', 'cost'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onChange('visualsPriority', p)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    settings.visualsPriority === p
                      ? 'border-c-info bg-c-info/10 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {t(`presentations.setup.visuals.${p}`, p)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {t('presentations.wizard.showAdvanced', 'Advanced options')}
      </button>

      {showAdvanced && (
        <div className="space-y-4 pl-4 border-l-2 border-slate-200 dark:border-navy-700">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('presentations.wizard.additionalInstructions', 'Additional Instructions for AI')}
            </label>
            <textarea
              value={settings.additionalInstructions}
              onChange={(e) => onChange('additionalInstructions', e.target.value)}
              placeholder={t(
                'presentations.wizard.additionalInstructionsPlaceholder',
                'e.g., Focus on financial metrics, use dark backgrounds...'
              )}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm resize-none"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={16} /> {t('common.back', 'Back')}
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 font-medium rounded-xl hover:bg-navy-800 disabled:opacity-50"
        >
          <Sparkles size={16} /> {t('presentations.setup.generateOutline', 'Generate Outline')}
        </button>
      </div>
    </div>
  );
};

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);
