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
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type {
  RaidItem,
  RaidType,
  RiskResponseStrategy,
} from '@/components/shared/NModeSections/RaidCanvas';
import { RaidCanvas } from '@/components/shared/NModeSections/RaidCanvas';
import { Api } from '@/services/api';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

/** Local-only ids are generated client-side before the server confirms the row. */
const isTempRaidId = (id: string): boolean => id.startsWith('raid-');

export const RaidSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
  readonly,
}) => {
  const { t } = useTranslation();
  const {
    raidItems,
    setRaidItems,
    criticalRaids,
    raidAiRequest,
    requestRaidAi,
    initiative,
    initiativeId,
    status,
    priority,
    users,
  } = useInitiativeContext();

  // ── Persistence plumbing ────────────────────────────────────────────
  // RaidCanvas fires onUpdateItem on every keystroke for free-text fields
  // (title, owner, source, contingency, mitigation, proposedAction…). We
  // debounce those into a merged PATCH per item; discrete field changes
  // (selects, date picker) go straight through.
  const pendingPatchRef = useRef<Record<string, Partial<RaidItem>>>({});
  const patchTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Ids removed locally while their create POST was still in flight — used
  // to clean up the orphaned server row once the real id comes back.
  const removedWhilePendingRef = useRef<Set<string>>(new Set());
  // Edits made to a brand-new item while its create POST is still in
  // flight can't PATCH yet (no real id exists server-side). Queue them
  // here keyed by tempId and flush under the real id once the POST
  // resolves — otherwise they're silently dropped (data-loss bug fixed
  // 2026-08-01: sendRaidPatch no-ops on temp ids with nowhere for the
  // edit to go).
  const queuedPatchForTempIdRef = useRef<Record<string, Partial<RaidItem>>>({});

  // Debounced PATCHes are fire-and-forget timers outside React's render
  // cycle — clear them on unmount so navigating away mid-edit doesn't
  // leave a stray Api.patch call scheduled after the component is gone.
  useEffect(() => {
    return () => {
      Object.values(patchTimersRef.current).forEach((timer) => clearTimeout(timer));
      patchTimersRef.current = {};
      pendingPatchRef.current = {};
    };
  }, []);

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

  /** Backend PATCH /initiatives/:id/raid/:raidId only persists these fields. */
  const sendRaidPatch = useCallback(
    (id: string, updates: Partial<RaidItem>) => {
      if (!initiativeId || isTempRaidId(id)) return;

      const body: Record<string, unknown> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.description !== undefined) body.description = updates.description;
      if (updates.status !== undefined) body.status = String(updates.status).toUpperCase();
      if (updates.impact !== undefined) body.severity = String(updates.impact).toUpperCase();
      if (updates.probability !== undefined)
        body.probability = String(updates.probability).toUpperCase();
      if (updates.dueDate !== undefined) body.dueDate = updates.dueDate || null;
      if (updates.owner !== undefined) body.ownerId = updates.owner || null;

      // Fields like category/mitigation/contingency/proposedAction/source/
      // responseStrategy/type have no column on this endpoint today — they
      // stay local-only (UI still reflects them via setRaidItems above).
      if (Object.keys(body).length === 0) return;

      Api.patch(`/initiatives/${initiativeId}/raid/${id}`, body).catch(() => {
        // Best-effort — local state already reflects the edit; a silent
        // background sync failure shouldn't interrupt typing.
      });
    },
    [initiativeId]
  );

  const handleAddItem = useCallback(
    (type: RaidType) => {
      if (!initiativeId) return;

      const tempId = `raid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newItem = {
        id: tempId,
        type,
        title: '',
        severity: 'MEDIUM' as const,
        status: 'OPEN',
        owner: '',
        mitigationPlan: '',
      };
      setRaidItems((prev) => [newItem, ...prev]);

      Api.post(`/initiatives/${initiativeId}/raid`, {
        type: String(type).toUpperCase(),
        title: '',
        description: '',
        severity: 'MEDIUM',
        idempotencyKey: tempId,
      })
        .then((res: any) => {
          const realId = res?.id;
          if (!realId) return;

          if (removedWhilePendingRef.current.has(tempId)) {
            // User already removed the row locally before the server id
            // came back — the local list no longer has it, so just clean
            // up the now-orphaned server-side row.
            removedWhilePendingRef.current.delete(tempId);
            delete queuedPatchForTempIdRef.current[tempId];
            Api.delete(`/initiatives/${initiativeId}/raid/${realId}`).catch(() => {});
            return;
          }

          setRaidItems((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, id: realId } : item))
          );
          toast.success(t('initiatives.raidItemAdded2'));

          // Flush any edit(s) the user made while the create POST was still
          // in flight — these were queued (not dropped) by sendRaidPatch
          // because there was no real id to PATCH against yet.
          const queued = queuedPatchForTempIdRef.current[tempId];
          if (queued) {
            delete queuedPatchForTempIdRef.current[tempId];
            sendRaidPatch(realId, queued);
          }
        })
        .catch((e: any) => {
          removedWhilePendingRef.current.delete(tempId);
          toast.error(
            e?.message || t('initiatives.toast.createRaidError', 'Failed to add RAID item')
          );
          // Roll back the optimistic local item — the UI must not claim
          // something was saved when it wasn't.
          setRaidItems((prev) => prev.filter((item) => item.id !== tempId));
        });
    },
    [setRaidItems, initiativeId, t, sendRaidPatch]
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

      // Keystroke-driven free-text fields get debounced so we don't fire a
      // PATCH per character. Discrete field changes (selects, date input)
      // go straight through.
      const isKeystrokeField =
        updates.title !== undefined ||
        updates.description !== undefined ||
        updates.owner !== undefined;

      if (!isKeystrokeField) {
        if (isTempRaidId(id)) {
          // Create POST still in flight — nothing to PATCH yet. Queue so
          // handleAddItem's .then() can flush it once the real id lands.
          queuedPatchForTempIdRef.current[id] = {
            ...(queuedPatchForTempIdRef.current[id] || {}),
            ...updates,
          };
          return;
        }
        sendRaidPatch(id, updates);
        return;
      }

      const pending = pendingPatchRef.current;
      pending[id] = { ...(pending[id] || {}), ...updates };

      const timers = patchTimersRef.current;
      if (timers[id]) clearTimeout(timers[id]);
      timers[id] = setTimeout(() => {
        const merged = pending[id];
        delete pending[id];
        delete timers[id];
        if (!merged) return;
        if (isTempRaidId(id)) {
          // The create POST for this item still hadn't resolved by the
          // time the debounce fired — queue instead of dropping (fixes
          // the 2026-08-01 silent-data-loss bug: this branch used to call
          // sendRaidPatch(id, merged) here, which no-ops on temp ids and
          // threw the edit away for good).
          queuedPatchForTempIdRef.current[id] = {
            ...(queuedPatchForTempIdRef.current[id] || {}),
            ...merged,
          };
          return;
        }
        sendRaidPatch(id, merged);
      }, 400);
    },
    [setRaidItems, sendRaidPatch]
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      setRaidItems((prev) => prev.filter((item) => item.id !== id));

      // Drop any pending debounced patch for this item.
      const timers = patchTimersRef.current;
      if (timers[id]) {
        clearTimeout(timers[id]);
        delete timers[id];
      }
      delete pendingPatchRef.current[id];

      if (!initiativeId) return;

      if (isTempRaidId(id)) {
        // Create POST is still in flight — mark for cleanup once the real
        // id comes back, since there's nothing to DELETE yet. Also drop
        // any edit queued for this temp id — the item is gone, nothing
        // left to flush.
        removedWhilePendingRef.current.add(id);
        delete queuedPatchForTempIdRef.current[id];
        toast.success(t('initiatives.raidItemRemoved2'));
        return;
      }

      toast.success(t('initiatives.raidItemRemoved2'));
      Api.delete(`/initiatives/${initiativeId}/raid/${id}`).catch((e: any) => {
        toast.error(
          e?.message || t('initiatives.toast.deleteRaidError', 'Failed to remove RAID item')
        );
      });
    },
    [setRaidItems, initiativeId, t]
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
          patch.source = t('initiatives.raidSection.convertedFrom', {
            type: oldType,
            title: oldTitle,
          });
          return patch;
        })
      );
    },
    [setRaidItems, t]
  );

  const handleAIGenerate = useCallback(() => {
    requestRaidAi();
  }, [requestRaidAi]);

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
      title={t('initiatives.raidSection.riskAndRaid')}
      icon={<AlertTriangle size={18} className="text-danger-500 dark:text-danger-400" />}
      iconBg="bg-gradient-to-br from-danger-500/10 to-danger-500/10 dark:from-danger-500/20 dark:to-danger-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {criticalRaids > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger-500/20 text-danger-400 font-medium">
              {criticalRaids} {t('initiatives.raidSection.crit')}
            </span>
          )}
          {raidItems.length > 0 && (
            <span className="text-xs text-slate-600">{raidItems.length}</span>
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
        isGeneratingAI={!!raidAiRequest}
        locked={readonly}
        artifactContext={artifactContext}
        fieldKeyPrefix="init"
        users={userOptions}
      />
    </CollapsibleSection>
  );
};
