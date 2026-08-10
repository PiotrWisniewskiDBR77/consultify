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
#   - fragment jest ciety do 100 linii bezpiecznika przed nieskonczona petla.

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
# zaczyna sie od czasownika-komendy.
function has_action_call(text,    temp, tok, parts, nseg, word, base) {
  temp = text
  while (match(temp, /[A-Za-z_][A-Za-z0-9_.]*\(/)) {
    tok = substr(temp, RSTART, RLENGTH - 1)
    nseg = split(tok, parts, ".")
    word = parts[nseg]
    base = strip_prefix(word)
    if (is_action_verb(base)) return 1
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
