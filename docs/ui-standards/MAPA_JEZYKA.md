# MAPA JĘZYKA — gdzie w Consultify rozstrzyga się język i kto tego pilnuje

Fala **E2f** (DEC-510, Wpis 48 pkt E2f), pomiar na linii `origin/integracja/20260911`
(SHA `59a8c44c04`), 2026-09-14.

Powód powstania tego dokumentu: „bałagan językowy w każdej warstwie" wracał, bo
bramka `check:jezyk:ci` widziała **tylko UI** (pliki `public/locales/**`, `src/**`
i wąski wycinek `server/src/routes|middleware|validators|schemas|controllers`).
Trzy warstwy, w których użytkownik EN realnie widzi polski, nie były mierzone
wcale: serwer poza routes, prompty AI i method pack DRD. Nie mierzone = odrasta.

Ta mapa jest SSOT odpowiedzi na pytanie „która warstwa, jakim mechanizmem, który
licznik, czyj to dług". Liczby mieszkają w baseline (patrz niżej), nie tutaj —
dokument opisuje MECHANIZM, nie stan.

---

## 1. Warstwa → mechanizm → licznik → właściciel

| # | Warstwa | Gdzie żyje | Mechanizm poprawny (docelowy) | Licznik w bramce | Właściciel |
|---|---------|-----------|-------------------------------|------------------|-----------|
| 1 | Klucze tłumaczeń | `public/locales/{en,pl}/*.json` | i18next, klucz obecny w OBU językach | `K1` `K2` `K3a` `K3aKLUCZ` `K3b` | Front |
| 2 | Wartości domyślne w kodzie | `src/**` — `t('klucz', 'Tekst')` | `defaultValue` po angielsku + klucz w `en` | `K1def` `K1defWID` | Front |
| 3 | Tekst na sztywno w JSX | `src/**/*.tsx` poza `t()` | każdy napis widoczny na ekranie przez `t()` | `K4pl` `K4en` | Front |
| 4 | Odpowiedzi HTTP z warstwy wejścia | `server/src/{routes,middleware,validators,schemas,controllers}` | zwracać `key` + `params`, tłumaczyć na kliencie | `K5pl` `K5en` | Backend |
| 5 | **Serwer poza warstwą wejścia** | `server/src/**` reszta: `services/`, `method-core/`, `jobs/`, maile, PDF | słownik dwujęzyczny per locale joba — wzór: `services/report/reportLocale.ts` (`MESSAGES`) i `method-core/outputs/EventDerivedOutputBridge.ts` (`TEKSTY_OUTPUTU`) | **`K8spl` `K8sen`** | Backend |
| 6 | **Prompty AI (Teresa i narzędzia)** | `server/src/**`, `src/services/**`, `src/lib/**` | prompt po angielsku + `withResolvedLocaleInstruction(prompt, locale)` z `services/ai/languagePolicy.ts` (SSOT DEC-510) | **`K9pPL` `K9pMIX` `K9pBRAK`** | AI / Backend |
| 7 | **Method pack DRD** | `src/method-core/methods/drd/compileDrdPack.ts` + `src/services/drdStructure.ts`, `src/services/assessmentKnowledge/**` | wariant EN per rekord: `titleEN`/`descriptionEN` dla poziomu, `name`/`namePL` dla obszaru; `compileDrdPack('en')` emituje wariant EN | **`K10dPL` `K10dROZ`** | Metodyka + Backend |
| 8 | Daty, liczby, waluty | `src/**`, `server/src/**` | `Intl` z locale z kontekstu, nigdy bez argumentu i nigdy `'pl-PL'` na sztywno | `K7` | Front + Backend |

Warstwy 5–7 (pogrubione) dołożyła fala E2f. Warstwy 1–4 i 8 istniały od J0.

### Czego liczniki świadomie NIE liczą

* **Słowniki dwujęzyczne.** Obiekt, w którym obok siebie stoją klucze `en:` i
  `pl:`, jest mechanizmem naprawy, nie długiem — `K8s` zamazuje takie obiekty
  przed skanem (`bezSlownikowDwujezycznych`). Bez tego bezpiecznik nagradzałby
  usunięcie tłumaczenia.
* **Pliki polityki języka.** `services/ai/languagePolicy.ts`,
  `services/ai/responseLanguage.ts`, `services/report/reportLocale.ts` —
  z definicji zawierają napisy w obu językach.
* **Prompt po angielsku.** To jest stan docelowy warstwy 6, nie dług: język
  odpowiedzi wymusza dopięta instrukcja, nie język promptu.
* **Testy, mocki, `_backup/`, `scripts/`.**
* **K5 i K8s są rozłączne** — K8s bierze dokładnie tę część `server/src`,
  której K5 nie rusza. Nic nie jest liczone dwa razy.

---

## 2. Gdzie jest baseline i jak działa ratchet

* **Plik baseline:** `docs/program/JEZYK_EN_PL_20260908/baseline.json`
  (ten sam od J0; E2f dołożył nowe kubełki, nie nowy plik).
  Zawiera `suma` (per kategoria), `moduly` (16 pozycji menu × kategoria),
  `przyklady` (do 25 na kategorię) i `_meta.sha`.
* **Przegenerowanie (świadome, tylko przy spadku):** `npm run check:jezyk:baseline`.
* **Bramka pełna (CI):** `npm run check:jezyk:ci` — pełny skan repo,
  porównanie z baseline **per SUMA i per MODUŁ**. Kod wyjścia `1`, gdy
  KTÓRYKOLWIEK licznik w KTÓRYMKOLWIEK module urósł.
  Per-moduł jest tam dlatego, że bramka global-only chowa regresję jednego
  modułu za niezwiązaną poprawą gdzie indziej.
* **Bramka szybka (pre-commit):** `npm run check:jezyk:staged` — liczy DELTĘ
  starej (`git show HEAD:<plik>`) i nowej treści wyłącznie plików w indeksie,
  dokłada ją do baseline. Dla `K8s` i `K9p` delta jest DOKŁADNA (każde trafienie
  siedzi w jednym pliku), tak samo jak dla K5/K7.
  Spada na pełny skan, gdy commit dotyka `public/locales/**.json` (K1–K3 zależą
  od całego pliku) **albo źródeł DRD** (`src/method-core/methods/drd/**`,
  `src/services/drdStructure.ts`, `src/services/assessmentKnowledge/**` — jedna
  zmiana przestawia setki tekstów paczki, delta pliku tego nie odda).
* **Ratchet ma tylko jeden kierunek:** liczba nie może wzrosnąć. Spadek jest
  raportowany („Spadki: …") i wymaga świadomego przegenerowania baseline.

## 3. Lista `plik:linia` do spłaty długu

```
npm run check:jezyk:raport            # -> evidence/jezyk/POMIAR_PLIK_LINIA.txt
node scripts/i18n/pomiar-jezyka.mjs --report <plik>
```

`--report` wypisuje PEŁNĄ listę trafień per kategoria (`plik:linia`, moduł,
treść, dowód) — bez przycięcia do 25 przykładów, którym karmiony jest baseline.
To robocza lista dla człowieka spłacającego dług, nie dowód bramki.

## 4. Jak mierzony jest DRD (i dlaczego to nie jest zero „bo nie patrzę")

`compileDrdPack` to TypeScript z aliasem `@/`, więc pomiar bundluje go esbuildem
do pliku tymczasowego i importuje, a potem puszcza `wykryjPolski` po nazwach,
tytułach, definicjach, dowodach i pytaniach paczki zbudowanej dla `en`.

Dowód, że przyrząd mierzy, a nie zwraca zera z bezradności: **ta sama funkcja
licząca na `compileDrdPack('pl')` daje 1338 trafień**, a na `'en'` — zero.
Gdy bundlowanie się nie uda, pomiar **przerywa się kodem 2** zamiast wpisać zero
(brak pomiaru nie jest wynikiem).

`K10dROZ` liczy `report.discrepancies` — ujawnione rozjazdy metodyki (m.in. to,
że tytuły poziomów osi 5 i 6 to robocze tłumaczenie czekające na podpis
właściciela metodyki). To są rozjazdy ZADEKLAROWANE, nie defekty przyrządu;
ratchet pilnuje, żeby nie przybyło nowych po cichu.

## 5. Powiązane dokumenty

* `docs/program/JEZYK_EN_PL_20260908/POMIAR.md` — opis kategorii K1–K7 (J0)
* `docs/program/JEZYK_EN_PL_20260908/J0_BRAMKA.md` — bramka, tryb szybki, nieprecyzje
* `server/src/services/ai/languagePolicy.ts` — SSOT języka odpowiedzi (DEC-510)
* `server/src/services/report/reportLocale.ts` — wzór słownika dwujęzycznego
* `src/method-core/methods/drd/compileDrdPack.ts` — wariant EN method packa
