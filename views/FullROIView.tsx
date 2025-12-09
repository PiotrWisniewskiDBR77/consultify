import React, { useEffect, useCallback } from 'react';
import { FullStep4Workspace } from '../components/FullStep4Workspace';
import { FullInitiative, CostRange, BenefitRange, AppView, EconomicsSummary } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';

export const FullROIView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullROI;

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

      const economics = recalculateEconomics(initializedInitiatives);
      updateFullSession({ initiatives: initializedInitiatives, economics });
      addAiMessage("I've pre-filled cost and benefit estimates based on the complexity of your initiatives. You can switch to 'Range View' or edit exact numbers.", 1000);
    }
  }, [fullSession.initiatives, updateFullSession, addAiMessage, language, t]);

  // Chat handler effect removed
  // TODO: Add Split View layout

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    const newStats = recalculateEconomics(newInits);
    updateFullSession({ initiatives: newInits, economics: newStats });
  };

  return (
    <div className="w-full h-full flex flex-col">
      <FullStep4Workspace
        fullSession={fullSession}
        onUpdateInitiative={handleUpdateInitiative}
        onNextStep={() => {
          updateFullSession({ step4Completed: true });
          onNavigate(AppView.FULL_STEP5_EXECUTION);
        }}
        language={language}
      />
    </div>
  );
};
