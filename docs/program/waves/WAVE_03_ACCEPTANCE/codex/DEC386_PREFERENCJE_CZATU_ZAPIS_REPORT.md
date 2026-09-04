# DEC-386 — przełącznik "chipy sugestii" w Czacie: magazyn per-użytkownik na serwerze

Data: 2026-09-04
Robotnik: Sonnet (worktree `/private/tmp/ag-dec386-20260904`, gałąź
`agent/dec386-preferencje-czatu-20260904`, hub `/private/tmp/m03` HEAD
`a0a2849838`)
Decyzja właściciela: DEC-386 — przełącznik ZOSTAJE w menu Czatu (ToolsMenu),
zmienia się TYLKO magazyn: zapis per użytkownik po stronie serwera zamiast
wyłącznie w `localStorage`. Zero nowych ekranów.

## R1 — stan zastany (zmierzony)

- Przełącznik UI: `src/components/AIChat/ToolsMenu.tsx:269-278` (wpis
  `chatSuggestionsEnabled` w tablicy `AI_MODES`), obsługa kliknięcia w
  `toggleMode()` (`src/components/AIChat/ToolsMenu.tsx:293-303`, było, przed
  moją zmianą, tylko `setAIConfig({ [modeId]: newValue })`).
- Stan w store: `src/store/slices/chatSlice.ts:54` (typ) i `:127` (wartość
  początkowa `true`), duplikat domyślnej wartości `true` też w
  `src/store/slices/authSlice.ts:147` (reset po `logout()`).
- Magazyn: CAŁY obiekt `aiConfig` (w tym `chatSuggestionsEnabled`) jest
  częścią `partialize()` w `src/store/useAppStore.ts:144-172`, persystowany
  przez zustand `persist` pod kluczem `consultify-storage` w `localStorage`
  (`APP_STORE_KEY`, `src/store/useAppStore.ts:44`). Brak jakiegokolwiek
  zapisu serwerowego przed tą zmianą — potwierdzone: `grep
  chatSuggestionsEnabled` w całym `server/src/` nie dawał ŻADNEGO trafienia.
- Endpoint `/api/ai-settings` — zamontowany w `server/src/Gateway.ts:744`
  (`app.use('/api/ai-settings', aiSettingsRoutes)`). Warstwa USER już
  istnieje i jest dokładnie tym, czego było trzeba:
  - `GET /api/ai-settings/user` — `server/src/routes/ai/ai-settings.routes.ts:405-425`
  - `PUT /api/ai-settings/user` — `server/src/routes/ai/ai-settings.routes.ts:432-478`
  Obie wołają `AISettingsService.getUserSettings(userId)` /
  `AISettingsService.updateUserSettings(userId, settings)`
  (`server/src/services/aiSettingsService.ts:399-511`), backed by tabelą
  `user_ai_settings` (PRIMARY KEY `user_id`, FK do `users(id)` ON DELETE
  CASCADE — `server/migrations/000_initdb_core_tables.sql:906-930`). Frontend
  ma już gotowe wrappery `Api.getAIUserSettings()` /
  `Api.updateAIUserSettings()` (`src/services/api.ts:17344-17356`).
  **Zdecydowałem NIE budować nowego endpointu** — ten już istnieje i jest
  ogólny (`settings: {...}` w body PUT, brak sztywnej listy pól na
  poziomie route'a).
- Pułapka znaleziona podczas R1: tabela `user_ai_settings` ma już kolumnę
  `auto_suggestions` (default `true`), która WYGLĄDA jak trafienie, ale to
  **inna, niepowiązana funkcja** — zasila "AI Auto-Complete" (`src/services/
  api.ts:17370-17384` `getAIAutoComplete`/`saveAIAutoComplete`, wpięte w
  `src/components/settings/AISettings.tsx:65,184-185,341` — ustawienia
  sugestii uzupełniania tekstu/komentarzy, nie chipy pod polem czatu).
  Podłączenie `chatSuggestionsEnabled` pod `auto_suggestions` sprzęgłoby po
  cichu dwa niezależne przełączniki widoczne w dwóch różnych miejscach UI —
  odrzucone. Zamiast tego dodałem osobną kolumnę.
- Efekt uboczny R1: znalazłem martwy kod — `server/src/routes/
  aiSettingsFallback.ts` (fallback zapisu do `user_preferences` gdy
  `AISettingsService` się nie zaimportuje) NIE jest nigdzie wpięty w
  `ai-settings.routes.ts` (grep — zero trafień poza własnym testem
  `aiSettingsFallback.test.ts`). Nie naprawiałem — poza zakresem DEC-386,
  zostawiam do osobnego zgłoszenia.

## R2 — co zmieniłem

1. **Migracja** `server/migrations/963_user_ai_settings_chat_suggestions.sql`
   (nowa, numerowana zaraz po `962_...`, ten sam idiom co tam:
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`):
   ```sql
   ALTER TABLE user_ai_settings
     ADD COLUMN IF NOT EXISTS chat_suggestions_enabled BOOLEAN DEFAULT true;
   ```
2. **`server/src/services/aiSettingsService.ts`** — dodałem
   `chat_suggestions_enabled` do: `DEFAULT_USER` (linia ~156-160),
   `getUserSettings()` (odczyt z `row`, fallback na default gdy `NULL`,
   ~426-430), `updateUserSettings()` (INSERT/ON CONFLICT UPDATE + parametr,
   ~453-500).
3. **Nowy moduł `src/services/chatSuggestionsPreference.ts`**:
   - `syncChatSuggestionsPreferenceFromServer()` — woła
     `Api.getAIUserSettings()`, jeśli zwrócone
     `chat_suggestions_enabled` jest `boolean`, nadpisuje
     `aiConfig.chatSuggestionsEnabled` w store (`setAIConfig`). Przy
     jakimkolwiek błędzie (offline, 503 "service not configured", stary
     wiersz sprzed migracji) — cichy no-op, zostaje wartość odtworzona przez
     zustand `persist` z `localStorage` (fallback wymagany przez R2).
   - `pushChatSuggestionsPreferenceToServer(enabled)` — woła
     `Api.updateAIUserSettings({ chat_suggestions_enabled: enabled })`,
     best-effort (błąd połknięty — `localStorage` ma już wartość
     optymistyczną).
4. **`src/App.tsx`** — w efekcie `verifyAuth` (start sesji, `useEffect` z
   pustą tablicą zależności, `src/App.tsx:279-403`), w gałęzi `if (user)`
   (uwierzytelniony użytkownik), dodałem `void
   syncChatSuggestionsPreferenceFromServer();` — jednorazowy, nieblokujący
   odczyt przy starcie sesji.
5. **`src/components/AIChat/ToolsMenu.tsx`** — w `toggleMode()`, obok
   istniejącego `setAIConfig({ [modeId]: newValue })`, dodałem: gdy
   `modeId === 'chatSuggestionsEnabled'`, wywołanie
   `void pushChatSuggestionsPreferenceToServer(newValue)`.

`localStorage` (zustand persist) zostaje jako cache/optymistyczny zapis —
zgodnie z R2 ŹRÓDŁEM PRAWDY jest teraz serwer (kolumna
`user_ai_settings.chat_suggestions_enabled`).

## R3 — dowód pary (real Postgres, NIE atrapa)

Środowisko: **realny PostgreSQL 16 + pgvector** w efemerycznym kontenerze
Dockera (`pgvector/pgvector:pg16`, port hosta `6350` — poza pulą
zarezerwowanych portów), NIE "mock DB". Zabezpieczenie przed pułapką z
`Środowisko testowe kłamie w obie strony`: uruchamiałem z
`NODE_ENV=test RUN_DB_TESTS=1 DATABASE_URL=postgresql://postgres:postgres@localhost:6350/consultify_test`
— `RUN_DB_TESTS=1` jest KONIECZNE, bo samo `NODE_ENV=test` podstawia atrapę
(`server/src/database/Database.ts` `createDatabase()`: warunek `NODE_ENV ===
'test' && RUN_DB_TESTS !== '1'` → mock). Pełny łańcuch migracji
(`server/scripts/migrate.postgres.ts`, >1000 plików) przeszedł od zera do
końca na tej pustej bazie, **w tym nowy plik `963_...`** — `--dry-run`
później pokazał `Pending migrations: 0`. Kolumna zweryfikowana w
`information_schema.columns`: `chat_suggestions_enabled | boolean | true`.

Skrypt wołał `AISettingsService.getUserSettings`/`updateUserSettings`
BEZPOŚREDNIO (to dokładnie to, co wołają handlery
`GET`/`PUT /api/ai-settings/user` — patrz R1) — pomijając tylko warstwę HTTP
(auth/routing), którą R1 potwierdził jako cienki passthrough (`req.body` →
`settings` → serwis, `settings` → `res.json()`).

**(a) zimne odtworzenie sesji (nowy kontekst, zero localStorage):**
```
--- R3(a): default value for a brand-new user row ---
userA default chat_suggestions_enabled = true
--- User A sets OFF (simulates ToolsMenu toggle -> PUT /api/ai-settings/user) ---
--- R3(a): cold read (new getUserSettings call, no localStorage, fresh from DB) ---
userA chat_suggestions_enabled after cold read = false
PASS R3(a): value survives a cold read from the server (no localStorage involved).
```
Użytkownik A ustawił OFF; kolejne, niezależne wywołanie `getUserSettings`
(symulujące zupełnie nowy klient/przeglądarkę — brak jakiegokolwiek
`localStorage` w tym procesie) czyta `false` wprost z bazy. WYNIK: **PASS**.

**(b) izolacja per-użytkownik (drugi użytkownik nie widzi cudzego ustawienia):**
```
--- R3(b): second user in same org must NOT see userA preference ---
userB chat_suggestions_enabled = true
PASS R3(b): preference is per-user, not leaked to another user.
```
Użytkownik B (nowy wiersz, nigdy nie dotykany) czyta domyślne `true` —
ustawienie A go nie dotyka (PK tabeli to `user_id`, brak żadnego sprzężenia
po organizacji). WYNIK: **PASS**.

## R4 — dowód mutacyjny

Zepsucie: w `getUserSettings()` tymczasowo zamieniłem obliczane pole na stałą:
```ts
// DEC-386 R4 MUTATION (temporary, must be reverted before commit):
// ignore the persisted row and always return the constant default.
chat_suggestions_enabled: true,
```
Nowy użytkownik: ustawiony na OFF (`updateUserSettings({
chat_suggestions_enabled: false })`), po czym `getUserSettings` (z mutacją):
```
chat_suggestions_enabled after setting OFF then reading = true
CONFIRMED RED: mutated getUserSettings ignores the DB row and returns true instead of the persisted false.
```
**CZERWONE** — dokładnie tam, gdzie powinno: test broni realnego odczytu z
bazy, nie atrapy. Mutację cofnąłem (`git diff` po cofnięciu pokazuje TYLKO
zamierzone dodania z R2, zero pozostałości mutacji — sprawdzone ręcznie), po
czym powtórzyłem R3(a)+R3(b) w całości — **ZIELONE**, identyczne z
wynikiem powyżej.

## R5 — higiena

- `npx esbuild` osobno na każdym zmienionym pliku TS/TSX — wszystkie 4
  przechodzą bez błędu:
  - `src/App.tsx`
  - `src/components/AIChat/ToolsMenu.tsx`
  - `src/services/chatSuggestionsPreference.ts`
  - `server/src/services/aiSettingsService.ts`
- `public/locales/pl/translation.json` i `en/translation.json` — liczba
  liści PRZED i PO identyczna (PL: 35183, EN: 33050) — nie dotykałem i18n
  (przełącznik i jego etykiety już istniały, DEC-386 nie wymagał nowych
  napisów).
- `git status --short` w worktree — tylko zamierzone pliki (3 zmodyfikowane
  + 2 nowe, patrz sekcja "Zmienione pliki" niżej), zero śmieci (skrypty
  weryfikacyjne z R3/R4 usunięte przed commitem, kontener Dockera
  zatrzymany).

## Co NIE zostało zweryfikowane (i dlaczego)

- **Ścieżka HTTP end-to-end** (realny request z tokenem JWT przez
  `verifyToken`/`requireActiveMembership` do żywego procesu Express) —
  NIEZWERYFIKOWANE. Uzasadnienie: R1 potwierdził, że handlery `GET`/`PUT
  /api/ai-settings/user` to bezpośredni, bezstanowy passthrough do
  `AISettingsService.getUserSettings`/`updateUserSettings` (brak
  dodatkowej logiki biznesowej między routingiem a serwisem dla tego pola),
  więc test na poziomie serwisu pokrywa realne ryzyko (zapis/odczyt kolumny
  w Postgresie). Nie podnosiłem pełnego serwera (auth, rate-limiter,
  middleware) w tym oknie czasowym — jeśli nadzorca chce dowodu na poziomie
  HTTP, to osobny, krótki dyżur (uruchomić `server/src/Gateway.ts` na porcie
  spoza rezerwacji, zalogować dwóch testowych userów, PUT+GET przez `curl`).
- **Zachowanie w prawdziwej przeglądarce** (React, `App.tsx` faktycznie
  wywołuje `syncChatSuggestionsPreferenceFromServer()` przy realnym
  logowaniu, `ToolsMenu.tsx` faktycznie woła `pushChatSuggestionsPreferenceToServer`
  po kliknięciu) — NIEZWERYFIKOWANE wizualnie/w przeglądarce. Weryfikacja
  była na poziomie kodu (esbuild + odczyt) i na poziomie serwisu (R3/R4 na
  realnym Postgresie), nie e2e w przeglądarce z prawdziwym loginem. To NIE
  jest ekran wizualny (brak nowej powierzchni UI — zero nowych elementów do
  pokazania), więc reguła "Piotr nigdy nie jest pierwszym testerem
  wizualnym" nie ma tu zastosowania wprost, ale przełącznik warto sprawdzić
  w praktyce (dwa logowania na dwóch przeglądarkach) przed uznaniem
  DEC-386 za w pełni CLOSED_FINAL.

## Zmienione/nowe pliki

- `server/migrations/963_user_ai_settings_chat_suggestions.sql` (nowy)
- `server/src/services/aiSettingsService.ts` (zmodyfikowany)
- `src/services/chatSuggestionsPreference.ts` (nowy)
- `src/App.tsx` (zmodyfikowany)
- `src/components/AIChat/ToolsMenu.tsx` (zmodyfikowany)
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/DEC386_PREFERENCJE_CZATU_ZAPIS_REPORT.md` (ten raport)
