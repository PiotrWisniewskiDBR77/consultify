/**
 * ArtifactPreviewCard — V5-IDEA-33
 *
 * Shared lightweight preview card for any platform artifact.
 * Uses the unified artifact identity contract (V5-IDEA-31).
 *
 * Supports: preview metadata, open action, remove link, pin primary.
 */
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  FileBarChart2,
  FileText,
  FolderKanban,
  Lightbulb,
  Presentation,
  Rocket,
  Scale,
  TrendingUp,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import React from 'react';

import type { ArtifactType } from '../../../utils/artifactLinks';
import { ARTIFACT_IDENTITY, buildArtifactCode } from '../../../utils/artifactLinks';

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Rocket,
  Lightbulb,
  CheckSquare,
  Scale,
  BookOpen,
  Wrench,
  CheckCircle2,
  FileBarChart2,
  Presentation,
  CalendarDays,
  Bell,
  FolderKanban,
  AlertTriangle,
  ExternalLink,
  Calculator,
  Wallet,
  TrendingUp,
  BarChart3,
  FileText,
};

const ACCENT_CLASSES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
    ring: 'ring-blue-400/30',
  },
  violet: {
    bg: 'bg-primary-500/10',
    text: 'text-primary-500',
    border: 'border-primary-500/20',
    ring: 'ring-c-info/30',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/20',
    ring: 'ring-emerald-400/30',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
    ring: 'ring-amber-400/30',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-500',
    border: 'border-indigo-500/20',
    ring: 'ring-indigo-400/30',
  },
  cyan: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
    ring: 'ring-blue-400/30',
  },
  slate: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-500/20',
    ring: 'ring-slate-400/30',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-500',
    border: 'border-fuchsia-500/20',
    ring: 'ring-fuchsia-400/30',
  },
  sky: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-500',
    border: 'border-sky-500/20',
    ring: 'ring-sky-400/30',
  },
  red: {
    bg: 'bg-danger-500/10',
    text: 'text-danger-500',
    border: 'border-danger-500/20',
    ring: 'ring-danger-400/30',
  },
  lime: {
    bg: 'bg-lime-500/10',
    text: 'text-lime-500',
    border: 'border-lime-500/20',
    ring: 'ring-lime-400/30',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20',
    ring: 'ring-green-400/30',
  },
  teal: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
    ring: 'ring-blue-400/30',
  },
  orange: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
    ring: 'ring-amber-400/30',
  },
};

export interface ArtifactPreviewMeta {
  status?: string;
  owner?: string;
  updatedAt?: string;
  due?: string;
  progress?: number;
  value?: string;
  spend?: string;
  stage?: string;
}

export interface ArtifactPreviewCardProps {
  artifactType: ArtifactType;
  artifactId: string;
  title: string;
  linkRole?: string;
  meta?: ArtifactPreviewMeta;
  onOpen?: () => void;
  onRemove?: () => void;
  onPin?: () => void;
  pinned?: boolean;
  compact?: boolean;
  isPl?: boolean;
}

export const ArtifactPreviewCard: React.FC<ArtifactPreviewCardProps> = ({
  artifactType,
  artifactId,
  title,
  linkRole,
  meta,
  onOpen,
  onRemove,
  compact = false,
  isPl = false,
}) => {
  const identity = ARTIFACT_IDENTITY[artifactType];
  const accent = ACCENT_CLASSES[identity?.accent || 'slate'] || ACCENT_CLASSES.slate;
  const IconComponent = ICON_MAP[identity?.icon || 'FileText'] || FileText;
  const code = buildArtifactCode(artifactType, artifactId);
  const label = isPl ? identity?.labelPl : identity?.labelEn;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${accent.bg} ${accent.text} border ${accent.border} hover:ring-1 ${accent.ring} transition-all cursor-pointer`}
        title={`${label}: ${title} (${code})`}
      >
        <IconComponent size={10} />
        <span className="truncate max-w-[100px]">{title}</span>
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border ${accent.border} ${accent.bg} p-2.5 group hover:ring-1 ${accent.ring} transition-all`}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 p-1 rounded-md ${accent.bg} ${accent.text}`}>
          <IconComponent size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-wider ${accent.text}`}>
              {label}
            </span>
            <span className="text-[8px] text-slate-600 dark:text-slate-500 font-mono">{code}</span>
            {linkRole && (
              <span className="text-[8px] text-slate-600 dark:text-slate-500 px-1 py-0.5 bg-slate-500/5 dark:bg-white/[0.04] rounded">
                {linkRole}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:underline truncate block w-full text-left mt-0.5"
          >
            {title}
          </button>
          {/* V5-IDEA-46: Dark/light parity for metadata */}
          {meta && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              {meta.status && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Status' : 'Status'}: {meta.status}
                </span>
              )}
              {meta.owner && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Właściciel' : 'Owner'}: {meta.owner}
                </span>
              )}
              {meta.updatedAt && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Zmieniono' : 'Updated'}: {meta.updatedAt}
                </span>
              )}
              {meta.due && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Termin' : 'Due'}: {meta.due}
                </span>
              )}
              {meta.progress != null && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Postęp' : 'Progress'}: {meta.progress}%
                </span>
              )}
              {meta.value && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Wartość' : 'Value'}: {meta.value}
                </span>
              )}
              {meta.stage && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Etap' : 'Stage'}: {meta.stage}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="p-1 rounded hover:bg-white/20 dark:hover:bg-white/5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
              title={isPl ? 'Otwórz artefakt' : 'Open artifact'}
            >
              <ExternalLink size={10} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded hover:bg-danger-500/10 text-slate-600 hover:text-danger-500"
              title={isPl ? 'Usuń link' : 'Remove link'}
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtifactPreviewCard;
