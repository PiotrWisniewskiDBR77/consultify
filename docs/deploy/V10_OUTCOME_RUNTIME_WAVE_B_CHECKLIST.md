## V10 Outcome Runtime — Wave B checklist

This checklist covers the "Outcome / wynik biznesowy - 2" increment:

- KPI acceptance preview
- outcome signal ingest
- acceptance contract resolution
- analysis to business-effect linkage
- telemetry for the admin flow

### Backend

- `server/src/routes/v10/outcome-runtime.routes.ts` exposes:
  - `POST /acceptance/preview`
  - `POST /signals/ingest`
  - `POST /acceptance/resolve`
  - `POST /analysis/business-link`
- Tenant scope is injected from auth context.
- `GET /contract` returns `outcome_runtime_wave_b_v1`.

### Frontend (Admin)

- `src/components/Admin/ChatV10RuntimesPanel.tsx` allows:
  - previewing KPI acceptance
  - capturing outcome signal
  - resolving acceptance contract
  - linking analysis to business effect
- Contract id from preview is reusable in resolve flow.

### Telemetry / docs

- `src/utils/chatV10FeatureFlags.ts` `outcome-telemetry` lists:
  - `outcome_kpi_acceptance_previewed`
  - `outcome_signal_ingested`
  - `outcome_acceptance_resolved`
  - `outcome_business_linked`
- `docs/Chat V9/CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md` contains matching Index rows and detailed sections.
