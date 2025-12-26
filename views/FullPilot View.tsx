import React, { useEffect, useCallback, useState } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullPilotWorkspace } from '../components/FullPilotWorkspace'; // New Component
import { FullInitiative, AppView, AIMessageHistory, SessionMode, InitiativeStatus } from '../types';
import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI } from '../services/ai/gemini';
import { toast } from 'react-hot-toast';
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
    // We look for status 'IN_EXECUTION' (which replaced step4) AND Wave 1
    // For simplicity, let's assume the "Pilot" is the one passed from Roadmap.

    const pilotInitiative = fullSession.initiatives.find(i => i.status === InitiativeStatus.EXECUTING && i.wave === 'Wave 1');

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
            const aiMessages: AIMessageHistory[] = [
                ...messages.filter(m => m.role === 'ai' || m.role === 'user').map(m => ({
                    role: (m.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
                    parts: [{ text: m.content }]
                })),
                { role: 'user' as const, parts: [{ text }] }
            ];

            const response = await sendMessageToAI(
                aiMessages,
                text,
                'You are a pilot execution consultant helping validate initiatives.',
                'pilot_execution'
            );

            setTyping(false);
            addAiMessage(response, 0);
        } catch (err) {
            console.error('AI Chat Error:', err);
            setTyping(false);
            addAiMessage("Sorry, I'm having trouble responding right now. Please try again.", 0);
        }
    };

    // Auto-intro message
    useEffect(() => {
        if (messages.length === 0) {
            addAiMessage(
                "Welcome to the Pilot Execution phase! I'm here to help you validate your selected initiative. Let me know if you need assistance with validation metrics, testing plans, or execution strategy."
            );
        }
    }, []);

    return (
        <SplitLayout title="Module 4: Pilot Execution" onSendMessage={handleAiChat}>
            <div className="w-full h-full flex flex-col">

                {/* If Pilot Active, show Pilot Workspace */}
                {pilotInitiative ? (
                    <>
                        <div className="absolute top-6 right-6 z-10">
                            <AIFeedbackButton context="pilot_execution" data={pilotInitiative} />
                        </div>
                        <FullPilotWorkspace
                            fullSession={fullSession}
                            pilotInitiative={pilotInitiative}
                            onUpdateInitiative={(updated: FullInitiative) => {
                                const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
                                updateFullSession({ ...fullSession, initiatives: newInits });
                            }}
                            onNextStep={async () => {
                                // Mark Pilot Complete
                                const updated = fullSession.initiatives.map(i =>
                                    i.id === pilotInitiative.id
                                        ? { ...i, status: InitiativeStatus.DONE }
                                        : i
                                );
                                updateFullSession({ ...fullSession, initiatives: updated, step4Completed: true });

                                toast.success("Pilot completed! Now transition to full rollout or assess next steps.");

                                // Save
                                if (currentUser?.id) {
                                    await Api.saveSession(
                                        currentUser.id,
                                        SessionMode.FULL,
                                        { ...fullSession, initiatives: updated, step4Completed: true },
                                        currentUser.organizationId
                                    );
                                }

                                addAiMessage("Congratulations! Pilot successfully completed. Now let's review learnings before full rollout.");
                            }}
                            language={language}
                        />
                    </>
                ) : (
                    // If No Pilot, Show Selection Interface
                    <div className="p-8 overflow-y-auto bg-slate-50 dark:bg-navy-950 h-full">
                        <div className="max-w-6xl mx-auto">
                            <h2 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">Select Pilot Initiative</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">
                                ⚠️ We recommend starting with a <strong>Quick Win</strong> pilot: <em>High Impact, Low Complexity</em>.
                                This validates your strategy with minimal risk.
                            </p>

                            {/* Pilot Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {fullSession.initiatives.filter(i => i.wave === 'Wave 1').map(init => (
                                    <div
                                        key={init.id}
                                        onClick={async () => {
                                            console.log("Pilot selection - Clicked:", init.id);
                                            // Activate Pilot
                                            const updated = fullSession.initiatives.map(i =>
                                                i.id === init.id ? { ...i, status: InitiativeStatus.EXECUTING } : i
                                            );

                                            updateFullSession({ initiatives: updated, step3Completed: true });

                                            if (currentUser?.id) {
                                                await Api.saveSession(
                                                    currentUser.id,
                                                    SessionMode.FULL,
                                                    { ...fullSession, initiatives: updated, step3Completed: true },
                                                    currentUser.organizationId
                                                );
                                            }
                                        }}
                                        className="relative p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer transition-all group flex flex-col h-full"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${init.priority === 'High' || init.priority === 'Critical'
                                                ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                                                : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                                                }`}>
                                                {init.priority}
                                            </span>
                                            {init.complexity === 'Low' && (
                                                <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 bg-green-100 dark:bg-green-500/10 px-2 py-0.5 rounded">
                                                    Quick Win
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                            {init.name}
                                        </h3>

                                        <div className="flex-1">
                                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">
                                                {init.description || init.summary || "No description provided."}
                                            </p>
                                        </div>

                                        {/* Assessment Tags */}
                                        <div className="flex gap-2 mb-4 flex-wrap">
                                            {init.confidenceLevel && (
                                                <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded">
                                                    Conf: {init.confidenceLevel}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation(); // Prevent card click
                                                console.log("Pilot selection - Button Clicked:", init.id);
                                                toast.loading("Launching Pilot...", { id: 'pilot-launch' });

                                                try {
                                                    // Activate Pilot
                                                    const updated = fullSession.initiatives.map(i =>
                                                        i.id === init.id ? { ...i, status: InitiativeStatus.EXECUTING } : i
                                                    );

                                                    updateFullSession({ initiatives: updated, step3Completed: true });
                                                    toast.success("Pilot Activated!", { id: 'pilot-launch' });

                                                    if (currentUser?.id) {
                                                        await Api.saveSession(
                                                            currentUser.id,
                                                            SessionMode.FULL,
                                                            { ...fullSession, initiatives: updated, step3Completed: true },
                                                            currentUser.organizationId
                                                        );
                                                    }
                                                } catch (err) {
                                                    console.error("Pilot Launch Error:", err);
                                                    toast.error("Failed to launch pilot", { id: 'pilot-launch' });
                                                }
                                            }}
                                            className="w-full mt-auto py-2.5 text-sm font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-lg group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                                        >
                                            Launch Experiment <span className="group-hover:translate-x-1 transition-transform">→</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {fullSession.initiatives.filter(i => i.wave === 'Wave 1').length === 0 && (
                                <div className="text-center p-12 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl mt-8">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                        📭
                                    </div>
                                    <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2">No Wave 1 Initiatives Found</h3>
                                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                                        You need to schedule initiatives into Wave 1 in the Roadmap module before you can launch a pilot.
                                    </p>
                                    <button
                                        onClick={() => onNavigate(AppView.FULL_STEP3_ROADMAP)}
                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        Return to Roadmap
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </SplitLayout>
    );
};
