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
import {
  createRaidItem as createCanonicalRaidItem,
  deleteRaidItem as deleteCanonicalRaidItem,
  newRaidItemId,
  updateRaidItem as updateCanonicalRaidItem,
} from '@/services/initiatives-execution/raidWrites';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

/**
 * Identyfikator pozycji RAID nadaje teraz KLIENT (kanoniczna komenda 26A jest
 * adresowana docelowym id), wiec nie ma juz stanu "tymczasowego id" i calej
 * maszynerii kolejkowania edycji na czas lotu POST-a.
 */

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

  /**
   * Kanoniczny (26A) zapis edycji pozycji RAID.
   *
   * Wczesniej szedl na wycofana trase `PATCH /initiatives/:id/raid/:raidId`
   * (odpowiedz 409) i mial `.catch(() => {})` — edycja przepadala BEZ SLOWA.
   * Teraz kazda nieudana zmiana mowi uzytkownikowi, co sie stalo.
   */
  const sendRaidPatch = useCallback(
    (id: string, updates: Partial<RaidItem>) => {
      if (!initiativeId) return;

      const body: Record<string, unknown> = {};
      if (updates.title !== undefined) body.title = updates.title || null;
      if (updates.description !== undefined) body.description = updates.description;
      if (updates.status !== undefined) body.status = String(updates.status).toUpperCase();
      if (updates.impact !== undefined) body.severity = String(updates.impact).toUpperCase();
      if (updates.probability !== undefined)
        body.probability = String(updates.probability).toUpperCase();
      if (updates.dueDate !== undefined) body.dueDate = updates.dueDate || null;
      if (updates.owner !== undefined) body.ownerId = updates.owner || null;
      if (updates.mitigation !== undefined) body.mitigationPlan = updates.mitigation || null;

      // Pola category/contingency/proposedAction/source/responseStrategy/type
      // nie maja wlasnej kolumny w kanonicznej komendzie — zostaja lokalne
      // (UI odzwierciedla je przez setRaidItems powyzej).
      if (Object.keys(body).length === 0) return;

      void updateCanonicalRaidItem(initiativeId, id, body).catch((error: Error) => {
        toast.error(error.message);
      });
    },
    [initiativeId]
  );

  const handleAddItem = useCallback(
    (type: RaidType) => {
      if (!initiativeId) return;

      // Id nadaje klient — kanoniczna komenda jest adresowana docelowym id,
      // wiec pozycja od pierwszej chwili ma ostateczny identyfikator i kazda
      // edycja trafia we wlasciwy rekord.
      const id = newRaidItemId();
      // Tytul nie moze byc pusty: i wycofany zapis legacy, i kanoniczna
      // komenda odrzucaja pusty tytul (400). Wpisujemy roboczy, ktory
      // uzytkownik nadpisuje w tabeli.
      const title = t('initiatives.raid.newItemTitle', 'New item');
      const newItem = {
        id,
        type,
        title,
        severity: 'MEDIUM' as const,
        status: 'OPEN',
        owner: '',
        mitigationPlan: '',
      };
      setRaidItems((prev) => [newItem, ...prev]);

      void createCanonicalRaidItem(initiativeId, id, {
        type: String(type).toUpperCase() as 'RISK' | 'ASSUMPTION' | 'ISSUE' | 'DEPENDENCY',
        title,
        severity: 'MEDIUM',
        status: 'OPEN',
      })
        .then(() => {
          toast.success(t('initiatives.raidItemAdded2'));
        })
        .catch((error: Error) => {
          toast.error(error.message);
          // Cofamy optymistyczny wiersz — UI nie moze udawac, ze cos zapisal.
          setRaidItems((prev) => prev.filter((item) => item.id !== id));
        });
    },
    [setRaidItems, initiativeId, t]
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
        sendRaidPatch(id, merged);
      }, 400);
    },
    [setRaidItems, sendRaidPatch]
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      // Zapamietujemy wiersz, zeby przywrocic go, gdy serwer odmowi.
      const removed = raidItems.find((item: { id: string }) => item.id === id);
      setRaidItems((prev) => prev.filter((item) => item.id !== id));

      // Drop any pending debounced patch for this item.
      const timers = patchTimersRef.current;
      if (timers[id]) {
        clearTimeout(timers[id]);
        delete timers[id];
      }
      delete pendingPatchRef.current[id];

      if (!initiativeId) return;

      void deleteCanonicalRaidItem(initiativeId, id)
        .then(() => {
          toast.success(t('initiatives.raidItemRemoved2'));
        })
        .catch((error: Error) => {
          toast.error(error.message);
          // Przywracamy wiersz — pozycja nadal istnieje po stronie serwera,
          // wiec lista nie moze udawac, ze zostala usunieta.
          if (removed) {
            setRaidItems((prev) =>
              prev.some((i: { id: string }) => i.id === id) ? prev : [removed, ...prev]
            );
          }
        });
    },
    [setRaidItems, raidItems, initiativeId, t]
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
