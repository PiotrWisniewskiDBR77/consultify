---
id: AGT-002
tytul: Rynek: generatory potoków
typ: analiza
waga: srednia
obszar: AGT
stan: do-odbioru
wlasciciel: piotr
blokuje: [AGT-003]
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: B3
utworzone: 2026-07-21
---

## 1. PROBLEM

Trzeba było wiedzieć, czy v1 ma być liniowy, jak rynek pokazuje wykonanie i błędy, i gdzie mamy przewagę.

## 2. PRZYCZYNA

Nie dotyczy — analiza rynkowa.

## 3. ROZWIĄZANIE

Przegląd Zapier / n8n / Make / Gumloop.

## 4. KRYTERIUM ODBIORU

**Dokument.** Zamknięte, gdy potwierdzisz, że rekomendacja „v1 liniowy" jest zgodna z Twoją decyzją DEC-002.

## 5. DOWODY

**Analiza rynkowa z wiedzy własnej — bez dowodu plik:linia (produkty zewnętrzne).**

**Zapier:** „Zap" = pionowa liniowa lista Trigger→Action. Rozgałęzienia („Paths") to **opcjonalny krok, nie domyślny**. Wykonanie: historia uruchomień, status per krok, „Replay" powtarza **cały** przebieg (nie wznawia w połowie).
**n8n:** canvas grafowy — rozgałęzienie natywne od początku; podgląd podświetla każdy węzeł ze statusem + JSON wejścia/wyjścia; wznowienie od awarii w Enterprise.
**Make:** canvas z modułami, jawny „Router"; **najbogatsza obsługa błędów per moduł** (Break/Ignore/Resume/Rollback jako jawne trasy).
**Gumloop:** canvas pod agentów AI, pokazuje koszt/tokeny per węzeł.

**Wzorzec uniwersalny u wszystkich czterech:** ślad per krok ze statusem **plus inspekcja dokładnego JSON wejścia/wyjścia** — nie samo „sukces/porażka".

**★ Realna przewaga konkurencyjna:** „zatrzymanie → poprawka → wznowienie w tym samym przebiegu" to funkcja, której **żaden z czterech nie robi dobrze natywnie**. A my mamy już sprawdzony wzorzec tego mechanizmu we własnym kodzie: obieg zatwierdzania wywiadu (submit → bramka AI → approve/send-back → popraw → resubmit), zweryfikowany end-to-end w WYW-001.

**Rekomendacja: v1 liniowy** — zgodne z decyzją DEC-002 i z Zapierem (najpopularniejszym, celowo liniowym). Rozgałęzienia jako **typ bloczka dodawany później**, nie wymagany od startu.

## 6. DZIENNIK

**2026-07-21** — zmigrowane ze źródła B3.
