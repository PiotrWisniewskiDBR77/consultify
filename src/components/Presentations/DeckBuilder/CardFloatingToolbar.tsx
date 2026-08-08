/**
 * CardFloatingToolbar — appears at the top of the active card.
 * Layout picker, background, alignment, animations.
 */

import {
  AlignVerticalJustifyStart,
  Layers,
  Layout,
  Palette,
  PanelLeft,
  PanelRight,
  PanelTop,
  Sparkles,
  Square,
} from 'lucide-react';
import React, { useState } from 'react';

import type { DeckCard } from '../wizard/types';

interface CardFloatingToolbarProps {
  card: DeckCard;
  onUpdateCard: (updates: Partial<DeckCard>) => void;
  onChooseBackgroundImage?: () => void;
}

const LAYOUTS = [
  { id: 'auto', label: 'Automatic', icon: Layout },
  { id: 'content_full', label: 'Full', icon: Square },
  { id: 'content_left_right', label: 'Left / Right', icon: PanelLeft },
  { id: 'content_right_image', label: 'Text / Image', icon: PanelRight },
  { id: 'content_top_bottom', label: 'Top / Bottom', icon: PanelTop },
  { id: 'content_overlay', label: 'Overlay', icon: Layers },
];

const BG_TYPES = [
  { id: 'theme', label: 'Theme default' },
  { id: 'color', label: 'Solid color' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'image', label: 'Background image' },
];

export const CardFloatingToolbar: React.FC<CardFloatingToolbarProps> = ({
  card,
  onUpdateCard,
  onChooseBackgroundImage,
}) => {
  const [expandedPanel, setExpandedPanel] = useState<'layout' | 'bg' | null>(null);

  const togglePanel = (panel: 'layout' | 'bg') => {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  };
  const alignment = card.content_alignment || 'top';
  const nextAlignment =
    alignment === 'top' ? 'center' : alignment === 'center' ? 'space-between' : 'top';

  return (
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-1 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-lg px-2 py-1">
        {/* Layout picker */}
        <div className="relative">
          <button
            onClick={() => togglePanel('layout')}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
              expandedPanel === 'layout'
                ? 'bg-c-focus/10 text-c-focus-solid'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
            title="Layout"
            aria-label="Choose slide layout"
          >
            <Layout size={14} />
          </button>
          {expandedPanel === 'layout' && (
            <div className="absolute top-full mt-1 left-0 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-xl p-2 flex gap-1 z-40">
              {LAYOUTS.map((l) => {
                const LayoutIcon = l.icon;
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      onUpdateCard({ layout_id: l.id });
                      setExpandedPanel(null);
                    }}
                    className={`w-10 h-8 rounded border text-[10px] font-mono flex items-center justify-center ${
                      card.layout_id === l.id
                        ? 'border-c-focus-solid bg-c-focus/10'
                        : 'border-c-border-subtle hover:border-c-border-subtle'
                    }`}
                    title={l.label}
                    aria-label={`Use ${l.label} layout`}
                  >
                    <LayoutIcon size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Background */}
        <div className="relative">
          <button
            onClick={() => togglePanel('bg')}
            className={`p-1.5 rounded-lg ${
              expandedPanel === 'bg'
                ? 'bg-c-focus/10 text-c-focus-solid'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
            title="Background"
            aria-label="Choose slide background"
          >
            <Palette size={14} />
          </button>
          {expandedPanel === 'bg' && (
            <div className="absolute top-full mt-1 left-0 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-xl p-2 w-40 z-40">
              {BG_TYPES.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    if (bg.id === 'image' && onChooseBackgroundImage) {
                      onChooseBackgroundImage();
                      setExpandedPanel(null);
                      return;
                    }
                    onUpdateCard({
                      background: { type: bg.id as DeckCard['background']['type'] },
                    });
                    setExpandedPanel(null);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-[11px] ${
                    card.background.type === bg.id
                      ? 'bg-c-focus/10 text-c-focus-solid'
                      : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
                  aria-label={`Use ${bg.label} background`}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-c-border-subtle mx-0.5" />

        {/* Alignment */}
        <button
          onClick={() => onUpdateCard({ content_alignment: nextAlignment })}
          className="p-1.5 rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
          title={`Content distribution: ${alignment}`}
          aria-label={`Change content distribution (currently ${alignment})`}
        >
          <AlignVerticalJustifyStart size={14} />
        </button>

        {/* Animations toggle */}
        <button
          onClick={() =>
            onUpdateCard({
              animations: {
                ...card.animations,
                block_stagger: !card.animations.block_stagger,
              },
            })
          }
          className={`p-1.5 rounded-lg ${
            card.animations.block_stagger
              ? 'bg-c-focus/10 text-c-focus-solid'
              : 'text-c-text-secondary hover:bg-c-surface-raised'
          }`}
          title="Animations"
          aria-label="Toggle block animations"
        >
          <Sparkles size={14} />
        </button>
      </div>
    </div>
  );
};
