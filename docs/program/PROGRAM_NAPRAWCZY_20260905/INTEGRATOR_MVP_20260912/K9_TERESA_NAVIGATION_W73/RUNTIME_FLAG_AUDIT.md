# K9 runtime route-gate audit

The 16 Teresa manifest entries were compared with their route declarations and route-level visibility conditions in `routeConfig.ts` and `AppRoutes.tsx`.

| Manifest entry | Visibility condition represented in K9 |
| --- | --- |
| `MODULE_MEETING` | `VITE_MODULE_MEETINGS` plus organization flag `MODULE_MEETING` |
| `PROJECTS` | `VITE_PMO_PROJECTS` |
| `MODULE_AUDITS` | organization flag `MODULE_AUDITS` |
| `MODULE_BENEFITS` | organization flag `MODULE_BENEFITS` |
| `MODULE_ECONOMICS` | organization flag `MODULE_ECONOMICS`; visible item remains marked `coming_soon` |
| `MODULE_PRESENTATIONS` | organization flag `MODULE_PRESENTATIONS` |
| `ADMIN` | current active membership role `OWNER` or `ADMIN` |
| Remaining nine entries | no route-level runtime gate found |

Result: the audit found one missing runtime mapping, `PROJECTS → VITE_PMO_PROJECTS`. The frontend manifest, backend mirror and server-owned chat runtime snapshot now carry that key. Both known runtime-gated routes fail closed because the filter admits a runtime-gated entry only when its value is exactly `true`.
