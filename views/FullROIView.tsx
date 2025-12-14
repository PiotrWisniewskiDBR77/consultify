import React, { useEffect, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullROIWorkspace } from '../components/FullROIWorkspace';
import { FullInitiative, CostRange, BenefitRange, AppView, EconomicsSummary } from '../types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

// FIX: Added missing imports
import { Api } from '../services/api';
import { SessionMode } from '../types';
import { AIFeedbackButton } from '../components/AIFeedbackButton'; // Added import

export const FullROIView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    currentProjectId,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate
  } = useAppStore();

  const handleAiChat = async (text: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
  };

  const language = currentUser?.preferredLanguage || 'EN';
  const { t: translate } = useTranslation();
  const t = translate('fullROI', { returnObjects: true }) as any;

  const addAiMessage = useCallback((content: string, delay = 600) => {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content,
        timestamp: new Date()
      });
      setTyping(false);
    }, delay);
  }, [addMessage, setTyping]);

  const recalculateEconomics = (initiatives: FullInitiative[]): EconomicsSummary => {
    let totalCost = 0;
    let totalBenefit = 0;

    initiatives.forEach(i => {
      totalCost += i.estimatedCost || 0;
      totalBenefit += i.estimatedAnnualBenefit || 0;
    });

    const roi = totalCost > 0 ? (totalBenefit / totalCost) * 100 : 0;
    const payback = totalBenefit > 0 ? totalCost / totalBenefit : 0;

    return {
      totalCost,
      totalAnnualBenefit: totalBenefit,
      overallROI: roi,
      paybackPeriodYears: payback
    };
  };

  useEffect(() => {
    const runSimulation = async () => {
      let initializedInitiatives = fullSession.initiatives;
      const needsDefaults = fullSession.initiatives.some(i => i.estimatedCost === undefined || i.estimatedCost === 0);

      if (needsDefaults) {
        initializedInitiatives = fullSession.initiatives.map(i => {
          if (i.estimatedCost && i.estimatedCost > 0) return i;

          let cost: number = 0;
          let costR: CostRange = 'Low (<$10k)';
          let benefit: number = 0;
          let benefitR: BenefitRange = 'Low (<$20k/yr)';

          if (i.complexity === 'High') { cost = 75000; costR = 'High (>$50k)'; }
          else if (i.complexity === 'Medium') { cost = 25000; costR = 'Medium ($10k-$50k)'; }
          else { cost = 5000; costR = 'Low (<$10k)'; }

          if (i.priority === 'High') { benefit = cost * 2.5; benefitR = 'High (>$100k/yr)'; }
          else if (i.priority === 'Medium') { benefit = cost * 1.5; benefitR = 'Medium ($20k-$100k/yr)'; }
          else { benefit = cost * 1.2; benefitR = 'Low (<$20k/yr)'; }

          if (benefit < 20000) benefitR = 'Low (<$20k/yr)';
          else if (benefit < 100000) benefitR = 'Medium ($20k-$100k/yr)';
          else benefitR = 'High (>$100k/yr)';

          return { ...i, estimatedCost: cost, costRange: costR, estimatedAnnualBenefit: benefit, benefitRange: benefitR };
        });

        // Update local state first
        updateFullSession({ initiatives: initializedInitiatives });
      }

      addAiMessage("Running economic simulation and CFO analysis...");

      try {
        // CALL AI SIMULATION LAYER
        const result = await Api.aiSimulate(initializedInitiatives);

        updateFullSession({
          economics: {
            totalCost: result.totalCost,
            totalAnnualBenefit: result.totalAnnualBenefit,
            overallROI: result.overallROI,
            paybackPeriodYears: result.paybackPeriodYears
          }
        });
        await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: initializedInitiatives, economics: result }, currentProjectId || undefined);

        if (result.commentary) {
          addAiMessage(`💡 CFO Commentary: ${result.commentary}`);
        }
        if (result.riskAssessment) {
          setTimeout(() => addAiMessage(`⚠️ Risk Assessment: ${result.riskAssessment}`), 1000);
        }

      } catch (e) {
        console.error("Simulation Error", e);
        // Fallback
        const economics = recalculateEconomics(initializedInitiatives);
        updateFullSession({ initiatives: initializedInitiatives, economics });
        addAiMessage("AI Simulation unavailable. Using standard calculated estimates.");
      }
    };

    runSimulation();
  }, [fullSession.initiatives, updateFullSession, addAiMessage, language, t, currentUser, currentProjectId]);

  // Chat handler effect removed
  // TODO: Add Split View layout

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    const newStats = recalculateEconomics(newInits);
    updateFullSession({ initiatives: newInits, economics: newStats });
  };

  return (
    <SplitLayout title="Value Realization & ROI" onSendMessage={handleAiChat}>
      <div className="w-full h-full bg-navy-900 flex flex-col overflow-hidden relative">
        <div className="absolute top-2 right-4 z-20">
          <AIFeedbackButton context="simulation" data={fullSession.economics} />
        </div>
        <FullROIWorkspace
          fullSession={fullSession}
          onUpdateInitiative={handleUpdateInitiative}
          onNextStep={() => {
            updateFullSession({ step4Completed: true });
            onNavigate(AppView.FULL_STEP5_EXECUTION);
          }}
          language={language}
        />
      </div>
    </SplitLayout>
  );
};
