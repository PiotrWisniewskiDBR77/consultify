# RAPORT STANU — weryfikacja twarda (evidence-based)
**Data:** 2026-06-18 | **Branch:** Londyn | **Metoda:** dowód w żywym kodzie > status w teczce | **Audyt:** koordynator + 3 subagenty (security / testy / funkcja+trwałość)

> Teza: surowy licznik luk (**240/251 = 95,6%**) **zawyża realną gotowość**. Weryfikacja w kodzie ujawnia warstwę „zamknięte-ale-nie-do-końca", lukę trwałości P0, dług testów i duży niezacommitowany obszar. Funkcjonalnie blisko, produkcyjnie — NIE jeszcze.

---

## 1. EXECUTIVE SUMMARY (jeden ekran)

| Wymiar | Status raportowany | Stan zweryfikowany | Werdykt |
|---|---|---|---|
| Luki (teczki) | 240/251 (95,6%) | licznik OK, ale ≥3 „zamknięte" sprzeczne z kodem | 🟡 zawyżony |
| Bezpieczeństwo | naprawione | **6/6 REALNE** (1 słaby punkt org-scope) | 🟢 mocne |
| i18n | dług Fazy 4 | **0 gołych kluczy w UI** (fallback EN + merge) | 🟢 bezpieczne |
| Trwałość M18 | „L-01 naprawiona, 12/12" | **FASADA in-memory — dane giną przy restarcie** | 🔴 P0 |
| M09 multiplayer | „pełny multiplayer v1" | realtime TAK, współdzielony zapis per-user | 🟡 częściowy |
| Testy | zielone | 431+149 poza CI; 179 pozornych asercji w CI | 🔴 dług |
| Tokeny/§27 | „sweep zrobiony" | **662 plików `rose-`, 154 surowe `<table>`** | 🟡 niedokończony |
| Build/Git | — | **433 pliki niezacommitowane, 23 commity niewypchnięte** | 🟡 ryzyko |

**Konkluzja:** rdzeń bezpieczeństwa i i18n-runtime są zdrowe. Ale **trzy rzeczy blokują uczciwe „100%/cutover"**: (1) M18 nietrwałe, (2) dług testów (fałszywe zielone w CI + całe suity poza CI), (3) ogromny niezacommitowany obszar do uporządkowania. „Pełny multiplayer M09" wg decyzji Piotra jest spełniony tylko jako realtime, nie jako współdzielona persystencja.

---

## 2. METRYKI TWARDE (zmierzone 2026-06-18)

- **Luki:** 240/251 zamknięte (95,6%). Otwarte (11): M01 L-10, M02 L-10/L-11, M09 L-01/L-02/L-04/L-06, M10 L-01, M12 L-07, M13 L-11a, M17 L-09, M21 L-06, M26 L-08, M27 L-10.
- **i18n:** **0** wywołań `t()` bez fallbacku z brakującym kluczem → zero gołych ścieżek w UI. ~7100 kluczy pokazuje EN fallback (dług PL, Faza 4). M22/`aios` (223 gołych) naprawione w tym audycie (commit `fix(i18n): merge 267 bare-key`).
- **Tokeny/§27:** `rose-` w **662** plikach, surowe `<table>` w **154** plikach, ~2964 literałów hex (część DP-8 legalna). Sweep NIEdokończony.
- **Git:** HEAD **23 commity przed** origin/Londyn (niewypchnięte); **433 zmodyfikowane pliki .tsx/.ts** niezacommitowane (settings 38, Admin 26, assessment 17, superadmin 15, MyWork 15, Interview 14, AIChat 13…); `stash@{0}` = WIP-M13-i18n nietknięty.
- **Testy:** tests/ = 3894 plików (≈73% unit, 11% integration, 10% component); server/src/__tests__ = 431 (CAŁOŚĆ poza CI).

---

## 3. FINDINGI PER WYMIAR

### 3.1 Bezpieczeństwo — 🟢 6/6 REALNE
Zweryfikowane w kodzie (nie w teczce):
1. M24 cross-org IDOR — `admin-data.routes.ts:42-53` router-level `requireRole`+`router.param('orgId')` 403. ✅
2. M24 ai-settings — org-scope na GET/PUT/tiers. ✅ **SŁABY PUNKT:** audit-log `ai-settings.routes.ts:622` logika `userRole!=='administrator' && userOrgId!==orgIdStr` przepuszcza administratora z INNEJ org. Do wyrównania.
3. M23 role-gate `/organization/*` — view-level `OrganizationView.tsx:197` (`!isOrgAdmin → Navigate`); realną granicą jest serwer. ✅
4. M23 SVG stored-XSS — `branding.routes.ts:92-101` DOMPurify (FORBID script/foreignObject/iframe/use), fail-closed. ✅
5. M27 superadmin gates — `llm.routes.ts` purposes/market/tiers `verifySuperAdmin`; `virtual-workers.routes.ts:21-22` `requireRole('super_admin')`. ✅
6. M25 account-delete — jedyna trasa `settings.routes.ts:2974` z `verifyUserPassword` (bcrypt); brak bezhasłowego duplikatu. ✅

### 3.2 i18n — 🟢 runtime bezpieczne, dług PL odroczony
- **0 gołych kluczy** w UI: swapy używają `t('klucz','English fallback')`, i18next `returnEmptyString:false` → pokazuje EN, nie ścieżkę. To zaplanowany stan Fazy 4.
- ~7100 kluczy bez PL (EN fallback) = dług kompletności, NIE regresja. M13 czeka w `stash@{0}` (komponenty na isPolish, działają PL/EN).
- **Korekta audytu:** wcześniejszy alarm „P0 regresja i18n / 2001 zepsutych kluczy" był BŁĘDNY — nie uwzględniał fallbacków. Stan jest zdrowy.

### 3.3 Trwałość / cold-start — 🔴 M18 FASADA (P0 udające zamknięte)
- **M18 DocumentStudio = w pełni in-memory.** Wszystkie serwisy domenowe trzymają stan w module-level `Map`: `documentLifecycleService.ts:122-151`, `documentStudioService.ts:157-174`, `documentCommentsService.ts:65-70`, +template/approval/version/source-pack/brand-voice/share-link/audience. **Dane giną przy restarcie procesu.**
- PG DAO z gotowym SQL (`documentEditorStateRegistryDao.ts:126` `INSERT…ON CONFLICT`) są napisane, ale **ZERO call-sites** w serwisach prod → kod trwały istnieje, lecz niepodłączony.
- **Sprzeczność:** teczka M18 = 12/12 ✓, L-01 „NAPRAWIONA mig.780/781". Migracje istnieją, ale serwisy ich nie używają. **L-01 realnie OTWARTA.**
- ✅ Table Platform (`RecordsService.ts:30` PG) i Presentation Studio (`presentation_decks`) — TRWAŁE.

### 3.4 M09 Whiteboard — 🟡 realtime TAK, współdzielona persystencja NIE
- Live-collab DZIAŁA org-scope: graph_patch broadcast (`ideaCollabWs.gateway.ts:373-397`), FE send/recv (`useWhiteboardCollab.ts`), 2. uczestnik READ 200 (`my-work.routes.ts:3588`). Facilitation/role/voting serwerowo-trwałe (PG, `realtimePlatformService.ts`). L-04 NIE jest FE-only.
- **ALE WRITE per-user:** `my-work.routes.ts:3784-3787` `WHERE user_id=?` — zmiany 2. uczestnika żyją tylko w sesji WS; po reloadzie czyta snapshot właściciela. Full shared-write oznaczony jako v1.1.
- **vs decyzja Piotra „pełny multiplayer w v1":** spełnione jako realtime collaboration, NIEspełnione jako współdzielony trwały zapis. Wymaga decyzji: czy realtime wystarcza na v1, czy dorabiamy shared-write.

### 3.5 Testy — 🔴 dwa P0 + jedna luka
1. **[P0] Całe suity poza CI:** `server/src/**/__tests__` = 431 plików (w tym `presentationStudio.routes.test.ts` 71 testów RBAC) NIGDY nie odpalają się w CI; +149 `src/**/__tests__` (prócz MyWork). CI odpala tylko `tests/unit|integration|components`.
2. **[P0] 179 pozornych asercji w CI:** wzorzec `expect([200,...,403,404,500,503]).toContain(status)` przechodzi przy KAŻDEJ odpowiedzi (maskuje IDOR/500) — w 88 plikach `tests/integration`, które REALNIE są w CI. Fałszywe zielone w gałęzi krytycznej.
3. **[P1] Brak realnego testu CSV/formula-injection:** test „formula injection" (M13) dotyczy wstrzykiwania doktryny do promptu, NIE neutralizacji `=`/`@`/`=HYPERLINK` przy eksporcie.
4. ✅ 4/5 P0-fixów (IDOR, superadmin, competency, M09-multiplayer) mają REALNE testy regresji z konkretnymi asercjami.
- CI **obejmuje branch Londyn** (`test-suite.yml:3-7`) — to akurat OK.

### 3.6 Tokeny / §27 / standard — 🟡 niedokończone
- `rose-` w 662 plikach, surowe `<table>` w 154 — kryterium 4 (tokeny) i 5 (§27) z DoD NIE są na 100%. Sweepy ruszyły (commity rose→danger), ale residual duży. Część hex = DP-8 legalne (data-viz/brand), ale 662 rose i 154 tabele to realna robota.

### 3.7 Build / Git integrity — 🟡 ryzyko
- **433 zmodyfikowane pliki niezacommitowane** — duży obszar pracy agentów (sweepy tokeny/i18n/dark-mode) wisi w drzewie. Ryzyko utraty + niejasne co przetestowane.
- **23 commity przed origin/Londyn** (niewypchnięte) — staging/CI ich nie widzi.
- `tsc --noEmit` NIE uruchomiony w tym audycie (zbyt wolny) — build-integrity niezweryfikowany przy 433 uncommitted.

---

## 4. SPRZECZNOŚCI TECZKA ↔ KOD (zamknięte-ale-nie-do-końca)

| Teczka mówi | Kod pokazuje | Akcja |
|---|---|---|
| M18 12/12, L-01 naprawiona | in-memory fasada, dane giną przy restarcie | otwórz L-01, podłącz PG DAO |
| M09 multiplayer (decyzja: pełny v1) | realtime tak, write per-user | decyzja: realtime=v1 czy shared-write |
| Tokeny/§27 „sweep zrobiony" w kilku teczkach | 662 rose + 154 raw tables | dokończ sweep lub oznacz residual |

---

## 5. REALNA GOTOWOŚĆ DO 100% / CUTOVER

**Funkcjonalnie:** ~92% — większość ścieżek działa, i18n runtime bezpieczne, security mocne.
**Produkcyjnie (cutover-ready):** NIE — blokery:
1. 🔴 M18 trwałość (in-memory → utrata danych klienta).
2. 🔴 Dług testów (fałszywe zielone w CI + 580 testów poza CI = brak realnej bramki regresji).
3. 🟡 433 uncommitted + 23 unpushed — uporządkować i wypchnąć przed jakimkolwiek deploy.
4. 🟡 Decyzja M09 (realtime vs shared-write na v1).

---

## 6. REKOMENDACJE PRIORYTETOWE

| Prio | Zadanie | Dlaczego |
|---|---|---|
| P0 | M18: podłączyć PG DAO (kod gotowy) zamiast Map; cold-start proof staging | utrata danych = blokер prod |
| P0 | Testy: skonwertować 179 pozornych asercji na konkretne statusy; wpiąć server/src/__tests__ do CI | fałszywe zielone maskują regresje |
| P0 | Git: przejrzeć i scommitować/odrzucić 433 pliki; wypchnąć 23 commity; `tsc` clean | integralność build + brak utraty |
| P1 | Decyzja M09 (realtime=v1 vs dorobić shared-write) | zgodność z decyzją produktową |
| P1 | Dokończyć M13 i18n (stash) + reports/documents | dług PL → 100% i18n |
| P1 | Test CSV/formula-injection (realny security) | eksport arkuszy/tabel |
| P2 | Dokończyć tokeny (662 rose) + §27 (154 tabele) lub oznaczyć residual DP-8 | kryt. 4/5 DoD |
| P2 | Wyrównać org-scope `ai-settings.routes.ts:622` | szczelność audit-log |

---

*Dowody: `admin-data.routes.ts:42-53`, `ai-settings.routes.ts:622`, `branding.routes.ts:92-101`, `llm.routes.ts` (verifySuperAdmin), `settings.routes.ts:2974`, `documentLifecycleService.ts:122-151`, `documentEditorStateRegistryDao.ts:126` (martwy PG), `my-work.routes.ts:3588/3784`, `ideaCollabWs.gateway.ts:373-397`, `test-suite.yml:3-7/314-369`, `tests/integration/aiLayersIntegration.test.js:85`. Subagenty: security 6/6, testy (CI+vacuous), funkcja+trwałość.*
