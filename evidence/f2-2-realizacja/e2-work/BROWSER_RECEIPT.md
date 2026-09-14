# F2-2 E2 browser receipt — author fixes 2026-09-14

**Result: PASS on the production-built focused harness in light and dark mode.**

- Build: `npx vite build --config dev-render/vite.execution-work-analysis.config.ts` — exit 0.
- URL shape: `execution-work-analysis.html?report=work&state=ready&lang=en&theme=<light|dark>`.
- The fixture copies the real `GET /api/initiatives/runtime-v1/execution-cases` shape, including `projectId` and `projectTitle`, and the real manager-problem envelope.
- Both themes visibly show three concrete attention records, human-readable reasons, `North plant transformation`, and the reachable `Escalate`, `Delegate`, and `Change resources` actions.
- CDP after a fresh reload: 0 `Runtime.exceptionThrown`, 0 `Log.entryAdded` errors.
- Light: `work-analysis-light.png`, 57,310 bytes, SHA-256 `66f4cf2fdca2e46e3383847234e82b0869110503aa7b1c8438c5da50becadcc4`.
- Dark: `work-analysis-dark.png`, 56,306 bytes, SHA-256 `8a49dedc612669fa3b04938349bd6fc4765d534043ef1d65c8929978f0b2b69d`.
