---
id: VLT-008
tytul: Client Vault — jeden pasek huba zamiast własnych (6 rzędów chrome → 0)
typ: zadanie
waga: wysoka
obszar: vault
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr, 2026-07-27: „Tak samo je trzeba posprzątać w tą, gdzie mamy Client Vault\""
utworzone: 2026-07-27
---

# VLT-008 — Client Vault: jeden pasek na ekran

## 1. PROBLEM

Sejf miał najgorszy wynik w całej aplikacji: **do 320 px** chrome nad obszarem
roboczym (6 rzędów), bo wnętrze sejfu rysowało własne Menu 1 (breadcrumb +
kebab), Menu 2 (lupa + filtr Kategoria + „Dodaj dokument") i Menu 3 (karta
sejfu) WEWNĄTRZ huba, który już ma swój komplet.

## 2. PRZYCZYNA

Ta sama co w Run agent (AGT-015): Client Vault to dawny samodzielny moduł
przeniesiony do My Work (VLT-004) razem z własnym `StandardModuleBar`.

## 3. ROZWIĄZANIE

Migracja na mechanizm `HubBarSlots` (wzór 1:1 z `AgentHubShell`): oba ekrany
(`ClientDocumentsVault` = lista sejfów, `VaultDocumentsView` = wnętrze)
deklarują swoje elementy przez `useHubBarSlot`, hub renderuje jedyne Menu 2/3.

## 4. KRYTERIUM ODBIORU

Piotr wchodzi w My Work → Client Vault → otwiera sejf: (a) nie ma podwójnego
nagłówka ani osobnych pasków sejfu; (b) filtry statusu dokumentów
(Wszystkie/Zindeksowane/W trakcie/Błąd) SĄ WIDOCZNE (dotąd zasłaniała je karta
sejfu — patrz VLT-007); (c) „Dodaj dokument" i filtr Kategorii działają;
(d) powrót do listy sejfów przez × na karcie w menu dynamicznym.

## 5. DOWODY

- Gałąź `fix/vault-jeden-pasek`, commit `f51011fca9`, wdrożona na demo
  (`c293d6c367`, 2026-07-27, health ok / strona 200). Punkt cofnięcia:
  `fa5fe13a06`.
- `VaultDocumentsView.tsx`: usunięty `<StandardModuleBar>` (3 rzędy naraz),
  dodany `useHubBarSlot` (~571-670); kebab (Odśwież / Eksportuj CSV)
  przeniesiony do `filterControls`, żeby nie zgubić funkcji; `bulk`
  renderowany lokalnie nad tabelą (kontrakt slotu nie ma pola bulk).
- `ClientDocumentsVault.tsx`: usunięty własny pasek, `useHubBarSlot` z
  `resyncTick` przy powrocie z sejfu (żeby lista odzyskała swój filtr).
- ★ VLT-007 rozwiązany przy okazji (wariant b) — chipy statusu w Menu 2,
  karta sejfu w Menu 3 = dwa różne rzędy, koniec wykluczania
  (`ModuleNavBar.tsx:289`).
- Bramki: esbuild oba pliki czyste, eslint 0 błędów (po `--fix` prettier),
  check-list-canon ✓, check-triada ✓, check-artefakt/gestosc ✓.
  Twarda weryfikacja diffu przed pushem: dokładnie 2 pliki.
- ★ OGRANICZENIE: scalony pasek NIE zweryfikowany wzrokiem (brak harnessu
  montującego MyWorkHub; harness `vault-sejf-wnetrze` montuje komponent
  samodzielnie → sloty są no-opem). Wdrożone na wyraźne polecenie Piotra
  („wdrażaj po prostu, daj mi do testowania").

## 6. DZIENNIK

- 2026-07-27 — wykonawca (Sonnet) zmigrował oba ekrany Vault; Master doscalił
  dryf demo, zweryfikował bramki i diff, wdrożył. Stan → do-odbioru.
- ★ DŁUG ŚWIADOMY: (a) lupa/wyszukiwarka obu ekranów jako zwykły input w
  `filterControls` (kontrakt `HubBarSlotValue` nie ma pola search) — działa,
  ale mieszka gdzie indziej niż lupa huba; (b) chipy usuwania pojedynczego
  tagu (`activeFilters`) usunięte — czyszczenie tagów zostaje przez lejek
  kolumny; (c) zniknął wiersz breadcrumb „Sejf klienta › nazwa" — powrót przez
  × na karcie Menu 3 (do potwierdzenia z Piotrem, czy tego chciał).
