/**
 * Presentation Wizard V3 (T058)
 * Gamma-app-level guided flow: Source selection -> Setup -> Outline -> Generate -> Result
 * Refactored into sub-components under ./wizard/
 */

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import {
  DEFAULT_WIZARD_SETTINGS,
  GeneratingStep,
  OutlineStep,
  ResultStep,
  SetupStep,
  SourceStep,
  WizardShell,
  type DeckTemplate,
  type IntentInfo,
  type OutlineItem,
  type SourceArtifact,
  type WizardSettings,
  type WizardStep,
} from './wizard';

export const PresentationWizard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isPl = i18n.language?.startsWith('pl');

  const [step, setStep] = useState<WizardStep>('sources');
  const [templates, setTemplates] = useState<DeckTemplate[]>([]);
  const [intents, setIntents] = useState<IntentInfo[]>([]);
  const [selectedSources, setSelectedSources] = useState<SourceArtifact[]>([]);
  const [settings, setSettings] = useState<WizardSettings>({
    ...DEFAULT_WIZARD_SETTINGS,
    language: isPl ? 'pl' : 'en',
  });
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [deckId, setDeckId] = useState('');
  const [result, setResult] = useState<{
    slideCount: number;
    warnings: string[];
    exportPath?: string;
  } | null>(null);
  const [brandKitColors, setBrandKitColors] = useState<{
    primary: string;
    secondary: string;
    accent: string;
  } | null>(null);

  useEffect(() => {
    trackFunnelEvent('presentation_generator_opened', {});
    loadTemplates();
    loadIntents();
    loadBrandKit();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const templateId = params.get('templateId');
    const cloneTemplateId = params.get('cloneTemplateId');

    if (templateId) {
      setSettings((prev) => ({ ...prev, selectedTemplate: templateId }));
    }

    if (cloneTemplateId) {
      // Clone happens server-side; then we select the cloned template.
      (async () => {
        try {
          const res = (await Api.post(`/presentations/templates/${cloneTemplateId}/clone`, {})) as any;
          const clonedId = res?.data?.id || res?.id;
          if (clonedId) {
            setSettings((prev) => ({ ...prev, selectedTemplate: String(clonedId) }));
          }
        } catch {
          // non-blocking
        }
      })();
    }
  }, [location.search]);

  const loadTemplates = async () => {
    try {
      const res = await Api.get('/presentations/templates');
      setTemplates(res.data || []);
    } catch {
      /* templates are optional */
    }
  };

  const loadIntents = async () => {
    try {
      const res = await Api.get('/presentations/intents');
      setIntents(res.data || []);
    } catch {
      /* intents are optional */
    }
  };

  const loadBrandKit = async () => {
    try {
      const res = await Api.get('/presentations/brand-kit');
      if (res.data) {
        setBrandKitColors({
          primary: `#${res.data.primary_color || '003A70'}`,
          secondary: `#${res.data.secondary_color || '2C5F8A'}`,
          accent: `#${res.data.accent_color || '00AA55'}`,
        });
        setSettings((prev) => ({ ...prev, colorSetId: 'brand_kit' }));
      }
    } catch {
      /* brand kit is optional */
    }
  };

  const toggleSource = useCallback((type: string) => {
    setSelectedSources((prev) => {
      const exists = prev.find((s) => s.type === type);
      if (exists) return prev.filter((s) => s.type !== type);
      return [...prev, { type, label: type.replace(/_/g, ' ') }];
    });
  }, []);

  const updateSetting = useCallback(
    <K extends keyof WizardSettings>(key: K, value: WizardSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleGenerateOutline = useCallback(async () => {
    if (!settings.title.trim()) {
      toast.error(t('presentations.wizard.titleRequired', 'Please enter a title'));
      return;
    }
    setStep('outline');
    try {
      const res = await Api.post('/presentations/generate/outline', {
        title: settings.title,
        templateId: settings.selectedTemplate || undefined,
        audience: settings.audience,
        goal: settings.goal,
        language: settings.language,
        presentationMode: settings.presentationMode,
        communicationRegister: settings.communicationRegister,
        imageStylePreset: settings.imageStylePreset,
        contentDepth: settings.contentDepth,
        confidentiality: settings.confidentiality,
        sourceArtifacts: selectedSources,
      });
      setOutline(res.data.outline);
      setDeckId(res.data.deckId);
      trackFunnelEvent('presentation_outline_generated', {
        templateId: settings.selectedTemplate,
        slideCount: res.data.outline.length,
        presentationMode: settings.presentationMode,
      });
    } catch {
      toast.error(t('presentations.wizard.outlineFailed', 'Failed to generate outline'));
      setStep('setup');
    }
  }, [settings, selectedSources, t]);

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    try {
      const res = await Api.post('/presentations/generate/deck', {
        deckId,
        outline,
        setup: {
          title: settings.title,
          templateId: settings.selectedTemplate,
          audience: settings.audience,
          goal: settings.goal,
          language: settings.language,
          confidentiality: settings.confidentiality,
          presentationMode: settings.presentationMode,
          communicationRegister: settings.communicationRegister,
          imageStylePreset: settings.imageStylePreset,
          imageSource: settings.imageSource,
          contentDepth: settings.contentDepth,
          cardSize: settings.cardSize,
          colorSetId: settings.colorSetId,
          sourceArtifacts: selectedSources,
          visuals: {
            enabled: settings.visualsEnabled,
            priority: settings.visualsPriority,
          },
          additionalInstructions: settings.additionalInstructions || undefined,
        },
      });
      setResult(res.data);
      setStep('result');
      trackFunnelEvent('presentation_exported', {
        format: 'pptx',
        slideCount: res.data.slideCount,
        presentationMode: settings.presentationMode,
      });
    } catch {
      toast.error(t('presentations.wizard.generationFailed', 'Generation failed'));
      setStep('outline');
    }
  }, [deckId, outline, settings, selectedSources, t]);

  const handleDownload = useCallback(async () => {
    if (!deckId) return;
    try {
      const response = await fetch(`/api/presentations/decks/${deckId}/download`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${settings.title || 'presentation'}.pptx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('presentations.wizard.downloadFailed', 'Download failed'));
    }
  }, [deckId, settings.title, t]);

  const handleOpenBuilder = useCallback(() => {
    if (deckId) {
      navigate(`/presentations/builder/${deckId}`);
    }
  }, [deckId, navigate]);

  return (
    <WizardShell step={step} onClose={onClose}>
      {step === 'sources' && (
        <SourceStep
          selectedSources={selectedSources}
          onToggleSource={toggleSource}
          onNext={() => setStep('setup')}
        />
      )}

      {step === 'setup' && (
        <SetupStep
          settings={settings}
          onChange={updateSetting}
          templates={templates}
          brandKitColors={brandKitColors}
          onBack={() => setStep('sources')}
          onNext={handleGenerateOutline}
        />
      )}

      {step === 'outline' && (
        <OutlineStep
          outline={outline}
          intents={intents}
          onOutlineChange={setOutline}
          onBack={() => setStep('setup')}
          onGenerate={handleGenerate}
        />
      )}

      {step === 'generating' && <GeneratingStep />}

      {step === 'result' && result && (
        <ResultStep
          result={result}
          settings={settings}
          onDownload={handleDownload}
          onEditOutline={() => setStep('outline')}
          onOpenBuilder={handleOpenBuilder}
        />
      )}
    </WizardShell>
  );
};

export default PresentationWizard;
