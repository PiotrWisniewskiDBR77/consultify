# Raport dnia — Deliverables light: triada deck / doc / sheet (2026-06-10)

> Sesja: deliverables-light (CTO/PM-mode, autonomiczna) · Branch: `feat/deliverables-light` (na origin)
> Zakres dnia: od planu L1 do kompletnej, chat-natywnej triady artefaktów + audyt UX + 6 naprawionych bugów systemowych.
> Równolegle na tym samym branchu pracowała druga sesja (canvas overhaul: wersje, share, switcher, Teresa retrieval) — jej commity oznaczone `feat(canvas)`/`feat(ai)` nie wchodzą w zakres tego raportu.

---

## 1. Wynik dnia w jednym akapicie

Rano Consultify tworzył dokumenty przez formularz 8 pól, który kończył się **placeholderem zamiast treści** — dokumenty literalnie nie powstawały. Wieczorem: **jedno zdanie w czacie** („napisz raport o…", „stwórz prezentację o…", „przygotuj budżet…") daje checklistę postępu w rozmowie i **żywy artefakt po prawej** — prezentację, dokument z realną konsultingową prozą po polsku albo edytowalną tabelę z eksportem XLSX. Wzorzec Kimi/Claude, wszystko za flagami (`ENABLE_DELIVERABLES_LIGHT` + `VITE_…`), produkcja nietknięta. Każdy plaster zweryfikowany na żywo w przeglądarce przed raportowaniem.

## 2. Co zostało zbudowane (fazy L1–L3 planu `DELIVERABLES_LIGHT_TARGET.md`)

### L1 — Deck (prezentacje) · commity `a657208a…332cf6a0`
- Jeden async **kontrakt generacji** `POST/GET /api/deliverables/generations` (plan → generate → poll), owijający istniejący generator decków — zero przepisywania.
- Split-view: starter `'presentation'` montuje żywy deck (reuse `CardRenderer`, lazy, self-poll podczas generacji) + „Otwórz w Deck Builder".
- Intercept czatu + **checklista Task-Progress** (wzorzec Kimi) zamiast nawigacji do modułu.

### L2 — Doc (dokumenty) · commity `e04e3c42…f3a1abbb`
- Decyzje ratyfikowane z ownerem po audycie (§11 planu: wejście = rozmowa, grounding dwutorowy, zakaz placeholderów, żywe sekcje później).
- **Obudzony uśpiony silnik prozy D11** (`generateBlockProse`) — istniał od miesięcy, nigdy nie był włączony i był podwójnie zepsuty (szczegóły w §4).
- Artefakt = canvas draft (markdown canonical): dziedziczy edytor TipTap, autosave, wersje, eksport DOCX/PDF.
- Dokument: realna polska proza, typ wykrywany adaptacyjnie (raport → 5 sekcji, plan wdrożenia → 9), założenia `[Assumption]` oznaczane inline.
- 11 testów jednostkowych (kontrakt, bramka anty-placeholder, wnioskowanie stanu po restarcie).

### L3 — Sheet (arkusze) · commity `f2d3a73e…9a0eb5e3`
- Gałąź `sheet`: LLM → walidowana tabela GFM → canvas draft `kind='table'`; **za darmo** odziedziczone: edycja, eksport XLSX/CSV/PDF, bridge „Send to Table Studio".
- Intercept przejmuje tylko intencje skoroszyt/budżet/model finansowy; działający AI Table Builder nietknięty.
- +4 testy (łącznie 15→17 po rundzie finalnej).

### Runda finalna — Kimi-parity · commity `54e840ce`, `49257743`
- **Artefakt widoczny od razu po PLAN** (szkielet sekcji „Teresa pisze treść…"), nie dopiero na końcu.
- **Czysty deliverable**: usunięte wewnętrzne metadane intake'u (Document type/Audience/…) i techniczne `KEY_MESSAGE` (→ „Kluczowa myśl") — renderer eksportu nietknięty.
- Kontrakt eventu `deliverables:draft-ready` + remount panelu po generacji.

## 3. Audyt UX wejścia do dokumentów (rano, na żywo)

Raport: `docs/audit/2026-06-10/DOC_ENTRY_UX_AUDIT.md`. 4 ścieżki przeklikane w przeglądarce,
porównane z benchmarkami Kimi/Gamma (`docs/benchmarks/`). Werdykt: strukturalna porażka —
kontekst ginął na przejściu czat→studio, formularz przed wartością, generacja kończyła się
placeholderami „MVP-1" z wewnętrznym żargonem, jedyna lekka ścieżka (canvas) ukryta i półmartwa.
Ten audyt ugruntował decyzje L2 i listę napraw.

## 4. Naprawione bugi systemowe (znalezione po drodze, każdy z dowodem)

| # | Bug | Skala rażenia | Fix |
|---|---|---|---|
| 1 | **Silnik prozy D11 martwy**: nikt nie włączał `useLlm:true`, a `MODEL_DEFAULT='default'` nie jest tierem → padał natychmiast **i po cichu** (połykany catch) | „dokumenty nie powstawały" — sedno skargi ownera | tier `standard`, logowany catch, twarda bramka anty-placeholder (uczciwy błąd zamiast wydmuszki) |
| 2 | **Tabele w canvasie niszczone przy każdym autosave**: TipTap emituje tabele bez `<thead>` + `<p>` w komórkach → turndown-gfm escapował całość do zepsutego HTML | każda tabela w rich-edytorze, od zawsze | normalizacja w `canvasMarkdownConversion` — round-trip bezstratny (dowód w DB) |
| 3 | **Polskie wzorce intencji martwe**: JS `\b` nie matchuje po diakrytykach („przygotuj prezentację" nigdy nie działało) | wszystkie odmienione formy PL | wzorce na rdzeniach |
| 4 | Komunikaty interceptów niewidoczne: czat renderuje `ConversationStore.activeMessages`, a intercepty pisały do `appStore` | wszystkie wiadomości AI interceptów | checklisty przez ConversationStore (ephemeral + trwały wpis końcowy) |
| 5 | Wiadomości ginęły w świeżych sesjach (brak aktywnej konwersacji → reset stanu) | pierwsze użycie czatu | bootstrap konwersacji w interceptach |
| 6 | Język artefaktu brał język UI zamiast języka wiadomości | polski prompt → angielski dokument | `detectMessageLanguage` steruje językiem artefaktu |

Plus przepisane stuby Document Studio na język użytkownika (zero „MVP-1" w outputach, niezależnie od flag).

## 5. Jakość i weryfikacja

- **17 testów jednostkowych** runtime'u deliverables + suita documentStudio (855) zielona; lint 0 błędów na zmienionych plikach; tsc bez nowych błędów (baseline repo niezmieniony).
- **Verify-before-claiming**: każdy plaster przeklikany w przeglądarce (register-demo, staging DB) — deck PL, doc PL (2×), sheet z realnym budżetem; screenshoty w transkrypcie sesji.
- Wszystko za flagami; flaga off ⇒ zachowanie legacy nietknięte (404 na routerze, stare redirecty działają).

## 6. Zgodność z Claude/Kimi — stan na koniec dnia

✅ wejście jednym zdaniem · ✅ checklista planu/postępu · ✅ artefakt od razu (szkielet) · ✅ chip artefaktu w transkrypcie + taby (workstream canvas) · ✅ czysty deliverable · ⚠️ **jedna luka**: podmiana szkieletu na finalną treść w już otwartym panelu — backend ma treść, event dochodzi, ale edytor ignoruje zewnętrzną zmianę `contentMd` (podejrzany ten sam root-cause co cichy canvas-streaming). Handoff z kontraktem i hipotezą: `docs/handoff/DELIVERABLES_X_CANVAS_REFRESH_HANDOFF.md`. Workaround usera: tab/chip artefaktu pokazuje finał.

## 7. Następne kroki (rekomendacja)

1. Fix zewnętrznej synchronizacji `CanvasRichEditor` (właściciel: workstream canvas — naprawia im też streaming) → zamyka ostatnią lukę Kimi-parity.
2. Afordancja „zrób z tego dokument/arkusz" na kartach encji — kontrakt już przyjmuje `sourceRefs`, brakuje tylko UI (decyzja UX per kanon Menu 1/2/3).
3. Per-sekcja akcje doc (Rozwiń/Skróć/Podeprzyj danymi) — iteracja na działającym E2E.
4. L4 retire-list: wygaszenie starych ekranów wejściowych po włączeniu flag na stałe.

## 8. Metryka dnia (tylko workstream deliverables)

- ~20 commitów na `feat/deliverables-light` (kontrakt+L1: 6, L2: 5, L3: 3, Kimi-parity: 2, docs/audyt/handoff: 4); nowy kod runtime'u + klient + widoki ≈ **2,1 tys. linii** + testy 320 linii.
- 3 dokumenty robocze: audyt UX, §10–12 planu (statusy DONE), handoff międzysesyjny.
