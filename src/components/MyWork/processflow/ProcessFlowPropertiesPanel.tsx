import { ChevronDown, Clock, DollarSign, Layers, Server, Tag, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Edge, Node } from 'reactflow';

import { CONDITION_TYPES, EDGE_KINDS, type EdgeKind } from './FlowEdgeComponent';

const inputClass =
  'w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:ring-2 focus:ring-c-info outline-none';

const sectionHeaderClass = 'text-xs font-semibold uppercase tracking-wider text-c-text-muted mb-2';

const GATEWAY_SHAPES = new Set(['decision', 'bpmn_gateway', 'auto_condition']);

type EdgeCondition = (typeof CONDITION_TYPES)[number];

interface ProcessFlowPropertiesPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  lanes: { id: string; label: string; color: string }[];
  isPl: boolean;
  locked: boolean;
  onNodeLabelChange: (nodeId: string, label: string) => void;
  onGatewayKindChange: (nodeId: string, kind: 'xor' | 'and') => void;
  onLaneChange: (nodeId: string, laneId: string) => void;
  onEdgeLabelChange: (edgeId: string, label: string) => void;
  onNodeMetricsChange: (
    nodeId: string,
    metrics: { duration?: string; durationUnit?: string; cost?: string; fteCount?: string }
  ) => void;
  /** Persist edge `data.conditionType` (yes / no / default / exception). */
  onEdgeConditionChange?: (edgeId: string, conditionType: EdgeCondition) => void;
  /** F5a A2: persist edge `data.edgeKind` (sequence / conditional / message). */
  onEdgeKindChange?: (edgeId: string, kind: EdgeKind) => void;
  /** F5a A1: toggle orthogonal routing (`data.orthogonal`) for the edge. */
  onEdgeOrthogonalToggle?: (edgeId: string, orthogonal: boolean) => void;
  /** Persist description, assignee, and system fields on node `data`. */
  onNodeMetadataChange?: (
    nodeId: string,
    metadata: { description?: string; assignee?: string; system?: string }
  ) => void;
}

export const ProcessFlowPropertiesPanel: React.FC<ProcessFlowPropertiesPanelProps> = ({
  selectedNode,
  selectedEdge,
  lanes,
  locked,
  onNodeLabelChange,
  onGatewayKindChange,
  onLaneChange,
  onEdgeLabelChange,
  onEdgeConditionChange = () => {},
  onEdgeKindChange = () => {},
  onEdgeOrthogonalToggle = () => {},
  onNodeMetricsChange,
  onNodeMetadataChange = () => {},
}) => {
  const { t } = useTranslation();
  const [labelDraft, setLabelDraft] = useState('');
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [systemDraft, setSystemDraft] = useState('');
  const [durationDraft, setDurationDraft] = useState('');
  const [durationUnitDraft, setDurationUnitDraft] = useState('h');
  const [costDraft, setCostDraft] = useState('');
  const [fteDraft, setFteDraft] = useState('');

  const syncFromNode = useCallback((n: Node | null) => {
    if (!n) return;
    const d = n.data || {};
    setLabelDraft(String(d.label ?? ''));
    setDescriptionDraft(String(d.description ?? ''));
    setAssigneeDraft(String(d.assignee ?? d.owner ?? ''));
    setSystemDraft(String(d.system ?? ''));
    setDurationDraft(d.duration != null ? String(d.duration) : '');
    setDurationUnitDraft(String(d.durationUnit ?? 'h'));
    setCostDraft(d.cost != null ? String(d.cost) : '');
    setFteDraft(d.fteCount != null ? String(d.fteCount) : '');
  }, []);

  useEffect(() => {
    if (selectedNode) {
      syncFromNode(selectedNode);
    }
  }, [selectedNode, syncFromNode]);

  useEffect(() => {
    if (selectedEdge) {
      const d = selectedEdge.data || {};
      setEdgeLabelDraft(String(selectedEdge.label ?? d.label ?? ''));
    }
  }, [selectedEdge]);

  const commitLabel = useCallback(() => {
    if (!selectedNode || locked) return;
    const next = labelDraft.trim();
    const prev = String(selectedNode.data?.label ?? '').trim();
    if (next !== prev) onNodeLabelChange(selectedNode.id, labelDraft);
  }, [labelDraft, locked, onNodeLabelChange, selectedNode]);

  const commitMetadata = useCallback(() => {
    if (!selectedNode || locked) return;
    const prev = selectedNode.data || {};
    const nextDesc = descriptionDraft;
    const nextAssignee = assigneeDraft;
    const nextSystem = systemDraft;
    if (
      nextDesc !== String(prev.description ?? '') ||
      nextAssignee !== String(prev.assignee ?? prev.owner ?? '') ||
      nextSystem !== String(prev.system ?? '')
    ) {
      onNodeMetadataChange(selectedNode.id, {
        description: nextDesc,
        assignee: nextAssignee,
        system: nextSystem,
      });
    }
  }, [assigneeDraft, descriptionDraft, locked, onNodeMetadataChange, selectedNode, systemDraft]);

  const commitMetrics = useCallback(() => {
    if (!selectedNode || locked) return;
    onNodeMetricsChange(selectedNode.id, {
      duration: durationDraft.trim() || undefined,
      durationUnit: durationUnitDraft.trim() || 'h',
      cost: costDraft.trim() || undefined,
      fteCount: fteDraft.trim() || undefined,
    });
  }, [
    costDraft,
    durationDraft,
    durationUnitDraft,
    fteDraft,
    locked,
    onNodeMetricsChange,
    selectedNode,
  ]);

  const commitEdgeLabel = useCallback(() => {
    if (!selectedEdge || locked) return;
    const prev = String(selectedEdge.label ?? selectedEdge.data?.label ?? '');
    if (edgeLabelDraft !== prev) onEdgeLabelChange(selectedEdge.id, edgeLabelDraft);
  }, [edgeLabelDraft, locked, onEdgeLabelChange, selectedEdge]);

  const shape = selectedNode?.data?.shape != null ? String(selectedNode.data.shape) : '';
  const showGateway = selectedNode && GATEWAY_SHAPES.has(shape);
  const gatewayKind: 'xor' | 'and' = selectedNode?.data?.gatewayKind === 'and' ? 'and' : 'xor';

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="space-y-4 p-4 text-sm text-c-text-muted">
        {t('processFlow.propertiesPanel.emptyState', 'Select a node or edge to view properties')}
      </div>
    );
  }

  if (selectedEdge && !selectedNode) {
    const condition = (selectedEdge.data?.conditionType ?? '') as EdgeCondition;
    const edgeKind: EdgeKind = EDGE_KINDS.includes(selectedEdge.data?.edgeKind)
      ? selectedEdge.data.edgeKind
      : selectedEdge.data?.conditionType
        ? 'conditional'
        : 'sequence';
    const orthogonal = Boolean(selectedEdge.data?.orthogonal);
    const edgeKindLabel = (k: EdgeKind) =>
      k === 'sequence'
        ? t('processFlow.propertiesPanel.edgeKindSequence', 'Sequence')
        : k === 'conditional'
          ? t('processFlow.propertiesPanel.edgeKindConditional', 'Conditional')
          : t('processFlow.propertiesPanel.edgeKindMessage', 'Message');
    return (
      <div className="space-y-4 p-4 text-sm">
        <div>
          <h3 className={sectionHeaderClass}>
            {t('processFlow.propertiesPanel.edgeSectionTitle', 'Edge properties')}
          </h3>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
              <Tag size={14} className="opacity-70" />
              {t('processFlow.propertiesPanel.label', 'Label')}
            </span>
            <input
              className={inputClass}
              value={edgeLabelDraft}
              disabled={locked}
              onChange={(e) => setEdgeLabelDraft(e.target.value)}
              onBlur={commitEdgeLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdgeLabel();
              }}
            />
          </label>
        </div>
        <div>
          <h3 className={sectionHeaderClass}>
            {t('processFlow.propertiesPanel.edgeTypeTitle', 'Edge type')}
          </h3>
          <div className="relative">
            <select
              className={`${inputClass} appearance-none pr-9`}
              value={edgeKind}
              disabled={locked}
              onChange={(e) => onEdgeKindChange(selectedEdge.id, e.target.value as EdgeKind)}
            >
              {EDGE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {edgeKindLabel(k)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
              aria-hidden
            />
          </div>
        </div>
        <div>
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-c-surface px-3 py-2 dark:border-navy-700">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('processFlow.propertiesPanel.orthogonalRouting', 'Orthogonal routing')}
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--c-info)]"
              checked={orthogonal}
              disabled={locked}
              onChange={(e) => onEdgeOrthogonalToggle(selectedEdge.id, e.target.checked)}
            />
          </label>
        </div>
        <div>
          <h3 className={sectionHeaderClass}>
            {t('processFlow.propertiesPanel.conditionTypeTitle', 'Condition type')}
          </h3>
          <div className="relative">
            <select
              className={`${inputClass} appearance-none pr-9`}
              value={condition}
              disabled={locked}
              onChange={(e) =>
                onEdgeConditionChange(selectedEdge.id, e.target.value as EdgeCondition)
              }
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct || 'none'} value={ct}>
                  {ct === ''
                    ? /* dead ternary in the original — "—" is identical in both locales */ '—'
                    : ct === 'yes'
                      ? t('processFlow.propertiesPanel.conditionYes', 'Yes')
                      : ct === 'no'
                        ? t('processFlow.propertiesPanel.conditionNo', 'No')
                        : ct === 'default'
                          ? t('processFlow.propertiesPanel.conditionDefault', 'Default')
                          : t('processFlow.propertiesPanel.conditionException', 'Exception')}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
              aria-hidden
            />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return null;
  }

  return (
    <div className="space-y-4 p-4 text-sm">
      <div>
        <h3 className={sectionHeaderClass}>
          {t('processFlow.propertiesPanel.nodeTypeTitle', 'Node type')}
        </h3>
        <span className="inline-flex items-center rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs font-medium text-c-text-secondary">
          {shape || t('processFlow.propertiesPanel.unknownShape', 'unknown')}
        </span>
      </div>

      <div>
        <h3 className={sectionHeaderClass}>{t('processFlow.propertiesPanel.label', 'Label')}</h3>
        <input
          className={inputClass}
          value={labelDraft}
          disabled={locked}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitLabel();
          }}
        />
      </div>

      {showGateway && (
        <div>
          <h3 className={sectionHeaderClass}>
            {t('processFlow.propertiesPanel.gatewayKindTitle', 'Gateway kind')}
          </h3>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-c-text-secondary">
              <input
                type="radio"
                name="gateway-kind"
                className="text-c-text focus:ring-c-info"
                checked={gatewayKind === 'xor'}
                disabled={locked}
                onChange={() => onGatewayKindChange(selectedNode.id, 'xor')}
              />
              XOR
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-c-text-secondary">
              <input
                type="radio"
                name="gateway-kind"
                className="text-c-text focus:ring-c-info"
                checked={gatewayKind === 'and'}
                disabled={locked}
                onChange={() => onGatewayKindChange(selectedNode.id, 'and')}
              />
              AND
            </label>
          </div>
        </div>
      )}

      <div>
        <h3 className={sectionHeaderClass}>
          <span className="inline-flex items-center gap-1">
            <Layers size={14} className="opacity-70" />
            {t('processFlow.propertiesPanel.laneTitle', 'Lane')}
          </span>
        </h3>
        <div className="relative">
          <select
            className={`${inputClass} appearance-none pr-9`}
            value={String(selectedNode.data?.laneId ?? lanes[0]?.id ?? '')}
            disabled={locked || lanes.length === 0}
            onChange={(e) => onLaneChange(selectedNode.id, e.target.value)}
          >
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
            aria-hidden
          />
        </div>
      </div>

      <div>
        <h3 className={sectionHeaderClass}>
          {t('processFlow.propertiesPanel.metadataTitle', 'Metadata')}
        </h3>
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-c-text-secondary">
              {t('processFlow.propertiesPanel.descriptionField', 'Description')}
            </span>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={descriptionDraft}
              disabled={locked}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={commitMetadata}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
              <User size={14} className="opacity-70" />
              {t('processFlow.propertiesPanel.assigneeField', 'Assignee')}
            </span>
            <input
              className={inputClass}
              value={assigneeDraft}
              disabled={locked}
              onChange={(e) => setAssigneeDraft(e.target.value)}
              onBlur={commitMetadata}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitMetadata();
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
              <Server size={14} className="opacity-70" />
              {t('processFlow.propertiesPanel.systemLabel', 'System')}
            </span>
            <input
              className={inputClass}
              value={systemDraft}
              disabled={locked}
              onChange={(e) => setSystemDraft(e.target.value)}
              onBlur={commitMetadata}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitMetadata();
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className={sectionHeaderClass}>
          {t('processFlow.propertiesPanel.metricsTitle', 'Metrics')}
        </h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
                <Clock size={14} className="opacity-70" />
                {t('processFlow.propertiesPanel.durationField', 'Duration')}
              </span>
              <input
                className={inputClass}
                value={durationDraft}
                disabled={locked}
                onChange={(e) => setDurationDraft(e.target.value)}
                onBlur={commitMetrics}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitMetrics();
                }}
              />
            </label>
            <label className="w-24 shrink-0">
              <span className="mb-1 block text-xs font-medium text-c-text-secondary">
                {t('processFlow.propertiesPanel.unitField', 'Unit')}
              </span>
              <select
                className={inputClass}
                value={durationUnitDraft}
                disabled={locked}
                onChange={(e) => {
                  setDurationUnitDraft(e.target.value);
                  onNodeMetricsChange(selectedNode.id, {
                    duration: durationDraft.trim() || undefined,
                    durationUnit: e.target.value,
                    cost: costDraft.trim() || undefined,
                    fteCount: fteDraft.trim() || undefined,
                  });
                }}
              >
                <option value="h">{t('processFlow.propertiesPanel.unitHour', 'h')}</option>
                <option value="min">{t('processFlow.propertiesPanel.unitMin', 'min')}</option>
                <option value="d">{t('processFlow.propertiesPanel.unitDay', 'd')}</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
              <DollarSign size={14} className="opacity-70" />
              {t('processFlow.propertiesPanel.costField', 'Cost')}
            </span>
            <input
              className={inputClass}
              value={costDraft}
              disabled={locked}
              onChange={(e) => setCostDraft(e.target.value)}
              onBlur={commitMetrics}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitMetrics();
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-c-text-secondary">
              {t('processFlow.propertiesPanel.fteField', 'FTE count')}
            </span>
            <input
              className={inputClass}
              value={fteDraft}
              disabled={locked}
              onChange={(e) => setFteDraft(e.target.value)}
              onBlur={commitMetrics}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitMetrics();
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
