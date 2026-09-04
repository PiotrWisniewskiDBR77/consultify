# CODEX DAY 323 — kreatory Wywiadu i Inicjatyw

## Werdykt

`PARTIAL / DO DECYZJI WŁAŚCICIELA`. R1–R4 wykonane. R2 naprawia wyłącznie cztery zestarzałe asercje i ma własny RED→GREEN. R5 nie przechodzi w całości: wspólna powłoka nie wykazała pełnego cyklu Tab i nie daje `focus-visible` każdemu elementowi; Kreator Inicjatyw używa jawnego fioletu `#8b5cf6`. Zgodnie z B.1 nie zmieniono współdzielonego `WizardModal.tsx` (używa go też ReportGeneratorWizard).

## R1 — wejście

```text
df -h / → 61 GiB wolne
merge-base … && echo → MARKER OK
rev-parse HEAD → bc18bc7acac2ec825ebb3db2f1309738ab034d58
status --short → (pusto)
port 5479 → pusty; port 6339 → pusty; kontenery cx-day323 → 0
test bazowy → Tests 4 failed | 8 passed (12)
lista część B → 43
rejestr 20260903 → No such file or directory
```

Tip `github-backup/grafika/m03-20260902` uciekł o sześć commitów do przodu (`0a7e3ddb33`…`192b38d022`); zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera. Zmienione na tipie są wyłącznie źródła/konfiguracje instrukcji 314–323 oraz ich wydane dokumenty; scalenie należy do nadzorcy.

Lokalny `pgvector/pgvector:pg16` na `127.0.0.1:6339`, baza `cx323`: pierwszy pełny przebieg migracji zakończony `✅ Postgres migrations complete`; drugi: `Applying migrations: 0`, `✅`.

Dowód Z30: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; Gateway nie zawiera drenaży. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R2 — cztery asercje

Zmiana: cztery `getByLabelText` nadal wymagają relacji label/input, ale oczekują zatwierdzonego `(required)` / `(wymagane)` zamiast ` *`.

```text
przed: Tests 4 failed | 8 passed (12)
po zmianie: Tests 12 passed (12)
mutacja: usunięto htmlFor="insight-creator-title" → Tests 4 failed | 8 passed (12)
przywrócenie przez cp → Tests 12 passed (12)
git diff -- InsightCreatorModal.tsx → pusto
diff przed-nazwy.txt po-nazwy.txt → pusto (12 identycznych fullName)
```

Pułapki Z33: pakiet jest czysto komponentowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc bramki V8/PG/auth nie leżą na ścieżce. Atrapę `react-i18next` uwzględniono: naprawa nie jest dowodem kompletności pliku PL, tylko dostępnej nazwy i relacji label/input; RED po usunięciu `htmlFor` dowodzi nie-tautologiczności.

Commit: `8921a99d37`.

## R3 — 43×2

Pełne 86 rozstrzygnięć: [REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md](../REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md). Czerwone: 31, 32, 40, 41, 43 (dla co najmniej jednego kreatora). Commit: `d4076027b7`.

## R4 — 16 obejrzanych kadrów

Każdy plik obejrzano. Pary light/dark są różne i poprawnie pokazują motyw. Opis wspólny: `interview-step1` pokazuje definicję i wybór typu; `interview-step2` wybór materiału; `initiative-step1` źródło z uczciwym błędem niedostępności insightów; `initiative-step2` założenie, pola i uczciwy błąd niedostępności projektów. PL/EN zmieniają chrome i treść; nazwy przykładowych sesji pozostają danymi własnymi, nie chrome.

1. `evidence/kreatory-odbior-20260904/interview-step1/interview-creator-shell__PO__pl__1440__light.png`
2. `evidence/kreatory-odbior-20260904/interview-step1/interview-creator-shell__PO__pl__1440__dark.png`
3. `evidence/kreatory-odbior-20260904/interview-step1/interview-creator-shell__PO__en__1440__light.png`
4. `evidence/kreatory-odbior-20260904/interview-step1/interview-creator-shell__PO__en__1440__dark.png`
5. `evidence/kreatory-odbior-20260904/interview-step2/interview-creator-shell__PO__pl__1440__light.png`
6. `evidence/kreatory-odbior-20260904/interview-step2/interview-creator-shell__PO__pl__1440__dark.png`
7. `evidence/kreatory-odbior-20260904/interview-step2/interview-creator-shell__PO__en__1440__light.png`
8. `evidence/kreatory-odbior-20260904/interview-step2/interview-creator-shell__PO__en__1440__dark.png`
9. `evidence/kreatory-odbior-20260904/initiative-step1/inicjatywy-lista__PO__pl__1440__light.png`
10. `evidence/kreatory-odbior-20260904/initiative-step1/inicjatywy-lista__PO__pl__1440__dark.png`
11. `evidence/kreatory-odbior-20260904/initiative-step1/inicjatywy-lista__PO__en__1440__light.png`
12. `evidence/kreatory-odbior-20260904/initiative-step1/inicjatywy-lista__PO__en__1440__dark.png`
13. `evidence/kreatory-odbior-20260904/initiative-step2/inicjatywy-lista__PO__pl__1440__light.png`
14. `evidence/kreatory-odbior-20260904/initiative-step2/inicjatywy-lista__PO__pl__1440__dark.png`
15. `evidence/kreatory-odbior-20260904/initiative-step2/inicjatywy-lista__PO__en__1440__light.png`
16. `evidence/kreatory-odbior-20260904/initiative-step2/inicjatywy-lista__PO__en__1440__dark.png`

SHA-256 wszystkich plików: `/private/tmp/cx-day323-kreator-wywiadu-artefakty/screenshots.sha256`. Axe: Wywiad 0 naruszeń / 0 błędów konsoli w 8 kadrach; Inicjatywy 0 naruszeń / 14 błędów konsoli na kadr (oczekiwane niedostępne transporty harnessu, widoczne jako uczciwy stan błędu). Commit kadrów: `f5d997bcd1`.

## R5 — dostępność

- istniejące, nietykalne suity Inicjatyw + flagi: 13/13 PASS, w tym Esc i zwrot fokusa;
- po czystym otwarciu Wywiadu fokus był na panelu `tabIndex=-1`; 19 elementów było focusable, lecz lokalna próba Tab nie przesunęła aktywnego elementu poza panel — punkt 41 nie jest zaliczony;
- `WizardModal` ustawia fokus na panelu i przycisk close nie ma klasy `focus-visible`; punkt 43 jest czerwony;
- test Wywiadu w tym harnessie nie dowodzi Esc, ponieważ `onClose={() => {}}`; nie zawyżono go do PASS;
- zagnieżdżonego popoveru/selecta i zasady „jeden Esc = jedna warstwa” nie udowodniono dla wszystkich wariantów.

### DO DECYZJI WŁAŚCICIELA

Czy wspólna powłoka ma przejść osobny dyżur obejmujący wszystkie trzy konsumenty (`InsightCreatorModal`, `InitiativeWizardModal`, `ReportGeneratorWizard`) i zamienić akcent/fokus na `--c-focus` oraz dodać pełną pułapkę i widoczność fokusa? Brakuje zgody na promień obejmujący ReportGeneratorWizard oraz decyzji, czy zatwierdzony violet Inicjatyw jest wyjątkiem od literalnej listy 43.

## Korekty wobec instrukcji

1. Teza o komentarzu flagi jest częściowo fałszywa: `parseFlag` i default `true` istnieją, ale `grep DEC-2026-09-03-350` nie zwraca komentarza. Plik jest tylko do odczytu.
2. `R4` wymaga flag rozwijania dla sekcji, lecz narzędzie uznało comboboksy/filtry za zwinięte sekcje i zwróciło 0/2 (`Zbuduj nowy`, daty, role, działy; na liście także Search/Filter/row actions). Zachowano JSON błędu i powtórzono tym samym narzędziem bez wadliwej pętli; inaczej nie powstałby żaden kadr kroku 2.
3. Nazwa pliku narzędzia nie zawiera `step`, więc kroki nadpisywałyby się. Bezpiecznie rozdzielono je na podkatalogi `*-step1`/`*-step2`.
4. Instrukcja odsyła raport do nieistniejącego `§R.2`; dokument ma `R6`, ale brak sekcji `§R.2`. Zastosowano strukturę wynikającą literalnie z R6.
5. Protokół Z30 mówi „dowody przed pierwszym przebiegiem zapisującym”, ale literalny blok 0 każe najpierw uruchomić migracje. Dowody pocztowe wykonano bezpośrednio po migracjach, przed runtime/harnessem; migracje nie uruchamiają `server/src/index.ts` ani drenaży.

## TWIERDZENIA NIEZWERYFIKOWANE

- brak dowodu na pełny produktowy HTTP/ApiGateway/PG: dyżur nie zmienia backendu, a kadry pochodzą z jawnego dev-render;
- brak dowodu na urządzenia fizyczne, Safari/Firefox i czytnik ekranu;
- brak pełnego cyklu Tab/Shift+Tab obu kroków obu kreatorów;
- brak dowodu jednowarstwowego Esc przy otwartym zagnieżdżonym popoverze;
- 14 błędów konsoli na każdym kadrze Inicjatyw nie zostało uznane za defekt produkcyjnego transportu, bo harness nie zapewnia tych endpointów;
- nie rozstrzygnięto właścicielsko, czy violet Inicjatyw jest zatwierdzonym wyjątkiem od kanonu.
