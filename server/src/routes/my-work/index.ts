/**
 * My Work Routes — Aggregator
 *
 * This module will gradually absorb sub-routers extracted from the monolithic
 * my-work.routes.ts (13k+ lines). Each domain below will become its own file.
 *
 * Extraction plan (by domain, approximate line count in monolith):
 *   - link-graph        ~100 lines   (770–869)
 *   - personal-tasks    ~415 lines   (942–1357)
 *   - decisions         ✅ EXTRACTED → ./decisions.routes.ts
 *   - inbox             ~910 lines   (1810–2721)
 *   - focus             ✅ EXTRACTED → ./focus.routes.ts
 *   - stats-workload    ✅ EXTRACTED → ./stats.routes.ts (/stats, /team-workload, /context-summary)
 *   - signals           ✅ EXTRACTED → ./signals.routes.ts
 *   - my-ideas          ~4020 lines  (3525–7546) — largest, extract first
 *   - notebook          ✅ EXTRACTED → ./notebook.routes.ts
 *   - briefing          ~550 lines   (8771–9322)
 *   - inbox-automation  ~460 lines   (9323–9778)
 *   - calendar          ✅ EXTRACTED → ./calendar.routes.ts (simple + unified + v2)
 *   - radar             ✅ EXTRACTED → ./radar.routes.ts
 *   - home              ✅ EXTRACTED → ./home.routes.ts
 *
 * The monolith imports extracted sub-routers via router.use().
 * Once all domains are extracted, this aggregator will compose them directly.
 */

export { default } from '../my-work.routes.js';
