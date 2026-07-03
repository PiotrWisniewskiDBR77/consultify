import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TabelePreviewSchemaField } from '@/types/tabeleArtifact';

interface TabeleSchemaBlockProps {
  field: TabelePreviewSchemaField;
  onClickProposal?: (proposalId: string) => void;
}

const GOVERNANCE_STYLES = {
  committed:
    'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
  proposed:
    'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
  rejected:
    'border-danger-300/80 bg-danger-50 text-danger-900 dark:border-danger-300/[0.25] dark:bg-danger-300/[0.12] dark:text-danger-100',
} as const;

function getGovernanceIcon(state: NonNullable<TabelePreviewSchemaField['governanceState']>) {
  if (state === 'proposed') return Clock3;
  if (state === 'rejected') return XCircle;
  return CheckCircle2;
}

export function TabeleSchemaBlock({ field, onClickProposal }: TabeleSchemaBlockProps) {
  const { t } = useTranslation();
  const governanceState = field.governanceState ?? 'committed';
  const GovernanceIcon = getGovernanceIcon(governanceState);
  const canOpenProposal = Boolean(field.proposalId && onClickProposal);
  const Component = canOpenProposal ? 'button' : 'div';

  const governanceLabel =
    governanceState === 'proposed'
      ? t('kimi.tabele.schema.proposed', { defaultValue: 'Proposed' })
      : governanceState === 'rejected'
        ? t('kimi.tabele.schema.rejected', { defaultValue: 'Rejected' })
        : t('kimi.tabele.schema.committed', { defaultValue: 'Committed' });

  return (
    <Component
      type={canOpenProposal ? 'button' : undefined}
      onClick={canOpenProposal ? () => onClickProposal?.(field.proposalId as string) : undefined}
      className={`group w-full rounded-hig-md border border-c-border-subtle bg-c-surface px-4 py-3 text-left transition-colors hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
        canOpenProposal ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <code className="font-mono text-sm font-semibold text-c-text">
            {field.name || t('kimi.tabele.schema.unnamedField', { defaultValue: 'unnamed_field' })}
          </code>
          <p className="mt-1 text-xs leading-relaxed text-c-text-secondary">
            {field.description?.trim()
              ? field.description.trim()
              : field.proposalId
                ? t('kimi.tabele.schema.proposalCaption', {
                    defaultValue: 'Linked to schema proposal {{proposalId}}',
                    proposalId: field.proposalId,
                  })
                : // No authored description: show an honest, field-derived caption
                  // (the field's own type token) instead of a shared boilerplate
                  // placeholder that read identically on every row (HOTFIX #62 UI-M6).
                  t('kimi.tabele.schema.typeCaption', {
                    defaultValue: '{{fieldType}} field',
                    fieldType: field.fieldType || t('kimi.tabele.schema.defaultType', {
                      defaultValue: 'text',
                    }),
                  })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-hig-full border border-c-border bg-c-surface-raised px-2.5 py-1 font-mono text-xs font-medium text-c-text/[0.11]/[0.075]">
            {field.fieldType || t('kimi.tabele.schema.defaultType', { defaultValue: 'text' })}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-hig-full border px-2.5 py-1 text-xs font-medium ${GOVERNANCE_STYLES[governanceState]}`}
          >
            <GovernanceIcon size={13} aria-hidden="true" />
            {governanceLabel}
          </span>
        </div>
      </div>
    </Component>
  );
}

export default TabeleSchemaBlock;
