/**
 * ImagePromptEnhancer - Helps users create better image prompts
 * Provides suggestions and templates for DALL-E 3
 *
 * @version 1.0.0
 */

import {
  Camera,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Palette,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ImagePromptEnhancerProps {
  onPromptSelect: (prompt: string) => void;
  onEnhanceRequest: (prompt: string) => void;
  currentPrompt?: string;
  isEnhancing?: boolean;
}

interface PromptTemplate {
  id: string;
  icon: React.ElementType;
  category: string;
  templates: {
    label: string;
    prompt: string;
  }[];
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'business',
    icon: Camera,
    category: 'Business & Professional',
    templates: [
      {
        label: 'Modern Office',
        prompt:
          'A modern, minimalist office space with floor-to-ceiling windows, natural light streaming in, sleek furniture, and green plants. Professional and inviting atmosphere.',
      },
      {
        label: 'Team Meeting',
        prompt:
          'Diverse team of professionals collaborating around a conference table, engaged in animated discussion, modern office setting with whiteboards and laptops.',
      },
      {
        label: 'Dashboard Visualization',
        prompt:
          'Futuristic holographic data dashboard floating in dark space, showing charts, graphs, and KPIs with blue and purple glow effects.',
      },
    ],
  },
  {
    id: 'abstract',
    icon: Palette,
    category: 'Abstract & Conceptual',
    templates: [
      {
        label: 'Innovation',
        prompt:
          'Abstract representation of innovation and creativity - interconnected neural networks made of light, vibrant colors flowing through geometric shapes.',
      },
      {
        label: 'Growth',
        prompt:
          'Abstract visualization of business growth - ascending stairs made of golden light, reaching towards a bright horizon, symbolizing progress and success.',
      },
      {
        label: 'Transformation',
        prompt:
          'Digital transformation concept - butterfly emerging from binary code, morphing from pixels to organic form, blend of technology and nature.',
      },
    ],
  },
  {
    id: 'presentation',
    icon: Lightbulb,
    category: 'Presentations & Reports',
    templates: [
      {
        label: 'Strategy Cover',
        prompt:
          'Elegant corporate presentation cover - abstract blue waves forming a path towards light, professional and inspiring, suitable for strategy documents.',
      },
      {
        label: 'Report Header',
        prompt:
          'Clean, professional header image for business report - subtle geometric pattern in corporate blue, minimal and sophisticated design.',
      },
      {
        label: 'Roadmap Visual',
        prompt:
          'Illustrated roadmap with milestones - winding path through landscape of achievements, each milestone as a glowing beacon, optimistic and forward-looking.',
      },
    ],
  },
];

const STYLE_MODIFIERS = [
  { id: 'photorealistic', label: 'Photorealistic', modifier: 'photorealistic, ultra-detailed, 8k' },
  {
    id: 'minimalist',
    label: 'Minimalist',
    modifier: 'minimalist design, clean lines, simple composition',
  },
  { id: 'watercolor', label: 'Watercolor', modifier: 'watercolor painting style, soft edges, artistic' },
  { id: 'isometric', label: 'Isometric 3D', modifier: 'isometric 3D illustration, clean, modern' },
  { id: 'sketch', label: 'Sketch', modifier: 'pencil sketch style, detailed linework, artistic' },
  { id: 'neon', label: 'Neon', modifier: 'neon glow effects, cyberpunk aesthetic, vibrant colors' },
];

export const ImagePromptEnhancer: React.FC<ImagePromptEnhancerProps> = ({
  onPromptSelect,
  onEnhanceRequest,
  currentPrompt = '',
  isEnhancing = false,
}) => {
  const { t } = useTranslation();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const handleTemplateSelect = (prompt: string) => {
    let finalPrompt = prompt;
    if (selectedStyle) {
      const style = STYLE_MODIFIERS.find((s) => s.id === selectedStyle);
      if (style) {
        finalPrompt = `${prompt}. Style: ${style.modifier}`;
      }
    }
    onPromptSelect(finalPrompt);
  };

  const handleEnhance = () => {
    if (currentPrompt.trim()) {
      let promptToEnhance = currentPrompt;
      if (selectedStyle) {
        const style = STYLE_MODIFIERS.find((s) => s.id === selectedStyle);
        if (style) {
          promptToEnhance = `${currentPrompt}. Style: ${style.modifier}`;
        }
      }
      onEnhanceRequest(promptToEnhance);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Enhance Button */}
      {currentPrompt.trim() && (
        <div className="p-3 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('imageGen.enhancePrompt', 'Enhance your prompt')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('imageGen.enhanceDescription', 'AI will improve your prompt for better results')}
                </p>
              </div>
            </div>
            <button
              onClick={handleEnhance}
              disabled={isEnhancing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg transition-colors"
            >
              {isEnhancing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  {t('common.enhancing', 'Enhancing...')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('common.enhance', 'Enhance')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Style Modifiers */}
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
          {t('imageGen.styleModifiers', 'Style Modifiers')}
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLE_MODIFIERS.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                selectedStyle === style.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-600'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Templates */}
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
          {t('imageGen.templates', 'Quick Templates')}
        </p>
        <div className="space-y-2">
          {PROMPT_TEMPLATES.map((category) => {
            const Icon = category.icon;
            const isExpanded = expandedCategory === category.id;

            return (
              <div
                key={category.id}
                className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {category.category}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-2 space-y-1">
                    {category.templates.map((template, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTemplateSelect(template.prompt)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {template.label}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-2">
                          {template.prompt}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImagePromptEnhancer;
