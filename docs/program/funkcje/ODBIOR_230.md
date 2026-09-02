# ODBIÓR 230 — GAMMA / OSTRZEŻENIE O PRZEPEŁNIENIU — **OCENA C** (NIE SCALAĆ BEZ FIX-230)

Gałąź: `codex/day230-gamma-przepelnienie-20260901` · commity `3f08d78a1a`, `22446291e4`, `d907ae6d1a`
Baza: `0a35699021` (po scaleniu 231). Audyt adwersaryjny: 1.09.2026.

---

## ODPOWIEDŹ NA PYTANIE, DLA KTÓREGO POWSTAŁ TEN DYŻUR

> **Czy ostrzeżenie o przepełnieniu jest wiarygodne — ile fałszywych alarmów na ilu slajdach?**

**NIE JEST. Zmierzone przeze mnie: 5 fałszywych alarmów na 5 slajdach. 100%.**

Nie przez czytanie raportu — przez **realną trasę HTTP** (`GET /api/presentations/decks/:id/download?preflight=overflow`),
realny `ApiGateway`, podpisany JWT OWNER, realny PostgreSQL 17 z pełnym zestawem migracji,
flaga `ENABLE_DECK_OVERFLOW_WARNING=true`.

Deck wejściowy: **5 slajdów, każdy tytuł + trzy zwięzłe punkty, 41–61 znaków widocznego tekstu na slajd.**
Deck bez zarzutu. Nic się nie przelewa.

```
>>> widoczny tekst na slajdach: [56, 61, 61, 41, 55] znaków
>>> detektor ostrzegł na 5/5 slajdów:
    slajd 1: zmierzone 263 / budżet 240
    slajd 2: zmierzone 268 / budżet 240
    slajd 3: zmierzone 268 / budżet 240
    slajd 4: zmierzone 248 / budżet 240
    slajd 5: zmierzone 262 / budżet 240
```

**56 znaków widocznych → „263 znaki” w pomiarze.** Użytkownik dostaje pasek
„5 slajdów ma treść, która się nie mieści” na decku, w którym mieści się wszystko.
To dokładnie to, przed czym ostrzegała instrukcja: ostrzeżenie, które wyje bez powodu,
zostanie wyłączone — i nie zadziała wtedy, gdy będzie potrzebne.

---

## PRZYCZYNA — detektor mierzy JSON, nie tekst

`server/src/services/report/pptx/deckOverflowDetector.ts:24-30`

```ts
function textLength(value: unknown): number {
  if (typeof value === 'string') return value.trim().length;
  if (typeof value === 'number') return String(value).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + textLength(item), 0);
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as UnknownRecord).reduce((sum, item) => sum + textLength(item), 0);
}
```

`Object.values(...)` rekurencyjnie sumuje **KAŻDY** łańcuch w obiekcie bloku. A produkt
zapisuje bloki wraz z metadanymi — `src/components/Presentations/DeckBuilder/deckData.ts:106-113`
(`pushBlock`), utrwalane przez `PUT /decks/:deckId/autosave`
(`server/src/routes/presentations.routes.ts:4045`):

```
block_id: "block-<uuid-decku>-4-1"   ~48 znaków
card_id:  "card-<uuid-decku>-4"      ~45 znaków
type / position.area / …             kolejne kilkanaście
```

**Dwa bloki = ~200 znaków szumu strukturalnego, zanim padnie pierwsze słowo treści.**
Budżet wynosi 240. Dlatego każdy edytowany slajd z 2–3 blokami przekracza próg z automatu.

Dowód minimalny (własny przebieg, realny kształt `pushBlock`):
> slajd „Agenda”, 3 bloki, **8 znaków widocznych** → detektor: `zmierzone: 316, budżet: 240`.

### Dlaczego raport tego nie zobaczył
Raport podaje **„2 fałszywe alarmy na 5 slajdach”** (sekcja „Pomiar pięciu realnych renderów”).
Pomiar wykonano na ręcznie zbudowanym fixture z `key_message` jako **gołym łańcuchem** —
jedynym kształcie, w którym błąd się nie ujawnia, bo `keyMessage.length || textLength(blocks)`
zwiera obwód przed dotknięciem bloków. To nie jest kłamstwo wykonawcy; to **próbka zamiast zbioru**.
Na kształcie, który produkt naprawdę zapisuje, jest 5/5.

---

## DRUGI DEFEKT TEGO SAMEGO WYRAŻENIA — fałszywy NEGATYW

`deckOverflowDetector.ts:88` — `const measuredContent = keyMessage.length || textLength(blocks);`

Jeżeli `key_message` jest niepuste (choćby 12 znaków), **bloki nigdy nie są mierzone**.

> Zmierzone: `key_message: 'Krotka teza.'` + **5 bloków × 400 znaków = 2000 znaków realnej treści** → **CISZA**.

Detektor wyje na pustych slajdach i milczy na przepełnionych. To nie jest kwestia kalibracji progu.

---

## POZOSTAŁE ZNALEZISKA

### 1. Detektor jest słabszym duplikatem istniejącego audytu
`server/src/services/presentationStudioLayoutAuditService.ts:294-320` **od dawna** liczy dokładnie
te same trzy rzeczy (`layout_overflow_title` / `layout_overflow_key_message` / `layout_overflow_blocks`),
tym samym `resolveSlotCapacity`, z numeracją slajdów 1-based. Nowy plik to szósta kopia wzorca,
**uboższa** o trzy rzeczy, które tamten ma:

| | audyt istniejący | `deckOverflowDetector` |
|---|---|---|
| gęstość per slot (`densityForSlot`) | tak | nie — jedna dla całego slajdu |
| zasięg organizacji (`organizationId` w rejestrze) | tak | **nie przekazany** |
| pomija slajdy wyłączone (`enabled === false`) | tak | **nie** |

Ostatni wiersz zmierzyłem: slajd `enabled:false`, który **nigdy nie trafia do pliku**, dostaje
ostrzeżenie z numerem. Istniejący audyt na tym samym wejściu zwraca `flags: []`.

### 2. Budżety to progi AUTORSKIE, nie progi renderowania
`presentationStudioLayoutCapacityRegistryService.ts:83-87` — `keyMessageMaxChars: 240` to cel
projektowy gęstości treści z audytu layoutu, nie granica, przy której pptxgenjs/LibreOffice
zaczyna się rozjeżdżać. Raport sam to zmierzył: realne załamanie **powyżej 369 znaków**, czyli
próg jest o **≥129 znaków** zbyt konserwatywny. Użycie budżetu autorskiego jako detektora
przepełnienia to pomyłka kategorii — i to ona, obok `textLength`, generuje alarmy.

### 3. UI wyrzuca `pewnosc`, którą detektor policzył
Detektor zwraca `pewnosc: 'wysoka' | 'niska'` (`deckOverflowDetector.ts:46`).
`DeckOverflowWarning.tsx` **nie używa jej ani razu**. Slajd 241-znakowy („niska”, w raporcie
fałszywy alarm) daje identyczny pasek co slajd realnie rozwalony. Pole policzone i wyrzucone.

### 4. ★ Jedna flaga steruje dwiema niezależnymi rzeczami — i włączenie ostrzeżenia POGARSZA plik
`ENABLE_DECK_OVERFLOW_WARNING` włącza preflight **oraz** wyłącza `fit:'shrink'` w pięciu miejscach
renderera (`PptxPipelineService.ts:491`, `atomics/{Badge,Highlight,KpiValue,SlideTitle}.ts`).

Raport pisze wprost: bez shrink „slajd 5 nachodzi na tytuł i wychodzi z pola”.
Czyli **włączenie ostrzeżenia realnie psuje wygląd wyeksportowanego PPTX**. Właściciel włączy
flagę, żeby dostać ostrzeżenie, a dostanie ostrzeżenie **plus gorszy plik**. To są dwie decyzje
i muszą być dwie flagi.

Zakazu „ratowania przepełnienia zmniejszaniem” wykonawca **nie złamał** — zrobił odwrotność.
Z 16 realnych emisji `fit:'shrink'` (nie 17 — korekta wykonawcy jest poprawna, sprawdziłem)
objął pięć; 10 w `DeckStyler.ts` i 1 w `UnifiedExportService.ts:693` zostawił nietknięte
i jawnie to wypisał. To akurat zrobione uczciwie.

### 5. Ostrzeżenie o PowerPoincie pokazuje się przy eksporcie do PDF
`DeckBuilder.tsx:1057-1067` woła preflight dla `format:'pdf'`; `presentationExport.ts:36` przepuszcza
`'pdf'`; trasa `router.get('/decks/:deckId/export/pdf')` (`presentations.routes.ts:2884`) zwraca
te same ostrzeżenia. Tekst paska brzmi: *„Układ może się rozjechać po eksporcie do PowerPointa i Google Slides.”*

PDF nie powstaje z PPTX — to `pdfkit` (`presentations.routes.ts:12`, trasa `:2884`, `new PDFDocument` `:3012`).
Ostrzeżenie liczone budżetami znakowymi PPTX nie mówi **nic** o pliku produkowanym przez inny
renderer, a komunikat wymienia dwa produkty, których ta ścieżka nie dotyczy. To jest właśnie
obiecywanie nieprawdy o PDF.

---

## CO JEST ZROBIONE DOBRZE (żeby nie było niesprawiedliwie)

- **Dowód idzie realną trasą HTTP.** `22446291e4` nie kłamie nazwą: `day230.overflow-preflight.pg.test.ts`
  montuje prawdziwy `ApiGateway`, podpisuje JWT, czyta deck z PostgreSQL. Uruchomiłem u siebie na
  własnej bazie: **2/2 PASS**. Żadnego wstrzykniętego kontekstu.
- **Mutacje dwustronne działają.** Detektor zawsze pusty → czerwień (`expected [] to have length 1`).
  Detektor zawsze ostrzegający → czerwień na obu przypadkach. Sprawdziłem sam, obie.
- **UI to realny produkt**, nie rusztowanie: `DeckOverflowWarning` jest importowany i renderowany
  w `DeckBuilder.tsx:1999` — prawdziwym ekranie prezentacji.
- **Preflight jest po autoryzacji**: `ensurePresentationCapability` → JWT → legal hold → odczyt decku
  → `ensureConfidentialityPolicy` → dopiero potem gałąź `preflight`. Nie omija bramek.
- **Ostrzeżenie nie blokuje** (przycisk „Eksportuj mimo ostrzeżenia”), zgodnie ze wzorcem Gammy.
- **Raport jest uczciwy w tonie**: sam przyznaje 2 fałszywe alarmy, sam prostuje 17→16 emisji,
  sam wypisuje 5 twierdzeń niezweryfikowanych, sam mówi że zrzuty są harnessowe. Błąd polega na
  **zbyt wąskiej próbce**, nie na zacieraniu.

---

## FIX-230 (kolejność wykonania)

| # | plik:linia | co zrobić |
|---|---|---|
| **F1** | `deckOverflowDetector.ts:24-30` | `textLength` ma liczyć **wyłącznie widoczny tekst** — białą listę pól (`content.text`, `content.items[]`, `content.title`), nigdy `Object.values`. Bramka: slajd „Agenda” z 8 znaków widocznych ⇒ **cisza**. |
| **F2** | `deckOverflowDetector.ts:88` | usunąć zwarcie `keyMessage.length \|\| textLength(blocks)` — mierzyć **sumę**. Bramka: `key_message` 12 znaków + 5 bloków × 400 ⇒ **ostrzeżenie**. |
| **F3** | `deckOverflowDetector.ts:71` | pominąć slajdy `enabled === false`, wzorem `presentationStudioLayoutAuditService.ts:270`. |
| **F4** | cały plik | **rozważyć skasowanie detektora** i wołanie `auditPresentationStudioOutlineLayout` z mapowaniem flag → `DeckOverflowWarning`. Trzy z czterech powyższych FIX-ów to odtworzenie tego, co tamten plik już umie. |
| **F5** | próg | odciąć próg od budżetu autorskiego. Raport zmierzył realne załamanie >369 przy budżecie 240 — dopóki próg = budżet, alarmy będą fałszywe nawet po F1. |
| **F6** | `FeatureFlags.ts:52` + 5 miejsc `fit:'shrink'` | **rozdzielić na dwie flagi**: `ENABLE_DECK_OVERFLOW_WARNING` (tylko preflight+UI) i osobną na wyłączenie shrink. Dziś włączenie ostrzeżenia psuje eksportowany plik. |
| **F7** | `DeckOverflowWarning.tsx` | albo pokazywać `pewnosc` („może się nie zmieścić” vs „nie mieści się”), albo w ogóle nie renderować alarmów `niska`. Dziś pole jest liczone i wyrzucane. |
| **F8** | `DeckBuilder.tsx:1057` / `presentationExport.ts:36` | dla `format:'pdf'` albo nie wołać preflightu, albo dać osobny tekst. PDF to `pdfkit`, nie PowerPoint. |
| **F9** | test | dołożyć bramkę **fałszywego alarmu przez trasę HTTP**: poprawny 5-slajdowy deck w kształcie `pushBlock` z flagą ON ⇒ `overflowWarnings: []`. Test dostarczony (`ON ⇒ slajd 3` / `OFF ⇒ cisza`) sprawdza tylko flagę, nie fałszywy alarm. |

---

## ROZŁĄCZNOŚĆ — czysto
Diff `0a35699021..HEAD` na `presentations.routes.ts` usuwa **jedną** linię: przeniesienie importu
`requireApprovedExportEngine` (kolejność, dodany niżej). Zero nadpisań pracy 226/228/231.

## OCENA: **C**
Mechanika istnieje, jest za flagą OFF, idzie realną trasą i ma dwustronne mutacje.
Ale **produkt, który miał ostrzegać uczciwie, ostrzega na 100% poprawnych slajdów i milczy na
przepełnionych**. To gorsze niż brak ostrzeżenia — a instrukcja mówiła to wprost.
Do B po F1+F2+F3+F9. Do A po F5+F6.

## WERDYKT: **NIE SCALAĆ** przed FIX-230.
