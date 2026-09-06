#!/usr/bin/env bash
# Dowód naprawy Teresy (język + źródła) — 2026-09-06.
#
# Trzy wywołania na REALNYM modelu, na lokalnym stanowisku:
#   1. Czat ogólny (bez screenContext)
#   2. Kontekst modułu /initiatives
#   3. Kontekst modułu /my-work
#
# Żadne z nich NIE wysyła pola `language` — dokładnie tak, jak wołacze, które
# je pomijają. Przed naprawą każde kończyło się angielską odpowiedzią i
# `degraded: no_sources`.
#
# Użycie: API=http://127.0.0.1:4110 bash scripts/dev/teresa-dowod-20260906.sh <katalog-wyjściowy>
set -uo pipefail

API="${API:-http://127.0.0.1:4110}"
OUT="${1:-evidence/teresa-20260906}"
CONF="${KONTO:-/private/tmp/stanowisko-noc/konto.json}"
mkdir -p "$OUT"

EMAIL=$(node -e "console.log(require('$CONF').email)")
PASS=$(node -e "console.log(require('$CONF').haslo)")

TOKEN=$(curl -s -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.token||j.accessToken||(j.data&&j.data.token)||'')})")
if [ -z "$TOKEN" ]; then echo "BRAK TOKENU — przerywam"; exit 1; fi

call() {
  local name="$1" body="$2"
  echo "== $name =="
  curl -s -N -X POST "$API/api/ai/chat/stream" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -H 'Accept-Language: pl-PL,pl;q=0.9' \
    -d "$body" > "$OUT/$name.sse"
  node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(process.argv[1], "utf8");
    let text = "";
    let ledger = null, trust = null;
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      let p; try { p = JSON.parse(line.slice(6)); } catch { continue; }
      if (typeof p.text === "string") text += p.text;
      if (p.type === "source_ledger") ledger = p;
      if (p.type === "trust_bundle") trust = p.bundle;
    }
    const diacritics = (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
    const englishStopwords = (text.match(/\b(the|and|with|please|language|should|would|answer)\b/gi) || []).length;
    const out = {
      odpowiedz: text.trim(),
      dlugosc: text.trim().length,
      polskieZnaki: diacritics,
      angielskieSlowa: englishStopwords,
      degraded: ledger && ledger.degraded,
      uzyteZrodla: ledger ? ledger.used_sources.length : 0,
      zrodla: ledger ? ledger.used_sources.slice(0, 8) : [],
      model: trust && trust.model,
      klasyZrodel: trust && trust.sourceClasses,
    };
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
    console.log(`  znaki PL: ${diacritics} | ang. slowa: ${englishStopwords} | zrodla: ${out.uzyteZrodla} | degraded: ${JSON.stringify(out.degraded)}`);
    console.log(`  odpowiedz: ${out.odpowiedz.slice(0, 220).replace(/\n/g, " ")}`);
  ' "$OUT/$name.sse" "$OUT/$name.json"
}

Q='Podsumuj w jednym zdaniu, co robi ten moduł.'

call "1-czat-ogolny" "{\"message\":\"$Q\"}"
call "2-inicjatywy" "{\"message\":\"$Q\",\"context\":{\"screenContext\":{\"currentScreen\":\"/initiatives\",\"moduleId\":\"initiatives\"}}}"
call "3-moja-praca" "{\"message\":\"$Q\",\"context\":{\"screenContext\":{\"currentScreen\":\"/my-work\",\"moduleId\":\"my-work\"}}}"

echo "Gotowe → $OUT"
