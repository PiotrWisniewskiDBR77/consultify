# ODBIÓR — Dyżur 225 (Narzędzia)

Audytor: sesja adwersaryjna, 2026-09-01. Worktree: `/private/tmp/cx-day225-narzedzia`,
gałąź `codex/day225-narzedzia-20260901`, HEAD `94684be8ac` na markerze `0a35699021`
(podniesionym z `9fb7942a01`).

## Werdykt: **A-**

Sprostowanie kłamliwego komentarza jest kompletne i dowiedzione mutacyjnie w obie
strony; flaga pozostaje domyślnie WYŁĄCZONA; retest jest udowodnienie lokalny. Jeden
prawdziwy, uczciwie zgłoszony (nie ukryty) resztkowy problem poza licencją tego dyżuru,
plus jedna drobna niedopatrzona niespójność artefaktu.

## Co zweryfikowałem sam (nie z raportu)

1. **Trzy miejsca, nie jedno.** `grep -n "NIE ISTNIEJE\|nie istnieje na bazie\|does not
   exist on the staging" src/utils/toolsInsightsWiringFlag.ts` — **zero trafień** po
   naprawie. Diff pokazuje poprawki dokładnie w trzech blokach komentarza (nagłówek
   modułu, opis kolejności rozstrzygania, komentarz nad `isToolsInsightsWiringEnabled`),
   zgodnie z tabelą licencji instrukcji (`:27-28`, `:45-46`, `:97`).
2. **Mutacja odtworzona przeze mnie, w obie strony.** Podmieniłem
   `toolsInsightsWiringFlag.ts` na wersję z bazowego markera `0a35699021` (starą, kłamliwą)
   i uruchomiłem `toolsInsightsWiringFlag.day225.commentAccuracy.test.ts` —
   **2 failed** (dokładnie te testy, które sprawdzają nowe zdanie i brak starych fraz).
   Przywróciłem plik z powrotem — **2 passed**, `git status` czysty. Zgadza się z
   `comment-mutation-red.json` / `comment-restored-green.json` w raporcie.
3. **Kod wykonywalny nietknięty, flaga wciąż OFF.** `resolved = fromQuery ?? fromLs ??
   fromEnv ?? false` w `src/utils/toolsInsightsWiringFlag.ts:118` — dokładnie ten sam
   fallback co przed dyżurem. `git diff 0a35699021..HEAD` nie zawiera żadnego pliku
   `.env*`, `docker-compose*`, Railway configu ani ustawienia
   `VITE_TOOLS_INSIGHTS_WIRING`; jedyne wystąpienia zmiennej w diffie to opisy w
   dokumentacji stwierdzające, że pozostaje domyślnie WYŁĄCZONA. **Reguła 9 CLAUDE.md
   (zakaz masowego włączania flag) nienaruszona.**
4. **Retest lokalny, nie staging.** Artefakt dowodowy
   `/private/tmp/cx-day225-narzedzia-artefakty/day225-tool-outputs-http-db-evidence.json`
   pokazuje `database: "cx225"`, `address: "172.17.0.5/32"` (prywatny adres Docker,
   nie host stagingu), `port: 5432`. `grep` po diffie i raporcie nie zwraca żadnego adresu
   spoza `127.0.0.1`. Raport wprost odnotowuje, że stara treść `ZNALEZISKO_TOOL_OUTPUTS.md`
   kazała retestować **na stagingu**, i że wykonawca **świadomie odrzucił** tę instrukcję
   powołując się na `Z28` — to jest poprawna decyzja, nie pominięcie.
5. **Weryfikacja „500 wywraca cały hub" — sprawdzona w kodzie, nie przepisana z dokumentu.**
   `grep` w `src/components/Discovery/DiscoveryToolsHub.tsx:1081-1087` potwierdza istniejący
   `.catch()`, który zwraca `{ outputs: [] }` i loguje ostrzeżenie zamiast rzucać dalej.
   Raport (`W4`) to stwierdza dosłownie: „obawa o pełnoekranowy crash nie odpowiada
   obecnej ścieżce" — czyli wykonawca **obalił** starą obawę pomiarem, nie przepisał ją
   automatycznie z instrukcji. Zrzut `day225-tools-insights-local.png` potwierdza pusty,
   nie awaryjny stan zakładki Insighty.
6. **Zgłoszony, nie ukryty, resztkowy problem.** Istniejący plik
   `src/utils/__tests__/toolsInsightsWiringFlag.test.ts:18` nadal ma w nazwie `describe`
   frazę „cofnięte 28.08, DEC-158: tool_outputs nie istnieje na bazie staging" —
   potwierdzone przeze mnie grepem. Ten plik **nie był** w tabeli licencji zapisu tego
   dyżuru (tylko odczyt dozwolony dla powiązanych plików), więc pozostawienie go
   nietkniętym jest zgodne z licencją — i wykonawca to jawnie zgłosił w sekcji „Korekty
   wobec instrukcji" zamiast milczeć albo przekroczyć zakres.

## Odpowiedzi wprost

**(a) Czy sprostowano wszystkie trzy miejsca, czy jedno?** Wszystkie trzy — potwierdzone
grepem i mutacją w obie strony.

**(b) Czy retest zrobiono lokalnie, bez stagingu?** Tak — baza `cx225` na wewnętrznym
adresie Dockera `172.17.0.5:5432`, żadnego zdalnego hosta w diffie/raporcie, i jawne
odrzucenie starej instrukcji nakazującej staging (powołanie się na `Z28`).

**(c) Czy flaga jest nadal domyślnie WYŁĄCZONA?** Tak — kod fallbacku niezmieniony,
żaden plik env/compose/Railway niedotknięty; retest wykonano wyłącznie przez query
override `?ff_toolsInsightsWiring=1`, nie przez zmianę defaultu.

## FIX-y (do kolejnego dyżuru, nieblokujące tego odbioru)

1. **Resztkowe kłamstwo w istniejącym teście** —
   `src/utils/__tests__/toolsInsightsWiringFlag.test.ts:18` — nazwa `describe` nadal
   twierdzi, że `tool_outputs nie istnieje na bazie staging`. Poza licencją Day225,
   wymaga osobnego wąskiego dyżuru na sprostowanie (analogiczne do tego, co dyżur 225
   zrobił dla `toolsInsightsWiringFlag.ts`).
2. **Niespójność artefaktu (drobna).** `day225-tools-insights-local.png` jest w
   rzeczywistości JPEG (`file` potwierdza `JPEG image data`), mimo rozszerzenia `.png` —
   to ten sam znany kwirk narzędzia przeglądarki, który dyżur 224 wykrył i **skonwertował**
   do prawdziwego PNG (`CODEX_DAY224_PARTNER_REPORT.md` §7, punkt 3). Dyżur 225 tego nie
   zauważył ani nie skonwertował. Nie podważa treści zrzutu (obejrzałem go — pokazuje
   pusty stan Insighty bez błędu), ale warto ujednolicić konwencję między dyżurami.

## Twierdzenia niezweryfikowane (uczciwie przyznane przez wykonawcę, potwierdzam)

Gotowość wizualna zakładki do akceptu właściciela nie sprawdzona (zrzut jest tylko
techniczny); staging/demo/produkcja celowo nietknięte; nie zweryfikowano każdego miejsca
w całym repo opisującego DEC-158 poza trzema blokami w licencji; pełny korpus testów
Narzędzi nie wykonany; brak decyzji właściciela o włączeniu flagi.
