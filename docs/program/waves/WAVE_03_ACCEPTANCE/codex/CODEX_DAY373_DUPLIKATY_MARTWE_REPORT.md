# CODEX DAY 373 — duplikaty i martwe pliki

Data pomiaru: 2026-09-05. Baza: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`. Gałąź: `codex/day373-duplikaty-martwe-20260905`.

## Stan wejściowy

Instrukcję z vaulta przeczytałem do EOF (1225 linii). Dokument był `WYDANY`.

```text
MARKER OK
9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c
```

Po materializacji worktree pozostało 48 GiB; porty 6444/5584 były wolne. Tip `github-backup/grafika/m03-20260902` był przed markerem, więc praca zaczęła się dokładnie z markera, bez rebase. Checkout właściciela nie był czytany ani zmieniany; jedynym kontaktem jest dozwolony symlink `node_modules`.

Przeczytałem cztery reguły R0: martwość mierzę od korzenia; przed usunięciem klasyfikuję całą rodzinę trafień; R1-R5 mają mutacje RED→GREEN; po usunięciu rozróżniam realnych importerów od komentarzy, guardów i podobnych nazw.

## Część A — pięć napraw

| R | Zmiana | Dowód zachowania | Mutacja | Commit |
|---|---|---|---|---|
| R1 | Został jeden zewnętrzny zestaw 7 analiz + Odrzuć; w kebabie jeden link „Pokaż analizy”, zamykający menu | render, upload CSV, otwarty kebab: 7 nazw akcji po 1, Odrzuć 1, link 1; klik zamyka menu | stary blok w kebabie: 1/1 RED; przywrócenie: 1/1 GREEN | `ccd0771a04` |
| R2 | Karta „Dodaj element” otwiera właściwe `<details>` i ustawia fokus na textarea | start `open=false`; po kliknięciu `open=true` i `document.activeElement===textarea` | stary handler: RED; przywrócenie: GREEN | `53149bbec4` |
| R3 | `taskDropdown.createNew`: „Przejdź do zadań” / „Go to tasks”; fallback też uczciwy | pusty dropdown pokazuje etykietę nawigacyjną; klik zachowuje `{tab:'tasks'}` + `MY_WORK` | stary fallback: RED; przywrócenie: GREEN | `a1aa1734fc` |
| R4 | Usunięty drugi przycisk „Centrum” z identycznym handlerem | dokładnie jedna akcja nagłówka, accessible name `Inbox`, title `Open Inbox (Action Queue)`; klik zachowuje `{tab:'inbox'}` + `MY_WORK` | przywrócony dublet: RED; ponowne usunięcie: GREEN | `0fb558c125` |
| R5 | Fallback `aiChat.newChat` = „Nowa rozmowa” | render z celowo brakującym kluczem pokazuje „Nowa rozmowa” | „Nowy czat”: RED; przywrócenie: GREEN | `62c91d5be9` |

Zbiorczy przebieg: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/components/AIChat/day373-*.test.tsx --retry=0 --reporter=json ...` — 5/5 GREEN; pełne nazwy w `/private/tmp/cx-day373-duplikaty-martwe-artefakty/po-nazwy.txt`. Testy renderują komponenty i interakcje; nie czytają tekstu źródła. Każdy z pięciu zmienionych komponentów przeszedł osobny `esbuild`.

Źródła odbioru `canvas-kebab-restructure` nie rozstrzygają, który wariant Dataset ma zostać. Wpis mówi „Zobaczmy co z tego będzie” i dotyczy całej restrukturyzacji; zastosowałem regułę awaryjną: zostaje panel poza kebabem.

## Część B — pomiar od korzenia

Komenda: `node scripts/dev/reachability-from-root.mjs > .../reach-before.json`. Rzeczywisty mianownik to **17**, nie 16: 14 `unreachable` i 3 `test-only`. `ActionCenter.tsx` wyszedł `app`; komponenty `Artifacts/**` wyszły `app`, poza trzema barrelami.

| Usunięty plik | Przed | Bajty | Test / barrel / mock | Commit |
|---|---:|---:|---|---|
| `AIChat/ChatExportModal.tsx` | unreachable | 5 043 | brak | `208d349aa5` |
| `AIChat/ImageAttachment.tsx` | unreachable | 9 896 | brak | `8f2a46d731` |
| `AIChat/ChatLanguageSelector.tsx` | unreachable | 3 938 | tylko komentarz pozostał | `bb3f2595dd` |
| `AIChat/SmartSuggestions.tsx` | unreachable | 18 311 | podobne żywe nazwy nietknięte | `2323d79749` |
| `AIChat/ResponseActions.tsx` | unreachable | 6 252 | klucz/komentarz, nie import | `a633b3afe0` |
| `AIChat/ResponseQualityIndicator.tsx` | unreachable | 11 326 | brak | `40eac325ee` |
| `AIChat/DiagramArtifact.tsx` | unreachable | 6 455 | brak | `671645796d` |
| `AIChat/ChatToggleButton.tsx` | unreachable | 3 104 | brak | `206e30c844` |
| `AIChat/ChatOverlay.tsx` | unreachable | 9 201 | komentarz zniknął razem z ToggleButton | `6e5fa5279e` |
| `layout/DemoTopbarStatus.tsx` | unreachable | 6 193 | brak | `f02ba1331e` |
| `ui/HelpButton.tsx` | unreachable | 2 356 | brak | `529428413f` |
| `layout/HelpPanel.tsx` | unreachable | 13 407 | `useHelpPanel` to inny symbol | `29a6f55fc1` |
| `AIChat/ActiveModeStrip.tsx` | unreachable | 2 465 | brak | `71a25e5b90` |
| `AIChat/OrganizationMemoryPanel.tsx` | unreachable | 15 244 | pozostał tylko guard nieobecności | `c7d9b2ed4d` |
| `AIChat/PendingActionsIndicator.tsx` | test-only | 13 053 | test usunięty; dozwolony mock usunięty | `549e8c8557` |
| `AIChat/WorkCanvas/WorkCanvasShell.tsx` | test-only | 57 303 | test i martwy `WorkCanvas/index.ts` usunięte | `739f5307f4` |

Po usunięciach: globalne `unreachable` 717→702, `test-only` 1014→1012. Dla usuniętych plików nie został żaden realny import/re-export/mock. Pozostałe tekstowe trafienia są sklasyfikowane w `r6-post-grep.txt`: komentarze architektoniczne, guardy nieobecności i różne żywe symbole o podobnej nazwie.

Pakiet `UnifiedChatPanel.test.tsx` przed i po usunięciu mocka ma identyczny SHA listy `status + fullName`: `4ae11166f7b51f560d617e9d52266343f7097751cbdec12030a9ad875e49f53c`; oba przebiegi mają 70 testów i te same 4 zastane porażki. Usunięcie nie zgubiło ani nie dodało przypadku.

### STOP — InputHintStrip

Rodzaj: MERYTORYCZNY. Pomiar potwierdził `test-only`, ale KROK 0 znalazł dodatkowy realny mock `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85`, którego instrukcja nie wymienia i którego tabela licencji nie pozwala zmienić. Nie usunąłem komponentu ani jego testu i nie pozostawiłem dziurawego mocka. Gdy właściciel/nadzorca rozszerzy licencję o tę jedną linię, należy uruchomić ten pakiet przed/po, porównać `fullName`, a następnie usunąć komponent, dedykowany test i oba mocki w jednym commicie.

### Baseline reachability

Stan wejściowy już miał `reach=1`: `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts` był nowym `test-only` poza zakresem. `--update-baseline` po naszych usunięciach odmówił: `Baseline update refused: the test-only set grew`. To ten sam odziedziczony plik, nie nowe testy day373 (pliki w `tests/**` są korzeniami, nie wierszami baseline). Baseline nie był edytowany ręcznie. Końcowo: focus=0, list=0, artefakt=0, reach=1 (odziedziczone i identyczne co do przyczyny).

## Korekty wobec instrukcji

- Liście i18n na markerze: PL 35 200 / EN 33 067, nie 34 327 / 32 338. Po R1: 35 201 / 33 068; nic nie zmalało.
- Kandydaci: 17 = 14 unreachable + 3 test-only, nie 16 = 11 + 3.
- Globalny pomiar przed: 717 unreachable / 1014 test-only, choć baseline przechowuje 719 / 1017.
- `reach=1` występował już na markerze; przyczyna to plik Initiatives poza zakresem.
- Pierwszy build przeszedł transformację 10 604 modułów, po czym zakończył się `SIGABRT`/OOM przy renderowaniu chunków. Kontrolowany retry `NODE_OPTIONS=--max-old-space-size=8192 npm run build` zakończył się kodem 0 (`✓ built in 36.51s`); nie było brakujących importów.

## ZNALEZISKA POZA ZAKRESEM

- `AIChat/Artifacts/index.ts`, `Artifacts/renderers/index.ts`, `Artifacts/renderers/index2.ts`: `unreachable`; nieusunięte.
- `MyWork/table/SmartSuggestionsBar.tsx`: `unreachable`, inny moduł; nieusunięty.
- `ActionCenter.tsx`: `app`, importerzy m.in. `ExecutionHub.tsx` i `AppRoutes.tsx`; nieusunięty.
- `Artifacts/**` komponenty/renderery: `app` przez `SplitLayout`; nieusunięte.
- `Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`: zastany nowy `test-only`, blokuje aktualizację baseline.

## PYTANIA DO WŁAŚCICIELA

1. Czy potwierdzasz regułę awaryjną dla Dataset: stały panel poza kebabem zostaje, a kebab zawiera tylko „Pokaż analizy”?
2. Czy rozszerzyć licencję o usunięcie dodatkowego mocka `EnhancedChatInput.teresa-error-toast.test.tsx:85`, aby bezpiecznie usunąć `InputHintStrip`?
3. Czy nadzorca ma najpierw osobno zintegrować/zaakceptować nowy test Initiatives do baseline, aby ponowny `--update-baseline` mógł legalnie zapisać spadek day373?

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie potwierdzono produkcyjnego renderu ani urządzeń; dyżur ma dowody jsdom i kompilację per komponent.
- Pierwszy build wymagał retry z większym limitem pamięci; nie ustalono, czy domyślny limit przejdzie na hoście CI.
- Nie twierdzę, że baseline jest zielony; jest `reach=1` z przyczyną zastaną.
- Nie twierdzę, że `InputHintStrip` został usunięty.

## Artefakty

Artefakty są poza repo w `/private/tmp/cx-day373-duplikaty-martwe-artefakty/`. Kluczowe SHA-256: `reach-before.json` `7ce41894d39183a1a4384058592e317d9bb0feb6a0f743189585a51261462f4b`; `reach-after.json` `093c1b92ae7000d30f7e8a3931ef7dfcaa1b07170c1bd577852423cd38a20e55`; `r6-family-before.txt` `429553098b3de281d17e6351474cb517984882987a1cc0f08e6431b5c605a1f7`; `r6-post-grep.txt` `6474d51e819f8f6941e58aca051979062db8467e6e6e77e6ac2dc9e97ba049a9`; `po-nazwy.txt` `a139a59646febd304993619ad814999984cdc9a5d58d99cb95d0bb4f4c6b6c22`.

Nie uruchamiałem bazy, runtime, `server/src/index.ts`, drenażu outboxu ani żadnego połączenia z Railway/demo/staging/produkcją. Nie ustawiłem SMTP. Żaden e-mail, zaproszenie ani powiadomienie zewnętrzne nie zostało wysłane.
