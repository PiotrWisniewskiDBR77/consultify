# Backlog — Cykl życia tabel (Archive/Delete + scope) i domknięcia kanonu

> Status na: 2026-06-07 · Branch: `Londyn` (wszystko lokalne, bez push)
> Kanon referencyjny: [`TABLE_AND_PREVIEW_CANON.md` §14](../ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md)
>
> **Dyspozycja właściciela (2026-06-07):** najpierw kończymy WSZYSTKIE tabele i wywiady
> (kanon + lifecycle). Potem **jeszcze raz przechodzimy przez wszystkie aktualizacje**
> i dopiero wtedy zajmujemy się pozycjami z tego backloga (rollout + weryfikacja live).
> Tzn. ten plik to świadomie odłożona praca — nie ruszać przed tym wspólnym przeglądem.

---

## ✅ Zrobione (commitnięte lokalnie)
- **Kanon tabeli — Insights** (`31b889c8e7`): typy/statusy z kropkami do lewej, ikony przy
  tytułach usunięte, popover portalowany, kebab 3-strefowy, bulk po lewej + framed Clear.
- **Lifecycle — pilot Insights** (`9c3ce35d6f`): chip scope Aktywne/Zarchiwizowane w Menu 3,
  kebab Archiwizuj/Przywróć, bulk Archive/Restore, `GET ?scope=`, guarded lazy ALTER
  `archived_at`/`archived_by` na `interview_insights`, archiwizacja przez `PATCH {archived}`.
- **Kanon §14** (ten commit): spisany standard cyklu życia + checki w §27 (D, H).

---

## B-1 — Rollout lifecycle na pozostałe tabele Wywiadu
**Cel:** ten sam wzorzec co Insights na: Inbox, Sessions, Assigned, Templates, Initiatives.
**Stan backendu:**
- `interview_sessions` i `interview_assignments` **mają już** `archived_at` + scope-helper
  (`ensureInterview*LifecycleColumns`, filtr scope ~`InterviewController` L1847–1886) → tu głównie
  okablowanie UI.
- `interview_library_templates` — sprawdzić, czy ma archived; jeśli nie → guarded ALTER jak Insights.
- Initiatives — zweryfikować źródło danych (interview vs my-work) i endpoint.
**Robota per tabela (wzorzec):**
1. Stan `*Scope` ('active'|'archived') + reload na zmianę.
2. Chip „Zarchiwizowane" w Menu 3 (formuła 1), za dzielnikiem.
3. Kebab strefa „dół/stały": Archiwizuj↔Przywróć (wg scope/`archivedAt`).
4. Bulk: Archive/Restore (`MENU_3_ACTION_NEUTRAL`).
5. API: `list({scope})` + `update({archived})` (lub istniejący archive/restore endpoint).
**Gate:** tsc 0 / eslint 0 + **weryfikacja live na realnych danych** (patrz B-2).

## B-2 — Weryfikacja live archive→restore (DŁUG DOWODOWY)
**Problem:** round-tripu archiwizacji **nie dało się sprawdzić** na koncie OWNER/DBR77 w tym env, bo:
- org nie ma realnych insightów → hub pokazuje **demo-fixtures** (`demo_insight_*`,
  `interviewDemoData.insights`, `InterviewHub` ~L7844), które **ignorują `scope`** i **odrzucają zapis**;
- `PATCH …/insights/:id` → **403 `INTERVIEW_INSIGHTS_REVIEW`** (znany RBAC/demo gap,
  `memory/finding_interview_rbac_admin_gap.md`).
**Do zrobienia:** na koncie z **realnymi insightami + prawem `INTERVIEW_INSIGHTS_REVIEW`**:
- archiwizuj wiersz → znika z `active`, pojawia się w `archived`;
- „Przywróć" → wraca do `active`;
- bulk archive/restore na ≥2 wierszach;
- potwierdzić, że `GET ?scope=archived` filtruje po stronie serwera (nie 12 z fixture'ów).
**Co JUŻ potwierdzone live (na ile env pozwalał):** `GET ?scope=active → 200`; chip renderuje się
w command row; kebab pokazuje „Archive"; klik wysyła `PATCH {archived:true}` na właściwy endpoint;
błąd 403 → toast, brak optymistycznego usunięcia (poprawna obsługa).

## B-3 — Domknięcia wyrównań kanonu (deferred „domknij")
- **Progress %** → wyrównać do **PRAWEJ**; **DueChip** → do **LEWEJ** na Inbox / Assigned / Sessions
  (obecnie część wyśrodkowana). §3.3.
- Rozważyć rolowanie kropki tożsamości (`categoryTone`) na pozostałe chipy type/source tam,
  gdzie jeszcze nie ma.

## B-4 — Decyzje świadomie odłożone (nie robić bez ponownej zgody)
- **Uprawnienia Usuń:** dziś `INTERVIEW_INSIGHTS_PUBLISH` (pre-existing) — luźniejsza decyzja
  „dla każdego z prawem edycji" dotyczyła Archive; ewentualne zaostrzenie Delete = osobny temat.
- **Scope w Menu 2 zamiast Menu 3:** właściciel wybrał Menu 3 (chip). Gdyby scope miał być
  zawsze widoczny (też gdy otwarty dokument/zakładka) → przenieść do Menu 2/rightControls. §14.2.
- **Stan `all`** (widok łączony aktywne+archiwum) — backend już wspiera (`scope=all`), UI na razie
  tylko 2-stanowy toggle; dołożyć gdy pojawi się potrzeba audytowa.

---

## Zasada zamknięcia (przypomnienie z reguły „weryfikuj, zanim ogłosisz")
Żadna pozycja z B-1..B-3 nie jest „zrobiona" na podstawie tsc/eslint. Każda zmiana UI:
otwórz w preview → sprawdź wizualnie i logicznie (per zakładka/stan) → dowód (screenshot/
computed-style/network). Lifecycle dodatkowo wymaga **realnych danych**, nie demo-fixtures.
