/**
 * StudioChat - AI Chat Panel for Studio
 * 
 * Chat interface for AI-powered diagram generation and modification.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { 
    Send, 
    Sparkles, 
    Loader2, 
    Trash2, 
    Bot, 
    User,
    Lightbulb,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { AIMessage } from './hooks/useStudioAI';

interface StudioChatProps {
    messages: AIMessage[];
    isProcessing: boolean;
    onSendMessage: (message: string) => void;
    onClear?: () => void;
    suggestions?: string[];
    className?: string;
}

// Quick action suggestions
const QUICK_ACTIONS = [
    { label: 'Create process flow', prompt: 'Create a process flow for ' },
    { label: 'Add decision node', prompt: 'Add a decision point for ' },
    { label: 'Create org chart', prompt: 'Create an organization chart for ' },
    { label: 'Add swimlane', prompt: 'Add a swimlane for ' },
    { label: 'Create mind map', prompt: 'Create a mind map about ' },
    { label: 'Create RACI matrix', prompt: 'Create a RACI matrix for ' }
];

export const StudioChat: React.FC<StudioChatProps> = ({
    messages,
    isProcessing,
    onSendMessage,
    onClear,
    suggestions = [],
    className = ''
}) => {
    const [input, setInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle send message
    const handleSend = useCallback(() => {
        if (!input.trim() || isProcessing) return;
        onSendMessage(input.trim());
        setInput('');
    }, [input, isProcessing, onSendMessage]);

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handle quick action
    const handleQuickAction = (prompt: string) => {
        setInput(prompt);
        inputRef.current?.focus();
    };

    // Format timestamp
    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div className={`flex flex-col h-full bg-slate-900 ${className}`}>
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">Studio AI</h3>
                        <p className="text-[10px] text-slate-500">Describe your diagram</p>
                    </div>
                </div>
                {onClear && messages.length > 0 && (
                    <button
                        onClick={onClear}
                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                        title="Clear chat"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                            <Bot size={28} className="text-blue-400" />
                        </div>
                        <h4 className="text-white font-medium mb-2">Start Creating</h4>
                        <p className="text-sm text-slate-500 max-w-[200px] mx-auto">
                            Describe the diagram you want to create, and I'll generate it for you.
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {/* Avatar */}
                        <div className={`
                            shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                            ${msg.role === 'user' 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'bg-purple-500/20 text-purple-400'
                            }
                        `}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>

                        {/* Message Content */}
                        <div className={`
                            flex-1 min-w-0
                            ${msg.role === 'user' ? 'text-right' : ''}
                        `}>
                            <div className={`
                                inline-block px-3 py-2 rounded-lg max-w-[85%] text-left
                                ${msg.role === 'user'
                                    ? 'bg-blue-500/20 text-blue-100'
                                    : 'bg-white/5 text-slate-300'
                                }
                            `}>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                    {msg.content}
                                </p>
                                
                                {/* Diagram update indicator */}
                                {msg.diagramUpdate && (
                                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <Sparkles size={10} />
                                            Diagram {msg.diagramUpdate.action === 'replace' ? 'generated' : 'updated'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-600 mt-1 px-1">
                                {formatTime(msg.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="flex gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Loader2 size={14} className="text-purple-400 animate-spin" />
                        </div>
                        <div className="bg-white/5 px-3 py-2 rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span>Generating diagram</span>
                                <span className="flex gap-0.5">
                                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length === 0 && (
                <div className="shrink-0 px-4 py-2 border-t border-white/5">
                    <button
                        onClick={() => setShowSuggestions(!showSuggestions)}
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors mb-2"
                    >
                        <Lightbulb size={12} />
                        Quick actions
                        {showSuggestions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    
                    {showSuggestions && (
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_ACTIONS.map((action) => (
                                <button
                                    key={action.label}
                                    onClick={() => handleQuickAction(action.prompt)}
                                    className="px-2 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-md transition-colors"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* AI Suggestions (when available) */}
            {suggestions.length > 0 && (
                <div className="shrink-0 px-4 py-2 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-amber-500 mb-2">
                        <Lightbulb size={12} />
                        Suggestions
                    </div>
                    <div className="space-y-1">
                        {suggestions.slice(0, 3).map((suggestion, i) => (
                            <button
                                key={i}
                                onClick={() => handleQuickAction(suggestion)}
                                className="block w-full text-left px-2 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-md transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="shrink-0 p-4 border-t border-white/10">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your diagram..."
                        rows={1}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        style={{ minHeight: '38px', maxHeight: '120px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isProcessing}
                        className={`
                            shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
                            ${input.trim() && !isProcessing
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-white/5 text-slate-600 cursor-not-allowed'
                            }
                        `}
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudioChat;






