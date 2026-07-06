import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Copy,
  ExternalLink,
  Group,
  Link2,
  Lock,
  Rocket,
  Trash2,
  Ungroup,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ENTER_ANIMATION } from '../canvas/motionTokens';
import { ToolbarBtn, ToolbarDropdown } from './WhiteboardToolbarPrimitives';

export interface WhiteboardSelectionBarProps {
  isPl: boolean;
  locked: boolean;
  selectedCount: number;
  hasSelectedFrame: boolean;
  ideaId: string;
  /**
   * A4: ids of the currently selected nodes, forwarded as `nodeIds` on the
   * wb_convert_* dispatches so handleConvert scopes the conversion to the
   * selection explicitly (server converts the WHOLE idea when nodeIds are absent
   * and the parent's synced selection state comes up empty).
   */
  selectedNodeIds?: string[];
  onAlignNodes: (dir: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistributeNodes: (dir: 'horizontal' | 'vertical') => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
  onDuplicateSelected: () => void;
  onLockSelected: () => void;
  onDeleteSelected: () => void;
}

export const WhiteboardSelectionBar: React.FC<WhiteboardSelectionBarProps> = ({
  isPl,
  locked,
  selectedCount,
  hasSelectedFrame,
  ideaId,
  selectedNodeIds,
  onAlignNodes,
  onDistributeNodes,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onLockSelected,
  onDeleteSelected,
}) => {
  const { t } = useTranslation();
  if (selectedCount <= 0) return null;

  return (
    <div
      className={`absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-c-surface backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-white/[0.03] shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] px-2 py-1.5 ${ENTER_ANIMATION.slideUp}`}
      role="toolbar"
      aria-label={t('myWork.whiteboard.selectionBar.ariaLabel')}
    >
      <span className="px-2 text-[10px] font-semibold text-c-text-muted whitespace-nowrap">
        {t('myWork.whiteboard.selection.elementsSelected', { count: selectedCount })}
      </span>
      <ToolbarBtn
        icon={Link2}
        label={t('myWork.whiteboard.selectionBar.attach')}
        ariaLabel={t('myWork.whiteboard.selectionBar.attach')}
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', {
              detail: { action: 'attach_artifact', ideaId },
            })
          )
        }
        disabled={locked}
      />
      <ToolbarBtn
        icon={ExternalLink}
        label={t('myWork.whiteboard.selectionBar.linked')}
        ariaLabel={t('myWork.whiteboard.selectionBar.linked')}
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', {
              detail: { action: 'open_linked_artifacts', ideaId },
            })
          )
        }
      />
      <ToolbarBtn
        icon={Rocket}
        label={t('myWork.whiteboard.selectionBar.convertDecision')}
        ariaLabel={t('myWork.whiteboard.selectionBar.convertDecision')}
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', {
              detail: {
                action: 'wb_convert_decision',
                ideaId,
                ...(selectedNodeIds?.length ? { nodeIds: selectedNodeIds } : {}),
              },
            })
          )
        }
        disabled={locked}
      />
      <ToolbarBtn
        icon={CheckSquare}
        label={t('myWork.whiteboard.selectionBar.convertAction')}
        ariaLabel={t('myWork.whiteboard.selectionBar.convertAction')}
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', {
              detail: {
                action: 'wb_convert_action',
                ideaId,
                ...(selectedNodeIds?.length ? { nodeIds: selectedNodeIds } : {}),
              },
            })
          )
        }
        disabled={locked}
      />

      <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

      <ToolbarDropdown
        icon={AlignCenter}
        label={t('myWork.whiteboard.selectionBar.align')}
        disabled={locked || selectedCount < 2}
        items={[
          {
            id: 'left',
            label: t('myWork.whiteboard.selection.alignLeft'),
            icon: AlignLeft,
            onClick: () => onAlignNodes('left'),
          },
          {
            id: 'center',
            label: t('myWork.whiteboard.selection.alignCenter'),
            icon: AlignCenter,
            onClick: () => onAlignNodes('center'),
          },
          {
            id: 'right',
            label: t('myWork.whiteboard.selection.alignRight'),
            icon: AlignRight,
            onClick: () => onAlignNodes('right'),
          },
          {
            id: 'top',
            label: t('myWork.whiteboard.selection.alignTop'),
            icon: ArrowUp,
            onClick: () => onAlignNodes('top'),
          },
          {
            id: 'middle',
            label: t('myWork.whiteboard.selection.alignMiddle'),
            icon: AlignCenter,
            onClick: () => onAlignNodes('middle'),
          },
          {
            id: 'bottom',
            label: t('myWork.whiteboard.selection.alignBottom'),
            icon: ArrowDown,
            onClick: () => onAlignNodes('bottom'),
          },
        ]}
        onMainClick={() => onAlignNodes('left')}
      />
      <ToolbarDropdown
        icon={ArrowLeftRight}
        label={t('myWork.whiteboard.selectionBar.distribute')}
        disabled={locked || selectedCount < 3}
        items={[
          {
            id: 'dist_h',
            label: t('myWork.whiteboard.selection.distributeH'),
            icon: ArrowLeftRight,
            onClick: () => onDistributeNodes('horizontal'),
          },
          {
            id: 'dist_v',
            label: t('myWork.whiteboard.selection.distributeV'),
            icon: ArrowUpDown,
            onClick: () => onDistributeNodes('vertical'),
          },
        ]}
        onMainClick={() => onDistributeNodes('horizontal')}
      />

      <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

      <ToolbarBtn
        icon={Group}
        label={t('myWork.whiteboard.selection.group')}
        onClick={onGroupSelected}
        disabled={locked || selectedCount < 2}
        ariaLabel={t('myWork.whiteboard.selection.group')}
      />
      <ToolbarBtn
        icon={Ungroup}
        label={t('myWork.whiteboard.selection.ungroup')}
        onClick={onUngroupSelected}
        disabled={locked || !hasSelectedFrame}
        ariaLabel={t('myWork.whiteboard.selection.ungroup')}
      />
      <ToolbarBtn
        icon={Copy}
        label={t('myWork.whiteboard.selection.duplicate')}
        onClick={onDuplicateSelected}
        disabled={locked}
        ariaLabel={t('myWork.whiteboard.selection.duplicate')}
      />
      <ToolbarBtn
        icon={Lock}
        label={t('myWork.whiteboard.selection.lock')}
        onClick={onLockSelected}
        disabled={locked}
        ariaLabel={t('myWork.whiteboard.selection.lock')}
      />
      <ToolbarBtn
        icon={Trash2}
        label={t('myWork.whiteboard.selection.delete')}
        onClick={onDeleteSelected}
        disabled={locked}
        danger
        ariaLabel={t('myWork.whiteboard.selection.delete')}
      />
    </div>
  );
};
