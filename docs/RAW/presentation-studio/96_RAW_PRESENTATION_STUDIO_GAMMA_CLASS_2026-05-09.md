---
uiux_doc_id: UIUX_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Presentation Studio (Gamma-class Presentation Artifact Engine) — 2026-05-09

Poniżej: surowe założenia autora (produkt + architektura) wklejone verbatim.  
Cel: materiał wejściowy do AUTHOR_CANON dla `Consultify Presentation Studio` (Presentation Artifact Engine).

---

## Consultify Presentation Studio — Gamma-class Presentation Artifact Engine

Dokumentacja produktowo-architektoniczna v1.0.

W skrócie: Presentation Studio ma tworzyć prezentacje jako **żywe, zarządzane artifacty konsultingowe** (źródła, wersje, diffy, approval, governance, eksport PPTX/PDF), a nie “PowerPoint z AI” ani prosty generator slajdów.

Kluczowe elementy:

- Prezentacja jako artifact pracy konsultingowej (deck/visual report/storytelling/decision memo/sales/board…).
- Źródła i provenance per claim oraz jawne oznaczanie braków danych.
- Template registry + brand/design system + layout taxonomy/engine.
- AI jako operator decku (planowanie, generacja, edycja, QA, wersjonowanie, approval).
- Rozróżnienie decku “do prezentowania” vs “do czytania”.
- Diff i approval obejmujące: treść, layout, źródła, kolejność, sekcje, tone/audience.
- Eksport PPTX jako funkcja krytyczna (enterprise standard) + PDF + web share link.
- Integracje: Documents/Tables/Tasks/CRM/Research/Interview/Meeting notes/KPI/Risk/Decision log.
- Gamma-class quality jako benchmark UX/visual, ale nie blueprint 1:1 — Consultify wygrywa governance i consulting execution.

Materiał zawiera również:

- 7 trybów pracy (generate w/o template, plan template, generate from template, AI edit existing, convert artifacts → deck, convert deck → artifacts, live project artifact),
- listę kluczowych komponentów (Strategist/Planner/Template Registry/Brand+Layout Engine/Chart Engine/QA/Versioning/Export),
- przykładowe modele danych (PresentationArtifact, Slide, SourceReference, Edit, Export),
- roadmapę MVP 1–5 oraz “Gamma-class quality standard” checklistę.

