/**
 * Lineage helpers for the M15 Results KPI drawer.
 *
 * H2.8: mapping rows can repeat the same initiative, and `initiative_name` is
 * sometimes null (deleted / cross-org join). These helpers dedup by initiative id
 * and resolve a human label, falling back through the initiatives list before an
 * "Unknown" placeholder.
 */

export interface LineageMappingRow {
  id: string;
  initiative_id: string;
  initiative_name?: string | null;
}

export interface LineageInitiativeOption {
  id: string;
  name: string;
}

export interface LinkedInitiative {
  initiativeId: string;
  mappingId: string;
  label: string;
}

/**
 * Deduplicates initiative options by id, preserving first-seen order. Names are
 * coalesced from `name` then `title` then empty string.
 */
export function dedupeInitiativeOptions(
  raw: Array<{ id?: unknown; name?: unknown; title?: unknown } | null | undefined>
): LineageInitiativeOption[] {
  const byId = new Map<string, LineageInitiativeOption>();
  for (const i of raw || []) {
    if (i?.id == null) continue;
    const id = String(i.id);
    if (byId.has(id)) continue;
    byId.set(id, { id, name: String((i.name as string) || (i.title as string) || '') });
  }
  return Array.from(byId.values());
}

/**
 * Builds the deduped linked-initiative list for the lineage panel. Dedups by
 * `initiative_id`; resolves the label from the mapping's `initiative_name`, then
 * the initiatives list, then an "Unknown" fallback string.
 */
export function buildLinkedInitiatives(
  mappings: LineageMappingRow[] | null | undefined,
  initiatives: LineageInitiativeOption[] | null | undefined,
  unknownLabel: string
): LinkedInitiative[] {
  const nameById = new Map((initiatives || []).map((i) => [String(i.id), i.name]));
  const seen = new Map<string, { mappingId: string; label: string }>();
  for (const m of mappings || []) {
    const initId = String(m.initiative_id);
    if (seen.has(initId)) continue;
    const label =
      (m.initiative_name && m.initiative_name.trim()) || nameById.get(initId) || unknownLabel;
    seen.set(initId, { mappingId: m.id, label });
  }
  return Array.from(seen.entries()).map(([initiativeId, v]) => ({
    initiativeId,
    mappingId: v.mappingId,
    label: v.label,
  }));
}
