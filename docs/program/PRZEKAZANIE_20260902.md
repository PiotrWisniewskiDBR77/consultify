---
doc_id: przekazanie-2026-09-02
status: canonical
owner: piotr
truth_type: handover
established: 2026-09-02
---

# PRZEKAZANIE — 2 września 2026

**Dla następcy.** Czytaj w tej kolejności: ten plik → sekcja 8 „Czego nie powtarzać" →
`docs/program/grafika/KORPUS_UWAG_20260902.md` → `docs/program/funkcje/ROZLICZENIE_DEMO_20260902.md`.
Liczby są zmierzone poleceniami w dniu pisania, nie przepisane z pamięci.

---

## 1. Gdzie stoimy — trzy zdania

Staging działa na naszym kodzie i właściciel się do niego loguje. Właściciel zatwierdził
**całą grafikę: 16 modułów i 262 z 265 kart ekranów**. Otwarte jest domknięcie formalnych
bramek modułowych i 45 realnych defektów z jego korpusu uwag.

---

## 2. Decyzje właściciela z tego dnia (wiążące)

| # | Decyzja | Kontekst |
| --- | --- | --- |
| D-1 | **Nowy magazyn zadań jedyny.** Legacy read-only, transfer pilotażowo od 1 rekordu, dobudowa tylko realnie używanych pól z 64 brakujących | dyżur 239 |
| D-2 | **Plakietka źródła przy odpowiedzi Oceny** (`source_type`+`source_id` wzorem `20260311_origin_tracking.sql`), do wdrożenia „Źródło nieznane" | dyżur 240; ★ cel przekierowany: `assessment_responses` ma ZERO pisarzy, żywy łańcuch to `assessment_axis_evidence` |
| D-3 | **Ciche zapisy Inicjatyw przez runtime-v1 + `ie_audit_events`**; pełny rejestr zatwierdzeń odłożony jawnie | dyżur 241 |
| D-4 | **Gamma filar 2: własne składanie + PDF do dystrybucji**, PPTX dla edytujących; 7 archetypów, 2 kroje, 1 akcent, 15 pt, ≤110 słów | `GAMMA_G1_*` |
| D-5 | **Przegląd 253 kart ZASTĘPUJE osobny przegląd modułowy** (bramki G07-G12) | 02.09 |
| D-6 | **Akcept zbiorowy „wszystkie są ok"** — 262 ok / 2 nie / 1 poprawka | `AKCEPT_ZBIOROWY_20260902.md` |
| D-7 | **16 modułów zamkniętych** („sprawdziłem wszystkie moduły i wszystkie są OK") | `ODBIOR_MODULOW.json` |
| D-8 | **Model bazowy Finansów włączyć domyślnie PO naprawie „per-2025-12"** | dyżur 278 |
| D-9 | **Zdejmowanie ochrony gałęzi na czas pushu** i przywracanie 1:1 — zgoda na wzorzec | 3× tego dnia |
| D-10 | **Zastosować zaległe migracje na stagingu po zrzucie bazy** — ★ wykonanie ZATRZYMANE, przesłanka okazała się fałszywa (patrz §8) | 02.09 |
| D-11 | **ENABLE_STUB_ROUTES na produkcji — sprawdzić PÓŹNIEJ** (ryzyko przyjęte świadomie) | 02.09 |
| D-12 | **Redis stagingu bez rotacji** (piaskownica) | 02.09 |

**Produkcja `consultify.ai` ma dane realnych klientów, na ODDZIELNEJ bazie** (słowa właściciela:
„ta baza jest super ważna"). Zero zapisu, zero migracji, zero sondowania bez jawnej zgody.

---

## 3. Stan linii i środowisk

| Co | Wartość |
| --- | --- |
| Linia grafiki | `github-backup/grafika/m03-20260902` @ `14fe8c3c84` (117 commitów dziś) |
| Kandydat wdrożeniowy | `github-backup/kandydat/staging-20260902d` @ `0eff12615b` |
| `origin/develop` = staging | `0eff12615b` — potwierdzone `gitSha` z `/api/health` |
| `origin/demo` | `f3237e9423` (14.08), nietknięte |
| Gałęzi z tego dnia na backupie | 24 |
| Wdrożeń stagingu | 3 (`fadbde60ed` 07:09 · `56913a0b3b` 11:05 · `0eff12615b` 14:0x) |
| Zrzuty bazy stagingu | `/private/tmp/dumps/staging-thomas-20260902.dump` (235 MB) i `…-przed-tp.dump` (240 MB) |

★ **Nazwa `codex/m03-admin-20260824` na github-backup NIE jest linią grafiki** — pod tą nazwą
pushuje tor funkcji. Linia grafiki to `grafika/m03-20260902`. Pomyłka kosztowałaby całą pracę dnia.

**Ochrona `origin/develop`:** wymaga PR + 1 review + zielonego „✅ PR Gate" (15 zadań) + `enforce_admins`.
Procedura pushu, użyta 3× za zgodą właściciela: `gh api -X DELETE …/enforce_admins` → `git push origin
"${SHA}:refs/heads/develop"` → `gh api -X POST …/enforce_admins` → weryfikacja reguł 1:1.

---

## 4. Co zrobiono w kodzie

**Wdrożone na staging:** naprawa awarii Architekta szablonów Word (klik w wiersz wywalał aplikację);
naprawa wysyłki poczty w CAŁEJ aplikacji (nadawca czytany tylko z `SMTP_FROM`, której na Railway nie ma —
wszystkie listy były martwe); wyjście z zamkniętego koła logowania dwuskładnikowego; naprawa bramki
migracyjnej w CI (miała wpisaną ścieżkę macOS, umierała przed pierwszym pomiarem); **27 poprawek
przeniesionych z demo**, w tym 5 blokujących pracę (nie dało się aktywować KPI, ROI ~100× za małe,
ślepy ekran starszych rekordów finansowych, wywalający się eksport roadmapy, wysypująca się lista
artefaktów); **zero błędów typów po obu stronach** (było 27 + 1).

**Grafika, 11 rodzin naprawionych u przyczyny:** tryby kanwy · czerwień na treści neutralnej ·
ucięcia tekstu (`parsePx` odrzucał znak procentu) · angielskie resztki · parytet harnessu · podgląd Idei ·
szerokość Administracji · odmiana liczebnika · menu kanwy · ekrany sprzed zalogowania (5 ekranów było
w całości po angielsku, 76 brakujących kluczy) · nazwiska w Realizacji i Wynikach.

**Bezpieczniki:** bramka parytetu naprawiona (29 z 31 zgłoszeń było fałszywym alarmem; kontrola
dodatnia i ujemna z dowodem mutacyjnym) · bramka języka kart · `jednostka.ts` (8 dni vs 74%) ·
`liczebnik()` · `measure-preview-canon.mjs` · `grafika-wolacze.mjs`.

---

## 5. Co jest w toku (agenci pracowali w chwili pisania)

1. **Wysokość podglądu** — świeża uwaga właściciela: panel nie sięga do dołu strony; zlecone jako
   RODZINA z pomiarem na żywym DOM. Gałąź `grafika/wysokosc-podgladu-20260902`.
2. **11 pozycji z korpusu** (9, 11, 19, 20, 22, 23, 25, 35, 36, 44, 45) — gałąź `grafika/trzy-rodziny-20260902`,
   **SCALONA do linii 02.09 wieczorem** (`14fe8c3c84`; budowa EXIT 0, odbiór CZYSTO, parytet CZYSTO).
   Zrobione 3 z 15 (poz. 3 przyrząd, 5 produkt, 8 pasek kanwy + liczebnik), poz. 4 zatrzymana świadomie
   (patrz §7). **Pozostałe 11 pozycji przechodzi do następcy jako pierwsze zadanie toru grafiki.**
3. **Karty modułowe** na stronie odbioru — 16 kart, tekst przepisywany na język właściciela.
4. **Dyżury 274-278 u Codexa** — wydane, worktree `cx-day274…278` aktywne.

---

## 6. Co dalej — kolejność

1. **Ujednolicić stany bramek.** Dziś 336 bramek: 125 `PASS`, 86 `NOT_STARTED`, **125 pośrednich
   opisanych 60 różnymi etykietami** („PARTIAL_TECHNICAL_BROWSER_PASS / REBUILD_ACTIVE" itp.).
   Bez trzech stanów + osobnego pola powodu licznik postępu nic nie znaczy.
2. **Domknąć G13-G16** materiałem z napraw, które już idą (każda kończy się zrzutem).
3. **G17 i G18 modułami**, w miarę schodzenia 45 uwag. Sześć modułów bez otwartych uwag można
   zamknąć od ręki: Audyty, Agent, Internal Tools, Logowanie + zamknięte Organizacja, Spotkania.
4. **G19-G20 na końcu**, jednym przebiegiem.
5. **Promocja na demo** dopiero po tym, z trzema warunkami: zrzut bazy demo · rozstrzygnięcie
   9 pozycji `TYLKO_DEMO` (dane pokazowe) · ★ zabezpieczenie przed ponowieniem migracji (patrz §8).

**Rozkład 45 defektów z korpusu:** 21 w pięciu rodzinach (front, w naprawie) · 13 w dyżurach 274-278
(mechanika) · 11 u wykonawcy grafiki · 4 to N-karta ROI (patrz §7).

---

## 7. Rzeczy zbudowane, których właściciel nigdy nie widział

★ **Karta ROI jest gotowa.** `RoiCaseCardSections.ts` implementuje dokładnie formułę właściciela
(5 sekcji: Założenia → Model → Wynik → Wyniki po wdrożeniu → Wnioski, 17 podwidoków), trasa podpięta
w `AppRoutes.tsx:3043`, PIR jest zakładką sekcji 5. **Flaga `roiRegistry` jest OFF na każdym hoście**,
a komentarz przy niej podaje powód: czeka na zrzuty i odbiór właściciela. Zrzuty zrobione dopiero
02.09 (`evidence/grafika/218-piec-rodzin/POMIAR__roi-karta-sekcja-{1..5}__light.png`).
**Flaga czekała na odbiór, odbiór czekał na zrzuty, których nikt nie zrobił** — a właściciel prosił
o tę kartę trzy razy, ostatnio pisząc „nie mam już siły serio !!".

Ten sam kształt dotyczy: 4 pozycji z pięciu rodzin, 2 z 3 zgłoszeń w dyżurze 275, 5 pozycji z korpusu
naprawionych po ostatnim kliknięciu właściciela. **Zasada wprowadzona 02.09: naprawa bez zrzutu na
stronie odbioru nie jest ukończona.**

---

## 8. ★ Czego nie powtarzać — pułapki zmierzone tego dnia

1. **„Pending = N" mówi o LICZNIKU, nie o schemacie.** Bramka meldowała 98 zaległych migracji na
   stagingu; wszystkie były zastosowane. To różnica dwóch niezależnych rejestrów (`schema_migrations`
   idzie z pre-deploy, `tp_migration_history` stoi od 22.08 przez `DB_MANAGED_SCHEMA=off`).
   Wykonanie zgody właściciela co do litery ponowiłoby 12 migracji nieaddytywnych, w tym jedną
   z `DELETE FROM`. **Sprawdzaj OBIEKT (czy tabela istnieje), nie wpis w liczniku.**
2. **Bramka może umrzeć PRZED pomiarem.** `day161` była czerwona przez ścieżkę `/private/tmp/…`
   (macOS) na runnerze Linux — nie uruchomiła ani jednej migracji, a wyglądała na porażkę migracji.
   Poprawka istniała od 31.08 na innej gałęzi i została przeoczona, bo integrator brał „10 ostatnich
   commitów". **Bierz commity po treści (ścieżce pliku), nie po pozycji w logu.**
3. **Zwinięta sekcja nie jest dowodem.** Naprawa bloku diagnostycznego w menu kanwy przeszła, a
   sąsiednia rozwinięta sekcja mówiła po angielsku dziewięcioma napisami. Żądaj zrzutu z KAŻDĄ sekcją
   rozwiniętą.
4. **Sonda mierzy pustą stronę i melduje czystość.** „0 styków cyfra-litera" przy zrzucie
   pokazującym „Ładowanie ekranu…". Każda sonda wizualna musi najpierw dowieść, że mierzy załadowany ekran.
5. **Nie pisz własnego skryptu zrzutowego obok kanonicznego.** Doraźny skrypt dał dwa identyczne
   obrazy pod nazwami „jasny" i „ciemny" i zameldował sukces. Brakującą funkcję dokłada się narzędziu, opt-in.
6. **Defekt widoczny przy jednej wartości danych.** „8dni" psuło się wszędzie, ale widać było w jednym
   wierszu, bo pozostałe wskaźniki mają `%`. Szukaj po WZORCU sklejania, nie po widocznym napisie.
7. **Rodzeństwo z gotową poprawką to najsilniejszy trop rodziny.** Trzy prezentery robiły własną
   zamianę myślnika; czwarty był naprawiony tydzień wcześniej i jego komentarz wymieniał przypadek testowy.
8. **`$SHA:refs/heads/develop` w zsh gubi `:r`** — cytuj `"${SHA}:refs/heads/develop"`.
9. **Nowy worktree ze skarbca bywa cicho „bare"** — `printf '[core]\n\tbare = false\n' > <skarbiec>/worktrees/<nazwa>/config.worktree`.
10. **Budowa wymaga `NODE_OPTIONS=--max-old-space-size=8192`** — EXIT 134 to brak pamięci, nie błąd kodu.
11. **Strona odbioru dwa razy nie zapisała kliknięć właściciela.** Baza zostawała pusta mimo jego pracy;
    mechanizm zweryfikowany osobnym kliknięciem nadzorcy (POST 200, wiersz zapisany). **Po każdej partii
    sprawdzaj bazę, nie ufaj temu, że interfejs nie krzyknął.** Decyzje z 02.09 zapisane ręcznie
    z wiadomości, z jawną adnotacją o źródle.
12. **Dwie kopie tego samego dokumentu rozjeżdżają się w godzinę.** Korpus uwag żył na dwóch gałęziach;
    scalone. Przy równoległych wykonawcach: jedno źródło albo jawna warstwa nadpisująca.

---

## 9. Otwarte ryzyka

- **`ENABLE_STUB_ROUTES` na produkcji — wartość nieznana.** Pięć tras z brakiem kontroli dostępu
  cross-org JEST w kodzie `origin/main`; montują się tylko przy `true` (domyślnie OFF w production).
  Cherry-pick poprawki: 0 konfliktów. Decyzja właściciela: sprawdzić później.
- **`csrfValidationMiddleware` nie jest zamontowany nigdzie** — walidacja CSRF martwa w całej aplikacji.
- **Migracja `771_demo_mock_seed_cleanup.sql`** (30 × `DELETE FROM`) — runner Table Platform pasuje do
  niej wzorcem `771_` i nie ma wykluczenia demo/mock/seed; chroni ją JEDEN wiersz w rejestrze.
  ★ Demo ma zarządzanie schematem WŁĄCZONE — przed promocją to musi być rozstrzygnięte.
- **Nie uruchamiać `acceptance-fixtures/run.ts` przeciw demo** — `ON CONFLICT DO UPDATE` nadpisze
  polskie dane pokazowe angielskimi zaślepkami.
- **Migracja `932_decision_workflow_canonical.sql` omija automatyczny runner** (nie pasuje do wzorca
  nazw) — na świeżej bazie tabele decyzji mogą nie powstać, a bramka `day161` tego nie wykryje.
- **Dysk**: dwa razy tego dnia zapełnił się do zera i przerwał pracę (raz kasując cache Playwrighta).
  Po sprzątaniu 93 GB wolnego. `~/.codex/worktrees` miało 91 GB (usunięte 60 czystych katalogów).

---

## 10. Infrastruktura odbioru

`node scripts/dev/stanowisko.mjs status|start|sprawdz` — harness `:3020`, strona odbioru `:3030`.
Widoki: `/` (ekrany, filtry „★ Poproszony przegląd", „Poprawione dla Ciebie") i `/moduly` (16 kart).
Bramki przed oddaniem: `odbior-kontrola.mjs` → CZYSTO · `check-dev-render-parytet.mjs` → CZYSTO ·
`check-list-canon.sh` → EXIT 0. Trwałe kopie decyzji: `ODBIOR_DECYZJE.json`, `ODBIOR_MODULOW.json`
(baza `odbior.sqlite` jest lokalna i ulotna — **eksportuj po każdej partii**).
