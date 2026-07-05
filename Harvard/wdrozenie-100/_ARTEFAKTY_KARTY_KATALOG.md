# ★★★ ARTEFAKTY — KATALOG KART (2026-07-05)
> Precyzyjny opis KAŻDEJ karty (sekcji lewego menu) artefaktów Rekord. Fundament: najpierw karty, potem artefakty (dyrektywa Piotra).
> Źródła prawdy: `docs/ui-standards/02-components/initiative-sections.md` · `src/components/Initiatives/sections/registry.ts` + `*Section.tsx` · migracje `529_initiative_section_types.sql` (nazwy/grupy) + `530_initiative_section_ai_prompts.sql` (AI) · `src/components/shared/NModeSections/*Canvas.tsx` (Task/Decision) · TaskDetailView/DecisionDetailView/InsightDetailView.
> Zbudowany po 2 zwiadach kodu w /private/tmp/triada (= demo 2f587e657b).

## 0. STAN FAKTYCZNY (2 kluczowe odkrycia)
1. **Karty-artefakty z sekcjami = Initiative(29) · Task(9) · Decision(8).** Insight NIE MA kart — to prosty read-only widok (banner+tytuł+meta+treść md+akcje eksport/approve). → decyzja Piotra: rozbudować Insight do kart czy zostaje prosty.
2. **DŁUG: karty wspólne mają DWIE implementacje.** Initiative używa własnych `Initiatives/sections/*Section.tsx`; Task/Decision używają wspólnych `shared/NModeSections/*Canvas.tsx`. Te same karty (Comments, Activity, Attachments, RACI, Risk) = 2 różne komponenty. Ujednolicenie = część rolloutu.

---

## 1. KARTY UNIWERSALNE (wspólne — dedup; docelowo JEDEN komponent per karta)
| Karta | Występuje w | Typ | Pola / elementy | AI | Komponenty dziś (dług) |
|-------|-------------|-----|-----------------|-----|------------------------|
| **Opis / Scope** (Overview/Description/Decision Scope) | Init·Task·Decision | formularz-tekst | RELATED TO chip · główna textarea opisu · (Task: Expected Outcome, Relevant Ideas/Notes) · (Decision: Additional Context) | ✓ | Init:OverviewSection · Task/Dec:inline (wariant) |
| **Komentarze** | Init·Task·Decision | wątek | filtr daty (All/Today/7d/30d) · sort · lista(avatar·autor·priorytet-dot·czas·AI-badge·treść·usuń) · input(priorytet L/N/H·tekst·wyślij·AI-enhance) | ✓ | Init:CommentsSection · Task/Dec:CommentsCanvas |
| **Aktywność / Historia** | Init·Task·Decision | timeline read-only | (Task/Dec) stat-cards(wpisy·zmiany·eskalacje·współpraca) · feed(ikona·opis·czas·user·typ·old→new) | — | Init:HistorySection · Task/Dec:ActivityLogCanvas |
| **Załączniki i powiązania** | Init·Task·Decision | lista+upload | upload(drag-drop) · lista plików(nazwa·rozmiar·typ·pobierz/usuń) · linked items(Init/Task/Decision/Tool/Insight) · input linku | — | Init:AttachmentsSection+LinkedItemsSection · Task/Dec:AttachmentsLinksCanvas |
| **RACI i eskalacja** | Init·Task·Decision | tabela | macierz RACI(osoba·rola R/A/C/I·email·notyfikacje·akcje) · „+ osoba" · reguły eskalacji(if impact HIGH→escalate) | — | Init:RaciEscalationSection+StakeholdersSection · Task/Dec:GovernanceCanvas |
| **Ryzyko** (RAID/Risk&Alternatives/Risk&Impact) | Init·Task·Decision | tablica/lista | (Init RAID) liczniki Risks/Assumptions/Issues/Dependencies + filtr-typ + wiersz(title·typ·impact·status·owner·mitigation·contingency·action·due) · (Task/Dec Risk) title·opis·prawdopod.·impact·mitigation·owner·status | ✓ | Init:RaidSection(RaidCanvas) · Task/Dec:RiskCanvas |
| **Zależności** | Init·Task | tabela | from-task·to-task·typ(FS/SS/FF/SF)·lag-dni·notatki · „+ dodaj" · (Init) AI-proposal | ✓(Init) | Init:DependenciesSection · Task:DependenciesSection(wariant) |

---

## 2. KARTY INITIATIVE — specyficzne (poza uniwersalnymi)
### Grupa SCOPE & PLAN
| Karta | key | Typ | Pola / elementy | AI | Default |
|-------|-----|-----|-----------------|-----|:---:|
| Definicja problemu | problemDefinition | formularz 3-pól | Symptom · Root Cause · Cost of Inaction (textarea każde) + badge filled/3 + progress | ✓/pole | ✓ |
| Stan docelowy i kryteria | targetState | 3 panele + AI-modal | Target description · Success Criteria(lista+add) · Deliverables(lista+add) + AI-proposal modal | ✓ | ✓ |
| Zakres i kryteria rezygnacji | scope | 2-kolumny | In Scope(zielone) · Out of Scope(czerwone) · Kill Criteria(alert) — listy inline-edit | ✓/pole | ✓ |
| Zadania i kamienie milowe | tasks | lista-kart | karty(title·status·priorytet·due·assignee·źródło manual/AI) + AI-proposal + akcje wiersza | ✓ | ✓ |
| Decyzje | decisions | tabela task-like | wiersze(title·typ·status·owner·due·priorytet) + „+New" + AI-proposal | ✓ | ✓ |
| Bramki decyzyjne | gates | workflow + AI-modal | pipeline statusów · panel gotowości(faza·readiness%·checklist) · role bram · AI-proposal(metadata/role/decyzje/tasks/RAID) | ✓ | ✓ |

### Grupa FINANCIAL / OUTCOMES
| Karta | key | Typ | Pola / elementy | AI | Default |
|-------|-----|-----|-----------------|-----|:---:|
| Analiza finansowa | financialAnalysis | grid KPI-cards | CAPEX·OPEX (2×2) · ROI·NPV·Payback (3×1) — z modelu inicjatywy | ✓ | ✓ |
| Wpływ finansowy | financialImpact | panel P&L | Revenue impact(+) · Cost savings(−) · Benefits realization(%) + preview | ✓ | ✓ |
| KPI i korzyści | kpis | tabela API | name·unit·baseline·target·current·status + add-row + AI-proposal (ciągłość z Benefits) | ✓ | ✓ |
| Pilot | pilot | status+listy | status(not_started…) · hipotezy · kryteria sukcesu · kryteria porażki · wyniki | ✓ | ✗ |

### Grupa PEOPLE
| Karta | key | Typ | Pola / elementy | AI | Default |
|-------|-----|-----|-----------------|-----|:---:|
| Panel sterowania | control | form+status | moduł(ikona·label·link) · status · priorytet(dropdown) · akcje workflow(primary+dropdown) | — | ✓ |
| Zespół | team | 2 dropdowny | Owner(select) · Sponsor(select) + summary(avatar) | — | ✓ |
| Harmonogram | timeline | planner status-aware | wg fazy: ESTIMATE(target+duration) / PLANNING(TimelinePlanner: daty·fazy·milestones·mini-Gantt) / TRACKING(summary+progress) + Kalendarz+Gantt + AI-proposal | ✓ | ✓ |
| Zasoby | resources | 4 tabele | Budget(kategoria·opis·kwota·źródło) · FTE(osoba·rola·%·daty) · Tools(nazwa·kat·status·koszt) · Intangibles(typ·opis·status·wartość) + AI/tabela | ✓ | ✓ |
| Interesariusze (RACI) | stakeholders | shared | avatar·nazwa·rola RACI·wpływ·zainteresowanie + notyfikacje + add | ✓ | ✓ |
| Zespół inicjatywy (alt) | initiativeTeam | panel+AI-modal | tabela ról(avatar·nazwa·rola) + add-member + AI-proposal | ✓ | ✗ |

### Grupa RECORDS / META (poza uniwersalnymi Comments/History/Attachments)
| Karta | key | Typ | Pola / elementy | AI | Default |
|-------|-----|-----|-----------------|-----|:---:|
| Tagi | tags | badge-list | pigułki tagów(kolor·usuń) + input+add | — | ✓ |
| Przypomnienia i eskalacja | reminders | tabela reguł | reguła(nazwa·trigger dni-przed·kanały in-app/email·akcja·toggle) · eskalacja(toggle·do-kogo·po-dniach·wiadomość) | — | ✓ |
| Wymagania kompetencji | competencyRequirements | tabela API | capability·kategoria·min-level·priorytet(required/nice)·headcount·uzasadnienie + add | — | ✓ |
| Luka umiejętności | skillsGap | 3-taby analiza | by-Requirement(coverage) · by-Person(profil·luki) · Summary(coverage%·rekomendacje) + alert braków | — | ✓ |
| RACI escalation (legacy alt) | raciEscalation | GovernanceCanvas | macierz RACI + eskalacja + przypomnienia (skonsolidowane) | — | ✗ |
| Powiązane (alt) | linkedItems | shared | typ(ikona)·tytuł·usuń + add-modal(szukaj+linkuj) | — | ✗ |
| Watchers | watchers | prosty (placeholder) | obserwujący (UI do rozbudowy) | — | ✗ |

**Kanoniczna kolejność 19 (initiative-sections.md, wersja produkcyjna):** Initiative Scope · Success Criteria · KPI · Financial Analysis · Financial Impact · Team · RACI · Resources · Dependencies · Risk & RAID · Milestones · Timeline · Tasks · Decisions · Gates · Technical Specification · Attachments · Comments · Activity Log. (Wyłączone: Overview, Pilot, Watchers.)

---

## 3. KARTY TASK — specyficzne (poza uniwersalnymi)
| Karta | Typ | Pola / elementy | AI |
|-------|-----|-----------------|-----|
| Implementation Ideas | lista-kart | pomysł(title·opis·status idea/considered/selected/rejected·głosy·źródło AI/Team/Manual·autor·usuń) | ✓/pomysł |
| Checklist | lista-checkbox | pozycja(checkbox·title·completed·usuń) + „add item" + licznik X/N | — |
**Nagłówek Task:** meta Status·Priority·Due·Owner·Initiative · przyciski wg stanu: Start / Send-to-Review / Complete / Block / Reopen / Reassign · Chat · Save.

## 4. KARTY DECISION — specyficzne (poza uniwersalnymi)
| Karta | Typ | Pola / elementy | AI |
|-------|-----|-----------------|-----|
| Options & Trade-offs | InlineTable | alternatywa(title·opis·pros/cons·status·isRecommended·impact/risk·usuń) + „+opcja" | ✓ |
| Consequences | scenariusze+tekst | Decision Note · AI-scenariusze 3× (Optimistic/Neutral/Pessimistic z d7/d30/d90) | ✓ |
**Nagłówek Decision:** meta Status·Priority·Created·Deadline·Requester·Decider · workflow badge(Draft→Proposed→Approved) · akcje: Approve/Reject/Request-Info/Delegate · Chat · Save · locking gdy published.

## 5. INSIGHT — read-only (NIE karta-artefakt)
Banner(typ+kategoria+status) · tytuł · meta(Impact·Confidence·Actionable·Sessions·data) · Source Quote · treść markdown(tabele/code/nagłówki) · akcje: Export→Tools · Export→Assessment · Approve · Regenerate · Download · info generacji.
→ **DECYZJA PIOTRA:** rozbudować do kart (jak Task) czy zostaje prosty read-only?

---

## 6. WNIOSKI DO SPEC ARTEFAKTÓW (następny etap)
- **~7 kart uniwersalnych** (Opis·Komentarze·Aktywność·Załączniki·RACI·Ryzyko·Zależności) — ujednolicić do JEDNEGO komponentu każda (dziś 2 implementacje).
- Initiative = najbogatsza (29 kart), Task/Decision = podzbiór + własne (Implementation Ideas/Checklist, Options/Consequences).
- Katalog kart = klocki. Artefakt = dobór kart + kolejność + grupy lewego menu + nagłówek(meta+primary).
- Dług do rolloutu: (a) 2 implementacje kart wspólnych → 1; (b) Insight bez kart → decyzja; (c) karty „alt/legacy" (initiativeTeam vs team, raciEscalation vs stakeholders, linkedItems vs attachments) → wybrać kanoniczną.
