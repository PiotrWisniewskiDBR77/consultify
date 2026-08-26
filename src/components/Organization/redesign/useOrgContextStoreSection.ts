/**
 * Współdzielony hak "Zapisz zmiany" dla pięciu ekranów redesignu opartych o
 * `useContextBuilderStore` (Cele i mierniki, Zakres i tryb współpracy,
 * Wyzwania i dowody, Przyczyny i blockery, Ryzyka i szanse).
 *
 * FAZA 2 (DEC-2026-08-24-15, warunek a) — REWIZJA: pierwsza wersja tego
 * haka robiła WŁASNY `PUT`/`GET /organization-context-store`, niezależny od
 * już istniejącego globalnego syncu W11 (`useOrgContextSync`, montowanego
 * raz w `OrganizationView`, z debounce'owanym auto-zapisem CAŁEGO store'u).
 * Dwóch niezależnych pisarzy do tego samego wiersza wywoływało REALNY wyścig
 * — potwierdzony na żywym runtime (Docker Postgres): odczyt zwrotny jednego
 * zapisu widział wersję z drugiego, co zapalało baner „Organization context
 * readback did not match the persisted write" mimo że oba zapisy z osobna
 * się powiodły.
 *
 * Naprawa: `useOrgContextSync` jest teraz JEDYNYM pisarzem (`saveNow()` —
 * anuluje oczekujący debounce i serializuje zapis przez tę samą kolejkę co
 * auto-save, patrz `src/hooks/useOrgContextSync.ts`). Ten hak jest już tylko
 * cienką powłoką: „Zapisz zmiany" woła `contextSync.saveNow()`, a napis
 * bufora lokalnego pokazuje się dokładnie wtedy, gdy `contextSync.isUnsynced`
 * jest prawdziwe (ten sam stan, którego używa globalny baner w
 * `OrganizationView`).
 */
import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { SyncResult } from '../../../hooks/useOrgContextSync';

export const ORG_CONTEXT_STORE_LOCAL_BUFFER_NOTE =
  'Dane zapisywane są lokalnie (bufor roboczy) — kliknij „Zapisz zmiany", aby zapisać trwale na serwerze.';

/** Podzbiór `SyncResult` faktycznie potrzebny ekranom — łatwiejszy do zamockowania w testach. */
export type OrgContextSyncHandle = Pick<SyncResult, 'saveNow' | 'isSyncing' | 'isUnsynced'>;

export interface OrgContextStoreSectionState {
  saving: boolean;
  /** Do wpięcia w `OrganizationStatePanelProps.completenessNote`. */
  completenessNote: string | undefined;
  handleSave: () => Promise<boolean>;
}

export function useOrgContextStoreSection(
  contextSync: OrgContextSyncHandle | undefined
): OrgContextStoreSectionState {
  const { t } = useTranslation();

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!contextSync) return false;
    const ok = await contextSync.saveNow();
    if (ok) {
      toast.success(t('organization.contextStore.saved', 'Zapisano'));
    } else {
      toast.error(
        t(
          'organization.contextStore.readbackFailed',
          'Zapis wykonany, ale odczyt zwrotny z serwera nie zgadza się z zapisanymi danymi.'
        )
      );
    }
    return ok;
  }, [contextSync, t]);

  return {
    saving: contextSync?.isSyncing ?? false,
    completenessNote: contextSync?.isUnsynced ? ORG_CONTEXT_STORE_LOCAL_BUFFER_NOTE : undefined,
    handleSave,
  };
}
