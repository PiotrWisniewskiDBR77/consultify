# Usunięcie NotificationSettingsV2/ — decyzja właściciela A5 (03.09 wieczór)

Gałąź: `agent/usun-notificationsettingsv2-20260903` (worktree `/private/tmp/ag-usun-v2`,
baza `HEAD` = `58ef0771d7` na m03).

## 1. Pomiar (przed usunięciem)

`git grep -lnE "NotificationSettingsV2|WatchingTab|useUserNotificationPreferences" -- src dev-render tests server`
zwrócił WYŁĄCZNIE:
- 8 plików wewnątrz `src/components/settings/NotificationSettingsV2/`
- `src/hooks/useUserNotificationPreferences.tsx`
- `server/src/scripts/g05-przelot.ts` — **jedyny hit spoza rodziny**; sprawdzono
  kontekst (linie 629, 638): to komentarz diagnostyczny cytujący ścieżkę hooka
  jako etykietę logu, NIE import (`grep "^import" ... | grep -iE "notification|watching"`
  → puste). Nie blokuje usunięcia.

`src/views/SettingsView.tsx:433` (rzeczywista ścieżka; instrukcja podawała
`src/components/settings/SettingsView.tsx`, plik faktycznie leży w `src/views/`)
renderuje `<NotificationSettings ...>` — v1, nie V2. Potwierdzone czytaniem pliku.

Hook wołał `/api/settings/watchers` (3×) oraz inne trasy `/api/settings/notifications/*`.
`git grep -n "settings/watchers" -- server/src` → pusto (serwer nie ma tej trasy).

## 2. Usunięte pliki i linie

| Commit | Co | Plików | Linii |
|---|---|---|---|
| `e6c236c0dd` | `src/components/settings/NotificationSettingsV2/` (7 komponentów + 1 test) | 8 | 1382 |
| `5d587187b5` | `src/hooks/useUserNotificationPreferences.tsx` | 1 | 532 |
| `fde1d15453` | 4 klucze i18n (pl+en) | 2 pliki JSON | -10 linii JSON (4 klucze × 2 pliki) |
| `09567a4814` | bezpiecznik testowy (rozszerzenie) | 1 | +24 |

**Razem usunięte pliki produktowe: 9, 1914 linii kodu TSX.**

## 3. Klucze i18n

Metoda: wyciągnięto WSZYSTKIE literały `settings.notifications.*` z treści usuwanych
plików (statyczne `t('...')` I dynamiczne `key: '...'` obiekty — pierwsze podejście
regexem `t\(['"]` przeoczyło warianty obiektowe typu `{ key: 'watchNotifyAll', ... }`,
poprawione drugim, ogólniejszym przebiegiem po pełnej treści plików z historii gita),
łącznie z kluczami budowanymi dynamicznie (`` `settings.notifications.${key}` `` w
`ChannelsTab.tsx`/`DigestsTab.tsx`) — 64 kandydatów.

Z tego w `translation.json` (pl/en) istniało 22 (reszta to czyste fallbacki
`t(klucz, domyślnyTekst)`, nigdy nie zapisane w JSON — nic do usunięcia).

Dla każdego z 22 sprawdzono `git grep` PO usunięciu plików V2/hooka — **18 jest
współdzielonych z v1** (`NotificationSettings.tsx`, `PushNotificationsSettings.tsx`)
i zostają. **4 były wyłącznie w `WatchingTab.tsx`** i mają zero pozostałych
konsumentów:
- `settings.notifications.watchNotifyPrefix`
- `settings.notifications.watchNotifyAll`
- `settings.notifications.watchNotifyMentions`
- `settings.notifications.watchNotifyStatusChanges`

Liczba liści `translation.json` PRZED/PO (liczone rekurencyjnie, liść = wartość
nie-obiektowa):
- pl: 34307 → 34303 (**-4**)
- en: 32318 → 32314 (**-4**)

Różnica dokładnie równa liczbie usuniętych kluczy — zgodnie z wymogiem instrukcji.

## 4. Bezpiecznik testowy

`tests/unit/initiatives/initiativeRecordCanon.test.ts` — nowy `describe`
„NotificationSettingsV2 (decyzja A5, 03.09 wieczór) nie wraca” sprawdza
nieobecność katalogu i hooka (test tekstowy `fs.existsSync`, wzorem istniejących
bloków w tym pliku).

`npx vitest run tests/unit/initiatives/initiativeRecordCanon.test.ts` →
**8/8 PASS** (4 istniejące opisy + 2 nowe testy w nowym opisie).

## 5. Dowód budowy (esbuild per plik)

- `npx esbuild src/views/SettingsView.tsx --bundle ...` → OK (4.1mb bundle, 0 błędów)
- `src/components/settings/NotificationSettings.tsx` (v1, zostaje) → OK
- `src/components/settings/PushNotificationsSettings.tsx` (zostaje) → OK
- `src/components/settings/index.ts` → OK, brak eksportu usuniętych symboli
- `server/src/scripts/g05-przelot.ts` — esbuild rzuca błędami, ale są to
  PRZEDISTNIEJĄCE, niezwiązane z tą zmianą problemy (`tesseract.js` dynamic
  import, natywne `.node` bindingi `@napi-rs/canvas`/`@sentry/node-cpu-profiler`
  nierozwiązywalne przez esbuild bez platform=node+external); plik nie ma
  żadnego `import` z usuniętej rodziny (tylko komentarz), więc to nie regresja
  tej zmiany.

## 6. Zrzut ekranu (dowód wizualny, harness dev-render)

Uruchomiono `npx vite --config dev-render/vite.config.ts --port 5434` (5432
zajęty przez Postgres) i kanoniczny `scripts/dev/grafika-zrzuty.mjs`
(--faza=PO --jezyk=pl --szerokosc=1440 --motywy=light,dark --rozwin-sekcje=1
--a11y=1 --osiad-po-rozwinieciu=1500 --klik-po-rozwinieciu=1
--cofnij-jesli-skraca=1) dla ekranu `ustawienia-powiadomienia`
(grupa `powiadomienia` → `notifications-overview`, z `scripts/dev/g06-macierz-ekrany.json`
→ `15_SETTINGS`), REALNY `<SettingsView>` z mock-danymi.

Wynik (`wynik-a11y.json`):

| ekran | motyw | status | błędy konsoli | a11yNaruszenia |
|---|---|---|---|---|
| ustawienia-powiadomienia | light | OK | 0 | `[]` |
| ustawienia-powiadomienia | dark | OK | 0 | `[]` |

Zrzuty: `ustawienia-powiadomienia__PO__pl__1440__light.png`,
`ustawienia-powiadomienia__PO__pl__1440__dark.png` (w tym katalogu).

Obejrzane oczami: ekran renderuje panel „Preferencje powiadomień" (v1 —
Aktywność/Aktualizacje zadań/Wzmianki/Kamienie milowe, przełączniki
W aplikacji/E-mail, „Włącz wszystko"/„Minimalne"). Brak jakiegokolwiek śladu
zakładek V2 (Overview/Channels/Categories/Schedule/Digests/Watching) — zgodne
z oczekiwaniem, bo Ustawienia od zawsze renderowały v1, a V2 nigdy nie miało
wołacza.

## 7. Kanon list

`bash scripts/check-list-canon.sh` → zielony: „brak NOWYCH naruszeń kanonu
tabel (pełny skan repo: 157 plików; naruszeń 368, baseline 368 — dług nie
rośnie)”. Ekran ustawień nie jest tabelą, więc ten bezpiecznik dotyczy głównie
kontroli że usunięcie nie ruszyło niczego z rodziny list.

## 8. Czego NIE zrobiono

- Nie usunięto pozostałych ~46 kluczy i18n z rodziny `settings.notifications.*`,
  które były w usuwanych plikach jako fallback (`t(klucz, domyślny)`) — one
  nigdy nie istniały w `translation.json`, więc nie ma czego usuwać.
- Nie ruszono `server/src/scripts/g05-przelot.ts` (tylko komentarz-referencja,
  poza zakresem zadania — werdykt: zostaje, nie import).
- Nie uruchomiono pełnej macierzy g06 (wszystkie 9 ekranów `15_SETTINGS` ×
  4 kombinacje × 2 motywy) — zweryfikowano tylko `ustawienia-powiadomienia`
  (jedyny ekran dotykający usuwanej rodziny funkcjonalnie; pozostałe 8 ekranów
  modułu 15_SETTINGS nie importowały niczego z V2/hooka, więc nie mogły
  regresować przez to usunięcie — potwierdzone przez `git grep` od korzenia
  w kroku 1).
- Nie pushnięto, nie mergowano do `m03`/`demo`/`Londyn` — gałąź czeka na
  nadzorcę.

## Commity (SHA, na gałęzi `agent/usun-notificationsettingsv2-20260903`)

1. `e6c236c0dd` — usuń: NotificationSettingsV2/ (8 plików, 1382 linii)
2. `5d587187b5` — usuń: useUserNotificationPreferences.tsx (532 linie)
3. `fde1d15453` — usuń: 4 klucze i18n watchNotify* (pl+en)
4. `09567a4814` — bezpiecznik: NotificationSettingsV2/ i hook nie wracają (+24 linie testu)
