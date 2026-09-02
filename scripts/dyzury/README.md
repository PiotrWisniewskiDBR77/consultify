# Generator instrukcji dyżurów

    python3 scripts/dyzury/gen_instrukcja.py cfgNNN.json bodyNNN.md <wyjscie.md>

Składa CZĘŚĆ A ze szkieletu `docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`
**dosłownie**, podmienia pola `<<KLUCZ>>` wartościami z configu, dokleja treść
merytoryczną z pliku ciała i produkuje obok plik `.wklejka.txt` z tego samego
źródła — dzięki czemu marker i porty **fizycznie nie mogą się rozjechać**
z instrukcją.

Blokuje zapis, gdy zostało niewypełnione pole `<<…>>` albo tabela `Z` nie ma
41 wierszy i 41 unikalnych etykiet.

## Dlaczego ten plik leży w repo (2026-09-02)

Do 2026-09-02 generator istniał **wyłącznie w katalogach tymczasowych sesji**
i miał **zaszytą na sztywno ścieżkę do zamrożonej kopii szkieletu** w jednym
z tych katalogów. Dwa ryzyka: narzędzie ginie razem z katalogiem sesji, a gdy
szkielet w repo się zmieni — generator po cichu produkuje instrukcje ze starych
reguł. W dniu przeniesienia snapshot i repo były jeszcze identyczne; to było
szczęście, nie zabezpieczenie. Teraz szkielet czytany jest z repo, a brak pliku
zatrzymuje generator zamiast go ominąć.

**Wiążąca jest instrukcja, wklejka jest pomocnicza.**
