---
name: consultify-test
description: Metodyka testowania i ODBIORU w Consultify — jak zdefiniować test (prosty i złożony), jak ma przebiegać, KTO i JAK ocenia, w jakich KRYTERIACH (progach) i JAK te kryteria wchodzą w dalsze działania (gate przed deploy/kolejnym fragmentem). Wywołaj ZAWSZE gdy masz ocenić czy narzędzie/artefakt/output „działa dla klienta", zaprojektować scenariusz testowy, uruchomić panel adwersaryjny albo zdecydować czy wynik przepuszcza dalej. Rdzeń kroku „Zmierz/Re-test" z consultify-petla.
---

# Consultify — testowanie i odbiór (dowód dla KLIENTA, nie „testy przeszły")

## Co to jest test w Consultify
Test = **dowód, że narzędzie działa z perspektywy klienta**, na ŻYWYM demo, nie w mocku. „Testy jednostkowe zielone" ≠ „działa" (mockują output LLM, nie odtwarzają realnego buga). Klient porzuca gdy się PSUJE (niezawodność) albo wygląda TANDETNIE (UX) — treść dopiero potem. Stąd 3 osie (`_SYSTEM_WERYFIKACJI_2.0.md`):
- **NIEZAWODNOŚĆ** — runner N powtórzeń, success%/latencja per narzędzie.
- **UX** — zrzuty z przeglądarki → werdykt Piotra (jego oko, nie mój osąd estetyczny).
- **TREŚĆ** — panel adwersaryjny per-narzędzie + cross-spójność.

## Test PROSTY vs ZŁOŻONY — kiedy który
- **PROSTY** (domyślny, tani): harness niezawodności (N× „stwórz X" → success%/latencja) + smoke live (1 klik renderuje+persystuje+reload). Model: Sonnet/Haiku. Dla: potwierdzenia że mechanika żyje, live-verify po fixie, kolaboracja 2 przeglądarki.
- **ZŁOŻONY** (gdy stawką jest jakość merytoryczna „board-ready"): realistyczny scenariusz klienta + **adwersaryjny panel N-obiektywów + weryfikacja-obalanie + synteza**. Model: Sonnet + Opus na trudne obiektywy. Dla: KPI/ROI/Finanse, N-kart, deliverables, wszystkiego co klient „podpisałby nazwiskiem".

## Jak ZDEFINIOWAĆ test złożony (scenariusz)
Nie testuj na zabawce. Zbuduj realistyczną firmę + zadanie + **twarde pułapki wbudowane** które mają wychwycić słabości (wzorce: NORDWIND, MCG, DBR77 — patrz ich SSOT-y w `wdrozenie-100/`). Definicja MUSI zawierać:
1. **Scenariusz** — firma, liczby, sprzeczne trajektorie, pułapki (np. discontinued ops, cross-record attribution, de-dup przychodu, sekwencja bramkowana, jednostki/waluta).
2. **Zadanie** — co zbudować w narzędziach (na żywej bazie TROLLEY, prefiks odwracalny `nazwa--`).
3. **KRYTERIA ODBIORU (progi twarde)** — patrz niżej.
4. **Checki cross-record** (muszą TIE co do tysiąca) — sumy się domykają, jedna wartość/metryka, enablery bez podwójnego liczenia.

## KTO ocenia i JAK (panel adwersaryjny — workflow `panel-adwersaryjny`)
- **Obiektywy** (każdy czyta bundle JSON z żywego API, punktuje /100, cytuje defekty): kompletność · rygor · logika · prezentacja · model_finansowy. Model: Sonnet dla lekkich (kompletność/prezentacja), **Opus dla rygor/logika/model_finansowy**.
- **Sceptycy-weryfikatorzy** (osobni, model Sonnet): każdy finding próbują OBALIĆ. Domyślnie „obalony=true jeśli niepewne". Perspektywa-różnorodna gdy finding może paść na kilka sposobów.
- **Synteza** (Opus przy sporze): score + werdykt + mapa napraw.
- Kalibracja + anti-halucynacja w prompcie (obiektyw prezentacji bywa wahliwy: rozrzut 24↔83↔92 — nie panikuj na spadku).

## KRYTERIA i JAK wchodzą w dalsze działania ★ (to jest sedno — bez tego pętla się nie zbiega)
1. **Finding liczy się TYLKO po adwersaryjnej weryfikacji.** Obalony = odrzucony, nie naprawiasz. Chroni przed „plausible-but-wrong".
2. **Potwierdzony finding → konkretna zmiana w JEDNYM źródle (DERIVED), nie narracyjny fix.** Lekcja NORDWIND: „domknięte z refi-inflow" w prozie panel złapał jako podwójne liczenie — fix musi być modelowy, nie zdanie. Reconciliation grep-and-fix KAŻDEGO pola (nie tylko nagłówka — „posprzątał salon, zostawił kuchnię").
3. **Próg = twardy GATE przed deploy/kolejnym fragmentem.** Nie przepuszczasz dalej póki próg nieosiągnięty. Progi (kalibracja board-ready): każdy obiektyw ≥88, średnia ≥90, ZERO potwierdzonych krytyczna/wysoka. Dla narzędzia operacyjnego: panel specjalistów ≥5,5/6.
4. **Powtarzalność:** próg musi paść w DWÓCH kolejnych przebiegach (jeden może być fartem). Dopiero wtedy „domknięte".
5. **Wynik pod progiem → wróć do naprawy** (krok 3 pętli), zmapuj findingi, re-test. Trajektoria bywa niemonotoniczna (spadek = adwersarz zszedł głębiej, rośnie dojrzałość — to OK).
6. **Padnięta weryfikacja (rate-limit) = wynik CZĘŚCIOWY, NIE „zero findingów".** Obiektywy policzone przed limitem są wiarygodne; „0 potwierdzonych" przy padniętych sceptykach to artefakt, nie sukces. Powtórz po resecie.

## Lekcje harnessu (NIE powtarzać — kosztowały iteracje)
- **JEDEN autorytatywny skrypt fix+export w jednej transakcji.** NIGDY stary patch po nowym buildzie (stale-clobber ściął DBR77 91→71).
- **Financials DERIVED z jednego źródła** (per-BU rev+marża) — narracja cytuje z modelu (template literal), nie z pamięci; inaczej zaszyta liczba zwietrzeje po zmianie parametru.
- Harness `panel-adwersaryjny.js`: guard bundlePath + parse args-jako-string + odporność na null (rate-limit→częściowe, nie crash) + kalibracja.
- Bundle = fetch z żywego API do JSON (nie z kodu). Stan danych = żywa baza TROLLEY, nie kod.

## Dobór modeli (koszt)
Obiektywy trudne (rygor/logika/model_finansowy) = Opus; lekkie + wszyscy sceptycy = Sonnet; build/export/re-capture = kod/Haiku. Nigdy Fable.

## Pointery
`consultify-petla` (cały cykl) · workflow `panel-adwersaryjny` + `_SYSTEM_PANEL_ADWERSARYJNY_RUNBOOK.md` · `_SYSTEM_WERYFIKACJI_2.0.md` (3 osie) · `_SYSTEM_ODBIORU_KPI_ROI_FINANSE` + NORDWIND/MCG/DBR77 SSOT (wzorce scenariuszy) · `consultify-promocja-demo` (bramka danych TROLLEY vs prod).
