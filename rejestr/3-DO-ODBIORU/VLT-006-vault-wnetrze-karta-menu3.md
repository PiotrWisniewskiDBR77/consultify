---
id: VLT-006
tytul: Wnętrze sejfu — karta w menu dynamicznym (Menu 3), wzór Agent Hub
typ: zadanie
waga: srednia
obszar: vault
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr, 2026-07-24 (uwaga do odbioru triady: po wejściu ma się otwierać karta w menu dynamicznym) + scalenie Mastera 2026-07-26"
utworzone: 2026-07-26
---

# VLT-006 — Wnętrze sejfu: karta w Menu 3

## 1. PROBLEM

Po otwarciu sejfu wnętrze zajmuje cały widok, ale w menu dynamicznym (Menu 3)
nie pojawia się karta otwartego sejfu — nie widać „co mam otwarte" i nie da
się zamknąć przez × tak, jak w Run agent. Cytat Piotra (2026-07-24): „Po
wejściu powinna się otwierać karta w menu dynamicznym".

## 2. PRZYCZYNA

Przy scaleniu `fix/triada-agent-sejfy` + `feat/sejf-redesign` (2026-07-26,
merge `1992061ad7`) wygrał pełnoekranowy `VaultDocumentsView` (redesign), a
mechanizm karty Menu 3 z triady (`openItems` na `StandardModuleBar`) był
zaimplementowany tylko we wrapperze, który przy otwartym sejfie w ogóle się
nie renderuje (`ClientDocumentsVault.tsx` — early return). Zapowiedziane w
komentarzu „SCALENIE 2026-07-26" tamże.

## 3. ROZWIĄZANIE

Dodać obsługę karty Menu 3 bezpośrednio w `VaultDocumentsView` (własny
StandardModuleBar): otwarty sejf = aktywna karta, × = powrót do tabeli sejfów.
Wzór 1:1: `AgentHubShell.tsx`. Bez zmian w komponentach wspólnych.

## 4. KRYTERIUM ODBIORU

Piotr otwiera sejf z tabeli → w pasku menu widzi kartę z nazwą sejfu (jak
karty procesów w Run agent) → klika × na karcie → wraca do tabeli sejfów.

## 5. DOWODY

- Gałąź `fix/vault-wnetrze-karta-menu3`, commit `5daa858d99` — scalona i
  wdrożona na demo (push `252159f6ec`, 2026-07-26).
- Mechanizm 1:1 z AgentHubShell: `openItems`/`activeItemId`/`onSelectItem`/
  `onCloseItem`/`onShowList` na własnym StandardModuleBar
  (`VaultDocumentsView.tsx:506-507` — jedna zawsze-aktywna karta
  `{type:'tool', subType:'vault-safe'}`); × karty i „Lista" wołają `onBack`.
  Zero zmian w plikach wspólnych.
- Render-verify wykonawcy (port 3420, light+dark): karta „vault-safe ·
  Transformacja DBR77" widoczna w Menu 3, × i „List" klikane bez błędów.
  Master widział ten render na własne oczy (zrzut w sesji).
- Bramki: esbuild OK, eslint 0 błędów (sprawdzone też niezależnie przez
  Mastera), check-list-canon ✓ (414→414).
- Efekt uboczny zgłoszony uczciwie: chipy statusu indeksowania niewidoczne
  przy aktywnej karcie (tryby wyłączne w `ModuleNavBar.tsx:289`) → osobna
  decyzja VLT-007 (rekomendacja: filtr statusu do Menu 2).

## 6. DZIENNIK

- 2026-07-26 — Master: zadanie utworzone przy rozwiązywaniu konfliktu scalenia
  (decyzja integracyjna: redesign wygrywa, karta dorabiana osobno); wykonawca
  (Sonnet) uruchomiony na gałęzi `fix/vault-wnetrze-karta-menu3` (baza
  origin/demo `1992061ad7`), stan → w-toku.

**2026-07-26 — wykonawca (Sonnet):** karta Menu 3 dopięta wg wzoru, wątpliwość
(chipy vs karta) zgłoszona i zarejestrowana jako VLT-007. Master zweryfikował
eslint/render samodzielnie, scalił i wdrożył na demo `252159f6ec`. Stan →
do-odbioru.
