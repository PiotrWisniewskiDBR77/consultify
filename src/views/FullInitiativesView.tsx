import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AIFeedbackButton } from '../components/AIFeedbackButton';
import { SplitLayout } from '../components/layout/SplitLayout';
import { FullStep2Workspace } from '../components/workspaces/FullStep2Workspace';
import { useAIStream } from '../hooks/useAIStream';
import { Agent } from '@/services/ai/agent';
import { formatChatError } from '@/services/ai/errorMessages';
import { AIMessageHistory, sendMessageToAI } from '@/services/ai/gemini';
import { Api } from '@/services/api';
import { generateInitiatives as engineGenerate } from '@/services/transformationEngine';
import { useAppStore } from '../store/useAppStore';
import { AppView, FullInitiative, SessionMode } from '../types';
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
        currentProjectId,
    } = useAppStore();
    const [users, setUsers] = React.useState<any[]>([]);
    const { startStream } = useAIStream();
    const language = currentUser?.preferredLanguage || 'EN';
    const { t: translate } = useTranslation();
    const t = translate('fullInitiatives', { returnObjects: true }) as Record<string, any>;
    // 0. FETCH ON MOUNT - Connect to DB
    useEffect(() => {
        let mounted = true;
        const loadInitiatives = async () => {
            try {
                // Fetch from DB using current project context
                const response = (await Api.getInitiatives(currentProjectId || undefined)) as any;

                // Handle response format variations (array vs object with initiatives prop)
                const initiatives = Array.isArray(response) ? response : response.initiatives || [];

                if (mounted) {
                    console.log('[FullInitiativesView] Loaded initiatives from DB:', initiatives.length);
                    // Update store with persistent DB data
                    updateFullSession({ initiatives });
                }
            } catch (err) {
                console.error('[FullInitiativesView] Failed to load initiatives:', err);
                // On error, we might keep existing or show error state
                // For now, silent fail means we rely on whatever is in state (likely empty)
            }
        };

        loadInitiatives();

        return () => {
            mounted = false;
        };
    }, [currentProjectId, updateFullSession]); // Re-fetch on project change

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await Api.getUsers();
                setUsers(data);
            } catch (e) {
                console.error('Failed to fetch users', e);
                // Fallback to current user if fetch fails
                if (currentUser) {
                    setUsers([currentUser]);
                }
            }
        };
        fetchUsers();
    }, [currentUser]);
    const addAiMessage = useCallback(
        (content: string, delay = 600) => {
            setTyping(true);
            setTimeout(() => {
                addMessage({
                    id: Date.now().toString(),
                    role: 'ai',
                    content,
                    timestamp: new Date(),
                });
                setTyping(false);
            }, delay);
        },
        [addMessage, setTyping],
    );
    const addUserMessage = (content: string) => {
        addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: new Date() });
    };
    const handleAiChat = async (text: string) => {
        addUserMessage(text);
        setTyping(true);
        const history: AIMessageHistory[] = messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
        }));
        // Context: Initiatives
        const initList = fullSession.initiatives.map((i) => `- ${i.name} (${i.priority})`).join('\n');
        const context = `Current Initiatives:\n${initList}\n\nUser asks: ${text}`;
        // 1. Add placeholder AI message
        const tempId = Date.now().toString();
        addMessage({
            id: tempId,
            role: 'ai',
            content: '',
            timestamp: new Date(),
        });
        startStream(text, history, context);
    };
    const generateInitiatives = useCallback(async () => {
        addAiMessage('Analyzing your assessment results against strategic goals...');
        try {
            const state = useAppStore.getState();
            const freeSession = state.freeSessionData;
            // Prepare Rich Context for "PRO MAX" Generation
            const generationContext = {
                assessment: fullSession.assessment,
                goals: freeSession.goal ? [freeSession.goal] : ['Optimizing Digital Maturity'], // Fallback
                painPoints: freeSession.painPoints || [],
                industry: currentUser?.companyName || 'General Industry', // Should use industry field if available
                contextSufficiency: fullSession.contextSufficiency,
            };
            // 1. Try AI Generation with Deep Context
            let newInitiatives = (await Api.aiRecommend(generationContext as any)) as any[];
            // 2. Fallback if AI fails or returns empty
            if (!newInitiatives || newInitiatives.length === 0) {
                console.warn('AI returned empty initiatives, using deterministic engine fallback.');
                newInitiatives = engineGenerate(fullSession);
            }
            // 3. Update State & DB
            // Persist to DB first to ensure IDs are valid (though we generate UUIDs client side? No, typically backend does or we do)
            // The Engine generates UUIDs?
            // engineGenerate likely generates string IDs.
            // We must save them to DB.

            const initiativesWithRealIds = await Promise.all(
                newInitiatives.map(async (init: any) => {
                    try {
                        // Ensure it has a project ID
                        const payload = {
                            ...init,
                            name: init.name || init.title || 'Untitled Initiative',
                            projectId: currentProjectId || undefined,
                        };
                        // Use Api to create. Note: Api.createInitiative returns the created object with ID
                        // But engine generated initiatives might strictly be formatted for frontend.
                        // We need to match backend schema.
                        // Create one by one.
                        await Api.createInitiative(payload);
                        return init; // Keep the one we have, or update if ID changed?
                        // Usually backend assigns ID if not provided, or uses provided UUID.
                        // Let's assume we keep the generated ID if valid UUID, or backend handles it.
                        // For safety, let's assume create returns the persisted object.
                    } catch (err) {
                        console.error('Failed to persist generated initiative', init.name, err);
                        return init; // Keep in session at least?
                    }
                }),
            );

            updateFullSession({ initiatives: initiativesWithRealIds });
            await Api.saveSession(
                currentUser!.id,
                SessionMode.FULL,
                { ...fullSession, initiatives: initiativesWithRealIds },
                currentProjectId || undefined,
            );

            addAiMessage(
                `I have generated ${initiativesWithRealIds.length} strategic initiatives. Note that each is linked to a specific gap found in your assessment.`,
            );
        } catch (e) {
            console.error('Initiative Gen Error', e);
            addAiMessage(formatChatError(e as Error, 'initiative_generation'));

            // Fallback on error - simple engine gen, no DB persistence for fallback yet?
            // Or should we persist fallback too? Yes.
            const fallback = engineGenerate(fullSession);
            // Try persist fallback
            fallback.forEach((f) =>
                Api.createInitiative({ ...f, projectId: currentProjectId || undefined }).catch(console.error),
            );

            updateFullSession({ initiatives: fallback });
            await Api.saveSession(
                currentUser!.id,
                SessionMode.FULL,
                { ...fullSession, initiatives: fallback },
                currentProjectId || undefined,
            );
        }
    }, [fullSession, updateFullSession, addAiMessage, currentUser, currentProjectId]);

    // MOVED: Don't auto-generate on mount if empty, because we fetch from DB now.
    // Only generate if explicitly requested or if we confirm DB is truly empty AND assessment is done?
    // Actually, better to leave auto-gen logic but guard it with a "loaded" state?
    // For now, removing the auto-trigger effect to prevent overwriting DB data with empty check race condition.
    // The user can click "Generate" if they want.

    /* 
  useEffect(() => {
     if (!fullSession.initiatives || fullSession.initiatives.length === 0) { ... }
  }, ...);
  */

    const handleUpdateInitiative = async (updated: FullInitiative) => {
        // Optimistic UI update
        const newInits = fullSession.initiatives.map((i) => (i.id === updated.id ? updated : i));
        updateFullSession({ initiatives: newInits });
        // Backend Update
        try {
            await Api.updateInitiative(updated.id, updated);
            // Also sync session for broader context if needed
            await Api.saveSession(
                currentUser!.id,
                SessionMode.FULL,
                { ...fullSession, initiatives: newInits },
                currentProjectId || undefined,
            );
        } catch (e) {
            console.error('Failed to update initiative', e);
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
            await Api.saveSession(
                currentUser!.id,
                SessionMode.FULL,
                { ...fullSession, initiatives: newInits },
                currentProjectId || undefined,
            );
            addAiMessage(`Created new initiative: "${created.name}"`);
        } catch (e) {
            console.error('Failed to create initiative', e);
            addAiMessage('Failed to save new initiative. Please try again.');
        }
    };
    return (
        <SplitLayout title="Strategic Initiatives">
            <div className="w-full h-full bg-gray-50 dark:bg-navy-900 flex flex-col overflow-hidden relative">
                <div className="absolute top-2 right-4 z-20">
                    <AIFeedbackButton context="recommendation" data={fullSession.initiatives} />
                </div>
                <FullStep2Workspace
                    fullSession={fullSession}
                    onUpdateInitiative={handleUpdateInitiative}
                    onCreateInitiative={handleCreateInitiative}
                    users={users} // Pass users
                    currentUser={currentUser} // Pass currentUser
                    strategicGoals={useAppStore.getState().freeSessionData.strategicGoals}
                    onEnrichInitiative={async (id) => {
                        try {
                            const initToEnrich = fullSession.initiatives.find((i) => i.id === id);
                            if (!initToEnrich) return;
                            addAiMessage(
                                `I am rewriting the business case for "${initToEnrich.name}" as a Senior Consultant. This may take a moment...`,
                            );
                            // Use new Agent Service
                            const enriched = await Agent.enrichInitiativeWithAI(
                                initToEnrich,
                                {
                                    name: currentUser?.companyName,
                                    industry: currentUser?.industry,
                                    country: currentUser?.country,
                                },
                                fullSession,
                                language,
                            );
                            // Merge results
                            const updatedInit = {
                                ...initToEnrich,
                                ...enriched,
                                description: enriched.description || initToEnrich.description,
                                // Store the structured data as well if needed, or just map key fields
                                marketContext: `Business Value: ${enriched.businessValue || 'N/A'}\n\nDeliverables:\n${enriched.deliverables?.map((d: string) => `- ${d}`).join('\n') || ''}`,
                            };
                            const updatedList = fullSession.initiatives.map((i) => (i.id === id ? updatedInit : i));
                            updateFullSession({ initiatives: updatedList });

                            // Persist update to DB
                            await Api.updateInitiative(updatedInit.id, updatedInit);
                            await Api.saveSession(
                                currentUser!.id,
                                SessionMode.FULL,
                                { ...fullSession, initiatives: updatedList },
                                currentProjectId || undefined,
                            );
                            addAiMessage(
                                `Analysis complete. I've updated "${initToEnrich.name}" with a detailed business case, risks, and deliverables.`,
                            );
                        } catch (e) {
                            console.error('Enrichment error', e);
                            addAiMessage(
                                'I encountered an issue generating the detailed business case. Please try again.',
                            );
                        }
                    }}
                    onNextStep={() => {
                        updateFullSession({ step2Completed: true });
                        onNavigate(AppView.FULL_STEP3_ROADMAP);
                    }}
                />
            </div>
        </SplitLayout>
    );
};
