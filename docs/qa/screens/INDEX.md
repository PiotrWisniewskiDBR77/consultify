# Archiwum screenów — Visual QA (light + dark, komplet)

> Pełny przebieg wszystkich modułów railu × pod-zakładki × 2 motywy. **72 PNG · 36 light + 36 dark · 0 blanków · 0 ERR.**
> Wygenerowane: `node docs/qa/capture-screens.mjs` (przejmuje sesję OWNER z `/tmp/consultify-auth.json` — token NIE w repo). Re-run regeneruje.
> Data: 2026-06-14 (nocny przebieg). Uwierzytelnione, z realnymi danymi.

## Pokrycie (każdy = `{zakładka}-light.png` + `{zakładka}-dark.png`)

| Moduł | Zakładki | PNG |
|---|---|---|
| `chat/` | default | 2 |
| `my-work/` | Ideas, Notebook, Inbox, Calendar, Tasks, Decisions, Manager | 14 |
| `interview/` | Inbox, Sessions, Assigned, Templates, Insights, Initiatives | 12 |
| `tools/` | Library, Sessions, Reports & Presentations, Initiatives | 8 |
| `initiatives/` | Portfolio, Analysis | 4 |
| `execution/` | Summary, Rollout, Reporting, Management | 8 |
| `results/` | Initiatives, KPI, KPI Reports, ROI, ROI Analysis | 10 |
| `finance/` | default | 2 |
| `audits/` | default | 2 |
| `documents/` | default | 2 |
| `document-studio/` | default | 2 |
| `presentation-studio/` | default | 2 |
| `table-studio/` | default | 2 |
| `meeting/` | default | 2 |

## Uwagi
- Moduły in-scope (do KPI: Chat→Results) — pełne pod-zakładki.
- Moduły poniżej-KPI (Finance→Meeting) — widok domyślny (wg decyzji „nie gotowe", ale renderują się — archiwum dokumentuje stan).
- Findings → [MASTER_VISUAL_QA_CATALOG.md](../MASTER_VISUAL_QA_CATALOG.md). Plan → [VISUAL_QUALITY_SPRINT_PLAN.md](../VISUAL_QUALITY_SPRINT_PLAN.md).
