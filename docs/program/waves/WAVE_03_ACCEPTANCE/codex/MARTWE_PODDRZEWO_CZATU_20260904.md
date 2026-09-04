# Martwe poddrzewo czatu — rozstrzygnięcie czerwonego bezpiecznika (2026-09-04)

Gałąź: `agent/martwe-czat-20260904` (baza: `codex/m03-admin-20260824` @ `cfb477dc96`).
Bezpiecznik: `tests/unit/canon/reachabilityFromRoot.test.ts` →
`node scripts/dev/reachability-from-root.mjs --check-baseline`.

## 1. Stan wyjściowy (zmierzony, nie przepisany)

`--check-baseline` kończył się **exit 1** (sam `tail` w potoku pokazywał 0 — mierzone przez
`$?` bez potoku) i meldował pięć nowych plików `test-only`:

```
src/components/AIChat/Messages/MessageActions.tsx
src/components/AIChat/Messages/MessageBubble.tsx
src/components/AIChat/Messages/ThinkingBlock.tsx
src/components/AIChat/ThinkingStatusLine.tsx
src/components/MyWork/__tests__/cardContractFlagFamily.day324.test.ts
```

Sumy przed pracą: `app 3044 · harness-only 30 · test-only 1022 · unreachable 722`
(martwych łącznie 1744; przed scaleniami było 1743).

**Diagnoza potwierdzona.** Cztery pliki czatu figurowały w baseline w polu `files`
(zbiór `unreachable`) — dyżur 332 przestawił `tests/components/AIChat/MessageBubble.test.tsx`
na render **realnego** komponentu, przez co przeszły z klasy `unreachable` do `test-only`.
Ratchet porównuje zbiory osobno, więc zgłosił je jako „nowe test-only", choć są to
**przejścia między dwiema klasami martwymi**. Realnie przybył **jeden** plik:
test dyżuru 324 położony pod `src/`.

## 2. R1 — test wyprowadzony z `src/`

`src/components/MyWork/__tests__/cardContractFlagFamily.day324.test.ts`
→ `tests/unit/cards/cardContractFlagFamily.day324.test.ts` (obok sióstr
`*CardContractCompleteness.test.ts`). Test czyta pliki przez `process.cwd()`,
więc przeniesienie nie wymagało zmiany ścieżek.

Po przeniesieniu, ta sama nazwa przypadku:

```
✓ tests/unit/cards/cardContractFlagFamily.day324.test.ts >
  Day 324 card-contract flag family >
  each of the seven runtime callers reads the shared ff.cardContract key
Test Files 1 passed (1) · Tests 1 passed (1)
```

## 3. R2 — werdykt o poddrzewie czatu, dwiema niezależnymi metodami

### Metoda 1 — narzędzie repo (parser TypeScript AST)

`scripts/dev/reachability-from-root.mjs --unreachable-only` wskazał jako nieosiągalne
od `src/index.tsx`: `src/components/layout/ChatPanel.tsx`,
`src/components/AIChat/index.ts`, `src/components/AIChat/Messages/index.ts`.

### Metoda 2 — własny BFS regexowy (inny parser, ta sama definicja korzenia)

Doraźny skrypt kontrolny (poza repo, `/private/tmp/bfs-check.mjs`) przeszedł graf od
`src/index.tsx` wyrażeniami regularnymi obejmującymi `import … from`, `import '…'`,
`export … from`, `import('…')` i `require('…')` — świadomie innym mechanizmem niż AST.
Osiągnął 3052 pliki. Werdykt per plik:

| plik | metoda 2 |
|---|---|
| `src/components/layout/ChatPanel.tsx` | NIEOSIĄGALNY |
| `src/components/AIChat/index.ts` | NIEOSIĄGALNY |
| `src/components/AIChat/Messages/index.ts` | NIEOSIĄGALNY |
| `src/components/AIChat/Messages/MessageActions.tsx` | NIEOSIĄGALNY |
| `src/components/AIChat/Messages/MessageBubble.tsx` | NIEOSIĄGALNY |
| `src/components/AIChat/Messages/ThinkingBlock.tsx` | NIEOSIĄGALNY |
| `src/components/AIChat/ThinkingStatusLine.tsx` | NIEOSIĄGALNY |
| `src/components/AIChat/Messages/InlineThinkingStream.tsx` | **ŻYWY** |
| `src/components/AIChat/Messages/ReasoningTrace.tsx` | **ŻYWY** |
| `src/components/AIChat/UnifiedChatPanel.tsx` | **ŻYWY** |
| `src/components/AIChat/MessageRenderer.tsx` | **ŻYWY** |

Obie metody zgodne co do joty. Katalog `Messages/` **nie jest** martwy w całości —
`InlineThinkingStream` i `ReasoningTrace` są importowane przez żywy `MessageRenderer.tsx`.

### Metoda 3 — drogi, których statyczny graf nie widzi

- `require.context` / `import.meta.glob` w `src/`: **zero trafień**.
- `import(\`…\`)` z template-literal: **zero trafień**.
- Nazwy `'ChatPanel'`, `'AIChatView'`, `'MessageBubble'` jako stringi w rejestrach
  komponentów lub mapach tras: **zero trafień**.
- Kontrola, że grep faktycznie działa (pułapka `--include` w zsh — wszystkie grepy puszczane
  przez `bash -c` z cudzysłowami): wzorzec `React.lazy` daje **28 trafień**, `MessageRenderer`
  daje **20**. Pustka jest więc wynikiem, nie awarią komendy.

### Dowód wprost z kodu, kto renderuje czat użytkownika

`src/layouts/MainLayout.tsx:43-45`:

```
const UnifiedChatPanel = React.lazy(() =>
  import('../components/AIChat/UnifiedChatPanel').then((module) => ({
    default: module.UnifiedChatPanel,
```

MainLayout montuje `UnifiedChatPanel` (linia 485). `layout/ChatPanel.tsx` nie jest
importowany przez nikogo — jedyne odwołanie w repo to `readFileSync` w teście
kontraktowym (patrz §4). Barrele `AIChat/index.ts` i `AIChat/Messages/index.ts`
nie mają ani jednego importera.

**Werdykt: MARTWE.** Usunięto siedem plików produktowych i dwa testy, które je trzymały:

```
src/components/layout/ChatPanel.tsx
src/components/AIChat/Messages/MessageBubble.tsx
src/components/AIChat/Messages/MessageActions.tsx
src/components/AIChat/Messages/ThinkingBlock.tsx
src/components/AIChat/ThinkingStatusLine.tsx
src/components/AIChat/Messages/index.ts
src/components/AIChat/index.ts
tests/components/AIChat/MessageBubble.test.tsx
tests/components/AIChat/ThinkingBlock.test.tsx
```

`tests/components/AIChat/ThinkingBlock.test.tsx` był przy okazji testem-zombie —
renderował własną atrapę `const ThinkingBlock = () => <div .../>`, nie dotykając produktu.

**Nietknięte imiennie sprawdzone:** `src/components/AIChat/UnifiedChatPanel.tsx` (307 592 B)
i `src/components/AIChat/MessageRenderer.tsx` (130 481 B) — oba na miejscu, oba kompilują się
esbuildem, testy `MessageRenderer.messageActions` (13/13) i `MessageRenderer.direction` (2/2)
zielone. Nie ruszono też `Actions/InlineActionsList.tsx`, które **definiuje własny**
`MessageActions` (nie importuje usuniętego).

## 4. Skutek uboczny: test kontraktowy bronił martwego pliku

`src/layouts/__tests__/MainLayoutTeresaClose.contract.test.ts` czytał
`components/layout/ChatPanel.tsx` i sprawdzał w nim klasy `pl-4 pr-14 py-3`
oraz `sticky top-0 z-10`. Zmierzone: żywy `UnifiedChatPanel.tsx` **nie zawiera żadnej
z tych klas** (0 trafień), MainLayout też nie. Test przechodził 4/4 na pliku, którego
użytkownik nigdy nie widzi — dawał fałszywy komfort co do przycisku zamykania nad
lepkim nagłówkiem głosu.

Naprawa: usunięto odczyt martwego pliku i obie martwe asercje, dołożono asercję
pilnującą, że MainLayout montuje żywą powierzchnię i nie wraca do martwego panelu:

```ts
it('mounts the live chat surface (UnifiedChatPanel), not a dead panel file', () => {
  expect(layoutSource).toContain("import('../components/AIChat/UnifiedChatPanel')");
  expect(layoutSource).not.toContain('components/layout/ChatPanel');
});
```

Po naprawie: `Test Files 1 passed · Tests 5 passed (5)`.

**To pozostaje otwarte:** kontrakt „close control nad lepkim nagłówkiem głosu" nie jest
już mierzony w żadnym żywym pliku. Klasy layoutu, które miał chronić, nie istnieją
w `UnifiedChatPanel`. Nie zgaduję, jak brzmi ich odpowiednik w żywym panelu — to zadanie
dla właściciela kontraktu, nie dla tego dyżuru.

## 5. R3 — baseline

Po R1+R2 `--check-baseline` przeszedł **sam, bez dotykania baseline** (exit 0).
Ratchet nie był obchodzony ani forsowany. Baseline odświeżono następnie legalnie
(`--update-baseline` przyjął go, bo oba zbiory się skurczyły), żeby dług zszedł z ewidencji:

```
docs/.../reachability.baseline.json | 7 -------
```

Sumy po: `app 3044 · harness-only 30 · test-only 1017 · unreachable 719`
(martwych 1736, było 1744 → **ubyło 8**: siedem usuniętych + jeden test wyprowadzony z `src/`).
Liczba plików `app` bez zmian — usunięte nie były częścią produktu.

## 6. R4 — dowód mutacyjny

Bezpiecznik po zmianie nadal łapie oba kształty martwego pliku:

| mutacja | wynik |
|---|---|
| `src/components/__mutantDeadProbe.tsx` + jeden test w `tests/unit/mutant/` | `New test-only files (1)` → **exit 1** |
| ten sam plik **bez** testu | `New unreachable files (1)` → **exit 1** |
| mutacja cofnięta, baseline przywrócony przez `cp` | `Reachability baseline OK` → **exit 0** |

Pełny test bezpiecznika: `tests/unit/canon/reachabilityFromRoot.test.ts` — **3 passed (3)**.

## 7. Higiena

- `esbuild` per plik (osobno) na wszystkich zmienionych i na obu nietkniętych plikach
  żywego czatu — bez błędów.
- Liście i18n bez ubytku: **pl 35198 / en 33065** (44 użycia `t('chat.…')` w usuniętych
  plikach; kluczy nie ruszano).
- `check-list-canon.sh` — OK (naruszeń 368, baseline 368, dług nie rośnie).
- `check-focus-canon.sh --ci` — OK (baseline 61 plików / 169 wystąpień).
- `check-artefakt.sh` — OK (crimson 8, baseline 9).
- `git status --short` — czysto.

## 8. Zastane, nie moje — uczciwie

`tests/components/AIChat/UnifiedChatPanel.test.tsx` ma **4 czerwone** przypadki
(`opens a clean work panel from the chat header`, `does not render selected Canvas context
chrome in the chat side`, `passes selected Canvas text to Teresa as the active Canvas
context`, `persists a product-safe Teresa fallback when stream start fails`).
Zmierzone przez tymczasowe przywrócenie usuniętych plików (`git checkout HEAD -- …`)
i ponowne uruchomienie: **te same 4 porażki na stanie zastanym**, 66 passed w obu
przebiegach. To dług sprzed tego dyżuru, nie regresja tej zmiany.

## 9. Stan bezpiecznika na koniec

**ZIELONY.** `--check-baseline` → exit 0;
`npx vitest run tests/unit/canon/reachabilityFromRoot.test.ts` → 3 passed (3).
