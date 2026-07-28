# PRZEPIS MIGRACJI — artefakt NOTIFICATION → kontrakt karty (RECON/PREP, 2026-07-22)

> **Dla:** eskadra migracji (po akcepcie POC Decision przez Piotra). **Co to jest:** gotowy do wykonania
> przepis adopcji `cardContract.types.ts` + bramki `check-artefakt-struktura.mjs` dla **jednego** artefaktu —
> Notification (sierota klasy **S**). **To NIE jest migracja** — zero edycji komponentu w tej fali; niżej sam plan.
>
> **Baza dowodów:** worktree `fix/prv-mywork-preview` (`origin/demo`). Każde twierdzenie: `plik:linia`
> albo jawne **DO DECYZJI PIOTRA**. Higiena: esbuild per plik, **NIE** pełny tsc/vitest (CLAUDE.md).
>
> **Model + katalog:** `_KANON_KARTY_MODEL_2026-07-22.md` (§2.2 51 id, §3.4 sieroty). **Kontrakt:**
> `_KONTRAKT_KARTY_SSOT_2026-07-22.md` (§8.3 kompozycje, §9 plan POC-first). **Typ:** `src/components/standard/cardContract.types.ts`.

---

## 0. TL;DR

- Notification = **sierota klasy S**, panel skrócony. Karty **zahardkodowane** w `nModeSections`
  (`NotificationDetailView.tsx:1347-1396`) — nie z katalogu. Rdzeń mapuje **po kształcie**:
  `whats-happening → executive-summary`, `expected-action → artifact-actions`.
- **Baseline bramki DZIŚ = FLAGA** (verdict `FLAGA`): 38 crimson w centrum + Menu 1 montowane
  „wprost NModeHeader" (obejście NModeShell — miękki sygnał). Panel: `[properties, history]` — kolejność OK.
- **Jeden genuine blocker:** sekcja `ai-analysis` (`:1368-1373`) **NIE MA kanonicznego id** w katalogu 51.
  → DO DECYZJI PIOTRA (nowe id / alias / lokalny wyjątek) — bez tego adapter nie domknie się w 100%.
- **Gotowość: ŚREDNIA.** Mała powierzchnia (2-3 sekcje lewe + 2 panelu), ale: (1) `ai-analysis` poza kanonem,
  (2) rola_AI `whats-happening` niejednoznaczna (kanon `pisze`, tu treść systemowa), (3) 38 crimson do zdjęcia
  = zmiana wizualna → harness + akcept Piotra (reguła #7).

---

## 1. DESKRYPTOR — karty Notification → kanoniczne id

Legenda: **rdzeń** = nieusuwalna · **dom.** = domyślnie widoczna · **dod.** = dodawalna · **pominięta** = w kontrakcie
z powodem (nie renderowana). `idWArtefakcie` = jak sekcję renderuje TEN artefakt (pole `PrzynaleznoscArtefaktu.idWArtefakcie`,
`cardContract.types.ts:164`). Klasa artefaktu = **S** (`registry.ts:100`).

### 1a. Lewa nawigacja (`nModeSections`, `:1359-1393`)

| # | id w kodzie (dowód) | kanoniczne id (rozwiązanie) | kompozycja | rola_AI | prompt AI | uwaga |
|---|---------------------|------------------------------|------------|---------|-----------|-------|
| 1 | `whats-happening` (`:1361`) | **`executive-summary`** (#1, mapowanie po kształcie) | **rdzeń** (per zadanie) | `asystuje` ⚠ DO DECYZJI (kanon: `pisze`) | drafty edytowalne, brak silnika bazowej treści (`descriptionDraft`/`whyImportantDraft` `:224-227`); AI tylko parsuje `applyIfUntouched` `:870` | `idWArtefakcie:'whats-happening'` |
| 2 | `ai-analysis` (`:1368-1373`, warunkowa `hasAIContext`) | **★ BRAK w katalogu 51** → DO DECYZJI | dod. (warunkowa) | `pisze` (`generateAIAnalysis` `:1092`) | jest (generacja) | **blocker adaptera** — patrz R1 |
| 3 | `expected-action` (`:1377`) | **`artifact-actions`** (#2, mapowanie po kształcie) | **rdzeń** (per zadanie) ⚠ kanon §3.4 wskazuje tylko „treść wiadomości" jako rdzeń → DO DECYZJI (rdzeń czy dom.) | `pisze`/`asystuje` (`canExpectedActionAI` `:1326`, `generateActionChecklist` `:462`) | jest (checklist AI `:1848`) | `idWArtefakcie:'expected-action'` |

### 1b. Prawy panel (`rightPanelSections`, `:2503-2570`) — sekcje POWŁOKI (nie karty-treści z katalogu 51)

| id w kodzie (dowód) | kanon powłoki (bramka §c) | kompozycja | rola_AI | uwaga |
|---------------------|----------------------------|------------|---------|-------|
| `properties` (`:2505`, `defaultOpen`) | `properties` (sekcja `ArtifactRightPanel`) | dom. | `dane` | tabela Właściwość/Wartość — sekcja shell, **nie** wpis katalogu 51 |
| `history` (`:2547`) | **`activity-log`** (#48, wchłania alias `history`) | dom. | `systemowa` | prompt = jawny brak (`BrakAiPrompt`) |

### 1c. Karty POMINIĘTE z powodem (D-6, wzorzec `PominietaSekcjaPanelu`)

| kanoniczne id | powód (dowód) |
|---------------|---------------|
| `comments` (#47) | **pominięta całkowicie** — „powiadomienie to wiadomość systemowa, nie artefakt współpracy" (plan K2, `NotificationDetailView.tsx:1385-1388`). Bloki `case 'comments'`/`case 'activity-log'` niżej są **nieosiągalne** (`:1389-1392`) — martwy kod, sprzątanie = osobna fala (SPEC-N §7 P3). |
| `relations` | brak (bramka `missingCore` info); „Related to" jest wtopione w `whats-happening` (`:1417-1452`), nie osobna sekcja panelu |
| `actions` | brak sekcji panelu Akcje (info) |

**Zwięźle (dla StructuredOutput):** rdzeń = `executive-summary`(←whats-happening) + `artifact-actions`(←expected-action);
dom. = `activity-log`(←history) + `properties`(shell); dod./warunkowa = `ai-analysis` (BRAK id → DO DECYZJI);
pominięta = `comments`(K2).

---

## 2. KROKI MIGRACJI (wykonywalne, per plik)

> Wzorzec = plan POC-first `_KONTRAKT_KARTY_SSOT §9`: flaga OFF → adapter → bramka `--strict` → harness oba
> motywy → zrzut → akcept Piotra → flaga domyślna + re-tag. **Nigdy dwa naraz** (reguła #9).

**KROK M0 — brama wejścia (przed dotknięciem Notification).** Rozstrzygnij R1 (`ai-analysis` kanoniczne id)
i rolę_AI `whats-happening`/rdzeń `expected-action` — patrz §3 (DO DECYZJI). Bez tego adapter nie ma dokąd
zmapować sekcji 2.

**KROK M1 — NOWY plik deskryptora (nie edytuje komponentu):**
`src/components/MyWork/notification.cards.ts`. Zadeklaruj kompozycję Notification przez `definiujKarteKanoniczna`
(`cardContract.types.ts:269`) dla wpisów z §1a/1b: `id` kanoniczny, `idWArtefakcie` (whats-happening/expected-action/history),
`kompozycja:[{artefakt:'notification', rola, klasa:'S'}]`, `rolaAI`+`aiPrompt` (spójne — `RolaAISpojna`), `prog:{rodzaj:'do-decyzji-piotra'}`,
`statusKanonu`. `history`→`activity-log` z `idWArtefakcie:'history'` (rozwiązanie aliasu). Higiena: `esbuild` per plik.

**KROK M2 — wepnij deskryptor do `nModeSections` (edycja komponentu, ZA FLAGĄ OFF).**
W `NotificationDetailView.tsx:1347-1396` zamień literał tablicy na mapowanie z deskryptora:
`descriptor.filter(widoczne).map(k => ({ id: k.idWArtefakcie ?? k.id, icon: IKONY[k.id], label: k.label, ... }))`.
Ikony/`badge`/warunek `hasAIContext` zostają lokalne (nie są w kontrakcie). Zachowaj `activeNSection` guard (`:1399-1403`).

**KROK M3 — zdejmij crimson z centrum (edycja, ZA FLAGĄ OFF — zmiana WIZUALNA).**
38 naruszeń bramki (z 91 wystąpień `primary-`/`crimson-` w pliku). Rdzeń długu = mapa kolorów ikon typu
(`:151` DECISION_REQUIRED, `:157` AI_RECOMMENDATION, `:169` DBR77_UPDATE = `text-primary-400`) + akcenty
centrum (`:1067,1480,1502,1546,1555…`). Swap `primary-*`→token semantyczny/neutralny (`c-*`; wzór: pozostałe
kolory mapy to `text-danger/amber/emerald/indigo-400`). To zmiana na ekranie → **wymaga harness + akcept Piotra**.

**KROK M4 (DO DECYZJI) — Menu 1 przez `NModeShell` zamiast wprost `NModeHeader`.**
Dziś `import { NModeHeader }` (`:64`), bramka: `headerPath: "wprost <NModeHeader> (obejście NModeShell)"` —
**miękki** sygnał (nie blokuje `--strict`; Decision/Task/Notif też tak mają, `check-artefakt-struktura.mjs:346`).
Przełączyć czy zostawić = DO DECYZJI (nie wymagane do zielonej bramki).

**KROK M5 — bramka + harness + akcept.**
`node scripts/check-artefakt-struktura.mjs --strict` na Notification = zielono (crimson 0). JA renderuję
`NotificationDetailView` w harnessie z mock-danymi, **oba motywy** (dark+light), zrzut czysty. **BRAMA:** akcept
Piotra na zrzutach → flaga domyślna + re-tag `demo-safe-<data>` (reguła #8). Adapter **addytywny** (nie kasuje
starej ścieżki) → rollback = usuń wpięcie.

---

## 3. DO DECYZJI PIOTRA (genuine wybory — kanon nie zgaduje)

- **★ `ai-analysis` — kanoniczne id?** Sekcja istnieje warunkowo (`:1368-1373`, `hasAIContext`), ma generację
  (`generateAIAnalysis :1092`), ale **NIE MA wpisu w katalogu 51** (zweryfikowane: `grep "ai-analysis"` w
  `_KANON_KARTY_MODEL` = pusto). Opcje: (a) nowe kanoniczne id `ai-analysis`; (b) alias do istniejącego
  (np. `consulting-readout` — rodzina Insight); (c) lokalny wyjątek w kontrakcie (jak `comments` pominięta,
  ale odwrotnie — dopuszczona lokalnie). **Bez decyzji adapter zostawia dziurę** (bramka test-e zgłosi
  „sekcja renderowana bez wpisu w katalogu").
- **rola_AI `whats-happening`?** Kanon `executive-summary` = `pisze` (wymaga `aiPrompt` treści, `cardContract.types.ts:91-95`).
  W Notification bazowa treść jest **systemowo komponowana** z danych powiadomienia (`descriptionDraft` seed,
  AI tylko `applyIfUntouched :870`). `pisze` → trzeba podać prompt; jak brak realnego generatora → `rozjazd`.
  Wybór: `pisze` (z promptem) vs `asystuje` vs `dane`.
- **`expected-action` — rdzeń czy domyślna?** Zadanie mapuje na rdzeń `artifact-actions`; ale KANON §3.4 dla
  Notification wymienia jako rdzeń tylko „treść wiadomości" (= whats-happening). Jeden rdzeń czy dwa?
- **KROK M4 — Menu 1 przez NModeShell?** Zostawić obejście (miękki) czy ujednolicić?
- **Próg** (`prog`): dla wszystkich kart Notification brak w kodzie → `do-decyzji-piotra` (D-1, druga tura).

---

## 4. RYZYKA (uczciwie, z dowodem)

- **R1 — `ai-analysis` poza katalogiem 51** (`NotificationDetailView.tsx:1368-1373` vs `_KANON_KARTY_MODEL §2.2`).
  Blokuje 100% adaptera + przyszły bramkowy test-e (KANON §4.4). **Mitygacja:** rozstrzygnąć w M0 (§3) PRZED kodem.
- **R2 — rola↔prompt niewyrażalna** (`cardContract.types.ts:91-104`): jeśli `whats-happening` dostanie `pisze`
  bez realnego promptu, typ wymusi `aiPrompt` treści → albo wymyślamy prompt (zakaz), albo `statusKanonu:'rozjazd'`.
  Dowód braku silnika bazowej treści: `:224-227` (czyste `useState('')`), generacja tylko dla analizy/checklisty
  (`:1092`, `:462`).
- **R3 — 38 crimson = zmiana wizualna, nie mechaniczna** (`:151,157,169,1067,1480,1502,1546,1555,…`). Reguła #7:
  Piotr nie jest pierwszym testerem → wymaga harness + zrzut PRZED akceptem. Ryzyko regresji koloru w mapie
  ikon typu (semantyka: crimson bywa „decyzja wymagana" — trzeba świadomie wybrać token, nie ślepy sed).
- **R4 — martwy kod `comments`/`activity-log`** (`:1389-1392`): adapter **nie może** wskrzesić nieosiągalnych
  `case`. `comments` pozostaje pominięta (K2); `activity-log` żyje TYLKO w prawym panelu jako `history` (`:2547`).
- **R5 — `properties` to sekcja powłoki, nie karta katalogu 51** (`:2505`). Deskryptor treści (§1a) i sekcje
  panelu (§1b) to dwie różne warstwy — nie mieszać: bramka §c ma własny kanon panelu (`missingCore` liczy
  actions/relations/comments, nie 51 katalog).
- **R6 — Menu 1 „wprost NModeHeader"** (`:64`; bramka `headerPath`): miękki sygnał; jeśli M4 pominięty, zostaje
  jako trwały divergence (nieblokujący, ale widoczny w raporcie).

---

## 5. BASELINE BRAMKI (dług strukturalny PRZED migracją)

`node scripts/check-artefakt-struktura.mjs --json` → wpis `Notification` (dziś, `origin/demo`):

```json
{
  "name": "Notification",
  "file": "src/components/MyWork/NotificationDetailView.tsx",
  "headerMounted": true,
  "headerPath": "wprost <NModeHeader> (obejście NModeShell)",
  "usesArtifactRightPanel": true,
  "sectionIds": ["properties", "history"],
  "orderInversions": [],
  "missingCore": ["actions", "relations", "comments"],
  "unknownSections": [],
  "evidenceIssue": null,
  "crimsonCenterCount": 38,
  "verdict": "FLAGA"
}
```

Czytanie: **verdict FLAGA** = twardy defekt (crimson 38). Panel `[properties, history]` — kolejność zgodna z
kanonem, brak `actions/relations/comments` = **informacyjnie** (nie blokuje; `comments` świadomie pominięta K2).
Menu 1 montuje się z **obejściem NModeShell** = miękki sygnał. **Do zielonego `--strict`:** zdjąć 38 crimson
(KROK M3). Reszta (bypass, brak sekcji) nie blokuje.

---

## 6. GOTOWOŚĆ: **ŚREDNIA**

**Za LATWA:** najmniejsza powierzchnia treści (2-3 sekcje lewe + 2 panelu ≤ limit klasy S), rdzeń mapuje
po kształcie 1:1 (executive-summary/artifact-actions), aliasy proste (`history→activity-log`), `comments`
już rozstrzygnięta (pominięta K2), panel kolejność już zgodna.

**Za TRUDNIEJSZA niż LATWA:** (1) `ai-analysis` bez kanonicznego id = genuine blocker (§3/R1); (2) rola_AI
`whats-happening` niejednoznaczna (system vs `pisze`); (3) 38 crimson = zmiana wizualna → obowiązkowy harness
+ akcept Piotra (reguła #7), nie „mechaniczny adapter". Dwa punkty decyzji Piotra PRZED kodem (M0) przesuwają
z LATWA na **ŚREDNIA**.

---

*Wygenerowano na `origin/demo` (worktree `fix/prv-mywork-preview`). RECON/PREP — zero edycji komponentu
Notification, zero wiązania w produkt, brak push. Migracja = osobny etap po akcepcie POC Decision (reguła #9).*
