/**
 * Współdzielony hak zapisu dla pięciu ekranów redesignu opartych o
 * `useContextBuilderStore` (Cele i mierniki, Zakres i tryb współpracy,
 * Wyzwania i dowody, Przyczyny i blockery, Ryzyka i szanse).
 *
 * Zaplecze: `GET/PUT /organization-context-store` (W11, `server/src/routes/
 * organization-context-store.routes.ts`, tabela `organization_context_store`,
 * migracja `779_organization_context_store.sql`) — istniało już PRZED tym
 * krokiem jako zamiennik dla `useContextBuilderStore` (local-storage), ale
 * żaden z pięciu ekranów redesignu go nie wołał. Ten hak spina lukę:
 *   - GET przy montowaniu → hydratuje lokalny store (`setGoals`/`setChallenges`
 *     /`setSynthesis`) danymi z serwera, jeśli tam są (wzorzec identyczny jak
 *     `OrganizationIdentityOperatingScreen` dla `/organization-profiles`),
 *   - PUT przy „Zapisz zmiany" + READBACK — zapis uznajemy za udany dopiero
 *     gdy odczyt zwrotny z serwera zgadza się z tym, co wysłaliśmy
 *     (porównanie strukturalne, niewrażliwe na kolejność kluczy — Postgres
 *     JSONB nie gwarantuje kolejności).
 *
 * PUT wysyła WYŁĄCZNIE klucz danej sekcji (`{ goals: {...} }` itd.) — trasa
 * serwerowa aktualizuje tylko przekazane kolumny (patrz komentarz w routach),
 * więc zapis z ekranu „Cele i mierniki" nie kasuje danych „Zakres i tryb
 * współpracy" mimo że oba dzielą klucz `goals` w jednym wierszu.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';

export type OrgContextStoreSectionKey = 'goals' | 'challenges' | 'synthesis';

export const ORG_CONTEXT_STORE_LOCAL_BUFFER_NOTE =
  'Dane zapisywane są lokalnie (bufor roboczy) — kliknij „Zapisz zmiany", aby zapisać trwale na serwerze.';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface OrgContextStoreSectionState {
  loading: boolean;
  saving: boolean;
  /** `true` = ostatnia znana wartość tej sekcji jest potwierdzona na serwerze. */
  synced: boolean;
  handleSave: () => Promise<boolean>;
  /** Do wpięcia w `OrganizationStatePanelProps.completenessNote`. */
  completenessNote: string | undefined;
}

export function useOrgContextStoreSection<T extends Record<string, unknown>>(
  key: OrgContextStoreSectionKey,
  currentValue: T,
  setValue: (data: Partial<T>) => void
): OrgContextStoreSectionState {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState(false);
  const valueRef = useRef(currentValue);
  valueRef.current = currentValue;
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await Api.get('/organization-context-store');
        if (cancelled) return;
        const serverSlice = res && typeof res === 'object' ? (res as Record<string, unknown>)[key] : null;
        if (serverSlice && typeof serverSlice === 'object' && Object.keys(serverSlice).length > 0) {
          setValueRef.current(serverSlice as Partial<T>);
          setSynced(true);
        }
      } catch (error) {
        // Kontekst serwerowy jest wzbogaceniem lokalnego bufora — brak go nie
        // może zablokować edycji offline-first (local-storage nadal działa).
        console.error(`[organization-context-store] load(${key}) failed`, error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const current = valueRef.current;
      await Api.put('/organization-context-store', { [key]: current });
      const readback = await Api.get('/organization-context-store');
      const persisted =
        readback && typeof readback === 'object' ? (readback as Record<string, unknown>)[key] : undefined;
      if (!persisted || stableStringify(persisted) !== stableStringify(current)) {
        throw new Error(
          t(
            'organization.contextStore.readbackFailed',
            'Zapis wykonany, ale odczyt zwrotny z serwera nie zgadza się z zapisanymi danymi.'
          )
        );
      }
      setValueRef.current(persisted as Partial<T>);
      setSynced(true);
      toast.success(t('organization.contextStore.saved', 'Zapisano'));
      return true;
    } catch (error) {
      toast.error(
        (error as Error)?.message || t('organization.contextStore.saveFailed', 'Nie udało się zapisać')
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [key, t]);

  return {
    loading,
    saving,
    synced,
    handleSave,
    completenessNote: synced ? undefined : ORG_CONTEXT_STORE_LOCAL_BUFFER_NOTE,
  };
}
