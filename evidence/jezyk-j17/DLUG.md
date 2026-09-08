# J17 — dług, którego ta paczka świadomie NIE zamyka

Pomiar: `scripts/i18n/pomiar-jezyka.mjs` + skaner z
`tests/unit/i18n/serverErrorCodeRatchet.test.ts`, stan po J17 (2026-09-08).

## 1. Trzy polskie zdania serwera bez kodu — poza zakresem J17

| Miejsce | Zdanie | Dlaczego zostaje |
| --- | --- | --- |
| `server/src/routes/ai.routes.ts:4828` | „Uruchamiam analizę wieloagentową (CFO, CTO, CHRO, COO)…" | ramka SSE `type: 'status'`, nie odpowiedź 4xx. Zmiana wymaga rozszerzenia kontraktu strumienia czatu i tłumaczenia po stronie `UnifiedChatPanel` → **paczka J1 (01 Chat)** |
| `server/src/routes/ai.routes.ts:4903` | „Tryb wieloagentowy niedostępny — przechodzę do standardowej analizy…" | jw. |
| `server/src/routes/client-errors.routes.ts:198` | „Ten sam błąd frontendu wystąpił N× …" | treść alertu operacyjnego (`sendSystemAlert`), **nigdy nie trafia do przeglądarki** — to nie jest defekt językowy UI |

Skaner ratchet celowo obejmuje tylko `res.status(4xx|5xx).json({…})`
w `server/src/routes/**` i `server/src/middleware/**` — te trzy miejsca mają inny
kształt i inny kontrakt. Zakres jest zapisany w `serverErrorCodeRatchet.dlug.json`.

## 2. K5en — 1 350 angielskich zdań serwera bez kodu

To dług **wersji polskiej** (użytkownik PL widzi angielski komunikat), nie angielskiej,
więc świadomie po priorytecie właściciela („PRIORYTET: wersja angielska").
Mechanizm jest gotowy: wystarczy dołożyć `errorCode` + wpis w `errors.*`.

Dziesięć najgorszych plików:

```
  68  server/src/routes/document-studio.routes.ts
  46  server/src/routes/table-platform.routes.ts
  43  server/src/routes/billing/billing.routes.ts
  41  server/src/routes/work-canvas.routes.ts
  32  server/src/routes/ai/ai-settings.routes.ts
  31  server/src/routes/workbook.routes.ts
  30  server/src/controllers/InterviewController.ts
  24  server/src/routes/presentations.routes.ts
  22  server/src/routes/auth.routes.ts
  22  server/src/controllers/InitiativeController.ts
```

472 z 1 822 zdań K5en ma już kod — te są tłumaczone od razu, jeśli tylko kod
trafi do `API_ERROR_FALLBACKS_EN` i do `errors.*`.

## 3. Kody spoza słownika

Serwer używa **1 171 różnych** wartości `code:`. Słownik `errors.*` ma 218 wpisów
(195 z pomiaru K5pl + 20 dołożonych w J17 + generyczny + `errors.app`).
Kod spoza słownika daje użytkownikowi generyczne zdanie w jego języku —
świadomie, bo alternatywą jest polskie zdanie z serwera na angielskim ekranie.

## 4. Menu 2 modułu Inicjatywy

„Inicjatywy / Plan / Obciążenie" i chip „Wszystkie" zostają po polsku w wersji EN —
to kategoria **K4pl** w `InitiativesHub.tsx`, czyli paczka **J6**. Nie ruszam, żeby
nie robić konfliktu w tym samym pliku.
