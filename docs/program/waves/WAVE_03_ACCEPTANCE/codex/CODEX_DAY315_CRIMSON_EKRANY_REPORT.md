# CODEX — dyżur 315 — crimson Czatu i ekrany dowodowe

Stan: W TOKU. Gałąź `codex/day315-crimson-ekrany-20260904`, baza `bc18bc7acac2ec825ebb3db2f1309738ab034d58`.

## Wejście i marker

Dosłowny wynik kontroli markera:

```text
MARKER OK
```

Dosłowny wynik sanity worktree:

```text
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

`git status --short | head -3` nie zwrócił żadnego wiersza. Tip `github-backup/grafika/m03-20260902` uciekł do przodu o sześć commitów dokumentacyjnych; zgodnie z `DEC-2026-08-26-95` praca zaczęła się dokładnie z markera. Delta obejmuje wyłącznie `_instr_src/**` oraz instrukcje dyżurów 314–323 w `docs/**`; scalenie z tipem pozostaje po stronie nadzorcy.

Dysk przed startem: 76 GiB wolnego, po utworzeniu worktree 64 GiB. Porty 5471 i 6331 były wolne, kontener `cx-day315-pg` nie istniał. Lokalny `pgvector/pgvector:pg16` na `127.0.0.1:6331` zastosował 891 migracji; drugi przebieg: `Applying migrations: 0`.

## R1 — klasyfikacja każdego trafienia `primary-`

Pomiar: 15 trafień w 9 plikach, 10 poza testami. W produkcie jest 5 linii zawierających 7 realnych tokenów klas w 3 plikach. Polecenie `git grep -n 'focus:ring-primary-500' -- src/components/AIChat` zwraca zero; `ToolsMenu`, `MoveToProjectModal` i `CloudFilePicker` mają po zero trafień `primary-`. Tym samym liczby zamówienia 22 / 12 nie opisują markera; obowiązuje pomiar 15 / 0.

| Plik:linia | Treść trafienia | Klasa | Decyzja |
|---|---|---|---|
| `AiProviderErrorNotice.tsx:10` | komentarz `NIGDY primary-*` | NIE-KOLOR — komentarz | nie ruszam |
| `ChatSignalsPanel.tsx:458` | `data-testid="chat-signal-primary-action"` | NIE-KOLOR — literal / data-testid | nie ruszam |
| `ConversationSearch.tsx:19` | `group-focus-within:text-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `text-c-focus` |
| `InlineResponseFeedback.tsx:280` | komentarz `primary-*` | NIE-KOLOR — komentarz | nie ruszam |
| `KimiWorkspace/ExceleRightPanel.tsx:17` | komentarz `zero primary-*` | NIE-KOLOR — komentarz | nie ruszam |
| `PrivateModeDetails.tsx:136` | `hover:bg-primary-100 dark:hover:bg-primary-900/40` | KOLOR — CTA albo stan aktywny | R2: neutralne `c-*` |
| `PrivateModeDetails.tsx:136` | `focus:ring-primary-400/50` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `ProjectMembersModal.tsx:298` | `focus:border-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `ProjectMembersModal.tsx:421` | `focus:border-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `ProjectMembersModal.tsx:432` | `focus:border-primary-500` | KOLOR — pierścień/obramowanie fokusu | R2: `c-focus` |
| `Wave9OutcomeAIOpsPanel.tsx:225` | `provider: 'primary-llm'` | NIE-KOLOR — literal / data-testid | nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:126` | nazwa testu `NIGDY primary-*` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:131` | regex `/primary-/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:136` | regex `/primary-/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:138` | regex `/primary-\\d/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |
| `aiProviderErrorCopy.chatOwn016.test.tsx:139` | regex `/primary-\\d/` | NIE-KOLOR — literal / data-testid | nietykalny test, nie ruszam |

Semantyka krytyczna sprawdzona i pozostawiona: ramka błędu AI w `AiProviderErrorNotice.tsx` używa `c-danger`; etykiety „Blokada” i „Krytyczny” w `ChatSignalsPanel.tsx` pozostają czerwone. Nie są trafieniami `primary-`, ale są jawnie zachowanym wynikiem kontroli.

## Bramki kanonu — PRZED

| Bramka | Wynik |
|---|---|
| `check-focus-canon.sh --ci` | PASS względem wzorca: 41 plików / 60 wystąpień; wzorzec widzi tylko `PrivateModeDetails` spośród 3 plików R2 |
| `check-artefakt.sh` | PASS: 8 aktualnych / baseline 9 |
| `check-list-canon.sh` | PASS po pełnym skanie fallback: 157 plików, 368 naruszeń / baseline 368 |

## Pomiar testów — PRZED

Pakiet jednostkowy uruchomiony jako `RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`: 95/95 suit i 367/367 pełnych przypadków PASS. Pełne nazwy: `/private/tmp/cx-day315-crimson-ekrany-artefakty/przed-nazwy.txt`. To dowodzi wyłącznie zachowania jednostkowego; nie jest dowodem DB, HTTP ani produkcyjnego runtime. Pułapki `ENABLE_V8_GLOBAL`, beta visibility, `DB_TYPE=sqlite` i auth bypass nie leżą na tej czysto jednostkowej ścieżce; wymuszone `RUN_DB_TESTS=0 MOCK_DB=true` jawnie wyklucza dowód egzekucyjny.

## R2 — naprawa realnego crimsona

| Plik | Zmiana | Dowód |
|---|---|---|
| `ConversationSearch.tsx` | `group-focus-within:text-primary-500` → `group-focus-within:text-c-focus` | `esbuild` PASS, commit `e98a4bbbb5` |
| `PrivateModeDetails.tsx` | hover `primary-100/900` → `c-surface-hover`; ring `primary-400/50` → `c-focus` | `esbuild` PASS, commit `8e37e69f4c` |
| `ProjectMembersModal.tsx` | 3 × `focus:border-primary-500` → początkowo `focus:border-c-focus-solid`, po czerwonym dowodzie dark: `focus-visible:ring-2 focus-visible:ring-c-focus` | `esbuild` PASS; commit bazowy `f650615ebf`, korekta dowodowa R5 |

Łącznie zmieniono dokładnie 5 linii i 7 tokenów klas. Hover i fokus w `PrivateModeDetails` są dwiema odrębnymi klasami naprawy mimo wspólnej linii `className`.

## R3 — rozszerzenie bezpiecznika

| Pomiar | Wynik |
|---|---|
| Wzorzec PRZED | `ring-(primary|crimson)-|outline-(primary|crimson)-|ring-offset-(primary|crimson)-` |
| Wzorzec PO | wzorzec PRZED + `(focus|focus-visible|group-focus-within):(border|text)-(primary|crimson)-` |
| Stan po R2 ze starym wzorcem | 40 plików / 59 wystąpień |
| Stan po rozszerzeniu przed baseline | 61 plików / 169 wystąpień, RC=1 |
| Dług odsłonięty | +21 plików / +110 wystąpień |
| Mutacja zabezpieczenia | pojedyncze `focus:border-primary-500` w `ProjectMembersModal.tsx` → RC=1, nowe naruszenie 1 |
| Po cofnięciu mutacji przez `cp` | RC=0, baseline 61 / 169; diff pliku produktu pusty |

**Cytowalne rozstrzygnięcie:** Do baseline weszło 110 wystąpień w 21 plikach jako dług odsłonięty przez poszerzenie miary, nie jako nowa regresja; jednocześnie `PrivateModeDetails.tsx` zniknął z baseline po naprawie R2, a trzy pliki dyżuru 315 mają baseline zero.

Nie użyto `--update-baseline`. Baseline zbudowano z jawnego pełnego pomiaru per plik, zapisano metadane 61/169 i zachowano ratchet per plik. Logi: `/private/tmp/cx-day315-crimson-ekrany-artefakty/focus-expanded-before-baseline.log`, `focus-expanded-counts.txt`, `focus-mutation-red.log`, `focus-mutation-green.log`.

## R4 — brakujące ekrany produktu

| Ekran | Realne komponenty i widoczny stan |
|---|---|
| `chat-crimson-search-research` | `ConversationSearch` w rozmiarze wywołania produktu, z aktywnym fokusem |
| `chat-crimson-private-message` | rozwinięty `PrivateModeDetails` z aktywnym fokusem |
| `chat-crimson-project-members` | realny `ProjectMembersModal`, dane API ograniczone do deterministycznego harnessu; widoczne trzy naprawione pola formularza |
| `chat-message-required-surfaces` | jeden realny `MessageRenderer`: `ResearchProgress`, `abortFeedback`, treść `⚠️`, retry, deep-thinking hint, CTA raportu i `msg.options` |
| `chat-v8-artifact-run-search` | realny, rozwinięty `V8ArtifactRunControl` pod `V8Provider`/router/query provider |

Każdy ekran przeszedł osobny bundle `esbuild` i został obejrzany w przeglądarce na `127.0.0.1:5471`. Kadry są czyste, bez panelu uwag. `ResearchProgress` pokazuje temat/źródła/postęp; tryb prywatny pokazuje popover; `MessageRenderer` pokazuje wszystkie wymagane gałęzie; modal pokazuje widoczność, członków i wiedzę; kontrolka V8 jest rozwinięta i pokazuje uczciwy brak migawki oraz dostępne kolejne działanie.

Pierwsza wersja dwóch ekranów zestawiała obok siebie komponenty bez precedensu produkcyjnego. `check-dev-render-parytet.mjs --all` słusznie zwrócił R2=2/RC=1. Te kompozycje usunięto przed commitem; pięć finalnych ekranów sprawdzono osobno przez `--ekran=<id>` i każdy ma R1=0, R2=0, R3=0, PODPIS=0, RC=0.

Duplikat macierzy rozstrzygnięto przez usunięcie wpisu `canvas-toolbar-md-history` wyłącznie z `13_CHAT`. Jego light SHA był identyczny z `canvas-kebab-restructure` (`2d134eaa…`), więc dwa wpisy zawyżały pokrycie. Plik ekranu i rejestr w `main.tsx` pozostają nietknięte; usunięto wyłącznie fałszywy licznik macierzy modułu Czatu.

## R5 — pary PRZED/PO

Katalog dowodów (poza repo, zgodnie z `Z13`): `/private/tmp/cx-day315-crimson-ekrany-artefakty/evidence/{PRZED,PO}`. Finalny kanoniczny przebieg `po-final.json`: 6/6 status `RÓŻNE`, 0 błędów konsoli, RC=0.

| Ekran | Motyw | SHA PRZED | SHA PO | Różne piksele | Luma PRZED → PO |
|---|---|---|---|---:|---:|
| search | light | `590db7f412c49aabf76e4966670afe21b24ec7309af0c67cda0b3af5c46a1bce` | `b58e88bf890316f7a7525382a9ea93f5f324589f890b64074adef62bc7508686` | 0.0044% | 249.5757 → 249.5786 |
| search | dark | `7ebf451d9475144e7b9fb72bfb092a69fd8e92d8c8b14a5c2266de0d944bd4b1` | `92f9fa31f7c64f75ee40bb9a7ea0eb9f91223d844e9ee77bb689c7b456ec7398` | 0.0044% | 15.5669 → 15.5666 |
| private mode | light | `1a05a28856ff14261503a21e4123ae7feaec04fd4121334b744b0af044fd04cd` | `16e23d8bff3f1c1f14ee059e91582890f4730c92996db43231f8091a2dd0bbb2` | 0.0341% | 249.4005 → 249.3999 |
| private mode | dark | `9cb64960a5af7067b0e5ac722063db6d9614551caf8ed44f7d95c8182d421a6f` | `6a8bc42e88c135561d5ee42abd527420d5b1d43818d99f6e385a9eab6bc1b872` | 0.0343% | 16.3837 → 16.3828 |
| project members | light | `b63decf0517a4e6e4d1c42f7d1c299f6a0919e6cfdb3d57cd3836132f8ddd7d6` | `e141ce573bd8701bda06fed66026ef770da131dd6930cde345dc562816046557` | 0.1403% | 151.5056 → 151.5140 |
| project members | dark | `3f060cda0882e333cbe90cfffc0bf7a63c40abdd1861403341f61f58ab30bf33` | `83093908ea68b7be50f96cbfd6bb99ec62d3beddaeb657c5460f72c4993428c8` | 0.0952% | 11.7967 → 11.8438 |

Kontrola przyrządu z `--rozwin-sekcje=1` i bez tej opcji dała tę samą wysokość stron; finalny JSON raportuje 0 automatycznie rozwijanych sekcji dla search/private i 1 dla modala, bez cofnięcia. Żaden przelot nie skrócił widocznej treści. Light/dark mają różne SHA i radykalnie różną lumę dla każdego ekranu.

Oględziny każdego kadru PO:

- `chat-crimson-search-research` light/dark: realne pole rozmów, aktywny niebieski ring oraz niebieska ikona; kadr czysty.
- `chat-crimson-private-message` light/dark: realny chip z niebieskim ringiem i otwarty popover; tekst nie jest ucięty, brak crimsonowego hover/focus.
- `chat-crimson-project-members` light/dark: realny modal; pole zaproszenia ma wyraźny niebieski ring w obu motywach, pozostałe pola i treść są czytelne.

Pierwszy pomiar modala ujawnił, że `focus:border-c-focus-solid` jest w dark przykrywane przez `dark:border-navy-700`: para dark była identyczna. To był czerwony wynik produktu, nie dowód. Zamiana w ramach trzech licencjonowanych fokusów na kanoniczny ring dała finalnie 0.0952% różnych pikseli w dark i RC=0.

Do par PRZED/PO weszły trzy nowe ekrany bezpośrednio obejmujące pięć zmienionych linii R2. Dwa pozostałe nowe ekrany (`chat-message-required-surfaces`, `chat-v8-artifact-run-search`) dowodzą brakującego pokrycia R4, ale nie weszły do par, ponieważ produktowo nie zależą od R2 i ich para byłaby bajtowo identyczna. To bezpieczniejsza korekta wobec sprzecznego połączenia wymagań „w tym nowe z R4” i „żadna para identyczna”.

## R6 — martwe poddrzewo `AgentAudit/`

Rozstrzygnięcie: **usunąć trzy nieosiągalne pliki** `AgentSuggestionCard.tsx`, `AgentAuditVerdictPanel.tsx` i ich lokalny `index.ts`. Pomiar od korzeni `src` i `dev-render` przed usunięciem zwrócił zero importów obu komponentów spoza własnego katalogu. Po usunięciu ponowny `git grep` zwraca zero odniesień, a produkcyjny build przechodzi.

Pierwszy `npm run build` po transformacji 10 595 modułów zakończył się RC=134 z powodu limitu sterty Node. Ten sam build, bez zmiany kodu, uruchomiony z `NODE_OPTIONS=--max-old-space-size=8192`, zakończył się RC=0 (`✓ built in 38.28s`). Log: `/private/tmp/cx-day315-crimson-ekrany-artefakty/build.log`.

Pełny licencjonowany pakiet jednostkowy po usunięciu: 95/95 suit i 367/367 testów PASS. Żywa funkcja audytu pozostaje w `UnifiedChatPanel`/`MessageRenderer`; pakiet obejmuje m.in. przypadki `deep thinking flow: confirm, proceed, and post-run agent audit (streamed verdict path)` oraz `agent audit accept handler persists acknowledgement and updates stores`. Usunięto zatem wyłącznie równoległe, nieosiągalne komponenty prezentacyjne, nie handlery ani produkcyjny przepływ audytu.

## Korekty wobec instrukcji

- Pomiar potwierdził 15 trafień ogółem i 10 poza testami, a nie 22 z zamówienia nadzorcy.
- W całym `src/components/AIChat` jest zero `focus:ring-primary-500`, a nie 12; realny dług to 5 linii / 7 tokenów klas.
- Dowód braku konfiguracji poczty (`BRAK ZMIENNYCH POCZTY`, 0 wierszy `smtp%`, brak drenaży w `Gateway.ts`) wykonano po migracjach, a nie przed pierwszym zapisem migracyjnym. Migracje dotyczyły wyłącznie pustej lokalnej bazy; nie uruchomiono runtime, outboxu ani transportu. To uchybienie kolejności zostaje jawne i nie będzie powtórzone przed runtime.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano jeszcze nowych ekranów w realnym dev-render ani par PRZED/PO.
- Nie zweryfikowano jeszcze rozszerzonego bezpiecznika mutacją w obie strony.
- Nie rozstrzygnięto jeszcze usunięcia martwego poddrzewa `AgentAudit/` testem i buildem.
