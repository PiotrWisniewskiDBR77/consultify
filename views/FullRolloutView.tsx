import React, { useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullRolloutWorkspace } from '../components/FullRolloutWorkspace'; // New Component
import { AppView, AIMessageHistory, FullInitiative } from '../types';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI } from '../services/ai/gemini';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

export const FullRolloutView: React.FC = () => {
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

            // Context: Full Rollout
            const context = `
        Context: User is in Module 5: Full Rollout Execution.
        Goal: Manage the comprehensive transformation program.
        Active Initiatives: ${fullSession.initiatives.length}
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
        <SplitLayout title="Module 5: Full Rollout Execution" onSendMessage={handleAiChat}>
            <div className="w-full h-full flex flex-col relative bg-slate-50 dark:bg-navy-950">
                <div className="absolute top-2 right-4 z-20">
                    <AIFeedbackButton context="rollout" data={fullSession} />
                </div>

                <FullRolloutWorkspace
                    fullSession={fullSession}
                    onUpdateInitiative={handleUpdateInitiative}
                    onNextStep={() => {
                        onNavigate(AppView.FULL_STEP6_REPORTS);
                    }}
                    language={language}
                />
            </div>
        </SplitLayout>
    );
};
