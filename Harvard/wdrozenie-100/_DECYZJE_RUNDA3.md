# DECYZJE — Runda 3
**Data:** 2026-06-17 | **Branch:** Londyn | **Status:** ✅ PODPISANE PRZEZ PIOTRA 2026-06-17

Zbiorczy rejestr 8 luk decyzyjnych (D-01/D-02) wymagających rozstrzygnięcia produktowego. Każdy agent dopisuje sekcję swojego modułu: **opcje + rekomendacja CTO (Claude) + miejsce na decyzję Piotra**. Piotr przegląda raz, rozstrzyga hurtem, agenci wykonują.

**Format wpisu agenta:**
```
### MXX L-YY — <tytuł>
- Plik: `<ścieżka:linie>`
- Stan obecny: <co jest>
- Opcje: A) … B) … C) …
- Rekomendacja CTO: <opcja + 1 zdanie dlaczego>
- DECYZJA PIOTRA: ☐ A ☐ B ☐ C — [tu wpisuje]
```

---

## REJESTR DECYZJI (8)

| # | Moduł/Luka | Tytuł | Typ | Agent | Status |
|---|-----------|-------|-----|-------|--------|
| 1 | M04 L-02 | Trzeci panel (RightRail/SplitLayout multi-instancja) | D-01/DP-2 | Harvard 4 | ☐ |
| 2 | M04 L-03 | Canonical Path Strip — ciężki/rozproszony | D-02 | Harvard 4 | ☐ |
| 3 | M13 L-07 | In-context open vs nawigacja do modułu | D-01 | Harvard 3 | ☐ |
| 4 | M14 L-05 | Feed-forward M14→M15 — realny odbiór vs preview | D-01 | Harvard 4 | ☐ |
| 5 | M15 L-05 | Sync-from-M20 — realny odbiorca vs preview | D-01 | Harvard 4 | ☐ |
| 6 | M17 L-01 | Bramka aprobaty eksportu (publish-approval policy) | D-02 | Harvard 5 | ☐ |
| 7 | M18 L-04 | Mode3 `useLlm:false` → placeholder vs LLM | D-02 | Harvard 5 | ☐ |
| 8 | M20 L-05 | Governed sync — realni czytelnicy M15/M16 vs preview | D-01 | Harvard 5 | ☐ |

---

## ROZSTRZYGNIĘCIA (podpisane 2026-06-17)

### 1. M04 L-02 — Trzeci panel → **DP-2 LEKKI RAIL** ✅
- Plik: powłoka (`RightRail`/`SplitLayout`/`MainLayout`)
- **DECYZJA PIOTRA: B-kompromis (DP-2)** — jeden trwały prawy rail z kontekstem, **przeżywający nawigację**, BEZ pełnego multi-instance docking. Pełne IDE-docking → v1.1. Spójne ze SPEC_ZADANIE_07.
- Wykonawca: **Harvard 4**. Zakres: trwałość raila przez nawigację (state w layout/context, nie per-route unmount).

### 2. M04 L-03 — Canonical Path → **ODCHUDŹ TERAZ** ✅
- Plik: `NotebookCanonicalPathStrip.tsx:25-179`
- **DECYZJA PIOTRA: A** — czysto FE refactor: odchudzić strip + scalić prawy panel do 1 raila z 2 zakładkami. Niski koszt/ryzyko, robimy w tej rundzie.
- Wykonawca: **Harvard 4**.

### 3. M13 L-07 — In-context open → **DP-2 (IDE-tabs)** ✅ *(rozstrzygnięte wcześniej)*
- Plik: `MyWorkHub.tsx:1249,3193`
- **DECYZJA: DP-2 globalny dok IDE-tabs.** Implementacja w `MyWorkHub.tsx` = **STREFA HARVARD 2** (nie H3). Reassign: H2 implementuje.

### 4-5. M14 L-05 + M15 L-05 — Feed-forward / sync-from-M20 → **DP-6 PREVIEW** ✅ *(rozstrzygnięte wcześniej)*
- Pliki: `ExecutionHub.tsx:945`; `table-platform.routes.ts:3413`
- **DECYZJA: DP-6 preview** — przyciski sync ukryte + komunikat „preview", ZERO fałszywego `success:true`. Realny odbiór = backlog v1.1. Jedna decyzja, trzy teczki (M14/M15/M20).
- Wykonawca: **Harvard 4** (M14/M15) — flip do statusu PODGLĄD-DP6.

### 6. M17 L-01 — Publish-approval → **SERVER GUARD 403** ✅
- Plik: `OutputsAggregateTabContent.tsx:1000-1004` + endpoint eksportu
- **DECYZJA PIOTRA: A** — serwerowa walidacja: **403 gdy validationState ≠ approved** przy bezpośrednim API. Zamyka obejście. Pełna polityka approval-workflow → v1.1.
- Wykonawca: **Harvard 5**. Test: bezpośredni API bez approved → 403.

### 7. M18 L-04 — Mode3 → **WŁĄCZ LLM** ✅
- Plik: `documentStudioService`
- **DECYZJA PIOTRA: A** — Mode3 generuje realną treść z szablonu przez LLM (jak Mode1). `useLlm:false` → `useLlm:true` w Mode3.
- Wykonawca: **Harvard 5**. Test: Mode3 zwraca treść, nie placeholder.

### 8. M20 L-05 — Governed sync → **DP-6 PREVIEW** ✅ *(rozstrzygnięte wcześniej)*
- Plik: `ModuleSyncService.ts:57-110,90`
- **DECYZJA: DP-6 preview** (wspólne z #4-5). Flip → PODGLĄD-DP6 (realny odbiór = backlog v1.1).
- Wykonawca: **Harvard 5**.

---

## M26 Portal Partnerski — decyzje do rozstrzygnięcia (Harvard 1, 2026-06-17)

### 9. M26 L-10 (D-01) — 5+ stubów Client Management → **rekom: DP-5 (ukryj za flagą + „wkrótce")** 🟡 czeka na potwierdzenie
- Pliki: `partners.routes.ts:1354/1367/1420/1437/1454/1903/2195` — dziś `FEATURE_NOT_AVAILABLE` 503; FE chowa akcje na `code==='FEATURE_NOT_AVAILABLE'`.
- **Opcje:** A (rekom) DP-5: zostaw honest-stub 503, ukryj wejścia FE za flagą `PARTNER_CLIENT_MGMT_ENABLED` (OFF) + label „wkrótce" (koszt ~0). B: zbuduj pełny Client Management (duży zakres, poza v1). C: usuń z UI (ryzyko niespójności z materiałami sprzedażowymi).
- **Rekomendacja CTO: A** — honest-stub już wdrożony i poprawny; brakuje tylko flagi+labelu. Budowę (B) → backlog v1.1 z decyzją produktową o zakresie.

### 10. M26 L-09 (D-02) — `PARTNER_SELF_CONNECT_ENABLED` na prod → **rekom: OFF w v1** 🟡 czeka na potwierdzenie
- Flaga default false; `/connection` już reflektuje flagę → FE chowa „Connect" gdy OFF.
- **Opcje:** A (rekom) OFF: partnerzy zakładani ręcznie (SuperAdmin/sprzedaż), zero niezweryfikowanych org/abuse, kontrola jakości; portal w pełni działa dla już-połączonych. B: ON (self-connect) — wymaga moderacji/akceptacji/anty-abuse/KYC partnera, przedwczesne dla Alpha.
- **Rekomendacja CTO: A (OFF) w v1** — self-connect bez warstwy moderacji to ryzyko jakości/abuse; włączyć w v1.1 z procesem akceptacji. Decyzja flagowa (env), odwracalna.

### 11. M26 L-06 (D-03) — resource shared-catalog → **ROZSTRZYGNIĘTE: zostaw shared + audit** ✅
- **DECYZJA CTO (techniczna):** `partner_resources` to wspólny toolkit; SELECT bez `partner_org_id` zamierzony, dostęp bramkuje `requirePartnerOrgId`+`min_partner_tier`, pobranie audytowane z `partner_org_id`+`user_id`. Udokumentowane w kodzie. Per-tier ograniczenie katalogu → opcjonalny backlog.

---

## M22 AI OS — decyzja do rozstrzygnięcia (Harvard 3, 2026-06-17)

### 12. M22 L-05 (D-02) — Wave 7 OAuth symulowany → **rekom: B (trwały label „Manual/Simulated")** ✅ ROZSTRZYGNIĘTE 07-19 — label martwy, usunięty
- Plik: `server/src/routes/wave7-connectors.routes.ts:52-113` (register/patch connector)
- **Stan obecny:** „połączenie" konektora to ręczny zapis DB — `POST /api/ai-connectors` przyjmuje `status:'connected'`, `externalConnectorId`, `tokenExpiresAt` wprost z body. **Brak realnego flow OAuth** (zero redirect do providera, zero wymiany code→token, zero refresh). Admin DBR77 wpisuje stan połączenia ręcznie. Moduł internal (DBR77-only), nie kliencki.
- **Opcje:**
  - **A — realny OAuth provider flow:** redirect do providera (Google/MS/Slack…), callback `code→token`, szyfrowane przechowywanie tokenów + refresh. Duży zakres (per-provider app registration, secret mgmt, token vault, refresh scheduler). Wartość dla modułu internal: niska (zespół DBR77 i tak zarządza ręcznie).
  - **B (rekom) — trwały label „Manual/Simulated":** zostaw ręczny model jako świadomą, JAWNĄ decyzję; dodaj w panelu Wave 7 widoczny badge/label „Manual connection (no live OAuth)" żeby nie udawać realnego OAuth. Koszt ~0, honest-UX, spójne z DP-11/DP-5 (honest-stub zamiast półbudowy).
  - **C — usuń sekcję konektorów z v1:** redukuje powierzchnię, ale traci ręczny rejestr konektorów którego zespół używa.
- **Rekomendacja CTO: B** — moduł jest internal/DBR77-only; realny OAuth (A) to duży nakład bez odbiorcy w v1. Jawny label „Manual/Simulated" usuwa deception (jedyny realny problem L-05) przy zerowym koszcie; realny provider-flow → backlog v1.1 gdy pojawi się klient zewnętrzny. **Warunek domknięcia L-05:** dodać label w `Wave7ConnectorAdminPanel.tsx` (strefa H3) — zrobię po decyzji.
- **DECYZJA PIOTRA (07-19): usuń — wave7 label martwy.** Ani A, ani B, ani C — Piotr zamknął temat jako niepotrzebny; nie dodawać labela do `Wave7ConnectorAdminPanel.tsx`. Funkcjonalny kod Wave 7 Connectors pozostaje bez zmian — decyzja dotyczy wyłącznie etykiety UX.
