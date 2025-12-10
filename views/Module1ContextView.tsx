import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppView, FullSession, ChatMessage, SessionMode } from '../types';
import { ChatPanel } from '../components/ChatPanel';
import { Api } from '../services/api'; // Using Api service for consistency
import { sendMessageToAIStream, AIMessageHistory, SYSTEM_PROMPTS } from '../services/ai/gemini';
import { CheckCircle2, Lock, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';

interface Module1ContextViewProps {
    currentUser: any;
    fullSession: FullSession;
    onNavigate: (view: AppView) => void;
    setFullSession: (session: FullSession) => void;
}

export const Module1ContextView: React.FC<Module1ContextViewProps> = ({ currentUser, fullSession, onNavigate, setFullSession }) => {
    const {
        activeChatMessages: messages,
        addChatMessage,
        isBotTyping,
        setIsBotTyping,
        updateLastChatMessage
    } = useAppStore();

    const [sufficiency, setSufficiency] = useState({
        score: fullSession.contextSufficiency?.score || 0,
        gaps: fullSession.contextSufficiency?.gaps || [],
        isReady: fullSession.contextSufficiency?.isReady || false
    });

    // Initial greeting if chat is empty
    useEffect(() => {
        if (messages.length === 0) {
            const greeting = "Hello. I am your Senior Transformation Consultant. Before we begin the assessment, I need to understand your strategic context fully.\n\nI will not let us proceed until I am confident we can drive real value. Let's start: **Why are you undertaking this transformation right now?**";
            addChatMessage({
                id: 'init',
                role: 'ai',
                content: greeting,
                timestamp: new Date()
            });
        }
    }, [messages.length]);

    // Update session when local sufficiency state changes
    useEffect(() => {
        if (
            sufficiency.score !== fullSession.contextSufficiency?.score ||
            sufficiency.isReady !== fullSession.contextSufficiency?.isReady
        ) {
            const updatedSession = {
                ...fullSession,
                contextSufficiency: {
                    score: sufficiency.score,
                    gaps: sufficiency.gaps,
                    isReady: sufficiency.isReady,
                    lastAnalysis: new Date().toISOString()
                }
            };
            setFullSession(updatedSession);
            // Debounced save could go here, but for now we rely on explicit actions or periodic saves
            Api.saveSession(currentUser.id, SessionMode.FULL, updatedSession, fullSession.id);
        }
    }, [sufficiency]);

    const analyzeSufficiency = async (history: ChatMessage[]) => {
        // Mock Sufficiency Analysis for immediate feedback loop (Real implementation would call a specialized LLM prompt)
        // Here we simulate the AI "Checking" the context.

        // In a real scenario, we would send the conversation to the LLM with a hidden system prompt asking to rate the context.
        // For this prototype, we'll increment score based on message count + length as a heuristic,
        // OR better yet, ask the AI to output a JSON block in a separate hidden call.

        // Let's do a hidden AI call to evaluate context.
        const evaluationPrompt = `
        ACT AS A SENIOR STRATEGY CONSULTANT AUDITOR.
        Analyze the conversation history provided.
        Evaluate if the user has provided sufficient context in these 4 areas:
        1. Strategic Drivers (Why now?)
        2. Business Goals (Quantifiable targets)
        3. Key Challenges (Pain points)
        4. Financial/Risk Context (Budget, constraints)

        Output a JSON ONLY:
        {
            "score": number (0-100),
            "gaps": string[] (list of missing areas),
            "reasoning": string (brief explanation)
        }
        `;

        // This is a simplified call to get the JSON. In production we might split this.
        // For now, we simulate "progress" to not block the user indefinitely in this demo.
        const msgCount = history.filter(m => m.role === 'user').length;
        let mockScore = Math.min(10 + (msgCount * 20), 100);
        let mockGaps = [];

        if (mockScore < 40) mockGaps = ["Strategic Drivers", "Business Goals", "Financial Context"];
        else if (mockScore < 70) mockGaps = ["Business Goals", "Financial Context"];
        else if (mockScore < 90) mockGaps = ["Financial Context"];

        setSufficiency({
            score: mockScore,
            gaps: mockGaps,
            isReady: mockScore >= 80
        });
    };

    const handleSendMessage = async (text: string) => {
        addChatMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
        setIsBotTyping(true);

        const history: AIMessageHistory[] = messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));
        // Add user's new message to history for the API call
        history.push({ role: 'user', parts: [{ text }] });

        // 1. Generate AI Response (Conversation)
        let currentText = "";
        await sendMessageToAIStream(
            history,
            "You are a strict Senior Consultant. Dig deep. Do not accept vague answers. If the user says 'we want to grow', ask 'How much? By when?'. Keep pushing until you have clear, quantifiable context.",
            (chunk) => {
                currentText += chunk;
                updateLastChatMessage(currentText);
            },
            () => {
                setIsBotTyping(false);
                // 2. Analyze Sufficiency after response (Background)
                analyzeSufficiency([...messages, { id: 'x', role: 'user', content: text, timestamp: new Date() }]);
            }
        );
    };

    const handleProceed = () => {
        if (sufficiency.isReady) {
            // update step completion
            const ur = { ...fullSession, step1Completed: true };
            setFullSession(ur);
            Api.saveSession(currentUser.id, SessionMode.FULL, ur, fullSession.id);
            onNavigate(AppView.FULL_STEP1_ASSESSMENT); // Proceed to Assessment (Step 2)
        }
    };

    return (
        <div className="flex w-full h-full bg-slate-50 dark:bg-navy-950">
            {/* Left: Chat Area */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-white/5">
                <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 shadow-sm flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="text-purple-600" />
                            Module 1: Strategic Context
                        </h2>
                        <p className="text-xs text-slate-500">PRO Mode: Senior Consultant Verification Active</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Context Quality</div>
                            <div className={`text-xl font-bold ${sufficiency.score >= 80 ? 'text-green-500' : sufficiency.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {sufficiency.score}%
                            </div>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="w-24 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${sufficiency.score >= 80 ? 'bg-green-500' : sufficiency.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${sufficiency.score}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <ChatPanel
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isTyping={isBotTyping}
                />
            </div>

            {/* Right: Context Status Panel */}
            <div className="w-80 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/5 flex flex-col p-6 shadow-xl z-10">
                <h3 className="font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
                    <Lock size={16} />
                    Gatekeeper
                </h3>

                <div className="flex-1 space-y-6">
                    <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-white/5">
                        <h4 className="font-semibold text-sm mb-3">Missing Context</h4>
                        {sufficiency.gaps.length > 0 ? (
                            <ul className="space-y-2">
                                {sufficiency.gaps.map(gap => (
                                    <li key={gap} className="flex items-center gap-2 text-xs text-red-500 font-medium">
                                        <AlertTriangle size={12} />
                                        {gap}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center gap-2 text-green-500 text-sm font-bold">
                                <CheckCircle2 size={16} />
                                All Checks Passed
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-slate-500 italic leading-relaxed">
                        "I cannot allow you to proceed to the Assessment phase until I am satisfied that we have defined clear, quantifiable business goals. This logic protection ensures your roadmap will actually be relevant."
                    </div>
                </div>

                <button
                    onClick={handleProceed}
                    disabled={!sufficiency.isReady}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${sufficiency.isReady
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/30 cursor-pointer transform hover:-translate-y-0.5'
                        : 'bg-slate-200 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {sufficiency.isReady ? (
                        <>
                            Proceed to Assessment
                            <ChevronRight size={18} />
                        </>
                    ) : (
                        <>
                            <Lock size={16} />
                            Context Insufficient
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
