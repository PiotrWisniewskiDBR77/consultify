/**
 * Prompt Block Builder
 *
 * Visual drag-and-drop interface for composing prompt templates
 * from reusable blocks.
 */

import {
  AlertTriangle,
  Blocks,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Info,
  Plus,
  Search,
  Shield,
  Sliders,
  Trash2,
  User,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { PromptAssistantApi } from '../../../services/api/promptAssistant.api';

interface Block {
  code: string;
  name: string;
  category: string;
  semantic: string;
  variables?: string[];
  example?: string;
  usageCount?: number;
}

interface BlockCategory {
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface PromptBlockBuilderProps {
  selectedBlocks: string[];
  onBlocksChange: (blocks: string[]) => void;
  onPreview?: (assembledPrompt: string) => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ROLE: <User size={14} />,
  BEHAVIOR: <Sliders size={14} />,
  OUTPUT: <FileText size={14} />,
  CONSTRAINT: <Shield size={14} />,
  CONTEXT: <Database size={14} />,
  TASK: <CheckSquare size={14} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  ROLE: 'blue',
  BEHAVIOR: 'green',
  OUTPUT: 'purple',
  CONSTRAINT: 'red',
  CONTEXT: 'orange',
  TASK: 'teal',
};

export const PromptBlockBuilder: React.FC<PromptBlockBuilderProps> = ({
  selectedBlocks,
  onBlocksChange,
  onPreview,
  className = '',
}) => {
  const { t } = useTranslation();
  const [availableBlocks, setAvailableBlocks] = useState<Block[]>([]);
  const [categories, setCategories] = useState<Record<string, BlockCategory>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['ROLE', 'BEHAVIOR'])
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load blocks from API
  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    setIsLoading(true);
    try {
      const data = await PromptAssistantApi.getBlocks();
      setAvailableBlocks(data.data || []);
      setCategories((data.categories || {}) as Record<string, BlockCategory>);
    } catch (error) {
      console.error('Failed to load blocks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter blocks by search
  const filteredBlocks = availableBlocks.filter((block) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      block.code.toLowerCase().includes(query) ||
      block.name.toLowerCase().includes(query) ||
      block.semantic.toLowerCase().includes(query)
    );
  });

  // Group blocks by category
  const blocksByCategory = filteredBlocks.reduce(
    (acc, block) => {
      if (!acc[block.category]) acc[block.category] = [];
      acc[block.category].push(block);
      return acc;
    },
    {} as Record<string, Block[]>
  );

  // Get selected block details
  const selectedBlockDetails = selectedBlocks
    .map((code) => availableBlocks.find((b) => b.code === code))
    .filter(Boolean) as Block[];

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const addBlock = (code: string) => {
    if (!selectedBlocks.includes(code)) {
      onBlocksChange([...selectedBlocks, code]);
    }
  };

  const removeBlock = (code: string) => {
    onBlocksChange(selectedBlocks.filter((b) => b !== code));
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const newBlocks = [...selectedBlocks];
    const [removed] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, removed);
    onBlocksChange(newBlocks);
  };

  // Drag handlers for reordering
  const handleDragStart = (code: string) => {
    setDraggedBlock(code);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedBlock && dragOverIndex !== null) {
      const fromIndex = selectedBlocks.indexOf(draggedBlock);
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        moveBlock(fromIndex, dragOverIndex);
      }
    }
    setDraggedBlock(null);
    setDragOverIndex(null);
  };

  // Generate preview
  const generatePreview = async () => {
    if (selectedBlocks.length === 0) {
      setPreviewContent('No blocks selected');
      return;
    }

    setShowPreview(true);

    let preview = selectedBlockDetails
      .map((block) => `# ${block.category}: ${block.name}\n${block.semantic}`)
      .join('\n\n---\n\n');

    try {
      const response = await PromptAssistantApi.previewBlocks(selectedBlocks);
      if (response?.preview) {
        preview = response.preview;
      }
    } catch (error) {
      console.error('Failed to generate server preview:', error);
    }

    setPreviewContent(preview);

    if (onPreview) {
      onPreview(preview);
    }
  };

  const getCategoryColor = (category: string) => {
    const color = CATEGORY_COLORS[category] || 'slate';
    return {
      bg: `bg-${color}-100 dark:bg-${color}-900/30`,
      text: `text-${color}-700 dark:text-${color}-400`,
      border: `border-${color}-200 dark:border-${color}-800`,
    };
  };

  if (isLoading) {
    return <LoadingState variant="spinner" className={`h-64 ${className}`.trim()} />;
  }

  return (
    <div className={`flex flex-col lg:flex-row gap-4 ${className}`}>
      {/* Block Library */}
      <div className="lg:w-1/2 flex flex-col bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 mb-3">
            <Blocks className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Block Library</h3>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blocks..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {Object.entries(blocksByCategory).map(([category, blocks]) => (
            <div
              key={category}
              className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
            >
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`p-1 rounded ${getCategoryColor(category).bg} ${getCategoryColor(category).text}`}
                  >
                    {CATEGORY_ICONS[category]}
                  </span>
                  <span className="font-medium text-sm text-slate-900 dark:text-white">
                    {category}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({blocks.length})
                  </span>
                </div>
                {expandedCategories.has(category) ? (
                  <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
                ) : (
                  <ChevronRight size={16} className="text-slate-600 dark:text-slate-500" />
                )}
              </button>

              {/* Blocks in category */}
              {expandedCategories.has(category) && (
                <div className="p-2 space-y-1">
                  {blocks.map((block) => {
                    const isSelected = selectedBlocks.includes(block.code);
                    return (
                      <div
                        key={block.code}
                        className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                            : 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                        onClick={() =>
                          isSelected ? removeBlock(block.code) : addBlock(block.code)
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                              {block.name}
                            </span>
                            {isSelected && (
                              <CheckCircle size={14} className="text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {block.code}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              removeBlock(block.code);
                            } else {
                              addBlock(block.code);
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSelected
                              ? 'text-danger-500 hover:bg-danger-100 dark:hover:bg-danger-900/30'
                              : 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isSelected ? <Trash2 size={14} /> : <Plus size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Blocks & Preview */}
      <div className="lg:w-1/2 flex flex-col gap-4">
        {/* Selected blocks */}
        <div className="flex-1 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="p-4 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Selected Blocks</h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ({selectedBlocks.length})
                </span>
              </div>
              <button
                onClick={generatePreview}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                Preview
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2 min-h-[200px]">
            {selectedBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600 dark:text-slate-500">
                <Blocks size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No blocks selected</p>
                <p className="text-xs">Click blocks in the library to add them</p>
              </div>
            ) : (
              selectedBlockDetails.map((block, index) => (
                <div
                  key={block.code}
                  draggable
                  onDragStart={() => handleDragStart(block.code)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    dragOverIndex === index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800'
                  } ${draggedBlock === block.code ? 'opacity-50' : ''}`}
                >
                  <GripVertical
                    size={16}
                    className="text-slate-600 dark:text-slate-500 cursor-move flex-shrink-0"
                  />
                  <span
                    className={`p-1 rounded ${getCategoryColor(block.category).bg} ${getCategoryColor(block.category).text}`}
                  >
                    {CATEGORY_ICONS[block.category]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {block.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{block.category}</p>
                  </div>
                  <button
                    onClick={() => removeBlock(block.code)}
                    className="p-1.5 text-danger-500 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                Assembled Preview
              </h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewContent);
                }}
                className="p-1.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <Copy size={14} />
              </button>
            </div>
            <pre className="p-4 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-auto max-h-64 font-mono">
              {previewContent}
            </pre>
          </div>
        )}

        {/* Validation warnings */}
        {selectedBlocks.length > 0 &&
          !selectedBlocks.some((b) => b.includes('LANGUAGE_ADAPTIVE')) && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle
                size={16}
                className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Missing Language Block
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Add BEHAVIOR.LANGUAGE_ADAPTIVE for multilingual support
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default PromptBlockBuilder;
