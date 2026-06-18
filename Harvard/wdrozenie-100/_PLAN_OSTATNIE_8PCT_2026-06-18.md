# PLAN — ostatnie 8% (do 100% cutover-ready)
**Data:** 2026-06-18 | **Branch:** Londyn | **Podstawa:** `_RAPORT_STANU_2026-06-18.md` (weryfikacja twarda) | **Cel:** zamknąć blokery produkcyjne, nie tylko licznik luk

> „8%" = luka między ~92% funkcjonalnym a 100% cutover-ready. Nie jest to „więcej luk" — to **4 blokery P0/P1 udające zamknięcie** + dokończenie i18n/jakości + cutover-prep. Plan posekwencjonowany: P0 (blokery prod) → P1 (kompletność) → P2 (jakość) → cutover.

---

## ROZBICIE 8% NA KONKRET (ile każda rzecz „waży")

| # | Pozycja | Waga | Klasa |
|---|---------|------|-------|
| 1 | M18 trwałość (in-memory → PG) | ~2% | 🔴 P0 prod |
| 2 | Dług testów (pozorne asercje + suity poza CI) | ~2% | 🔴 P0 jakość |
| 3 | Git integrity (433 uncommitted + 23 unpushed + tsc) | ~1% | 🔴 P0 build |
| 4 | M09 decyzja + realizacja (realtime vs shared-write) | ~1% | 🟡 P1 |
| 5 | i18n M13 (stash) + reports/documents | ~1% | 🟡 P1 |
| 6 | Pozostałe otwarte luki (M01/M02/M10/M12/M17/M21/M26/M27) | ~0,5% | 🟡 P1 |
| 7 | Tokeny (662 rose) + §27 (154 tabele) | ~0,5% | 🟢 P2 |
| 8 | Cutover-prep (schema verify, smoke, push, checklist) | gate | 🟦 Faza 5 |

---

## FAZA A — BLOKERY P0 (muszą paść PRZED czymkolwiek na prod)

### A1 · M18 trwałość → Postgres  *(właściciel: Harvard 4)*
- **Problem:** 8 serwisów DocumentStudio trzyma stan w module-level `Map`; PG DAO z gotowym SQL istnieją, ale 0 call-sites.
- **Robota:** podłącz `documentEditorStateRegistryDao` + pozostałe RegistryDao do serwisów (`documentLifecycleService.ts:122-151`, `documentStudioService.ts:157-174`, comments/template/approval/version/source-pack/brand-voice/share-link/audience). Swap mechaniczny (DAO gotowe).
- **Bramka:** cold-start proof na staging — utwórz dokument → restart procesu → dane są. Flip M18 L-01 ZAMKNIĘTA (R6).

### A2 · Dług testów  *(właściciel: Harvard 5)*
- **A2a:** skonwertuj 179 pozornych asercji `expect([200,...,500,503]).toContain(status)` → konkretne statusy (88 plików `tests/integration`; najgorsze: `aiLayersIntegration`, `storage_security`, `initiatives`, `llmHealth`).
- **A2b:** wepnij `server/src/**/__tests__` (431, w tym `presentationStudio.routes.test.ts`) + `src/**/__tests__` (149) do CI — nowy job w `test-suite.yml` (server vitest runner).
- **Bramka:** CI zielone z REALNYMI asercjami; raport ile testów było pozornych przed/po.

### A3 · Git integrity  *(właściciel: koordynator + Harvard 3)*
- Przejrzyj 433 zmodyfikowane pliki: rozdziel sweepy (tokeny/i18n/dark-mode) na sensowne commity per obszar; odrzuć śmieci; **NIGDY `git add -A`**.
- `tsc --noEmit` (client + server) clean — zero nowych błędów przy 433 zmianach.
- Wypchnij 23 commity na origin/Londyn (po `tsc` + smoke).
- **Bramka:** drzewo czyste, `tsc` clean, origin/Londyn = HEAD.

> **A3 jest warunkiem wstępnym dla deployów** — bez czystego drzewa nie wiadomo co testujemy/wdrażamy.

---

## FAZA B — KOMPLETNOŚĆ P1

### B1 · M09 — DECYZJA PIOTRA, potem realizacja  *(Harvard 1)*
- Decyzja: (a) realtime-collab = wystarcza na v1 → flip L-01/L-02/L-04/L-06 z adnotacją „shared-write v1.1"; albo (b) dorób współdzielony trwały zapis (`my-work.routes.ts:3784` per-user → per-resource).
- Rekomendacja CTO: jeśli klienci nie używają wieloosobowej edycji TERAZ → (a); shared-write to realna robota architektoniczna.

### B2 · i18n do 100%  *(Harvard 2 — owner locales)*
- Dokończ M13 ze `stash@{0}` (26 plików, klucze z keys_initiatives*.json + git HEAD).
- Domerguj reports (M17) + documents (M18) + pozostałe patche. Flip dossiers i18n: M01 L-10, M02 L-11, M12 L-07, M17 L-09, M21 L-06.
- **Bramka:** 0 gołych kluczy (jest), + PL realnie wyświetlane w preview (nie EN fallback) dla M13/M17/M18.

### B3 · Pozostałe otwarte luki  *(rozproszone wg stref)*
- M02 L-10, M26 L-08 (schema drift — known-gap doc, NIE migruj prod), M27 L-10 (feedback live-verify po deploy).
- M10 L-01: **Piotr ustawia OPENAI_API_KEY** → Harvard 4 odpala gotowy E2E test → flip.

### B4 · Test CSV/formula-injection  *(Harvard 5)*
- Realny test neutralizacji `=`/`+`/`@`/`=HYPERLINK` przy eksporcie tabel/arkuszy (obecny „formula" test dotyczy promptu, nie security).

---

## FAZA C — JAKOŚĆ / DoD (P2)

### C1 · Tokeny + §27  *(Harvard 3)*
- 662 plików `rose-` → tokeny danger/semantic; 154 surowe `<table>` → FilterableTable. Hex data-viz/brand → oznacz DP-8 (legalne) z listą.
- **Bramka:** rose w 0 plików (poza udokumentowanymi), raw tables 0 (poza adnotowanymi §27-exempt).

### C2 · Szczelność org-scope  *(Harvard 5)*
- `ai-settings.routes.ts:622` audit-log → wzorzec `isSuperAdmin || (userOrgId===orgId && admin)` (admin z obcej org nie przechodzi).

---

## FAZA D — CUTOVER-PREP (Faza 5, gate na Piotrze)

- `db:verify:schema:staging` → 0 drift (raport).
- Reconcyliacja 27 teczek §03 z kodem (flip committed-but-open → ZAMKNIĘTA z SHA; M18 L-01 po A1).
- Smoke staging: każdy moduł renderuje się na demo.consultify.ai (lista OK/ERR).
- Checklista cutover Londyn→prod (backup centerbeam, verify, smoke po) — **DO AKCEPTACJI Piotra, NIE wykonuj sam.**

---

## SEKWENCJA I ZALEŻNOŚCI

```
A3 (git clean) ─┬─→ FAZA B + C (równolegle) ─→ FAZA D (cutover-prep) ─→ [zgoda Piotra] ─→ cutover
A1 (M18 PG) ────┤
A2 (testy) ─────┘   (A1/A2/A3 równolegle, ale A3 warunkuje deploye)
B1 czeka na decyzję Piotra (M09).  B3/M10 czeka na klucz Piotra (STT).
```

## PRZYDZIAŁ 5 AGENTÓW (ostatnia runda)

| Agent | Faza A-D | Główne |
|-------|----------|--------|
| **Harvard 1** | B1 | M09 (po decyzji): flip realtime=v1 LUB shared-write |
| **Harvard 2** | B2 | i18n do 100% (M13 stash + merge + flip dossiers) |
| **Harvard 3** | A3 + C1 | git cleanup (z koordynatorem) + tokeny/§27 |
| **Harvard 4** | A1 + B3 | M18 PG persistence + cold-start + M10 STT test (po kluczu) |
| **Harvard 5** | A2 + B4 + C2 + D | dług testów + formula-injection + org-scope + cutover-prep |

**Na Piotrze:** (1) decyzja M09 (realtime=v1 czy shared-write), (2) `OPENAI_API_KEY` na centerbeam (M10), (3) zgoda na cutover po Fazie D.

**Definicja 100%:** wszystkie P0 padłe (M18 trwałe, testy realne, git czysty), i18n PL kompletne, tokeny/§27 domknięte, schema 0-drift, smoke staging zielony, checklista cutover gotowa do akceptacji.
