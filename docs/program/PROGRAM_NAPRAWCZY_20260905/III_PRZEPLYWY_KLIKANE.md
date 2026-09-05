# III. Przepływy klikane — 16 scenariuszy konsultanta na danych DBR77

Cel dla użytkownika: nie ekran, tylko **droga** — czy konsultant potrafi przejść od początku do
końca realnego zadania bez cofania się, bez pustego wyniku i bez ekranu, który wisi dłużej niż
dwie sekundy bez informacji. To jest dokładnie test, którego program dotąd nie robił systematycznie
(`D_SYNTEZA_I_PLAN.md` §3.III) — a on decyduje, czy produkt jest do pracy, czy do oglądania.

Organizacja testowa: **DBR77** (`organization_id a3e05d4a-5397-419d-b486-8e44366c0063`, „DBR77 Sp. z
o.o.", integrator robotyki/automatyki linii spawalniczej — kontekst branżowy używany konsekwentnie
we wszystkich rekordach utworzonych 05.09, patrz `evidence/odbior-zywo-20260905/UTWORZONE_REKORDY.md`).
Gdzie DBR77 ma już realny rekord z tego samego dnia — scenariusz go **używa**, nie tworzy duplikatu.
Gdzie brakuje — scenariusz tworzy dokładnie jeden, realistyczny rekord przez UI (zgodnie ze zmianą
zasad właściciela 05.09: „wolno tworzyć REALISTYCZNE rekordy na stagingu tam, gdzie ekran jest pusty
z braku danych… zakaz usuwania i edycji istniejących rekordów właściciela"), i **loguje go**
do `evidence/odbior-zywo-20260905/UTWORZONE_REKORDY.md` w tym samym formacie co dotychczasowe wpisy
(moduł, nazwa, id, trasa, po co). Żaden scenariusz nie tworzy rekordu, który wywołuje płatne
zapytanie do AI bez wyraźnej potrzeby testu tego kroku — jeśli krok scenariusza jest „poproś Teresę
o X", zaznaczone jest wprost jako jedyny płatny krok.

## Skeleton Playwright — wspólny dla wszystkich 16 scenariuszy

Wzorowany na istniejących skryptach `scripts/dev/odbior-zywo/zrzut.mjs` i
`scripts/dev/odbior-cto-20260905/klik.mjs`, przeniesiony na format `*.spec.ts` uruchamiany przez
`npx playwright test`, nie na jednorazowy skrypt `.mjs`. Różnice względem istniejących skryptów dev,
odnotowane świadomie:

- **Host `http://127.0.0.1:3000`, nie `http://localhost:3000`.** Wszystkie istniejące skrypty dev
  (`zrzut.mjs`, `klik.mjs`, `zrzut-agent-dark.mjs`) używają `localhost`. `127.0.0.1` jest tu
  wymagany przez brief, ale **uwaga na pułapkę udokumentowaną wprost w
  `scripts/dev/odbior-zywo-agent/zrzut-agent-dark.mjs` (komentarz „KOPIA ROBOTNIKA")**:
  `storageState.origins[]` w pliku `ODBIOR_AUTH_STATE` jest zapisany dla origin
  `http://localhost:3000` dokładnie — Playwright zwraca `localStorage` tylko dla **dokładnie
  pasującego** originu (schemat+host+port). `127.0.0.1` i `localhost` są w przeglądarce różnymi
  originami, mimo że wskazują na ten sam proces. Bez świadomego obejścia sesja wyląduje na `/login`.
  **Obejście (ten sam wzorzec co w `zrzut-agent-dark.mjs`):** odczytać `origins[]` z pliku auth,
  znaleźć wpis dla `http://localhost:3000`, wstrzyknąć te same pary klucz/wartość `localStorage`
  ręcznie przez `context.addInitScript` **przed** pierwszą nawigacją na nowym originie `127.0.0.1`;
  cookies (jeśli `domain=localhost` bez portu) mogą wymagać analogicznego zabiegu — zweryfikować
  przed pierwszym uruchomieniem, nie zakładać, że zadziała bez zmian.
- **Motyw jasny + ciemny jako dwa przebiegi tego samego testu**, nie osobne pliki — patrz dokument
  IV dla dokładnego mechanizmu `--theme=dark` (dziś nieistniejący, do zbudowania).

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const AUTH = process.env.ODBIOR_AUTH_STATE!;
const BASE = 'http://127.0.0.1:3000';

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'pl-PL' });

test.beforeEach(async ({ context, page }) => {
  // Obejście originu localhost→127.0.0.1 (patrz uwaga wyżej) — kopiuje localStorage
  // zapisany dla http://localhost:3000 na bieżący origin PRZED nawigacją.
  const authJson = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
  const kv = (authJson.origins || []).find((o: any) => o.origin === 'http://localhost:3000')?.localStorage ?? [];
  await context.addInitScript((entries) => {
    for (const { name, value } of entries) localStorage.setItem(name, value);
  }, kv);

  // Motyw jasny wymuszony (jak w zrzut.mjs) — przy przebiegu ciemnym podmienić na 'dark' + classList.add.
  await context.addInitScript(() => {
    const raw = localStorage.getItem('consultify-storage');
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    obj.state = { ...(obj.state || {}), theme: 'light' };
    localStorage.setItem('consultify-storage', JSON.stringify(obj));
    document.documentElement.classList.remove('dark');
  });

  // Zbiór błędów konsoli i odpowiedzi ≥400 — asercje na końcu każdego testu (patrz "Kryteria zdania").
  (page as any)._consoleErrors = [];
  (page as any)._httpErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') (page as any)._consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => (page as any)._consoleErrors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) (page as any)._httpErrors.push(`${r.status()} ${r.url()}`); });
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = (page as any)._consoleErrors as string[];
  const http = (page as any)._httpErrors as string[];
  // Dokumentowane wyjątki (404 zamierzone jako kontrakt, patrz P5/CZ1 itd.) wchodzą do allowlisty
  // per-scenariusz — patrz sekcja "Kryteria zdania" niżej i tabelę wyjątków w każdym scenariuszu.
  testInfo.attach('console-errors.json', { body: JSON.stringify(errors, null, 1) });
  testInfo.attach('http-errors.json', { body: JSON.stringify(http, null, 1) });
});
```

Selektory w każdym scenariuszu niżej są podane w składni Playwright preferującej rolę/tekst
(`page.getByRole('button', { name: 'Otwórz' })`, `page.getByText('...')`) zgodnie z briefem — tam,
gdzie audyt A/B/C już zidentyfikował, że natywny `title`/tekst jest niestabilny (np. ucięte etykiety
kolumn, MP2/P2), selektor celuje w `data-testid`/rolę strukturalną, nie w widoczny, ucinany tekst.

## Kryteria zdania — wspólne dla wszystkich 16

1. **Zero błędów konsoli** poza udokumentowaną allowlistą per-scenariusz (np. 404
   `/api/ai/stream/partial/:id` w Czacie, jawnie odnotowane jako „zamierzony kontrakt, do naprawy w
   P5" — test **rejestruje**, że wystąpił, ale nie failuje na TYM konkretnym, wcześniej
   udokumentowanym wpisie; każdy INNY błąd konsoli failuje test).
2. **Zero odpowiedzi ≥400** poza tą samą allowlistą.
3. **Stan przeżywa odświeżenie i „Wstecz" przeglądarki** — filtr Menu 3, otwarty rekord, aktywna
   zakładka; MP16 (filtr „Krytyczne" w Mojej Pracy) i „Pełna karta Inicjatywy po odświeżeniu wraca
   cicho do listy" (audyt B, Inicjatywy) są przykładami znanych **dzisiejszych** naruszeń tego
   kryterium — scenariusze, które przez nie przechodzą, mają to wprost zaznaczone jako
   `BLOKADA DZIŚ`, nie jako cichy fail.
4. **Żaden krok nie wisi dłużej niż 2 s bez informacji zwrotnej** (spinner/skeleton/tekst) — gdzie
   dziś to nie jest prawda (Realizacja Praca/Zasoby 15-22 s, Narzędzia Operacyjne 5-10 s, canvasy
   pomysłu w Mojej Pracy 4-6 s), scenariusz zaznacza `BLOKADA DZIŚ (P5)` w danym kroku, zamiast
   podnosić próg progu na sztywno pod dzisiejszy stan.

---

## 1. Czat AI

**Scenariusz:** konsultant otwiera wcześniejszą rozmowę o redukcji kosztów produkcji DBR77,
sprawdza źródła cytowane przez Teresę, wraca do listy.

**Dane:** istniejąca konwersacja `cff44da8-274b-4bb3-bfbf-0513e3139e65` („DEC-396 redukcja kosztów
produkcji", utworzona 05.09 podczas pomiaru agenta — realna, nietestowa treść). Nowych rekordów nie
trzeba tworzyć.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/chat')` | Lista historii widoczna, bez „QA folder"/„test Tomek" **po P8** (dziś: te pozycje są widoczne — `BLOKADA DZIŚ (P8)`, nie failuje testu funkcjonalnego, ale failuje kryterium „zero danych testowych") |
| 2 | `page.getByText('DEC-396').click()` (albo bezpośrednio `page.goto('/chat/cff44da8-...')`) | Konwersacja się otwiera, treść widoczna |
| 3 | Sprawdzić chip źródeł: `page.getByText(/source/i)` | **Dziś:** „1 sources" po angielsku (`CZ2`) — `BLOKADA DZIŚ (P3)` do naprawy w paczce II/Czat |
| 4 | `page.goBack()` | Wraca do listy historii, ta sama pozycja podświetlona jako ostatnio otwarta |

**Playwright — specyfika:** selektor kroku 2 celuje w `data-testid` konwersacji, jeśli istnieje
(do potwierdzenia w `ConversationItem.tsx`), bo tekst tytułu może się zmienić przy naprawie CZ5
(domyślny tytuł „New conversation").

**Zablokowane dziś:** krok 3 (P3 — brak i18n), kryterium „zero danych testowych" w kroku 1 (P8),
404 `stream/partial` w tle przy każdym otwarciu (P5, CZ1) — test rejestruje, nie failuje (w
allowlist do czasu naprawy).

---

## 2. Moja Praca

**Scenariusz:** konsultant zapisuje pomysł na cyfrowego bliźniaka linii montażowej, otwiera go w
widoku Tabela, konwertuje wiersz przez menu kontekstowe, wraca do Skrzynki i sprawdza, że filtr
Menu 3 przeżył przejście między zakładkami.

**Dane:** istniejący pomysł „Cyfrowy bliźniak linii montażowej — analiza wykonalności"
(`400d107a-1cdb-4b25-bf49-7d323942f91b`, `/my-work/ideas/400d107a-1cdb-4b25-bf49-7d323942f91b/workspace/table`,
utworzony 05.09 właśnie do tego celu — „test menu wiersza i wklejania ze schowka"). Nowych rekordów
nie trzeba tworzyć.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/my-work')`, `page.getByRole('tab',{name:'Skrzynka'}).click()` | Tabela z otwartym podglądem (ekran flagowy paczki II) |
| 2 | Ustawić filtr Menu 3 na „Krytyczne" | Lista filtruje się |
| 3 | `page.getByRole('tab',{name:'Zadania'}).click()`, potem z powrotem `{name:'Skrzynka'}` | **Dziś:** filtr „Krytyczne" znika (`MP16`) — `BLOKADA DZIŚ`, kryterium 3 (stan przeżywa nawigację) nie jest spełnione |
| 4 | `page.goto('/my-work/ideas/400d107a.../workspace/table')` | Canvas tabeli pomysłu się otwiera; **dziś** 4-6 s ciszy bez szkieletu (`MP5`) — `BLOKADA DZIŚ (P5)` |
| 5 | Prawy-klik na wierszu tabeli pomysłu → menu kontekstowe | Menu się otwiera (dowód: `idea-table-tool-kebab`, już zweryfikowany 05.09) |
| 6 | Zakładka „Teresa" w panelu bocznym | Treść bez surowego markdownu `##`/`-` w **naprawionej** wersji; **dziś** surowy markdown widoczny (`MP9`) — `BLOKADA DZIŚ` |

**Zablokowane dziś:** krok 3 (MP16 — poza P1-P6, osobna naprawa), krok 4 (MP5/P5), krok 6 (MP9).
Krok 1 zależy na pełną ocenę 3/3 od **P1+P2** (paczka II/Moja Praca).

---

## 3. Wywiad

**Scenariusz:** konsultant otwiera zakładkę Sesje, filtruje po statusie, otwiera jedną sesję DRD z
podglądu, sprawdza że macierz DRD **nie** jest wspominana w tym module (uwaga właściciela 05.09).

**Dane:** sesja DRD „Digital Readiness Diagnosis" dla DBR77 (`203d5476-657b-4033-9ff3-d2c177dc047c`,
`/assessment/drd/203d5476-...`) — **uwaga:** ta sesja żyje pod trasą `/assessment/`, nie
`/interview/`, co samo w sobie jest dowodem materialnym na słuszność uwagi właściciela („DRD nie
jest w wywiadzie") — scenariusz Wywiadu powinien znaleźć **inną**, natywną sesję wywiadu w
`/interview?tab=sessions`, nie tę. Jeśli żadna nie istnieje z realną treścią DBR77, utworzyć jedną
przez UI (kreator „Przydziel" → szablon → uczestnik) i zalogować w `UTWORZONE_REKORDY.md`.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/interview?tab=sessions')` | Lista sesji Wywiadu (nie DRD) |
| 2 | Filtr Menu 3 po statusie | Lista się zawęża |
| 3 | Klik w wiersz sesji (single-click) | `StandardPreview` się otwiera z rekomendacją i szczegółami |
| 4 | `page.getByRole('tab', {name:/DRD|Macierz/i})` | **Oczekiwany wynik: element NIE istnieje** w module Wywiad — jeśli istnieje, to jest dokładnie defekt zgłoszony przez właściciela, test failuje świadomie na obecność, nie na brak |
| 5 | Klik w zakładkę steperową odległą od bieżącej (np. „Inicjatywy") | Nagłówek/breadcrumb **nie** przewija się i nie znika (`W2`) — **dziś: przewija się, BLOKADA DZIŚ** |

**Zablokowane dziś:** krok 5 (W1/W2, paczka II/Wywiad), krok 4 zależy od usunięcia referencji DRD
(paczka II/Wywiad, krok 4 tamtej listy).

---

## 4. Narzędzia

**Scenariusz:** konsultant otwiera Bibliotekę, wchodzi w jedyne realnie aktywne narzędzie („Dynamic
SWOT"), otwiera istniejącą sesję DBR77, sprawdza pełny widok przy 1440 px.

**Dane:** istniejąca sesja „Dynamic SWOT — Session (853a73cf)"
(`853a73cf-6ea9-473e-bea9-05e33384b54a`, `/discovery-tools?tab=sessions&docId=853a73cf-...`).

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/discovery-tools')` | Biblioteka renderuje się, bez czerwonych elementów **po P6** (dziś: kategoria „Oceny" czerwona — `BLOKADA DZIŚ`) |
| 2 | Klik w wiersz „Dynamic SWOT" | Podgląd się otwiera |
| 3 | `page.getByRole('button',{name:'Otwórz'})` | Pełny widok narzędzia (`KnownToolDetailView`) |
| 4 | Sprawdzić nagłówek przy viewport 1440 | **Dziś:** „Aktywne"/„Sekcje" nachodzi na „Zapisano"/„Baza wiedzy" (`N7`) — `BLOKADA DZIŚ (P6)` |
| 5 | `page.goto('/discovery-tools/strategic/megatrends')` (osobna gałąź scenariusza, nie kontynuacja) | **Oczekiwany wynik dziś: ekran martwy** — `GET /api/megatrends/baseline` 503 trwale, „Spróbuj ponownie" też pada (`N5`). To jedyny scenariusz z tego dokumentu, w którym cel testu jest **potwierdzić, że coś jest zepsute**, nie że działa — do naprawy poza zakresem P1-P6 (własna pozycja w fali 2 lub naprawy równoległej) |

**Zablokowane dziś:** krok 1 (P6), krok 4 (N7/P6), krok 5 (N5 — całkowicie martwy, nie należy do
żadnej z paczek P1-P6, wymaga osobnej naprawy backendu importu modelu).

---

## 5. Ocena

**Scenariusz:** konsultant otwiera sesję DRD DBR77, przechodzi przez wywiad, ogląda macierz w trybie
pełnoekranowym, próbuje wygenerować raport i go przeczytać — scenariusz, który dziś **urywa się na
pustym raporcie** (TOP-1 znalezisko całej części B audytu).

**Dane:** sesja DRD „Digital Readiness Diagnosis" dla DBR77 (`203d5476-657b-4033-9ff3-d2c177dc047c`)
+ jej zamrożony Output (`92f3bd7f-7048-44c8-a023-392b982c52ee`, frozenSnapshotId
`40e92571-cddc-4a65-9b25-8e4b45669014`, wersja v5, stan `frozen`, utworzony 05.09 właśnie przez
przejście przez zamrożenie SUPERADMIN). Oba rekordy już istnieją — nie tworzyć nowych.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/assessment/drd/203d5476-657b-4033-9ff3-d2c177dc047c')` | Ekran wywiadu DRD, pytania z uzasadnieniem „Dlaczego pytamy" |
| 2 | Przejść do zakładki Macierz | Macierz w panelu, komórki mogą obcinać etykiety bez tooltipa (`ocena-09-drd-raport-hover-trunc.png`, część P2) |
| 3 | `page.getByRole('button',{name:/pełny ekran|fullscreen/i})` | Tryb pełnoekranowy — **ekran flagowy paczki II**, `Esc` zamyka |
| 4 | `page.goto('/assessment/outputs/92f3bd7f-.../report')` | **Oczekiwany wynik dziś: pusty dokument** „Zacznij budować raport — Dodaj pierwszy blok" mimo statusu „Finalne"/80% w liście — `BLOKADA DZIŚ`, poza zakresem P1-P6, wymaga osobnej naprawy (przepływ treści raportu-oceny do bloków Kreatora raportów) |
| 5 | `page.goto('/assessment/outputs/92f3bd7f-.../presentation')` | **Oczekiwany wynik dziś: potwierdza pustkę** — „Podgląd raportu — 0 sekcji" |

**Zablokowane dziś:** kroki 4-5 — to jest **centralny, najcięższy blokujący defekt tego dokumentu**:
dokładnie ten scenariusz, którego właściciel się boi („nigdy nie powstał ani jeden naprawdę dobry
dokument z szablonu", pamięć nadzorcy). Nie jest częścią żadnej z paczek P1-P6 — wymaga własnej,
dedykowanej naprawy poza fundamentami (audyt B szacuje Impact **H**, Effort **M**: „trzeba
prześledzić, dlaczego zawartość raportu-oceny nie trafia do bloków Kreatora raportów przy statusie
Final").

---

## 6. Inicjatywy

**Scenariusz:** konsultant otwiera tabelę inicjatyw DBR77, filtruje, otwiera podgląd
jednokliknięciem (ekran flagowy), próbuje otworzyć pełną kartę (24 sekcje), odświeża stronę na pełnej
karcie.

**Dane:** dowolna istniejąca inicjatywa DBR77 z tabeli `/initiatives` — audyt B użył rekordu ze
slugiem demo `demo-story-20260826-initiative-traceability`, który generuje 11×404 (bo nie jest
realnym UUID). Scenariusz **musi** użyć realnego UUID inicjatywy DBR77, nie tego slugu, żeby test
faktycznie sprawdzał ścieżkę produkcyjną, a nie znany, osobno udokumentowany przypadek demo — do
ustalenia przez `GET /api/v8/planning/initiatives?organizationId=a3e05d4a-...` przed napisaniem testu.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/initiatives')` | Tabela, nagłówek Menu 1 **dziś** „Initiatives" po angielsku (`BLOKADA DZIŚ (P3)`) |
| 2 | Klik w wiersz (single-click) | `StandardPreview` — **ekran flagowy paczki II**, 3/3 |
| 3 | `page.getByRole('button',{name:'Otwórz'})` | Pełna karta (24 sekcje) się otwiera |
| 4 | Sprawdzić sekcje karty dla realnego UUID | Zapytania API zwracają dane (nie 404×11 — to był artefakt slugu demo w audycie, nie oczekiwany stan dla realnego rekordu; **do potwierdzenia w tym teście**, nie zakładać z góry) |
| 5 | `page.reload()` na URL `?mode=doc&open=<id>` | **Dziś:** cichy powrót do listy zamiast zachowania widoku dokumentu — `BLOKADA DZIŚ`, kryterium 3 (stan przeżywa odświeżenie) nie spełnione |

**Zablokowane dziś:** krok 1 (P3), krok 5 (utrata stanu przy deep-linku, poza P1-P6 — osobna
naprawa routingu trybu dokumentu). Krok 4 wymaga weryfikacji na realnym rekordzie zamiast slugu
demo, bo dzisiejsza ocena „11×404" audytu może nie reprezentować normalnej ścieżki.

---

## 7. Realizacja

**Scenariusz:** menedżer sprawdza Kokpit, przechodzi do zakładki Praca żeby zobaczyć rejestr
realizacji DBR77, i do Zasobów — scenariusz, który dziś **wisi 15-22 sekundy** bez informacji na obu
drugich krokach.

**Dane:** istniejące realizacje DBR77 widoczne w `/execution?tab=work` — w tym realizacja
`a3e05d4a-5397-...-acceptance-execution-case`, której endpoint pracy nie odpowiada (znany,
udokumentowany przypadek — mechanizm `fanOutExecutionCases` ma go obsłużyć banerem „Niepełne dane").
Nie tworzyć nowych rekordów — cel testu to zmierzyć realny czas odpowiedzi, nie ominąć problem.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/execution')` | Kokpit menedżera — **ekran flagowy paczki II**, 5 kafli KPI |
| 2 | `page.getByRole('tab',{name:'Praca'}).click()` | Skeleton/spinner widoczny **od pierwszej sekundy** (kryterium 4) — **dziś: brak, tylko tekst „Wczytuję kanoniczny rejestr pracy..." bez ruchu, `BLOKADA DZIŚ (P5)`** |
| 3 | `expect(page.getByText('Niepełne dane')).toBeVisible({timeout: 25000})` | Baner degradacji pojawia się — **dziś w 15,5-22 s**, przekracza deklarowany `EXECUTION_CASE_FANOUT_TIMEOUT_MS=12000` — test rejestruje realny czas jako metrykę, nie tylko pass/fail |
| 4 | `page.getByRole('tab',{name:'Zasoby'}).click()` | To samo zjawisko, gorsze — ekran zupełnie pusty przez pierwsze ~15 s (`BLOKADA DZIŚ (P5)`) |

**Zablokowane dziś:** kroki 2-4 (P5, paczka II/Realizacja) — to jest TOP-2 znalezisko części B
audytu („Impact H — dwa z sześciu ekranów Menu 2 Realizacji").

---

## 8. Wyniki

**Scenariusz:** konsultant otwiera rejestr KPI, przechodzi do zestawienia „Karta wyników
transformacji", otwiera dodany 05.09 element „Acceptance KPI — benefits realization", potem
osobno: rejestr OKR → zestaw → cel → pełna karta.

**Dane:** zestawienie „Karta wyników transformacji" (`4fdc1bb9-dd71-4dda-a4a4-9e03fa87faf4`) z
pozycją „Acceptance KPI — benefits realization" (`e635d6a0-eee1-448b-a932-a8a435eb9f14`, dodaną
05.09 właśnie po to, żeby ten poziom nawigacji miał na czym się pokazać — **to jest dokładnie
naprawiona przez P7 ścieżka**, scalona 05.09 17:30). Dla części OKR: dowolny istniejący cel z
rejestru `/results/okr`.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/results/kpi')` | Rejestr KPI, nagłówek Menu 1 **dziś** „Resultaty" (`BLOKADA DZIŚ (P3)`), placeholder „Search" zamiast „Szukaj" |
| 2 | Klik w wiersz zestawienia „Karta wyników transformacji" | Lista zestawienia z opisem i pozycjami — **dokładnie to, czego brakowało właścicielowi przed P7** |
| 3 | Klik w pozycję „Acceptance KPI — benefits realization" | Karta pojedynczego KPI się otwiera |
| 4 | `page.goto('/results/okr')` → klik w zestaw → klik w cel → „Otwórz pełną kartę" | Pełna karta celu OKR — **ekran flagowy paczki II**, potwierdzone 1:1 z referencją właściciela |
| 5 | Sprawdzić pole „Pewność ogólna" na liście zestawu (**przed** wejściem w pełną kartę) | **Dziś:** „Srednia" bez polskiego znaku w tabeli/przeglądzie zestawu, ale poprawnie „Średnia" w pełnej karcie tego samego rekordu — dwa różne słowniki tej samej wartości enum (`BLOKADA DZIŚ`, część **P4**-sąsiedniej rodziny defektów, cross-module z Inicjatywami) |

**Zablokowane dziś:** krok 1 (P3), krok 5 (rozjazd słownika „Średnia"/„Srednia" — poza P1-P6 per
się, ale tej samej rodziny co P3/P4, do naprawy razem).

---

## 9. Finanse

**Scenariusz — nie dotyczy w obecnej fali MVP.** Moduł wycofany decyzją właściciela 05.09
(„wyrzucamy z MVP, to co pokazałeś jest gorsze niż to, co było"). Scenariusz udokumentowany tu na
przyszłość (fala 2), na bazie realnych rekordów DBR77 już istniejących na stagingu (statement packs
`19ff7554-1e82-446b-b4d5-00981eba7c24` 2024 i `901581c8-0668-454e-98a1-ce316a6d9f10` 2025, model
bazowy `08b2fad8-b072-4d02-8ec4-3ff6b948ce39`), bez uruchamiania w tej fali.

| # | Krok | Oczekiwany wynik (fala 2, nie dziś) |
| :-: | --- | --- |
| 1 | `page.goto('/finance?tab=statements')` | Lista sprawozdań — ekran flagowy wybrany w paczce II |
| 2 | Otworzyć pakiet 2025 | **Znany, udokumentowany blokujący defekt fali 2 poza zakresem tego programu:** model bazowy zwraca `409 BASELINE_CONTEXT_NOT_CONFIGURED` niezależnie od trybu utworzenia (Runda 6/7 w `UTWORZONE_REKORDY.md`) — strukturalna luka konfiguracji kontekstu, nie defekt UI |

**Zablokowane dziś:** cały moduł (decyzja zakresu, nie defekt).

---

## 10. Materiały

**Scenariusz:** konsultant otwiera Bibliotekę materiałów, tworzy nowy dokument przez Document
Studio, wraca do biblioteki i otwiera go ponownie.

**Dane:** istniejący dokument roboczy „Nowy dokument — pusty, z wstawionymi blokami Tabela/KPI/
Wykres" (`artifact-2dfa9b26-9cb3-4da4-92de-b58804252e53`, `/document-studio/artifact-2dfa9b26-...`,
utworzony 05.09 właśnie do tego celu) — użyć do kroku „otwórz ponownie"; krok „utwórz nowy" tworzy
**jeszcze jeden**, osobny dokument (zgodnie z celem testu — sprawdzić sam kreator, nie tylko
ponowne otwarcie), zalogować w `UTWORZONE_REKORDY.md`.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/materials?tab=all')` | Biblioteka, tytuły wierszy mogą być ucięte bez tooltipa (P2) |
| 2 | `page.getByRole('button',{name:/nowy dokument/i})` | Modal wyboru trybu „Od zera"/„Z AI" — **ekran flagowy paczki II** |
| 3 | Wybrać „Od zera" | Document Studio się otwiera, pusty dokument |
| 4 | Zapisać, wrócić do Biblioteki | Nowy dokument widoczny na liście |
| 5 | `page.goto('/document-studio/artifact-2dfa9b26-...')` (rekord istniejący) | Dokument otwiera się z blokami Tabela/KPI/Wykres nietkniętymi |

**Zablokowane dziś:** brak znanej blokady na tej dokładnej ścieżce — audyt C nie zmierzył pełnego
cyklu create→edit→save→reopen (wprost w `NIE_DOTARLEM`), więc **ten scenariusz jest pierwszym realnym
pomiarem tej ścieżki**, nie potwierdzeniem czegoś już zmierzonego.

---

## 11. Audyty

**Scenariusz:** audytor otwiera bibliotekę programów audytowych DBR77, otwiera opublikowany pakiet,
otwiera aktywną sesję audytową, próbuje dojść do warsztatu kryterium i do łańcucha
Output→Raport.

**Dane:** pakiet audytowy „Audyt gotowości do robotyzacji — linia spawalnicza"
(`apk_56c9594a-3d8f-48c2-8e95-b62e26fb218e`, opublikowany, 3 domeny/6 kryteriów), sesja
„…— 05/09/2026" (`aprog_9e1d5652-c277-4178-8697-c1a7e105f7cf`), Output v1
(`aout_261354fb-3808-4185-bda9-d75f47211785`), Raport poaudytowy v1
(`arep_a2ac215a-bcd8-48f2-bc46-0629453624d0`) — pełny łańcuch już istnieje z 05.09, zbudowany
właśnie po to, żeby ten scenariusz miał na czym się wykonać.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/audit-programs?tab=library')` | Biblioteka, breadcrumb Menu 1 **dziś** „Audits" po angielsku (`BLOKADA DZIŚ (P3)`) |
| 2 | Klik w pakiet (single-click) | Podgląd programu audytowego — **ekran flagowy paczki II**; **dziś brak przycisku „Otwórz" w nagłówku** — krok 3 musi obejść przez inny selektor (`BLOKADA DZIŚ`) |
| 3 | `page.goto('/audit-programs?tab=processes')`, klik w sesję | Warsztat kryterium (`/audit-programs/:programId/criteria/:criterionId`) — **audyt C nie znalazł bezpośredniego linku z podglądu programu** (`NIE_DOTARLEM`); ten krok jest pierwszym potwierdzeniem, czy nawigacja w ogóle istnieje |
| 4 | `page.goto('/audit-programs?tab=outputs&ff_auditsReportChain=1')` | Output v1 widoczny |
| 5 | `page.goto('/audit-programs/reports/arep_a2ac215a-...')` | Raport poaudytowy (szkic) się otwiera — powłoka artefaktu dokumentowego |

**Zablokowane dziś:** krok 1 (P3), krok 2 (brak „Otwórz", paczka II/Audyty), krok 3 (nawigacja do
warsztatu kryterium niepotwierdzona — do zmierzenia po raz pierwszy w tym scenariuszu, nie w
audycie).

---

## 12. Spotkania

**Scenariusz:** konsultant otwiera listę spotkań, otwiera jedno spotkanie, sprawdza sugestię AI
(dziś po angielsku), oznacza jako zakończone.

**Dane:** dowolne istniejące spotkanie DBR77 z listy `/meetings` — audyt C nie precyzuje konkretnego
id; jeśli lista jest pusta dla realnych spotkań DBR77, utworzyć jedno przez UI (temat: przegląd
statusu wdrożenia robotyzacji linii spawalniczej) i zalogować w `UTWORZONE_REKORDY.md`.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/meetings')` | Lista, status w komórce może być ucięty bez tooltipa (P2) |
| 2 | Klik w wiersz (single-click) | Podgląd spotkania — **ekran flagowy paczki II**: karta meta, SZCZEGÓŁY, blok AI, POWIĄZANIA |
| 3 | Sprawdzić blok sugestii AI | **Dziś:** treść w 100% po angielsku — `BLOKADA DZIŚ`, przyczyna nierozstrzygnięta (prompt czy dane seed — do ustalenia w kroku 1 paczki II/Spotkania) |
| 4 | `page.getByRole('button',{name:'Oznacz jako zakończone'})` | Status się zmienia, przeżywa odświeżenie |
| 5 | `page.goto('/meetings/:id/minutes')` (jeśli id istnieje) | **NIE_DOTARLEM w audycie C** — pierwszy realny pomiar tej podtrasy |

**Zablokowane dziś:** krok 3 (przyczyna nieznana, paczka II/Spotkania krok 1).

---

## 13. Organizacja

**Scenariusz:** konsultant otwiera profil organizacji DBR77, sprawdza sekcję Tożsamość, próbuje
przejść do „Members".

**Dane:** organizacja DBR77 sama w sobie (`a3e05d4a-5397-419d-b486-8e44366c0063`) — profil już
istnieje z realną treścią („Stan danych" 2/13 pól, 864 zatwierdzone fakty). Nie tworzyć nowych
rekordów.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/organization')` | Nagłówek Menu 1 **dziś** „Organization" po angielsku (`BLOKADA DZIŚ (P3)`), breadcrumb pod nim poprawnie polski |
| 2 | Klik „Tożsamość i model działania" | **Ekran flagowy paczki II** — treść mocna, „Zapisz zmiany"/„Opublikuj wersję kontekstu" widoczne |
| 3 | `page.goto('/organization/members')` | **Dziś:** ciche przekierowanie do `/admin/team/members`, breadcrumb i nagłówek zmieniają się na „Panel Administratora" bez ostrzeżenia — `BLOKADA DZIŚ`, pytanie otwarte do właściciela (zamierzona konsolidacja czy dług routingu) |

**Zablokowane dziś:** krok 1 (P3), krok 3 (routing, poza P1-P6, wymaga decyzji właściciela przed
implementacją naprawy — nie jest jasne, co jest „poprawnym" zachowaniem).

---

## 14. Panel Administratora

**Scenariusz:** administrator otwiera Panel, sprawdza (nieistniejący) ekran Przegląd, przechodzi do
Bezpieczeństwa i tożsamości → Polityka bezpieczeństwa.

**Dane:** brak potrzeby nowych rekordów — konto właściciela ma już rolę administratora organizacji
DBR77.

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/admin/overview')` | **Dziś:** ciche przekierowanie do `/admin/team/members`, ale górny pasek Menu 1 dalej pokazuje „Przegląd" — desynchronizacja breadcrumb/treść (`BLOKADA DZIŚ`) |
| 2 | `page.getByRole('link',{name:/Bezpieczeństwo i tożsamość/i}).click()` → „Polityka bezpieczeństwa" | **Ekran flagowy paczki II** — sub-taby w pełni po polsku, 3 karty (MFA/SSO/Sesja) |
| 3 | `page.goto('/superadmin/ai-platform')` (konto bez roli superadmina) | Poprawnie przekierowuje do `/chat` — **to jest oczekiwane zachowanie**, nie defekt (niemierzalne na tym koncie z zamierzonego powodu) |

**Zablokowane dziś:** krok 1 (desynchronizacja breadcrumb, poza P1-P6 — do namierzenia w routingu
wewnętrznym Panelu, `ROUTES.ADMIN.OVERVIEW` zdefiniowane, ale brak referencji w `AppRoutes.tsx` dla
dedykowanego renderowania).

---

## 15. Ustawienia

**Scenariusz:** użytkownik otwiera swój profil, sprawdza niespójność plakietki roli, przechodzi do
Bezpieczeństwa → Przegląd bezpieczeństwa.

**Dane:** brak potrzeby nowych rekordów — profil zalogowanego użytkownika (Piotr Wiśniewski, OWNER).

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/settings/profile')` | **Dziś:** plakietka roli „Product" po angielsku obok pola „Dział: Produkt" po polsku — ta sama wartość, dwa języki w jednym ekranie (`BLOKADA DZIŚ`) |
| 2 | `page.getByRole('link',{name:/Bezpieczeństwo/i}).click()` → „Przegląd bezpieczeństwa" | **Ekran flagowy paczki II** — karta „0% Wymaga poprawy" (czerwień poprawnie krytyczna), etykieta „Odroczone / Nieuwzględnione w demo MVP" przy 2FA |

**Zablokowane dziś:** krok 1 (rozjazd słownika roli, ta sama rodzina co P3/P4, poza flagowym
ekranem tej paczki).

---

## 16. Partnerzy

**Scenariusz:** gość (bez sesji) otwiera stronę aplikacji partnerskiej, loguje się kontem bez roli
partnera, widzi pusty stan portalu.

**Dane:** brak nowych rekordów — konto właściciela nie ma roli partnera (celowo, zgodnie z zakazem
tworzenia kont niepotrzebnych do tego pomiaru).

| # | Krok | Oczekiwany wynik |
| :-: | --- | --- |
| 1 | `page.goto('/become-partner/apply')` (bez sesji) | Strona marketingowa; CTA **dziś** crimson (`#85182F`-podobny) — `BLOKADA DZIŚ`, ale poza kanonem SPEC-A wprost (strona marketingowa, osobny system wizualny — pytanie otwarte do właściciela, nie do rozstrzygnięcia w tej paczce) |
| 2 | `page.goto('/auth')`, zalogować kontem właściciela | Ekran logowania — jeden z dwóch kandydatów na ekran flagowy paczki II |
| 3 | `page.goto('/partner')` | Portal partnerski — pusty stan „Profil partnera nie jest jeszcze podłączony" — drugi kandydat, **oba 3/3 dziś** |

**Zablokowane dziś:** krok 1 (crimson, pytanie o zakres kanonu — nie blokuje flagowego wyboru z
kroków 2-3).

---

## Zbiorczo — ile przepływów jest dziś zablokowanych

| Moduł | Zablokowane kroki dziś | Powiązanie z paczką |
| --- | :-: | --- |
| Czat | 2 (chip i18n, dane testowe) | P3, P8 |
| Moja Praca | 3 (filtr Menu 3, canvas w ciszy, markdown Teresy) | P5, poza P1-P6 (MP16), poza P1-P6 (MP9) |
| Wywiad | 2 (nawigacja steppera, DRD w Wywiadzie) | poza P1-P6 (W1/W2), własna poprawka |
| Narzędzia | 3 (crimson, nakładanie nagłówka, Megatrendy martwe) | P6, P6, poza P1-P6 (N5) |
| Ocena | 2 (raport pusty ×2 kroki) | poza P1-P6, własna duża naprawa |
| Inicjatywy | 2 (nagłówek EN, utrata stanu po odświeżeniu) | P3, poza P1-P6 |
| Realizacja | 3 (Praca i Zasoby wiszą, ×2 zakładki + brak spinnera) | P5 |
| Wyniki | 2 (nagłówek „Resultaty", rozjazd „Średnia"/„Srednia") | P3, poza P1-P6 |
| Finanse | cały moduł (poza MVP) | decyzja zakresu |
| Materiały | 0 potwierdzonych (pierwszy pomiar tej ścieżki) | — |
| Audyty | 3 (breadcrumb EN, brak „Otwórz", nawigacja do warsztatu niepotwierdzona) | P3, własna poprawka, do zmierzenia |
| Spotkania | 1 (blok AI po angielsku) | do ustalenia (P3 albo dane) |
| Organizacja | 2 (nagłówek EN, routing „Members") | P3, decyzja właściciela |
| Panel Administratora | 1 (desynchronizacja breadcrumb Przegląd) | poza P1-P6 |
| Ustawienia | 1 (rozjazd słownika roli) | poza P1-P6 |
| Partnerzy | 1 (crimson na stronie marketingowej, poza kanonem wprost) | pytanie otwarte |

**Razem: 26 kroków zablokowanych dziś na 16 scenariuszach** (Finanse liczony jako „cały moduł", nie
jako liczba kroków, bo scenariusz w ogóle nie wchodzi w tej fali). Naprawa **P1-P6** (paczki
fundamentów z dokumentu II) odblokowuje bezpośrednio **12 z 26** kroków; pozostałe **14** wymagają
osobnych, punktowych napraw poza fundamentami (macierz raportu w Ocenie, fan-out w Realizacji ponad
wynikiem P5, MP16/MP9 w Mojej Pracy, nawigacja steppera w Wywiadzie, routing Organizacji/Panelu
Administratora, rozjazdy słowników „Średnia"/rola, crimson na stronie marketingowej — każda z nich
ma już przypisany Effort/Impact w dokumencie II lub w audycie źródłowym).
