/**
 * F1/F3 — Client Reader block renderer (`ff_client_reader`).
 *
 * Read-only React rendering of a single `ReaderBlock`. Mirrors the content
 * shapes the server's canonical markdown renderer uses
 * (`server/src/services/documentStudio/documentSchemaRenderer.ts`), and
 * reuses the SAME pure block components the editor canvas uses for
 * table / risk_table / kpi_strip / chart (`../blocks/*`) — those are
 * already display-only (props in → JSX out, no TipTap, no edit
 * affordances), so they are safe to drop into an anonymous public page
 * verbatim.
 *
 * Zero crimson — neutral `c-*` tokens only, "document reading" typography
 * (serif-free, generous line-height, ~72ch measure enforced by the page
 * shell, not here).
 */

import React from 'react';

import {
  DocChartBlock,
  DocKpiStrip,
  DocTableBlock,
  narrowChartContent,
  narrowKpiContent,
  narrowTableContent,
} from '../blocks';
import type { ReaderBlock } from './clientReaderApi';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function AssumptionTag(): React.ReactElement {
  return (
    <span className="ml-1.5 rounded-full bg-c-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-c-text-secondary align-middle">
      Założenie
    </span>
  );
}

export function ReaderBlockRenderer({ block }: { block: ReaderBlock }): React.ReactElement | null {
  const content = asRecord(block.content);

  switch (block.type) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(content.level) || 2));
      const text = typeof content.text === 'string' ? content.text : '';
      const Tag = `h${level + 1}` as 'h2' | 'h3' | 'h4';
      const sizeClass = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
      return (
        <Tag className={`${sizeClass} font-semibold text-c-text mt-6 mb-2 first:mt-0`}>{text}</Tag>
      );
    }

    case 'paragraph': {
      const text = typeof content.text === 'string' ? content.text : '';
      if (!text) return null;
      return (
        <p className="text-[15px] leading-7 text-c-text mb-4 whitespace-pre-wrap">
          {text}
          {block.isAssumption ? <AssumptionTag /> : null}
        </p>
      );
    }

    case 'bullet_list':
    case 'numbered_list': {
      const items = Array.isArray(content.items) ? (content.items as unknown[]) : [];
      if (items.length === 0) return null;
      const ListTag = block.type === 'numbered_list' ? 'ol' : 'ul';
      return (
        <ListTag
          className={`mb-4 space-y-1.5 pl-5 text-[15px] leading-7 text-c-text ${
            block.type === 'numbered_list' ? 'list-decimal' : 'list-disc'
          }`}
        >
          {items.map((item, index) => (
            <li key={index}>{typeof item === 'string' ? item : String(item ?? '')}</li>
          ))}
        </ListTag>
      );
    }

    case 'callout': {
      const variant = typeof content.variant === 'string' ? content.variant : 'info';
      const text = typeof content.text === 'string' ? content.text : '';
      return (
        <div className="mb-4 rounded-lg border border-c-border-subtle bg-c-surface-raised px-4 py-3 text-[14px] text-c-text">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary">
            {variant}
          </div>
          {text}
        </div>
      );
    }

    case 'quote': {
      const text = typeof content.text === 'string' ? content.text : '';
      if (!text) return null;
      return (
        <blockquote className="mb-4 border-l-2 border-c-border-subtle pl-4 text-[15px] italic leading-7 text-c-text-secondary">
          {text}
        </blockquote>
      );
    }

    case 'table':
    case 'risk_table': {
      const narrowed = narrowTableContent(block.content, {
        riskSemantics: block.type === 'risk_table',
      });
      if (!narrowed) return null;
      return (
        <div className="mb-4">
          <DocTableBlock content={narrowed} />
        </div>
      );
    }

    case 'kpi_strip': {
      const narrowed = narrowKpiContent(block.content);
      if (!narrowed) return null;
      return (
        <div className="mb-4">
          <DocKpiStrip content={narrowed} />
        </div>
      );
    }

    case 'chart': {
      const narrowed = narrowChartContent(block.content);
      if (!narrowed) return null;
      return (
        <div className="mb-4">
          <DocChartBlock content={narrowed} />
        </div>
      );
    }

    case 'image': {
      const url = typeof content.url === 'string' ? content.url : '';
      const alt = typeof content.alt === 'string' ? content.alt : '';
      if (!url) return null;
      return (
        <figure className="mb-4">
          <img
            src={url}
            alt={alt}
            className="max-w-full rounded-lg border border-c-border-subtle"
          />
          {alt ? (
            <figcaption className="mt-1 text-xs text-c-text-secondary">{alt}</figcaption>
          ) : null}
        </figure>
      );
    }

    case 'footnote':
    case 'citation': {
      const text = typeof content.text === 'string' ? content.text : '';
      if (!text) return null;
      return <p className="mb-4 text-xs text-c-text-secondary">{text}</p>;
    }

    default:
      return null;
  }
}

export default ReaderBlockRenderer;
