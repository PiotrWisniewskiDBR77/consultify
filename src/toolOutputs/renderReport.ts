/**
 * Deterministyczne renderery Report i Presentation.
 *
 * KONTRAKT (decyzja koordynatora 2026-08-13):
 *  - Report i Presentation renderują ten sam ZATWIERDZONY Artifact.
 *  - Nigdy zrzut ekranu. Wynikiem jest model dokumentu, nie obrazek.
 *  - Ten sam Output + ta sama wersja renderera = ten sam dokument (hash).
 *  - Presentation usuwa kontrolki i skraca treść, ale NIE zmienia znaczenia
 *    ani klasyfikacji — to inna gęstość tej samej prawdy.
 *
 * Renderer nie wywołuje modelu językowego. Cała treść pochodzi z Outputu.
 */

import { contentHash } from './contentHash';
import type {
  ReportBlock,
  ReportSection,
  ToolOutput,
  ToolReportDocument,
  ToolReportKind,
  ToolReportTheme,
} from './types';

/** Podbijamy przy każdej zmianie kształtu dokumentu — dokumenty są wersjonowane. */
export const REPORT_RENDERER_VERSION = '1.0.0';

export class OutputNotApprovedError extends Error {
  constructor(outputId: string, status: string) {
    super(`Output ${outputId} ma status "${status}" — raport wolno renderować wyłącznie z zatwierdzonych.`);
    this.name = 'OutputNotApprovedError';
  }
}

export interface RenderOptions {
  id: string;
  organizationId: string;
  kind: ToolReportKind;
  theme?: ToolReportTheme;
  title: string;
  /** Presentation domyślnie skraca; można wymusić pełną treść. */
  maxConclusionsPerOutput?: number;
}

/**
 * Action title sekcji = WNIOSEK, nie etykieta i nie statystyka silnika.
 *
 * Świadomie NIE używamy tu K1: K1 jest policzalną podstawą („Podstawa: 2
 * napięcia o wadze 6"), a nagłówek ma nieść to, co czytelnik ma zrozumieć.
 * Pierwsza rekomendacja K3 jest najbliższa wnioskowi, bo zaczyna się od
 * czasownika i niesie decyzję. Powtórzenie K1 w nagłówku i w bloku konkluzji
 * było dublem wykrytym na zrzucie przed odbiorem właściciela.
 */
function buildActionTitle(output: ToolOutput): string {
  const first = output.conclusions[0];
  const leadAction = first?.k3Actions?.[0];
  if (leadAction) return leadAction;
  if (first?.k2Meaning) return first.k2Meaning;
  return output.title;
}

function buildSection(output: ToolOutput, kind: ToolReportKind, maxConclusions: number): ReportSection {
  const blocks: ReportBlock[] = [];

  // Grafika sygnaturowa — to samo źródło danych co w sesji.
  blocks.push({
    kind: 'signature-visual',
    archetype: output.toolType,
    payload: { items: output.items, tensions: output.tensions },
  });

  // Napięcia: w prezentacji tylko najważniejsze, w raporcie wszystkie.
  // Sortowanie W PAMIĘCI i stabilne — przy równym priorytecie rozstrzyga id,
  // inaczej ten sam Output dałby dwa różne dokumenty.
  const tensions = [...output.tensions].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  if (tensions.length > 0) {
    blocks.push({
      kind: 'tension-list',
      items: (kind === 'presentation' ? tensions.slice(0, 4) : tensions).map((t) => ({
        posture: t.posture,
        title: t.title,
        priority: t.priority,
      })),
    });
  }

  // Dowody: raport pokazuje pełną listę, prezentacja ją pomija —
  // pełny tekst zostaje w raporcie, nie na slajdzie.
  if (kind === 'report' && output.items.length > 0) {
    blocks.push({
      kind: 'evidence-list',
      items: output.items.map((i) => ({ label: i.label, evidenceKind: i.evidenceKind })),
    });
  }

  // Wnioski K1-K4 — treść przenoszona dosłownie, renderer niczego nie redaguje.
  output.conclusions.slice(0, maxConclusions).forEach((c) => {
    blocks.push({
      kind: 'conclusion',
      k1Fact: c.k1Fact,
      k2Meaning: c.k2Meaning,
      k3Actions: [...c.k3Actions],
      k4Effect: c.k4Effect,
      tradeoff: { ...c.tradeoff },
    });
  });

  return {
    id: `section-${output.id}`,
    actionTitle: buildActionTitle(output),
    sourceOutputId: output.id,
    blocks,
  };
}

/**
 * Renderuje dokument z JEDNEGO lub WIELU zatwierdzonych Outputów.
 * Rzuca, gdy którykolwiek Output nie jest zatwierdzony — dokument klienta nie
 * powstaje z roboczej wersji.
 */
export function renderToolReport(outputs: ToolOutput[], options: RenderOptions): ToolReportDocument {
  if (outputs.length === 0) {
    throw new Error('Raport wymaga co najmniej jednego zatwierdzonego Outputu.');
  }

  outputs.forEach((o) => {
    if (o.status !== 'approved') throw new OutputNotApprovedError(o.id, o.status);
  });

  const kind = options.kind;
  const theme: ToolReportTheme = options.theme ?? 'executive-paper';
  const maxConclusions =
    options.maxConclusionsPerOutput ?? (kind === 'presentation' ? 3 : Number.MAX_SAFE_INTEGER);

  // Kolejność sekcji jest znacząca i musi być deterministyczna: bierzemy
  // kolejność wejściową, a nie kolejność z bazy.
  const sections = outputs.map((o) => buildSection(o, kind, maxConclusions));

  const body = {
    kind,
    theme,
    title: options.title,
    rendererVersion: REPORT_RENDERER_VERSION,
    sourceOutputIds: outputs.map((o) => o.id),
    sections,
  };

  return {
    id: options.id,
    organizationId: options.organizationId,
    ...body,
    contentHash: contentHash(body),
  };
}
