# RAPORT REALIZACJI — per moduł (po rundzie napraw P0/P1)
**Data:** 2026-06-18 (wieczór) | **Branch:** Londyn (czyste, wypchnięte) | **Dwa tory:** Funkcja · Grafika

> Zmiana od poprzedniego raportu: **wszystkie blokery P0/P1 wizualne domknięte** + M10 STT rozwiązane kodem (Gemini, klucz Teresy). Funkcja 250/251. Zostają: deploy na staging (blokada uploadu Railway) + backlog v1.1 (kosmetyka P2/P3, audyt M09/M27).

---

## 1. CO ZMIENIŁO SIĘ W TEJ RUNDZIE
- 🔴→✅ **M03 Inbox crash (VIS-013)** — zweryfikowane: 0 crashy (był naprawiony `8bf85a6679`).
- 🟡→✅ **SYS-1** selekcja crimson→neutral/blue (nav, settings cards, MyWork, exec/initiatives).
- 🟡→✅ **SYS-3** StatusPill danger-fill w light (centralnie, ~34 callerów).
- 🟡→✅ **M19/M20** scope-bug Recent=Saved (allowlist stanów, test 2/2).
- 🟡→✅ **M21** Meeting fetch (honest error+retry, test 5/5).
- 🟡→✅ **M18** owner UUID→nazwa (+ M17 Outputs hub).
- 🟡→✅ **i18n-mix** M16/M18/M25/M26 (0 braków kluczy).
- 🔑→✅(kod) **M10 STT** — fallback Gemini, używa `GEMINI_API_KEY` (Teresy); test 2/2. Zostaje deploy.
- ✅ **M27 feedback** zweryfikowane na żywo (pulse 401, nie 500).

---

## 2. ZESTAWIENIE PER MODUŁ

Funkcja = luki. Grafika: 🟢 czyste/drobne · 🟡 deploy/audyt-pending · ⬜ nieaudytowany.

| # | Moduł | Funkcja | Grafika | Pozostało | Gotowość |
|---|-------|---------|---------|-----------|----------|
| M01 | Czat | 100% | 🟢 | i18n de/es/jp/ar (v1.1) | **96%** |
| M02 | Canvas | 100% | 🟢 | — | **96%** |
| M03 | Moja Praca | 100% | 🟢 | (P0 crash + SYS-1/3 ✅) | **95%** |
| M04 | Notatnik | 100% | 🟢 | — | **94%** |
| M05 | Ideas — Zarządzanie | 100% | 🟢 | — | **95%** |
| M06 | Ideas — Mind Map | 100% | 🟢 | — | **95%** |
| M07 | Ideas — Process Flow | 100% | 🟢 | — | **95%** |
| M08 | Ideas — Table | 100% | 🟢 | — | **95%** |
| M09 | Ideas — Whiteboard | 100% | ⬜ | audyt wizualny + shared-write v1.1 | **88%** |
| M10 | Wywiad | 99%* | 🟢 | *kod ✅ (Gemini STT), czeka deploy+live-verify | **92%** |
| M12 | Audyty | 100% | 🟢 | §27 listy assessment (v1.1) | **95%** |
| M13 | Inicjatywy | 100% | 🟢 | — | **95%** |
| M14 | Wdrożenie | 100% | 🟢 | — | **95%** |
| M15 | Rezultaty | 100% | 🟢 | — | **95%** |
| M16 | Finanse | 100% | 🟢 | (i18n-mix ✅) | **95%** |
| M17 | Outputs | 100% | 🟢 | (owner-name ✅) | **96%** |
| M18 | Dokumenty | 100% | 🟢 | cold-start proof (deploy-pending) | **93%** |
| M19 | Prezentacje | 100% | 🟢 | (scope ✅) | **95%** |
| M20 | Tabele Studio | 100% | 🟢 | (scope ✅) | **95%** |
| M21 | Meeting | 100% | 🟢 | (fetch ✅) | **95%** |
| M22 | AI OS | 100% | 🟢 | — | **95%** |
| M23 | Organizacja | 100% | 🟢 | — | **96%** |
| M24 | Admin | 100% | 🟢 | — | **95%** |
| M25 | Ustawienia | 100% | 🟢 | (i18n-mix ✅) | **95%** |
| M26 | Portal Partnerski | 100% | 🟢 | schema drift = known-gap | **94%** |
| M27 | SuperAdmin | 100% | ⬜ | audyt wizualny (wymaga konta) | **87%** |

**Średnia gotowość: ~94%** (funkcja 99,6% · grafika P0/P1 czyste, kosmetyka/audyt v1.1).

---

## 3. CO ZOSTAŁO (3 koszyki)

**A. Deploy-gated (kod gotowy, blokada = upload Railway):**
- Gemini STT live-verify (M10) + cold-start proof (M18) — czekają na deploy nowego builda na staging. `railway up` z tej maszyny pada (TLS/timeout); deploy przez dashboard Railway lub auto-deploy z GitHub.

**B. Na Piotrze:**
- Trigger deployu staging (dashboard) → potem live-verify M10/M18.
- Konto superadmina → audyt wizualny M27.
- Zgoda na deploy prod (centerbeam) → fix STT dla VTS (ten sam kod + `GEMINI_API_KEY` już na prodzie).

**C. Backlog v1.1 (po GA):**
- Kosmetyka P2/P3 (~40 drobiazgów), §27 listy (M12/M26/M27), M09 shared-write + audyt wizualny, i18n de/es/jp/ar.

---

*Dowody: commity `f0a3ccee6e` (M03/VIS-013), `0c5c4a6488`+`081f38396a` (SYS-1), `9f26e682ab` (SYS-3), `ba9837e68a` (M19/M20), `c93ea09f30` (M21), `c549efe515`+`37fea8e0da` (M18/M17 owner), `50a6307391` (i18n-mix), `9cdb40787d` (M10 Gemini STT). Funkcja: 250/251.*
