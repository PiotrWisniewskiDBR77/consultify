# Consultify Table Platform — Pre-Flight Sign-Off Package

**Status:** Ready for ratification  
**Generated:** 2026-03-15  
**Purpose:** Formal approval gates before Sprint 0 start

---

## 1. Architecture Decisions — Ratification

| ADR | Decision | Recommended | Rationale |
|-----|----------|-------------|-----------|
| **D-01 / ADR-001** | Metadata-first source of truth | ✅ APPROVE | Bez tego chat-to-schema i server-side views są strukturalnie słabe. |
| **D-02 / ADR-002** | Graph jako warstwa projekcji | ✅ APPROVE | Graph pozostaje dla orchestration; dane tabel → canonical backend. |
| **D-03** | Proposal → approval → execution dla AI | ✅ APPROVE | Bezpośrednia mutacja przez AI = ryzyko trust/validation. |
| **D-04** | Izolacja od innych modułów | ✅ APPROVE | Krytyczny constraint biznesowy — Finance, Mindmap muszą kontynuować. |
| **ADR-003** | Server-side query engine obowiązkowy | ✅ APPROVE | Bez tego skalowanie >500 wierszy jest niemożliwe. |
| **ADR-004** | Osobne serwisy domenowe | ✅ APPROVE | Brak rozrostu my-work.routes; dedykowane /api/v1/bases, /tables, /records. |
| **ADR-005** | Feature-flagged rollout | ✅ APPROVE | Pilot-only, brak broad exposure podczas budowy. |
| **ADR-006** | Adapter-first migration | ✅ APPROVE | 4 etapy: backend → table adapter → chat adapter → workspace projection. |

**Rekomendacja:** Wszystkie 6 ADR-ów zatwierdzone.

---

## 2. Blocking Questions — Rekomendowane odpowiedzi

| Pytanie | Odpowiedź | Uzasadnienie |
|---------|-----------|--------------|
| **Czy workspace ma jeden base czy wiele bases?** | **Wiele bases** (1..n per workspace) | Elastyczność na później (np. "CRM base" + "Finance base"); MVP może zaczynać od 1 base = 1 workspace dla uproszczenia. |
| **Czy każde workspace dostaje default base?** | **Tak** | Przy tworzeniu workspace automatycznie tworzymy base "Default" — zachowanie podobne do Airtable. |
| **Czy current graph pozostaje writable po wprowadzeniu platformy?** | **Tak, dla non-table tools** | Mindmap, whiteboard, process_flow piszą do graph. Tylko table tool kieruje zapisy do Records API (gdy flag on). |
| **Czy graph jest consumerem nowej platformy czy równoległym source of truth?** | **Consumer** | Graph czyta projekcje z canonical data; nie jest równoległym SOT dla tabel. |
| **Czy chat może tworzyć nowe bases czy tylko tabele w istniejącym base?** | **Oba** | Intent `create_base` + `create_table`. W MVP: głównie `create_table` w default base. |
| **Które typy pól są launch-critical?** | **WS-C Section 1** — pełna lista 22 typów | W MVP: text, long_text, number, currency, percent, checkbox, date, single_select, multi_select, url, email, phone, attachment, linked_record, created_time/by, last_modified_time/by. |
| **Czy attachments są first-class w MVP?** | **Tak** | WS-C i 90-Day Plan wymieniają attachment v1. Metadata + upload URL + signed download. |
| **Czy pilot widzi platformę w My Work czy przez oddzielny entry point?** | **W My Work** | Zachowanie continuity UX. Nowy table tool (pod flagą) w tym samym workspace shell. |

---

## 3. MVP Scope Sign-Off

**Dokument źródłowy:** WS-A Section 4 (Product Definition)

| Capability | Status | Epic |
|------------|--------|------|
| Metadata backend (base/table/field/view) | IN | Epic 1 |
| Records CRUD + batch | IN | Epic 2 |
| Server-side query engine | IN | Epic 3 |
| Grid UI v1 | IN | Epic 4 |
| Saved views | IN | Epic 3–4 |
| Linked records v1 (count/lookup/rollup) | IN | Epic 5 |
| Chat-to-Schema v1 | IN | Epic 6 |
| Audit trail v1 | IN | Epic 8 |
| CSV import v1 | IN | Epic 7 |
| File attachments v1 | IN | Epic 7 |
| Permissions v1 (base-level) | IN | Epic 10 |
| Workspace compatibility layer | IN | Epic 9 |

**Explicitly OUT of MVP:**
- Full formula engine
- Advanced automations builder
- Interface designer
- Offline-first
- Extension runtime
- External sync ecosystem (Phase 2)
- Enterprise IAM parity

**Rekomendacja:** Scope zatwierdzony zgodnie z WS-A. Brak rozszerzeń.

---

## 4. Success Preconditions — Checklist

| Warunek | Status |
|---------|--------|
| Canonical schema będzie na backendzie | ✅ Założone (ADR-001) |
| Rekordy tabel przestaną zależeć od graph nodes jako final model | ✅ Założone (ADR-002) |
| Pierwsza fala jest celowo partial | ✅ Założone (MVP scope frozen) |
| Obecne strumienie delivery są chronione regułami izolacji | ✅ Założone (ADR-005, ADR-006, Migration doc) |

---

## 5. Zespół i Capacity Check

| Rola | Wymagane | Dostępne? |
|------|----------|-----------|
| Tech Lead / Architect | 1 | [ ] |
| Backend Engineer | 2 | [ ] |
| Frontend Engineer | 2 | [ ] |
| AI / Application Engineer | 1 | [ ] |
| Product Designer | 1 | [ ] |
| Product Owner / PM | 1 | [ ] |
| QA (shared/embedded) | 1 | [ ] |

**Akcja:** Uzupełnij przed startem Sprint 0.

---

## 6. Operacyjne Checkpointy

Przed każdym release stage:
- [ ] Brak regresji w My Work flows
- [ ] Brak regresji w Finance, Mindmap, innych modułach
- [ ] Brak wzrostu failure rate w shared modules
- [ ] Brak wymuszania zmian API dla konsumentów spoza table stream

---

## 7. Final Verdict

### GO Conditions (wszystkie muszą być spełnione)

1. **ADR-y zatwierdzone** — rekomendacja: TAK (Sekcja 1)
2. **Blocking questions odpowiedziane** — rekomendacje w Sekcji 2
3. **MVP scope zatwierdzony** — rekomendacja: TAK (Sekcja 3)
4. **Success preconditions zaakceptowane** — rekomendacja: TAK (Sekcja 4)
5. **Zespół przypisany** — do uzupełnienia (Sekcja 5)
6. **Feature flags przygotowane** — infrastruktura przed S1

### Rekomendacja końcowa

**GO** — jeśli:
- Zatwierdzisz ADR-y, blocking questions i MVP scope (Sekcje 1–3)
- Zespół minimum 6–7 osób jest dostępny
- Feature flags są gotowe przed Sprint 1

**NO-GO** — jeśli:
- Którykolwiek z ADR-ów jest odrzucony
- Zespół < 5 osób lub brak Tech Lead
- Trwają równoległe duże zmiany w my-work.routes lub IdeaMapWorkspace bez domenowej izolacji

---

## 8. Następne kroki

1. Przejrzyj ten dokument z Product + Tech Lead
2. Zatwierdź (podpis / komentarz w PR / ticket) Sekcje 1–4
3. Uzupełnij Sekcję 5 (zespół)
4. Przygotuj feature flags: `table_platform_metadata_first`, `table_platform_records_api`
5. Start Sprint 0 — Architecture lock, domain model confirmation, sprint backlog
