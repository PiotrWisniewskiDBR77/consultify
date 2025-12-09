
import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Check } from 'lucide-react';
import { ChatMessage, ChatOption } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onOptionSelect: (option: ChatOption, isMultiSelect?: boolean) => void;
  onMultiSelectSubmit?: (selectedOptions: string[]) => void;
  isTyping: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  onSendMessage, 
  onOptionSelect,
  onMultiSelectSubmit,
  isTyping 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
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
    <div className="flex flex-col h-full bg-navy-950 border-r border-navy-800 relative">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-navy-800 flex justify-between items-center bg-navy-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">Transformation Assistant</h2>
          <p className="text-xs text-slate-400">Step 1: Profiling</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          
          return (
            <div key={msg.id} className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 border ${
                  msg.role === 'ai' 
                    ? 'bg-primary-900/50 border-primary-700' 
                    : 'bg-slate-700 border-slate-600'
                }`}>
                  {msg.role === 'ai' ? <Bot size={16} className="text-primary-400" /> : <User size={16} className="text-slate-300" />}
                </div>
                
                {/* Bubble */}
                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-tr-none' 
                    : 'bg-navy-800 text-slate-200 border border-navy-700 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>

              {/* Interactive Options (Only show for AI and if options exist) */}
              {msg.role === 'ai' && msg.options && (
                <div className={`ml-12 flex flex-wrap gap-2 ${isLastMessage ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  {msg.multiSelect ? (
                    // Multi-select Mode
                    <div className="flex flex-col gap-3 w-full max-w-md">
                      <div className="flex flex-wrap gap-2">
                        {msg.options.map((option) => {
                          const isSelected = selectedMultiOptions.includes(option.value);
                          return (
                            <button
                              key={option.id}
                              onClick={() => handleMultiSelectToggle(option.value)}
                              className={`px-4 py-2 text-sm rounded-full border transition-all flex items-center gap-2 ${
                                isSelected
                                  ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                                  : 'bg-navy-900 border-white/10 text-slate-300 hover:bg-navy-800 hover:border-white/20'
                              }`}
                            >
                              {option.label}
                              {isSelected && <Check size={14} />}
                            </button>
                          );
                        })}
                      </div>
                      {isLastMessage && selectedMultiOptions.length > 0 && (
                        <button 
                          onClick={handleMultiSelectConfirm}
                          className="self-start px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-md transition-colors"
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
                        className="px-4 py-2 bg-navy-900 border border-white/10 text-slate-300 text-sm rounded-full hover:bg-purple-600/10 hover:border-purple-500 hover:text-purple-300 transition-all text-left"
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
          <div className="flex gap-4 justify-start">
             <div className="w-8 h-8 rounded-full bg-primary-900/50 border border-primary-700 flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-primary-400" />
              </div>
              <div className="bg-navy-800 border border-navy-700 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-1">
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-navy-800 bg-navy-950">
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            className="w-full bg-navy-900 text-white placeholder-slate-500 rounded-lg px-4 py-3 border border-navy-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
          />
        </form>
      </div>
    </div>
  );
};
