# Warsztat runtime Teresy — v10 (`teresa-v10-runtime`)

**Status:** PROPOZYCJA — do słowa właściciela, z **rekomendacją wykluczenia z kanonu Karty N**
(nie tylko pytanie — dowód jest jednoznaczny, patrz §0/§7). Pomiar 06.09.2026 z żywego stanowiska,
zrzut `evidence/p10b8/13-ai-os-hub.png` (`bledyKonsoli: []`, rekord realny: `voice: Kore`,
`model: gemini-2.5-flash-native-audio-preview-09-2025`, status `ready`).

## §0. Tożsamość — i dlaczego to prawdopodobnie NIE jest karta N

- Nazwa PL (na ekranie, po angielsku — patrz §5): „Teresa voice workspace”.
- Moduł: `13_CHAT` wg inwentarza, ale faktyczne umiejscowienie to **`/ai`** (AI OS Hub) — ekran
  wewnętrzny, nie zakładka Czatu widziana przez klienta.
- Trasa: `/ai` (`ROUTES.AI_OS.ROOT`, `routeConfig.ts:342`), montowany jako **jeden z wielu bloków
  statycznej strony `AIOSHub`**, nie osobny ekran-obiekt z własnym adresem.
- Otwarcie: `/ai` → AIOSHub → sekcja na dole strony, obok tabeli „AI OS Build Milestones” (statyczna
  dokumentacja fal wdrożenia, jawnie oznaczona w kodzie jako „static reference”, nie żywy monitoring).
- Komponent: `src/components/v10/V10TeresaRuntimeWorkspace.tsx:6` (**74 linie** — najkrótszy
  komponent w całym inwentarzu 72 pozycji).
- Powłoka: **brak** — jeden `<section>` z trzema kaflami statusu (Voice enabled / Model /
  Unavailable reason).
- **Dowód, że to nie jest ekran dla klienta, tylko diagnostyka wewnętrzna:** trasa `/ai` jest
  owinięta w `renderInternalToolsShell(['AI OS'], <AIOSHub />)` (`AppRoutes.tsx:1802`), a ta funkcja
  (`:1162-1171`) opakowuje dziecko w **`<InternalToolsGate enabled={internalToolsEnabled}>`** —
  identyczna bramka jak dla `/ai/actions`, `/ai/research`, `/ai/artifacts` (Wave5 runtime panel),
  `/ai/context`, `/ai/connectors`, `/ai/agents`, `/ai/outcomes` (`AppRoutes.tsx:1821-1867`) — cała
  ta rodzina to **wewnętrzne narzędzia diagnostyczne**, nie moduły produktowe klienta.

## §1. Sekcje (centrum ekranu)

Nie ma katalogu sekcji — trzy kafle na sztywno (`:34-64`):

| kafel | treść | źródło danych → writer |
|---|---|---|
| Voice enabled | tak/nie + nazwa głosu | `useV10TeresaRuntime()` → `GET /api/v10/teresa/voice-config` |
| Model | nazwa modelu (np. `gemini-2.5-flash-native-audio-preview-09-2025`) | jw. |
| Unavailable reason / Diagnostics error | powód niedostępności albo „none” | jw., rozgałęzione wg `runtime.status` |

Reguła pustki: nie dotyczy — to widget statusu, zawsze coś pokazuje (albo wartość, albo „not
configured”/„none”).

## §2–§4. Prawy panel, Menu 5, AI

Nie dotyczy w żadnym punkcie — to jest 74-liniowy widget diagnostyczny (odczyt configu głosu),
nie obiekt z akcjami/właściwościami/powiązaniami. Zero AI w sensie K21-K24 (sam widget JEST
diagnostyką AI-runtime, ale nie ma przycisku generującego treść).

## §5. Czytelność — potwierdzone naruszenia na żywo

- **K17: kolory legacy, nie tokeny `c-*`.** Cały komponent używa `slate-*`/`navy-*`/`indigo-*`/
  `emerald-*`/`amber-*`/`danger-*` bezpośrednio (np. `bg-white`, `dark:bg-navy-900`,
  `text-slate-950`, `dark:text-white`) — zero `c-*` w całym pliku.
- **K25: zero i18n, 100% angielski, potwierdzone na żywo.** Zrzut (`13-ai-os-hub.png.json`)
  pokazuje dosłownie: „V10 Frontend Runtime”, „Teresa voice workspace”, „Frontend V10 surface
  backed by `/api/v10/teresa/voice-config`. It exposes the runtime state instead of leaving V10 as
  a server-only slice.”, „Voice enabled” / „yes”, „Model”, „Unavailable reason” / „none” — **żaden
  string nie przechodzi przez `t()`**, wszystko to literały JSX (potwierdzone czytaniem pliku:
  zero importu `useTranslation`/`react-i18next`). Cała otaczająca strona „AI OS Build Milestones”
  jest tak samo w 100% angielska (§ dowód w zrzucie: „Build milestones (static reference)”,
  „Documentation of the AI OS build waves…” itd.) — to spójne z resztą `AIOSHub`, nie odosobniony
  wypadek.
- K27: brak wzmianek „Teresa” w znaczeniu marki-czatu (jest „Teresa voice workspace” jako nazwa
  funkcji, nie przycisk wejścia do rozmowy) — nie dotyczy w sensie K27.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | 3 kafle na sztywno |
| K6–K16 (prawy panel, Menu 5) | n/d | to nie jest karta z tożsamością (§0) |
| **K17 zero primary/tokeny c-\*** | **✗** | `slate-`/`navy-`/inne legacy w całym pliku |
| **K25 i18n bez angielskiego** | **✗ (100%)** | zero `t()`, wszystko literałami EN, potwierdzone zrzutem |
| K27 Teresa tylko Menu 1 | n/d | nazwa funkcji, nie wejście do czatu |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []` |
| K30 zrzut z realnym rekordem | ✓ | dane realne z żywego API (`voice: Kore`, model prawdziwy) |

## §7. Luki → naprawa — rekomendacja: wykluczyć z kanonu, nie naprawiać jako Kartę N

To NIE jest karta N w żadnym praktycznym sensie: 74 linie, brak tożsamości/adresu, brak akcji, brak
sekcji, żyje za bramką narzędzi wewnętrznych (`InternalToolsGate`) obok siedmiu innych paneli
diagnostycznych tej samej rodziny (Action Center, Research Sessions, Wave5 Artifact Runtime, Context
Learning, Connector Admin, Agent Catalog, Outcome AIOps). Naprawianie go pod kanon SPEC-A (Menu 5,
prawy panel, i18n pełny) byłoby pracą włożoną w ekran, którego klient nigdy nie widzi — dokładnie
ten kształt marnotrawstwa, o którym ostrzega `KARTA_N_KONTRAKT.md` §7 („praca standaryzacyjna
została włożona w ekran, którego nikt nie widzi”, cytat o `AgentHubShell`).

Jeśli mimo to ma zostać dociągnięty do standardu wewnętrznych narzędzi (nie SPEC-A, tylko
„czytelność minimalna”):
1. **i18n albo świadome wyjątki.** Jeśli cała rodzina `/ai/*` ma zostać po angielsku jako narzędzie
   deweloperskie, warto to zapisać jako jawną decyzję (podobnie jak inne świadome wyjątki w tym
   programie), zamiast zostawiać niejednoznaczność „czy to przeoczenie czy zamysł”. Rozmiar: S
   (decyzja + jeden komentarz w kodzie), nie naprawa per-string.
2. **Tokeny `c-*`** — jeśli #1 rozstrzygnie się na „to zostaje narzędziem wewnętrznym”, ta naprawa
   traci priorytet (kolory legacy w narzędziu deweloperskim nie szkodzą klientowi).

**Pytanie do właściciela (max 1):** czy cała rodzina `/ai/*` (AI OS Hub i siedem sióstr za tą samą
bramką) ma formalny status „narzędzie wewnętrzne, poza kanonem SPEC-A i poza wymogiem i18n” — czy
to przeoczenie i ktoś kiedyś planował je otworzyć klientom? Rekomendacja: **formalizować jako
narzędzie wewnętrzne** — nazwa `InternalToolsGate` i umieszczenie obok „AI OS Build Milestones”
(jawnie „static reference”, nie runtime) sugerują świadomy zamysł, nie przeoczenie.

**STOP:** brak — dowód jest kompletny z jednego zrzutu i pełnego odczytu 74-liniowego pliku; nie ma
tu nic więcej do zmierzenia.
