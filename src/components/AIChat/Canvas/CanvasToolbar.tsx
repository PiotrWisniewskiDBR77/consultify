/**
 * CanvasToolbar - Action toolbar for canvas editing
 * Provides AI edit, formatting, and undo/redo controls
 *
 * @version 1.0.0
 */

import {
  AlignLeft,
  Bold,
  Code,
  Copy,
  FileCode,
  Italic,
  List,
  Loader2,
  Redo2,
  Save,
  Sparkles,
  Undo2,
  Wand2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CanvasToolbarProps {
  type: string;
  language: string;
  onAIEdit: (instruction: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  isProcessing: boolean;
}

const QUICK_ACTIONS = {
  code: [
    { id: 'refactor', label: 'Refactor', icon: FileCode, instruction: 'Refactor this code for better readability and maintainability' },
    { id: 'optimize', label: 'Optimize', icon: Sparkles, instruction: 'Optimize this code for performance' },
    { id: 'document', label: 'Add Docs', icon: AlignLeft, instruction: 'Add documentation comments to this code' },
    { id: 'tests', label: 'Add Tests', icon: Code, instruction: 'Generate unit tests for this code' },
  ],
  document: [
    { id: 'improve', label: 'Improve', icon: Wand2, instruction: 'Improve the clarity and readability of this text' },
    { id: 'shorten', label: 'Shorten', icon: AlignLeft, instruction: 'Make this text more concise while keeping the key points' },
    { id: 'expand', label: 'Expand', icon: List, instruction: 'Expand this text with more details and examples' },
    { id: 'formal', label: 'Formalize', icon: FileCode, instruction: 'Make this text more formal and professional' },
  ],
  markdown: [
    { id: 'format', label: 'Format', icon: AlignLeft, instruction: 'Improve the formatting and structure of this markdown' },
    { id: 'headings', label: 'Add Headings', icon: Bold, instruction: 'Add appropriate headings to organize the content' },
    { id: 'lists', label: 'Add Lists', icon: List, instruction: 'Convert appropriate content to bullet points or numbered lists' },
    { id: 'links', label: 'Add Links', icon: Code, instruction: 'Identify terms that should be linked and add placeholder links' },
  ],
};

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  type,
  language,
  onAIEdit,
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
  hasChanges,
  isProcessing,
}) => {
  const { t } = useTranslation();
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const quickActions = QUICK_ACTIONS[type as keyof typeof QUICK_ACTIONS] || QUICK_ACTIONS.document;

  const handleQuickAction = (instruction: string) => {
    onAIEdit(instruction);
  };

  const handleCustomEdit = () => {
    if (customPrompt.trim()) {
      onAIEdit(customPrompt);
      setCustomPrompt('');
      setShowCustomPrompt(false);
    }
  };

  return (
    <div className="flex flex-col border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800">
      {/* Main Toolbar Row */}
      <div className="flex items-center justify-between px-3 py-2">
        {/* Left: History Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo || isProcessing}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('canvas.undo', 'Undo (⌘Z)')}
          >
            <Undo2 size={16} className="text-slate-500 dark:text-slate-400" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo || isProcessing}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('canvas.redo', 'Redo (⌘⇧Z)')}
          >
            <Redo2 size={16} className="text-slate-500 dark:text-slate-400" />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-2" />

          {/* Quick AI Actions */}
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.instruction)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded transition-colors disabled:opacity-50"
              >
                <Icon size={14} />
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Right: Custom Edit & Save */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showCustomPrompt
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
            }`}
          >
            {isProcessing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            {t('canvas.aiEdit', 'AI Edit')}
          </button>

          <button
            onClick={onSave}
            disabled={!hasChanges || isProcessing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              hasChanges
                ? 'bg-primary-500 text-white hover:bg-primary-600'
                : 'bg-slate-100 dark:bg-navy-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save size={14} />
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Custom Prompt Input Row */}
      {showCustomPrompt && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCustomEdit();
                  }
                  if (e.key === 'Escape') {
                    setShowCustomPrompt(false);
                  }
                }}
                placeholder={t('canvas.editInstruction', 'Describe the changes you want AI to make...')}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
              <Sparkles
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <button
              onClick={handleCustomEdit}
              disabled={!customPrompt.trim() || isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg transition-colors"
            >
              {t('common.apply', 'Apply')}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t('canvas.examples', 'Examples:')}</span>
            <button
              onClick={() => setCustomPrompt('Fix any bugs in this code')}
              className="hover:text-primary-500 transition-colors"
            >
              Fix bugs
            </button>
            <span>•</span>
            <button
              onClick={() => setCustomPrompt('Translate to TypeScript')}
              className="hover:text-primary-500 transition-colors"
            >
              Convert to TS
            </button>
            <span>•</span>
            <button
              onClick={() => setCustomPrompt('Add error handling')}
              className="hover:text-primary-500 transition-colors"
            >
              Add error handling
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasToolbar;
