---
brief: whiteboard
module: Ideas → Whiteboard
sources: [tldraw.dev (scrape 2026-03), Excalidraw docs (2026-03), Miro]
status: done
updated: 2026-06-09
---

# Benchmark: Whiteboard (Ideas)

> Po co: zdefiniować feature-surface i architekturę naszego Whiteboard wobec najlepszego
> SDK na rynku (tldraw), żeby przepisać moduł Miro-style bez wynajdywania koła.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **tldraw** | Embeddable React whiteboard SDK, open-source + komercyjny | `tldraw sync` (realtime) + `AI integrations` + pełny model kształtów/bindingów |
| **Excalidraw** | Lekki, „hand-drawn", open-source | Prostota, natychmiastowy start, estetyka szkicu |
| **Miro** | Enterprise collaborative canvas | Skala, szablony, integracje, multiplayer na produkcyjną skalę |

Wniosek strategiczny: **tldraw to nasz wzorzec architektury i potencjalny silnik** (React, MIT/komercyjny), Miro to wzorzec UX/skali, Excalidraw to wzorzec prostoty onboardingu.

## 2. Feature-surface tldraw (checklist dla naszego Whiteboard)
Z nawigacji docs (`Learn tldraw` + `SDK features`) — to jest siatka kontrolna kompletności modułu:

**Rdzeń:** Editor · Shapes · Tools · User interface · Handles · Indicators · Camera system · Click detection
**Dane/trwałość:** Persistence · Assets · Bindings · Clipboard
**Współpraca:** **Collaboration** · **tldraw sync** (realtime backend)
**AI:** **AI integrations** · **LLM documentation** (kształty sterowane przez LLM)
**Jakość:** Accessibility · Actions · Animation

→ Mapuje się 1:1 na nasz `realtime-collab.md` (Liveblocks) i na integrację z Teresą (AI integrations).

## 3. Model danych / architektura
- tldraw: dokument = **store rekordów** (shapes, bindings, assets, pages, camera) z reaktywnym sygnałem.
- **Bindings** = relacje między kształtami (np. strzałka „przyklejona" do node'a) — to czego brakuje prostym whiteboardom; krytyczne dla naszego Process Flow / Mind Map.
- **Assets** = obrazy/media jako osobne rekordy z lazy-load.
→ Dla nas: schemat Whiteboard powinien być rekordowy (nie monolityczny JSON), żeby realtime-diff i undo działały per-rekord.

## 4. Realtime / API
- **tldraw sync** — gotowy wzorzec serwera realtime (presence + dokument). Alternatywa/uzupełnienie Liveblocks (patrz `realtime-collab.md`).
- yjs/Liveblocks (folder `0 Miro/added`) — CRDT jako warstwa transportu.
→ Decyzja architektoniczna do podjęcia: tldraw-sync vs Liveblocks vs własny WS.

## 5. Decyzje dla Consultify
- ✅ **Kradniemy:** rekordowy model store (shapes/bindings/assets) + feature-checklist z §2 jako definicję „kompletnego" Whiteboard.
- ✅ **Kradniemy:** wzorzec `AI integrations` — Teresa jako narzędzie na kanwie (generuj/przekształć kształty), nie tylko czat obok.
- ⚠️ **Adaptujemy:** estetykę Excalidraw (hand-drawn) jako opcjonalny styl; onboarding „pusta kanwa w 1 klik".
- ⚠️ **Adaptujemy:** Miro-style interakcje (z pamięci projektu: owner chce Miro-style UX) — ale model danych bierzemy z tldraw, nie z Miro.
- ❌ **Unikamy:** monolitycznego JSON-a całej kanwy (zabija realtime + undo granularny).
- ❌ **Unikamy:** rozjazdu z pozostałymi narzędziami Ideas — Whiteboard/Process Flow/Mind Map/Table mają dzielić model bindingów.

## 6. Otwarte pytania
- Silnik: integrujemy tldraw SDK czy budujemy własny na ich wzorcach? (licencja komercyjna tldraw vs koszt własnego)
- Warstwa realtime: tldraw sync vs Liveblocks (rozstrzygnąć w `realtime-collab.md`).
- Wspólny model bindingów dla całego Ideas — czy to jeden pakiet?

## Załączniki
Surowe źródło (do usunięcia po akceptacji briefu): `Softs/0 Whiteboard/Tldraw.zip`, `Softs/0 Miro/Excalidraw.zip`.
Uwaga: scrapy tldraw.dev są częściowo JS-renderowane (body cienkie); najwartościowsza jest mapa nawigacji = feature-surface. Pełny tekst: tldraw.dev/llms.txt (LLM documentation) — dociągnąć online przy implementacji.
