ZLECENIE 1.2 (pojemnik 1) — P1 dokończenie: Skrzynka (Moja Praca) i Wywiad na wzorzec JEDNEGO prawego panela „Rekord | Teresa". Praca do celu: pracujesz aż WSZYSTKIE progi z sekcji CEL OSIĄGNIĘTY są spełnione, potem raport. Język komunikacji i commitów: polski.

KROK 0 — KATALOG ROBOCZY (dokładnie tak):
git -C /Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git worktree add -b mvp/p1-skrzynka-wywiad /private/tmp/wt-p1-skrzynka-wywiad codex/m03-admin-20260824
ln -s /private/tmp/m03/node_modules /private/tmp/wt-p1-skrzynka-wywiad/node_modules
Pracujesz WYŁĄCZNIE w /private/tmp/wt-p1-skrzynka-wywiad. Pierwszy commit: zapisz treść tego zlecenia dosłownie do evidence/p1-skrzynka-wywiad/ZLECENIE.md.

ZAKAZY (nienaruszalne): git sparse-checkout; git stash; git worktree remove/prune; --no-verify; pkill/kill cudzych procesów (zabijasz tylko własny vite po PID); dotykanie /private/tmp/m03, stagingu, demo, produkcji; git push; tworzenie flag chowających pracę; własne tabele/panele zamiast kanonu; własne skrypty zrzutów obok scripts/dev/odbior-zywo/zrzut.mjs; edycja plików w server/migrations; pytania do właściciela (decydujesz w ramach specyfikacji, wątpliwość opisujesz w raporcie).

SPECYFIKACJA (przeczytaj w całości): docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md — §4.1 (jeden korzeń DOM = TableWithPreviewLayout, Teresa jako ZAKŁADKA, trzy stany panelu), §5 krok 5 (rodzina B przez JedenPrawyPanel), §6 testy, §10 progi. Kanon: docs/ui-standards/TRIADA_KANON.md, skill consultify-preview (6 bloków podglądu). Tokeny c-*, zero primary-* (crimson tylko dla stanu krytycznego), polszczyzna pl+en w public/locales.

WZORZEC DO SKOPIOWANIA (już scalony, działa): src/components/MyWork/MyTasksListContent.tsx (TableWithPreviewLayout linie ~2594–3184, z Teresą jako zakładką i lepkim zamknięciem), src/components/Execution/ExecutionHub.tsx (JedenPrawyPanel), src/components/shared/PreviewPane/JedenPrawyPanel.tsx, src/components/shared/PreviewPane/useJedenPanel.ts, src/components/shared/TableWithPreviewLayout.tsx.

CELE (dwa ekrany):
(A) Skrzynka: src/components/MyWork/InboxContent.tsx ok. linii 4318–4332 — renderuje WŁASNY <aside data-preview-pane> ze StandardPreview poza wzorcem (bez zakładki Teresa, bez lepkiego zamknięcia, bez nakładki <1440).
(B) Wywiad: src/components/Interview/InterviewHub.tsx ok. linii 8619 — WŁASNY <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 ..."> ze StandardPreview (do tego kolory spoza tokenów c-*). Sprawdź też src/components/Interview/QuestionsList.tsx (importuje TableWithPreviewLayout — może być już poprawny).
HIPOTEZA NADZORCY DO ZWERYFIKOWANIA PRZED KODOWANIEM (może być fałszywa): „oba ekrany renderują panel poza TableWithPreviewLayout, więc przy zaznaczonym wierszu i otwartej Teresie z Menu 3 licznik aside = 2, przy 1280 px tabela Skrzynki kurczy się poniżej 1000 px, a klik w wiersz po X otwiera panel ponownie". ZMIERZ to najpierw (zrzuty PRZED z --dom="aside" na 1280/1440) i zapisz wynik w raporcie; jeśli hipoteza jest fałszywa w którymś punkcie — napisz to wprost i dostosuj zakres.

MODUŁY ZAMROŻONE: 07_MY_WORK_AGENT (Skrzynka) i 02_INTERVIEW (Wywiad). KAŻDY commit dotykający ich plików musi mieć w opisie marker [ODMROZENIE 07_MY_WORK_AGENT DEC-397] albo [ODMROZENIE 02_INTERVIEW DEC-397]. Hook odrzuci commit bez markera — to zamierzone, nie obchodź.

CO ROBISZ: (1) pomiar PRZED (hipoteza); (2) Skrzynka na JedenPrawyPanel/TableWithPreviewLayout z zakładkami „Rekord | Teresa", jeden X, lepkie zamknięcie (po X klik w wiersz NIE otwiera panelu; wraca pigułką „Pokaż panel"/„Teresa" w Menu 3), nakładka poniżej 1440 px, Teresa z Menu 3 bez zaznaczenia = ta sama kolumna z zakładką Teresa, rejestr gospodarzy registerEmbeddedModuleChatHost (globalny dok Teresy nie powstaje); (3) to samo dla Wywiadu, plus usunięcie kolorów spoza tokenów (bg-slate-50/dark:bg-navy-950 → tokeny c-*); (4) testy jednostkowe z DOWODEM MUTACYJNYM (dla każdego: opisz mutację, która musi zabić test, uruchom ją, pokaż RED, cofnij): T1 Skrzynka renderuje dokładnie jeden aside przy zaznaczonym wierszu i otwartej Teresie; T2 po zamknięciu X klik w wiersz nie otwiera panelu (lepkie zamknięcie); T3 to samo dla Wywiadu; T4 brak klas spoza tokenów w obu panelach; (5) i18n pl+en dla każdego nowego napisu; (6) zrzuty na żywo.

ŚRODOWISKO NA ŻYWO (lokalne stanowisko, NIE staging): API już działa na http://127.0.0.1:4100 (baza lokalna z seedami DBR77, konto audyt@dbr77.local). Własny vite Z TWOJEGO worktree na wolnym porcie 3091 (sprawdź lsof -nP -iTCP:3091 -sTCP:LISTEN; jeśli zajęty weź 3092…):
cd /private/tmp/wt-p1-skrzynka-wywiad && VITE_DOTENV_DISABLED=1 VITE_API_TARGET=http://127.0.0.1:4100 VITE_API_URL= nohup npx vite --port 3091 --strictPort --host 127.0.0.1 > /private/tmp/wt-p1-skrzynka-wywiad/vite.log 2>&1 & echo $! > /private/tmp/wt-p1-skrzynka-wywiad/vite.pid
Sesja: cp /private/tmp/stanowisko-noc/auth.json /private/tmp/stanowisko-noc/auth-p1.json i używaj ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth-p1.json. Zrzuty kanonicznym przyrządem:
ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth-p1.json node scripts/dev/odbior-zywo/zrzut.mjs --url=/my-work --port=3091 --host=127.0.0.1 --szerokosc=1280 --motyw=light --dom="aside" --klik="..." --out=evidence/p1-skrzynka-wywiad/01-skrzynka-1280-jasny.png
(opcje: --klik wielokrotnie, --dom liczy selektor i zapisuje do .json obok obrazka, --szerokosc, --motyw=dark daje sufiks __dark). Trasy: Skrzynka = /my-work (zakładka Skrzynka), Wywiad = /interview (sprawdź realną trasę w src/App albo routerze). Po pracy zabij TYLKO własny vite: kill $(cat /private/tmp/wt-p1-skrzynka-wywiad/vite.pid).

CEL OSIĄGNIĘTY = WSZYSTKIE naraz (§10):
- npx esbuild <każdy zmieniony plik .tsx/.ts> --bundle --platform=browser --outdir=/tmp/esb-p1 --log-level=error --loader:.png=file --loader:.svg=file → exit 0 dla KAŻDEGO pliku („Transform failed" = błąd komendy, nie zielone);
- npx vitest run <pliki testów, które dodałeś + src/components/shared/PreviewPane/__tests__ + src/components/MyWork/__tests__/*Inbox* + src/components/Interview/__tests__> → PASS, z dowodem mutacyjnym T1–T4 opisanym w raporcie (RED→GREEN); „No test files found" = błąd, nie PASS;
- bash scripts/check-list-canon.sh && bash scripts/check-artefakt.sh → OK, dług nie rośnie;
- git diff --name-only codex/m03-admin-20260824..HEAD -- server/migrations → pusto; jeśli dotknąłeś server/src (nie powinieneś): cd server && npx tsc --build tsconfig.build.json exit 0;
- zrzuty w evidence/p1-skrzynka-wywiad/: dla KAŻDEGO z 2 ekranów × szerokości 1280/1440/1920 (jasny) + 1280 ciemny, w trzech stanach: (a) wiersz zaznaczony, (b) Teresa otwarta z Menu 3, (c) po X. Progi z .json: (a) i (b) dom.aside.count = 1, (c) = 0; po (c) klik w wiersz → nadal 0 (zrzut d); Skrzynka 1280: szerokość elementu table ≥ 1000 px (zmierz --dom="table" albo przez .json geometry, opisz jak); bledyKonsoli = 0; zero odpowiedzi ≥ 400; zrzut ciemny różni się od jasnego średnią jasnością (nie ta sama fotka pod dwiema nazwami); zero napisów po angielsku w panelu; zero surowych UUID.
- commit per krok, autor domyślny, bez push; markery odmrożenia w każdym commicie dotykającym modułów zamrożonych.

STOP: próg niespełnialny bez decyzji właściciela albo bez pliku poza zakresem (np. zmiana w MainLayout.tsx) → zatrzymaj się, opisz, nie obchodź.

RAPORT (ostatnia wiadomość, po polsku, zwięźle, bez lukru): wynik pomiaru PRZED (czy hipoteza nadzorcy była prawdziwa, liczby); lista commitów (SHA + tytuł); tabela progów §10 z wartościami (spełniony/nie); dowody mutacyjne T1–T4 (mutacja → RED → cofnięta → GREEN); ścieżki wszystkich zrzutów z licznikami aside; co NIE zostało zmierzone i dlaczego; ścieżka worktree i gałąź. Nie pisz „gotowe" bez SHA i zrzutów.
