import { arrow, autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Info, Loader2 } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TabelePreviewRelation } from '@/types/tabeleArtifact';

interface TabeleRelationChipProps {
  relation: TabelePreviewRelation;
  rationale?: string;
  loading?: boolean;
  onLoadRationale?: (relation: TabelePreviewRelation) => void;
}

export function TabeleRelationChip({
  relation,
  rationale,
  loading = false,
  onLoadRationale,
}: TabeleRelationChipProps) {
  const { t } = useTranslation();
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const hasRequestedRationale = useRef(false);

  useEffect(() => {
    if (!isOpen || !buttonRef.current || !tooltipRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current || !tooltipRef.current) return;

      computePosition(buttonRef.current, tooltipRef.current, {
        placement: 'top-start',
        middleware: [
          offset(10),
          flip(),
          shift({ padding: 12 }),
          arrow({ element: arrowRef.current! }),
        ],
      }).then(({ x, y, placement, middlewareData }) => {
        if (!tooltipRef.current) return;
        Object.assign(tooltipRef.current.style, {
          left: `${x}px`,
          top: `${y}px`,
        });

        const { x: arrowX, y: arrowY } = middlewareData.arrow ?? {};
        const staticSide = {
          top: 'bottom',
          right: 'left',
          bottom: 'top',
          left: 'right',
        }[placement.split('-')[0]];

        if (arrowRef.current && staticSide) {
          Object.assign(arrowRef.current.style, {
            left: arrowX != null ? `${arrowX}px` : '',
            top: arrowY != null ? `${arrowY}px` : '',
            right: '',
            bottom: '',
            [staticSide]: '-4px',
          });
        }
      });
    };

    return autoUpdate(buttonRef.current, tooltipRef.current, updatePosition);
  }, [isOpen]);

  const openTooltip = () => {
    setIsOpen(true);
    if (!hasRequestedRationale.current && rationale === undefined && onLoadRationale) {
      hasRequestedRationale.current = true;
      onLoadRationale(relation);
    }
  };

  const closeTooltip = () => setIsOpen(false);

  const tooltipBody = loading
    ? t('kimi.tabele.relations.loadingRationale', { defaultValue: 'Loading relation rationale...' })
    : rationale ||
      t('kimi.tabele.relations.noRationale', {
        defaultValue: 'Relation rationale is not available in this preview.',
      });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-describedby={isOpen ? tooltipId : undefined}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onClick={openTooltip}
        className="inline-flex items-center gap-2 rounded-hig-full border border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus dark:hover:border-sky-300/[0.35] dark:hover:bg-sky-300/[0.10]"
      >
        <span className="font-mono">{relation.fieldName}</span>
        <span aria-hidden="true" className="text-c-text-secondary">
          {'->'}
        </span>
        <span>{relation.targetTableName}</span>
        <span className="rounded-hig-full bg-c-surface px-1.5 py-0.5 text-[10px] text-c-text-secondary">
          {relation.targetCount}
        </span>
        {loading ? (
          <Loader2 size={13} className="animate-spin text-c-text-secondary" aria-hidden="true" />
        ) : (
          <Info size={13} className="text-c-text-secondary" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="fixed z-50 w-72 rounded-hig-md border border-c-border-subtle bg-c-surface p-3 text-xs leading-relaxed text-c-text shadow-xl"
        >
          <div ref={arrowRef} className="absolute h-2 w-2 rotate-45 bg-c-surface" />
          <p className="font-semibold text-c-text">
            {t('kimi.tabele.relations.tooltipTitle', { defaultValue: 'Relation explainability' })}
          </p>
          <p className="mt-1">{tooltipBody}</p>
          <p className="mt-2 text-[11px] text-c-text-secondary">
            {t('kimi.tabele.relations.tooltipSource', {
              defaultValue: 'Source: ACL-filtered table relation metadata',
            })}
          </p>
        </div>
      )}
    </>
  );
}

export default TabeleRelationChip;
