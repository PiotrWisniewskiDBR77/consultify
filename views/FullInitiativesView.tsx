import React, { useEffect, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullStep2Workspace } from '../components/FullStep2Workspace';
import { FullInitiative, AppView, SessionMode } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI, AIMessageHistory } from '../services/ai/gemini';
import { Agent } from '../services/ai/agent';
import { generateInitiatives as engineGenerate } from '../services/transformationEngine';
import { Api } from '../services/api';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

export const FullInitiativesView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    activeChatMessages: messages,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate,
    isBotTyping,
    currentProjectId
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullInitiatives;

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

  const addUserMessage = (content: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: new Date() });
  };

  const handleAiChat = async (text: string) => {
    addUserMessage(text);
    setTyping(true);

    const history: AIMessageHistory[] = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Context: Initiatives
    const initList = fullSession.initiatives.map(i => `- ${i.name} (${i.priority})`).join('\n');
    const context = `Current Initiatives:\n${initList}\n\nUser asks: ${text}`;

    // 1. Add placeholder AI message
    const tempId = Date.now().toString();
    addMessage({
      id: tempId,
      role: 'ai',
      content: '',
      timestamp: new Date()
    });

    let currentText = "";

    // Dynamically import to avoid circular dep issues if any, or just standard import usage
    await import('../services/ai/gemini').then(async (mod) => {
      await mod.sendMessageToAIStream(
        history,
        context, // Sending context as message or system instruction?
        // Original code sent 'context' as message.
        // sendMessageToAI signature: (history, message, system?)
        // Here we are passing context as message.
        // However, for streaming, the signature is same.
        (chunk) => {
          currentText += chunk;
          useAppStore.getState().updateLastChatMessage(currentText);
        },
        () => {
          setTyping(false);
        }
        // No system prompt override used in original, so undefined.
      );
    });
  };

  const generateInitiatives = useCallback(async () => {
    addAiMessage("Analyzing your assessment results against strategic goals...");

    try {
      const state = useAppStore.getState();
      const freeSession = state.freeSessionData;

      // Prepare Rich Context for "PRO MAX" Generation
      const generationContext = {
        assessment: fullSession.assessment,
        goals: freeSession.goal ? [freeSession.goal] : ['Optimizing Digital Maturity'], // Fallback
        painPoints: freeSession.painPoints || [],
        industry: currentUser?.companyName || 'General Industry', // Should use industry field if available
        contextSufficiency: fullSession.contextSufficiency
      };

      // 1. Try AI Generation with Deep Context
      let newInitiatives = await Api.aiRecommend(generationContext);

      // 2. Fallback if AI fails or returns empty
      if (!newInitiatives || newInitiatives.length === 0) {
        console.warn("AI returned empty initiatives, using deterministic engine fallback.");
        newInitiatives = engineGenerate(fullSession);
      }

      // 3. Update State & DB
      // Ensure we preserve existing if merging, but here we replace or append? likely replace for initial gens.
      updateFullSession({ initiatives: newInitiatives });
      await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: newInitiatives }, currentProjectId || undefined);

      addAiMessage(`I have generated ${newInitiatives.length} strategic initiatives. Note that each is linked to a specific gap found in your assessment.`);

    } catch (e) {
      console.error("Initiative Gen Error", e);
      addAiMessage("I encountered an issue generating custom initiatives. Using standard recommendations instead.");

      // Fallback on error
      const fallback = engineGenerate(fullSession);
      updateFullSession({ initiatives: fallback });
      await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: fallback }, currentProjectId || undefined);
    }
  }, [fullSession, updateFullSession, addAiMessage, currentUser, currentProjectId]);

  useEffect(() => {
    // Generate if empty.
    // Also consider regeneration if assessment changed? 
    // For now, simple check: if empty, generate.
    if (!fullSession.initiatives || fullSession.initiatives.length === 0) {
      // Ensure we have some assessment data before generating?
      const hasAssessment = Object.keys(fullSession.assessment || {}).length > 0;
      if (hasAssessment) {
        addAiMessage("Analyzing your assessment results and generating transformation initiatives...");
        generateInitiatives();
      } else {
        addAiMessage("Please complete the assessment first to generate initiatives.");
      }
    }
  }, []); // Run once on mount if empty. 
  // Note: removing dependencies to prevent loop if initiatives update triggers effect. 
  // We want to run it only on mount.

  const handleUpdateInitiative = async (updated: FullInitiative) => {
    // Optimistic UI update
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });

    // Backend Update
    try {
      await Api.updateInitiative(updated.id, updated);
      // Also sync session for broader context if needed
      await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: newInits }, currentProjectId || undefined);
    } catch (e) {
      console.error("Failed to update initiative", e);
      // Revert? For now just log.
    }
  };

  const handleCreateInitiative = async (newInit: FullInitiative) => {
    // Backend Create
    try {
      // ensure projectId is attached if available
      const payload = { ...newInit, projectId: currentProjectId || 'default' };
      const created = await Api.createInitiative(payload);

      // Update State with returned object (has ID)
      const newInits = [...fullSession.initiatives, created];
      updateFullSession({ initiatives: newInits });

      // Sync Session
      await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: newInits }, currentProjectId || undefined);

      addAiMessage(`Created new initiative: "${created.name}"`);
    } catch (e) {
      console.error("Failed to create initiative", e);
      addAiMessage("Failed to save new initiative. Please try again.");
    }
  };



  return (
    <SplitLayout title="Strategic Initiatives" onSendMessage={handleAiChat}>
      <div className="w-full h-full bg-gray-50 dark:bg-navy-900 flex flex-col overflow-hidden relative">
        <div className="absolute top-2 right-4 z-20">
          <AIFeedbackButton context="recommendation" data={fullSession.initiatives} />
        </div>
        <FullStep2Workspace
          fullSession={fullSession}
          onUpdateInitiative={handleUpdateInitiative}
          onCreateInitiative={handleCreateInitiative}
          onEnrichInitiative={async (id) => {
            try {
              const initToEnrich = fullSession.initiatives.find(i => i.id === id);
              if (!initToEnrich) return;

              addAiMessage(`I am rewriting the business case for "${initToEnrich.name}" as a Senior Consultant. This may take a moment...`);

              // Use new Agent Service
              const enriched = await Agent.enrichInitiativeWithAI(
                initToEnrich,
                {
                  name: currentUser?.companyName,
                  industry: currentUser?.industry,
                  country: currentUser?.country
                },
                fullSession
              );

              // Merge results
              const updatedInit = {
                ...initToEnrich,
                ...enriched,
                description: enriched.description || initToEnrich.description,
                // Store the structured data as well if needed, or just map key fields
                marketContext: `Business Value: ${enriched.businessValue || 'N/A'}\n\nDeliverables:\n${enriched.deliverables?.map((d: any) => `- ${d}`).join('\n') || ''}`
              };

              const updatedList = fullSession.initiatives.map(i => i.id === id ? updatedInit : i);
              updateFullSession({ initiatives: updatedList });

              await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: updatedList }, currentProjectId || undefined);
              addAiMessage(`Analysis complete. I've updated "${initToEnrich.name}" with a detailed business case, risks, and deliverables.`);

            } catch (e) {
              console.error("Enrichment error", e);
              addAiMessage("I encountered an issue generating the detailed business case. Please try again.");
            }
          }}
          onNextStep={() => {
            updateFullSession({ step2Completed: true });
            onNavigate(AppView.FULL_STEP3_ROADMAP);
          }}
          language={language}
        />
      </div>
    </SplitLayout>
  );
};
