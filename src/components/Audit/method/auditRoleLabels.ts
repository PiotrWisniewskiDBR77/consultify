/**
 * auditRoleLabels — czytelne etykiety PL/EN dla ról audytowych
 * (`AUDIT_ROLES` w `server/src/services/audits/types.ts`).
 *
 * Bez tego pliku `lead_auditor`/`observer`/… renderowały się w UI jako
 * surowe klucze bazy danych (widoczne na zrzutach preview programu i w
 * kolumnie „Wymagane role" biblioteki). Świadomie WŁASNY plik modułu Audits,
 * a nie zmiana w `src/components/standard/**` — role audytowe (member role w
 * programie) to inna domena niż role platformowe/organizacyjne gdzie indziej
 * w produkcie, więc nie ma tu współdzielonego słownika do rozszerzenia.
 *
 * Nieznana wartość (np. rozjazd z backendem, dane historyczne) NIE pokazuje
 * surowego klucza z podkreśleniami — humanizuje go („evidence_owner" →
 * „Evidence owner") zamiast wyglądać jak literówka albo błąd.
 */
import type { AuditRole } from './auditsMethodApi';

const AUDIT_ROLE_LABEL: Record<AuditRole, { pl: string; en: string }> = {
  program_owner: { pl: 'Właściciel programu', en: 'Program owner' },
  lead_auditor: { pl: 'Audytor wiodący', en: 'Lead auditor' },
  auditor: { pl: 'Audytor', en: 'Auditor' },
  technical_expert: { pl: 'Ekspert techniczny', en: 'Technical expert' },
  auditee: { pl: 'Audytowany', en: 'Auditee' },
  evidence_owner: { pl: 'Właściciel dowodu', en: 'Evidence owner' },
  reviewer: { pl: 'Recenzent', en: 'Reviewer' },
  action_owner: { pl: 'Właściciel działania', en: 'Action owner' },
  administrator: { pl: 'Administrator', en: 'Administrator' },
  viewer: { pl: 'Obserwator (odczyt)', en: 'Viewer' },
};

/** Zamienia `snake_case`/`kebab-case` na „Snake case" — czytelniejsze niż surowy klucz. */
function humanize(raw: string): string {
  const spaced = raw.replace(/[_-]+/g, ' ').trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function auditRoleLabel(role: string | null | undefined, isPolish = false): string {
  if (!role) return '—';
  const entry = AUDIT_ROLE_LABEL[role as AuditRole];
  if (entry) return isPolish ? entry.pl : entry.en;
  return humanize(role);
}
