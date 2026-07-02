/**
 * Section icon resolver (M13 Depth · Seria K · K2 — CardContainer).
 *
 * Maps a `SectionTypeInfo.icon` name (string, registry-driven) to a Lucide
 * component so the shared CardContainer can render a section's visual identity
 * from the registry instead of each section hard-coding its own icon.
 */
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileText,
  Flag,
  GitBranch,
  Layers,
  LayoutGrid,
  Link2,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Paperclip,
  Scale,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';

/** Curated name → icon map (lower-cased lookup, tolerant of common aliases). */
const ICONS: Record<string, LucideIcon> = {
  filetext: FileText,
  file: FileText,
  description: FileText,
  target: Target,
  targetstate: Target,
  scope: Layers,
  layers: Layers,
  tasks: CheckSquare,
  checksquare: CheckSquare,
  listchecks: ListChecks,
  decisions: Scale,
  scale: Scale,
  gates: Flag,
  flag: Flag,
  timeline: Calendar,
  calendar: Calendar,
  team: Users,
  users: Users,
  raci: Users,
  kpis: BarChart3,
  barchart: BarChart3,
  metrics: TrendingUp,
  okr: Target,
  financial: DollarSign,
  finance: DollarSign,
  dollarsign: DollarSign,
  raid: AlertTriangle,
  risk: AlertTriangle,
  alerttriangle: AlertTriangle,
  dependencies: GitBranch,
  gitbranch: GitBranch,
  links: Link2,
  link: Link2,
  attachments: Paperclip,
  paperclip: Paperclip,
  comments: MessageSquare,
  messagesquare: MessageSquare,
  activity: Activity,
  activitylog: Activity,
  changelog: ClipboardList,
  clipboard: ClipboardList,
  hypothesis: Sparkles,
  sparkles: Sparkles,
  control: Settings2,
  settings: Settings2,
};

export function resolveSectionIcon(name?: string | null): LucideIcon {
  if (!name) return LayoutGrid;
  const key = String(name).toLowerCase().replace(/[^a-z]/g, '');
  return ICONS[key] || LayoutGrid;
}

/** Render a section's icon from its registry name + color class. */
export function SectionIcon({
  name,
  color,
  size = 18,
}: {
  name?: string | null;
  color?: string | null;
  size?: number;
}): React.ReactElement {
  const Icon = resolveSectionIcon(name);
  return <Icon size={size} className={color || 'text-slate-500 dark:text-slate-400'} />;
}

export default SectionIcon;
