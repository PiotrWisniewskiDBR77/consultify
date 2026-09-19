# QB0f (Wpis 234, DEC-691) — KROK 0: zawężenie `isPinnedBaseTemplate`

**WERDYKT: premisa fałszywa → STOP.** Zawężenie predykatu wg zadanego dyskryminatora
(„kanoniczne źródło, NIE family") jest jednoznaczne i zmierzone, ale oczekiwana liczba z
Wpisu 234 („na 21 wierszach `pin-fixture-21-docbase.json` dokładnie **3 pinowane, 18 nie**")
jest **arytmetycznie niemożliwa** na tej fixture: fixture ma **20 TPL-1b KEEP + 1 kanoniczną
bazę DOC-BASE** (dokładnie pomiar QB0e przyjęty przez CTO w Wpisie 233), więc kanoniczne
zawężenie pinuje **1/21**, nie 3/21. „3" odpowiada całej bibliotece (DOC+DECK+SHEET), której
ta fixture (sam DOC-BASE) nie zawiera; „18" nie zgadza się z żadnym pomiarem (KEEP = 20).

---

## 1. Predykat dziś (plik:linia)

`src/components/ReportsAndPresentations/useRapData.ts:1255`
```ts
export function isPinnedBaseTemplate(item: TemplateItem): boolean {
  return (
    item.scope === 'system' &&
    typeof item.templateFamily === 'string' &&
    (BASE_TEMPLATE_FAMILIES as readonly string[]).includes(item.templateFamily)
  );
}
```
`BASE_TEMPLATE_FAMILIES = ['DOC-BASE','DECK-BASE','SHEET-BASE']` (`:1248`).
Mapper `:1354` wyprowadza `scope` z `template.scope` (KEEP = `'system'`) LUB `template.system===true`
(baza); `:1355` wyprowadza `templateFamily` z `template.family`. **Wszystkie 21 wierszy qualifies**
→ PIN renderuje 21 kart DOC-BASE na górze (plus DECK/SHEET) — defekt zgłoszony w QB0e (b).

## 2. Pomiar na REALNYCH 21 wierszach (realne funkcje produktu)

Uruchomione: `mapCanonicalTemplateArtifact` + `isPinnedBaseTemplate` (import z `useRapData.ts`)
na `evidence/qb0f-pin-narrow-20260919/pin-fixture-21-docbase.json` (org 3935603f, kopia dumpu).

| miara | wartość |
|---|---|
| `totalMapped` | **21** |
| `currentPinned_familyOnly` (dzisiejszy predykat) | **21** |
| `narrowedPinned_canonicalSource` (`source !== 'legacy'`) | **1** |
| `legacyKeep` (`source === 'legacy'`) | **20** |
| `canonicalNonLegacy` | **1** |
| tytuł jedynej kanonicznej | `[System] Client final report (EN)` |

Rozkład w fixture (record index → `originSummary.template`):
- **0–19 (20 szt.)** = TPL-1b KEEP: `scope:'system'`, `family:'DOC-BASE'`, `legacy:true`,
  `source:'legacy'`, `originRuntime:'report_template'`, `canonicalTemplateId:'tpl-*'`.
- **20 (1 szt.)** = kanoniczna baza DOC-BASE z `20262271`: `{system:true, family:'DOC-BASE',
  status:'approved'}` — BEZ `legacy`/`source`/`originRuntime`/`canonicalTemplateId`; tytuł
  `'[System] Client final report (EN)'` == tytuł z migracji (`20262271:315`).

## 3. Kanoniczny dyskryminator (z migracji 20262271)

Trzy kanoniczne źródła baz (`20262271:312-322`, `:480-484`):
```
('document_template',    'doc-template-system-en-client_final_report')  -> DOC-BASE
('presentation_template','dbr77-deck-board')                            -> DECK-BASE
('sheet_template',       '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1')        -> SHEET-BASE
```
20 KEEP ma `origin_runtime='report_template'` (`20262272:473-493` ustawił im
`template_family_ref='DOC-BASE'` — rodzina KEEP jest poprawna by design, TPL-1b/owner-accepted).

W `TemplateItem` (front) kanoniczna baza mapuje się na `source='canonical'`/`legacy=false`
(record 20 nie niesie `legacy`/`source` → `legacy=false`), a KEEP na `source='legacy'`/`legacy=true`.
**Dostępny, wierny dyskryminator: `source !== 'legacy'`** (równoważnie `legacy !== true`).
`originRuntime`/`sourceId`/`contractVersion` NIE są wystawione przez API w `originSummary`
(record 20 ich nie ma), więc nie są osiągalne w `TemplateItem` — `source`/`legacy` jest.

## 4. Sprzeczność w Wpisie 234 (wymaga decyzji CTO)

Wpis 234 akceptuje QB0e (Wpis 233: „21 = 20 KEEP + 1 bazowa"), po czym dla TEJ SAMEJ 21-wierszowej
fixture DOC-BASE żąda „3 pinowane, 18 nie". Oba nie mogą być prawdziwe:

| odczyt | pinowane | niepinowane | razem |
|---|---|---|---|
| Wpis 234 literalnie | 3 | 18 | 21 |
| **zmierzone: ta fixture (DOC-BASE only), kanoniczne zawężenie** | **1** | **20** | **21** |
| zmierzone: CAŁA biblioteka orgu (21 DOC + 1 DECK + 1 SHEET = 23) | 3 | 20 | 23 |

„3" istnieje TYLKO w całej bibliotece (DOC+DECK+SHEET) — ale wtedy „niepinowane" = 20 (KEEP),
nie 18. „18" nie odpowiada żadnemu pomiarowi. Dyskryminator i mutacja z Wpisu 234 są spójne
i jednoznaczne; niespójna jest wyłącznie oczekiwana liczba na nazwanej fixture.

## 5. Co zbuduję po jednym słowie potwierdzenia (bez zgadywania)

Zawężenie (zgodne z dyskryminatorem + mutacją z Wpisu 234):
```ts
export function isPinnedBaseTemplate(item: TemplateItem): boolean {
  return (
    item.scope === 'system' &&
    typeof item.templateFamily === 'string' &&
    (BASE_TEMPLATE_FAMILIES as readonly string[]).includes(item.templateFamily) &&
    item.source !== 'legacy'            // kanoniczne źródło, NIE rodzina (20 KEEP też ma DOC-BASE)
  );
}
```
- Test na `pin-fixture-21-docbase.json`: **1 pinowana** (record 20), **20 nie**.
- Mutacja (przywróć `family`-only, tj. usuń `source !== 'legacy'`) → **21** → RED. ✔ warunek Wpisu 234.
- Opcjonalnie test na pełnym zestawie 3 kanonicznych (DOC+DECK+SHEET) → **3/3** pinowane,
  aby dowieść intencji właściciela „TRZY bazowe na górze" (DEC-655).

**PYTANIE DO CTO (jedno):** potwierdź, że test na `pin-fixture-21-docbase.json` ma asertować
**1/20** (a „3" to pełna biblioteka DOC+DECK+SHEET, dowodzona osobnym zestawem) — czy też mam
zbudować/autoryzować fixture 3-rodzinową, na której „3 pinowane" jest literalnie prawdziwe?
„18 nie" nie zgadza się z żadnym odczytem (KEEP = 20 wg QB0e/Wpis 233).

## Reprodukcja
```bash
# fixture: evidence/qb0f-pin-narrow-20260919/pin-fixture-21-docbase.json (git add -f, *.json ignorowane)
# pomiar: import { mapCanonicalTemplateArtifact, isPinnedBaseTemplate } z useRapData.ts
#         -> currentPinned_familyOnly=21, narrowed(source!=='legacy')=1, legacyKeep=20
```
