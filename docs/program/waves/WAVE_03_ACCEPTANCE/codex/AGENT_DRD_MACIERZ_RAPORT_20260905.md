# Macierz DRD na ekranie RAPORTU — naprawa (2026-09-05)

Gałąź: `agent/drd-macierz-raport-20260905` (baza: `m03` @ `b066a5f8eb`)
Worktree: `/private/tmp/ag-drd-raport`

Sprawa właściciela zgłoszona PIĄTY raz: „Ciągle nie wiem dlaczego nie używasz mojej
macierzy DRD". Naprawione 01.09 w PREZENTACJI (`7e262a2b9c`) i w DOKUMENCIE raportu
(`81b1d9669f`) — ekran RAPORTU został wtedy pominięty.

---

## 1. Powierzchnie rysujące macierz — PRZED i PO

Pomiar: `rg -n "AreaMatrixTable|EmbeddedMatrix|DRDMatrixGrid" src --glob '!**/__tests__/**'`

| # | Powierzchnia (plik) | Co to jest w produkcie | Siatka PRZED | Siatka PO |
|---|---|---|---|---|
| 1 | `src/components/assessment/report/AssessmentReportContractView.tsx` | **Ekran raportu Oceny** (`ff.assessment_report_view`, domyślnie ON) | WŁASNA tabela w pliku: `Obszar / Poziom obecny / Poziom docelowy / Luka / Stan dowodów`, `aria-label` „Axis matrix table" — kształt odrzucony (Z-10) | **`DRDMatrixReadOnly` → `DRDMatrixGrid`** |
| 2 | `src/components/assessment/report/AssessmentReportDocument.tsx:382` | Dokument raportu (render zamrożonego Outputu) | `DRDMatrixReadOnly` (naprawione 01.09) | bez zmian |
| 3 | `src/components/assessment/presentation/slides.tsx:264` | Slajd „Macierz · oś N" | `DRDMatrixReadOnly` (naprawione 01.09) | bez zmian |
| 4 | `src/components/assessment/drd/DRDAssessmentEditor.tsx:1170,2262` | Ekran „Macierz oceny DRD — obszary × poziomy" (**oryginał**, ocena B właściciela 01.09) | `DRDMatrixGrid` | bez zmian |
| 5 | `src/components/assessment/AssessmentQualityReviewPanel.tsx:309` | Panel jakości oceny | `DRDMatrixGrid` | bez zmian |
| 6 | `src/components/Reports/EmbeddedMatrix.tsx` → `AxisDetailMatrix` (żywe przez `ReportBuilder` → `DRDAuditReportView`, trasa `/assessment-reports/:id/full` za `ff_drd_report`) | Rozdział osi w raporcie AUDYTU | tabela `Area / Current / Target / Gap / Progress` — **ten sam odrzucony kształt** | **`DRDMatrixReadOnly` → `DRDMatrixGrid`** (liczby całej osi zostają) |
| 7 | `src/components/Reports/AreaMatrixTable.tsx` | odrzucona macierz (Z-10) | rysowała samą siebie; wołacze: `AxisReportSection` → barrel `Reports/index.ts` → **NIKT** | **USUNIĘTA z repo** |
| 8 | `src/components/assessment/drd/DRDMatrixSession.tsx` | domyślna powierzchnia ŻYWEJ sesji (`AssessmentSessionEditorView:1847`) | własna siatka sesji | **bez zmian — poza zakresem** (to ekran pracy, nie raport; zgłaszam jako otwarte) |

Po zmianie jedyna macierz DRD w produkcie to `DRDMatrixGrid`
(`src/components/assessment/drd/DRDAssessmentEditor.tsx`), a w trybie do czytania
wspólne opakowanie `DRDMatrixReadOnly` — **eksport, nie kopia**.

---

## 2. Co usunięte (dowód: zero wołaczy)

Commit `7901e966e3`:

```
src/components/Reports/AreaMatrixTable.tsx          735 linii  (odrzucona macierz, Z-10)
src/components/Reports/AxisReportSection.tsx        676 linii  (jedyny wołacz AreaMatrixTable)
src/components/Reports/AreaDetailCard.tsx           893 linie  (jedyny wołacz AxisReportSection)
dev-render/screens/drd-macierz-obszary-poziomy.tsx  180 linii  (sonda dev-render na martwym komponencie)
+ re-eksporty z src/components/Reports/index.ts, wpis w dev-render/main.tsx
razem -2499 linii
```

Dowód reachability PRZED usunięciem: barrela `src/components/Reports/index.ts` **nie
importuje nikt** — `rg "components/Reports'|Reports/index" src dev-render tests server`
zwraca wyłącznie komentarz w usuwanej sondzie dev-render. Poza barrelem `AreaMatrixTable`
miała w `src/` dokładnie dwóch wołaczy (`AxisReportSection`, `AreaDetailCard` przez
`BUSINESS_AREAS`/`MATURITY_LEVELS`), oba nieosiągalne z aplikacji.

Dowód PO usunięciu:

```
$ rg -n '\b(AreaMatrixTable|AxisReportSection|AreaDetailCard)\b' src dev-render tests server
src/components/Reports/index.ts:26        # komentarz „USUNIĘTE 2026-09-05"
src/components/assessment/presentation/slides.tsx:210,225   # komentarze historyczne
src/components/assessment/drd/DRDAssessmentEditor.tsx:162,170
src/components/assessment/drd/DRDMatrixReadOnly.tsx:7,14

$ rg -n "from '.*(AreaMatrixTable|AxisReportSection|AreaDetailCard)'" src dev-render tests server
(brak wyników — zero importów)
```

Kompilacja po usunięciu: `esbuild src/components/Reports/index.ts` OK,
`esbuild dev-render/main.tsx` OK. Testów tych komponentów w repo nie było
(`rg -l AreaMatrixTable` po katalogach testów: zero plików).

Powód usunięcia, a nie zostawienia: piąte zgłoszenie tej samej sprawy wzięło się
z tego, że kopie odrzuconej siatki wciąż leżały w repo i wracały na ekrany
(Z-12: „kopii jest w tym repo więcej niż oryginałów").

---

## 3. i18n — co faktycznie było po angielsku (sprostowanie zlecenia)

Zlecenie zakładało, że nagłówki ekranu raportu („Axis introduction", „Section to be
completed") są po angielsku w polskim produkcie. **Zmierzone — to nieprawda dla
widocznego interfejsu.** Wartości PL istniały i były polskie; widać to na zrzucie PRZED:
„Wstęp do osi", „Sekcja do uzupełnienia — limit 120–180 słów", „Macierz osi i podpis",
„Komentarz per obszar". Cytowane angielskie napisy to wartości z locale **en**.

Jedyny angielski napis renderowany niezależnie od języka to był **domyślny fallback
w kodzie**: `t('assessment.reportView.matrix.regionLabel', 'Axis matrix table — scrolls
horizontally')` — czytany przez czytniki ekranu. Zniknął razem z tabelą.

Zmiany w `public/locales/{pl,en}/translation.json`:

| Klucz | PL | EN |
|---|---|---|
| `assessment.reportView.matrix.regionLabel` | **usunięty** | **usunięty** |
| `assessment.reportView.matrix.gridLabel` | „Macierz DRD — obszary × poziomy" | „DRD matrix — areas × levels" |
| `matrix.area`, `matrix.current`, `matrix.target`, `matrix.gap`, `matrix.evidence` | **usunięte** (martwe po usunięciu tabeli) | **usunięte** |
| `reportView.notAssessedValue` | **usunięty** (martwy) | **usunięty** |

Weryfikacja, że nie zostało nic angielskiego w kodzie ekranu:
`rg "t\('[^']+', *'" AssessmentReportContractView.tsx` → zero fallbacków.

Napisy w samej siatce (nazwy poziomów, obszarów, technologii, pasek „Area") **zostają
po angielsku świadomie** — decyzja właściciela z `KANON_Z_ODBIOROW.md`: angielski jest
wiodącym językiem metodyki, polski obowiązuje w podpisach interfejsu.

---

## 4. Testy i dowód mutacyjny

Plik: `src/components/assessment/report/__tests__/AssessmentReportContractView.test.tsx`
(dwa nowe testy, commit `d67db4f41a`).

1. `rysuje macierz DRD właściciela w rozdziale osi (a nie odrzuconej tabeli 5 kolumn)`
   — sprawdza w `[data-testid="assessment-report-drd-matrix"]`: poziomy z metodyki
   („7. AI Support", „1. Basic Data Registration" — **7 poziomów z `DRD_STRUCTURE`,
   nie `chapter.maxLevel=5` z mocka**, czyli liczba poziomów jest cechą osi),
   treść komórki z kanonu („Order Management System"), chip „TO 3" w pasku obszarów,
   nazwę obszaru („Sales Processes") i **zero elementów `<table>`**.
2. `nie renderuje odrzuconej tabeli macierzy osi („Axis matrix table")`
   — brak `[aria-label*="Axis matrix table"]`, brak kluczy
   `assessment.reportView.matrix.{area,current,target,gap,evidence}`,
   brak `reportView.notAssessedValue`.

**Dowód mutacyjny** (przywrócenie odrzuconego komponentu na chwilę):

```
$ git show HEAD~1:src/.../AssessmentReportContractView.tsx > src/.../AssessmentReportContractView.tsx
$ npx vitest run src/components/assessment/report/__tests__/AssessmentReportContractView.test.tsx
AssertionError: expected <div …(4)>…(1)</div> to be null
      Tests  2 failed | 5 passed (7)
$ cp /tmp/agdrd/keep.tsx src/.../AssessmentReportContractView.tsx   # cofnięte
      Tests  7 passed (7)
```

Cały katalog testów raportu + test macierzy w panelu jakości: **6 plików / 36 testów zielonych**
(`npx vitest run src/components/assessment/report/__tests__/ src/components/assessment/__tests__/day275-macierz-w-panelu.test.tsx`).

---

## 5. Zrzuty dowodowe

Katalog: `evidence/drd-raport-20260905/drd-raport-20260905/`
Harness: `npx vite --config dev-render/vite.config.ts --port 5341 --strictPort`
(własny proces, zatrzymany po pracy; `pkill` NIE użyty).
Narzędzie: `node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5341 --ekrany=… --katalog=drd-raport-20260905 --faza=PRZED|PO --motywy=light`

| Plik | Co pokazuje |
|---|---|
| `assessment-report-contract__PRZED__pl__1440__light.png` | stan zastany: tabela 5 kolumn (Obszar/Poziom obecny/Poziom docelowy/Luka/Stan dowodów), 9 wierszy liczb |
| `assessment-report-contract__PO__pl__1440__light.png` | macierz właściciela: 7 poziomów × obszary osi 1, treść komórek z kanonu, wypełnienie kumulatywne, pasek „Area" z chipami `AS n` / `TO n` |
| `drd-embedded-matrix-axis-levels__PO__pl__1440__light.png` | raport AUDYTU, rozdział osi (`axis_detail`, culture + cybersecurity): ta sama siatka zamiast tabeli „Area/Current/Target/Gap/Progress" |

Zrzuty robione przeze mnie, przed pokazaniem właścicielowi (CLAUDE.md #7).
Zero błędów konsoli w obu przebiegach.

**Zmierzona zmiana układu przy okazji.** Na pierwszym zrzucie PO macierz siedziała
w kolumnie czytelniczej `max-w-[760px]` i mieściła **4 kolumny z 9** — reszta tylko po
przewinięciu w bok („Jeszcze 5 kolumn po prawej"). Rozdział został rozdzielony:
akapity zostają w 760 px (szerokość szkodzi czytaniu), macierz dostaje własną,
szerszą kolumnę `max-w-[1180px]` — po zmianie widać **6 z 9** kolumn bez przewijania
(commit `eda90642c5`). Reszty nie da się dołożyć bez ruszania współdzielonej siatki
(kolumna etykiet 240 px w `DRDMatrixGrid`) — ogranicza szerokość powłoki, nie ten ekran.
Przewijanie poziome + podpis „Jeszcze N kolumn po prawej" zostają zabezpieczeniem;
tak samo zachowuje się zaakceptowany ekran edytora przy osi 1.

---

## 6. Pytanie otwarte do właściciela

**Czy w raporcie ma być PEŁNA siatka 9×7 z treścią komórek, czy tylko zaznaczone
poziomy (sama drabinka AS/TO bez nazw technologii)?**

Wybrałem **pełną siatkę z treścią komórek — dokładnie to samo, co prezentacja i dokument
raportu.** Uzasadnienie:

1. Zlecenie właściciela brzmi „używaj MOJEJ macierzy", a jego macierz to ekran
   `drd-macierz-oceny` z treścią komórek (ocena B, 01.09) — wariant „tylko zaznaczone
   poziomy" byłby SZÓSTĄ wersją macierzy w repo, czyli powtórzeniem błędu Z-12.
2. Trzy powierzchnie raportowe (slajd, dokument, ekran raportu) muszą pokazywać to samo,
   bo czytelnik dostaje je jako jeden materiał. Rozjazd między nimi to dokładnie ta
   klasa defektu, którą naprawiamy.
3. Treść komórek niesie wartość merytoryczną (wiodąca technologia obszaru na poziomie —
   `MACIERZ_TRESC_KOMOREK.md` §4.3); pusta krata to był zarzut z odbioru
   („63 komórki, 61 pustych").

Do rozstrzygnięcia przez właściciela, gdyby chciał inaczej:
- **(a)** czy przy 9 obszarach osi 1 akceptuje przewijanie w bok (3 kolumny poza kadrem),
  czy woli węższą kolumnę etykiet poziomów w macierzy — to ruch we WSPÓLNEJ siatce,
  więc zmieni też prezentację, dokument i edytor;
- **(b)** czy `DRDMatrixSession` (domyślny ekran ŻYWEJ sesji, `AssessmentSessionEditorView`)
  ma zostać przepięty na tę samą siatkę — dziś ma własną. Nie ruszałem: to ekran pracy
  z zapisem odpowiedzi, nie raport, a przepięcie dotyka ścieżki zapisu oceny.

## 7. Commity

```
1b9a0dad6f  fix(raport-oceny): macierz osi = macierz DRD wlasciciela (DRDMatrixGrid)
d67db4f41a  test(raport-oceny): dowod, ze rozdzial osi rysuje macierz DRD
eda90642c5  fix(raport-oceny): macierz dostaje wlasna, szersza kolumne niz akapity
7901e966e3  chore(macierz): usuniete AreaMatrixTable + jej jedyni wolacze
38839f0984  fix(raport-audytu): sekcja osi w EmbeddedMatrix rysuje macierz DRD wlasciciela
```
