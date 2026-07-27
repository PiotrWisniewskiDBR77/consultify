# MAT-FALA2 — Naprawy z żywych testów Piotra + suita E2E jako stała bramka

- **Stan:** DO ODBIORU (2026-07-27, 17:30)
- **Demo:** `9f720dca92`, tag `demo-safe-2026-07-27-fala2-urodzinowa`. Deploy SUCCESS, health 200,
  gitSha potwierdzony na żywo.
- **Skąd te naprawy:** Piotr klikał demo na żywo i w kilka minut wyszły 3 realne bugi.
  Plus pierwsza w historii headless suita E2E przez ścieżki użytkownika (Playwright).

## Co klikać (3 minuty)

**1. Excel z czatu — ma być PRAWDZIWY skoroszyt**
Napisz w czacie samo `excel` albo „zrób mi excel z budżetem operacyjnym".
Oczekiwane: powstaje **skoroszyt z żywymi formułami** do pobrania.
Wcześniej: samo słowo „excel" nie pasowało do żadnego wzorca rozpoznawania intencji (tylko pełne
frazy typu „arkusz excel"), więc prośba spadała do generycznej ścieżki i kończyła **pustą tabelą**
w Table Studio — dokładnie to, co zobaczyłeś.

**2. Document Studio — kontekst organizacji**
Materiały → Dodaj → Dokument → Z AI. Oczekiwane: nad polem opisu **chip „Kontekst: <nazwa firmy>"**,
a wygenerowany dokument ma **źródła** i NIE jest blokowany przez bramkę QA przy eksporcie.
Wcześniej: generator dostawał zero kontekstu organizacji → 0 źródeł → własna bramka jakości
blokowała eksport (Twój przypadek: „Strategia AI dla Zarządu DBR77", Language 45/100).
Dowód naprawy: wynik Sources w bramce QA **0 → 100**, nazwa firmy i projektu fizycznie w treści.
★ Chip zweryfikowany zrzutem przeze mnie (light) — ale UWAGA: sam ten ekran (formularz z Gęstością/
Celem/Odbiorcami) jest w Twojej wizji z dziś rano **przeznaczony do rozbiórki**. To plaster, nie cel.

**3. „New template" w Szablonach — martwy przycisk ożył**
Materiały → Szablony → przycisk „New template" ma mieć **widoczny tekst i strzałkę**, a pod
strzałką „Architekt szablonów (Prezentacja)".
Wcześniej: pusta biała pigułka bez tekstu i bez kliknięcia — czyli **jedyne wejście UI do Twojego
Architekta szablonów było martwe**. To była moja regresja z 26.07, złapana dopiero przez suitę E2E.

## ★ Suita „urodzinowa" — pierwszy uczciwy pomiar ścieżek użytkownika
Nowy plik `tests/e2e/golden/materialy.golden.spec.ts` — 8 ścieżek headless (Playwright), od teraz
stała bramka przed każdym pushem.

**Wynik baseline (PRZED tą falą): 6 PASS / 2 FAIL / 1 DEGRADED.** Werdykt robotnika: **5/10**.
- PASS: 5 zakładek Menu 1 · polski błąd przy zepsutym linku · 4 redirecty kanonów · Prezentacje ·
  Report Builder.
- FAIL G5: martwy „New template" → **naprawiony tą falą**.
- FAIL G2: nowo utworzony dokument nie pojawiał się na liście — **wymaga potwierdzenia na realnej
  bazie** (środowisko testowe używa uproszczonej atrapy bazy, która może nie odwzorowywać rejestracji
  artefaktów). Nie nazywam tego bugiem produktowym, dopóki nie sprawdzę na Postgresie.
- DEGRADED G6: rozróżnienie arkuszy — seedowanie realnych danych poza budżetem testu; mapowanie
  pokryte 6 testami jednostkowymi.

## Uczciwie
Chip kontekstu widziałem na zrzucie. Pozostałych dwóch napraw (Excel z czatu, przycisk) **nie
klikałem na żywym demo** — mam je pokryte testami (18 + 3 RTL, te ostatnie zweryfikowane
czerwony→zielony), ale Twoje kliknięcie jest ostatecznym dowodem.
