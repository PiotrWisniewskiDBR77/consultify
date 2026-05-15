## V10 Research Runtime — Wave B checklist

This checklist covers the “Research runtime - 2” increment:

- mission planning (`/api/v10/research-runtime/missions/plan`)
- watch delta (`/api/v10/research-runtime/missions/watch`)
- mission summary (`/api/v10/research-runtime/missions/summary`)
- delegation endpoint (`/api/v10/reasoning-runtime/delegate/research/plan`)
- telemetry events for admin actions

### Backend

- **Routes**: verify `server/src/routes/v10/research-runtime.routes.ts` exposes:
  - `POST /missions/plan`
  - `POST /missions/watch`
  - `POST /missions/summary`
- **Delegation**: verify `server/src/routes/v10/reasoning-runtime.routes.ts` exposes:
  - `POST /delegate/research/plan`
- **Auth**: endpoints require `verifyToken` + `requireOrganization` (admin-only is not required for research).

### Frontend (Admin)

- **UI**: `src/components/Admin/ChatV10RuntimesPanel.tsx`
  - Plan, Run, Watch Δ, Summary, Delegate plan buttons work
  - MissionId is captured after plan/start and reused for watch/summary
- **Telemetry**: with `ff.research_telemetry` enabled:
  - emits `research_mission_planned`
  - emits `research_mission_watched_delta`
  - emits `research_mission_summary_loaded`
  - emits `reasoning_delegated_research_plan`

### Docs / invariants

- **Contract**: `docs/Chat V9/CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md` includes the 4 Wave B research events.
- **Feature flags**: `src/utils/chatV10FeatureFlags.ts` `research-telemetry` lists those events.
- **Analytics union**: `src/services/funnelAnalytics.ts` includes those event names.

