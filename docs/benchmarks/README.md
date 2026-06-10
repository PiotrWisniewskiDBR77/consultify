# Benchmarki konkurencji → moduły Consultify

Cel: zamienić surową hałdę scrapów (`~/Documents/Antygracity/DRD/Softs`, 38 GB)
w **żywy benchmark** — jeden zwięzły brief na moduł, z którego zespół i AI (Teresa/Anna)
czerpią przy projektowaniu i przepisywaniu funkcji.

Źródło surowe jest tymczasowe (kasowane po dystylacji). **Prawdą zostaje ten katalog.**

## Mapa moduł → źródła (taksonomia benchmarku)

| Brief | Moduł Consultify | Źródła w `Softs/` | Status |
|---|---|---|---|
| `chat-and-ai.md`        | Chat + Canvas + asystent (Teresa/Anna) | 0 Czat, 0 Prompty, 0 Agenci, KIMI | ☐ todo |
| `whiteboard.md`         | Ideas: Whiteboard                      | 0 Whiteboard (Tldraw), 0 Miro (Excalidraw) | ☐ todo |
| `process-flow.md`       | Ideas: Process Flow                    | 0 Diagramy (Lucid), 0 Miro (Mermaid) | ☐ todo |
| `mind-map.md`           | Ideas: Mind Map                        | 0 Miro | ☐ todo |
| `tables.md`             | Ideas: Table + Table Studio            | 0 tabele (Airtable, Coda) | ☐ todo |
| `surveys-interview.md`  | Ankiety + Wywiad                       | 0 Ankiety (Qualtrics, SurveyMonkey, Typeform) | ☐ todo |
| `kpi-insights.md`       | KPI/OKR + Insights                     | 0 KPI (Quantive, Looker, Tableau, Perdoo, Workboard, Databox) | ☐ todo |
| `calendar-meeting.md`   | Meeting / Kalendarz                    | 0 Kalendarz (Google, Outlook/Graph, CalDAV, OneCal, Morgen) | ☐ todo |
| `notes-notebooks.md`    | Notes / Notebooks                      | 0 Notatki (Notion, Evernote) | ☐ todo |
| `presentations.md`      | Presentation Studio (Deliverables)     | 0 Prezentacje (Gamma, Beautiful.ai, Pitch) | ☐ todo |
| `projects-initiatives.md`| Initiatives / Projekty                | 0 Projekty (ClickUp, Linear, Monday) | ☐ todo |
| `knowledge-base.md`     | Help/KB (Anna/Teresa digest)           | 0 Baza wiedzy (Atlassian, Intercom, Zendesk) | ☐ todo |
| `realtime-collab.md`    | Multiplayer (Canvas/Whiteboard)        | Multiplayer (Liveblocks) | ☐ todo |
| `integrations.md`       | Integracje / sync                      | 0 synchronizacja (Workato, Boomi, Mustsoft) | ☐ todo |
| `enterprise-aip.md`     | Wzorce enterprise / data-ops           | Palantir (AIP, ontology) | ☐ todo |
| `financial-analysis.md` | Analiza finansowa (jeśli w roadmapie)  | 0 Analiza finansowa (Anaplan, Apiary) | ☐ todo |

Peryferia (research biznesowy, nie moduł): `0 Program partnerski` — brief opcjonalny.

## Proces (per źródło)
1. Przejrzyj surowe HTML/PDF/screeny danego narzędzia.
2. Wypełnij brief wg `_TEMPLATE.md` — wzorce UX/IA, model danych, API, „co kradniemy / czego unikamy".
3. Wytnij 3–8 kluczowych zrzutów do `assets/<brief>/`.
4. Oznacz status `done` w tej tabeli.
5. DOPIERO wtedy surowe źródło w `Softs/` idzie do usunięcia (decyzja: agresywnie).

## Powiązania
- Standard treści kart: [`docs/standards/CARD_CONTENT_FORMULA.md`](../standards/CARD_CONTENT_FORMULA.md)
- Manifest sprzątania surowca: `Softs/_AUDIT/00_PROPOSED_DELETIONS.md`
