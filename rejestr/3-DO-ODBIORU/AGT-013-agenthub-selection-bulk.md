---
id: AGT-013
tytul: Agent Hub — checkbox zaznaczania i akcje zbiorcze w tabelach (kanon MUST #7/#13)
typ: zadanie
waga: srednia
obszar: agent
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Audyt kanonu triady (Master, 2026-07-26) — TOP luka #3"
utworzone: 2026-07-26
---

# AGT-013 — Agent Hub: selection + akcje zbiorcze

## 1. PROBLEM

W tabelach „Moje procesy" i „Szablony" nie da się zaznaczyć wielu pozycji ani
wykonać akcji zbiorczej (np. anulować kilku procesów naraz). Wszystkie ekrany
wzorcowe (Zadania, Decyzje, Assessment, Interview) mają checkbox po lewej.

## 2. PRZYCZYNA

`src/components/AIChat/AgentHubShell.tsx` — StandardTable bez propa
`selection`. Kanon `docs/ui-standards/TRIADA_KANON.md` MUST #7/#13 wymaga
checkboxa w każdej tabeli. Potwierdzone audytem kanonu 2026-07-26 (wzorzec
poprawny: `src/components/MyWork/MyTasksListContent.tsx`).

## 3. ROZWIĄZANIE

Wpiąć `selection` w obie tabele; „Moje procesy" → akcje zbiorcze anuluj/usuń
oparte o realne API (`src/services/api/agentPlan.api.ts`); „Szablony" — jeśli
brak sensownej akcji zbiorczej, świadome pominięcie z komentarzem w kodzie
(wzór: VaultSafesTable). Przyciski zbiorcze disabled bez zaznaczenia;
potwierdzenie przed destrukcją; zero crimson jako stanu UI.

## 4. KRYTERIUM ODBIORU

Piotr w My Work → Run agent zaznacza dwa procesy checkboxami → widzi pasek
akcji zbiorczych → „Anuluj zaznaczone" pyta o potwierdzenie i po nim oba
procesy zmieniają status. Bez zaznaczenia przyciski są nieaktywne.

## 5. DOWODY

- Gałąź `fix/agenthub-selection-bulk`, commity `f74df19d15` + `a7e678a1e3`
  (statusy PL) — scalone i wdrożone na demo (push `252159f6ec`, 2026-07-26).
- „Moje procesy": `selection` na StandardTable (`AgentHubShell.tsx:736`),
  pasek bulk na StandardModuleBar z akcją „Anuluj zaznaczone (N)" — licznik
  liczy tylko podzbiór anulowalny (planning/executing/awaiting_approval/
  paused); potwierdzenie przed anulowaniem; disabled+tooltip gdy brak
  anulowalnych.
- API: jedyny endpoint `cancelAgentPlan` (`agentPlan.api.ts:202-208`), wołany
  sekwencyjnie; „Usuń zaznaczone" ŚWIADOMIE pominięte — brak endpointu DELETE
  (przycisk byłby fasadą).
- „Szablony": selection świadomie NIE dodane (biblioteka statyczna, akcja
  per-wiersz) — uzasadnienie w komentarzu `AgentHubShell.tsx:~44-49`.
- Zmiana addytywna w wspólnym `StandardModuleBar.tsx` (StandardBulkAction:
  `disabled`/`title`) — sprawdzono 6 pozostałych konsumentów bulk, zero zmian
  zachowania.
- Znalezisko odbioru domknięte: kolumna Status po polsku
  (`label={planStatusLabel(...)}`, `AgentHubShell.tsx:566`) — reszta callerów
  EntityStatusChip → zadanie TAB-003.
- Render-verify wykonawcy: klikane end-to-end na mocku (checkbox → bulk →
  confirm-gate → realny cancel → refresh); render-verify Mastera: zrzut
  z scalonej całości — checkboxy + statusy PL na oba oczy. Bramki: esbuild 0
  err, eslint 0 err, check-list-canon ✓, check-triada ✓.

## 6. DZIENNIK

- 2026-07-26 — Master: zadanie utworzone z TOP-luki audytu kanonu; wykonawca
  (Sonnet) uruchomiony na gałęzi `fix/agenthub-selection-bulk` (baza
  origin/demo `1992061ad7`), stan → w-toku.

**2026-07-26 — wykonawca (Sonnet):** selection+bulk + poprawka statusów PL
(dopiska na wiadomość Mastera po znalezisku odbioru). Master zweryfikował
render scalonej całości samodzielnie, scalił i wdrożył na demo `252159f6ec`.
Stan → do-odbioru.
