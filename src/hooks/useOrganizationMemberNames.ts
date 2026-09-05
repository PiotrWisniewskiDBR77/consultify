import { useCallback, useEffect, useState } from 'react';

import { OrganizationApi } from '@/services/api/organizations.api';
import { useAppStore } from '@/store/useAppStore';

/**
 * Identyfikator osoby → NAZWISKO, z realnej listy członków organizacji.
 *
 * PO CO ISTNIEJE. Ten sam blok (organizacja ze store → `getOrganizationMembers`
 * → mapa `id → nazwa` → resolver z uczciwym `null`) był przepisany słowo w słowo
 * w CZTERECH miejscach (`ResultsAttentionPage`, `ResultsRoiHub`, `ResultsOkrHub`,
 * `KpiToolPage`) plus piąty raz w `components/ResultsVNext/useOrganizationMemberNames.ts`.
 * Teraz jest JEDEN dom — `src/hooks/` — bo z Finansów i Realizacji nikt nie
 * powinien importować haka „z Wyników".
 *
 * ★ PRZYCZYNA DEFEKTU RODZINY „surowe UUID zamiast nazwiska" (pomiar 2026-09-05,
 * odbiór na żywo: `results-vnext-okr-registry`, `execution-tab-work`,
 * `finance-comments-panel`). Wszystkie kopie czytały `m.userId` i `m.name`.
 * Serwer (`organizationController.getMembers` → `organizationService.getActiveMembers`)
 * zwraca SUROWE WIERSZE SQL:
 *     SELECT m.id, m.user_id, m.role, m.status, m.created_at,
 *            u.first_name, u.last_name, u.email
 * — czyli `user_id`/`first_name`/`last_name`, snake_case, BEZ pola `name`
 * i BEZ `userId`. Klucz mapy wychodził `undefined`, więc KAŻDE wyszukanie
 * zwracało `null`, a ekran pokazywał UUID. Nie było to „luką w liście członków
 * na stagingu" — resolver nigdy nie mógł trafić. Dlatego `readMemberId`
 * i `readMemberLabel` czytają OBIE konwencje: kontrakt typu (`OrganizationMember`,
 * camelCase) i to, co realnie leci po drucie (snake_case).
 *
 * UCZCIWOŚĆ ZAMIAST ZGADYWANIA: gdy członka nie ma na liście (konto usunięte,
 * lista jeszcze nie doszła, 403 na katalogu dla zwykłego użytkownika) resolver
 * zwraca `null`, a wołacz pokazuje `memberNameOrUnknown` („Nieznany
 * użytkownik"). NIE wymyślamy nazwiska i NIE pokazujemy UUID-a w kolumnie,
 * w której właściciel spodziewa się człowieka.
 */
export type MemberNameResolver = (userId: string) => string | null;

type RawMember = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Identyfikator UŻYTKOWNIKA (nie wiersza członkostwa) — obie konwencje nazw. */
export function readMemberId(member: RawMember): string {
  return str(member.userId) || str(member.user_id) || str(member.id);
}

/** Etykieta do pokazania: nazwa → imię+nazwisko → e-mail. `null` gdy nic nie ma. */
export function readMemberLabel(member: RawMember): string | null {
  const name = str(member.name);
  if (name) return name;
  const first = str(member.firstName) || str(member.first_name);
  const last = str(member.lastName) || str(member.last_name);
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  const email = str(member.email);
  return email || null;
}

/** Czysta (testowalna) budowa mapy `userId → etykieta` z odpowiedzi API. */
export function buildMemberNameMap(members: ReadonlyArray<RawMember> | null | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  (members ?? []).forEach((member) => {
    if (!member || typeof member !== 'object') return;
    const id = readMemberId(member);
    const label = readMemberLabel(member);
    if (id && label) map[id] = label;
  });
  return map;
}

/**
 * Etykieta osoby dla WARSTWY WIDOKU. Nigdy nie zwraca UUID-a — gdy katalog nie
 * zna identyfikatora, wraca „Nieznany użytkownik" (klucz i18n już istniał
 * w `translation.json` jako `unknownAuthor`/`unknownActor`).
 */
export function memberNameOrUnknown(
  resolveMemberName: MemberNameResolver | null | undefined,
  userId: string | null | undefined,
  isPolish: boolean
): string {
  const id = str(userId);
  if (!id) return isPolish ? 'Nieprzypisany' : 'Unassigned';
  const name = resolveMemberName?.(id);
  if (name) return name;
  return isPolish ? 'Nieznany użytkownik' : 'Unknown user';
}

export function useOrganizationMemberNames(): MemberNameResolver {
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    OrganizationApi.getOrganizationMembers(currentOrganization.id)
      .then((members) => {
        if (cancelled) return;
        setMemberNameById(buildMemberNameMap(members as unknown as RawMember[]));
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
