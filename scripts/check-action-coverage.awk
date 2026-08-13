# check-action-coverage.awk — wykrywa akcjopodobne onClick/onSelect w
# powierzchniach src/components/MyWork/ nietraceable do IDEA_ACTION_REGISTRY.
#
# SSOT reguły: docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM.md
# §4.2 ("Automated checks fail when a visible command lacks a registry entry
# or live handler") + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md E02
# DoD ("machine check detects unregistered commands"). Wołane per plik przez
# scripts/check-action-coverage.sh (ratchet/baseline tam, nie tutaj).
#
# Uzycie: awk -f scripts/check-action-coverage.awk -- <plik.tsx>
# Wyjscie: jedna linia na naruszenie, format `<numer-linii>|<fragment>`.
#
# ── HEURYSTYKA (opisana takze w raporcie strażnika) ─────────────────────────
# Kandydat = kazde wystapienie `onClick={...}` / `onSelect={...}` w pliku.
# Dla kazdego kandydata wyciagany jest fragment (bare identifier ROZWIJANY do
# ciala nazwanego handlera z tego samego pliku, jesli je znajdziemy — const
# X = (...) => {...} albo function X(...) {...} — inline arrow brany wprost).
#
# Kandydat jest ODRZUCANY (NIE jest naruszeniem) jesli fragment zawiera
# `runIdeaAction(` — to jest kanoniczny sposob wywolania zarejestrowanej akcji
# w tym repo (16 juz wpietych plikow, patrz git grep runIdeaAction src/).
#
# Kandydat jest ZGLASZANY (akcjopodobny, nietraceable) jesli fragment:
#   - wola `Api.<Metoda>(`                              (bezposrednie IO), LUB
#   - wola `dispatchEvent(new CustomEvent(`               (drugi kanal), LUB
#   - zawiera wywolanie identyfikatora, ktorego OSTATNI segment (po kropce),
#     PO ZDJECIU prefiksu `handle`/`on` (tylko gdy nastepna litera jest wielka
#     — handleDeleteRow -> DeleteRow, onDeleteClick -> DeleteClick), zaczyna
#     sie (po malej literyzacji) od jednego z czasownikow-komend w VERBS.
#
# Czasowniki dobrane tak, by ZBUDOWANE NA `set*/toggle*/show*/hide*/open*/
# close*` przelaczniki UI (setShowX, toggleY, uiDispatch) NIE trafialy —
# zaden z nich nie zaczyna sie od czasownika-komendy z listy. To jest
# GLOWNY mechanizm niskiej liczby falszywych trafien (patrz raport).
#
# Znane ograniczenia (akceptowane — to jest bramka ratchet, nie parser AST):
#   - liczenie klamer per-linia (gsub) ignoruje klamry w stringach/template
#     literalach — rzadkie w JSX-props, ale mozliwe;
#   - rozwijanie bare-identifier dziala tylko dla handlerow zdefiniowanych
#     W TYM SAMYM pliku (nie podaza za importami);
#   - fragment jest ciety do 100 linii bezpiecznika przed nieskonczona petla;
#   - wykrywanie listy propsow dziala dla JEDNOLINIOWEJ destrukturyzacji
#     `({ a, b, onX }) => {` / `({ a, b, onX }) {}` (Pass A2, typowy styl
#     komponentow lisci — SubCard/NodeRefPicker/LineageChips ponizej) ORAZ dla
#     WIELOLINIOWEJ destrukturyzacji `({\n  a,\n  b,\n  onX,\n}) => {` (Pass A3,
#     dopisane 2026-08-10 po QG-02 — typowy styl glownego eksportowanego
#     komponentu pliku, patrz ViewRouter.tsx PlatformGridView). Pass A3
#     rozpoznaje TYLKO otwarcie konczace sie doslownie `({` na koncu linii i
#     zamkniecie zaczynajace sie `}` na poczatku linii w oknie 200 linii —
#     destrukturyzacje w INNYM stylu (np. `({ a, b,\n  onX }) => {` mieszane)
#     nadal NIE sa rozpoznawane — false negative w DRUGA strone (moze dalej
#     falszywie zgloszic), nigdy false positive (propNames tylko ODEJMUJE od
#     wyniku, nigdy nie dodaje naruszen).
#
# ── Pass A2 — propsy odbierane przez komponent (`({ ..., onX, ... }) =>`) ──
# `onClick={() => onAdd(ref)}` / `onClick={() => onRemove(idx)}` to NIE jest
# wywolanie wlasnej, lokalnie zdefiniowanej komendy — to PRZEKAZANIE zdarzenia
# UI do wlasciciela komponentu przez callback-prop nazwany po konwencji
# `onX` (dokladnie tak samo jak `onClick`/`onChange`/`onSelect` same w sobie
# sa propsami, nie komendami). Realna mutacja (jesli w ogole istnieje) siedzi
# tam, gdzie prop DOSTAJE wartosc w JSX (`<NodeRefPicker onAdd={(ref) =>
# ...}>`) — a to jest przypisanie propsa, NIE `onClick=`/`onSelect=`, wiec
# poza zakresem tego skryptu z definicji (i tak samo nietraceable jak
# `onChange`, ktory nigdy nie trafial na liste czasownikow). Bez Pass A2
# kazdy komponent-lisc z propem `onAdd`/`onRemove`/`onApprove`/`onSave`/...
# fałszywie zapala się na tej samej klasie bledu, ktora liste `set*/toggle*/
# show*/hide*/open*/close*` juz eliminuje dla stanu lokalnego — patrz raport
# zadania R10 (IdeaBusinessCaseSection.tsx L166/L207, 2026-08-10).
#
# Wylaczenie dziala TYLKO gdy `word` jest dokladnie nazwa propsa ZNALEZIONA w
# jednoliniowej licie destrukturyzacji W TYM PLIKU i NIE jest jednoczesnie
# lokalnie zdefiniowanym handlerem (`word in handlerBody`) — jesli plik SAM
# definiuje `onAdd` jako prawdziwa funkcje z cialem, ktore np. wola Api.*,
# Pass A i tak to zlapie normalnie (handlerBody wygrywa nad propNames).

function strip_prefix(word,    r) {
  r = word
  if (r ~ /^handle[A-Z]/) { r = substr(r, 7) }
  else if (r ~ /^on[A-Z]/) { r = substr(r, 3) }
  return r
}

function is_action_verb(word,    lw, i) {
  lw = tolower(word)
  for (i = 1; i <= nverbs; i++) {
    if (index(lw, verbs[i]) == 1) return 1
  }
  return 0
}

# Ekstrahuje z tekstu `text` kazdy token `identyfikator(` i zwraca 1, jesli
# ktorykolwiek (po zdjeciu prefiksu handle/on, po ostatnim segmencie kropki)
# zaczyna sie od czasownika-komendy — Z WYJATKIEM identyfikatorow, ktore sa
# ZNANYM propem-callbackiem TEGO komponentu (patrz Pass A2 / propNames) a nie
# sa jednoczesnie lokalnie zdefiniowanym handlerem w tym pliku.
function has_action_call(text,    temp, tok, parts, nseg, word, base) {
  temp = text
  while (match(temp, /[A-Za-z_][A-Za-z0-9_.]*\(/)) {
    tok = substr(temp, RSTART, RLENGTH - 1)
    nseg = split(tok, parts, ".")
    word = parts[nseg]
    base = strip_prefix(word)
    if (is_action_verb(base) && !((word in propNames) && !(word in handlerBody))) return 1
    temp = substr(temp, RSTART + RLENGTH)
  }
  return 0
}

BEGIN {
  nverbs = split("create add delete remove duplicate save apply convert export import insert merge archive restore undo redo rename move reorder publish send assign approve reject discard revert share copy paste generate submit confirm complete lock unlock pin unpin run execute upload download invite promote demote bulk sync", verbs, " ")
}

{ lines[NR] = $0; n = NR }

END {
  # ── Pass A: katalog nazwanych handlerow (const X = ... => { / function X( ) ─
  for (i = 1; i <= n; i++) {
    line = lines[i]
    name = ""
    if (match(line, /^[ \t]*(export[ \t]+)?(const|let)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*(async[ \t]+)?\([^=]*=>[ \t]*\{/)) {
      tmp = line
      sub(/^[ \t]*(export[ \t]+)?(const|let)[ \t]+/, "", tmp)
      sub(/[ \t]*=.*$/, "", tmp)
      name = tmp
    } else if (match(line, /^[ \t]*(export[ \t]+)?(async[ \t]+)?function[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*\(/)) {
      tmp = line
      sub(/^[ \t]*(export[ \t]+)?(async[ \t]+)?function[ \t]+/, "", tmp)
      sub(/[ \t]*\(.*$/, "", tmp)
      name = tmp
    }
    if (name != "" && name ~ /^[A-Za-z_][A-Za-z0-9_]*$/) {
      depth = 0; body = ""; j = i; started = 0
      while (j <= n) {
        l = lines[j]
        o = gsub(/\{/, "{", l)
        c = gsub(/\}/, "}", l)
        if (o > 0) started = 1
        depth += (o - c)
        body = body " " lines[j]
        j++
        if (started && depth <= 0) break
        if (j - i > 200) break
      }
      if (!(name in handlerBody)) handlerBody[name] = body
    }
  }

  # ── Pass A2: propsy odbierane przez komponent, jednoliniowa destrukturyzacja
  # `({ a, b, onX }) =>` / `({ a, b, onX }) {` — patrz naglowek pliku. Kazdy
  # nazwany prop pasujacy do konwencji `on[A-Z]...` idzie do propNames; wolanie
  # takiego identyfikatora w has_action_call NIE jest juz traktowane jako
  # lokalnie wlasna komenda (chyba ze plik SAM go tez definiuje jako handler —
  # handlerBody wygrywa, sprawdzane w has_action_call).
  for (i = 1; i <= n; i++) {
    line = lines[i]
    pos = 1
    while (match(substr(line, pos), /\([ \t]*\{[^{}]*\}[ \t]*\)[ \t]*(:[ \t]*[A-Za-z_][A-Za-z0-9_<>\[\],. \t]*)?[ \t]*(=>|\{)/)) {
      whole = substr(substr(line, pos), RSTART, RLENGTH)
      # wnetrze pierwszej pary { } w dopasowaniu — sama lista destrukturyzacji
      inner = whole
      sub(/^\([ \t]*\{/, "", inner)
      sub(/\}.*$/, "", inner)
      nparts = split(inner, pparts, ",")
      for (k = 1; k <= nparts; k++) {
        p = pparts[k]
        gsub(/^[ \t]+/, "", p); gsub(/[ \t]+$/, "", p)
        if (p ~ /^\.\.\./) continue
        sub(/=.*$/, "", p)          # zdejmij wartosc domyslna: `x = false`
        gsub(/[ \t]+$/, "", p)
        if (p ~ /:/) { sub(/^[^:]*:/, "", p); gsub(/^[ \t]+/, "", p) }  # `{ x: y }` -> lokalna nazwa `y`
        if (p ~ /^[A-Za-z_][A-Za-z0-9_]*$/ && p ~ /^on[A-Z]/) propNames[p] = 1
      }
      pos += RSTART + RLENGTH - 1
      if (RLENGTH == 0) pos++  # bezpiecznik przed petla zerowej dlugosci
    }
  }

  # ── Pass A3 — propsy odbierane przez komponent, WIELOLINIOWA
  # destrukturyzacja (QG-02, 2026-08-10): `export const X: React.FC<...> = ({`
  # z kazdym propem we WLASNEJ linii, zamykane `}) => {` (albo `}: Props) => {`
  # itd.) kilka/kilkanascie linii dalej — dokladny styl gl4wnego eksportowanego
  # komponentu w tym repo (patrz ViewRouter.tsx PlatformGridView, NodeDetailDrawer.tsx,
  # QG-02 inwentarz: docs/qa/ideas-complete-transformation-2026-08-09/
  # 04_ACTION_COVERAGE_INVENTORY.csv, klasa (a) "heuristic-false-negative" —
  # ta luka byla NAJWIEKSZYM pojedynczym zrodlem klasy (a): ~40/76 wpisow).
  # Ten sam prog identyfikacji propsow co Pass A2 (`^on[A-Z]...`), TA SAMA
  # gwarancja bezpieczenstwa (handlerBody wygrywa nad propNames w
  # has_action_call) — jedyna roznica to WYKRYWANIE otwarcia/zamkniecia
  # destrukturyzacji rozlozonej na wiele linii zamiast jednej.
  # Uruchamiane TYLKO gdy linia otwierajaca konczy sie doslownie na `({` —
  # jednoliniowe przypadki (z zawartoscia po `({`) zostaja Pass A2 (bez zmian,
  # zero ryzyka kolizji/podwojnego liczenia — te dwa wzorce sie wykluczaja).
  for (i = 1; i <= n; i++) {
    line = lines[i]
    if (line !~ /\([ \t]*\{[ \t]*$/) continue
    # Zamkniecie: linia zaczynajaca sie (po bialych znakach) od `}`, dalej
    # opcjonalnie `: Type`, `)`row, `=>` albo `{` — bezpiecznik 200 linii jak
    # reszta pliku (Pass A / Pass B).
    j = i + 1
    closeIdx = 0
    while (j <= n && j - i <= 200) {
      if (lines[j] ~ /^[ \t]*\}/) { closeIdx = j; break }
      j++
    }
    if (closeIdx == 0) continue  # brak zamkniecia w oknie — pomin, bezpiecznie (nie dodaje propsow)
    for (k = i + 1; k < closeIdx; k++) {
      p = lines[k]
      gsub(/^[ \t]+/, "", p); gsub(/[ \t]+$/, "", p)
      sub(/,[ \t]*$/, "", p)             # zdejmij koncowy przecinek
      if (p == "" || p ~ /^\/\//) continue  # pusta linia / komentarz liniowy
      if (p ~ /^\.\.\./) continue
      sub(/=.*$/, "", p)                 # zdejmij wartosc domyslna: `x = false,`
      gsub(/[ \t]+$/, "", p)
      if (p ~ /:/) { sub(/^[^:]*:/, "", p); gsub(/^[ \t]+/, "", p) }  # `{ x: y }` -> lokalna nazwa `y`
      # Pass A3 akceptuje DWIE konwencje nazywania propsow-callbackow: `onX`
      # (jak Pass A2) ORAZ `handleX` — sprawdzone na ViewRouter.tsx
      # PlatformGridViewProps (linie ~129-131): `handleDuplicateRow: (id:
      # string) => void` w interfejsie propsow, jednoznacznie callback, nie
      # lokalny handler tego pliku. Bezpieczne: handlerBody nadal wygrywa w
      # has_action_call (jesli plik SAM DEFINIUJE `handleX` jako prawdziwa
      # funkcje z cialem, to cialo i tak zostanie sprawdzone normalnie) —
      # rozszerzenie tylko ODEJMUJE od wyniku (propNames), nigdy nie dodaje.
      if (p ~ /^[A-Za-z_][A-Za-z0-9_]*$/ && (p ~ /^on[A-Z]/ || p ~ /^handle[A-Z]/)) propNames[p] = 1
    }
  }

  # ── Pass B: kandydaci onClick={...} / onSelect={...} ────────────────────
  for (i = 1; i <= n; i++) {
    rest = lines[i]
    while (match(rest, /on(Click|Select)=\{/)) {
      # RSTART/RLENGTH sa GLOBALNE i nadpisywane przez KAZDE kolejne match()
      # (m.in. wewnatrz has_action_call ponizej) — zapisz je NATYCHMIAST, bo
      # `rest = substr(rest, RSTART+RLENGTH)` na koncu petli uzywajac stale
      # wartosci nie przesuwa `rest` i daje petle NIESKONCZONA na tej samej
      # linii (zlapane na TableToolbar.tsx podczas developmentu tego pliku).
      mstart = RSTART; mlen = RLENGTH
      bracepos = mstart + mlen - 1
      depth = 0; snippet = ""; j = i; first = 1
      while (j <= n) {
        if (first) { seg = substr(lines[j], bracepos); first = 0 }
        else { seg = lines[j] }
        o = gsub(/\{/, "{", seg)
        c = gsub(/\}/, "}", seg)
        depth += (o - c)
        snippet = snippet " " seg
        j++
        if (depth <= 0) break
        if (j - i > 100) break
      }
      trimmed = snippet
      gsub(/^[ \t]*\{/, "", trimmed)
      gsub(/\}[ \t]*$/, "", trimmed)
      gsub(/^[ \t]+/, "", trimmed)
      gsub(/[ \t]+$/, "", trimmed)

      resolved = snippet
      if (trimmed ~ /^[A-Za-z_][A-Za-z0-9_]*$/ && (trimmed in handlerBody)) {
        resolved = resolved " " handlerBody[trimmed]
      }

      # Traceable = wolane bezposrednio runIdeaAction(...), ALBO lokalny
      # wrapper `runAction(id, run)` (WhiteboardToolbar.tsx/ProcessFlowToolbar.tsx,
      # N6/N8 wiring) — wrapper SAM sprawdza `registryActionsById.has(id)` i
      # dopiero wtedy woła runIdeaAction; falszywy negatyw (id spoza rejestru
      # cicho odpala surowy callback) jest ZNANYM, udokumentowanym w kodzie
      # kompromisem tego wrappera, nie luka tego strażnika.
      traceable = (resolved ~ /runIdeaAction\(/) || (resolved ~ /runAction\(/)
      actionlike = 0
      if (!traceable) {
        # Wyjatek strukturalny: Tiptap `editor.chain()....run()` (Notebook
        # formatting toolbar) to idiom edytora lokalnego (bold/italic/undo
        # tekstu), nie komenda Idei — bez tego wyjatku KAZDY przycisk
        # formatowania w NotebookToolbar/NotebookBubbleToolbar falszywie
        # trafia na czasownik "undo/redo/run" (patrz raport strażnika).
        if (resolved !~ /editor\.chain\(\)/) {
          if (resolved ~ /Api\.[A-Za-z0-9_]+\(/) actionlike = 1
          if (resolved ~ /dispatchEvent\(new CustomEvent\(/) actionlike = 1
          if (has_action_call(resolved)) actionlike = 1
        }
      }
      if (actionlike && !traceable) {
        out = trimmed
        gsub(/[ \t]+/, " ", out)
        if (length(out) > 90) out = substr(out, 1, 90) "…"
        print i "|" out
      }

      rest = substr(rest, mstart + mlen)
    }
  }
}
