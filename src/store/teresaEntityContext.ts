/**
 * teresaEntityContext — PRZYPIĘTY kontekst obiektu dla JEDNEGO okna Teresy.
 *
 * DLACZEGO OSOBNE POLE, A NIE `workspaceContext`:
 * decyzja właściciela 2026-09-01 („jedna Teresa, w swoim oknie") zdjęła czaty
 * z paneli artefaktów i zostawiła przycisk „Zapytaj Teresę o tę inicjatywę /
 * o tę prezentację / o tę notatkę". Przycisk otwierał Teresę, ale KONTEKST
 * OBIEKTU do niej nie docierał, bo:
 *   1. `MainLayout` (src/layouts/MainLayout.tsx:155-196, :485-489) na każdej
 *      trasie SPOZA Artifact Studio wylicza `workspaceContext` z trasy
 *      (`createWorkspaceContext(currentView, type, { projectId })` — BEZ
 *      `entityId`), wpisuje go do store'u i przekazuje propsem do panelu.
 *      Kontekst encji ustawiony przez `useOpenChatWithContext` był przez to
 *      nadpisywany przy najbliższym renderze layoutu.
 *   2. Pełne okno (`/chat`, `AppRoutes.tsx`) renderuje `<UnifiedChatPanel
 *      mode="full" />` BEZ propsa, a panel czytał kontekst wyłącznie z propsa.
 *   3. `workspaceContext` nie był persystowany (`partialize`), więc odświeżenie
 *      strony gubiło go bezpowrotnie.
 * Efekt: `selectedObjectId` / `selectedObjectType` w ładunku do modelu = null.
 *
 * ROZWIĄZANIE: kontekst obiektu mieszka w WŁASNYM polu store'u, którego
 * `MainLayout` nie dotyka (nie da się go nadpisać kontekstem trasy), jest
 * persystowany w localStorage i nakładany na kontekst-bazę w JEDNYM miejscu —
 * w `UnifiedChatPanel` — więc dok i pełne okno dostają go tym samym kodem.
 *
 * ZAKRES OBOWIĄZYWANIA (żeby przypięcie nie „ciągnęło się" po całej apce):
 * pin obowiązuje TYLKO gdy aktywna jest rozmowa, dla której go założono,
 * ALBO gdy użytkownik stoi na tej samej trasie, z której otworzył Teresę.
 * Po odświeżeniu na karcie obiektu ratuje nas ścieżka (`originPath`), po
 * odświeżeniu na `/chat/:id` — identyfikator rozmowy (`conversationId`).
 * Wejście na inny ekran => pin nie obowiązuje, kontekst wraca do trasowego.
 */
import type { WorkspaceContext, WorkspaceType } from '@/types/workspace';
import { AppView } from '@/types/core';

export interface TeresaEntityContext {
  /** Typ obiektu: 'initiative' | 'presentation' | 'notebook' | … */
  type: string;
  /** Identyfikator obiektu — to jest ta wartość, która ma dolecieć jako `selectedObjectId`. */
  entityId: string;
  entityName?: string;
  entityData?: Record<string, unknown>;
  /** Rozmowa, dla której kontekst założono (gdy znana). */
  conversationId?: string | null;
  /** Trasa, z której otwarto Teresę — przeżywa odświeżenie strony. */
  originPath?: string | null;
  ts: number;
}

/** Czy przypięty kontekst obowiązuje w danym miejscu aplikacji. */
export function isTeresaEntityContextInScope(
  pin: TeresaEntityContext | null | undefined,
  scope: { activeConversationId?: string | null; pathname?: string | null }
): boolean {
  if (!pin || !pin.entityId) return false;
  if (pin.conversationId && pin.conversationId === scope.activeConversationId) return true;
  if (pin.originPath && scope.pathname && pin.originPath === scope.pathname) return true;
  return false;
}

/**
 * Nakłada przypięty kontekst obiektu na kontekst-bazę (props / trasa).
 * Brak pinu albo pin poza zakresem => zwraca bazę BEZ ZMIAN (wsteczna
 * zgodność: wywołania bez kontekstu działają jak dotąd).
 */
export function resolveTeresaWorkspaceContext(
  base: WorkspaceContext | null | undefined,
  pin: TeresaEntityContext | null | undefined,
  scope: { activeConversationId?: string | null; pathname?: string | null }
): WorkspaceContext | null {
  if (!isTeresaEntityContextInScope(pin, scope)) return base ?? null;
  const applied = pin as TeresaEntityContext;
  return {
    ...(base || {}),
    view: base?.view ?? AppView.AI_CHAT,
    type: applied.type as WorkspaceType,
    entityId: applied.entityId,
    entityName: applied.entityName || base?.entityName,
    entityData: {
      ...(base?.entityData || {}),
      ...(applied.entityData || {}),
    },
    timestamp: base?.timestamp instanceof Date ? base.timestamp : new Date(),
  };
}

export default resolveTeresaWorkspaceContext;
