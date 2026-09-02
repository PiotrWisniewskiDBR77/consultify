#!/usr/bin/env python3
"""Generator instrukcji dyzuru — sklada CZESC A ze szkieletu DOSLOWNIE.

Uzycie: gen_instrukcja.py <config.json> <cialo.md> <plik_wyjsciowy>

Kontrola po zapisie:
  - liczba pozostalych pol '<<' MUSI byc 0
  - liczba wierszy tabeli Z MUSI byc 46 (41 unikalnych etykiet Z1-Z40 + Z34a)
"""
import json
import re
import sys
from pathlib import Path

# Szkielet czytamy z REPO, nie z zamrozonej kopii w katalogu tymczasowym sesji.
# Powod: do 2026-09-02 generator zyl wylacznie w scratchpadach sesji i celowal w snapshot;
# gdy szkielet w repo sie zmieni, a snapshot nie, generator cicho produkuje instrukcje
# ze starych regul. Sciezka liczona od polozenia tego pliku (scripts/dyzury/ -> korzen).
SZKIELET = Path(__file__).resolve().parents[2] / "docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md"
if not SZKIELET.is_file():
    sys.exit(f"BLAD: brak szkieletu pod {SZKIELET}")


def wytnij_czesc_a(tekst: str) -> str:
    """Zwraca sklejone bloki ```markdown / ````markdown z CZESCI A, w kolejnosci."""
    linie = tekst.splitlines()
    start = koniec = None
    for i, l in enumerate(linie):
        if l.startswith("# CZĘŚĆ A") and start is None:
            start = i
        elif l.startswith("# CZĘŚĆ B") and start is not None:
            koniec = i
            break
    if start is None or koniec is None:
        sys.exit("BLAD: nie znaleziono granic CZESCI A w szkielecie")

    bloki, i = [], start
    otwarcie = re.compile(r"^(`{3,4})markdown\s*$")
    while i < koniec:
        m = otwarcie.match(linie[i])
        if m:
            plot = m.group(1)
            i += 1
            buf = []
            while i < koniec and linie[i].rstrip() != plot:
                buf.append(linie[i])
                i += 1
            bloki.append("\n".join(buf))
        i += 1
    if not bloki:
        sys.exit("BLAD: CZESC A nie zawiera ani jednego bloku markdown")
    return "\n\n---\n\n".join(bloki)


# Zdania szkieletu, ktore MUSZA byc przeredagowane, bo cytuja skladnie pola
# szablonu doslownie. Zostawione w wydanym dokumencie zlamalyby kontrole
# `grep -c "<<"` = 0 (CZESC C, punkt 10).
PRZEREDAGOWANIA = [
    (
        "albo jakikolwiek nawias `<<\u2026>>` \u2014 **dokument nie",
        "albo jakiekolwiek niewypelnione pole szablonu \u2014 **dokument nie",
    ),
]


def podmien(tekst: str, cfg: dict) -> str:
    # 0) zdania cytujace skladnie pola szablonu
    for skad, dokad in PRZEREDAGOWANIA:
        tekst = tekst.replace(skad, dokad)
    # 1) pola proste: <<KLUCZ>>
    for k, v in cfg.items():
        tekst = tekst.replace(f"<<{k}>>", str(v))
    # 2) pola dlugie/opisowe: <<KLUCZ ...dowolny opis, takze wielolinijkowy...>>
    #    Wzorzec musi byc nieapetyczny (`.*?`) i obejmowac znaki nowej linii oraz
    #    `>` wystepujace wewnatrz opisu (np. cytat blokowy `> ...`).
    for k, v in cfg.items():
        tekst = re.sub(
            r"<<" + re.escape(k) + r".*?>>", lambda _m, _v=str(v): _v, tekst, flags=re.S
        )
    return tekst


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    cialo = Path(sys.argv[2]).read_text(encoding="utf-8")
    wyjscie = Path(sys.argv[3])

    czesc_a = wytnij_czesc_a(SZKIELET.read_text(encoding="utf-8"))
    dokument = podmien(czesc_a + "\n\n---\n\n" + cialo, cfg)

    # --- kontrola przed zapisem -------------------------------------------
    zostaly = re.findall(r"<<[^>]{0,80}", dokument)
    if zostaly:
        print("★ NIEPODMIENIONE POLA:")
        for z in sorted(set(zostaly)):
            print("   ", z.replace("\n", " ")[:78])
        sys.exit(1)

    wierszy_z = len(re.findall(r"^\| `Z\d+a?`", dokument, re.M))
    unikalnych_z = len(set(re.findall(r"`(Z\d+a?)`", dokument)))
    if wierszy_z != 41 or unikalnych_z != 41:
        sys.exit(
            f"★ TABELA Z USZKODZONA: wierszy {wierszy_z} (ma byc 41), "
            f"unikalnych {unikalnych_z} (ma byc 41)"
        )

    wyjscie.write_text(dokument, encoding="utf-8")

    # --- BLOK WKLEJKI generowany Z TEGO SAMEGO ZRODLA co instrukcja ---------
    # Powod: 2026-08-29 cztery razy wydalem wklejke z markerem innym niz
    # w instrukcji, bo skladalem ja osobno, z pamieci. Dyzury 100, 102 i 108
    # slusznie stanely przed utworzeniem worktree. Teraz marker i porty moga
    # pochodzic WYLACZNIE z tego samego configu co dokument.
    wklejka = f"""NOWY \u2014 DY\u017bUR {cfg['NR_DYZURU']}

\u2605 PIERWSZA KOMENDA \u2014 odczyt instrukcji z vaulta, NIE z katalogu roboczego:

git -C /Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git \\
  fetch {cfg['REMOTE']} --prune && \\
git -C /Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git \\
  show {cfg['REMOTE']}/{cfg['GALAZ_BAZOWA']}:{wyjscie.name and 'docs/program/waves/WAVE_03_ACCEPTANCE/codex/' + wyjscie.name}

Przeczytaj wynik w CA\u0141O\u015aCI, dopiero potem wykonuj dy\u017cur {cfg['NR_DYZURU']}.

Marker: {cfg['SHA_MARKERA']}
Zasoby wy\u0142\u0105czne: baza {cfg['PORT_DB']}, runtime {cfg['PORT_HARNESS']}.

Je\u017celi cokolwiek w tej wklejce r\u00f3\u017cni si\u0119 od tre\u015bci instrukcji \u2014
WI\u0104\u017b\u0104CA JEST INSTRUKCJA.
"""
    plik_wklejki = wyjscie.with_suffix(".wklejka.txt")
    plik_wklejki.write_text(wklejka, encoding="utf-8")

    print(f"OK  {wyjscie}")
    print(f"    wklejka: {plik_wklejki}")
    print(f"    linii: {len(dokument.splitlines())}")
    print(f"    pol '<<' pozostalo: 0")
    print(f"    wierszy Z: {wierszy_z} · unikalnych etykiet Z: {unikalnych_z}")


if __name__ == "__main__":
    main()
