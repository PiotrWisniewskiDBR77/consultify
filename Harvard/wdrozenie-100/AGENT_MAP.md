# AGENT MAP — Program Harvard do 100%
**Data:** 2026-06-17 | **Branch:** Londyn | **SSOT teczki:** Harvard/wdrozenie-100/

---

## 1. CEL PROGRAMU

Domknąć wszystkie 27 modułów produktu Consultify do stanu gotowości produkcyjnej (score 100/100 wg protokołu MODULE_AUDIT_PROTOCOL_V1.md). Każdy moduł ma teczkę (`M01-czat.md` … `M27-superadmin.md`) z rejestrem luk (L-xx). Zadanie agenta = zamknąć wszystkie OTWARTE luki w swoich modułach, zweryfikować NAPRAWIONE i zaktualizować teczki.

---

## 2. KLASYFIKACJA MODUŁÓW: MAŁE vs WIELKIE

### MAŁE (≤6 otwartych luk, brak blokad architektonicznych)

| Nr | Tytuł | Otwarte luki | Agent |
|----|-------|-------------|-------|
| M05 | Ideas — zarządzanie | 3 | Harvard 2 |
| M06 | Ideas — Mind Map | 5 | Harvard 2 |
| M07 | Ideas — Process Flow | 4 | Harvard 2 |
| M08 | Ideas — Table | 5 | Harvard 2 |
| M12 | Audyty | 6 | Harvard 3 |
| M14 | Wdrożenie (Execution) | 2 | Harvard 4 |
| M15 | Rezultaty (Results) | 3 | Harvard 4 |
| M16 | Finanse (Economics) | 1 | Harvard 4 |
| M19 | Prezentacje | 6 | Harvard 5 |
| M20 | Tabele Studio | 5 | Harvard 5 |
| M21 | Meeting | 6 | Harvard 5 |

### WIELKIE (≥7 otwartych luk LUB złożoność architektoniczna LUB blokada zewnętrzna)

| Nr | Tytuł | Otwarte luki | Agent | Uwaga |
|----|-------|-------------|-------|-------|
| M01 | Czat (Teresa) | 10 | Harvard 1 | AI core, największy user-impact |
| M02 | Canvas / Deliverables | 15 | Harvard 1 | VITE flag, editor, triada |
| M03 | Moja Praca (organizer) | 10 | Harvard 2 | hub dla M05-M09 |
| M04 | Notatnik | 7 | Harvard 4 | i18n ~186 kluczy, handoff |
| M09 | Ideas — Whiteboard | 6 | FALA 2 | ZABLOKOWANY: P0 per-user doc |
| M10 | Wywiad (Interview) | 7 | Harvard 3 | PROD P0 czeka na Piotra (STT key) |
| M13 | Inicjatywy | 9 | Harvard 3 | SSOT statusów ↔ kod |
| M17 | Outputs Library | 10 | Harvard 5 | hub deliverables |
| M18 | Dokumenty Studio | 10 | Harvard 5 | 6/8 warstw trwałych (cold-start) |

---

## 3. FALE PRACY

### FALA 1 — aktywna (5 agentów równolegle)

| Agent | Cluster | Moduły | Łączne otwarte luki |
|-------|---------|--------|---------------------|
| Harvard 1 | Core Chat & Canvas | M01, M02 | ~25 |
| Harvard 2 | Ideas Suite | M03, M05, M06, M07, M08 | ~27 |
| Harvard 3 | Research Chain | M10, M12, M13 | ~22 |
| Harvard 4 | Execution Wrap-up | M04, M14, M15, M16 | ~13 |
| Harvard 5 | Platform & Outputs | M17, M18, M19, M20, M21 | ~37 |

### FALA 2 — odroczona

Moduły: M22 (AI OS), M23 (Organizacja), M24 (Admin), M25 (Ustawienia), M26 (Portal Partnerski), M27 (SuperAdmin), A1 (Ecosystem).  
Łącznie: ~52 otwarte luki.

### ZABLOKOWANE (czekają na decyzję Piotra)

- **M09** — P0 architektoniczny: personal whiteboard per-user doc (design decision required)
- **M10 PROD P0** — OPENAI_API_KEY na Railway centerbeam (osobna zgoda Piotra)

---

## 4. PODZIAŁ PLIKÓW — STREFY AGENTÓW

Każdy agent pracuje TYLKO w swojej strefie. `git add -A` jest ZAKAZANE — zawsze `git add <konkretne-pliki>`.

```
Harvard 1:
  src/components/Chat/
  src/components/Canvas/
  src/views/chat/
  server/src/routes/chat.routes.ts
  server/src/services/chat*/

Harvard 2:
  src/components/MyWork/
  src/views/my-work/
  server/src/routes/my-work.routes.ts   ← wyłącznie H2

Harvard 3:
  src/components/Interview/
  src/components/Audit/
  src/components/Initiatives/
  server/src/routes/interview.routes.ts
  server/src/routes/initiatives.routes.ts
  server/src/routes/audits.routes.ts

Harvard 4:
  src/components/Notebook/
  src/components/Execution/
  server/src/routes/notebook.routes.ts
  server/src/routes/execution.routes.ts

Harvard 5:
  src/components/Outputs/
  src/components/Documents/
  src/components/Presentations/
  src/components/TablePlatform/
  src/components/Meeting/
  server/src/routes/table-platform.routes.ts
  server/src/routes/documents.routes.ts
  server/src/routes/presentations.routes.ts
```

**ZAKAZANE dla wszystkich agentów (bez zgody Piotra):**
- `public/locales/*/` — translacje (inny agent + ryzyko merge)
- `server/src/middleware/` — wspólny kod auth
- `.env*`, `.railway*`, `railway.toml`
- Jakikolwiek deploy na prod (centerbeam)

---

## 5. PROTOKÓŁ GIT (OBOWIĄZKOWY)

```bash
# Sprawdź HEAD przed każdym commit
git fetch origin Londyn
git status

# Dodawaj tylko swoje pliki
git add src/components/Chat/SomeComponent.tsx
git add server/src/routes/chat.routes.ts

# Nowe pliki testów w /tests/ wymagają -f
git add -f tests/integration/chat/some.test.ts

# Commit
git commit -m "fix(M01/L-xx): opis"
```

---

## 6. DEFINICJA DONE (per luka)

1. Kod naprawiony i lokalnie działa
2. Test (unit lub integration) weryfikuje poprawkę
3. `tsc --noEmit` bez nowych błędów
4. Teczka zaktualizowana: status luki → `ZAMKNIĘTA <data> <commit>`
5. Commit z etykietą `fix(MXX/L-xx):`

---

## 7. LINKI DO BRIEFÓW AGENTÓW

- [HARVARD_1_BRIEF.md](./HARVARD_1_BRIEF.md)
- [HARVARD_2_BRIEF.md](./HARVARD_2_BRIEF.md)
- [HARVARD_3_BRIEF.md](./HARVARD_3_BRIEF.md)
- [HARVARD_4_BRIEF.md](./HARVARD_4_BRIEF.md)
- [HARVARD_5_BRIEF.md](./HARVARD_5_BRIEF.md)
