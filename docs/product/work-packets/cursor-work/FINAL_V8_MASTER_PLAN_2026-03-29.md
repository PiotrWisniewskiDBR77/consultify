# Final V8 Master Plan — one implementation program (35 positions)
Date: 2026-03-29  
Owner: Product + Engineering  
Scope: a single master plan for **one rollout** (no Wave split), consisting of **exactly 35 positions** defined in the program review notes.

---

## 1. What this document is

This file is the manager-owned master index for the Final V8 implementation program:

- one open list of 35 positions,
- each position has an explicit intent (“what it must deliver”),
- each position points to an existing detailed implementation plan **or is marked as missing**,
- done means: **scope approved → executed fully → evidence complete**.

No “Wave” terminology is used in this program document.

---

## 2. Rules (non-negotiable)

- **No guessing**: if a position requires a competitor-specific behavior (e.g. “100% KIMI style”), we must link to the exact reference docs; if the reference is not present, we mark it as **missing input** (not “we’ll approximate”).
- **No silent scope splits/merges**: `Wordy`, `Excele`, `Raporty`, `Prezentacje` are separate positions here. If we decide to implement them through one shared engine, that is still a deliberate decision — but the plan must explicitly preserve the user-facing product distinction.
- **Done = evidence**: each position needs a definition of evidence (tests, staging proof, etc.).

---

## 3. Master list (35 positions)

Legend:

- **Plan**: link to an existing detailed implementation plan (if present).
- **Plan status**:
  - `present (direct)` — a dedicated module plan already exists.
  - `present (shared)` — plan exists but currently bundled with a broader module; requires extraction or explicit acceptance that it is shared.
  - `missing` — needs a new dedicated plan file.

| # | Pozycja | Co ma wdrożyć (intent) | Plan | Plan status |
|---:|---|---|---|---|
| 1 | `Integracja` | Integracja z zewnętrznymi programami. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md` | present (direct) |
| 2 | `Kalendarz` | Praca z terminami + koordynacja z kalendarzami innych aplikacji. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KALENDARZ_2026-03-29.md` | present (direct) |
| 3 | `Wdrożenia` | Zarządzanie pracą wielu zadań i inicjatyw: ryzyko, obciążenia, zasoby. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WDROZENIA_2026-03-29.md` | present (direct) |
| 4 | `KPI` | KPI są dobrze opisane — teraz trzeba je dobrze zbudować. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md` | present (direct) |
| 5 | `Finanse` | Poprawa modeli (import + dane historyczne) + analityka 1/2/3 poziomów + pełne narzędzia pracy z modelem. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md` | present (direct) |
| 6 | `Radar` | Doc mówi po co jest; problem: UI/UX/grafika jest nieczytelna — trzeba podnieść czytelność i „sexiness”. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_RADAR_2026-03-29.md` | present (direct) |
| 7 | `Notatnik` | Jest ok, trzeba dobrze połączyć z resztą aplikacji. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md` | present (direct) |
| 8 | `Teresa` | AI głosowy+tekstowy: pełen kontekst org + narzędzia + web; steruje aplikacją; konsultant/manager/partner/pracownik. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TERESA_2026-03-29.md` | present (direct) |
| 9 | `Ankiety` | Generalnie ok; ewentualnie poprawa UI/UX. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md` | present (direct) |
| 10 | `Wnioski z interview (insights)` | Pełne wnioskowanie z odpowiedzi + kontekstu organizacji; wnioski zasilają szeroki kontekst; AI rozumie wszystko, nie musi „wierzyć”. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md` | present (direct) |
| 11 | `Inicjatywy` | Dopięcie UI/UX + AI: wypełnianie całości/fragmentów, “zrób inicjatywę”, poprawianie tekstów. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md` | present (direct) |
| 12 | `Mindmap` | UI/UX budowania jest dramat; porównać z konkurencją; komplet przycisków; zadania do AI i AI buduje. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md` | present (direct) |
| 13 | `Whiteboard` | Jak Mindmap: przegląd narzędzi/przycisków + naprawa procesu budowania; AI współbuduje. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WHITEBOARD_2026-03-29.md` | present (direct) |
| 14 | `Proces flow` | Jak Mindmap/Whiteboard: UX budowania + komplet narzędzi; AI współbuduje. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_PROCES_FLOW_2026-03-29.md` | present (direct) |
| 15 | `Tabele` | Pełna logika Airtable: tabele zwykłe/relacyjne + AI współbuduje jak konkurencja. | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TABELE_2026-03-29.md` | present (direct) |
| 16 | `Anna` | Ma dostać pełniejszy kontekst DBR77+produkty; rozwój wiedzy sterowalny w Superadmin (Virtual Workers). | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANNA_2026-03-29.md` | present (direct) |
| 17 | `ArtifactRun z czatu` | Chat/Teresa pracuje z aplikacją (głos+tekst): rozumie ekran, robi pracę w UI i bazach. To ma być jedno z pierwszych. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md` | present (direct) |
| 18 | `Provenance / review / visibility` | Pełne traceability myśli i kontekstu (trust grammar artefaktów). | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` | present (direct) |
| 19 | `Outputs Library` | Jedno miejsce na efekty pracy (tabele/excel, word, prezentacje, raporty); wyszukiwanie + automatyczne tworzenie i wysyłanie (obszar+format → generuj+wyślij). | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md` | present (direct) |
| 20 | `Prezentacje` | Gamma‑like: generacja+edycja; export PPT/PDF; zarządzanie generatorem; edycja z poziomu czata. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md` | present (direct) |
| 21 | `Raporty` | Gamma‑like raporty: template → “zrób raport o … używając template …”. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` | present (shared) |
| 22 | `Wordy` | 100% KIMI: split-screen chat↔word; generuj/edytuj; zapis do Outputs opcjonalny; zero zgadywania bez referencji KIMI. | (brak dedykowanego planu; częściowo dotyka `Documents` + `ArtifactRun`) | missing |
| 23 | `Excele` | 100% KIMI: split-screen chat↔excel; generuj/edytuj; zapis do Outputs opcjonalny; zero zgadywania bez referencji KIMI. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md` | present (shared) |
| 24 | `Templaty` | Templates dla raportów i prezentacji; przeniesienie pełnej funkcji z admin do Outputs: zakładka Templaty + generator + user templates + app templates. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md` | present (shared) |
| 25 | `Help` | Kontekstowy help; spójny język; dostępny dla Anny i Teresy. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` | present (shared) |
| 26 | `Baza wiedzy` | Narzędzie edukacyjno‑sprzedażowe: LP + prawy panel + kontekst narzędzi; 50 tekstów + grafiki; tagi; linkowanie do newsletter/social; promowane przez Annę/Teresę. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` | present (shared) |
| 27 | `Tools` | Narzędzia AI‑driven, wykonywalne przez czat. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_TOOLS_2026-03-29.md` | present (direct) |
| 28 | `Assessment` | Assessment AI‑driven, wykonywalne przez czat. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md` | present (direct) |
| 29 | `Program partnerski` | Portal+LP; darmowe konto partnera z limitami; AI‑driven narzędzia; rozliczanie i zachęcanie do partnerstwa. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md` | present (direct) |
| 30 | `Organization` | Dopasować UI/UX do standardu; dodać/zmienić co ma sens; lepsza organizacja danych. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md` | present (direct) |
| 31 | `Settings` | Dopasować UI/UX; scalić myślenie: user settings + admin org + superadmin dzierżawca; role: owner/admin/user + role w projekcie. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md` | present (direct) |
| 32 | `Admin` | Dopasować UI/UX; połączyć z Settings i Superadmin; zarządzanie rolami i organizacją. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md` | present (direct) |
| 33 | `Superadmin` | Dopasować UI/UX; pełne zarządzanie dzierżawcą + Virtual Workers (Anna/Teresa) + governance; role. | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md` | present (direct) |
| 34 | `Mądrość czata` | Konkurencyjność: kontekst, reasoning, research; żeby chat był tak dobry jak konkurencja (bez udawania). | `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md` | present (direct) |
| 35 | `Historia czatów` | Dobre zarządzanie historią rozmów realizowanych także w aplikacji. | `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md` + `docs/product/CHAT_V8_IMPLEMENTATION_PLAN.md` | present (direct) |

---

## 4. First execution recommendation (ordering without “waves”)

Based on dependency impact stated in the intents above, the safest early sequence is:

1. `ArtifactRun z czatu` (position 17)  
2. `Provenance / review / visibility` (18)  
3. `Outputs Library` (19)  
4. `Teresa` (8) + `Anna` (16) — but only after ArtifactRun spine is explicit  
5. `Integracja` (1) + `Kalendarz` (2)  
6. `Wdrożenia` (3) + `KPI` (4) + `Finanse` (5)

This ordering is a recommendation; the authoritative ordering becomes the one we approve explicitly in this master plan after scope approval for the first few positions.

---

## 5. Immediate blockers (plan-missing / reference-missing)

- `Wordy` (22): **missing dedicated plan** and explicitly requires **KIMI reference docs** (“100% same style”). Until the reference is linked, we do not implement by approximation.

