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

Bezpiecznik porównuje teraz **dwie niezależne rzeczy**:

- do jakiej bazy łączy się **migracja**,
- do jakiej bazy łączy się **aplikacja**.

Wcześniej porównywał jedną i tę samą etykietę wpisaną ręcznie — takie
porównanie zawsze wypadało zgodnie i niczego nie wykrywało.

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
| `STAGING_DB_HOST_FINGERPRINT` | kawałek nazwy hosta z kroku 1.3, np. `sakura` |

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

## KROK 4. Zrób jedno zwykłe wdrożenie i sprawdź logi

Wdróż normalnie (push na `develop` / zwykły deploy demo).

W logu wdrożenia znajdź **dwie linie** zaczynające się od `DB_IDENTITY`:

```
DB_IDENTITY role=migration identity=sakura.proxy.rlwy.net:41234/railway ...
DB_IDENTITY role=app       identity=sakura.proxy.rlwy.net:41234/railway ...
```

Czytasz tylko pole `identity=`:

| Co widzisz | Co to znaczy | Co robisz |
| --- | --- | --- |
| obie wartości **identyczne** | wszystko dobrze | idź do kroku 5 |
| wartości **różne** | to jest rozjazd DEC-165 | wdrożenie samo się zatrzymało; napraw `DATABASE_URL` tak, żeby obie usługi wskazywały tę samą bazę, i wróć do kroku 1 |
| `identity=unresolved` | ta strona nie umie ustalić bazy | sprawdź, czy `DATABASE_URL` nie jest puste albo nie zawiera nierozwiniętego `${{...}}` |
| brak którejś linii | ta strona chodzi na starym buildzie | wdróż ponownie z aktualnego kodu |

> Te linie są odporne na poziom logowania — pojawią się także na produkcyjnym
> ustawieniu `LOG_LEVEL`. Nie zawierają hasła ani nazwy użytkownika.
> **Stara procedura** kazała porównywać pole `dbTarget=` w liniach
> `RELEASE_MIGRATION_GATE_PASS` i `[Postgres] Config:` — była bezwartościowa
> i tej pary już nie używamy.

---

## KROK 5. Uzbrój bezpiecznik

Dopiero gdy krok 4 pokazał **dwie identyczne** wartości `identity=`:

**GitHub → Settings → Secrets and variables → Actions → Variables** →
„New repository variable":

| Nazwa | Wartość |
| --- | --- |
| `DEPLOY_TARGET_GUARD_ENFORCE` | `1` |

Od tej chwili brak którejkolwiek z powyższych zmiennych **blokuje** wdrożenie,
zamiast tylko ostrzegać.

---

## KROK 6. Sprawdź, że bezpiecznik naprawdę działa (test na sucho)

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
