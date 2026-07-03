import { ChevronDown, Clock, DollarSign, Layers, Server, Tag, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import { CONDITION_TYPES } from './FlowEdgeComponent';

const inputClass =
  'w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text focus:ring-2 focus:ring-c-info outline-none';

const sectionHeaderClass =
  'text-xs font-semibold uppercase tracking-wider text-c-text-muted mb-2';

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
  isPl,
  locked,
  onNodeLabelChange,
  onGatewayKindChange,
  onLaneChange,
  onEdgeLabelChange,
  onEdgeConditionChange = () => {},
  onNodeMetricsChange,
  onNodeMetadataChange = () => {},
}) => {
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
        {isPl
          ? 'Zaznacz węzeł lub krawędź, aby zobaczyć właściwości'
          : 'Select a node or edge to view properties'}
      </div>
    );
  }

  if (selectedEdge && !selectedNode) {
    const condition = (selectedEdge.data?.conditionType ?? '') as EdgeCondition;
    return (
      <div className="space-y-4 p-4 text-sm">
        <div>
          <h3 className={sectionHeaderClass}>{isPl ? 'Krawędź' : 'Edge properties'}</h3>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
              <Tag size={14} className="opacity-70" />
              {isPl ? 'Etykieta' : 'Label'}
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
          <h3 className={sectionHeaderClass}>{isPl ? 'Warunek' : 'Condition type'}</h3>
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
                    ? isPl
                      ? '—'
                      : '—'
                    : ct === 'yes'
                      ? isPl
                        ? 'Tak'
                        : 'Yes'
                      : ct === 'no'
                        ? isPl
                          ? 'Nie'
                          : 'No'
                        : ct === 'default'
                          ? isPl
                            ? 'Domyślny'
                            : 'Default'
                          : isPl
                            ? 'Wyjątek'
                            : 'Exception'}
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
        <h3 className={sectionHeaderClass}>{isPl ? 'Typ węzła' : 'Node type'}</h3>
        <span className="inline-flex items-center rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs font-medium text-c-text-secondary">
          {shape || (isPl ? 'nieznany' : 'unknown')}
        </span>
      </div>

      <div>
        <h3 className={sectionHeaderClass}>{isPl ? 'Etykieta' : 'Label'}</h3>
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
          <h3 className={sectionHeaderClass}>{isPl ? 'Rodzaj bramki' : 'Gateway kind'}</h3>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-c-text-secondary">
              <input
                type="radio"
                name="gateway-kind"
                className="text-c-accent focus:ring-c-info"
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
                className="text-c-accent focus:ring-c-info"
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
            {isPl ? 'Tor' : 'Lane'}
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
        <h3 className={sectionHeaderClass}>{isPl ? 'Metadane' : 'Metadata'}</h3>
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-c-text-secondary">
              {isPl ? 'Opis' : 'Description'}
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
              {isPl ? 'Przypisany' : 'Assignee'}
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
              {isPl ? 'System' : 'System'}
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
        <h3 className={sectionHeaderClass}>{isPl ? 'Metryki' : 'Metrics'}</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
                <Clock size={14} className="opacity-70" />
                {isPl ? 'Czas trwania' : 'Duration'}
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
                {isPl ? 'Jedn.' : 'Unit'}
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
                <option value="h">{isPl ? 'godz.' : 'h'}</option>
                <option value="min">{isPl ? 'min' : 'min'}</option>
                <option value="d">{isPl ? 'dni' : 'd'}</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-c-text-secondary">
              <DollarSign size={14} className="opacity-70" />
              {isPl ? 'Koszt' : 'Cost'}
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
              {isPl ? 'Liczba FTE' : 'FTE count'}
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
