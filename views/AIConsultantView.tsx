import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI } from '../services/ai/gemini';
import { AIMessageHistory, FullSession } from '../types';
import { Bot, Send, User as UserIcon, Sparkles, TrendingUp, DollarSign, Activity } from 'lucide-react';

interface AIConsultantViewProps {
    session: FullSession;
}

export const AIConsultantView: React.FC<AIConsultantViewProps> = ({ session }) => {
    const {
        activeChatMessages: messages,
        addChatMessage,
        isBotTyping,
        setIsBotTyping
    } = useAppStore();

    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isBotTyping]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsgId = Date.now().toString();
        addChatMessage({ id: userMsgId, role: 'user', content: text, timestamp: new Date() });
        setInput('');
        setIsBotTyping(true);

        try {
            // Dynamic Context Injection (The "Brain")
            // 1. Get Proactive Insights
            const insights = await import('../services/ai/agent').then(m => m.Agent.analyzeSessionForInsights(session, 'Client'));
            const insightSummary = insights.map(i => `- [${i.type.toUpperCase()}] ${i.text} (${i.impact} Priority)`).join('\n');

            // 2. Build Context
            const context = `
                ACT AS: Digital Executive Consultant.
                
                REAL-TIME SYSTEM ALERTS (The "Brain"):
                ${insightSummary || "No critical alerts."}
                
                CLIENT DATA:
                - Progress: Assessment (${session.step2Completed ? 'Done' : 'Pending'}), Initiatives (${session.initiatives?.length || 0}).
                - ROI: ${session.economics?.overallROI || 0}%.
                
                USER QUESTION: ${text}
                
                INSTRUCTION:
                If the user's question relates to the alerts above, reference them explicitly.
            `;

            const history: AIMessageHistory[] = messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));

            const response = await sendMessageToAI(history, context);

            addChatMessage({
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: response,
                timestamp: new Date()
            });
        } catch (error) {
            console.error(error);
            addChatMessage({
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: "I apologize, but I'm having trouble analyzing the data right now. Please try again.",
                timestamp: new Date()
            });
        } finally {
            setIsBotTyping(false);
        }
    };

    const suggestedPrompts = [
        { icon: <TrendingUp size={16} />, text: "Analyze my KPI trends", prompt: "Analyze the potential impact of our initiatives on key operational KPIs based on the roadmap." },
        { icon: <DollarSign size={16} />, text: "Explain Financial ROI", prompt: "Break down the ROI calculation. How does the $120k cost translate to the projected benefits?" },
        { icon: <Activity size={16} />, text: "Operational Recs", prompt: "What operational changes should we prioritize to unblock the 'Data Foundation' initiative?" },
    ];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-900 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm relative">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-navy-950/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-navy-900 dark:text-white">AI Consultant Insights</h2>
                        <p className="text-xs text-slate-500">Your Digital Executive Partner</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-navy-950">
                {messages.length === 0 && (
                    <div className="text-center py-12 opacity-60">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                            <Sparkles size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">How can I help you today?</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">
                            I can analyze your transformation data, explain financial projections, or provide strategic recommendations.
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'}`}>
                            {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-white border border-slate-200 text-navy-900 dark:bg-navy-800 dark:border-white/5 dark:text-white rounded-tr-none' : 'bg-indigo-600 text-white shadow-md rounded-tl-none'}`}>
                            <div className="prose dark:prose-invert text-sm max-w-none whitespace-pre-wrap">
                                {msg.content}
                            </div>
                            <div className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-slate-400' : 'text-indigo-200'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {isBotTyping && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 rounded-tl-none flex items-center gap-2">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-white/10 space-y-4">
                {/* Suggested Prompts */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {suggestedPrompts.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => handleSendMessage(p.prompt)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 dark:bg-navy-800 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-white/5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors whitespace-nowrap"
                        >
                            {p.icon}
                            {p.text}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(input)}
                        placeholder="Ask your Digital Consultant..."
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all dark:text-white"
                    />
                    <button
                        onClick={() => handleSendMessage(input)}
                        disabled={!input.trim() || isBotTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
