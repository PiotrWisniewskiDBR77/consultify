---
id: WYW-001
tytul: Przejście obiegu zatwierdzania wywiadu od początku do końca
typ: analiza
waga: wysoka
obszar: WYW
stan: do-odbioru
wlasciciel: piotr
blokuje: [WYW-005, WYW-006]
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: A3
utworzone: 2026-07-21
---

## 1. PROBLEM

Nie było potwierdzone, czy obieg zatwierdzania wywiadu działa end-to-end — czy bramka jakości AI faktycznie blokuje, czy Approve/Send back działa.

## 2. PRZYCZYNA

Nie dotyczy — test przejścia.

## 3. ROZWIĄZANIE

Przejść ścieżkę w przeglądarce na żywym demo i opisać, co działa, a co nie.

## 4. KRYTERIUM ODBIORU

**Dokument z wynikiem testu.** Zamknięte, gdy przyjmiesz pięć ustaleń — **w tym dwa błędy, które z tego testu wypadły i mają już własne zadania (WYW-008, WYW-009).**

## 5. DOWODY

**Test w przeglądarce, demo.consultify.ai, konto OWNER.** Ścieżka: 2 nowe szablony wywiadu (Personal + Organization) → przypisanie do siebie → odpowiedzi → wysłanie.

**(1) BUG blokujący** → wydzielony jako **WYW-008**.
**(2) Bramka jakości AI działa i ma dwa tryby, oba potwierdzone:** twardy blok przy zbyt płytkiej odpowiedzi na pytanie `required` („Complete the required answers before submitting" — nie da się ominąć) oraz miękkie ostrzeżenie dla pozostałych („Some answers look too short… hint, not a hard block" + „Submit anyway"). Dowód: `POST /api/v8/interview/sessions/:id/evaluate-answers` widoczne w sieci przy każdej próbie.
**(3) Approve / Send back działają** — ale **wyłącznie z widoku „Sessions"** (nie „Inbox", nie „Assigned"), kebab wiersza. Kod: `InterviewHub.tsx:4507-4535`. Approve zmienia status na Approved (zweryfikowane zrzutem). Send back otwiera modal z powodem, `POST /assignments/:id/send-back`, status → In Progress (zweryfikowane).
**(4) Historia wersji NIEZWERYFIKOWANA — i to jest jawne ograniczenie testu.** `InterviewWorkspace.tsx:266-273`: `isReviewerMode` wymaga `session.ownerId !== currentUser.id`. Przy jednym koncie self-assignment nigdy tego nie aktywuje. **Potrzebne drugie konto** do pełnej weryfikacji.
**(5) Luka governance** → wydzielona jako **WYW-009**.

**Sprzątanie:** 3 testowe szablony zarchiwizowane, nie usunięte — API zwraca `403 Cannot delete default templates`. Drobny bug uboczny: nowo tworzone custom-szablony zdają się dziedziczyć `is_default`.

⚠️ Zrzuty robione z każdego kroku, **nie zapisane na dysk** — dowodem są cytaty z sieci i logów powyżej.

## 6. DZIENNIK

**2026-07-21** — zmigrowane ze źródła A3. **Z testu wypadły 2 realne błędy, które w źródle siedziały w środku opisu analizy i mogły tam zginąć.** Wydzielone jako WYW-008 i WYW-009, żeby trafiły do kolejki wykonawcy.
