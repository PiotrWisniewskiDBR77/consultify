---
id: AGT-001
tytul: Inwentarz zdolności pod silnik agenta
typ: analiza
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: piotr
blokuje: [AGT-003, AGT-004]
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: A5
utworzone: 2026-07-21
---

## 1. PROBLEM

Przed budową silnika potoków trzeba było wiedzieć, co już istnieje i da się użyć, a co trzeba dorobić. Inaczej budujemy drugi raz to, co jest.

## 2. PRZYCZYNA

Nie dotyczy — analiza.

## 3. ROZWIĄZANIE

Przegląd kodu pod kątem gotowych mechanizmów „bloczek: wejście/wyjście + zatwierdzenie" z decyzji DEC-002.

## 4. KRYTERIUM ODBIORU

**Dokument.** Zamknięte, gdy przyjmiesz podział „można użyć dziś / trzeba dorobić" jako podstawę do budowy.

## 5. DOWODY

Analiza kodu przez `git show origin/demo:<ścieżka>`, dowód plik:linia.

**★ Największe odkrycie: mechanizm nadający się na silnik potoku JUŻ ISTNIEJE i częściowo działa** — „Teresa Copilot P08" (`server/src/routes/v8/teresa.routes.ts` + `services/v8/teresaCopilotService.ts`).

Kontrakt `POST /api/v8/teresa/proposal` → `proposal/:id/approve` → `proposal/:id/execute` to dokładnie wzorzec „bloczek + zatwierdzenie" z decyzji DEC-002.

**Idempotencja potwierdzona w kodzie:** `createProposal()` (`teresaCopilotService.ts:1132-1166`) — przy podanym `idempotencyKey` najpierw szuka istniejącego proposalu i zwraca go zamiast tworzyć duplikat.

**MOŻNA UŻYĆ DZIŚ (5, realne serwisy, nie zaślepki):** `radar` (:1773) · `initiatives` (:1816) · `calendar` (:1856) · `notebook` (:1912) · `interview` (:1958). Wszystkie mają wzorzec `tryImport()` realnego serwisu → wywołanie → `real_entity: Boolean(ref)` w odpowiedzi, **uczciwie mówiące, czy powstał prawdziwy rekord czy fallback**.

**TRZEBA DOROBIĆ (2 potwierdzone):**
- `excele` — `handleExceleHandoff` (:2006-2031) to **czysty stub**, tylko fallback UUID
- `ideas` — **zadeklarowane w kanonie** (`teresaCopilotCanon.ts:202-210`), ale **nie ma case'u w switchu** `performHandoff()` (:1738-1757) → wywołanie rzuciłoby `Unknown target module: ideas`

**NIEZBADANE w tej turze (jawnie):** Assessment, Deck/Presentations, Whiteboard, Process Flow — mają REST-owe create, ale **idempotencji nie zweryfikowano per endpoint**.

**Rekomendacja:** albo (a) rozszerzyć listę handlerów Teresy o brakujące moduły wzorem `tryImport`+`real_entity`, albo (b) zbudować cieńszą warstwę potoku na REST-ach z osobną tabelą kluczy idempotencji (wzorem `teresa_proposals`).

## 6. DZIENNIK

**2026-07-21** — zmigrowane ze źródła A5.
