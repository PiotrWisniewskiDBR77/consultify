# Final Implementation Contract — Wnioski z interview (insights) (Position 10/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P10-A/B/C complete

## 1. Executive summary
- **Intent**: Wnioskowanie z odpowiedzi + kontekstu organizacji w sposób **audytowalny**: insight ma strukturę, wskazuje evidence, i ma jawne granice pewności.
- **Primary users**: operatorzy badań / consulting; decydenci konsumujący insights.
- **Success metric**: insight artifact ma strukturę + confidence/limits + daje się użyć do następnej decyzji i ma bridge do inicjatyw.

## 2. Scope
### 2.1 In-scope
- Insight readback jako artefakt: struktura findingów, evidence framing, confidence semantics.
- Downstream handoff do `Inicjatywy` / pracy operacyjnej na deklarowanych ścieżkach.

### 2.2 Out-of-scope / non-goals
- Pełna parity „research analytics platform”.

### 2.3 P10-A canon (insight artifact canon + scope approval)

Ta sekcja jest **zamrożonym kanonem** dla `Wniosków` jako audytowalnego artefaktu. Każda implementacja (`P10-B+`) musi:

- opierać się na tej samej strukturze insight artefaktu (bez alternatywnych formatów “v2”),
- zachować **no-overclaim** (confidence + limits są jawne, a UI nie “udaje faktów”),
- utrzymać trwałe evidence pointers (bez “source loss” przy edycjach),
- przekazać downstream do `Inicjatyw` dokładnie zdefiniowany payload (bez równoległej prawdy inicjatyw).

#### 2.3.1 Artifact structure (frozen)

**Insight artifact** to publikowalny readback złożony z wielu findingów. Minimalna struktura:

1) **Finding** (jednostka wniosku)
- **Finding statement**: 1–3 zdania, *co* twierdzimy (bez “dlaczego” jeśli brak evidence).
- **Evidence**: lista evidence pointers + krótki opis “jakie dane to wspierają”.
- **Limits**: jawne granice (czego nie wiemy, czego nie mierzyliśmy, co może być błędem).
- **Next action**: 1–3 konkretne kolejne kroki (decision/test/initiative), powiązane z confidence.

2) **Artifact header/meta**
- Context: program/interview run / zakres (np. segment / org / timeframe).
- Ownership: autor/recenzent + timestamp publikacji.
- Summary: 3–7 bulletów (agregacja, bez “nowych” findingów nieobecnych niżej).

**Rule**: Nie istnieje finding bez (a) confidence level oraz (b) limits.

#### 2.3.2 Confidence semantics (levels + meaning + UI rules; no-overclaim)

Confidence jest semantyką **niepewności**, nie “jakości języka” ani “pewności modelu”. Poziom confidence musi być widoczny na finding i przenoszony downstream.

Poziomy (frozen):

| Level | Meaning (what it claims) | Minimum evidence requirement | UI rules (must) | What is forbidden |
| --- | --- | --- | --- | --- |
| `unknown` | brak oceny; finding nie jest gotowy | brak | musi wyglądać jak `draft`; blokada publish/handoff | “publikacja bez confidence” |
| `low` | hipoteza / sygnał; może być trafne, ale łatwo się myli | 1+ pointer, ale wąski / jednostkowy | label “Hypothesis”; ostrzeżenie; handoff do inicjatywy tylko jako “investigate”, nie “execute” | language typu “na pewno / zawsze / wszyscy” |
| `medium` | wiarygodny pattern, ale brak triangulacji lub pełnej reprezentatywności | 2+ pointers **lub** 1 pointer + mocny artefakt (np. transcript excerpt) | UI pokazuje “Assumptions” + “Limits” zawsze widoczne bez scroll-trap; handoff do inicjatywy dozwolony, ale z widocznymi limits | “root cause” bez evidence |
| `high` | dobrze wsparty w ramach zdefiniowanego kontekstu; nadal ma granice | 3+ pointers z różnych źródeł/segmentów **lub** wyraźna triangulacja + brak sprzeczności | UI może pokazać badge “High confidence”, ale nadal eksponuje limits; default next action może być “execute” | overclaim poza zasięg (np. generalizacja na cały rynek) |
| `contradicted` | istnieją istotne sprzeczności w evidence | pointers w konflikcie | UI wymusza “contradiction callout”; blokada automatycznego handoff; wymagany operator decision: split/resolve/keep-with-warning | “ukrywanie sprzeczności” |

Global no-overclaim rules (always):

- Confidence dotyczy **tego** kontekstu (artifact header), nie świata.
- UI nigdy nie powinno renderować findingów jako “facts” bez pokazania confidence + limits.
- “Causality claims” (A powoduje B) są dozwolone tylko przy `high` i tylko jeśli evidence to wspiera; w przeciwnym razie język musi być probabilistyczny.

#### 2.3.3 Evidence pointers rules (what can be linked + preventing source loss + duplicate robustness)

Evidence pointer to *referencja audytowa* (link + metadane) do źródła, które wspiera finding. Pointers są **częścią kanonu**: nie wolno ich “odtwarzać” z tekstu po fakcie.

Co może być linkowane (allowed pointer types):

- **Interview session**: session id + deep link.
- **Question/answer**: question id, answer id, respondent id (jeśli dostępne), timestamp.
- **Transcript excerpt**: cytat + offset/range + link do transcriptu.
- **Survey/Ankiety linkage (upstream)**: response id / export id / submission id (P09 posture: at-least-once + possible duplicates).
- **Attachment / export**: plik/artefakt (CSV/XLSX/ZIP) + hash/fingerprint + storage link.
- **Operator note**: jawnie oznaczone jako `operator_observation` (nigdy nie udaje “user evidence”).

Preventing “source loss” on edits (frozen rules):

- Evidence set jest **append-only by default**:
  - dodanie pointera: zawsze dozwolone,
  - usunięcie pointera: tylko z `removal_reason` i pozostawia **tombstone** (pointer widoczny w audycie jako “removed”).
- Każdy pointer przechowuje:
  - stabilne `source_ref` (id + typ),
  - `captured_excerpt` (jeśli dotyczy) oraz `captured_at`,
  - `source_fingerprint` (hash/etag/version), aby wykryć drift lub podmianę źródła.
- Edycja finding statement / limits / next action **nigdy** nie usuwa pointerów automatycznie.
- Gdy źródło znika (deleted/redacted/permission loss), pointer pozostaje jako **broken reference** z jasnym UI: “source unavailable”, bez ukrywania.

Duplicate-input robustness (must):

- System przyjmuje, że upstream delivery może być **at-least-once** (duplikaty eventów/wejścia) → evidence pointers muszą mieć dedupe key (`source_ref` + `source_fingerprint`) i nie mogą “multiplikować” tego samego źródła.
- Gdy dwa różne wejścia mapują się na to samo źródło (np. ten sam response importowany 2x), UI pokazuje 1 pointer + metadane “duplicate observed”, zamiast dwóch identycznych linków.

#### 2.3.4 Frozen handoff payload to `Inicjatywy` (P11)

Handoff nie jest “create initiative truth”. To bounded payload, który:

- zachowuje sens findingu,
- niesie confidence + limits,
- niesie evidence pointers jako linki audytowe,
- zostawia ślad pochodzenia (back-link do insight artefaktu).

Payload (minimum, frozen):

| Field | Required | Meaning |
| --- | --- | --- |
| `source_insight_artifact_id` + deep link | yes | skąd pochodzi |
| `source_finding_id` + deep link | yes | konkretny finding |
| `finding_statement` | yes | treść wniosku (bounded) |
| `confidence_level` | yes | `unknown/low/medium/high/contradicted` |
| `limits` | yes | jawne granice |
| `evidence_pointers[]` | yes | lista linków + metadane (bez utraty) |
| `next_action` | yes | rekomendowany następny krok (bounded) |
| `assumptions` | optional | tylko jeśli jawnie opisane |
| `tags` (segment/theme) | optional | pomoc w triage, nie semantyka dowodu |
| `owner_suggestion` | optional | sugestia, nie assignment truth |

Rule: `Inicjatywa` musi móc odtworzyć kontekst przez *links-first* (max 5 linków w “context pack”), bez kopiowania całych transkryptów do inicjatywy.

#### 2.3.5 Anti-duplicate gate (no “collection engine”; no parallel initiative truth)

Zasady “anti-duplicate” dla P10:

- Insight nie jest engine zbierającym dane. Źródło prawdy o wejściu pozostaje upstream (`Interview`, `Ankiety` / P09 posture).
- Insight nie tworzy równoległego magazynu odpowiedzi; przechowuje tylko pointers + minimalne captured excerpts dla audytu.
- Handoff do inicjatyw jest **jednym** kanałem:
  - jeśli istnieje inicjatywa powiązana z danym findingiem → UI ma preferować “link to existing initiative”,
  - jeśli inicjatywa ma być utworzona → tworzenie odbywa się przez kanoniczny flow `Inicjatyw` (P11), a insight zapisuje tylko request + link.
- Zakaz “parallel truth”: nie wolno mieć równoległego ekranu “Initiatives created by insights” jako alternatywy dla P11.

#### 2.3.6 Error / degraded posture (minimum scenarios; must be explicit)

Co najmniej poniższe scenariusze muszą mieć jawne UI + audit + operator next action (bez “unknown error” jako jedynego stanu):

1) **Missing evidence** (finding bez pointers) → blok publish/handoff; UI wskazuje brak evidence
2) **Broken pointer** (źródło usunięte / brak uprawnień) → pointer stays, marked unavailable; UI nie ukrywa luki
3) **Source drift** (fingerprint changed) → UI pokazuje “source changed since capture”; operator decyduje o re-capture
4) **Duplicate input observed** (at-least-once) → dedupe pointers; audit zapisuje duplikat
5) **Contradictory evidence** → confidence `contradicted`; UI wymusza contradiction callout
6) **Handoff denied** (brak uprawnień do `Inicjatyw`) → UI pokazuje “permission denied”; oferuje export/link-only
7) **Initiative creation/link failure** (downstream error) → finding zachowuje payload draft + retry policy; brak “ghost initiative”
8) **Partial artifact state** (draft vs published mismatch) → UI nie pozwala udawać “published”; jawny status badge
9) **Redaction event** (transcript excerpt redacted) → pointer pozostaje z tombstone; UI pokazuje “redacted”
10) **Offline / transient network** podczas publish/handoff → UI ma retry/backoff; bez duplikatów inicjatyw

#### 2.3.7 Acceptance checklist (P10-A scope approval) — testable (10+)

- [ ] Insight artifact ma frozen strukturę: finding/evidence/limits/next action.
- [ ] Każdy finding wymaga jawnego `confidence_level` oraz jawnych `limits`.
- [ ] Confidence semantics ma stałe poziomy + meaning + UI rules + no-overclaim.
- [ ] Evidence pointers mają zamrożone typy (session/Q&A/transcript excerpt/survey link/attachment/export/operator note).
- [ ] “Source loss” jest zablokowany: evidence set append-only by default; removal → tombstone + reason.
- [ ] Pointer przechowuje `source_ref` + `captured_at` + fingerprint, a drift/broken source jest jawny w UI.
- [ ] System jest odporny na upstream duplikaty (at-least-once): dedupe pointers, bez multiplikacji linków.
- [ ] Frozen handoff payload do `Inicjatyw` jest jawnie zdefiniowany (fields + required/optional) i zawiera back-links.
- [ ] Anti-duplicate gate jest jawnie zapisany: brak “collection engine”; brak parallel initiative truth; prefer link-to-existing.
- [ ] Error/degraded posture ma min. 8 scenariuszy z zachowaniem audytu i operator next action.
- [ ] `EXECUTION_INDEX.md` #10 jest ustawiony na `approved(scope)` po closeout P10-A.
- [ ] Wiersz evidence ledger `P10-A` jest wypełniony commit ref po closeout pakietu.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md`
- Readiness: `docs/product/INTERVIEW_V8_READINESS_AUDIT.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje jako najbliższe benchmark family: `Softs/0 Ankiety` + `Softs/0 Projekty` (limitation opisana w planie).

### 4.2 Local Softs evidence (concrete artifacts — adjacent expectations)
- **Collection truth & governance (Typeform/SurveyMonkey via Ankiety)**:
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360057591531-Logic-Map.html` (Logic Map + troubleshooting: złożone ścieżki muszą być kontrolowalne).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/12978390412692-Webhooks-Troubleshooting-and-FAQ.html` (delivery posture: duplicate webhooks / at-least-once, retry gdy brak HTTP 200).
  - `Softs/0 Ankiety/Qualtrics 2/help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses.html` (export CSV/XLSX; eksport tylko filtrowanych/wybranych; export file uploads jako zip).
  - `Softs/0 Ankiety/Surveymonkey 2/help.surveymonkey.com/en/surveymonkey/create/skip-logic/index.html` (skip logic: różne ścieżki; consent/disqualification/multilingual).
- **Downstream action surfaces (Linear / Projekty family)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/triage.html` (triage jako “special inbox”: review/update/prioritize przed wejściem do workflow).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/developers/agent-signals.html` (signals jako metadane intencji — downstream powinien rozumieć jak interpretować wynik).

### 4.3 Missing input (must remain explicit)
- **Dovetail / Condens-class insight products**: zgodnie z planem (`WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md`) **Softs corpus nie zawiera bezpośredniego benchmarku** → insight-depth parity jest tu prowadzone głównie przez readiness/SSOT, a Softs służy tylko do oczekiwań “adjacent”.

### 4.4 Parity checklist vs Softs (approval-grade, within limitation)
**Parity oznacza “actionable insight artifact z evidence + confidence”, nie “pełna platforma research analytics”.**

- **Evidence traceability to collection (Ankiety Softs adjacency)**:
  - Każdy finding musi dać się cofnąć do: źródła (survey/interview), subsetu odpowiedzi, i/lub artefaktu wejściowego (export/link).
  - System musi być odporny na “at-least-once” delivery i duplikaty wejścia (bez psucia evidence framing).
- **Operator review flow (Linear triage analogy)**:
  - Insight powstaje przez review/triage: operator widzi “co jest kandydatem na finding”, dopina evidence, i publikuje artifact.
- **Intent metadata for downstream (agent signals analogy)**:
  - Finding/insight powinien mieć metadane intencji: “co z tym zrobić dalej” + proponowany handoff do `Inicjatywy`.

### 4.5 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md` + readiness `INTERVIEW_V8_READINESS_AUDIT.md`.

| Capability cluster (parity target) | What “good” implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Artifact structure | findings grouped, evidence framed | “structure too light” | Ustalić strukturę insight artefaktu (finding/evidence/limit/next action) | P0 |
| Confidence & limits | explicit uncertainty boundaries | “confidence semantics not deep enough” | Zdefiniować confidence/limits jako kontrakt UI+data (bez overclaim) | P0 |
| Actionability → Inicjatywy | clear handoff | “downstream actionability partial” | Domknąć handoff z findingu do inicjatywy z zachowaniem sensu | P0 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Insight ma jawny confidence/limits; user może przejść z findingu do inicjatywy bez utraty sensu.
- Finding ma evidence pointers (responses/subset/attachments/exports) i nie jest “gołym podsumowaniem bez źródeł”.
- System nie myli “collection completed” z “insight ready” — istnieje jawny review/publish state.

### 5.2 Tests
- Integracyjne: ankieta/interview input → insight draft → review/publish → handoff do `Inicjatywy`.
- Contract tests: confidence/limits + evidence pointers renderują się spójnie i nie znikają przy edycjach.
- Regression: duplikaty wejścia / partial submissions (jeśli w zakresie) nie psują evidence ledger.

### 5.3 Staging proof checklist
- Demo: „survey/interview → insight → initiative handoff” z co najmniej 2 findingami o różnych confidence levels.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P10-A — Insight artifact canon + scope approval
- **Goal**: insight jako audytowalny artefakt (finding/evidence/limits/next action).
- **Inputs required**: confidence/limits contract + evidence pointers; handoff do `Inicjatywy`.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no overclaim” zasada spisana.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze artifact structure (finding/evidence/limits/next action) and confidence levels semantics.
  - Freeze evidence pointers rules (what is linkable; how we prevent “source loss” on edits).
  - Freeze handoff payload to `Inicjatywy` (what context travels, bounded).
- **DoD**:
  - Approved(scope): “no overclaim” is enforceable; artifact is audytowalny and testable.

#### P10-B — Review/publish + handoff closure
- **Goal**: draft→review→publish state + stable handoff do inicjatywy.
- **Acceptance**: user przechodzi finding→initiative bez utraty sensu; evidence pointers nie znikają po edycji.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement review/publish state machine (bounded) and stable handoff to initiatives.
  - Ensure evidence pointers persist across edits; add contract tests for payload stability.
  - Run staging demo (5.3) with 2 findings of different confidence.
- **Staging proof script (click-by-click)**:
  1. Open an insight draft sourced from a survey/interview run.
  2. Create 2 findings with different confidence levels and attach evidence pointers (responses/exports/attachments).
  3. Move the artifact through review → publish and verify state badges are explicit.
  4. Edit a finding after publish (if allowed) and verify evidence pointers remain intact (or explicit rule blocks).
  5. Use “handoff to initiative” and confirm the initiative receives context + links (no loss of meaning).
- **DoD**:
  - Handoff is stable; evidence pointers persist; confidence/limits visible and consistent.

#### P10-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P10-A/B/C.
  - Validate rollback: disable publish/handoff automations; preserve read-only insights.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw read-only artifact + review, potem automatyzacje/AI assist (jeśli P1).

### 8.3 Rollback plan
- Wyłącz publish/handoff automations; zachowaj read access do insightów; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: insight bez evidence pointers (nieaudytowalny).
- Ryzyko: mylenie “collection done” z “insight ready”.
- Decyzje: minimalna skala confidence levels + ich semantyka.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P10-A | approved(scope) | f15dda63af0afed396a6b282ac179560103015ba | n/a (docs-only scope approval) | n/a | §2.3 canon frozen (artifact structure, confidence semantics, evidence pointers rules, P11 handoff payload, anti-duplicate gate, degraded posture, acceptance checklist) |
| P10-B | verified(evidence) | ws/c-artifact-evidence | 55 tests (artifact structure, confidence levels + semantics, no-overclaim rules, evidence pointer types, source loss rules, handoff payload, anti-duplicate gate, degraded posture, canPublishFinding, acceptance checklist) — all pass | Canon + confidence semantics closure | interviewInsightCanon: frozen artifact structure (finding/evidence/limits/next_action), 4 confidence levels + semantics + no-overclaim, 7 evidence pointer types, source loss rules (append-only/tombstone), handoff to initiatives (9 required + 3 optional), 5 anti-duplicate rules, 10 degraded scenarios, 12/12 acceptance |
| P10-C | verified(evidence) | ws/c-artifact-evidence | 55 tests — regression green | Evidence ledger filled; EXECUTION_INDEX updated | Full P10-A acceptance checklist verified; evidence `P10_VERIFIED_CLOSEOUT_2026-03-31.md` |

