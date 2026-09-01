// Średnia jasność (luma) pliku PNG — użyte przez bezpiecznik pary zrzutów
// light/dark. Rec. 601 luma z per-kanałowych średnich zwracanych przez
// sharp().stats() (tanie, bez czytania każdego piksela w JS).
import sharp from 'sharp';

export async function meanLuma(pngPath) {
  const stats = await sharp(pngPath).stats();
  const [r, g, b] = stats.channels;
  return 0.299 * r.mean + 0.587 * g.mean + 0.114 * b.mean;
}
