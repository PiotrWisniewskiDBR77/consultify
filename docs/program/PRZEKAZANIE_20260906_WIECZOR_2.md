# PRZEKAZANIE — 06.09.2026 wieczór (sesja Fable #23 → #24)

Właściciel 16:47: „wypełnia się kontekst; przerzuć pracę do kolejnego agenta bez zamykania robotników;
kolejny agent rozlicza się tym samym arkuszem postępu”. Ten plik = jedyny punkt wejścia następnej sesji.

## 0. Pierwsze 5 minut nowej sesji
1. Przeczytaj ten plik do końca, potem `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`
   (rejestr; nowe wiersze WSTAWIA SIĘ NAD kotwicą `| 1.5 P8 (wklejka 2) | \`codex/p8-teresa\` | WYDANE Codexowi 06.09 rano |`)
   i `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md` (plan).
2. Arkusz postępu (właściciel patrzy TYLKO na niego): `docs/program/plan-pojemniki/stan.json` →
   `node scripts/dev/plan-pojemniki/generuj.mjs` → skopiuj `docs/program/plan-pojemniki/PANEL.html` do scratchpadu
   jako `trzy-pojemniki.html` → opublikuj Artifact z `url=https://claude.ai/code/artifact/2a86e4bf-46b5-4056-a472-264dc4a26da6`
   (TEN SAM URL zawsze; bez `url` powstanie drugi arkusz — zakaz).
3. Katalog pracy: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, = to, co idzie na `origin/staging`).
   Bare: `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git`.
   Stanowisko lokalne: API 4100, vite 3090, PG 54400 (org DBR77 `cc9db573-…`), sesja `/private/tmp/stanowisko-noc/auth.json`.
4. `date '+%H:%M'` przed KAŻDYM wpisem czasu (dziś 4× wpisałem czas z głowy i prostowałem).

## 1. Stan na 17:07
- Paczka 8 WYPCHNIĘTA (`HEAD m03 na chwilę pushu`, run dispatch 17:07) — sprawdź health; jeśli gitSha ≠ HEAD sprzed dispatchu, patrz §5. Na stagingu po niej: R2, M-1, K5, R4, przekazanie. Zostają do scalenia: Codex P10 r2, P11 (M-2 i A2 już scalone lokalnie, niepushowane).
- Właściciel odebrał (TAK): Czat, Moja Praca, Organizacja, Panel administratora, Ustawienia, DRD hotfix.
  Ocenił: Wyniki „narzędzia świetne, sterowanie nie”; Inicjatywy karta „bez większych uwag”; Materiały „zachwycony”;
  ROI/OKR/KPI „naprawdę świetne, brak tylko menu 1–3 i Pracuj z AI”. Właściciel dojeżdża do ~95% zgłoszeń przeglądu.

## 2. Robotnicy W TOKU (worktree · gałąź · co · co zrobić z meldunkiem)
| worktree | gałąź | zadanie | po meldunku |
|---|---|---|---|
| `/private/tmp/codex-p10-karty-n` | `codex/p10-karty-n` | Codex, P10 runda 2 (wklejka 7 wydana właścicielowi 14:51) | gdy właściciel powie „Codex skończył”: `git -C /private/tmp/m03 fetch /private/tmp/codex-p10-karty-n HEAD && git merge --no-ff FETCH_HEAD` po obejrzeniu `P10/98_RAPORT.md`; 99_DECYZJE → jedna karta decyzji dla właściciela |
| `/private/tmp/codex-p11-plan-obciazenie` | `codex/p11-plan-obciazenie` | Codex, P11 Plan i Obciążenie (wklejka 8 wydana 16:10; paczka `P11_PLAN_I_OBCIAZENIE.md` na stagingu) | jw.; 5 decyzji już rozstrzygnięte przez CTO i wpisane do paczki |
Robotnicy piszą meldunki jako wynik Agenta (task-notification). SendMessage do agentów NIE działa w tej sesji — rozszerzenia = nowe zlecenie po scaleniu poprzedniego (ten sam plik = kolejka).

## 3. Kolejka po bieżących (w tej kolejności)
1. **Paczka 8 push+deploy** (§5), karta dla właściciela: Materiały + Wyniki (raporty zarządcze, karty) + Audyty.
2. **1.11 Statusy inicjatyw** (pojemnik 1, słowo właściciela 15:43): Fable pisze JEDNĄ tablicę statusów i przejść
   (status · kto zmienia · z→na · gdzie widać · co blokuje · kto nadaje priorytet) dla Inicjatyw, Wywiadu→inicjatywy,
   Oceny→inicjatywy, Narzędzi→inicjatywy, Audytów→propozycje, Realizacji→handoff; do akceptu właściciela; potem Codex (wklejka 9).
   Wejście: R3 znalezisko (draft KPI omija maker-checker), I2 (6 słowników statusów).
3. **A3 (Sonnet)**: usunąć flagę `ff_auditsReportChain` (default OFF, serwer nie bramkuje) — kebab „Generuj raport audytu/naprawczy” na Wynikach i „Sfinalizuj Output” w podglądzie Sesji mają być widoczne zawsze (te same czynności są już w CTA Menu 2 po A2).
4. **K6 (Sonnet)**: DEC-397b w 23 ekranach osadzających `JedenPrawyPanel` bezpośrednio (InterviewHub, MyProjects, taby Audytów/Oceny, MeetingHub) — ten sam `otworz()` w ich click-handlerach + aktualizacja `InterviewHub.jedenPanel.test.tsx`.
5. **Znaleziska do rozliczenia** (małe Sonnet): `OrgContextSummaryBanner.tsx:246` „Zapytaj Teresę o kontekst organizacji” (K4 nie ruszył);
   sekcja AKCJE w Podglądzie inicjatywy „0” z 3-zdaniowym tłumaczeniem; `TaskDetailView`/`DecisionDetailView` auto-zapis AI bez propozycji (K3);
   `PORTFOLIO_HEALTH` raport → DATABASE_ERROR; tytuły raportów zarządczych po angielsku (serwis); `ReportBuilder/TemplatePickerModal.tsx` EN+crimson;
   chipy TYP wniosków po angielsku (Wywiad); `dev-render/screens/audyty-drd-report.tsx` + e2e `aud-g4.spec.ts` wskazują usuniętą trasę;
   `playwright.config.ts:58` martwa zmienna PARTNER_SELF_CONNECT; 11 zastanych czerwonych `assessment/drd` po hotfixie Teresy;
   `GET /api/conclusions` synchronizuje całą org przy odczycie (O3); `InitiativesHub.smoke.test.tsx` fałszywy PASS (sessionStorage).
6. **Po pushu**: `railway variable delete` ×3 na stagingu (`VITE_INTERVIEW_PIPELINE_STEPPER`, `VITE_INTERVIEW_PENDING_REVIEW_TAB`,
   `VITE_TOOLS_INSIGHTS_WIRING`; kod usunięty) — TYLKO gdy nic się nie buduje (zmiana zmiennej = redeploy).
7. Pozostałe z planu: 1.9 re-audyt na danych właściciela, S1.11 zamrożenie tagami, S1.12 przekazanie do pojemnika 2,
   demo F1–F5 (runbook `docs/program/demo-pilotaz/`).

## 4. Procedura odbioru meldunku (obowiązkowa, w tej kolejności)
1. Obejrzyj ≥1 zrzut z `evidence/` robotnika (Read). Zrzut z harnessu dev-render ≠ produkt.
2. `git -C /private/tmp/m03 merge --no-ff <gałąź> -m "merge(<moduł>): … [ODMROZENIE <MODUL> DEC-<n>] …"`.
   Nazwy modułów TYLKO z `docs/program/MVP_FINAL_ZAMROZONE.json`: 13_CHAT 01_ORGANIZATION 02_INTERVIEW 03_TOOLS 04_ASSESSMENT
   05_INITIATIVES 06_EXECUTION 07_MY_WORK_AGENT 08_MEETINGS 11_MATERIALS 12_AUDITS 14_ADMIN 15_SETTINGS 16_PARTNER
   (Wyniki i Finanse NIE są zamrożone). Hook wypisze brakujące moduły — dodaj znaczniki i `git commit` ponownie.
3. **Merge stanął = sprawdź `git status`**: `UU` = konflikt (rozwiąż, `git add`, `git commit --no-edit`); brak `UU` a MERGE_HEAD istnieje = hook
   odrzucił wiadomość → tylko `git commit -m` z pełnymi znacznikami. NIGDY nie „sprzątaj” drzewa (`checkout HEAD -- …`) —
   tak powstał evil merge (rejestr 13:43, pamięć `evil-merge-po-hooku.md`).
4. Po scaleniu: `git ls-files <plik usuwany przez gałąź>` = 0 i `git diff HEAD <tip> -- <pliki gałęzi>` (poza translation.json/dev-render) = 0.
5. `git -C <bare> worktree remove --force <worktree>`; wiersz w rejestrze nad kotwicą (czas z `date`); `stan.json` gdy zmienia się stan pozycji/szampana.
6. Konflikty w `dev-render/main.tsx` są zawsze addytywne — po rozwiązaniu sprawdź brakujący `},` (2× dziś).

## 5. Push i deploy
`git push origin HEAD:staging` → `gh workflow run railway-deploy.yml --ref staging -f environment=staging` (bez `--ref` = pominięty).
Push sam NIE wyzwala workflow, ALE Railway auto-buduje z GitHuba → NIE pushuj nic (nawet docs) w trakcie budowy (3 równoległe buildy = 25 min).
Dowód wdrożenia = `curl -s https://staging.consultify.ai/api/health` `gitSha`, nie wynik runu (run pada na własnym limicie 15 min, Railway kończy sam).
Sygnał dla właściciela = jedno zdanie + jeden żywy obraz (zrzut z 3090 na HEAD: `ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth-fable.json
node scripts/dev/odbior-zywo/zrzut.mjs --url=… --port=3090 --host=127.0.0.1 --motyw=light --czekaj=6000 --out=…`; `--czekaj` działa PRZED klikami, `--czekaj-po` po).

## 6. Zlecanie robotników (wzór = dowolne zlecenie z tej sesji w transkrypcie; skrót)
Worktree: `git -C $BARE worktree add -b mvp/<id> /private/tmp/wt-<id> codex/m03-admin-20260824; printf '[core]\n\tbare = false\n' > $BARE/worktrees/wt-<id>/config.worktree; ln -s /private/tmp/m03/node_modules …`.
Zakazy w KAŻDYM zleceniu: sparse-checkout, git stash (podaj alternatywę `git show baza:plik`), worktree remove/prune, --no-verify, pkill, push, flagi,
rm -rf poza worktree, dotykanie m03/stanowisko-noc (poza cp auth.json), pełne tsc/vitest, staging/demo/prod, rekordy testowe. Podaj pliki innych robotników jako zakazane.
Dowód DEC-400: esbuild per plik, testy zastane PRZED (bez stash), nowe=0, mutacja celująca w zabezpieczenie → RED, zrzuty 1440 light z realnej trasy
(`scripts/dev/odbior-zywo/zrzut.mjs`, README `scripts/dev/stanowisko-lokalne/README.md`), commit-per-krok ze znacznikiem. Sonnet = mechanika, Opus = trudne/cross.

## 7. Decyzje właściciela z dzisiaj (skrót; pełne w rejestrze DEC-398…423d)
DEC-404 Teresa tylko w Menu 1 (dok zastępuje podgląd); DEC-407 CONFIRMED „Pracuj z AI” (Analizuj · Uzupełnij tę sekcję · Uzupełnij cały dokument)
w każdej karcie N + sticky + Edycja/Podgląd tylko z prawem; DEC-410/410b Wywiad bez steppera i „Dopuszczenia”; DEC-411 analiza kart N = S1.13 (P10);
DEC-412 Narzędzia Insighty≠Raporty, producent, CTA per zakładka; DEC-413 jeden generator inicjatyw (wzorzec Oceny); DEC-414 Ocena bez rzędów chipów
(filtr w Menu 2); DEC-415 DRD kolory stanów/Zapytaj Teresę/Podyktuj/nagłówek/czcionki/bez auto-przeskoku; DEC-416 Ocena „Nowy wniosek”;
DEC-417 Audyty (sidebar, bez DRD reports, Nowy audyt zamrożony, Menu 3, bez Ustaleń, generatory); DEC-418 Partnerzy podłączeni; DEC-419 bez „Zapytaj Teresę o…”
w panelach; DEC-420 Inicjatywy Menu 3 ≤3, bez pigułki FILTERS; DEC-397b podgląd wraca na klik; DEC-421 Plan/Obciążenie = narzędzia (P11 Codex);
DEC-422 Wyniki (bez Uwaga/Raport zarządczy, zakładka Raporty zarządcze, KPI bez UUID, karty N); DEC-423 Materiały (standard Menu 1–3, Biblioteka, Nowy wzorzec zamrożony).
Fala 2: 3.9–3.18 (m.in. 3.12 zatwierdzanie odpowiedzi wywiadu, 3.13 układ DRD, 3.14 PDF/PPT, 3.15 założenia audytu + generator pytań, 3.16 automatyzacja raportów,
3.17 źródła danych arkuszy, 3.18 nowe wzorce). Pojemnik 2: 2.10 (3–4 audyty od firm zewnętrznych). Pojemnik 1: 1.11 statusy inicjatyw.

## 8. Zasady komunikacji z właścicielem (potwierdzone dziś)
Krótko, po polsku, bez pytań o szczegóły; decyzje CTO podejmuj sam i zapisuj (właściciel zmienia jednym zdaniem); karta odbioru = jeden żywy obraz + Tak/Nie;
wklejki dla Codexa w bloku kodu (właściciel = listonosz); każde jego zdanie z przeglądu → wiersz w rejestrze (cytat + zakres + DEC) ZANIM wydasz zlecenie;
gdy zgłasza coś, co już naprawiono — sprawdź czas zrzutu vs deploy i poproś o odświeżenie (3× dziś).

## 9. KOORDYNACJA DWÓCH SESJI (17:08)
Sesja #24 już pracuje (worktree `wt-111-statusy-inicjatyw`, `wt-11z1-znaleziska-front`, `wt-11z2-znaleziska-serwer` widoczne o 17:08).
Sesja #23 SKOŃCZYŁA 17:14: M-2 scalone `cab6f65c61`, wiersz w rejestrze, `wt-11m2b` usunięty. Od teraz jedyna sesja nadzorcza = #24.
Sesja #24: M-2 jest w m03 — do następnej paczki (karta Materiałów dla właściciela po deployu).
Jeden pusher: sesja #24 od momentu przejęcia. Wspólny m03 = kolejka scaleń; sprawdzaj `git log -1` przed każdym merge.
