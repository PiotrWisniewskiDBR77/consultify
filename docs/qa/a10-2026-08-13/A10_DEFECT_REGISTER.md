# A10 — pierwszy ręczny odbiór modułu Assessment (DRD)

Agent: S7 (Sonnet, pierwszy przebieg — reguła #7 CLAUDE.md, Piotr nie jest pierwszym testerem).
Worktree: `/Users/piotrwisniewski/.codex/worktrees/mac-s7-a10-audit`
Branch: `codex/mac-s7-a10-audit-20260813`
SHA testowany: `a2484ae65ea1d830f5648758dd48314284c6a3fc` (= baseline, zero commitów — patrz RAPORT: audyt, nie build).
Data: 2026-08-13.
Zrzuty: `docs/qa/a10-2026-08-13/*.png` (109 plików, każdy obejrzany oczами).

Środowisko: serwer `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://t:t@localhost:55495/t_test METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true ENABLE_TEST_AUTH_BYPASS=true` na porcie 42500; frontend `npx vite dev-render --port 42600` z `DEV_RENDER_API_PROXY_TARGET=http://localhost:42500`. Ekrany DRD: `drd-workspace.html?screen=...`; ekrany generyczne S6: `method-workspace.html?view=...`.

Legenda statusu: **PASS** = zrzut obejrzany, zgodny z kryterium · **DEFECT** = zgłoszone, dowód załączony · **NOT VERIFIED** = nie dało się sprawdzić w tym przebiegu, podano powód.

---

## Tabela defektów i obserwacji

| # | Ekran | Motyw | Viewport | Defekt / obserwacja | Dowód (zrzut) | Waga | Kanon (paragraf) | Właściciel pliku | Status |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Approval | light | 1600×1000 | **„Zamroź (tylko approver)" NIE jest wyszarzone dla złej roli.** `disabled={session.state !== 'in_review'}` w `DrdMethodWorkspaceScreen.tsx:612` sprawdza WYŁĄCZNIE stan sesji, nigdy rolę aktora. Zweryfikowano interaktywnie (Playwright): `freezeBtn.isDisabled()` = `false` zarówno dla Anna (approver) jak i Piotr (owner) przy sesji `in_review`. Runtime odrzuca próbę PO kliknięciu (baner „Odrzucono: wymagana rola „approver"") — nie jest to luka bezpieczeństwa, ale złamanie literalnego kryterium odbioru #6. | `06b-approval-actor-approver-light-1600x1000.png` (przycisk aktywny jako approver — poprawnie) · `06c-approval-actor-owner-light-1600x1000.png` (przycisk IDENTYCZNIE aktywny jako owner — błąd) · `06d-approval-owner-click-refusal-light-1600x1000.png` (po kliknięciu: odrzucenie server-side) | **P1** | Zakres A10 pkt 6 „Approval — Zamroź (tylko approver) wyszarzone dla złej roli" | `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx` (S3 — NIE dotykaj) | zgłoszone |
| D2 | Matrix / Split / mw-matrix | light+dark | 1600×1000 + 1280×800 (12/12 kombinacji) | React ostrzeżenie hydratacji: „In HTML, whitespace text nodes cannot be a child of `<table>`… This will cause a hydration error." — powtarzalne w `LiveMatrix`, na WSZYSTKICH 12 kombinacjach motyw×viewport dla ekranów Matrix/Split/mw-matrix. Wizualnie tabela renderuje się poprawnie (brak widocznego uszkodzenia w zrzutach), ale ostrzeżenie jest deterministyczne i wskazuje na białe znaki jako bezpośrednie dziecko `<table>` w JSX. | Zrzuty 03-matrix-*, 03b-mw-matrix-*, 04-split-* (wszystkie 12) wyglądają POPRAWNIE wizualnie; dowód defektu = `docs/qa/a10-2026-08-13/capture-console-errors.json` (12 wpisów) + `capture-run.log` | **P2** | n/d (jakość kodu / React correctness, nie kanon UI) | `src/components/method-workspace/LiveMatrix.tsx` (S6 — NIE dotykaj) | zgłoszone |
| D3 | Interview | light | 1600×1000 | `interviewProps.onResolutionAction: () => {}` w `DrdMethodWorkspaceScreen.tsx:558` jest pustym stubem. Kliknięcie „Nie wiem / potrzebuję pomocy" **poprawnie NIE zwiększa** licznika „X/39 jednostek odpowiedzianych" (potwierdzone przed/po: 1/39 → 1/39, PASS na główne kryterium „nie daje zera"), ale UI po kliknięciu po prostu przechodzi do następnego poziomu bez żadnej widocznej karty pomocy/eskalacji (`ResolutionCard`) — panel Teresa pokazuje ten sam generyczny tekst co przed kliknięciem. Nagłówek `AnswerStateControl.tsx` deklaruje „selecting it opens ResolutionCard instead of committing an answer" — to zachowanie nie jest widoczne w tym przebiegu; może to być zamierzone (pomoc ambient w panelu Teresa) albo luka w podłączeniu. Wymaga potwierdzenia właściciela komponentu. | `02e-dontknow-before-light-1600x1000.png` / `02f-dontknow-after-click-light-1600x1000.png` (fullPage) | **P2** | Zakres A10 pkt 2 „Nie wiem nie daje zera" — częściowo PASS (nie scoruje), ale obiecany help-flow niewidoczny | `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx` (S3) / `src/components/method-workspace/AnswerStateControl.tsx`, `ResolutionCard.tsx` (S6) — NIE dotykaj | zgłoszone |
| D4 | Interview | light | 1600×1000 | Etykieta „Gotowe do zamrożenia" (zielona) pojawia się już przy 1/39 zebranych dowodów, tuż po starcie wywiadu — technicznie poprawne (liczy tylko strukturalne blokery, nie completeness), ale może mylić konsultanta sugerując gotowość mimo że asesment jest w 3% ukończony. Do potwierdzenia z właścicielem czy to zamierzone. | `02c-interview-initial-light-1600x1000.png` (pasek dolny: „Evidence: 1/39 · 0 do przeglądu · Gotowe do zamrożenia") | **P2** | n/d (czytelność statusu, nie twardy kanon) | `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx` (S3) | zgłoszone |
| D5 | Library | light+dark | oba viewporty | Ekran `screen=library` w dev-render NIE jest prawdziwym ekranem Library z listą packów i statusem readiness — to jawnie udokumentowany „screenshot-only harness" (`dev-render/screens/drd-library-entry.tsx`, komentarz nagłówkowy: „NOT a mock of the real AssessmentHub… nothing more"), z JEDNYM zahardkodowanym wierszem procesu, bez pola readiness w ogóle. Realna baza (`method_packs`) ma mix `draft`/`methodology_review`/`released`, ale żaden z tych statusów nie jest renderowany na tym ekranie. Kryterium A10 pkt 1 „readiness widoczny i prawdziwy" NIE DA SIĘ zweryfikować przez ten harness. | `01-library-light-1600x1000.png`, `01-library-dark-1600x1000.png` — pokazują tylko 1 wiersz, brak kolumny/wskaźnika readiness | **P1 (jako gap pomiarowy, nie defekt runtime)** | Zakres A10 pkt 1 | `dev-render/screens/drd-library-entry.tsx` (harness, autor S3 wg nagłówka) | zgłoszone (NOT VERIFIED dla realnego ekranu) |

---

## PASS — zweryfikowane wzrokiem, zgodne z kryterium

| # | Ekran | Motyw | Viewport | Obserwacja | Dowód |
|---|---|---|---|---|---|
| P1 | Interview (Session) | light+dark | 1600×1000, 1280×800 | Readiness DRD (`methodology_review`) jest **uczciwie ujawniony**: baner „Metodyka DRD jest w statusie „w przeglądzie" (methodology_review) — canStartSession() zwraca false. To jest SESJA DEMONSTRACYJNA…, ten runtime jawnie omija bramkę gotowości packa wyłącznie do celów pokazu mechanizmu." Potwierdzone też testem: `test:method-core:front` zawiera „shows the explicit demo-bypass banner (never a silent override of pack readiness)" (PASS, 246/246). | `02c-interview-initial-light-1600x1000.png`, `02-interview-dark-1600x1000.png` |
| P2 | Interview | light | 1600×1000 | Sześć uczciwych stanów odpowiedzi (Potwierdzone/Częściowo/Nie/Nie wiem/Nie mam dowodu/Nie dotyczy) renderuje się poprawnie, ikony + tonacje bez crimson; „Nie wiem" NIE inkrementuje licznika odpowiedzianych jednostek (1/39 → 1/39) — nie scoruje jako zero. | `02d-interview-state-*.png` (18 zrzutów), `02e/02f-dontknow-*.png` |
| P3 | Live Matrix | light+dark | 1600×1000, 1280×800 | Skale per oś: kolumny L1–L7 dla osi „Procesy Cyfrowe (7L)", inne osie mają 5L/6L własne zakresy (widoczne w zakładkach osi). Kolor NIE jest jedynym nośnikiem — komórki mają numer + obwódkę + ikonkę (blocker/review/luka dowodowa), czerwień wyłącznie na komórkach „Blocker". | `03-matrix-light-1600x1000.png`, `03-matrix-dark-*.png` |
| P4 | Live Matrix | light | 1600×1000 | Klik komórki → otwiera side sheet z pozycją (np. „1A · Poziom 1 — osiągnięty"); zamknięcie → macierz wraca DOKŁADNIE do tej samej pozycji/układu (brak przesunięcia scrolla, brak zmiany innych komórek). | `03c-matrix-before-click-*.png` → `03d-matrix-after-click-sidesheet-*.png` → `03e-matrix-after-close-*.png` |
| P5 | Split view (method-workspace) | light+dark | oba viewporty | Interview + Live Matrix jednocześnie, spójny z kanonem, zaznaczony stan „Częściowo" w kolorze warning (nie crimson). | `04-split-light-1600x1000.png` |
| P6 | Teresa (proposal) | light+dark | oba viewporty | Propozycja AI wizualnie odróżniona: osobna karta z ikoną ✨, nagłówkiem „Propozycja AI — draft_score_proposal", podglądem zmiany „2 → 3", ostrzeżeniem „Wymaga przeglądu człowieka" (amber) i akcjami Zaakceptuj/Zaakceptuj z edycją/Odrzuć/Przemyśl ponownie — jednoznacznie odróżnialna od zaakceptowanej treści pytań. | `05-teresa-light-1600x1000.png`, `06b-approval-actor-approver-light-1600x1000.png` (ten sam wzorzec) |
| P7 | Output | light+dark | 1600×1000 | Immutable: nagłówek „AssessmentOutput (immutable, v1)" z ikoną kłódki, `contentHash: 138537af9643e4…` widoczny, sekcja `limitations` opisana wprost („businessMeaning/recommendation to deterministyczne szablony, NIE analiza LLM"). | `07-output-light-1600x1000.png` |
| P8 | Report | light+dark | 1600×1000 | Snapshot jawnie oznaczony: „Renderowane ze snapshotu Outputu v1 — zmiana sesji po freeze nie zmieni tego raportu." | `07-output-light-1600x1000.png` (sekcja Report Snapshot na tym samym ekranie) |
| P9 | Initiative Proposal | light+dark | 1600×1000 | Disclaimer „NIE Registered Initiative" widoczny DWUKROTNIE: w nagłówku sekcji („Initiative Proposal Draft (lokalny, NIE Registered Initiative)") i w treści („DRAFT — DECYZJA „REGISTER AS INITIATIVE" NALEŻY DO CZŁOWIEKA, POZA TYM MODUŁEM."), kolor pomarańczowy/ostrzegawczy, nie crimson. | `07-output-light-1600x1000.png`, `09-initiative-dark-1600x1000.png` |
| P10 | Reopen | light | 1600×1000 | Baner rewizji: „Rewizja sesji 1b249791 (utworzona przez reopen — poprzedni Output pozostaje nietknięty, oznaczony jako superseded po ponownym freeze)." — amber, jednoznaczny. | `10-reopen-light-1600x1000.png` |
| P11 | 8 stanów HTTP (SERVER/SAVING/SAVED/OFFLINE/RECOVERY_DRAFT/CONFLICT/RECONNECTING/RECOVERED) | light+dark | 1600×1000, 1280×800 (24 kombinacje) | Każdy stan ma odrębny badge + kolor semantyczny (SERVER=zielony, SAVING=fiolet z spinnerem, SAVED=zielony, OFFLINE=pomarańczowy z „To NIE jest potwierdzony stan serwera", RECOVERY_DRAFT=pomarańczowy z licznikiem kolejki, CONFLICT=czerwony pełnoekranowy z diff + 2 akcje, RECONNECTING=fiolet spinner, RECOVERED=zielony z komunikatem „dane na ekranie są znowu w pełni zsynchronizowane"). Czerwień WYŁĄCZNIE na Conflict (realny bloker). | `11-http-*-light-1600x1000.png`, `11-http-*-dark-1600x1000.png`, `11-http-*-light-1280x800.png` (24 zrzuty) |
| P12 | Interview | light | 1600×1000 | Fokus klawiatury widoczny: po 6× Tab fokus na zakładce osi „5. Kultura Transformacji" ma wyraźny niebieski pierścień (`c-focus`), nie crimson. | `12a-interview-keyboard-focus-light-1600x1000.png` |
| P13 | Wszystkie ekrany | dark | oba viewporty | Tryb dark spójny na wszystkich sprawdzonych ekranach — brak wycieku crimson/navy/slate, poprawne tokeny `c-*`, kontrast czytelny. | wszystkie pliki `*-dark-*.png` (54 zrzuty) |
| P14 | Wszystkie ekrany | light | 1280×800 | Mniejszy viewport (1280×800) nie łamie layoutu: panel Teresa pozostaje widoczny (nie `hidden`), macierz w pełni widoczna, brak nachodzenia elementów. | `02-interview-light-1280x800.png`, `03-matrix-light-1280x800.png` i pozostałe `*-1280x800.png` |

---

## NOT VERIFIED — nie dało się sprawdzić w tym przebiegu

| # | Pozycja zakresu | Powód |
|---|---|---|
| N1 | Pkt 12 „loading" jako trwały, samodzielny stan | `BootstrapLoadingView` istnieje w kodzie (`DrdHttpMethodWorkspaceScreen.tsx`), ale jest tranzytywny (znika po pierwszej odpowiedzi serwera) — nie udało się złapać czystego zrzutu bez wyścigu. Alias `http-loading` (`forceState: 'loading'`) nie był w priorytetowej liście CEL-4 ośmiu stanów i nie został osobno przechwycony w tym przebiegu z braku czasu. |
| N2 | Pkt 12 „empty" jako dedykowany pusty ekran (zero jednostek/zero pytań) | Brak parametru URL/seed do wywołania tego stanu bez ingerencji w kod S3/S6. Częściowy substytut: „Brak oczekujących propozycji" w panelu Teresa (widoczny stale, PASS) i „Szkic"/`draft` w HTTP-screens, ale to nie jest test dedykowanego pustego zbioru danych. |
| N3 | Pkt 12 „brak uprawnień" jako WIDOK (nie akcja) | Sprawdzono tylko brak uprawnień do AKCJI (freeze — patrz D1). Nie sprawdzono scenariusza użytkownika bez ŻADNEJ roli próbującego otworzyć sesję (403 na poziomie widoku) — brak bezpiecznego sposobu wywołania tego bez ingerencji w seed ról w bazie współdzielonej przez wiele równoległych sesji S1–S7. |
| N4 | Pkt 12 „długi tekst" | Nie wstrzyknięto celowo bardzo długiego tekstu odpowiedzi/komentarza do sprawdzenia zawijania i przepełnień — pominięte z braku czasu w tym przebiegu. |
| N5 | `prefers-reduced-motion` | Zrzut z `reducedMotion: 'reduce'` (`12b-teresa-reduced-motion-light-1600x1000.png`) wygląda identycznie jak bez tej flagi — brak widocznej animacji do porównania w statycznym zrzucie, więc nie potwierdzono ani nie obalono respektowania tej preferencji (żaden zaobserwowany element nie ma oczywistej animacji do wyłączenia). |
| N6 | Approval — rola błędna w DARK i na 1280×800 | D1 potwierdzone interaktywnie i zrzutami tylko w light/1600×1000 (najbardziej przekonujący dowód: atrybut `disabled` odczytany programowo, niezależny od motywu/viewportu — defekt jest w logice, nie w CSS, więc nie oczekuję różnicy w innych kombinacjach, ale nie zrobiono dodatkowych zrzutów). |

---

## Bramki testowe (uruchomione, kody wyjścia)

```
npm run test:method-core:front
  → EXIT_CODE_FRONT=0
  → Test Files 33 passed (33) · Tests 246 passed (246) · 37.82s
  → log: docs/qa/a10-2026-08-13/gate-front.log

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://t:t@localhost:55495/t_test \
  npm run test:method-core:server
  → EXIT_CODE_SERVER=0
  → Test Files 13 passed (13) · Tests 161 passed (161) · 102.94s
  → log: docs/qa/a10-2026-08-13/gate-server.log
```

Oba gate'y PASS z realną liczbą testów (nie „0 tests found").

---

## Ryzyko środowiskowe zaobserwowane w trakcie audytu (do wiadomości, nie defekt produktu)

Serwer testowy (port 42500) był **trzykrotnie ubity SIGTERM-em** w trakcie audytu przez `pkill -f "tsx src/index.ts"` uruchamiany przez INNĄ równoległą sesję (widoczne w `ps aux`: proces `mac-s2-roles` z komendą zawierającą `pkill -f "tsx src/index.ts"; pkill -f "vite dev-render"`) — wzorzec pasuje po nazwie procesu do WSZYSTKICH worktree, nie tylko własnego. Każdorazowo zrestartowano serwer i wznowiono przechwytywanie (`FORCE_RECAPTURE`/skip-istniejących), finalnie 100% zrzutów HTTP-states bez błędów sieciowych. Brak wpływu na treść defektów D1–D5 (zweryfikowane na żywym, stabilnym serwerze). Warto zgłosić do backlogu: `pkill` w skryptach sprzątających innych sesji powinien być zawężony do PID-u/portu własnego worktree, nie do nazwy procesu.
