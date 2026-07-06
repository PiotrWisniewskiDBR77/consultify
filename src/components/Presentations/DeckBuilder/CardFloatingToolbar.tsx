/**
 * CardFloatingToolbar — appears at the top of the active card.
 * Layout picker, background, alignment, animations.
 */

import {
  AlignCenter,
  AlignVerticalJustifyStart,
  Image,
  Layout,
  Palette,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DeckCard } from '../wizard/types';

interface CardFloatingToolbarProps {
  card: DeckCard;
  onUpdateCard: (updates: Partial<DeckCard>) => void;
}

const LAYOUTS = [
  { id: 'full', label: 'Full', icon: '▢' },
  { id: 'left-right', label: 'Left / Right', icon: '▤' },
  { id: 'right-left', label: 'Right / Left', icon: '▥' },
  { id: 'top-bottom', label: 'Top / Bottom', icon: '▦' },
  { id: 'overlay', label: 'Overlay', icon: '▣' },
];

const BG_TYPES = [
  { id: 'theme', label: 'Theme default' },
  { id: 'color', label: 'Solid color' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'image', label: 'Background image' },
];

export const CardFloatingToolbar: React.FC<CardFloatingToolbarProps> = ({ card, onUpdateCard }) => {
  const { t } = useTranslation();
  const [expandedPanel, setExpandedPanel] = useState<'layout' | 'bg' | null>(null);

  const togglePanel = (panel: 'layout' | 'bg') => {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-1 bg-c-surface border border-c-border-subtle rounded-xl shadow-lg px-2 py-1">
        {/* Layout picker */}
        <div className="relative">
          <button
            onClick={() => togglePanel('layout')}
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
              expandedPanel === 'layout'
                ? 'bg-c-accent-soft text-c-accent'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
            title="Layout"
          >
            <Layout size={14} />
          </button>
          {expandedPanel === 'layout' && (
            <div className="absolute top-full mt-1 left-0 bg-c-surface border border-c-border-subtle rounded-lg shadow-xl p-2 flex gap-1 z-40">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    onUpdateCard({ layout_id: l.id });
                    setExpandedPanel(null);
                  }}
                  className={`w-10 h-8 rounded border text-[10px] font-mono flex items-center justify-center ${
                    card.layout_id === l.id
                      ? 'border-c-accent bg-c-accent-soft'
                      : 'border-c-border-subtle hover:border-c-border-subtle'
                  }`}
                  title={l.label}
                >
                  {l.icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Background */}
        <div className="relative">
          <button
            onClick={() => togglePanel('bg')}
            className={`p-1.5 rounded-lg ${
              expandedPanel === 'bg'
                ? 'bg-c-accent-soft text-c-accent'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
            title="Background"
          >
            <Palette size={14} />
          </button>
          {expandedPanel === 'bg' && (
            <div className="absolute top-full mt-1 left-0 bg-c-surface border border-c-border-subtle rounded-lg shadow-xl p-2 w-40 z-40">
              {BG_TYPES.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    onUpdateCard({
                      background: { type: bg.id as DeckCard['background']['type'] },
                    });
                    setExpandedPanel(null);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-[11px] ${
                    card.background.type === bg.id
                      ? 'bg-c-accent-soft text-c-accent'
                      : 'text-c-text-secondary hover:bg-c-surface-raised'
                  }`}
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
          className="p-1.5 rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
          title="Content alignment"
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
              ? 'bg-c-accent-soft text-c-accent'
              : 'text-c-text-secondary hover:bg-c-surface-raised'
          }`}
          title="Animations"
        >
          <Sparkles size={14} />
        </button>
      </div>
    </div>
  );
};
