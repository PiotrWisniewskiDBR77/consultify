/**
 * Mind Map → Unified Report JSON mapper
 *
 * M06 FALA3 3.4 — feeds the mind map's branch data into the same BCG-grade
 * `PptxPipelineService.generateFromUnifiedJson` pipeline used by Report
 * Builder, so the mind-map ".pptx" export becomes a REAL PowerPoint file
 * instead of the legacy HTML blob (see ExportPowerPoint.tsx).
 *
 * Shape mirrors the FE payload built in IdeaRecommendationMap.tsx (search
 * `branches={nodes` / `<ExportPowerPoint`):
 *   branches: Array<{ branchKey, label, nodes: Array<{ id, label, status? }> }>
 *
 * Slide layout:
 *   1. Cover slide — idea title + branch/idea counts.
 *   2. One `section_intro` + `key_messages` slide pair per branch (branch
 *      title, then its ideas as bullet messages).
 *   3. Pipeline appends its own closing slide automatically.
 */
import type { UnifiedReportJSON } from '../report/pptx/types.js';

export interface MindMapBranchNode {
  id: string;
  label: string;
  status?: string;
}

export interface MindMapBranch {
  branchKey: string;
  label: string;
  nodes: MindMapBranchNode[];
}

export interface MindMapExportOptions {
  language?: 'en' | 'pl';
  template?: 'corporate' | 'minimal' | 'modern';
  confidentiality?: 'confidential' | 'internal' | 'public';
  author?: string;
  organizationName?: string;
}

const MAX_KEY_MESSAGES_PER_SLIDE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out.length ? out : [[]];
}

function branchNodeIcon(status?: string): string | undefined {
  const s = String(status || '').toLowerCase();
  if (s === 'done' || s === 'completed') return 'check';
  if (s === 'blocked' || s === 'risk') return 'alert';
  if (s === 'in_progress' || s === 'active') return 'clock';
  return undefined;
}

/**
 * Maps a mind map (idea title + branches) into `UnifiedReportJSON`, the SSOT
 * input consumed by `PptxPipelineService.generateFromUnifiedJson`.
 *
 * Pure function — no I/O, no DB access — so it is fully unit-testable.
 */
export function mapMindMapToUnifiedReport(
  ideaTitle: string,
  branches: MindMapBranch[],
  options: MindMapExportOptions = {}
): UnifiedReportJSON {
  const language = options.language === 'en' ? 'en' : 'pl';
  const isPl = language === 'pl';
  const safeTitle = String(ideaTitle || (isPl ? 'Mapa myśli' : 'Mind Map')).trim();
  const totalIdeas = branches.reduce((sum, b) => sum + (b.nodes?.length || 0), 0);

  const meta: UnifiedReportJSON['meta'] = {
    client: options.organizationName || 'Consultify',
    project: safeTitle,
    date: new Date().toISOString().slice(0, 10),
    author: options.author || 'Consultify',
    confidentiality: options.confidentiality || 'internal',
    sourceType: 'MIND_MAP',
    language,
    template: options.template || 'corporate',
  };

  const slides: UnifiedReportJSON['slides'] = [];

  // 1. Cover slide
  slides.push({
    intent: 'cover',
    key_message: safeTitle,
    content: {
      type: 'cover',
      title: safeTitle,
      subtitle: isPl
        ? `${branches.length} gałęzi · ${totalIdeas} pomysłów`
        : `${branches.length} branches · ${totalIdeas} ideas`,
      organization: meta.client,
      date: meta.date,
      confidentiality: meta.confidentiality,
    },
  });

  // 2. One (or more, if a branch has many ideas) slide per branch.
  for (const branch of branches) {
    const label = String(branch.label || branch.branchKey || (isPl ? 'Gałąź' : 'Branch')).trim();
    const nodes = Array.isArray(branch.nodes) ? branch.nodes : [];

    slides.push({
      intent: 'section_intro',
      key_message: label,
      content: {
        type: 'section_intro',
        section_title: label,
        description: isPl ? `${nodes.length} pomysłów` : `${nodes.length} ideas`,
      },
    });

    if (nodes.length === 0) {
      slides.push({
        intent: 'key_messages',
        key_message: label,
        content: {
          type: 'key_messages',
          messages: [
            {
              title: isPl ? 'Brak pomysłów' : 'No ideas yet',
              description: '',
            },
          ],
        },
      });
      continue;
    }

    const pages = chunk(nodes, MAX_KEY_MESSAGES_PER_SLIDE);
    for (const page of pages) {
      slides.push({
        intent: 'key_messages',
        key_message: label,
        content: {
          type: 'key_messages',
          messages: page.map((n) => ({
            title: String(n.label || '').trim() || (isPl ? '(bez nazwy)' : '(untitled)'),
            description: n.status ? String(n.status) : '',
            icon: branchNodeIcon(n.status),
          })),
        },
      });
    }
  }

  return { meta, slides };
}

export default mapMindMapToUnifiedReport;
