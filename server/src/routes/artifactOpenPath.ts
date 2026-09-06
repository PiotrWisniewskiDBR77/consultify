/**
 * Trasa otwarcia dla artefaktu o runtime `native_artifact` — wydzielona z
 * `buildActionTargetPayload` (artifacts.routes.ts), żeby dała się przetestować
 * bez montowania całego routera (ten plik ciągnie pół serwera przy imporcie).
 *
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały) — „pierwszy dokument z listy
 * otwiera się jako 404". POMIAR NA STAGINGU (organizacja DBR77, GET z tokenem
 * właściciela):
 *   - `GET /api/artifacts?outputType=report&limit=200` → 69 wierszy, 65 z
 *     `originRuntime='native_artifact'`;
 *   - 61 z nich ma `originRecordId` w kształcie Document Studio
 *     (`artifact-<uuid>`) i `GET /api/document-studio/<id>` → 200;
 *   - pozostałe 4 mają `originRecordId` = `generationId` dostawy z czatu i
 *     `GET /api/document-studio/<id>` → 404 „not_found". To DOKŁADNIE te
 *     4 wiersze, które właściciel widział jako „Nie ma tu dokumentu"
 *     (m.in. „Analizę dla rynku polskiego tylko");
 *   - ten sam identyfikator na `GET /api/work-canvas/drafts/<id>` → 200 z
 *     pełnym draftem. Obiekt ISTNIEJE, tylko mieszka gdzie indziej.
 *
 * Przyczyna: kilku pisarzy rejestruje w Bibliotece wyników rekord, którego
 * NIE MA w Document Studio (`wave5_artifacts`), pod runtime `native_artifact`
 * — bo `native_artifact` jest jedyną dopuszczoną wartością dla rodziny
 * `document` (RegisterArtifactOriginParamsSchema + CHECK na
 * `v8_artifact_origin_links.origin_runtime`). Taki wiersz rodzi się z martwym
 * linkiem.
 *
 * ★ POMIAR 06/07.09 (stanowisko lokalne, baza 54400, organizacja DBR77) —
 * naprawa z 05.09 rozpoznawała TYLKO `sourceType === 'chat'`, więc łapała
 * dwóch pisarzy z pięciu. `GET /api/artifacts?outputType=report&limit=100`
 * → 14 wierszy, 2 z `native_artifact`; jeden z nich
 * (`99849d62-cdef-4507-bacd-85081b6c430a`, `sourceType: 'work_canvas'`,
 * `sourceTable: 'work_canvas_drafts'`) dostawał
 * `openPath: /document-studio/99849d62-…`, a `GET /api/document-studio/<id>`
 * → **404 `not_found`**. Ten sam identyfikator jest wierszem
 * `work_canvas_drafts` (tytuł „Plan strategiczny w kontekście cyfrowej
 * transformacji organizacji…"). Objaw identyczny jak 05.09, inny pisarz.
 *
 * PEŁNA RODZINA PISARZY `native_artifact` (przejrzana, nie próbkowana):
 *   | pisarz                                        | sourceType                      | gdzie NAPRAWDĘ leży rekord |
 *   | document-studio.routes.ts (generate/create)   | `document_studio`               | wave5_artifacts     → OK   |
 *   | deliverables/docGenerationRuntime.ts (doc)    | `deliverables_doc_generation`   | wave5_artifacts     → OK   |
 *   | meetingBoundary/meetingBoundaryService.ts     | `meeting`                       | wave5_artifacts     → OK   |
 *   | routes/artifacts.routes.ts (register-chat)    | `chat`                          | work_canvas_drafts  → 404  |
 *   | services/ai/tools/generateDeliverable.ts      | `chat`                          | work_canvas_drafts  → 404  |
 *   | routes/work-canvas.routes.ts (register-in-outputs) | `work_canvas`              | work_canvas_drafts  → 404  |
 *   | deliverables/docGenerationRuntime.ts (sheet)  | `deliverables_sheet_generation` | work_canvas_drafts  → 404  |
 *
 * Dopóki dostawa z kanwy/czatu nie ma własnego, uczciwego runtime'u (zmiana
 * szersza niż ta naprawa), NIE WOLNO wystawiać adresu, o którym wiadomo, że
 * kończy się 404. Rozpoznajemy te wiersze po SEMANTYCE — `originSummary`
 * mówi wprost, w której TABELI leży rekord (`sourceTable`) i z jakiej
 * powierzchni pochodzi (`sourceType`) — nie po kształcie napisu. Kierujemy do
 * miejsca, w którym obiekt naprawdę jest: `?workPanel=1&canvasDraftId=` czyta
 * `UnifiedChatPanel` (ta sama trasa, co `buildDuplicateChatUrl` przy akcji
 * „Duplikuj"). Wzorzec jak HOTFIX task#63 dla `assessment_report`.
 *
 * ★ DLACZEGO NIE ODWROTNA LISTA (tylko `sourceTable === 'document_studio_artifacts'`
 * → Studio, reszta → nigdzie): wiersze SPRZED wprowadzenia `originSummary`
 * nie niosą żadnego znacznika, a pomiar na stagingu pokazał 61 działających
 * adresów Document Studio. Domyślne zachowanie zostaje więc bez zmian —
 * odcinamy wyłącznie te źródła, dla których ZMIERZYLIŚMY, że rekord leży w
 * `work_canvas_drafts`.
 */
export interface NativeArtifactOpenTarget {
  openPath: string | null;
  exportPath: string | null;
  authority: 'document_studio' | 'chat_canvas';
}

/**
 * Źródła, dla których `originRecordId` jest identyfikatorem wiersza
 * `work_canvas_drafts`, a NIE artefaktu Document Studio. Lista pochodzi
 * z przeglądu WSZYSTKICH pisarzy `originRuntime: 'native_artifact'`
 * w `server/src/` (tabela w nagłówku pliku), nie z próbki.
 */
const CANVAS_DRAFT_SOURCE_TYPES = new Set([
  'chat',
  'work_canvas',
  'deliverables_sheet_generation',
]);

/** Tabela, w której leżą drafty kanwy — pisarze deklarują ją wprost. */
const CANVAS_DRAFT_SOURCE_TABLE = 'work_canvas_drafts';

function readSummaryField(
  originSummary: Record<string, unknown> | null | undefined,
  key: 'sourceType' | 'sourceTable'
): string {
  const raw = (originSummary as Record<string, unknown> | null | undefined)?.[key];
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function resolveNativeArtifactOpenTarget(params: {
  originRecordId: string;
  originSummary?: Record<string, unknown> | null;
}): NativeArtifactOpenTarget {
  const originRecordId = String(params.originRecordId || '');
  const sourceType = readSummaryField(params.originSummary, 'sourceType');
  const sourceTable = readSummaryField(params.originSummary, 'sourceTable');

  const livesInCanvasDrafts =
    CANVAS_DRAFT_SOURCE_TYPES.has(sourceType) || sourceTable === CANVAS_DRAFT_SOURCE_TABLE;

  if (livesInCanvasDrafts) {
    return {
      openPath: originRecordId
        ? `/chat?workPanel=1&canvasDraftId=${encodeURIComponent(originRecordId)}`
        : null,
      exportPath: null,
      authority: 'chat_canvas',
    };
  }

  return {
    openPath: `/document-studio/${originRecordId}`,
    exportPath: `/api/document-studio/${originRecordId}/export/pdf`,
    authority: 'document_studio',
  };
}
