/**
 * EditCardPopup — "Edit this card" popup (bottom-left of active card).
 * Freeform prompt + Quick actions grouped by category.
 */

import {
  BarChart3,
  Check,
  Image,
  Languages,
  Layout,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Type,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EditCardPopupProps {
  onClose: () => void;
  onSendPrompt: (prompt: string) => void;
  onQuickAction: (action: string) => void;
}

interface QuickAction {
  id: string;
  labelKey: string;
  icon: React.FC<{ size?: number; className?: string }>;
  category: 'writing' | 'image' | 'data' | 'layout';
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'improve_writing',
    labelKey: 'presentations.builder.editCard.improveWriting',
    icon: Pencil,
    category: 'writing',
  },
  {
    id: 'fix_spelling',
    labelKey: 'presentations.builder.editCard.fixSpelling',
    icon: Check,
    category: 'writing',
  },
  {
    id: 'translate',
    labelKey: 'presentations.builder.editCard.translate',
    icon: Languages,
    category: 'writing',
  },
  {
    id: 'make_longer',
    labelKey: 'presentations.builder.editCard.makeLonger',
    icon: Plus,
    category: 'writing',
  },
  {
    id: 'make_shorter',
    labelKey: 'presentations.builder.editCard.makeShorter',
    icon: Minus,
    category: 'writing',
  },
  {
    id: 'simplify',
    labelKey: 'presentations.builder.editCard.simplify',
    icon: Type,
    category: 'writing',
  },
  {
    id: 'more_visual',
    labelKey: 'presentations.builder.editCard.moreVisual',
    icon: Image,
    category: 'image',
  },
  {
    id: 'add_image',
    labelKey: 'presentations.builder.editCard.addImage',
    icon: Image,
    category: 'image',
  },
  {
    id: 'add_chart',
    labelKey: 'presentations.builder.editCard.addChart',
    icon: BarChart3,
    category: 'image',
  },
  {
    id: 'swap_org_photo',
    labelKey: 'presentations.builder.editCard.swapOrgPhoto',
    icon: Image,
    category: 'image',
  },
  {
    id: 'update_data',
    labelKey: 'presentations.builder.editCard.updateData',
    icon: RefreshCw,
    category: 'data',
  },
  {
    id: 'change_chart_type',
    labelKey: 'presentations.builder.editCard.changeChartType',
    icon: BarChart3,
    category: 'data',
  },
  {
    id: 'try_new_layout',
    labelKey: 'presentations.builder.editCard.tryNewLayout',
    icon: Layout,
    category: 'layout',
  },
];

const CATEGORIES = [
  { id: 'writing', label: 'Writing' },
  { id: 'image', label: 'Image & Visual' },
  { id: 'data', label: 'Data' },
  { id: 'layout', label: 'Layout' },
] as const;

export const EditCardPopup: React.FC<EditCardPopupProps> = ({
  onClose,
  onSendPrompt,
  onQuickAction,
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('writing');

  const handleSend = () => {
    if (prompt.trim()) {
      onSendPrompt(prompt.trim());
      setPrompt('');
    }
  };

  const filteredActions = QUICK_ACTIONS.filter((a) => a.category === activeCategory);

  return (
    <div className="absolute bottom-4 left-4 w-72 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-c-accent" />
          <span className="text-xs font-semibold text-c-text">
            {t('presentations.builder.editCard.title', 'Edit this card')}
          </span>
        </div>
        <button onClick={onClose} className="text-c-text-secondary hover:text-c-text-secondary text-xs">
          ESC
        </button>
      </div>

      {/* Prompt field */}
      <div className="px-3 py-2 border-b border-c-border-subtle">
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t(
              'presentations.builder.editCard.prompt',
              'How would you like to edit this card?'
            )}
            className="flex-1 text-xs bg-transparent border-none outline-none focus:ring-2 focus:ring-c-focus text-c-text"
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim()}
            className="p-1 text-c-accent disabled:opacity-30"
          >
            <Send size={12} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-c-border-subtle">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
              activeCategory === cat.id
                ? 'text-c-accent border-b-2 border-c-accent'
                : 'text-c-text-secondary hover:text-c-text-secondary'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="p-1.5 max-h-48 overflow-y-auto">
        {filteredActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onQuickAction(action.id)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-c-text-secondary hover:bg-c-accent-soft hover:text-c-accent transition-colors"
            >
              <Icon size={12} className="flex-shrink-0" />
              {t(action.labelKey, action.id.replace(/_/g, ' '))}
            </button>
          );
        })}
      </div>
    </div>
  );
};
