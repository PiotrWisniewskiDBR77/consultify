/**
 * SSOT sześciu sekcji prawego panelu Idei (układ zaakceptowany przez
 * właściciela na prototypie, 2026-07-28) — patrz `ideaPanel6SectionsFlag.ts`.
 *
 * DLACZEGO OSOBNY PLIK, A NIE `ideaCanvasMelsChips.ts`:
 * budowniczy paska pięciu ikon (`buildIdeaCanvasRightRailTools`) żyje w
 * `ideaCanvasMelsChips.ts`, który w tej samej fali zmienia równolegle inny
 * robotnik. Sześć sekcji to układ ZA FLAGĄ (default OFF), więc dokładamy drugi,
 * niezależny budowniczy zamiast przepisywać cudzy plik: przy fladze OFF host
 * woła stary builder (zero zmian), przy ON — ten.
 *
 * KONTRAKT: identyfikatory muszą zgadzać się 1:1 z `IDEA_PANEL_6_SECTIONS`
 * konsumowanymi przez `IdeaWorkspaceTools` jako `onlySection` — powłoka podaje
 * id aktywnej ikony wprost. Rozjazd = pusty panel.
 *
 * MOSTY ZE STARYM KANONEM (żeby zapamiętany stan railа nie dawał pustki):
 *   comments → activity · history → activity · inspector/properties → properties
 *   problem/status/health/convert → overview
 */

import type { LucideIcon } from 'lucide-react';
import { History, Layers, LayoutDashboard, Link2, SlidersHorizontal, Sparkles } from 'lucide-react';

import type { RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell';

export const IDEA_PANEL_6_SECTION_IDS = [
  'overview',
  'properties',
  'relations',
  'ai',
  'activity',
  'tool',
] as const;
export type IdeaPanel6SectionId = (typeof IDEA_PANEL_6_SECTION_IDS)[number];

/**
 * Wszystkie identyfikatory, które host / zapamiętany stan railа mogą podać —
 * kanon 6 + kanon D1 (5 zakładek) + aliasy sprzed D1.
 */
const NA_SZESC: Record<string, IdeaPanel6SectionId> = {
  // kanon 6 (tożsamość)
  overview: 'overview',
  properties: 'properties',
  relations: 'relations',
  ai: 'ai',
  activity: 'activity',
  tool: 'tool',
  // kanon D1 (5 zakładek)
  comments: 'activity',
  history: 'activity',
  // aliasy sprzed D1
  problem: 'overview',
  status: 'overview',
  health: 'overview',
  convert: 'overview',
  inspector: 'properties',
};

/** Normalizacja dowolnego id zakładki do jednej z sześciu sekcji. */
export function normalizujDoSzesciu(sekcja: string | null | undefined): IdeaPanel6SectionId {
  if (!sekcja) return 'overview';
  return NA_SZESC[sekcja] ?? 'overview';
}

/**
 * HAKI POD PRZENIESIENIE CZTERECH PŁYWAJĄCYCH PANELI (osobne, późniejsze
 * zlecenie — NIE w tej robocie). Dziś nad płótnem wiszą: AI Blind Spots,
 * Map Health, Sceny, Warstwa sesji — i nie da się ich schować. Docelowo
 * Blind Spots i Map Health lądują w sekcji „AI", Sceny i Warstwa sesji w
 * sekcji „Narzędzie". Te dwa węzły DOM istnieją tylko przy fladze ON i są
 * puste, dopóki ktoś nie zaportaluje do nich panelu — dokładnie tak, jak
 * `WHITEBOARD_SESSION_PANEL_SLOT_ID` robi to dziś dla panelu sesji tablicy.
 * Pusty węzeł nie rysuje żadnej ramki, więc nie tworzy „martwego UI".
 */
export const IDEA_PANEL_AI_SLOT_ID = 'idea-panel-ai-slot';
export const IDEA_PANEL_TOOL_SLOT_ID = 'idea-panel-tool-slot';

export interface IdeaPanel6SectionLabels {
  overview: string;
  properties: string;
  relations: string;
  ai: string;
  activity: string;
  tool: string;
}

export const IDEA_PANEL_6_LABELS_PL: IdeaPanel6SectionLabels = {
  overview: 'Przegląd',
  properties: 'Właściwości',
  relations: 'Powiązania',
  ai: 'AI',
  activity: 'Aktywność',
  tool: 'Narzędzie',
};

export const IDEA_PANEL_6_LABELS_EN: IdeaPanel6SectionLabels = {
  overview: 'Overview',
  properties: 'Properties',
  relations: 'Relations',
  ai: 'AI',
  activity: 'Activity',
  tool: 'Tool',
};

const IKONY: Record<IdeaPanel6SectionId, LucideIcon> = {
  overview: LayoutDashboard,
  properties: SlidersHorizontal,
  relations: Link2,
  ai: Sparkles,
  activity: History,
  tool: Layers,
};

/**
 * MM-P3-01: dla Mapy myśli sekcja „Narzędzie"/„Tool" pokazuje WYŁĄCZNIE ustawienia
 * wyglądu węzłów/mapy (`MindmapInspector`: Styl/Układ/Motyw) — nazwa „Narzędzie"
 * myliła to z narzędziem-aplikacją (audyt `01_MIND_MAP_AUDIT.md`, `MM-P3-01`).
 * Pozostałe trzy reprezentacje (Whiteboard sesja, Process Flow/Table „brak
 * ustawień jeszcze") NIE są ustawieniami wyglądu — zostają przy generycznej
 * etykiecie „Narzędzie"/„Tool", żeby nie okłamać ich zawartości.
 */
export function ideaPanel6ToolLabel(
  activeTool: string | null | undefined,
  isPolish: boolean
): string {
  if (activeTool === 'mindmap') return isPolish ? 'Wygląd' : 'Appearance';
  return isPolish ? IDEA_PANEL_6_LABELS_PL.tool : IDEA_PANEL_6_LABELS_EN.tool;
}

/**
 * Pasek sześciu ikon prawego panelu.
 *
 * ŻADNA sekcja nie jest wyłączana: w układzie „przedmiot decyduje o treści"
 * każda sekcja ma treść albo UCZCIWY pusty stan (np. Właściwości bez
 * zaznaczenia mówią „zaznacz element"). Wyłączona ikona kłóciłaby się z zasadą
 * porządkującą — użytkownik ma przyzwyczaić się, że ikony ZAWSZE tu są.
 */
export function buildIdeaPanel6RailTools(args?: {
  isPolish?: boolean;
  /** Aktywna reprezentacja — MM-P3-01: zmienia tylko etykietę sekcji `tool`. */
  activeTool?: string | null;
  /** Liczniki na plakietkach (np. liczba wpisów Aktywności). Opcjonalne. */
  badges?: Partial<Record<IdeaPanel6SectionId, string | number>>;
}): RightRailToolDescriptor[] {
  const isPolish = Boolean(args?.isPolish);
  const etykiety = isPolish ? IDEA_PANEL_6_LABELS_PL : IDEA_PANEL_6_LABELS_EN;
  return IDEA_PANEL_6_SECTION_IDS.map((id) => ({
    id,
    label: id === 'tool' ? ideaPanel6ToolLabel(args?.activeTool, isPolish) : etykiety[id],
    icon: IKONY[id],
    badge: args?.badges?.[id],
    testId: `idea-panel6-rail-${id}`,
  }));
}
