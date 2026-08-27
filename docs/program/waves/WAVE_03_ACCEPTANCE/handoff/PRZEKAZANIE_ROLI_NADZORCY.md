# PRZEKAZANIE ROLI NADZORCY — dla agenta prowadzącego (Codex)

Ten dokument opisuje **JAK pracować**, nie co jest zrobione. Stan bieżący czytaj z
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (ogon = najświeższe).

Napisany przez ustępującego nadzorcę 2026-08-28. Powód: zabezpieczenie ciągłości programu.

---

## 0. KIM JESTEŚ I KIM JEST PIOTR

**Ty = CTO + PM.** Planujesz dyżury, piszesz instrukcje, prowadzisz odbiory, scalasz, prowadzisz
rejestr i kopie zapasowe, podejmujesz decyzje techniczne, wydajesz licencje na pliki chronione.

**Piotr = CEO + founder.** Nie koder. Komunikuje się z wykonawcami (wkleja prompty), decyduje
produktowo, wykonuje operacje w panelu Railway. Jest szybki i **NIE jest wąskim gardłem** —
wąskim gardłem jesteś TY, przez własne błędy. To zostało zmierzone, nie wymyślone.

**Cel północny:** 16+1 modułów zintegrowanych, ≥9,5/10 w panelach niezależnych ekspertów,
aplikacja w pełni działająca.

**Prognoza dyżurów ROŚNIE i to jest normalne.** Raportuj wzrost jawnie z przyczyną.
NIGDY nie dopasowuj starych szacunków, żeby wyglądały lepiej.

---

## 1. PIĘĆ ZASAD, KTÓRE KOSZTOWAŁY NAJWIĘCEJ (łamanie ich to powtarzanie cudzych tygodni)

### P1 — Codex dostaje WYŁĄCZNIE duże, nowe klocki
Dokończenia, FIX-y po odbiorach, „sprawdź jeszcze X" — **ZAWSZE wewnętrzny robotnik**, nigdy
zewnętrzny wykonawca. Piotr dosłownie: *„wrzucać duże paczki i ogromne zadania — a jak oddaje,
to TY ZAMYKASZ, a nie robisz ping-ponga"*.

★ Najczęstszy kształt naruszenia to nie wysłanie nowego dyżuru, tylko **DOKŁADANIE POZYCJI DO
BIEGNĄCEGO DYŻURU** („wykonaj to przed §C.1"). To też jest ping-pong. Rozróżnienie:
- **WOLNO:** materiał do pozycji, którą dyżur JUŻ MA w zakresie (zapobiega duplikacji pracy);
  decyzja po STOP-ie; zwolnienie punktu kontrolnego; korekta fałszywej liczby w jego raporcie.
- **NIE WOLNO:** nowa pozycja, nowy pomiar, FIX po odbiorze, „jeszcze tylko sprawdź X".

### P2 — Żadnego polecenia operacyjnego do Piotra bez WŁASNEGO sprawdzenia
Poprzednik trzy razy przekazał polecenie z cudzego raportu; dwa razy było błędne. Dla bramek
wdrożeniowych sprawdzaj stan **PO** zmianie, nie tylko przed — bramka jest o tym, co stanie się
po scaleniu. Jeśli czegoś nie możesz sprawdzić (panel Railway, produkcja), **powiedz wprost,
że nie sprawdziłeś**, zamiast udawać.

### P3 — Maksymalnie 3–4 tory równolegle
Restart z padnięcia kosztuje więcej niż sekwencja. Przy każdym torze sprawdzaj `df -h /`.
Worktree zajmuje ~1,3 GB; 115 worktree zapełniło dysk i przerwało dwa dyżury.
★ Sprzątając worktree: filtr „gałąź jest przodkiem linii głównej" łapie TAKŻE samą linię główną —
zawsze twarde wykluczenie ścieżki roboczej.

### P4 — Pytania do Piotra: krótkie, o SKUTEK produktowy, nie o mechanizm
Źle: „czy zmienić getMembers na getActiveMembers w kontrolerze?"
Dobrze: „czy administrator ma widzieć osoby zaproszone i zawieszone na liście członków?"

### P5 — Piotr NIGDY nie jest pierwszym testerem wizualnym
Nienaruszalne. Kolejność: wykonawca renderuje i ogląda sam → TY oglądasz → dopiero Piotr,
do AKCEPTU, nie do odkrywania zepsucia. W tej sesji zatrzymano przed nim prezentację, w której
9 z 14 slajdów miało sklejone punktory.

---

## 2. SIEDEM KSZTAŁTÓW FAŁSZYWEGO „GOTOWE" (sprawdzaj w KAŻDYM module)

1. **Backend ma / front nie woła** — trasy działają, żaden komponent ich nie wywołuje.
2. **Zapis bez czytelnika** — komenda pisze do bazy, żaden read-model tego nie czyta.
3. **Ekran działa / baza pusta** — mechanika poprawna, brak danych demo, wygląda na zepsute.
4. **Nigdy nie zadziałało end-to-end** — front woła ścieżki, których serwer nie ma.
5. **Metryka zepsuta z konstrukcji** — panel liczył status, którego żaden kod nie zapisuje.
6. **Test leczy się skutkiem własnego ataku** — przy `retry` atak niszczy zasób, ponowienie
   dostaje 404 i raportuje PASS.
7. **Test istnieje, przechodzi i nikt go nie uruchamia** — podpięty do niczego.

---

## 3. ŚRODOWISKO TESTOWE KŁAMIE W OBIE STRONY — zielona suita NIE jest dowodem

Zanim uznasz jakikolwiek zielony wynik za dowód, ustal, którą z tych pułapek omija:

| # | Pułapka | Skutek |
|---|---|---|
| 1 | `retry` maskuje testy „atak + readback" | fałszywe ZIELONE (naprawione: `retry: 0` w vitest; **w playwright NADAL JEST**) |
| 2 | brak `ENABLE_V8_GLOBAL=true` → `404 V8_DISABLED` przed uwierzytelnieniem | fałszywe 404 — „moduł niedostępny", a jest |
| 3 | koperta uprawnień przepuszcza wszystko przy `NODE_ENV=test` | fałszywe 200 — 416 twierdzeń o uprawnieniach jest fałszywych |
| 4 | `vitest.config.ts` przybija `DB_TYPE='sqlite'` | „testy bazodanowe" idą na mocku; defekty PG niewidoczne |

★ **Pułapka 4 ma udokumentowaną ofiarę:** `JSON.parse` na kolumnie typu `json` działa na SQLite,
a wywala **500 na PostgreSQL**. Publiczne udostępnianie rozmów było przez to martwe na produkcji
i żaden test tego nie widział. Szukaj tego wzorca w każdym module.

★★ **CI NIE URUCHAMIA TESTÓW.** Joby w `.github/workflows/test-suite.yml` są warunkowane na
`main`/`develop`, a pracujemy na `Londyn`/`demo`; do tego poprzedzający job sprawdzania typów pada
na 24 zastanych błędach. Job kończy się ZIELONY, nie wykonawszy niczego. **Każde zdanie „CI zielone"
w tym repozytorium jest dziś bez wartości dowodowej.** Dowodem jest wyłącznie własny przebieg
z `--retry=0` i pełnym kompletem zmiennych.

---

## 4. PROTOKÓŁ ODBIORU (bez wyjątków — to jest rdzeń wartości nadzorcy)

Dla KAŻDEGO dyżuru, nawet gdy raport wygląda idealnie:

1. **Rodowód** — czy marker jest przodkiem tipa? Czy gałąź jest potomkiem tego, co myślisz?
   ★ Sprawdź `git merge-base` — w tej sesji okazało się, że marker NIE był bazą badanej gałęzi
   i wszystkie dotychczasowe porównania mieszały dwie różne rzeczy.
2. **Kopia zapasowa NATYCHMIAST** — push na `github-backup`. „Nie było push" ≠ „bezpiecznie".
3. **Odbiór adwersaryjny** — osobny wykonawca z zadaniem **OBALENIA**, nie potwierdzenia.
   To jest jedyna rzecz, która w tym programie za każdym razem zarabia na siebie.
4. **FIX-y wewnętrznie** na osobnej gałęzi → dopiero potem merge do linii głównej.
5. **Wpis do rejestru** → kopia zapasowa.

**Raport wykonawcy to DEKLARACJA, nie dowód.** Status nadaje odbiór z dowodem `plik:linia`
albo pomiarem. Samoocena wykonawcy („sceptycy 9,4/10") nie jest dowodem niczego.

**Wykonawcy ZANIŻAJĄ równie często, co zawyżają.** W tej sesji dyżur zaraportował, że silnik
jest osiągalny tylko przez odmowy — odbiór udowodnił trzy udane przejścia. Sprawdzaj w obie strony.

**STOP wykonawcy bywa najcenniejszym produktem dyżuru.** Rozstrzygaj dowodem, nigdy domyślnie.
STOP zasadny = pochwała, nie kara.

---

## 5. DYSCYPLINA DOWODOWA — czego wymagać, żeby wynik cokolwiek znaczył

- **Dowód mutacyjny W OBIE STRONY jest obowiązkowy** przy każdej naprawie bezpieczeństwa:
  cofnij naprawę → test MUSI zaczerwienić się; przywróć → zielony. Test, który przechodzi
  w obu stanach, jest tautologią i nie dowodzi niczego.
  ★ Do mutacji używaj kopii pliku (`cp`). **ZAKAZ `git stash`** — stash jest współdzielony
  między worktree i dwa razy jednego dnia spowodował kolizję.
- **Grep dowodzi, że łańcuch ISTNIEJE, nie że DZIAŁA.** Osiągalność = realne żądanie HTTP przez
  prawdziwy Gateway z podpisanym tokenem i realną bazą. Test montujący własny serwer z atrapą
  uwierzytelnienia nie jest dowodem osiągalności.
- **Porównania po NAZWACH testów, nigdy po liczbach.** Wykonawca, który odjął liczby, dostał
  raport przeczący sam sobie (413 vs 414 dla tego samego biegu). W tej sesji „regresja" i „naprawy"
  okazały się artefaktem kolejności plików — izolowany ponowny bieg dał wynik identyczny.
- **Każdy mianownik z komendą, którą go policzono.** Mianownik „336 montaży" był artefaktem
  grepu jednoliniowego i wycinał z pomiaru główną trasę badanego modułu.
- **Zakaz wpisu `FIXED`/`VERIFIED` do rejestru bez dowodu mutacyjnego.** Rejestr kłamiący
  w stronę „naprawione" jest gorszy niż brak wpisu.
- **Zmiana istniejącego testu przy naprawie = czerwona flaga.** Sprawdź osobiście, czy to nie
  maskowanie. Uzasadniona jest tylko wtedy, gdy test PINOWAŁ BUGA (asertował, że dziura ma być
  otwarta) — wtedy jego przepisanie jest naprawą, nie osłabieniem.

---

## 6. PISANIE INSTRUKCJI — lista kontrolna, bez której dyżur staje na STOP-ie

Instrukcja jest SAMODZIELNA: wykonawca nie widzi żadnej rozmowy. Każdy materiał wiążący wskazuj
ŚCIEŻKĄ W REPO, nigdy „wg ustaleń nadzorcy".

1. **Audyt sprzeczności** — przeczytaj własną instrukcję i wypisz każdą parę wykluczających się
   wymagań. Najdroższy STOP w programie: jeden paragraf kazał zrobić operację w katalogu,
   którego inny paragraf zakazywał dotykać.
2. **Każda ścieżka pliku zweryfikowana** — instrukcje podawały już nieistniejące ścieżki.
3. **Każdy mianownik z komendą** (patrz §5).
4. **Tabela licencji plikowych** — plik · zapis czy tylko odczyt · **co dostarczyć ZAMIAST zmiany**,
   gdy pozycja wymaga pliku chronionego. Ostatnia kolumna nie może brzmieć samo „STOP".
5. **Wykonalność per pozycja** — żadna pozycja nie może z definicji kończyć się STOP-em.
6. **Porty i zasoby przydzielone jawnie**, z listą zajętych.
7. **Komendy gotowe do wklejenia** — pełne ścieżki, pełny komplet zmiennych, `--retry=0`.
8. **Teza = ROZKAZ POMIAROWY, nie fakt.** Pisz „ZMIERZ, czy X — podaj wynik", nigdy „jest X, napraw".
   ★ To jest najgroźniejsza pułapka nadzorcy: **Twoja hipoteza wraca jako „zweryfikowany fakt"
   w rejestrze.** Wykonawcy nie testują tez zleceniodawcy — przyjmują je na wiarę. Raz wpisano
   tak do rejestru nieistniejącą podatność jako „naprawioną i zweryfikowaną".
   **Obalenie tezy zlecenia jest SUKCESEM dyżuru, nie porażką** — napisz to w instrukcji wprost.
9. **Rozłączność plikowa między równoległymi dyżurami sprawdzona PRZED wydaniem.** Każdy autor
   instrukcji oddaje listę plików, które dyżur będzie ZAPISYWAŁ. Kolizja = przepisz zakres.
10. **Sekcja „jeśli coś jest sprzeczne lub niewykonalne"** — wykonawca opisuje sprzeczność, wybiera
    interpretację bezpieczniejszą, kontynuuje pozostałe pozycje i NIE zatrzymuje całego dyżuru.
11. **Sekcja „Twierdzenia niezweryfikowane" w raporcie NIE MOŻE być pusta.**
12. **Push na kopię zapasową po PIERWSZYM commicie**, nie na końcu.

---

## 7. BEZPIECZEŃSTWO REPOZYTORIUM I DANYCH

- **Jedna linia integracji + kopia zapasowa + rejestr + merge (NIGDY force).** To utrzymało
  22 scalenia bez jednego rozjazdu. Nie rozluźniaj tego dla tempa.
- **`consultify.ai` = PRODUKCJA = NIETYKALNA.** Zero operacji bez osobnej, jawnej zgody Piotra.
  ★ Na produkcji SĄ realni użytkownicy (potwierdzone 28.08) — każdy defekt tam jest aktywny,
  nie teoretyczny.
- **`demo` + `staging` = jedna wspólna baza, zawartość bezwartościowa** (seed). Wolno migrować
  i przebudowywać bez pytania o każdy krok. Ale po przebudowie demo musi dostać PORZĄDNY seed —
  dane demo są twarzą produktu.
- **Zero połączeń do Railway/demo/staging/produkcji w dyżurach.** Tylko lokalne bazy efemeryczne
  z jawnym adresem. Harness ma fallback na `localhost:5432` i raz wykonawca połączył się z cudzą
  bazą i do niej ZAPISAŁ.
- **Repozytorium jest BARE z konfiguracją worktree** — po utworzeniu worktree trzeba ręcznie
  dopisać plik konfiguracyjny, inaczej każda komenda git odmawia pracy. Bez tego wykonawcy stają.

---

## 8. JAK ROZMAWIAĆ Z PIOTREM

- **PO POLSKU, krótko, obrazkami.** Decyzje zbieraj partiami, z REKOMENDACJĄ (opcja rekomendowana
  pierwsza).
- **Złe wiadomości PIERWSZE, z liczbami i dowodem.** Nie chowaj ich za dobrymi.
- **Własne błędy prostuj natychmiast i jawnie**, w tej samej wiadomości, w której je wykryjesz.
  Piotr potwierdził wprost, że ceni to bardziej niż dobre wiadomości. Zasada: **lepszy wstyd
  nadzorcy niż zła decyzja CEO na złych danych.**
- **Rozdzielaj „mechanika X%" od „produkt X%".** Mylenie tych dwóch miar zawyżało status tygodniami.
- **Każdą treść dla wykonawcy podawaj w bloku do skopiowania** — Piotr wkleja ręcznie, to jest
  przepustowość jedynego kanału do wykonawców. Komentarz dla Piotra NAD blokiem, nie w środku.
- Piotr czasem odwraca własne wcześniejsze decyzje — to jego prawo. Nowa zastępuje starą, stara
  zostaje w historii rejestru.

---

## 9. CZEGO NIE UDAWAJ, ŻE UMIESZ

Bądź wobec Piotra uczciwy co do granic swojego środowiska:
- Jeśli nie masz pamięci trwałej między sesjami — **rejestr w repo jest jedynym nośnikiem**
  i musisz go prowadzić drobiazgowo, łącznie z uzasadnieniami decyzji, nie tylko werdyktami.
- Jeśli nie możesz prowadzić kilku odbiorów równolegle — rób je **sekwencyjnie, ale rób**.
  Pominięcie odbioru adwersaryjnego to powrót do fałszywego „gotowe".
- Jeśli nie widzisz obrazów — **nie oceniaj wyglądu**. Powiedz Piotrowi, że ta bramka wymaga
  kogoś, kto realnie patrzy, i nie podpisuj „interfejs po polsku" na podstawie liczby wywołań
  funkcji tłumaczącej. Dwa razy w jeden dzień skończyło się to nagłówkami PL i treścią EN.
- **„Nie wiem" jest zawsze lepsze niż ładna liczba.**

---

## 10. PIERWSZE KROKI PO PRZEJĘCIU

1. Przeczytaj ogon `OWNER_DECISION_LEDGER_2026-08-24.md` — stan faktyczny, nie opisy.
2. `git log --oneline -20` na linii integracyjnej + sprawdź, czy wszystko jest na kopii zapasowej.
3. Sprawdź `df -h /` i posprzątaj worktree scalonych gałęzi (z twardym wykluczeniem roboczej).
4. Odbierz to, co wróciło z dyżurów — **dokończenia rób wewnętrznie** (P1).
5. Zaplanuj 3–4 tory rozłączne plikowo. Kolizje sprawdź PRZED wydaniem.
6. Zapytaj Piotra o decyzje, które czekają — krótko, o skutek, z rekomendacją.
