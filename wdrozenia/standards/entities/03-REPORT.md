# ✅ Standard encji: Report

## Rola w systemie
Report to ustrukturyzowany artefakt zarządczy generowany z danych ze wszystkich modułów. Report:
- ma **typ**, **scope** (portfolio/project), **okres**, **sekcje**,
- może być generowany ad-hoc lub **scheduled**,
- ma eksport **PDF** i **PPTX**,
- zawiera „Decisions Required” (pending/overdue/escalated) oraz RAG.

## Typy raportów (minimum)
Z planu i promptów:
- Steering Committee Report
- Team Weekly Report
- Portfolio Health Report
- RAID Report

## Sekcje (kanon minimalny)
- Executive Summary (RAG + eskalacje)
- Progress vs plan (time/budget)
- Milestones / Roadmap (jeśli w scope)
- RAID (Risks/Assumptions/Issues/Dependencies)
- **Decisions Required** (pending + overdue + escalated)
- Next period priorities

## RAG (kanon)
- Green: ok
- Amber: ryzyko / opóźnienia
- Red: eskalacja / blokady krytyczne

## Model danych (minimum)
- **Identity**: `id`, `type`, `title?`
- **Scope**: `scopeType` (`portfolio|project`), `scopeId?`
- **Period**: `from`, `to`
- **Config**: `sections[]`, `filters{}`
- **Outputs**: `pdfUrl?`, `pptxUrl?`
- **Tracking**: `createdById`, `createdAt`, `updatedAt`
- **Schedule** (jeśli dotyczy): `cron|frequency`, `nextRunAt`, `recipients`

## UI/UX (kanon)
- **Generator (wizard)**: wybór typu → scope → okres → sekcje → preview → export/schedule
- **History**: lista raportów z filtrami, status generacji, download
- **Template builder**: konfigurowalne sekcje i kolejność (v2, jeśli nie ma jeszcze)
- Stany: loading/error/empty + retry (brak mock fallbacków)

## API (kanon – minimalny zestaw)
- `POST /api/reports/generate` (lub istniejący endpoint per typ) – uruchom generację
- `GET /api/reports` – historia / lista
- `GET /api/reports/:id` – detal + sekcje + linki do plików
- `POST /api/reports/:id/export/pdf`
- `POST /api/reports/:id/export/pptx`
- Schedule:
  - `POST /api/reports/schedules`
  - `GET /api/reports/schedules`
  - `PATCH /api/reports/schedules/:id`

## Integracje (must-have)
- Initiatives/Execution/Benefits: postęp, statusy, KPI
- Decisions: pending/overdue/escalated
- RAID: risks/issues/dependencies (z Execution, ewentualnie Initiatives)

## DoD (Report)
- Backend: generacja działa dla min. 2 typów + PDF export; spójne dane wejściowe; błędy raportowane.
- Frontend: generator + preview + download; stany; brak mock fallbacków.
- Testy: min. 1 E2E (generate → preview → export) dla jednego typu.

## Historia zmian
- 2026-01-26: utworzono standard Report (kanon minimalny)

