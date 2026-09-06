/**
 * 1.1-A (06.09) — PROPOZYCJA DOKUMENTU OBOK. [ODMROZENIE 13_CHAT DEC-397]
 *
 * Gdy w Czacie jest otwarty dokument obok, a użytkownik prosi o treść „w
 * oknie obok / w dokumencie / obok", Teresa NIE pisze do dokumentu sama i NIE
 * tworzy obiektu w innym module. Wytwarza PROPOZYCJĘ: Markdown do podglądu w
 * karcie czatu, którą człowiek wstawia jednym kliknięciem („Wstaw do
 * dokumentu" / „Zastąp sekcję") albo odrzuca.
 *
 * Zgodność z `docs/ssot/ZASADY_AI_TERESA_SSOT.md`:
 *   • §3 klasa „Twórz szkic": `mutates ⇒ requiresPreview` — podgląd jest
 *     obowiązkowy, karta go daje;
 *   • §3 „Zakaz auto-apply" — zapis do dokumentu wychodzi WYŁĄCZNIE z
 *     kliknięcia człowieka (patrz `CANVAS_DOCUMENT_APPLY_EVENT`);
 *   • §8 J1 — treść domyślnie po polsku.
 *
 * Kontrakt serwerowy: ZERO nowego. Używamy istniejącego `POST /api/ai/generate`
 * (`AiGenerateRequestSchema`: `message` + `systemInstruction`, odpowiedź
 * `{ text }`), tego samego, z którego korzystają inne narzędzia w aplikacji.
 */

/** Zdarzenie „wstaw zatwierdzoną treść do otwartego dokumentu obok". */
export const CANVAS_DOCUMENT_APPLY_EVENT = 'canvas-document-apply';

export type CanvasDocumentApplyMode = 'append' | 'replace';

export interface CanvasDocumentApplyDetail {
  markdown: string;
  mode: CanvasDocumentApplyMode;
  proposalId: string;
}

export interface CanvasDocumentProposal {
  proposalId: string;
  /** Prośba użytkownika, słowo w słowo — to jest tytuł karty. */
  request: string;
  /** Treść do wstawienia (Markdown kanoniczny). */
  markdown: string;
  /** Tytuł dokumentu, do którego propozycja jest adresowana. */
  documentTitle: string;
  /** Czy w dokumencie było zaznaczenie (wtedy „Zastąp sekcję" ma sens). */
  hasSelection: boolean;
  state: 'pending' | 'applied' | 'rejected';
}

const PL_SYSTEM = [
  'Jesteś Teresą — asystentką konsultanta. Piszesz treść, która ma trafić do OTWARTEGO obok dokumentu roboczego.',
  'Zwróć WYŁĄCZNIE gotową treść w Markdown: nagłówki (##), akapity, listy, tabele.',
  'ZAKAZ: wstępów typu „Oto plan", pytań o zgodę, komentarzy o sobie, bloków kodu ``` wokół całości.',
  'Nie wymyślaj liczb ani faktów, których nie ma w kontekście — brakującą wartość zapisz jako „—".',
  'Pisz po polsku, konkretnie, w rzeczowym tonie doradczym.',
].join('\n');

const EN_SYSTEM = [
  'You are Teresa, a consultant copilot. You write content that goes into the work document opened next to the chat.',
  'Return ONLY the finished Markdown: headings (##), paragraphs, lists, tables.',
  'FORBIDDEN: preambles like "Here is the plan", asking for approval, meta commentary, wrapping the whole answer in ``` fences.',
  'Never invent numbers or facts that are not in the context — write a missing value as "—".',
  'Write concretely, in a factual advisory tone.',
].join('\n');

/** Zdejmuje opakowanie ```markdown … ``` i przycina puste linie z brzegów. */
export function stripMarkdownFence(raw: string): string {
  const text = String(raw || '').trim();
  const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : text).trim();
}

export function buildDocumentProposalMessage(params: {
  request: string;
  documentMarkdown: string;
  selectedText?: string;
}): string {
  const parts = [
    `Prośba użytkownika: ${params.request.trim()}`,
    params.documentMarkdown.trim()
      ? `Aktualna treść dokumentu (Markdown):\n"""\n${params.documentMarkdown.trim().slice(0, 12000)}\n"""`
      : 'Dokument jest obecnie pusty.',
    params.selectedText?.trim()
      ? `Zaznaczony fragment (do zastąpienia):\n"""\n${params.selectedText.trim().slice(0, 4000)}\n"""`
      : '',
    'Zwróć samą treść do wstawienia.',
  ].filter(Boolean);
  return parts.join('\n\n');
}

export interface RequestDocumentProposalParams {
  request: string;
  documentMarkdown: string;
  documentTitle: string;
  selectedText?: string;
  language?: string;
  signal?: AbortSignal;
  /** Wstrzykiwane w testach; domyślnie globalny `fetch`. */
  fetchImpl?: typeof fetch;
  /** Wstrzykiwane w testach; domyślnie `localStorage.token`. */
  token?: string | null;
}

/**
 * Wytwarza propozycję treści. NIE zapisuje niczego — ani do dokumentu, ani do
 * żadnego modułu. Zwraca `null`, gdy model nie oddał treści.
 */
export async function requestDocumentProposal(
  params: RequestDocumentProposalParams
): Promise<CanvasDocumentProposal | null> {
  const doFetch = params.fetchImpl || fetch;
  const token =
    params.token !== undefined
      ? params.token
      : typeof localStorage !== 'undefined'
        ? localStorage.getItem('token')
        : null;
  const isPolish = String(params.language || 'pl')
    .toLowerCase()
    .startsWith('pl');

  const response = await doFetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: buildDocumentProposalMessage({
        request: params.request,
        documentMarkdown: params.documentMarkdown,
        selectedText: params.selectedText,
      }),
      systemInstruction: isPolish ? PL_SYSTEM : EN_SYSTEM,
      roleName: 'TERESA_DOCUMENT_PROPOSAL',
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      String(
        (body as { error?: { message?: string }; message?: string } | null)?.error?.message ||
          (body as { message?: string } | null)?.message ||
          `AI ${response.status}`
      )
    );
  }

  const data = (await response.json()) as { text?: string; response?: string; content?: string };
  const markdown = stripMarkdownFence(String(data?.text || data?.response || data?.content || ''));
  if (!markdown) return null;

  return {
    proposalId: `doc-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    request: params.request,
    markdown,
    documentTitle: params.documentTitle,
    hasSelection: Boolean(params.selectedText && params.selectedText.trim().length > 0),
    state: 'pending',
  };
}
