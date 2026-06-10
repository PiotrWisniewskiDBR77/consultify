# Benchmarki konkurencji → moduły Consultify

Cel: zamienić surową hałdę scrapów (`~/Documents/Antygracity/DRD/Softs`, 38 GB)
w **żywy benchmark** — jeden zwięzły brief na moduł, z którego zespół i AI (Teresa/Anna)
czerpią przy projektowaniu i przepisywaniu funkcji.

**Status: ukończone (2026-06-10).** 16 briefów zdystylowanych z realnej treści scrapów,
44 prawdziwe zrzuty w `assets/`. Surowiec (35 GB) przeniesiony do Kosza
(`~/.Trash/Softs_distilled_raw_2026-06-10/`) — do odzysku dysku wystarczy opróżnić Kosz;
do przywrócenia: „Put Back"/przeciągnięcie folderu. **Prawdą zostaje ten katalog.**

## Mapa moduł → brief (taksonomia benchmarku)

| Brief | Moduł Consultify | Grounding | Zrzuty | Status |
|---|---|---|---|---|
| `chat-and-ai.md`        | Chat + Canvas + asystent (Teresa/Anna) | scrape (Kimi) / partial | 4 | ✅ |
| `whiteboard.md`         | Ideas: Whiteboard                      | partial (tldraw nav + UI) | 3 | ✅ |
| `process-flow.md`       | Ideas: Process Flow                    | scrape | 3 | ✅ |
| `mind-map.md`           | Ideas: Mind Map                        | scrape | 3 | ✅ |
| `tables.md`             | Ideas: Table + Table Studio            | scrape | 4 | ✅ |
| `surveys-interview.md`  | Ankiety + Wywiad                       | scrape / partial | 4 | ✅ |
| `kpi-insights.md`       | KPI/OKR + Insights                     | scrape | 3 | ✅ |
| `calendar-meeting.md`   | Meeting / Kalendarz                    | partial (API-docs only) | 0 | ✅ |
| `notes-notebooks.md`    | Notes / Notebooks                      | scrape | 3 | ✅ |
| `presentations.md`      | Presentation Studio (Deliverables)     | scrape | 4 | ✅ |
| `projects-initiatives.md`| Initiatives / Projekty                | scrape | 3 | ✅ |
| `knowledge-base.md`     | Help/KB (Anna/Teresa digest)           | scrape / partial | 3 | ✅ |
| `realtime-collab.md`    | Multiplayer (Canvas/Whiteboard)        | scrape / partial | 0 | ✅ |
| `integrations.md`       | Integracje / sync                      | scrape | 3 | ✅ |
| `enterprise-aip.md`     | Wzorce enterprise / data-ops           | scrape / partial | 2 | ✅ |
| `financial-analysis.md` | Analiza finansowa (spekulatywny moduł) | scrape / partial | 2 | ✅ |

`calendar-meeting` i `realtime-collab` bez zrzutów świadomie — źródła to dokumentacja API /
artykuły architektoniczne (brak realnego UI produktu). `0 Program partnerski` (affiliate) —
research biznesowy, nie moduł; pominięty (surowiec w Koszu).

## Jak korzystać
Każdy brief ma stałą strukturę (`_TEMPLATE.md`): §1 krajobraz konkurencji, §2 wzorce UX/IA
(z osadzonymi zrzutami), §3 model danych, §4 API/realtime, §5 decyzje **✅ kradniemy / ❌ unikamy**,
§6 otwarte pytania. Przy przepisywaniu modułu — zacznij od §5 i §3 odpowiedniego briefu.

## Znaleziska — źródła błędnie oznaczone (zapisane, surowiec w Koszu)
- `0 Ankiety/Qualtrics 2` = faktycznie **Typeform**; `0 Ankiety/typerform 2` = faktycznie **Qualtrics** (para zamieniona).
- `0 Projekty/Monday help.zip` = **Notion API**; `0 Projekty/Monday support.zip` = **Evernote**.
- `0 Miro/added/Visio.zip` = generyczny **Microsoft Learn**, nie Visio.
- `0 Analiza finansowa/Apiary.zip` = **Anaplan Integration API** (host apiary.io), NIE Apiary.io — w zakresie modułu finansowego.
- Puste: `0 synchronizacja/Boomi2`, `0 Kalendarz/GOOGLE CALENDAR`.
- `Looker` / `Lookre 2` / `Looker 3` = ten sam vendor (Google Looker), różne podzbiory.

## Powiązania
- Standard treści kart: [`docs/standards/CARD_CONTENT_FORMULA.md`](../standards/CARD_CONTENT_FORMULA.md)
- Audyt + logi sprzątania surowca: `Softs/_AUDIT/` (`08_DELETED_LOG.txt`, `09_TRASHED_MANIFEST.txt`)
- Tabela/Preview: brief `tables.md` jest komplementarny do `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`
  (kandydat na obiecany `matrix-editor-standard.md`).
