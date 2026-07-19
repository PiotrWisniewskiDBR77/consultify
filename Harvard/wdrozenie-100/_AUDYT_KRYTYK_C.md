# KRYTYK ADWERSARYJNY — sekcja C · Oxford (69✅/0🟡/0⬜/1🔵)

Weryfikacja: worktree `origin/demo@8e10f1c5b0` (bo testy Oxford NIE ISTNIEJĄ na aktualnie
wypiętym HEAD `oxford/oc2-merge@676ca97e9c` — patrz FINDING #0), Postgres parity pg18 `:5443`,
Anthropic klucz z `.env.staging.local` (realne calle LLM, nie mock).

## ★★★ FINDING #0 (meta, wcześniej niewidoczny) — testy „dowodowe" nie istnieją na branchu, z którego pracujesz

`git ls-tree HEAD --name-only | grep tests/acceptance` na `oxford/oc2-merge` (aktualny checkout) →
**0 wyników**. Fizycznie w `tests/acceptance/` leżą tylko 5 plików ogólnych (`harness.ts`,
`notebook.e2e.test.ts`, `run.mjs`, `schema.mjs`, `seed.mjs`) — ŻADEN z plików cytowanych w
rejestrze (`j21-oxford-o4`, `o1-drd-report-benchmark`, `o25-deck-conclusion`, `teresa-six`,
`odbior--o4c--business-case-live`, `odbior--o7c--content-standards`, `o1-siri-adma-initiatives`,
`o6-benchmark-financial`, `odbior-o5-prompt-registry`) nie jest na tym branchu. Commity z tymi
plikami żyją na osobnych, w większości niezmergowanych gałęziach roboczych; 5/6 sprawdzonych
commitów JEST ancestorem `origin/demo` (deploy target), 1/6 (`1c78e138c5`, j21 O4.2-4.7) NIE jest
ancestorem `origin/demo` wcale (zastąpiony późniejszym `odbior--o4c` na innej gałęzi).
**Wniosek:** rejestr = prawdziwy względem `origin/demo`, ale FAŁSZYWY względem bieżącego
checkoutu. Ktokolwiek próbowałby dziś zweryfikować „testy przeszły" bez wiedzy o tym rozjeździe
— nie znajdzie nic do uruchomienia. Musiałem sam zbudować `git worktree add … origin/demo`, żeby
w ogóle mieć co odpalić.

## Tabela wyroków (próbka 12 z 69✅)

| # | Pozycja (O-x) | Test uruchomiony | Wynik | Sensowność outputu | WERDYKT |
|---|---|---|---|---|---|
| 1 | O1.4/O1.5 — DRD raport + benchmark branżowy + fail-safe narrator | `o1-drd-report-benchmark.e2e.test.ts` | 3/3 PASS | Realny Postgres+5×realny call Anthropic (sonnet-4-6, ~800 tok/call) — ALE finalny `narrative` mode = **`deterministic`** (LLM guardian odrzucił własną prozę 5× i spadł na canned-stub). Test i tak PASS bo asercja to `expect(['llm','deterministic']).toContain(...)` — **każdy wynik przechodzi**. Liczby engine (20%, „Benchmark branżowy") są realne i nie-fabrykowane. | **DELEGOWANE-BEZ-ODBIORU** — kod nie crashuje, ale „prawdziwa proza LLM" NIE została pokazana na żywo w tym uruchomieniu; test z definicji nie może tego wymusić |
| 2 | O1.8 — SIRI/ADMA auto-tworzenie DRAFT inicjatyw | `o1-siri-adma-initiatives.e2e.test.ts` | 4/4 PASS | Deterministyczne (bez LLM), realne wiersze w DB, idempotencja potwierdzona. Uboczny fallback: `[InitiativeSimilarity] Embedding similarity unavailable, falling back to token overlap` — realna degradacja (brak embeddings) | **POTWIERDZONE** (mechanika działa jak deklarowano; drobny znany gap embeddingów) |
| 3 | O2.5 — deck slajd „Wnioski" K1→K4 (grounded) | `o25-deck-conclusion.e2e.test.ts` | 2/2 PASS | `conclusion.source=deterministic confidence=medium allHardPass=true` — CELOWO deterministyczne (nie LLM), liczby wyprowadzone z realnych initiative/KPI. To dobrze — unika halucynacji z założenia | **POTWIERDZONE** |
| 4 | O2.5 — `narrativeEngine` system prompt (CONCLUSION_LAYER) | `tests/unit/narrativeEngineConclusionLayer.test.ts` | 9/9 PASS | Test sprawdza że PROMPT ZAWIERA odpowiednie frazy (answer-first, anty-fabrykacja) + logikę post-checks na sztucznych danych. **Nie wywołuje żywego LLM** — nie dowodzi że model faktycznie się stosuje (patrz #1, gdzie live LLM sam odpadł z walidacji) | **DELEGOWANE-BEZ-ODBIORU** — kontrakt promptu istnieje, stosowanie się LLM w praktyce nieprzetestowane tu |
| 5 | O4.1-O4.7 — finance-report wiring (ratios/reconcile/post-mortem) | `j21-oxford-o4.e2e.test.ts` | 4/4 PASS | Realne liczby z silnika, ALE odpowiedź pokazuje **„1/24 wskaźników policzonych (Z111)... EV koszyk niedostępny"** (23/24 skipped, brak danych źródłowych) — i drugi test w tym samym pliku **explicite tytułowany**: „GET lineage does NOT surface O4.2-O4.4/O4.6 — confirms FE lineage panel cannot show them" | **DELEGOWANE-BEZ-ODBIORU / częściowo ZAWYŻONE** — silnik liczy, ale sam test dokumentuje że panel frontendowy TEGO NIE POKAZUJE użytkownikowi; to nie jest „gotowe dla klienta", to API bez UI |
| 6 | O4.1/O4.5 — Business Case LIVE (NPV/ROI/WACC + narracja) | `odbior--o4c--business-case-live.e2e.test.ts` | 1/1 PASS | Realny call Anthropic (23s, 2450 tok) → **konkretny, sensowny polski biznes-case** (CAPEX 500k PLN, drivery z rationale %, ramp-curve, WACC). Najlepszy dowód sensownej treści w próbce. Uboczne (nieblokujące) błędy: `ai_user_memory` brak kolumny `recent_topics`, `ai_budgets` query error — cicho połknięte | **POTWIERDZONE** (treść), z adnotacją o towarzyszącym długu infra (schema drift) |
| 7 | O4 — `businessCaseModel` (NPV/IRR/ROI/WACC/anti-fabrication net) | `tests/unit/backend/businessCase.test.ts` | 23/23 PASS | Czysta matematyka finansowa + `checkNarrativeNumbers` anti-fabrication — solidne, deterministyczne, dobrze pokryte | **POTWIERDZONE** |
| 8 | O5.5 — Prompt Registry (odczyt + RBAC) | `odbior-o5-prompt-registry.e2e.test.ts` | 3/3 PASS | Realny endpoint, realny RBAC (403 non-superadmin, 401 unauth) — proste, ale prawdziwe | **POTWIERDZONE** |
| 9 | O5.4/O7.1-3 — persona Teresy PL/EN + walidator CARD/INITIATIVE_FORMULA | `odbior--o7c--content-standards.e2e.test.ts` | 20/20 PASS | Walidator formuł (hard/soft fails) działa na SZTUCZNYCH przykładach dobry/zły. Prompt person zawiera oczekiwane frazy PL/EN. **Rejestr SAM przyznaje**: „zostaje ODB: akcept tonu Teresy na żywej rozmowie (SESJA#1) — subiektywna jakość głosu, nie kod" | **DELEGOWANE-BEZ-ODBIORU** (jawnie przyznane przez sam rejestr) |
| 10 | O6.2/O6.3 — benchmark finansowy branżowy | `o6-benchmark-financial.e2e.test.ts` | 2/2 PASS | Sensowny output: polska narracja, źródło „GUS/Eurostat", `refreshOwner`, `confidence:"sourced"` — realne wartości 0.9x vs mediana 1.5x | **POTWIERDZONE** |
| 11 | O3 — 19 „Q-banków pogłębiania" (deepening ladder per narzędzie) | `pickWeakestRungDynamicLadder.test.ts` + `promptRegistryDeepenLadder.test.ts` | 20/20 PASS | Mechanika (wybór najsłabszego „szczebla" dynamicznie) realnie działa dla przetestowanych narzędzi. **Ale**: `find src/config -iname deepeningLadder.ts` → **15 plików, nie 19** | **POTWIERDZONE mechanika / ZAWYŻONA liczba** (15 realnych „banków", nie 19 jak w rejestrze) |
| 12 | Meta — czy to w ogóle uruchamialne na branchu roboczym | — | — | Patrz FINDING #0 | **ZAWYŻONE w kontekście „aktualny stan"** |

## Bilans z próbki 12 (ekstrapolacja jakościowa na 69✅)

- **POTWIERDZONE (kod+test+sensowny output, bez zastrzeżeń):** 6/12 (#2,3,6,7,8,10)
- **DELEGOWANE-BEZ-ODBIORU (test zielony, ale albo słaba asercja / string-only check / brak
  realnej akceptacji Piotra / sam rejestr to przyznaje):** 5/12 (#1,4,5,9, + meta #0)
- **ZAWYŻONE (liczba/twierdzenie nie zgadza się z realnym stanem kodu):** 1/12 wprost (#11, 15≠19),
  plus #0 jako zawyżenie kontekstowe („dowiedzione" bez zaznaczenia że dowód żyje tylko na demo)

Żaden z 12 sprawdzonych testów faktycznie **nie przeszedł** — to ważne: silniki NIE są
fantomami, kod istnieje i się wykonuje na żywej bazie z żywym Anthropic. Ale **prawie połowa
próbki** to testy, które z definicji nie mogą wykazać to, co rejestr im przypisuje („realna
proza LLM", „ton Teresy", „widoczność w UI") — mierzą wyłącznie że kod się nie wywala i że
struktura/kontrakt istnieje.

## Odpowiedź na pytanie wprost: czy C=99% to prawda?

**Nie w znaczeniu „gotowe dla klienta", tak w znaczeniu „silnik nie jest fantomem".**

Rejestr sam używa języka: „★ODBIÓR delegowany... Jako delegat CTO **przyjmuję odbiór** — dowód
runtime zastępuje akcept-na-zrzutach" — czyli WSZYSTKIE 69✅ z założenia stoją na definicji
odbioru innej niż reszta systemu (Harvard/Vegas wymagają zrzutów+akceptu Piotra). To jest
świadoma decyzja procesowa, nie ukryte oszustwo — ale efekt jest identyczny z perspektywy
użytkownika końcowego: **żaden człowiek (ani Piotr, ani żaden inny użytkownik) nie widział ani
jednego z tych 69 ekranów/treści i nie ocenił czy to ma sens biznesowo.** Mój sampling pokazuje,
że nawet „dowód runtime" bywa słabszy niż sugerowany:
- w #1 (O1 DRD benchmark) live-LLM naprawdę odpadł i system spadł na fallback — a i tak zaliczono
  jako pass, bo test to explicite dopuszcza;
- w #5 (O4 finance) sam test w tytule przyznaje, że frontend NIE pokazuje tego co silnik liczy —
  czyli mechanika jest, ale user-facing warstwa ma dziurę;
- w #9 (persona Teresy) rejestr sam pisze, że akcept tonu zostaje do SESJA#1.

**Realny kod-dowód:** ~50% próbki (silnik wykonuje realną, sensowną pracę na żywych danych/LLM).
**„Przyjąłem za Piotra" (delegacja bez substytutu prawdziwego wzroku/ucha użytkownika):**
pozostałe ~50%, w tym CAŁA warstwa „czy to brzmi jak konsultant" (O2, O5, O7 tonu) i CAŁA
warstwa „czy user to zobaczy w UI" (O4 lineage). Liczba „19 Q-banków" jest micro-zawyżeniem (15
realnych). Meta-problem #0 (testy nieobecne na branchu roboczym) jest cichym, ale realnym
ryzykiem — następna sesja bez tej wiedzy powtórzy „testy nie istnieją" jako fałszywy alarm albo,
gorzej, uzna 69✅ za niemożliwe do zweryfikowania i się podda.
