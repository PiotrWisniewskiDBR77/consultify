/**
 * STYL KART MODUŁOWYCH — trzymany osobno, żeby ten sam kod ubierał podgląd
 * statyczny (moduly-podglad.mjs) i widok na żywej stronie odbioru. Jedno źródło
 * wyglądu: gdyby styl istniał w dwóch kopiach, podgląd zatwierdzony przez
 * nadzorcę przestałby być dowodem na to, co zobaczy właściciel.
 *
 * Kolor: neutralny. Czerwień (crimson) NIE występuje — kanon CLAUDE.md UI#3
 * rezerwuje ją dla semantyki krytycznej, a „jeszcze nie" nie jest awarią, tylko
 * decyzją właściciela. Stan zamknięty = zieleń, stan otwarty = neutralny grafit.
 */
export const STYL_MODULOW = `
:root{--tlo:#f7f8fa;--karta:#fff;--tekst:#0f172a;--drugi:#475569;--kres:#e2e8f0;--ok:#15803d;--nieb:#1d4ed8;--zolty:#b45309}
*{box-sizing:border-box}
body{margin:0;background:var(--tlo);color:var(--tekst);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.pasek{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--kres);padding:12px 20px;display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
.pasek h1{font-size:16px;margin:0;font-weight:650}
.pasek .lic{color:var(--drugi);font-size:13.5px}
.mkarty{padding:20px;max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.mk{background:var(--karta);border:1px solid var(--kres);border-radius:14px;padding:20px 22px}
.mk[data-stan=zamykam]{border-color:var(--ok);box-shadow:0 0 0 2px #bbf7d0 inset}
.mk header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.mk h3{font-size:20px;margin:0;font-weight:650;letter-spacing:-.01em}
.plom{font-size:12px;padding:3px 11px;border-radius:999px;background:#f1f5f9;color:var(--drugi);font-weight:600}
.plom.zam{background:#dcfce7;color:#14532d}
.plom.jesz{background:#fef3c7;color:#92400e}
.doczego{color:var(--drugi);font-size:14.5px;margin:7px 0 0;max-width:84ch}
.liczby{display:flex;gap:18px;flex-wrap:wrap;margin:13px 0 4px;padding:10px 0;border-top:1px solid #eef1f6;border-bottom:1px solid #eef1f6}
.liczby span{font-size:13.5px;color:var(--drugi)}
.liczby b{color:var(--tekst);font-size:17px;font-variant-numeric:tabular-nums;margin-right:4px}
.liczby i{font-style:normal;font-size:12.5px;color:#94a3b8}
.liczby .uw b{color:var(--zolty)}
.mblok{margin-top:16px}
.mblok h4{font-size:14px;margin:0 0 9px;font-weight:650;display:flex;align-items:center;gap:8px}
.mblok h4 .licz{background:var(--tekst);color:#fff;border-radius:999px;font-size:11.5px;padding:1px 8px;font-variant-numeric:tabular-nums}
.mblok.pusto p{color:#64748b;font-size:13.5px;margin:0;font-style:italic}
.mblok.szary{background:#f8fafc;border:1px solid #eef1f6;border-radius:10px;padding:12px 14px}
.mblok.szary p{color:var(--drugi);font-size:13px;margin:0 0 7px}
.grupa{margin-bottom:16px}
.gopis{font-size:13.5px;color:var(--drugi);margin:0 0 9px;max-width:88ch;line-height:1.55}
.gile{display:inline-block;margin-left:7px;background:#eef2ff;color:#3730a3;border-radius:999px;font-size:11.5px;font-weight:650;padding:1px 9px;white-space:nowrap}
.mini{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.mini figure{margin:0;background:#fbfcfd;border:1px solid #eef1f6;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.mini img{width:100%;display:block;border-bottom:1px solid #eef1f6;background:#fff}
.mini figcaption{padding:8px 10px;display:flex;flex-direction:column;gap:3px}
.mini figcaption{font-size:12.5px;font-weight:600;color:var(--tekst);padding:7px 10px}
.otwarte{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.otwarte li{background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:9px 12px;display:flex;flex-direction:column;gap:4px}
.otwarte b{font-size:13px;color:#78350f}
.otwarte q{font-size:13.5px;color:#92400e;font-style:italic}
.otwarte .domyka{font-size:12.5px;color:#57534e}
.otwarte .kl{align-self:flex-start;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;border-radius:5px;padding:1px 6px;background:#e7e5e4;color:#57534e}
.otwarte .kl-ZROBIONE{background:#dcfce7;color:#14532d}
.otwarte .kl-DO_NAPRAWY{background:#fee2e2;color:#7f1d1d}
.otwarte .kl-BACKLOG{background:#e0e7ff;color:#3730a3}
.brakkorpusu{font-size:12.5px;color:var(--drugi);margin:0 0 9px;font-style:italic}
.poza{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:7px}
.poza li{background:#fff;border:1px solid var(--kres);border-radius:7px;padding:3px 9px;font-size:12.5px;color:var(--drugi)}
.poza .o{font-size:10px;font-weight:700;border-radius:4px;padding:0 4px;margin-left:4px}
.poza .oC{background:#fee2e2;color:#991b1b}.poza .oD{background:#e2e8f0;color:#475569}
.makcje{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:18px}
.mb{border:1px solid var(--kres);background:#fff;border-radius:9px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;color:var(--tekst);font-family:inherit}
.mb:hover{background:#f1f5f9}
.mb.zamykam.on{background:var(--ok);border-color:var(--ok);color:#fff}
.mb.jeszcze.on{background:var(--zolty);border-color:var(--zolty);color:#fff}
.mb.link{margin-left:auto;font-weight:500;color:var(--nieb);border-color:transparent;background:transparent;text-decoration:underline}
.mpowod{width:100%;margin-top:9px;border:1px solid var(--kres);border-radius:9px;padding:7px 11px;font-size:13.5px;font-family:inherit}
.mzapis{font-size:12px;color:#94a3b8;margin-top:6px;min-height:15px}
`;
