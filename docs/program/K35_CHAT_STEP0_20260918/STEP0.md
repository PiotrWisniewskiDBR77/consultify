# K-35 Czat AI — KROK 0

Data: 2026-09-18
Tor: B / Codex-2
Baza: `origin/integracja/20260911` = `d9f8b2203f636e62c527f5237a3e504afd0a211d`

## Wynik

K-35 nie jest jedną naprawą. Historyczny audyt `/chat` z 2026-09-05 został w dużej części spłacony przez dyżury 367–377; na aktualnej linii pozostają dwie uczciwe rodziny do osobnych commitów: stan połączenia źródeł chmurowych oraz niedomknięte klucze i18n R3 czatu. Stare K1/K2/K4/K6 nie powinny być naprawiane ponownie bez nowego RED, bo kod ma już ścieżki realnego AI, inicjatywy i kickoffu.

## Źródła wejściowe

- `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md` — pierwotne K1–K6, w tym złe źródła i przewody `/chat`.
- `docs/program/REJESTR_ZNALEZISK_20260903.md` sekcje AG–AN — rozliczenie dyżurów 367–377.
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md` — aktualny otwarty mianownik i18n: R3 141 pozycji.

## Co jest już zamknięte na aktualnym tipie

| Audyt | Status na tipie | Adresy aktualne |
|---|---|---|
| K1 — kanwa obiecywała AI, a robiła deterministyczną podmianę | Zamknięte lokalnie, dostawca realny dalej wymaga dowodu przy regresji | `src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx:60`, `:87`; `src/components/AIChat/WorkCanvasDocumentPanel.tsx:2496`, `:2658`; `server/src/routes/ai.routes.ts:6932`, `:6961`; operacje kanwy nadal przechodzą przez preview/approve w `server/src/routes/work-canvas.routes.ts:3853`. |
| K2/K6 — `/chat` bez business actions i bez kickoffu z Help | Zamknięte kodowo; business actions za flagą default OFF, kickoff czyta store | `src/components/AIChat/UnifiedChatPanel.tsx:829-863`, `:7148-7155`; `src/components/Help/HelpSidePanel.tsx:307-325`; `src/layouts/MainLayout.tsx:247-251`; `/chat` dalej montuje sam panel w `src/routes/AppRoutes.tsx:2026-2032`, więc fallback w panelu jest właściwym miejscem. |
| K4 — „Konwertuj na inicjatywę” zapisywało decyzję | Zamknięte dla saveType=`initiative`; decyzja zostaje osobnym trybem | `server/src/routes/ai/deep-thinking.routes.ts:16`, `:99-115` woła `createInitiative`; dopiero gałąź default zapisuje `ai_decision_outcomes` w `:124-129`. |
| D-3/D-4/D-5 i etykiety czatu | Zamknięte w słownikach/aria | `src/components/AIChat/UnifiedChatPanel.tsx:7211-7223`, `:7862`; `src/components/AIChat/ChatHistorySidebar.tsx:641-645`, `:902-908`; `src/components/AIChat/ConversationActions.tsx:356-393`; `src/components/SystemHealth.tsx:191`; klucze są obecne w PL/EN. |

## Otwarte defekty do kolejnych commitów

### K35-1 — stan źródeł chmurowych nadal może kłamać w `/api/cloud/providers`

`POST /api/cloud/sources` jest już fail-closed: bez aktywnego tokenu zwraca `409 CLOUD_PROVIDER_NOT_CONNECTED` (`server/src/routes/cloud.routes.ts:103-114`). Operacje list/download też używają żywego tokenu przez `getValidAccessToken` (`server/src/services/cloudDataService.ts:74-76`, `:168`, `:223`, `:542`, `:613`). Natomiast `GET /api/cloud/providers` liczy `connected` wyłącznie z `listCloudSources(organizationId)` i provider name (`server/src/routes/cloud.routes.ts:412-435`). To może pokazać dostawcę jako połączonego po starym wierszu `cloud_sources`, nawet jeśli token został cofnięty/wygasł.

Cięcie naprawy: zmienić `/providers`, żeby status `connected` pochodził z aktywnego tokenu użytkownika (`getStoredToken`/`getValidAccessToken`) albo rozróżniał `sourceConfigured` od `oauthConnected`. Dowód: realny HTTP/JWT na kopii lub lokalnym RealPG — wiersz `cloud_sources` bez tokenu daje `connected=false`; mutacja „wróć do liczenia z cloud_sources” daje RED.

### K35-2 — i18n czatu R3 pozostaje PARTIAL po Day374

Day374 zamknął R2/R4/R5/R6, ale raportuje R3 `194 → 141`, nadal PARTIAL. Pięć wystąpień w `UnifiedChatPanel.tsx` koliduje z istniejącymi rodzicami-stringami (`myWork.tasks.createdFromChatToast`, `chat.initiativeHandoff.createdDraft`, `myWork.initiatives.createdFromChatToast`, `aiChat.errors.messageSaveFailed`). Pozostałe 136 wystąpień kart obejmuje m.in. konflikt znaczeń `myWork.ideas.plantInGarden`. Raport źródłowy: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md`.

Cięcie naprawy: najpierw osobny commit dla pięciu kolizji string/obiekt w `UnifiedChatPanel` z migracją kształtu kluczy i testem realnego resolvera/renderu; potem osobny commit dla kart wiadomości albo mniejszymi rodzinami komponentów. Dowód: prawdziwy i18next `fallbackLng:false`, render realnego komponentu, mutacja wybranej wartości PL→EN daje RED, pełny pomiar bramki językowej bez wzrostu.

## Kolejność po KROK0

1. K35-1 cloud providers connected-state, bo dotyczy „złych źródeł” i ma mały, mierzalny kontrakt HTTP.
2. K35-2a pięć kolizji R3 w `UnifiedChatPanel`.
3. K35-2b+ karty wiadomości R3 dzielone na małe rodziny po pliku/komponencie.

## Wolna strefa

Nie dotykać ponownie: kanwa AI K1, deep-thinking initiative K4, business actions/kickoff K2/K6, bulk delete/work panel/SystemHealth i18n — bez nowego RED są już rozliczone. Nie dotykać `src/services/aiReview/aiReviewSummary.ts`. Nie zmieniać polityki OAuth ani zatwierdzeń providerów; K35-1 ma tylko poprawić prawdę statusu, nie otworzyć nowych integracji.

