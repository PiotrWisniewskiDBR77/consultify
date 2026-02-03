/**
 * BlockCard
 *
 * Individual block in the report canvas
 * Can be configured, reordered, enabled/disabled
 */

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  Grip,
  Image,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Table,
  Trash2,
  Type,
} from 'lucide-react';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import type { BlockConfig } from './ReportEditor';

// ==========================================
// TYPES
// ==========================================

interface BlockCardProps {
  block: BlockConfig;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BlockConfig>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isPl: boolean;
}

// ==========================================
// HELPERS
// ==========================================

const getBlockIcon = (type: string) => {
  switch (type) {
    case 'summary':
      return <FileText className="w-5 h-5" />;
    case 'matrix':
      return <LayoutGrid className="w-5 h-5" />;
    case 'analysis':
      return <BarChart3 className="w-5 h-5" />;
    case 'recommendations':
      return <List className="w-5 h-5" />;
    case 'table':
      return <Table className="w-5 h-5" />;
    case 'chart':
      return <BarChart3 className="w-5 h-5" />;
    case 'image':
      return <Image className="w-5 h-5" />;
    default:
      return <Type className="w-5 h-5" />;
  }
};

const getBlockColor = (type: string) => {
  switch (type) {
    case 'summary':
      return 'from-blue-500 to-blue-600';
    case 'matrix':
      return 'from-purple-500 to-purple-600';
    case 'analysis':
      return 'from-emerald-500 to-emerald-600';
    case 'recommendations':
      return 'from-amber-500 to-amber-600';
    case 'table':
      return 'from-slate-500 to-slate-600';
    case 'chart':
      return 'from-pink-500 to-pink-600';
    default:
      return 'from-slate-400 to-slate-500';
  }
};

// ==========================================
// COMPONENT
// ==========================================

export const BlockCard: React.FC<BlockCardProps> = ({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddBelow,
  canMoveUp,
  canMoveDown,
  isPl,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`
        group relative bg-white dark:bg-slate-900 rounded-xl border-2 transition-all
        ${
          isSelected
            ? 'border-blue-500 shadow-lg shadow-blue-500/10'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }
        ${!block.enabled ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
        {/* Drag Handle */}
        <div className="cursor-grab text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
          <Grip className="w-5 h-5" />
        </div>

        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getBlockColor(block.type)} flex items-center justify-center text-white`}
        >
          {getBlockIcon(block.type)}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full font-semibold text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-0"
            placeholder={isPl ? 'Tytuł bloku...' : 'Block title...'}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400 capitalize">{block.type}</span>
            {block.isGenerated && (
              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                {isPl ? 'Wygenerowano' : 'Generated'}
              </span>
            )}
            {block.isGenerating && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {isPl ? 'Generowanie...' : 'Generating...'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
            }}
            className={`p-1.5 rounded ${showSettings ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddBelow();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  {isPl ? 'Dodaj poniżej' : 'Add below'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ enabled: !block.enabled });
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {block.enabled ? (isPl ? 'Wyłącz' : 'Disable') : isPl ? 'Włącz' : 'Enable'}
                </button>
                <hr className="my-1 border-slate-200 dark:border-slate-700" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  {isPl ? 'Usuń' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            {/* Length */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {isPl ? 'Długość' : 'Length'}
              </label>
              <div className="flex gap-1">
                {(['short', 'medium', 'long'] as const).map((len) => (
                  <button
                    key={len}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ length: len });
                    }}
                    className={`
                      flex-1 py-1.5 px-2 text-xs font-medium rounded transition-all
                      ${
                        block.length === len
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                      }
                    `}
                  >
                    {len === 'short'
                      ? isPl
                        ? 'Krótki'
                        : 'Short'
                      : len === 'medium'
                        ? isPl
                          ? 'Średni'
                          : 'Medium'
                        : isPl
                          ? 'Długi'
                          : 'Long'}
                  </button>
                ))}
              </div>
            </div>

            {/* Visuals Toggle */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {isPl ? 'Grafiki' : 'Visuals'}
              </label>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ includeVisuals: !block.includeVisuals });
                }}
                className={`
                  w-full py-1.5 px-3 text-xs font-medium rounded flex items-center justify-center gap-2 transition-all
                  ${
                    block.includeVisuals
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                  }
                `}
              >
                <Image className="w-3.5 h-3.5" />
                {block.includeVisuals
                  ? isPl
                    ? 'Włączone'
                    : 'Enabled'
                  : isPl
                    ? 'Wyłączone'
                    : 'Disabled'}
              </button>
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {isPl ? 'Dodatkowe instrukcje (opcjonalne)' : 'Additional instructions (optional)'}
            </label>
            <textarea
              value={block.customPrompt || ''}
              onChange={(e) => onUpdate({ customPrompt: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder={
                isPl
                  ? 'Np. "Skup się na aspektach finansowych..."'
                  : 'E.g., "Focus on financial aspects..."'
              }
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg resize-none h-20"
            />
          </div>
        </div>
      )}

      {/* Content Preview */}
      {isExpanded && (
        <div className="p-4">
          {block.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
              <ReactMarkdown>{`${block.content.slice(0, 500)}...`}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <div className="text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {isPl
                    ? 'Treść zostanie wygenerowana przez AI'
                    : 'Content will be generated by AI'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Below Indicator */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddBelow();
          }}
          className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default BlockCard;
