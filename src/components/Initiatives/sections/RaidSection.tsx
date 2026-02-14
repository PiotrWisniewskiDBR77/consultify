/**
 * RaidSection — Initiative RAID Log (D-mode CollapsibleSection wrapper)
 *
 * Wraps the shared RaidCanvas component inside a CollapsibleSection
 * for the D-mode presentation of initiatives.
 *
 * The RaidCanvas handles all RAID UI (R/A/I/D types, counter cards,
 * filter tabs, conditional rendering, proposed action, AI).
 *
 * @see docs/ui-standards/02-components/initiative-sections.md §7
 */

import { AlertTriangle } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import type {
  RaidItem,
  RaidType,
  RiskResponseStrategy,
} from '@/components/shared/NModeSections/RaidCanvas';
import { RaidCanvas } from '@/components/shared/NModeSections/RaidCanvas';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const RaidSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
  readonly,
}) => {
  const {
    raidItems,
    setRaidItems,
    criticalRaids,
    isPolish,
    isGeneratingAI,
    handleGenerateAI,
    initiative,
    status,
    priority,
    users,
  } = useInitiativeContext();

  // ── Map initiative RaidItems → RaidCanvas RaidItems ──────────────────

  const canvasItems: RaidItem[] = useMemo(
    () =>
      raidItems.map((r) => ({
        id: r.id,
        type: r.type as RaidType,
        title: r.title,
        probability: (r as any).probability || undefined,
        impact: (r.severity || 'MEDIUM').toLowerCase() as RaidItem['impact'],
        category: (r as any).category || undefined,
        mitigation: (r as any).mitigation || r.mitigationPlan || '',
        contingency: (r as any).contingency || '',
        proposedAction: (r as any).proposedAction || '',
        status: (r.status || 'OPEN').toLowerCase() as RaidItem['status'],
        responseStrategy: (r as any).responseStrategy || undefined,
        owner: r.owner || (r as any).ownerName || '',
        dueDate: (r as any).dueDate || '',
        source: (r as any).source || '',
        description: (r as any).description || r.description || '',
      })),
    [raidItems]
  );

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleAddItem = useCallback(
    (type: RaidType) => {
      const newItem = {
        id: `raid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        title: '',
        severity: 'MEDIUM' as const,
        status: 'OPEN',
        owner: '',
        mitigationPlan: '',
      };
      setRaidItems((prev) => [newItem, ...prev]);
    },
    [setRaidItems]
  );

  const handleUpdateItem = useCallback(
    (id: string, updates: Partial<RaidItem>) => {
      setRaidItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const patch: any = { ...item };
          if (updates.title !== undefined) patch.title = updates.title;
          if (updates.type !== undefined) patch.type = updates.type;
          if (updates.impact !== undefined) patch.severity = updates.impact.toUpperCase();
          if (updates.status !== undefined) patch.status = updates.status.toUpperCase();
          if (updates.owner !== undefined) patch.owner = updates.owner;
          if (updates.mitigation !== undefined) patch.mitigationPlan = updates.mitigation;
          // Store extended fields directly on the item
          if (updates.probability !== undefined) patch.probability = updates.probability;
          if (updates.category !== undefined) patch.category = updates.category;
          if (updates.contingency !== undefined) patch.contingency = updates.contingency;
          if (updates.proposedAction !== undefined) patch.proposedAction = updates.proposedAction;
          if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate;
          if (updates.source !== undefined) patch.source = updates.source;
          if (updates.responseStrategy !== undefined)
            patch.responseStrategy = updates.responseStrategy;
          if (updates.description !== undefined) patch.description = updates.description;
          return patch;
        })
      );
    },
    [setRaidItems]
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      setRaidItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setRaidItems]
  );

  const handleConvertToIssue = useCallback(
    (id: string) => {
      setRaidItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const patch: any = { ...item };
          const oldType = patch.type;
          const oldTitle = patch.title;
          patch.type = 'issue';
          patch.status = 'OPEN';
          patch.source = `${isPolish ? 'Konwersja z' : 'Converted from'} ${oldType}: ${oldTitle}`;
          return patch;
        })
      );
    },
    [setRaidItems, isPolish]
  );

  const handleAIGenerate = useCallback(() => {
    handleGenerateAI('raid');
  }, [handleGenerateAI]);

  // ── User list for owner dropdown ─────────────────────────────────────

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.email || u.id,
      })),
    [users]
  );

  // ── Artifact context for AI ──────────────────────────────────────────

  const artifactContext = useMemo(
    () => ({
      title: initiative?.title || initiative?.name || '',
      status: status || '',
      priority: priority || '',
      type: 'initiative',
    }),
    [initiative, status, priority]
  );

  return (
    <CollapsibleSection
      id="raid"
      title={isPolish ? 'Ryzyko i RAID' : 'Risk & RAID'}
      icon={<AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />}
      iconBg="bg-gradient-to-br from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {criticalRaids > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
              {criticalRaids} {isPolish ? 'kryt.' : 'crit.'}
            </span>
          )}
          {raidItems.length > 0 && (
            <span className="text-xs text-slate-400">{raidItems.length}</span>
          )}
        </div>
      }
    >
      <RaidCanvas
        items={canvasItems}
        onAddItem={handleAddItem}
        onUpdateItem={handleUpdateItem}
        onRemoveItem={handleRemoveItem}
        onConvertToIssue={handleConvertToIssue}
        onAIGenerate={handleAIGenerate}
        isGeneratingAI={isGeneratingAI === 'raid'}
        locked={readonly}
        artifactContext={artifactContext}
        fieldKeyPrefix="init"
        users={userOptions}
      />
    </CollapsibleSection>
  );
};
