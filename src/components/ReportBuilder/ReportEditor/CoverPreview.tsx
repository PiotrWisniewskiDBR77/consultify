/**
 * Cover block preview (Wpis 88 / D-75a): the cover section is generated as JSON
 * (`reportGenerationService` prompts for title/subtitle/companyName/date), but
 * LLM output sometimes arrives fenced (```json …```) or with prose around the
 * object. The old renderers only parsed content that started with `{`, so
 * anything else fell through to markdown and the owner saw the raw JSON dump
 * on the card. One extractor + one preview shared by the card (BlockCard) and
 * the View modal (renderCoverPage).
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

export interface CoverFields {
  title: string;
  subtitle: string;
  company: string;
  date: string;
  assessmentType: string;
}

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function parseCoverContent(content: string): CoverFields | null {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const candidates: string[] = [unfenced];
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(unfenced.slice(start, end + 1));

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    // Double-encoded cover: JSON string holding the JSON object.
    for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
      try {
        parsed = JSON.parse(parsed as string);
      } catch {
        parsed = null;
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const p = parsed as Record<string, unknown>;
      return {
        title: asText(p.title),
        subtitle: asText(p.subtitle),
        company: asText(p.companyName ?? p.company),
        date: asText(p.date),
        assessmentType: asText(p.assessmentType),
      };
    }
  }
  return null;
}

export function looksLikeCoverJson(content: string): boolean {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .trim();
  return unfenced.startsWith('{') || unfenced.startsWith('"');
}

export const CoverPreview: React.FC<{ content: string }> = ({ content }) => {
  const { t } = useTranslation();
  const fallbackTitle = t('reportBuilder.coverPreview.fallbackTitle', 'Report');
  const fields = parseCoverContent(content);

  if (!fields) {
    // Unparsable JSON must never reach the owner as a raw dump; plain markdown
    // covers (seeded documents) keep rendering as markdown.
    if (looksLikeCoverJson(content)) {
      return (
        <div className="text-center py-6 px-4">
          <h3 className="text-xl font-bold text-c-text mb-1">{fallbackTitle}</h3>
        </div>
      );
    }
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="text-center py-6 px-4">
      <h3 className="text-xl font-bold text-c-text mb-1">{fields.title || fallbackTitle}</h3>
      {fields.subtitle ? (
        <p className="text-sm text-c-text-secondary mb-3">{fields.subtitle}</p>
      ) : null}
      {fields.company || fields.date ? (
        <div className="flex items-center justify-center gap-2 text-xs text-c-text-secondary">
          {fields.company ? <span>{fields.company}</span> : null}
          {fields.company && fields.date ? <span>·</span> : null}
          {fields.date ? <span>{fields.date}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

export default CoverPreview;
