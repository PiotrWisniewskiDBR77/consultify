import { useCallback, useEffect, useState } from 'react';

import { OrganizationApi } from '@/services/api/organizations.api';
import { useAppStore } from '@/store/useAppStore';

/**
 * Identyfikator osoby → NAZWISKO, z realnej listy członków organizacji (2026-09-02).
 *
 * PO CO ISTNIEJE. Ten sam blok (organizacja ze store → `getOrganizationMembers` →
 * mapa `userId → name || email || userId` → resolver z uczciwym `null`) był już
 * przepisany DWA razy, słowo w słowo: `ResultsAttentionPage.tsx:90-115` i
 * `ResultsRoiHub.tsx:253-278`. Ekrany OKR były trzecim miejscem, które go
 * potrzebuje — trzecia kopia zamieniłaby powtórzenie w dryf, a dryf w tym
 * repozytorium już raz dał tego samego człowieka pod dwoma zapisami na jednym
 * ekranie. Dlatego wspólny hak, nie kolejne kopiuj-wklej.
 *
 * UCZCIWOŚĆ ZAMIAST ZGADYWANIA: gdy członka nie ma na liście (konto usunięte,
 * lista jeszcze nie doszła, brak organizacji w kontekście) resolver zwraca
 * `null`, a wołacz pokazuje skrócony identyfikator. NIE wymyślamy nazwiska
 * i nie udajemy, że je znamy — żadna zamiana znaków nie odtworzy „Wiśniewski"
 * z „wisniewski".
 *
 * Dług do domknięcia: `ResultsAttentionPage` i `ResultsRoiHub` nadal mają własne
 * kopie tego bloku. Nie ruszam ich w tym dyżurze, bo to ekrany z akceptem
 * właściciela — zwinięcie ich do tego haka wymaga własnego zrzutu PO.
 */
export type MemberNameResolver = (userId: string) => string | null;

export function useOrganizationMemberNames(): MemberNameResolver {
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    OrganizationApi.getOrganizationMembers(currentOrganization.id)
      .then((members) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        members.forEach((m) => {
          const label = (m.name && m.name.trim()) || m.email || m.userId;
          if (label) map[m.userId] = label;
        });
        setMemberNameById(map);
      })
      .catch(() => {
        if (!cancelled) setMemberNameById({});
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  return useCallback((userId: string) => memberNameById[userId] || null, [memberNameById]);
}
