# ODBIÓR 232 — GAMMA / „AGENT" REDAGUJĄCY DECK — **OCENA B** (SCALIĆ PO FIX-232-A)

Gałąź: `codex/day232-gamma-agent-20260901` · commity `461bb38a2c`, `6fd0c27e55`, `e01ec6256c`
Baza: `0a35699021`. Audyt adwersaryjny: 1.09.2026.

---

## ODPOWIEDŹ NA PYTANIE, DLA KTÓREGO POWSTAŁ TEN DYŻUR

> **Czy operację już odrzuconą można dziś zatwierdzić ponownie?**

**NIE. Dziura jest realnie zamknięta.** Zmierzone przeze mnie — nie przeczytane z raportu:
realny `ApiGateway`, podpisany JWT OWNER, PostgreSQL 17 z pełnym zestawem migracji, `--retry=0`.

| przebieg | wynik |
| --- | --- |
| propozycja → **accept** | `200`, `version 1→2`, `deck_json` zmieniony, status `applied` |
| **ten sam accept powtórnie** | `409` `AI_PROPOSAL_ALREADY_RESOLVED`, `deck_json` i `version` **bajtowo bez zmian** |
| propozycja → **reject** → **accept** | `409` `AI_PROPOSAL_ALREADY_RESOLVED`, deck nietknięty |
| obca organizacja | `404` nieodróżnialne, status zostaje `draft` |

**3/3 PASS.** Para dowodowa kompletna: człon „właściwe przechodzi" jest obecny (pierwszy accept
daje 200 i podbija wersję), więc zabezpieczenie nie jest zielone dlatego, że funkcja nie działa.

Brama jest **poza flagą** — `ENABLE_TERESA_DECK_EDIT` steruje wyłącznie rozpoznawaniem pięciu
nowych operacji redakcyjnych (`presentations.routes.ts:4069`), nie kontrolą stanu. Zgodnie z instrukcją.

---

## BRAMA JEST TRÓJWARSTWOWA (wzorem 207) — `plik:linia`

Wszystko w `server/src/routes/presentations.routes.ts`:

| warstwa | linia | co robi |
|---|---|---|
| **1 — odczyt stanu** | `:908` `status: row.status` | `getAiOperation` **wreszcie czyta kolumnę `status`**; kolejność odwrócona: DB pierwsze, mapa w pamięci tylko jako `catch`-fallback (`:915`) |
| **2 — kontrola przed czynnością** | `:4188-4194` accept · `:4294-4300` reject | `if (op.status !== 'draft') → 409 AI_PROPOSAL_ALREADY_RESOLVED` |
| **3 — atomowe zajęcie** | `:4202` (`resolveAiOperation(..., 'draft')`) + `:924-930` | `UPDATE … WHERE id = ? AND status = ?` i sprawdzenie `changes === 1`; przy porażce `409 AI_PROPOSAL_STATE_CONFLICT` |

Warstwa 3 jest **realna, nie ozdobna** — potwierdziłem mutacyjnie (niżej).

---

## ★ ZNALEZISKO GŁÓWNE: warstwa 3 jest NIEUDOWODNIONA dostarczonym pakietem

Reguła programu: *zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest nieudowodnione.*

**Mutacja M4** — semantyczna, zachowująca **wszystkie** literały, których pilnuje test kontraktowy.
Usunąłem wyłącznie reakcję na nieudane zajęcie (`if (!claimed) { return 409 }` w `/accept`, `:4203-4209`).
Wywołanie `resolveAiOperation(operationId, 'accepted', undefined, 'draft')` zostaje; `AND status = ?`
zostaje; `changes === 1` zostaje.

```
dostarczony pakiet 232 (3 pliki):   Tests  12 passed (12)   ← ZIELONO
mój test wyścigu:                    200 / 200               ← CZERWIEŃ
```

**Dwa równoczesne zatwierdzenia obie przechodzą z 200.** Zabezpieczenie przed wyścigiem zniszczone,
a pakiet nie mrugnął. To dokładnie ten kształt, który 31.08 cztery razy przepuścił skasowane
zabezpieczenie.

Przyczyna: `day232.presentation-agent-edit-state.contract.test.ts` to **test obecności tekstu**,
nie zachowania — czyta `presentations.routes.ts` przez `readFileSync` i sprawdza `toContain('…')`.
Łapie skasowanie literału, **nie łapie zmiany semantyki przy zachowanym literale**.

### Dowód, że warstwa 3 jest realnie nośna (para rozstrzygająca)
Ten sam test wyścigu, dwa stany kodu:

| stan | dwa równoczesne `accept` | wersja decku |
|---|---|---|
| **warstwa 3 usunięta** | `200` / `200` | 1 → 2 (zgubiona aktualizacja) |
| **kod produkcyjny** | `200` / `409` | 1 → 2 (**zastosowane dokładnie raz**) |

Test do dołożenia leży w `/private/tmp/AUDYT232-race-test.ts` — do wgrania jako
`tests/integration/day232-agent-edit-race.realdb.test.ts`.

### Kontrola sprawiedliwości
Mutacja **M1** (usunięcie warstwy 2) **czerwieni** dostarczony test realdb — ale na kodzie błędu
(`AI_PROPOSAL_STATE_CONFLICT` zamiast `AI_PROPOSAL_ALREADY_RESOLVED`), nie na skutku: deck nadal
był chroniony przez warstwę 3. Obrona w głąb działa. Zarzut dotyczy wyłącznie **pokrycia**, nie bramy.

---

## ★ „AGENT" TO PIĘĆ WYRAŻEŃ REGULARNYCH — nazywam to po imieniu

`presentationAgentEditService.ts:80-91` — pięć zagnieżdżonych operatorów warunkowych nad
`prompt.toLowerCase()`: `przeredaguj|rewrite`, `skróć|skroc|shorten`, `rozbij|split`,
`zmień archetyp`, `dodaj źródło`. **Zero modelu.** Raport tego nie zaciera — mówi wprost
*„Modelu nie wołałem"* (linia 9) i konsekwentnie pisze „legacy parser". To uczciwe.

Zacierają natomiast **implementacje**, i to trzeba nazwać:

- **`rewrite_slide`** (`:464`) — `String(prompt).split(':').slice(1).join(':').trim()` wklejone
  jako treść slajdu. **Tekst pisze człowiek po dwukropku.** Nic nie jest redagowane.
  Słowo „przeredaguj" opisuje operację, która jest zamianą ciągu znaków.
- **`split_slide`** (`:475`) — przy jednym bloku tnie **łańcuch znaków** na `Math.ceil(len/2)`,
  czyli w środku wyrazu. Tytuły stają się „X — 1" / „X — 2". Do tego `card_id: …-split-${Date.now()}`
  — dwa podziały w tej samej milisekundzie dadzą kolizję identyfikatorów.
- **`change_archetype`** (`:497`) — regex wyciąga token i wpisuje go do `layout_id`
  **bez walidacji, że taki layout istnieje**. Można wpisać `layout_id: 'banan'`.
- **`add_source`** (`:508`) — ★ **najgroźniejsze.** Regex wyciąga `https?://…` z polecenia
  i dopisuje do `source_refs` jako `{source_type:'url', title:url}`. **Zero weryfikacji.**
  Dyżur 231 właśnie zamknął dziurę „stempel pochodzenia był echem flagi, nie faktem" — a ta
  operacja pozwala wyprodukować cytowanie z dowolnego łańcucha wklejonego w czacie.
  To ta sama klasa błędu, tydzień później, w sąsiednim pliku.

---

## ★ EKRAN DOWODOWY `6fd0c27e55` TO RUSZTOWANIE — i pokazuje rzeczy, których produkt nie umie

Powtórka wzorca z dyżuru 231. `dev-render/screens/day232-agent-decku.tsx`:

| co pokazuje ekran | co potrafi kod |
|---|---|
| nagłówek **„Model proponuje zmianę"** | modelu nie ma — jest regex (`presentationAgentEditService.ts:80`) |
| **Przed:** „Pilotaż dał lepsze wyniki i warto rozważyć dalsze działania." **Po:** „Retencja wzrosła o **12,2 p.p.**; rekomendujemy kontrolowane rozszerzenie w Q4." | `rewrite_slide` wkleja to, co człowiek napisał po dwukropku. **Produkt nie potrafi wyprodukować tego „Po" — ani liczby, ani przeredagowania.** |
| karta propozycji z „Przed/Po", `op_232_7fa1`, „wersja 7 → 8", „wymagane `presentation_approve`" | **nie ma takiego komponentu w `src/`.** Cała karta jest napisana w pliku harnessu. |
| „Następne ruchy": **Dodaj 2 slajdy**, **Znajdź studia przypadku** („Utwórz kartę propozycji") | żadna z tych operacji nie istnieje — jest ich pięć, wypisanych wyżej |

Uczciwe w tym ekranie: `AgentActivityPanel` **jest** realnym komponentem produktu, renderowanym
w `DeckBuilder.tsx:1624` i `:2125`; trzeci przycisk jest jawnie wyłączony z podpisem
„Czeka na detektor z dyżuru 230"; raport sam pisze, że dane pochodzą z propsów harnessu.

Ale **para „Przed/Po" jest obietnicą jakości redakcyjnej, której w tym dyżurze nie ma.**
Właściciel patrzący na ten zrzut zobaczy agenta piszącego lepiej od konsultanta.
Dostanie parser, który wkleja jego własne zdanie.

---

## PROPOZYCJE ZAPISU: to **szósta kopia**, nie ten sam mechanizm

`grep -c "aiActionExecutor\|ai_actions" server/src/routes/presentations.routes.ts` → **0**.

| | dyżur 207 | dyżur 232 |
|---|---|---|
| tabela | `ai_actions` | `presentation_ai_operations` |
| wykonawca | `AIActionExecutor.approveAction/executeAction` (`aiActionExecutor.ts:664, 868`) | kod inline w trasach |
| stany | `PENDING → APPROVED → EXECUTING` | `draft → accepted → applied \| rejected` |
| ślad | `recordAIRunEvent` + wiadomości cyklu życia w wątku czatu | `recordPresentationRuntimeEvent` |
| wzorce zatwierdzeń | `ApprovalPatternService` | brak |

Wzorzec skopiowany **poprawnie** (te same trzy warstwy, ten sam warunkowy UPDATE — 207 robi
`WHERE id = ? AND status = 'PENDING'`, `aiActionExecutor.ts:872`). Ale nie jest współdzielony
ani wiersza. Każda przyszła poprawka reguł zatwierdzania trafi w jedno miejsce z dwóch.

---

## DROBNE

- `presentations.routes.ts:18` — `import { featureFlags }` wstawiony **po** `verifyToken`, łamie
  porządek importów (gałąź 230 przy okazji naprawiła analogiczny przypadek w tym samym pliku).
- `DbPromise.run` ma `fallback = true` i **nie rzuca** przy błędzie SQL — zwraca `{success:false}`.
  Wtedy `result?.changes ?? 0` = 0 ⇒ `resolved = false` ⇒ **409 na każdym zatwierdzeniu**.
  Na środowisku bez tabeli `presentation_ai_operations` funkcja przestaje działać zupełnie
  (przed dyżurem ratowała ją mapa w pamięci). Migracje mają tę tabelę, więc to ryzyko odtworzenia
  po awarii, nie awaria dziś — ale fallback `:915` jest martwy dla ścieżki zapisu.
- Po udanym zajęciu status = `accepted`; jeśli `UPDATE presentation_decks` padnie, operacja zostaje
  w `accepted` **na zawsze** — nie da się jej ani zastosować, ani odrzucić. Brak wyjścia awaryjnego.
- Pułapka atrapy, wartа zapisania: `Database.ts:686` w bazie-atrapie zwraca
  `changes: didUpdate ? 1 : 0` **niezależnie od klauzuli WHERE**. Każdy test warstwy 3 uruchomiony
  na atrapie jest bezwartościowy. Wykonawca tego uniknął (`.realdb.test.ts` + `assertRealPostgres`) — słusznie.

---

## FIX-232

| # | plik:linia | co zrobić |
|---|---|---|
| **A1** | nowy `tests/integration/day232-agent-edit-race.realdb.test.ts` | dołożyć test **wyścigu** (gotowy w `/private/tmp/AUDYT232-race-test.ts`). Bez niego warstwa 3 jest nieudowodniona: mutacja M4 daje 12/12 zielono. **Blokuje scalenie.** |
| **A2** | `presentationAgentEditService.ts:508` | `add_source` **nie może** produkować cytowania z surowego łańcucha. Albo walidacja wobec Knowledge Vault, albo `source_type:'user_asserted'` z widocznym w UI oznaczeniem „niezweryfikowane". Dziura pochodzenia otwarta tydzień po 231. **Blokuje scalenie.** |
| **A3** | `dev-render/screens/day232-agent-decku.tsx:52-55` | „Po" musi być tym, co produkt **naprawdę wyprodukuje** (czyli zdaniem wklejonym przez człowieka po dwukropku), albo ekran trzeba oznaczyć jako makietę docelową, nie dowód. Nagłówek „Model proponuje zmianę" → „Polecenie proponuje zmianę". Dwa nieistniejące „następne ruchy" wyłączyć jak trzeci. **Blokuje pokazanie właścicielowi.** |
| B1 | `day232.presentation-agent-edit-state.contract.test.ts` | test `toContain` nad źródłem nie zastępuje testu zachowania — zostawić jako dokumentację, ale nie liczyć jako bramkę. |
| B2 | `presentationAgentEditService.ts:497` | walidować `layout_id` wobec rejestru layoutów. |
| B3 | `presentationAgentEditService.ts:479` | `split_slide` ma ciąć po granicy zdania/bloku, nie po `len/2`; `card_id` z `randomUUID()`, nie `Date.now()`. |
| B4 | `:924-930` | rozróżnić „0 zmienionych wierszy" (konflikt stanu, 409) od „zapytanie padło" (500) — dziś oba dają 409. |
| C1 | architektura | zapisać decyzję: dwa równoległe mechanizmy propozycji (`ai_actions` / `presentation_ai_operations`) albo zjednoczyć, albo świadomie utrwalić. |

---

## ROZŁĄCZNOŚĆ — czysto
Diff `0a35699021..HEAD` na `presentations.routes.ts` usuwa wyłącznie kod, który był naprawianą
dziurą (`const cached = …; if (cached) return cached;`, stary bezwarunkowy `UPDATE`, dwa stare
wywołania `resolveAiOperation`). **Zero nadpisań pracy 226/228/231.** Regiony 230 (`:2663`, `:2938`)
i 232 (`:890`, `:4066+`) nie zachodzą na siebie — kolizja tylko w `FeatureFlags.ts` (dwie nowe flagi
w tej samej liście, trywialna).

## OCENA: **B**
Dziura z instrukcji jest realnie zamknięta, trójwarstwowo, poza flagą, z uczciwym testem realdb
i kompletną parą dowodową. To jest dobra robota inżynierska i tak trzeba ją nazwać.
Trzy rzeczy trzymają przed A: **warstwa 3 nieprzykryta testem** (mutacja przechodzi zielono),
**`add_source` produkuje cytowania z niczego**, **ekran dowodowy obiecuje redakcję, której nie ma**.

## WERDYKT: **SCALIĆ PO A1+A2**; A3 przed pokazaniem czegokolwiek właścicielowi.
