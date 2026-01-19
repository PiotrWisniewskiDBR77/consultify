/**
 * ImageGenerationCard - Displays generated AI images
 * Shows the image with options to download, copy, or regenerate
 *
 * @version 1.0.0
 */

import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ImageGenerationCardProps {
  imageUrl: string;
  prompt: string;
  revisedPrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  isLoading?: boolean;
  error?: string;
  onRegenerate?: (prompt: string) => void;
  onVariation?: (prompt: string) => void;
}

export const ImageGenerationCard: React.FC<ImageGenerationCardProps> = ({
  imageUrl,
  prompt,
  revisedPrompt,
  size = '1024x1024',
  quality = 'standard',
  style = 'vivid',
  isLoading = false,
  error,
  onRegenerate,
  onVariation,
}) => {
  const { t } = useTranslation();
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showZoom, setShowZoom] = useState(false);

  const handleCopyPrompt = async () => {
    const textToCopy = revisedPrompt || prompt;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download image:', err);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(imageUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
        <div className="aspect-square flex items-center justify-center bg-slate-50 dark:bg-navy-900">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('imageGen.generating', 'Generating image...')}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t('imageGen.mayTakeTime', 'This may take 10-30 seconds')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 overflow-hidden p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {t('imageGen.error', 'Image generation failed')}
            </p>
            <p className="text-sm text-red-600 dark:text-red-500 mt-1">{error}</p>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(prompt)}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
              >
                <RefreshCw size={14} />
                {t('imageGen.tryAgain', 'Try Again')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden group">
        {/* Image Container */}
        <div className="relative aspect-square bg-slate-100 dark:bg-navy-900">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
          <img
            src={imageUrl}
            alt={prompt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => setShowZoom(true)}
              className="p-2 bg-white/90 dark:bg-navy-800/90 rounded-lg hover:bg-white dark:hover:bg-navy-700 transition-colors"
              title={t('imageGen.zoom', 'Zoom')}
            >
              <ZoomIn size={18} className="text-slate-700 dark:text-slate-300" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-white/90 dark:bg-navy-800/90 rounded-lg hover:bg-white dark:hover:bg-navy-700 transition-colors"
              title={t('imageGen.download', 'Download')}
            >
              <Download size={18} className="text-slate-700 dark:text-slate-300" />
            </button>
            <button
              onClick={handleOpenInNewTab}
              className="p-2 bg-white/90 dark:bg-navy-800/90 rounded-lg hover:bg-white dark:hover:bg-navy-700 transition-colors"
              title={t('imageGen.openInNewTab', 'Open in new tab')}
            >
              <ExternalLink size={18} className="text-slate-700 dark:text-slate-300" />
            </button>
          </div>

          {/* Quality Badge */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span className="px-2 py-0.5 text-[10px] font-medium bg-white/90 dark:bg-navy-800/90 text-slate-600 dark:text-slate-400 rounded-full">
              {size}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-white/90 dark:bg-navy-800/90 text-slate-600 dark:text-slate-400 rounded-full capitalize">
              {quality}
            </span>
          </div>
        </div>

        {/* Prompt Section */}
        <div className="p-3 border-t border-slate-200 dark:border-navy-700">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm text-slate-600 dark:text-slate-400 ${showFullPrompt ? '' : 'line-clamp-2'}`}
              >
                {revisedPrompt || prompt}
              </p>
              {(revisedPrompt || prompt).length > 100 && (
                <button
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                  className="text-xs text-primary-500 hover:text-primary-600 mt-1"
                >
                  {showFullPrompt
                    ? t('common.showLess', 'Show less')
                    : t('common.showMore', 'Show more')}
                </button>
              )}
            </div>
            <button
              onClick={handleCopyPrompt}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors shrink-0"
              title={t('imageGen.copyPrompt', 'Copy prompt')}
            >
              {copied ? (
                <Check size={14} className="text-green-500" />
              ) : (
                <Copy size={14} className="text-slate-400" />
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(revisedPrompt || prompt)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 rounded-lg transition-colors"
              >
                <RefreshCw size={14} />
                {t('imageGen.regenerate', 'Regenerate')}
              </button>
            )}
            {onVariation && (
              <button
                onClick={() => onVariation(revisedPrompt || prompt)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                <Sparkles size={14} />
                {t('imageGen.variation', 'Variation')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Modal */}
      {showZoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowZoom(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={imageUrl}
              alt={prompt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setShowZoom(false)}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <span className="sr-only">{t('common.close', 'Close')}</span>
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageGenerationCard;
