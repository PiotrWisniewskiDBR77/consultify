---
brief: realtime-collab
module: Realtime multiplayer (Canvas + Ideas: Whiteboard / Process Flow / Mind Map / Table)
sources: [Liveblocks docs (Liveblock.zip ~44.5MB, scrape), Yjs docs (yjs..zip ~9.2MB, scrape), Art 1-6 (CRDT/OT/realtime articles, scrape)]
grounding: scrape/partial
status: done
updated: 2026-06-10
---

# Benchmark: Realtime multiplayer (Canvas + Ideas)

> Po co: to jest **hub decyzji architektonicznej dla realtime** w całym produkcie.
> Referowany przez `whiteboard.md` i briefy diagramowe. Rozstrzyga: presence/awareness,
> rozwiązywanie konfliktów (CRDT vs OT), trwałość/persistence, model Liveblocks Storage vs
> Yjs, skalowanie i koszt — oraz daje ramę rekomendacji dla NASZEGO stacku.

## 0. Zakres i status źródeł (zweryfikowane realnym scrapem)
- **Liveblocks** — rozpakowane docs (`liveblocks.io/docs/...`): przeczytane Storage engine, `@liveblocks/yjs`,
  Webhooks, Limits, „sync Storage → Postgres". Tezy poniżej oparte na **realnej treści docs**, nie z pamięci.
- **Yjs** — rozpakowane `docs.yjs.dev`: przeczytane shared-types, awareness, „persisting to central DB",
  ekosystem providerów (y-websocket / y-redis / y-indexeddb / y-leveldb).
- **Art 1–6** — to zapisane (SiteSucker) artykuły, zidentyfikowane po URL-ach z logów:
  - **Art 2** — dev.to/arghya_majumder: *Operational Transformation (OT) and CRDTs — Real-Time Collaboration Systems*
  - **Art 3** — systemdesignhandbook.com: *Google Docs system design*
  - **Art 4** — **figma.com/blog: *How Figma's multiplayer technology works*** (kanon — przeczytany w całości)
  - **Art 5** — systemdr.substack.com: *CRDTs vs Operational Transformation* (Google Docs / Figma case)
  - **Art 6** — oneuptime.com/blog: *Operational Transformation* (2026-01-30)
  - **Art 1** — crackingwalnuts.com: *Maps platform system design* (tło distributed-systems, poboczne)
- Grounding: **scrape/partial** — limity/cennik Liveblocks są z migawki docs (mar 2026); przy wdrożeniu potwierdzić online.

## 1. Krajobraz opcji realtime

| Opcja | Czym jest | Killer feature | Koszt operacyjny |
|---|---|---|---|
| **Liveblocks** | Managed realtime infra (presence + Storage + hostowany Yjs + Comments) | Zero-ops, gotowe presence/awareness, hostowany Yjs i webhooks | $ wg active rooms/connections (vendor) |
| **Yjs (self-host)** | Biblioteka CRDT + transport (y-websocket / y-redis) | Pełna kontrola, offline-first, dojrzały ekosystem providerów | własny serwer WS + storage |
| **tldraw sync** | Realtime backend wzorcowany pod tldraw store | Idealne sprzężenie z modelem shape/binding tldraw | własny host (Cloudflare DO) |
| **Custom WS (model Figmy)** | Własny WebSocket + CRDT-inspired LWW na autorytatywnym serwerze | Maks. kontrola, leaner od pełnego CRDT | wysoki koszt budowy/utrzymania |

Wniosek strategiczny: **Liveblocks = najszybsza droga do produkcyjnego multiplayer**;
**Yjs = nasz „plan B" bez vendor-locka**; **tldraw sync = naturalny wybór, jeśli Whiteboard pójdzie na SDK tldraw**;
**Custom WS = anty-wzorzec dla nas** (Figma mogła, bo to był ich rdzeń biznesu — patrz §4).

## 2. Zrzuty ekranu
**Brak (0).** Brief architektoniczny — zrzuty opcjonalne. Diagramy w artykule Figmy są inline'owymi animacjami
(GIF/SVG osadzone w HTML), a obrazki z `cdn.sanity.io` to miniatury kart bloga, nie czyste diagramy architektury —
nie było czego sensownie wyciąć. Przy implementacji dograć z liveblocks.io diagram „Room / Storage / Presence".

## 3. Presence / awareness (live cursors, selekcja, „kto patrzy")
- **Model efemeryczny (NIE trwały):** kursor, selekcja, kolor/nazwa, status. Nie wchodzi do dokumentu.
- **Yjs (zweryfikowane):** awareness jest **w `y-protocols`, NIE w rdzeniu `yjs`** — to osobny, prosty
  network-agnostic CRDT. Stan = schemaless JSON + rosnący zegar; klient broadcastuje swój stan, a jeśli
  **przez 30 s nie dostanie update'u od peera — oznacza go jako offline**. Dlatego presence trzeba odświeżać cyklicznie.
- **Liveblocks:** `presence` + `others` out-of-the-box; broadcast eventów; brak własnej infry.
- **Dla nas:** presence to **osobna warstwa od trwałego dokumentu**, krytyczna dla Miro-style UX
  (live cursors + „kto edytuje ten węzeł"). **Nie zapisywać presence do DB** — tylko warstwa realtime.

## 4. Rozwiązywanie konfliktów: CRDT vs OT (sedno — potwierdzone artykułami)
- **OT (Operational Transform)** — Google Docs. Wymaga **autorytatywnego serwera** transformującego operacje
  względem version vectors. Z artykułów: transformacja jest „przetestowana raz, wdrożona centralnie", ale ma
  **setki przypadków brzegowych**; dokumenty są kompaktowe (brak metadanych per-znak); latencja serwera < 5 ms.
- **CRDT** — metadane wbudowane w strukturę → repliki konwergują **bez centralnego arbitra**; offline-first, P2P.
  Koszt: **„metadata explosion"** — string-CRDT (RGA/YATA) to **16–32 B metadanych na znak** (10 KB tekstu → ~320 KB),
  plus tombstones po usunięciach (wymaga garbage-collection / kompakcji).
- **Lekcja Figmy (Art 4, kluczowa korekta dla §1):** Figma **odrzuciła OT** (zbyt złożone dla startupu) i
  **NIE używa „prawdziwego" CRDT** — jest **CRDT-inspired**. Ponieważ serwer jest centralny, Figma usunęła
  narzut decentralizacji: konflikt = **last-writer-wins register, ale BEZ timestampu** (serwer definiuje
  kolejność zdarzeń). Dokument = **drzewo obiektów** (jak DOM); merge **per-property** (dwie zmiany różnych
  pól tego samego obiektu nie kolidują); **usuwane obiekty NIE są trzymane na serwerze** — ich properties
  lądują w **undo-bufferze klienta**, który je odtwarza przy undo (tak długie dokumenty nie puchną).
- **Niuans „intent vs convergence" (z artykułów):** ani OT, ani CRDT nie zachowują w pełni „intencji" przy
  równoległej edycji tej samej pozycji (interleaving „cdaotg"). Dla **Process Flow / Mind Map** (krawędzie/bindingi)
  potrzebny rekordowy model (`whiteboard.md` §3), by równoległe edycje strzałek nie tworzyły „wiszących" krawędzi.
- **Wybór: CRDT (lub CRDT-inspired LWW).** OT odrzucamy — droższy w utrzymaniu, gorszy offline, setki edge-case'ów.

## 5. Model danych: Liveblocks Storage vs Yjs (potwierdzone docs)
- **Liveblocks Storage** — opisany w docs jako **„persisted conflict-free data store"**; typy
  **`LiveObject` / `LiveList` / `LiveMap`**; granularny merge per-pole. Idealne pod **strukturalny stan kanwy**.
  Od **v3.14 nowy v2 storage engine** streamuje dokument z warstwy persisted (mniej RAM, większe dokumenty,
  szybszy initial load) — bez zmian w kodzie aplikacji.
- **Hostowany Yjs (Liveblocks):** rekomendowane API to **`getYjsProviderForRoom(room)`** (auto-cleanup),
  **nie** `LiveblocksYjsProvider` wprost. Offline-support przez IndexedDB jest **eksperymentalny**
  (`offlineSupport_experimental`). To ta sama warstwa dla rich-textu/edytorów.
- **Yjs (self-host):** shared types **`Y.Map` / `Y.Array` / `Y.Text` / `Y.XmlFragment` / `Y.XmlElement` / `Y.XmlText`**;
  `Y.Text`/`Y.XmlFragment` to złoty standard pod TipTap/ProseMirror (link do `canvas-overhaul.md`).
- **Mapowanie na nasze moduły:**
  - **Whiteboard** → rekordowy store (`LiveMap`/`Y.Map` per kształt) + `Y.Text` w notatkach.
  - **Process Flow / Mind Map** → `LiveMap` węzłów + `LiveList`/`Y.Array` krawędzi (bindingi jako rekordy).
  - **Table** → `LiveList<LiveObject>` wierszy (merge per-komórka, nie per-tabela).
  - **Canvas (czat split-view)** → `Y.XmlFragment` pod TipTap (rich-text współdzielony) + presence.
- **Anty-wzorzec:** monolityczny JSON całej kanwy (zabija granularny merge i undo — spójne z `whiteboard.md` §3/§5).

## 6. Trwałość / persistence (potwierdzone docs)
- **Liveblocks:** webhook **`StorageUpdated`** + **Get Storage Document REST API** → mirror do naszego Postgres.
  WAŻNE (z docs): ten webhook jest **throttlowany do 1×/60 s** (bo Storage może zmieniać się do 60×/s) — czyli
  mirror do DB jest **near-real-time, nie instant**; dla audytu/eksportu OK, dla „live" zostaje warstwa realtime.
  Endpoint musi zwracać 2xx; po 5 dniach samych fail-i Liveblocks wyłącza endpoint (jest replay z dashboardu).
- **Yjs:** my odpowiadamy za persist — `y-leveldb` / `y-redis` / własny snapshot; dokument = binarny update-log
  (`encodeStateAsUpdate`), który okresowo kompaktujemy do snapshotu. (Tutorial „persisting to central DB" w docs
  istnieje, ale treść to stub „WIP, 5 lat temu" — wzorzec znany, lecz nie ma gotowca od Yjs.)
- **Dla nas (kluczowe):** realtime-doc i **nasz Postgres SSOT to dwie różne rzeczy** — dokładnie jak Figma, która
  trzyma dokumenty w multiplayer, a komentarze/users/teams w **osobnym Postgres** (inne tradeoffy perf/offline/security).
  Zawsze autorytatywny snapshot w naszej DB (audyt, RBAC, eksport do Deliverables/EE). Realtime = edycja, DB = prawda.

## 7. Skalowanie i koszt (liczby z migawki docs — potwierdzić online)
- **Liveblocks plany** (z `platform/limits`): **Free** — 500 monthly active rooms, 10 jednoczesnych połączeń/room,
  256 MB storage, 3 000 anon connections/mc. **Pro/Team** — 500 rooms w cenie, **potem $0.03/room**; 50 conn/room;
  8 GB storage w cenie, **potem $0.15/GB**; seat $10. **Enterprise** — custom. Monthly active **users = Unlimited**
  na wszystkich planach → **rozliczenie idzie per ROOM, nie per user**. To zmienia model: przy „pokój per dokument"
  × wielu klientów B2B liczy się **liczba aktywnych pokojów/mc**, nie liczba ludzi.
- **Yjs self-host:** koszt = infra WS (sticky sessions / `y-redis` pub-sub do skalowania poziomego) + storage + ops/SRE.
- **tldraw sync:** zwykle Cloudflare Durable Objects (pokój = 1 DO) — świetne sprzężenie z tldraw, ale lock na model+CF.
- **Reguła kciuka:** do GA koszt Liveblocks << koszt zbudowania własnej infry CRDT (Figma: przejście OT→CRDT to
  ~6 miesięcy inżynierii). Self-host opłaca się przy dużej skali active-rooms / twardych wymogach data-residency.

## 8. Rekomendacja dla Consultify
**Faza 1 (GA / teraz): Liveblocks — POTWIERDZONA przez realny scrap.**
- Najszybsza droga; presence/awareness, Storage (`LiveObject/List/Map`) i hostowany Yjs out-of-the-box
  (`getYjsProviderForRoom`); `StorageUpdated` webhook → mirror do Postgres SSOT (świadomie: 1×/60 s).
- **Warunek izolacji vendor-locka:** budować na **Yjs-owym modelu danych** tam, gdzie tekst (`Y.Text`/`Y.XmlFragment`),
  i na `LiveObject/List/Map` tam, gdzie struktura — by wyjście na self-host Yjs było **migracją transportu, nie modelu**.

**Faza 2 (skala / data-residency): Yjs self-host** jako ścieżka wyjścia, jeśli koszt active-rooms lub wymogi
enterprise tego zażądają. Ten sam model danych = niska bariera migracji.

**tldraw sync — warunkowo:** jeśli `whiteboard.md` rozstrzygnie na SDK tldraw, tldraw sync jest naturalnym
backendem realtime dla samego Whiteboard; reszta Ideas (Table, Mind Map, Process Flow, Canvas-czat) idzie na
Liveblocks/Yjs → utrzymać **jedną warstwę presence**.

**Custom WS (model Figmy) — odrzucamy** poza wąskimi efemerycznymi sygnałami (np. „typing"). Figma zbudowała
własny CRDT-inspired stack, bo multiplayer był jej **rdzeniem produktu**; dla nas to miesiące pracy bez przewagi.

## 9. Decyzje dla Consultify
- ✅ **Kradniemy:** rozdział **presence (efemeryczny, `y-protocols`/Liveblocks) ↔ dokument (trwały)** — presence nigdy do DB.
- ✅ **Kradniemy:** **CRDT / CRDT-inspired LWW** jako merge (Yjs / Liveblocks-Storage); OT odrzucamy (setki edge-case'ów).
- ✅ **Kradniemy (model Figmy):** **drzewo obiektów + merge per-property + delete do undo-buffera klienta** (nie do serwera).
- ✅ **Kradniemy:** **`StorageUpdated` webhook → mirror do Postgres SSOT** (świadomie near-real-time 1×/60 s; audyt/eksport).
- ✅ **Kradniemy:** **rozdział realtime-doc vs Postgres** — jak Figma trzyma dokumenty osobno od komentarzy/users.
- ⚠️ **Adaptujemy:** Liveblocks na Fazę 1, ale **na modelu Yjs** (`getYjsProviderForRoom`), żeby migracja na self-host była tania.
- ⚠️ **Adaptujemy:** plan tombstone/GC — CRDT puchnie metadanymi (16–32 B/znak), trzeba kompakcji jak w Figmie.
- ❌ **Unikamy:** monolitycznego JSON kanwy; OT; własnego serwera CRDT na Fazę 1.
- ❌ **Unikamy:** dwóch różnych warstw presence w różnych modułach Ideas (jedna, wspólna).

## 10. Otwarte pytania
- Liveblocks: koszt liczony **per active-room/mc** (nie per user) — policzyć realnie przy „pokój per dokument" × klienci B2B.
- **Granica pokoju (Room):** per-dokument czy per-projekt? (wpływa na koszt active-rooms i model RBAC).
- Mirror SSOT: 1×/60 s throttle `StorageUpdated` wystarczy do audytu/eksportu, czy potrzebny dodatkowy snapshot on-demand?
- Jeśli Whiteboard → SDK tldraw: **tldraw sync czy Liveblocks** dla samego Whiteboard? (utrzymać jedną warstwę presence).
- Wspólny model bindingów dla całego Ideas (z `whiteboard.md` §6) — jak ujednolicić rekordy krawędzi pod CRDT.

## Załączniki
Źródła rozpakowane i przeczytane: `liveblocks.io/docs` (Storage engine, `@liveblocks/yjs`, Webhooks, Limits, Postgres-sync),
`docs.yjs.dev` (shared-types, awareness, providers), Art 1–6 (Figma multiplayer — kanon; systemdr/dev.to CRDT-vs-OT;
Google Docs / OneUptime OT). Cennik/limity Liveblocks to migawka docs — przy wdrożeniu potwierdzić na liveblocks.io.
