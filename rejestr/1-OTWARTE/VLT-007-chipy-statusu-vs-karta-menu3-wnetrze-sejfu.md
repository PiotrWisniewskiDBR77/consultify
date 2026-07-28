---
id: VLT-007
tytul: Wnętrze sejfu — chipy statusu indeksowania niewidoczne, gdy karta Menu 3 aktywna
typ: decyzja
waga: niska
obszar: vault
stan: otwarte
wlasciciel: master
blokuje: []
zablokowane_przez: []
zrodlo: "Wykonawca VLT-006, 2026-07-26 (wątpliwość zgłoszona w raporcie, udokumentowana w kodzie)"
utworzone: 2026-07-26
---

# VLT-007 — Chipy statusu vs karta Menu 3 (decyzja)

## 1. PROBLEM

Po dodaniu karty sejfu do Menu 3 (VLT-006) chipy filtra statusu indeksowania
(Wszystkie/Zindeksowane/W trakcie/Błąd) przestają być widoczne, dopóki karta
jest na pasku — a we wnętrzu sejfu karta jest zawsze. Filtr działa w danych,
ale nie ma go czym klikać.

## 2. PRZYCZYNA

Wspólny `ModuleNavBar` traktuje chipy i dynamiczne taby jako tryby WYŁĄCZNE —
`DynamicTabs` bezwarunkowo zastępuje `commandRowContent`, gdy
`openDocuments.length > 0` (`src/components/shared/ModuleHub/ModuleNavBar.tsx:289`).
W Agent Hubie nie kolidowało (brak chipów), w Vault koliduje.

## 3. ROZWIĄZANIE

Warianty (od wykonawcy VLT-006): (a) zaakceptować jak jest; (b) przenieść
filtr statusu do Menu 2 obok selecta Kategorii (zmiana tylko w
`VaultDocumentsView`, zgodna z kanonem „Menu 2 = filtry") — REKOMENDOWANE;
(c) tryb łączony chipy+taby w `ModuleNavBar` (zmiana pliku wspólnego,
dotyka wszystkich hubów — wymaga osobnej zgody).

## 4. KRYTERIUM ODBIORU

Piotr w otwartym sejfie widzi jednocześnie kartę sejfu w Menu 3 ORAZ ma czym
filtrować po statusie indeksowania (miejsce wg wybranego wariantu).

## 5. DOWODY

(puste — czeka na decyzję wariantu)

## 6. DZIENNIK

- 2026-07-26 — Master: założone z wątpliwości wykonawcy VLT-006. Wariant do
  potwierdzenia przy odbiorze VLT-006 (rekomendacja: b).
