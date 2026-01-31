# Jobs To Be Done (JTBD)

## Metadata

- **Tool name**: Jobs To Be Done (JTBD)
- **Slug**: `jobs-to-be-done`
- **Category**: Strategy
- **Level**: Core
- **Typical duration**: 2–6 hours (initial); 1–2 weeks (with interviews)
- **Best for**: Product strategy, customer insight, differentiation, innovation, reducing feature-bloat
- **Not for**: Pure segmentation by demographics (JTBD is about circumstances and progress)
- **Primary outputs**: Job statement, job map, forces of progress, key struggles, opportunity areas, initiatives
- **Required inputs**: target decision (what are we trying to improve?), target user/customer context
- **Optional inputs**: interviews, usage data, churn/win-loss notes
- **Related tools**:
  - [`customer-segmentation.md`](./customer-segmentation.md)
  - [`strategic-positioning.md`](./strategic-positioning.md)
  - [`business-model-canvas.md`](./business-model-canvas.md)
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31

---

## 1. Purpose

JTBD explains **why people choose** a product/service by focusing on the progress they are trying to make in a specific circumstance (functional, social, emotional). It helps teams build strategy around “the real competition” (what customers hire instead) and define what to improve or create.

---

## 2. Core concepts

- **Job**: progress toward a goal in a circumstance.
- **Hire**: customers “hire” products/services to do the job.
- **Forces of progress**: pushes/pulls vs habits/anxieties influencing change.
- **Job map**: steps of the job from definition to execution to monitoring.

---

## 3. Method (step-by-step)

1. Define decision scope (what outcome matters).\n2) Collect stories (interviews or internal narratives).\n3) Identify struggling moment + triggers.\n4) Write the job statement: “Help me [make progress] when [situation] so I can [outcome].”\n5) Map functional + social + emotional dimensions.\n6) Build forces of progress (push/pull/habit/anxiety).\n7) Identify unmet needs and opportunity areas.\n8) Convert opportunities into initiatives (product, service, process, messaging).

---

## 4. Outputs & DoD

- Job statement and job map\n- Forces-of-progress diagram\n- Opportunity list ranked by impact\n- 3–7 initiatives

DoD:

- [ ] Job statement written and validated with at least 3 stories\n- [ ] Forces of progress filled\n- [ ] Opportunity areas ranked\n- [ ] Initiatives created with traceability

---

## 5. UI / Graphic spec

- Story capture cards (timeline)\n- Job statement builder\n- Forces-of-progress 2×2 visualization\n- Opportunity backlog + initiative generator\n- Export: one-page JTBD summary PDF

---

## 6. Worked example (condo “moving lives”)

Using JTBD, a condo developer discovered buyers were not buying “granite countertops” but hiring condos to “move their lives” while dealing with anxiety about meaningful possessions (e.g., dining room table). The solution added moving services and storage; prices increased and sales improved despite market decline.

---

## 7. Implementation spec (JSON)

```json
{
  "jobStatement": "Help me move my life with less anxiety when downsizing...",
  "stories": [{ "trigger": "...", "anxieties": ["..."], "habits": ["..."] }],
  "forcesOfProgress": {
    "push": ["..."],
    "pull": ["..."],
    "habits": ["..."],
    "anxieties": ["..."]
  },
  "opportunities": [{ "title": "Provide moving support", "impact": 5 }],
  "initiativeDrafts": [{ "title": "Moving & Storage Service", "sourceOpportunityId": "o1" }]
}
```

---

## 8. References (sources)

- [Christensen Institute: Jobs to Be Done Theory (definition, forces, examples)](https://www.christenseninstitute.org/theory/jobs-to-be-done/)\n+
