---
id: TAB-003
tytul: Statusy w tabelach po angielsku przy polskim UI (EntityStatusChip humanizuje bez i18n)
typ: blad
waga: srednia
obszar: tabele
stan: otwarte
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Master, 2026-07-26, render-verify Agent Huba (statusy Planning/Executing przy lang=pl)"
utworzone: 2026-07-26
---

# TAB-003 — Statusy tabel po angielsku (EntityStatusChip)

## 1. PROBLEM

W polskim interfejsie kolumna Status w tabelach pokazuje angielskie etykiety
(„Planning", „Awaiting approval", „Failed"), choć reszta ekranu jest po
polsku. Dotyczy potencjalnie WSZYSTKICH tabel, nie jednego ekranu.

## 2. PRZYCZYNA

`src/components/ui/primitives/chips/EntityStatusChip.tsx` — kanoniczny most
status→pigułka (TABLE_AND_PREVIEW_CANON.md §4.1) „humanizuje" surowy status
mechanicznie (underscore→spacja, wielka litera — funkcja `humanize`), bez
tłumaczenia. Komponent MA prop `label` (override), ale wielu callerów go nie
przekazuje. Przykład potwierdzony: `AgentHubShell.tsx` kolumna Status
(`<EntityStatusChip status={plan.status} />`), podczas gdy preview tego samego
ekranu używa przetłumaczonej `planStatusLabel` — stąd mieszany język.

## 3. ROZWIĄZANIE

Wariant rekomendowany: centralny słownik i18n w samym `EntityStatusChip`
(klucze `status.<normalized>` w translation.json, fallback = dzisiejsza
humanizacja) — jedna zmiana naprawia wszystkie tabele i nie wymaga ruszania
callerów. Wariant ostrożny: inwentarz callerów i per-caller `label`.
Decyzja wariantu = pierwsza czynność wykonawcy, z dowodem liczby callerów.

## 4. KRYTERIUM ODBIORU

Piotr przełącza UI na polski i otwiera 3 różne tabele (np. Run agent,
Zadania, Assessment) — wszystkie statusy w pigułkach są po polsku; po
przełączeniu na angielski — po angielsku.

## 5. DOWODY

(puste — do wykonania)

## 6. DZIENNIK

- 2026-07-26 — Master: znalezisko z render-verify po scaleniu triady
  (Agent Hub, lang=pl, statusy EN). Doraźnie naprawiony JEDEN caller
  (AgentHubShell, w ramach fali AGT-013). Reszta callerów = to zadanie.
