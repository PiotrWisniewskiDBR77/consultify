# Audyt gotowości MVP — część A (Czat, Moja Praca, Wywiad, Narzędzia, Ocena, Inicjatywy, Realizacja)

Data uruchomienia: 2026-09-06 (noc z 05→06.09). Środowisko: `http://localhost:3000`
(vite z `/private/tmp/m03`, HEAD `59e282df885161467102ceb0c23a14c8717b2bec`, branch
`codex/m03-admin-20260824` — potwierdzone `lsof`/`ps` na PID 11402, nie tylko dokumentacją).

## BLOKADA ŚRODOWISKA — audyt na żywo NIE WYKONANY

Próba zrzutu `/chat` i `/chat/cff44da8-...` (`ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`)
zakończyła się przekierowaniem na `/login?redirect=...` w OBU próbach. Zdiagnozowane precyzyjnie
(nie zgaduję):

- `auth.json` (mtime 22:53): brak wpisu `token` w `localStorage` origin `http://localhost:3000` —
  sesja już wcześniej wylogowana/wyczyszczona przez inny proces przed moim uruchomieniem.
- `iv-auth.json` (mtime 18:51): token JWT obecny, ale `exp` w przeszłości (wygasł ~11 011 s przed
  próbą). Konsola przeglądarki: 9× `401 Unauthorized`, `[TokenService] Refresh failed: 401`,
  `[Auth] Profile sync failed: ApiError: Token expired` — **refresh_token też odrzucony przez
  serwer** (401), nie tylko access token wygasł. To wyklucza proste odświeżenie.
- `p3-odbior-auth.json` (mtime 20:14, znaleziony przeszukaniem `/private/tmp` z ostatnich 3h): oba
  tokeny JWT w środku również z `exp` w przeszłości (−6031 s, −8085 s).
- Przeszukanie `/private/tmp` (głębokość 4, pliki zmienione w ostatnich 3h, 6314 kandydatów) **nie
  znalazło żadnego pliku storageState z ważnym (nie-wygasłym) tokenem** dla `http://localhost:3000`.

**Przyczyna prawdopodobna:** refresh token jest rotacyjny/jednorazowy (pamięć nadzorcy:
„token odświeża się rotacyjnie" — dyzur `zrzut.mjs`), a plik `ODBIOR_AUTH_STATE` jest współdzielony
między wieloma równoległymi agentami/sesjami tego dnia (m.in. `ag-cto-mywork`, `ag-cto-wno`,
`ag-cto-irw`, inne worktree) — któryś z nich zużył/rotował token jako ostatni, a ten zrzut ubiegł go
i zapisał plik ponownie wygasły, albo token po prostu wygasł czasowo (krótkie TTL) i nikt
nie zrobił świeżego logowania od tamtej pory.

**Zgodnie z zasadami bezpieczeństwa tej sesji NIE loguję się sam** — logowanie wymaga hasła
właściciela, a skrypt `scripts/dev/odbior-zywo/zaloguj.mjs` jest zaprojektowany dokładnie w tym celu
(„WŁAŚCICIEL LOGUJE SIĘ SAM, nikt nie wpisuje jego hasła" — otwiera widoczne okno przeglądarki i
czeka do 10 minut na ręczne logowanie). Odczyt/kopiowanie cudzych zapisanych haseł też nie wchodzi
w grę. **Wymagana akcja:** ktoś z dostępem do konta właściciela musi uruchomić
`ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json node scripts/dev/odbior-zywo/zaloguj.mjs`
i zalogować się ręcznie, zanim audyt A może zebrać jakikolwiek żywy zrzut.

## Co ZOSTAŁO wykonane bez żywej sesji

- Potwierdzone REALNE trasy 7 modułów (grep `src/routes/routeConfig.ts`, nie zgadywanie z treści
  zlecenia — zlecenie podawało `/tools`, co jest MYLĄCE: `/tools` to publiczna strona-wizytówka
  `ToolsShowcasePage` (`src/routes/AppRoutes.tsx:1332-1341`), prawdziwy moduł Narzędzia żyje pod
  `/discovery-tools`):
  - Czat: `/chat`, `/chat/:conversationId`
  - Moja Praca: `/my-work` z zakładkami `/my-work/inbox`, `/my-work/tasks`, `/my-work/ideas`,
    `/my-work/notebook`
  - Wywiad: `/interview` (`?tab=sessions`)
  - Narzędzia: `/discovery-tools` (**nie** `/tools`)
  - Ocena: `/assessment/drd/:sessionId` (macierz → pełny ekran)
  - Inicjatywy: `/initiatives`
  - Realizacja: `/execution`
- Potwierdzone w `git log`/`git merge-base --is-ancestor`, że HEAD `59e282df88` **zawiera** wszystkie
  commity napraw cytowane w `docs/program/ODBIOR_CTO_20260905/{02-moja-praca,03-04-05,06-07-08}.md`
  z 05.09 (m.in. `2e2abb1011`, `ba9e2fc012`, `328e3a6a8d`, `307fa67cae`, `9de1b76522`,
  `5ed0480532`, `296e131c22`, `c67313c987`, `4d4abf7a3e`, `b44c535209`) — czyli te konkretne
  naprawy z wczoraj SĄ na kodzie, na którym ma działać dzisiejszy /jutrzejszy MVP. To **nie jest**
  dowód, że ekrany faktycznie tak wyglądają na żywo dziś (brak zrzutu) — tylko że kod naprawy
  fizycznie istnieje w drzewie.
- Odczytane w całości `II_EKRANY_FLAGOWE.md` i `III_PRZEPLYWY_KLIKANE.md` dla 7 modułów — pełna
  lista znanych z wczoraj BLOKAD DZIŚ (patrz niżej), zbiorczo, PRZED weryfikacją na żywo.

## Znane z wczoraj (05.09) otwarte BLOKADY per moduł — DO PONOWNEJ WERYFIKACJI NA ŻYWO, nie potwierdzone dziś

| Moduł | Blokada cytowana wczoraj | Plik/dowód cytowany wczoraj | Status dziś |
|---|---|---|---|
| Czat | „QA folder"/„test Tomek" — dane testowe widoczne w historii demo | dane w bazie stagingu, nie kod | NIE ZMIERZONE |
| Czat | Plakietka źródeł „1 sources" po angielsku | `TrustBadge.tsx:384`, brak klucza i18n | NIE ZMIERZONE |
| Czat | 404 na `/api/ai/stream/partial/:id` przy otwarciu historycznej rozmowy | `useAIStream.ts:1479` / `ai.routes.ts:6446` | NIE ZMIERZONE |
| Moja Praca | Filtr Menu 3 „Krytyczne" znika po przełączeniu zakładek (MP16) | — | NIE ZMIERZONE |
| Moja Praca | 4-6 s ciszy bez szkieletu przy otwarciu canvas Tabeli pomysłu (MP5) | — | NIE ZMIERZONE |
| Moja Praca | Surowy markdown `##`/`-` w zakładce Teresa (MP9) | — | NIE ZMIERZONE |
| Moja Praca | `GET /api/integrations` → 501 na każdym ekranie Kalendarza | backend | NIE ZMIERZONE |
| Moja Praca | Widok „Dzień" kalendarza — NIE_DOTARŁEM wczoraj (podejrzenie duplikatu przycisku w DOM) | — | NIE ZMIERZONE |
| Wywiad | Nagłówek/breadcrumb przewija się przy zakładce stepperowej odległej (W1/W2) | — | NIE ZMIERZONE |
| Wywiad | `unified-create-launcher` USUNIĘTY jako martwy kod — pytanie czy zamierzone | `InitiativesHub.tsx:2347,2484` | NIE ZMIERZONE (pytanie do właściciela, nie defekt UI) |
| Wywiad | 4 błędy konsoli 404 w tle przy `karta-interview` (fallback maskuje wizualnie) | — | NIE ZMIERZONE |
| Narzędzia | Kategoria „Oceny" czerwona w Bibliotece (przed P6) | — | NIE ZMIERZONE |
| Narzędzia | Nachodzenie „Aktywne"/„Sekcje" na „Zapisano"/„Baza wiedzy" przy 1440 (N7) | — | NIE ZMIERZONE |
| Narzędzia | `/discovery-tools/strategic/megatrends` — ekran martwy, `GET /api/megatrends/baseline` 503 trwale | backend | NIE ZMIERZONE |
| Narzędzia | `tools-outputs-insights-tab`: 3 zduplikowane wiersze „Sekcja finansowa", PL/EN mieszane w danych | dane, nie UI | NIE ZMIERZONE |
| Ocena | `/assessment/outputs/:id/report` — **pusty dokument** mimo statusu „Finalne"/80% (TOP-1 znalezisko audytu B, poza P1-P6) | — | NIE ZMIERZONE — **to jest największa obawa właściciela wg pamięci nadzorcy („nigdy nie powstał ani jeden naprawdę dobry dokument z szablonu")** |
| Ocena | `/assessment/outputs/:id/presentation` — „Podgląd raportu — 0 sekcji" | — | NIE ZMIERZONE |
| Ocena | Treść komórek macierzy DRD (oś 1+) częściowo fałszywa — 23/63 wg kanonu | `docs/program/grafika/MACIERZ_TRESC_KOMOREK.md` | NIE ZMIERZONE (dane, nie UI) |
| Inicjatywy | Nagłówek Menu 1 „Initiatives" po angielsku | (P3) | NIE ZMIERZONE |
| Inicjatywy | `?mode=doc&open=<id>` + `page.reload()` → cichy powrót do listy (utrata stanu) | — | NIE ZMIERZONE |
| Inicjatywy | Karta z rekordu `DEMO_STORY` generuje 12×404 w konsoli (luka w danych seeda, wizualnie OK) | `demo-story-20260826-initiative-traceability` | NIE ZMIERZONE |
| Realizacja | Zakładka „Praca"/„Zasoby": 15-22 s bez skeletonu/spinnera, tylko statyczny tekst (P5) | `EXECUTION_CASE_FANOUT_TIMEOUT_MS=12000` przekroczony | NIE ZMIERZONE |
| Realizacja | `execution-tab-rollout`: kolumna TREND „Brak pomiarów" dla WSZYSTKICH 28 KPI (dane, nie kod) | — | NIE ZMIERZONE |

## Werdykt per moduł

Wszystkie 7 modułów: **NIEGOTOWY DO WERDYKTU** — nie „NIEGOTOWY produktowo", tylko dosłownie brak
możliwości wydania GOTOWY/GOTOWY Z KOSMETYKĄ/NIEGOTOWY bez jednego żywego zrzutu z dzisiejszego
dnia. Wydanie werdyktu na podstawie samej dokumentacji z wczoraj byłoby dokładnie kształtem
fałszywego „gotowe" nr 2 z pamięci nadzorcy („Hipoteza nadzorcy staje się faktem") — teza z wczoraj
nie może wejść do dzisiejszego rejestru jako zweryfikowany fakt.

## Rekomendacja

1. Ktoś z dostępem do konta właściciela uruchamia ręcznie `zaloguj.mjs` (patrz wyżej), zapisując
   świeży `ODBIOR_AUTH_STATE`.
2. Po odświeżeniu sesji — **NIE uruchamiać równolegle innych agentów zapisujących do tego samego
   pliku** (rotacja tokenu jest współdzielona i jednorazowa — patrz przyczyna blokady wyżej); jeśli
   trzeba wielu agentów naraz, każdy powinien dostać własną kopię pliku sesji i własny port
   (`--port=`), tak jak przewiduje nagłówek `zrzut.mjs`.
3. Dopiero wtedy powtórzyć tę listę kontrolną w całości dla 7 modułów — dokument ten (BLOKADA +
   tabela „NIE ZMIERZONE") służy jako gotowy punkt startowy/checklist, nie jako finalny raport.
