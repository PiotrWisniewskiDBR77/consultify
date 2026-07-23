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
  type DeckTemplate,
  DEFAULT_WIZARD_SETTINGS,
  GeneratingStep,
  type IntentInfo,
  type OutlineItem,
  OutlineStep,
  ResultStep,
  SetupStep,
  type SourceArtifact,
  SourceStep,
  type WizardSettings,
  WizardShell,
  type WizardStep,
} from './wizard';

function unwrap<T = any>(res: any): T {
  const d = res?.data;
  if (d && typeof d === 'object' && 'data' in d) return d.data;
  return d;
}

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
    // A4: nie-blokujący sygnał jakości (Critic + M19), gdy
    // ENABLE_DECK_QUALITY_GATES !== 'false'. Brak pola = bramki pominięte.
    qualityGates?: {
      critic: { overallScore: number; regenerateSlides: number[]; passed: boolean };
      structural: { valid: boolean; errorCount: number; warningCount: number };
    };
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
    const templateArtifactId = params.get('templateArtifactId');
    const cloneTemplateArtifactId = params.get('cloneTemplateArtifactId');

    async function resolveLegacyTemplateIdFromArtifactId(
      artifactId: string
    ): Promise<string | null> {
      try {
        const res = await Api.get(`/artifacts/${artifactId}`);
        const data = unwrap(res);
        const links = Array.isArray(data?.originLinks) ? data.originLinks : [];
        const primary = links.find(
          (l: any) => String(l?.originRuntime || '') === 'presentation_template'
        );
        const legacy = String(primary?.originRecordId || '').trim();
        return legacy || null;
      } catch {
        return null;
      }
    }

    (async () => {
      if (templateArtifactId) {
        const legacy = await resolveLegacyTemplateIdFromArtifactId(templateArtifactId);
        if (legacy) {
          setSettings((prev) => ({ ...prev, selectedTemplate: legacy }));
        }
      } else if (templateId) {
        setSettings((prev) => ({ ...prev, selectedTemplate: templateId }));
      }

      const cloneIdToUse = cloneTemplateArtifactId
        ? await resolveLegacyTemplateIdFromArtifactId(cloneTemplateArtifactId)
        : cloneTemplateId;

      if (cloneIdToUse) {
        // Clone happens server-side; then we select the cloned template.
        try {
          const res = await Api.post(`/presentations/templates/${cloneIdToUse}/clone`, {});
          const cloneData = unwrap(res);
          const clonedId = cloneData?.id;
          if (clonedId) {
            setSettings((prev) => ({ ...prev, selectedTemplate: String(clonedId) }));
          }
        } catch {
          // non-blocking
        }
      }
    })();
  }, [location.search]);

  const loadTemplates = async () => {
    try {
      const res = await Api.get('/presentations/templates');
      const data = unwrap(res);
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      /* templates are optional */
    }
  };

  const loadIntents = async () => {
    try {
      const res = await Api.get('/presentations/intents');
      const data = unwrap(res);
      setIntents(Array.isArray(data) ? data : []);
    } catch {
      /* intents are optional */
    }
  };

  const loadBrandKit = async () => {
    try {
      const res = await Api.get('/presentations/brand-kit');
      const kit = unwrap(res);
      if (kit && kit.primary_color) {
        setBrandKitColors({
          primary: `#${kit.primary_color || '003A70'}`,
          secondary: `#${kit.secondary_color || '2C5F8A'}`,
          accent: `#${kit.accent_color || '00AA55'}`,
        });
        setSettings((prev) => ({ ...prev, colorSetId: 'brand_kit' }));
      }
    } catch {
      /* brand kit is optional */
    }
  };

  const toggleSource = useCallback((source: SourceArtifact) => {
    setSelectedSources((prev) => {
      const key = source.artifactId || source.id || source.type;
      const exists = prev.find((s) => (s.artifactId || s.id || s.type) === key);
      if (exists) return prev.filter((s) => (s.artifactId || s.id || s.type) !== key);
      return [...prev, source];
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
    setStep('generating');
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
      const data = unwrap(res);
      const outlineArr = Array.isArray(data?.outline) ? data.outline : [];
      setOutline(outlineArr);
      setDeckId(data?.deckId || '');
      setStep('outline');
      trackFunnelEvent('presentation_outline_generated', {
        templateId: settings.selectedTemplate,
        slideCount: outlineArr.length,
        presentationMode: settings.presentationMode,
      });
    } catch (err) {
      console.error('[PresentationWizard] generateOutline failed:', err);
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
      const data = unwrap(res);
      setResult(data || { slideCount: 0, warnings: [] });
      setStep('result');
      trackFunnelEvent('presentation_exported', {
        format: 'pptx',
        slideCount: data?.slideCount ?? 0,
        presentationMode: settings.presentationMode,
      });
    } catch (err) {
      console.error('[PresentationWizard] generateDeck failed:', err);
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
