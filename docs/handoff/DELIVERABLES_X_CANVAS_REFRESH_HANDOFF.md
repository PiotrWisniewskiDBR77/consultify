# Handoff: deliverables ↔ canvas — odświeżenie treści po generacji (2026-06-10)

> Od: sesja deliverables-light (deck/doc/sheet) · Do: sesja canvas-overhaul (switcher/wersje/share) + Piotr
> Kontekst: pracujemy równolegle na `feat/deliverables-light`, wspólny working tree + dev-serwery.

## Co działa (zweryfikowane live)
- Triada deck/doc/sheet z czatu: intencja → checklista → artefakt. Backend produkuje finalną,
  czystą treść (DB-proof; doc: realna polska proza; sheet: tabela GFM, bezstratny round-trip po
  moim fixie `canvasMarkdownConversion`).
- Kimi-parity z tej rundy: panel montuje się **od razu po PLAN** ze szkieletem sekcji
  („Teresa pisze treść…"), output bez wewnętrznych metadanych/`KEY_MESSAGE`
  (`polishMarkdownForCanvas` w `docGenerationRuntime` — renderer dla eksportów nietknięty).
- Wasze chipy artefaktów w transkrypcie (B2) + taby switchera wyglądają bardzo Claude'owo. 👏

## Otwarta luka: skeleton → finalna treść w OTWARTYM panelu
Po zakończeniu generacji emitujemy `window` CustomEvent **`deliverables:draft-ready`**
`{ detail: { draftId } }` (z retry 0/2/5 s) + bump `canvasRemountNonce` (klucz mountu panelu
w `UnifiedChatPanel` ~5650). Listener jest w `WorkCanvasDocumentPanel` (markdown-panel,
za hydration-effectem): jeśli `documentState.draftId` pasuje i treść nadal zawiera marker
`po zakończeniu generacji` → fetch draftu i `setDocumentState`.

**Obserwacja:** fetch odpala (network-proof), serwer ma finalną treść, a edytor dalej pokazuje
szkielet. Dwie hipotezy, w kolejności prawdopodobieństwa:
1. **Martwa zewnętrzna synchronizacja `contentMd` w `CanvasRichEditor`** (effect
   `editor.commands.setContent(html, { emitUpdate: false })` ~l.146-157). To by tłumaczyło TAKŻE
   cichy no-op canvas-streamingu z audytu (`docs/audit/2026-06-10/DOC_ENTRY_UX_AUDIT.md` §1D) —
   ten sam objaw: stan się zmienia, edytor nie. Podejrzenia: sygnatura `setContent` (obiekt jako
   2. argument vs boolean w tej wersji TipTapa), albo guard `isExternalUpdateRef`.
2. **Switcher/aktywny artefakt nadpisuje wybór panelu** — po remount aktywny tab to
   „Working document" (nowo utworzony boilerplate draft), nie draft generacji. Jeśli switcher
   utrwala „active artifact" per konwersacja, powinien przyjmować `deliverables:draft-ready`
   (albo `initialDraftId`) jako nowy aktywny.

## Prośba / propozycja podziału
- Canvas-side: zweryfikować `setContent`-sync w `CanvasRichEditor` (naprawa załatwia i refresh,
  i streaming) oraz uczyć switcher honorować `deliverables:draft-ready`.
- Deliverables-side (ja): event + remount już emitowane; nic więcej nie blokuje.
- Test ręczny E2E: flagi w `.env.local`/`.env.staging.local` już ustawione; w czacie
  „Napisz raport o X" → panel powinien przejść szkielet → finalna treść bez przeładowania.

## Drobne kolizje dnia (FYI)
- Restarty tsx-watch podczas waszych edycji ubijają in-flight requesty (przejściowe 500 na
  POST /generations — uczciwie pokazane w checkliście, ale w demo może zmylić).
- Dzielimy przeglądarkę preview — nawigacje się przeplatają.
