import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

/**
 * Identyfikator inicjatywy → NAZWA, z realnej listy inicjatyw organizacji.
 *
 * PO CO ISTNIEJE (TEST-DANE D-06, 09.09.2026). Podgląd Mojej Pracy pokazywał
 * w bloku pochodzenia surowy identyfikator: „Initiative:
 * 4e7a8762-62e6-52b5-985b-536a4d9185aa" — dla klienta znak bez treści (w bazie
 * ta inicjatywa nazywa się „Skills Matrix and Upskilling"). Wiersz skrzynki
 * (`canonical_inbox_items`) przenosi `initiative_id` przepisane w chwili
 * materializacji, ale NIE przenosi nazwy — nie ma jej ani w kolumnie, ani
 * w odpowiedzi trasy v8 (`V8CanonicalInboxItem`). Nazwę trzeba więc rozwiązać
 * po stronie widoku, tak jak nazwiska rozwiązuje `useOrganizationMemberNames`.
 *
 * UCZCIWOŚĆ ZAMIAST ZGADYWANIA: kiedy inicjatywy nie ma na liście (usunięta,
 * lista jeszcze nie doszła, brak uprawnień do rejestru) resolver zwraca `null`.
 * Wołacz ma wtedy schować wiersz, a NIE pokazać identyfikatora — pokazanie
 * UUID-a jest dokładnie tym defektem, który ten hak zamyka.
 */
export type InitiativeNameResolver = (initiativeId: string) => string | null;

type RawInitiative = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Etykieta inicjatywy: `title` → `name`. `null`, gdy wiersz nie ma żadnej. */
export function readInitiativeLabel(initiative: RawInitiative): string | null {
  return str(initiative.title) || str(initiative.name) || null;
}

/** Czysta (testowalna) budowa mapy `id → etykieta` z odpowiedzi API. */
export function buildInitiativeNameMap(
  initiatives: ReadonlyArray<RawInitiative> | null | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  (initiatives ?? []).forEach((initiative) => {
    if (!initiative || typeof initiative !== 'object') return;
    const id = str(initiative.id);
    const label = readInitiativeLabel(initiative);
    if (id && label) map[id] = label;
  });
  return map;
}

export function useInitiativeNames(): InitiativeNameResolver {
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const [nameById, setNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentOrganization?.id) return undefined;
    let cancelled = false;
    Api.get('/initiatives')
      .then((rows: unknown) => {
        if (cancelled) return;
        setNameById(buildInitiativeNameMap(Array.isArray(rows) ? (rows as RawInitiative[]) : []));
      })
      .catch(() => {
        // Brak listy to brak nazw — wołacz chowa wiersz, nigdy nie pokazuje UUID-a.
        if (!cancelled) setNameById({});
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  return useCallback((initiativeId: string) => nameById[initiativeId] || null, [nameById]);
}
