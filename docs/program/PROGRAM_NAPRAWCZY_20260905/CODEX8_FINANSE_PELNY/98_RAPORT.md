# E0-only integrator intake — DEC-470

Data: 2026-09-12. Stanowisko: lokalne E0 gotowe do niezależnego odbioru integratora. To NIE jest zakończenie CODEX8_FINANSE_PELNY ani zgoda na deploy.

Zakres tej dostawy został przez integratora jawnie ograniczony do E0/DEC-470: Finanse widoczne jako „Wkrótce / Coming soon”, jeden neutralny ekran na wejściu i deep-linkach. Pełne aktualne 01_INSTRUKCJA.md, 00_WKLEJKA.txt oraz wspólne Z1–Z24 przeczytano z vault `origin/integracja/20260911`. WT `codex8-finanse-pelny`, branch `codex/finanse-pelny-20260912`, baza/marker `0b5ba8337c`. Bez owner WIP, push, zdalnego runtime i zmiany domyślnych flag. Hook przypisuje współdzielone NavItem/menuConfig do 07_MY_WORK_AGENT; commit używa jawnych markerów WSPOLNE i 07_MY_WORK_AGENT z DEC-470 zgodnie z instrukcją CODEX8, bez omijania hooka.

## Pomiar i zmiana

Przed: beta Finance `closed`; zwykły użytkownik dostawał blokadę, OWNER omijał ją i montował EconomicsView; declutter usuwał Finanse. Niezależne pilot/public-production menu też blokowały wejście. Test zachowania przed poprawką: 9 FAIL / 2 PASS.

Po: osobny zbiór zapowiedzi przy istniejącym betaMenuStatus; backend pozostaje `closed` z dotychczasową semantyką administratorów. BetaGate po sprawdzeniu uwierzytelnienia renderuje zapowiedź, również dla OWNER, i nie montuje dzieci Finansów. Istniejące menu `soon`, neutralna powłoka MeetingsWave2Placeholder/NotFoundPage, bez nowej koncepcji UX. Pilot/public/declutter dopuszczają wyłącznie wejście do zapowiedzi. Spotkania i ich flaga default OFF bez zmian. API, migracje, dane finansowe i obliczenia nietknięte.

Route coverage: `/finance`, pięć istniejących typów `/finance/{statements,models,analyses,predictions,valuations}/:id`, wildcard `/finance/*`, alias `/economics` i wildcard `/economics/*`. Istniejące redirecty zachowane. Polskie i angielskie teksty, działający powrót do Czatu. Uwierzytelnienie i granice organizacji nie zostały zniesione.

## Dowody wykonane

- 42/42 testy, 6 plików, retry=0. Rzeczywisty render gate dla OWNER/ADMIN/USER/MEMBER, brak montowania dzieci, menu/pilot/public/declutter, auth, zachowanie Spotkań, rzeczywiste JSON i18n PL/EN oraz nawigacja przyciskiem.
- Mutacja: usunięcie Finance z COMING_SOON_MENU_IDS powoduje RED (9 błędów); przywrócenie kodu daje GREEN. Początkowy RED zachowany oddzielnie.
- Esbuild per zmieniony TS/TSX, synchronizacja 11 runtime mirrors `--check`, git diff --check PASS. Pełnego front tsc i build nie wykonywano: E0 odebrane na dev runtime, slot ciężkich buildów był zajęty przez C4.
- Prawdziwe POST `/api/auth/login` dla własnych OWNER i MEMBER, ApiGateway + canonical health/CSRF/inputSanitization mounts, realny PostgreSQL na `127.0.0.1:6459/cx8_e0`, kontener `cx-codex8-pg` pg18, pełny lokalny restore dostarczonego dumpu. Vite `5218`, API `4218`, bez mockowania HTTP w końcowym odbiorze. Redis jawnie mock w tym izolowanym harnessie; DB jawnie MOCK_DB=false/RUN_DB_TESTS=1.
- Dla obu ról: 9 deep-linków, HTTP200, ten sam ekran, klik menu z legacy deep-linka, declutter ON jako pojedynczy query override, PL nagłówek i powrót do Czatu. Zero żądań `/api/finance*`, `/api/economics*` ani wersjonowanych odpowiedników. Zero HTTP4xx/5xx w końcowych readbackach.
- 4 screenshoty 1440×1000, oglądnięte. Theme zmieniony rzeczywistym Zustand toggleTheme i potwierdzony w `consultify-storage.state.theme`. Stabilność body 3×400ms. Różnica luminancji OWNER 229.09, MEMBER 229.36 (>40).

Dowody: `evidence/finanse-wkrotce/` — screenshoty, readbacki bez tokenów/haseł, luma.json, RED/mutation/GREEN/esbuild logs. Runtime/harness źródła lokalnie w `../codex8-scratch/{api.mts,account.mjs,real-ui.mjs}`. Prywatny account.json pozostaje poza repo, nie jest dowodem do publikacji. Uwierzytelnienie pochodzi z realnego loginu HTTP; logowanie przez formularz i backend rate limiting/Redis nie są przedmiotem tego E0.

Odrzucone próby nie są dowodem: pierwszy harness bez MOCK_DB=false dostał 401 (mock DB); przy nim Redis połączył się z domyślnym localhost6379 przed zatrzymaniem. Końcowy harness używa wyłącznie własnego PostgreSQL i mock Redis. Początkowe 404 health/CSRF usunięto przez prawdziwe bootstrap mounts. Próba z fixture auth nie jest zaliczana. Przeglądarka blokowała zewnętrzne adresy; wynikające z tego ERR_FAILED dla zasobów zewnętrznych nie są finansowym API ani HTTP4xx. Pierwszy intro/onboarding modal został zamknięty zwykłą akcją „Skip for now”, nie zmianą produktu.

## Granica dostawy / nadal niewykonane

| Zakres | Stan tej dostawy |
| --- | --- |
| E0 / DEC-470 | Lokalnie udowodnione; oczekuje niezależnego odbioru integratora |
| KROK 0: funkcjonalny F-M2/M3/M4/M6/M7 | NIE MIERZONO — nie powielamy starszych deklaracji |
| E1, E2 i dalsze F-P1… pełnych Finansów | NIEWYKONANE W TEJ DOSTAWIE; Fala 2 |
| Minimum pełnego briefu E0+E1+E2 | NIE SPEŁNIONE przez E0-only; świadome ograniczenie integratora |
| Pełny backend tsc / dist build | NIE WYKONANO dla E0-only; żaden endpoint backendu nie zmieniony |
| Staging / demo / produkcja | NIE URUCHAMIANO, NIE DEPLOYOWANO |

Następny ruch: niezależny review E0 i integracja dokładnego commita. Pełne Finanse wracają jako odrębna dostawa Fali 2; ten raport nie zamyka ich backlogu.
