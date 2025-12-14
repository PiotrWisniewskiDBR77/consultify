import React, { useEffect, useCallback, useState } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullPilotWorkspace } from '../components/FullPilotWorkspace'; // New Component
import { FullInitiative, AppView, AIMessageHistory } from '../types';
// import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI } from '../services/ai/gemini';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

export const FullPilotView: React.FC = () => {
    const {
        currentUser,
        fullSessionData: fullSession,
        setFullSessionData: updateFullSession,
        addChatMessage: addMessage,
        setIsBotTyping: setTyping,
        setCurrentView: onNavigate,
        activeChatMessages: messages
    } = useAppStore();

    const language = currentUser?.preferredLanguage || 'EN';

    // Find the Active Pilot Initiative
    // We look for status 'step4' (which we set in RoadmapView) OR 'In Progress' if marked as Pilot
    // For simplicity, let's assume the "Pilot" is the one passed from Roadmap.
    // Actually, we should probably add a specific 'isPilot: boolean' flag to initiatives or rely on status='step4'.
    // Using status='step4' as "Ready for Pilot" / "In Pilot".

    const pilotInitiative = fullSession.initiatives.find(i => i.status === 'step4' || i.status === 'In Progress' && i.wave === 'Wave 1');

    const addUserMessage = (content: string) => {
        addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: new Date() });
    };

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

    const handleAiChat = async (text: string) => {
        addUserMessage(text);
        setTyping(true);

        try {
            const history: AIMessageHistory[] = messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));

            // Context: Pilot Execution
            const context = `
        Context: User is in Module 4: Pilot Execution.
        Pilot Initiative: ${pilotInitiative?.name || 'None selected'}
        Goal: Execute a business experiment to validate assumptions before full rollout.
        User Question: ${text}
      `;

            const response = await sendMessageToAI(history, context);
            addAiMessage(response, 0);

        } catch (e) {
            console.error(e);
            addAiMessage("I apologize, I am having trouble processing that right now.");
            setTyping(false);
        }
    };

    const handleUpdateInitiative = (updated: FullInitiative) => {
        const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
        updateFullSession({ initiatives: newInits });
    };

    return (
        <SplitLayout title="Module 4: Pilot Execution" onSendMessage={handleAiChat}>
            <div className="w-full h-full flex flex-col relative bg-slate-50 dark:bg-navy-950">
                <div className="absolute top-2 right-4 z-20">
                    <AIFeedbackButton context="pilot" data={pilotInitiative} />
                </div>

                {pilotInitiative ? (
                    <FullPilotWorkspace
                        fullSession={fullSession}
                        pilotInitiative={pilotInitiative}
                        onUpdateInitiative={handleUpdateInitiative}
                        onNextStep={() => {
                            // Navigate to Rollout or Reports?
                            // Typically after Pilot comes Evaluation -> Decision -> Rollout (Mod 5)
                            onNavigate(AppView.FULL_ROLLOUT);
                        }}
                        language={language}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <p className="mb-4">No Active Pilot Initiative Found.</p>
                        <button
                            onClick={() => onNavigate(AppView.FULL_STEP3_ROADMAP)}
                            className="text-blue-500 hover:underline"
                        >
                            Return to Roadmap to Select a Pilot
                        </button>
                    </div>
                )}

            </div>
        </SplitLayout>
    );
};
