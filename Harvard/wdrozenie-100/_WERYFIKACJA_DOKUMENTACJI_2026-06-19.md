# Weryfikacja dokumentacji Harvard wdrozenie-100 — przeciw realnemu kodowi

**Data:** 2026-06-19 · **Branch:** Londyn · **Metoda:** 7 agentów równolegle, każdy sprawdzał teczki PRZECIW KODOWI (nie ufając deklaracjom) + dopisywał inwentarz ekranów
**Zakres:** wszystkie 27 modułów (M01–M27, M11 descoped) + A1 Affiliate
**Cel:** odpowiedź na pytanie właściciela — czy dokumentacja jest pewna i wykonalna, czy to puste/krótkie zbiory; przygotować ją do egzekucji kroku 4–6 (dokończenie modułów) z odbiorem per moduł.

---

## TL;DR — werdykt

1. **Dokumentacja jest WIARYGODNA.** Zweryfikowano ~40 deklaracji „NAPRAWIONA/ZAMKNIĘTA" przeciw kodowi → **przeważająca większość = PRAWDA** (commity istnieją, guardy/INSERT-y/testy obecne w cytowanych plikach i liniach). To NIE jest fasada — w przeciwieństwie do obawy „znowu deklaracje bez pokrycia".
2. **Wszystkie 27 teczek = SOLID** (realne epiki, DoD, rejestr luk z `plik:linia`, testy). Jedyny wyjątek: **A1 Affiliate = NIEAKTUALNA** (descoped, jedna fałszywa deklaracja „usunięto view").
3. **Teczki są wykonalne** — można z nich odbierać moduły. Brakowało dotąd egzekucji, nie dokumentacji.
4. **3 realne rzeczy do uwagi** (niżej): (a) 49 nieśledzonych plików src/ psuje clean-build, (b) M10 głos/STT — kod gotowy ale NIEzweryfikowany na żywo (żywy P0 VTS), (c) M27 SuperAdmin i część live-verify wymaga kont/środowisk.
5. **Inwentarz ekranów dopisany do każdej teczki** (sekcja `## EKRANY (inwentarz) — 2026-06-19`) — łącznie **~437 ekranów** w 27 modułach do dopięcia ze screenami drugiego audytora.

---

## Tabela werdyktów per moduł

| Mod | Jakość | Weryfikacja kodu (luki sprawdzone) | Ekrany | Gotowość egzekucji |
|---|---|---|---|---|
| M01 Czat | SOLID | 3/3 PRAWDA (kręgosłup, reasoning, PL→EN) | 20 | ✅ TAK |
| M02 Canvas | SOLID | 3/3 PRAWDA (capabilities, regenerate, 400-guard) | 16 | ✅ TAK¹ |
| M03 My Work | SOLID | 3/3 PRAWDA (leak-403, crash-fix, in-context) | 15 | ✅ TAK |
| M04 Notatnik | SOLID | 3/3 PRAWDA (handoff, search-scope, rail-persist) | 16 | ✅ TAK |
| M05 Ideas-Zarz. | SOLID | 3/3 PRAWDA (conflict-409, one-writer, flush) | 11 | ✅ TAK |
| M06 Mind Map | SOLID | 3/3 PRAWDA (WS org-scope, rose, AI overlays) | 16 | ✅ TAK |
| M07 Process Flow | SOLID | 3/3 PRAWDA (V8 CUT realny) | 12 | ✅ TAK² |
| M08 Table | SOLID | 2/3 PRAWDA, 1 mylące (PublicFormView untracked) | 17 | ⚠️ drobny cleanup |
| M09 Whiteboard | SOLID | 3/3 PRAWDA (org-read, graph_patch, WS-scope) | 11 | ✅ TAK |
| M10 Wywiad | SOLID | 3/3 PRAWDA w kodzie — **ale P0 głos NIE live-verified** | 28 | ⚠️ WYMAGA live-verify |
| M12 Audyty | SOLID | 3/3 PRAWDA (beta-gate, search, MVP-banner) | 7 | ✅ TAK |
| M13 Inicjatywy | SOLID | 3/3 PRAWDA + testy 15/15 PASS | 30 | ✅ TAK |
| M14 Wdrożenie | SOLID | 3/3 PRAWDA (rollout-gate, bannery, dead-code) | 18 | ✅ TAK |
| M15 Rezultaty | SOLID | 3/3 PRAWDA — **ale dead-code wrócił untracked** | 17 | ⚠️ doc-korekta |
| M16 Finanse | SOLID | 3/3 PRAWDA (IDOR-scope, test-fix, beta-gate) | 22 | ✅ TAK |
| M17 Outputs | SOLID | 3/3 PRAWDA (export-gate, rate-limit, persistKey) | 11 | ✅ TAK |
| M18 Dokumenty | SOLID | 3/3 PRAWDA — fraza „0 new Map" nieprecyzyjna | 7 | ✅ TAK |
| M19 Prezentacje | SOLID | 3/3 PRAWDA (override-gate, snapshot, viewer-fix) | 21 | ✅ TAK³ |
| M20 Tabele Studio | SOLID | 3/3 PRAWDA (IDOR-fix, tp_* persist, webhook-AES) | 13 | ✅ TAK |
| M21 Meeting | SOLID | 3/3 PRAWDA (notebook_pages, injection, gates) | 8 | ✅ TAK |
| M22 AI OS | SOLID | 3/3 PRAWDA (route-usunięty, 404-mid, V8-banner) | 9 | ✅ TAK |
| M23 Organizacja | SOLID | 3/3 PRAWDA (3×P1 role-gate + testy) | 6 | ✅ TAK |
| M24 Admin | SOLID | 2/3 PRAWDA, 1 CZĘŚCIOWA (AdminSidebar untracked) | 5 | ✅ TAK |
| M25 Ustawienia | SOLID | 3/3 PRAWDA (self-scope, gdpr-bcrypt, 500-N/D) | 7 | ✅ TAK |
| M26 Portal Part. | SOLID | 3/3 PRAWDA (503-deprecation, stub-503, test) | 18 | ✅ TAK⁴ |
| M27 SuperAdmin | SOLID⁵ | 3/3 PRAWDA (security-gates) — live-verify pending | 60 | ⚠️ wymaga konta superadmin |
| A1 Affiliate | NIEAKTUALNA | 2/3 PRAWDA, 1 FAŁSZ (view-orphan na dysku) | 0 | ✅ TAK (descope) |

**Przypisy:**
1. M02 — kod triady deck/doc/sheet gotowy, ale `VITE_ENABLE_DELIVERABLES_LIGHT` musi być ustawiony na Railway (deploy-time, decyzja Piotra) — bez tego Canvas OFF na staging/prod.
2. M07 — drobny rozjazd: martwy `vi.mock` nieistniejącego `v8/processFlowService.js` w `my-work.home.fail-closed.contract.test.ts` + ten test failuje na osobnym braku `requireRole` w mocku auth (niezwiązane z M07).
3. M19 — pipeline „z czatu zrób deck" wymaga `ENABLE_V8_GLOBAL` na prod (OFF → martwy bez env var).
4. M26 — **schema drift na prod (centerbeam)** musi być zaaplikowany przez Piotra przed otwarciem portalu.
5. M27 — security-gate'y realne w kodzie i statycznie potwierdzone, ale DoD #2/#6 (żywy dowód RBAC-reject), L-11 (testy maskowane mock-gate), §27 (~73–80 surowych `<table>`, największy dług programu) NIE domknięte bez konta superadmin.

---

## 3 realne rzeczy do uwagi właściciela

### 1. 49 nieśledzonych plików źródłowych w `src/` (git-race na Londyn) — psuje clean-build
Wzorzec z `finding_build_integrity_untracked`: pliki usunięte w gicie wróciły na dysk jako `??` (untracked), część **ma importerów** → na świeżym `git clone`/`git archive` ich nie ma = build się wywala lub gubi kod.
- **Martwe (0 importerów) — bezpieczne do usunięcia:** `table/PublicFormView.tsx`, `Initiatives/InitiativeConflictsPanel.tsx` (tracked, ale 0 ref — osobny przypadek), `Results/ResultsSummaryView.tsx`, `Results/OperationalAnalysisView.tsx`, `views/AffiliateDashboardView.tsx`, + ~30 w `Economics/`, `Execution/`, `MyWork/`.
- **Untracked ALE z importerami — NIE kasować, trzeba zacommitować lub rozplątać:** `notebook/InsertMenu.tsx` (2), `notebook/KnowledgePulse.tsx` (1), `layout/AdminSidebar.tsx` (1) — to żywy-ale-niezacommitowany kod, ryzyko utraty.
- **Rekomendacja:** osobny triaż build-integrity (metoda `git archive` → próbny build) PRZED dalszą egzekucją. Pierwszy konkretny krok kodowy do zrobienia z Piotrem.

### 2. M10 Wywiad — głos/STT: kod gotowy, NIE zweryfikowany na żywo (żywy P0 VTS)
Łańcuch STT realny (OpenAI→Groq→Gemini fallback, działa bez `OPENAI_API_KEY`), FE interim-flush wpięty. **Ale teczka uczciwie mówi „czeka live-verify na staging" — to nie jest potwierdzone na żywym mikrofonie/prodzie.** Żywi ludzie VTS na to czekają. Najwyższy priorytet po stronie klienta.

### 3. Drobne nieścisłości frazeologiczne (nie wpływają na bezpieczeństwo/funkcję)
- M18: fraza „0 `new Map` w ścieżce prod" przesadzona — write-through Map-cache nadal istnieje (`documentLifecycleService.ts:127`); persystencja PG realna, ale sformułowanie sugeruje brak Map.
- M12/M16/M23/M25: cytaty `plik:linia` miejscami przeterminowane przez współbieżne commity (np. GET vs POST, ścieżka testu) — logika kodu zgadza się, cytaty traktować orientacyjnie.

---

## Co jest potrzebne, żeby ruszyć z egzekucją (bramka)

**Dokumentacja jest gotowa.** Blokery egzekucji to nie braki w teczkach, tylko:
1. **Triaż 49 untracked plików** (build-integrity) — żeby egzekucja nie stała na zatrutym working-tree.
2. **Środowiska/konta** dla 3 modułów: M02 flaga Railway, M26 schema prod, M27 konto superadmin, M03/M10 env-vars (OAuth kalendarz, Gemini key) — wszystko za zgodą Piotra (prod=centerbeam).
3. **Żywe smoke** (R6) dla modułów beta/Ideas — testowane przez Piotra + drugi audytor (screeny).

**Kolejność rekomendowana (klienci najpierw):** M10 (głos VTS live) → M13/M16 (Inicjatywy/Finanse) → reszta wg puli. Każdy moduł: dokończenie w kodzie → demo → odbiór Piotra (funkcja + UX ze screenami audytora).

---

## Inwentarz ekranów — dla drugiego audytora (screeny)

Każda teczka MXX ma teraz sekcję `## EKRANY (inwentarz) — 2026-06-19` z listą ekranów (nazwa — cel — plik komponentu). Łącznie **~437 ekranów** w 27 modułach. Największe: M27 SuperAdmin (~60), M13 Inicjatywy (~30), M10 Wywiad (~28), M16 Finanse (~22), M19 Prezentacje (~21), M01 Czat (~20).

Mapowanie screen→moduł→plik pozwala dopiąć screeny audytora do konkretnych komponentów i odbierać UX per moduł równolegle z funkcją.
