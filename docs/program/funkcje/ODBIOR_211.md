# ★ SCALONE PO FIX-211 (`4dc5fe94fc`) — 31.08.2026

## Wartość dyżuru leży w BEZPIECZNIKU, nie w naprawach

Audytor napisał świeże naruszenie własną ręką i **prawdziwy hook
`.husky/pre-commit` zablokował prawdziwy `git commit`**. Bezpiecznik nie jest
dekoracją. Sprawdzone też, że nie jest za ciasny — brak fałszywych alarmów na
poprawnych wzorcach.

## ★ Skala pułapki: JEDNO naruszenie w całym repozytorium

Trzy liczby krążyły w tej sprawie; tylko jedna ma niezależnie potwierdzony pomiar:
- **1** — blokujące, repo-wide (`day205.decisionWisdom.pg.test.ts:34`). Potwierdzone
  DWIEMA niezależnymi sondami o różnej logice (wykonawca i audytor).
- **87** — pochodziła od **nadzorcy przy planowaniu**, ze zgrubnego `awk`, bez sondy
  i bez walidacji. Podana jako pomiar, czym nie była.
- **130/136** — luźne współwystępowanie z fazy pisania instrukcji, bez wartości dowodowej.

**Dlaczego skala jest tak mała** (zmierzone sześcioma reprodukcjami przeciw
prawdziwemu `tests/setup.ts`): pułapka dotyczy **wyłącznie `vi.spyOn(...)`**. Goły
`vi.fn()` przeżywa `clearAllMocks()` — także gdy `.mockResolvedValue()` woła się
później i gdy atrapa jest przypisana wprost do właściwości obiektu. Trzy z czterech
plików „naprawionych" przez dyżur nie miały żywego defektu; wykonawca przyznał to sam.

## FIX-211 — dziura w bezpieczniku zamknięta

Audytor udowodnił, że bezpiecznik **przepuściłby defekt, dla którego powstał**:
uznawał plik za czysty, gdy JAKIKOLWIEK setter był w JAKIMKOLWIEK `beforeEach`, bez
sprawdzania, czy chodzi o TEN SAM cel. Pokazał to na prawdziwym, historycznym pliku
tego samego dyżuru sprzed naprawy.

Naprawione: dopasowanie **per cel** (`vi.spyOn(obj,'method')` → klucz `obj.method`,
z rozwiązywaniem zmiennej). Bramka: plik sprzed naprawy ⇒ zgłoszony; ten sam plik po
naprawie ⇒ czysto; przypadek audytora (dwa spy w `beforeAll`, jeden reinstalowany)
⇒ naruszenie na właściwej linii, i ten sam przypadek zablokował prawdziwy commit.
Zawężone do `vi.spyOn` jako jedynego wzorca blokującego; goły `vi.fn()` zostaje
**ostrzeżeniem nieblokującym** — świadomie, żeby szum nie skłonił nikogo do
wyłączenia bramki.

## ★ Wykonawca OBALIŁ audytora — z powtarzalną reprodukcją

Audytor zażądał wycofania twierdzenia o sprzężeniu kolejności testów w
`interviewAiReviewTimeoutFallback.pg.test.ts`, bo nie odtworzył go w trzech
przebiegach. Wykonawca pokazał, **dlaczego** nie odtworzył: audytor uruchamiał cały
plik (oba testy razem — wtedy zawsze przechodzi). Reprodukcja wymaga uruchomienia
**samego drugiego testu**: `vitest run <plik> -t "does not crash the process"` ⇒
`AssertionError: expected null to match object {...}`. Odtworzone deterministycznie
**6/6**, na wersji sprzed i po naprawie.

**Twierdzenie potwierdzone, nie wycofane. Defekt jest żywy i NIENAPRAWIONY** —
pozycja otwarta na osobny dyżur.

Lekcja metodyczna: „nie odtworzyłem" nie znaczy „nie istnieje". Sposób uruchomienia
testu jest częścią reprodukcji.

---

## Pierwotna karta odbioru adwersaryjnego

---
doc_id: funkcje-odbior-211
status: evidence
truth_type: work-status
established: 2026-08-31
---

# Odbiór adwersaryjny — dyżur 211 (pułapka `clearAllMocks`, ratchet lifecycle mocków)

**Werdykt: `B` — SCALIĆ PO FIX.** Commit jest nieszkodliwy i można go bezpiecznie
wpuścić (nic nie psuje, gate realnie blokuje najprostszy kształt naruszenia przez
prawdziwy hook pre-commit). Ale bezpiecznik ma udowodnioną dziurę dokładnie na
kształcie błędu, który spowodował ten dyżur, i 3 z 4 „napraw" nie naprawiają
żadnego zaobserwowanego defektu — to wymaga FIX-a przed uznaniem dyżuru za
domykający temat `clearAllMocks`.

Materiał: worktree `/private/tmp/cx-day211-atrapy`, gałąź
`codex/day211-atrapy-20260831`, **1 commit** `dd9e66998a` od merge-base `e45904dc79`
(rodzic `fe33ce8036`). `git show --stat` zgodny z opisem wykonawcy: 11 plików,
+344/−31.

## 1. Co realnie weszło (policzone z `git show --stat`)

| Kategoria | Pliki |
|---|---|
| (a) Inwentarz + bramka (jeden skrypt, dwa tryby) | `scripts/check-mock-lifecycle.sh` (132 linii), `scripts/check-mock-lifecycle.baseline.json`, `tests/unit/scripts/checkMockLifecycle.test.mjs` (59 linii), `.husky/pre-commit` (+13, blok 10), `package.json` (rejestracja w `test:node-native`) |
| (b) Naprawa konkretnych plików (przeniesienie settera z `beforeAll` do `beforeEach`) | `interviewAiReviewTimeoutFallback.pg.test.ts`, `interviewDeliveryMountedAuth.pg.test.ts`, `v8Interview.contextDocuments.test.ts`, `ragService.test.js` — 4 pliki |
| (c) Dokumentacja | `LISTA_DYZUROW_211_222.md` (+1), `CODEX_DAY211_ATRAPY_REPORT.md` (91 linii) |

Jeden commit „ratchet" faktycznie niesie **oba** rodzaje pracy (bezpiecznik na
przyszłość ORAZ 4 konkretne naprawy), nie tylko bezpiecznik — to obala wstępną
hipotezę z briefu.

## 2. Własna sonda inwentarza (niezależna od wykonawcy)

Napisałem dwie własne sondy (Python, maskowanie komentarzy/stringów + dopasowanie
klamer beforeAll/beforeEach, LOGIKA różna od `check-mock-lifecycle.sh`):

- **v1** (dopasowanie po identyfikatorze przed kropką) — 0 trafień. Zawodna: nie
  radzi sobie z `vi.spyOn(x,'y').mockResolvedValue(...)`, bo przed kropką jest `)`,
  nie identyfikator. Odrzucona.
- **v2** (rozpoznaje `vi.spyOn(obj,'method')` jako klucz `obj.method`, inaczej
  identyfikator; klucz w `beforeAll` musi wystąpić w jakimś `beforeEach`, inaczej
  to naruszenie) — **1 potwierdzone naruszenie w 1 pliku, repo-wide**:
  `server/src/services/ai/__tests__/day205.decisionWisdom.pg.test.ts:34`.

Zgadza się z wynikiem wykonawcy (`bash scripts/check-mock-lifecycle.sh` bez
argumentów → też 1/1, ten sam plik) i z jego baseline (`total:1`). Rozbieżność
wobec instrukcyjnego framingu „4 pliki wąsko / 2 zagrożone” i wobec starej liczby
`87` jest **wynikiem, nie porażką** — obie strony (wykonawca i ja, niezależnie)
mierzą 1 realne naruszenie repo-wide w obecnym stanie drzewa (po naprawach).
Liczba `130`/`136` (luźne współwystępowanie bez dowodu) jest bez wartości
dowodowej — potwierdzam.

## 3. Sedno: czy `vi.fn()` w ogóle ginie pod `clearAllMocks()`? — NIE zawsze

Zbudowałem 6 minimalnych, empirycznych reprodukcji przeciwko **prawdziwemu**
`tests/setup.ts` i `vitest.config.ts` tego repo (nie syntetyczny standalone
runner):

| Wzorzec w `beforeAll`, bez reinstalacji w `beforeEach` | Test 2 widzi mocka? |
|---|---|
| `vi.spyOn(realObj, 'method').mockResolvedValue(...)` | **NIE — ginie, idzie realną ścieżką** |
| `vi.spyOn(realObj, 'method').mockReturnValue(...)` | **NIE — ginie** |
| bare `vi.fn().mockResolvedValue(...)` (zmienna) | TAK — przeżywa |
| bare `vi.fn().mockReturnValue(...)` (zmienna) | TAK — przeżywa |
| `obj.method = vi.fn().mockReturnValue(...)` (bezpośrednie przypisanie) | TAK — przeżywa |
| dokładna replika produkcyjna: `const mockLlmCall = vi.fn(); vi.mock(...,()=>({...call: mockLlmCall}))`, potem `mockLlmCall.mockResolvedValue(...)` w `beforeAll` | **TAK — przeżywa** |

Rozstrzygający czynnik to **`vi.spyOn` kontra goły `vi.fn()`**, nie sync/async i
nie „setter wywołany później”. To dokładnie pokrywa się z własnym ustaleniem R0
wykonawcy w `CODEX_DAY211_ATRAPY_REPORT.md` („`vi.spyOn(...).mockResolvedValue(...)`
traci implementację w drugim teście; `vi.fn(() => X)` zachowuje”) — **potwierdzam
tę diagnozę jako prawdziwą**, niezależnie zreplikowaną.

### Konsekwencja dla „4 pliki grupy (a)”

Wszystkie 4 „naprawione” pliki używają **gołego `vi.fn()`** (nie `vi.spyOn`) jako
przenoszonego settera:
- `interviewDeliveryMountedAuth.pg.test.ts` / `interviewAiReviewTimeoutFallback.pg.test.ts`:
  `const mockLlmCall = vi.fn();` na szczycie pliku, użyty przez `vi.mock(...)`.
- `v8Interview.contextDocuments.test.ts`: `PermissionService: { hasPermission: vi.fn().mockResolvedValue(true) }` — bezpośrednie przypisanie.
- `ragService.test.js`: `embeddingService: { generateEmbedding: vi.fn().mockResolvedValue([]) , ...}` przez `setDependencies()`.

Żaden z nich nie pasuje do wzorca, który mój i wykonawcy R0 potwierdził jako
faktycznie tracony.

## 4. Zadanie 3 — dowód „przed/po” dla dwóch wskazanych plików

**`tests/unit/backend/ragService.test.js`** (test jednostkowy, mock-only, bez DB):
podmieniłem plik na wersję `fe33ce8036` (rodzic), uruchomiłem, przywróciłem.

- PRZED naprawą: `5 passed (5)`, identyczny log błędu wewnętrznego
  (`Cannot read properties of undefined (reading 'create')`) w tych samych testach.
- PO naprawie (HEAD): `5 passed (5)`, identyczny log.
- **Zero różnicy.** Nie ma dowodu „przed realna ścieżka, po mock” — bo mock nigdy
  nie ginął (goły `vi.fn()`).

**`server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts`**
(wymaga realnego Postgresa): postawiłem własny kontener
`pgvector/pgvector:pg16` na porcie **6301** (poza zakazanym 6151-6157/5092-5105),
zmigrowałem od pustej bazy (`NODE_ENV=test DB_TYPE=postgres npx tsx
server/scripts/migrate.postgres.ts` → `✅ Postgres migrations complete`),
uruchomiłem plik z pełnym env wykonawcy
(`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false`).

- PRZED naprawą (`fe33ce8036`, prawdziwy HTTP przez `evaluate-answers`,
  prawdziwa baza): **`6 passed (6)`**.
- PO naprawie (HEAD): **`6 passed (6)`**.
- **Zero różnicy**, z realną bazą i realnym HTTP, nie syntetycznie.

Sprawdziłem dodatkowo (nie było wymagane wprost, ale to jeden z 4 plików grupy a)
**`v8Interview.contextDocuments.test.ts`**: PRZED `3 passed (3)`, PO `3 passed (3)`
— też zero różnicy.

**Wniosek: 3 z 4 „napraw” (interviewDeliveryMountedAuth, v8Interview.contextDocuments,
ragService) nie naprawiają żadnego zaobserwowanego, żywego defektu — usuwają
teoretyczne ryzyko dopasowane do kształtu regexa, nie potwierdzony błąd.** To
samo przyznaje raport wykonawcy wprost („nie ujawniły zmiany statusu, mimo
błędnego lifecycle”) — **uczciwe ujawnienie, nie próba ukrycia**. Jedyny plik z
realną obserwowalną różnicą to `interviewAiReviewTimeoutFallback.pg.test.ts`, i
tam różnica (wg wykonawcy) pochodzi z INNEGO, niepowiązanego długu (sprzężenie
kolejności testów), nie z naprawianego wzorca — zob. punkt 6.

## 5. Zadanie 4 — BEZPIECZNIK: łapie świeże naruszenie napisane moją ręką? **TAK, częściowo**

Napisałem `tests/unit/__day211_gate_probe/freshViolation.test.ts` —
`vi.spyOn(target,'call').mockReturnValue('MOCK')` w `beforeAll`, zero
`beforeEach`. Zastałem realnym przebiegiem `.husky/pre-commit`:

```
git add -f tests/unit/__day211_gate_probe/freshViolation.test.ts
git commit -m "..."
→ mock-lifecycle: debt grew for tests/unit/__day211_gate_probe/freshViolation.test.ts: 0 -> 1
→ ⛔ Commit blocked: mock implementation debt in beforeAll grew (DAY211).
```

`git log` po próbie: HEAD nadal `dd9e66998a` — **commit realnie zablokowany**, nie
tylko skrypt zwrócił 1. Plik usunięty, `git reset`, worktree czysty.

**Ale**: napisałem DRUGI plik dokładnie odtwarzający prawdziwy kształt błędu z
`v8Interview.contextDocuments.test.ts` sprzed naprawy — `beforeAll` instaluje DWA
mocki (`targetA`, `targetB`), lokalny `beforeEach` reinstaluje **tylko A**. Realny
runtime: `t2` → `A=MOCK_A B=REAL_B` (B rzeczywiście ginie). Bramka:
`scripts/check-mock-lifecycle.sh --ci` → **`0 violation(s)`, exit 0 — PRZEPUSZCZA**.

Powód w kodzie (`scripts/check-mock-lifecycle.sh`, funkcja `scan`):
```python
before_each_has_setter = any(setter_re.search(block) for _, _, block in hooks['beforeEach'])
violations = []
if before_each_has_setter: return violations   # <- cały plik czysty, jeśli JAKIKOLWIEK setter jest gdziekolwiek w beforeEach
```
To „dowolny setter w dowolnym beforeEach czyści cały plik”, nie „ten sam cel
reinstalowany”. **Potwierdziłem to również na prawdziwym pliku**: podmieniłem
`v8Interview.contextDocuments.test.ts` na wersję `fe33ce8036` (rzeczywisty stan
PRZED naprawą tego dyżuru, gdzie `beforeEach` reinstalował 3 inne mocki ale NIE
`PermissionService.hasPermission`) i uruchomiłem bramkę na miejscu: **`0
violation(s)`, exit 0**. Bezpiecznik NIE złapałby własnego przykładu roboczego
tego dyżuru, gdyby commitowano go dziś od nowa.

**FIX wymagany:** `scripts/check-mock-lifecycle.sh:90-95` (funkcja `scan`) —
zamienić `before_each_has_setter` (globalne dla pliku) na dopasowanie
per-cel/identyfikator, analogiczne do mojej sondy v2 (klucz `spyOn(obj,'method')`
→ `"obj.method"`, w przeciwnym razie identyfikator; sprawdzać czy TEN SAM klucz
występuje w `beforeEach`, nie „jakikolwiek setter gdziekolwiek”).

## 6. Zadanie 5 — czy bramka jest ZA ciasna?

Sprawdziłem dwa poprawne wzorce:
- `beforeAll` instaluje gołego spy'a, `beforeEach` go reinstaluje z wartością →
  **0 naruszeń** (poprawnie przepuszcza).
- `beforeAll` instaluje gołego spy'a, każdy `it()` osobno woła
  `.mockImplementationOnce(...)` → **0 naruszeń** (poprawnie przepuszcza; regex
  `mock(...)Value\s*\(` nie łapie `...ValueOnce(` bo między nazwą a `(` jest
  „Once”).

Bramka NIE jest za ciasna — nie znalazłem fałszywego alarmu na dwóch typowych
poprawnych wzorcach. Problem jest odwrotny: **za luźna** (patrz punkt 5), nie za
ciasna.

## 7. Zadanie 6 — fałszywa zieleń

Raport wykonawcy podaje **0 zmian statusu** (16 pełnych nazw testów, porównanie
PASS/FAIL przed/po, identyczny SHA-256 `przed`/`po`). Zgadza się z moim
niezależnym pomiarem: `ragService.test.js` 5/5→5/5, `interviewDeliveryMountedAuth`
6/6→6/6 (realna baza), `v8Interview.contextDocuments` 3/3→3/3 — **zero zmian
statusu potwierdzone niezależnie na 3 z 4 plików**. Lista pusta jest prawdziwa,
nie dlatego że nikt nie sprawdził — bo naprawiany wzorzec (goły `vi.fn()`) nigdy
faktycznie nie tracił implementacji.

**Rozbieżność do zgłoszenia:** raport wykonawcy twierdzi, że
`interviewAiReviewTimeoutFallback.pg.test.ts` uruchomiony OSOBNO (nie w
pakiecie) PRZED naprawą pada na `expected null to match object` z powodu
sprzężenia kolejności (drugi test zależy od rekordu audytu z pierwszego). **Nie
odtworzyłem tego** — uruchomiłem PRZED-naprawą wersję pliku osobno, na świeżo
zmigrowanej własnej bazie (port 6301), **3 razy pod rząd: `2 passed (2)`,
`2 passed (2)`, `2 passed (2)`**, za każdym razem z prawdziwym HTTP i prawdziwym
"AI review exceeded bound, returning fallback" logiem. Może to zależeć od stanu
bazy/env wykonawcy (np. resztki z wcześniejszego przebiegu), ale jako
przedstawione w raporcie jest to **niepotwierdzona teza**, nie zmierzony fakt —
nie obniża werdyktu (bo i tak jest opisana jako NIE naprawiona, ujawniona
uczciwie), ale wymaga odnotowania.

## 8. Zadanie 7 — regresja sąsiadów

Bez zmian w kodzie, uruchomione na HEAD (`dd9e66998a`) z realną bazą (port 6301):
- `interviewGetSessionAccessMatrix.pg.test.ts` — 9/9 PASS
- `interviewAnswerCasAndNullableFixType.pg.test.ts` — 9/9 PASS
- `tests/unit/scripts/checkMockLifecycle.test.mjs` (własny test bezpiecznika, w
  izolowanym worktree) — 2/2 PASS, worktree macierzysty pozostał czysty po teście.

Brak regresji w sąsiadach.

## FIX-e do domknięcia przed uznaniem tematu za zamknięty

1. **`scripts/check-mock-lifecycle.sh` (funkcja `scan`, ok. linii 90-95)** —
   zmienić „dowolny setter w `beforeEach` czyści cały plik” na dopasowanie
   per-cel (identyfikator albo `spyOn(obj,'method')`). Bez tego bramka nie łapie
   dokładnie tego kształtu błędu, który uzasadnia jej istnienie (potwierdzone na
   prawdziwym, historycznym pliku `v8Interview.contextDocuments.test.ts`).
2. **Rozróżnić `vi.spyOn(...)` od gołego `vi.fn()` w sondzie/raporcie** —
   obecny regex traktuje oba jednakowo jako „ryzyko”, co spowodowało 3 z 4
   napraw tego dyżuru bez potwierdzonego żywego defektu (nieszkodliwe, ale
   marnotrawi budżet przyszłych dyżurów na fantomy). Niska pilność — nie blokuje
   scalenia, ale warto zapisać w `LISTA_DYZUROW_211_222.md` dla następnego kroku
   fali.
3. **`interviewAiReviewTimeoutFallback.pg.test.ts` — zweryfikować twierdzenie
   o sprzężeniu kolejności** (`server/src/routes/interviewDelivery/__tests__/interviewAiReviewTimeoutFallback.pg.test.ts`) — 3 moje przebiegi osobne, świeża baza, nie
   reprodukują `expected null to match object`. Albo dostarczyć powtarzalną
   repro-komendę, albo zdjąć twierdzenie z rejestru długu.

## Odpowiedź wprost

**Czy bezpiecznik łapie świeże naruszenie napisane moją ręką?** TAK — dla
najprostszego kształtu (`beforeAll` instaluje jeden `vi.spyOn(...).mockXxx()`,
zero `beforeEach`), zablokowałem to realnym `git commit` przez prawdziwy hook
`.husky/pre-commit`, nie tylko wywołaniem skryptu. **NIE** — dla kształtu, który
faktycznie wystąpił w tym repo (`beforeEach` reinstaluje NIEKTÓRE mocki, ale nie
ten jeden, którego dotyczy `beforeAll`) — to przeszło bramkę cicho, zarówno w
moim świeżo napisanym przykładzie, jak i na prawdziwym, historycznym pliku tego
samego dyżuru odtworzonym z rodzica commita.
