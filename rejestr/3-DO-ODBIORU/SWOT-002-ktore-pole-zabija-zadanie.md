---
id: SWOT-002
tytul: Ustalić, które pole żądania AI jest wysyłane jako null
typ: analiza
waga: krytyczna
obszar: SWOT
stan: do-odbioru
wlasciciel: master
blokuje: [SWOT-001]
zablokowane_przez: []
zrodlo: "diagnoza SWOT-001, 2026-07-21"
utworzone: 2026-07-21
---

## 1. PROBLEM

Wiadomo, że żądanie AI z kroku 4 SWOT jest odrzucane przez serwer, i wiadomo, że sześć pól
powoduje odrzucenie, gdy mają wartość `null`. **Nie wiadomo, które z nich SWOT faktycznie wysyła.**

Bez tego naprawa SWOT-001 byłaby zgadywaniem — a zgadywanie już dwa razy dziś dało błędną diagnozę.

## 2. PRZYCZYNA

Nie dotyczy — to zadanie diagnostyczne, nie usterka.

Stan wiedzy: `api.ts:2411` buduje `assistantScope: options?.assistantScope ?? context?.assistantScope`.
Operator `??` **przepuszcza jawny `null`**. To samo dotyczy `focusMode: context?.focusMode`.
Oba pola pochodzą z obiektu `context`, który buduje `useToolAI` przy wywołaniu `sendMessage(prompt)`
(`useToolAI.ts:435-455`). Zawartość tego obiektu nie została jeszcze odczytana.

## 3. ROZWIĄZANIE

Ustalić empirycznie, nie z lektury kodu. Dwie drogi, w tej kolejności:

**Droga 1 — przechwycenie realnego żądania.** Otworzyć sesję SWOT w przeglądarce,
kliknąć syntezę, odczytać z zakładki sieci **dokładne ciało żądania** i **kod odpowiedzi**.
To rozstrzyga w jednym kroku i nie wymaga interpretacji.

**Droga 2 — jeśli droga 1 niedostępna:** prześledzić w kodzie, co `useToolAI` przekazuje jako
`context` do `sendMessage`, aż do `api.ts`, i sprawdzić każde z sześciu pól ryzyka.

Wynik zapisać w sekcji DOWODY jako: nazwa pola · wysyłana wartość · kod odpowiedzi.

## 4. KRYTERIUM ODBIORU

To zadanie diagnostyczne — Piotr go nie klika.

**Zamknięte, gdy w sekcji DOWODY jest zapisane: konkretna nazwa pola, jego wartość w realnym
żądaniu i kod odpowiedzi serwera.** Bez hipotez. Jeśli okaże się, że przyczyna jest inna niż
sześć pól — to też jest wynik, pod warunkiem że poparty realnym żądaniem.

## 5. DOWODY

- 2026-07-21 — **WINOWAJCA USTALONY: `selectedTier: null`.** Sonda na żywym demo, to samo ciało
  żądania, jedyna różnica to poprawka:

  ```
  PRZED (obecny kod)   400  Invalid option: expected "BUDGET"|"STANDARD"|"PREMIUM"|"REASONING"
  PO   (z poprawką)    200  strumień SSE — AI odpowiada
  ```

  `useAIStream.ts:1310` wysyła `selectedTier: (aiConfig as any)?.selectedTier` — przy sesji
  narzędzia `aiConfig` nie ma tego pola, więc leci `null`. Zod odrzuca. **Dotyczy każdej sesji
  narzędzia, w której użytkownik nie wybrał ręcznie modelu** — czyli praktycznie każdej.
  Te same objawy dałyby `assistantScope: null` (:1307) i `coThinkerMode: ?? null` (:1304).
- 2026-07-21 — gałąź `fix/swot-ai-null-fields`, commit `c9780fda8e`. esbuild czysty na 4 plikach.


## 6. DZIENNIK

**2026-07-21** — Zadanie wydzielone z SWOT-001. Powód wydzielenia: reszta przyczyny jest
udowodniona, brakuje jednego ogniwa, a bez niego naprawa byłaby zgadywaniem.

**2026-07-21** — ✅ **NAPRAWIONE, czeka na odbiór.** Przyczyna: `selectedTier: null`.
Poprawka nie łata pojedynczego pola, tylko pomija wszystkie klucze o wartości `null`
przy budowie żądania — chroni pozostałe narzędzia i przyszłe pola dodane bez strażnika.
Osobno odsłonięty kanał błędu (SWOT-003), żeby następna awaria nie zniknęła po cichu.
