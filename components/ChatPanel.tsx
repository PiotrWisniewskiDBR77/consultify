import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, HelpCircle, Check, Send, ThumbsUp, ThumbsDown, Mic, MicOff, Square, Volume2, VolumeX, Square as StopIcon } from 'lucide-react';
import { ChatMessage, ChatOption } from '../types';
import { AIFeedbackButton } from './AIFeedbackButton';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from 'react-i18next';
import { useVoiceChat } from '../hooks/useVoiceChat';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onOptionSelect: (option: ChatOption, isMultiSelect?: boolean) => void;
  onMultiSelectSubmit?: (selectedOptions: string[]) => void;
  isTyping: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Enable automatic voice readback of AI responses */
  enableVoice?: boolean;
  /** Callback when voice readback should trigger (AI response complete) */
  onVoiceRead?: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  onOptionSelect,
  onMultiSelectSubmit,
  isTyping,
  title,
  subtitle,
  enableVoice: externalVoiceEnabled,
  onVoiceRead
}) => {
  const { t } = useTranslation();
  const { aiFreezeStatus } = useAppStore();
  const displayTitle = title || t('chat.header');
  const displaySubtitle = subtitle || t('chat.subHeader');
  const [inputValue, setInputValue] = useState('');
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Voice Chat (TTS) Integration
  const {
    speak,
    stopSpeaking,
    isSpeaking,
    voiceEnabled,
    toggleVoice,
    ttsSupported
  } = useVoiceChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-read AI responses when voice is enabled
  useEffect(() => {
    if (!voiceEnabled || !ttsSupported) return;

    // Find the last AI message that isn't currently streaming
    const lastAIMessage = [...messages].reverse().find(
      msg => msg.role === 'ai' && msg.id !== 'stream'
    );

    if (lastAIMessage && lastAIMessage.id !== lastMessageIdRef.current && !isTyping) {
      lastMessageIdRef.current = lastAIMessage.id;
      speak(lastAIMessage.content);
    }
  }, [messages, voiceEnabled, ttsSupported, isTyping, speak]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      // Set language based on i18n setting
      const i18nLang = localStorage.getItem('i18nextLng') || 'pl';
      const langMap: Record<string, string> = {
        'pl': 'pl-PL',
        'en': 'en-US',
        'de': 'de-DE',
        'es': 'es-ES',
        'ja': 'ja-JP',
        'ar': 'ar-SA'
      };
      recognition.lang = langMap[i18nLang] || 'pl-PL';
      console.log('[ChatPanel] Speech recognition language:', recognition.lang);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInputValue(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
      // Stop recording if active
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setInputValue('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleMultiSelectToggle = (value: string) => {
    if (selectedMultiOptions.includes(value)) {
      setSelectedMultiOptions(prev => prev.filter(item => item !== value));
    } else {
      if (selectedMultiOptions.length < 2) { // Max 2 as per requirements
        setSelectedMultiOptions(prev => [...prev, value]);
      }
    }
  };

  const handleMultiSelectConfirm = () => {
    if (onMultiSelectSubmit && selectedMultiOptions.length > 0) {
      onMultiSelectSubmit(selectedMultiOptions);
      setSelectedMultiOptions([]); // Reset for next time
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-navy-800 relative">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 flex justify-between items-center bg-white/50 dark:bg-navy-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h2 className="text-xs font-bold text-navy-900 dark:text-white tracking-wide uppercase">{displayTitle}</h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{displaySubtitle}</p>
        </div>
        {/* Voice Toggle Button */}
        {ttsSupported && (
          <button
            onClick={toggleVoice}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs ${voiceEnabled
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            title={voiceEnabled ? 'Wyłącz głos AI' : 'Włącz głos AI'}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">{voiceEnabled ? 'Głos ON' : 'Głos OFF'}</span>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;

          return (
            <div key={msg.id} className={`flex flex-col space-y-1.5 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${msg.role === 'ai'
                  ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-700'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                  }`}>
                  {msg.role === 'ai' ? <Bot size={14} className="text-primary-600 dark:text-primary-400" /> : <User size={14} className="text-slate-400 dark:text-slate-300" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-none'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 rounded-tl-none'
                  }`}>
                  {msg.content}
                </div>
              </div>

              {/* Message Actions (Feedback + Voice) */}
              {msg.role === 'ai' && msg.id !== 'stream' && (
                <div className="ml-9 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AIFeedbackButton context="chat" data={msg.content} />
                  {/* Read aloud button */}
                  {ttsSupported && (
                    <button
                      onClick={() => isSpeaking ? stopSpeaking() : speak(msg.content)}
                      className={`p-1.5 rounded-md transition-all ${isSpeaking
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                        }`}
                      title={isSpeaking ? 'Zatrzymaj' : 'Przeczytaj'}
                    >
                      {isSpeaking ? <Square size={12} /> : <Volume2 size={12} />}
                    </button>
                  )}
                </div>
              )}

              {/* Interactive Options (Only show for AI and if options exist) */}
              {msg.role === 'ai' && msg.options && (
                <div className={`ml-9 flex flex-wrap gap-2 ${isLastMessage ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  {msg.multiSelect ? (
                    // Multi-select Mode
                    <div className="flex flex-col gap-2 w-full max-w-md">
                      <div className="flex flex-wrap gap-1.5">
                        {msg.options.map((option) => {
                          const isSelected = selectedMultiOptions.includes(option.value);
                          return (
                            <button
                              key={option.id}
                              onClick={() => handleMultiSelectToggle(option.value)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 ${isSelected
                                ? 'bg-purple-100 dark:bg-purple-600/20 border-purple-300 dark:border-purple-500 text-purple-700 dark:text-purple-200'
                                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 hover:border-slate-300 dark:hover:border-white/20'
                                }`}
                            >
                              {option.label}
                              {isSelected && <Check size={12} />}
                            </button>
                          );
                        })}
                      </div>
                      {isLastMessage && selectedMultiOptions.length > 0 && (
                        <button
                          onClick={handleMultiSelectConfirm}
                          className="self-start btn-primary px-4 py-1.5 text-xs font-medium rounded-md"
                        >
                          Confirm Selection
                        </button>
                      )}
                    </div>
                  ) : (
                    // Single Select Mode
                    msg.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => onOptionSelect(option)}
                        className="px-3 py-1.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs rounded-full hover:bg-purple-50 dark:hover:bg-purple-600/10 hover:border-purple-300 dark:hover:border-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-all text-left"
                      >
                        {option.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700 flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={14} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={aiFreezeStatus.isFrozen}
              placeholder={aiFreezeStatus.isFrozen ? "AI RESTRICTED (Budget Exhausted)" : isRecording ? "Listening..." : "Type your answer..."}
              className={`w-full bg-slate-50 dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 pr-10 text-sm border border-slate-200 dark:border-navy-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all ${aiFreezeStatus.isFrozen ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-navy-950' : ''} ${isRecording ? 'border-red-400 ring-1 ring-red-400 animate-pulse' : ''}`}
            />
            {isRecording && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </div>
            )}
          </div>

          {/* Microphone Button - always visible */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={aiFreezeStatus.isFrozen || !speechSupported}
            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${isRecording
              ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/30'
              : speechSupported
                ? 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 hover:text-slate-700 dark:hover:text-slate-200'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              } ${aiFreezeStatus.isFrozen ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!speechSupported ? 'Voice input not supported in this browser' : isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isRecording ? <Square size={16} /> : <Mic size={16} />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={aiFreezeStatus.isFrozen || !inputValue.trim()}
            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${inputValue.trim()
              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-500/30'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-400 dark:text-slate-500'
              } ${aiFreezeStatus.isFrozen ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
