ZLECENIE 1.8 (pojemnik 1) — Dług i18n: 484 klucze pl==en w ratchecie → ≤ 300, 141 kluczy Czatu z dyżuru 374 przetłumaczone, 16 testów z mockiem react-router bez useLocation naprawionych. Praca do celu: pracujesz aż WSZYSTKIE progi z CEL OSIĄGNIĘTY są spełnione, potem raport. Język: polski.

KROK 0 — KATALOG ROBOCZY (dokładnie tak):
git -C /Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git worktree add -b mvp/i18n-dlug-1 /private/tmp/wt-i18n-dlug-1 codex/m03-admin-20260824
ln -s /private/tmp/m03/node_modules /private/tmp/wt-i18n-dlug-1/node_modules
Pracujesz WYŁĄCZNIE w /private/tmp/wt-i18n-dlug-1. Pierwszy commit: treść tego zlecenia dosłownie do evidence/i18n-dlug-1/ZLECENIE.md.

ZAKAZY (nienaruszalne): git sparse-checkout; git stash; git worktree remove/prune; --no-verify; pkill/kill cudzych procesów; dotykanie /private/tmp/m03, stagingu, demo, produkcji; git push; edycja server/migrations; obniżanie progu/whitelistowanie w teście zamiast tłumaczenia (jedyne dopuszczalne wyjątki: nazwy własne i skróty, które po polsku brzmią tak samo — „Consultify”, „KPI”, „OKR”, „ROI”, „NPV”, „IRR”, „PDF”, „OK”, „E-mail” — każdy wyjątek wymieniony w raporcie z uzasadnieniem); zmiana plików modułów zamrożonych poza public/locales i testami bez markera [ODMROZENIE <MODUL> DEC-397] w commicie; pytania do właściciela.

KONTEKST I ŹRÓDŁA:
- Ratchet: tests/unit/i18n/i18nTrescPolska.test.ts + tests/unit/i18n/i18nTrescPolska.baseline.json (klucze, których wartość pl jest identyczna z en — „klucz istnieje ≠ przetłumaczony”). Zmierz stan wyjściowy własną komendą (liczba wpisów baseline) — hipoteza nadzorcy „484” może być nieaktualna; zamelduj realną liczbę.
- P3 (koniec angielskiego): docs/program/PROGRAM_NAPRAWCZY_20260905/P3_KONIEC_ANGIELSKIEGO.md — §4 zasady, §10 komendy strażników (stop-lista EN, strażnik pl≠en). Użyj DOKŁADNIE tych strażników; nie pisz własnych.
- 141 kluczy Czatu: dyżur 374 — znajdź listę (rg -n '374' docs/program docs/dyzury 2>/dev/null; rg -l 'chat\.' tests/unit/i18n/i18nTrescPolska.baseline.json). Jeśli lista nie istnieje jako plik, zbuduj ją z baseline (klucze chat.*/aiChat.*) i zamelduj liczbę.
- Pliki: public/locales/pl/translation.json i public/locales/en/translation.json (pl dostaje POLSKĄ wartość; en zostaje angielski; zero polskich wartości w en i odwrotnie).
- 16 testów z mockiem react-router bez useLocation: znajdź je (rg -l "vi.mock\\('react-router-dom'" src tests | xargs rg -L 'useLocation' — zweryfikuj liczbę własnym pomiarem, „16” to hipoteza nadzorcy). Napraw mock (dodaj useLocation/useNavigate wg realnego użycia), NIE wyłączaj testów (zero it.skip/describe.skip, zero zmian asercji na luźniejsze).

KOLEJNOŚĆ: (1) pomiar wyjściowy (liczby: baseline, chat.*, admin.*, testy z mockiem); (2) tłumaczenie po rodzinach kluczy — najpierw chat.* (Czat jest pierwszym ekranem ścieżki pokazu), potem admin.*, settings.*, potem reszta wg liczebności; każda rodzina = osobny commit, po każdym commicie ratchet zmniejszony w baseline.json o klucze przetłumaczone (usuwasz je z baseline — to jest „dług nie rośnie i maleje”); (3) mock react-router; (4) pomiar końcowy.

TŁUMACZENIE — JAKOŚĆ: polszczyzna produktowa, zwięzła, styl jak istniejące polskie klucze w tym samym pliku (przejrzyj 30 sąsiednich kluczy zanim przetłumaczysz rodzinę); wielkość liter jak w oryginale; placeholdery {{x}} zachowane co do znaku; żadnych „Kliknij tutaj”, żadnych kalk („Dashboard” → „Kokpit”, „Insights” → „Wnioski”, „Submit” → „Wyślij”/„Zapisz” wg kontekstu, „Owner” → „Właściciel”, „Due date” → „Termin”). Gdy klucz jest używany w kodzie w kontekście, którego nie rozumiesz — rg po kluczu i przeczytaj komponent.

CEL OSIĄGNIĘTY = WSZYSTKIE naraz:
- npx vitest run tests/unit/i18n/i18nTrescPolska.test.ts → PASS; liczba wpisów baseline ≤ 300 (cel), z czego chat.* = 0 pozostałych;
- strażniki z P3 §10 (dokładnie te komendy) → OK / dług nie rośnie;
- node -e "JSON.parse(require('fs').readFileSync('public/locales/pl/translation.json'))" i to samo dla en → bez błędu; brak zduplikowanych kluczy (sprawdź skryptem jednolinijkowym);
- DOWÓD MUTACYJNY ratchetu: cofnij JEDEN przetłumaczony klucz do wartości angielskiej bez dodawania go do baseline → test i18nTrescPolska musi być RED; przywróć → GREEN (opisz w raporcie);
- npx vitest run <naprawione pliki testów z mockiem react-router> → PASS, zero skip; „No test files found” = błąd;
- pomiar na żywo (lokalne stanowisko, NIE staging): API na http://127.0.0.1:4100 już działa; własny vite z Twojego worktree na porcie 3093 (jeśli zajęty: 3094): cd /private/tmp/wt-i18n-dlug-1 && VITE_DOTENV_DISABLED=1 VITE_API_TARGET=http://127.0.0.1:4100 VITE_API_URL= nohup npx vite --port 3093 --strictPort --host 127.0.0.1 > /private/tmp/wt-i18n-dlug-1/vite.log 2>&1 & echo $! > /private/tmp/wt-i18n-dlug-1/vite.pid; sesja: cp /private/tmp/stanowisko-noc/auth.json /private/tmp/stanowisko-noc/auth-i18n.json; zrzuty kanonicznym przyrządem: ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth-i18n.json node scripts/dev/odbior-zywo/zrzut.mjs --url=/chat --port=3093 --host=127.0.0.1 --szerokosc=1440 --out=evidence/i18n-dlug-1/01-czat-1440.png (i tak samo dla /admin lub trasy Administracji oraz /settings — sprawdź realne trasy w routerze). Progi: bledyKonsoli = 0; w tekście widocznym każdego z 3 zrzutów zero tokenów ze stop-listy EN z P3 (użyj strażnika P3 na tekście strony albo get z .json zrzutu — opisz jak zmierzyłeś); zrzuty PRZED i PO dla Czatu.
- Po pracy zabij TYLKO własny vite: kill $(cat /private/tmp/wt-i18n-dlug-1/vite.pid).

STOP: próg ≤ 300 nieosiągalny bez decyzji właściciela (np. klucze będące nazwami funkcji, których polską nazwę musi ustalić właściciel) → zatrzymaj się przy osiągniętym minimum, wypisz listę kluczy wymagających decyzji (klucz, en, propozycja pl), nie obchodź.

RAPORT (ostatnia wiadomość, po polsku, zwięźle): liczby PRZED/PO (baseline razem, chat.*, admin.*, inne; testy z mockiem: ile znalezionych, ile naprawionych); lista commitów (SHA + tytuł); wynik każdej komendy z CEL OSIĄGNIĘTY; dowód mutacyjny; wyjątki nazw własnych z uzasadnieniem; ścieżki zrzutów; klucze do decyzji właściciela; co NIE zostało zmierzone; worktree i gałąź. Nie pisz „gotowe” bez liczb i SHA.
