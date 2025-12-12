import React, { useState, useEffect, useRef } from 'react';
import { Agent } from '../services/ai/agent';
import { Bot, Send, User, X, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface AIInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    axisId: string;
    axisLabel: string;
    onComplete: (score: number, reasoning: string) => void;
}

export const AIInterviewModal: React.FC<AIInterviewModalProps> = ({
    isOpen, onClose, axisLabel, onComplete
}) => {
    const { currentUser } = useAppStore();
    const language = currentUser?.preferredLanguage || 'en';
    const [messages, setMessages] = useState<{ role: 'model' | 'user', text: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                role: 'model',
                text: `Hello! I am your AI Auditor for "${axisLabel}". I will ask a few questions to help assess your maturity level. Ready?`
            }]);
        }
    }, [isOpen, axisLabel, messages.length]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const newHistory = [...messages, { role: 'user', text: input }];
        setMessages(newHistory as any);
        setInput('');
        setIsLoading(true);

        try {
            const result = await Agent.conductAssessmentInterview(axisLabel, newHistory as any, language); // pass language if needed

            if (result.isFinished && result.conclusion) {
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: `Thank you. Based on our conversation, I assess your maturity at level ${result.conclusion!.score}. Reasoning: ${result.conclusion!.reasoning}`
                }]);

                // Auto-close after short delay or show a "Accept" button? 
                // Let's show a "Accept Score" button in the UI instead of auto-closing immediately.
                // But for now, we just wait for user to click a confirmation.
                // Or we can just call onComplete immediately if we want to be aggressive.
                // Let's add a specialized "Conclusion" message helper.

            } else if (result.nextQuestion) {
                setMessages(prev => [...prev, { role: 'model', text: result.nextQuestion! }]);
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', text: "I encountered an error. Let's try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Check if the last message is a conclusion to show the "Accept" button
    const lastMessage = messages[messages.length - 1];
    const isConclusion = lastMessage?.text.startsWith('Thank you. Based on our conversation');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 bg-indigo-600 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <Bot size={20} />
                        <h3 className="font-bold">AI Auditor: {axisLabel}</h3>
                    </div>
                    <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-navy-950">
                    {messages.map((m, idx) => (
                        <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-300 text-slate-600' : 'bg-indigo-600 text-white'}`}>
                                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                            </div>
                            <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.role === 'user' ? 'bg-white border border-slate-200 text-slate-800 rounded-tr-none' : 'bg-indigo-600 text-white rounded-tl-none'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0"><Bot size={14} className="text-white" /></div>
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl rounded-tl-none">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75" />
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-white/10">
                    {isConclusion ? (
                        <button
                            onClick={() => {
                                // Extract score from the last message text (hacky but works for demo)
                                const match = lastMessage.text.match(/level (\d+(\.\d+)?)/);
                                const score = match ? parseFloat(match[1]) : 3;
                                const reasoning = lastMessage.text.split('Reasoning: ')[1] || "AI Assessment";
                                onComplete(score, reasoning);
                            }}
                            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
                        >
                            <CheckCircle size={18} /> Accept Assessment Score
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-slate-100 dark:bg-navy-950 border border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-all dark:text-white"
                                placeholder="Type your answer..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                disabled={isLoading}
                                autoFocus
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white p-3 rounded-xl transition-colors"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
