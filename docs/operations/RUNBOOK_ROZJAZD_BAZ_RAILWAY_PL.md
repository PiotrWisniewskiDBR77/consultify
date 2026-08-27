# Runbook: bezpiecznik „rozjazdu baz" — co ustawić i jak sprawdzić

**Dla kogo:** właściciel (nie-koder). **Czas:** ~20 minut.
**Kolejność jest istotna** — krok 0 wykonaj przed scaleniem albo tuż po nim.
**Czego dotyczy:** DEC-2026-08-28-165 — aplikacja czytała JEDNĄ bazę, a migracje
szły do INNEJ. Trzy bazy nazywają się `railway`, więc nazwa niczego nie mówi.

**Zasada nadrzędna:** `consultify.ai` = PRODUKCJA, nie ruszamy jej bez osobnej
zgody. `demo.consultify.ai` i `staging.consultify.ai` = jedna wspólna baza,
zawartość bezwartościowa.

---

## Co się zmieniło w kodzie

Bezpiecznik porównuje **dwie niezależne rzeczy**:

- do jakiej bazy łączy się **migracja**,
- do jakiej bazy łączy się **aplikacja**.

Wcześniej porównywał jedną i tę samą etykietę wpisaną ręcznie — takie
porównanie zawsze wypadało zgodnie i niczego nie wykrywało.

### ★ GDZIE ten bezpiecznik naprawdę jest (to jest sedno)

Rozjazd da się zobaczyć **tylko z zewnątrz obu usług** — tam, gdzie istnieją
dwie osobno podane wartości. Takie miejsce jest jedno:

> **GitHub Actions**, skrypt `scripts/validate-deploy-target.sh`, porównujący
> sekrety `..._APP_DATABASE_URL` i `..._MIGRATION_DATABASE_URL`.

**W środku wdrożenia (Railway) rozjazdu wykryć się NIE DA.** Bramka migracji
uruchamia się jako `preDeployCommand` w **tej samej usłudze co aplikacja**,
więc czyta **te same zmienne** co aplikacja. Cokolwiek by tam porównała,
porówna jedną wartość ze sobą samą i zawsze wyjdzie „zgadza się".

Dwie poprzednie wersje kodu robiły dokładnie to (raz przez `DB_TARGET_LABEL`,
raz przez ponowne policzenie tej samej zmiennej) i wypisywały do logu
zielone `appIdentityMatches=true`. Zostało to **usunięte** — „nie wiem" jest
uczciwsze niż fałszywe „zgadza się". Bramka migracji mówi to teraz wprost
w logu wdrożenia, linią zaczynającą się od `[release-gate] NOTE:`.

Bezpiecznik jest **domyślnie WYŁĄCZONY** (tryb ostrzegawczy). Dopóki go nie
uzbroisz, wdrożenia działają normalnie, a w logu GitHub Actions pojawia się
żółte ostrzeżenie. **Wyjątek: jeśli bezpiecznik zobaczy rozjazd, blokuje
wdrożenie zawsze — także wyłączony.**

---

## KROK 0. ★ ZRÓB TO NAJPIERW — inaczej wdrożenia stagingu staną

Bezpiecznik sprawdza także, czy adres strony pasuje do środowiska. To NIE jest
objęte włącznikiem z kroku 5 — działa od razu po scaleniu.

Wg zapisu DEC-2026-08-28-172 zmienna GitHub `STAGING_FRONTEND_URL` wskazuje
dziś `stage.consultinity.ai`, czyli domenę środowiska **demo** (domeny Railway
są skrzyżowane). Bezpiecznik dla stagingu dopuszcza wyłącznie
`staging.consultify.ai`, więc dopóki tego nie poprawisz, wdrożenie stagingu
zatrzyma się na kroku „Validate staging target mapping".

★ Tej wartości nie sprawdziłem — musisz ją odczytać sam.

1. Wejdź: **GitHub → Settings → Secrets and variables → Actions → Variables**.
2. Sprawdź `STAGING_FRONTEND_URL`. Jeśli zawiera `consultinity` lub `demo` —
   zmień na `https://staging.consultify.ai`.
3. Sprawdź `STAGING_API_HEALTH_URL`. Ma wskazywać API **stagingu**, nie demo.

Jeśli obie już wskazują staging — nic nie rób, przejdź dalej.

---

## KROK 1. Odczytaj adresy dwóch baz (nic nie zmieniasz)

W panelu Railway, dla środowiska **staging**:

1. Wejdź w usługę **aplikacji** (ta, która serwuje stronę) → zakładka
   **Variables** → znajdź `DATABASE_URL`. Skopiuj **całą** wartość.
   To jest adres bazy, z której korzysta APLIKACJA.
2. Wejdź w usługę, na której uruchamiana jest **bramka migracji**
   (`preDeployCommand` / release gate) → **Variables** → znajdź `DATABASE_URL`
   (albo `DATABASE_PUBLIC_URL`, jeśli jest ustawione). Skopiuj całą wartość.
   To jest adres bazy, do której idą MIGRACJE.

> Jeśli obie usługi to ta sama usługa i wartość jest ta sama — świetnie,
> rozjazdu nie ma. Wklej tę samą wartość w obu miejscach w KROKU 2.

3. Zapisz sobie z KAŻDEGO adresu **kawałek nazwy hosta** — słowo między `@`
   a `.proxy` (np. `sakura`, `trolley`, `thomas`, `centerbeam`).

Przykład adresu: `postgresql://uzytkownik:haslo@sakura.proxy.rlwy.net:41234/railway`
→ kawałek nazwy hosta to `sakura`.

---

## KROK 2. Wpisz to w GitHubie (nie w Railway!)

★ To jest miejsce, w którym poprzednia wersja instrukcji **kłamała**.
Bezpiecznik uruchamia się w GitHub Actions, a nie w Railway. Zmienna wpisana
wyłącznie w panelu Railway do niego NIE DOCIERA.

Idź: **GitHub → repozytorium → Settings → Secrets and variables → Actions**.

### 2a. Zakładka **Secrets** → „New repository secret" (dwa wpisy)

| Nazwa | Wartość |
| --- | --- |
| `STAGING_APP_DATABASE_URL` | cały adres z kroku 1.1 |
| `STAGING_MIGRATION_DATABASE_URL` | cały adres z kroku 1.2 |

### 2b. Zakładka **Variables** → „New repository variable" (jeden wpis)

| Nazwa | Wartość |
| --- | --- |
| `STAGING_DB_HOST_FINGERPRINT` | kawałek nazwy **hosta** z kroku 1.3, np. `sakura` |

★ **NIE wpisuj tu `railway`.** To jest nazwa BAZY, taka sama we wszystkich
trzech bazach — nie odróżnia niczego. Bezpiecznik od teraz taką wartość
odrzuca i mówi o tym wprost, zamiast ją po cichu przyjąć (wcześniej `railway`
przepuszczało dowolny host). Wpisz słowo między `@` a `.proxy`.

**Jeszcze NIE wpisuj** `DEPLOY_TARGET_GUARD_ENFORCE`. To krok 5.

---

## KROK 3. Wpisz jedną zmienną w Railway (inny konsument)

W Railway, w środowisku **staging**, w usłudze aplikacji → **Variables**:

| Nazwa | Wartość |
| --- | --- |
| `RELEASE_TARGET_DB_HOST_FINGERPRINT` | ten sam kawałek nazwy hosta, np. `sakura` |

To samo powtórz dla środowiska **demo** (tam kawałek nazwy hosta odczytaj z
`DATABASE_URL` usługi demo).

**Produkcji NIE ruszamy** — to osobna decyzja (E5).

Opcjonalnie, dla czytelności logów, możesz dodać `DB_TARGET_LABEL` (np.
`staging-sakura`). Ta zmienna niczego nie sprawdza, tylko podpisuje log.

---

## KROK 4. Zrób jedno zwykłe wdrożenie i zapisz, jakiej bazy użyło

★ **Uwaga: ten krok NICZEGO nie dowodzi o rozjeździe.** Poprzednia wersja tej
instrukcji kazała porównać dwie linie z logu i uznać zgodność za dowód. Te
linie pochodzą z jednej i tej samej zmiennej środowiskowej, więc **zawsze**
były identyczne — wiersz „wartości różne = rozjazd" opisywał zdarzenie, które
nie mogło nastąpić. Wykonanie tego kroku dawało fałszywe poczucie, że coś
zostało sprawdzone. Dowodem jest **wyłącznie KROK 6.**

Ten krok robisz po to, żeby **zobaczyć na oczy, jakiej bazy wdrożenie
naprawdę użyło** — i porównać ją z tym, co odczytałeś w KROKU 1.

Wdróż normalnie (push na `develop` / zwykły deploy demo). W logu wdrożenia
znajdź linię:

```
DB_IDENTITY role=migration identity=sakura.proxy.rlwy.net:41234/railway ...
```

| Co widzisz | Co to znaczy | Co robisz |
| --- | --- | --- |
| `identity=` zgadza się z adresem z KROKU 1 | wdrożenie migrowało bazę, o której myślisz | idź do kroku 5 |
| `identity=` to **inna** baza niż z KROKU 1 | źle odczytałeś adres albo Railway ma inną zmienną, niż myślisz | wróć do kroku 1 i odczytaj ponownie |
| `identity=unresolved` | ta strona nie umie ustalić bazy | sprawdź, czy `DATABASE_URL` nie jest puste ani nie zawiera nierozwiniętego `${{...}}` |
| brak tej linii | usługa chodzi na starym buildzie | wdróż ponownie z aktualnego kodu |

Obok zobaczysz też linię `[release-gate] NOTE: ...`, w której bramka sama
pisze, że rozjazdu wykryć nie może i że robi to dopiero GitHub Actions. To
jest zamierzone, nie błąd.

> Linia `DB_IDENTITY` jest odporna na poziom logowania — pojawi się także na
> produkcyjnym `LOG_LEVEL`. Nie zawiera hasła ani nazwy użytkownika.
> **Stara procedura** kazała porównywać pole `dbTarget=` w liniach
> `RELEASE_MIGRATION_GATE_PASS` i `[Postgres] Config:` — była bezwartościowa
> i tej pary już nie używamy. Para `role=migration` / `role=app` była
> bezwartościowa z dokładnie tego samego powodu i też jej nie używamy.

---

## KROK 5. Uzbrój bezpiecznik

Gdy krok 4 pokazał bazę, której się spodziewałeś:

**GitHub → Settings → Secrets and variables → Actions → Variables** →
„New repository variable":

| Nazwa | Wartość |
| --- | --- |
| `DEPLOY_TARGET_GUARD_ENFORCE` | `1` |

Od tej chwili brak którejkolwiek z powyższych zmiennych **blokuje** wdrożenie,
zamiast tylko ostrzegać.

---

## KROK 6. ★ JEDYNY PRAWDZIWY DOWÓD — test na sucho

To jest jedyne miejsce w całej procedurze, w którym bezpiecznik jest naprawdę
sprawdzany. Nie pomijaj go i nie zastępuj go patrzeniem w logi z kroku 4.


1. W GitHubie **tymczasowo** zmień secret `STAGING_MIGRATION_DATABASE_URL` na
   adres innej bazy (np. tej z `demo`).
2. Uruchom wdrożenie.
3. Workflow musi się **zatrzymać** na kroku „Validate staging target mapping"
   z komunikatem zaczynającym się od `DEC-165 DIVERGENCE`.
4. Przywróć poprawną wartość secretu i wdróż ponownie — musi przejść.

Jeśli krok 3 przeszedł zamiast się zatrzymać, bezpiecznik nie działa i trzeba
to zgłosić.

---

## Ściąga: co gdzie

| Zmienna | Gdzie | Po co |
| --- | --- | --- |
| `STAGING_APP_DATABASE_URL` | GitHub **secret** | adres bazy aplikacji |
| `STAGING_MIGRATION_DATABASE_URL` | GitHub **secret** | adres bazy migracji |
| `STAGING_DB_HOST_FINGERPRINT` | GitHub **variable** | przypięcie do właściwego środowiska |
| `DEPLOY_TARGET_GUARD_ENFORCE` | GitHub **variable** | włącznik bezpiecznika (`1`) |
| `RELEASE_TARGET_DB_HOST_FINGERPRINT` | **Railway** (staging, demo) | bramka migracji w środku wdrożenia |
| `DB_TARGET_LABEL` | **Railway** (opcjonalnie) | tylko podpis w logu, nic nie sprawdza |

Dla produkcji te same nazwy z przedrostkiem `PRODUCTION_` — ale dopiero po
osobnej zgodzie (E5).

## Czego ten runbook NIE zrobił

Nie sprawdzono żadnej żywej wartości w Railway ani w GitHubie — ten dokument
powstał wyłącznie z kodu. Wartości `DATABASE_URL` odczytujesz Ty w kroku 1.

## Czego ten bezpiecznik NIE potrafi

- **Nie wykryje rozjazdu, jeśli nie uzbroisz go w GitHubie** (krok 2 + krok 5).
  Bez `..._APP_DATABASE_URL` i `..._MIGRATION_DATABASE_URL` nie ma dwóch
  niezależnych wartości i nie ma czego porównywać — wdrożenie przechodzi
  z żółtym ostrzeżeniem.
- **Nie wykryje rozjazdu w środku wdrożenia.** Bramka w Railway czyta
  środowisko aplikacji i nie ma dostępu do żadnej innej usługi. Mówi o tym
  wprost w logu.
- **Nie wykryje sytuacji, w której oba sekrety w GitHubie wskazują tę samą
  ZŁĄ bazę** — od tego jest przypięcie do hosta (`..._DB_HOST_FINGERPRINT`),
  i tylko wtedy, gdy wpisałeś tam kawałek nazwy hosta, a nie `railway`.
- **Nie pilnuje, żeby sekrety w GitHubie nadal odpowiadały temu, co jest
  w Railway.** Jeśli ktoś zmieni `DATABASE_URL` w panelu Railway i nie
  zaktualizuje sekretu, bezpiecznik będzie porównywał nieaktualne wartości.
  Powtórz kroki 1-2 po każdej takiej zmianie.
