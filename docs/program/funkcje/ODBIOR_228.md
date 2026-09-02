# ★ SCALONE PO FIX-228 i scaleniu autora (`a11e356ab4`) — 1.09.2026

**Styl obrazu wybrany w motywie dokleja się do polecenia dla modelu.** Dowód
na **samym stringu polecenia**, nie na strukturze danych, dla wszystkich trzech
dostawców, z mutacją w obie strony. To jest mechanizm, którym Gamma osiąga
„obraz pasuje kolorem" — odkryty na koncie właściciela i skopiowany.

## Bramki bezpieczeństwa — realne, nie zadeklarowane
Dokumentacja Gammy sama przyznaje, że modele **dodają niechciany tekst mimo zakazu
w poleceniu** — czyli negatywny prompt **nie jest zabezpieczeniem**. Stąd dwie
bramki: odrzucenie obrazu z tekstem i odrzucenie obrazu z twarzą.

Odbiór wykrył, że bramka tekstu **nie była pokryta żadnym testem integracyjnym** —
istniał tylko test wyizolowanej funkcji, więc nikt nie pilnował, czy jest wołana
w realnej ścieżce. **Szósty raz w programie ten sam kształt.** Domknięte:
mutacja warunku ⇒ `expected false to be true`, przywrócenie ⇒ 13/13.
Bramka twarzy sprawdzona — **tej luki nie miała**.

## Pole interfejsu — za flagą, do akceptu właściciela
Pole „Styl obrazu" nie było za flagą i nie miało akceptu na zrzutach, co łamie
regułę 7 (`CLAUDE.md`): **właściciel nigdy nie jest pierwszym testerem wizualnym**.
Domknięte: własna flaga domyślnie WYŁĄCZONA, ekran w `dev-render` z realnym
komponentem, zrzuty jasny i ciemny. **Bezpiecznik duplikatu: jasność 242,2 kontra
35,8 — różnica 206,4.** Para realnie różna.

## ★ Scalenie: autor udowodnił, że NIE złamał cudzej pracy

Nadzorca **wycofał własne scalenie** i oddał je autorowi, bo jeden z czterech
konfliktów nie był dopisaniem pola, tylko **dwoma blokami logiki zapisującymi do tej
samej struktury** (zapis stylu obrazu kontra zapis motywu z dyżuru 226).

Rozstrzygnięcie autora: literał warunku z 226 zachowany **dosłownie**, walidacja
`customTemplate` nadal wyłącznie za jego flagą, a `imageStylePrompt` dopisany jako
**niezależny OR** — **żadna z dwóch flag nie warunkuje drugiej** (zweryfikowane
przez nadzorcę: `presentations.routes.ts:1644`).

**Po scaleniu cztery asercje testu kontraktowego 226 były czerwone.** Zamiast je
naprawić po cichu albo ogłosić, że to nie jego wina, autor **postawił osobny worktree
na tipie 226 i na własnym tipie sprzed scalenia** i zmierzył: **trzy z czterech były
czerwone JUŻ PRZED jego scaleniem**. Naprawił dwie realne dziury, których 226 nie
domknął (zapis `customTemplate` przy tworzeniu planu i brak ponownej walidacji przy
zatwierdzaniu). **Czwartej nie zgadywał** — to funkcja z innej gałęzi z 7.08, zgubiona
przy późniejszej rekonstrukcji; zgłoszona osobno zamiast dopisania na ślepo pod
presją bramki.

**To jest wzorzec, którego chcemy:** przy podejrzeniu „złamałem cudze" — **zmierz oba
stany**, nie zakładaj ani winy, ani niewinności.

## Round-trip potwierdzony
Jedno żądanie `PUT` z oboma polami ⇒ oba w bazie i oba w runtime. Przy fladze 226
wyłączonej styl obrazu **nadal wraca** (dowód niezależności), a pole 226 poprawnie
ukryte (jego bramkowanie nienaruszone). `tsc` serwera czysto.

---

## Pierwotna karta odbioru adwersaryjnego

# ODBIOR — Dyżur 228 (Gamma: styl obrazu)

Audytor: sesja adwersaryjna (nadzorca), 2026-09-01. Nie autor zmiany.
Worktree: `/private/tmp/cx-day228-gamma-stylobrazu`, gałąź `codex/day228-gamma-stylobrazu-20260901`,
commity `4f5094a059` (feat) + `3b51d7193e` (docs). Marker bazowy `9fb7942a01`.

## WERDYKT: **SCALIĆ PO FIX**

Mechanizm rdzeniowy (doklejanie stylu do promptu obrazu + dwie bramki bezpieczeństwa OCR/twarz)
jest realny i sprawdzony mutacyjnie własnymi rękami audytora — to nie fasada. Znaleziono jedną
istotną **dziurę w pokryciu testowym** bramki OCR (nie w samym mechanizmie bezpieczeństwa) oraz
kilka drobnych porządków. Żadna z nich nie unieważnia mechanizmu, ale wszystkie powinny wejść
przed scaleniem do wspólnej bazy z 226/demo.

## Ocena: B

Solidna, uczciwie opisana robota (raport wykonawcy sam przyznaje `EVIDENCE_MISSING` na zrzutach
UI) z jedną realną luką w teście bezpieczeństwa i drobnymi niedoróbkami higienicznymi.

## Odpowiedź wprost: czy styl wybrany przez użytkownika DOCIERA do polecenia dla modelu?

**TAK — potwierdzone na stringu wyrenderowanego promptu, dla wszystkich trzech dostawców
(OpenAI/Gemini/Replicate), niezależnym testem audytora (nie reużywającym pliku wykonawcy).**
Przez wstrzyknięty `generate(provider, prompt)` w `generateImageVisual`
(`deckVisualsService.ts:~599-745`) przechwycono finalny string:
```
captured[0] === 'AUDITOR BASE PROMPT AUDITOR-STYLE-MARKER-XYZ'
```
— dla `openai`, `gemini` i `replicate` jednym testem parametryzowanym. Potwierdzone mutacyjnie:
usunięcie doklejania appendixu (`[params.prompt, styleAppendix].filter(Boolean).join(' ')`)
zaczerwienia 6 testów (obie suity — wykonawcy i audytora) razem; przywrócenie → 21/21 zielono,
`git diff` po przywróceniu pusty.

Przewód od kreatora/motywu do promptu zweryfikowany kod-po-kodzie:
`templateRuntime?.imageStylePrompt` (R1, motyw, zapisywany w `layout_policy_json` tym samym
wzorcem co `colorTemplateId`/`customTemplate` z 226) + `setup.imageStylePreset` (R3, kreator —
pole istniało już wcześniej, `const setup: DeckSetup = req.body` sprawia że dowolne pole z
żądania klienta dociera do `setup` bez dodatkowego mapowania) → `buildImageStyleAppendix(...)`
wywołane w `presentationGeneratorService.ts:~2028` → `styleAppendix` przekazane do OBU wywołań
`materializePlannedVisual` (pierwotnej generacji i regeneracji w bramce VisionQA) → jedyny
punkt dyspozycji `generateImageVisual` → trzy gałęzie dostawcy. Motyw poprzedza preset
(zweryfikowane testem: `indexOf('MY THEME WORDS') === 0`, mniejszy niż indeks fragmentu
presetu).

## Czy zniknęły oba "zaszyte na sztywno" hardkody z zamówienia?

**Sprawdzone bezpośrednio na obecnym stanie brancha — NIE zniknęły, ale są to inne ścieżki, nie
ta sama, którą 228 miał naprawić:**

- `presentations.routes.ts:2170` (`image_style_preset: 'minimal_no_images'`) — to **inny
  endpoint** (`POST /api/presentations/decks`, budowniczy kart/deck-JSON używany przez Table OS
  export), zero importerów łączących go z `deckVisualsService.ts`. Poza zakresem R1-R4 z
  definicji (osobny dokument JSON, osobna ścieżka renderu).
- `presentationGeneratorService.ts:2081` (`imageStylePreset: v.styleHint || 'corporate'`) —
  to parametr wejściowy do `qaGatedImageGeneration`/`presentationVisionQAService.ts`: etykieta w
  prompcie dla modelu WIZYJNEGO oceniającego zgodność stylu wygenerowanego obrazu (QA gate), nie
  wejście do generatora obrazu. **Nie wpływa na to, co trafia do polecenia generującego obraz**
  — ta ścieżka (`materializePlannedVisual` → `generateImageVisual`) poprawnie otrzymuje
  `styleAppendix` (patrz wyżej). Formalnie poza licencją tego dyżuru (
  `presentationGeneratorService.ts` licencjonowany WYŁĄCZNIE w okolicy wywołań
  `materializePlannedVisual`).

Rzeczywisty, jedyny żywy tor dyspozycji promptu jest jeden: `generateImageVisual`. Potwierdzone
niezależnym grepem, że `generateCoverVisual`/`generateBackgroundTextureVisual` (funkcje, które
budowały styl z trzech zaszytych stringów `params.meta.template`) mają **zero wołaczy w całym
repo** — same są martwym kodem, nie realną alternatywną ścieżką. R2 "jedno miejsce doklejania"
jest więc w praktyce jedynym miejscem, nie uproszczeniem.

## Dwie bramki bezpieczeństwa — istnieją I działają, z jednym zastrzeżeniem

**Obie bramki są realne, nie tylko zadeklarowane w raporcie** — potwierdzone dowodem
mutacyjnym RED→GREEN dla każdej niezależnie:

- **OCR**: realny `tesseract.js 7.0.0` (świeży install poza worktree, zero zmian w repo/lockfile)
  na fixture'ach zbudowanych samodzielnie (SVG-tekst wypalony na PNG przez `sharp`):
  `TEXT FIXTURE → {hasText:true, text:"NADZORCA AUDYT"}`, `BLANK FIXTURE → {hasText:false}`.
  Próg `>2` znaki po `trim()`.
- **Twarz**: wstrzykiwalny detektor, decyzja bezwarunkowa — **domyślnie odrzuca nawet dla stylu
  `corporate_photography`** (brak jakiegokolwiek pola zgody `allowPeople`/`consent*` w repo,
  potwierdzone grepem). Mutacja usuwająca warunek odrzucenia → 2 testy czerwone (`attempts`
  1 zamiast 3, fallback nie wywołany); przywrócenie → 21/21 zielono.
- Bounded retry: dokładnie 3 próby, potem `tryStockFallback` (reużyta, nie zduplikowana),
  zweryfikowane mutacyjnie.
- Flaga OFF: prompt bajt w bajt identyczny, **zero wywołań obu bramek** (`gateHits === 0`,
  zmierzone).

**Jedna realna luka znaleziona w tym audycie**: mutacja usuwająca WYŁĄCZNIE warunek OCR
(`!textResult.hasText`, zostawiając tylko sprawdzanie twarzy) **nie zaczerwieniła ani jednego
testu w całej suicie wykonawcy (12/12 PASS) ani w pierwotnej suicie audytora (9/9 PASS)** — żaden
test nie sprawdzał integracyjnego odrzucenia przez `generateImageVisual` po `hasText:true` (był
tylko unit-test samej funkcji OCR w izolacji + happy-path). Innymi słowy: **gdyby ktoś przez
pomyłkę usunął w przyszłości warunek OCR z `generateImageVisual`, żaden istniejący test by tego
nie złapał.** Test uzupełniający, który poprawnie łapie tę mutację, jest gotowy i zweryfikowany
w artefaktach audytu (`/private/tmp/audit228-artefakty/` — test `AUDITOR: OCR/text gate rejects
by itself even when face gate says clean`), gotowy do wklejenia 1:1 do
`day228.imageStyleSafety.test.ts`.

## Wszystkie sześć presetów

Działają wszystkie: 4 niosą fragment promptu (`corporate_photography`, `abstract_geometric`,
`flat_illustration`, `industry_realistic` — każdy zweryfikowany osobno, `it.each` po mapie
`IMAGE_STYLE_PRESET_PROMPTS`), 2 (`minimal_no_images`, `data_focused`) świadomie nie niosą
fragmentu obrazu — zweryfikowane jako zamierzone (`buildImageStyleAppendix(undefined, preset)
=== undefined`), nie zaniedbanie.

## Kolizja z dyżurem 226

Real-PG test (kontener własny, poza zarezerwowanymi zakresami portów): PUT z `imageStylePrompt`
**nie kasuje** istniejącego `colorTemplateId` w `layout_policy_json` — spread `...currentLayoutPolicy`
poprawnie zachowuje sąsiednie pole (na gałęzi 228 `customTemplate` z 226 jest nieobecny, zgodne z
raportem — gałęzie nie są scalone). 228 znalazło i naprawiło we własnym zakresie realny defekt:
`getTemplateForOrgOrSystem` może zwrócić `layout_policy_json` w formie, którą 226-owy
`JSON.parse(existing.layout_policy_json)` (bez sprawdzenia typu) obsługuje gorzej niż 228-owa
wersja z `typeof` guard — przy scalaniu gałęzi warto ujednolicić na wersję 228 (bezpieczniejsza).
Patrz też ODBIOR_226.md, sekcja "Nowe znalezisko audytu" — audytor niezależnie potwierdził inny,
głębszy defekt w tej samej funkcji (`provenance_status` filter), nieobjęty żadną z dwóch gałęzi.

## FIX-y wymagane przed scaleniem

1. **Dziura testowa bramki OCR** (opisana wyżej) — dodać test integracyjny łapiący usunięcie
   warunku `hasText` w `generateImageVisual`, nie tylko unit-test izolowanej funkcji OCR. Gotowy
   test do wklejenia w artefaktach audytu.
2. **Typ frontendowy** `UpdatePresentationTemplateInput`
   (`src/services/presentationTemplateArchitect.ts:185-195`) nie ma pola `imageStylePrompt` —
   wykonawca obszedł to rzutowaniem typu w `PresentationTemplateArchitectView.tsx:522-528`.
   Dodać jedną linię do interfejsu (wzorem `colorTemplateId?: string | null`), usunąć rzutowanie.
3. **Pole „Styl obrazu” w UI edytora motywu nie jest za żadną flagą** i nie ma zrzutu-akceptu
   Piotra (raport wykonawcy sam przyznaje `EVIDENCE_MISSING`). Zgodnie z regułą 7 CLAUDE.md
   („wygląd tylko za flagą do akceptu, Piotr nigdy pierwszym testerem wizualnym") — albo zgasić
   pole flagą do czasu akceptu, albo dostarczyć zrzut z dev-render harnessu i uzyskać akcept
   przed jakimkolwiek push na demo/staging.
4. **Koordynacja z 226 przy docelowym scaleniu** — warunek w `presentations.routes.ts` trzeba
   rozszerzyć do trójczłonowego (`colorTemplateId !== undefined || imageStylePrompt !== undefined
   || customTemplate !== undefined`) i przenieść `typeof`-guard z JSON.parse (patrz kolizja
   wyżej). To nie blokuje scalenia SAMEGO 228 do głównej linii — dotyczy przyszłego mergu 226+228.

Nieblokujące, do wiadomości:
- `tesseract.js` jest w `server/package.json`/lockfile, ale nieobecny we współdzielonym
  `node_modules` (bo `server` nie jest npm-workspace w root `package.json`). Kod failuje
  bezpiecznie (cały blok bramek w `try/catch`, wyjątek → stock fallback) — to NIE jest luka
  bezpieczeństwa, ale każdy kolejny developer testujący lokalnie potrzebuje `cd server && npm
  install`.
- OCR na czystym szumie losowym dał fałszywy pozytyw (`hasText:true` na bełkocie odczytanym z
  szumu) — bramka jest nadwrażliwa, ale w bezpiecznym kierunku (nadmiarowe odrzucanie obrazów,
  nie przepuszczanie tekstu).

## Zasięg dowodu

Testy jednostkowe i mutacyjne uruchomione osobiście (`RUN_DB_TESTS=0 MOCK_DB=true` dla
czysto-funkcyjnych, `--retry=0` wszędzie). Real-PG test uruchomiony przeciw realnemu Postgresowi
(kontener własny, poza zarezerwowanymi zakresami portów, posprzątany `docker rm -f -v`). Zero
wywołań realnego modelu obrazowego/wizyjnego (potwierdzone grepem po `fetch(`/nazwach domen
dostawców we wszystkich plikach testowych — zero trafień). Niezależny sub-agent audytorski
powtórzył pomiar z tym samym wynikiem (SCALIĆ PO FIX, ocena B, ta sama lista FIX-ów) — dwie
niezależne ścieżki dowodowe zbieżne.
