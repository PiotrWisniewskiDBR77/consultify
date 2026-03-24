# Ideas V5 — Post-Release Adoption Review & Iteration Backlog

> **Task:** V5-IDEA-52  
> **Date:** 2026-03-08  
> **Status:** TEMPLATE READY — to be filled after release

---

## 1. Adoption metrics to track

Based on V5-IDEA-48 telemetry events, measure the following KPIs weekly:

### Seed Surface adoption
| Metric | Event | Target |
| --- | --- | --- |
| Seed Surface open rate | `ideas_v5_seed_surface_opened` | >60% of new idea creations |
| Start mode distribution | `ideas_v5_seed_start_mode` | Healthy mix (AI >30%, blank <40%) |
| Template usage | `ideas_v5_seed_template_selected` | >20% of starts use a template |
| Popular start usage | `ideas_v5_seed_popular_start_used` | >15% of starts |
| Brief submission rate | `ideas_v5_seed_brief_submitted` | >10% of starts |

### System usage
| Metric | Event | Target |
| --- | --- | --- |
| System switch frequency | `ideas_v5_system_switched` | Avg >1.5 switches per session |
| Focus mode usage | `ideas_v5_focus_mode_changed` | >20% of sessions use focus |
| Cross-system transforms | `ideas_v5_cross_system_transform` | >5% of sessions |

### Knowledge layer
| Metric | Event | Target |
| --- | --- | --- |
| Knowledge cards created | `ideas_v5_knowledge_card_created` | >10% of sessions |
| Evidence captured | `ideas_v5_evidence_captured` | >5% of sessions |
| Knowledge search used | `ideas_v5_knowledge_search_used` | >15% of sessions |

### Artifact linking
| Metric | Event | Target |
| --- | --- | --- |
| Artifacts attached | `ideas_v5_artifact_attached` | >10% of sessions |
| Artifacts opened from workspace | `ideas_v5_artifact_opened` | >20% of attached |
| AI artifact retrieval | `ideas_v5_ai_retrieve_artifacts` | >5% of sessions |

### Conversion
| Metric | Event | Target |
| --- | --- | --- |
| Whole idea conversions | `ideas_v5_convert_whole_idea` | >15% of mature ideas |
| Selection conversions | `ideas_v5_convert_selection` | >5% of sessions |
| Report/deck exports | `ideas_v5_export_report` + `ideas_v5_export_presentation` | >3% of sessions |

---

## 2. Review cadence

| When | What |
| --- | --- |
| Week 1 post-release | Smoke check: are events firing? Basic adoption numbers |
| Week 2 | First adoption report: Seed Surface, system usage, conversion |
| Week 4 | Full review: all metrics, user feedback, iteration priorities |
| Week 8 | Maturity review: compare to targets, decide on V6 scope |

---

## 3. Iteration backlog (post-release)

Priority items identified during V5 implementation:

### P0 — Critical for adoption
| # | Item | Reason |
| --- | --- | --- |
| 1 | Backend AI handlers for `ai_retrieve_artifacts`, `ai_propose_attachments` | Frontend wired but backend not yet implemented |
| 2 | Performance profiling for >200 node canvases | No profiling done yet |
| 3 | E2E test coverage for Seed Surface → workspace flow | Only static smoke checks exist |

### P1 — Important for quality
| # | Item | Reason |
| --- | --- | --- |
| 4 | Whiteboard ARIA improvements | Keyboard nav incomplete |
| 5 | Process Flow ARIA improvements | Keyboard nav incomplete |
| 6 | Offline-first workspace sync | Falls back to local but no sync |
| 7 | Real-time collaboration testing for V5 features | Gateway exists but untested with V5 |
| 8 | Table autofill backend handler | Frontend dispatches AI chat but no dedicated endpoint |

### P2 — Nice to have
| # | Item | Reason |
| --- | --- | --- |
| 9 | Canvas minimap improvements | Current minimap is basic |
| 10 | Presentation mode for workspace | Show workspace as slideshow |
| 11 | Workspace templates marketplace | User-created templates |
| 12 | Advanced VSM metrics dashboard | VSM data exists but no dashboard |
| 13 | Multi-workspace linking | Link ideas across workspaces |

---

## 4. User feedback channels

- In-app feedback via `FeedbackSidePanel`
- Telemetry anomaly alerts (if conversion rate drops >20%)
- Support tickets tagged `ideas-v5`
- Weekly product review with stakeholders

---

## 5. Success criteria for V5

V5 is considered successful when:
1. Seed Surface is used for >60% of new idea creations (week 4)
2. Average session uses >1.5 canvas systems (week 4)
3. >15% of mature ideas are converted to outputs (week 8)
4. No P0 bugs reported after week 2
5. User satisfaction score >4.0/5.0 (week 8 survey)
