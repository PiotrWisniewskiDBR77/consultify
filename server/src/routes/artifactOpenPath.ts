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
 * Przyczyna: dwaj pisarze rejestrują dostawę z czatu jako `native_artifact` z
 * `originRecordId: generationId` (`services/ai/tools/generateDeliverable.ts`
 * oraz `POST /artifacts/register-chat`). Taki rekord nigdy nie istniał w
 * Document Studio, więc wiersz rodzi się z martwym linkiem.
 *
 * Dopóki dostawa z czatu nie ma własnego, uczciwego runtime'u (zmiana szersza
 * niż ta naprawa), NIE WOLNO wystawiać adresu, o którym wiadomo, że kończy się
 * 404. Rozpoznajemy te wiersze po SEMANTYCE (`originSummary.sourceType`), nie po
 * kształcie napisu, i kierujemy do miejsca, w którym obiekt naprawdę jest:
 * `?workPanel=1&canvasDraftId=` czyta `UnifiedChatPanel` (ta sama trasa, co
 * `buildDuplicateChatUrl` przy akcji „Duplikuj"). Wzorzec jak HOTFIX task#63
 * dla `assessment_report`.
 */
export interface NativeArtifactOpenTarget {
  openPath: string | null;
  exportPath: string | null;
  authority: 'document_studio' | 'chat_canvas';
}

export function resolveNativeArtifactOpenTarget(params: {
  originRecordId: string;
  originSummary?: Record<string, unknown> | null;
}): NativeArtifactOpenTarget {
  const originRecordId = String(params.originRecordId || '');
  const sourceType = String(
    (params.originSummary as { sourceType?: unknown } | null | undefined)?.sourceType || ''
  )
    .trim()
    .toLowerCase();

  if (sourceType === 'chat') {
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
