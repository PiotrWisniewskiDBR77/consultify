# Built candidate smoke — 2026-09-12

Wynik: **PASS ograniczonej funkcjonalności z dwiema obserwacjami**, nie odbiór całego MVP. Frontend z root `ad7618df32266a73c29c449854eb89a0b53a37de`, istniejący backend C8 na 4218 (real ApiGateway/JWT/PG cx8_e0, Redis mock zgodnie z wcześniejszym harness). Nie jest to test całego backendu scalonego kandydata.

## Identyfikacja i dowody

- WT root: `/Users/piotrwisniewski/Developer/codex-wt/codex-integrator-mvp-20260912`; build `INTEGRATION_BUILD_INTERVIEW.log`: exit0, 39.08s. Bez nowego builda.
- SHA256 dist/index.html: `4e5d3a0d2df23e3cfdb8f70f717e76a6fb8591836cb9e83a31e305e1424ab213`.
- Preview5290 uruchomiony dopiero po potwierdzeniu wolnego portu, `--strictPort`, jawny root/dist i proxy4218. Własna exec session44223 pozostaje do przekazania integratorowi. Nie restartowano API4218, Vite5218 ani baz.
- Końcowe dowody: `built-smoke-ad7618df32-20260912-c/`: harness.mjs, readback.json, luma.json, 16 PNG. Run node exit0. Katalogi a/b zachowane jako wcześniejsze próby przyrządu, nie końcowy PASS.
- Realne logowanie formularzem dla OWNER i MEMBER. Konto odczytywane w pamięci z prywatnego account.json; brak kopiowania haseł, tokenów, HAR lub trace. Preferencje motywu/języka inicjalizowane bez mockowania auth. Brak /src imports, /@vite/client i mockowania odpowiedzi API.

## Macierz końcowa

| Rola / motyw | Finance 9 | Auth redirect + login | Meetings 3 istniejące | Meetings dodatkowy wildcard | Help | Wizualny |
|---|---|---|---|---|---|---|
| OWNER light | 9/9 PASS | PASS | 3/3 PASS | NotFound; założenie harnessu FAIL, nie blocker produktu | PASS | PASS |
| OWNER dark | 9/9 PASS | PASS | 3/3 PASS | NotFound; założenie harnessu FAIL, nie blocker produktu | PASS | PASS |
| MEMBER light | 9/9 PASS | PASS | 3/3 PASS | NotFound; założenie harnessu FAIL, nie blocker produktu | PASS | PASS |
| MEMBER dark | 9/9 PASS | PASS | 3/3 PASS | NotFound; założenie harnessu FAIL, nie blocker produktu | PASS | PASS |

Finance9: `/finance`, `/finance/statements/cx8`, `/finance/models/cx8`, `/finance/analyses/cx8`, `/finance/predictions/cx8`, `/finance/valuations/cx8`, `/finance/unknown/cx8`, `/economics`, `/economics/legacy/cx8`. Wszędzie neutralna zapowiedź i HTTP200; menu Finance Coming soon klikalne, również declutter queryON. OWNER nie omija zapowiedzi. Anonymous `/finance?smoke=built` przekierowuje do login z zachowanym redirect; logowanie wraca do Finance.

Meetings4: `/meetings`, `/meetings/cx8`, `/meeting?meetingId=cx8` renderują zapowiedź, legacy przekierowuje do `/meetings/cx8`; `/meetings/unknown/cx8` renderuje Page not found (HTTP200 dla SPA shell). Meetings niewidoczne w menu. Wszystkie cztery adresy faktycznie sprawdzono dla czterech kontekstów; tylko trzy są trasami aplikacji.

Help4: brak chunku przed otwarciem; pierwsze otwarcie pobiera HelpSidePanel; FAQ filter faktycznie renderuje No matching questions; zamknięcie/ponowne otwarcie zachowuje filtr i wynik, bez ponownego pobrania chunku. Artykuły, deeplink FAQ i wszystkie zakładki **NOT_PROVEN w tym smoke**.

Łącznie zero odpowiedzi HTTP4xx/5xx, zero pageerror, zero żądań API Finance/Economics/Meetings i zero chunków MeetingHub/MeetingObjectPage. Zewnętrzne GoogleTagManager/fonts.googleapis.com blokowane przez przyrząd: 34 próby na kontekst (136 razem); nie deklarujemy zero błędów zasobów zewnętrznych ani odbioru zewnętrznych fontów/analytics. Nie wykonywano połączeń live.

## Kwalifikacja obserwacji ze źródłami

1. **Nieznany Meetings wildcard — rozjazd scenariusza, nie wykazany defekt kontraktu.** Root `src/routes/routeConfig.ts:130–143` definiuje listę, obiekt, minutes, decisions, note i alias singular. Root `src/routes/AppRoutes.tsx:2802–2966` ma konkretne trasy; nie ma wildcard obsługującego dowolne zagnieżdżenia. Komentarze w AppRoutes343/1058 mówią szeroko /meetings/**, lecz nie są wystarczającym mandatem rozszerzenia zakresu o celowo nieistniejącą trasę. Poprzedni C8 raport `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX8_FINANSE_PELNY/98_RAPORT.md:5–22` wymaga dziewięciu Finance deep-linków i zachowania Spotkań/defaultOFF; nie dowodzi wymogu dowolnego Meetings wildcard. **Minutes/decisions/notes są istniejącymi dodatkowymi trasami: ich runtime NOT_PROVEN w tej ograniczonej macierzy**, choć źródło zawiera placeholder gate. Nie rozszerzano testu po końcowej instrukcji integratora.

2. **Anonymous Finance pobiera MainLayout przed poprawnym redirect.** Potwierdzone 4/4, `MainLayout-1TxkLwhq.js` widoczny w publicJs. Root AppRoutes2491–2591 renderuje powłokę przed wewnętrznym BetaGate. Osobny świeży kontekst direct `/login` PASS bez MainLayout/Help. Poprzedni `POMIAR_BUNDLE_20260912.md:64` dowodzi literalnego public `/auth`, a nie każdego wejścia anonimowego na prywatny deeplink. Sformułowania linii9 o odkładaniu na wejście zalogowane nie wolno generalizować: nowe zachowanie ogranicza taką deklarację. To obserwacja kosztu publicznego deeplinka, **nie obejście auth**; transfer/czas renderu całego pierwszego ekranu nie był tu mierzony, więc performance globalny NOT_PROVEN. Nie zmieniamy produktu na podstawie nowego założenia harnessu.

Surowy status JSON `PARTIAL_RECORDED_FINDINGS` zachowany: przyrząd konserwatywnie oznacza obie obserwacje. Niniejsza kwalifikacja rozdziela PASS funkcjonalny, FAIL założenia dodatkowej trasy oraz granice performance. Nie przepisywano raw evidence na bezwarunkowy PASS.

## Oględziny PNG

Obejrzano wszystkie16 PNG 1440×1000: Finance, Meetings, Help i NotFound dla obu ról/motywów. Brak pustego białego ekranu, crasha, obciętego głównego komunikatu lub nakładania kontrolek. Finance ma neutralną etykietę Coming soon bez lock/red; inne moduły MEMBER zachowują swoje dotychczasowe blokady. Help ma czytelny panel, zachowany wynik filtra i prawidłowe przyciemnienie tła.

Średnia luminancja Finance OWNER light247.444 / dark18.121, delta229.323; MEMBER247.567 /17.978, delta229.589. Obie >40, potwierdzone również stanem theme i html.dark. Szczegóły wszystkich16 w luma.json. To odbiór wizualny tej macierzy, nie całego UI ani ocena wszystkich treści Help.

## Przekazanie

Integratora upoważnia się technicznie do przejęcia własnego preview5290/session44223; API4218 i Vite5218 pozostają poprzednimi runtime C8 bez zmian. Bez zmian kodu produktu, flag domyślnych, schematu, buildów i commitów. Nie ma podstaw do globalnego MVP/deploy PASS z tego wyniku.


## Addendum — dopełnienie istniejących tras Meetings (ostatni wynik)

Na dodatkowe jawne polecenie integratora wykonano tylko12 wejść: `/meetings/cx8/minutes`, `/meetings/cx8/decisions`, `/meetings/cx8/notes/cx8-note` × OWNER/MEMBER × light/dark. Osobny katalog `built-smoke-ad7618df32-20260912-d-meetings/`, harness.mjs + readback.json +12PNG; node exit0, raw status **PASS**. Bez powtarzania macierzy36Finance i Help; logowanie odbyło się ponownie prawdziwym formularzem.

| Rola / motyw | Minutes | Decisions | Notes | HTTP błędy / pageerror |
|---|---|---|---|---|
| OWNER light | PASS | PASS | PASS | 0 / 0 |
| OWNER dark | PASS | PASS | PASS | 0 / 0 |
| MEMBER light | PASS | PASS | PASS | 0 / 0 |
| MEMBER dark | PASS | PASS | PASS | 0 / 0 |

W każdym przypadku zapowiedź Meetings, HTTP200, docelowy URL zachowany, Meetings nieobecne w menu, prawidłowy theme i html.dark; zero żądań finansowych/Meetings API, zero MeetingHub/MeetingObjectPage i importów deweloperskich. Dodatkowe32 zablokowane próby zewnętrznych fontów/analytics (8/kontekst) są ograniczeniem przyrządu jak wyżej. Obejrzano wszystkie12 nowychPNG: czytelny placeholder, poprawna powłoka, brak crasha/białego ekranu/obcięcia komunikatu. Razem obejrzano28PNG końcowych c+d.

**Aktualizacja kwalifikacji:** wcześniejsze NOT_PROVEN dla minutes/decisions/notes jest zamknięte dowodem12/12PASS. Łącznie istniejące wejścia Meetings to6adresów×4konteksty=24/24PASS (lista, obiekt, legacy z id, minutes, decisions, note). Celowo nieistniejące zagnieżdżenie pozostaje NotFound bez produktowego blockera. Pozostałe ograniczenia Help/performance/pełnegoMVP i hybrydowego backendu nie zmieniają się.

Wyłączność preview5290/session44223 oraz użyciaC8backend4218 do tego testu przekazana root po zakończeniu. Brak dalszych aktywnych harnessów; istniejące API4218/Vite5218 bez restartu i zmian.
