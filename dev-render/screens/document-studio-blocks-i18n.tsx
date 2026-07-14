/**
 * Dev-render host dla M18 punkt 3 — weryfikacja i18n pustych stanów bloków
 * dokumentu (DocTableBlock/DocKpiStrip/DocChartBlock, wcześniej EN-only
 * niezależnie od języka UI) + DocumentInlineAIMenu (wcześniej hardkodowane
 * PL niezależnie od języka UI, plus martwe `labelEn`).
 *
 * URL params: ?screen=document-studio-blocks-i18n&theme=light|dark&lang=pl|en
 */
import React from 'react';

import type { NarrowedTableContent } from '@/components/DocumentStudio/blocks/docBlockContent';
import { DocChartBlock } from '@/components/DocumentStudio/blocks/DocChartBlock';
import { DocKpiStrip } from '@/components/DocumentStudio/blocks/DocKpiStrip';
import { DocTableBlock } from '@/components/DocumentStudio/blocks/DocTableBlock';
import type { DocumentChartBlockContent } from '@/components/DocumentStudio/types';

const emptyTable: NarrowedTableContent = { columns: [], rows: [] };
const emptyChart: DocumentChartBlockContent = {
  kind: 'bar',
  title: '',
  series: [],
  categories: [],
};

export default function DocumentStudioBlocksI18nScreen(): React.ReactElement {
  return (
    <div className="flex h-screen w-full flex-col gap-6 overflow-y-auto bg-slate-50 p-8 dark:bg-navy-950">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          DocTableBlock — empty state
        </h3>
        <DocTableBlock content={emptyTable} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          DocKpiStrip — empty state
        </h3>
        <DocKpiStrip content={{ items: [] }} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          DocChartBlock — empty state
        </h3>
        <DocChartBlock content={emptyChart} />
      </div>
    </div>
  );
}
