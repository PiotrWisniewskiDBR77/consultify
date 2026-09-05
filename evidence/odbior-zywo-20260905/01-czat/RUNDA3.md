# RUNDA 3 — 01-czat (05.09.2026, po naprawach)

Staging `GET /api/health` → **gitSha `b852ade6164e0dec755ea3ae0c59ec2f7ca3dc04`** — czyli **starszy** niz `5ffdabe05e`: naprawy SERWEROWE z 05.09 NIE dzialaja jeszcze na stagingu. Frontend localhost:3000 stoi na m03 @ `03c47ab29a` i ma komplet napraw frontendowych.

Sprawdzono ponownie **4** pozycji, ktore rano mialy werdykt `ROZNI_SIE`. Kazda ma swiezy jasny zrzut 1440 (nadpisany `<id>.png`).

## Tabela

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| `chat-split-teresa-right` | ROZNI_SIE | **NOWY_WZORZEC** | Ikony paska zgodne; skrocone Dok/MD i pionowy kebab to decyzje wlasciciela z 05.09. |
| `teresa-confirm-chip` | ROZNI_SIE | **NOWY_WZORZEC** | Obraz nieaktualny — delikatna forma chipu wdrozona 30.08 wg uwagi wlasciciela. |
| `mindmap-i18n-smoke` | ROZNI_SIE | **ROZNI_SIE** | Modal dalej uwieziony w szufladzie przez backdrop-blur-xl — spec naprawy (portal do body) w opisie. |
| `chat-signals-feed` | ROZNI_SIE | **CZEKA_NA_SERWER** | Panel zgodny, lista pusta bo serwer zwraca producerEnabled=false (staging b852ade6). |

## Bilans calego pakietu po rundzie 3

| Werdykt | Liczba |
|---|---|
| ZGODNY | 11 |
| NOWY_WZORZEC | 2 |
| ROZNI_SIE | 1 |
| CZEKA_NA_SERWER | 1 |
| **Razem** | **15** |

## Pozostale `ROZNI_SIE` — specyfikacja dla robotnika

### `mindmap-i18n-smoke`

Modal „Dodaj dowod / zrodlo" nadal jest uwieziony w prawej szufladzie i nieklikalny mysza — zmierzone ponownie 05.09: overlay `fixed inset-0` ma x=1021 w=419 zamiast pelnego ekranu, dialog x=1039 y=341 w=384, a elementFromPoint nad dialogiem zwraca SELECT z szyny inspektora (aside x=1088 w=320); Playwright melduje timeout przy kliknieciu „Dodaj dowod". NAPRAWA: przyczyna to `backdrop-blur-xl` na korzeniu szuflady (src/components/MyWork/mindmap/UnifiedNodeDetailDrawer.tsx:866), ktore tworzy blok zawierajacy dla position:fixed — opakuj korzen modala w src/components/MyWork/mindmap/AddEvidenceModal.tsx:38 w createPortal(..., document.body) i podnies jego z-index ponad szyne inspektora elementu, zeby overlay wracal do pelnego ekranu i przechwytywal klikniecia. Dzisiejsza naprawa (SHA 57eaa48659) dotyczyla wylacznie inert/aria-hidden na zwinietych sekcjach ToggleBlock i tego defektu nie ruszala.

Zrzut: `evidence/odbior-zywo-20260905/01-czat/mindmap-i18n-smoke.png`


## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| chat-signals-feed | CZEKA_NA_SERWER | **CZEKA_NA_SERWER** | GET /api/my-work/signals nadal zwraca producerEnabled:false — zmienna ENABLE_SIGNAL_PRODUCER wciąż nie jest 'true' na stagingu, wbrew twierdzeniu backlogu że włączono ją 05.09 04:22; zmierzone przez API bo sesja SUPERADMIN jest przekierowywana z /chat na /superadmin (RouterSync.tsx:347, niezwiązane z naprawami). |

## Runda 5

Redeploy stagingu 10:49, gitSha `fd4e36e1e2`. `ENABLE_SIGNAL_PRODUCER=true` potwierdzone bezposrednio przez API: `GET /api/my-work/signals` -> `{"signals":[],"producerEnabled":true,"nextCursor":null}` (poprzednio `producerEnabled:false`). Ta czesc naprawy zadziala.

Ekranu nadal nie mozna zobaczyc w przegladarce: `FORCE_SUPERADMIN_EMAILS` wyczyszczone na Railway, ale `GET /api/auth/me` nadal zwraca `role: "SUPERADMIN"` dla piotr.wisniewski@dbr77.com. Przyczyna w kodzie: `server/src/routes/auth.routes.ts:690-708` przy logowaniu/odswiezeniu tokenu TRWALE zapisuje `UPDATE users SET role='SUPERADMIN'` do bazy dla kont z historii `FORCE_SUPERADMIN_EMAILS` — ten zapis juz sie wykonal wczesniej (kiedy zmienna byla ustawiona) i samo wyczyszczenie zmiennej teraz tego nie cofa, bo `users.role` w bazie zostalo trwale nadpisane. Skutek: `src/components/RouterSync.tsx:346-351` przekierowuje SUPERADMIN z `/chat` na `/superadmin` (potwierdzone zrzutem — `zrzut.mjs --url=/chat` konczy na `http://localhost:3000/superadmin`), wiec panel sygnalow jest niedostepny dla tej sesji niezaleznie od stanu backendu.

| id | werdykt runda 4 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| chat-signals-feed | CZEKA_NA_SERWER | **CZEKA_NA_SERWER** | producerEnabled teraz true (naprawa serwerowa zadziala), ale ekran nadal niedostepny bo role konta utknela na SUPERADMIN w bazie (nie w env) i RouterSync przekierowuje /chat -> /superadmin; naprawa: reczny UPDATE users SET role='ADMIN' dla tego konta na stagingu, albo test na koncie bez wpisu w historii FORCE_SUPERADMIN_EMAILS. |

## Bilans po rundzie 5 (ten ekran)
- CZEKA_NA_SERWER: 1 (przyczyna zmieniona: z "ENABLE_SIGNAL_PRODUCER=false" na "rola konta utknela na SUPERADMIN w bazie po historycznym FORCE_SUPERADMIN_EMAILS")

## Runda 5 (mindmap-i18n-smoke)

| id | werdykt runda 3 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| mindmap-i18n-smoke | ROZNI_SIE | **ROZNI_SIE** | Sam modal jest juz naprawiony (pelnoekranowy, klikalny), ale klikniecie myszy w przycisk 'Dodaj dowod' (i nawet w naglowek sekcji 'DOWODY I ZRODLA') jest przechwytywane przez stojacy z boku panel inspektora elementu (mels-element-inspector-rail) — nowa, precyzyjniejsza diagnoza w wyniki.json wskazuje UnifiedNodeDetailDrawer.tsx:2115 (brak createPortal do document.body gdy niezadokowane). |

Ustalenie ponad to co wiedziala runda 3: przyczyna nie jest w backdrop-blur na korzeniu szuflady, tylko w tym ze `return zadokowany && slotPanelu ? createPortal(tresc, slotPanelu) : tresc` (linia 2115) zwraca tresc BEZ portalu do body, gdy nie jest zadokowana — mimo klasy `fixed z-modal` na korzeniu (linia 866), drzewo nie ucieka z lokalnego stacking-context i przegrywa z sasiednim panelem ElementInspectorRail (position:relative, ExecutiveModuleShell/index.tsx:680-682). Dowod: Playwright real-click zwraca "aside data-testid=mels-element-inspector-rail subtree intercepts pointer events"; wymuszony klik JS otwiera modal identyczny z zatwierdzonym obrazem, wiec sam modal dziala — problem jest wylacznie w dosiegalnosci przycisku wyzwalajacego.
