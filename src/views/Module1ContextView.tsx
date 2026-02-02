import { AlertTriangle, CheckCircle2, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AIMessageHistory } from '@/services/ai/gemini';
import { Api } from '@/services/api'; // Using Api service for consistency

import { UnifiedChatPanel } from '../components/AIChat/UnifiedChatPanel';
import { useAIStream } from '../hooks/useAIStream';
import { useAppStore } from '../store/useAppStore';
import { AppView, FullSession, SessionMode } from '../types';
interface Module1ContextViewProps {
  currentUser: { id: string }; // Replace `any` with a more specific type
  fullSession: FullSession;
  onNavigate: (view: AppView) => void;
  setFullSession: (session: FullSession) => void;
}
export const Module1ContextView: React.FC<Module1ContextViewProps> = ({
  currentUser,
  fullSession,
  onNavigate,
  setFullSession,
}) => {
  const {
    activeChatMessages: messages,
    addChatMessage,
    isBotTyping,
    setIsBotTyping,
  } = useAppStore();
  const { isStreaming, streamedContent, startStream } = useAIStream();
  const [sufficiency, setSufficiency] = useState({
    score: fullSession.contextSufficiency?.score || 0,
    gaps: fullSession.contextSufficiency?.gaps || [],
    isReady: fullSession.contextSufficiency?.isReady || false,
  });
  // Initial greeting if chat is empty
  useEffect(() => {
    if (messages.length === 0) {
      const greeting =
        "Hello. I am your Senior Transformation Consultant. Before we begin the assessment, I need to understand your strategic context fully.\n\nI will not let us proceed until I am confident we can drive real value. Let's start: **Why are you undertaking this transformation right now?**";
      addChatMessage({
        id: 'init',
        role: 'ai',
        content: greeting,
        timestamp: new Date(),
      });
    }
  }, [messages.length, addChatMessage]);
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
          lastAnalysis: new Date().toISOString(),
        },
      };
      setFullSession(updatedSession);
      // Debounced save could go here, but for now we rely on explicit actions or periodic saves
      Api.saveSession(currentUser.id, SessionMode.FULL, updatedSession, fullSession.id);
    }
  }, [sufficiency, fullSession, setFullSession, currentUser.id]);
  const analyzeSufficiency = async (history: ChatMessage[]) => {
    // Real AI call to evaluate context sufficiency
    const evaluationPrompt = `
        ACT AS A SENIOR STRATEGY CONSULTANT AUDITOR.
        Analyze the conversation history provided.
        Evaluate if the user has provided sufficient context in these 4 areas:
        1. Strategic Drivers (Why now?)
        2. Business Goals (Quantifiable targets)
        3. Key Challenges (Pain points)
        4. Financial/Risk Context (Budget, constraints)
        
        Conversation:
        ${history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
        
        Output ONLY a valid JSON object (no markdown, no explanation):
        {"score": number (0-100), "gaps": ["list of missing areas"], "reasoning": "brief explanation"}
        `;

    try {
      const response = await Api.chatWithAI(
        evaluationPrompt,
        [],
        'You are a context evaluator. Output only valid JSON.'
      );
      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSufficiency({
          score: parsed.score || 0,
          gaps: parsed.gaps || [],
          isReady: (parsed.score || 0) >= 80,
        });
      }
    } catch (error) {
      console.error('Failed to analyze sufficiency:', error);
      // Fallback: use message count heuristic if AI fails
      const msgCount = history.filter((m) => m.role === 'user').length;
      const fallbackScore = Math.min(10 + msgCount * 15, 100);
      let fallbackGaps: string[] = [];
      if (fallbackScore < 40)
        fallbackGaps = ['Strategic Drivers', 'Business Goals', 'Financial Context'];
      else if (fallbackScore < 70) fallbackGaps = ['Business Goals', 'Financial Context'];
      else if (fallbackScore < 90) fallbackGaps = ['Financial Context'];
      setSufficiency({
        score: fallbackScore,
        gaps: fallbackGaps,
        isReady: fallbackScore >= 80,
      });
    }
  };
  const handleSendMessage = async (text: string) => {
    addChatMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    });
    setIsBotTyping(true);
    const history: AIMessageHistory[] = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    // Add user's new message to history for the API call
    history.push({ role: 'user', parts: [{ text }] });
    // Add placeholder AI message
    addChatMessage({ id: Date.now().toString(), role: 'ai', content: '', timestamp: new Date() });
    // 1. Generate AI Response (Conversation)
    startStream(
      text,
      history,
      "You are a strict Senior Consultant. Dig deep. Do not accept vague answers. If the user says 'we want to grow', ask 'How much? By when?'. Keep pushing until you have clear, quantifiable context."
    ).then(() => {
      // 2. Analyze Sufficiency after response (Background)
      // Note: startStream is async but basic version usually just starts it.
      // However, my hook implementation is async awaiting the stream.
      // Wait, useAIStream's startStream awaits the whole stream?
      // Yes, looking at implementation: `await Api.chatWithAIStream(...)`.
      // So this .then() happens when stream is DONE.
      // Analyze Sufficiency
      analyzeSufficiency([
        ...messages,
        { id: 'x', role: 'user', content: text, timestamp: new Date() },
      ]);
    });
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
      <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-navy-700">
        <div className="p-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-purple-600" />
              Module 1: Strategic Context
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PRO Mode: Senior Consultant Verification Active
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Context Quality
              </div>
              <div
                className={`text-xl font-bold ${sufficiency.score >= 80 ? 'text-green-500' : sufficiency.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}
              >
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
        <UnifiedChatPanel
          customMessages={
            isStreaming
              ? [
                  ...messages,
                  {
                    id: 'streaming-ai',
                    role: 'ai',
                    content: streamedContent,
                    timestamp: new Date(),
                    isStreaming: true,
                  },
                ]
              : messages
          }
          onMessageSent={handleSendMessage}
          onOptionSelect={(opt) => handleSendMessage(opt.value)}
          disabled={isBotTyping}
        />
      </div>
      {/* Right: Context Status Panel */}
      <div className="w-80 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 flex flex-col p-6 shadow-xl z-10">
        <h3 className="font-bold text-navy-900 dark:text-white mb-6 uppercase tracking-wider text-sm flex items-center gap-2">
          <Lock size={16} />
          Gatekeeper
        </h3>
        <div className="flex-1 space-y-6">
          <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-100 dark:border-navy-700">
            <h4 className="font-semibold text-sm mb-3">Missing Context</h4>
            {sufficiency.gaps.length > 0 ? (
              <ul className="space-y-2">
                {sufficiency.gaps.map((gap) => (
                  <li
                    key={gap}
                    className="flex items-center gap-2 text-xs text-red-500 font-medium"
                  >
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
          <div className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
            "I cannot allow you to proceed to the Assessment phase until I am satisfied that we have
            defined clear, quantifiable business goals. This logic protection ensures your roadmap
            will actually be relevant."
          </div>
        </div>
        <button
          onClick={handleProceed}
          disabled={!sufficiency.isReady}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            sufficiency.isReady
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/30 cursor-pointer transform hover:-translate-y-0.5'
              : 'bg-slate-200 dark:bg-navy-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
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
