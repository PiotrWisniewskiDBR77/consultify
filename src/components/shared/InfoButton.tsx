/**
 * InfoButton Component
 *
 * Reusable documentation button that shows help content for cards/sections.
 * Click opens a slide-out panel with documentation.
 * Features subtle animated color pulse for discoverability.
 */

import {
  Book,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { getCardDocumentation } from '../../config/cardDocumentation';

// CSS for card info button animation
const infoAnimationStyle = `
@keyframes infoColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #A51C30 0%, #651120 100%);
        box-shadow: 0 0 8px rgba(165, 28, 48, 0.3);
    }
    50% {
        background: linear-gradient(135deg, #D42B3D 0%, #851627 100%);
        box-shadow: 0 0 12px rgba(165, 28, 48, 0.4);
    }
}

@keyframes infoIconGlow {
    0%, 100% {
        filter: drop-shadow(0 0 1px rgba(255,255,255,0.2));
    }
    50% {
        filter: drop-shadow(0 0 4px rgba(255,255,255,0.5));
    }
}
`;

interface InfoButtonProps {
  cardId: string;
  position?: 'top-right' | 'header-inline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({
  cardId,
  position = 'top-right',
  size = 'md',
  className = '',
  showLabel = false,
  label = 'Help',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const docs = getCardDocumentation(cardId);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (!docs) {
    console.warn(`[InfoButton] No documentation found for cardId: ${cardId}`);
    return null;
  }

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  const positionClasses =
    position === 'top-right' ? 'absolute top-3 right-3' : 'relative inline-flex';

  return (
    <>
      <style>{infoAnimationStyle}</style>
      {/* Info Button */}
      <button
        ref={buttonRef}
        data-info-button
        onClick={() => setIsOpen(!isOpen)}
        className={`
                    ${positionClasses}
                    ${showLabel ? 'px-3 py-2 gap-2' : sizeClasses[size]}
                    flex items-center justify-center
                    rounded-xl
                    text-white
                    transition-all duration-200
                    z-10
                    group
                    ${className}
                `}
        style={{
          animation: isOpen ? 'none' : 'infoColorPulse 5s ease-in-out infinite',
          background: isOpen ? 'linear-gradient(135deg, #851627 0%, #651120 100%)' : undefined,
        }}
        title="View documentation"
        aria-label="View documentation"
      >
        <HelpCircle
          size={iconSizes[size]}
          style={{ animation: isOpen ? 'none' : 'infoIconGlow 5s ease-in-out infinite' }}
        />
        {showLabel && <span className="text-sm font-medium">{label}</span>}
      </button>

      {/* Documentation Panel - Slide out from right */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-navy-900 shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Book size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{docs.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Documentation</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Description */}
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {docs.description}
                </p>
              </div>

              {/* Features */}
              {docs.features && docs.features.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    Features
                  </h3>
                  <ul className="space-y-2">
                    {docs.features.map((feature: any, index: number) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                      >
                        <ChevronRight
                          size={14}
                          className="text-slate-600 dark:text-slate-500 mt-0.5 shrink-0"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* How to Use */}
              {docs.howToUse && docs.howToUse.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Book size={16} className="text-blue-500" />
                    How to Use
                  </h3>
                  <ol className="space-y-3">
                    {docs.howToUse.map((step: any, index: number) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tips */}
              {docs.tips && docs.tips.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                    <Lightbulb size={16} />
                    Tips
                  </h3>
                  <ul className="space-y-2">
                    {docs.tips.map((tip: any, index: number) => (
                      <li key={index} className="text-sm text-amber-700 dark:text-amber-300/80">
                        • {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Docs */}
              {docs.relatedDocs && docs.relatedDocs.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <ExternalLink size={16} className="text-primary-500" />
                    Related Documentation
                  </h3>
                  <div className="space-y-2">
                    {docs.relatedDocs.map((doc: any, index: number) => {
                      const normalizedDoc =
                        typeof doc === 'string' ? { title: doc, url: '#' } : doc;

                      return (
                        <a
                          key={index}
                          href={normalizedDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors group"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {normalizedDoc.title}
                          </span>
                          <ExternalLink
                            size={14}
                            className="text-slate-600 dark:text-slate-500 group-hover:text-blue-500 ml-auto"
                          />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Need more help? Contact support or check the full documentation.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default InfoButton;
