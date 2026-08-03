/**
 * MW-10 — JEDNO miejsce, w którym liczą się uprawnienia do dokumentu Vault.
 *
 * PO CO: kontrakt MW-10 pkt 6/8 wymaga, żeby reguła własności obowiązywała
 * IDENTYCZNIE dla dokumentu i dla KAŻDEJ jego wersji. Przed MW-10 reguły były
 * rozsypane po `knowledge.routes.ts`: lista miała własne WHERE
 * (`KnowledgeService.getDocuments`), edycja metadanych własny predykat
 * (`canEditOwnPrivateDocument`), a `DELETE /documents/:id` NIE MIAŁ ŻADNEGO
 * sprawdzenia poza `organization_id` — czyli dowolny użytkownik organizacji mógł
 * skasować CUDZY dokument prywatny (`scope='user'`), którego nawet nie widział na
 * liście. To jest zamknięte tutaj (`canDelete` wymaga czytelności).
 *
 * ZAKRES ZMIANY UPRAWNIEŃ względem stanu przed MW-10:
 *   - `canMutateContent` = 1:1 dotychczasowy `canEditOwnPrivateDocument`
 *     (superadmin albo właściciel WŁASNEGO dokumentu prywatnego) + wymóg
 *     czytelności. Dokumenty project/organization pozostają superadmin-only,
 *     tak jak dotąd — MW-10 tego celowo nie rozszerza (VLT-002: „Dokumentów
 *     project/organization NIE odblokowujemy tu dla zwykłych userów — to
 *     pozostaje SuperAdmin-only").
 *   - `canDelete` ZAWĘŻONE i WYRÓWNANE z `canMutate` (poprawka po recenzji
 *     CTO 2026-08-02 — patrz DZIENNIK niżej): dla `scope='user'` naprawia
 *     realną lukę (cudzy dokument prywatny przestał być usuwalny). Dla
 *     `scope='project'|'organization'` teraz TA SAMA reguła co mutate
 *     (superadmin-only), a nie „każdy, kto widzi" — pierwsza wersja tego
 *     pliku pozwalała project/org-scope usuwać KAŻDEMU członkowi/userowi
 *     organizacji, co nie miało odpowiednika w decyzji VLT-002 (ta explicite
 *     ograniczała tylko EDYCJĘ do superadmina, o DELETE milczała — zgadywanie
 *     "delete = szerzej niż edit" nie miało uzasadnienia w kodzie ani w
 *     dokumentacji). Wyszło na jaw przy budowaniu macierzy uprawnień (recenzja
 *     pkt 3) jako niewytłumaczalna asymetria: member mógł skasować
 *     project-scoped dokument, ale nie mógł dodać do niego wersji. Naprawione
 *     przez ujednolicenie z mutate, nie przez rozluźnienie mutate.
 *
 * DZIENNIK: pierwsza wersja tego modułu (2026-08-02, przed recenzją CTO) miała
 * `canDeleteDocument` zwracające `true` dla KAŻDEGO czytelnika project/org-scope
 * dokumentu. Recenzja (pkt 3, budowa macierzy uprawnień) wykazała, że to była
 * niczym nieuzasadniona asymetria względem `canMutateDocument` — poprawione tu.
 */

export interface VaultAccessContext {
  organizationId: string;
  userId: string | null;
  isSuperAdmin: boolean;
  /** Projekty, w których wołający jest członkiem (`project_members`). */
  memberProjectIds: string[];
}

export interface VaultDocumentLike {
  id?: string;
  organization_id?: string | null;
  owner_id?: string | null;
  scope?: string | null;
  project_id?: string | null;
  deleted_at?: string | null;
  version?: number | string | null;
}

/** Dokumenty sprzed VLT-001 mają `scope IS NULL` — to była faktycznie widoczność organizacyjna. */
export const effectiveScope = (doc: VaultDocumentLike): 'user' | 'project' | 'organization' => {
  const s = doc?.scope;
  return s === 'user' || s === 'project' ? s : 'organization';
};

const sameOrg = (doc: VaultDocumentLike, ctx: VaultAccessContext): boolean => {
  const docOrg = doc?.organization_id;
  // `organization_id IS NULL` = dokumenty globalne sprzed multi-tenancy; taka
  // sama tolerancja jak w `KnowledgeService.getDocuments`. Wiersz z ustawionym,
  // CUDZYM `organization_id` nie przechodzi NIGDY (izolacja tenantów).
  if (docOrg === null || docOrg === undefined || docOrg === '') return true;
  return String(docOrg) === String(ctx.organizationId);
};

/**
 * Czy wołający może CZYTAĆ dokument. Odwzorowuje regułę widoku listy
 * (`KnowledgeService.getDocuments`), rozszerzoną o superadmina — to samo
 * uprawnienie, którym superadmin już dziś edytuje dowolny dokument Vault
 * (`canEditOwnPrivateDocument`), więc odczyt pojedynczego dokumentu nie może być
 * węższy niż jego prawo zapisu.
 */
export function canReadDocument(doc: VaultDocumentLike | null, ctx: VaultAccessContext): boolean {
  if (!doc) return false;
  if (doc.deleted_at) return false;
  if (!sameOrg(doc, ctx)) return false;
  if (ctx.isSuperAdmin) return true;

  const scope = effectiveScope(doc);
  if (scope === 'user') {
    return Boolean(ctx.userId) && String(doc.owner_id || '') === String(ctx.userId);
  }
  if (scope === 'project') {
    const pid = String(doc.project_id || '');
    return Boolean(pid) && ctx.memberProjectIds.map(String).includes(pid);
  }
  return true;
}

/**
 * Czy wołający może ZMIENIAĆ treść/wersje/metadane dokumentu. Ten sam predykat
 * obsługuje: nową wersję, restore, edycję metadanych i zmianę poziomu — dzięki
 * temu „bez prawa edit nie ruszysz wersji" jest prawdą z konstrukcji, a nie
 * przez powtórzony if w każdym handlerze.
 */
export function canMutateDocument(doc: VaultDocumentLike | null, ctx: VaultAccessContext): boolean {
  if (!canReadDocument(doc, ctx)) return false;
  if (ctx.isSuperAdmin) return true;
  return (
    effectiveScope(doc!) === 'user' &&
    Boolean(ctx.userId) &&
    String(doc!.owner_id || '') === String(ctx.userId)
  );
}

/** Restore to zapis treści — dokładnie to samo prawo co edycja (kontrakt pkt 8). */
export const canRestoreDocument = canMutateDocument;

/**
 * Usunięcie. Naprawia realną lukę sprzed MW-10 (cudzy dokument prywatny był
 * usuwalny przez każdego w organizacji — zero sprawdzenia poza
 * `organization_id`). Dla `scope='project'|'organization'` TA SAMA reguła co
 * `canMutateDocument` (superadmin-only) — patrz DZIENNIK w nagłówku pliku:
 * pierwsza wersja pozwalała tu każdemu czytelnikowi, co nie miało pokrycia w
 * decyzji VLT-002 i wyszło na jaw jako asymetria przy budowie macierzy
 * uprawnień.
 */
export function canDeleteDocument(doc: VaultDocumentLike | null, ctx: VaultAccessContext): boolean {
  return canMutateDocument(doc, ctx);
}

export default {
  effectiveScope,
  canReadDocument,
  canMutateDocument,
  canRestoreDocument,
  canDeleteDocument,
};
