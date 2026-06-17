# Audyt zgodności testów manualnych — raport niezależny

> **Co to:** niezależny, adwersarialny audyt 24 specyfikacji testów (M05–M27 + A1) względem wzorca (M01) i realnego kodu. Każdy moduł audytował osobny agent, który NIE pisał testu, weryfikując twierdzenia o kodzie bezpośrednio w repo (grep/Read w `src/` i `server/src/`).
> **Data:** 2026-06-16
> **Zakres:** M05–M27 + A1 (M01–M04 = wzorzec, nieaudytowane tu).

---

## Werdykty zbiorcze

| Moduł | Werdykt | Grounding (potw./sprawdz.) | Najważniejszy defekt |
|---|---|---|---|
| M05 Ideas-Zarządzanie | 🟡 ZGODNY-Z-UWAGAMI | 20/22 | flaga beta odwrócona |
| M06 Ideas-Mind Map | 🟡 ZGODNY-Z-UWAGAMI | 14/16 | martwy shim + flaga beta odwrócona |
| M07 Ideas-Process Flow | 🟡 ZGODNY-Z-UWAGAMI | 18/20 | zły endpoint AI; 24 vs 25 kształtów |
| M08 Ideas-Table | 🔴 **NIEZGODNY** | 11/18 | flaga beta odwrócona + złe ścieżki audit/activity + bugi już naprawione cytowane jako otwarte |
| M09 Ideas-Whiteboard | 🟡 ZGODNY-Z-UWAGAMI | 14/16 | nieaktualny „known bug" L-03 (org-scope już jest) |
| M10 Wywiad | 🟡 ZGODNY-Z-UWAGAMI | 22/25 | błędne cytaty linii (7 vs 5; zła linia zapisu) |
| M11 Narzędzia | 🟡 ZGODNY-Z-UWAGAMI | 12/14 | LEAN ma dedykowany template; trasa `megatrends` (nie `megatrendy`) |
| M12 Audyty | 🟡 ZGODNY-Z-UWAGAMI | 14/15 | definicja „done" pomija `approved`; L-04 już naprawiony |
| M13 Inicjatywy | 🔴 **NIEZGODNY** | 15/22 | maszyna stanów rozjechana z kodem; statusy DB UPPERCASE vs lowercase; fałszywe założenie egzekwowania ról na serwerze |
| M14 Wdrożenie | 🟡 ZGODNY-Z-UWAGAMI | 18/21 | zmyślone pola `overview.*`; zły plik/ścieżka Manager V8 |
| M15 Rezultaty | 🟡 ZGODNY-Z-UWAGAMI | 17/19 | zły funnel event; zły endpoint scorecards; luka ROIAssumptionEditor |
| M16 Finanse | 🟡 ZGODNY-Z-UWAGAMI | 13/18 | zły wizard importu (PDF→fałszywy FAIL); liczby DCF poza własną tolerancją; błędna atrybucja commitu IDOR |
| M17 Outputs | 🟡 ZGODNY-Z-UWAGAMI | 22/23 | etykieta „bramka eksportu" (to Start-review); drift linii |
| M18 Dokumenty | 🟡 ZGODNY-Z-UWAGAMI | 16/18 | nieaktualna L-05 (gating roli już jest → fałszywy FAIL) |
| M19 Prezentacje | 🟡 ZGODNY-Z-UWAGAMI | 18/20 | złe endpointy pipeline + brak prekroku snapshot + zły revert |
| M20 Tabele Studio | 🟡 ZGODNY-Z-UWAGAMI | 13/15 | 35 vs 34 typy pól; zła ścieżka formularza publicznego |
| M21 Meeting | 🟡 ZGODNY-Z-UWAGAMI | 12/12 | §12.1 sfabrykowany („23 PASS" + 2 nieistniejące pliki testów) |
| M22 AI OS | 🔴 **NIEZGODNY** | 11/24 | ~15 złych/zmyślonych endpointów; funkcje-widma (private-mode, final-gate); nieaktualna L-01 |
| M23 Organizacja | 🟡 ZGODNY-Z-UWAGAMI | 15/15 | §0.2 zawyża: W11 sync istnieje, ale Teresa go NIE konsumuje |
| M24 Admin | 🟡 ZGODNY-Z-UWAGAMI | 18/18 | nieaktualna L-07 (sprzeczna z własnym groundingiem); mylna struktura zakładek AI |
| M25 Ustawienia | 🟡 ZGODNY-Z-UWAGAMI | 14/17 | złe endpointy Calendar Sync (ale słusznie obala Voice/Billing/GDPR jako naprawione) |
| M26 Portal Partnerski | 🟡 ZGODNY-Z-UWAGAMI | 16/21 | wszystkie 11 linii 503 błędne; złe ścieżki SuperAdmin; zły katalog i18n |
| M27 SuperAdmin | 🟡 ZGODNY-Z-UWAGAMI | 19/19 | tylko kosmetyka (ścieżka ProtectedRoute, drift linii) |
| A1 Affiliate | 🟡 ZGODNY-Z-UWAGAMI | 14/14 | drobne; STUB oznaczony wzorcowo |

**Podsumowanie:** 🔴 NIEZGODNE: **3** (M08, M13, M22) · 🟡 ZGODNE-Z-UWAGAMI: **21** · 🟢 ZGODNE-bez-uwag: 0.

> **AKTUALIZACJA 2026-06-16:** 3 NIEZGODNE (**M08, M13, M22**) zostały **NAPRAWIONE** — warstwa faktów (flagi/endpointy/statusy/przejścia/known-bugi) przepisana z realnego kodu jako SSOT przez osobnych agentów, każdy defekt zweryfikowany w kodzie przed edycją. Pozostałe 21 (z uwagami) NIE były jeszcze poprawiane — listy DO_POPRAWY niżej obowiązują.

**Ocena ogólna:** wszystkie testy są strukturalnie wzorcowe (WZORZEC: PASS dla 24/24), kompletne w pokryciu epików/funkcji i mają mocny rygor E2E (żądanie dowodu endpoint/payload/DB, nie sam wygląd). **Wspólna słabość = warstwa faktów o kodzie**: ścieżki/endpointy/linie rekonstruowane częściowo z dokumentów zamiast w 100% z kodu. To produkuje **fałszywe FAIL-e** (tester pójdzie po złym endpoincie) i **fałszywe „znane bugi"** (raportowanie defektów już naprawionych).

---

## Wzorce systemowe (naprawiać raz, nie 24 razy)

### S1 — Flaga beta Ideas ODWRÓCONA (M05, M06, M08) — KRYTYCZNE
Testy twierdzą `MYWORK_IDEAS: 'closed'` + `BETA_ADMINS_EXEMPT = 'false'` („zamknięte dla wszystkich ról"). Realny kod: `src/utils/betaAccess.ts:58` = `'open'`, `:32` = `BETA_ADMINS_EXEMPT = true`. Ideas jest OTWARTE. → cała premisa wejścia + testy blokady dadzą fałszywy FAIL. **Źródło: stale KARTA/teczka.** Poprawić w M05/M06/M08 (i sprzątnąć stale komentarz w `MyWorkHub.tsx:606`).

### S2 — Złe / zmyślone endpointy (M22 ⚠️, M13, M19, M14, M15, M16, M25, M26)
Agenci odtwarzali ścieżki endpointów z pamięci/dokumentów, nie z `src/services/api.ts` + route files. Skala: M22 ~15 błędnych (w tym funkcje-widma `/ai-context/private-mode`, `/ai-outcomes/:id/final-gate`), M13 cała maszyna stanów, M19 pipeline (`/artifact-runs` zamiast `/from-chat`), M26 wszystkie ścieżki SuperAdmin. **Naprawa: regenerować każdy „oczekiwany URL" z kodu jako SSOT (grep w api.ts), z dowodem.**

### S3 — Dryf numerów linii (niemal uniwersalny)
Ścieżki plików zwykle poprawne, ale numery linii przesunięte (kod się ruszył od czasu audytów 06-11/06-13). Testy cytują „plik:linia" jako dowód → tester trafia w komentarz/inny kod. **Naprawa: dodać do każdego testu notę „linie orientacyjne — zweryfikuj grepem", albo zastąpić linie nazwami symboli/handlerów.**

### S4 — Nieaktualne „znane bugi" cytowane jako otwarte (M08, M09, M12, M18, M24, M22)
Testy każą raportować jako P0/P1 defekty, które są już naprawione w kodzie: M08 fenced-JSON crash, M09 L-03 org-scope, M12 L-04 beta-guard, M18 L-05 gating roli template, M24 L-07 members requireRole, M22 L-01 artifact loadError. → tester zgłosi nieistniejący defekt (fałszywy negatyw). **Naprawa: przeklasyfikować na „test regresji: potwierdź że naprawione".**

### S5 — Niezgodności wartości/format DB (M13, M12)
M13: statusy w asercjach `[DB]` jako UPPERCASE (`PENDING_REVIEW`), realna kolumna `status` trzyma lowercase (`'review'`). M12: definicja „done" pomija status `approved` (kod: `DONE_STATUSES = {submitted, approved, completed}`). → fałszywe FAIL-e asercji DB. **Naprawa: wyrównać do realnych wartości w kodzie.**

### S6 — Sfabrykowane dane regresji (M21)
M21 §12.1 podaje „23 PASS / 0 FAIL" i 2 nieistniejące pliki testów. Realnie 1 plik smoke z 3 testami. **Naprawa: zastąpić realnym stanem (lub odnotować brak pokrycia BE).**

### Pozytyw — testy czasem ŚWIEŻSZE niż grounding
M23 (W11 org-context sync REALNIE istnieje), M25 (Voice false-negative OBALONY, Billing i GDPR-delete NAPRAWIONE), M12 (baner kreatora naprawiony) — agenci zweryfikowali żywy kod i słusznie wyprzedzili nieaktualne dokumenty. To dowód, że rygor „weryfikuj w kodzie" działa.

---

## Realne findingi produktowe wykryte przy okazji (nie defekty testów — defekty aplikacji)

> Te wymagają decyzji/naprawy w KODZIE, niezależnie od testów.

1. **[M13 — bezpieczeństwo, P1] Bramki stanów inicjatyw bez egzekwowania ról na serwerze.** Trasy `submit-review/approve/reject/start-execution` nie mają middleware ról, kontrolery nie wołają `canExecuteGate`. Gating jest tylko po stronie klienta → potencjalny bypass autoryzacji. Zweryfikować i — jeśli potwierdzone — dodać guard serwerowy.
2. **[M22 — produkt, P2] Martwe przyciski w Research Sessions.** `pause`/`archive` w UI nie mają ani backendu (`/transition`), ani metody klienta (`Api.pauseResearch/archiveResearch`). Klik = nic.
3. **[M19 — produkt, P3] Collaborate STUB nieukryty.** Decyzja DP-5 (ukryć zakładkę invite-by-email za flagą) nie wdrożona — zakładka „Collaborate" wciąż pierwsza i widoczna, mimo martwych handlerów.
4. **[M23 — produkt, P2] Goals/Challenges/Strategy nie zasilają Teresy.** W11 sync zapisuje do `organization_context_store`, ale `OrganizationContextService` czyta cele z innego źródła (claim rows) → wpisane cele org NIE trafiają do AI.
5. **[M16 — bezpieczeństwo, P2] `getModel(modelId, orgId?)` — orgId opcjonalny.** Brak org-scope gdy pominięty; bezpieczeństwo zależy wyłącznie od tego, że route przekazuje `organizationId`. Dodać test regresji na pominięcie.

---

## Rekomendowana kolejność naprawy

1. **3 × NIEZGODNY** (M08, M13, M22) — przepisać warstwę faktów (endpointy/statusy/flagi) z kodu.
2. **S1 flaga beta** (M05/M06/M08) — szybka, mechaniczna, wysokie ryzyko fałszywych FAIL.
3. **S4 nieaktualne known-bugi** (6 modułów) — przeklasyfikować na regresję.
4. **S2 endpointy** w pozostałych (M14/M15/M16/M19/M25/M26) — regeneracja z api.ts.
5. **S3 dryf linii** — globalna nota + punktowe poprawki.
6. **Findingi produktowe** — osobny backlog (to naprawy w kodzie, nie w testach).

*Pełne listy defektów per moduł (TOP_DEFEKTY + DO_POPRAWY) są w surowych zwrotach audytorów w transkrypcie sesji 2026-06-16.*
